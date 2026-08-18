(() => {
    'use strict';


    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER
     * ADAPTIVE RECOGNITION — TEST HARNESS  (Stage 1C.5)
     * =========================================================
     *
     * Isolated runtime test suite for the Adaptive Recognition stack.
     *
     * Tests: VimeReportTextNormalizer, VimeReportFuzzyMatcher,
     *        VimeReportAdaptiveRecognition
     *
     * DOES NOT:
     *   - modify vocabulary or any data file
     *   - write localStorage or IndexedDB
     *   - touch the DOM
     *   - modify scanner or highlighting state
     *
     * Usage (browser console after extension loads):
     *   VimeReportRecognitionTests.runAll()
     *   VimeReportRecognitionTests.runGroup('negative')
     *   VimeReportRecognitionTests.summary()
     *
     * Global API:
     *   window.VimeReportRecognitionTests
     *     .runAll()              -> SummaryResult
     *     .runCase(nameOrObj)    -> CaseResult
     *     .runGroup(groupName)   -> CaseResult[]
     *     .summary()             -> SummaryResult | { ran: false }
     * =========================================================
     */


    /* =========================================================
       STATUS CONSTANTS
       ========================================================= */

    const STATUS = Object.freeze({
        PASS:                    'PASS',
        FAIL:                    'FAIL',
        SKIP:                    'SKIP',
        VOCAB_MISSING:           'VOCAB_MISSING',
        POTENTIAL_FALSE_POSITIVE: 'POTENTIAL_FALSE_POSITIVE',
    });


    /* =========================================================
       HELPERS
       ========================================================= */

    function dep(name) {
        return window[name] ?? null;
    }

    /**
     * Check whether a word (or its lowercase form) appears in the
     * live official vocabulary.  Case-insensitive.
     */
    function vocabHas(word) {
        const vocab = window.VimeReportProhibitedWords ?? [];
        const lower = (word ?? '').toLowerCase();
        return vocab.some(w => w === word || w.toLowerCase() === lower);
    }

    /** Call recognizeToken safely; returns null if engine unavailable. */
    function recognize(token) {
        const engine = dep('VimeReportAdaptiveRecognition');
        if (!engine) return null;
        try {
            return engine.recognizeToken(token);
        } catch (e) {
            return {
                _error: String(e),
                recognized: false,
                level: 'none',
                method: 'none',
                confidence: 0,
                normalized: token,
                transformations: [],
                indexMap: [],
            };
        }
    }

    function findAliasMatches(text) {
        const aliases = dep('VimeReportRecognitionAliases');
        if (!aliases || typeof aliases.findMatches !== 'function') {
            return [];
        }
        try {
            return aliases.findMatches(text);
        } catch (e) {
            return [{
                _error: String(e)
            }];
        }
    }

    function summarizeCases(cases) {
        const failed = cases.filter((item) => item.status !== STATUS.PASS);

        return {
            passed: cases.length - failed.length,
            total: cases.length,
            failed
        };
    }

    function runContextProbe(input) {
        const detector = dep('VimeReportRelativeContextDetector');

        if (!detector || typeof detector.analyzeMessage !== 'function') {
            return null;
        }

        try {
            return detector.analyzeMessage({
                text: input,
                index: 0,
                time: '00:00:00'
            });
        } catch (e) {
            return { _error: String(e) };
        }
    }

    function runCrossMessageProbe(messages) {
        const scanner = dep('VimeReportViolationScanner');

        if (!scanner || typeof scanner._buildCrossMessageKnowledge !== 'function') {
            return null;
        }

        try {
            const prohibited = window.VimeReportProhibitedWords ?? [];
            return scanner._buildCrossMessageKnowledge(messages, prohibited);
        } catch (e) {
            return { _error: String(e) };
        }
    }

    function runCategoryProbe(input) {
        const rules = dep('VimeReportViolationRules');

        if (!rules || typeof rules.classifyMessage !== 'function') {
            return null;
        }

        try {
            return rules.classifyMessage(input);
        } catch (e) {
            return { _error: String(e) };
        }
    }

    function nowMs() {
        return (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
    }


    /* =========================================================
       STATIC TEST CASE DEFINITIONS
       =========================================================
       Fields:
         name                string
         group               string
         input               string
         expectedRecognized  boolean  (optional)
         expectedLevel       string[] one of these is acceptable
         expectedMethod      string[] one of these is acceptable
         expectedCanonical   string   validated against live vocab at runtime
         _normExpected       string   (normalizer group only)
         _normChanged        boolean  (normalizer group only)
         _fuzzyCanonical     string   (fuzzy-direct group only)
         _fuzzyExpectMatched boolean  (fuzzy-direct group only)
         _fuzzyExpectDist    number   (fuzzy-direct group only)
       ========================================================= */

    const STATIC_CASES = [

        /* ================================================================
           GROUP: normalizer
           Verify text-normalizer.js produces expected normalized forms.
           ================================================================ */

        { name: 'norm: plain word unchanged',
          group: 'normalizer', input: 'привет',
          _normExpected: 'привет', _normChanged: false },

        { name: 'norm: uppercase -> lowercase',
          group: 'normalizer', input: 'ПРИВЕТ',
          _normExpected: 'привет', _normChanged: true },

        { name: 'norm: repeated vowel collapsed',
          group: 'normalizer', input: 'привееет',
          _normExpected: 'привет', _normChanged: true },

        { name: 'norm: dash separator removed',
          group: 'normalizer', input: 'п-р-и-в-е-т',
          _normExpected: 'привет', _normChanged: true },

        { name: 'norm: legitimate double consonant preserved (касса)',
          group: 'normalizer', input: 'касса',
          _normExpected: 'касса', _normChanged: false },

        { name: 'norm: legitimate double consonant preserved (ванна)',
          group: 'normalizer', input: 'ванна',
          _normExpected: 'ванна', _normChanged: false },


        /* ================================================================
           GROUP: fuzzy-direct
           Verify fuzzy-matcher.js match() output directly.
           ================================================================ */

        { name: 'fuzzy: exact same word -> matched distance=0',
          group: 'fuzzy-direct', input: 'привет', _fuzzyCanonical: 'привет',
          _fuzzyExpectMatched: true, _fuzzyExpectDist: 0 },

        { name: 'fuzzy: дом vs том (must reject, too short)',
          group: 'fuzzy-direct', input: 'дом', _fuzzyCanonical: 'том',
          _fuzzyExpectMatched: false },

        { name: 'fuzzy: мама vs рама (must reject, too short)',
          group: 'fuzzy-direct', input: 'мама', _fuzzyCanonical: 'рама',
          _fuzzyExpectMatched: false },

        { name: 'fuzzy: туполй vs тупой (1 edit, medium bucket)',
          group: 'fuzzy-direct', input: 'туполй', _fuzzyCanonical: 'тупой',
          _fuzzyExpectMatched: true },

        { name: 'fuzzy: касса vs масса (must reject, too short)',
          group: 'fuzzy-direct', input: 'касса', _fuzzyCanonical: 'масса',
          _fuzzyExpectMatched: false },

        { name: 'fuzzy: привет vs привод (2 edits in medium bucket, low sim)',
          group: 'fuzzy-direct', input: 'привет', _fuzzyCanonical: 'привод',
          _fuzzyExpectMatched: false },


        /* ================================================================
           GROUP: alias
           Built-in knowledge layer (phrases / compact aliases).
           ================================================================ */

        { name: 'alias: иди на хуй',
          group: 'alias', input: 'иди на хуй',
          _aliasReasonId: 'player-insult-mat',
          _aliasCategory: 'INSULT_MAT' },

        { name: 'alias: 0 iq',
          group: 'alias', input: '0 iq',
          _aliasReasonId: 'player-insult',
          _aliasCategory: 'INSULT' },


        /* ================================================================
           GROUP: context
           Relative context detector checks.
           ================================================================ */

        { name: 'context: self mother',
          group: 'context', input: 'моя мама играет',
          _contextDetected: true, _contextTarget: 'self' },

        { name: 'context: other mother',
          group: 'context', input: 'твоя мама играет',
          _contextDetected: true, _contextTarget: 'other' },

        { name: 'context: third-person father',
          group: 'context', input: 'его отец дома',
          _contextDetected: true, _contextTarget: 'third-person' },

        { name: 'context: ambiguous brother',
          group: 'context', input: 'братан ты где',
          _contextDetected: false, _contextTarget: 'unknown' },


        /* ================================================================
           GROUP: cross-message
           Fail-closed same-author / different-author probes.
           ================================================================ */

        { name: 'cross-message: same author',
          group: 'cross-message',
          _crossMessages: [
              { author: 'a', index: 0, time: '00:00:01', text: 'иди на' },
              { author: 'a', index: 1, time: '00:00:02', text: 'хуй' }
          ],
          _crossExpected: true },

        { name: 'cross-message: different authors',
          group: 'cross-message',
          _crossMessages: [
              { author: 'a', index: 0, time: '00:00:01', text: 'иди на' },
              { author: 'b', index: 1, time: '00:00:02', text: 'хуй' }
          ],
          _crossExpected: false },


        /* ================================================================
           GROUP: category
           Official reason mapping checks.
           ================================================================ */

        { name: 'category: insult',
          group: 'category', input: 'ты дебил',
          _categoryReasonId: 'player-insult',
          _categoryLabel: 'Оскорбление игроков' },

        { name: 'category: mat',
          group: 'category', input: 'блять',
          _categoryReasonId: 'mat-amoral',
          _categoryLabel: 'Мат/Аморал' },

        { name: 'category: insult + mat',
          group: 'category', input: 'ебаный урод',
          _categoryReasonId: 'player-insult-mat',
          _categoryLabel: 'Оскорбление игроков + Мат' },


        /* ================================================================
           GROUP: positive
           Verify that normalized/obfuscated/typo forms are recognized.
           If expectedCanonical is set and not in live vocab -> VOCAB_MISSING.
           If expectedRecognized=true but result=false and normalized not in
           vocab -> VOCAB_MISSING (not engine fault).
           ================================================================ */

        { name: 'positive: digit lookalike 0->о',
          group: 'positive', input: 'пид0р',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'exact'],
          expectedLevel:  ['trusted'] },

        { name: 'positive: wrong layout gbljh -> пидор',
          group: 'positive', input: 'gbljh',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'layout', 'exact'],
          expectedLevel:  ['trusted'] },

        { name: 'positive: zero-width separator',
          group: 'positive', input: 'п\u200b-и-д-о-р',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'exact'],
          expectedLevel:  ['trusted'] },

        { name: 'positive: dash separator',
          group: 'positive', input: 'п-и-д-о-р',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'exact'],
          expectedLevel:  ['trusted'] },

        { name: 'positive: dot separator',
          group: 'positive', input: 'п.и.д.о.р',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'exact'],
          expectedLevel:  ['trusted'] },

        { name: 'positive: underscore separator',
          group: 'positive', input: 'п_и_д_о_р',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'exact'],
          expectedLevel:  ['trusted'] },

        { name: 'positive: space separator (token)',
          group: 'positive', input: 'п и д о р',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'exact'],
          expectedLevel:  ['trusted'] },

        { name: 'positive: typo придуиок -> придурок',
          group: 'positive', input: 'придуиок',
          expectedCanonical:  'придурок',
          expectedRecognized: true,
          expectedMethod: ['fuzzy'],
          expectedLevel:  ['high'] },

        { name: 'positive: typo туполй -> тупой',
          group: 'positive', input: 'туполй',
          expectedCanonical:  'тупой',
          expectedRecognized: true,
          expectedMethod: ['fuzzy'],
          expectedLevel:  ['high'] },

        { name: 'positive: repeated consonant ебанныыйй',
          group: 'positive', input: 'ебанныыйй',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'exact', 'fuzzy'],
          expectedLevel:  ['trusted', 'high', 'medium'] },

        { name: 'positive: vowel run пиiiидар',
          group: 'positive', input: 'пиiiидар',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'exact', 'fuzzy'],
          expectedLevel:  ['trusted', 'high'] },

        { name: 'positive: doubled consonant шллюха',
          group: 'positive', input: 'шллюха',
          expectedRecognized: true,
          expectedMethod: ['normalized', 'exact', 'fuzzy'],
          expectedLevel:  ['trusted', 'high', 'medium'] },


        /* ================================================================
           GROUP: negative
           Normal Russian words must not be recognized as prohibited.
           If word IS in official vocab, reports VOCAB_MISSING instead.
           ================================================================ */

        { name: 'negative: привет',  group: 'negative', input: 'привет',  expectedRecognized: false },
        { name: 'negative: ванна',   group: 'negative', input: 'ванна',   expectedRecognized: false },
        { name: 'negative: касса',   group: 'negative', input: 'касса',   expectedRecognized: false },
        { name: 'negative: мама',    group: 'negative', input: 'мама',    expectedRecognized: false },
        { name: 'negative: работа',  group: 'negative', input: 'работа',  expectedRecognized: false },
        { name: 'negative: игрок',   group: 'negative', input: 'игрок',   expectedRecognized: false },
        { name: 'negative: сервер',  group: 'negative', input: 'сервер',  expectedRecognized: false },
        { name: 'negative: команда', group: 'negative', input: 'команда', expectedRecognized: false },
        { name: 'negative: репорт',  group: 'negative', input: 'репорт',  expectedRecognized: false },
        { name: 'negative: окно',    group: 'negative', input: 'окно',    expectedRecognized: false },
        { name: 'negative: машина',  group: 'negative', input: 'машина',  expectedRecognized: false },
        { name: 'negative: сегодня', group: 'negative', input: 'сегодня', expectedRecognized: false },
        { name: 'negative: hello',    group: 'negative', input: 'hello',    expectedRecognized: false },
        { name: 'negative: привет всем', group: 'negative', input: 'привет всем', expectedRecognized: false },
        { name: 'negative: hello world', group: 'negative', input: 'hello world', expectedRecognized: false },
        { name: 'negative: minecraft server', group: 'negative', input: 'minecraft server', expectedRecognized: false },
        { name: 'negative: player123', group: 'negative', input: 'player123', expectedRecognized: false },
        { name: 'negative: numbers only', group: 'negative', input: '123 456 7890', expectedRecognized: false },
        { name: 'negative: punctuation only', group: 'negative', input: '!!! ??? ...', expectedRecognized: false },
        { name: 'negative: harmless family', group: 'negative', input: 'моя мама дома', expectedRecognized: false },
        { name: 'negative: harmless slang', group: 'negative', input: 'братан как дела', expectedRecognized: false },
        { name: 'negative: benign mixed script', group: 'negative', input: 'pрiвет', expectedRecognized: false },
        { name: 'negative: safe layout-like', group: 'negative', input: 'ghbdtn all', expectedRecognized: false },
        { name: 'negative: dangerous substring word', group: 'negative', input: 'херобрин', expectedRecognized: false },
        { name: 'negative: legitimate doubles', group: 'negative', input: 'классный сервер', expectedRecognized: false },
        { name: 'negative: short token', group: 'negative', input: 'ок', expectedRecognized: false },
        { name: 'negative: username style', group: 'negative', input: 'A1exR_', expectedRecognized: false },
        { name: 'negative: minecraft terms', group: 'negative', input: 'крипер и зомби', expectedRecognized: false },
        { name: 'negative: ascii slang', group: 'negative', input: 'lol gg wp', expectedRecognized: false },
        { name: 'negative: benign typo-like', group: 'negative', input: 'привед всем', expectedRecognized: false },
        { name: 'negative: repeated benign letters', group: 'negative', input: 'сссервис', expectedRecognized: false },


        /* ================================================================
           GROUP: near-miss
           Words that are one character away from common Russian words.
           Flags POTENTIAL_FALSE_POSITIVE if recognized at high/trusted.
           ================================================================ */

        { name: 'near-miss: рама',   group: 'near-miss', input: 'рама'   },
        { name: 'near-miss: масса',  group: 'near-miss', input: 'масса'  },
        { name: 'near-miss: том',    group: 'near-miss', input: 'том'    },
        { name: 'near-miss: рот',    group: 'near-miss', input: 'рот'    },
        { name: 'near-miss: банка',  group: 'near-miss', input: 'банка'  },
        { name: 'near-miss: привод', group: 'near-miss', input: 'привод' },
        { name: 'near-miss: мамка',  group: 'near-miss', input: 'мамка'  },
        { name: 'near-miss: дача',   group: 'near-miss', input: 'дача'   },
        { name: 'near-miss: темка',  group: 'near-miss', input: 'темка'  },

    ];


    /* =========================================================
       SINGLE-CASE RUNNER
       ========================================================= */

    function runSingleCase(tc) {
        const base = {
            name:     tc.name,
            group:    tc.group,
            input:    tc.input,
            status:   STATUS.SKIP,
            result:   null,
            failures: [],
            reason:   null,
        };

        /* ---- Normalizer group ---- */
        if (tc.group === 'normalizer') {
            const norm = dep('VimeReportTextNormalizer');
            if (!norm) {
                return { ...base, reason: 'normalizer-unavailable' };
            }

            let nr;
            try { nr = norm.normalizeToken(tc.input); }
            catch (e) { return { ...base, status: STATUS.FAIL, reason: String(e) }; }

            const failures = [];
            if (tc._normExpected !== undefined && nr.normalized !== tc._normExpected) {
                failures.push(
                    `normalized: expected "${tc._normExpected}", got "${nr.normalized}"`
                );
            }
            if (tc._normChanged !== undefined && nr.changed !== tc._normChanged) {
                failures.push(
                    `changed: expected ${tc._normChanged}, got ${nr.changed}`
                );
            }

            return {
                ...base,
                result: {
                    original:       nr.original,
                    normalized:     nr.normalized,
                    changed:        nr.changed,
                    transformCount: nr.transformations?.length ?? 0,
                    indexMapLen:    nr.indexMap?.length ?? 0,
                },
                status:   failures.length === 0 ? STATUS.PASS : STATUS.FAIL,
                failures,
            };
        }

        /* ---- Fuzzy-direct group ---- */
        if (tc.group === 'fuzzy-direct') {
            const fuzzy = dep('VimeReportFuzzyMatcher');
            if (!fuzzy) {
                return { ...base, reason: 'fuzzy-matcher-unavailable' };
            }

            let r;
            try { r = fuzzy.match(tc.input, tc._fuzzyCanonical); }
            catch (e) { return { ...base, status: STATUS.FAIL, reason: String(e) }; }

            const failures = [];
            if (tc._fuzzyExpectMatched !== undefined && r.matched !== tc._fuzzyExpectMatched) {
                failures.push(`matched: expected ${tc._fuzzyExpectMatched}, got ${r.matched}`);
            }
            if (tc._fuzzyExpectDist !== undefined && r.distance !== tc._fuzzyExpectDist) {
                failures.push(`distance: expected ${tc._fuzzyExpectDist}, got ${r.distance}`);
            }

            return {
                ...base,
                result: {
                    input:      r.input,
                    canonical:  r.canonical ?? tc._fuzzyCanonical,
                    matched:    r.matched,
                    distance:   r.distance,
                    similarity: r.similarity,
                    confidence: r.confidence,
                    reason:     r.reason,
                },
                status:   failures.length === 0 ? STATUS.PASS : STATUS.FAIL,
                failures,
            };
        }

        /* ---- Alias group ---- */
        if (tc.group === 'alias') {
            const matches = findAliasMatches(tc.input);

            if (!matches.length) {
                return {
                    ...base,
                    status: STATUS.FAIL,
                    reason: 'alias-not-found',
                    failures: ['expected built-in alias match, got none']
                };
            }

            const match = matches[0];
            const failures = [];

            if (tc._aliasReasonId && match.reasonId !== tc._aliasReasonId) {
                failures.push(
                    `reasonId: expected "${tc._aliasReasonId}", got "${match.reasonId}"`
                );
            }

            if (tc._aliasCategory && match.category !== tc._aliasCategory) {
                failures.push(
                    `category: expected "${tc._aliasCategory}", got "${match.category}"`
                );
            }

            return {
                ...base,
                result: {
                    id: match.id,
                    canonical: match.canonical,
                    category: match.category,
                    reasonId: match.reasonId,
                    confidence: match.confidence,
                    matchedText: match.matchedText ?? match.alias ?? match.canonical,
                    matchType: match.matchType ?? 'alias'
                },
                status: failures.length === 0 ? STATUS.PASS : STATUS.FAIL,
                failures,
                reason: null
            };
        }

        /* ---- Context group ---- */
        if (tc.group === 'context') {
            const result = runContextProbe(tc.input);

            if (!result) {
                return { ...base, reason: 'context-detector-unavailable' };
            }

            const failures = [];
            const detected = Boolean(result.detected);

            if (tc._contextDetected !== undefined && detected !== tc._contextDetected) {
                failures.push(`detected: expected ${tc._contextDetected}, got ${detected}`);
            }

            const target = result.target ??
                result.relatives?.[0]?.target ??
                result.parentImplications?.[0]?.target ??
                'unknown';

            if (tc._contextTarget && target !== tc._contextTarget) {
                failures.push(`target: expected "${tc._contextTarget}", got "${target}"`);
            }

            return {
                ...base,
                result: {
                    detected,
                    target,
                    confidence: result.confidence ?? null,
                    relativeCount: Array.isArray(result.relatives) ? result.relatives.length : 0,
                    parentImplicationCount: Array.isArray(result.parentImplications) ? result.parentImplications.length : 0
                },
                status: failures.length === 0 ? STATUS.PASS : STATUS.FAIL,
                failures,
                reason: null
            };
        }

        /* ---- Cross-message group ---- */
        if (tc.group === 'cross-message') {
            const result = runCrossMessageProbe(tc._crossMessages);

            if (!result) {
                return { ...base, reason: 'cross-message-unavailable' };
            }

            const failures = [];
            const detected = Array.isArray(result.descriptors) && result.descriptors.length > 0;

            if (tc._crossExpected !== undefined && detected !== tc._crossExpected) {
                failures.push(`detected: expected ${tc._crossExpected}, got ${detected}`);
            }

            return {
                ...base,
                result: {
                    detected,
                    descriptorCount: Array.isArray(result.descriptors) ? result.descriptors.length : 0,
                    recommendationCount: Array.isArray(result.recommendations) ? result.recommendations.length : 0,
                    messages: tc._crossMessages
                },
                status: failures.length === 0 ? STATUS.PASS : STATUS.FAIL,
                failures,
                reason: null
            };
        }

        /* ---- Category group ---- */
        if (tc.group === 'category') {
            const classification = runCategoryProbe(tc.input);

            if (!classification) {
                return { ...base, reason: 'category-rules-unavailable' };
            }

            const failures = [];
            const reasonId = classification.reason?.reasonId ?? null;
            const label = classification.reason?.label ?? null;

            if (tc._categoryReasonId && reasonId !== tc._categoryReasonId) {
                failures.push(`reasonId: expected "${tc._categoryReasonId}", got "${reasonId}"`);
            }

            if (tc._categoryLabel && label !== tc._categoryLabel) {
                failures.push(`label: expected "${tc._categoryLabel}", got "${label}"`);
            }

            return {
                ...base,
                result: {
                    type: classification.type ?? null,
                    reasonId,
                    label,
                    confidence: classification.confidence ?? null
                },
                status: failures.length === 0 ? STATUS.PASS : STATUS.FAIL,
                failures,
                reason: null
            };
        }

        /* ---- All recognition groups ---- */
        const result = recognize(tc.input);

        if (!result) {
            return { ...base, reason: 'engine-unavailable' };
        }
        if (result._error === 'vocabulary-not-ready') {
            return { ...base, reason: 'vocabulary-not-ready' };
        }
        if (result._error === 'dependencies-unavailable') {
            return { ...base, reason: 'dependencies-unavailable' };
        }

        const resultSummary = {
            recognized:     result.recognized,
            canonical:      result.canonical,
            matchedText:    result.matchedText,
            source:         result.source,
            matchType:      result.matchType,
            reason:         result.reason,
            method:         result.method,
            level:          result.level,
            confidence:     result.confidence,
            distance:       result.distance,
            similarity:     result.similarity,
            normalized:     result.normalized,
            normalizationCandidates: result.normalizationCandidates ?? [],
            transformCount: result.transformations?.length ?? 0,
            indexMapLen:    result.indexMap?.length ?? 0,
        };
        base.result = resultSummary;

        /* ---- near-miss: audit for suspicious false positives ---- */
        if (tc.group === 'near-miss') {
            if (result.recognized &&
                (result.level === 'high' || result.level === 'trusted')
            ) {
                return {
                    ...base,
                    status: STATUS.POTENTIAL_FALSE_POSITIVE,
                    reason: `recognized as "${result.canonical}" ` +
                            `(${result.level}, conf=${(result.confidence * 100).toFixed(1)}%)`,
                };
            }
            return { ...base, status: STATUS.PASS };
        }

        /* ---- negative: normal words should not be recognized ---- */
        if (tc.group === 'negative') {
            if (result.recognized && vocabHas(tc.input)) {
                return {
                    ...base,
                    status: STATUS.VOCAB_MISSING,
                    reason: `"${tc.input}" is present in official vocabulary`,
                };
            }
            if (result.recognized) {
                return {
                    ...base,
                    status: STATUS.FAIL,
                    failures: [
                        `recognized: expected false, got true ` +
                        `(canonical="${result.canonical}", level="${result.level}")`
                    ],
                };
            }
            return { ...base, status: STATUS.PASS };
        }

        /* ---- positive: validate expected canonical against live vocab ---- */
        if (tc.expectedCanonical) {
            if (!vocabHas(tc.expectedCanonical)) {
                return {
                    ...base,
                    status: STATUS.VOCAB_MISSING,
                    reason: `expected canonical "${tc.expectedCanonical}" not in official vocabulary`,
                };
            }
        }

        /*
         * If we expect recognized=true but got false, check whether the
         * normalized form itself is missing from the vocabulary before
         * declaring a FAIL — that would be a vocabulary gap, not an engine bug.
         */
        const failures = [];

        if (tc.expectedRecognized === true && !result.recognized) {
            if (!vocabHas(result.normalized)) {
                return {
                    ...base,
                    status: STATUS.VOCAB_MISSING,
                    reason: `normalized form "${result.normalized}" not in official vocabulary`,
                };
            }
            failures.push(
                `recognized: expected true, got false ` +
                `(normalized="${result.normalized}" IS in vocab)`
            );
        } else if (tc.expectedRecognized === false && result.recognized) {
            failures.push(
                `recognized: expected false, got true ` +
                `(canonical="${result.canonical}", level="${result.level}")`
            );
        }

        if (failures.length === 0) {
            if (tc.expectedLevel?.length > 0 &&
                !tc.expectedLevel.includes(result.level)
            ) {
                failures.push(
                    `level: expected one of [${tc.expectedLevel.join(', ')}], ` +
                    `got "${result.level}"`
                );
            }
            if (tc.expectedMethod?.length > 0 &&
                !tc.expectedMethod.includes(result.method)
            ) {
                failures.push(
                    `method: expected one of [${tc.expectedMethod.join(', ')}], ` +
                    `got "${result.method}"`
                );
            }
        }

        return {
            ...base,
            status:   failures.length === 0 ? STATUS.PASS : STATUS.FAIL,
            failures,
        };
    }


    /* =========================================================
       DYNAMIC: EXACT-MATCH TESTS FROM LIVE VOCAB
       ========================================================= */

    /** Pick first N vocab entries and verify exact recognition. */
    function buildAndRunExactTests(n) {
        const vocab = window.VimeReportProhibitedWords ?? [];
        if (vocab.length === 0) {
            return [{
                name:     'exact-vocab: (no vocabulary loaded)',
                group:    'exact',
                input:    '',
                status:   STATUS.SKIP,
                reason:   'vocabulary-not-ready',
                result:   null,
                failures: [],
            }];
        }

        return vocab.slice(0, n).map((word, i) => {
            const label = `exact-vocab: entry ${i + 1} of ${n}`;
            const result = recognize(word);

            if (!result) {
                return {
                    name: label, group: 'exact', input: word,
                    status: STATUS.SKIP, reason: 'engine-unavailable',
                    result: null, failures: [],
                };
            }
            if (result._error) {
                return {
                    name: label, group: 'exact', input: word,
                    status: STATUS.SKIP, reason: result._error,
                    result: null, failures: [],
                };
            }

            const failures = [];
            if (!result.recognized)
                failures.push('recognized: expected true, got false');
            if (result.method !== 'exact' && result.method !== 'normalized')
                failures.push(`method: expected exact or normalized, got "${result.method}"`);
            if (result.level !== 'trusted')
                failures.push(`level: expected trusted, got "${result.level}"`);

            return {
                name: label, group: 'exact', input: word,
                status:   failures.length === 0 ? STATUS.PASS : STATUS.FAIL,
                result:   {
                    recognized: result.recognized,
                    canonical:  result.canonical,
                    method:     result.method,
                    level:      result.level,
                    confidence: result.confidence,
                    normalized: result.normalized,
                },
                failures, reason: null,
            };
        });
    }


    /* =========================================================
       STABILITY TESTS
       ========================================================= */

    function runStabilityTests() {
        const INPUTS = ['привет', 'п-и-д-о-р', 'придуиок'];
        const REPS   = 3;

        return INPUTS.map(input => {
            const results = [];
            for (let i = 0; i < REPS; i++) {
                const r = recognize(input);
                if (r) results.push(r);
            }

            if (results.length < REPS) {
                return {
                    name: `stability: "${input}" ×${REPS}`,
                    group: 'stability', input,
                    status: STATUS.SKIP, reason: 'engine-unavailable',
                    result: null, failures: [],
                };
            }

            const ref      = results[0];
            const failures = [];

            for (let i = 1; i < results.length; i++) {
                const r = results[i];
                if (r.recognized !== ref.recognized)
                    failures.push(`run ${i + 1}: recognized mismatch`);
                if (r.canonical !== ref.canonical)
                    failures.push(`run ${i + 1}: canonical mismatch`);
                if (r.confidence !== ref.confidence)
                    failures.push(`run ${i + 1}: confidence mismatch`);
                if (r.level !== ref.level)
                    failures.push(`run ${i + 1}: level mismatch`);
                if (r.method !== ref.method)
                    failures.push(`run ${i + 1}: method mismatch`);
            }

            return {
                name: `stability: "${input}" ×${REPS}`,
                group: 'stability', input,
                status: failures.length === 0 ? STATUS.PASS : STATUS.FAIL,
                result: {
                    recognized: ref.recognized,
                    canonical:  ref.canonical,
                    method:     ref.method,
                    level:      ref.level,
                    confidence: ref.confidence,
                    runs:       REPS,
                },
                failures, reason: null,
            };
        });
    }


    /* =========================================================
       PERFORMANCE TEST
       ========================================================= */

    function runPerfTest(reps) {
        const CORPUS = [
            'привет',   'придуиок',  'п-и-д-о-р', 'пид0р',   'туполй',
            'ванна',    'касса',     'игрок',      'ебанныыйй', 'шллюха',
            'рама',     'масса',     'команда',    'машина',  'сегодня',
        ];

        const engine = dep('VimeReportAdaptiveRecognition');
        if (!engine) {
            return [{
                name:     `perf: ${reps} calls`,
                group:    'perf',
                input:    '(corpus)',
                status:   STATUS.SKIP,
                reason:   'engine-unavailable',
                result:   null,
                failures: [],
            }];
        }

        const t0 = nowMs();
        let count = 0;

        for (let i = 0; i < reps; i++) {
            const token = CORPUS[i % CORPUS.length];
            try { engine.recognizeToken(token); count++; } catch (_) {}
        }

        const elapsed = nowMs() - t0;
        const avgMs   = elapsed / Math.max(1, count);
        const ok      = avgMs < 5;

        return [{
            name:   `perf: ${count} calls`,
            group:  'perf',
            input:  '(corpus)',
            status: ok ? STATUS.PASS : STATUS.FAIL,
            result: {
                totalCalls: count,
                totalMs:    +elapsed.toFixed(2),
                avgMs:      +avgMs.toFixed(3),
                threshold:  5,
            },
            failures: ok
                ? []
                : [`avg ${avgMs.toFixed(2)}ms/call exceeds 5ms threshold`],
            reason: null,
        }];
    }


    /* =========================================================
       TEST RUNNER CLASS
       ========================================================= */

    class VimeReportRecognitionTestsImpl {

        constructor() {
            this._lastSummary = null;
        }

        /** Run a single case by name string or test-case object. */
        runCase(nameOrObj) {
            if (typeof nameOrObj === 'string') {
                const tc = STATIC_CASES.find(c => c.name === nameOrObj);
                return tc ? runSingleCase(tc) : null;
            }
            return runSingleCase(nameOrObj);
        }

        /** Run only the named group from STATIC_CASES. */
        runGroup(groupName) {
            return STATIC_CASES
                .filter(tc => tc.group === groupName)
                .map(runSingleCase);
        }

        /** Run the complete test suite and return a SummaryResult. */
        runAll() {
            const t0 = nowMs();

            const results = [
                ...STATIC_CASES.map(runSingleCase),
                ...buildAndRunExactTests(5),
                ...runStabilityTests(),
                ...runPerfTest(200),
            ];

            const elapsed = nowMs() - t0;

            let passed = 0, failed = 0, skipped = 0, vocabMiss = 0, pfp = 0;

            for (const r of results) {
                switch (r.status) {
                    case STATUS.PASS:                     passed++;    break;
                    case STATUS.FAIL:                     failed++;    break;
                    case STATUS.SKIP:                     skipped++;   break;
                    case STATUS.VOCAB_MISSING:            vocabMiss++; break;
                    case STATUS.POTENTIAL_FALSE_POSITIVE: pfp++;       break;
                }
            }

            const summary = {
                ran:                     true,
                total:                   results.length,
                passed,
                failed,
                skipped,
                vocabMissing:            vocabMiss,
                potentialFalsePositives: pfp,
                durationMs:              +elapsed.toFixed(2),
                cases:                   results,
            };

            this._lastSummary = summary;
            this._printSummary(summary, results);
            return summary;
        }

        /** Return the last runAll() result, or { ran: false } if not run yet. */
        summary() {
            return this._lastSummary ?? { ran: false };
        }

        /* ---- Private: console output ---- */

        _printSummary(summary, results) {
            console.group('[VimeReportRecognitionTests] runAll()');

            console.log(
                `Total ${summary.total}  |  ` +
                `PASS ${summary.passed}  FAIL ${summary.failed}  ` +
                `SKIP ${summary.skipped}  VOCAB_MISSING ${summary.vocabMissing}  ` +
                `PFP ${summary.potentialFalsePositives}  ` +
                `(${summary.durationMs}ms)`
            );

            const attention = results.filter(
                r => r.status === STATUS.FAIL ||
                     r.status === STATUS.POTENTIAL_FALSE_POSITIVE
            );

            if (attention.length > 0) {
                console.warn(`Needs attention (${attention.length}):`);
                attention.forEach(r => {
                    const detail = [r.reason, ...r.failures]
                        .filter(Boolean).join(' — ');
                    console.warn(`  [${r.status}] ${r.name}${detail ? ' — ' + detail : ''}`);
                });
            }

            if (typeof console.table === 'function') {
                console.table(results.map(r => ({
                    group:  r.group,
                    name:   r.name.slice(0, 42),
                    status: r.status,
                    method: r.result?.method  ?? '—',
                    level:  r.result?.level   ?? '—',
                    conf:   r.result?.confidence != null
                        ? (r.result.confidence * 100).toFixed(0) + '%'
                        : '—',
                })));
            }

            console.groupEnd();
        }

        run() {
            const exact = buildAndRunExactTests(5);
            const shouldMatch = [
                ...this.runGroup('alias'),
                ...this.runGroup('positive'),
                ...exact
            ];
            const shouldNotMatch = [
                ...this.runGroup('negative'),
                ...this.runGroup('near-miss')
            ];
            const context = this.runGroup('context');
            const crossMessage = this.runGroup('cross-message');
            const category = this.runGroup('category');

            return {
                shouldMatch: summarizeCases(shouldMatch),
                shouldNotMatch: summarizeCases(shouldNotMatch),
                context: summarizeCases(context),
                crossMessage: summarizeCases(crossMessage),
                category: summarizeCases(category)
            };
        }

    }


    /* =========================================================
       EXPORT
       ========================================================= */

    window.VimeReportRecognitionTests =
        new VimeReportRecognitionTestsImpl();

})();
