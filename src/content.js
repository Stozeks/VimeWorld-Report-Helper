(() => {
    'use strict';

    const adapter = window.VimeReportDomAdapter;
    const reportPanel = window.VimeReportPanel;
    const playerIdentityUI = window.VimeReportPlayerIdentityUI;

    if (!adapter) {
        console.error('[Vime Report Helper] DOM Adapter not loaded.');
        return;
    }

    if (!reportPanel) {
        console.error('[Vime Report Helper] Report Panel not loaded.');
        return;
    }

    const LAUNCHER_ID = 'vrh-launcher';
    const OWNED_ROOT_SELECTOR = '.vrh-player-identity, #vrh-report-panel, #vrh-launcher, #vrh-learning-action, #vrh-learning-dialog, #vrh-learning-toast, #vrh-monthly-stats';
    const REPORT_LIST_DEBOUNCE_MS = 100;

    let modalUpdateTimer = null;
    let lastOpenedReportId = null;
    let reportListObserver = null;
    let reportListRefreshTimer = null;
    let lastReportListSnapshot = null;
    let reportListObserverCallbacks = 0;
    let reportListIgnoredVrhMutations = 0;
    let reportListDebouncedRuns = 0;
    let reportListActualChanges = 0;

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
                reportPanel.userClosedForReportId = null;
                reportPanel.show(report);
                playerIdentityUI?.scheduleRefresh?.();

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
        const state = document.getElementById('vrh-launcher-state');
        const action = document.getElementById('vrh-launcher-action-text');
        const launcher = document.getElementById(LAUNCHER_ID);

        if (!state || !action || !launcher) {
            return;
        }

        if (report?.id) {
            launcher.dataset.mode = 'report';
            state.textContent = `Репорт #${report.id}`;
            action.textContent = 'Открыть для репорта';
            return;
        }

        launcher.dataset.mode = 'manual';
        state.textContent = 'Готов к работе';
        action.textContent = reportPanel.isVisible()
            ? 'Вернуться в Toolkit'
            : 'Открыть Toolkit';
    }

    function getMutationElement(node) {
        if (!node) {
            return null;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            return node;
        }

        return node.parentElement || node.parentNode || null;
    }

    function isInsideVrhOwnedRoot(node) {
        const element = getMutationElement(node);

        if (!element || typeof element.closest !== 'function') {
            return false;
        }

        return Boolean(element.closest(OWNED_ROOT_SELECTOR));
    }

    function isVrhOwnedMutation(mutation) {
        if (!mutation) {
            return false;
        }

        if (isInsideVrhOwnedRoot(mutation.target)) {
            return true;
        }

        if (mutation.type === 'childList') {
            const addedOnlyOwned = Array.from(mutation.addedNodes || []).every((node) => isInsideVrhOwnedRoot(node));
            const removedOnlyOwned = Array.from(mutation.removedNodes || []).every((node) => isInsideVrhOwnedRoot(node));
            return addedOnlyOwned && removedOnlyOwned;
        }

        if (mutation.type === 'characterData') {
            return isInsideVrhOwnedRoot(mutation.target);
        }

        return false;
    }

    function getReportListSnapshot() {
        const rows = adapter.getReportRows();
        const ids = rows
            .map((row) => adapter.getReportIdFromRow(row))
            .filter((id) => Boolean(id));

        return {
            ids,
            key: ids.join('|'),
            count: ids.length
        };
    }

    function analyzeReportListChanges() {
        reportListDebouncedRuns += 1;

        const snapshot = getReportListSnapshot();

        if (snapshot.key === lastReportListSnapshot) {
            return;
        }

        lastReportListSnapshot = snapshot.key;
        reportListActualChanges += 1;

        console.log('[Vime Report Helper] Report list changed. Active:', snapshot.count);
        playerIdentityUI?.scheduleRefresh?.();
    }

    function scheduleReportListAnalysis() {
        if (reportListRefreshTimer) {
            clearTimeout(reportListRefreshTimer);
        }

        reportListRefreshTimer = window.setTimeout(() => {
            reportListRefreshTimer = null;
            analyzeReportListChanges();
        }, REPORT_LIST_DEBOUNCE_MS);
    }

    /* =========================================================
       REPORTS
       ========================================================= */

    function scanReports() {
        const table = adapter.getReportsTable();
        const rows = adapter.getReportRows();

        lastReportListSnapshot = getReportListSnapshot().key;

        console.log('[Vime Report Helper] Reports table:', Boolean(table));
        console.log('[Vime Report Helper] Active reports:', rows.length);

        rows.forEach((row) => {
            console.log('[Vime Report Helper] Report detected:', adapter.getReportIdFromRow(row));
        });

        playerIdentityUI?.scheduleRefresh?.();
    }

    /* =========================================================
       MODAL STATE
       ========================================================= */

    function handleReportModalState() {
        clearTimeout(modalUpdateTimer);

        modalUpdateTimer = window.setTimeout(() => {
            if (!adapter.isReportOpen()) {
                if (
                    lastOpenedReportId !== null ||
                    reportPanel.getMode() === 'report'
                ) {
                    lastOpenedReportId = null;
                    reportPanel.closeReportMode();
                }

                updateLauncherState(null);
                reportPanel.userClosedForReportId = null;
                return;
            }

            const report = adapter.getCurrentReport();

            if (!report?.id) {
                return;
            }

            updateLauncherState(report);

            if (
                reportPanel.userClosedForReportId === report.id &&
                !reportPanel.isVisible()
            ) {
                return;
            }

            const activeReportId = reportPanel.currentReport?.id ?? null;

            if (activeReportId !== report.id) {
                lastOpenedReportId = report.id;
                reportPanel.userClosedForReportId = null;
                reportPanel.show(report);
                playerIdentityUI?.scheduleRefresh?.();
                return;
            }

            if (!reportPanel.isVisible()) {
                reportPanel.show(report);
                playerIdentityUI?.scheduleRefresh?.();
                return;
            }

            reportPanel.update(report);
        }, 100);
    }

    /* =========================================================
       WATCH REPORT MODAL
       ========================================================= */

    function watchReportModal() {
        const modal = adapter.getReportModal();

        if (!modal) {
            console.warn('[Vime Report Helper] Report modal not found.');
            return;
        }

        const observer = new MutationObserver((mutations) => {
            if (!mutations.some((mutation) => !isVrhOwnedMutation(mutation))) {
                return;
            }

            handleReportModalState();
        });

        observer.observe(modal, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true
        });

        handleReportModalState();
    }

    /* =========================================================
       REPORT TABLE
       ========================================================= */

    function watchReportsTable() {
        const table = adapter.getReportsTable();

        if (!table) {
            console.warn('[Vime Report Helper] Reports table not found.');
            return;
        }

        reportListObserver = new MutationObserver((mutations) => {
            reportListObserverCallbacks += 1;

            if (!mutations.some((mutation) => !isVrhOwnedMutation(mutation))) {
                reportListIgnoredVrhMutations += 1;
                return;
            }

            scheduleReportListAnalysis();
        });

        reportListObserver.observe(table, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    window.VimeReportListDebug = function () {
        const snapshot = getReportListSnapshot();

        return {
            observerCallbacks: reportListObserverCallbacks,
            ignoredVrhMutations: reportListIgnoredVrhMutations,
            debouncedRuns: reportListDebouncedRuns,
            actualListChanges: reportListActualChanges,
            currentReportIds: snapshot.ids,
            currentSnapshotKey: snapshot.key,
            currentSnapshotCount: snapshot.count
        };
    };


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
        playerIdentityUI?.scheduleRefresh?.();


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