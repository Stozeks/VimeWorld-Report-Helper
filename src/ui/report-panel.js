(() => {
    'use strict';

    const PANEL_ID = 'vrh-report-panel';

    const MULTIPLE_REASON =
        'Многочисленные нарушения';

    const MULTIPLE_REASON_THRESHOLD =
        5;


    /* =========================================================
       PUNISHMENT GROUPS
       ========================================================= */

    const PUNISHMENT_GROUPS = {
        'inappropriate-behaviour': {
            outputReason:
                'Неадекватное поведение',

            maxMinutes:
                1440
        }
    };


    /* =========================================================
       OFFICIAL VIMEWORLD REASONS
       ========================================================= */

    const REASON_DEFINITIONS = [

        {
            id: 'flood',
            label: 'Flood',
            outputReason: 'Flood',
            minutes: 60,
            severity: 'standard',
            repeatable: false
        },

        {
            id: 'flood-symbols',
            label: 'Flood символами',
            outputReason: 'Flood символами',
            minutes: 60,
            severity: 'standard',
            repeatable: false
        },

        {
            id: 'caps-lock',
            label: 'Caps Lock',
            outputReason: 'Caps Lock',
            minutes: 60,
            severity: 'standard',
            repeatable: false
        },

        {
            id: 'voting',
            label: 'Голосование',
            outputReason: 'Голосование',
            minutes: 60,
            severity: 'standard',
            repeatable: false
        },


        /* =====================================================
           НЕАДЕКВАТНОЕ ПОВЕДЕНИЕ
           ===================================================== */

        {
            id: 'mat-amoral',

            label:
                'Мат/Аморал',

            group:
                'inappropriate-behaviour',

            outputReason:
                'Неадекватное поведение',

            minutes:
                120,

            severity:
                'standard',

            repeatable:
                true
        },

        {
            id:
                'player-insult',

            label:
                'Оскорбление игроков',

            group:
                'inappropriate-behaviour',

            outputReason:
                'Неадекватное поведение',

            minutes:
                240,

            severity:
                'standard',

            repeatable:
                true
        },

        {
            id:
                'player-insult-mat',

            label:
                'Оскорбление игроков + Мат',

            group:
                'inappropriate-behaviour',

            outputReason:
                'Неадекватное поведение',

            minutes:
                360,

            severity:
                'standard',

            repeatable:
                true
        },


        /* =====================================================
           STAFF / PROJECT
           ===================================================== */

        {
            id:
                'relative-insult',

            label:
                'Оскорбление родственников',

            outputReason:
                'Оскорбление родственников',

            minutes: 2880,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'staff-insult',

            label:
                'Оскорбление Персонала',

            outputReason:
                'Оскорбление Персонала',

            minutes: 2880,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'staff-disrespect',

            label:
                'Неуважительное общение с Персоналом',

            outputReason:
                'Неуважительное общение с Персоналом',

            minutes: 2880,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'administration-insult',

            label:
                'Оскорбление Администрации',

            outputReason:
                'Оскорбление Администрации',

            minutes: 2880,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'administration-disrespect',

            label:
                'Неуважительное общение с Администрацией',

            outputReason:
                'Неуважительное общение с Администрацией',

            minutes: 2880,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'project-insult',

            label:
                'Оскорбление проекта',

            outputReason:
                'Оскорбление проекта',

            minutes: 43200,
            severity: 'standard',
            repeatable: false
        },


        /* =====================================================
           IMPERSONATION / ADVERTISING
           ===================================================== */

        {
            id:
                'staff-impersonation',

            label:
                'Выдача себя за Персонал',

            outputReason:
                'Выдача себя за Персонал',

            minutes: 2880,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'administration-impersonation',

            label:
                'Выдача себя за Администрацию',

            outputReason:
                'Выдача себя за Администрацию',

            minutes: 10080,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'third-party-promotion',

            label:
                'Пиар сторонних ресурсов',

            outputReason:
                'Пиар сторонних ресурсов',

            minutes: 2880,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'project-advertising',

            label:
                'Реклама другого проекта',

            outputReason:
                'Реклама другого проекта',

            minutes: 10080,
            severity: 'standard',
            repeatable: false
        },


        /* =====================================================
           OTHER
           ===================================================== */

        {
            id:
                'offtopic',

            label:
                'Оффтоп',

            outputReason:
                'Оффтоп',

            minutes: 1440,
            severity: 'standard',
            repeatable: false
        },

        /*
         * Пока оставляем значение
         * как в рабочем старом Tool.
         */
        {
            id:
                'political-agitation',

            label:
                'Политическая агитация',

            outputReason:
                'Политическая агитация',

            minutes: 2880,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'player-deception',

            label:
                'Обман игроков',

            outputReason:
                'Обман игроков',

            minutes: 240,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'suicide-call',

            label:
                'Призыв к суициду',

            outputReason:
                'Призыв к суициду',

            minutes: 240,
            severity: 'standard',
            repeatable: false
        },


        /* =====================================================
           VIMERS
           ===================================================== */

        {
            id:
                'vimer-selling',

            label:
                'Продажа вимеров',

            outputReason:
                'Продажа вимеров',

            minutes: 21600,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'vimer-buying',

            label:
                'Покупка вимеров',

            outputReason:
                'Покупка вимеров',

            minutes: 21600,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'services-for-vimers',

            label:
                'Продажа услуг за вимеры',

            outputReason:
                'Продажа услуг за вимеры',

            minutes: 21600,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'non-game-items-for-vimers',

            label:
                'Продажа неигровых вещей за вимеры',

            outputReason:
                'Продажа неигровых вещей за вимеры',

            minutes: 21600,
            severity: 'standard',
            repeatable: false
        },


        /* =====================================================
           REAL MONEY
           ===================================================== */

        {
            id:
                'items-for-real-money',

            label:
                'Продажа вещей за реальные деньги',

            outputReason:
                'Продажа вещей за реальные деньги',

            minutes: 43200,
            severity: 'standard',
            repeatable: false
        },

        {
            id:
                'services-for-real-money',

            label:
                'Продажа услуг за реальные деньги',

            outputReason:
                'Продажа услуг за реальные деньги',

            minutes: 43200,
            severity: 'standard',
            repeatable: false
        },


        /* =====================================================
           BAN REQUIRED
           ===================================================== */

        {
            id:
                'account-selling',

            label:
                'Продажа аккаунта',

            outputReason:
                'Продажа аккаунта',

            minutes: 1440,
            severity: 'critical',
            repeatable: false
        },

        {
            id:
                'account-buying',

            label:
                'Покупка аккаунта',

            outputReason:
                'Покупка аккаунта',

            minutes: 1440,
            severity: 'critical',
            repeatable: false
        },

        {
            id:
                'account-transfer',

            label:
                'Передача аккаунта',

            outputReason:
                'Передача аккаунта',

            minutes: 1440,
            severity: 'critical',
            repeatable: false
        },

        {
            id:
                'drug-propaganda',

            label:
                'Пропаганда наркотиков',

            outputReason:
                'Пропаганда наркотиков',

            minutes: 1440,
            severity: 'critical',
            repeatable: false
        },

        {
            id:
                'fascism-propaganda',

            label:
                'Пропаганда фашизма',

            outputReason:
                'Пропаганда фашизма',

            minutes: 1440,
            severity: 'critical',
            repeatable: false
        },

        {
            id:
                'player-provocation',

            label:
                'Провокация игроков',

            outputReason:
                'Провокация игроков',

            minutes: 1440,
            severity: 'critical',
            repeatable: false
        },

        {
            id:
                'cheat-distribution',

            label:
                'Распространение читов',

            outputReason:
                'Распространение читов',

            minutes: 1440,
            severity: 'critical',
            repeatable: false
        },

        {
            id:
                'bug-distribution',

            label:
                'Распространение багов',

            outputReason:
                'Распространение багов',

            minutes: 1440,
            severity: 'critical',
            repeatable: false
        }
    ];


    /* =========================================================
       KEYBOARD LAYOUT
       ========================================================= */

    const ENG_TO_RUS = {
        '`': 'ё',

        q: 'й',
        w: 'ц',
        e: 'у',
        r: 'к',
        t: 'е',
        y: 'н',
        u: 'г',
        i: 'ш',
        o: 'щ',
        p: 'з',

        '[': 'х',
        ']': 'ъ',

        a: 'ф',
        s: 'ы',
        d: 'в',
        f: 'а',
        g: 'п',
        h: 'р',
        j: 'о',
        k: 'л',
        l: 'д',

        ';': 'ж',
        "'": 'э',

        z: 'я',
        x: 'ч',
        c: 'с',
        v: 'м',
        b: 'и',
        n: 'т',
        m: 'ь',

        ',': 'б',
        '.': 'ю',
        '/': '.'
    };


    const RUS_TO_ENG =
        Object.fromEntries(
            Object.entries(
                ENG_TO_RUS
            ).map(
                ([eng, rus]) => [
                    rus,
                    eng
                ]
            )
        );


    /* =========================================================
       PANEL
       ========================================================= */
    const VRH_REASON_ICONS = {
        'Flood': '💬',
        'Flood символами': '💬',
        'Caps Lock': 'Aa',
        'Голосование': '▥',

        'Мат/Аморал': '🎭',
        'Оскорбление игроков': '☹',
        'Оскорбление игроков + Мат': '🎭',
        'Оскорбление родственников': '♟',

        'Оскорбление Персонала': '♟',
        'Неуважительное общение с Персоналом': '♟',

        'Оскорбление Администрации': '♟',
        'Неуважительное общение с Администрацией': '♟',

        'Оскорбление проекта': '◆',

        'Выдача себя за Персонал': '♟',
        'Выдача себя за Администрацию': '♟',

        'Пиар сторонних ресурсов': '🔗',
        'Реклама другого проекта': '📢',

        'Оффтоп': '⊘',
        'Политическая агитация': '⚑',

        'Обман игроков': '●',
        'Призыв к суициду': '⚠',

        'Продажа вимеров': '●',
        'Покупка вимеров': '●',

        'Продажа услуг за вимеры': '◆',
        'Продажа неигровых вещей за вимеры': '◆',

        'Продажа вещей за реальные деньги': '▣',
        'Продажа услуг за реальные деньги': '▣',

        'Продажа аккаунта': '♟',
        'Покупка аккаунта': '🛒',
        'Передача аккаунта': '⇄',

        'Пропаганда наркотиков': '♦',
        'Пропаганда фашизма': '☢',

        'Провокация игроков': '🔥',
        'Распространение читов': '⚙',
        'Распространение багов': '🔧'
    };

    function getReasonIcon(reason) {
        return VRH_REASON_ICONS[reason] || '•';
    }

    class VimeReportPanel {

        constructor() {
            this.panel =
                null;

            this.currentReport =
                null;

            this.mode =
                'manual';

            this.reasonStacks =
                new Map();

            this.groupMinutes =
                new Map();

            this.lastScanResults =
                [];
        }


        /* =====================================================
           CREATE
           ===================================================== */

        create() {
            const existing =
                document.getElementById(
                    PANEL_ID
                );

            if (existing) {
                this.panel =
                    existing;

                return;
            }


            const panel =
                document.createElement(
                    'aside'
                );

            panel.id =
                PANEL_ID;

            panel.className =
                'vrh-panel';


            panel.innerHTML = `

                <div class="vrh-panel__header">

                    <div>

                        <div class="vrh-panel__brand">
                            VimeWorld Report Helper
                        </div>

                        <div
                            id="vrh-panel-mode"
                            class="vrh-panel__subtitle"
                        >
                            Manual Mode
                        </div>

                    </div>


                    <button
                        id="vrh-panel-close"
                        class="vrh-panel__close"
                        type="button"
                        title="Закрыть"
                    >
                        ×
                    </button>

                </div>


                <div
                    id="vrh-ban-warning"
                    class="vrh-ban-warning"
                    hidden
                >
                    ⚠ Требуется бан: после мута передайте нарушение модератору.
                </div>


                <div class="vrh-report-info">

                    <div class="vrh-report-info__item">
                        <span>Репорт</span>
                        <strong id="vrh-report-id">—</strong>
                    </div>

                    <div class="vrh-report-info__item">
                        <span>Нарушитель</span>
                        <strong id="vrh-violator">—</strong>
                    </div>

                    <div class="vrh-report-info__item">
                        <span>Сообщений</span>
                        <strong id="vrh-message-count">—</strong>
                    </div>

                </div>


                <div class="vrh-punishment-controls">

                    <input
                        id="vrh-time"
                        class="vrh-input vrh-input--time"
                        type="text"
                        placeholder="Время"
                        readonly
                    >


                    <input
                        id="vrh-reason"
                        class="vrh-input vrh-input--reason"
                        type="text"
                        placeholder="Причина"
                        readonly
                    >


                    <button
                        id="vrh-copy"
                        class="vrh-action vrh-action--copy"
                        type="button"
                    >
                        COPY
                    </button>


                    <button
                        id="vrh-reset"
                        class="vrh-action vrh-action--reset"
                        type="button"
                    >
                        RESET
                    </button>

                </div>


                <div class="vrh-punishment-summary">

                    <span
                        id="vrh-time-preview"
                        class="vrh-time-preview"
                    >
                        0 мин.
                    </span>


                    <span
                        id="vrh-stack-status"
                        class="vrh-stack-status"
                    >
                        Неадекватное поведение: 0 / 1440
                    </span>

                </div>


                <!-- =================================================
                     REPORT SCANNER
                     ================================================= -->

                <div class="vrh-report-scanner">

                    <button
                        id="vrh-scan-report"
                        class="vrh-action vrh-action--scan"
                        type="button"
                    >
                        Сканировать репорт
                    </button>


                    <span
                        id="vrh-scan-result"
                        class="vrh-scan-result"
                    >
                        Сканирование не запускалось
                    </span>

                </div>


                <div
                    id="vrh-reasons"
                    class="vrh-reasons"
                ></div>


                <div class="vrh-text-tools">

                    <div class="vrh-text-tools__title">
                        Текстовые инструменты
                    </div>


                    ${this.buildTextToolRow('a')}

                    ${this.buildTextToolRow('b')}

                </div>


                <div class="vrh-panel__footer">

                    <div class="vrh-connection">

                        <span
                            class="vrh-connection__dot"
                        ></span>

                        VRH ready

                    </div>


                    <span class="vrh-version">
                        v0.4.1
                    </span>

                </div>
            `;


            document.body.appendChild(
                panel
            );


            this.panel =
                panel;


            this.renderReasons();

            this.bindEvents();

            this.afterStateChange();

            this.updateModeUI();

            this.resetScannerUI();
        }


        /* =====================================================
           TEXT TOOL
           ===================================================== */

        buildTextToolRow(id) {
            return `
                <div
                    class="vrh-text-tool"
                    data-tool-id="${id}"
                >

                    <input
                        class="vrh-text-tool__input"
                        type="text"
                        placeholder="Введите текст..."
                        autocomplete="off"
                        spellcheck="false"
                    >


                    <span class="vrh-text-tool__count">
                        0 симв.
                    </span>


                    <button
                        class="vrh-text-tool__button"
                        data-action="eng-rus"
                        type="button"
                    >
                        Eng → Rus
                    </button>


                    <button
                        class="vrh-text-tool__button"
                        data-action="rus-eng"
                        type="button"
                    >
                        Rus → Eng
                    </button>

                </div>
            `;
        }


        /* =====================================================
           REASONS
           ===================================================== */

        renderReasons() {
            const container =
                this.panel?.querySelector(
                    '#vrh-reasons'
                );

            if (!container) {
                return;
            }


            container.innerHTML =
                '';


            REASON_DEFINITIONS.forEach(
                (definition) => {

                    const button =
                        document.createElement(
                            'button'
                        );

                    button.type =
                        'button';

                    button.className =
                        `vrh-reason vrh-reason--${definition.severity}`;

                    button.dataset.reasonId =
                        definition.id;

                    const icon =
                        document.createElement(
                            'span'
                        );

                    icon.className =
                        'vrh-reason__icon';

                    icon.textContent =
                        getReasonIcon(definition.label);

                    icon.setAttribute(
                        'aria-hidden',
                        'true'
                    );

                    button.appendChild(icon);


                    const label =
                        document.createElement(
                            'span'
                        );

                    label.className =
                        'vrh-reason__label';

                    label.textContent =
                        definition.label;


                    button.appendChild(
                        label
                    );


                    if (
                        definition.group
                    ) {
                        const counter =
                            document.createElement(
                                'span'
                            );

                        counter.className =
                            'vrh-reason__counter vrh-reason__counter--empty';

                        counter.textContent =
                            '×0';


                        button.appendChild(
                            counter
                        );
                    }


                    button.addEventListener(
                        'click',
                        () => {
                            this.handleReasonClick(
                                definition
                            );
                        }
                    );


                    container.appendChild(
                        button
                    );
                }
            );
        }


        /* =====================================================
           EVENTS
           ===================================================== */

        bindEvents() {
            this.panel
                ?.querySelector(
                    '#vrh-panel-close'
                )
                ?.addEventListener(
                    'click',
                    () => {
                        this.hide();
                    }
                );


            this.panel
                ?.querySelector(
                    '#vrh-reset'
                )
                ?.addEventListener(
                    'click',
                    () => {
                        this.reset();
                    }
                );


            this.panel
                ?.querySelector(
                    '#vrh-copy'
                )
                ?.addEventListener(
                    'click',
                    () => {
                        this.copyPunishment();
                    }
                );


            /*
             * =================================================
             * REPORT SCANNER
             * =================================================
             */

            this.panel
                ?.querySelector(
                    '#vrh-scan-report'
                )
                ?.addEventListener(
                    'click',
                    () => {
                        this.runReportScan();
                    }
                );


            /*
             * =================================================
             * TEXT TOOLS
             * =================================================
             */

            this.panel
                ?.querySelectorAll(
                    '.vrh-text-tool'
                )
                .forEach(
                    (row) => {

                        const input =
                            row.querySelector(
                                '.vrh-text-tool__input'
                            );

                        const counter =
                            row.querySelector(
                                '.vrh-text-tool__count'
                            );


                        input?.addEventListener(
                            'input',
                            () => {
                                if (counter) {
                                    counter.textContent =
                                        `${input.value.length} симв.`;
                                }
                            }
                        );


                        row
                            .querySelector(
                                '[data-action="eng-rus"]'
                            )
                            ?.addEventListener(
                                'click',
                                () => {
                                    this.convertTextTool(
                                        row,
                                        'eng-rus'
                                    );
                                }
                            );


                        row
                            .querySelector(
                                '[data-action="rus-eng"]'
                            )
                            ?.addEventListener(
                                'click',
                                () => {
                                    this.convertTextTool(
                                        row,
                                        'rus-eng'
                                    );
                                }
                            );
                    }
                );
        }


        /* =====================================================
           REPORT SCANNER
           ===================================================== */

        runReportScan() {
            const resultElement =
                this.panel?.querySelector(
                    '#vrh-scan-result'
                );

            const scanButton =
                this.panel?.querySelector(
                    '#vrh-scan-report'
                );

            if (
                this.mode !==
                'report'
            ) {
                if (resultElement) {
                    resultElement.textContent =
                        'Сначала открой репорт';
                }

                return;
            }

            if (
                !window
                    .VimeReportDomAdapter
                    ?.isReportOpen?.()
            ) {
                if (resultElement) {
                    resultElement.textContent =
                        'Репорт не открыт';
                }

                return;
            }

            const scanner =
                window.VimeReportViolationScanner;

            if (
                !scanner ||
                typeof scanner.scan !==
                'function'
            ) {
                if (resultElement) {
                    resultElement.textContent =
                        'Scanner недоступен';
                }

                return;
            }

            if (scanButton) {
                scanButton.disabled =
                    true;

                scanButton.textContent =
                    'Сканирование...';
            }

            try {
                const scanOutput =
                    scanner.scan();

                const results =
                    Array.isArray(scanOutput)
                        ? scanOutput
                        : Array.isArray(scanOutput?.matches)
                            ? scanOutput.matches
                            : Array.isArray(scanOutput?.results)
                                ? scanOutput.results
                                : [];

                this.lastScanResults =
                    results;

                this.renderScanResult(
                    this.lastScanResults
                );

            } catch (error) {
                console.error(
                    '[Vime Report Helper] Report scan failed:',
                    error
                );

                if (resultElement) {
                    resultElement.textContent =
                        'Ошибка сканирования';
                }

            } finally {
                if (scanButton) {
                    scanButton.disabled =
                        false;

                    scanButton.textContent =
                        'Сканировать репорт';
                }
            }
        }


        renderScanResult(results) {
            const element =
                this.panel?.querySelector(
                    '#vrh-scan-result'
                );


            if (!element) {
                return;
            }


            element.classList.remove(
                'vrh-scan-result--clean',
                'vrh-scan-result--warning'
            );


            /*
             * Старый раскрытый список перед новым
             * результатом всегда удаляем.
             */
            this.panel
                ?.querySelector(
                    '#vrh-scan-details'
                )
                ?.remove();


            if (
                !results ||
                results.length === 0
            ) {
                element.innerHTML =
                    'Совпадений не найдено';

                element.classList.add(
                    'vrh-scan-result--clean'
                );

                return;
            }


            const messageIndexes =
                new Set(
                    results
                        .map(
                            (result) =>
                                result?.messageIndex ??
                                result?.message?.index ??
                                result?.index
                        )
                        .filter(
                            (index) =>
                                index !== undefined &&
                                index !== null
                        )
                );


            element.innerHTML = `
        <span>
            Найдено: ${results.length} совп. / ${messageIndexes.size} сообщ.
        </span>

        <button
            id="vrh-scan-details-toggle"
            type="button"
            style="
                margin-left: 8px;
                padding: 3px 8px;
                border: 0;
                border-radius: 5px;
                background: #4c78a8;
                color: #fff;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
            "
        >
            Показать ${messageIndexes.size}
        </button>
    `;


            element.classList.add(
                'vrh-scan-result--warning'
            );


            this.panel
                ?.querySelector(
                    '#vrh-scan-details-toggle'
                )
                ?.addEventListener(
                    'click',
                    () => {
                        this.toggleScanDetails(
                            results
                        );
                    }
                );
        }

        toggleScanDetails(results) {
            const existing =
                this.panel?.querySelector(
                    '#vrh-scan-details'
                );


            const toggleButton =
                this.panel?.querySelector(
                    '#vrh-scan-details-toggle'
                );


            /*
             * Если список уже открыт —
             * просто закрываем его.
             */
            if (existing) {
                existing.remove();

                if (toggleButton) {
                    const messageIndexes =
                        new Set(
                            results
                                .map(
                                    (result) =>
                                        result?.messageIndex ??
                                        result?.message?.index ??
                                        result?.index
                                )
                                .filter(
                                    (index) =>
                                        index !== undefined &&
                                        index !== null
                                )
                        );


                    toggleButton.textContent =
                        `Показать ${messageIndexes.size}`;
                }

                return;
            }


            if (
                !Array.isArray(results) ||
                results.length === 0
            ) {
                return;
            }


            /*
             * Собираем результаты по сообщениям,
             * чтобы одно сообщение не выводилось
             * по несколько раз.
             */
            const grouped =
                new Map();


            results.forEach(
                (result) => {

                    const index =
                        result?.messageIndex ??
                        result?.message?.index ??
                        result?.index;


                    if (
                        index === undefined ||
                        index === null
                    ) {
                        return;
                    }


                    if (
                        !grouped.has(index)
                    ) {
                        grouped.set(
                            index,
                            {
                                index:
                                index,

                                time:
                                    result?.time ??
                                    result?.message?.time ??
                                    '',

                                text:
                                    result?.text ??
                                    result?.message?.text ??
                                    '',

                                words:
                                    new Set()
                            }
                        );
                    }


                    const item =
                        grouped.get(index);


                    if (
                        result?.word
                    ) {
                        item.words.add(
                            String(result.word)
                        );
                    }
                }
            );


            const wrapper =
                document.createElement(
                    'div'
                );


            wrapper.id =
                'vrh-scan-details';


            /*
             * Пока временный стиль.
             * В финале перенесём в CSS.
             */
            wrapper.style.marginTop =
                '8px';

            wrapper.style.padding =
                '8px';

            wrapper.style.background =
                'rgba(255,255,255,0.04)';

            wrapper.style.borderRadius =
                '7px';

            wrapper.style.maxHeight =
                '220px';

            wrapper.style.overflowY =
                'auto';

            wrapper.style.fontSize =
                '12px';


            grouped.forEach(
                (item) => {

                    const row =
                        document.createElement(
                            'div'
                        );


                    row.style.padding =
                        '6px 0';

                    row.style.borderBottom =
                        '1px solid rgba(255,255,255,0.06)';


                    const time =
                        document.createElement(
                            'span'
                        );


                    time.textContent =
                        item.time || '--:--:--';

                    time.style.color =
                        '#65b7ff';

                    time.style.fontWeight =
                        '700';

                    time.style.marginRight =
                        '8px';


                    const text =
                        document.createElement(
                            'span'
                        );


                    text.textContent =
                        item.text;


                    /*
                     * Подсветим найденные слова уже
                     * внутри нашего preview.
                     */
                    let html =
                        text.textContent;


                    [...item.words]
                        .sort(
                            (a, b) =>
                                b.length -
                                a.length
                        )
                        .forEach(
                            (word) => {

                                if (!word) {
                                    return;
                                }


                                const escaped =
                                    word.replace(
                                        /[.*+?^${}()|[\]\\]/g,
                                        '\\$&'
                                    );


                                const regex =
                                    new RegExp(
                                        `(${escaped})`,
                                        'giu'
                                    );


                                html =
                                    html.replace(
                                        regex,
                                        '<mark style="background:#ff3b3b;color:#fff;font-weight:700;border-radius:4px;padding:1px 3px;">$1</mark>'
                                    );
                            }
                        );


                    text.innerHTML =
                        html;


                    row.appendChild(
                        time
                    );


                    row.appendChild(
                        text
                    );


                    wrapper.appendChild(
                        row
                    );
                }
            );


            /*
             * Вставляем список прямо после строки
             * результата Scanner.
             */
            const resultElement =
                this.panel?.querySelector(
                    '#vrh-scan-result'
                );


            resultElement
                ?.insertAdjacentElement(
                    'afterend',
                    wrapper
                );


            if (toggleButton) {
                toggleButton.textContent =
                    'Скрыть';
            }
        }


        resetScannerUI() {
            this.lastScanResults =
                [];


            const element =
                this.panel?.querySelector(
                    '#vrh-scan-result'
                );


            if (element) {
                element.textContent =
                    'Сканирование не запускалось';


                element.classList.remove(
                    'vrh-scan-result--clean',
                    'vrh-scan-result--warning'
                );
            }


            const button =
                this.panel?.querySelector(
                    '#vrh-scan-report'
                );


            if (button) {
                button.disabled =
                    this.mode !== 'report';
            }
        }


        /* =====================================================
           CLICK LOGIC
           ===================================================== */

        handleReasonClick(
            definition
        ) {
            if (
                definition.group
            ) {
                const group =
                    PUNISHMENT_GROUPS[
                        definition.group
                        ];


                const current =
                    this.getGroupMinutes(
                        definition.group
                    );


                const next =
                    current +
                    definition.minutes;


                if (
                    next >
                    group.maxMinutes
                ) {
                    return;
                }


                const stacks =
                    this.reasonStacks.get(
                        definition.id
                    ) ?? 0;


                this.reasonStacks.set(
                    definition.id,
                    stacks + 1
                );


                this.groupMinutes.set(
                    definition.group,
                    next
                );


                this.afterStateChange();

                return;
            }


            const stacks =
                this.reasonStacks.get(
                    definition.id
                ) ?? 0;


            if (
                !definition.repeatable &&
                stacks >= 1
            ) {
                return;
            }


            this.reasonStacks.set(
                definition.id,
                stacks + 1
            );


            this.afterStateChange();
        }


        /* =====================================================
           STATE
           ===================================================== */

        afterStateChange() {
            this.updateReasonButtons();

            this.updateReasonFields();

            this.updateTimeFields();

            this.updateNativeVimeFields();

            this.updateStatus();

            this.updateBanWarning();
        }


        getSelectedOutputReasons() {
            const result =
                [];


            REASON_DEFINITIONS.forEach(
                (definition) => {

                    const stacks =
                        this.reasonStacks.get(
                            definition.id
                        ) ?? 0;


                    if (
                        stacks <= 0
                    ) {
                        return;
                    }


                    if (
                        !result.includes(
                            definition.outputReason
                        )
                    ) {
                        result.push(
                            definition.outputReason
                        );
                    }
                }
            );


            return result;
        }


        buildReasonString() {
            const reasons =
                this.getSelectedOutputReasons();


            if (
                reasons.length >=
                MULTIPLE_REASON_THRESHOLD
            ) {
                return MULTIPLE_REASON;
            }


            return reasons.join(
                ' + '
            );
        }


        getGroupMinutes(
            groupId
        ) {
            return (
                this.groupMinutes.get(
                    groupId
                ) ?? 0
            );
        }


        getTotalMinutes() {
            let total =
                0;


            this.groupMinutes.forEach(
                (minutes) => {
                    total +=
                        minutes;
                }
            );


            REASON_DEFINITIONS.forEach(
                (definition) => {

                    if (
                        definition.group
                    ) {
                        return;
                    }


                    const stacks =
                        this.reasonStacks.get(
                            definition.id
                        ) ?? 0;


                    total +=
                        definition.minutes *
                        stacks;
                }
            );


            return total;
        }


        hasCriticalReason() {
            return REASON_DEFINITIONS.some(
                (definition) => {

                    if (
                        definition.severity !==
                        'critical'
                    ) {
                        return false;
                    }


                    return (
                        this.reasonStacks.get(
                            definition.id
                        ) ?? 0
                    ) > 0;
                }
            );
        }


        /* =====================================================
           UI
           ===================================================== */

        updateReasonFields() {
            const field =
                this.panel?.querySelector(
                    '#vrh-reason'
                );


            if (field) {
                field.value =
                    this.buildReasonString();
            }
        }


        updateTimeFields() {
            const minutes =
                this.getTotalMinutes();


            const field =
                this.panel?.querySelector(
                    '#vrh-time'
                );


            if (field) {
                field.value =
                    minutes > 0
                        ? String(minutes)
                        : '';
            }


            const preview =
                this.panel?.querySelector(
                    '#vrh-time-preview'
                );


            if (preview) {
                preview.textContent =
                    this.formatMinutes(
                        minutes
                    );
            }
        }


        formatMinutes(
            minutes
        ) {
            if (
                minutes <= 0
            ) {
                return '0 мин.';
            }


            const days =
                Math.floor(
                    minutes / 1440
                );


            const remainder =
                minutes % 1440;


            const hours =
                Math.floor(
                    remainder / 60
                );


            const mins =
                remainder % 60;


            const parts =
                [];


            if (
                days > 0
            ) {
                parts.push(
                    `${days} д.`
                );
            }


            if (
                hours > 0
            ) {
                parts.push(
                    `${hours} ч.`
                );
            }


            if (
                mins > 0
            ) {
                parts.push(
                    `${mins} мин.`
                );
            }


            return parts.join(
                ' '
            );
        }


        updateReasonButtons() {
            REASON_DEFINITIONS.forEach(
                (definition) => {

                    const button =
                        this.panel?.querySelector(
                            `[data-reason-id="${definition.id}"]`
                        );


                    if (!button) {
                        return;
                    }


                    const stacks =
                        this.reasonStacks.get(
                            definition.id
                        ) ?? 0;


                    button.classList.toggle(
                        'vrh-reason--selected',
                        stacks > 0
                    );


                    if (
                        definition.group
                    ) {
                        const group =
                            PUNISHMENT_GROUPS[
                                definition.group
                                ];


                        const remaining =
                            group.maxMinutes -
                            this.getGroupMinutes(
                                definition.group
                            );


                        const disabled =
                            definition.minutes >
                            remaining;


                        button.disabled =
                            disabled;


                        button.classList.toggle(
                            'vrh-reason--maxed',
                            disabled
                        );


                        const counter =
                            button.querySelector(
                                '.vrh-reason__counter'
                            );


                        if (
                            counter
                        ) {
                            counter.textContent =
                                `×${stacks}`;


                            counter.classList.toggle(
                                'vrh-reason__counter--empty',
                                stacks === 0
                            );
                        }


                        return;
                    }


                    button.disabled =
                        (
                            !definition.repeatable &&
                            stacks >= 1
                        );


                    button.classList.remove(
                        'vrh-reason--maxed'
                    );
                }
            );
        }


        updateStatus() {
            const status =
                this.panel?.querySelector(
                    '#vrh-stack-status'
                );


            if (!status) {
                return;
            }


            const current =
                this.getGroupMinutes(
                    'inappropriate-behaviour'
                );


            status.textContent =
                `Неадекватное поведение: ${current} / 1440`;
        }


        updateBanWarning() {
            const warning =
                this.panel?.querySelector(
                    '#vrh-ban-warning'
                );


            if (warning) {
                warning.hidden =
                    !this.hasCriticalReason();
            }
        }


        updateModeUI() {
            const mode =
                this.panel?.querySelector(
                    '#vrh-panel-mode'
                );


            if (
                mode
            ) {
                mode.textContent =
                    this.mode === 'report'
                        ? 'Report Mode'
                        : 'Manual Mode';
            }


            this.panel?.classList.toggle(
                'vrh-panel--report-mode',
                this.mode === 'report'
            );


            this.panel?.classList.toggle(
                'vrh-panel--manual-mode',
                this.mode === 'manual'
            );


            /*
             * Scanner доступен только
             * в Report Mode.
             */

            const scanButton =
                this.panel?.querySelector(
                    '#vrh-scan-report'
                );


            if (scanButton) {
                scanButton.disabled =
                    this.mode !==
                    'report';
            }
        }


        /* =====================================================
           VIME FIELDS
           ===================================================== */

        updateNativeVimeFields() {
            if (
                this.mode !==
                'report'
            ) {
                return;
            }


            if (
                !window
                    .VimeReportDomAdapter
                    ?.isReportOpen?.()
            ) {
                return;
            }


            const fields =
                window
                    .VimeReportDomAdapter
                    ?.getPunishmentFields?.();


            if (!fields) {
                return;
            }


            if (
                fields.reason
            ) {
                fields.reason.value =
                    this.buildReasonString();


                this.dispatchNativeFieldEvents(
                    fields.reason
                );
            }


            if (
                fields.time
            ) {
                const minutes =
                    this.getTotalMinutes();


                fields.time.value =
                    minutes > 0
                        ? String(minutes)
                        : '';


                this.dispatchNativeFieldEvents(
                    fields.time
                );
            }
        }


        dispatchNativeFieldEvents(
            field
        ) {
            field.dispatchEvent(
                new Event(
                    'input',
                    {
                        bubbles: true
                    }
                )
            );


            field.dispatchEvent(
                new Event(
                    'change',
                    {
                        bubbles: true
                    }
                )
            );
        }


        /* =====================================================
           COPY
           ===================================================== */

        async copyPunishment() {
            const minutes =
                this.getTotalMinutes();


            const reason =
                this.buildReasonString();


            if (
                !minutes ||
                !reason
            ) {
                return;
            }


            const text =
                `${minutes} ${reason}`;


            try {
                await navigator.clipboard.writeText(
                    text
                );


                this.flashCopyButton(
                    'COPIED'
                );

            } catch {
                const temp =
                    document.createElement(
                        'textarea'
                    );


                temp.value =
                    text;


                temp.style.position =
                    'fixed';


                temp.style.opacity =
                    '0';


                document.body.appendChild(
                    temp
                );


                temp.select();


                document.execCommand(
                    'copy'
                );


                temp.remove();


                this.flashCopyButton(
                    'COPIED'
                );
            }
        }


        flashCopyButton(
            text
        ) {
            const button =
                this.panel?.querySelector(
                    '#vrh-copy'
                );


            if (!button) {
                return;
            }


            const previous =
                button.textContent;


            button.textContent =
                text;


            window.setTimeout(
                () => {
                    button.textContent =
                        previous;
                },
                900
            );
        }


        /* =====================================================
           TRANSLITERATION
           ===================================================== */

        convertTextTool(
            row,
            direction
        ) {
            const input =
                row.querySelector(
                    '.vrh-text-tool__input'
                );


            const counter =
                row.querySelector(
                    '.vrh-text-tool__count'
                );


            if (!input) {
                return;
            }


            const map =
                direction ===
                'eng-rus'
                    ? ENG_TO_RUS
                    : RUS_TO_ENG;


            input.value =
                this.convertKeyboardLayout(
                    input.value,
                    map
                );


            if (counter) {
                counter.textContent =
                    `${input.value.length} симв.`;
            }


            input.focus();


            input.setSelectionRange(
                input.value.length,
                input.value.length
            );
        }


        convertKeyboardLayout(
            text,
            map
        ) {
            return [
                ...text
            ]
                .map(
                    (char) => {

                        const lower =
                            char.toLowerCase();


                        const converted =
                            map[lower];


                        if (
                            converted ===
                            undefined
                        ) {
                            return char;
                        }


                        const uppercase =
                            char !== lower &&
                            char ===
                            char.toUpperCase();


                        return uppercase
                            ? converted.toUpperCase()
                            : converted;
                    }
                )
                .join('');
        }


        /* =====================================================
           RESET
           ===================================================== */

        clearTextTools() {
            this.panel
                ?.querySelectorAll(
                    '.vrh-text-tool'
                )
                .forEach(
                    (row) => {

                        const input =
                            row.querySelector(
                                '.vrh-text-tool__input'
                            );


                        const counter =
                            row.querySelector(
                                '.vrh-text-tool__count'
                            );


                        if (input) {
                            input.value =
                                '';
                        }


                        if (counter) {
                            counter.textContent =
                                '0 симв.';
                        }
                    }
                );
        }


        reset() {
            this.reasonStacks.clear();

            this.groupMinutes.clear();

            this.clearTextTools();

            this.resetScannerUI();

            window
                .VimeReportViolationScanner
                ?.clear?.();

            this.afterStateChange();
        }


        /* =====================================================
           MOUNTING
           ===================================================== */

        mountInsideReportModal() {
            const modal =
                window
                    .VimeReportDomAdapter
                    ?.getReportModal?.();


            if (
                !modal ||
                !this.panel
            ) {
                return false;
            }


            if (
                this.panel.parentElement !==
                modal
            ) {
                modal.appendChild(
                    this.panel
                );
            }


            return true;
        }


        mountToBody() {
            if (
                !this.panel
            ) {
                return;
            }


            if (
                this.panel.parentElement !==
                document.body
            ) {
                document.body.appendChild(
                    this.panel
                );
            }
        }


        /* =====================================================
           REPORT MODE
           ===================================================== */

        update(
            report
        ) {
            if (
                !report
            ) {
                return;
            }


            this.create();


            const changed =
                this.currentReport?.id !==
                report.id;


            this.currentReport =
                report;


            this.setText(
                '#vrh-report-id',

                report.id
                    ? `#${report.id}`
                    : '—'
            );


            this.setText(
                '#vrh-violator',

                report.violator ||
                '—'
            );


            this.setText(
                '#vrh-message-count',

                String(
                    report.messages?.length ??
                    0
                )
            );


            if (
                changed
            ) {
                this.reset();
            }
        }


        show(
            report
        ) {
            this.mode =
                'report';


            this.update(
                report
            );


            this.mountInsideReportModal();


            this.updateModeUI();

            this.afterStateChange();


            this.panel
                ?.classList
                .add(
                    'vrh-panel--visible'
                );
        }


        closeReportMode() {
            if (
                this.mode ===
                'report'
            ) {
                this.mode =
                    'manual';


                this.currentReport =
                    null;


                this.mountToBody();


                this.panel
                    ?.classList
                    .remove(
                        'vrh-panel--visible'
                    );


                this.reset();


                this.setText(
                    '#vrh-report-id',
                    '—'
                );


                this.setText(
                    '#vrh-violator',
                    '—'
                );


                this.setText(
                    '#vrh-message-count',
                    '—'
                );


                this.updateModeUI();
            }
        }


        /* =====================================================
           MANUAL MODE
           ===================================================== */

        openManual() {
            this.create();


            if (
                this.mode ===
                'report'
            ) {
                this.reset();
            }


            this.mode =
                'manual';


            this.currentReport =
                null;


            this.mountToBody();


            this.setText(
                '#vrh-report-id',
                '—'
            );


            this.setText(
                '#vrh-violator',
                '—'
            );


            this.setText(
                '#vrh-message-count',
                '—'
            );


            this.resetScannerUI();

            this.updateModeUI();


            this.panel
                ?.classList
                .add(
                    'vrh-panel--visible'
                );
        }


        /* =====================================================
           COMMON
           ===================================================== */

        hide() {
            this.panel
                ?.classList
                .remove(
                    'vrh-panel--visible'
                );
        }


        isVisible() {
            return Boolean(
                this.panel?.classList.contains(
                    'vrh-panel--visible'
                )
            );
        }


        getMode() {
            return this.mode;
        }


        setText(
            selector,
            value
        ) {
            const element =
                this.panel?.querySelector(
                    selector
                );


            if (element) {
                element.textContent =
                    value;
            }
        }
    }


    window.VimeReportPanel =
        new VimeReportPanel();

})();