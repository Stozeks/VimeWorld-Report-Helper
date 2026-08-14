(() => {
    'use strict';

    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER
     * MONTHLY STATISTICS ENGINE
     * =========================================================
     *
     * Закрытый репорт:
     *      +1 closed
     *      +2 points
     *
     * Отклонённый репорт:
     *      +1 rejected
     *      +1 point
     *
     * Один report ID может быть засчитан
     * только один раз в рамках одного месяца.
     *
     * Данные хранятся в chrome.storage.local.
     * =========================================================
     */


    const STORAGE_KEY =
        'vrh_monthly_stats';


    const POINTS = Object.freeze({
        closed: 2,
        rejected: 1
    });


    let pendingAction =
        null;


    let lastReportOpenState =
        false;


    /* =========================================================
       DATE
       ========================================================= */

    function getMonthKey(date = new Date()) {
        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(
                2,
                '0'
            );


        return `${year}-${month}`;
    }


    function getMonthInfo(date = new Date()) {
        const year =
            date.getFullYear();

        const monthIndex =
            date.getMonth();

        const day =
            date.getDate();

        const daysInMonth =
            new Date(
                year,
                monthIndex + 1,
                0
            ).getDate();


        return {
            year,
            monthIndex,
            month:
                monthIndex + 1,
            day,
            daysInMonth,
            key:
                getMonthKey(date)
        };
    }


    /* =========================================================
       STORAGE
       ========================================================= */

    async function readStorage() {
        try {
            const result =
                await chrome.storage.local.get(
                    STORAGE_KEY
                );


            const storage =
                result?.[STORAGE_KEY];


            if (
                storage &&
                typeof storage === 'object'
            ) {
                return storage;
            }


            return {};

        } catch (error) {
            console.error(
                '[Vime Report Helper] Monthly Stats read failed:',
                error
            );


            return {};
        }
    }


    async function writeStorage(data) {
        try {
            await chrome.storage.local.set({
                [STORAGE_KEY]:
                data
            });


            return true;

        } catch (error) {
            console.error(
                '[Vime Report Helper] Monthly Stats write failed:',
                error
            );


            return false;
        }
    }


    /* =========================================================
       MONTH MODEL
       ========================================================= */

    function createEmptyMonth(
        monthKey
    ) {
        return {
            monthKey,

            closed:
                0,

            rejected:
                0,

            points:
                0,

            processedReports:
                {},

            createdAt:
                Date.now(),

            updatedAt:
                Date.now()
        };
    }


    async function getMonth(
        monthKey = getMonthKey()
    ) {
        const storage =
            await readStorage();


        return (
            storage[monthKey] ??
            createEmptyMonth(
                monthKey
            )
        );
    }


    async function getCurrentMonthStats() {
        const month =
            await getMonth();


        const info =
            getMonthInfo();


        return {
            ...month,

            total:
                month.closed +
                month.rejected,

            ...info
        };
    }


    /* =========================================================
       REPORT
       ========================================================= */

    function getCurrentReportId() {
        const adapter =
            window.VimeReportDomAdapter;


        const report =
            adapter
                ?.getCurrentReport?.();


        if (
            report?.id
        ) {
            return String(
                report.id
            );
        }


        /*
         * Fallback по заголовку:
         *
         * Просмотр репорта #939183
         */

        const modal =
            document.querySelector(
                '#view_report'
            );


        const text =
            modal
                ?.textContent ??
            '';


        const match =
            text.match(
                /репорта\s*#?(\d+)/i
            );


        return (
            match?.[1] ??
            null
        );
    }


    function isReportOpen() {
        const adapter =
            window.VimeReportDomAdapter;


        if (
            typeof adapter
                ?.isReportOpen ===
            'function'
        ) {
            return Boolean(
                adapter.isReportOpen()
            );
        }


        const modal =
            document.querySelector(
                '#view_report'
            );


        if (!modal) {
            return false;
        }


        const style =
            window.getComputedStyle(
                modal
            );


        return (
            style.display !== 'none' &&
            modal.getAttribute(
                'aria-hidden'
            ) !== 'true'
        );
    }


    /* =========================================================
       COUNT
       ========================================================= */

    async function registerReport(
        reportId,
        action
    ) {
        if (
            !reportId ||
            !POINTS[action]
        ) {
            return {
                success: false,
                reason:
                    'invalid'
            };
        }


        const monthKey =
            getMonthKey();


        const storage =
            await readStorage();


        const month =
            storage[monthKey] ??
            createEmptyMonth(
                monthKey
            );


        /*
         * Защита от повторного подсчёта.
         */

        if (
            month
                .processedReports
                ?.[reportId]
        ) {
            console.warn(
                '[Vime Report Helper] Stats: report already counted:',
                reportId
            );


            return {
                success: false,
                reason:
                    'duplicate'
            };
        }


        if (
            action ===
            'closed'
        ) {
            month.closed++;
        }


        if (
            action ===
            'rejected'
        ) {
            month.rejected++;
        }


        month.points +=
            POINTS[action];


        month.processedReports[
            reportId
            ] = {
            action,

            points:
                POINTS[action],

            timestamp:
                Date.now()
        };


        month.updatedAt =
            Date.now();


        storage[monthKey] =
            month;


        const saved =
            await writeStorage(
                storage
            );


        if (!saved) {
            return {
                success: false,
                reason:
                    'storage'
            };
        }


        const stats =
            await getCurrentMonthStats();


        window.dispatchEvent(
            new CustomEvent(
                'vrh:monthly-stats-updated',
                {
                    detail:
                    stats
                }
            )
        );


        console.log(
            '[Vime Report Helper] Stats registered:',
            {
                reportId,
                action,
                points:
                    POINTS[action],
                stats
            }
        );


        return {
            success: true,
            stats
        };
    }


    /* =========================================================
       ACTION DETECTION
       ========================================================= */

    function normalizeButtonText(
        button
    ) {
        return String(
            button?.textContent ??
            ''
        )
            .replace(
                /\s+/g,
                ' '
            )
            .trim()
            .toLowerCase();
    }


    function detectAction(
        button
    ) {
        const text =
            normalizeButtonText(
                button
            );


        /*
         * Родная зелёная кнопка VimeWorld.
         */

        if (
            text === 'мут'
        ) {
            return 'closed';
        }


        /*
         * Родная кнопка отклонения.
         */

        if (
            text === 'отклонить'
        ) {
            return 'rejected';
        }


        return null;
    }


    /* =========================================================
       CLICK WATCH
       ========================================================= */

    document.addEventListener(
        'click',
        (event) => {

            const button =
                event.target
                    ?.closest?.(
                    'button, input[type="button"], input[type="submit"]'
                );


            if (!button) {
                return;
            }


            /*
             * Учитываем только кнопки внутри
             * открытого окна репорта.
             */

            const modal =
                button.closest(
                    '#view_report'
                );


            if (!modal) {
                return;
            }


            const action =
                detectAction(
                    button
                );


            if (!action) {
                return;
            }


            const reportId =
                getCurrentReportId();


            if (!reportId) {
                console.warn(
                    '[Vime Report Helper] Stats: report ID not found.'
                );


                return;
            }


            /*
             * Пока НЕ считаем.
             *
             * Только запоминаем намерение.
             * Засчитаем после фактического
             * закрытия окна репорта.
             */

            pendingAction = {
                reportId,
                action,
                startedAt:
                    Date.now()
            };


            console.log(
                '[Vime Report Helper] Stats pending:',
                pendingAction
            );

        },
        true
    );


    /* =========================================================
       MODAL WATCH
       ========================================================= */

    function checkReportState() {
        const open =
            isReportOpen();


        /*
         * Был открыт -> стал закрыт.
         */

        if (
            lastReportOpenState &&
            !open
        ) {
            if (
                pendingAction
            ) {
                const action =
                    pendingAction;


                pendingAction =
                    null;


                /*
                 * Небольшая защита от совсем
                 * старого pending action.
                 */

                if (
                    Date.now() -
                    action.startedAt <
                    15000
                ) {
                    registerReport(
                        action.reportId,
                        action.action
                    );
                }
            }
        }


        /*
         * Если открыт другой репорт,
         * старый pending больше не нужен.
         */

        if (
            open &&
            pendingAction
        ) {
            const currentId =
                getCurrentReportId();


            if (
                currentId &&
                currentId !==
                pendingAction.reportId
            ) {
                pendingAction =
                    null;
            }
        }


        lastReportOpenState =
            open;
    }


    const observer =
        new MutationObserver(
            () => {
                checkReportState();
            }
        );


    observer.observe(
        document.documentElement,
        {
            attributes:
                true,

            childList:
                true,

            subtree:
                true
        }
    );


    /*
     * Начальное состояние.
     */

    lastReportOpenState =
        isReportOpen();


    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.VimeReportMonthlyStats = {

        getMonthKey,

        getMonthInfo,

        getMonth,

        getCurrentMonthStats,

        registerReport,

        readStorage
    };


    console.log(
        '[Vime Report Helper] Monthly Stats loaded.'
    );

})();