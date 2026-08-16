(() => {
    'use strict';


    class VimeReportRelativeAbuseDetector {

        constructor() {
            this.lastResults = [];
        }


        /* =====================================================
           DEPENDENCIES
           ===================================================== */

        getRules() {
            return (
                window.VimeReportRelativeAbuseRules ??
                null
            );
        }


        getContextDetector() {
            return (
                window.VimeReportRelativeContextDetector ??
                null
            );
        }


        /* =====================================================
           NORMALIZATION
           ===================================================== */

        normalizeToken(
            value
        ) {
            return String(value ?? '')
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


            const result = [];

            let match;


            while (
                (
                    match =
                        regex.exec(source)
                ) !== null
                ) {
                const normalized =
                    this.normalizeToken(
                        match[0]
                    );


                if (!normalized) {
                    continue;
                }


                result.push({
                    value:
                    normalized,

                    raw:
                        match[0],

                    index:
                    match.index,

                    length:
                    match[0].length
                });
            }


            return result;
        }


        normalizeList(
            list
        ) {
            if (
                !Array.isArray(
                    list
                )
            ) {
                return [];
            }


            return list
                .map(
                    (item) =>
                        this.normalizeToken(
                            item
                        )
                )
                .filter(Boolean);
        }


        /* =====================================================
           LOCAL CONTEXT
           ===================================================== */

        findTokenIndexByCharacterIndex(
            tokens,
            characterIndex
        ) {
            return tokens.findIndex(
                (token) =>
                    characterIndex >=
                    token.index &&
                    characterIndex <
                    token.index +
                    token.length
            );
        }


        getContextTokens(
            text,
            relativeIndex
        ) {
            const tokens =
                this.tokenize(
                    text
                );


            const tokenIndex =
                this.findTokenIndexByCharacterIndex(
                    tokens,
                    relativeIndex
                );


            if (
                tokenIndex === -1
            ) {
                return {
                    tokens: [],
                    tokenIndex:
                        -1
                };
            }


            const radius =
                Number(
                    this.getRules()
                        ?.config
                        ?.abuseRadius
                ) || 6;


            const start =
                Math.max(
                    0,
                    tokenIndex - radius
                );


            const end =
                Math.min(
                    tokens.length,
                    tokenIndex +
                    radius +
                    1
                );


            return {
                tokens:
                    tokens.slice(
                        start,
                        end
                    ),

                tokenIndex
            };
        }


        /* =====================================================
           EXACT RELATIVE ABUSE
           ===================================================== */

        findUniversalAbuse(
            text,
            relativeIndex
        ) {
            const context =
                this.getContextTokens(
                    text,
                    relativeIndex
                );


            const terms =
                this.normalizeList(
                    this.getRules()
                        ?.universalTerms
                );


            for (
                const token
                of context.tokens
                ) {
                if (
                    terms.includes(
                        token.value
                    )
                ) {
                    return {
                        type:
                            'exact-relative-abuse',

                        text:
                        token.raw,

                        normalized:
                        token.value,

                        index:
                        token.index,

                        length:
                        token.length,

                        confidence:
                            'high'
                    };
                }
            }


            return null;
        }


        /* =====================================================
           CONTEXT ACTION ANALYSIS
           ===================================================== */

        findContextAction(
            text,
            relativeIndex
        ) {
            const context =
                this.getContextTokens(
                    text,
                    relativeIndex
                );


            const actionTerms =
                this.normalizeList(
                    this.getRules()
                        ?.contextActionTerms
                );


            const signals =
                context.tokens.filter(
                    (token) =>
                        actionTerms.includes(
                            token.value
                        )
                );


            if (
                !signals.length
            ) {
                return null;
            }


            const combinations =
                this.getRules()
                    ?.strongContextCombinations ??
                [];


            let strong =
                false;


            for (
                const combination
                of combinations
                ) {
                const normalizedCombination =
                    this.normalizeList(
                        combination
                    );


                const present =
                    normalizedCombination.every(
                        (required) =>
                            signals.some(
                                (signal) =>
                                    signal.value ===
                                    required
                            )
                    );


                if (present) {
                    strong =
                        true;

                    break;
                }
            }


            const first =
                signals[0];


            const last =
                signals[
                signals.length - 1
                    ];


            return {
                type:
                    'relative-context-action',

                signals:
                    signals.map(
                        (signal) =>
                            signal.value
                    ),

                text:
                    signals
                        .map(
                            (signal) =>
                                signal.raw
                        )
                        .join(' '),

                index:
                first.index,

                length:
                    (
                        last.index +
                        last.length
                    ) -
                    first.index,

                confidence:
                    strong
                        ? 'high'
                        : 'medium'
            };
        }


        /* =====================================================
           DIRECT RELATIVE ABUSE
           ===================================================== */

        detectDirectRelative(
            message,
            contextResult
        ) {
            const results = [];


            if (
                !Array.isArray(
                    contextResult?.relatives
                )
            ) {
                return results;
            }


            contextResult.relatives.forEach(
                (relative) => {

                    /*
                     * UNKNOWN не принимаем.
                     *
                     * 'self', 'other', 'third-person' — все
                     * принимаем, потому что оскорбление
                     * родственника является нарушением вне
                     * зависимости от того, чей это родственник.
                     *
                     * "моя мама тупая" → нарушение (self).
                     * "твоя мама тупая" → нарушение (other).
                     * "его мама тупая" → нарушение (third-person).
                     */
                    if (
                        relative.target !==
                        'self' &&
                        relative.target !==
                        'other' &&
                        relative.target !==
                        'third-person'
                    ) {
                        return;
                    }


                    const exact =
                        this.findUniversalAbuse(
                            message.text,
                            relative.index
                        );


                    const contextual =
                        this.findContextAction(
                            message.text,
                            relative.index
                        );


                    /*
                     * Если есть обычное оскорбление —
                     * оно приоритетнее.
                     *
                     * Иначе используем контекстное действие.
                     */
                    const abuse =
                        exact ??
                        contextual;


                    if (!abuse) {
                        return;
                    }


                    results.push({
                        detected:
                            true,

                        source:
                            'direct-relative',

                        relativeType:
                        relative.relativeType,

                        relativeText:
                        relative.relativeText,

                        target:
                        relative.target,

                        abuseType:
                        abuse.type,

                        abuseText:
                        abuse.text,

                        abuseSignals:
                            abuse.signals ??
                            [],

                        messageIndex:
                        message.index,

                        time:
                        message.time,

                        text:
                        message.text,

                        relativeIndex:
                        relative.index,

                        relativeLength:
                        relative.length,

                        abuseIndex:
                        abuse.index,

                        abuseLength:
                        abuse.length,

                        confidence:
                            (
                                relative.confidence ===
                                'high' &&
                                abuse.confidence ===
                                'high'
                            )
                                ? 'high'
                                : 'medium',

                        priority:
                            this.getRules()
                                ?.config
                                ?.priority ??
                            100
                    });
                }
            );


            return results;
        }


        /* =====================================================
           CHILD → PARENT IMPLICATION
           ===================================================== */

        detectParentImplication(
            message
        ) {
            const tokens =
                this.tokenize(
                    message.text
                );


            const childTerms =
                this.normalizeList(
                    this.getRules()
                        ?.childReferenceTerms
                );


            const motherTerms =
                this.normalizeList(
                    this.getRules()
                        ?.motherTerms
                );


            const fatherTerms =
                this.normalizeList(
                    this.getRules()
                        ?.fatherTerms
                );


            const universalTerms =
                this.normalizeList(
                    this.getRules()
                        ?.universalTerms
                );


            const maxDistance =
                Number(
                    this.getRules()
                        ?.config
                        ?.parentImplicationDistance
                ) || 3;


            const results = [];


            tokens.forEach(
                (
                    childToken,
                    childIndex
                ) => {

                    if (
                        !childTerms.includes(
                            childToken.value
                        )
                    ) {
                        return;
                    }


                    const candidates =
                        tokens.slice(
                            childIndex + 1,
                            childIndex + 1 +
                            maxDistance
                        );


                    for (
                        const candidate
                        of candidates
                        ) {
                        let relativeType =
                            null;


                        if (
                            motherTerms.includes(
                                candidate.value
                            )
                        ) {
                            relativeType =
                                'mother';
                        } else if (
                            fatherTerms.includes(
                                candidate.value
                            )
                        ) {
                            relativeType =
                                'father';
                        } else if (
                            universalTerms.includes(
                                candidate.value
                            )
                        ) {
                            relativeType =
                                'unknown-parent';
                        }


                        if (!relativeType) {
                            continue;
                        }


                        results.push({
                            detected:
                                true,

                            source:
                                'parent-implication',

                            relativeType,

                            relativeText:
                            childToken.raw,

                            sourceRelative:
                            childToken.value,

                            target:
                                'other',

                            abuseType:
                                'parent-implication',

                            abuseText:
                            candidate.raw,

                            abuseSignals:
                                [
                                    candidate.value
                                ],

                            messageIndex:
                            message.index,

                            time:
                            message.time,

                            text:
                            message.text,

                            relativeIndex:
                            childToken.index,

                            relativeLength:
                            childToken.length,

                            abuseIndex:
                            candidate.index,

                            abuseLength:
                            candidate.length,

                            confidence:
                                relativeType ===
                                'unknown-parent'
                                    ? 'medium'
                                    : 'high',

                            priority:
                                this.getRules()
                                    ?.config
                                    ?.priority ??
                                100
                        });


                        break;
                    }
                }
            );


            return results;
        }


        /* =====================================================
           DEDUPLICATION
           ===================================================== */

        deduplicate(
            results
        ) {
            const unique = [];


            results.forEach(
                (result) => {

                    const duplicate =
                        unique.some(
                            (existing) =>
                                existing.messageIndex ===
                                result.messageIndex &&
                                existing.relativeIndex ===
                                result.relativeIndex &&
                                existing.abuseIndex ===
                                result.abuseIndex &&
                                existing.source ===
                                result.source
                        );


                    if (!duplicate) {
                        unique.push(
                            result
                        );
                    }
                }
            );


            return unique;
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
                return [];
            }


            const contextDetector =
                this.getContextDetector();


            if (
                !contextDetector ||
                typeof contextDetector
                    .analyzeMessage !==
                'function'
            ) {
                return [];
            }


            const contextResult =
                contextDetector.analyzeMessage(
                    message
                );


            const results = [];


            if (
                contextResult?.detected
            ) {
                results.push(
                    ...this.detectDirectRelative(
                        message,
                        contextResult
                    )
                );
            }


            /*
             * Работает независимо от прямого
             * упоминания "мама/папа".
             */
            results.push(
                ...this.detectParentImplication(
                    message
                )
            );


            return this.deduplicate(
                results
            );
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
                this.lastResults =
                    [];

                return [];
            }


            const results = [];


            messages.forEach(
                (message) => {

                    results.push(
                        ...this.analyzeMessage(
                            message
                        )
                    );
                }
            );


            this.lastResults =
                this.deduplicate(
                    results
                );


            return [
                ...this.lastResults
            ];
        }


        getLastResults() {
            return [
                ...this.lastResults
            ];
        }


        clear() {
            this.lastResults = [];
        }
    }


    window.VimeReportRelativeAbuseDetector =
        new VimeReportRelativeAbuseDetector();


    console.log(
        '[Vime Report Helper] Relative Abuse Detector v3 loaded.'
    );

})();