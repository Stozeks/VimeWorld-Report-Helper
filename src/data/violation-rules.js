(() => {
    'use strict';

    /*
     * =========================================================
     * VIMEWORLD VIOLATION RULE DATABASE
     * =========================================================
     *
     * Используется только для ПОДСКАЗКИ модератору.
     *
     * Никаких автоматических мутов.
     * Никаких автоматических нажатий плиток.
     *
     * Классы:
     *
     * MAT
     *      -> Мат/Аморал
     *
     * AMORAL
     *      -> Мат/Аморал
     *
     * INSULT
     *      -> Оскорбление игроков
     *
     * INSULT_MAT
     *      -> Оскорбление игроков + Мат
     *
     * =========================================================
     */


    const TYPE = Object.freeze({
        MAT: 'MAT',
        AMORAL: 'AMORAL',
        INSULT: 'INSULT',
        INSULT_MAT: 'INSULT_MAT'
    });


    const REASON_BY_TYPE = Object.freeze({

        MAT: {
            reasonId:
                'mat-amoral',

            label:
                'Мат/Аморал'
        },


        AMORAL: {
            reasonId:
                'mat-amoral',

            label:
                'Мат/Аморал'
        },


        INSULT: {
            reasonId:
                'player-insult',

            label:
                'Оскорбление игроков'
        },


        INSULT_MAT: {
            reasonId:
                'player-insult-mat',

            label:
                'Оскорбление игроков + Мат'
        }

    });


    /*
     * =========================================================
     * МАТ
     * =========================================================
     *
     * Здесь в основном корни.
     *
     * Scanner сможет ловить:
     *
     * ебать
     * ебаный
     * ебучий
     * ебало
     * ебануть
     *
     * и т.д.
     */


    const MAT = [

        /*
         * ЕБ-
         */

        'еб',
        'ёб',
        'еба',
        'ёба',
        'еби',
        'ёби',
        'ебу',
        'ёбу',
        'ебуч',
        'ебан',
        'ёбан',
        'ебат',
        'ёбат',
        'ебнул',
        'ёбнул',
        'ебнут',
        'ёбнут',
        'ебош',
        'ёбош',
        'ебыр',
        'ебырь',


        /*
         * ХУЙ-
         */

        'хуй',
        'хуя',
        'хуе',
        'хуё',
        'хуи',
        'хуйн',
        'хуёв',
        'хуев',
        'охуе',
        'охуё',
        'ахуе',
        'ахуё',
        'нихуя',
        'нахуя',
        'нахуй',
        'похуй',
        'похую',
        'дохуя',


        /*
         * ПИЗД-
         */

        'пизд',
        'пизда',
        'пиздец',
        'пиздос',
        'пиздан',
        'пизжен',
        'пиздю',
        'пиздят',
        'пиздит',
        'пиздоб',


        /*
         * БЛЯД-
         */

        'бляд',
        'блять',
        'бля',
        'блят',
        'бляди',
        'блядь',


        /*
         * СУКА
         */

        'сука',
        'сучка',
        'сучий',
        'сучара',
        'суки',


        /*
         * ПРОЧЕЕ
         */

        'манда',
        'мандав',
        'мандой',
        'манду',

        'залуп',
        'залупа',

        'мудак',
        'мудила',
        'мудень',

        'говно',
        'говнюк',

        'дерьмо',
        'дерьмов',

        'жопа',
        'жопу',
        'жопой',
        'жопн',

        'срать',
        'срал',
        'сру',
        'срет',
        'срёт',

        'перд',
        'пернул',

        'дроч',
        'драчить',
        'дрочить',

        'трах',
        'трахать',
        'трахнул',


        /*
         * ENGLISH
         */

        'fuck',
        'fucking',
        'fucked',
        'fucker',

        'shit',
        'bullshit',

        'cunt',

        'dick',

        'cock',

        'bitch',

        'asshole',

        'motherfucker',


        /*
         * TRANSLIT
         */

        'ebat',
        'ebatb',
        'eban',
        'ebani',
        'ebanyi',
        'ebuch',
        'eblan',

        'huy',
        'hui',
        'huй',
        'huya',
        'hue',
        'huevo',
        'nahuy',
        'nahui',
        'pohuy',
        'pohui',

        'pizda',
        'pizdec',
        'pizdets',
        'pizd',

        'blyad',
        'blyat',
        'bljad',
        'bljat',

        'suka',

        'mudak',

        'zalupa'

    ];


    /*
     * =========================================================
     * АМОРАЛ
     * =========================================================
     *
     * Само наличие некоторых слов ещё не всегда = нарушение.
     *
     * Поэтому эта категория в дальнейшем должна иметь
     * меньшую уверенность, чем INSULT_MAT.
     */


    const AMORAL = [

        'член',
        'пенис',
        'вагина',
        'вагину',
        'вагиной',

        'сперма',
        'сперму',
        'спермой',

        'кончил',
        'кончить',
        'конча',
        'кончу',

        'минет',
        'отсос',
        'сосать',
        'соси',

        'анал',
        'анальный',

        'секс',
        'трахаться',

        'порно',
        'порнуха',

        'эрекция',

        'голый',
        'голая',
        'голые',

        'сиськи',
        'сисек',
        'соски',

        'титьки',

        'проститутка',
        'шлюха',
        'шлюшка',

        'whore',
        'slut',

        'sex',
        'porn',

        'penis',
        'vagina',
        'cum',
        'sperm',

        'blowjob',
        'handjob'

    ];


    /*
     * =========================================================
     * ОСКОРБЛЕНИЯ БЕЗ ОБЯЗАТЕЛЬНОГО МАТА
     * =========================================================
     */


    const INSULT = [

        'идиот',
        'идиотка',

        'дебил',
        'дебилка',

        'тупой',
        'тупая',
        'тупица',

        'дурак',
        'дура',
        'дурень',

        'кретин',

        'имбецил',

        'даун',

        'аутист',

        'урод',
        'уродина',

        'чмо',

        'мразь',

        'тварь',

        'гнида',

        'крыса',

        'петух',

        'лох',
        'лошара',

        'клоун',

        'дегенерат',

        'ничтожество',

        'ублюдок',

        'отброс',

        'мусор',

        'днище',

        'бездарь',

        'позорище',

        'тормоз',

        'овощ',

        'обезьяна',

        'животное',

        'свинья',

        'свин',

        'пёс',
        'пес',

        'собака',

        'осёл',
        'осел',

        'баран',

        'козёл',
        'козел',

        'придурок',

        'псих',

        'ненормальный',

        'ущербный',

        'жалкий',

        'никчёмный',
        'никчемный',

        'тупоголовый',

        'безмозглый',

        'мозгов нет',

        'iq 0',
        '0 iq',

        'бот',

        'нуб',

        'noob',

        'idiot',

        'moron',

        'retard',

        'loser',

        'clown',

        'trash',

        'garbage'

    ];


    /*
     * =========================================================
     * ОСКОРБЛЕНИЕ + МАТ
     * =========================================================
     *
     * Самая важная категория.
     *
     * Эти слова сами по себе уже несут
     * одновременно оскорбительный и матерный характер.
     */


    const INSULT_MAT = [

        /*
         * ЕБ-
         */

        'долбоеб',
        'долбоёб',
        'далбаеб',
        'далбаёб',
        'долбаеб',
        'долбаёб',

        'еблан',
        'ёблан',

        'ебанат',
        'ёбанат',

        'уебок',
        'уёбок',
        'уебан',
        'уёбан',

        'заебок',

        'ебло',
        'ёбло',

        'еблище',
        'ёблище',

        'ебырь',
        'ёбырь',


        /*
         * ХУЙ-
         */

        'хуесос',
        'хуёсос',

        'хуеплет',
        'хуеплёт',
        'хуёплет',
        'хуёплёт',

        'хуеглот',
        'хуёглот',

        'хуемразь',
        'хуёмразь',

        'хуила',
        'хуйло',

        'хуепут',
        'хуёпут',

        'хуеголовый',
        'хуёголовый',

        'хуемордый',
        'хуёмордый',

        'хуенос',
        'хуёнос',


        /*
         * ПИЗД-
         */

        'пиздабол',
        'пиздобол',

        'пиздюк',

        'пиздюк',

        'пиздёнок',
        'пизденок',

        'пиздолиз',

        'пиздоглаз',

        'пиздорванец',


        /*
         * БЛЯДЬ / ШЛЮХА
         */

        'блядь',
        'блядина',
        'блядюга',
        'блядища',

        'шалава',


        /*
         * ПРОЧЕЕ
         */

        'мудак',
        'мудила',

        'говноед',
        'говноедка',

        'говнюк',

        'гандон',
        'гондон',

        'залупа',

        'залупоглазый',

        'жополиз',

        'жопоголовый',

        'сучара',

        'сучонок',
        'сучёнок',

        'мандавошка',

        'мандавоха',

        'дрочер',

        'дрочила',


        /*
         * ENGLISH
         */

        'fuckface',

        'fuckhead',

        'dickhead',

        'cocksucker',

        'shithead',

        'bastard',

        'cunt',


        /*
         * TRANSLIT
         */

        'dolboeb',
        'dalbaeb',
        'dolbaeb',

        'eblan',

        'ueban',
        'uyoban',
        'uebok',

        'huesos',
        'huyesos',
        'huesos',

        'huilo',
        'huylo',

        'pizdabol',
        'pizdobol',

        'pidar',
        'pidaras',
        'pidor',
        'pidoras',

        'gandon',
        'gondon',

        'mudak'

    ];


    /*
     * =========================================================
     * NORMALIZATION
     * =========================================================
     */


    function normalize(value) {
        const normalizer =
            window.VimeReportTextNormalizer;

        if (
            normalizer &&
            typeof normalizer.normalize === 'function'
        ) {
            try {
                return normalizer.normalize(
                    String(value ?? '')
                );
            } catch (_) {
                // fallback ниже
            }
        }

        return String(
            value ?? ''
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


    function getBuiltInRecognitionAliases() {
        return window.VimeReportRecognitionAliases ?? null;
    }


    function findRecognitionAliasMatches(text) {
        const aliases = getBuiltInRecognitionAliases();

        if (
            !aliases ||
            typeof aliases.findMatches !== 'function'
        ) {
            return [];
        }

        return aliases.findMatches(text);
    }
    /*
 * =========================================================
 * LEARNING STORE CATEGORY MATCHES
 * =========================================================
 *
 * Связывает обученные знания Scanner с классификатором
 * причин.
 *
 * Благодаря этому любое слово / алиас / фраза,
 * обученная модератором как:
 *
 * INSULT
 * MAT
 * AMORAL
 * INSULT_MAT
 *
 * автоматически участвует в рекомендации плиток.
 *
 * Здесь НЕТ хардкода отдельных слов.
 * =========================================================
 */


    function normalizeLearnedCategory(
        category
    ) {

        const value =
            String(
                category ?? ''
            )
                .trim()
                .toUpperCase()
                .replace(
                    /[\s-]+/g,
                    '_'
                );


        /*
         * Основные категории Learning Store.
         */
        if (
            value === 'INSULT' ||
            value === 'PLAYER_INSULT'
        ) {
            return TYPE.INSULT;
        }


        if (
            value === 'INSULT_MAT' ||
            value === 'PLAYER_INSULT_MAT'
        ) {
            return TYPE.INSULT_MAT;
        }


        if (
            value === 'MAT'
        ) {
            return TYPE.MAT;
        }


        if (
            value === 'AMORAL'
        ) {
            return TYPE.AMORAL;
        }


        /*
         * На случай, если в старых данных
         * вместо category сохранился reasonId.
         */
        if (
            value === 'PLAYER_INSULT'
        ) {
            return TYPE.INSULT;
        }


        if (
            value === 'PLAYER_INSULT_MAT'
        ) {
            return TYPE.INSULT_MAT;
        }


        if (
            value === 'MAT_AMORAL'
        ) {
            return TYPE.MAT;
        }


        return null;
    }


    /*
     * Проверяем, является ли запись Learning Store активной.
     */
    function isActiveLearnedEntry(
        entry
    ) {

        if (
            !entry
        ) {
            return false;
        }


        const status =
            String(
                entry.status ?? ''
            )
                .trim()
                .toLowerCase();


        /*
         * Текущая система Scanner использует
         * learned / trusted.
         */
        return (
            status === 'learned' ||
            status === 'trusted'
        );
    }


    /*
     * Совпадение отдельного обученного алиаса.
     *
     * Используем нормализованный текст и границы слова,
     * чтобы алиас не срабатывал внутри случайного слова.
     */
    function learnedAliasMatchesText(
        text,
        entry
    ) {

        const source =
            normalize(
                text
            );


        const alias =
            normalize(
                entry?.normalized ??
                entry?.original ??
                ''
            );


        if (
            !source ||
            !alias
        ) {
            return false;
        }


        const escaped =
            alias.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            );


        const pattern =
            new RegExp(
                `(^|[^a-zа-яё0-9_])(${escaped})(?=$|[^a-zа-яё0-9_])`,
                'i'
            );


        return pattern.test(
            source
        );
    }


    /*
     * Совпадение обученной фразы.
     *
     * Фразы могут состоять из нескольких слов,
     * поэтому здесь работаем с нормализованной строкой.
     */
    function learnedPhraseMatchesText(
        text,
        entry
    ) {

        const source =
            normalize(
                text
            );


        const phrase =
            normalize(
                entry?.normalized ??
                entry?.original ??
                ''
            );


        if (
            !source ||
            !phrase
        ) {
            return false;
        }


        return source.includes(
            phrase
        );
    }


    /*
     * Возвращает ВСЕ обученные категории,
     * присутствующие в конкретном сообщении.
     */
    function findLearningStoreMatches(
        text
    ) {

        const store =
            window.VimeReportLearningStore;


        if (
            !store ||
            store.getStatus?.().ready !== true
        ) {
            return [];
        }


        try {

            const aliases =
                typeof store.findAliases ===
                'function'
                    ? store.findAliases()
                    : [];


            const phrases =
                typeof store.findPhrases ===
                'function'
                    ? store.findPhrases()
                    : [];


            const matches =
                [];


            /*
             * =====================================================
             * LEARNED ALIASES
             * =====================================================
             */

            if (
                Array.isArray(
                    aliases
                )
            ) {

                aliases.forEach(
                    (entry) => {

                        if (
                            !isActiveLearnedEntry(
                                entry
                            )
                        ) {
                            return;
                        }


                        const category =
                            normalizeLearnedCategory(
                                entry.category ??
                                entry.reasonId
                            );


                        if (
                            !category
                        ) {
                            return;
                        }


                        if (
                            !learnedAliasMatchesText(
                                text,
                                entry
                            )
                        ) {
                            return;
                        }


                        matches.push({
                            category,

                            value:
                                entry.original ??
                                entry.normalized ??
                                '',

                            source:
                                'learning-store-alias',

                            id:
                                entry.id ??
                                null
                        });
                    }
                );
            }


            /*
             * =====================================================
             * LEARNED PHRASES
             * =====================================================
             */

            if (
                Array.isArray(
                    phrases
                )
            ) {

                phrases.forEach(
                    (entry) => {

                        if (
                            !isActiveLearnedEntry(
                                entry
                            )
                        ) {
                            return;
                        }


                        const category =
                            normalizeLearnedCategory(
                                entry.category ??
                                entry.reasonId
                            );


                        if (
                            !category
                        ) {
                            return;
                        }


                        if (
                            !learnedPhraseMatchesText(
                                text,
                                entry
                            )
                        ) {
                            return;
                        }


                        matches.push({
                            category,

                            value:
                                entry.original ??
                                entry.normalized ??
                                '',

                            source:
                                'learning-store-phrase',

                            id:
                                entry.id ??
                                null
                        });
                    }
                );
            }


            return matches;

        } catch (error) {

            console.warn(
                '[Vime Report Helper] Violation Rules: Learning Store classification failed:',
                error
            );


            /*
             * Fail-safe:
             * старая классификация продолжает работать.
             */
            return [];
        }
    }


    /*
     * =========================================================
     * UNIQUE
     * =========================================================
     */


    function unique(list) {

        return [
            ...new Set(
                list
                    .map(normalize)
                    .filter(Boolean)
            )
        ];
    }


    const DATABASE =
        Object.freeze({

            MAT:
                unique(MAT),

            AMORAL:
                unique(AMORAL),

            INSULT:
                unique(INSULT),

            INSULT_MAT:
                unique(INSULT_MAT)

        });


    /*
     * =========================================================
     * FIND MATCHES
     * =========================================================
     */


    function findMatches(
        text,
        dictionary
    ) {

        const normalizedText =
            normalize(text);


        if (!normalizedText) {
            return [];
        }


        return dictionary.filter((word) => {
            const normalizedWord =
                normalize(word);

            if (!normalizedWord) {
                return false;
            }

            const escaped =
                normalizedWord.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                );

            const pattern = new RegExp(
                `(^|[^a-zа-яё0-9_])(${escaped})`,
                'i'
            );

            return pattern.test(
                normalizedText
            );
        });
    }


    /*
     * =========================================================
     * CLASSIFY MESSAGE
     * =========================================================
     */


    function classifyMessage(
        text
    ) {

        /*
         * =========================================================
         * ИСТОЧНИКИ ЗНАНИЙ
         * =========================================================
         *
         * 1. Static Violation Rules
         * 2. Built-in Recognition Aliases
         * 3. Learning Store
         *
         * Все источники участвуют в одной классификации.
         * =========================================================
         */


        /*
         * ---------------------------------------------------------
         * STATIC DATABASE
         * ---------------------------------------------------------
         */

        const insultMatMatches =
            findMatches(
                text,
                DATABASE.INSULT_MAT
            );


        const insultMatches =
            findMatches(
                text,
                DATABASE.INSULT
            );


        const matMatches =
            findMatches(
                text,
                DATABASE.MAT
            );


        const amoralMatches =
            findMatches(
                text,
                DATABASE.AMORAL
            );


        /*
         * ---------------------------------------------------------
         * BUILT-IN RECOGNITION KNOWLEDGE
         * ---------------------------------------------------------
         */

        const aliasMatches =
            findRecognitionAliasMatches(
                text
            );


        /*
         * ---------------------------------------------------------
         * LEARNING STORE
         * ---------------------------------------------------------
         */

        const learnedMatches =
            findLearningStoreMatches(
                text
            );


        /*
         * =========================================================
         * CATEGORY HELPERS
         * =========================================================
         */

        const aliasByCategory =
            (category) =>
                aliasMatches.filter(
                    (item) =>
                        normalizeLearnedCategory(
                            item?.category ??
                            item?.reasonId
                        ) ===
                        category
                );


        const learnedByCategory =
            (category) =>
                learnedMatches.filter(
                    (item) =>
                        item.category ===
                        category
                );


        /*
         * =========================================================
         * INSULT + MAT
         * =========================================================
         *
         * Самый высокий приоритет.
         *
         * Срабатывает, если:
         *
         * - есть готовое слово INSULT_MAT;
         * - built-in knowledge сказал INSULT_MAT;
         * - Learning Store сказал INSULT_MAT;
         * - либо в одном сообщении отдельно присутствуют
         *   INSULT и MAT.
         * =========================================================
         */


        const directInsultMat =
            [
                ...insultMatMatches,

                ...aliasByCategory(
                    TYPE.INSULT_MAT
                ),

                ...learnedByCategory(
                    TYPE.INSULT_MAT
                )
            ];


        if (
            directInsultMat.length >
            0
        ) {

            return {
                type:
                TYPE.INSULT_MAT,

                reason:
                REASON_BY_TYPE
                    .INSULT_MAT,

                confidence:
                    'high',

                matches:
                directInsultMat
            };
        }


        /*
         * =========================================================
         * СОБИРАЕМ ВСЕ INSULT
         * =========================================================
         */

        const allInsults =
            [
                ...insultMatches,

                ...aliasByCategory(
                    TYPE.INSULT
                ),

                ...learnedByCategory(
                    TYPE.INSULT
                )
            ];


        /*
         * =========================================================
         * СОБИРАЕМ ВЕСЬ MAT
         * =========================================================
         */

        const allMat =
            [
                ...matMatches,

                ...aliasByCategory(
                    TYPE.MAT
                ),

                ...learnedByCategory(
                    TYPE.MAT
                )
            ];


        /*
         * Оскорбление + отдельный мат
         * в ОДНОМ сообщении.
         */
        if (
            allInsults.length >
            0 &&
            allMat.length >
            0
        ) {

            return {
                type:
                TYPE.INSULT_MAT,

                reason:
                REASON_BY_TYPE
                    .INSULT_MAT,

                confidence:
                    'high',

                matches:
                    [
                        ...allInsults,
                        ...allMat
                    ]
            };
        }


        /*
         * =========================================================
         * ОБЫЧНОЕ ОСКОРБЛЕНИЕ
         * =========================================================
         */

        if (
            allInsults.length >
            0
        ) {

            return {
                type:
                TYPE.INSULT,

                reason:
                REASON_BY_TYPE
                    .INSULT,

                confidence:
                    'medium',

                matches:
                allInsults
            };
        }


        /*
         * =========================================================
         * МАТ
         * =========================================================
         */

        if (
            allMat.length >
            0
        ) {

            return {
                type:
                TYPE.MAT,

                reason:
                REASON_BY_TYPE
                    .MAT,

                confidence:
                    'medium',

                matches:
                allMat
            };
        }


        /*
         * =========================================================
         * AMORAL
         * =========================================================
         */

        const allAmoral =
            [
                ...amoralMatches,

                ...aliasByCategory(
                    TYPE.AMORAL
                ),

                ...learnedByCategory(
                    TYPE.AMORAL
                )
            ];


        if (
            allAmoral.length >
            0
        ) {

            return {
                type:
                TYPE.AMORAL,

                reason:
                REASON_BY_TYPE
                    .AMORAL,

                confidence:
                    'low',

                matches:
                allAmoral
            };
        }


        /*
         * =========================================================
         * COMPACT FALLBACK
         * =========================================================
         *
         * Оставляем существующую защиту от обходов:
         *
         * п - и - з - д - а
         * х . у . й
         * и т.п.
         * =========================================================
         */

        const normalizedForCompact =
            normalize(
                text
            );


        const compactText =
            normalizedForCompact.replace(
                /[^а-яёa-z0-9]+/gi,
                ''
            );


        if (
            compactText.length >=
            3 &&
            compactText !==
            normalizedForCompact
        ) {

            const cInsultMat =
                findMatches(
                    compactText,
                    DATABASE.INSULT_MAT
                );


            if (
                cInsultMat.length >
                0
            ) {

                return {
                    type:
                    TYPE.INSULT_MAT,

                    reason:
                    REASON_BY_TYPE
                        .INSULT_MAT,

                    confidence:
                        'medium',

                    matches:
                    cInsultMat
                };
            }


            const cInsult =
                findMatches(
                    compactText,
                    DATABASE.INSULT
                );


            const cMat =
                findMatches(
                    compactText,
                    DATABASE.MAT
                );


            if (
                cInsult.length >
                0 &&
                cMat.length >
                0
            ) {

                return {
                    type:
                    TYPE.INSULT_MAT,

                    reason:
                    REASON_BY_TYPE
                        .INSULT_MAT,

                    confidence:
                        'medium',

                    matches:
                        [
                            ...cInsult,
                            ...cMat
                        ]
                };
            }


            if (
                cInsult.length >
                0
            ) {

                return {
                    type:
                    TYPE.INSULT,

                    reason:
                    REASON_BY_TYPE
                        .INSULT,

                    confidence:
                        'medium',

                    matches:
                    cInsult
                };
            }


            if (
                cMat.length >
                0
            ) {

                return {
                    type:
                    TYPE.MAT,

                    reason:
                    REASON_BY_TYPE
                        .MAT,

                    confidence:
                        'medium',

                    matches:
                    cMat
                };
            }
        }


        /*
         * =========================================================
         * DIGIT-STRIPPED FALLBACK
         * =========================================================
         *
         * п0-и-з-д-а
         * и похожие обходы.
         * =========================================================
         */

        if (
            /[0-9]/.test(
                text
            )
        ) {

            const digitStripped =
                text.replace(
                    /[0-9]/g,
                    ''
                );


            const normDigitStripped =
                normalize(
                    digitStripped
                );


            if (
                normDigitStripped &&
                normDigitStripped !==
                normalizedForCompact
            ) {

                const dsInsultMat =
                    findMatches(
                        normDigitStripped,
                        DATABASE.INSULT_MAT
                    );


                if (
                    dsInsultMat.length >
                    0
                ) {

                    return {
                        type:
                        TYPE.INSULT_MAT,

                        reason:
                        REASON_BY_TYPE
                            .INSULT_MAT,

                        confidence:
                            'medium',

                        matches:
                        dsInsultMat
                    };
                }


                const dsInsult =
                    findMatches(
                        normDigitStripped,
                        DATABASE.INSULT
                    );


                const dsMat =
                    findMatches(
                        normDigitStripped,
                        DATABASE.MAT
                    );


                if (
                    dsInsult.length >
                    0 &&
                    dsMat.length >
                    0
                ) {

                    return {
                        type:
                        TYPE.INSULT_MAT,

                        reason:
                        REASON_BY_TYPE
                            .INSULT_MAT,

                        confidence:
                            'medium',

                        matches:
                            [
                                ...dsInsult,
                                ...dsMat
                            ]
                    };
                }


                if (
                    dsInsult.length >
                    0
                ) {

                    return {
                        type:
                        TYPE.INSULT,

                        reason:
                        REASON_BY_TYPE
                            .INSULT,

                        confidence:
                            'medium',

                        matches:
                        dsInsult
                    };
                }


                if (
                    dsMat.length >
                    0
                ) {

                    return {
                        type:
                        TYPE.MAT,

                        reason:
                        REASON_BY_TYPE
                            .MAT,

                        confidence:
                            'medium',

                        matches:
                        dsMat
                    };
                }
            }
        }


        return null;
    }


    /*
     * =========================================================
     * CLASSIFY REPORT
     * =========================================================
     */


    function classifyReport(
        messages
    ) {

        if (
            !Array.isArray(
                messages
            )
        ) {
            return [];
        }


        const classifications =
            [];


        messages.forEach(
            (message) => {

                const classification =
                    classifyMessage(
                        message?.text
                    );


                if (
                    !classification
                ) {
                    return;
                }


                classifications.push({
                    messageIndex:
                    message.index,

                    time:
                    message.time,

                    text:
                    message.text,

                    ...classification
                });
            }
        );


        return classifications;
    }


    /*
     * =========================================================
     * GET RECOMMENDED REASONS
     * =========================================================
     */


    /*
 * =========================================================
 * GET RECOMMENDED REASONS
 * =========================================================
 *
 * Собирает ВСЕ категории нарушений,
 * найденные в репорте.
 *
 * Важно:
 *
 * player-insult-mat НЕ должен удалять
 * player-insult или mat-amoral из других сообщений.
 *
 * Пример:
 *
 * "Бомж"
 *      -> player-insult
 *
 * "ты бомж ебаный"
 *      -> player-insult-mat
 *
 * "ебать"
 *      -> mat-amoral
 *
 * Все три рекомендации могут существовать
 * одновременно.
 * =========================================================
 */

    function getRecommendedReasons(
        messages
    ) {

        const classifications =
            classifyReport(
                messages
            );


        const recommendations =
            new Map();


        classifications.forEach(
            (classification) => {

                const reason =
                    classification.reason;


                if (
                    !reason ||
                    !reason.reasonId
                ) {
                    return;
                }


                const existing =
                    recommendations.get(
                        reason.reasonId
                    );


                /*
                 * Первая классификация
                 * этого типа нарушения.
                 */
                if (
                    !existing
                ) {

                    recommendations.set(
                        reason.reasonId,
                        {
                            reasonId:
                            reason.reasonId,

                            label:
                            reason.label,

                            count:
                                1,

                            examples:
                                [
                                    classification
                                ]
                        }
                    );


                    return;
                }


                /*
                 * Такая категория уже была найдена
                 * в другом сообщении.
                 */
                existing.count++;


                /*
                 * Храним максимум три примера,
                 * чтобы не раздувать объект.
                 */
                if (
                    existing.examples.length <
                    3
                ) {

                    existing.examples.push(
                        classification
                    );
                }
            }
        );


        /*
         * НИЧЕГО здесь не удаляем.
         *
         * Если в разных сообщениях присутствуют:
         *
         * - Мат/Аморал
         * - Оскорбление игроков
         * - Оскорбление игроков + Мат
         *
         * все соответствующие плитки должны
         * получить рекомендации.
         */


        return [
            ...recommendations.values()
        ];
    }


    /*
     * =========================================================
     * EXPORT
     * =========================================================
     */


    window.VimeReportViolationRules = {

        TYPE,

        DATABASE,

        REASON_BY_TYPE,

        normalize,

        classifyMessage,

        classifyReport,

        getRecommendedReasons

    };


    console.log(
        '[Vime Report Helper] Violation Rules loaded:',
        {
            MAT:
            DATABASE.MAT.length,

            AMORAL:
            DATABASE.AMORAL.length,

            INSULT:
            DATABASE.INSULT.length,

            INSULT_MAT:
            DATABASE
                .INSULT_MAT
                .length
        }
    );

})();