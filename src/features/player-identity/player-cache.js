(() => {
    'use strict';

    const DEFAULT_PROFILE_TTL_MS = 5 * 60 * 1000;
    const DEFAULT_SESSION_TTL_MS = 30 * 1000;
    const DEFAULT_APPEARANCE_TTL_MS = 15 * 60 * 1000;
    const DEFAULT_MAX_ENTRIES = 250;

    function normalizeUsername(username) {
        if (typeof username !== 'string') {
            return '';
        }

        return username.trim().toLowerCase();
    }

    function normalizeId(id) {
        if (id === null || id === undefined) {
            return '';
        }

        return String(id).trim();
    }

    function cloneValue(value) {
        if (!value || typeof value !== 'object') {
            return value;
        }

        return {
            ...value,
            ranks: Array.isArray(value.ranks) ? [ ...value.ranks ] : value.ranks,
            rankInfo: value.rankInfo && typeof value.rankInfo === 'object'
                ? { ...value.rankInfo }
                : value.rankInfo
        };
    }

    class VimeReportPlayerCache {
        constructor() {
            this.PROFILE_TTL_MS = DEFAULT_PROFILE_TTL_MS;
            this.SESSION_TTL_MS = DEFAULT_SESSION_TTL_MS;
            this.APPEARANCE_TTL_MS = DEFAULT_APPEARANCE_TTL_MS;
            this.MAX_ENTRIES = DEFAULT_MAX_ENTRIES;

            this.profileCache = new Map();
            this.sessionCache = new Map();
            this.appearanceCache = new Map();

            this.profileHits = 0;
            this.profileMisses = 0;
            this.sessionHits = 0;
            this.sessionMisses = 0;
            this.appearanceHits = 0;
            this.appearanceMisses = 0;
        }

        clear() {
            this.profileCache.clear();
            this.sessionCache.clear();
            this.appearanceCache.clear();

            this.profileHits = 0;
            this.profileMisses = 0;
            this.sessionHits = 0;
            this.sessionMisses = 0;
            this.appearanceHits = 0;
            this.appearanceMisses = 0;
        }

        getStats() {
            return {
                profile: {
                    size: this.profileCache.size,
                    hits: this.profileHits,
                    misses: this.profileMisses,
                    ttlMs: this.PROFILE_TTL_MS
                },
                session: {
                    size: this.sessionCache.size,
                    hits: this.sessionHits,
                    misses: this.sessionMisses,
                    ttlMs: this.SESSION_TTL_MS
                },
                appearance: {
                    size: this.appearanceCache.size,
                    hits: this.appearanceHits,
                    misses: this.appearanceMisses,
                    ttlMs: this.APPEARANCE_TTL_MS
                },
                maxEntries: this.MAX_ENTRIES
            };
        }

        getProfile(username) {
            return this.#getEntry(
                this.profileCache,
                normalizeUsername(username),
                this.PROFILE_TTL_MS,
                'profile'
            );
        }

        setProfile(username, value) {
            this.#setEntry(
                this.profileCache,
                normalizeUsername(username),
                value,
                this.PROFILE_TTL_MS
            );
        }

        getSession(id) {
            return this.#getEntry(
                this.sessionCache,
                normalizeId(id),
                this.SESSION_TTL_MS,
                'session'
            );
        }

        setSession(id, value) {
            this.#setEntry(
                this.sessionCache,
                normalizeId(id),
                value,
                this.SESSION_TTL_MS
            );
        }

        getAppearance(locale) {
            return this.#getEntry(
                this.appearanceCache,
                this.#normalizeLocale(locale),
                this.APPEARANCE_TTL_MS,
                'appearance'
            );
        }

        setAppearance(locale, value) {
            this.#setEntry(
                this.appearanceCache,
                this.#normalizeLocale(locale),
                value,
                this.APPEARANCE_TTL_MS
            );
        }

        #normalizeLocale(locale) {
            if (typeof locale !== 'string') {
                return '';
            }

            const text = locale.trim().toLowerCase();

            if (text === 'en' || text.startsWith('en-')) {
                return 'en';
            }

            if (text === 'ru' || text.startsWith('ru-')) {
                return 'ru';
            }

            return '';
        }

        #getEntry(store, key, ttlMs, kind) {
            if (!key) {
                if (kind === 'profile') {
                    this.profileMisses += 1;
                } else {
                    if (kind === 'session') {
                        this.sessionMisses += 1;
                    } else {
                        this.appearanceMisses += 1;
                    }
                }

                return null;
            }

            const entry = store.get(key);

            if (!entry) {
                if (kind === 'profile') {
                    this.profileMisses += 1;
                } else {
                    if (kind === 'session') {
                        this.sessionMisses += 1;
                    } else {
                        this.appearanceMisses += 1;
                    }
                }

                return null;
            }

            if (entry.expiresAt <= Date.now()) {
                store.delete(key);

                if (kind === 'profile') {
                    this.profileMisses += 1;
                } else {
                    if (kind === 'session') {
                        this.sessionMisses += 1;
                    } else {
                        this.appearanceMisses += 1;
                    }
                }

                return null;
            }

            store.delete(key);
            store.set(key, entry);

            if (kind === 'profile') {
                this.profileHits += 1;
            } else if (kind === 'session') {
                this.sessionHits += 1;
            } else {
                this.appearanceHits += 1;
            }

            return cloneValue(entry.value);
        }

        #setEntry(store, key, value, ttlMs) {
            if (!key) {
                return;
            }

            store.set(key, {
                value: cloneValue(value),
                expiresAt: Date.now() + ttlMs
            });

            while (store.size > this.MAX_ENTRIES) {
                const oldestKey = store.keys().next().value;

                if (oldestKey === undefined) {
                    break;
                }

                store.delete(oldestKey);
            }
        }
    }

    window.VimeReportPlayerCache = new VimeReportPlayerCache();
})();
