(() => {
    'use strict';


    class VimeReportRelativeAbuseIntegration {

        constructor() {
            this.installed =
                false;

            this.relativeResults =
                [];
        }


        /* =====================================================
           DEPENDENCIES
           ===================================================== */

        getScanner() {
            return (
                window.VimeReportViolationScanner ??
                null
            );
        }


        getDetector() {
            return (
                window.VimeReportRelativeAbuseDetector ??
                null
            );
        }


        getHighlighter() {
            return (
                window.VimeReportRelativeAbuseHighlighter ??
                null
            );
        }


        /* =====================================================
           REASON BUTTON
           ===================================================== */

        findRelativeReasonButton() {
            const buttons =
                document.querySelectorAll(
                    '[data-reason-id]'
                );


            for (
                const button
                of buttons
                ) {
                const label =
                    String(
                        button.textContent ??
                        ''
                    )
                        .replace(
                            /\s+/g,
                            ' '
                        )
                        .trim();


                /*
                 * Используем includes, а не строгое ===,
                 * потому что внутри плитки может позже
                 * появляться counter / badge.
                 */
                if (
                    label.includes(
                        'Оскорбление родственников'
                    )
                ) {
                    return button;
                }
            }


            return null;
        }


        clearRecommendation() {
            const button =
                this.findRelativeReasonButton();


            if (!button) {
                return;
            }


            button.classList.remove(
                'vrh-reason--relative-recommended'
            );


            button.removeAttribute(
                'data-vrh-relative-count'
            );


            if (
                button.dataset
                    .vrhRelativeOwnedTitle ===
                'true'
            ) {
                button.removeAttribute(
                    'title'
                );


                delete button.dataset
                    .vrhRelativeOwnedTitle;
            }
        }


        applyRecommendation(
            results,
            attempt = 0
        ) {
            if (
                !Array.isArray(
                    results
                ) ||
                !results.length
            ) {
                this.clearRecommendation();

                return;
            }


            const button =
                this.findRelativeReasonButton();


            if (!button) {

                if (
                    attempt < 12
                ) {
                    requestAnimationFrame(
                        () => {
                            this.applyRecommendation(
                                results,
                                attempt + 1
                            );
                        }
                    );
                }


                return;
            }


            button.classList.add(
                'vrh-reason--relative-recommended'
            );


            button.dataset
                .vrhRelativeCount =
                String(
                    results.length
                );


            const highConfidence =
                results.filter(
                    (result) =>
                        result.confidence ===
                        'high'
                ).length;


            button.title =
                `Оскорбление родственников: ${results.length} совпадений, HIGH: ${highConfidence}`;


            button.dataset
                .vrhRelativeOwnedTitle =
                'true';
        }


        /* =====================================================
           SCAN STATUS
           ===================================================== */

        updateScannerStatus(
            results,
            attempt = 0
        ) {
            if (
                !Array.isArray(
                    results
                ) ||
                !results.length
            ) {
                return;
            }


            const element =
                document.querySelector(
                    '#vrh-scan-result'
                );


            if (!element) {

                if (
                    attempt < 12
                ) {
                    requestAnimationFrame(
                        () => {
                            this.updateScannerStatus(
                                results,
                                attempt + 1
                            );
                        }
                    );
                }


                return;
            }


            const current =
                String(
                    element.textContent ??
                    ''
                )
                    .replace(
                        /\s*•\s*Родств\.\s*\d+/gi,
                        ''
                    )
                    .trim();


            element.textContent =
                current
                    ? `${current} • Родств. ${results.length}`
                    : `Родств. ${results.length}`;
        }


        /* =====================================================
           HIGHLIGHT
           ===================================================== */

        applyHighlights(
            results
        ) {
            const highlighter =
                this.getHighlighter();


            if (
                !highlighter ||
                typeof highlighter.highlight !==
                'function'
            ) {
                console.warn(
                    '[Vime Report Helper] Relative Abuse Highlighter unavailable.'
                );

                return;
            }


            highlighter.clear?.();


            highlighter.highlight(
                results
            );
        }


        /* =====================================================
           ANALYSIS
           ===================================================== */

        analyze(
            scanner
        ) {
            const detector =
                this.getDetector();


            if (
                !detector ||
                typeof detector.analyzeReport !==
                'function'
            ) {
                this.relativeResults =
                    [];

                return [];
            }


            const messages =
                typeof scanner?.getMessages ===
                'function'
                    ? scanner.getMessages()
                    : [];


            const results =
                detector.analyzeReport(
                    messages
                );


            this.relativeResults =
                Array.isArray(
                    results
                )
                    ? results
                    : [];


            return [
                ...this.relativeResults
            ];
        }


        /* =====================================================
           LOGGING
           ===================================================== */

        logResults(
            results
        ) {
            if (
                !results.length
            ) {
                return;
            }


            console.group(
                `[Vime Report Helper] Relative Abuse detected: ${results.length}`
            );


            results.forEach(
                (result) => {

                    console.log({
                        source:
                        result.source,

                        relativeType:
                        result.relativeType,

                        relativeText:
                        result.relativeText,

                        abuseType:
                        result.abuseType,

                        abuseText:
                        result.abuseText,

                        abuseSignals:
                        result.abuseSignals,

                        confidence:
                        result.confidence,

                        time:
                        result.time,

                        text:
                        result.text
                    });
                }
            );


            console.groupEnd();
        }


        /* =====================================================
           POST RENDER
           ===================================================== */

        applyUI(
            results
        ) {
            /*
             * Старый Scanner сначала сам завершает
             * красную подсветку слов.
             *
             * Relative Highlighter запускаем после него,
             * чтобы системы не мешали друг другу.
             */
            requestAnimationFrame(
                () => {

                    requestAnimationFrame(
                        () => {

                            this.applyHighlights(
                                results
                            );


                            this.applyRecommendation(
                                results
                            );


                            this.updateScannerStatus(
                                results
                            );

                        }
                    );

                }
            );
        }


        /* =====================================================
           CLEAR
           ===================================================== */

        clearAll() {
            this.relativeResults =
                [];


            this.clearRecommendation();


            this.getDetector()
                ?.clear?.();


            this.getHighlighter()
                ?.clear?.();
        }


        /* =====================================================
           INSTALL
           ===================================================== */

        install() {
            if (
                this.installed
            ) {
                return true;
            }


            const scanner =
                this.getScanner();


            if (
                !scanner ||
                typeof scanner.scan !==
                'function'
            ) {
                console.warn(
                    '[Vime Report Helper] Relative Abuse Integration V4: Scanner unavailable.'
                );

                return false;
            }


            const originalScan =
                scanner.scan.bind(
                    scanner
                );


            const originalClear =
                typeof scanner.clear ===
                'function'
                    ? scanner.clear.bind(
                        scanner
                    )
                    : null;


            const integration =
                this;


            scanner.scan =
                function (
                    ...args
                ) {
                    /*
                     * Сначала убираем только старый
                     * Relative UI.
                     */
                    integration
                        .getHighlighter()
                        ?.clear?.();


                    integration
                        .clearRecommendation();


                    /*
                     * Старый Scanner работает полностью
                     * как раньше:
                     *
                     * dictionary
                     * bypass
                     * CAPS
                     * красная подсветка слов
                     */
                    const normalResults =
                        originalScan(
                            ...args
                        );


                    try {

                        const relativeResults =
                            integration.analyze(
                                scanner
                            );


                        integration.logResults(
                            relativeResults
                        );


                        integration.applyUI(
                            relativeResults
                        );

                    } catch (error) {

                        console.error(
                            '[Vime Report Helper] Relative Abuse Integration V4 failed:',
                            error
                        );
                    }


                    return normalResults;
                };


            scanner.clear =
                function (
                    ...args
                ) {
                    integration.clearAll();


                    if (
                        originalClear
                    ) {
                        return originalClear(
                            ...args
                        );
                    }
                };


            /*
             * Позже понадобится Context Engine /
             * Adaptive Scanner.
             */
            scanner.getLastRelativeAbuse =
                () => [
                    ...integration.relativeResults
                ];


            this.installed =
                true;


            console.log(
                '[Vime Report Helper] Relative Abuse Integration V4 installed.'
            );


            return true;
        }
    }


    const integration =
        new VimeReportRelativeAbuseIntegration();


    window.VimeReportRelativeAbuseIntegration =
        integration;


    integration.install();

})();