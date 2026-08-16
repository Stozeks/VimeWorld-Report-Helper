(() => {
    'use strict';


    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER
     * ADAPTIVE RECOGNITION — FUZZY MATCHER  (Stage 1B)
     * =========================================================
     *
     * Compares two already-normalized tokens and estimates whether
     * they are likely the same intended word with a typo.
     *
     * DOES NOT:
     *   - normalize text (that is Stage 1A — text-normalizer.js)
     *   - decide whether a word is offensive
     *   - know moderation categories
     *   - access the DOM
     *   - make network calls
     *
     * Inputs are assumed to be pre-normalized (lowercase, no
     * separators, no lookalike characters).
     *
     * API:
     *   window.VimeReportFuzzyMatcher.distance(a, b)
     *   window.VimeReportFuzzyMatcher.similarity(a, b)
     *   window.VimeReportFuzzyMatcher.match(input, canonical, options?)
     *   window.VimeReportFuzzyMatcher.debug(input, canonical)
     * =========================================================
     */


    /* =========================================================
       OSA DISTANCE
       (Optimal String Alignment — restricted Damerau-Levenshtein)
       =========================================================

       Supports:
         - insertions
         - deletions
         - substitutions
         - adjacent-character transpositions  (abcd → abdc = 1)

       This differs from full Damerau-Levenshtein in that it does
       not handle multiple transpositions of the same substring,
       but that level of precision is not needed here.

       Time:  O(|a| × |b|)
       Space: O(|a| × |b|)
       ========================================================= */

    /**
     * Computes OSA distance between strings a and b.
     *
     * @param {string} a
     * @param {string} b
     * @returns {number} non-negative integer
     */
    function osaDistance(a, b) {
        const la = a.length;
        const lb = b.length;

        if (la === 0) return lb;
        if (lb === 0) return la;
        if (a === b)  return 0;

        /*
         * d[i][j] = edit distance between a[0..i-1] and b[0..j-1].
         * Int16Array keeps memory low for large string pairs.
         */
        const d = [];
        for (let i = 0; i <= la; i++) {
            d[i] = new Int16Array(lb + 1);
        }

        for (let i = 0; i <= la; i++) d[i][0] = i;
        for (let j = 0; j <= lb; j++) d[0][j] = j;

        for (let i = 1; i <= la; i++) {
            for (let j = 1; j <= lb; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;

                d[i][j] = Math.min(
                    d[i - 1][j]     + 1,       // deletion
                    d[i][j - 1]     + 1,       // insertion
                    d[i - 1][j - 1] + cost     // substitution / match
                );

                /* Adjacent transposition: a[i-2..i-1] == b[j-1..j-2] */
                if (
                    i > 1 && j > 1 &&
                    a[i - 1] === b[j - 2] &&
                    a[i - 2] === b[j - 1]
                ) {
                    d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
                }
            }
        }

        return d[la][lb];
    }


    /* =========================================================
       CONSERVATIVE MATCHING POLICY
       =========================================================

       The policy is keyed on the LONGER of the two token lengths.
       We choose the longer length because that is the harder bar:
       a deletion-based edit transforms the longer string into the
       shorter one in one step.

       Design rationale:
         - Tokens up to length 5 are too short for safe fuzzy
           matching.  A single character difference in "мама"
           produces "рама", "тема", "лама" — all valid Russian
           words.  Exact match only.

         - Tokens of length 6-7 are common in Russian obscenities.
           One edit with a reasonably high similarity gate is enough.

         - Longer tokens allow two edits because genuine typos
           accumulate in longer words.

       minSim is a SECONDARY gate.  The primary gate is maxEdits.
       Both must pass.
       ========================================================= */

    /**
     * @typedef {{ maxEdits: number, minSim: number, bucket: string }} Policy
     */

    /**
     * Returns the conservative matching policy for the given token length.
     *
     * @param {number} len - the longer of the two tokens
     * @returns {Policy}
     */
    function policyFor(len) {
        if (len <= 5)  return { maxEdits: 0, minSim: 1.00, bucket: 'short'     };
        if (len <= 7)  return { maxEdits: 1, minSim: 0.80, bucket: 'medium'    };
        if (len <= 10) return { maxEdits: 2, minSim: 0.75, bucket: 'long'      };
        return             { maxEdits: 2, minSim: 0.80, bucket: 'very-long' };
    }


    /* =========================================================
       CORE HELPERS
       ========================================================= */

    /**
     * Normalized similarity score in [0, 1].
     *
     * Formula: 1 - dist / max(|a|, |b|)
     *
     * Using the max length means we penalize edits relative to the
     * harder / longer form rather than the shorter one.
     *
     * @param {number} dist
     * @param {number} la
     * @param {number} lb
     * @returns {number}
     */
    function computeSimilarity(dist, la, lb) {
        const maxLen = Math.max(la, lb);
        if (maxLen === 0) return 1.0;
        return 1.0 - dist / maxLen;
    }


    /**
     * Deterministic confidence score in [0, 1].
     *
     * Confidence differs from similarity:
     *   - It accounts for the policy context (how lenient are we being?).
     *   - Longer tokens get a small bonus: one slip in a 10-letter word
     *     is more credible than one slip in a 6-letter word.
     *   - Using the maximum allowed edits incurs a small penalty.
     *
     * @param {number} dist
     * @param {number} similarity
     * @param {number} len - the longer of the two tokens
     * @param {Policy} policy
     * @returns {number}
     */
    function computeConfidence(dist, similarity, len, policy) {
        if (dist === 0) return 1.0;

        let conf = similarity;

        /* Length bonus: +0 at len=6, up to +0.05 at len=12+ */
        const lengthBonus = Math.min(0.05, Math.max(0, (len - 6) * 0.008));
        conf += lengthBonus;

        /* Penalty when burning the full edit budget */
        if (policy.maxEdits > 1 && dist >= policy.maxEdits) {
            conf -= 0.03;
        }

        return Math.min(0.99, Math.max(0, conf));
    }


    /**
     * Produces a human-readable reason string describing the kind of match
     * (or rejection) that occurred.
     *
     * Only called for accepted matches; rejection reasons are added directly
     * in match().
     *
     * @param {number}  dist
     * @param {string}  a   - input
     * @param {string}  b   - canonical
     * @param {number}  la
     * @param {number}  lb
     * @returns {string}
     */
    function describeReason(dist, a, b, la, lb) {
        if (dist === 0) return 'exact-match';

        /* Detect whether the single edit is a pure adjacent transposition */
        if (dist === 1 && la === lb) {
            let diffCount = 0;
            for (let i = 0; i < la; i++) {
                if (a[i] !== b[i]) diffCount++;
            }

            if (diffCount === 2) {
                /* Collect the two differing positions */
                const pos = [];
                for (let i = 0; i < la; i++) {
                    if (a[i] !== b[i]) pos.push(i);
                }

                if (
                    pos.length === 2        &&
                    pos[1] - pos[0] === 1   &&
                    a[pos[0]] === b[pos[1]] &&
                    a[pos[1]] === b[pos[0]]
                ) {
                    return 'single-transposition';
                }
            }
        }

        if (dist === 1) return 'single-edit-near-match';
        return 'double-edit-near-match';
    }


    /* =========================================================
       MATCHER IMPLEMENTATION
       ========================================================= */

    class VimeReportFuzzyMatcherImpl {

        /* --------------------------------------------------
           distance(a, b)

           Raw OSA edit distance between two strings.
           Inputs should already be normalized.
        -------------------------------------------------- */
        distance(a, b) {
            if (typeof a !== 'string' || typeof b !== 'string') return Infinity;
            return osaDistance(a, b);
        }


        /* --------------------------------------------------
           similarity(a, b)

           Normalized similarity score in [0, 1].
        -------------------------------------------------- */
        similarity(a, b) {
            if (typeof a !== 'string' || typeof b !== 'string') return 0;
            const dist = osaDistance(a, b);
            return computeSimilarity(dist, a.length, b.length);
        }


        /* --------------------------------------------------
           match(input, canonical, options?)

           Full conservative policy-based match.

           @param {string} input     - already-normalized player token
           @param {string} canonical - already-normalized dictionary token
           @param {object} [options]
           @param {number} [options.maxEditsOverride]
           @param {number} [options.minSimOverride]
           @returns {MatchResult}
        -------------------------------------------------- */
        match(input, canonical, options = {}) {
            const a  = String(input     ?? '');
            const b  = String(canonical ?? '');

            const la  = a.length;
            const lb  = b.length;
            const len = Math.max(la, lb);

            const policy   = policyFor(len);
            const maxEdits = options.maxEditsOverride ?? policy.maxEdits;
            const minSim   = options.minSimOverride   ?? policy.minSim;

            const dist = osaDistance(a, b);
            const sim  = computeSimilarity(dist, la, lb);

            /* ---- Primary gate: edit count ---- */
            if (dist > maxEdits) {
                return {
                    input:        a,
                    canonical:    b,
                    matched:      false,
                    distance:     dist,
                    similarity:   +sim.toFixed(4),
                    confidence:   0,
                    reason:       'rejected-distance-too-high',
                    lengthBucket: policy.bucket,
                };
            }

            /* ---- Secondary gate: similarity ---- */
            if (sim < minSim) {
                return {
                    input:        a,
                    canonical:    b,
                    matched:      false,
                    distance:     dist,
                    similarity:   +sim.toFixed(4),
                    confidence:   0,
                    reason:       'rejected-similarity-too-low',
                    lengthBucket: policy.bucket,
                };
            }

            /* ---- Accepted ---- */
            const reason = describeReason(dist, a, b, la, lb);
            const conf   = computeConfidence(dist, sim, len, policy);

            return {
                input:        a,
                canonical:    b,
                matched:      true,
                distance:     dist,
                similarity:   +sim.toFixed(4),
                confidence:   +conf.toFixed(4),
                reason,
                lengthBucket: policy.bucket,
            };
        }


        /* --------------------------------------------------
           debug(input, canonical)

           Logs a concise diagnostic to the browser console and
           returns the MatchResult for programmatic inspection.
        -------------------------------------------------- */
        debug(input, canonical) {
            const r    = this.match(input, canonical);
            const sim  = (r.similarity * 100).toFixed(1);
            const conf = (r.confidence * 100).toFixed(1);

            console.group(
                `[VimeReportFuzzyMatcher] "${input}" ↔ "${canonical}"`
            );
            console.log(`matched:    ${r.matched}`);
            console.log(`distance:   ${r.distance}`);
            console.log(`similarity: ${sim}%`);
            console.log(`confidence: ${conf}%`);
            console.log(`reason:     ${r.reason}`);
            console.log(`bucket:     ${r.lengthBucket}`);
            console.groupEnd();

            return r;
        }

    }


    /* =========================================================
       EXPORT
       ========================================================= */

    window.VimeReportFuzzyMatcher = new VimeReportFuzzyMatcherImpl();

})();
