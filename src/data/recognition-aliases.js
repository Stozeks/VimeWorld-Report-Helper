(() => {
    'use strict';

    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER — BUILT-IN RECOGNITION KNOWLEDGE
     * =========================================================
     *
     * Отдельный слой встроенных знаний VRH.
     *
     * Это НЕ официальный prohibited-words.txt и НЕ Learning Store.
     * Здесь лежат только поддерживаемые расширением формы:
     *   - частые фразы-обходы;
     *   - компактные алиасы;
     *   - устойчивые варианты написания;
     *   - подсказки для reason tiles.
     *
     * Файл хранит не «огромный словарь», а небольшое количество
     * подтверждённых шаблонов, которые VRH может безопасно
     * применять локально.
     */

    const ALIASES = Object.freeze([
        {
            id: 'insult-mat-go-away',
            canonical: 'иди нахуй',
            reasonId: 'player-insult-mat',
            label: 'Оскорбление игроков + Мат',
            category: 'INSULT_MAT',
            confidence: 0.98,
            aliases: [
                'иди нахуй',
                'иди на хуй',
                'пошел нахуй',
                'пошёл нахуй',
                'пошла нахуй',
                'пошёл на хуй',
                'пошла на хуй'
            ]
        },
        {
            id: 'insult-mat-brainless',
            canonical: 'мозгов нет',
            reasonId: 'player-insult',
            label: 'Оскорбление игроков',
            category: 'INSULT',
            confidence: 0.96,
            aliases: [
                'мозгов нет',
                'без мозгов',
                '0 iq',
                'iq 0'
            ]
        },
        {
            id: 'mat-action',
            canonical: 'членом разорвал',
            reasonId: 'mat-amoral',
            label: 'Мат/Аморал',
            category: 'MAT',
            confidence: 0.97,
            aliases: [
                'членом разорвал',
                'хером разорвал',
                'хуем разорвал',
                'членом порвал',
                'хером порвал',
                'хуем порвал'
            ]
        },
        {
            id: 'mat-family-action',
            canonical: 'мать ебал',
            reasonId: 'player-insult-mat',
            label: 'Оскорбление игроков + Мат',
            category: 'INSULT_MAT',
            confidence: 0.98,
            aliases: [
                'мать ебал',
                'ебал мать',
                'ебал твою мать',
                'ебал твою маму'
            ]
        }
    ]);

    function toText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function normalizeText(value) {
        const normalizer = window.VimeReportTextNormalizer;

        if (normalizer && typeof normalizer.normalize === 'function') {
            try {
                return normalizer.normalize(String(value ?? ''));
            } catch (_) {
                // fallback ниже
            }
        }

        return String(value ?? '')
            .toLowerCase()
            .replace(/\u00a0/g, ' ')
            .trim();
    }

    function compactKey(value) {
        return normalizeText(value)
            .replace(/[^a-zа-яё0-9]+/gi, '');
    }

    function normalizedKey(value) {
        return normalizeText(value).trim();
    }

    function unique(list) {
        return [...new Set(list.filter(Boolean))];
    }

    function buildAliasIndex() {
        const index = new Map();

        for (const entry of ALIASES) {
            const rawAliases = unique([
                entry.canonical,
                ...(Array.isArray(entry.aliases) ? entry.aliases : [])
            ].map(toText).filter(Boolean));

            index.set(entry.id, {
                ...entry,
                rawAliases
            });
        }

        return index;
    }

    const ALIAS_INDEX = buildAliasIndex();

    function getDictionaryWords() {
        return unique(
            ALIASES.flatMap((entry) => [
                entry.canonical,
                ...(Array.isArray(entry.aliases) ? entry.aliases : [])
            ])
        );
    }

    const WORD_SET = new Set(getDictionaryWords().map(compactKey));

    function hasWord(value) {
        return WORD_SET.has(compactKey(value));
    }

    function findMatches(text) {
        const normalized = normalizeText(text);
        const compact = compactKey(text);
        const matches = [];

        if (!normalized || !compact) {
            return matches;
        }

        for (const entry of ALIAS_INDEX.values()) {
            const hit = entry.rawAliases.find((alias) => {
                const aliasNormalized = normalizedKey(alias);
                const aliasCompact = compactKey(alias);

                if (!aliasCompact || !aliasNormalized) {
                    return false;
                }

                return normalized === aliasNormalized || compact === aliasCompact;
            });

            if (!hit) {
                continue;
            }

            matches.push({
                id: entry.id,
                canonical: entry.canonical,
                category: entry.category,
                reasonId: entry.reasonId,
                label: entry.label,
                confidence: entry.confidence,
                alias: hit,
                matchedText: hit,
                matchType: hit === entry.canonical ? 'canonical' : 'alias'
            });
        }

        return matches;
    }

    function getStatus() {
        return {
            ready: true,
            aliasCount: ALIAS_INDEX.size,
            aliasForms: getDictionaryWords().length
        };
    }

    window.VimeReportRecognitionAliases = Object.freeze({
        entries: ALIASES,
        getDictionaryWords,
        hasWord,
        findMatches,
        getStatus,
        normalizeText,
        compactKey
    });
})();
