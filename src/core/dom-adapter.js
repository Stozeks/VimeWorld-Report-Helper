(() => {
    'use strict';

    class VimeReportDomAdapter {

        getReportsTable() {
            return document.querySelector('#table');
        }

        getReportRows() {
            return Array.from(
                document.querySelectorAll('tr[id^="row_report"]')
            );
        }

        getReportIdFromRow(row) {
            if (!row?.id) {
                return null;
            }

            const match = row.id.match(/^row_report(\d+)$/);
            return match ? match[1] : null;
        }

        getReportModal() {
            return document.querySelector('#view_report');
        }

        isReportOpen() {
            const modal = this.getReportModal();

            if (!modal) {
                return false;
            }

            return modal.classList.contains('in') ||
                modal.getAttribute('aria-hidden') === 'false';
        }

        getCurrentReport() {
            if (!this.isReportOpen()) {
                return null;
            }

            return {
                id: this.getText('#mr_id'),
                date: this.getText('#mr_date'),
                violator: this.getText('#mr_violator'),
                reporter: this.getText('#mr_reporter'),
                reports: this.getText('#mr_reports'),
                messages: this.getMessages()
            };
        }

        getMessages() {
            const container = document.querySelector('#mr_messages');

            if (!container) {
                return [];
            }

            const messages = [];
            const timeElements = container.querySelectorAll('span.text-muted');

            timeElements.forEach((timeElement) => {
                let message = '';

                let node = timeElement.nextSibling;

                while (node && node.nodeName !== 'BR') {
                    message += node.textContent ?? '';
                    node = node.nextSibling;
                }

                message = message
                    .replace(/^\s*-\s*/, '')
                    .trim();

                messages.push({
                    time: timeElement.textContent.trim(),
                    text: message
                });
            });

            return messages;
        }

        getPunishmentFields() {
            return {
                time: document.querySelector('#mr_itime'),
                reason: document.querySelector('#mr_ireason')
            };
        }

        getText(selector) {
            return document.querySelector(selector)?.textContent?.trim() ?? '';
        }
    }

    window.VimeReportDomAdapter = new VimeReportDomAdapter();
})();