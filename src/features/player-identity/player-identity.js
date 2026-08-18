(() => {
    'use strict';

    const SOURCE = 'vimeworld-api';
    const DEFAULT_ERROR = 'api-unavailable';
    const HEAD_BASE = 'https://skin.vimeworld.com/helm/3d';

    const RANKS = Object.freeze({
        PLAYER: Object.freeze({
            name: 'Игрок',
            prefix: '',
            color: null
        }),
        VIP: Object.freeze({
            name: 'VIP',
            prefix: '[VIP]',
            color: '#55ff55'
        }),
        PREMIUM: Object.freeze({
            name: 'Premium',
            prefix: '[Premium]',
            color: '#55ffff'
        }),
        HOLY: Object.freeze({
            name: 'Holy',
            prefix: '[Holy]',
            color: '#ff55ff'
        }),
        IMMORTAL: Object.freeze({
            name: 'Immortal',
            prefix: '[Immortal]',
            color: '#ff5555'
        }),
        BUILDER: Object.freeze({
            name: 'Строитель',
            prefix: '[Builder]',
            color: '#55aaaa'
        }),
        SRBUILDER: Object.freeze({
            name: 'Старший строитель',
            prefix: '[SrBuilder]',
            color: '#00aaaa'
        }),
        MAPLEAD: Object.freeze({
            name: 'Главный картодел',
            prefix: '[MapLead]',
            color: '#ffaa00'
        }),
        YOUTUBE: Object.freeze({
            name: 'YouTube',
            prefix: '[YouTube]',
            color: '#ff0000'
        }),
        DEV: Object.freeze({
            name: 'Разработчик',
            prefix: '[Dev]',
            color: '#aa00aa'
        }),
        ORGANIZER: Object.freeze({
            name: 'Организатор',
            prefix: '[Org]',
            color: '#ffaa00'
        }),
        HELPER: Object.freeze({
            name: 'Хелпер',
            prefix: '[Хелпер]',
            color: '#00ffff'
        }),
        MODER: Object.freeze({
            name: 'Модератор',
            prefix: '[Модер]',
            color: '#1b00ff'
        }),
        WARDEN: Object.freeze({
            name: 'Старший модератор',
            prefix: '[Ст.Модер]',
            color: '#0088ff'
        }),
        CHIEF: Object.freeze({
            name: 'Главный модератор',
            prefix: '[Гл.Модер]',
            color: '#ff8800'
        }),
        ADMIN: Object.freeze({
            name: 'Администратор',
            prefix: '[Админ]',
            color: '#ff0000'
        })
    });

    function toText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function normalizeUsername(username) {
        return toText(username);
    }

    function normalizeRankKey(rank) {
        return toText(rank).toUpperCase();
    }

    function resolvePageLocaleKey() {
        const documentLocale = toText(document.documentElement?.lang).toLowerCase();

        if (documentLocale === 'en' || documentLocale.startsWith('en-')) {
            return 'en';
        }

        if (documentLocale === 'ru' || documentLocale.startsWith('ru-')) {
            return 'ru';
        }

        const pathname = toText(window.location.pathname).toLowerCase();

        if (pathname === '/en' || pathname.startsWith('/en/')) {
            return 'en';
        }

        return 'ru';
    }

    function normalizeHexColor(value) {
        const text = toText(value).replace(/^#/, '');

        if (!/^[0-9a-f]{3,4}$|^[0-9a-f]{6,8}$/i.test(text)) {
            return null;
        }

        return `#${text.toLowerCase()}`;
    }

    function collectCustomColors(customColors) {
        if (!customColors) {
            return [];
        }

        if (typeof customColors === 'string') {
            const color = normalizeHexColor(customColors);
            return color ? [color] : [];
        }

        if (Array.isArray(customColors)) {
            return customColors
                .map((item) => {
                    if (typeof item === 'string') {
                        return normalizeHexColor(item);
                    }

                    if (item && typeof item === 'object') {
                        return normalizeHexColor(
                            item.color ||
                            item.value ||
                            item.hex ||
                            item.code
                        );
                    }

                    return null;
                })
                .filter(Boolean);
        }

        if (typeof customColors === 'object') {
            const directLists = [
                customColors.colors,
                customColors.items,
                customColors.customColors,
                customColors.usernameColors
            ];

            for (const list of directLists) {
                if (Array.isArray(list)) {
                    const colors = collectCustomColors(list);
                    if (colors.length) {
                        return colors;
                    }
                }
            }

            const singleColor = normalizeHexColor(
                customColors.color ||
                customColors.value ||
                customColors.hex ||
                customColors.code ||
                customColors.usernameColor
            );

            return singleColor ? [singleColor] : [];
        }

        return [];
    }

    function isValidColorString(value) {
        const text = toText(value);

        if (!text) {
            return false;
        }

        if (typeof CSS !== 'undefined' && CSS.supports?.('color', text)) {
            return true;
        }

        if (typeof document !== 'undefined') {
            const probe = document.createElement('span');
            probe.style.color = '';
            probe.style.color = text;
            return probe.style.color !== '';
        }

        return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text) ||
            /^rgba?\(/i.test(text) ||
            /^hsla?\(/i.test(text);
    }

    function extractColorCandidate(value) {
        if (!value) {
            return null;
        }

        if (typeof value === 'string') {
            return normalizeHexColor(value) || (isValidColorString(value) ? toText(value) : null);
        }

        if (Array.isArray(value)) {
            return null;
        }

        if (typeof value === 'object') {
            const keys = [
                'color',
                'value',
                'hex',
                'code',
                'selectedColor',
                'activeColor',
                'currentColor',
                'usernameColor'
            ];

            for (const key of keys) {
                const candidate = extractColorCandidate(value[key]);
                if (candidate) {
                    return candidate;
                }
            }
        }

        return null;
    }

    function resolveCustomUsernameColor(customColors) {
        if (Array.isArray(customColors)) {
            const indexKeys = [
                'activeIndex',
                'currentIndex',
                'selectedIndex'
            ];

            for (const key of indexKeys) {
                const index = Number(customColors[key]);

                if (!Number.isInteger(index) || index < 0 || index >= customColors.length) {
                    continue;
                }

                const candidate = extractColorCandidate(customColors[index]);
                if (candidate) {
                    return candidate;
                }
            }

            const activeItems = customColors.filter((item) => (
                item &&
                typeof item === 'object' &&
                (item.active === true || item.current === true || item.selected === true)
            ));

            if (activeItems.length === 1) {
                return extractColorCandidate(activeItems[0]);
            }

            return null;
        }

        if (typeof customColors === 'string') {
            return extractColorCandidate(customColors);
        }

        if (typeof customColors === 'object') {
            const explicitKeys = [
                'usernameColor',
                'activeColor',
                'currentColor',
                'selectedColor'
            ];

            for (const key of explicitKeys) {
                const candidate = extractColorCandidate(customColors[key]);
                if (candidate) {
                    return candidate;
                }
            }

            const indexKeys = [
                'activeIndex',
                'currentIndex',
                'selectedIndex'
            ];

            for (const key of indexKeys) {
                const index = Number(customColors[key]);
                const list = Array.isArray(customColors.colors)
                    ? customColors.colors
                    : Array.isArray(customColors.items)
                        ? customColors.items
                        : null;

                if (!list || !Number.isInteger(index) || index < 0 || index >= list.length) {
                    continue;
                }

                const candidate = extractColorCandidate(list[index]);
                if (candidate) {
                    return candidate;
                }
            }

            const directColor = extractColorCandidate(customColors.color) ||
                extractColorCandidate(customColors.value);

            if (directColor) {
                return directColor;
            }
        }

        return null;
    }

    function getLocaleRankEntry(localeData, rank) {
        const ranks = localeData && localeData.ranks && typeof localeData.ranks === 'object'
            ? localeData.ranks
            : null;
        const rawRank = normalizeRankKey(rank).toLowerCase();

        if (!ranks || !rawRank) {
            return null;
        }

        return ranks[rawRank] || null;
    }

    function normalizeLocaleGradient(gradient) {
        return Array.isArray(gradient)
            ? gradient.map((value) => normalizeHexColor(value)).filter(Boolean)
            : [];
    }

    function resolveDisplayPrefix(user, rankInfo) {
        const rawPrefix = toText(user?.prefix);

        if (rawPrefix) {
            const normalized = rawPrefix.replace(/\s+/g, ' ').trim();

            if (/^\[[^\]]+\]$/.test(normalized)) {
                return normalized;
            }

            return `[${normalized.replace(/^\[|\]$/g, '')}]`;
        }

        const fallbackPrefix = toText(rankInfo?.prefix);

        return fallbackPrefix || null;
    }

    function normalizePrefixText(prefix) {
        const text = toText(prefix);

        if (!text) {
            return null;
        }

        if (/^\[[^\]]+\]$/.test(text)) {
            return text;
        }

        const normalized = text.replace(/\s+/g, ' ').trim().replace(/^\[|\]$/g, '');
        return normalized ? `[${normalized}]` : null;
    }

    function resolvePrefixAppearance(user, rankInfo, localeData) {
        const localeRank = getLocaleRankEntry(localeData, user?.rank);
        const localeColors = normalizeLocaleGradient(localeRank?.gradient);
        const localeColor = normalizeHexColor(localeRank?.color);
        const fallbackColor = toText(rankInfo?.color) || null;

        if (localeColors.length >= 2) {
            return {
                prefixColor: null,
                prefixColors: localeColors,
                prefixColorSource: 'locale-rank-gradient'
            };
        }

        if (localeColors.length === 1) {
            return {
                prefixColor: localeColors[0],
                prefixColors: localeColors,
                prefixColorSource: 'locale-rank-color'
            };
        }

        if (localeColor) {
            return {
                prefixColor: localeColor,
                prefixColors: [localeColor],
                prefixColorSource: 'locale-rank-color'
            };
        }

        if (fallbackColor) {
            return {
                prefixColor: fallbackColor,
                prefixColors: [],
                prefixColorSource: 'static-fallback'
            };
        }

        return {
            prefixColor: null,
            prefixColors: [],
            prefixColorSource: 'neutral'
        };
    }

    function resolveUsernameAppearance(user, rankInfo, localeData) {
        const explicitCustomColor = resolveCustomUsernameColor(user?.customColors);
        const customColors = collectCustomColors(user?.customColors);
        const localeRank = getLocaleRankEntry(localeData, user?.rank);
        const localeColors = normalizeLocaleGradient(localeRank?.gradient);

        if (explicitCustomColor) {
            return {
                usernameColor: explicitCustomColor,
                usernameColors: [explicitCustomColor],
                colorSource: 'custom',
                appearanceSource: 'profile-api'
            };
        }

        if (customColors.length >= 2) {
            return {
                usernameColor: null,
                usernameColors: customColors,
                colorSource: 'custom-gradient',
                appearanceSource: 'profile-api'
            };
        }

        if (customColors.length === 1) {
            return {
                usernameColor: customColors[0],
                usernameColors: customColors,
                colorSource: 'custom',
                appearanceSource: 'profile-api'
            };
        }

        if (localeColors.length >= 2) {
            return {
                usernameColor: null,
                usernameColors: localeColors,
                colorSource: 'locale-gradient',
                appearanceSource: 'locale-api'
            };
        }

        if (localeColors.length === 1) {
            return {
                usernameColor: localeColors[0],
                usernameColors: localeColors,
                colorSource: 'locale-color',
                appearanceSource: 'locale-api'
            };
        }

        if (rankInfo?.color) {
            return {
                usernameColor: rankInfo.color,
                usernameColors: [],
                colorSource: 'rank-fallback',
                appearanceSource: 'static-fallback'
            };
        }

        return {
            usernameColor: null,
            usernameColors: [],
            colorSource: 'neutral',
            appearanceSource: 'static-fallback'
        };
    }

    function applyPrefixAppearance(prefixElement, player) {
        if (!prefixElement) {
            return;
        }

        prefixElement.classList.remove('vrh-player-identity__prefix--gradient');
        prefixElement.style.backgroundImage = '';
        prefixElement.style.backgroundRepeat = '';
        prefixElement.style.backgroundSize = '';
        prefixElement.style.backgroundPosition = '';
        prefixElement.style.backgroundClip = '';
        prefixElement.style.webkitBackgroundClip = '';
        prefixElement.style.webkitTextFillColor = '';
        prefixElement.style.color = '';

        const colors = Array.isArray(player?.prefixColors)
            ? player.prefixColors.filter(Boolean)
            : [];

        if (colors.length >= 2) {
            prefixElement.classList.add('vrh-player-identity__prefix--gradient');
            prefixElement.style.backgroundImage = `linear-gradient(90deg, ${colors.join(', ')})`;
            prefixElement.style.backgroundRepeat = 'no-repeat';
            prefixElement.style.backgroundSize = '100% 100%';
            prefixElement.style.backgroundPosition = '0 0';
            prefixElement.style.color = 'transparent';
            prefixElement.style.webkitTextFillColor = 'transparent';
            return;
        }

        if (colors.length === 1) {
            prefixElement.style.color = colors[0];
            return;
        }

        if (player?.prefixColor) {
            prefixElement.style.color = player.prefixColor;
        }
    }

    function getHeadUrl(username) {
        const normalized = normalizeUsername(username);

        if (!normalized) {
            return null;
        }

        return `${HEAD_BASE}/${encodeURIComponent(normalized)}.png`;
    }

    function getRankInfo(rank) {
        const rawRank = normalizeRankKey(rank);

        if (!rawRank) {
            return {
                name: null,
                prefix: null,
                color: null
            };
        }

        const mapped = RANKS[rawRank];

        if (mapped) {
            return { ...mapped };
        }

        return {
            name: rawRank,
            prefix: `[${rawRank}]`,
            color: null
        };
    }

    function buildUnavailablePlayer(username, error) {
        const rankInfo = getRankInfo(null);
        return {
            id: null,
            username: normalizeUsername(username) || username || null,
            rank: null,
            ranks: [],
            prefix: null,
            displayPrefix: null,
            effectivePrefix: null,
            customColors: null,
            prime: null,
            primeIcon: null,
            guild: null,
            prefixColor: null,
            prefixColors: [],
            prefixColorSource: 'neutral',
            usernameColor: null,
            usernameColors: [],
            colorSource: 'neutral',
            appearanceSource: 'static-fallback',
            rankInfo,
            online: false,
            onlineMessage: null,
            game: null,
            lastSeen: null,
            headUrl: getHeadUrl(username),
            source: SOURCE,
            available: false,
            error: error || DEFAULT_ERROR
        };
    }

    function mergePlayerModel(user, session, localeData) {
        if (!user || !user.available) {
            return buildUnavailablePlayer(user?.requestedName || user?.username, user?.error);
        }

        if (!session || !session.available) {
            const rankInfo = getRankInfo(user.rank);
            const usernameAppearance = resolveUsernameAppearance(user, rankInfo, localeData);
            const prefixAppearance = resolvePrefixAppearance(user, rankInfo, localeData);
            return {
                id: user.id ?? null,
                username: user.username || null,
                rank: user.rank || null,
                ranks: Array.isArray(user.ranks) ? [ ...user.ranks ] : [],
                prefix: user.prefix || null,
                displayPrefix: resolveDisplayPrefix(user, rankInfo),
                effectivePrefix: resolveDisplayPrefix(user, rankInfo),
                customColors: user.customColors ?? null,
                prime: user.prime ?? null,
                primeIcon: user.primeIcon ?? null,
                guild: user.guild ?? null,
                prefixColor: prefixAppearance.prefixColor,
                prefixColors: prefixAppearance.prefixColors,
                prefixColorSource: prefixAppearance.prefixColorSource,
                usernameColor: usernameAppearance.usernameColor,
                usernameColors: usernameAppearance.usernameColors,
                colorSource: usernameAppearance.colorSource,
                appearanceSource: usernameAppearance.appearanceSource,
                rankInfo,
                online: null,
                onlineMessage: null,
                game: null,
                lastSeen: user.lastSeen ?? null,
                headUrl: getHeadUrl(user.username),
                source: SOURCE,
                available: false,
                error: session?.error || DEFAULT_ERROR
            };
        }

        const username = session.username || user.username || null;
        const rank = user.rank || session.rank || null;
        const rankInfo = getRankInfo(rank);
        const usernameAppearance = resolveUsernameAppearance(user, rankInfo, localeData);
        const prefixAppearance = resolvePrefixAppearance(user, rankInfo, localeData);

        return {
            id: user.id ?? session.id ?? null,
            username,
            rank,
            ranks: Array.isArray(user.ranks) ? [ ...user.ranks ] : [],
            prefix: user.prefix || null,
            displayPrefix: resolveDisplayPrefix(user, rankInfo),
            effectivePrefix: resolveDisplayPrefix(user, rankInfo),
            customColors: user.customColors ?? null,
            prime: user.prime ?? null,
            primeIcon: user.primeIcon ?? null,
            guild: user.guild ?? null,
            prefixColor: prefixAppearance.prefixColor,
            prefixColors: prefixAppearance.prefixColors,
            prefixColorSource: prefixAppearance.prefixColorSource,
            usernameColor: usernameAppearance.usernameColor,
            usernameColors: usernameAppearance.usernameColors,
            colorSource: usernameAppearance.colorSource,
            appearanceSource: usernameAppearance.appearanceSource,
            rankInfo,
            online: typeof session.online === 'boolean' ? session.online : null,
            onlineMessage: session.onlineMessage ?? null,
            game: session.game ?? null,
            lastSeen: session.lastSeen ?? user.lastSeen ?? null,
            headUrl: getHeadUrl(username),
            source: SOURCE,
            available: true,
            error: null
        };
    }

    async function resolvePlayers(usernames, { withDiagnostics = false } = {}) {
        const requestedNames = Array.isArray(usernames)
            ? usernames
            : [];
        const uniqueNames = [];
        const seen = new Set();

        requestedNames.forEach((value) => {
            const username = normalizeUsername(value);

            if (!username) {
                return;
            }

            const key = username.toLowerCase();

            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            uniqueNames.push(username);
        });

        if (!uniqueNames.length) {
            return withDiagnostics
                ? {
                    players: [],
                    diagnostics: new Map()
                }
                : [];
        }

        const cache = window.VimeReportPlayerCache;
        const api = window.VimeReportPlayerApi;

        const usersByName = new Map();
        const sessionIdsToFetch = [];
        const sessionIdToName = new Map();
        const diagnosticsByName = new Map();

        uniqueNames.forEach((name) => {
            const cachedUser = cache.getProfile(name);

            if (cachedUser) {
                usersByName.set(name.toLowerCase(), {
                    ...cachedUser,
                    requestedName: name
                });
                diagnosticsByName.set(name.toLowerCase(), {
                    profileCacheHit: true,
                    sessionCacheHit: false
                });
                return;
            }

            diagnosticsByName.set(name.toLowerCase(), {
                profileCacheHit: false,
                sessionCacheHit: false
            });
        });

        const missingNames = uniqueNames.filter((name) => !usersByName.has(name.toLowerCase()));
        const fetchedUsers = missingNames.length
            ? await api.getUsersByNames(missingNames)
            : [];

        fetchedUsers.forEach((user) => {
            if (!user || !user.requestedName) {
                return;
            }

            const key = user.requestedName.toLowerCase();
            usersByName.set(key, user);
            cache.setProfile(user.requestedName, user);
        });

        const localeKey = resolvePageLocaleKey();
        let appearanceLocale = null;
        let appearanceCacheHit = false;
        let appearanceFetched = false;

        const needsLocaleAppearance = uniqueNames.length > 0;

        if (needsLocaleAppearance) {
            const cachedAppearance = cache.getAppearance(localeKey);

            if (cachedAppearance) {
                appearanceLocale = cachedAppearance;
                appearanceCacheHit = true;
            } else {
                const fetchedAppearance = await api.getLocale(localeKey);

                appearanceFetched = true;

                if (fetchedAppearance && fetchedAppearance.available) {
                    appearanceLocale = fetchedAppearance;
                    cache.setAppearance(localeKey, fetchedAppearance);
                }
            }
        }

        uniqueNames.forEach((name) => {
            const user = usersByName.get(name.toLowerCase());

            if (!user || !user.available || user.id === null) {
                return;
            }

            const cachedSession = cache.getSession(user.id);

            if (cachedSession) {
                sessionIdToName.set(String(user.id), cachedSession);
                const diagnostics = diagnosticsByName.get(name.toLowerCase()) || {
                    profileCacheHit: false,
                    sessionCacheHit: false
                };
                diagnostics.sessionCacheHit = true;
                diagnosticsByName.set(name.toLowerCase(), diagnostics);
                return;
            }

            const diagnostics = diagnosticsByName.get(name.toLowerCase()) || {
                profileCacheHit: false,
                sessionCacheHit: false
            };
            diagnostics.sessionCacheHit = false;
            diagnosticsByName.set(name.toLowerCase(), diagnostics);
            sessionIdsToFetch.push(String(user.id));
        });

        const fetchedSessions = sessionIdsToFetch.length
            ? await api.getSessionsByIds(sessionIdsToFetch)
            : [];

        fetchedSessions.forEach((session) => {
            if (!session || session.id === null) {
                return;
            }

            sessionIdToName.set(String(session.id), session);
            cache.setSession(session.id, session);
        });

        const players = uniqueNames.map((name) => {
            const user = usersByName.get(name.toLowerCase());

            if (!user) {
                return buildUnavailablePlayer(name, DEFAULT_ERROR);
            }

            const session = user.id === null
                ? null
                : sessionIdToName.get(String(user.id)) || null;

            return mergePlayerModel(user, session, appearanceLocale);
        });

        if (withDiagnostics) {
            return {
                players,
                diagnostics: diagnosticsByName,
                appearanceDiagnostics: {
                    locale: localeKey,
                    cacheHit: appearanceCacheHit,
                    fetched: appearanceFetched,
                    source: appearanceLocale ? 'locale-api' : null
                }
            };
        }

        return players;
    }

    class VimeReportPlayerIdentity {
        async getPlayer(username) {
            const normalized = normalizeUsername(username);

            if (!normalized) {
                return buildUnavailablePlayer(username, 'invalid-username');
            }

            const players = await resolvePlayers([username]);
            return players[0] || buildUnavailablePlayer(username, 'not-found');
        }

        async getPlayers(usernames) {
            return resolvePlayers(usernames);
        }

        getRankInfo(rank) {
            return getRankInfo(rank);
        }

        getHeadUrl(username) {
            return getHeadUrl(username);
        }

        getStatus() {
            return {
                source: SOURCE,
                api: window.VimeReportPlayerApi.getStatus(),
                cache: window.VimeReportPlayerCache.getStats(),
                ranks: Object.keys(RANKS).length
            };
        }

        async debug(username) {
            const name = normalizeUsername(username);

            if (!name) {
                return buildUnavailablePlayer(username, 'invalid-username');
            }

            const result = await resolvePlayers([name], {
                withDiagnostics: true
            });
            const player = result.players[0] || buildUnavailablePlayer(name, 'not-found');
            const diagnostics = result.diagnostics.get(name.toLowerCase()) || {
                profileCacheHit: false,
                sessionCacheHit: false
            };
            const appearanceDiagnostics = result.appearanceDiagnostics || {
                locale: null,
                cacheHit: false,
                fetched: false,
                source: null
            };
            const appearanceSummary = {
                customColorsCount: Array.isArray(player.customColors) ? player.customColors.length : 0,
                usernameColorsCount: Array.isArray(player.usernameColors) ? player.usernameColors.length : 0,
                localeRankGradientCount: Array.isArray(player.usernameColors) && player.appearanceSource === 'locale-api'
                    ? player.usernameColors.length
                    : 0,
                localeRankHasGradient: player.appearanceSource === 'locale-api' &&
                    Array.isArray(player.usernameColors) &&
                    player.usernameColors.length > 1,
                locale: appearanceDiagnostics.locale
            };

            const output = {
                username: player.username,
                id: player.id,
                rawRank: player.rank,
                ranks: player.ranks ?? [],
                'rank name': player.rankInfo?.name ?? null,
                rawPrefix: player.prefix ?? null,
                displayPrefix: player.displayPrefix ?? null,
                effectivePrefix: player.effectivePrefix ?? player.displayPrefix ?? null,
                rankColor: player.rankInfo?.color ?? null,
                prefixColors: player.prefixColors ?? [],
                prefixColor: player.prefixColor ?? null,
                prefixColorSource: player.prefixColorSource ?? null,
                customColors: player.customColors ?? null,
                usernameColors: player.usernameColors ?? [],
                usernameColor: player.usernameColor ?? null,
                colorSource: player.colorSource ?? null,
                appearanceSource: player.appearanceSource ?? null,
                prime: player.prime ?? null,
                primeIcon: player.primeIcon ?? null,
                guild: player.guild ?? null,
                online: player.online,
                'online message': player.onlineMessage,
                game: player.game,
                headUrl: player.headUrl,
                'profile cache hit/miss': diagnostics.profileCacheHit ? 'hit' : 'miss',
                'session cache hit/miss': diagnostics.sessionCacheHit ? 'hit' : 'miss',
                'appearance cache hit/miss': appearanceDiagnostics.cacheHit ? 'hit' : (appearanceDiagnostics.fetched ? 'miss' : 'n/a'),
                rawAppearanceData: appearanceSummary
            };

            console.group('[Vime Report Helper] Player Identity');
            console.table([output]);
            console.groupEnd();

            return output;
        }
    }

    window.VimeReportPlayerIdentity = new VimeReportPlayerIdentity();
})();
