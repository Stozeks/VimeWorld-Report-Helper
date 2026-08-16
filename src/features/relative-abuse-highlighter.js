(() => {
    'use strict';


    class VimeReportRelativeAbuseHighlighter {

        constructor() {
            this.relativeClass =
                'vrh-relative-target';

            this.abuseClass =
                'vrh-relative-abuse';

            this.styleId =
                'vrh-relative-v5-style';
        }


        /* =====================================================
           STYLES
           ===================================================== */

        installStyles() {
            if (
                document.getElementById(
                    this.styleId
                )
            ) {
                return;
            }


            const style =
                document.createElement(
                    'style'
                );


            style.id =
                this.styleId;


            style.textContent = `
                /*
                 * RELATIVE TARGET
                 *
                 * "твоя мать"
                 * "сын"
                 * "ребенок"
                 */
                .${this.relativeClass} {
                    background: transparent !important;
                    color: #e2b341 !important;

                    font-weight: 700 !important;

                    padding: 0 !important;
                    margin: 0 !important;

                    border: 0 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;

                    text-decoration-line: underline !important;
                    text-decoration-style: dotted !important;
                    text-decoration-thickness: 1px !important;
                    text-underline-offset: 3px !important;
                    text-decoration-color:
                        rgba(226, 179, 65, 0.72) !important;
                }


                /*
                 * ABUSE / ACTION
                 *
                 * "шлюхи"
                 * "шалавы"
                 * "членом разорвал"
                 */
                .${this.abuseClass} {
                    background: transparent !important;
                    color: #e76565 !important;

                    font-weight: 700 !important;

                    padding: 0 !important;
                    margin: 0 !important;

                    border: 0 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;

                    text-decoration-line: underline !important;
                    text-decoration-style: dotted !important;
                    text-decoration-thickness: 1px !important;
                    text-underline-offset: 3px !important;
                    text-decoration-color:
                        rgba(231, 101, 101, 0.70) !important;
                }
            `;


            (
                document.head ||
                document.documentElement
            ).appendChild(
                style
            );
        }


        /* =====================================================
           NORMALIZATION
           ===================================================== */

        normalize(
            value
        ) {
            return String(
                value ??
                ''
            )
                .replace(
                    /\s+/g,
                    ' '
                )
                .trim()
                .toLocaleLowerCase(
                    'ru-RU'
                );
        }


        indexOfIgnoreCase(
            source,
            search
        ) {
            if (
                typeof source !==
                'string' ||
                typeof search !==
                'string' ||
                !search
            ) {
                return -1;
            }


            return source
                .toLocaleLowerCase(
                    'ru-RU'
                )
                .indexOf(
                    search
                        .toLocaleLowerCase(
                            'ru-RU'
                        )
                );
        }


        /* =====================================================
           MESSAGES
           ===================================================== */

        getMessagesContainer() {
            return document.querySelector(
                '#mr_messages'
            );
        }


        /*
         * Самое важное изменение V5.
         *
         * Мы больше НЕ ищем огромный DOM element,
         * содержащий сразу несколько сообщений.
         *
         * Ищем минимальный элемент, внутри которого
         * находится ровно нужный message.text.
         */
        findExactMessageElement(
            messageText
        ) {
            const container =
                this.getMessagesContainer();


            if (
                !container ||
                !messageText
            ) {
                return null;
            }


            const target =
                this.normalize(
                    messageText
                );


            if (!target) {
                return null;
            }


            const elements =
                Array.from(
                    container.querySelectorAll(
                        'div, p, li, span'
                    )
                );


            const matches =
                elements
                    .filter(
                        (element) => {

                            if (
                                element.closest(
                                    `.${this.relativeClass}, ` +
                                    `.${this.abuseClass}`
                                )
                            ) {
                                return false;
                            }


                            const full =
                                this.normalize(
                                    element.textContent
                                );


                            if (!full) {
                                return false;
                            }


                            return full.includes(
                                target
                            );
                        }
                    )
                    .sort(
                        (a, b) => {

                            const aLength =
                                String(
                                    a.textContent ??
                                    ''
                                ).length;


                            const bLength =
                                String(
                                    b.textContent ??
                                    ''
                                ).length;


                            return (
                                aLength -
                                bLength
                            );
                        }
                    );


            /*
             * Берём только самый узкий DOM-узел.
             */
            return (
                matches[0] ??
                null
            );
        }


        /* =====================================================
           SAFE MESSAGE TEXT RANGE
           ===================================================== */

        getMessageTextRange(
            element,
            messageText
        ) {
            if (
                !element ||
                !messageText
            ) {
                return null;
            }


            const fullText =
                String(
                    element.textContent ??
                    ''
                );


            const offset =
                this.indexOfIgnoreCase(
                    fullText,
                    messageText
                );


            if (
                offset < 0
            ) {
                return null;
            }


            return {
                start:
                offset,

                end:
                    offset +
                    messageText.length
            };
        }


        /* =====================================================
           TARGET RANGE
           ===================================================== */

        getTargetRange(
            detection
        ) {
            const message =
                String(
                    detection?.text ??
                    ''
                );


            if (!message) {
                return null;
            }


            const relativeText =
                String(
                    detection.relativeText ??
                    ''
                );


            let relativeIndex =
                Number.isInteger(
                    detection.relativeIndex
                )
                    ? detection.relativeIndex
                    : this.indexOfIgnoreCase(
                        message,
                        relativeText
                    );


            if (
                relativeIndex < 0
            ) {
                return null;
            }


            let start =
                relativeIndex;


            const before =
                message.slice(
                    0,
                    relativeIndex
                );


            /*
             * Для:
             *
             * твою мать
             * твоя мама
             * твой отец
             * у тебя мать
             *
             * включаем possessive marker
             * в target highlight.
             */
            const markerMatch =
                before.match(
                    /(?:^|\s)(твой|твоя|твоё|твое|твои|твоего|твоей|твоему|твою|твоим|твоими|у\s+тебя)\s*$/iu
                );


            if (
                markerMatch
            ) {
                const marker =
                    markerMatch[1];


                const markerIndex =
                    this.indexOfIgnoreCase(
                        before,
                        marker
                    );


                if (
                    markerIndex >= 0
                ) {
                    start =
                        markerIndex;
                }
            }


            const length =
                Number.isInteger(
                    detection.relativeLength
                )
                    ? detection.relativeLength
                    : relativeText.length;


            return {
                start,

                end:
                    relativeIndex +
                    length
            };
        }


        /* =====================================================
           ABUSE RANGE
           ===================================================== */

        getAbuseRange(
            detection
        ) {
            const message =
                String(
                    detection?.text ??
                    ''
                );


            if (!message) {
                return null;
            }


            const abuseText =
                String(
                    detection.abuseText ??
                    ''
                );


            let abuseIndex =
                Number.isInteger(
                    detection.abuseIndex
                )
                    ? detection.abuseIndex
                    : this.indexOfIgnoreCase(
                        message,
                        abuseText
                    );


            if (
                abuseIndex < 0 ||
                !abuseText
            ) {
                return null;
            }


            /*
             * Для contextual action у нас abuseText
             * может выглядеть как:
             *
             * "членом разорвал"
             *
             * Тогда выделяем его полностью.
             */

            const length =
                Number.isInteger(
                    detection.abuseLength
                )
                    ? detection.abuseLength
                    : abuseText.length;


            return {
                start:
                abuseIndex,

                end:
                    abuseIndex +
                    length
            };
        }


        /* =====================================================
           TEXT NODE MAP
           ===================================================== */

        buildTextNodeMap(
            root
        ) {
            const walker =
                document.createTreeWalker(
                    root,
                    NodeFilter.SHOW_TEXT
                );


            const map = [];

            let cursor =
                0;


            let node;


            while (
                (
                    node =
                        walker.nextNode()
                )
                ) {
                const value =
                    node.nodeValue ??
                    '';


                if (!value) {
                    continue;
                }


                /*
                 * Не заходим внутрь уже созданной
                 * V5 подсветки.
                 */
                if (
                    node.parentElement
                        ?.closest(
                            `.${this.relativeClass}, ` +
                            `.${this.abuseClass}`
                        )
                ) {
                    cursor +=
                        value.length;

                    continue;
                }


                map.push({
                    node,

                    start:
                    cursor,

                    end:
                        cursor +
                        value.length
                });


                cursor +=
                    value.length;
            }


            return map;
        }


        /* =====================================================
           WRAP ABSOLUTE RANGE
           ===================================================== */

        wrapAbsoluteRange(
            root,
            start,
            end,
            className
        ) {
            if (
                !root ||
                start < 0 ||
                end <= start
            ) {
                return;
            }


            const map =
                this.buildTextNodeMap(
                    root
                );


            const operations =
                [];


            map.forEach(
                (entry) => {

                    if (
                        end <=
                        entry.start ||
                        start >=
                        entry.end
                    ) {
                        return;
                    }


                    const localStart =
                        Math.max(
                            0,
                            start -
                            entry.start
                        );


                    const localEnd =
                        Math.min(
                            entry.end -
                            entry.start,
                            end -
                            entry.start
                        );


                    if (
                        localEnd >
                        localStart
                    ) {
                        operations.push({
                            node:
                            entry.node,

                            start:
                            localStart,

                            end:
                            localEnd
                        });
                    }
                }
            );


            operations
                .reverse()
                .forEach(
                    (operation) => {

                        this.wrapTextNode(
                            operation.node,
                            operation.start,
                            operation.end,
                            className
                        );
                    }
                );
        }


        wrapTextNode(
            textNode,
            start,
            end,
            className
        ) {
            const value =
                textNode.nodeValue ??
                '';


            const before =
                value.slice(
                    0,
                    start
                );


            const selected =
                value.slice(
                    start,
                    end
                );


            const after =
                value.slice(
                    end
                );


            if (
                !selected
            ) {
                return;
            }


            const fragment =
                document
                    .createDocumentFragment();


            if (before) {
                fragment.appendChild(
                    document.createTextNode(
                        before
                    )
                );
            }


            const span =
                document.createElement(
                    'span'
                );


            span.className =
                className;


            span.textContent =
                selected;


            fragment.appendChild(
                span
            );


            if (after) {
                fragment.appendChild(
                    document.createTextNode(
                        after
                    )
                );
            }


            textNode.replaceWith(
                fragment
            );
        }


        /* =====================================================
           ONE DETECTION
           ===================================================== */

        highlightDetection(
            detection
        ) {
            if (
                !detection?.detected ||
                !detection.text
            ) {
                return;
            }


            const element =
                this.findExactMessageElement(
                    detection.text
                );


            /*
             * SAFE FAIL.
             *
             * Если не смогли однозначно найти строку —
             * лучше вообще ничего не красить.
             */
            if (!element) {
                return;
            }


            const messageRange =
                this.getMessageTextRange(
                    element,
                    detection.text
                );


            if (!messageRange) {
                return;
            }


            const targetRange =
                this.getTargetRange(
                    detection
                );


            const abuseRange =
                this.getAbuseRange(
                    detection
                );


            /*
             * Сначала abuse, затем target.
             *
             * Они не должны пересекаться,
             * но даже если пересекутся —
             * каждый работает только внутри
             * message.text.
             */


            if (abuseRange) {
                this.wrapAbsoluteRange(
                    element,

                    messageRange.start +
                    abuseRange.start,

                    messageRange.start +
                    abuseRange.end,

                    this.abuseClass
                );
            }


            if (targetRange) {
                this.wrapAbsoluteRange(
                    element,

                    messageRange.start +
                    targetRange.start,

                    messageRange.start +
                    targetRange.end,

                    this.relativeClass
                );
            }
        }


        /* =====================================================
           PUBLIC
           ===================================================== */

        highlight(
            detections
        ) {
            this.installStyles();


            if (
                !Array.isArray(
                    detections
                )
            ) {
                return;
            }


            detections.forEach(
                (detection) => {

                    this.highlightDetection(
                        detection
                    );
                }
            );
        }


        /* =====================================================
           CLEAR
           ===================================================== */

        clear() {
            const container =
                this.getMessagesContainer();


            if (!container) {
                return;
            }


            container
                .querySelectorAll(
                    `.${this.relativeClass}, ` +
                    `.${this.abuseClass}`
                )
                .forEach(
                    (element) => {

                        element.replaceWith(
                            document.createTextNode(
                                element.textContent ??
                                ''
                            )
                        );
                    }
                );


            container.normalize();
        }
    }


    window.VimeReportRelativeAbuseHighlighter =
        new VimeReportRelativeAbuseHighlighter();


    console.log(
        '[Vime Report Helper] Relative Abuse Highlighter V5 loaded.'
    );

})();