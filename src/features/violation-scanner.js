(() => {
    'use strict';

    class VimeReportViolationScanner {

        constructor() {
            this.lastResults = [];
            this.lastRecommendations = [];
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
            word,
            global = false
        ) {
            const cleaned =
                String(word ?? '')
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
                    ? 'giu'
                    : 'iu';


            if (
                [...cleaned].length <= 2
            ) {
                return new RegExp(
                    `(?<![\\p{L}\\p{N}_])(${escaped})`,
                    flags
                );
            }


            return new RegExp(
                `(${escaped})`,
                flags
            );
        }


        /* =====================================================
           SCAN ONE MESSAGE
           ===================================================== */

        scanMessage(
            message,
            prohibitedWords
        ) {
            if (
                !message ||
                typeof message.text !== 'string'
            ) {
                return [];
            }


            const matches = [];


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


                    const regex =
                        this.buildRegex(
                            word,
                            false
                        );


                    if (!regex) {
                        return;
                    }


                    if (
                        regex.test(
                            message.text
                        )
                    ) {
                        matches.push({
                            messageIndex:
                            message.index,

                            time:
                            message.time,

                            text:
                            message.text,

                            word:
                            word
                        });
                    }
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

                    const regex =
                        this.buildRegex(
                            word,
                            true
                        );


                    if (!regex) {
                        return;
                    }


                    let match;


                    while (
                        (
                            match =
                                regex.exec(text)
                        ) !== null
                        ) {
                        found.push({
                            index:
                            match.index,

                            length:
                            match[0].length,

                            text:
                                match[0],

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


            const prohibitedWords =
                this.getProhibitedWords();


            this.lastResults = [];
            this.lastRecommendations = [];


            if (!messages.length) {
                return [];
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
                                prohibitedWords
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