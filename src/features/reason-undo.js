(() => {
    'use strict';

    /*
     * =========================================================
     * VRH REASON UNDO
     * =========================================================
     *
     * ↶ UNDO отменяет только ПОСЛЕДНЕЕ успешное
     * нажатие на плитку причины.
     *
     * Примеры:
     *
     * Мат/Аморал ×3
     * UNDO
     * -> Мат/Аморал ×2
     *
     * Flood + Caps Lock
     * UNDO
     * -> Flood
     *
     * RESET полностью очищает историю Undo.
     *
     * Новый репорт тоже начинает новую историю.
     * =========================================================
     */


    const panel =
        window.VimeReportPanel;


    if (!panel) {
        console.error(
            '[Vime Report Helper] Reason Undo: Report Panel not loaded.'
        );

        return;
    }


    /* =========================================================
       HISTORY
       ========================================================= */

    const history = [];


    /* =========================================================
       SNAPSHOT
       ========================================================= */

    function createSnapshot() {
        return {
            reasonStacks:
                new Map(
                    panel.reasonStacks
                ),

            groupMinutes:
                new Map(
                    panel.groupMinutes
                )
        };
    }


    /* =========================================================
       STATE SIGNATURE
       =========================================================
       Нужна, чтобы не записывать в историю неудачные клики.

       Например:
       Flood уже выбран -> второй клик ничего не меняет.
       Такой клик в Undo попасть не должен.
       ========================================================= */

    function getStateSignature() {
        const reasonStacks =
            [...panel.reasonStacks.entries()]
                .sort(
                    ([a], [b]) =>
                        String(a).localeCompare(
                            String(b)
                        )
                );


        const groupMinutes =
            [...panel.groupMinutes.entries()]
                .sort(
                    ([a], [b]) =>
                        String(a).localeCompare(
                            String(b)
                        )
                );


        return JSON.stringify({
            reasonStacks,
            groupMinutes
        });
    }


    /* =========================================================
       UPDATE BUTTON
       ========================================================= */

    function updateUndoButton() {
        const button =
            document.querySelector(
                '#vrh-undo'
            );


        if (!button) {
            return;
        }


        button.disabled =
            history.length === 0;


        button.style.opacity =
            history.length === 0
                ? '0.45'
                : '1';


        button.style.cursor =
            history.length === 0
                ? 'default'
                : 'pointer';


        button.title =
            history.length === 0
                ? 'Нет действий для отмены'
                : `Отменить последнее действие (${history.length})`;
    }


    /* =========================================================
       CREATE BUTTON
       ========================================================= */

    function createUndoButton() {
        if (
            document.querySelector(
                '#vrh-undo'
            )
        ) {
            updateUndoButton();

            return;
        }


        const resetButton =
            document.querySelector(
                '#vrh-reset'
            );


        if (!resetButton) {
            return;
        }


        /*
         * RESET сейчас является четвёртым элементом Grid.
         *
         * Чтобы не ломать расположение панели,
         * создаём один wrapper на его месте:
         *
         * [ ↶ ] [ RESET ]
         */

        const wrapper =
            document.createElement(
                'div'
            );


        wrapper.className =
            'vrh-reset-group';


        wrapper.style.display =
            'flex';

        wrapper.style.gap =
            '5px';

        wrapper.style.width =
            '100%';

        wrapper.style.height =
            '40px';


        resetButton.parentNode.insertBefore(
            wrapper,
            resetButton
        );


        wrapper.appendChild(
            resetButton
        );


        /*
         * RESET занимает большую часть места.
         */

        resetButton.style.flex =
            '1 1 auto';

        resetButton.style.minWidth =
            '0';


        /*
         * UNDO
         */

        const undoButton =
            document.createElement(
                'button'
            );


        undoButton.id =
            'vrh-undo';


        undoButton.type =
            'button';


        undoButton.textContent =
            '↶';


        undoButton.title =
            'Отменить последнюю причину';


        undoButton.style.width =
            '34px';

        undoButton.style.minWidth =
            '34px';

        undoButton.style.height =
            '40px';

        undoButton.style.padding =
            '0';

        undoButton.style.border =
            '0';

        undoButton.style.borderRadius =
            '7px';

        undoButton.style.background =
            '#4b535c';

        undoButton.style.color =
            '#ffffff';

        undoButton.style.fontSize =
            '18px';

        undoButton.style.fontWeight =
            '700';

        undoButton.style.transition =
            'filter 100ms ease, opacity 100ms ease';


        undoButton.addEventListener(
            'mouseenter',
            () => {
                if (!undoButton.disabled) {
                    undoButton.style.filter =
                        'brightness(1.15)';
                }
            }
        );


        undoButton.addEventListener(
            'mouseleave',
            () => {
                undoButton.style.filter =
                    '';
            }
        );


        undoButton.addEventListener(
            'click',
            () => {
                undoLastReason();
            }
        );


        wrapper.insertBefore(
            undoButton,
            resetButton
        );


        updateUndoButton();
    }


    /* =========================================================
       UNDO
       ========================================================= */

    function undoLastReason() {
        if (
            history.length === 0
        ) {
            return;
        }


        const snapshot =
            history.pop();


        /*
         * Восстанавливаем состояние ДО последнего клика.
         */

        panel.reasonStacks =
            new Map(
                snapshot.reasonStacks
            );


        panel.groupMinutes =
            new Map(
                snapshot.groupMinutes
            );


        /*
         * Полностью обновляем:
         *
         * - плитки
         * - счётчики ×N
         * - время
         * - итоговую причину
         * - родные поля VimeWorld
         * - лимит 1440
         */

        if (
            typeof panel.afterStateChange ===
            'function'
        ) {
            panel.afterStateChange();
        }


        updateUndoButton();
    }


    /* =========================================================
       PATCH REASON CLICK
       ========================================================= */

    const originalHandleReasonClick =
        panel.handleReasonClick.bind(
            panel
        );


    panel.handleReasonClick =
        function (
            definition
        ) {

            const beforeSnapshot =
                createSnapshot();


            const beforeSignature =
                getStateSignature();


            /*
             * Выполняем настоящий код плитки VRH.
             */

            originalHandleReasonClick(
                definition
            );


            const afterSignature =
                getStateSignature();


            /*
             * История создаётся ТОЛЬКО если
             * состояние реально поменялось.
             */

            if (
                beforeSignature !==
                afterSignature
            ) {
                history.push(
                    beforeSnapshot
                );
            }


            updateUndoButton();
        };


    /* =========================================================
       PATCH RESET
       ========================================================= */

    const originalReset =
        panel.reset.bind(
            panel
        );


    panel.reset =
        function () {

            /*
             * RESET — это осознанное полное очищение.
             * Возвращаться Undo в предыдущий репорт нельзя.
             */

            history.length =
                0;


            originalReset();


            updateUndoButton();
        };


    /* =========================================================
       PATCH CREATE
       =========================================================
       Panel может ещё не существовать в DOM,
       когда загружается этот файл.

       Поэтому после create() гарантированно добавляем кнопку.
       ========================================================= */

    const originalCreate =
        panel.create.bind(
            panel
        );


    panel.create =
        function () {

            const result =
                originalCreate();


            createUndoButton();


            return result;
        };


    /* =========================================================
       INIT
       ========================================================= */

    /*
     * Если панель к моменту загрузки уже создана —
     * кнопку добавим сразу.
     */

    createUndoButton();


    console.log(
        '[Vime Report Helper] Reason Undo loaded.'
    );

})();