(() => {
    'use strict';

    /*
     * =========================================================
     * VIMEWORLD PROHIBITED WORDS DATABASE
     * =========================================================
     *
     * Загружает словарь из:
     *
     * src/data/prohibited-words.txt
     *
     * Формат TXT:
     * одно слово / выражение на одной строке.
     * =========================================================
     */


    const prohibitedWords = [];


    /*
     * Сразу экспортируем массив.
     *
     * Scanner всегда работает именно с этим массивом.
     * После загрузки TXT мы просто заполняем его.
     */
    window.VimeReportProhibitedWords =
        prohibitedWords;


    window.VimeReportProhibitedWordsReady =
        false;


    async function loadDictionary() {
        try {
            const dictionaryUrl =
                chrome.runtime.getURL(
                    'src/data/prohibited-words.txt'
                );


            const response =
                await fetch(
                    dictionaryUrl
                );


            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            const rawText =
                await response.text();


            const words =
                rawText
                    .split(/\r?\n/)
                    .map(
                        (line) =>
                            line.trim()
                    )
                    .filter(
                        (line) =>
                            line.length > 0
                    );


            /*
             * Удаляем дубликаты.
             */

            const uniqueWords =
                [
                    ...new Set(
                        words
                    )
                ];


            prohibitedWords.splice(
                0,
                prohibitedWords.length,
                ...uniqueWords
            );


            window.VimeReportProhibitedWordsReady =
                true;


            console.log(
                '[Vime Report Helper] Prohibited Words loaded:',
                prohibitedWords.length
            );

        } catch (error) {
            window.VimeReportProhibitedWordsReady =
                false;


            console.error(
                '[Vime Report Helper] Failed to load prohibited words:',
                error
            );
        }
    }


    loadDictionary();

})();