(() => {
    'use strict';


    class VimeReportRelativeContextDetector {

        constructor() {
            this.rules =
                window.VimeReportRelativeContextRules ?? null;
        }


        /* =====================================================
           RULES
           ===================================================== */

        getRules() {
            return (
                this.rules ??
                window.VimeReportRelativeContextRules ??
                null
            );
        }


        /* =====================================================
           NORMALIZATION
           ===================================================== */

        normalizeText(
            text
        ) {
            return String(text ?? '')
                .toLowerCase()
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }


        normalizeToken(
            token
        ) {
            return String(token ?? '')
                .toLowerCase()
                .replace(
                    /^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi,
                    ''
                )
                .trim();
        }


        tokenize(
            text
        ) {
            const source =
                String(text ?? '');


            const regex =
                /[a-zа-яё0-9]+/gi;


            const tokens = [];

            let match;


            while (
                (
                    match =
                        regex.exec(source)
                ) !== null
                ) {
                const value =
                    this.normalizeToken(
                        match[0]
                    );


                if (!value) {
                    continue;
                }


                tokens.push({
                    value,

                    raw:
                        match[0],

                    index:
                    match.index,

                    length:
                    match[0].length
                });
            }


            return tokens;
        }


        /* =====================================================
           RELATIVE TERMS
           ===================================================== */

        buildRelativeIndex() {
            const rules =
                this.getRules();


            const index =
                new Map();


            if (
                !rules?.relativeTerms
            ) {
                return index;
            }


            Object.entries(
                rules.relativeTerms
            ).forEach(
                ([
                     type,
                     forms
                 ]) => {

                    if (
                        !Array.isArray(
                            forms
                        )
                    ) {
                        return;
                    }


                    forms.forEach(
                        (form) => {

                            const normalized =
                                this.normalizeText(
                                    form
                                );


                            if (!normalized) {
                                return;
                            }


                            index.set(
                                normalized,
                                type
                            );
                        }
                    );
                }
            );


            return index;
        }


        findRelativeTerms(
            text
        ) {
            const index =
                this.buildRelativeIndex();


            const tokens =
                this.tokenize(
                    text
                );


            const matches = [];


            tokens.forEach(
                (
                    token,
                    tokenIndex
                ) => {

                    const type =
                        index.get(
                            token.value
                        );


                    if (!type) {
                        return;
                    }


                    matches.push({
                        type,

                        value:
                        token.value,

                        raw:
                        token.raw,

                        tokenIndex,

                        index:
                        token.index,

                        length:
                        token.length
                    });
                }
            );


            return {
                tokens,
                matches
            };
        }


        /* =====================================================
           MARKERS
           ===================================================== */

        normalizeMarkerList(
            markers
        ) {
            if (
                !Array.isArray(
                    markers
                )
            ) {
                return [];
            }


            return markers
                .map(
                    (value) =>
                        this.normalizeText(
                            value
                        )
                )
                .filter(Boolean);
        }


        getMarkerMatches(
            text,
            markerList
        ) {
            const normalizedText =
                this.normalizeText(
                    text
                );


            const matches = [];


            markerList.forEach(
                (marker) => {

                    if (
                        !marker ||
                        !normalizedText.includes(
                            marker
                        )
                    ) {
                        return;
                    }


                    matches.push(
                        marker
                    );
                }
            );


            return matches;
        }


        /* =====================================================
           TARGET RESOLUTION
           ===================================================== */

        resolveTarget(
            text,
            relativeMatch
        ) {
            const rules =
                this.getRules();


            const targetMarkers =
                this.normalizeMarkerList(
                    rules?.targetMarkers
                );


            const selfMarkers =
                this.normalizeMarkerList(
                    rules?.selfMarkers
                );


            const normalizedText =
                this.normalizeText(
                    text
                );


            const relativeText =
                relativeMatch?.value;


            if (!relativeText) {
                return {
                    target:
                        'unknown',

                    confidence:
                        'low',

                    markers:
                        []
                };
            }


            const relativePos =
                normalizedText.indexOf(
                    relativeText
                );


            if (
                relativePos === -1
            ) {
                return {
                    target:
                        'unknown',

                    confidence:
                        'low',

                    markers:
                        []
                };
            }


            const left =
                normalizedText.slice(
                    Math.max(
                        0,
                        relativePos - 45
                    ),
                    relativePos
                );


            const right =
                normalizedText.slice(
                    relativePos +
                    relativeText.length,
                    relativePos +
                    relativeText.length +
                    45
                );


            const localContext =
                `${left} ${right}`;


            const foundSelf =
                selfMarkers.filter(
                    (marker) =>
                        localContext.includes(
                            marker
                        )
                );


            if (
                foundSelf.length
            ) {
                return {
                    target:
                        'self',

                    confidence:
                        'high',

                    markers:
                    foundSelf
                };
            }


            const foundTarget =
                targetMarkers.filter(
                    (marker) =>
                        localContext.includes(
                            marker
                        )
                );


            if (
                foundTarget.length
            ) {

                const thirdPerson =
                    foundTarget.some(
                        (marker) =>
                            marker === 'его' ||
                            marker === 'ему' ||
                            marker === 'у него' ||
                            marker === 'её' ||
                            marker === 'ее' ||
                            marker === 'ей' ||
                            marker === 'у неё' ||
                            marker === 'у нее' ||
                            marker === 'их' ||
                            marker === 'у них'
                    );


                return {
                    target:
                        thirdPerson
                            ? 'third-person'
                            : 'other',

                    confidence:
                        'high',

                    markers:
                    foundTarget
                };
            }


            /*
             * Особые конструкции:
             *
             * мама твоя
             * папа твой
             * сестра твоя
             */

            const afterPattern =
                new RegExp(
                    `${this.escapeRegExp(relativeText)}\\s+(твой|твоя|твои|твою|твоего|твоей)`,
                    'i'
                );


            if (
                afterPattern.test(
                    normalizedText
                )
            ) {
                return {
                    target:
                        'other',

                    confidence:
                        'high',

                    markers: [
                        'post-relative-possessive'
                    ]
                };
            }


            return {
                target:
                    'unknown',

                confidence:
                    'low',

                markers:
                    []
            };
        }


        escapeRegExp(
            text
        ) {
            return String(text ?? '')
                .replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                );
        }


        /* =====================================================
           CONTEXT WINDOW
           ===================================================== */

        getContextWindow(
            tokens,
            tokenIndex
        ) {
            const rules =
                this.getRules();


            const radius =
                Number(
                    rules
                        ?.config
                        ?.contextRadius
                ) || 5;


            const start =
                Math.max(
                    0,
                    tokenIndex - radius
                );


            const end =
                Math.min(
                    tokens.length,
                    tokenIndex + radius + 1
                );


            return tokens
                .slice(
                    start,
                    end
                )
                .map(
                    (token) =>
                        token.raw
                );
        }


        /* =====================================================
           AMBIGUOUS RELATIVE WORDS
           ===================================================== */

        isAmbiguousRelative(
            type,
            value
        ) {
            const ambiguous =
                new Set([
                    'брат',
                    'братишка',
                    'братуха',
                    'братец',

                    'батя',
                    'батек',
                    'батёк'
                ]);


            return (
                    type === 'brother' ||
                    type === 'father'
                ) &&
                ambiguous.has(
                    value
                );
        }


        shouldAcceptAmbiguousRelative(
            text,
            match,
            targetInfo
        ) {
            if (
                !this.isAmbiguousRelative(
                    match.type,
                    match.value
                )
            ) {
                return true;
            }


            /*
             * Для "брат", "батя" и подобных
             * без target marker считаем контекст
             * слишком неопределённым.
             *
             * "братан ты где" -> не родственник
             * "твой брат" -> родственник
             */

            return (
                targetInfo.target !==
                'unknown'
            );
        }


        /* =====================================================
           PARENT IMPLICATION
           ===================================================== */

        detectParentImplication(
            text
        ) {
            const normalized =
                this.normalizeText(
                    text
                );


            const tokens =
                this.tokenize(
                    normalized
                );


            const childWords =
                new Set([
                    'сын',
                    'сына',
                    'сынок',
                    'сынка',
                    'сыночек',

                    'дочь',
                    'дочка',
                    'дочки',
                    'доченька'
                ]);


            const results = [];


            tokens.forEach(
                (
                    token,
                    index
                ) => {

                    if (
                        !childWords.has(
                            token.value
                        )
                    ) {
                        return;
                    }


                    const next =
                        tokens[
                        index + 1
                            ];


                    if (!next) {
                        return;
                    }


                    /*
                     * Пока мы НЕ определяем,
                     * является ли второе слово оскорблением.
                     *
                     * Мы только фиксируем потенциальную
                     * parent implication конструкцию:
                     *
                     * сын дуры
                     * сын пидора
                     * дочь ...
                     *
                     * В следующем слое Relative Abuse Engine
                     * второе слово будет проверяться
                     * по отдельному словарю.
                     */

                    results.push({
                        detected:
                            true,

                        type:
                            'parent-implication',

                        childType:
                            token.value.startsWith(
                                'доч'
                            )
                                ? 'daughter'
                                : 'son',

                        childText:
                        token.raw,

                        candidateText:
                        next.raw,

                        candidateNormalized:
                        next.value,

                        startIndex:
                        token.index,

                        endIndex:
                            next.index +
                            next.length,

                        confidence:
                            'pending-abuse-validation'
                    });
                }
            );


            return results;
        }


        /* =====================================================
           ANALYZE MESSAGE
           ===================================================== */

        analyzeMessage(
            message
        ) {
            if (
                !message ||
                typeof message.text !==
                'string'
            ) {
                return {
                    detected:
                        false,

                    relatives:
                        [],

                    parentImplications:
                        []
                };
            }


            const text =
                message.text;


            const {
                tokens,
                matches
            } =
                this.findRelativeTerms(
                    text
                );


            const relatives = [];


            matches.forEach(
                (match) => {

                    const targetInfo =
                        this.resolveTarget(
                            text,
                            match
                        );


                    if (
                        !this.shouldAcceptAmbiguousRelative(
                            text,
                            match,
                            targetInfo
                        )
                    ) {
                        return;
                    }


                    relatives.push({
                        detected:
                            true,

                        relativeType:
                        match.type,

                        relativeText:
                        match.raw,

                        normalizedRelative:
                        match.value,

                        target:
                        targetInfo.target,

                        confidence:
                        targetInfo.confidence,

                        markers:
                        targetInfo.markers,

                        contextWords:
                            this.getContextWindow(
                                tokens,
                                match.tokenIndex
                            ),

                        index:
                        match.index,

                        length:
                        match.length
                    });
                }
            );


            const parentImplications =
                this.detectParentImplication(
                    text
                );


            return {
                detected:
                    relatives.length > 0 ||
                    parentImplications.length > 0,

                messageIndex:
                message.index,

                time:
                message.time,

                text,

                relatives,

                parentImplications
            };
        }


        /* =====================================================
           ANALYZE REPORT
           ===================================================== */

        analyzeReport(
            messages
        ) {
            if (
                !Array.isArray(
                    messages
                )
            ) {
                return [];
            }


            return messages
                .map(
                    (message) =>
                        this.analyzeMessage(
                            message
                        )
                )
                .filter(
                    (result) =>
                        result.detected
                );
        }
    }


    window.VimeReportRelativeContextDetector =
        new VimeReportRelativeContextDetector();


    console.log(
        '[Vime Report Helper] Relative Context Detector loaded.'
    );

})();