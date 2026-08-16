(() => {
    'use strict';


    /*
     * =========================================================
     * VIMEWORLD REPORT HELPER
     * ADAPTIVE RECOGNITION — LEARNING UI  (Stage 2B)
     * =========================================================
     *
     * Provides the «Обучить сканер» moderator interface.
     *
     * Flow:
     *   1. Moderator selects text inside #mr_messages.
     *   2. A small «Обучить сканер» action button appears.
     *   3. Clicking it opens a compact dialog.
     *   4. Moderator picks an official category and saves,
     *      OR marks the word as «Не нарушение» (false positive).
     *
     * Writes exclusively to:  window.VimeReportLearningStore
     * Advisory reads from:    window.VimeReportAdaptiveRecognition
     *
     * Global API:  window.VimeReportLearningUI
     * =========================================================
     */


    /* =========================================================
       OFFICIAL CATEGORY LABELS

       Reproduced verbatim from REASON_DEFINITIONS in
       report-panel.js.  That IIFE does not expose them
       publicly, so they are declared here as read-only
       reference data.

       DO NOT rename, translate, shorten or reorder these.
       ========================================================= */

    const LEARN_CATEGORIES = [
        'Мат/Аморал',
        'Оскорбление игроков',
        'Оскорбление игроков + Мат',
        'Оскорбление родственников',
        'Оскорбление Персонала',
        'Неуважительное общение с Персоналом',
        'Оскорбление Администрации',
        'Неуважительное общение с Администрацией',
        'Оскорбление проекта',
        'Провокация игроков',
        'Выдача себя за Персонал',
        'Выдача себя за Администрацию',
        'Пиар сторонних ресурсов',
        'Реклама другого проекта',
        'Flood',
        'Flood символами',
        'Caps Lock',
        'Голосование',
        'Оффтоп',
        'Политическая агитация',
        'Обман игроков',
        'Призыв к суициду',
        'Продажа вимеров',
        'Покупка вимеров',
        'Продажа услуг за вимеры',
        'Продажа неигровых вещей за вимеры',
        'Продажа вещей за реальные деньги',
        'Продажа услуг за реальные деньги',
        'Продажа аккаунта',
        'Покупка аккаунта',
        'Передача аккаунта',
        'Пропаганда наркотиков',
        'Пропаганда фашизма',
        'Распространение читов',
        'Распространение багов',
    ];


    /* =========================================================
       RUNTIME STATE
       ========================================================= */

    const _state = {
        selectionText:      null,   /* trimmed selected string           */
        selectionIsPhrase:  false,  /* multiple word tokens              */
        selectionCrossMsg:  false,  /* spans more than one chat message  */
        selectedCategory:   null,   /* chosen official label             */
        adaptiveResult:     null,   /* AR engine suggestion (or null)    */
        isOpen:             false,  /* dialog is currently visible       */
    };


    /* =========================================================
       DOM ELEMENT REFERENCES
       ========================================================= */

    let _actionEl  = null;  /* floating «Обучить сканер» button  */
    let _dialogEl  = null;  /* the learning dialog               */
    let _toastEl   = null;  /* ephemeral status toast            */
    let _toastTimer = null;

    /*
     * Pending mouseup timer — lets the browser finish
     * updating the Selection object before we read it.
     */
    let _selectionCheckTimer = null;


    /* =========================================================
       HELPERS
       ========================================================= */

    function _messagesContainer() {
        return document.getElementById('mr_messages');
    }

    function _store() {
        return window.VimeReportLearningStore ?? null;
    }

    function _isStoreReady() {
        const s = _store();
        if (!s) return false;
        return s.getStatus?.().ready === true;
    }

    function _hasLetters(text) {
        return /[а-яёА-ЯЁa-zA-Z]/u.test(text);
    }

    function _isSingleToken(text) {
        return text.trim().split(/\s+/).filter(function (t) {
            return t.length > 0;
        }).length === 1;
    }


    /* =========================================================
       ADAPTIVE RECOGNITION SUGGESTION
       ========================================================= */

    function _getAdaptiveSuggestion(text) {
        if (!_isSingleToken(text)) return null;

        const engine = window.VimeReportAdaptiveRecognition;
        if (!engine || typeof engine.recognizeToken !== 'function') {
            return null;
        }

        try {
            const result = engine.recognizeToken(text.trim());
            if (
                result &&
                result.recognized &&
                result.canonical &&
                typeof result.confidence === 'number' &&
                result.confidence >= 0.70
            ) {
                return result;
            }
        } catch (_) {
            /* engine unavailable or vocabulary not ready */
        }

        return null;
    }


    /* =========================================================
       SELECTION MONITORING
       ========================================================= */

    function _onDocumentMouseUp(e) {
        /* Ignore clicks on our own UI so it stays visible */
        if (
            (_actionEl && _actionEl.contains(e.target)) ||
            (_dialogEl && _dialogEl.contains(e.target))
        ) {
            return;
        }

        /* Don't show action button while dialog is open */
        if (_state.isOpen) return;

        clearTimeout(_selectionCheckTimer);
        _selectionCheckTimer = setTimeout(_checkCurrentSelection, 12);
    }

    function _onSelectionChange() {
        /* Hide action button whenever selection becomes empty */
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
            _hideActionButton();
        }
    }

    function _onDocumentScroll() {
        /* Selection rect moves on scroll — just hide the button */
        _hideActionButton();
    }

    function _checkCurrentSelection() {
        const container = _messagesContainer();
        if (!container) return;

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed) {
            _hideActionButton();
            return;
        }

        const range   = sel.getRangeAt(0);
        const rawText = sel.toString();

        /* Selection must be inside #mr_messages */
        if (!container.contains(range.commonAncestorContainer)) {
            _hideActionButton();
            return;
        }

        const trimmed = rawText.trim();
        if (!trimmed || !_hasLetters(trimmed)) {
            _hideActionButton();
            return;
        }

        /*
         * Cross-message check:
         * if the common ancestor IS the messages container
         * the selection spans more than one message element.
         */
        const ancestor    = range.commonAncestorContainer;
        const crossMsg    = ancestor === container;

        _state.selectionText     = trimmed;
        _state.selectionIsPhrase = !_isSingleToken(trimmed);
        _state.selectionCrossMsg = crossMsg;

        _showActionButton(range.getBoundingClientRect());
    }


    /* =========================================================
       ACTION BUTTON
       ========================================================= */

    function _buildActionButton() {
        if (_actionEl) return;

        const el  = document.createElement('div');
        el.id         = 'vrh-learning-action';
        el.className  = 'vrh-learning-action';

        const btn = document.createElement('button');
        btn.className   = 'vrh-learning-action__btn';
        btn.textContent = '\uD83C\uDF93 \u041E\u0431\u0443\u0447\u0438\u0442\u044C \u0441\u043A\u0430\u043D\u0435\u0440';
        /* 🎓 Обучить сканер */

        btn.addEventListener('click', function () {
            _hideActionButton();
            _openDialog();
        });

        el.appendChild(btn);
        document.body.appendChild(el);
        _actionEl = el;
    }

    function _showActionButton(rect) {
        if (!_actionEl) return;

        /*
         * Clamp left so the button doesn't overflow the viewport.
         * 160px is a safe upper-bound for its rendered width.
         */
        const maxLeft = Math.max(0, window.innerWidth - 164);
        const top     = Math.round(rect.bottom + 6);
        const left    = Math.round(Math.min(rect.left, maxLeft));

        _actionEl.style.top  = top  + 'px';
        _actionEl.style.left = left + 'px';
        _actionEl.classList.add('vrh-learning-action--visible');
    }

    function _hideActionButton() {
        _actionEl?.classList.remove('vrh-learning-action--visible');
    }


    /* =========================================================
       DIALOG — BUILD
       ========================================================= */

    function _buildDialog() {
        if (_dialogEl) return;

        const el = document.createElement('div');
        el.id       = 'vrh-learning-dialog';
        el.className = 'vrh-learning-dialog';

        el.innerHTML = [
            '<div class="vrh-learning-dialog__backdrop"></div>',
            '<div class="vrh-learning-dialog__panel"',
            '     role="dialog" aria-modal="true"',
            '     aria-labelledby="vrh-ld-title">',

            '  <div class="vrh-learning-dialog__header">',
            '    <span id="vrh-ld-title"',
            '          class="vrh-learning-dialog__title">',
            '      \u041E\u0431\u0443\u0447\u0435\u043D\u0438\u0435 \u0441\u043A\u0430\u043D\u0435\u0440\u0430',
            /* Обучение сканера */
            '    </span>',
            '  </div>',

            '  <div class="vrh-learning-dialog__body">',

            '    <div class="vrh-learning-dialog__section">',
            '      <span class="vrh-learning-dialog__label">',
            '        \u0412\u044B\u0434\u0435\u043B\u0435\u043D\u043E:',
            /* Выделено: */
            '      </span>',
            '      <span class="vrh-learning-dialog__selected-text"',
            '            id="vrh-ld-selected"></span>',
            '    </div>',

            '    <div class="vrh-learning-dialog__suggestion"',
            '         id="vrh-ld-suggestion" style="display:none">',
            '      <span class="vrh-learning-dialog__sug-label">',
            '        \u041F\u043E\u0445\u043E\u0436\u0435 \u043D\u0430:',
            /* Похоже на: */
            '      </span>',
            '      <span class="vrh-learning-dialog__sug-canonical"',
            '            id="vrh-ld-canonical"></span>',
            '      <span class="vrh-learning-dialog__sug-confidence"',
            '            id="vrh-ld-confidence"></span>',
            '    </div>',

            '    <div class="vrh-learning-dialog__section',
            '               vrh-learning-dialog__section--cats">',
            '      <span class="vrh-learning-dialog__label">',
            '        \u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F:',
            /* Категория: */
            '      </span>',
            '      <div class="vrh-learning-dialog__categories"',
            '           id="vrh-ld-categories"></div>',
            '    </div>',

            '  </div>',

            '  <div class="vrh-learning-dialog__status"',
            '       id="vrh-ld-status"></div>',

            '  <div class="vrh-learning-dialog__actions">',
            '    <button class="vrh-learning-dialog__btn vrh-learning-dialog__btn--primary"',
            '            id="vrh-ld-save">',
            '      \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C',
            /* Сохранить */
            '    </button>',
            '    <button class="vrh-learning-dialog__btn vrh-learning-dialog__btn--exception"',
            '            id="vrh-ld-exception">',
            '      \u041D\u0435 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u0435',
            /* Не нарушение */
            '    </button>',
            '    <button class="vrh-learning-dialog__btn vrh-learning-dialog__btn--cancel"',
            '            id="vrh-ld-cancel">',
            '      \u041E\u0442\u043C\u0435\u043D\u0430',
            /* Отмена */
            '    </button>',
            '  </div>',

            '</div>',
        ].join('\n');

        /* Backdrop click → close */
        el.querySelector('.vrh-learning-dialog__backdrop')
          .addEventListener('click', _closeDialog);

        el.querySelector('#vrh-ld-save')     .addEventListener('click', _onSave);
        el.querySelector('#vrh-ld-exception').addEventListener('click', _onException);
        el.querySelector('#vrh-ld-cancel')   .addEventListener('click', _closeDialog);

        document.body.appendChild(el);
        _dialogEl = el;
    }


    /* =========================================================
       DIALOG — OPEN / CLOSE
       ========================================================= */

    function _openDialog() {
        if (!_dialogEl) _buildDialog();

        const text = _state.selectionText;
        if (!text) return;

        _state.selectedCategory = null;
        _state.isOpen           = true;

        /* Selected text preview */
        const selEl = _dialogEl.querySelector('#vrh-ld-selected');
        if (selEl) {
            selEl.textContent = '\u00AB' + text + '\u00BB';
            /* «text» */
        }

        /* AR suggestion */
        const suggestion         = _getAdaptiveSuggestion(text);
        _state.adaptiveResult    = suggestion;

        const sugEl = _dialogEl.querySelector('#vrh-ld-suggestion');
        if (sugEl) {
            if (suggestion) {
                const pct = Math.round(suggestion.confidence * 100);
                _dialogEl.querySelector('#vrh-ld-canonical')  .textContent =
                    suggestion.canonical;
                _dialogEl.querySelector('#vrh-ld-confidence') .textContent =
                    '\u2248\u00A0' + pct + '%';
                /* ≈ XX% */
                sugEl.style.display = '';
            } else {
                sugEl.style.display = 'none';
            }
        }

        /* Build category buttons */
        _renderCategories();

        /* Clear status */
        _setStatus('', false);

        /* Re-enable buttons */
        _setBusy(false);

        _dialogEl.classList.add('vrh-learning-dialog--visible');
    }

    function _closeDialog() {
        if (!_dialogEl) return;

        _dialogEl.classList.remove('vrh-learning-dialog--visible');

        _state.isOpen           = false;
        _state.selectedCategory = null;
        _state.adaptiveResult   = null;
        _state.selectionText    = null;
        _state.selectionIsPhrase  = false;
        _state.selectionCrossMsg  = false;
    }

    function _renderCategories() {
        const container = _dialogEl?.querySelector('#vrh-ld-categories');
        if (!container) return;

        container.innerHTML = '';

        LEARN_CATEGORIES.forEach(function (label) {
            const btn = document.createElement('button');
            btn.className   = 'vrh-learning-dialog__category-btn';
            btn.textContent = label;
            btn.setAttribute('data-category', label);

            btn.addEventListener('click', function () {
                _state.selectedCategory = label;

                container.querySelectorAll(
                    '.vrh-learning-dialog__category-btn'
                ).forEach(function (b) {
                    b.classList.toggle(
                        'vrh-learning-dialog__category-btn--selected',
                        b === btn
                    );
                });

                /* Clear any prior "choose a category" error */
                _setStatus('', false);
            });

            container.appendChild(btn);
        });
    }

    function _setStatus(text, isError) {
        const el = _dialogEl?.querySelector('#vrh-ld-status');
        if (!el) return;
        el.textContent = text;
        el.className = [
            'vrh-learning-dialog__status',
            text
                ? (isError
                    ? 'vrh-learning-dialog__status--error'
                    : 'vrh-learning-dialog__status--ok')
                : '',
        ].join(' ').trim();
    }

    function _setBusy(busy) {
        ['#vrh-ld-save', '#vrh-ld-exception', '#vrh-ld-cancel'].forEach(
            function (sel) {
                const btn = _dialogEl?.querySelector(sel);
                if (btn) btn.disabled = busy;
            }
        );
    }


    /* =========================================================
       SAVE HANDLERS
       ========================================================= */

    async function _onSave() {
        const store = _store();

        if (!store || !_isStoreReady()) {
            _setStatus('Хранилище обучения недоступно', true);
            return;
        }

        if (!_state.selectedCategory) {
            _setStatus('Выберите категорию нарушения', true);
            return;
        }

        _setBusy(true);

        const text       = _state.selectionText;
        const isPhrase   = _state.selectionIsPhrase;
        const crossMsg   = _state.selectionCrossMsg;
        const arResult   = _state.adaptiveResult;
        const category   = _state.selectedCategory;

        try {
            let record   = null;
            let toastMsg = '';

            if (isPhrase) {

                /* ---- multi-word phrase ---- */
                record = await store.learnPhrase({
                    original:   text,
                    category:   category,
                    confidence: 1,
                    source:     'manual',
                    context: {
                        crossMessage:  crossMsg,
                        maxMessageGap: null,
                        maxTimeGapMs:  null,
                    },
                });
                toastMsg = 'Фраза сохранена в знания сканера';

            } else {

                /* ---- single-token alias ---- */
                record = await store.learnAlias({
                    original:   text,
                    canonical:  arResult?.canonical  ?? null,
                    category:   category,
                    confidence: arResult?.confidence ?? 1,
                    source:     'manual',
                });
                toastMsg = 'Сканер обучен: \u00AB' + text + '\u00BB';
                /* «text» */
            }

            /*
             * Explicit moderator action counts as one confirmation.
             * Phrases are also confirmable via _findById (checks both
             * aliases and phrases collections in learning-store.js).
             */
            if (record?.id) {
                try {
                    await store.confirm(record.id);
                } catch (_) {
                    /* confirm is best-effort; record was already saved */
                }
            }

            _closeDialog();
            _showToast(toastMsg, false);

            console.log(
                '[Vime Report Helper] Learning UI: saved',
                isPhrase ? 'phrase' : 'alias',
                JSON.stringify(text),
                '→', category
            );

        } catch (e) {
            console.error('[Vime Report Helper] Learning UI: save failed', e);
            _setBusy(false);
            _setStatus('Не удалось сохранить правило', true);
        }
    }

    async function _onException() {
        const store = _store();

        if (!store || !_isStoreReady()) {
            _setStatus('Хранилище обучения недоступно', true);
            return;
        }

        _setBusy(true);

        const text = _state.selectionText;

        try {
            await store.addException({
                original: text,
                reason:   'manual-reject',
                source:   'manual',
            });

            _closeDialog();
            _showToast('Добавлено в исключения', false);

            console.log(
                '[Vime Report Helper] Learning UI: exception added',
                JSON.stringify(text)
            );

        } catch (e) {
            console.error('[Vime Report Helper] Learning UI: exception failed', e);
            _setBusy(false);
            _setStatus('Не удалось сохранить правило', true);
        }
    }


    /* =========================================================
       TOAST
       ========================================================= */

    function _buildToast() {
        if (_toastEl) return;
        const el = document.createElement('div');
        el.id       = 'vrh-learning-toast';
        el.className = 'vrh-learning-toast';
        document.body.appendChild(el);
        _toastEl = el;
    }

    function _showToast(text, isError) {
        if (!_toastEl) _buildToast();

        clearTimeout(_toastTimer);

        _toastEl.textContent = text;
        _toastEl.className = [
            'vrh-learning-toast',
            'vrh-learning-toast--visible',
            isError ? 'vrh-learning-toast--error' : '',
        ].join(' ').trim();

        _toastTimer = setTimeout(function () {
            if (_toastEl) {
                _toastEl.classList.remove('vrh-learning-toast--visible');
            }
        }, 2800);
    }


    /* =========================================================
       KEYBOARD
       ========================================================= */

    function _onKeyDown(e) {
        if (e.key === 'Escape' && _state.isOpen) {
            _closeDialog();
        }
    }


    /* =========================================================
       INIT
       ========================================================= */

    function _init() {
        _buildActionButton();
        _buildDialog();
        _buildToast();

        document.addEventListener(
            'mouseup',
            _onDocumentMouseUp,
            { passive: true }
        );

        document.addEventListener(
            'selectionchange',
            _onSelectionChange
        );

        document.addEventListener(
            'scroll',
            _onDocumentScroll,
            { passive: true, capture: true }
        );

        document.addEventListener(
            'keydown',
            _onKeyDown
        );

        console.log('[Vime Report Helper] Learning UI loaded.');
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.VimeReportLearningUI = {

        getStatus() {
            const s = _store();
            return {
                initialized:   true,
                storeReady:    _isStoreReady(),
                storeStatus:   s?.getStatus?.() ?? null,
                isDialogOpen:  _state.isOpen,
                currentText:   _state.selectionText,
            };
        },

        openForSelection() {
            if (_state.selectionText && !_state.isOpen) {
                _openDialog();
            }
        },

        close() {
            _closeDialog();
        },

        getCurrentSelection() {
            if (!_state.selectionText) return null;
            return {
                text:        _state.selectionText,
                isPhrase:    _state.selectionIsPhrase,
                crossMessage: _state.selectionCrossMsg,
            };
        },

    };


    /* =========================================================
       BOOTSTRAP
       ========================================================= */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})();
