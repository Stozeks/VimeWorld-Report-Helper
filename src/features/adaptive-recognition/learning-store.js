(() => {
    'use strict';


    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER
     * ADAPTIVE RECOGNITION — LEARNING STORE  (Stage 2A)
     * =========================================================
     *
     * Persistent local store for moderator-taught recognition data.
     *
     * Backed exclusively by chrome.storage.local.
     * NEVER writes to prohibited-words.txt.
     * NEVER learns automatically from scanner results.
     *
     * All learning must be explicitly triggered by future UI.
     *
     * Global API:
     *   window.VimeReportLearningStore
     *     .init()
     *     .getStatus()
     *
     *     .learnAlias(data)     -> Promise<AliasRecord>
     *     .learnPhrase(data)    -> Promise<PhraseRecord>
     *     .addException(data)   -> Promise<ExceptionRecord>
     *
     *     .confirm(id)          -> Promise<Record|null>
     *     .reject(id)           -> Promise<Record|null>
     *
     *     .getAlias(normalized) -> AliasRecord|null
     *     .findAliases(filter?) -> AliasRecord[]
     *     .getPhrase(id)        -> PhraseRecord|null
     *     .findPhrases(filter?) -> PhraseRecord[]
     *     .isException(normalized) -> boolean
     *     .findExceptions()     -> ExceptionRecord[]
     *
     *     .getStats()           -> StatsObject
     *     .exportData()         -> object
     *     .importData(data, options?) -> Promise<void>
     *     .clearAll()           -> Promise<void>
     *     .debug()
     * =========================================================
     */


    /* =========================================================
       CONSTANTS
       ========================================================= */

    const STORAGE_KEY    = 'vrh_adaptive_learning_v1';
    const SCHEMA_VERSION = 1;

    /*
     * Confirmation thresholds for automatic status promotion.
     *
     * candidate -> learned  : >= TRUSTED_AT_CONFIRMATIONS / 3
     * learned   -> trusted  : >= TRUSTED_AT_CONFIRMATIONS
     * any       -> rejected : >= REJECTED_AT_REJECTIONS
     */
    const TRUSTED_AT_CONFIRMATIONS = 3;
    const LEARNED_AT_CONFIRMATIONS = 1;
    const REJECTED_AT_REJECTIONS   = 2;


    /* =========================================================
       HELPERS
       ========================================================= */

    function nowTs() {
        return Date.now();
    }

    function generateId(prefix) {
        return (
            prefix + '_' +
            nowTs().toString(36) + '_' +
            Math.random().toString(36).slice(2, 8)
        );
    }

    /**
     * Normalize a raw string using the existing TextNormalizer when
     * available, falling back to simple lowercase.
     *
     * @param {string} text
     * @returns {string}
     */
    function normalizeText(text) {
        const norm = window.VimeReportTextNormalizer;

        if (norm && typeof norm.normalizeToken === 'function') {
            try {
                return norm.normalizeToken(
                    String(text ?? '')
                ).normalized;
            } catch (_) {
                /* fall through to simple fallback */
            }
        }

        return String(text ?? '').toLowerCase().trim();
    }

    /**
     * Build an empty store object with the current schema version.
     *
     * @returns {StoreShape}
     */
    function emptyStore() {
        const ts = nowTs();
        return {
            version:    SCHEMA_VERSION,
            aliases:    {},
            phrases:    {},
            exceptions: {},
            stats: {
                createdAt:          ts,
                updatedAt:          ts,
                totalLearnEvents:   0,
                totalConfirmations: 0,
                totalRejections:    0,
            },
        };
    }

    /**
     * Validate that a stored value has the expected schema shape.
     *
     * @param {*} data
     * @returns {boolean}
     */
    function isValidStore(data) {
        return (
            data !== null &&
            typeof data === 'object' &&
            data.version === SCHEMA_VERSION &&
            typeof data.aliases    === 'object' &&
            typeof data.phrases    === 'object' &&
            typeof data.exceptions === 'object' &&
            typeof data.stats      === 'object'
        );
    }

    /**
     * Determine the next status for a record after confirmation.
     * Does not downgrade; once rejected, stays rejected.
     *
     * @param {AliasRecord|PhraseRecord} record
     * @returns {string}
     */
    function nextConfirmStatus(record) {
        if (record.status === 'rejected') return 'rejected';

        if (record.confirmations >= TRUSTED_AT_CONFIRMATIONS) {
            return 'trusted';
        }
        if (record.confirmations >= LEARNED_AT_CONFIRMATIONS) {
            return 'learned';
        }
        return 'candidate';
    }


    /* =========================================================
       LEARNING STORE
       ========================================================= */

    class VimeReportLearningStoreImpl {

        constructor() {
            /*
             * 'uninitialized' | 'ready' | 'unavailable' | 'error'
             */
            this._status = 'uninitialized';
            this._error  = null;

            /*
             * In-memory cache.  All sync read-methods use this.
             * All write-methods update this and then persist.
             */
            this._store = null;
        }


        /* --------------------------------------------------
           init()
           Load or initialise the store.  Must be called once
           before any other method.
        -------------------------------------------------- */

        async init() {
            if (!chrome?.storage?.local) {
                this._status = 'unavailable';
                this._error  = 'chrome.storage.local not available';
                console.warn(
                    '[VimeReportLearningStore] chrome.storage.local unavailable'
                );
                return;
            }

            try {
                const raw  = await chrome.storage.local.get(STORAGE_KEY);
                const data = raw[STORAGE_KEY];

                if (!data) {
                    /* First run */
                    this._store = emptyStore();
                    await this._persist();

                } else if (isValidStore(data)) {
                    this._store = data;

                } else {
                    /* Corrupt or outdated data */
                    console.warn(
                        '[VimeReportLearningStore]',
                        'Corrupt storage data — reinitializing.',
                        'Original preserved in _store._recoveredFrom.'
                    );
                    this._store = emptyStore();
                    /*
                     * Preserve the raw corrupt value for diagnostics.
                     * This property is never written back to storage.
                     */
                    this._store._recoveredFrom = data;
                    await this._persist();
                }

                this._status = 'ready';
                this._error  = null;

            } catch (e) {
                this._status = 'error';
                this._error  = String(e);
                /*
                 * Provide an in-memory-only fallback so that code that
                 * calls read methods does not crash even if storage failed.
                 */
                this._store = emptyStore();
                console.error('[VimeReportLearningStore] init failed:', e);
            }
        }


        /* --------------------------------------------------
           getStatus()
        -------------------------------------------------- */

        getStatus() {
            return {
                status:     this._status,
                ready:      this._status === 'ready',
                error:      this._error,
                storageKey: STORAGE_KEY,
                version:    SCHEMA_VERSION,
            };
        }


        /* --------------------------------------------------
           Internal: persist and guard helpers
        -------------------------------------------------- */

        async _persist() {
            if (!chrome?.storage?.local || !this._store) return;

            this._store.stats.updatedAt = nowTs();

            try {
                await chrome.storage.local.set(
                    { [STORAGE_KEY]: this._store }
                );
            } catch (e) {
                console.error(
                    '[VimeReportLearningStore] Persist failed:', e
                );
            }
        }

        _isReady() {
            if (this._status !== 'ready' || !this._store) {
                console.warn(
                    '[VimeReportLearningStore] Store not ready:',
                    this._status
                );
                return false;
            }
            return true;
        }

        _findById(id) {
            return (
                this._store.aliases[id]    ??
                this._store.phrases[id]    ??
                null
            );
        }


        /* --------------------------------------------------
           learnAlias(data)

           Stores a player-written form → canonical mapping.
           If an identical normalized+canonical pair already
           exists, the existing record is updated and returned.
        -------------------------------------------------- */

        async learnAlias(data) {
            if (!this._isReady()) return null;

            const original   = String(data?.original  ?? '').trim();
            const category   = String(data?.category  ?? '').trim() || null;
            const source     = String(data?.source    ?? 'manual');
            const confidence =
                typeof data?.confidence === 'number'
                    ? data.confidence
                    : 0;

            /* canonical may be null for category-level terms */
            const canonical =
                data?.canonical != null
                    ? String(data.canonical).trim().toLowerCase() || null
                    : null;

            if (!original) {
                console.warn('[VimeReportLearningStore] learnAlias: original required');
                return null;
            }

            const normalized = normalizeText(original);
            const ts         = nowTs();

            /* Dedup check */
            const existing = this._findAliasByKey(normalized, canonical);

            if (existing) {
                existing.lastSeenAt = ts;
                existing.updatedAt  = ts;

                /* Cautious merge: only fill empty fields */
                if (category && !existing.category) {
                    existing.category = category;
                }
                if (confidence > existing.confidence) {
                    existing.confidence = confidence;
                }

                await this._persist();
                return { ...existing };
            }

            const record = {
                id:            generateId('alias'),
                original,
                normalized,
                canonical,
                category,
                confidence,
                status:        'candidate',
                confirmations: 0,
                rejections:    0,
                source,
                createdAt:     ts,
                updatedAt:     ts,
                lastSeenAt:    ts,
            };

            this._store.aliases[record.id] = record;
            this._store.stats.totalLearnEvents++;

            await this._persist();
            return { ...record };
        }

        _findAliasByKey(normalized, canonical) {
            const canonLower =
                canonical !== null
                    ? canonical.toLowerCase()
                    : null;

            return (
                Object.values(this._store.aliases).find(
                    (a) =>
                        a.normalized === normalized &&
                        a.canonical  === canonLower
                ) ?? null
            );
        }

        /** Get the best active alias for a normalized token. */
        getAlias(normalized) {
            if (!this._store) return null;

            const norm = String(normalized ?? '');

            return (
                Object.values(this._store.aliases)
                    .filter(
                        (a) =>
                            a.normalized === norm &&
                            a.status !== 'rejected'
                    )
                    .sort(
                        (a, b) => b.confidence - a.confidence
                    )[0] ?? null
            );
        }

        /** Find aliases matching an optional filter. */
        findAliases(filter) {
            if (!this._store) return [];

            let results = Object.values(this._store.aliases);

            if (filter?.status)     results = results.filter((a) => a.status     === filter.status);
            if (filter?.canonical)  results = results.filter((a) => a.canonical  === filter.canonical);
            if (filter?.category)   results = results.filter((a) => a.category   === filter.category);
            if (filter?.normalized) results = results.filter((a) => a.normalized === filter.normalized);

            return results;
        }


        /* --------------------------------------------------
           learnPhrase(data)

           Stores a full phrase (possibly multi-message in future).
           Deduplicated by normalized form.
        -------------------------------------------------- */

        async learnPhrase(data) {
            if (!this._isReady()) return null;

            const original  = String(data?.original  ?? '').trim();
            const category  = String(data?.category  ?? '').trim() || null;
            const source    = String(data?.source    ?? 'manual');
            const matchMode = String(data?.matchMode ?? 'normalized-phrase');

            if (!original) {
                console.warn('[VimeReportLearningStore] learnPhrase: original required');
                return null;
            }

            const normalized = normalizeText(original);
            const ts         = nowTs();

            /* Dedup by normalized form */
            const existing = Object.values(this._store.phrases)
                .find((p) => p.normalized === normalized) ?? null;

            if (existing) {
                existing.lastSeenAt = ts;
                existing.updatedAt  = ts;
                if (category && !existing.category) {
                    existing.category = category;
                }
                await this._persist();
                return { ...existing };
            }

            const record = {
                id:            generateId('phrase'),
                original,
                normalized,
                category,
                confidence:    data?.confidence ?? 1,
                status:        'candidate',
                confirmations: 0,
                rejections:    0,
                source,
                matchMode,

                /*
                 * Future cross-message context.
                 * Not used in current scanning logic.
                 */
                context: {
                    crossMessage:  data?.context?.crossMessage  ?? false,
                    maxMessageGap: data?.context?.maxMessageGap ?? null,
                    maxTimeGapMs:  data?.context?.maxTimeGapMs  ?? null,
                },

                createdAt:  ts,
                updatedAt:  ts,
                lastSeenAt: ts,
            };

            this._store.phrases[record.id] = record;
            this._store.stats.totalLearnEvents++;

            await this._persist();
            return { ...record };
        }

        getPhrase(id) {
            if (!this._store) return null;
            const r = this._store.phrases[id];
            return r ? { ...r } : null;
        }

        findPhrases(filter) {
            if (!this._store) return [];

            let results = Object.values(this._store.phrases);

            if (filter?.status)   results = results.filter((p) => p.status   === filter.status);
            if (filter?.category) results = results.filter((p) => p.category === filter.category);

            return results;
        }


        /* --------------------------------------------------
           addException(data)

           Records a false-positive exception.
           The Recognition Engine will later consult these
           before fuzzy matching.
        -------------------------------------------------- */

        async addException(data) {
            if (!this._isReady()) return null;

            const original = String(data?.original ?? '').trim();

            if (!original) {
                console.warn('[VimeReportLearningStore] addException: original required');
                return null;
            }

            const normalized = normalizeText(original);
            const ts         = nowTs();

            /* Dedup by normalized form */
            const existing = Object.values(this._store.exceptions)
                .find((e) => e.normalized === normalized) ?? null;

            if (existing) {
                existing.updatedAt = ts;
                await this._persist();
                return { ...existing };
            }

            const record = {
                id:         generateId('exc'),
                original,
                normalized,
                reason:     String(data?.reason ?? 'manual-reject'),
                source:     String(data?.source ?? 'manual'),
                createdAt:  ts,
                updatedAt:  ts,
            };

            this._store.exceptions[record.id] = record;

            await this._persist();
            return { ...record };
        }

        /**
         * Check whether a normalized token is explicitly excepted.
         *
         * @param {string} normalized
         * @param {*} _context  reserved for future context-aware matching
         * @returns {boolean}
         */
        isException(normalized, _context) {
            if (!this._store) return false;

            const norm = String(normalized ?? '');

            return Object.values(this._store.exceptions)
                .some((e) => e.normalized === norm);
        }

        findExceptions() {
            if (!this._store) return [];
            return Object.values(this._store.exceptions);
        }


        /* --------------------------------------------------
           confirm(id) / reject(id)

           Moderator feedback on a learned alias or phrase.
        -------------------------------------------------- */

        async confirm(id) {
            if (!this._isReady()) return null;

            const record = this._findById(id);

            if (!record) {
                console.warn('[VimeReportLearningStore] confirm: id not found:', id);
                return null;
            }

            const ts = nowTs();

            record.confirmations++;
            record.updatedAt  = ts;
            record.lastSeenAt = ts;
            record.status     = nextConfirmStatus(record);

            this._store.stats.totalConfirmations++;

            await this._persist();
            return { ...record };
        }

        async reject(id) {
            if (!this._isReady()) return null;

            const record = this._findById(id);

            if (!record) {
                console.warn('[VimeReportLearningStore] reject: id not found:', id);
                return null;
            }

            const ts = nowTs();

            record.rejections++;
            record.updatedAt = ts;

            if (record.rejections >= REJECTED_AT_REJECTIONS) {
                record.status = 'rejected';
            }

            this._store.stats.totalRejections++;

            await this._persist();
            return { ...record };
        }


        /* --------------------------------------------------
           getStats()
        -------------------------------------------------- */

        getStats() {
            if (!this._store) {
                return {
                    aliases:          0,
                    phrases:          0,
                    exceptions:       0,
                    trustedAliases:   0,
                    learnedAliases:   0,
                    candidateAliases: 0,
                    rejectedAliases:  0,
                    totalConfirmations: 0,
                    totalRejections:    0,
                };
            }

            const aliases = Object.values(this._store.aliases);

            return {
                aliases:          aliases.length,
                phrases:          Object.keys(this._store.phrases).length,
                exceptions:       Object.keys(this._store.exceptions).length,
                trustedAliases:   aliases.filter((a) => a.status === 'trusted').length,
                learnedAliases:   aliases.filter((a) => a.status === 'learned').length,
                candidateAliases: aliases.filter((a) => a.status === 'candidate').length,
                rejectedAliases:  aliases.filter((a) => a.status === 'rejected').length,
                totalConfirmations: this._store.stats.totalConfirmations,
                totalRejections:    this._store.stats.totalRejections,
            };
        }


        /* --------------------------------------------------
           exportData() / importData()
        -------------------------------------------------- */

        /**
         * Return a deep JSON copy of the current store, suitable
         * for backup or transfer.  Never triggers storage writes.
         */
        exportData() {
            if (!this._store) return null;
            return JSON.parse(JSON.stringify(this._store));
        }

        /**
         * Import previously exported data.
         *
         * @param {object} data          - exported store object
         * @param {object} [options]
         * @param {'merge'|'replace'} [options.mode='merge']
         */
        async importData(data, options = {}) {
            if (!this._isReady()) return;

            if (!isValidStore(data)) {
                console.warn(
                    '[VimeReportLearningStore] importData: invalid store format'
                );
                return;
            }

            const mode = options.mode === 'replace' ? 'replace' : 'merge';
            const ts   = nowTs();

            if (mode === 'replace') {
                this._store = {
                    ...data,
                    stats: {
                        ...data.stats,
                        updatedAt: ts,
                    },
                };
            } else {
                /*
                 * Merge: add records not already present by their ID.
                 * Existing records are never overwritten to preserve
                 * locally accumulated confirmation history.
                 */
                for (const [id, record] of Object.entries(data.aliases ?? {})) {
                    if (!this._store.aliases[id]) {
                        this._store.aliases[id] = record;
                    }
                }
                for (const [id, record] of Object.entries(data.phrases ?? {})) {
                    if (!this._store.phrases[id]) {
                        this._store.phrases[id] = record;
                    }
                }
                for (const [id, record] of Object.entries(data.exceptions ?? {})) {
                    if (!this._store.exceptions[id]) {
                        this._store.exceptions[id] = record;
                    }
                }
            }

            await this._persist();
        }


        /* --------------------------------------------------
           clearAll()

           Deletes ONLY the learning store key.
           Does not touch any other extension storage.
        -------------------------------------------------- */

        async clearAll() {
            if (!chrome?.storage?.local) return;

            try {
                await chrome.storage.local.remove(STORAGE_KEY);
            } catch (e) {
                console.error('[VimeReportLearningStore] clearAll failed:', e);
            }

            this._store = emptyStore();
            await this._persist();
        }


        /* --------------------------------------------------
           debug()
        -------------------------------------------------- */

        debug() {
            const status = this.getStatus();
            const stats  = this.getStats();

            console.group('[VimeReportLearningStore] debug');
            console.log('status:',    status.status);
            console.log('storageKey:', STORAGE_KEY);
            console.log(
                'aliases:',
                stats.aliases,
                `trusted:${stats.trustedAliases}`,
                `learned:${stats.learnedAliases}`,
                `candidate:${stats.candidateAliases}`,
                `rejected:${stats.rejectedAliases}`
            );
            console.log('phrases:',    stats.phrases);
            console.log('exceptions:', stats.exceptions);
            console.log('confirmations:', stats.totalConfirmations);
            console.log('rejections:',    stats.totalRejections);
            console.groupEnd();

            return { status, stats };
        }

    }


    /* =========================================================
       EXPORT
       ========================================================= */

    window.VimeReportLearningStore =
        new VimeReportLearningStoreImpl();

    console.log('[Vime Report Helper] Learning Store loaded.');

    /*
     * Auto-initialize storage asynchronously.
     * The global is already registered above; init() failure is non-fatal.
     */
    window.VimeReportLearningStore.init().catch(function (e) {
        console.error('[VimeReportLearningStore] Auto-init error:', e);
    });

})();
