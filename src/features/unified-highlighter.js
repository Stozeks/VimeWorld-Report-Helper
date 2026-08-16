(() => {
    'use strict';


    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER
     * UNIFIED HIGHLIGHT PIPELINE
     * =========================================================
     *
     * Single authoritative source for all DOM highlighting.
     *
     * Consumers (violation-scanner, relative-abuse) produce
     * descriptor objects and pass them here.
     * This module handles:
     *
     *   - message → DOM text node mapping (per-message, safe)
     *   - priority-based overlap resolution
     *   - actual DOM text-node splitting
     *   - idempotent clear
     *
     * Descriptor format:
     *   {
     *     messageIndex : number   (0-based, matches message-parser index)
     *     start        : number   (char offset from start of message.text)
     *     end          : number   (exclusive end, same space as start)
     *     cssClass     : string   (one of CSS_CLASSES values)
     *     priority     : number   (higher wins on overlap)
     *   }
     *
     * Highlights NEVER span message boundaries.
     * Timestamps are NEVER touched.
     * =========================================================
     */


    /* =========================================================
       CSS CLASSES
       ========================================================= */

    const CSS_CLASSES = Object.freeze({
        VIOLATION:       'vrh-hl-violation',
        RELATIVE_TARGET: 'vrh-hl-relative-target',
        RELATIVE_ABUSE:  'vrh-hl-relative-abuse',
        CAPS:            'vrh-hl-caps',
        FLOOD:           'vrh-hl-flood'
    });


    /* =========================================================
       PRIORITY
       =========================================================
       Higher value = wins over lower on overlap.
       ========================================================= */

    const PRIORITY = Object.freeze({
        RELATIVE_ABUSE:  70,
        RELATIVE_TARGET: 65,
        VIOLATION:       40,
        CAPS:            30,
        FLOOD:           20
    });


    /* =========================================================
       ALL SELECTORS TO CLEAR
       ========================================================= */

    const NEW_HIGHLIGHT_CLASSES = Object.values(CSS_CLASSES);

    /*
     * Legacy classes from older implementations.
     * Also removed on clear() for clean idempotency.
     */
    const LEGACY_CLASSES = [
        'vrh-violation-highlight',
        'vrh-caps-highlight',
        'vrh-relative-target',
        'vrh-relative-abuse'
    ];

    const ALL_CLEAR_SELECTOR = [
        ...NEW_HIGHLIGHT_CLASSES,
        ...LEGACY_CLASSES
    ]
        .map(c => `.${c}`)
        .join(', ');


    /* =========================================================
       STYLE ID
       ========================================================= */

    const STYLE_ID = 'vrh-unified-highlight-styles';


    /* =========================================================
       CLASS
       ========================================================= */

    class VimeReportUnifiedHighlighter {

        constructor() {
            this._stylesInstalled = false;
        }


        /* =====================================================
           INSTALL STYLES
           ===================================================== */

        installStyles() {
            if (
                this._stylesInstalled ||
                document.getElementById(STYLE_ID)
            ) {
                this._stylesInstalled = true;
                return;
            }

            const style =
                document.createElement('style');

            style.id = STYLE_ID;

            style.textContent = `

                /*
                 * VIOLATION — prohibited word / phrase
                 * (MAT, AMORAL, INSULT, etc.)
                 *
                 * Amber / yellow-orange
                 */
                .vrh-hl-violation {
                    color: #e0a030 !important;
                    font-weight: 600 !important;
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    text-decoration-line: underline !important;
                    text-decoration-style: dotted !important;
                    text-decoration-thickness: 1px !important;
                    text-underline-offset: 3px !important;
                    text-decoration-color: rgba(224, 160, 48, 0.65) !important;
                }


                /*
                 * RELATIVE TARGET — the family member reference
                 *
                 * "твою мать", "его мама", "сын"
                 *
                 * Gold / amber
                 */
                .vrh-hl-relative-target {
                    color: #e2b341 !important;
                    font-weight: 700 !important;
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    text-decoration-line: underline !important;
                    text-decoration-style: dotted !important;
                    text-decoration-thickness: 1px !important;
                    text-underline-offset: 3px !important;
                    text-decoration-color: rgba(226, 179, 65, 0.72) !important;
                }


                /*
                 * RELATIVE ABUSE — the abusive / degrading fragment
                 *
                 * "шлюхи", "дебил", "членом разорвал"
                 *
                 * Red
                 */
                .vrh-hl-relative-abuse {
                    color: #e76565 !important;
                    font-weight: 700 !important;
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    text-decoration-line: underline !important;
                    text-decoration-style: dotted !important;
                    text-decoration-thickness: 1px !important;
                    text-underline-offset: 3px !important;
                    text-decoration-color: rgba(231, 101, 101, 0.70) !important;
                }


                /*
                 * CAPS LOCK — uppercase word within detection window
                 *
                 * Purple / violet
                 */
                .vrh-hl-caps {
                    color: #a878f0 !important;
                    font-weight: 600 !important;
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    text-decoration-line: underline !important;
                    text-decoration-style: dotted !important;
                    text-decoration-thickness: 1px !important;
                    text-underline-offset: 3px !important;
                    text-decoration-color: rgba(168, 120, 240, 0.60) !important;
                }


                /*
                 * FLOOD — symbol or repeated-message flood fragment
                 *
                 * Orange
                 */
                .vrh-hl-flood {
                    color: #f0a030 !important;
                    font-weight: 600 !important;
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    text-decoration-line: underline !important;
                    text-decoration-style: dotted !important;
                    text-decoration-thickness: 1px !important;
                    text-underline-offset: 3px !important;
                    text-decoration-color: rgba(240, 160, 48, 0.65) !important;
                }

            `;


            (
                document.head ||
                document.documentElement
            ).appendChild(style);


            this._stylesInstalled = true;
        }


        /* =====================================================
           CLEAR
           =====================================================
           Removes ALL VRH highlight spans (new and legacy),
           then normalizes adjacent text nodes.

           Must be called before re-scanning to guarantee
           that buildMessageNodeIndex() sees clean text nodes.
           ===================================================== */

        clear() {
            const container =
                document.querySelector('#mr_messages');

            if (!container) {
                return;
            }

            container
                .querySelectorAll(ALL_CLEAR_SELECTOR)
                .forEach(
                    (el) => {
                        el.replaceWith(
                            document.createTextNode(
                                el.textContent || ''
                            )
                        );
                    }
                );

            /*
             * Merge any adjacent text nodes produced
             * by the span removals above.
             */
            container.normalize();
        }


        /* =====================================================
           BUILD MESSAGE NODE INDEX
           =====================================================
           Maps messageIndex (0-based, matching message-parser)
           to the DOM text nodes that carry that message text.

           MUST be called on a CLEAN DOM (after clear()).

           Returns: Map<number, { textNodes: Text[], textOffset: number }>

           textOffset = number of characters from the start of the
           first (and usually only) text node where message.text
           actually begins (after stripping the leading " - " prefix
           and any surrounding whitespace).
           ===================================================== */

        buildMessageNodeIndex() {
            const container =
                document.querySelector('#mr_messages');

            if (!container) {
                return new Map();
            }

            const index = new Map();

            /*
             * messageIndex is incremented ONLY for messages
             * that would actually be pushed by message-parser.
             * i.e. messages whose text, after trim + dash-strip,
             * is non-empty.
             *
             * If a timestamp is followed immediately by a BR
             * (no text, or whitespace-only text), the parser
             * skips it and does NOT push to the array.
             * This counter must mirror that behaviour exactly,
             * otherwise every subsequent messageIndex will be
             * off-by-N and no highlights will be found.
             */
            let messageIndex = 0;
            let inMessage = false;
            let currentTextNodes = [];


            const flushMessage =
                () => {
                    if (!inMessage) {
                        return;
                    }

                    if (
                        currentTextNodes.length
                    ) {
                        const rawText =
                            currentTextNodes
                                .map(n => n.nodeValue || '')
                                .join('');

                        /*
                         * Mirror message-parser normalisation:
                         * replace \u00a0 with space, trim,
                         * then strip the leading " - " prefix.
                         *
                         * Only store and increment messageIndex
                         * when this produces a non-empty string.
                         */
                        const parsedText =
                            rawText
                                .replace(/\u00a0/g, ' ')
                                .trim()
                                .replace(/^\s*-\s*/, '');

                        if (parsedText) {
                            const textOffset =
                                this._computeTextOffset(
                                    rawText
                                );

                            index.set(
                                messageIndex,
                                {
                                    textNodes: [
                                        ...currentTextNodes
                                    ],
                                    textOffset
                                }
                            );

                            messageIndex++;
                        }
                        /*
                         * If parsedText is empty:
                         * the message-parser would NOT push this
                         * entry, so we MUST NOT increment
                         * messageIndex here either.
                         */
                    }

                    currentTextNodes = [];
                    inMessage = false;
                };


            for (
                const node
                of container.childNodes
                ) {

                const isTimestamp =
                    node.nodeType ===
                    Node.ELEMENT_NODE &&
                    node.matches?.(
                        'span.text-muted'
                    );

                const isBR =
                    node.nodeType ===
                    Node.ELEMENT_NODE &&
                    node.tagName === 'BR';

                const isText =
                    node.nodeType ===
                    Node.TEXT_NODE;


                if (isTimestamp) {

                    /*
                     * New timestamp → flush whatever was
                     * accumulating (messageIndex increment is
                     * handled inside flushMessage now).
                     */
                    if (inMessage) {
                        flushMessage();
                    }

                    inMessage = true;
                    currentTextNodes = [];

                } else if (isBR) {

                    if (inMessage) {
                        flushMessage();
                    }

                } else if (
                    isText &&
                    inMessage
                ) {

                    currentTextNodes.push(node);
                }
            }


            /*
             * Handle final message with no trailing <br>.
             */
            if (inMessage) {
                flushMessage();
            }


            return index;
        }


        /* =====================================================
           COMPUTE TEXT OFFSET
           =====================================================
           Given the raw text node content of a message,
           compute the character offset at which message.text
           (the parser-cleaned text) begins.

           The parser applies:
             .join('').replace(\u00a0 → ' ').trim()
                      .replace(leading dash prefix → '')

           Since \u00a0 → ' ' is a same-length substitution,
           character positions in the normalized string equal
           positions in the original.
           ===================================================== */

        _computeTextOffset(rawText) {
            if (!rawText) {
                return 0;
            }

            const normalized =
                rawText.replace(/\u00a0/g, ' ');

            const trimStartLen =
                normalized.length -
                normalized.trimStart().length;

            const trimmed =
                normalized.trimStart();

            const prefixMatch =
                trimmed.match(/^(\s*-\s*)/);

            const prefixLen =
                prefixMatch
                    ? prefixMatch[1].length
                    : 0;

            return trimStartLen + prefixLen;
        }


        /* =====================================================
           APPLY HIGHLIGHTS
           =====================================================
           Main public method.

           descriptors: Array of {
             messageIndex, start, end, cssClass, priority
           }

           start/end are offsets relative to message.text
           (same space as message-parser output).

           Internally converts these to absolute offsets within
           the message's raw text nodes, then applies DOM splits.
           ===================================================== */

        applyHighlights(descriptors) {
            if (
                !Array.isArray(descriptors) ||
                !descriptors.length
            ) {
                return;
            }

            this.installStyles();


            /*
             * Build the node index on the CURRENT (clean) DOM.
             */
            const nodeIndex =
                this.buildMessageNodeIndex();


            /*
             * Group descriptors by messageIndex.
             */
            const byMessage = new Map();

            for (
                const desc
                of descriptors
                ) {
                if (
                    typeof desc.messageIndex !==
                    'number' ||
                    typeof desc.start !==
                    'number' ||
                    typeof desc.end !==
                    'number' ||
                    desc.start >= desc.end
                ) {
                    continue;
                }

                if (
                    !byMessage.has(
                        desc.messageIndex
                    )
                ) {
                    byMessage.set(
                        desc.messageIndex,
                        []
                    );
                }

                byMessage
                    .get(desc.messageIndex)
                    .push(desc);
            }


            /*
             * Process each message independently.
             */
            byMessage.forEach(
                (msgDescs, messageIndex) => {

                    const entry =
                        nodeIndex.get(
                            messageIndex
                        );

                    if (
                        !entry ||
                        !entry.textNodes.length
                    ) {
                        console.warn(
                            '[Vime Report Helper] Unified Highlighter: ' +
                            'no DOM entry for messageIndex',
                            messageIndex,
                            '(nodeIndex has', nodeIndex.size, 'entries)'
                        );
                        return;
                    }

                    const resolved =
                        this._resolveOverlaps(
                            msgDescs
                        );

                    if (!resolved.length) {
                        return;
                    }

                    try {
                        this._applyToTextNodes(
                            entry.textNodes,
                            entry.textOffset,
                            resolved
                        );
                    } catch (err) {
                        console.warn(
                            '[Vime Report Helper] Unified Highlighter: failed to highlight message',
                            messageIndex,
                            err
                        );
                    }
                }
            );
        }


        /* =====================================================
           RESOLVE OVERLAPS
           =====================================================
           Given a list of descriptors for ONE message,
           returns a non-overlapping subset sorted by start.

           Priority resolution:
             Higher priority → wins on overlap.
             Equal priority  → earlier start wins.
           ===================================================== */

        _resolveOverlaps(descs) {
            if (!descs.length) {
                return [];
            }

            /*
             * Sort: highest priority first.
             * Tie-break: earliest start first.
             */
            const sorted = [
                ...descs
            ].sort(
                (a, b) => {
                    const pd =
                        (b.priority || 0) -
                        (a.priority || 0);

                    return pd !== 0
                        ? pd
                        : a.start - b.start;
                }
            );

            const accepted = [];

            for (
                const d
                of sorted
                ) {
                const overlaps =
                    accepted.some(
                        (a) =>
                            d.start < a.end &&
                            d.end > a.start
                    );

                if (!overlaps) {
                    accepted.push(d);
                }
            }

            /*
             * Return in rendering order (start ascending).
             */
            return accepted.sort(
                (a, b) => a.start - b.start
            );
        }


        /* =====================================================
           APPLY TO TEXT NODES
           =====================================================
           Converts message.text-space descriptors into
           absolute positions within the raw text node sequence,
           then applies them in reverse node order to avoid
           offset corruption.
           ===================================================== */

        _applyToTextNodes(textNodes, textOffset, descriptors) {
            if (
                !textNodes.length ||
                !descriptors.length
            ) {
                return;
            }

            /*
             * Build cumulative position map for each text node.
             */
            let cursor = 0;

            const nodeMap =
                textNodes.map(
                    (node) => {
                        const val =
                            node.nodeValue || '';

                        const entry = {
                            node,
                            start: cursor,
                            end: cursor + val.length
                        };

                        cursor += val.length;

                        return entry;
                    }
                );


            /*
             * Convert descriptor offsets from message.text space
             * to raw-text-node space (by adding textOffset).
             */
            const absDescs =
                descriptors
                    .map(
                        (d) => ({
                            start:
                                textOffset + d.start,
                            end:
                                textOffset + d.end,
                            cssClass:
                                d.cssClass
                        })
                    )
                    .filter(
                        (d) => d.end > d.start
                    );


            /*
             * Process text nodes in REVERSE order.
             *
             * Applying a split to a text node replaces it in the
             * parent's childNodes. Processing in reverse ensures
             * that earlier nodes are not invalidated before we
             * reach them, since our nodeMap was built before any
             * DOM changes.
             */
            for (
                let i = nodeMap.length - 1;
                i >= 0;
                i--
                ) {
                const entry = nodeMap[i];

                const relevant =
                    absDescs.filter(
                        (d) =>
                            d.start < entry.end &&
                            d.end > entry.start
                    );

                if (!relevant.length) {
                    continue;
                }

                /*
                 * Clip each descriptor to this node's bounds.
                 */
                const clipped =
                    relevant
                        .map(
                            (d) => ({
                                start: Math.max(
                                    0,
                                    d.start - entry.start
                                ),
                                end: Math.min(
                                    entry.end - entry.start,
                                    d.end - entry.start
                                ),
                                cssClass: d.cssClass
                            })
                        )
                        .filter(
                            (d) => d.end > d.start
                        );


                if (clipped.length) {
                    this._splitTextNode(
                        entry.node,
                        clipped
                    );
                }
            }
        }


        /* =====================================================
           SPLIT TEXT NODE
           =====================================================
           Replaces one text node with a fragment containing
           plain text nodes and highlight spans.

           clipped: [{start, end, cssClass}] sorted by start,
                    all within [0, node.length], non-overlapping.
           ===================================================== */

        _splitTextNode(textNode, clipped) {
            const text =
                textNode.nodeValue || '';

            if (!text) {
                return;
            }

            const sorted = [
                ...clipped
            ].sort(
                (a, b) => a.start - b.start
            );

            const fragment =
                document.createDocumentFragment();

            let pos = 0;

            for (
                const range
                of sorted
                ) {

                /*
                 * Skip if overlap escaped resolution
                 * (safety guard).
                 */
                if (range.start < pos) {
                    continue;
                }

                /*
                 * Plain text before this range.
                 */
                if (range.start > pos) {
                    fragment.appendChild(
                        document.createTextNode(
                            text.slice(
                                pos,
                                range.start
                            )
                        )
                    );
                }

                /*
                 * Highlighted span.
                 */
                const highlighted =
                    text.slice(
                        range.start,
                        range.end
                    );

                if (highlighted) {
                    const span =
                        document.createElement(
                            'span'
                        );

                    span.className =
                        range.cssClass;

                    span.textContent =
                        highlighted;

                    fragment.appendChild(span);
                }

                pos = range.end;
            }

            /*
             * Remaining plain text.
             */
            if (pos < text.length) {
                fragment.appendChild(
                    document.createTextNode(
                        text.slice(pos)
                    )
                );
            }

            textNode.replaceWith(fragment);
        }


        /* =====================================================
           DEBUG
           =====================================================
           Call from browser console:
             VimeReportUnifiedHighlighter.debug()
           ===================================================== */

        debug() {
            const nodeIndex = this.buildMessageNodeIndex();

            console.group('[Vime Report Helper] Unified Highlighter debug');
            console.log('nodeIndex size:', nodeIndex.size);

            nodeIndex.forEach((entry, idx) => {
                const text = entry.textNodes
                    .map(n => n.nodeValue || '')
                    .join('');

                console.log(
                    `  msg[${idx}] textOffset=${entry.textOffset}`,
                    `rawLen=${text.length}`,
                    `parsedStart="${text.slice(entry.textOffset, entry.textOffset + 20)}..."`
                );
            });

            console.groupEnd();
            return nodeIndex;
        }
    }


    /* =========================================================
       EXPORT
       ========================================================= */

    const instance =
        new VimeReportUnifiedHighlighter();

    instance.CSS_CLASSES = CSS_CLASSES;
    instance.PRIORITY = PRIORITY;

    window.VimeReportUnifiedHighlighter =
        instance;


    console.log(
        '[Vime Report Helper] Unified Highlighter loaded.'
    );

})();
