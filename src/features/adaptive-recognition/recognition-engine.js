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
     *     -> embedded lookup inside glued token
     *     -> if no exact/embedded match: fuzzy search via VimeReportFuzzyMatcher
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
     *   >= CONF_MEDIUM -> medium  (recognized: true; confirm with moderator)
     *   >= CONF_LOW    -> low     (recognized: false; weak candidate only)
     *   <  CONF_LOW    -> none    (recognized: false)
     */
    const CONF_HIGH = 0.82;
    const CONF_MEDIUM = 0.70;
    const CONF_LOW = 0.55;


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
                '[VimeReportAdaptiveRecognition] Dependency not available:',
                name
            );
        }

        return obj ?? null;
    }


    /**
     * Build a "not recognized" result, carrying normalizer metadata when
     * available so callers can still see what the normalizer produced.
     *
     * @param {string} original
     * @param {object|null} normResult
     * @param {Array} normalizationCandidates
     * @returns {RecognitionResult}
     */
    function noMatch(
        original,
        normResult,
        normalizationCandidates = []
    ) {
        return {
            original,

            normalized:
                normResult?.normalized ??
                original,

            recognized:
                false,

            canonical:
                null,

            matchedText:
                null,

            category:
                null,

            confidence:
                0,

            level:
                'none',

            method:
                'none',

            matchType:
                'none',

            source:
                'none',

            distance:
                null,

            similarity:
                null,

            reason:
                null,

            transformations:
                normResult?.transformations ??
                [],

            indexMap:
                normResult?.indexMap ??
                [],

            normalizationCandidates,

            alternatives:
                [],

            candidateId:
                null
        };
    }


    /**
     * Map a fuzzy-matcher confidence value to a named level.
     *
     * @param {number} conf
     * @returns {'high'|'medium'|'low'|'none'}
     */
    function fuzzyLevel(conf) {
        if (conf >= CONF_HIGH) {
            return 'high';
        }

        if (conf >= CONF_MEDIUM) {
            return 'medium';
        }

        if (conf >= CONF_LOW) {
            return 'low';
        }

        return 'none';
    }


    /* =========================================================
       RECOGNITION ENGINE
       ========================================================= */

    class VimeReportAdaptiveRecognitionImpl {

        constructor() {

            /*
             * Индекс строится лениво после загрузки
             * VimeReportProhibitedWords.
             */

            this._indexReady =
                false;

            /*
             * Set нормализованных официальных слов.
             */
            this._exactSet =
                null;

            /*
             * first char ->
             * Array<{ word, normalized }>
             *
             * Используется для fuzzy pre-filter.
             */
            this._charIndex =
                null;

            /*
             * Официальные длинные словарные формы,
             * которые разрешено искать внутри
             * намеренно склеенных токенов.
             *
             * Например:
             *
             * ябухаюименнопохуй
             *
             * Внутри может быть найдено:
             *
             * похуй
             *
             * Короткие формы сюда не попадают.
             */
            this._embeddedEntries =
                [];

            this._aliasReady =
                false;
        }


        /* =====================================================
           INDEX MANAGEMENT
           ===================================================== */

        _ensureIndex() {

            if (
                this._indexReady
            ) {
                return true;
            }


            if (
                !window
                    .VimeReportProhibitedWordsReady
            ) {
                return false;
            }


            const vocab =
                window
                    .VimeReportProhibitedWords;


            if (
                !Array.isArray(vocab) ||
                vocab.length === 0
            ) {
                return false;
            }


            this._buildIndex(
                vocab
            );


            return true;
        }


        /**
         * Создаёт:
         *
         * exact index
         * fuzzy first-char index
         * embedded lookup index
         */
        _buildIndex(
            vocab
        ) {

            const normalizer =
                dep(
                    'VimeReportTextNormalizer'
                );


            this._exactSet =
                new Set();


            this._charIndex =
                new Map();


            this._embeddedEntries =
                [];


            this._aliasReady =
                !!window
                    .VimeReportRecognitionAliases;


            for (
                const word
                of vocab
                ) {

                if (
                    typeof word !==
                    'string' ||
                    word.length === 0
                ) {
                    continue;
                }


                const forms =

                    normalizer &&
                    typeof normalizer
                        .normalizeTokenForms ===
                    'function'

                        ? normalizer
                            .normalizeTokenForms(
                                word
                            )

                        : [
                            {
                                kind:
                                    'base',

                                result:
                                    normalizer

                                        ? normalizer
                                            .normalizeToken(
                                                word
                                            )

                                        : {
                                            normalized:
                                                word
                                                    .toLowerCase(),

                                            changed:
                                                false
                                        }
                            }
                        ];


                const seen =
                    new Set();


                for (
                    const form
                    of forms
                    ) {

                    const normalized =
                        form
                            ?.result
                            ?.normalized;


                    if (
                        typeof normalized !==
                        'string' ||
                        !normalized
                    ) {
                        continue;
                    }


                    if (
                        seen.has(
                            normalized
                        )
                    ) {
                        continue;
                    }


                    seen.add(
                        normalized
                    );


                    /*
                     * Exact lookup.
                     */
                    this._exactSet.add(
                        normalized
                    );


                    /*
                     * =================================================
                     * EMBEDDED / GLUED TOKEN INDEX
                     * =================================================
                     *
                     * Добавляем только достаточно длинные формы.
                     *
                     * Пример:
                     *
                     * ябухаюименнопохуй
                     *           ^^^^^
                     *
                     * При этом короткие опасные корни
                     * намеренно сюда не попадают.
                     *
                     * Это предотвращает совпадения вроде:
                     *
                     * страхуй -> хуй
                     *
                     * Фразы с пробелами тоже исключаются.
                     */

                    if (
                        normalized.length >=
                        4 &&
                        /^[а-яёієa-z0-9]+$/i
                            .test(
                                normalized
                            )
                    ) {

                        this._embeddedEntries
                            .push({
                                word,
                                normalized
                            });
                    }


                    /*
                     * Fuzzy first-character index.
                     */
                    const fc =
                        normalized[0];


                    if (!fc) {
                        continue;
                    }


                    if (
                        !this._charIndex
                            .has(fc)
                    ) {
                        this._charIndex
                            .set(
                                fc,
                                []
                            );
                    }


                    this._charIndex
                        .get(fc)
                        .push({
                            word,
                            normalized
                        });
                }
            }


            /*
             * Убираем дубли embedded-записей.
             *
             * Один vocab-word может породить
             * несколько одинаковых normalized forms.
             */
            const embeddedSeen =
                new Set();


            this._embeddedEntries =
                this._embeddedEntries
                    .filter(
                        (entry) => {

                            const key =
                                `${entry.word}\u0000${entry.normalized}`;


                            if (
                                embeddedSeen
                                    .has(key)
                            ) {
                                return false;
                            }


                            embeddedSeen
                                .add(key);


                            return true;
                        }
                    );


            /*
             * Сначала длинные слова.
             *
             * Если внутри токена одновременно:
             *
             * "еб"
             * "ебать"
             * "поебать"
             *
             * приоритет получает наиболее
             * конкретная длинная форма.
             */
            this._embeddedEntries
                .sort(
                    (a, b) =>
                        b.normalized.length -
                        a.normalized.length
                );


            this._indexReady =
                true;


            console.log(
                '[VimeReportAdaptiveRecognition] Index built:',
                this._exactSet.size,
                'entries,',
                this._charIndex.size,
                'first-char buckets,',
                this._embeddedEntries.length,
                'embedded entries'
            );
        }


        /* =====================================================
           CANDIDATE PRE-FILTER
           ===================================================== */

        _getCandidates(
            normInput
        ) {

            if (
                !this._charIndex
            ) {
                return [];
            }


            const fc =
                normInput[0];


            const len =
                normInput.length;


            const bucket =
                this._charIndex
                    .get(fc);


            if (
                !bucket
            ) {
                return [];
            }


            return bucket
                .filter(
                    (candidate) =>
                        Math.abs(
                            candidate
                                .normalized
                                .length -
                            len
                        ) <=
                        CANDIDATE_LENGTH_WINDOW
                );
        }


        /* =====================================================
           EMBEDDED LOOKUP
           ===================================================== */

        /**
         * Ищет официальное запрещённое слово
         * внутри длинного склеенного токена.
         *
         * Пример:
         *
         * ябухаюименнопохуй
         *
         * -> похуй
         *
         * Важно:
         *
         * - exact match обрабатывается раньше;
         * - candidate должен быть короче всего token;
         * - короткие формы сюда не индексируются;
         * - fuzzy здесь НЕ используется;
         * - возвращается только официальный
         *   vocabulary candidate.
         */
        _findEmbeddedMatch(
            formResults
        ) {

            if (
                !Array.isArray(
                    formResults
                ) ||
                !Array.isArray(
                    this._embeddedEntries
                ) ||
                !this._embeddedEntries
                    .length
            ) {
                return null;
            }


            const hits =
                [];


            for (
                const form
                of formResults
                ) {

                const normalized =
                    form
                        ?.result
                        ?.normalized;


                /*
                 * Слишком короткий token
                 * нет смысла рассматривать
                 * как glued construction.
                 */
                if (
                    typeof normalized !==
                    'string' ||
                    normalized.length <
                    5
                ) {
                    continue;
                }


                for (
                    const candidate
                    of this._embeddedEntries
                    ) {

                    /*
                     * Если candidate равен длине
                     * token — это уже должен был
                     * поймать exact lookup.
                     */
                    if (
                        candidate
                            .normalized
                            .length >=
                        normalized.length
                    ) {
                        continue;
                    }


                    const index =
                        normalized
                            .indexOf(
                                candidate
                                    .normalized
                            );


                    if (
                        index ===
                        -1
                    ) {
                        continue;
                    }


                    hits.push({
                        form,

                        word:
                        candidate
                            .word,

                        normalized:
                        candidate
                            .normalized,

                        index
                    });
                }
            }


            if (
                !hits.length
            ) {
                return null;
            }


            /*
             * Самое длинное совпадение имеет
             * наивысший приоритет.
             *
             * Если длина одинаковая —
             * более раннее в token.
             */
            hits.sort(
                (a, b) =>
                    b.normalized.length -
                    a.normalized.length ||
                    a.index -
                    b.index
            );


            return hits[0];
        }


        /* =====================================================
           PUBLIC API — RECOGNIZE TOKEN
           ===================================================== */

        recognizeToken(
            token,
            options = {}
        ) {

            if (
                typeof token !==
                'string' ||
                token.length === 0
            ) {
                return noMatch(
                    String(
                        token ??
                        ''
                    ),
                    null
                );
            }


            /*
             * Dependencies.
             */
            const normalizer =
                dep(
                    'VimeReportTextNormalizer'
                );


            const fuzzy =
                dep(
                    'VimeReportFuzzyMatcher'
                );


            if (
                !normalizer ||
                !fuzzy
            ) {
                return {
                    ...noMatch(
                        token,
                        null
                    ),

                    _error:
                        'dependencies-unavailable'
                };
            }


            /*
             * Vocabulary index.
             */
            if (
                !this._ensureIndex()
            ) {
                return {
                    ...noMatch(
                        token,
                        null
                    ),

                    _error:
                        'vocabulary-not-ready'
                };
            }


            /*
             * =================================================
             * STEP 1 — NORMALIZE
             * =================================================
             */

            const formResults =

                typeof normalizer
                    .normalizeTokenForms ===
                'function'

                    ? normalizer
                        .normalizeTokenForms(
                            token
                        )

                    : [
                        {
                            kind:
                                'base',

                            result:
                                normalizer
                                    .normalizeToken(
                                        token
                                    )
                        }
                    ];


            const primaryForm =
                formResults[0]
                    ?.result ??
                normalizer
                    .normalizeToken(
                        token
                    );


            const normInput =
                primaryForm
                    .normalized;


            const normalizationCandidates =
                formResults
                    .map(
                        (form) => ({
                            kind:
                            form.kind,

                            normalized:
                            form.result
                                .normalized,

                            changed:
                            form.result
                                .changed
                        })
                    );


            const aliases =
                window
                    .VimeReportRecognitionAliases;


            /*
             * =================================================
             * STEP 2 — EXACT LOOKUP
             * =================================================
             */

            const exactCandidate =
                formResults
                    .find(
                        (form) =>
                            form
                                ?.result
                                ?.normalized &&
                            this._exactSet
                                .has(
                                    form
                                        .result
                                        .normalized
                                )
                    );


            if (
                exactCandidate
            ) {

                const method =

                    exactCandidate
                        .kind ===
                    'base'

                        ? (
                            exactCandidate
                                .result
                                .changed

                                ? 'normalized'

                                : 'exact'
                        )

                        : 'layout';


                return {
                    original:
                    token,

                    normalized:
                    exactCandidate
                        .result
                        .normalized,

                    recognized:
                        true,

                    canonical:
                    exactCandidate
                        .result
                        .normalized,

                    matchedText:
                    exactCandidate
                        .result
                        .normalized,

                    category:
                        null,

                    confidence:
                        1.0,

                    level:
                        'trusted',

                    method,

                    distance:
                        0,

                    similarity:
                        1.0,

                    matchType:
                    method,

                    source:
                        aliases
                            ?.hasWord
                            ?.(
                                exactCandidate
                                    .result
                                    .normalized
                            )

                            ? 'built-in-knowledge'

                            : 'official-vocabulary',

                    reason:
                        'exact-match',

                    transformations:
                    exactCandidate
                        .result
                        .transformations,

                    indexMap:
                    exactCandidate
                        .result
                        .indexMap,

                    normalizationCandidates,

                    alternatives:
                        [],

                    candidateId:
                        exactCandidate
                            .result
                            .normalized +
                        ':' +
                        exactCandidate
                            .result
                            .normalized
                };
            }


            /*
             * =================================================
             * STEP 3 — EMBEDDED / GLUED TOKEN LOOKUP
             * =================================================
             *
             * Именно этот слой исправляет:
             *
             * ябухаюименнопохуй
             *
             * Обычный boundary-scanner видит это
             * как одно большое слово.
             *
             * Adaptive Recognition теперь может
             * найти внутри длинную официальную
             * словарную форму.
             */

            const embeddedHit =
                this._findEmbeddedMatch(
                    formResults
                );


            if (
                embeddedHit
            ) {

                const method =

                    embeddedHit
                        .form
                        .kind ===
                    'base'

                        ? 'embedded'

                        : 'layout-embedded';


                return {
                    original:
                    token,

                    normalized:
                    embeddedHit
                        .form
                        .result
                        .normalized,

                    recognized:
                        true,

                    canonical:
                    embeddedHit
                        .word,

                    matchedText:
                    embeddedHit
                        .normalized,

                    category:
                        null,

                    confidence:
                        1.0,

                    level:
                        'trusted',

                    method,

                    distance:
                        0,

                    similarity:
                        1.0,

                    matchType:
                        'embedded',

                    source:
                        aliases
                            ?.hasWord
                            ?.(
                                embeddedHit
                                    .word
                            )

                            ? 'built-in-knowledge'

                            : 'official-vocabulary',

                    reason:
                        'embedded-official-match',

                    transformations:
                    embeddedHit
                        .form
                        .result
                        .transformations,

                    indexMap:
                    embeddedHit
                        .form
                        .result
                        .indexMap,

                    normalizationCandidates,

                    alternatives:
                        [],

                    candidateId:
                        embeddedHit
                            .word +
                        ':' +
                        embeddedHit
                            .form
                            .result
                            .normalized,

                    embedded: {
                        normalizedStart:
                        embeddedHit
                            .index,

                        normalizedEnd:
                            embeddedHit
                                .index +
                            embeddedHit
                                .normalized
                                .length
                    }
                };
            }


            /*
             * =================================================
             * STEP 4 — SHORT TOKEN GUARD
             * =================================================
             */

            if (
                normInput.length <=
                SHORT_TOKEN_FUZZY_THRESHOLD
            ) {
                return noMatch(
                    token,
                    primaryForm,
                    normalizationCandidates
                );
            }


            /*
             * =================================================
             * STEP 5 — FUZZY SEARCH
             * =================================================
             */

            const candidates =
                this._getCandidates(
                    normInput
                );


            if (
                candidates.length ===
                0
            ) {
                return noMatch(
                    token,
                    primaryForm,
                    normalizationCandidates
                );
            }


            const hits =
                [];


            for (
                const candidate
                of candidates
                ) {

                const result =
                    fuzzy.match(
                        normInput,
                        candidate
                            .normalized,
                        options
                            .fuzzyOptions
                    );


                if (
                    result.matched
                ) {

                    hits.push({
                        canonical:
                        candidate
                            .word,

                        normalized:
                        candidate
                            .normalized,

                        confidence:
                        result
                            .confidence,

                        distance:
                        result
                            .distance,

                        similarity:
                        result
                            .similarity,

                        reason:
                        result
                            .reason
                    });
                }
            }


            if (
                hits.length ===
                0
            ) {
                return noMatch(
                    token,
                    primaryForm,
                    normalizationCandidates
                );
            }


            /*
             * Highest confidence first.
             */
            hits.sort(
                (a, b) =>
                    b.confidence -
                    a.confidence ||
                    b.similarity -
                    a.similarity
            );


            const best =
                hits[0];


            const level =
                fuzzyLevel(
                    best.confidence
                );


            const recognized =
                level ===
                'high' ||
                level ===
                'medium';


            const alternatives =
                hits
                    .slice(
                        1,
                        MAX_ALTERNATIVES +
                        1
                    )
                    .map(
                        (hit) => ({
                            canonical:
                            hit
                                .canonical,

                            confidence:
                            hit
                                .confidence,

                            distance:
                            hit
                                .distance,

                            similarity:
                            hit
                                .similarity
                        })
                    );


            return {
                original:
                token,

                normalized:
                normInput,

                recognized,

                canonical:
                    recognized
                        ? best
                            .canonical
                        : null,

                matchedText:
                    recognized
                        ? best
                            .canonical
                        : null,

                category:
                    null,

                confidence:
                best
                    .confidence,

                level,

                method:
                    'fuzzy',

                matchType:
                    'fuzzy',

                source:
                    aliases
                        ?.hasWord
                        ?.(
                            best
                                .canonical
                        )

                        ? 'built-in-knowledge'

                        : 'official-vocabulary',

                distance:
                best
                    .distance,

                similarity:
                best
                    .similarity,

                reason:
                best
                    .reason,

                transformations:
                primaryForm
                    .transformations,

                indexMap:
                primaryForm
                    .indexMap,

                normalizationCandidates,

                alternatives,

                candidateId:
                    recognized

                        ? best
                            .canonical +
                        ':' +
                        normInput

                        : null
            };
        }


        /* =====================================================
           RECOGNIZE TOKENS
           ===================================================== */

        recognizeTokens(
            tokens,
            options = {}
        ) {

            if (
                !Array.isArray(
                    tokens
                )
            ) {
                return [];
            }


            return tokens
                .map(
                    (token) =>
                        this.recognizeToken(
                            token,
                            options
                        )
                );
        }


        /* =====================================================
           DEBUG
           ===================================================== */

        debug(
            token
        ) {

            const result =
                this.recognizeToken(
                    token
                );


            const fmtPct =
                (value) =>
                    value != null
                        ? (
                            value *
                            100
                        ).toFixed(1) +
                        '%'
                        : '—';


            console.group(
                `[VimeReportAdaptiveRecognition] debug: "${token}"`
            );


            console.log(
                `original:    ${result.original}`
            );


            console.log(
                `normalized:  ${result.normalized}`
            );


            console.log(
                `recognized:  ${result.recognized}`
            );


            console.log(
                `canonical:   ${result.canonical ?? '—'}`
            );


            console.log(
                `matchedText: ${result.matchedText ?? '—'}`
            );


            console.log(
                `category:    ${result.category ?? '—'}`
            );


            console.log(
                `method:      ${result.method}`
            );


            console.log(
                `matchType:   ${result.matchType ?? '—'}`
            );


            console.log(
                `source:      ${result.source ?? '—'}`
            );


            console.log(
                `distance:    ${result.distance ?? '—'}`
            );


            console.log(
                `similarity:  ${fmtPct(result.similarity)}`
            );


            console.log(
                `confidence:  ${fmtPct(result.confidence)}`
            );


            console.log(
                `reason:      ${result.reason ?? '—'}`
            );


            console.log(
                `level:       ${result.level}`
            );


            if (
                result.embedded
            ) {

                console.log(
                    'embedded:',
                    result.embedded
                );
            }


            if (
                result
                    .normalizationCandidates
                    ?.length >
                0
            ) {

                console.log(
                    'normalizationCandidates:'
                );


                result
                    .normalizationCandidates
                    .forEach(
                        (
                            candidate,
                            index
                        ) => {

                            console.log(
                                `  [${index + 1}] ` +
                                `${candidate.kind}: ` +
                                `"${candidate.normalized}" ` +
                                `changed=${candidate.changed ? 'yes' : 'no'}`
                            );
                        }
                    );
            }


            if (
                result
                    .transformations
                    ?.length >
                0
            ) {

                console.log(
                    `transforms:  ${result.transformations.length} step(s) applied`
                );
            }


            if (
                result
                    .alternatives
                    ?.length >
                0
            ) {

                console.log(
                    `alternatives (${result.alternatives.length}):`
                );


                result
                    .alternatives
                    .forEach(
                        (
                            alternative,
                            index
                        ) => {

                            console.log(
                                `  [${index + 1}] ` +
                                `"${alternative.canonical}" ` +
                                `conf=${fmtPct(alternative.confidence)} ` +
                                `dist=${alternative.distance}`
                            );
                        }
                    );
            }


            if (
                result._error
            ) {

                console.warn(
                    `error: ${result._error}`
                );
            }


            console.groupEnd();


            return result;
        }


        /* =====================================================
           STATUS
           ===================================================== */

        getStatus() {

            const normAvail =
                !!window
                    .VimeReportTextNormalizer;


            const fuzzyAvail =
                !!window
                    .VimeReportFuzzyMatcher;


            const vocabAvail =
                !!window
                    .VimeReportProhibitedWordsReady;


            const vocabSize =
                window
                    .VimeReportProhibitedWords
                    ?.length ??
                0;


            const aliasStatus =
                window
                    .VimeReportRecognitionAliases
                    ?.getStatus
                    ?.() ??
                null;


            return {
                normalizerAvailable:
                normAvail,

                fuzzyMatcherAvailable:
                fuzzyAvail,

                vocabularyAvailable:
                vocabAvail,

                vocabularySize:
                vocabSize,

                aliasAvailable:
                    !!window
                        .VimeReportRecognitionAliases,

                aliasStatus,

                indexBuilt:
                this._indexReady,

                embeddedEntries:
                    this
                        ._embeddedEntries
                        ?.length ??
                    0,

                ready:
                    normAvail &&
                    fuzzyAvail &&
                    vocabAvail
            };
        }

    }


    /* =========================================================
       EXPORT
       ========================================================= */

    window.VimeReportAdaptiveRecognition =
        new VimeReportAdaptiveRecognitionImpl();

})();