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


            /*
             * Пока стили здесь.
             *
             * На финальном дизайн-этапе
             * вынесем всё в report-helper.css.
             */

            panel.style.position =
                'fixed';

            panel.style.top =
                '18px';

            panel.style.left =
                '18px';

            panel.style.width =
                '285px';

            panel.style.zIndex =
                '999998';

            panel.style.background =
                '#22272d';

            panel.style.color =
                '#ffffff';

            panel.style.border =
                '1px solid rgba(255,255,255,0.08)';

            panel.style.borderRadius =
                '12px';

            panel.style.boxShadow =
                '0 12px 35px rgba(0,0,0,0.28)';

            panel.style.fontFamily =
                'Arial, Helvetica, sans-serif';

            panel.style.overflow =
                'hidden';


            panel.innerHTML = `

                <div
                    id="vrh-stats-header"
                    style="
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        padding:13px 14px;
                        background:rgba(0,0,0,0.12);
                    "
                >

                    <div>

                        <div
                            style="
                                font-size:14px;
                                font-weight:700;
                            "
                        >
                            VRH • Статистика
                        </div>

                        <div
                            id="vrh-stats-period"
                            style="
                                margin-top:3px;
                                color:#70bfff;
                                font-size:11px;
                            "
                        >
                            —
                        </div>

                    </div>


                    <button
                        id="vrh-stats-collapse"
                        type="button"
                        title="Свернуть"
                        style="
                            width:30px;
                            height:30px;
                            border:0;
                            border-radius:7px;
                            background:rgba(255,255,255,0.07);
                            color:#fff;
                            cursor:pointer;
                            font-size:17px;
                        "
                    >
                        −
                    </button>

                </div>


                <div
                    id="vrh-stats-body"
                    style="
                        padding:14px;
                    "
                >

                    <div
                        style="
                            display:grid;
                            grid-template-columns:1fr 1fr;
                            gap:8px;
                        "
                    >

                        <div
                            style="
                                padding:10px;
                                border-radius:8px;
                                background:rgba(255,255,255,0.04);
                            "
                        >
                            <div
                                style="
                                    color:#8e98a4;
                                    font-size:10px;
                                    text-transform:uppercase;
                                "
                            >
                                Закрыто
                            </div>

                            <strong
                                id="vrh-stats-closed"
                                style="
                                    display:block;
                                    margin-top:5px;
                                    font-size:20px;
                                "
                            >
                                0
                            </strong>

                            <div
                                style="
                                    margin-top:2px;
                                    color:#7c8792;
                                    font-size:10px;
                                "
                            >
                                × 2 балла
                            </div>
                        </div>


                        <div
                            style="
                                padding:10px;
                                border-radius:8px;
                                background:rgba(255,255,255,0.04);
                            "
                        >
                            <div
                                style="
                                    color:#8e98a4;
                                    font-size:10px;
                                    text-transform:uppercase;
                                "
                            >
                                Отклонено
                            </div>

                            <strong
                                id="vrh-stats-rejected"
                                style="
                                    display:block;
                                    margin-top:5px;
                                    font-size:20px;
                                "
                            >
                                0
                            </strong>

                            <div
                                style="
                                    margin-top:2px;
                                    color:#7c8792;
                                    font-size:10px;
                                "
                            >
                                × 1 балл
                            </div>
                        </div>

                    </div>


                    <div
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            margin-top:9px;
                            padding:12px;
                            border-radius:8px;
                            background:rgba(255,255,255,0.055);
                        "
                    >

                        <div>
                            <div
                                style="
                                    color:#8e98a4;
                                    font-size:10px;
                                    text-transform:uppercase;
                                "
                            >
                                Всего обработано
                            </div>

                            <strong
                                id="vrh-stats-total"
                                style="
                                    display:block;
                                    margin-top:4px;
                                    font-size:17px;
                                "
                            >
                                0
                            </strong>
                        </div>


                        <div
                            style="
                                text-align:right;
                            "
                        >
                            <div
                                style="
                                    color:#f5a623;
                                    font-size:10px;
                                    text-transform:uppercase;
                                    font-weight:700;
                                "
                            >
                                Баллы
                            </div>

                            <strong
                                id="vrh-stats-points"
                                style="
                                    display:block;
                                    margin-top:4px;
                                    color:#f5a623;
                                    font-size:23px;
                                "
                            >
                                0
                            </strong>
                        </div>

                    </div>


                    <div
                        style="
                            margin-top:10px;
                            padding-top:9px;
                            border-top:1px solid rgba(255,255,255,0.07);
                            color:#7f8994;
                            font-size:10px;
                            display:flex;
                            justify-content:space-between;
                        "
                    >

                        <span
                            id="vrh-stats-day"
                        >
                            —
                        </span>

                        <span>
                            Локальная статистика
                        </span>

                    </div>

                </div>


                <div
                    id="vrh-stats-collapsed"
                    hidden
                    style="
                        padding:10px 14px;
                        cursor:pointer;
                        font-size:12px;
                    "
                >
                    📊
                    <strong id="vrh-stats-mini-total">
                        0
                    </strong>
                    реп. •
                    <strong id="vrh-stats-mini-points">
                        0
                    </strong>
                    бал.
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