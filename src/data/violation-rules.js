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


    function classifyMessage(text) {

        /*
         * Сначала проверяем наиболее специфичную категорию.
         */

        const insultMatMatches =
            findMatches(
                text,
                DATABASE.INSULT_MAT
            );


        if (
            insultMatMatches.length >
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
                insultMatMatches
            };
        }


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


        /*
         * Если в одном сообщении есть
         * отдельное оскорбление + отдельный мат,
         *
         * это тоже:
         *
         * Оскорбление игроков + Мат.
         */

        if (
            insultMatches.length >
            0 &&
            matMatches.length >
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

                matches: [
                    ...insultMatches,
                    ...matMatches
                ]
            };
        }


        if (
            insultMatches.length >
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
                insultMatches
            };
        }


        if (
            matMatches.length >
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
                matMatches
            };
        }


        const amoralMatches =
            findMatches(
                text,
                DATABASE.AMORAL
            );


        if (
            amoralMatches.length >
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
                amoralMatches
            };
        }


        const aliasMatches =
            findRecognitionAliasMatches(
                text
            );


        if (
            aliasMatches.length > 0
        ) {

            const matchByPriority =
                aliasMatches.find(
                    (item) =>
                        item.category === 'INSULT_MAT'
                ) ||
                aliasMatches.find(
                    (item) =>
                        item.category === 'INSULT'
                ) ||
                aliasMatches.find(
                    (item) =>
                        item.category === 'MAT'
                ) ||
                aliasMatches[0];


            if (matchByPriority) {
                const reason =
                    matchByPriority.category === 'INSULT_MAT'
                        ? REASON_BY_TYPE.INSULT_MAT
                        : matchByPriority.category === 'INSULT'
                            ? REASON_BY_TYPE.INSULT
                            : REASON_BY_TYPE.MAT;

                return {
                    type:
                        matchByPriority.category === 'INSULT_MAT'
                            ? TYPE.INSULT_MAT
                            : matchByPriority.category === 'INSULT'
                                ? TYPE.INSULT
                                : TYPE.MAT,

                    reason,

                    confidence:
                        typeof matchByPriority.confidence === 'number' &&
                        matchByPriority.confidence >= 0.95
                            ? 'high'
                            : typeof matchByPriority.confidence === 'number' &&
                              matchByPriority.confidence >= 0.85
                                ? 'medium'
                                : 'low',

                    matches:
                        aliasMatches.map(
                            (item) => item.alias || item.canonical
                        )
                };
            }
        }


        /*
         * Compact-key fallback.
         *
         * Covers multi-char or inconsistent separator patterns that
         * _normalizeSepsStr cannot collapse via its backreference rule:
         *   "п - и - з - д - а" → "пизда"
         *   "х . у . й"         → "хуй"
         *   "п  и  з  д  а"     → "пизда"  (double-space)
         *
         * Safety guards:
         *   1. Only triggers when non-letter chars were actually
         *      stripped (compact ≠ normalized), so plain text skips
         *      this path entirely.
         *   2. Minimum compact length 3 — avoids single-char noise.
         *   3. findMatches uses word-boundary prefix pattern, so a
         *      prohibited root must appear at the start of the compact
         *      string or after a non-word char — concatenated word
         *      runs where a prohibited root lands mid-interior are
         *      not matched.
         */
        const normalizedForCompact =
            normalize(text);

        const compactText =
            normalizedForCompact.replace(
                /[^а-яёa-z0-9]+/gi,
                ''
            );

        if (
            compactText.length >= 3 &&
            compactText !== normalizedForCompact
        ) {

            const cInsultMat =
                findMatches(compactText, DATABASE.INSULT_MAT);

            if (cInsultMat.length > 0) {
                return {
                    type:       TYPE.INSULT_MAT,
                    reason:     REASON_BY_TYPE.INSULT_MAT,
                    confidence: 'medium',
                    matches:    cInsultMat
                };
            }

            const cInsult = findMatches(compactText, DATABASE.INSULT);
            const cMat    = findMatches(compactText, DATABASE.MAT);

            if (cInsult.length > 0 && cMat.length > 0) {
                return {
                    type:       TYPE.INSULT_MAT,
                    reason:     REASON_BY_TYPE.INSULT_MAT,
                    confidence: 'medium',
                    matches:    [...cInsult, ...cMat]
                };
            }

            if (cInsult.length > 0) {
                return {
                    type:       TYPE.INSULT,
                    reason:     REASON_BY_TYPE.INSULT,
                    confidence: 'medium',
                    matches:    cInsult
                };
            }

            if (cMat.length > 0) {
                return {
                    type:       TYPE.MAT,
                    reason:     REASON_BY_TYPE.MAT,
                    confidence: 'medium',
                    matches:    cMat
                };
            }
        }

        // Digit-stripped variant: digits used as noise separators between letters
        // (e.g. "п0-и-з-д-а"). The LOOKALIKE_MAP converts some digits to Cyrillic
        // letters (0→о, 1→и, 3→з) before separator collapse, which corrupts the
        // reconstructed form. Stripping digits first and re-normalizing produces the
        // clean candidate. Only triggers when digits are present AND stripping changes
        // the normalized form (guards against ordinary numbered messages).
        if (/[0-9]/.test(text)) {
            const digitStripped     = text.replace(/[0-9]/g, '');
            const normDigitStripped = normalize(digitStripped);

            if (normDigitStripped && normDigitStripped !== normalizedForCompact) {
                const dsInsultMat = findMatches(normDigitStripped, DATABASE.INSULT_MAT);
                if (dsInsultMat.length > 0) {
                    return { type: TYPE.INSULT_MAT, reason: REASON_BY_TYPE.INSULT_MAT, confidence: 'medium', matches: dsInsultMat };
                }

                const dsInsult = findMatches(normDigitStripped, DATABASE.INSULT);
                const dsMat    = findMatches(normDigitStripped, DATABASE.MAT);

                if (dsInsult.length > 0 && dsMat.length > 0) {
                    return { type: TYPE.INSULT_MAT, reason: REASON_BY_TYPE.INSULT_MAT, confidence: 'medium', matches: [...dsInsult, ...dsMat] };
                }
                if (dsInsult.length > 0) {
                    return { type: TYPE.INSULT, reason: REASON_BY_TYPE.INSULT, confidence: 'medium', matches: dsInsult };
                }
                if (dsMat.length > 0) {
                    return { type: TYPE.MAT, reason: REASON_BY_TYPE.MAT, confidence: 'medium', matches: dsMat };
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


                if (!reason) {
                    return;
                }


                const existing =
                    recommendations.get(
                        reason.reasonId
                    );


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

                            examples: [
                                classification
                            ]
                        }
                    );


                    return;
                }


                existing.count++;


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
         * Если есть:
         *
         * Оскорбление игроков + Мат
         *
         * отдельные:
         *
         * Мат/Аморал
         * Оскорбление игроков
         *
         * уже не нужны как основная рекомендация.
         */

        if (
            recommendations.has(
                'player-insult-mat'
            )
        ) {

            recommendations.delete(
                'player-insult'
            );


            recommendations.delete(
                'mat-amoral'
            );
        }


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