(() => {
    'use strict';

    /*
     * =========================================================
     * VRH MONTHLY STATS PANEL
     * =========================================================
     */


    const PANEL_ID =
        'vrh-monthly-stats-panel';


    const MONTHS = [
        'Январь',
        'Февраль',
        'Март',
        'Апрель',
        'Май',
        'Июнь',
        'Июль',
        'Август',
        'Сентябрь',
        'Октябрь',
        'Ноябрь',
        'Декабрь'
    ];


    class VimeReportStatsPanel {

        constructor() {
            this.panel =
                null;

            this.collapsed =
                false;
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
                'vrh-stats-panel';


            panel.innerHTML = `
        <div
            id="vrh-stats-header"
            class="vrh-stats-panel__header"
        >
            <div class="vrh-stats-panel__heading">
                <div class="vrh-stats-panel__eyebrow">
                    VRH
                    <span></span>
                    STATISTICS
                </div>

                <div class="vrh-stats-panel__title">
                    Статистика
                </div>

                <div
                    id="vrh-stats-period"
                    class="vrh-stats-panel__period"
                >
                    —
                </div>
            </div>


            <button
                id="vrh-stats-collapse"
                class="vrh-stats-panel__collapse"
                type="button"
                title="Свернуть"
            >
                −
            </button>
        </div>


        <div
            id="vrh-stats-body"
            class="vrh-stats-panel__body"
        >
            <div class="vrh-stats-panel__metrics">

                <div
                    class="
                        vrh-stats-metric
                        vrh-stats-metric--closed
                    "
                >
                    <div class="vrh-stats-metric__top">
                        <span class="vrh-stats-metric__dot"></span>

                        <span class="vrh-stats-metric__label">
                            Закрыто
                        </span>
                    </div>

                    <strong
                        id="vrh-stats-closed"
                        class="vrh-stats-metric__value"
                    >
                        0
                    </strong>

                    <div class="vrh-stats-metric__meta">
                        × 2 балла
                    </div>
                </div>


                <div
                    class="
                        vrh-stats-metric
                        vrh-stats-metric--rejected
                    "
                >
                    <div class="vrh-stats-metric__top">
                        <span class="vrh-stats-metric__dot"></span>

                        <span class="vrh-stats-metric__label">
                            Отклонено
                        </span>
                    </div>

                    <strong
                        id="vrh-stats-rejected"
                        class="vrh-stats-metric__value"
                    >
                        0
                    </strong>

                    <div class="vrh-stats-metric__meta">
                        × 1 балл
                    </div>
                </div>

            </div>


            <div class="vrh-stats-summary">

                <div class="vrh-stats-summary__total">
                    <span class="vrh-stats-summary__label">
                        Всего обработано
                    </span>

                    <strong
                        id="vrh-stats-total"
                        class="vrh-stats-summary__value"
                    >
                        0
                    </strong>
                </div>


                <div class="vrh-stats-summary__divider"></div>


                <div class="vrh-stats-summary__points">
                    <span class="vrh-stats-summary__label">
                        Баллы
                    </span>

                    <strong
                        id="vrh-stats-points"
                        class="vrh-stats-summary__value"
                    >
                        0
                    </strong>
                </div>

            </div>


            <div class="vrh-stats-progress">
                <div class="vrh-stats-progress__head">
                    <span>
                        Прогресс месяца
                    </span>

                    <span id="vrh-stats-day">
                        —
                    </span>
                </div>

                <div class="vrh-stats-progress__track">
                    <div
                        id="vrh-stats-progress-bar"
                        class="vrh-stats-progress__bar"
                    ></div>
                </div>
            </div>


            <div class="vrh-stats-panel__footer">
                <span class="vrh-stats-panel__status-dot"></span>

                <span>
                    Локальная статистика
                </span>
            </div>
        </div>


        <div
            id="vrh-stats-collapsed"
            class="vrh-stats-mini"
            hidden
        >
            <span class="vrh-stats-mini__logo">
                VRH
            </span>

            <span class="vrh-stats-mini__divider"></span>

            <strong id="vrh-stats-mini-total">
                0
            </strong>

            <span>
                реп.
            </span>

            <strong
                id="vrh-stats-mini-points"
                class="vrh-stats-mini__points"
            >
                0
            </strong>

            <span>
                бал.
            </span>
        </div>
    `;


            document.body.appendChild(
                panel
            );


            this.panel =
                panel;


            this.bindEvents();
        }
        /* =====================================================
           EVENTS
           ===================================================== */

        bindEvents() {
            this.panel
                ?.querySelector(
                    '#vrh-stats-collapse'
                )
                ?.addEventListener(
                    'click',
                    () => {
                        this.setCollapsed(
                            true
                        );
                    }
                );


            this.panel
                ?.querySelector(
                    '#vrh-stats-collapsed'
                )
                ?.addEventListener(
                    'click',
                    () => {
                        this.setCollapsed(
                            false
                        );
                    }
                );


            window.addEventListener(
                'vrh:monthly-stats-updated',
                (event) => {

                    if (
                        event.detail
                    ) {
                        this.render(
                            event.detail
                        );
                    }
                }
            );
        }


        /* =====================================================
           COLLAPSE
           ===================================================== */

        setCollapsed(
            collapsed
        ) {
            this.collapsed =
                collapsed;


            const header =
                this.panel?.querySelector(
                    '#vrh-stats-header'
                );


            const body =
                this.panel?.querySelector(
                    '#vrh-stats-body'
                );


            const mini =
                this.panel?.querySelector(
                    '#vrh-stats-collapsed'
                );


            if (header) {
                header.hidden =
                    collapsed;
            }


            if (body) {
                body.hidden =
                    collapsed;
            }


            if (mini) {
                mini.hidden =
                    !collapsed;
            }


            if (
                this.panel
            ) {
                this.panel.style.width =
                    collapsed
                        ? '190px'
                        : '285px';
            }
        }


        /* =====================================================
           SET TEXT
           ===================================================== */

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
                    String(value);
            }
        }


        /* =====================================================
           RENDER
           ===================================================== */

        render(stats) {
            if (!stats) {
                return;
            }


            const monthName =
                MONTHS[
                    stats.monthIndex
                    ] ??
                '—';


            this.setText(
                '#vrh-stats-period',
                `${monthName} ${stats.year}`
            );


            this.setText(
                '#vrh-stats-closed',
                stats.closed ?? 0
            );


            this.setText(
                '#vrh-stats-rejected',
                stats.rejected ?? 0
            );


            this.setText(
                '#vrh-stats-total',
                stats.total ?? 0
            );


            this.setText(
                '#vrh-stats-points',
                stats.points ?? 0
            );


            this.setText(
                '#vrh-stats-day',
                `${stats.day} / ${stats.daysInMonth} день месяца`
            );
            const progressBar =
                this.panel?.querySelector(
                    '#vrh-stats-progress-bar'
                );

            if (progressBar) {
                const day =
                    Number(stats.day) || 0;

                const daysInMonth =
                    Number(stats.daysInMonth) || 1;

                const progress =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            (day / daysInMonth) * 100
                        )
                    );

                progressBar.style.width =
                    `${progress}%`;
            }

            this.setText(
                '#vrh-stats-mini-total',
                stats.total ?? 0
            );


            this.setText(
                '#vrh-stats-mini-points',
                stats.points ?? 0
            );
        }


        /* =====================================================
           REFRESH
           ===================================================== */

        async refresh() {
            const statsEngine =
                window.VimeReportMonthlyStats;


            if (
                !statsEngine ||
                typeof statsEngine
                    .getCurrentMonthStats !==
                'function'
            ) {
                return;
            }


            const stats =
                await statsEngine
                    .getCurrentMonthStats();


            this.render(
                stats
            );
        }


        /* =====================================================
           INIT
           ===================================================== */

        async init() {
            this.create();

            await this.refresh();
        }
    }


    window.VimeReportStatsPanel =
        new VimeReportStatsPanel();


    window
        .VimeReportStatsPanel
        .init();

})();