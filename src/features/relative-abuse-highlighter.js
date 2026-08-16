(() => {
    'use strict';


    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER — RELATIVE ABUSE HIGHLIGHTER
     * =========================================================
     *
     * This module is an ADAPTER layer between the relative-abuse
     * detector and the unified highlighting pipeline.
     *
     * It no longer performs any DOM search or DOM manipulation
     * itself. Previously it contained fragile DOM search logic
     * (findExactMessageElement / wrapAbsoluteRange) that was
     * broken because VimeWorld's #mr_messages uses flat bare
     * text nodes — there are no per-message wrapper elements
     * for querySelectorAll('div,p,li,span') to find.
     *
     * Current responsibilities:
     *   1. getTargetRange()  — compute relative-target char range
     *      within message.text, including possessive-marker
     *      extension ("твою мать" not just "мать").
     *   2. getAbuseRange()   — compute abusive-fragment range.
     *   3. buildDescriptors() — convert detector results to
     *      unified-highlighter descriptor objects.
     *   4. highlight()       — thin public facade; delegates to
     *      VimeReportUnifiedHighlighter.
     *   5. clear()           — delegates to unified highlighter.
     * =========================================================
     */


    class VimeReportRelativeAbuseHighlighter {

        constructor() {
            /*
             * CSS class names are defined by the unified
             * highlighter. Keep references here for any code
             * that reads them externally.
             */
            this.relativeClass = 'vrh-hl-relative-target';
            this.abuseClass    = 'vrh-hl-relative-abuse';
        }


        /* =====================================================
           NORMALISATION HELPERS
           ===================================================== */

        _lc(value) {
            return String(value ?? '')
                .toLocaleLowerCase('ru-RU');
        }


        _indexOfIC(source, search) {
            if (
                typeof source !== 'string' ||
                typeof search !== 'string' ||
                !search
            ) {
                return -1;
            }

            return this._lc(source)
                .indexOf(this._lc(search));
        }


        /* =====================================================
           TARGET RANGE
           =====================================================
           Returns {start, end} within message.text for the
           relative-target highlight.

           Extends start backwards to include a preceding
           possessive pronoun so "твою мать" highlights both
           words, not just "мать".
           ===================================================== */

        getTargetRange(detection) {
            const message =
                String(detection?.text ?? '');

            if (!message) {
                return null;
            }

            const relativeText =
                String(detection.relativeText ?? '');

            let relativeIndex =
                Number.isInteger(detection.relativeIndex)
                    ? detection.relativeIndex
                    : this._indexOfIC(message, relativeText);

            if (relativeIndex < 0) {
                return null;
            }

            let start = relativeIndex;

            const before = message.slice(0, relativeIndex);

            /*
             * Include possessive marker when present:
             *
             *   "твоя мама"    → start at "твоя"
             *   "твою мать"    → start at "твою"
             *   "у тебя мать"  → start at "у"
             */
            const markerMatch = before.match(
                /(?:^|\s)(твой|твоя|твоё|твое|твои|твоего|твоей|твоему|твою|твоим|твоими|у\s+тебя)\s*$/iu
            );

            if (markerMatch) {
                const marker   = markerMatch[1];
                const markerIdx = this._indexOfIC(before, marker);

                if (markerIdx >= 0) {
                    start = markerIdx;
                }
            }

            const length =
                Number.isInteger(detection.relativeLength)
                    ? detection.relativeLength
                    : relativeText.length;

            return {
                start,
                end: relativeIndex + length
            };
        }


        /* =====================================================
           ABUSE RANGE
           =====================================================
           Returns {start, end} within message.text for the
           abusive/degrading fragment highlight.
           ===================================================== */

        getAbuseRange(detection) {
            const message =
                String(detection?.text ?? '');

            if (!message) {
                return null;
            }

            const abuseText =
                String(detection.abuseText ?? '');

            if (!abuseText) {
                return null;
            }

            let abuseIndex =
                Number.isInteger(detection.abuseIndex)
                    ? detection.abuseIndex
                    : this._indexOfIC(message, abuseText);

            if (abuseIndex < 0) {
                return null;
            }

            const length =
                Number.isInteger(detection.abuseLength)
                    ? detection.abuseLength
                    : abuseText.length;

            return {
                start: abuseIndex,
                end:   abuseIndex + length
            };
        }


        /* =====================================================
           BUILD DESCRIPTORS
           =====================================================
           Converts an array of relative-abuse detector results
           into unified-highlighter descriptor objects.

           Returns: Array<{ messageIndex, start, end,
                             cssClass, priority }>
           ===================================================== */

        buildDescriptors(detections) {
            if (!Array.isArray(detections)) {
                return [];
            }

            const HL =
                window.VimeReportUnifiedHighlighter;

            const clsTarget =
                HL?.CSS_CLASSES?.RELATIVE_TARGET ??
                'vrh-hl-relative-target';

            const clsAbuse =
                HL?.CSS_CLASSES?.RELATIVE_ABUSE ??
                'vrh-hl-relative-abuse';

            const priTarget =
                HL?.PRIORITY?.RELATIVE_TARGET ?? 65;

            const priAbuse =
                HL?.PRIORITY?.RELATIVE_ABUSE  ?? 70;

            const descriptors = [];

            detections.forEach((detection) => {
                if (!detection?.detected) {
                    return;
                }

                const msgIdx = detection.messageIndex;

                if (typeof msgIdx !== 'number') {
                    return;
                }

                /*
                 * Abuse fragment (highest priority — wins on
                 * overlap with any prohibited-word match).
                 */
                const abuseRange =
                    this.getAbuseRange(detection);

                if (abuseRange) {
                    descriptors.push({
                        messageIndex: msgIdx,
                        start:    abuseRange.start,
                        end:      abuseRange.end,
                        cssClass: clsAbuse,
                        priority: priAbuse
                    });
                }

                /*
                 * Relative target (includes possessive marker
                 * extension from getTargetRange).
                 */
                const targetRange =
                    this.getTargetRange(detection);

                if (targetRange) {
                    descriptors.push({
                        messageIndex: msgIdx,
                        start:    targetRange.start,
                        end:      targetRange.end,
                        cssClass: clsTarget,
                        priority: priTarget
                    });
                }
            });

            return descriptors;
        }


        /* =====================================================
           PUBLIC API
           ===================================================== */

        /**
         * Highlight a set of detection results.
         *
         * NOTE: The integration wrapper in
         * relative-abuse-integration.js normally calls
         * VimeReportUnifiedHighlighter.applyHighlights() once
         * with ALL descriptors (violation + relative) combined.
         * This method exists as a direct fallback only.
         */
        highlight(detections) {
            const descriptors =
                this.buildDescriptors(detections);

            if (!descriptors.length) {
                return;
            }

            window
                .VimeReportUnifiedHighlighter
                ?.applyHighlights(descriptors);
        }


        /**
         * Clear all VRH highlights.
         * Delegates to the unified highlighter which handles
         * both violation and relative highlight spans.
         */
        clear() {
            window
                .VimeReportUnifiedHighlighter
                ?.clear?.();
        }
    }


    window.VimeReportRelativeAbuseHighlighter =
        new VimeReportRelativeAbuseHighlighter();


    console.log(
        '[Vime Report Helper] Relative Abuse Highlighter (adapter) loaded.'
    );

})();
