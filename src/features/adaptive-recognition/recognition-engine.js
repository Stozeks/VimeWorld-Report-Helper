(() => {
    'use strict';


    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER
     * ADAPTIVE RECOGNITION ENGINE  (Stage 1C)
     * =========================================================
     *
     * Connects player tokens to the official prohibited vocabulary
     * using normalization + fuzzy matching.
     *
     * Pipeline:
     *   raw token
     *     -> VimeReportTextNormalizer.normalizeToken()
     *     -> exact lookup in official vocabulary
     *     -> if no exact match: fuzzy search via VimeReportFuzzyMatcher
     *     -> ranked candidates -> RecognitionResult
     *
     * DOES NOT:
     *   - duplicate normalization or fuzzy-distance algorithms
     *   - define new prohibited words
     *   - touch the DOM
     *   - persist anything (no localStorage / IndexedDB)
     *   - know moderation categories
     *
     * Global API:
     *   window.VimeReportAdaptiveRecognition
     *     .recognizeToken(token, options?)   -> RecognitionResult
     *     .recognizeTokens(tokens, options?) -> RecognitionResult[]
     *     .debug(token)                      -> RecognitionResult + console log
     *     .getStatus()                       -> StatusObject
     * =========================================================
     */


    /* =========================================================
       CONSTANTS
       ========================================================= */

    /* Maximum number of runner-up candidates stored in .alternatives */
    const MAX_ALTERNATIVES = 3;

    /*
     * Pre-filter: only compare against candidates whose normalized length
     * is within this many characters of the input.
     */
    const CANDIDATE_LENGTH_WINDOW = 2;

    /*
     * Tokens of this length or shorter skip fuzzy matching entirely.
     * The FuzzyMatcher policy for length <= 5 is exact-only (maxEdits=0).
     * Since we already ran the exact lookup before reaching fuzzy, running
     * the fuzzy step for short tokens can only produce false positives.
     */
    const SHORT_TOKEN_FUZZY_THRESHOLD = 5;

    /*
     * Confidence thresholds for classifying fuzzy hits into levels.
     * (Exact / normalized matches are always 'trusted'.)
     *
     * The FuzzyMatcher returns confidence in [0, 1].
     * We further classify:
     *   >= CONF_HIGH   -> high    (recognized: true)
     *   >= CONF_MEDIUM -> medium  (recognized: true;  confirm with moderator)
     *   >= CONF_LOW    -> low     (recognized: false; weak candidate only)
     *   <  CONF_LOW    -> none    (recognized: false)
     */
    const CONF_HIGH   = 0.82;
    const CONF_MEDIUM = 0.70;
    const CONF_LOW    = 0.55;


    /* =========================================================
       INTERNAL HELPERS
       ========================================================= */

    /**
     * Retrieve a global dependency by name.
     * Logs a warning if unavailable; returns null rather than throwing.
     *
     * @param {string} name
     * @returns {object|null}
     */
    function dep(name) {
        const obj = window[name];
        if (!obj) {
            console.warn(
                '[VimeReportAdaptiveRecognition] Dependency not available:', name
            );
        }
        return obj ?? null;
    }


    /**
     * Build a "not recognized" result, carrying normalizer metadata when
     * available so callers can still see what the normalizer produced.
     *
     * @param {string}       original
     * @param {object|null}  normResult - output of normalizeToken(), or null
     * @returns {RecognitionResult}
     */
    function noMatch(original, normResult, normalizationCandidates = []) {
        return {
            original,
            normalized:      normResult?.normalized ?? original,
            recognized:      false,
            canonical:       null,
            matchedText:     null,
            category:        null,
            confidence:      0,
            level:           'none',
            method:          'none',
            matchType:       'none',
            source:          'none',
            distance:        null,
            similarity:      null,
            reason:          null,
            transformations: normResult?.transformations ?? [],
            indexMap:        normResult?.indexMap        ?? [],
            normalizationCandidates,
            alternatives:    [],
            candidateId:     null,
        };
    }


    /**
     * Map a fuzzy-matcher confidence value to a named level.
     *
     * @param {number} conf
     * @returns {'high'|'medium'|'low'|'none'}
     */
    function fuzzyLevel(conf) {
        if (conf >= CONF_HIGH)   return 'high';
        if (conf >= CONF_MEDIUM) return 'medium';
        if (conf >= CONF_LOW)    return 'low';
        return 'none';
    }


    /* =========================================================
       RECOGNITION ENGINE
       ========================================================= */

    class VimeReportAdaptiveRecognitionImpl {

        constructor() {
            /*
             * Lazily built once VimeReportProhibitedWordsReady is true.
             *
             * _exactSet   Set<string>  normalized form of each vocabulary word
             *                          used for O(1) exact lookup
             *
             * _charIndex  Map<string, Array<{word:string, normalized:string}>>
             *                          keyed by first character of normalized word
             *                          used for cheap pre-filtering before fuzzy matching
             */
            this._indexReady = false;
            this._exactSet   = null;
            this._charIndex  = null;
            this._aliasReady = false;
        }


        /* --------------------------------------------------
           Index management
        -------------------------------------------------- */

        /**
         * Build (or rebuild) the in-memory lookup index from the
         * official vocabulary.  Safe to call multiple times; only
         * rebuilds when necessary.
         *
         * @returns {boolean} true when the index is ready
         */
        _ensureIndex() {
            if (this._indexReady) return true;

            if (!window.VimeReportProhibitedWordsReady) return false;

            const vocab = window.VimeReportProhibitedWords;
            if (!Array.isArray(vocab) || vocab.length === 0) return false;

            this._buildIndex(vocab);
            return true;
        }


        /**
         * Construct _exactSet and _charIndex from the raw vocabulary array.
         *
         * @param {string[]} vocab
         */
        _buildIndex(vocab) {
            const normalizer = dep('VimeReportTextNormalizer');

            this._exactSet  = new Set();
            this._charIndex = new Map();
            this._aliasReady = !!window.VimeReportRecognitionAliases;

            for (const word of vocab) {
                if (typeof word !== 'string' || word.length === 0) continue;

                const forms =
                    normalizer &&
                    typeof normalizer.normalizeTokenForms === 'function'
                        ? normalizer.normalizeTokenForms(word)
                        : [{
                            kind: 'base',
                            result: normalizer
                                ? normalizer.normalizeToken(word)
                                : {
                                    normalized: word.toLowerCase(),
                                    changed: false
                                }
                        }];

                const seen = new Set();

                for (const form of forms) {
                    const normalized = form?.result?.normalized;

                    if (typeof normalized !== 'string' || !normalized) {
                        continue;
                    }

                    if (seen.has(normalized)) {
                        continue;
                    }

                    seen.add(normalized);
                    this._exactSet.add(normalized);

                    const fc = normalized[0];
                    if (!fc) continue;

                    if (!this._charIndex.has(fc)) {
                        this._charIndex.set(fc, []);
                    }
                    this._charIndex.get(fc).push({ word, normalized });
                }
            }

            this._indexReady = true;

            console.log(
                '[VimeReportAdaptiveRecognition] Index built:',
                this._exactSet.size, 'entries,',
                this._charIndex.size, 'first-char buckets'
            );
        }


        /* --------------------------------------------------
           Candidate pre-filter
        -------------------------------------------------- */

        /**
         * Return vocabulary entries that are plausible fuzzy candidates
         * for `normInput` without running a full edit-distance computation.
         *
         * Pre-filter criteria:
         *   1. Same first normalized character (fast Map lookup)
         *   2. Length within CANDIDATE_LENGTH_WINDOW of the input
         *
         * This reduces the fuzzy comparison set dramatically for large
         * vocabularies without discarding genuine typo candidates.
         *
         * @param {string} normInput
         * @returns {Array<{word:string, normalized:string}>}
         */
        _getCandidates(normInput) {
            if (!this._charIndex) return [];

            const fc  = normInput[0];
            const len = normInput.length;

            const bucket = this._charIndex.get(fc);
            if (!bucket) return [];

            return bucket.filter(c =>
                Math.abs(c.normalized.length - len) <= CANDIDATE_LENGTH_WINDOW
            );
        }


        /* --------------------------------------------------
           Public API
        -------------------------------------------------- */

        /**
         * Attempt to recognize a single already-typed token.
         *
         * @param {string}  token
         * @param {object}  [options]
         * @param {object}  [options.fuzzyOptions]  forwarded to FuzzyMatcher.match()
         * @returns {RecognitionResult}
         */
        recognizeToken(token, options = {}) {
            if (typeof token !== 'string' || token.length === 0) {
                return noMatch(String(token ?? ''), null);
            }

            /* Verify dependencies */
            const normalizer = dep('VimeReportTextNormalizer');
            const fuzzy      = dep('VimeReportFuzzyMatcher');

            if (!normalizer || !fuzzy) {
                return {
                    ...noMatch(token, null),
                    _error: 'dependencies-unavailable',
                };
            }

            /* Ensure the vocabulary index is ready */
            if (!this._ensureIndex()) {
                return {
                    ...noMatch(token, null),
                    _error: 'vocabulary-not-ready',
                };
            }

            /* ---- Step 1: Normalize ---- */
            const formResults =
                typeof normalizer.normalizeTokenForms === 'function'
                    ? normalizer.normalizeTokenForms(token)
                    : [{
                        kind: 'base',
                        result: normalizer.normalizeToken(token)
                    }];

            const primaryForm =
                formResults[0]?.result ??
                normalizer.normalizeToken(token);

            const normInput  = primaryForm.normalized;
            const normalizationCandidates = formResults.map((form) => ({
                kind: form.kind,
                normalized: form.result.normalized,
                changed: form.result.changed
            }));

            const exactCandidate = formResults.find(
                (form) =>
                    form?.result?.normalized &&
                    this._exactSet.has(form.result.normalized)
            );
            const aliases = window.VimeReportRecognitionAliases;

            /* ---- Step 2: Exact lookup ---- */
            if (exactCandidate) {
                /*
                 * method='exact'      — original token already matched
                 * method='normalized' — normalizer transformed the token
                 *                       before it matched (bypass detected)
                 */
                const method =
                    exactCandidate.kind === 'base'
                        ? (exactCandidate.result.changed ? 'normalized' : 'exact')
                        : 'layout';

                return {
                    original:        token,
                    normalized:      exactCandidate.result.normalized,
                    recognized:      true,
                    canonical:       exactCandidate.result.normalized,
                    matchedText:     exactCandidate.result.normalized,
                    category:        null,
                    confidence:      1.0,
                    level:           'trusted',
                    method,
                    distance:        0,
                    similarity:      1.0,
                    matchType:       method,
                    source:          aliases?.hasWord?.(exactCandidate.result.normalized)
                        ? 'built-in-knowledge'
                        : 'official-vocabulary',
                    reason:          'exact-match',
                    transformations: exactCandidate.result.transformations,
                    indexMap:        exactCandidate.result.indexMap,
                    normalizationCandidates,
                    alternatives:    [],
                    candidateId:     exactCandidate.result.normalized + ':' + exactCandidate.result.normalized,
                };
            }

            /* ---- Step 3: Skip fuzzy for short tokens ---- */
            /*
             * The FuzzyMatcher policy for tokens <= SHORT_TOKEN_FUZZY_THRESHOLD
             * characters is exact-only (maxEdits = 0), which would immediately
             * reject anything that survived step 2.  Running the fuzzy loop would
             * waste CPU and risk false positives on short fragments.
             */
            if (normInput.length <= SHORT_TOKEN_FUZZY_THRESHOLD) {
                return noMatch(token, primaryForm, normalizationCandidates);
            }

            /* ---- Step 4: Fuzzy search ---- */
            const candidates = this._getCandidates(normInput);

            if (candidates.length === 0) {
                return noMatch(token, primaryForm, normalizationCandidates);
            }

            const hits = [];

            for (const c of candidates) {
                const r = fuzzy.match(
                    normInput,
                    c.normalized,
                    options.fuzzyOptions
                );

                if (r.matched) {
                    hits.push({
                        canonical:  c.word,
                        normalized: c.normalized,
                        confidence: r.confidence,
                        distance:   r.distance,
                        similarity: r.similarity,
                        reason:     r.reason,
                    });
                }
            }

            if (hits.length === 0) {
                return noMatch(token, primaryForm, normalizationCandidates);
            }

            /* Sort best first: highest confidence, then highest similarity */
            hits.sort((a, b) =>
                b.confidence - a.confidence ||
                b.similarity  - a.similarity
            );

            const best  = hits[0];
            const level = fuzzyLevel(best.confidence);

            /* Only high and medium are promoted to recognized: true */
            const recognized = level === 'high' || level === 'medium';

            const alternatives = hits
                .slice(1, MAX_ALTERNATIVES + 1)
                .map(h => ({
                    canonical:  h.canonical,
                    confidence: h.confidence,
                    distance:   h.distance,
                    similarity: h.similarity,
                }));

            return {
                original:        token,
                normalized:      normInput,
                recognized,
                canonical:       recognized ? best.canonical : null,
                matchedText:     recognized ? best.canonical : null,
                category:        null,
                confidence:      best.confidence,
                level,
                method:          'fuzzy',
                matchType:       'fuzzy',
                source:          aliases?.hasWord?.(best.canonical)
                    ? 'built-in-knowledge'
                    : 'official-vocabulary',
                distance:        best.distance,
                similarity:      best.similarity,
                reason:          best.reason,
                transformations: primaryForm.transformations,
                indexMap:        primaryForm.indexMap,
                normalizationCandidates,
                alternatives,
                candidateId:     recognized
                    ? best.canonical + ':' + normInput
                    : null,
            };
        }


        /**
         * Recognize an array of tokens.  No DOM access.
         *
         * @param {string[]} tokens
         * @param {object}   [options]  forwarded to recognizeToken()
         * @returns {RecognitionResult[]}
         */
        recognizeTokens(tokens, options = {}) {
            if (!Array.isArray(tokens)) return [];
            return tokens.map(t => this.recognizeToken(t, options));
        }


        /**
         * Log a concise diagnostic for a single token.
         *
         * @param {string} token
         * @returns {RecognitionResult}
         */
        debug(token) {
            const r = this.recognizeToken(token);

            const fmtPct = v =>
                v != null ? (v * 100).toFixed(1) + '%' : '—';

            console.group(
                `[VimeReportAdaptiveRecognition] debug: "${token}"`
            );
            console.log(`original:    ${r.original}`);
            console.log(`normalized:  ${r.normalized}`);
            console.log(`recognized:  ${r.recognized}`);
            console.log(`canonical:   ${r.canonical ?? '—'}`);
            console.log(`matchedText: ${r.matchedText ?? '—'}`);
            console.log(`category:    ${r.category ?? '—'}`);
            console.log(`method:      ${r.method}`);
            console.log(`matchType:   ${r.matchType ?? '—'}`);
            console.log(`source:      ${r.source ?? '—'}`);
            console.log(`distance:    ${r.distance ?? '—'}`);
            console.log(`similarity:  ${fmtPct(r.similarity)}`);
            console.log(`confidence:  ${fmtPct(r.confidence)}`);
            console.log(`reason:      ${r.reason ?? '—'}`);
            console.log(`level:       ${r.level}`);

            if (r.normalizationCandidates?.length > 0) {
                console.log('normalizationCandidates:');
                r.normalizationCandidates.forEach((candidate, i) => {
                    console.log(
                        `  [${i + 1}] ${candidate.kind}: "${candidate.normalized}"` +
                        ` changed=${candidate.changed ? 'yes' : 'no'}`
                    );
                });
            }

            if (r.transformations?.length > 0) {
                console.log(
                    `transforms:  ${r.transformations.length} step(s) applied`
                );
            }

            if (r.alternatives?.length > 0) {
                console.log(`alternatives (${r.alternatives.length}):`);
                r.alternatives.forEach((a, i) => {
                    console.log(
                        `  [${i + 1}] "${a.canonical}"` +
                        `  conf=${fmtPct(a.confidence)}` +
                        `  dist=${a.distance}`
                    );
                });
            }

            if (r._error) {
                console.warn(`  error: ${r._error}`);
            }

            console.groupEnd();

            return r;
        }


        /**
         * Return the current readiness state of all dependencies.
         *
         * @returns {StatusObject}
         */
        getStatus() {
            const normAvail  = !!window.VimeReportTextNormalizer;
            const fuzzyAvail = !!window.VimeReportFuzzyMatcher;
            const vocabAvail = !!window.VimeReportProhibitedWordsReady;
            const vocabSize  = window.VimeReportProhibitedWords?.length ?? 0;
            const aliasStatus =
                window.VimeReportRecognitionAliases?.getStatus?.() ?? null;

            return {
                normalizerAvailable:   normAvail,
                fuzzyMatcherAvailable: fuzzyAvail,
                vocabularyAvailable:   vocabAvail,
                vocabularySize:        vocabSize,
                aliasAvailable:        !!window.VimeReportRecognitionAliases,
                aliasStatus,
                indexBuilt:            this._indexReady,
                ready:                 normAvail && fuzzyAvail && vocabAvail,
            };
        }

    }


    /* =========================================================
       EXPORT
       ========================================================= */

    window.VimeReportAdaptiveRecognition =
        new VimeReportAdaptiveRecognitionImpl();

})();
