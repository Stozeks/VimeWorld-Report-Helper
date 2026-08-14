(() => {
    'use strict';

    /* =========================================================
       VIMEWORLD REPORT MESSAGE PARSER
       =========================================================
       Разбирает содержимое #mr_messages.

       Ожидаемая структура VimeWorld:

       <div id="mr_messages">

           <span class="text-muted">
               12:04:05
           </span>

           " - сообщение игрока"

           <br>

           ...

       </div>
       ========================================================= */


    class VimeReportMessageParser {

        /* =====================================================
           MESSAGE CONTAINER
           ===================================================== */

        getContainer() {
            return document.querySelector(
                '#mr_messages'
            );
        }


        /* =====================================================
           AVAILABLE
           ===================================================== */

        isAvailable() {
            return Boolean(
                this.getContainer()
            );
        }


        /* =====================================================
           PARSE ALL MESSAGES
           ===================================================== */

        parse() {
            const container =
                this.getContainer();


            if (!container) {
                return [];
            }


            const messages =
                [];


            let currentTime =
                null;


            let currentTextParts =
                [];


            const flushMessage =
                () => {

                    /*
                     * Удаляем мусорные пробелы
                     * и дефис перед сообщением.
                     */

                    let text =
                        currentTextParts
                            .join('')
                            .replace(
                                /\u00a0/g,
                                ' '
                            )
                            .trim();


                    text =
                        text.replace(
                            /^\s*-\s*/,
                            ''
                        );


                    if (
                        currentTime &&
                        text
                    ) {

                        messages.push({
                            index:
                            messages.length,

                            time:
                            currentTime,

                            text:
                            text
                        });
                    }


                    currentTime =
                        null;


                    currentTextParts =
                        [];
                };


            container
                .childNodes
                .forEach(
                    (node) => {

                        /*
                         * =========================================
                         * TIMESTAMP
                         * =========================================
                         */

                        if (
                            node.nodeType ===
                            Node.ELEMENT_NODE &&
                            node.matches?.(
                                'span.text-muted'
                            )
                        ) {

                            /*
                             * Если вдруг предыдущая строка
                             * не закончилась через <br>,
                             * безопасно завершаем её здесь.
                             */

                            if (
                                currentTime !==
                                null
                            ) {

                                flushMessage();
                            }


                            currentTime =
                                node.textContent
                                    ?.trim() ||
                                null;


                            return;
                        }


                        /*
                         * =========================================
                         * LINE END
                         * =========================================
                         */

                        if (
                            node.nodeType ===
                            Node.ELEMENT_NODE &&
                            node.tagName ===
                            'BR'
                        ) {

                            flushMessage();

                            return;
                        }


                        /*
                         * =========================================
                         * TEXT NODE
                         * =========================================
                         */

                        if (
                            node.nodeType ===
                            Node.TEXT_NODE
                        ) {

                            if (
                                currentTime ===
                                null
                            ) {

                                return;
                            }


                            currentTextParts.push(
                                node.textContent ||
                                ''
                            );
                        }
                    }
                );


            /*
             * Последняя строка может не иметь <br>.
             */

            if (
                currentTime !==
                null
            ) {

                flushMessage();
            }


            return messages;
        }


        /* =====================================================
           MESSAGE COUNT
           ===================================================== */

        count() {
            return this.parse().length;
        }


        /* =====================================================
           FIND BY TEXT
           =====================================================
           Пока просто технический helper.
           Позже его будет использовать Search.
           ===================================================== */

        findByText(
            query,
            {
                caseSensitive = false
            } = {}
        ) {

            if (
                typeof query !==
                'string' ||
                query.trim() === ''
            ) {

                return [];
            }


            const normalizedQuery =
                caseSensitive
                    ? query.trim()
                    : query
                        .trim()
                        .toLowerCase();


            return this
                .parse()
                .filter(
                    (message) => {

                        const haystack =
                            caseSensitive
                                ? message.text
                                : message.text
                                    .toLowerCase();


                        return haystack.includes(
                            normalizedQuery
                        );
                    }
                );
        }


        /* =====================================================
           DEBUG
           ===================================================== */

        debug() {
            const messages =
                this.parse();


            console.group(
                '[Vime Report Helper] Message Parser'
            );


            console.log(
                'Container:',
                this.getContainer()
            );


            console.log(
                'Messages:',
                messages.length
            );


            console.table(
                messages.map(
                    (message) => ({
                        index:
                        message.index,

                        time:
                        message.time,

                        text:
                        message.text
                    })
                )
            );


            console.groupEnd();


            return messages;
        }
    }


    /* =========================================================
       EXPORT
       ========================================================= */

    window.VimeReportMessageParser =
        new VimeReportMessageParser();

})();