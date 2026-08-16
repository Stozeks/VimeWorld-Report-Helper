(() => {
    'use strict';

    class VimeReportViolationScanner {

        constructor() {
            this.lastResults = [];
            this.lastRecommendations = [];
            this.lastCapsLock = null;

            /*
             * Descriptors built during scan() for the
             * unified highlighter.  Populated even when
             * _relativeAbuseIntegrationActive is true so the
             * integration wrapper can read them.
             */
            this._lastViolationDescriptors = [];

            /*
             * Set to true by VimeReportRelativeAbuseIntegration
             * once it wraps scan().  When true, scan() does NOT
             * call the unified highlighter itself; the integration
             * wrapper applies all descriptors (violation + relative)
             * in a single pass.
             */
            this._relativeAbuseIntegrationActive = false;

            /*
             * Кэш скомпилированных bypass-регулярных выражений.
             *
             * Кэшируются ТОЛЬКО bypass-паттерны (buildBypassRegex).
             * Они строятся посимвольно через getBypassCharacterPattern
             * и компилируют сложный NFA — дорогая операция.
             *
             * Простые word/root-выражения (buildRegex) НЕ кэшируются:
             * они сводятся к escapeRegExp + шаблону и пересоздаются
             * мгновенно; хранить их нет смысла.
             *
             * Все bypass-regex хранятся как /gi (global+case-insensitive).
             * lastIndex сбрасывается в 0 перед каждым возвратом из кэша,
             * поэтому один объект безопасно использовать как для
             * одиночного exec() (scanMessage), так и для цикла while
             * (findTextMatches).
             *
             * Кэш заполняется при первом скане и стабилизируется:
             * максимум ~3052 записей (одна на слово словаря).
             * Повторные сканы дают только cache hit — память не растёт.
             */
            this._regexCache = new Map();
        }


        /* =====================================================
           MESSAGES
           ===================================================== */

        getMessages() {
            const parser =
                window.VimeReportMessageParser;

            if (
                !parser ||
                typeof parser.parse !== 'function'
            ) {
                return [];
            }

            return parser.parse();
        }


        /* =====================================================
           PROHIBITED WORDS
           ===================================================== */

        getProhibitedWords() {
            const words =
                window.VimeReportProhibitedWords;

            return Array.isArray(words)
                ? words
                : [];
        }

        getProhibitedRoots() {
            const roots =
                window.VimeReportProhibitedRoots;

            return Array.isArray(roots)
                ? roots
                : [];
        }


        getScannerExceptions() {
            const exceptions =
                window.VimeReportScannerExceptions;

            return Array.isArray(exceptions)
                ? exceptions
                : [];
        }

        /* =====================================================
           VIOLATION RULES
           ===================================================== */

        getViolationRules() {
            const rules =
                window.VimeReportViolationRules;

            if (
                !rules ||
                typeof rules.getRecommendedReasons !== 'function'
            ) {
                return null;
            }

            return rules;
        }


        /* =====================================================
           HELPERS
           ===================================================== */

        normalizeText(text) {
            return String(text ?? '')
                .toLowerCase()
                .replace(/\u00a0/g, ' ')
                .trim();
        }


        escapeRegExp(text) {
            return String(text).replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            );
        }

        getBypassCharacterPattern(
            char
        ) {
            const value =
                String(char ?? '')
                    .toLowerCase();


            const alternatives = {

                /*
                 * Кириллица ↔ похожая латиница
                 */

                'а': '[аa]',
                'a': '[аa]',

                'в': '[вb]',
                'b': '[вb]',

                'е': '[еe]',
                'e': '[еe]',

                'к': '[кk]',
                'k': '[кk]',

                'м': '[мm]',
                'm': '[мm]',

                'н': '[нh]',
                'h': '[нh]',

                'о': '[оo0]',
                'o': '[оo0]',
                '0': '[оo0]',

                'р': '[рp]',
                'p': '[рp]',

                'с': '[сc]',
                'c': '[сc]',

                'т': '[тt]',
                't': '[тt]',

                'х': '[хx]',
                'x': '[хx]',

                'у': '[уy]',
                'y': '[уy]'
            };


            return (
                alternatives[value] ??
                this.escapeRegExp(value)
            );
        }


        buildBypassRegex(
            value,
            global = false
        ) {
            const cleaned =
                String(value ?? '')
                    .toLowerCase()
                    .trim();


            if (!cleaned) {
                return null;
            }


            /* --- Кэш bypass-паттернов: один объект на слово, всегда /gi --- */

            const cacheKey =
                `bypass:${cleaned}`;

            const cached = this._regexCache.get(cacheKey);

            if (cached !== undefined) {
                /*
                 * Сбрасываем lastIndex перед каждым возвратом.
                 * Это безопасно в однопоточном JS:
                 *   - scanMessage вызывает exec() один раз и завершает итерацию
                 *   - findTextMatches исчерпывает цикл while до null → lastIndex=0
                 * В обоих случаях следующий вызов buildBypassRegex для
                 * этого же слова вернёт объект уже с lastIndex=0.
                 */
                cached.lastIndex = 0;
                return cached;
            }


            /*
             * Между буквами разрешаем:
             *
             * пробел
             * .
             * ,
             * -
             * _
             * *
             * ~
             * /
             * \
             *
             * Максимум несколько символов подряд,
             * чтобы Scanner не связывал две совершенно
             * разные части сообщения.
             */
            const separator =
                '[\\s.,\\-_*~\\\\/]{0,3}';


            const characters =
                [...cleaned];


            const parts = [];


            characters.forEach(
                (char) => {

                    /*
                     * Пробел внутри словарной фразы
                     * превращаем в разрешённый разделитель.
                     */
                    if (
                        /\s/.test(char)
                    ) {

                        if (
                            parts.length &&
                            parts[
                            parts.length - 1
                                ] !== separator
                        ) {
                            parts.push(
                                separator
                            );
                        }


                        return;
                    }


                    const charPattern =
                        this.getBypassCharacterPattern(
                            char
                        );


                    /*
                     * Разрешаем небольшое растягивание:
                     *
                     * о
                     * оо
                     * ооо
                     *
                     * Этого достаточно для большинства
                     * намеренных обходов, но мы не делаем
                     * бесконечный +, чтобы снизить false positive.
                     */
                    parts.push(
                        `(?:${charPattern}){1,3}`
                    );

                    parts.push(
                        separator
                    );
                }
            );


            /*
             * Последний separator не нужен.
             */
            if (
                parts[
                parts.length - 1
                    ] === separator
            ) {
                parts.pop();
            }


            if (!parts.length) {
                return null;
            }


            const pattern =
                parts.join('');


            /*
             * Сохраняем защиту границ слова.
             *
             * Поэтому:
             *
             * х.е.р      -> YES
             * х е р      -> YES
             * ххееер     -> YES
             *
             * Херобрин   -> NO
             *
             * Всегда компилируем с флагом /gi:
             * один объект покрывает оба сценария использования
             * (одиночный exec и цикл while).
             */
            const builtRegex = new RegExp(
                `(^|[^a-zа-яё0-9_])(${pattern})(?=$|[^a-zа-яё0-9_])`,
                'gi'
            );

            this._regexCache.set(cacheKey, builtRegex);

            return builtRegex;
        }

        timeToSeconds(
            time
        ) {
            if (
                typeof time !== 'string'
            ) {
                return null;
            }


            const match =
                time.trim().match(
                    /^(\d{1,2}):(\d{2}):(\d{2})$/
                );


            if (!match) {
                return null;
            }


            return (
                Number(match[1]) * 3600 +
                Number(match[2]) * 60 +
                Number(match[3])
            );
        }


        isCapsWord(
            word
        ) {
            const letters =
                String(word ?? '')
                    .match(
                        /[a-zа-яё]/gi
                    ) ?? [];


            if (!letters.length) {
                return false;
            }


            const uppercaseCount =
                letters.filter(
                    (letter) =>
                        letter ===
                        letter.toUpperCase()
                ).length;


            /*
             * Минимум половина букв слова
             * должна быть в верхнем регистре.
             */
            return (
                uppercaseCount /
                letters.length
            ) >= 0.5;
        }


        extractCapsWords(
            message
        ) {
            if (
                !message ||
                typeof message.text !== 'string'
            ) {
                return [];
            }


            const seconds =
                this.timeToSeconds(
                    message.time
                );


            if (
                seconds === null
            ) {
                return [];
            }


            /*
             * Берём именно слова.
             * Цифры и знаки препинания
             * в расчёт регистра не входят.
             */
            const regex =
                /[a-zа-яё]+/gi;


            const matches = [];

            let match;


            while (
                (
                    match =
                        regex.exec(
                            message.text
                        )
                ) !== null
                ) {
                const word =
                    match[0];


                if (
                    !this.isCapsWord(
                        word
                    )
                ) {
                    continue;
                }


                matches.push({
                    word,

                    index:
                    match.index,

                    length:
                    word.length,

                    messageIndex:
                    message.index,

                    time:
                    message.time,

                    seconds,

                    text:
                    message.text
                });
            }


            return matches;
        }


        scanCapsLock(
            messages
        ) {
            const CAP_WORD_LIMIT = 4;
            const WINDOW_SECONDS = 5 * 60;


            const capsWords =
                messages
                    .flatMap(
                        (message) =>
                            this.extractCapsWords(
                                message
                            )
                    )
                    .sort(
                        (a, b) =>
                            a.seconds -
                            b.seconds
                    );


            let best = {
                detected:
                    false,

                count:
                    0,

                requiredCount:
                CAP_WORD_LIMIT,

                startTime:
                    null,

                endTime:
                    null,

                matches:
                    []
            };


            let left = 0;


            for (
                let right = 0;
                right < capsWords.length;
                right++
            ) {

                while (
                    left <= right &&
                    (
                        capsWords[right].seconds -
                        capsWords[left].seconds
                    ) > WINDOW_SECONDS
                    ) {
                    left++;
                }


                const current =
                    capsWords.slice(
                        left,
                        right + 1
                    );


                if (
                    current.length >
                    best.count
                ) {
                    best = {
                        detected:
                            current.length >=
                            CAP_WORD_LIMIT,

                        count:
                        current.length,

                        requiredCount:
                        CAP_WORD_LIMIT,

                        startTime:
                            current[0]?.time ??
                            null,

                        endTime:
                            current[
                            current.length - 1
                                ]?.time ??
                            null,

                        matches:
                            [...current]
                    };
                }
            }


            return best;
        }

        /* =====================================================
           BUILD CAPS DESCRIPTORS
           =====================================================
           Converts scanCapsLock() result into highlight
           descriptors for the unified highlighter.
           No DOM changes here.
           ===================================================== */

        _buildCapsDescriptors(
            capsResult
        ) {
            if (
                !capsResult?.detected ||
                !Array.isArray(
                    capsResult.matches
                )
            ) {
                return [];
            }

            const HL =
                window
                    .VimeReportUnifiedHighlighter;

            const cssClass =
                HL?.CSS_CLASSES?.CAPS ??
                'vrh-hl-caps';

            const priority =
                HL?.PRIORITY?.CAPS ??
                30;


            return capsResult.matches
                .filter(
                    (match) =>
                        typeof match.messageIndex ===
                        'number' &&
                        typeof match.index ===
                        'number' &&
                        typeof match.length ===
                        'number'
                )
                .map(
                    (match) => ({
                        messageIndex:
                            match.messageIndex,

                        start:
                            match.index,

                        end:
                            match.index +
                            match.length,

                        cssClass,

                        priority
                    })
                );
        }

        /*
         * Короткие корни типа "еб":
         *
         * ебать     -> да
         * ебаный    -> да
         * тебя      -> нет
         * тебе      -> нет
         *
         * Более длинные записи могут быть основой слова:
         *
         * бомж      -> бомживатые
         */
        buildRegex(
            value,
            global = false,
            mode = 'word'
        ) {
            const cleaned =
                String(value ?? '')
                    .trim();

            if (!cleaned) {
                return null;
            }


            const escaped =
                this.escapeRegExp(
                    cleaned
                );


            const flags =
                global
                    ? 'gi'
                    : 'i';


            /*
             * ROOT MODE
             *
             * Только специально разрешённые корни.
             *
             * Здесь совпадение внутри слова допустимо.
             */
            if (
                mode === 'root'
            ) {
                return new RegExp(
                    `(${escaped})`,
                    flags
                );
            }


            /*
             * WORD MODE
             *
             * Основной prohibited-words.txt.
             *
             * Совпадение разрешено только как
             * самостоятельное слово или фраза.
             *
             * Примеры:
             *
             * хер            -> YES
             * "хер!"         -> YES
             * ты хер         -> YES
             *
             * Херобрин       -> NO
             *
             * бл             -> YES
             * блокировать    -> NO
             *
             * бло            -> YES
             * блок           -> NO
             */

            return new RegExp(
                `(^|[^a-zа-яё0-9_])(${escaped})(?=$|[^a-zа-яё0-9_])`,
                flags
            );
        }

        isScannerException(
            text,
            matchedText
        ) {
            const exceptions =
                this.getScannerExceptions();


            if (
                !exceptions.length
            ) {
                return false;
            }


            const normalizedMatch =
                String(matchedText ?? '')
                    .toLowerCase()
                    .trim();


            if (
                !normalizedMatch
            ) {
                return false;
            }


            return exceptions.some(
                (exception) => {

                    const normalizedException =
                        String(exception ?? '')
                            .toLowerCase()
                            .trim();


                    if (
                        !normalizedException
                    ) {
                        return false;
                    }


                    /*
                     * Если исключение является полным
                     * фрагментом исходного сообщения,
                     * Scanner его пропускает.
                     */
                    return (
                        String(text ?? '')
                            .toLowerCase()
                            .includes(
                                normalizedException
                            ) &&
                        normalizedException.includes(
                            normalizedMatch
                        )
                    );
                }
            );
        }

        /* =====================================================
   SCAN ONE MESSAGE
   ===================================================== */

        scanMessage(
            message,
            prohibitedWords,
            prohibitedRoots = []
        ) {
            if (
                !message ||
                typeof message.text !== 'string'
            ) {
                return [];
            }


            const matches = [];


            /*
             * =====================================================
             * EXACT WORDS / PHRASES
             * =====================================================
             */

            prohibitedWords.forEach(
                (entry) => {

                    const word =
                        typeof entry === 'string'
                            ? entry
                            : entry?.word;


                    if (
                        typeof word !== 'string' ||
                        !word.trim()
                    ) {
                        return;
                    }


                    /*
                     * =====================================================
                     * 1. NORMAL MATCH
                     * =====================================================
                     */

                    const normalRegex =
                        this.buildRegex(
                            word,
                            false,
                            'word'
                        );


                    let match =
                        normalRegex
                            ?.exec(
                                message.text
                            ) ??
                        null;


                    let matchMode =
                        'word';


                    /*
                     * =====================================================
                     * 2. BYPASS MATCH
                     * =====================================================
                     *
                     * Если обычного совпадения нет,
                     * пробуем найти обход.
                     */

                    if (!match) {

                        const bypassRegex =
                            this.buildBypassRegex(
                                word,
                                false
                            );


                        match =
                            bypassRegex
                                ?.exec(
                                    message.text
                                ) ??
                            null;


                        if (match) {
                            matchMode =
                                'bypass';
                        }
                    }


                    if (!match) {
                        return;
                    }


                    /*
                     * И обычный regex, и bypass regex
                     * кладут фактический найденный фрагмент
                     * во вторую meaningful capture-group.
                     */

                    const matchedText =
                        match[2] ??
                        match[1] ??
                        match[0];


                    if (
                        this.isScannerException(
                            message.text,
                            matchedText
                        )
                    ) {
                        return;
                    }


                    matches.push({
                        messageIndex:
                        message.index,

                        time:
                        message.time,

                        text:
                        message.text,

                        word,

                        matchedText,

                        matchMode
                    });
                }
            );


            /*
             * =====================================================
             * EXPLICIT ROOTS
             * =====================================================
             *
             * Основной словарь сюда НЕ попадает.
             *
             * Здесь находятся только специально
             * разрешённые нами корни.
             */

            prohibitedRoots.forEach(
                (entry) => {

                    const root =
                        typeof entry === 'string'
                            ? entry
                            : entry?.word;


                    if (
                        typeof root !== 'string' ||
                        !root.trim()
                    ) {
                        return;
                    }


                    const regex =
                        this.buildRegex(
                            root,
                            false,
                            'root'
                        );


                    if (!regex) {
                        return;
                    }


                    const match =
                        regex.exec(
                            message.text
                        );


                    if (!match) {
                        return;
                    }


                    const matchedText =
                        match[1] ??
                        match[0];


                    if (
                        this.isScannerException(
                            message.text,
                            matchedText
                        )
                    ) {
                        return;
                    }


                    matches.push({
                        messageIndex:
                        message.index,

                        time:
                        message.time,

                        text:
                        message.text,

                        word:
                        root,

                        matchedText,

                        matchMode:
                            'root'
                    });
                }
            );


            return matches;
        }
        /* =====================================================
           CLEAR HIGHLIGHTS
           ===================================================== */

        clearHighlights() {
            window
                .VimeReportUnifiedHighlighter
                ?.clear?.();
        }


        /* =====================================================
           BUILD VIOLATION DESCRIPTORS
           =====================================================
           For each message that has at least one violation,
           finds ALL match positions in message.text using
           findTextMatches() and returns highlight descriptors.
           No DOM changes.
           ===================================================== */

        _buildViolationDescriptors(
            messages,
            prohibitedWords
        ) {
            if (
                !messages.length ||
                !prohibitedWords.length ||
                !this.lastResults.length
            ) {
                return [];
            }

            const HL =
                window
                    .VimeReportUnifiedHighlighter;

            const cssClass =
                HL?.CSS_CLASSES?.VIOLATION ??
                'vrh-hl-violation';

            const priority =
                HL?.PRIORITY?.VIOLATION ??
                40;

            /*
             * Only scan messages that actually had a violation.
             */
            const violatingIndexes =
                new Set(
                    this.lastResults.map(
                        (r) => r.messageIndex
                    )
                );

            const allWords = [
                ...new Set(
                    prohibitedWords.map(
                        (e) =>
                            typeof e === 'string'
                                ? e
                                : e?.word
                    ).filter(Boolean)
                )
            ];

            const descriptors = [];

            messages.forEach(
                (message) => {
                    if (
                        !violatingIndexes.has(
                            message.index
                        )
                    ) {
                        return;
                    }

                    const matches =
                        this.findTextMatches(
                            message.text,
                            allWords
                        );

                    matches.forEach(
                        (match) => {
                            descriptors.push({
                                messageIndex:
                                    message.index,

                                start:
                                    match.index,

                                end:
                                    match.index +
                                    match.length,

                                cssClass,

                                priority
                            });
                        }
                    );
                }
            );

            return descriptors;
        }


        /* =====================================================
           ADAPTIVE RECOGNITION FALLBACK
           =====================================================
           Secondary detection pass.  Runs AFTER the normal
           exact / bypass scan.

           Only tokens whose range is NOT already covered by
           an existing violation/caps descriptor are evaluated.

           Confidence policy:
             trusted -> detect
             high    -> detect
             medium / low / none -> skip (conservative)

           Fail-safe: returns [] when the engine is unavailable,
           throws, or vocabulary is not yet loaded.  Scanner
           behaviour is completely unaffected in those cases.
           ===================================================== */

        _buildAdaptiveDescriptors(
            messages,
            existingDescriptors
        ) {
            const engine =
                window.VimeReportAdaptiveRecognition;

            if (
                !engine ||
                typeof engine.recognizeToken !== 'function'
            ) {
                return [];
            }


            const HL =
                window.VimeReportUnifiedHighlighter;

            const cssClass =
                HL?.CSS_CLASSES?.VIOLATION ??
                'vrh-hl-violation';

            const priority =
                HL?.PRIORITY?.VIOLATION ??
                40;


            /*
             * Index existing descriptors by messageIndex so we
             * can quickly skip already-detected token ranges.
             */
            const coveredByMsg = new Map();

            for (const d of existingDescriptors) {
                if (!coveredByMsg.has(d.messageIndex)) {
                    coveredByMsg.set(
                        d.messageIndex,
                        []
                    );
                }

                coveredByMsg
                    .get(d.messageIndex)
                    .push({
                        start: d.start,
                        end:   d.end
                    });
            }


            const adaptiveDescriptors = [];

            /*
             * Extract contiguous Cyrillic / Latin / digit runs.
             * Surrounding punctuation is excluded so the
             * highlight covers only the token itself.
             */
            const TOKEN_RE =
                /[а-яёa-zA-Z0-9]+/gi;


            for (const message of messages) {
                const msgIdx = message.index;
                const text   = message.text;

                if (
                    typeof text !== 'string' ||
                    !text
                ) {
                    continue;
                }


                /*
                 * Lazily create the covered-range list for this
                 * message.  We also push newly-found adaptive
                 * ranges so we never emit two descriptors for the
                 * same span within a single pass.
                 */
                if (!coveredByMsg.has(msgIdx)) {
                    coveredByMsg.set(msgIdx, []);
                }

                const covered =
                    coveredByMsg.get(msgIdx);


                TOKEN_RE.lastIndex = 0;

                let m;

                while (
                    (m = TOKEN_RE.exec(text)) !== null
                ) {
                    const tokenText  = m[0];
                    const tokenStart = m.index;
                    const tokenEnd   =
                        tokenStart + tokenText.length;


                    if (
                        this._isRangeCovered(
                            tokenStart,
                            tokenEnd,
                            covered
                        )
                    ) {
                        continue;
                    }


                    let res;

                    try {
                        res = engine.recognizeToken(
                            tokenText
                        );
                    } catch (e) {
                        /* Engine error — skip this token */
                        continue;
                    }


                    if (
                        res &&
                        res.recognized === true &&
                        (
                            res.level === 'trusted' ||
                            res.level === 'high'
                        )
                    ) {
                        adaptiveDescriptors.push({
                            messageIndex: msgIdx,

                            start: tokenStart,
                            end:   tokenEnd,

                            cssClass,

                            priority,

                            /*
                             * Debug metadata — not used by the
                             * renderer; preserved for future
                             * learning / audit stages.
                             */
                            _meta: {
                                source:        'adaptive',
                                originalToken: tokenText,
                                canonical:     res.canonical,
                                confidence:    res.confidence,
                                method:        res.method,
                                level:         res.level,
                            }
                        });


                        covered.push({
                            start: tokenStart,
                            end:   tokenEnd
                        });
                    }
                }
            }


            return adaptiveDescriptors;
        }


        _isRangeCovered(
            start,
            end,
            covered
        ) {
            return covered.some(
                (r) =>
                    r.start < end &&
                    r.end   > start
            );
        }


        /* =====================================================
           BUILD LEARNED DESCRIPTORS
           =====================================================
           Интегрирует знания модератора из Learning Store
           в пайплайн подсветки.

           Алиасы и фразы со статусом «learned» или «trusted»
           сопоставляются с токенами и подстроками каждого
           сообщения.

           Исключения («Не нарушение») подавляют совпадения.

           Возвращает { descriptors, matches }:
             descriptors  — дескрипторы для unified-highlighter
             matches      — записи в lastResults (счётчик панели)

           Fail-safe: при недоступном хранилище или ошибке
           возвращает { descriptors:[], matches:[] } —
           нормальное сканирование не затрагивается.
           ===================================================== */

        _buildLearnedDescriptors(
            messages,
            existingDescriptors
        ) {
            const EMPTY = { descriptors: [], matches: [] };

            /* --- 1. Проверяем доступность Learning Store --- */

            const store = window.VimeReportLearningStore;

            if (
                !store ||
                store.getStatus?.().ready !== true
            ) {
                return EMPTY;
            }


            try {

                /* --- 2. Снимок обученных данных (синхронные чтения) --- */

                const rawAliases    = store.findAliases();
                const rawPhrases    = store.findPhrases();
                const rawExceptions = store.findExceptions();


                /* Только подтверждённые записи */

                const activeAliases = rawAliases.filter(
                    (a) =>
                        a.status === 'learned' ||
                        a.status === 'trusted'
                );

                const activePhrases = rawPhrases.filter(
                    (p) =>
                        p.status === 'learned' ||
                        p.status === 'trusted'
                );


                if (
                    !activeAliases.length &&
                    !activePhrases.length
                ) {
                    return EMPTY;
                }


                /* Множество исключений по нормализованному ключу */

                const exceptionSet = new Set(
                    rawExceptions.map((e) => e.normalized)
                );


                /* --- 3. Вспомогательная нормализация --- */

                const normalizer =
                    window.VimeReportTextNormalizer;

                const _normalize = (text) => {
                    if (
                        normalizer &&
                        typeof normalizer.normalizeToken === 'function'
                    ) {
                        try {
                            return normalizer.normalizeToken(text).normalized;
                        } catch (_) {}
                    }
                    return text.toLowerCase();
                };


                /* --- 4. Индекс алиасов: normKey → запись --- */

                const aliasMap = new Map();

                for (const alias of activeAliases) {
                    const key = _normalize(alias.original);

                    if (
                        !exceptionSet.has(key) &&
                        !aliasMap.has(key)
                    ) {
                        aliasMap.set(key, alias);
                    }
                }


                /* --- 5. Карта покрытых диапазонов --- */

                const coveredByMsg = new Map();

                for (const d of existingDescriptors) {
                    if (!coveredByMsg.has(d.messageIndex)) {
                        coveredByMsg.set(
                            d.messageIndex,
                            []
                        );
                    }
                    coveredByMsg.get(d.messageIndex).push({
                        start: d.start,
                        end:   d.end,
                    });
                }


                const HL = window.VimeReportUnifiedHighlighter;

                const cssClass =
                    HL?.CSS_CLASSES?.VIOLATION ?? 'vrh-hl-violation';

                /*
                 * Приоритет чуть выше адаптивного (40),
                 * чтобы при наложении побеждало явное знание
                 * модератора, а не нечёткое распознавание.
                 */
                const priority = 45;


                const descriptors = [];
                const matches     = [];


                /* --- 6. Поиск алиасов по токенам --- */

                const TOKEN_RE = /[а-яёa-zA-Z0-9]+/gi;

                if (aliasMap.size > 0) {

                    for (const message of messages) {

                        const msgIdx = message.index;
                        const text   = message.text;

                        if (
                            typeof text !== 'string' ||
                            !text
                        ) {
                            continue;
                        }


                        if (!coveredByMsg.has(msgIdx)) {
                            coveredByMsg.set(msgIdx, []);
                        }

                        const covered = coveredByMsg.get(msgIdx);

                        TOKEN_RE.lastIndex = 0;

                        let m;

                        while (
                            (m = TOKEN_RE.exec(text)) !== null
                        ) {
                            const tokenText  = m[0];
                            const tokenStart = m.index;
                            const tokenEnd   =
                                tokenStart + tokenText.length;


                            if (
                                this._isRangeCovered(
                                    tokenStart,
                                    tokenEnd,
                                    covered
                                )
                            ) {
                                continue;
                            }


                            const normToken = _normalize(tokenText);

                            /* Пропускаем исключения */

                            if (exceptionSet.has(normToken)) {
                                continue;
                            }


                            const alias = aliasMap.get(normToken);

                            if (!alias) continue;


                            descriptors.push({
                                messageIndex: msgIdx,
                                start:        tokenStart,
                                end:          tokenEnd,
                                cssClass,
                                priority,
                                _meta: {
                                    source:        'learned',
                                    originalToken: tokenText,
                                    category:      alias.category,
                                    aliasId:       alias.id,
                                    status:        alias.status,
                                },
                            });

                            matches.push({
                                messageIndex: msgIdx,
                                time:         message.time,
                                text,
                                word:         alias.original,
                                matchedText:  tokenText,
                                matchMode:    'learned',
                            });

                            covered.push({
                                start: tokenStart,
                                end:   tokenEnd,
                            });
                        }
                    }
                }


                /* --- 7. Поиск выученных фраз --- */

                if (activePhrases.length > 0) {

                    for (const message of messages) {

                        const msgIdx = message.index;
                        const text   = message.text;

                        if (
                            typeof text !== 'string' ||
                            !text
                        ) {
                            continue;
                        }


                        if (!coveredByMsg.has(msgIdx)) {
                            coveredByMsg.set(msgIdx, []);
                        }

                        const covered   = coveredByMsg.get(msgIdx);
                        const textLower = text.toLowerCase();


                        for (const phrase of activePhrases) {

                            if (!phrase.original) continue;


                            /* Исключения по нормализованной форме */

                            if (
                                phrase.normalized &&
                                exceptionSet.has(phrase.normalized)
                            ) {
                                continue;
                            }


                            const searchStr =
                                phrase.original.toLowerCase();

                            if (!searchStr) continue;


                            let searchPos = 0;

                            while (searchPos < textLower.length) {

                                const found =
                                    textLower.indexOf(
                                        searchStr,
                                        searchPos
                                    );

                                if (found === -1) break;


                                const start = found;
                                const end   =
                                    found + phrase.original.length;


                                if (
                                    !this._isRangeCovered(
                                        start,
                                        end,
                                        covered
                                    )
                                ) {
                                    descriptors.push({
                                        messageIndex: msgIdx,
                                        start,
                                        end,
                                        cssClass,
                                        priority,
                                        _meta: {
                                            source:         'learned-phrase',
                                            originalPhrase: phrase.original,
                                            category:       phrase.category,
                                            phraseId:       phrase.id,
                                            status:         phrase.status,
                                        },
                                    });

                                    matches.push({
                                        messageIndex: msgIdx,
                                        time:         message.time,
                                        text,
                                        word:         phrase.original,
                                        matchedText:  text.slice(start, end),
                                        matchMode:    'learned-phrase',
                                    });

                                    covered.push({ start, end });
                                }

                                searchPos = end;
                            }
                        }
                    }
                }


                return { descriptors, matches };


            } catch (e) {
                console.error(
                    '[Vime Report Helper] _buildLearnedDescriptors: ошибка',
                    e
                );
                return EMPTY;
            }
        }


        /* =====================================================
           FILTER ADAPTIVE BY EXCEPTIONS
           =====================================================
           Убирает из адаптивных дескрипторов токены,
           которые модератор явно отметил как «Не нарушение».

           Исключения подавляют только адаптивное/обученное
           распознавание — официальные словарные правила
           этим методом не затрагиваются.

           Fail-safe: при ошибке возвращает исходный массив.
           ===================================================== */

        _filterAdaptiveByExceptions(descriptors) {
            if (!descriptors.length) return descriptors;

            const store = window.VimeReportLearningStore;

            if (
                !store ||
                store.getStatus?.().ready !== true
            ) {
                return descriptors;
            }

            try {
                const exceptions = store.findExceptions();

                if (!exceptions.length) return descriptors;

                const exceptionSet = new Set(
                    exceptions.map((e) => e.normalized)
                );

                const normalizer =
                    window.VimeReportTextNormalizer;

                return descriptors.filter((d) => {
                    const token = d._meta?.originalToken;

                    if (!token) return true;

                    let norm;

                    if (
                        normalizer &&
                        typeof normalizer.normalizeToken === 'function'
                    ) {
                        try {
                            norm = normalizer.normalizeToken(token).normalized;
                        } catch (_) {
                            norm = token.toLowerCase();
                        }
                    } else {
                        norm = token.toLowerCase();
                    }

                    return !exceptionSet.has(norm);
                });

            } catch (_) {
                return descriptors;
            }
        }




        findTextMatches(
            text,
            words
        ) {
            const found = [];


            words.forEach(
                (word) => {

                    const regexes = [];


                    const normalRegex =
                        this.buildRegex(
                            word,
                            true,
                            'word'
                        );


                    if (normalRegex) {
                        regexes.push(
                            normalRegex
                        );
                    }


                    const bypassRegex =
                        this.buildBypassRegex(
                            word,
                            true
                        );


                    if (bypassRegex) {
                        regexes.push(
                            bypassRegex
                        );
                    }


                    regexes.forEach(
                        (regex) => {

                            let match;


                            while (
                                (
                                    match =
                                        regex.exec(text)
                                ) !== null
                                ) {

                                /*
                                 * Из-за boundary-группы match[0]
                                 * иногда содержит символ перед словом.
                                 *
                                 * Нам нужен именно найденный
                                 * запрещённый фрагмент.
                                 */
                                const actualText =
                                    match[2] ??
                                    match[1] ??
                                    match[0];


                                const offsetInsideMatch =
                                    match[0]
                                        .lastIndexOf(
                                            actualText
                                        );


                                const actualIndex =
                                    match.index +
                                    Math.max(
                                        0,
                                        offsetInsideMatch
                                    );


                                found.push({
                                    index:
                                    actualIndex,

                                    length:
                                    actualText.length,

                                    text:
                                    actualText,

                                    dictionaryWord:
                                    word
                                });


                                if (
                                    match[0].length === 0
                                ) {
                                    regex.lastIndex++;
                                }
                            }
                        }
                    );

                }
            );


            /*
             * Раннее совпадение сначала.
             * При одинаковом начале выбираем
             * самое длинное.
             */
            found.sort(
                (a, b) => {

                    if (
                        a.index !== b.index
                    ) {
                        return (
                            a.index -
                            b.index
                        );
                    }


                    return (
                        b.length -
                        a.length
                    );
                }
            );


            /*
             * Убираем пересекающиеся совпадения.
             */
            const filtered = [];

            let lastEnd = -1;


            found.forEach(
                (match) => {

                    if (
                        match.index <
                        lastEnd
                    ) {
                        return;
                    }


                    filtered.push(
                        match
                    );


                    lastEnd =
                        match.index +
                        match.length;
                }
            );


            return filtered;
        }


        /* =====================================================
           GET LAST VIOLATION DESCRIPTORS
           =====================================================
           Called by VimeReportRelativeAbuseIntegration to
           retrieve violation + caps descriptors built during
           the last scan(), so it can combine them with
           relative-abuse descriptors in a single unified pass.
           ===================================================== */

        getLastViolationDescriptors() {
            return [
                ...(
                    this._lastViolationDescriptors ??
                    []
                )
            ];
        }


        /* =====================================================
           BUILD RECOMMENDATIONS
           ===================================================== */

        buildRecommendations(messages) {
            const rules =
                this.getViolationRules();


            if (!rules) {
                return [];
            }


            try {
                const recommendations =
                    rules.getRecommendedReasons(
                        messages
                    );


                return Array.isArray(
                    recommendations
                )
                    ? recommendations
                    : [];

            } catch (error) {
                console.error(
                    '[Vime Report Helper] Recommendation engine failed:',
                    error
                );


                return [];
            }
        }


        /* =====================================================
           GET LAST RECOMMENDATIONS
           ===================================================== */

        getLastRecommendations() {
            return [
                ...this.lastRecommendations
            ];
        }

        getLastCapsLock() {
            return this.lastCapsLock;
        }

        /* =====================================================
           GET BEST RECOMMENDATION
           ===================================================== */

        getBestRecommendation() {
            if (
                !this.lastRecommendations.length
            ) {
                return null;
            }


            /*
             * Приоритет:
             *
             * Оскорбление + Мат
             * Оскорбление
             * Мат/Аморал
             */
            const priority = [
                'player-insult-mat',
                'player-insult',
                'mat-amoral'
            ];


            for (
                const reasonId
                of priority
                ) {
                const recommendation =
                    this.lastRecommendations.find(
                        (item) =>
                            item.reasonId ===
                            reasonId
                    );


                if (recommendation) {
                    return recommendation;
                }
            }


            return (
                this.lastRecommendations[0] ??
                null
            );
        }


        /* =====================================================
           SCAN
           ===================================================== */

        scan() {
            const _t0 = performance.now();

            /*
             * Always clear first so buildMessageNodeIndex()
             * sees clean text nodes.
             */
            window
                .VimeReportUnifiedHighlighter
                ?.clear?.();


            const messages =
                this.getMessages();

            const capsLock =
                this.scanCapsLock(
                    messages
                );

            const prohibitedWords =
                this.getProhibitedWords();

            const prohibitedRoots =
                this.getProhibitedRoots();


            this.lastResults = [];
            this.lastRecommendations = [];
            this._lastViolationDescriptors = [];
            this.lastCapsLock =
                capsLock;


            if (!messages.length) {
                return [];
            }

            /*
             * Сначала обычный Report Scanner.
             */
            const _t1 = performance.now();

            if (
                prohibitedWords.length
            ) {
                messages.forEach(
                    (message) => {

                        this.lastResults.push(
                            ...this.scanMessage(
                                message,
                                prohibitedWords,
                                prohibitedRoots
                            )
                        );
                    }
                );
            }

            const _t2 = performance.now();


            /*
             * Затем классификатор причин.
             *
             * Он НЕ влияет на подсветку
             * и НЕ нажимает плитки.
             */
            this.lastRecommendations =
                this.buildRecommendations(
                    messages
                );

            const _t3 = performance.now();


            /*
             * Build descriptors for the unified highlighter.
             *
             * We always build them, regardless of whether
             * _relativeAbuseIntegrationActive is set, so that
             * the integration wrapper can read them via
             * getLastViolationDescriptors().
             */
            this._lastViolationDescriptors = [
                ...this._buildCapsDescriptors(capsLock),
                ...this._buildViolationDescriptors(
                    messages,
                    prohibitedWords
                )
            ];

            const _t4 = performance.now();


            /*
             * Обученные знания модератора (2-й приоритет).
             *
             * Алиасы и фразы, явно сохранённые через
             * «Обучить сканер», проверяются раньше нечёткого
             * распознавания.  Это гарантирует, что явное знание
             * модератора не заглушается автоматикой.
             *
             * Fail-safe: при недоступном хранилище возвращается
             * { descriptors:[], matches:[] } без исключений.
             */
            const learned =
                this._buildLearnedDescriptors(
                    messages,
                    this._lastViolationDescriptors
                );

            if (learned.descriptors.length) {
                this._lastViolationDescriptors.push(
                    ...learned.descriptors
                );
            }

            if (learned.matches.length) {
                this.lastResults.push(
                    ...learned.matches
                );
            }

            const _t5 = performance.now();


            /*
             * Adaptive Recognition fallback (3-й приоритет).
             *
             * Evaluates tokens not already detected by the
             * exact / bypass scan or learned aliases.
             * Only trusted/high-confidence results are promoted
             * to violation descriptors.
             *
             * Исключения («Не нарушение») отфильтровываются
             * методом _filterAdaptiveByExceptions.
             *
             * Fail-safe: if the engine is unavailable the array
             * is empty and no existing behaviour is affected.
             */
            const rawAdaptiveDescriptors =
                this._buildAdaptiveDescriptors(
                    messages,
                    this._lastViolationDescriptors
                );

            const _t6 = performance.now();

            const adaptiveDescriptors =
                this._filterAdaptiveByExceptions(
                    rawAdaptiveDescriptors
                );

            if (adaptiveDescriptors.length) {
                this._lastViolationDescriptors.push(
                    ...adaptiveDescriptors
                );
            }

            const _t7 = performance.now();


            /*
             * When the Relative Abuse integration is active it
             * will apply ALL descriptors (violation + relative)
             * in a single pass.  Only apply directly here when
             * the integration is absent.
             */
            if (
                !this._relativeAbuseIntegrationActive
            ) {
                window
                    .VimeReportUnifiedHighlighter
                    ?.applyHighlights(
                        this._lastViolationDescriptors
                    );
            }

            const _tEnd = performance.now();


            console.group(
                '[Vime Report Helper] Violation Scanner'
            );


            console.log(
                'Messages scanned:',
                messages.length
            );


            console.log(
                'Dictionary entries:',
                prohibitedWords.length
            );


            console.log(
                'Matches found:',
                this.lastResults.length
            );


            console.log(
                'Обученные совпадения:',
                learned.matches.length
            );


            console.log(
                'Adaptive detections:',
                adaptiveDescriptors.length
            );


            console.log(
                'Recommendations:',
                this.lastRecommendations
            );


            /* --- Тайминги по этапам --- */

            console.group('Тайминги (мс)');
            console.log(`Официальное сканирование: ${(_t2 - _t1).toFixed(1)}`);
            console.log(`Рекомендации:             ${(_t3 - _t2).toFixed(1)}`);
            console.log(`Дескрипторы нарушений:    ${(_t4 - _t3).toFixed(1)}`);
            console.log(`Обученные знания:         ${(_t5 - _t4).toFixed(1)}`);
            console.log(`Адаптивное распознавание: ${(_t6 - _t5).toFixed(1)}`);
            console.log(`Фильтр исключений:        ${(_t7 - _t6).toFixed(1)}`);
            console.log(`Подсветка:                ${(_tEnd - _t7).toFixed(1)}`);
            console.log(`ИТОГО:                    ${(_tEnd - _t0).toFixed(1)}`);
            console.log(`Кэш bypass-regex:         ${this._regexCache.size} записей`);
            console.groupEnd();


            console.groupEnd();


            /*
             * ВАЖНО:
             * Возвращаем старый формат Array,
             * поэтому уже работающая панель
             * не ломается.
             */
            return this.lastResults;
        }


        /* =====================================================
           CLEAR
           ===================================================== */

        clear() {
            this.lastResults = [];
            this.lastRecommendations = [];
            this.lastCapsLock = null;
            this._lastViolationDescriptors = [];
            window
                .VimeReportUnifiedHighlighter
                ?.clear?.();
        }


        debug() {
            return this.scan();
        }
    }


    /* =========================================================
       EXPORT
       ========================================================= */

    window.VimeReportViolationScanner =
        new VimeReportViolationScanner();

})();