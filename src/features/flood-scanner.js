(() => {
    'use strict';


    class VimeReportFloodScanner {

        constructor() {
            this.lastResult = null;
        }


        /* =====================================================
           CONFIG
           ===================================================== */

        get windowSeconds() {
            return 5 * 60;
        }


        get symbolLimit() {
            return 14;
        }


        get repeatedMessageLimit() {
            return 3;
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
           TIME
           ===================================================== */

        timeToSeconds(time) {
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


            const hours =
                Number(match[1]);

            const minutes =
                Number(match[2]);

            const seconds =
                Number(match[3]);


            if (
                Number.isNaN(hours) ||
                Number.isNaN(minutes) ||
                Number.isNaN(seconds)
            ) {
                return null;
            }


            return (
                hours * 3600 +
                minutes * 60 +
                seconds
            );
        }


        /* =====================================================
           NORMALIZATION
           ===================================================== */

        normalizeMessage(text) {
            return String(text ?? '')
                .toLowerCase()

                /*
                 * NBSP -> обычный пробел
                 */
                .replace(/\u00a0/g, ' ')

                /*
                 * Убираем декоративную пунктуацию
                 * только по краям сообщения.
                 *
                 * "-Привет" == "Привет"
                 * "Привет!!!" == "Привет"
                 */
                .replace(
                    /^[\s\-—–_=+*~`'".,:;!?()[\]{}<>\\/|]+/,
                    ''
                )
                .replace(
                    /[\s\-—–_=+*~`'".,:;!?()[\]{}<>\\/|]+$/,
                    ''
                )

                /*
                 * Несколько пробелов -> один.
                 */
                .replace(/\s+/g, ' ')

                .trim();
        }


        /* =====================================================
           SYMBOL FLOOD DETECTION
           ===================================================== */

        extractFloodFragments(text) {
            const source =
                String(text ?? '');

            const fragments = [];


            /*
             * 1. Повтор одной буквы/цифры.
             *
             * ааааа
             * хххх
             * 11111
             */
            const repeatedCharacter =
                /([a-zа-яё0-9])\1{3,}/gi;


            /*
             * 2. Повторяющийся короткий паттерн.
             *
             * ахахахах
             * хахахаха
             * asdasdasd
             * abababa
             */
            const repeatedPattern =
                /((?:[a-zа-яё0-9]{2,4}))\1{2,}/gi;


            /*
             * 3. Серии спецсимволов.
             *
             * ))))))
             * !!!!!!
             * ??????
             * :)))))
             */
            const repeatedSymbols =
                /[^\p{L}\p{N}\s]{4,}/gu;


            /*
             * 4. Keyboard-smash / хаотичная последовательность.
             *
             * Не пытаемся определить "смысл".
             * Берём длинную слитную последовательность,
             * если в ней очень мало гласных.
             *
             * хвпахпавхп
             * глглг
             *
             * Но обычные слова сюда попадать не должны.
             */
            const chaoticWord =
                /[a-zа-яё]{7,}/gi;


            const addMatches =
                (
                    regex,
                    validator = null
                ) => {

                    let match;


                    while (
                        (
                            match =
                                regex.exec(source)
                        ) !== null
                        ) {
                        const value =
                            match[0];


                        if (
                            validator &&
                            !validator(value)
                        ) {
                            continue;
                        }


                        fragments.push({
                            index:
                            match.index,

                            length:
                            value.length,

                            text:
                            value,

                            symbolCount:
                            value.length
                        });


                        if (
                            value.length === 0
                        ) {
                            regex.lastIndex++;
                        }
                    }
                };


            addMatches(
                repeatedCharacter
            );


            addMatches(
                repeatedPattern
            );


            addMatches(
                repeatedSymbols
            );


            addMatches(
                chaoticWord,
                (value) => {

                    const normalized =
                        value.toLowerCase();


                    const vowels =
                        normalized.match(
                            /[аеёиоуыэюяaeiouy]/g
                        )?.length ?? 0;


                    /*
                     * Слишком мало гласных для длинной строки —
                     * скорее keyboard smash.
                     */
                    return (
                        vowels /
                        normalized.length
                    ) <= 0.28;
                }
            );


            /*
             * Сортируем и убираем пересечения.
             */
            fragments.sort(
                (a, b) => {

                    if (
                        a.index !==
                        b.index
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


            const filtered = [];

            let lastEnd = -1;


            fragments.forEach(
                (fragment) => {

                    if (
                        fragment.index <
                        lastEnd
                    ) {
                        return;
                    }


                    filtered.push(
                        fragment
                    );


                    lastEnd =
                        fragment.index +
                        fragment.length;
                }
            );


            return filtered;
        }


        /* =====================================================
           PREPARE MESSAGES
           ===================================================== */

        prepareMessages() {
            return this.getMessages()
                .map(
                    (message) => {

                        const seconds =
                            this.timeToSeconds(
                                message.time
                            );


                        if (
                            seconds === null
                        ) {
                            return null;
                        }


                        const text =
                            String(
                                message.text ?? ''
                            );


                        return {
                            ...message,

                            seconds,

                            normalized:
                                this.normalizeMessage(
                                    text
                                ),

                            floodFragments:
                                this.extractFloodFragments(
                                    text
                                )
                        };
                    }
                )
                .filter(Boolean)
                .sort(
                    (a, b) =>
                        a.seconds -
                        b.seconds
                );
        }


        /* =====================================================
           SYMBOL FLOOD
           ===================================================== */

        scanSymbolFlood(messages) {
            let best = null;


            for (
                let start = 0;
                start < messages.length;
                start++
            ) {
                let totalSymbols = 0;

                const involved = [];


                for (
                    let end = start;
                    end < messages.length;
                    end++
                ) {
                    const delta =
                        messages[end].seconds -
                        messages[start].seconds;


                    if (
                        delta >
                        this.windowSeconds
                    ) {
                        break;
                    }


                    const fragments =
                        messages[end]
                            .floodFragments;


                    if (
                        fragments.length
                    ) {
                        const count =
                            fragments.reduce(
                                (
                                    sum,
                                    fragment
                                ) =>
                                    sum +
                                    fragment.symbolCount,
                                0
                            );


                        totalSymbols +=
                            count;


                        involved.push({
                            message:
                                messages[end],

                            fragments,

                            symbolCount:
                            count
                        });
                    }


                    if (
                        !best ||
                        totalSymbols >
                        best.totalSymbols
                    ) {
                        best = {
                            detected:
                                totalSymbols >=
                                this.symbolLimit,

                            totalSymbols,

                            requiredSymbols:
                            this.symbolLimit,

                            startTime:
                            messages[start].time,

                            endTime:
                            messages[end].time,

                            messageCount:
                            involved.length,

                            matches:
                                involved.map(
                                    (item) => ({
                                        messageIndex:
                                        item.message.index,

                                        time:
                                        item.message.time,

                                        text:
                                        item.message.text,

                                        fragments:
                                        item.fragments,

                                        symbolCount:
                                        item.symbolCount
                                    })
                                )
                        };
                    }
                }
            }


            return best ?? {
                detected:
                    false,

                totalSymbols:
                    0,

                requiredSymbols:
                this.symbolLimit,

                startTime:
                    null,

                endTime:
                    null,

                messageCount:
                    0,

                matches:
                    []
            };
        }


        /* =====================================================
           REPEATED MESSAGE FLOOD
           ===================================================== */

        scanRepeatedMessages(messages) {
            let best = null;


            for (
                let start = 0;
                start < messages.length;
                start++
            ) {
                const groups =
                    new Map();


                for (
                    let end = start;
                    end < messages.length;
                    end++
                ) {
                    const delta =
                        messages[end].seconds -
                        messages[start].seconds;


                    if (
                        delta >
                        this.windowSeconds
                    ) {
                        break;
                    }


                    const normalized =
                        messages[end]
                            .normalized;


                    /*
                     * Пустые сообщения не учитываем.
                     */
                    if (
                        !normalized
                    ) {
                        continue;
                    }


                    /*
                     * Слишком короткое одиночное слово
                     * не должно само по себе создавать Flood.
                     *
                     * Например:
                     * "да"
                     * "да"
                     * "да"
                     *
                     * Но полноценное "привет" или предложение
                     * уже может быть повторным сообщением.
                     */
                    const words =
                        normalized
                            .split(/\s+/)
                            .filter(Boolean);


                    if (
                        words.length === 1 &&
                        normalized.length < 5
                    ) {
                        continue;
                    }


                    if (
                        !groups.has(
                            normalized
                        )
                    ) {
                        groups.set(
                            normalized,
                            []
                        );
                    }


                    groups
                        .get(normalized)
                        .push(
                            messages[end]
                        );
                }


                groups.forEach(
                    (
                        groupMessages,
                        normalized
                    ) => {

                        const count =
                            groupMessages.length;


                        if (
                            !best ||
                            count >
                            best.count
                        ) {
                            best = {
                                detected:
                                    count >=
                                    this
                                        .repeatedMessageLimit,

                                count,

                                requiredCount:
                                this
                                    .repeatedMessageLimit,

                                normalized,

                                startTime:
                                    groupMessages[0]
                                        ?.time ??
                                    null,

                                endTime:
                                    groupMessages[
                                    groupMessages.length - 1
                                        ]?.time ??
                                    null,

                                matches:
                                    groupMessages.map(
                                        (message) => ({
                                            messageIndex:
                                            message.index,

                                            time:
                                            message.time,

                                            text:
                                            message.text
                                        })
                                    )
                            };
                        }
                    }
                );
            }


            return best ?? {
                detected:
                    false,

                count:
                    0,

                requiredCount:
                this.repeatedMessageLimit,

                normalized:
                    null,

                startTime:
                    null,

                endTime:
                    null,

                matches:
                    []
            };
        }


        /* =====================================================
           HIGHLIGHTS
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
                    '.vrh-flood-highlight'
                )
                .forEach(
                    (mark) => {

                        mark.replaceWith(
                            document.createTextNode(
                                mark.textContent || ''
                            )
                        );
                    }
                );


            container.normalize();
        }


        createSymbolHighlight(text) {
            const mark =
                document.createElement(
                    'mark'
                );


            mark.className =
                'vrh-flood-highlight vrh-flood-highlight--symbol';


            mark.textContent =
                text;


            return mark;
        }


        highlightTextNode(
            textNode,
            fragments
        ) {
            const originalText =
                textNode.nodeValue;


            if (
                !originalText ||
                !fragments.length
            ) {
                return;
            }


            const fragment =
                document.createDocumentFragment();


            let position = 0;


            fragments.forEach(
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
                        this.createSymbolHighlight(
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


        highlightSymbolFlood(result) {
            if (
                !result?.detected
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
             * Карта:
             *
             * полный текст сообщения ->
             * найденные flood fragments
             */
            const byText =
                new Map();


            result.matches.forEach(
                (match) => {

                    if (
                        !match.text ||
                        !match.fragments?.length
                    ) {
                        return;
                    }


                    byText.set(
                        match.text,
                        match.fragments
                    );
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
                    node.parentElement?.matches(
                        'span.text-muted'
                    )
                ) {
                    continue;
                }


                if (
                    node.parentElement?.closest(
                        '.vrh-violation-highlight, .vrh-flood-highlight'
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

                    const text =
                        textNode.nodeValue;


                    for (
                        const [
                            messageText,
                            fragments
                        ]
                        of byText
                        ) {
                        if (
                            !text.includes(
                                messageText
                            )
                        ) {
                            continue;
                        }


                        /*
                         * Индексы fragments относятся
                         * к самому сообщению.
                         *
                         * Находим начало сообщения
                         * внутри текстового узла.
                         */
                        const offset =
                            text.indexOf(
                                messageText
                            );


                        const adjusted =
                            fragments.map(
                                (fragment) => ({
                                    ...fragment,

                                    index:
                                        offset +
                                        fragment.index
                                })
                            );


                        this.highlightTextNode(
                            textNode,
                            adjusted
                        );


                        break;
                    }
                }
            );
        }


        /* =====================================================
           SCAN
           ===================================================== */

        scan() {
            this.clearHighlights();


            const messages =
                this.prepareMessages();


            const symbolFlood =
                this.scanSymbolFlood(
                    messages
                );


            const repeatedFlood =
                this.scanRepeatedMessages(
                    messages
                );


            this.lastResult = {
                detected:
                    symbolFlood.detected ||
                    repeatedFlood.detected,

                windowSeconds:
                this.windowSeconds,

                symbolFlood,

                repeatedFlood
            };


            if (
                symbolFlood.detected
            ) {
                this.highlightSymbolFlood(
                    symbolFlood
                );
            }


            console.group(
                '[Vime Report Helper] Flood Scanner'
            );


            console.log(
                'Messages scanned:',
                messages.length
            );


            console.log(
                'Symbol flood:',
                symbolFlood
            );


            console.log(
                'Repeated message flood:',
                repeatedFlood
            );


            console.groupEnd();


            return this.lastResult;
        }


        getLastResult() {
            return this.lastResult;
        }


        clear() {
            this.lastResult =
                null;

            this.clearHighlights();
        }
    }


    window.VimeReportFloodScanner =
        new VimeReportFloodScanner();

})();