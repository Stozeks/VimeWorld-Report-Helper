(() => {
    'use strict';


    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER — RELATIVE ABUSE INTEGRATION
     * =========================================================
     *
     * Orchestrates the full scan pipeline:
     *
     *   1. Installs itself by wrapping scanner.scan().
     *   2. On each scan:
     *        a. Original scan builds violation descriptors but
     *           does NOT apply them (because
     *           scanner._relativeAbuseIntegrationActive = true).
     *        b. Relative abuse detector runs on the same messages.
     *        c. Violation + relative descriptors are combined.
     *        d. VimeReportUnifiedHighlighter.applyHighlights()
     *           is called ONCE with all combined descriptors.
     *           This guarantees:
     *             - single DOM pass (no offset corruption)
     *             - priority-based overlap resolution
     *             - message-boundary safety
     *             - idempotency
     *   3. Applies "Оскорбление родственников" recommendation.
     *   4. Updates the scan-result status element.
     *
     * Replaces the old double-RAF timing hack that caused the
     * two highlighters to fight over the same DOM nodes.
     * =========================================================
     */


    class VimeReportRelativeAbuseIntegration {

        constructor() {
            this.installed      = false;
            this.relativeResults = [];
        }


        /* =====================================================
           DEPENDENCIES
           ===================================================== */

        getScanner() {
            return window.VimeReportViolationScanner ?? null;
        }


        getDetector() {
            return window.VimeReportRelativeAbuseDetector ?? null;
        }


        getHighlighter() {
            return window.VimeReportRelativeAbuseHighlighter ?? null;
        }


        getUnifiedHighlighter() {
            return window.VimeReportUnifiedHighlighter ?? null;
        }


        /* =====================================================
           REASON BUTTON — RECOMMENDATION
           ===================================================== */

        findRelativeReasonButton() {
            const buttons =
                document.querySelectorAll('[data-reason-id]');

            for (const button of buttons) {
                const label =
                    String(button.textContent ?? '')
                        .replace(/\s+/g, ' ')
                        .trim();

                /*
                 * Use includes() because the tile may later
                 * gain a counter/badge inside it.
                 */
                if (label.includes('Оскорбление родственников')) {
                    return button;
                }
            }

            return null;
        }


        clearRecommendation() {
            const button = this.findRelativeReasonButton();

            if (!button) {
                return;
            }

            button.classList.remove(
                'vrh-reason--relative-recommended'
            );

            button.removeAttribute('data-vrh-relative-count');

            if (button.dataset.vrhRelativeOwnedTitle === 'true') {
                button.removeAttribute('title');
                delete button.dataset.vrhRelativeOwnedTitle;
            }
        }


        applyRecommendation(results, attempt = 0) {
            if (!Array.isArray(results) || !results.length) {
                this.clearRecommendation();
                return;
            }

            const button = this.findRelativeReasonButton();

            if (!button) {
                if (attempt < 12) {
                    requestAnimationFrame(
                        () => this.applyRecommendation(results, attempt + 1)
                    );
                }
                return;
            }

            button.classList.add(
                'vrh-reason--relative-recommended'
            );

            button.dataset.vrhRelativeCount =
                String(results.length);

            const highConfidence =
                results.filter(
                    (r) => r.confidence === 'high'
                ).length;

            button.title =
                `Оскорбление родственников: ${results.length} совп., уверенность HIGH: ${highConfidence}`;

            button.dataset.vrhRelativeOwnedTitle = 'true';
        }


        /* =====================================================
           SCAN STATUS
           ===================================================== */

        updateScannerStatus(violationResults, relativeResults, attempt = 0) {
            const element =
                document.querySelector('#vrh-scan-result');

            if (!element) {
                if (attempt < 12) {
                    requestAnimationFrame(
                        () => this.updateScannerStatus(
                            violationResults,
                            relativeResults,
                            attempt + 1
                        )
                    );
                }
                return;
            }

            const vCount =
                Array.isArray(violationResults)
                    ? violationResults.length
                    : 0;

            const rCount =
                Array.isArray(relativeResults)
                    ? relativeResults.length
                    : 0;

            if (vCount === 0 && rCount === 0) {
                return;
            }

            /*
             * Build a compact unified summary.
             * Replace the existing text that renderScanResult()
             * already set, to avoid duplication.
             */
            const parts = [];

            if (vCount > 0) {
                const msgSet = new Set(
                    violationResults.map(
                        (r) =>
                            r?.messageIndex ??
                            r?.message?.index ??
                            r?.index
                    ).filter(
                        (i) => i !== undefined && i !== null
                    )
                );

                parts.push(
                    `${vCount} наруш. · ${msgSet.size} сообщ.`
                );
            }

            if (rCount > 0) {
                parts.push(`Родств. ${rCount}`);
            }

            if (!parts.length) {
                return;
            }

            /*
             * Only update if the element currently has the
             * old violation-only text (i.e. was set by
             * renderScanResult). Avoid overwriting if someone
             * else already set the full combined status.
             */
            const spanEl =
                element.querySelector('span');

            if (spanEl) {
                spanEl.textContent = parts.join(' · ');
            }
        }


        /* =====================================================
           ANALYSIS — run detector over all messages
           ===================================================== */

        analyze(scanner) {
            const detector = this.getDetector();

            if (
                !detector ||
                typeof detector.analyzeReport !== 'function'
            ) {
                this.relativeResults = [];
                return [];
            }

            const messages =
                typeof scanner?.getMessages === 'function'
                    ? scanner.getMessages()
                    : [];

            const results =
                detector.analyzeReport(messages);

            this.relativeResults =
                Array.isArray(results) ? results : [];

            return [...this.relativeResults];
        }


        /* =====================================================
           LOGGING
           ===================================================== */

        logResults(results) {
            if (!results.length) {
                return;
            }

            console.group(
                `[Vime Report Helper] Relative Abuse detected: ${results.length}`
            );

            results.forEach((result) => {
                console.log({
                    source:       result.source,
                    relativeType: result.relativeType,
                    relativeText: result.relativeText,
                    abuseType:    result.abuseType,
                    abuseText:    result.abuseText,
                    abuseSignals: result.abuseSignals,
                    confidence:   result.confidence,
                    target:       result.target,
                    time:         result.time,
                    text:         result.text
                });
            });

            console.groupEnd();
        }


        /* =====================================================
           CLEAR
           ===================================================== */

        clearAll() {
            this.relativeResults = [];

            this.clearRecommendation();

            this.getDetector()?.clear?.();

            /*
             * The unified highlighter clears both violation and
             * relative spans in one pass.
             */
            this.getUnifiedHighlighter()?.clear?.();
        }


        /* =====================================================
           INSTALL
           ===================================================== */

        install() {
            if (this.installed) {
                return true;
            }

            const scanner = this.getScanner();

            if (
                !scanner ||
                typeof scanner.scan !== 'function'
            ) {
                console.warn(
                    '[Vime Report Helper] Relative Abuse Integration: Scanner unavailable.'
                );
                return false;
            }

            const originalScan =
                scanner.scan.bind(scanner);

            const originalClear =
                typeof scanner.clear === 'function'
                    ? scanner.clear.bind(scanner)
                    : null;

            const integration = this;


            /*
             * Signal to the scanner that we will handle all
             * highlighting ourselves in a single pass.
             * When this flag is true, scanner.scan() builds
             * descriptors but does NOT call applyHighlights().
             */
            scanner._relativeAbuseIntegrationActive = true;


            scanner.scan = function (...args) {

                integration.clearRecommendation();

                /*
                 * Run the original scanner.
                 * It will:
                 *   - call unified highlighter clear
                 *   - scan for violations / caps
                 *   - build _lastViolationDescriptors
                 *   - NOT apply highlights (flag is set)
                 */
                const normalResults =
                    originalScan(...args);


                try {

                    const relativeResults =
                        integration.analyze(scanner);

                    integration.logResults(relativeResults);


                    /*
                     * Combine ALL descriptors (violation + caps
                     * + relative) and apply in a single pass.
                     *
                     * The unified highlighter resolves overlaps
                     * deterministically by priority.
                     */
                    const violationDescs =
                        typeof scanner.getLastViolationDescriptors ===
                        'function'
                            ? scanner.getLastViolationDescriptors()
                            : [];

                    const relativeDescs =
                        integration
                            .getHighlighter()
                            ?.buildDescriptors(relativeResults) ??
                        [];

                    const allDescs = [
                        ...violationDescs,
                        ...relativeDescs
                    ];

                    if (allDescs.length) {
                        integration
                            .getUnifiedHighlighter()
                            ?.applyHighlights(allDescs);
                    }


                    integration.applyRecommendation(
                        relativeResults
                    );

                    integration.updateScannerStatus(
                        normalResults,
                        relativeResults
                    );

                } catch (error) {
                    console.error(
                        '[Vime Report Helper] Relative Abuse Integration failed:',
                        error
                    );
                }


                return normalResults;
            };


            scanner.clear = function (...args) {
                integration.clearAll();

                if (originalClear) {
                    return originalClear(...args);
                }
            };


            scanner.getLastRelativeAbuse =
                () => [...integration.relativeResults];


            this.installed = true;

            console.log(
                '[Vime Report Helper] Relative Abuse Integration installed.'
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
