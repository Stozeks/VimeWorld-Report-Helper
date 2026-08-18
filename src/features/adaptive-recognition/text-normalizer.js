(() => {
    'use strict';


    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER
     * ADAPTIVE RECOGNITION — TEXT NORMALIZER  (Stage 1A)
     * =========================================================
     *
     * Normalises raw player text to a canonical form suitable
     * for later bypass-resistant matching.
     *
     * DOES NOT:
     *   - decide whether a word is offensive
     *   - know moderation categories
     *   - touch the DOM
     *   - mutate the caller's string
     *
     * Tracks original character positions so that future stages
     * can map normalised match offsets back to DOM highlights.
     *
     * window.VimeReportTextNormalizer
     *   .normalize(text, options?)   -> string
     *   .normalizeToken(token, options?)  -> NormalizeResult
     *   .debug(text)                 -> NormalizeResult + console log
     *
     * NormalizeResult shape:
     *   {
     *     original       : string
     *     normalized     : string
     *     changed        : boolean
     *     transformations: Transform[]
     *     indexMap       : number[]  -- indexMap[i] = origIndex of normalized[i]
     *   }
     * =========================================================
     */


    /* =========================================================
       CONSTANTS
       ========================================================= */

    /*
     * Characters whose doubled occurrences are collapsed.
     * Includes Russian vowels + semi-vowel й.
     * Doubled vowels are essentially never legitimate in Russian
     * player text, so collapsing runs of 2+ is safe.
     *
     * Consonant doubling (касса, ванна, группа) is common and
     * is NOT collapsed by default.  Use collapseRunsThreshold:2
     * for a more aggressive pass.
     */
    const COLLAPSE_DOUBLES_CHARS = new Set(
        '\u0430\u0435\u0451\u0438\u043e\u0443\u044b\u044d\u044e\u044f' + // аеёиоуыэюя
        '\u0456\u0454' + // і є
        '\u0439'         // й (semi-vowel, never legitimately doubled)
    );

    /*
     * Lookalike-character substitution map.
     *
     * Applied only when the token contains at least one Cyrillic
     * character (to avoid mangling purely Latin/English text).
     *
     * Only characters with low false-positive risk are included.
     */
    const LOOKALIKE_MAP = Object.freeze({
        /* Digit lookalikes */
        '0': '\u043e', // о
        '1': '\u0438', // и  (1 used as bypass for и/л; и is more common)
        '3': '\u0437', // з
        '4': '\u0447', // ч
        '6': '\u0431', // б
        '@': '\u0430', // а

        /* Latin → Cyrillic */
        'a': '\u0430', // а
        'c': '\u0441', // с
        'e': '\u0435', // е
        'i': '\u0438', // и
        'o': '\u043e', // о
        'p': '\u0440', // р
        'x': '\u0445', // х
        'y': '\u0443', // у
    });

    /*
     * Non-space characters treated as separators in
     * obfuscated sequences like п-и-д-о-р.
     */
    const NON_SPACE_SEPS = ['-', '.', '_', ','];

    /*
     * Unusual Unicode whitespace variants → regular space.
     */
    const ABNORMAL_SPACE_CHARS = new Set([
        '\u00a0', // non-breaking space
        '\u2009', // thin space
        '\u200b', // zero-width space
        '\u202f', // narrow no-break space
        '\u2060', // word joiner
        '\ufeff', // BOM / zero-width no-break space
    ]);

    const ABNORMAL_SPACES_RE =
        /[\u00a0\u2009\u200b\u202f\u2060\ufeff]/g;

    /*
     * Скрытые символы и комбинирующие знаки.
     * Удаляем только безопасные маркеры, которые не несут смысла
     * для модераторского текста.
     */
    const INVISIBLE_RE =
        /[\u200b\u200c\u200d\u2060\ufeff\u00ad]/g;

    const COMBINING_MARK_RE =
        /[\u0300-\u036f]/g;

    /*
     * Раскладка QWERTY ↔ ЙЦУКЕН.
     * Используется только как вспомогательный кандидат.
     */
    const QWERTY_TO_CYR = Object.freeze({
        q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з',
        '[': 'х', ']': 'ъ',
        a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д',
        ';': 'ж', "'": 'э',
        z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь'
    });

    const CYR_TO_QWERTY = Object.freeze(
        Object.fromEntries(
            Object.entries(QWERTY_TO_CYR).map(([latin, cyr]) => [cyr, latin])
        )
    );


    /* =========================================================
       DEFAULT OPTIONS
       ========================================================= */

    const DEFAULT_OPTIONS = Object.freeze({

        /*
         * Fold to lowercase using the ru-RU locale
         * (correct ё/е handling).
         */
        lowercase: true,

        /*
         * Replace unusual Unicode spaces with a regular space.
         */
        normalizeSpaces: true,

        /*
         * Collapse runs of N+ identical characters to 1.
         *   3 (default) — conservative: preserves касса, ванна, группа.
         *   2            — aggressive: also collapses шлл→шл.
         *   0            — disable run-length collapsing entirely.
         */
        collapseRunsThreshold: 3,

        /*
         * Additionally collapse runs of 2+ characters that
         * belong to COLLAPSE_DOUBLES_CHARS (vowels + й).
         * Default true: doubled vowels are essentially never
         * legitimate in Russian player text.
         */
        collapseVowelDoubles: true,

        /*
         * Detect and remove separators in sequences like
         * п-и-д-о-р, п.и.д.о.р, п и д о р.
         * Only fires when the ENTIRE token (normalizeToken) or a
         * clearly delimited sub-sequence (normalize) is a strict
         * letter–sep–letter alternating pattern.
         */
        removeSeparators: true,

        /*
         * Minimum letter count in a separated sequence before
         * separator removal triggers.
         */
        minSeparatedLength: 3,

        /*
         * Apply lookalike-character substitution.
         * Guarded by isLikelyCyrillicToken; purely Latin tokens
         * are left unchanged.
         */
        applyLookalikes: true,
    });


    /* =========================================================
       INTERNAL HELPERS
       ========================================================= */

    /*
     * Build a mutable char-entry array from a string.
     * origIndex is the UTF-16 code-unit offset, matching
     * JavaScript's String indices exactly.
     */
    function buildEntries(text) {
        const entries = [];
        let idx = 0;

        for (const ch of text) {
            entries.push({
                char:      ch,
                origIndex: idx,
                removed:   false,
            });
            idx += ch.length; // 1 for BMP; 2 for surrogate pairs
        }

        return entries;
    }

    function stripInvisible(text) {
        return String(text ?? '')
            .replace(INVISIBLE_RE, '')
            .replace(COMBINING_MARK_RE, '');
    }

    function translateLayout(text, map) {
        let result = '';

        for (const ch of String(text ?? '')) {
            const lower = ch.toLocaleLowerCase('ru-RU');
            const mapped = map[lower];

            if (mapped) {
                result += ch === lower
                    ? mapped
                    : mapped.toLocaleUpperCase('ru-RU');
            } else {
                result += ch;
            }
        }

        return result;
    }

    function activeOf(entries) {
        return entries.filter(e => !e.removed);
    }

    function isLetter(ch) {
        return /[а-яёієa-z]/i.test(ch);
    }

    /*
     * Returns true when entries contain at least one Cyrillic
     * character, enabling lookalike substitution.
     */
    function isLikelyCyrillicToken(entries) {
        return entries.some(
            e => !e.removed && /[а-яёіє]/i.test(e.char)
        );
    }

    /*
     * Returns true when the active entry list is a strict
     * alternating  L sep L sep L …  pattern.
     *
     * Requirements:
     *   - total length is odd  (first and last positions are letters)
     *   - at least minLen letters
     *   - even indices are letters, odd indices are all equal to sep
     */
    function looksLikeSeparatedSeq(active, sep, minLen) {
        if (active.length % 2 !== 1) {
            return false;
        }

        const letterCount = (active.length + 1) / 2;

        if (letterCount < minLen) {
            return false;
        }

        for (let i = 0; i < active.length; i++) {
            if (i % 2 === 0) {
                if (!isLetter(active[i].char)) {
                    return false;
                }
            } else {
                if (active[i].char !== sep) {
                    return false;
                }
            }
        }

        return true;
    }

    /*
     * Returns the effective collapse threshold for a character.
     */
    function thresholdFor(ch, opts) {
        const base =
            opts.collapseRunsThreshold > 0
                ? opts.collapseRunsThreshold
                : Infinity;

        if (opts.collapseVowelDoubles && COLLAPSE_DOUBLES_CHARS.has(ch)) {
            return Math.min(base, 2);
        }

        return base;
    }

    /*
     * Return an identity (no-op) result for empty or non-string input.
     */
    function identityResult(s) {
        const indexMap = [];
        let idx = 0;
        for (const ch of s) {
            indexMap.push(idx);
            idx += ch.length;
        }
        return {
            original:        s,
            normalized:      s,
            changed:         false,
            transformations: [],
            indexMap,
        };
    }


    /* =========================================================
       CLASS
       ========================================================= */

    class VimeReportTextNormalizerImpl {


        /* =====================================================
           PUBLIC — normalize(text, options?)
           ===================================================== */

        /*
         * Normalise a full text string, returning the result.
         * Does NOT return position metadata.
         * Call normalizeToken() when you need indexMap.
         */
        normalize(text, options) {
            if (typeof text !== 'string') {
                return String(text ?? '');
            }

            const opts = { ...DEFAULT_OPTIONS, ...options };
            let s = stripInvisible(text);

            if (opts.normalizeSpaces) {
                s = s.replace(ABNORMAL_SPACES_RE, ' ');
            }

            if (opts.lowercase) {
                s = s.toLocaleLowerCase('ru-RU');
            }

            if (opts.applyLookalikes) {
                s = this._applyLookalikeStr(s);
            }

            if (opts.removeSeparators) {
                /*
                 * Strip [letter] bracket obfuscation before separator
                 * collapsing: п[и]з[д]а → пизда.
                 * Brackets wrapping multiple letters (e.g. [VIP]) are
                 * not affected because the class requires exactly one
                 * letter inside the brackets.
                 */
                s = s.replace(/\[([а-яёa-zA-Z])\]/gi, '$1');
                s = this._normalizeSepsStr(s, opts);
            }

            if (
                opts.collapseRunsThreshold > 0 ||
                opts.collapseVowelDoubles
            ) {
                s = this._collapseRepeatsStr(s, opts);
            }

            return s;
        }


        /* =====================================================
           PUBLIC — normalizeToken(token, options?)
           ===================================================== */

        /*
         * Normalise a single token with full position metadata.
         *
         * Returns a NormalizeResult:
         *   original       – unchanged input
         *   normalized     – result string
         *   changed        – true if any transform was applied
         *   transformations – ordered log of each change
         *   indexMap        – indexMap[i] = origIndex of normalized[i]
         */
        normalizeToken(token, options) {
            if (typeof token !== 'string') {
                return identityResult(String(token ?? ''));
            }

            if (token === '') {
                return identityResult('');
            }

            const opts = { ...DEFAULT_OPTIONS, ...options };
            const transformations = [];
            const entries = buildEntries(stripInvisible(token));

            if (opts.normalizeSpaces) {
                this._stepSpaceNorm(entries, transformations);
            }

            if (opts.lowercase) {
                this._stepLowercase(entries, transformations);
            }

            if (opts.removeSeparators) {
                this._stepSeparatorRemoval(
                    entries, opts, transformations
                );
            }

            if (opts.applyLookalikes) {
                this._stepLookalikes(entries, transformations);
            }

            if (
                opts.collapseRunsThreshold > 0 ||
                opts.collapseVowelDoubles
            ) {
                this._stepRepeatCollapse(
                    entries, opts, transformations
                );
            }

            const active     = activeOf(entries);
            const normalized = active.map(e => e.char).join('');
            const indexMap   = active.map(e => e.origIndex);

            return {
                original:   token,
                normalized,
                changed:    normalized !== token,
                transformations,
                indexMap,
            };
        }

        normalizeTokenForms(token, options) {
            const forms = [];
            const seen = new Set();

            const pushForm = (kind, value) => {
                if (!value || seen.has(value)) {
                    return;
                }

                seen.add(value);
                forms.push({
                    kind,
                    result: this.normalizeToken(value, options)
                });
            };

            const raw = String(token ?? '');
            pushForm('base', raw);
            pushForm('qwerty-to-cyr', translateLayout(raw, QWERTY_TO_CYR));
            pushForm('cyr-to-qwerty', translateLayout(raw, CYR_TO_QWERTY));

            return forms;
        }


        /* =====================================================
           PUBLIC — debug(text)
           ===================================================== */

        debug(text) {
            const r = this.normalizeToken(String(text ?? ''));

            console.group(
                '[VimeReportTextNormalizer] ' +
                JSON.stringify(r.original)
            );
            console.log(
                '  normalized :', JSON.stringify(r.normalized)
            );
            console.log('  changed    :', r.changed);

            if (r.transformations.length > 0) {
                console.log(
                    '  transforms (' + r.transformations.length + '):'
                );
                r.transformations.forEach((t, i) => {
                    console.log('    [' + i + ']', JSON.stringify(t));
                });
            } else {
                console.log('  transforms : none');
            }

            console.log(
                '  indexMap   : [' + r.indexMap.join(', ') + ']'
            );
            console.groupEnd();

            return r;
        }


        /* =====================================================
           STEP IMPLEMENTATIONS
           ===================================================== */

        _stepSpaceNorm(entries, transformations) {
            entries.forEach(e => {
                if (e.removed) {
                    return;
                }

                if (ABNORMAL_SPACE_CHARS.has(e.char)) {
                    transformations.push({
                        type:          'space-normalization',
                        from:          e.char,
                        originalIndex: e.origIndex,
                    });
                    e.char = ' ';
                }
            });
        }


        _stepLowercase(entries, transformations) {
            entries.forEach(e => {
                if (e.removed) {
                    return;
                }

                const lower = e.char.toLocaleLowerCase('ru-RU');

                if (lower !== e.char) {
                    transformations.push({
                        type:          'lowercase',
                        from:          e.char,
                        to:            lower,
                        originalIndex: e.origIndex,
                    });
                    e.char = lower;
                }
            });
        }


        _stepSeparatorRemoval(entries, opts, transformations) {
            const active = activeOf(entries);

            /*
             * Try non-space separators first.
             * Stop on the first match (one separator type per token).
             */
            for (const sep of NON_SPACE_SEPS) {
                if (
                    looksLikeSeparatedSeq(
                        active, sep, opts.minSeparatedLength
                    )
                ) {
                    entries.forEach(e => {
                        if (!e.removed && e.char === sep) {
                            transformations.push({
                                type:          'separator-removal',
                                from:          sep,
                                originalIndex: e.origIndex,
                            });
                            e.removed = true;
                        }
                    });
                    return;
                }
            }

            /*
             * Try space as separator (token-level only).
             * In normalize() spaces are not collapsed because the
             * string-level helper does not handle space as sep.
             */
            if (
                looksLikeSeparatedSeq(
                    active, ' ', opts.minSeparatedLength
                )
            ) {
                entries.forEach(e => {
                    if (!e.removed && e.char === ' ') {
                        transformations.push({
                            type:          'separator-removal',
                            from:          ' ',
                            originalIndex: e.origIndex,
                        });
                        e.removed = true;
                    }
                });
            }
        }


        _stepLookalikes(entries, transformations) {
            /*
             * Only apply when the token contains Cyrillic so that
             * purely Latin text (hello, world) is left intact.
             */
            if (!isLikelyCyrillicToken(entries)) {
                return;
            }

            entries.forEach(e => {
                if (e.removed) {
                    return;
                }

                const mapped = LOOKALIKE_MAP[e.char];

                if (mapped !== undefined) {
                    transformations.push({
                        type:          'lookalike',
                        from:          e.char,
                        to:            mapped,
                        originalIndex: e.origIndex,
                    });
                    e.char = mapped;
                }
            });
        }


        _stepRepeatCollapse(entries, opts, transformations) {
            const active = activeOf(entries);
            let i = 0;

            while (i < active.length) {
                const ch = active[i].char;

                /* Find the end of this run. */
                let j = i + 1;
                while (j < active.length && active[j].char === ch) {
                    j++;
                }

                const runLen   = j - i;
                const threshold = thresholdFor(ch, opts);

                if (runLen >= threshold) {
                    /*
                     * Keep first occurrence; mark the rest removed.
                     */
                    for (let k = i + 1; k < j; k++) {
                        transformations.push({
                            type:          'repeat-collapse',
                            char:          ch,
                            runLength:     runLen,
                            originalIndex: active[k].origIndex,
                        });
                        active[k].removed = true;
                    }
                }

                i = j;
            }
        }


        /* =====================================================
           STRING-LEVEL HELPERS  (used by normalize())
           ===================================================== */

        _applyLookalikeStr(text) {
            /*
             * Applied to entire string unconditionally at the
             * string level; the per-character guard is not needed
             * here because the caller already decided to apply it.
             * The Cyrillic guard is enforced at the caller level
             * (normalize passes the whole string through once);
             * callers that need the guard should use normalizeToken.
             */
            const result = [];
            for (const ch of text) {
                result.push(LOOKALIKE_MAP[ch] ?? ch);
            }
            return result.join('');
        }


        _normalizeSepsStr(text, opts) {
            /*
             * Detect and collapse separator-obfuscated sequences.
             *
             * Regex:  L sep L (sep L)+
             *   where L   = Cyrillic or Latin letter (single char)
             *   and   sep = same separator throughout
             *               (enforced via backreference \2)
             *
             * Separators: . , - _ / \ and single space.
             * Space is safe here because the backreference enforces
             * CONSISTENT single-char sep throughout the match, and
             * each segment between separators must be exactly one
             * letter — normal multi-letter words cannot trigger this.
             *
             * Minimum 3 letters is enforced in the callback.
             */
            return text.replace(
                /([а-яёa-zA-Z])([-._,/ \\])([а-яёa-zA-Z])(?:\2[а-яёa-zA-Z])+/gi,
                (match, _l1, sep) => {
                    const letters = match.split(sep);
                    if (letters.length < opts.minSeparatedLength) {
                        return match;
                    }
                    return letters.join('');
                }
            );
        }


        _collapseRepeatsStr(text, opts) {
            const chars  = Array.from(text);
            const result = [];
            let i = 0;

            while (i < chars.length) {
                const ch = chars[i];
                let j = i + 1;

                while (j < chars.length && chars[j] === ch) {
                    j++;
                }

                const runLen   = j - i;
                const threshold = thresholdFor(ch, opts);

                if (runLen >= threshold) {
                    result.push(ch); // keep exactly 1
                } else {
                    for (let k = i; k < j; k++) {
                        result.push(chars[k]);
                    }
                }

                i = j;
            }

            return result.join('');
        }

    }


    /* =========================================================
       EXPORT
       ========================================================= */

    window.VimeReportTextNormalizer =
        new VimeReportTextNormalizerImpl();


    console.log(
        '[Vime Report Helper] Text Normalizer (Adaptive Recognition Stage 1A) loaded.'
    );

})();
