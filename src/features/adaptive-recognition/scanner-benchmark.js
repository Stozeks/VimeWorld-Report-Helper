(() => {
    'use strict';

    const PRIORITY = ['player-insult-mat', 'player-insult', 'mat-amoral'];

    function dep(name) {
        return window[name] ?? null;
    }

    function makeMessage(text, index, author) {
        const message = {
            index: index,
            time: '00:00:0' + Math.min(index, 9),
            text: text
        };

        if (author !== undefined) {
            message.author = author;
        }

        return message;
    }

    function pickBestRecommendation(recommendations) {
        if (!Array.isArray(recommendations) || !recommendations.length) {
            return null;
        }

        const byId = new Map();
        recommendations.forEach((item) => {
            if (item?.reasonId) {
                byId.set(item.reasonId, item);
            }
        });

        for (const reasonId of PRIORITY) {
            if (byId.has(reasonId)) {
                return byId.get(reasonId);
            }
        }

        return recommendations[0];
    }

    function createWordCases(prefix, group, entries, expectedCategory, expectedDetected, difficulty) {
        return entries.map((entry, index) => {
            const item = Array.isArray(entry)
                ? {
                    input: entry[0],
                    difficulty: entry[1],
                    notes: entry[2] ?? ''
                }
                : entry;

            return {
                id: prefix + '-' + String(index + 1).padStart(2, '0'),
                group,
                mode: 'scan',
                input: item.input,
                expectedDetected,
                expectedCategory: item.expectedCategory ?? expectedCategory,
                expectedTarget: null,
                difficulty: item.difficulty ?? difficulty,
                notes: item.notes ?? ''
            };
        });
    }

    function buildCases() {
        const directMat = createWordCases('direct-mat', 'DIRECT_MAT', [
            ['блять', 'EASY', 'clear profanity'],
            ['блядь', 'EASY', 'clear profanity'],
            ['сука', 'EASY', 'direct profane form'],
            ['сучара', 'MEDIUM', 'profane derivative'],
            ['пизда', 'EASY', 'direct profanity'],
            ['пиздец', 'EASY', 'direct profanity'],
            ['ебать', 'EASY', 'direct profanity'],
            ['ебаный', 'MEDIUM', 'inflected profanity'],
            ['ебучий', 'MEDIUM', 'inflected profanity'],
            ['хуй', 'EASY', 'direct profanity'],
            ['хуйня', 'MEDIUM', 'root-level profanity'],
            ['fuck', 'EASY', 'english profanity'],
            ['shit', 'EASY', 'english profanity'],
            ['bitch', 'EASY', 'english profanity'],
            ['asshole', 'EASY', 'english profanity'],
            ['motherfucker', 'HARD', 'english profanity']
        ], 'mat-amoral', true);

        const directInsult = createWordCases('direct-insult', 'DIRECT_INSULT', [
            ['дебил', 'EASY', 'clear insult'],
            ['идиот', 'EASY', 'clear insult'],
            ['тупой', 'EASY', 'clear insult'],
            ['кретин', 'EASY', 'clear insult'],
            ['мразь', 'EASY', 'clear insult'],
            ['урод', 'EASY', 'clear insult'],
            ['клоун', 'EASY', 'clear insult'],
            ['безмозглый', 'MEDIUM', 'clear insult'],
            ['нуб', 'EASY', 'game insult'],
            ['лох', 'EASY', 'clear insult'],
            ['обезьяна', 'MEDIUM', 'clear insult'],
            ['бездарь', 'MEDIUM', 'clear insult'],
            ['тормоз', 'MEDIUM', 'clear insult'],
            ['днище', 'MEDIUM', 'clear insult'],
            ['позорище', 'MEDIUM', 'clear insult'],
            ['жалкий', 'MEDIUM', 'clear insult']
        ], 'player-insult', true);

        const insultMat = createWordCases('insult-mat', 'INSULT_MAT', [
            ['дебил блять', 'EASY', 'insult + profanity'],
            ['тупой сука', 'EASY', 'insult + profanity'],
            ['урод, блять', 'EASY', 'insult + profanity'],
            ['идиот, нахуй', 'EASY', 'insult + profanity'],
            ['клоун еблан', 'MEDIUM', 'insult + profanity'],
            ['мразь ебучая', 'MEDIUM', 'insult + profanity'],
            ['ебаный кретин', 'MEDIUM', 'insult + profanity'],
            ['пидор сука', 'MEDIUM', 'insult + profanity'],
            ['долбоеб', 'MEDIUM', 'compound insult'],
            ['ебаная мразь', 'MEDIUM', 'insult + profanity']
        ], 'player-insult-mat', true);

        const amoral = createWordCases('amoral', 'AMORAL', [
            ['шлюха', 'EASY', 'supported amoral category'],
            ['шлюшка', 'EASY', 'supported amoral category'],
            ['проститутка', 'EASY', 'supported amoral category'],
            ['минет', 'EASY', 'supported amoral category'],
            ['секс', 'EASY', 'supported amoral category'],
            ['порно', 'EASY', 'supported amoral category'],
            ['голая', 'EASY', 'supported amoral category'],
            ['blowjob', 'HARD', 'supported amoral category']
        ], 'mat-amoral', true);

        const obfuscation = createWordCases('obfuscation', 'OBFUSCATION', [
            ['п и з д а', 'EASY', 'spaces inside word'],
            ['п-и-з-д-а', 'EASY', 'dashes inside word'],
            ['п.и.з.д.а', 'EASY', 'dots inside word'],
            ['п,и,з,д,а', 'EASY', 'commas inside word'],
            ['п/и/з/д/а', 'MEDIUM', 'slashes inside word'],
            ['п\\и\\з\\д\\а', 'MEDIUM', 'backslashes inside word'],
            ['п[и]з[д]а', 'MEDIUM', 'brackets inside word'],
            ['п1зда', 'MEDIUM', 'digit substitution'],
            ['пид0р', 'MEDIUM', 'digit substitution'],
            ['д0лбoеб', 'HARD', 'mixed digits and Latin'],
            ['gbljh', 'MEDIUM', 'layout substitution'],
            ['еб@нный', 'HARD', 'symbol substitution'],
            ['сyкa', 'MEDIUM', 'mixed scripts'],
            ['хуЙ', 'EASY', 'case mix'],
            ['шллюха', 'MEDIUM', 'repeated consonant'],
            ['пиiiзда', 'MEDIUM', 'repeated letters'],
            ['дебииил', 'MEDIUM', 'repeated letters'],
            ['п\u200bи\u200bз\u200bд\u200bа', 'HARD', 'zero-width separators']
        ], 'mat-amoral', true);

        const splitWord = createWordCases('split-word', 'SPLIT_WORD', [
            { input: 'п и з д а', difficulty: 'EASY', notes: 'space-separated letters', expectedCategory: 'mat-amoral' },
            { input: 'х у й', difficulty: 'EASY', notes: 'space-separated letters', expectedCategory: 'mat-amoral' },
            { input: 'д е б и л', difficulty: 'EASY', notes: 'space-separated letters', expectedCategory: 'player-insult' },
            { input: 'м о з г о в н е т', difficulty: 'MEDIUM', notes: 'space-separated phrase', expectedCategory: 'player-insult' },
            { input: 'ч л е н о м р а з о р в а л', difficulty: 'HARD', notes: 'long split phrase', expectedCategory: 'mat-amoral' },
            { input: 'п  и  з  д  а', difficulty: 'EASY', notes: 'repeated spaces', expectedCategory: 'mat-amoral' },
            { input: 'п - и - з - д - а', difficulty: 'EASY', notes: 'punctuated split', expectedCategory: 'mat-amoral' },
            { input: 'е б а л  м а т ь', difficulty: 'MEDIUM', notes: 'split insult + profanity', expectedCategory: 'player-insult-mat' },
            { input: 'м о з г о в   н е т', difficulty: 'MEDIUM', notes: 'repeated spaces', expectedCategory: 'player-insult' },
            { input: 'х . у . й', difficulty: 'EASY', notes: 'punctuated split', expectedCategory: 'mat-amoral' }
        ], 'mat-amoral', true);

        const crossMessage = [
            {
                id: 'cross-message-01',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    makeMessage('иди на', 0, 'alpha'),
                    makeMessage('хуй', 1, 'alpha')
                ],
                expectedDetected: true,
                expectedCategory: 'player-insult-mat',
                expectedTarget: null,
                difficulty: 'EASY',
                notes: 'same author split phrase'
            },
            {
                id: 'cross-message-02',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    makeMessage('мозгов', 0, 'alpha'),
                    makeMessage('нет', 1, 'alpha')
                ],
                expectedDetected: true,
                expectedCategory: 'player-insult',
                expectedTarget: null,
                difficulty: 'EASY',
                notes: 'same author alias split'
            },
            {
                id: 'cross-message-03',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    makeMessage('ебал', 0, 'alpha'),
                    makeMessage('мать', 1, 'alpha')
                ],
                expectedDetected: true,
                expectedCategory: 'player-insult-mat',
                expectedTarget: null,
                difficulty: 'MEDIUM',
                notes: 'same author alias split'
            },
            {
                id: 'cross-message-04',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    makeMessage('членом', 0, 'alpha'),
                    makeMessage('разорвал', 1, 'alpha')
                ],
                expectedDetected: true,
                expectedCategory: 'mat-amoral',
                expectedTarget: null,
                difficulty: 'MEDIUM',
                notes: 'same author alias split'
            },
            {
                id: 'cross-message-05',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    makeMessage('пошел', 0, 'alpha'),
                    makeMessage('нахуй', 1, 'alpha')
                ],
                expectedDetected: true,
                expectedCategory: 'player-insult-mat',
                expectedTarget: null,
                difficulty: 'EASY',
                notes: 'same author alias split'
            },
            {
                id: 'cross-message-06',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    makeMessage('иди на', 0, 'alpha'),
                    makeMessage('хуй', 1, 'beta')
                ],
                expectedDetected: false,
                expectedCategory: null,
                expectedTarget: null,
                difficulty: 'EASY',
                notes: 'different authors must fail closed'
            },
            {
                id: 'cross-message-07',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    makeMessage('иди на', 0),
                    makeMessage('хуй', 1)
                ],
                expectedDetected: false,
                expectedCategory: null,
                expectedTarget: null,
                difficulty: 'EASY',
                notes: 'unknown authors must fail closed'
            },
            {
                id: 'cross-message-08',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    { index: 0, time: '00:00:01', text: 'иди на', author: 'alpha' },
                    { index: 1, time: '00:00:02', text: 'хуй', username: 'alpha' }
                ],
                expectedDetected: false,
                expectedCategory: null,
                expectedTarget: null,
                difficulty: 'HARD',
                notes: 'ambiguous author fields must fail closed'
            },
            {
                id: 'cross-message-09',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    makeMessage('мозгов', 0, 'alpha'),
                    makeMessage('нет', 1, 'beta')
                ],
                expectedDetected: false,
                expectedCategory: null,
                expectedTarget: null,
                difficulty: 'EASY',
                notes: 'different authors split alias'
            },
            {
                id: 'cross-message-10',
                group: 'CROSS_MESSAGE',
                mode: 'cross',
                messages: [
                    makeMessage('иди', 0, 'alpha'),
                    makeMessage('на', 1, 'alpha'),
                    makeMessage('хуй', 2, 'alpha')
                ],
                expectedDetected: true,
                expectedCategory: 'player-insult-mat',
                expectedTarget: null,
                difficulty: 'HARD',
                notes: 'three-message same-author split'
            }
        ];

        const context = [
            { id: 'context-01', text: 'моя мама играет', expectedDetected: true, expectedTarget: 'self', difficulty: 'EASY', notes: 'self-relative mention' },
            { id: 'context-02', text: 'твоя мама играет', expectedDetected: true, expectedTarget: 'other', difficulty: 'EASY', notes: 'second-person relative mention' },
            { id: 'context-03', text: 'его отец дома', expectedDetected: true, expectedTarget: 'third-person', difficulty: 'EASY', notes: 'third-person relative mention' },
            { id: 'context-04', text: 'её сестра пришла', expectedDetected: true, expectedTarget: 'third-person', difficulty: 'EASY', notes: 'third-person relative mention' },
            { id: 'context-05', text: 'мой дедушка спит', expectedDetected: true, expectedTarget: 'self', difficulty: 'EASY', notes: 'self-relative mention' },
            { id: 'context-06', text: 'у тебя мать дома', expectedDetected: true, expectedTarget: 'other', difficulty: 'MEDIUM', notes: 'second-person relative mention' },
            { id: 'context-07', text: 'твой брат играет', expectedDetected: true, expectedTarget: 'other', difficulty: 'MEDIUM', notes: 'second-person relative mention' },
            { id: 'context-08', text: 'братан ты где', expectedDetected: false, expectedTarget: 'unknown', difficulty: 'EASY', notes: 'colloquial address only' },
            { id: 'context-09', text: 'семья играет вместе', expectedDetected: false, expectedTarget: 'unknown', difficulty: 'EASY', notes: 'harmless family mention' },
            { id: 'context-10', text: 'родители в сборе', expectedDetected: false, expectedTarget: 'unknown', difficulty: 'EASY', notes: 'neutral family mention' }
        ].map((item) => ({
            id: item.id,
            group: 'CONTEXT',
            mode: 'context',
            text: item.text,
            expectedDetected: item.expectedDetected,
            expectedCategory: null,
            expectedTarget: item.expectedTarget,
            difficulty: item.difficulty,
            notes: item.notes
        }));

        const falsePositiveTraps = [
            'привет всем',
            'добрый вечер',
            'я в лобби',
            'игрок вышел из игры',
            'построил дом',
            'поменял скин',
            'модератор проверил репорт',
            'сервер перезагрузился',
            'крипер взорвался',
            'эндермен телепортировался',
            'блокировка чата',
            'планшет разрядился',
            'технический долг',
            'модель данных',
            'репорт отклонён',
            'монитор 144hz',
            'документ сохранён',
            'команда работает',
            'пишу код',
            'сидим в дискорде',
            'майнкрафт обновился',
            'у меня классный дом',
            'сегодня иду в школу',
            'коробка с вещами',
            'пинг высокий',
            'A1exR_',
            'xXx_HeroBriN_xXx',
            'http://example.com',
            'https://example.org/report',
            'херсон это город',
            'херобрин легенда майна',
            'пизанская башня',
            'пиджак на вешалке',
            'суккулент на окне',
            'шлюз открыт',
            'педагог пришёл',
            'передача данных',
            'система охлаждения',
            'клавиатура русская',
            'обсуждаем сервер',
            'играю на карте',
            'у меня новая мышь',
            'городской маршрут',
            'светлая комната',
            'вчера была учёба',
            'pрiвет',
            'ghbdtn all'
        ].map((text, index) => ({
            id: 'fp-trap-' + String(index + 1).padStart(2, '0'),
            group: 'FALSE_POSITIVE_TRAPS',
            mode: 'scan',
            input: text,
            expectedDetected: false,
            expectedCategory: null,
            expectedTarget: null,
            difficulty: 'EASY',
            notes: 'benign trap'
        }));

        const nearMiss = [
            'рама',
            'масса',
            'том',
            'рот',
            'банка',
            'привод',
            'мамка',
            'дача',
            'темка',
            'слон'
        ].map((text, index) => ({
            id: 'near-miss-' + String(index + 1).padStart(2, '0'),
            group: 'NEAR_MISS',
            mode: 'scan',
            input: text,
            expectedDetected: false,
            expectedCategory: null,
            expectedTarget: null,
            difficulty: 'MEDIUM',
            notes: 'close but safe'
        }));

        const adversarial = [
            { text: 'п0-и-з-д-а', expectedDetected: true, expectedCategory: 'mat-amoral', difficulty: 'HARD', notes: 'digit + punctuation mix' },
            { text: 'д0лбoеб', expectedDetected: true, expectedCategory: 'player-insult-mat', difficulty: 'HARD', notes: 'mixed digit and Latin obfuscation' },
            { text: 'еб@нный', expectedDetected: true, expectedCategory: 'mat-amoral', difficulty: 'HARD', notes: 'symbol substitution' },
            { text: 'пи3дa', expectedDetected: true, expectedCategory: 'mat-amoral', difficulty: 'MEDIUM', notes: 'digit substitution and Latin tail' },
            { text: 'гbljh', expectedDetected: true, expectedCategory: 'player-insult', difficulty: 'HARD', notes: 'layout-like mix' },
            { text: 'п\\и\\з\\д\\а', expectedDetected: true, expectedCategory: 'mat-amoral', difficulty: 'HARD', notes: 'backslash separators' },
            { text: 'сyкa', expectedDetected: true, expectedCategory: 'mat-amoral', difficulty: 'MEDIUM', notes: 'mixed scripts' },
            { text: 'тyп0й', expectedDetected: true, expectedCategory: 'player-insult', difficulty: 'HARD', notes: 'mixed scripts and digit' },
            { text: 'херобрин', expectedDetected: false, expectedCategory: null, difficulty: 'EASY', notes: 'substring trap' },
            { text: 'qwe asd zxc', expectedDetected: false, expectedCategory: null, difficulty: 'EASY', notes: 'benign keyboard noise' }
        ].map((item, index) => ({
            id: 'adversarial-' + String(index + 1).padStart(2, '0'),
            group: 'ADVERSARIAL_COMBINATIONS',
            mode: 'scan',
            input: item.text,
            expectedDetected: item.expectedDetected,
            expectedCategory: item.expectedCategory,
            expectedTarget: null,
            difficulty: item.difficulty,
            notes: item.notes
        }));

        return [
            ...directMat,
            ...directInsult,
            ...insultMat,
            ...obfuscation,
            ...splitWord,
            ...crossMessage,
            ...context,
            ...amoral,
            ...falsePositiveTraps,
            ...nearMiss,
            ...adversarial
        ];
    }

    function evaluateCase(tc) {
        const scanner = dep('VimeReportViolationScanner');
        const rules = dep('VimeReportViolationRules');
        const contextDetector = dep('VimeReportRelativeContextDetector');
        const abuseDetector = dep('VimeReportRelativeAbuseDetector');

        if (!scanner || !rules) {
            return {
                ...tc,
                status: 'SKIP',
                reason: 'scanner-unavailable'
            };
        }

        const prohibitedWords = window.VimeReportProhibitedWords ?? [];
        const prohibitedRoots = window.VimeReportProhibitedRoots ?? [];

        if (tc.mode === 'context') {
            if (!contextDetector || typeof contextDetector.analyzeMessage !== 'function') {
                return {
                    ...tc,
                    status: 'SKIP',
                    reason: 'context-detector-unavailable'
                };
            }

            const message = makeMessage(tc.text, 0, 'alpha');
            const contextResult = contextDetector.analyzeMessage(message);
            const abuseResults =
                abuseDetector && typeof abuseDetector.analyzeMessage === 'function'
                    ? abuseDetector.analyzeMessage(message)
                    : [];

            const actualDetected = Boolean(contextResult?.detected);
            const actualTarget =
                contextResult?.target ??
                contextResult?.relatives?.[0]?.target ??
                contextResult?.parentImplications?.[0]?.target ??
                'unknown';

            return {
                ...tc,
                input: tc.text,
                actualDetected,
                actualCategory: null,
                actualTarget,
                actualMethod: actualDetected ? 'relative-context' : 'none',
                actualConfidence: contextResult?.confidence ?? null,
                matchedToken: contextResult?.relatives?.[0]?.relativeText ?? null,
                matchedRule: abuseResults[0]?.abuseType ?? null,
                matchedAlias: null,
                status: actualDetected === tc.expectedDetected &&
                    actualTarget === tc.expectedTarget
                    ? 'PASS'
                    : 'FAIL',
                failureType: actualDetected !== tc.expectedDetected
                    ? (tc.expectedDetected ? 'FALSE_NEGATIVE' : 'FALSE_POSITIVE')
                    : null,
                categoryError: false
            };
        }

        if (tc.mode === 'cross') {
            const knowledge = scanner._buildCrossMessageKnowledge(
                tc.messages,
                prohibitedWords
            ) ?? { descriptors: [], recommendations: [] };

            const directRecommendations = scanner.buildRecommendations(tc.messages);
            const mergedRecommendations = [
                ...directRecommendations
            ];

            (knowledge.recommendations ?? []).forEach((item) => {
                const existing = mergedRecommendations.find((entry) => entry.reasonId === item.reasonId);
                if (existing) {
                    existing.count += item.count;
                    return;
                }
                mergedRecommendations.push({
                    reasonId: item.reasonId,
                    label: item.label,
                    count: item.count,
                    examples: []
                });
            });

            const topRecommendation = pickBestRecommendation(mergedRecommendations);
            const actualDetected = (knowledge.descriptors ?? []).length > 0;
            const actualCategory = topRecommendation?.reasonId ?? null;
            const matchedDescriptor = (knowledge.descriptors ?? [])[0] ?? null;

            const categoryError =
                actualDetected &&
                tc.expectedCategory &&
                actualCategory !== tc.expectedCategory;

            return {
                ...tc,
                input: tc.messages.map((m) => m.text).join(' | '),
                actualDetected,
                actualCategory,
                actualTarget: null,
                actualMethod: actualDetected ? 'cross-message' : 'none',
                actualConfidence: topRecommendation?.count ?? null,
                matchedToken: matchedDescriptor?._meta?.originalToken ?? null,
                matchedRule: actualCategory,
                matchedAlias: matchedDescriptor?._meta?.aliasId ?? null,
                status: actualDetected === tc.expectedDetected && !categoryError
                    ? 'PASS'
                    : 'FAIL',
                failureType: actualDetected !== tc.expectedDetected
                    ? (tc.expectedDetected ? 'FALSE_NEGATIVE' : 'FALSE_POSITIVE')
                    : categoryError
                        ? 'CATEGORY_ERROR'
                        : null,
                categoryError
            };
        }

        const message = makeMessage(tc.input, 0, 'alpha');
        const scanMatches = scanner.scanMessage(message, prohibitedWords, prohibitedRoots);
        const recommendations = scanner.buildRecommendations([message]);
        const topRecommendation = pickBestRecommendation(recommendations);
        const classification = rules.classifyMessage(tc.input);

        const actualDetected = scanMatches.length > 0;
        const actualCategory = topRecommendation?.reasonId ?? null;
        const matched = scanMatches[0] ?? null;
        const categoryError =
            actualDetected &&
            tc.expectedCategory &&
            actualCategory !== tc.expectedCategory;

        return {
            ...tc,
            actualDetected,
            actualCategory,
            actualTarget: null,
            actualMethod: matched?.matchMode ?? 'none',
            actualConfidence: classification?.confidence ?? null,
            matchedToken: matched?.matchedText ?? matched?.word ?? null,
            matchedRule: matched?.word ?? null,
            matchedAlias: window.VimeReportRecognitionAliases?.hasWord?.(matched?.word) ? matched?.word : null,
            classificationType: classification?.type ?? null,
            classificationReasonId: classification?.reason?.reasonId ?? null,
            classificationLabel: classification?.reason?.label ?? null,
            status: actualDetected === tc.expectedDetected && !categoryError
                ? 'PASS'
                : 'FAIL',
            failureType: actualDetected !== tc.expectedDetected
                ? (tc.expectedDetected ? 'FALSE_NEGATIVE' : 'FALSE_POSITIVE')
                : categoryError
                    ? 'CATEGORY_ERROR'
                    : null,
            categoryError
        };
    }

    function summarize(results) {
        const total = results.length;
        const passed = results.filter((r) => r.status === 'PASS').length;
        const failed = total - passed;
        const falsePositives = results.filter((r) => r.failureType === 'FALSE_POSITIVE').length;
        const falseNegatives = results.filter((r) => r.failureType === 'FALSE_NEGATIVE').length;
        const categoryErrors = results.filter((r) => r.failureType === 'CATEGORY_ERROR').length;
        const correctDetections = results.filter(
            (r) => r.expectedDetected === r.actualDetected
        ).length;
        const truePositives = results.filter((r) => r.expectedDetected && r.actualDetected).length;
        const predictedPositives = results.filter((r) => r.actualDetected).length;
        const actualPositives = results.filter((r) => r.expectedDetected).length;

        const accuracy = total > 0 ? ((passed / total) * 100) : 0;
        const precision = predictedPositives > 0 ? ((truePositives / predictedPositives) * 100) : 0;
        const recall = actualPositives > 0 ? ((truePositives / actualPositives) * 100) : 0;

        const byGroup = {};
        results.forEach((r) => {
            if (!byGroup[r.group]) {
                byGroup[r.group] = { total: 0, pass: 0, fail: 0 };
            }
            byGroup[r.group].total++;
            if (r.status === 'PASS') {
                byGroup[r.group].pass++;
            } else {
                byGroup[r.group].fail++;
            }
        });

        return {
            total,
            pass: passed,
            fail: failed,
            falsePositives,
            falseNegatives,
            categoryErrors,
            accuracy: +accuracy.toFixed(2),
            precision: +precision.toFixed(2),
            recall: +recall.toFixed(2),
            correctDetections,
            byGroup,
            cases: results
        };
    }

    class VimeReportScannerBenchmarkImpl {
        constructor() {
            this._lastSummary = null;
            this._cases = buildCases();
        }

        getStatus() {
            return {
                ready: true,
                cases: this._cases.length
            };
        }

        run() {
            const results = this._cases.map((tc) => evaluateCase(tc));
            const summary = summarize(results);
            this._lastSummary = summary;

            const interesting = results.filter(
                (r) => r.status !== 'PASS' || r.categoryError
            );

            console.group('VRH SCANNER BENCHMARK');
            console.log(`TOTAL: ${summary.total}`);
            console.log(`PASS: ${summary.pass}`);
            console.log(`FAIL: ${summary.fail}`);
            console.log(`FALSE POSITIVES: ${summary.falsePositives}`);
            console.log(`FALSE NEGATIVES: ${summary.falseNegatives}`);
            console.log(`CATEGORY ERRORS: ${summary.categoryErrors}`);
            console.log(`ACCURACY: ${summary.accuracy}%`);
            console.log(`PRECISION: ${summary.precision}%`);
            console.log(`RECALL: ${summary.recall}%`);
            console.log('BY GROUP:', summary.byGroup);
            if (interesting.length && typeof console.table === 'function') {
                console.table(interesting.map((r) => ({
                    id: r.id,
                    group: r.group,
                    difficulty: r.difficulty,
                    input: r.input,
                    expectedDetected: r.expectedDetected,
                    actualDetected: r.actualDetected,
                    expectedCategory: r.expectedCategory ?? '—',
                    actualCategory: r.actualCategory ?? '—',
                    expectedTarget: r.expectedTarget ?? '—',
                    actualTarget: r.actualTarget ?? '—',
                    method: r.actualMethod ?? '—',
                    confidence: r.actualConfidence ?? '—',
                    matchedToken: r.matchedToken ?? '—',
                    matchedRule: r.matchedRule ?? '—',
                    matchedAlias: r.matchedAlias ?? '—',
                    failureType: r.failureType ?? '—'
                })));
            }
            console.groupEnd();

            return summary;
        }

        summary() {
            return this._lastSummary ?? { ran: false };
        }
    }

    window.VimeReportScannerBenchmark = new VimeReportScannerBenchmarkImpl();
})();
