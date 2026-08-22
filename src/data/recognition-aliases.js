(() => {
    'use strict';

    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER — BUILT-IN RECOGNITION KNOWLEDGE
     * =========================================================
     *
     * Центральный слой категорий распознавания.
     *
     * Источники:
     *
     * 1. Built-in aliases
     * 2. Violation Rules DATABASE
     * 3. Learning Store
     * 4. Дополнительные подтверждённые category words
     *
     * ВАЖНО:
     *
     * prohibited-words.txt остаётся официальным плоским
     * словарём и НЕ изменяется.
     *
     * Здесь VRH только определяет, к какой категории
     * относится уже найденное нарушение.
     */


    /*
     * =========================================================
     * EXTRA CATEGORY WORDS
     * =========================================================
     *
     * Сюда попадают слова, которые присутствуют в
     * prohibited-words, но ещё отсутствуют в
     * категоризированном Violation Rules DATABASE.
     *
     * Это НЕ отдельный prohibited dictionary.
     *
     * Сканер всё равно должен сначала найти нарушение.
     * Этот список только говорит:
     *
     * "если Scanner уже встретил это слово,
     *  какой reason ему рекомендовать?"
     */

    const CATEGORY_WORDS =
        Object.freeze({

            INSULT: Object.freeze([
                'бомж'
            ]),

            MAT: Object.freeze([
            ]),

            AMORAL: Object.freeze([
            ]),

            INSULT_MAT: Object.freeze([
            ])

        });


    /*
     * =========================================================
     * BUILT-IN ALIASES
     * =========================================================
     */

    const ALIASES = Object.freeze([

        {
            id:
                'insult-mat-go-away',

            canonical:
                'иди нахуй',

            reasonId:
                'player-insult-mat',

            label:
                'Оскорбление игроков + Мат',

            category:
                'INSULT_MAT',

            confidence:
                0.98,

            aliases: [
                'иди нахуй',
                'иди на хуй',
                'пошел нахуй',
                'пошёл нахуй',
                'пошла нахуй',
                'пошёл на хуй',
                'пошла на хуй'
            ]
        },


        {
            id:
                'insult-mat-brainless',

            canonical:
                'мозгов нет',

            reasonId:
                'player-insult',

            label:
                'Оскорбление игроков',

            category:
                'INSULT',

            confidence:
                0.96,

            aliases: [
                'мозгов нет',
                'без мозгов',
                '0 iq',
                'iq 0'
            ]
        },


        {
            id:
                'mat-action',

            canonical:
                'членом разорвал',

            reasonId:
                'mat-amoral',

            label:
                'Мат/Аморал',

            category:
                'MAT',

            confidence:
                0.97,

            aliases: [
                'членом разорвал',
                'хером разорвал',
                'хуем разорвал',
                'членом порвал',
                'хером порвал',
                'хуем порвал'
            ]
        },


        {
            id:
                'mat-family-action',

            canonical:
                'мать ебал',

            reasonId:
                'player-insult-mat',

            label:
                'Оскорбление игроков + Мат',

            category:
                'INSULT_MAT',

            confidence:
                0.98,

            aliases: [
                'мать ебал',
                'ебал мать',
                'ебал твою мать',
                'ебал твою маму'
            ]
        }

    ]);


    /*
     * =========================================================
     * BASIC HELPERS
     * =========================================================
     */

    function toText(
        value
    ) {

        return typeof value ===
        'string'
            ? value.trim()
            : '';
    }


    function normalizeText(
        value
    ) {

        const normalizer =
            window.VimeReportTextNormalizer;


        if (
            normalizer &&
            typeof normalizer.normalize ===
            'function'
        ) {

            try {

                return normalizer.normalize(
                    String(
                        value ??
                        ''
                    )
                );

            } catch (_) {

                /*
                 * fallback ниже
                 */

            }
        }


        return String(
            value ??
            ''
        )
            .toLowerCase()

            .replace(
                /\u00a0/g,
                ' '
            )

            .replace(
                /ё/g,
                'е'
            )

            .trim();
    }


    function compactKey(
        value
    ) {

        return normalizeText(
            value
        )
            .replace(
                /[^a-zа-яё0-9]+/gi,
                ''
            );
    }


    function normalizedKey(
        value
    ) {

        return normalizeText(
            value
        ).trim();
    }


    function unique(
        list
    ) {

        return [
            ...new Set(
                list.filter(
                    Boolean
                )
            )
        ];
    }


    /*
     * =========================================================
     * CATEGORY NORMALIZATION
     * =========================================================
     */

    function normalizeCategory(
        value
    ) {

        const category =
            String(
                value ??
                ''
            )
                .trim()
                .toUpperCase()
                .replace(
                    /[\s-]+/g,
                    '_'
                );


        switch (
            category
            ) {

            case 'INSULT':
            case 'PLAYER_INSULT':

                return 'INSULT';


            case 'INSULT_MAT':
            case 'PLAYER_INSULT_MAT':

                return 'INSULT_MAT';


            case 'MAT':
            case 'MAT_AMORAL':

                return 'MAT';


            case 'AMORAL':

                return 'AMORAL';


            default:

                return null;
        }
    }


    /*
     * =========================================================
     * ALIAS INDEX
     * =========================================================
     */

    function buildAliasIndex() {

        const index =
            new Map();


        for (
            const entry
            of ALIASES
            ) {

            const rawAliases =
                unique(
                    [
                        entry.canonical,

                        ...(
                            Array.isArray(
                                entry.aliases
                            )
                                ? entry.aliases
                                : []
                        )
                    ]
                        .map(
                            toText
                        )
                        .filter(
                            Boolean
                        )
                );


            index.set(
                entry.id,
                {
                    ...entry,
                    rawAliases
                }
            );
        }


        return index;
    }


    const ALIAS_INDEX =
        buildAliasIndex();


    /*
     * =========================================================
     * DICTIONARY WORDS
     * =========================================================
     */

    function getDictionaryWords() {

        return unique(
            ALIASES.flatMap(
                (entry) => [

                    entry.canonical,

                    ...(
                        Array.isArray(
                            entry.aliases
                        )
                            ? entry.aliases
                            : []
                    )

                ]
            )
        );
    }


    const WORD_SET =
        new Set(
            getDictionaryWords()
                .map(
                    compactKey
                )
        );


    function hasWord(
        value
    ) {

        return WORD_SET.has(
            compactKey(
                value
            )
        );
    }


    /*
     * =========================================================
     * BUILT-IN ALIAS MATCHING
     * =========================================================
     */

    function findMatches(
        text
    ) {

        const normalized =
            normalizeText(
                text
            );


        const compact =
            compactKey(
                text
            );


        const matches =
            [];


        if (
            !normalized ||
            !compact
        ) {
            return matches;
        }


        for (
            const entry
            of ALIAS_INDEX.values()
            ) {

            const hit =
                entry.rawAliases.find(
                    (alias) => {

                        const aliasNormalized =
                            normalizedKey(
                                alias
                            );


                        const aliasCompact =
                            compactKey(
                                alias
                            );


                        if (
                            !aliasCompact ||
                            !aliasNormalized
                        ) {
                            return false;
                        }


                        return (
                            normalized ===
                            aliasNormalized ||
                            compact ===
                            aliasCompact
                        );
                    }
                );


            if (
                !hit
            ) {
                continue;
            }


            matches.push({

                id:
                entry.id,

                canonical:
                entry.canonical,

                category:
                    normalizeCategory(
                        entry.category
                    ),

                reasonId:
                entry.reasonId,

                label:
                entry.label,

                confidence:
                entry.confidence,

                alias:
                hit,

                matchedText:
                hit,

                matchType:
                    hit ===
                    entry.canonical
                        ? 'canonical'
                        : 'alias'

            });
        }


        return matches;
    }


    /*
     * =========================================================
     * EXTRA CATEGORY LOOKUP
     * =========================================================
     */

    function getExtraCategory(
        value
    ) {

        const key =
            normalizedKey(
                value
            );


        const compact =
            compactKey(
                value
            );


        if (
            !key &&
            !compact
        ) {
            return null;
        }


        for (
            const [
                category,
                words
            ]
            of Object.entries(
            CATEGORY_WORDS
        )
            ) {

            const found =
                words.some(
                    (word) => {

                        const wordKey =
                            normalizedKey(
                                word
                            );


                        const wordCompact =
                            compactKey(
                                word
                            );


                        return (
                            key ===
                            wordKey ||
                            compact ===
                            wordCompact
                        );
                    }
                );


            if (
                found
            ) {

                return normalizeCategory(
                    category
                );
            }
        }


        return null;
    }


    /*
     * =========================================================
     * VIOLATION RULES CATEGORY LOOKUP
     * =========================================================
     *
     * Violation Rules загружается ПОСЛЕ этого файла,
     * поэтому обращаемся к нему лениво — только в момент
     * реального вызова функции.
     */

    function getViolationRulesCategory(
        value
    ) {

        const rules =
            window.VimeReportViolationRules;


        const database =
            rules?.DATABASE;


        if (
            !database
        ) {
            return null;
        }


        const target =
            normalizedKey(
                value
            );


        const targetCompact =
            compactKey(
                value
            );


        if (
            !target &&
            !targetCompact
        ) {
            return null;
        }


        const contains =
            (list) => {

                if (
                    !Array.isArray(
                        list
                    )
                ) {
                    return false;
                }


                return list.some(
                    (word) => {

                        const wordKey =
                            normalizedKey(
                                word
                            );


                        const wordCompact =
                            compactKey(
                                word
                            );


                        return (
                            target ===
                            wordKey ||
                            targetCompact ===
                            wordCompact
                        );
                    }
                );
            };


        /*
         * Самая специфичная категория —
         * первой.
         */

        if (
            contains(
                database.INSULT_MAT
            )
        ) {
            return 'INSULT_MAT';
        }


        if (
            contains(
                database.INSULT
            )
        ) {
            return 'INSULT';
        }


        if (
            contains(
                database.MAT
            )
        ) {
            return 'MAT';
        }


        if (
            contains(
                database.AMORAL
            )
        ) {
            return 'AMORAL';
        }


        return null;
    }


    /*
     * =========================================================
     * LEARNING STORE CATEGORY LOOKUP
     * =========================================================
     */

    function getLearningCategory(
        value
    ) {

        const store =
            window.VimeReportLearningStore;


        if (
            !store
        ) {
            return null;
        }


        const target =
            normalizedKey(
                value
            );


        const targetCompact =
            compactKey(
                value
            );


        if (
            !target &&
            !targetCompact
        ) {
            return null;
        }


        try {

            const aliases =
                typeof store.findAliases ===
                'function'
                    ? store.findAliases()
                    : [];


            if (
                Array.isArray(
                    aliases
                )
            ) {

                const entry =
                    aliases.find(
                        (item) => {

                            const original =
                                normalizedKey(
                                    item?.original
                                );


                            const normalized =
                                normalizedKey(
                                    item?.normalized
                                );


                            const originalCompact =
                                compactKey(
                                    item?.original
                                );


                            const normalizedCompact =
                                compactKey(
                                    item?.normalized
                                );


                            return (
                                target ===
                                original ||
                                target ===
                                normalized ||
                                targetCompact ===
                                originalCompact ||
                                targetCompact ===
                                normalizedCompact
                            );
                        }
                    );


                if (
                    entry
                ) {

                    const category =
                        normalizeCategory(
                            entry.category ??
                            entry.reasonId
                        );


                    if (
                        category
                    ) {
                        return category;
                    }
                }
            }


            const phrases =
                typeof store.findPhrases ===
                'function'
                    ? store.findPhrases()
                    : [];


            if (
                Array.isArray(
                    phrases
                )
            ) {

                const entry =
                    phrases.find(
                        (item) => {

                            const original =
                                normalizedKey(
                                    item?.original
                                );


                            const normalized =
                                normalizedKey(
                                    item?.normalized
                                );


                            return (
                                target ===
                                original ||
                                target ===
                                normalized
                            );
                        }
                    );


                if (
                    entry
                ) {

                    return normalizeCategory(
                        entry.category ??
                        entry.reasonId
                    );
                }
            }

        } catch (
            error
            ) {

            console.warn(
                '[Vime Report Helper] Recognition category lookup failed:',
                error
            );
        }


        return null;
    }


    /*
     * =========================================================
     * MASTER CATEGORY RESOLVER
     * =========================================================
     *
     * Это теперь единственная функция, которой Scanner
     * должен задавать вопрос:
     *
     * "Какой категории это слово?"
     */

    function getCategoryForWord(
        value
    ) {

        /*
         * 1. Явные built-in aliases.
         */

        const aliasMatch =
            findMatches(
                value
            )[0];


        if (
            aliasMatch?.category
        ) {
            return aliasMatch.category;
        }


        /*
         * 2. Violation Rules DATABASE.
         *
         * Здесь автоматически покрываются ВСЕ слова,
         * уже находящиеся в MAT / INSULT /
         * INSULT_MAT / AMORAL.
         */

        const violationCategory =
            getViolationRulesCategory(
                value
            );


        if (
            violationCategory
        ) {
            return violationCategory;
        }


        /*
         * 3. Learning Store.
         */

        const learningCategory =
            getLearningCategory(
                value
            );


        if (
            learningCategory
        ) {
            return learningCategory;
        }


        /*
         * 4. Небольшой список слов, которых пока
         * нет в категоризированной базе.
         */

        return getExtraCategory(
            value
        );
    }


    /*
     * =========================================================
     * REASON RESOLVER
     * =========================================================
     */

    function getReasonForCategory(
        category
    ) {

        switch (
            normalizeCategory(
                category
            )
            ) {

            case 'INSULT':

                return {
                    reasonId:
                        'player-insult',

                    label:
                        'Оскорбление игроков'
                };


            case 'INSULT_MAT':

                return {
                    reasonId:
                        'player-insult-mat',

                    label:
                        'Оскорбление игроков + Мат'
                };


            case 'MAT':
            case 'AMORAL':

                return {
                    reasonId:
                        'mat-amoral',

                    label:
                        'Мат/Аморал'
                };


            default:

                return null;
        }
    }


    function getReasonForWord(
        value
    ) {

        return getReasonForCategory(
            getCategoryForWord(
                value
            )
        );
    }


    /*
     * =========================================================
     * STATUS
     * =========================================================
     */

    function getStatus() {

        return {

            ready:
                true,

            aliasCount:
            ALIAS_INDEX.size,

            aliasForms:
            getDictionaryWords()
                .length,

            extraInsultWords:
            CATEGORY_WORDS
                .INSULT
                .length,

            categoryResolver:
                true

        };
    }


    /*
     * =========================================================
     * EXPORT
     * =========================================================
     */

    window.VimeReportRecognitionAliases =
        Object.freeze({

            entries:
            ALIASES,

            categoryWords:
            CATEGORY_WORDS,

            getDictionaryWords,

            hasWord,

            findMatches,

            getCategoryForWord,

            getReasonForCategory,

            getReasonForWord,

            getStatus,

            normalizeCategory,

            normalizeText,

            compactKey

        });

})();