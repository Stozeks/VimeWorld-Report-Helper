(() => {
    'use strict';

    const adapter = window.VimeReportDomAdapter;
    const reportPanel = window.VimeReportPanel;

    if (!adapter) {
        console.error('[Vime Report Helper] DOM Adapter not loaded.');
        return;
    }

    if (!reportPanel) {
        console.error('[Vime Report Helper] Report Panel not loaded.');
        return;
    }

    const LAUNCHER_ID = 'vrh-launcher';

    let modalUpdateTimer = null;
    let lastOpenedReportId = null;

    console.log('[Vime Report Helper] Starting v0.4.0...');


    /* =========================================================
       LAUNCHER
       ========================================================= */

    function createLauncher() {
        if (document.getElementById(LAUNCHER_ID)) {
            return;
        }

        const launcher = document.createElement('div');

        launcher.id = LAUNCHER_ID;
        launcher.className = 'vrh-launcher';

        launcher.innerHTML = `
            <div class="vrh-launcher__card">

                <div class="vrh-launcher__top">

                    <div class="vrh-launcher__identity">
                        <div class="vrh-launcher__mark">
                            VRH
                        </div>

                        <div>
                            <div class="vrh-launcher__title">
                                Moderation Toolkit
                            </div>

                            <div
                                id="vrh-launcher-state"
                                class="vrh-launcher__state"
                            >
                                Готов к работе
                            </div>
                        </div>
                    </div>

                    <span class="vrh-launcher__status-dot"></span>

                </div>


                <button
                    id="vrh-launcher-open"
                    class="vrh-launcher__open"
                    type="button"
                >
                    <span id="vrh-launcher-action-text">
                        Открыть Toolkit
                    </span>

                    <span class="vrh-launcher__arrow">
                        →
                    </span>
                </button>

            </div>


            <button
                class="vrh-launcher__trigger"
                type="button"
                aria-label="VimeWorld Report Helper"
                title="VimeWorld Report Helper"
            >
                <span class="vrh-launcher__trigger-text">
                    VRH
                </span>

                <span class="vrh-launcher__trigger-dot"></span>
            </button>
        `;

        document.body.appendChild(launcher);


        /*
         * Клик по самой маленькой кнопке VRH
         * тоже открывает Toolkit.
         */

        launcher
            .querySelector('.vrh-launcher__trigger')
            ?.addEventListener(
                'click',
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    openFromLauncher();
                }
            );


        launcher
            .querySelector('#vrh-launcher-open')
            ?.addEventListener(
                'click',
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    openFromLauncher();
                }
            );
    }


    function openFromLauncher() {
        /*
         * Если сейчас реально открыт репорт —
         * открываем VRH в Report Mode.
         */

        if (adapter.isReportOpen()) {
            const report = adapter.getCurrentReport();

            if (report?.id) {
                reportPanel.show(report);

                lastOpenedReportId = report.id;

                updateLauncherState(report);

                return;
            }
        }


        /*
         * Иначе обычный Manual Mode.
         */

        reportPanel.openManual();

        updateLauncherState(null);
    }


    function updateLauncherState(report = null) {
        const state =
            document.getElementById(
                'vrh-launcher-state'
            );

        const action =
            document.getElementById(
                'vrh-launcher-action-text'
            );

        const launcher =
            document.getElementById(
                LAUNCHER_ID
            );

        if (!state || !action || !launcher) {
            return;
        }


        if (report?.id) {
            launcher.dataset.mode = 'report';

            state.textContent =
                `Репорт #${report.id}`;

            action.textContent =
                'Открыть для репорта';

            return;
        }


        launcher.dataset.mode = 'manual';

        state.textContent =
            'Готов к работе';

        action.textContent =
            reportPanel.isVisible()
                ? 'Вернуться в Toolkit'
                : 'Открыть Toolkit';
    }


    /* =========================================================
       REPORTS
       ========================================================= */

    function scanReports() {
        const table =
            adapter.getReportsTable();

        const rows =
            adapter.getReportRows();

        console.log(
            '[Vime Report Helper] Reports table:',
            Boolean(table)
        );

        console.log(
            '[Vime Report Helper] Active reports:',
            rows.length
        );

        rows.forEach(
            (row) => {
                console.log(
                    '[Vime Report Helper] Report detected:',
                    adapter.getReportIdFromRow(row)
                );
            }
        );
    }


    /* =========================================================
       MODAL STATE
       ========================================================= */

    function handleReportModalState() {
        clearTimeout(modalUpdateTimer);

        modalUpdateTimer =
            window.setTimeout(
                () => {

                    /*
                     * =============================================
                     * REPORT CLOSED
                     * =============================================
                     */

                    if (!adapter.isReportOpen()) {
                        if (lastOpenedReportId !== null) {
                            lastOpenedReportId = null;

                            /*
                             * Закрываем только Report Mode.
                             * Launcher при этом остаётся.
                             */

                            reportPanel.closeReportMode();
                        }

                        updateLauncherState(null);

                        return;
                    }


                    /*
                     * =============================================
                     * REPORT OPEN
                     * =============================================
                     */

                    const report =
                        adapter.getCurrentReport();

                    if (!report?.id) {
                        return;
                    }


                    updateLauncherState(report);


                    /*
                     * Важно:
                     *
                     * Не вызываем show() на каждую мутацию DOM.
                     * Иначе любое изменение самой VRH-панели
                     * могло бы снова её открывать.
                     *
                     * Автоматически показываем только при
                     * открытии нового репорта.
                     */

                    if (
                        lastOpenedReportId !==
                        report.id
                    ) {
                        lastOpenedReportId =
                            report.id;

                        reportPanel.show(report);

                        console.log(
                            '[Vime Report Helper] Opened report:',
                            report
                        );
                    }

                },
                100
            );
    }


    /* =========================================================
       WATCH REPORT MODAL
       ========================================================= */

    function watchReportModal() {
        const modal =
            adapter.getReportModal();

        if (!modal) {
            console.warn(
                '[Vime Report Helper] Report modal not found.'
            );

            return;
        }


        const observer =
            new MutationObserver(
                (mutations) => {

                    /*
                     * VRH в Report Mode физически находится
                     * внутри modal.
                     *
                     * Поэтому игнорируем изменения,
                     * которые произошли только внутри VRH.
                     */

                    const hasExternalMutation =
                        mutations.some(
                            (mutation) => {

                                const panel =
                                    document.getElementById(
                                        'vrh-report-panel'
                                    );

                                if (!panel) {
                                    return true;
                                }

                                return !panel.contains(
                                    mutation.target
                                );
                            }
                        );


                    if (!hasExternalMutation) {
                        return;
                    }


                    handleReportModalState();
                }
            );


        observer.observe(
            modal,
            {
                attributes: true,
                childList: true,
                subtree: true,
                characterData: true
            }
        );


        /*
         * На случай прямой ссылки вида:
         * #report939154
         */

        handleReportModalState();
    }


    /* =========================================================
       REPORT TABLE
       ========================================================= */

    function watchReportsTable() {
        const table =
            adapter.getReportsTable();

        if (!table) {
            console.warn(
                '[Vime Report Helper] Reports table not found.'
            );

            return;
        }


        const observer =
            new MutationObserver(
                () => {
                    console.log(
                        '[Vime Report Helper] Report list changed. Active:',
                        adapter.getReportRows().length
                    );
                }
            );


        observer.observe(
            table,
            {
                childList: true,
                subtree: true
            }
        );
    }


    /* =========================================================
       INIT
       ========================================================= */

    function init() {
        /*
         * Панель создаётся сразу,
         * но остаётся скрытой.
         */

        reportPanel.create();


        /*
         * Launcher существует всегда.
         */

        createLauncher();

        updateLauncherState(null);


        scanReports();

        watchReportModal();

        watchReportsTable();


        console.log(
            '[Vime Report Helper] Initialized successfully.'
        );
    }


    init();
})();

// ============================================================
// VIMEWORLD THEME BACKGROUND
// ============================================================

(() => {
    const backgroundUrl = chrome.runtime.getURL(
        'src/assets/vimeworld-bg.png'
    );

    document.documentElement.style.setProperty(
        '--vrh-site-background',
        `url("${backgroundUrl}")`
    );

    console.log('[VRH] Background loaded:', backgroundUrl);
})();