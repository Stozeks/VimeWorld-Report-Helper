(() => {
    'use strict';

    const API_BASE = 'https://api.vimeworld.com';
    const REQUEST_TIMEOUT_MS = 4000;
    const SOURCE = 'vimeworld-api';
    const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

    function toText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map((item) => (
                item && typeof item === 'object'
                    ? { ...item }
                    : item
            ));
        }

        if (value && typeof value === 'object') {
            return { ...value };
        }

        return value === undefined ? null : value;
    }

    function normalizeUsername(username) {
        const text = toText(username);

        if (!text || !USERNAME_PATTERN.test(text)) {
            return '';
        }

        return text;
    }

    function normalizeId(id) {
        const text = id === null || id === undefined
            ? ''
            : String(id).trim();

        if (!/^\d+$/.test(text)) {
            return '';
        }

        return text;
    }

    function normalizeLocaleKey(locale) {
        const text = toText(locale).toLowerCase();

        if (text === 'en' || text.startsWith('en-')) {
            return 'en';
        }

        if (text === 'ru' || text.startsWith('ru-')) {
            return 'ru';
        }

        return '';
    }

    function uniqueValues(values, normalizer) {
        const result = [];
        const seen = new Set();

        if (!Array.isArray(values)) {
            return result;
        }

        values.forEach((value) => {
            const normalized = normalizer(value);

            if (!normalized) {
                return;
            }

            const key = normalized.toLowerCase();

            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            result.push(normalized);
        });

        return result;
    }

    function extractRecords(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (!payload || typeof payload !== 'object') {
            return [];
        }

        const keys = [
            'data',
            'users',
            'user',
            'result',
            'results',
            'response',
            'sessions',
            'session',
            'items'
        ];

        for (const key of keys) {
            if (Array.isArray(payload[key])) {
                return payload[key];
            }
        }

        if (typeof payload.id !== 'undefined') {
            return [payload];
        }

        return [];
    }

    function mapHttpError(status) {
        if (status === 429) {
            return 'api-rate-limited';
        }

        if (status === 404) {
            return 'api-not-found';
        }

        return 'api-unavailable';
    }

    async function fetchJson(url) {
        const controller = typeof AbortController === 'function'
            ? new AbortController()
            : null;

        const timer = controller
            ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
            : null;

        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'omit',
                cache: 'no-store',
                signal: controller ? controller.signal : undefined
            });

            if (!response.ok) {
                return {
                    ok: false,
                    error: mapHttpError(response.status),
                    status: response.status
                };
            }

            const text = await response.text();

            if (!text) {
                return {
                    ok: true,
                    data: null
                };
            }

            try {
                return {
                    ok: true,
                    data: JSON.parse(text)
                };
            } catch (error) {
                return {
                    ok: false,
                    error: 'malformed-json'
                };
            }
        } catch (error) {
            if (error && error.name === 'AbortError') {
                return {
                    ok: false,
                    error: 'api-timeout'
                };
            }

            return {
                ok: false,
                error: 'api-unavailable'
            };
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }

    function buildUnavailableUser(username, error) {
        return {
            id: null,
            username,
            rank: null,
            ranks: [],
            prefix: null,
            customColors: null,
            prime: null,
            primeIcon: null,
            guild: null,
            lastSeen: null,
            available: false,
            error,
            source: SOURCE,
            requestedName: username
        };
    }

    function buildUnavailableSession(id, error) {
        return {
            id: toNumber(id),
            username: null,
            online: null,
            onlineMessage: null,
            game: null,
            lastSeen: null,
            available: false,
            error,
            source: SOURCE,
            requestedId: normalizeId(id)
        };
    }

    function buildUnavailableLocale(locale, error) {
        return {
            locale: normalizeLocaleKey(locale) || null,
            ranks: {},
            available: false,
            error,
            source: SOURCE,
            requestedLocale: normalizeLocaleKey(locale) || locale || null
        };
    }

    function normalizeRankEntry(raw) {
        const gradient = Array.isArray(raw?.gradient)
            ? raw.gradient.map((value) => toText(value).replace(/^#/, '').toLowerCase()).filter((value) => /^[0-9a-f]{3,8}$/.test(value))
            : [];

        return {
            name: toText(raw?.name) || null,
            prefix: toText(raw?.prefix) || null,
            color: toText(raw?.color).replace(/^#/, '').toLowerCase() || null,
            gradient
        };
    }

    function normalizeLocaleResponse(raw, requestedLocale) {
        const ranks = {};
        const rawRanks = raw && typeof raw.ranks === 'object' && raw.ranks !== null
            ? raw.ranks
            : {};

        Object.keys(rawRanks).forEach((key) => {
            const normalizedKey = toText(key).toLowerCase();

            if (!normalizedKey) {
                return;
            }

            ranks[normalizedKey] = normalizeRankEntry(rawRanks[key]);
        });

        return {
            locale: normalizeLocaleKey(requestedLocale) || null,
            ranks,
            available: true,
            error: null,
            source: SOURCE,
            requestedLocale: normalizeLocaleKey(requestedLocale) || requestedLocale || null
        };
    }

    function normalizeUserRecord(raw, requestedName) {
        return {
            id: toNumber(raw?.id),
            username: toText(raw?.username) || requestedName,
            rank: toText(raw?.rank).toUpperCase() || null,
            ranks: Array.isArray(raw?.ranks)
                ? raw.ranks.map((value) => toText(value).toUpperCase()).filter(Boolean)
                : [],
            prefix: toText(raw?.prefix) || null,
            customColors: cloneValue(raw?.customColors),
            prime: cloneValue(raw?.prime),
            primeIcon: toText(raw?.primeIcon) || null,
            guild: cloneValue(raw?.guild),
            lastSeen: toNumber(raw?.lastSeen),
            available: true,
            error: null,
            source: SOURCE,
            requestedName
        };
    }

    function normalizeSessionRecord(raw, requestedId) {
        const onlineData = raw && typeof raw.online === 'object'
            ? raw.online
            : null;

        return {
            id: toNumber(raw?.id),
            username: toText(raw?.username) || null,
            online: typeof onlineData?.value === 'boolean'
                ? onlineData.value
                : (typeof raw?.online === 'boolean' ? raw.online : null),
            onlineMessage: toText(onlineData?.message) ||
                toText(raw?.onlineMessage) ||
                toText(raw?.message) ||
                null,
            game: toText(raw?.game) ||
                toText(raw?.server) ||
                null,
            lastSeen: toNumber(raw?.lastSeen),
            available: true,
            error: null,
            source: SOURCE,
            requestedId: normalizeId(requestedId)
        };
    }

    function normalizeLookupResponse(records, requestedValues, requestKey) {
        const map = new Map();

        records.forEach((record) => {
            if (!record || typeof record !== 'object') {
                return;
            }

            const key = requestKey === 'username'
                ? toText(record.username).toLowerCase()
                : normalizeId(record.id);

            if (!key) {
                return;
            }

            map.set(key, record);
        });

        return requestedValues.map((requestedValue) => {
            const key = requestKey === 'username'
                ? requestedValue.toLowerCase()
                : normalizeId(requestedValue);
            const record = map.get(key);

            if (!record) {
                return requestKey === 'username'
                    ? buildUnavailableUser(requestedValue, 'not-found')
                    : buildUnavailableSession(requestedValue, 'not-found');
            }

            return requestKey === 'username'
                ? normalizeUserRecord(record, requestedValue)
                : normalizeSessionRecord(record, requestedValue);
        });
    }

    class VimeReportPlayerApi {
        async getUsersByNames(names) {
            const requestedNames = uniqueValues(names, normalizeUsername);

            if (!requestedNames.length) {
                return [];
            }

            const url = `${API_BASE}/user/name/${requestedNames
                .map((name) => encodeURIComponent(name))
                .join(',')}`;
            const response = await fetchJson(url);

            if (!response.ok) {
                return requestedNames.map((name) => buildUnavailableUser(name, response.error));
            }

            const records = extractRecords(response.data);
            return normalizeLookupResponse(records, requestedNames, 'username');
        }

        async getSessionsByIds(ids) {
            const requestedIds = uniqueValues(ids, normalizeId);

            if (!requestedIds.length) {
                return [];
            }

            const url = `${API_BASE}/user/session/${requestedIds
                .map((id) => encodeURIComponent(id))
                .join(',')}`;
            const response = await fetchJson(url);

            if (!response.ok) {
                return requestedIds.map((id) => buildUnavailableSession(id, response.error));
            }

            const records = extractRecords(response.data);
            return normalizeLookupResponse(records, requestedIds, 'id');
        }

        async getPlayers(names) {
            const requestedNames = uniqueValues(names, normalizeUsername);
            const users = await this.getUsersByNames(requestedNames);
            const ids = users
                .filter((user) => user && user.available && user.id !== null)
                .map((user) => String(user.id));
            const sessions = ids.length
                ? await this.getSessionsByIds(ids)
                : [];
            const sessionsById = new Map(
                sessions
                    .filter((session) => session && session.id !== null)
                    .map((session) => [String(session.id), session])
            );

            return users.map((user) => {
                if (!user || !user.available) {
                    return user;
                }

                const session = sessionsById.get(String(user.id));

                if (!session || !session.available) {
                    return {
                        ...user,
                        online: null,
                        onlineMessage: null,
                        game: null,
                        available: false,
                        error: session?.error || 'api-unavailable'
                    };
                }

                return {
                    ...user,
                    online: typeof session.online === 'boolean' ? session.online : null,
                    onlineMessage: session.onlineMessage,
                    game: session.game,
                    lastSeen: session.lastSeen ?? user.lastSeen,
                    available: true,
                    error: null
                };
            });
        }

        async getLocale(locale) {
            const requestedLocale = normalizeLocaleKey(locale);

            if (!requestedLocale) {
                return buildUnavailableLocale(locale, 'invalid-locale');
            }

            const url = `${API_BASE}/locale/${requestedLocale}`;
            const response = await fetchJson(url);

            if (!response.ok) {
                return buildUnavailableLocale(requestedLocale, response.error);
            }

            return normalizeLocaleResponse(response.data, requestedLocale);
        }

        getStatus() {
            return {
                baseUrl: API_BASE,
                requestTimeoutMs: REQUEST_TIMEOUT_MS,
                endpoints: {
                    usersByName: `${API_BASE}/user/name/{names}`,
                    sessionsById: `${API_BASE}/user/session/{ids}`,
                    locale: `${API_BASE}/locale/{locale}`
                }
            };
        }
    }

    window.VimeReportPlayerApi = new VimeReportPlayerApi();
})();
