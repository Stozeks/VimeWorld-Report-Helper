(() => {
    'use strict';

    class VimeReportViolationScanner {

        constructor() {
            this.lastResults = [];
            this.lastRecommendations = [];
            this.lastCapsLock = null;
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


            const flags =
                global
                    ? 'gi'
                    : 'i';


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
             */
            return new RegExp(
                `(^|[^a-zа-яё0-9_])(${pattern})(?=$|[^a-zа-яё0-9_])`,
                flags
            );
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

        highlightCapsLock(
            result
        ) {
            if (
                !result?.detected ||
                !Array.isArray(result.matches)
            ) {
                return;
            }


            const container =
                document.querySelector(
                    '#mr_messages'
                );


            if (!container) {
                return;
            }


            /*
             * Группируем найденные Caps-слова
             * по полному тексту сообщения.
             */
            const byMessage =
                new Map();


            result.matches.forEach(
                (match) => {

                    if (
                        !match?.text ||
                        typeof match.index !== 'number' ||
                        typeof match.length !== 'number'
                    ) {
                        return;
                    }


                    if (
                        !byMessage.has(
                            match.text
                        )
                    ) {
                        byMessage.set(
                            match.text,
                            []
                        );
                    }


                    byMessage
                        .get(
                            match.text
                        )
                        .push({
                            index:
                            match.index,

                            length:
                            match.length,

                            text:
                            match.word
                        });
                }
            );


            const walker =
                document.createTreeWalker(
                    container,
                    NodeFilter.SHOW_TEXT
                );


            const nodes = [];

            let node;


            while (
                (
                    node =
                        walker.nextNode()
                )
                ) {
                if (
                    node.parentElement?.closest(
                        '.vrh-violation-highlight, ' +
                        '.vrh-flood-highlight, ' +
                        '.vrh-caps-highlight'
                    )
                ) {
                    continue;
                }


                nodes.push(
                    node
                );
            }


            nodes.forEach(
                (textNode) => {

                    const fullText =
                        textNode.nodeValue;


                    if (!fullText) {
                        return;
                    }


                    for (
                        const [
                            messageText,
                            capsMatches
                        ]
                        of byMessage
                        ) {

                        const messageOffset =
                            fullText.indexOf(
                                messageText
                            );


                        if (
                            messageOffset === -1
                        ) {
                            continue;
                        }


                        const adjusted =
                            capsMatches
                                .map(
                                    (match) => ({
                                        ...match,

                                        index:
                                            messageOffset +
                                            match.index
                                    })
                                )
                                .sort(
                                    (a, b) =>
                                        a.index -
                                        b.index
                                );


                        this.highlightCapsTextNode(
                            textNode,
                            adjusted
                        );


                        break;
                    }
                }
            );
        }

        highlightCapsTextNode(
            textNode,
            matches
        ) {
            const originalText =
                textNode.nodeValue;


            if (
                !originalText ||
                !matches.length
            ) {
                return;
            }


            const fragment =
                document.createDocumentFragment();


            let position = 0;


            matches.forEach(
                (match) => {

                    if (
                        match.index <
                        position
                    ) {
                        return;
                    }


                    if (
                        match.index >
                        position
                    ) {
                        fragment.appendChild(
                            document.createTextNode(
                                originalText.slice(
                                    position,
                                    match.index
                                )
                            )
                        );
                    }


                    const mark =
                        document.createElement(
                            'mark'
                        );


                    mark.className =
                        'vrh-caps-highlight';


                    mark.textContent =
                        originalText.slice(
                            match.index,
                            match.index +
                            match.length
                        );


                    fragment.appendChild(
                        mark
                    );


                    position =
                        match.index +
                        match.length;
                }
            );


            if (
                position <
                originalText.length
            ) {
                fragment.appendChild(
                    document.createTextNode(
                        originalText.slice(
                            position
                        )
                    )
                );
            }


            textNode.replaceWith(
                fragment
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
            const container =
                document.querySelector(
                    '#mr_messages'
                );


            if (!container) {
                return;
            }


            container
                .querySelectorAll(
                    '.vrh-violation-highlight'
                )
                .forEach(
                    (highlight) => {

                        highlight.replaceWith(
                            document.createTextNode(
                                highlight.textContent || ''
                            )
                        );
                    }
                );


            container.normalize();
        }


        /* =====================================================
           CREATE HIGHLIGHT
           ===================================================== */

        createHighlight(text) {
            const mark =
                document.createElement(
                    'mark'
                );


            mark.className =
                'vrh-violation-highlight';


            mark.textContent =
                text;


            /*
             * Временный стиль.
             * Финальный дизайн сделаем отдельно.
             */
            mark.style.background =
                '#ff3b3b';

            mark.style.color =
                '#ffffff';

            mark.style.fontWeight =
                '700';

            mark.style.borderRadius =
                '4px';

            mark.style.padding =
                '1px 4px';

            mark.style.margin =
                '0 1px';


            return mark;
        }


        /* =====================================================
           FIND TEXT MATCHES
           ===================================================== */

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
           HIGHLIGHT TEXT NODE
           ===================================================== */

        highlightTextNode(
            textNode,
            words
        ) {
            const originalText =
                textNode.nodeValue;


            if (
                !originalText ||
                !words.length
            ) {
                return;
            }


            const matches =
                this.findTextMatches(
                    originalText,
                    words
                );


            if (!matches.length) {
                return;
            }


            const fragment =
                document.createDocumentFragment();


            let position = 0;


            matches.forEach(
                (match) => {

                    if (
                        match.index >
                        position
                    ) {
                        fragment.appendChild(
                            document.createTextNode(
                                originalText.slice(
                                    position,
                                    match.index
                                )
                            )
                        );
                    }


                    fragment.appendChild(
                        this.createHighlight(
                            match.text
                        )
                    );


                    position =
                        match.index +
                        match.length;
                }
            );


            if (
                position <
                originalText.length
            ) {
                fragment.appendChild(
                    document.createTextNode(
                        originalText.slice(
                            position
                        )
                    )
                );
            }


            textNode.replaceWith(
                fragment
            );
        }


        /* =====================================================
           HIGHLIGHT RESULTS
           ===================================================== */

        highlightMatches(results) {
            const container =
                document.querySelector(
                    '#mr_messages'
                );


            if (!container) {
                return;
            }


            this.clearHighlights();


            if (
                !Array.isArray(results) ||
                !results.length
            ) {
                return;
            }


            const words =
                [
                    ...new Set(
                        results
                            .map(
                                (result) =>
                                    result.word
                            )
                            .filter(Boolean)
                    )
                ];


            const walker =
                document.createTreeWalker(
                    container,
                    NodeFilter.SHOW_TEXT
                );


            const nodes = [];

            let node;


            while (
                (
                    node =
                        walker.nextNode()
                )
                ) {
                /*
                 * Timestamp не трогаем.
                 */
                if (
                    node.parentElement?.matches(
                        'span.text-muted'
                    )
                ) {
                    continue;
                }


                /*
                 * Уже подсвеченный текст тоже.
                 */
                if (
                    node.parentElement?.closest(
                        '.vrh-violation-highlight'
                    )
                ) {
                    continue;
                }


                nodes.push(
                    node
                );
            }


            nodes.forEach(
                (textNode) => {

                    this.highlightTextNode(
                        textNode,
                        words
                    );
                }
            );
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
            this.clearHighlights();


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
            this.lastCapsLock =
                capsLock;


            if (!messages.length) {
                return [];
            }

            if (
                capsLock.detected
            ) {
                this.highlightCapsLock(
                    capsLock
                );
            }

            /*
             * Сначала обычный Report Scanner.
             */
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


            this.highlightMatches(
                this.lastResults
            );


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
                'Recommendations:',
                this.lastRecommendations
            );


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
            this.lastCapsLock =
                null;
            this.clearHighlights();
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