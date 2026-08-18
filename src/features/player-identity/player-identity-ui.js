(() => {
    'use strict';

    const ROOT_ATTR = 'data-vrh-player-identity';
    const USERNAME_ATTR = 'data-vrh-player-identity-username';
    const ROLE_ATTR = 'data-vrh-player-identity-role';
    const PREFIX_ATTR = 'data-vrh-player-identity-prefix';
    const VALID_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
    const PREFIX_PATTERN = /^\s*\[[^\]]+\]\s+/;

    let refreshTimer = null;
    let lastStats = {
        identityNodes: 0,
        processedNodes: 0,
        usernamesCollected: 0,
        applied: 0,
        fallback: 0,
        duplicates: 0
    };

    function toText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function normalizeUsername(username) {
        const text = toText(username);
        return text || '';
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function extractUsername(text) {
        const normalized = toText(text);

        if (!normalized) {
            return '';
        }

        const withoutPrefix = normalized.replace(PREFIX_PATTERN, '');

        if (VALID_USERNAME_PATTERN.test(withoutPrefix)) {
            return withoutPrefix;
        }

        const parts = withoutPrefix.split(/\s+/);
        const last = parts[parts.length - 1] || '';

        if (VALID_USERNAME_PATTERN.test(last)) {
            return last;
        }

        return '';
    }

    function getIdentityRoot(node) {
        if (!node) {
            return null;
        }

        if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(`[${ROOT_ATTR}]`)) {
            return node;
        }

        return node.querySelector?.(`[${ROOT_ATTR}]`) || null;
    }

    function isTargetVisible(node) {
        return Boolean(node && node.isConnected);
    }

    function shouldPreserveExistingMarkup(target) {
        return Boolean(
            target &&
            target.children &&
            target.children.length > 0
        );
    }

    function shouldRenderPrefix(targetText, player) {
        const prefix = toText(player?.displayPrefix || player?.prefix || player?.rankInfo?.prefix);

        if (!prefix) {
            return false;
        }

        const normalizedText = toText(targetText);

        if (PREFIX_PATTERN.test(normalizedText)) {
            return false;
        }

        const lowerText = normalizedText.toLowerCase();
        const lowerPrefix = prefix.toLowerCase();

        return !lowerText.startsWith(lowerPrefix) &&
            !lowerText.startsWith(`${lowerPrefix} `);
    }

    function createPrefixElement(player) {
        const displayPrefix = toText(player?.displayPrefix || player?.prefix || player?.rankInfo?.prefix);
        const prefix = document.createElement('span');
        prefix.className = 'vrh-player-identity__prefix';
        prefix.textContent = displayPrefix;
        applyPrefixAppearance(prefix, player);

        return prefix;
    }

    function clearPrefixAppearance(prefix) {
        if (!prefix) {
            return;
        }

        prefix.classList.remove('vrh-player-identity__prefix--gradient');
        prefix.style.backgroundImage = '';
        prefix.style.backgroundRepeat = '';
        prefix.style.backgroundSize = '';
        prefix.style.backgroundPosition = '';
        prefix.style.backgroundClip = '';
        prefix.style.webkitBackgroundClip = '';
        prefix.style.webkitTextFillColor = '';
        prefix.style.color = '';
    }

    function applyPrefixAppearance(prefix, player) {
        if (!prefix) {
            return;
        }

        clearPrefixAppearance(prefix);

        const colors = Array.isArray(player?.prefixColors)
            ? player.prefixColors.filter(Boolean)
            : [];

        if (colors.length >= 2) {
            prefix.classList.add('vrh-player-identity__prefix--gradient');
            prefix.style.backgroundImage = `linear-gradient(90deg, ${colors.join(', ')})`;
            prefix.style.backgroundRepeat = 'no-repeat';
            prefix.style.backgroundSize = '100% 100%';
            prefix.style.backgroundPosition = '0 0';
            prefix.style.color = 'transparent';
            prefix.style.webkitTextFillColor = 'transparent';
            return;
        }

        if (colors.length === 1) {
            prefix.style.color = colors[0];
            return;
        }

        if (player?.prefixColor) {
            prefix.style.color = player.prefixColor;
        }
    }

    function clearNameAppearance(name) {
        if (!name) {
            return;
        }

        name.classList.remove('vrh-player-identity__name--gradient');
        name.style.backgroundImage = '';
        name.style.backgroundRepeat = '';
        name.style.backgroundSize = '';
        name.style.backgroundPosition = '';
        name.style.backgroundClip = '';
        name.style.webkitBackgroundClip = '';
        name.style.webkitTextFillColor = '';
        name.style.color = '';
    }

    function applyNameAppearance(name, player) {
        if (!name) {
            return;
        }

        clearNameAppearance(name);

        const colors = Array.isArray(player?.usernameColors)
            ? player.usernameColors.filter(Boolean)
            : [];

        if (colors.length >= 2) {
            name.classList.add('vrh-player-identity__name--gradient');
            name.style.backgroundImage = `linear-gradient(90deg, ${colors.join(', ')})`;
            name.style.backgroundRepeat = 'no-repeat';
            name.style.backgroundSize = '100% 100%';
            name.style.backgroundPosition = '0 0';
            name.style.color = 'transparent';
            name.style.webkitTextFillColor = 'transparent';
            return;
        }

        if (colors.length === 1) {
            name.style.color = colors[0];
            return;
        }

        if (player?.usernameColor) {
            name.style.color = player.usernameColor;
        }
    }

    function createNameElement(player) {
        const name = document.createElement('span');
        name.className = 'vrh-player-identity__name';
        name.textContent = player.username || '';
        applyNameAppearance(name, player);

        return name;
    }

    function createStatusElement(player) {
        const status = document.createElement('span');
        status.className = player.online
            ? 'vrh-player-identity__status vrh-player-identity__status--online'
            : 'vrh-player-identity__status vrh-player-identity__status--offline';
        status.title = player.onlineMessage ||
            (player.online ? 'Игрок онлайн' : 'Игрок оффлайн');
        status.setAttribute('aria-hidden', 'true');
        return status;
    }

    function buildIdentityFragment(player, options = {}) {
        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('span');

        wrapper.className = options.compact
            ? 'vrh-player-identity vrh-player-identity--compact'
            : 'vrh-player-identity vrh-player-identity--expanded';
        wrapper.setAttribute(ROOT_ATTR, '1');
        wrapper.setAttribute(USERNAME_ATTR, player.username || '');
        wrapper.setAttribute(ROLE_ATTR, options.role || '');
        wrapper.setAttribute(
            PREFIX_ATTR,
            options.showPrefix && toText(player?.displayPrefix || player?.prefix || player?.rankInfo?.prefix)
                ? '1'
                : '0'
        );

        if (player.headUrl) {
            const head = document.createElement('img');
            head.className = 'vrh-player-identity__head';
            head.alt = '';
            head.src = player.headUrl;
            head.loading = 'lazy';
            head.decoding = 'async';
            head.setAttribute('aria-hidden', 'true');
            head.addEventListener('error', () => {
                head.remove();
            });
            wrapper.appendChild(head);
        }

        if (options.showPrefix && toText(player?.displayPrefix || player?.prefix || player?.rankInfo?.prefix)) {
            wrapper.appendChild(createPrefixElement(player));
        }

        wrapper.appendChild(createNameElement(player));

        if (player.online !== null) {
            wrapper.appendChild(createStatusElement(player));
        }

        fragment.appendChild(wrapper);
        return fragment;
    }

    function updateExistingIdentity(root, player) {
        if (!root) {
            return;
        }

        const prefix = root.querySelector('.vrh-player-identity__prefix');
        const name = root.querySelector('.vrh-player-identity__name');
        const status = root.querySelector('.vrh-player-identity__status');
        const head = root.querySelector('.vrh-player-identity__head');

        if (head && player.headUrl) {
            head.src = player.headUrl;
            head.style.display = '';
        }

        if (prefix) {
            const displayPrefix = toText(player?.displayPrefix || player?.prefix || player?.rankInfo?.prefix);

            if (displayPrefix) {
                prefix.textContent = displayPrefix;
                applyPrefixAppearance(prefix, player);
                prefix.hidden = false;
            } else {
                prefix.remove();
            }
        }

        if (name) {
            name.textContent = player.username || '';
            applyNameAppearance(name, player);
        }

        if (status) {
            if (player.online === null) {
                status.remove();
            } else {
                status.className = player.online
                    ? 'vrh-player-identity__status vrh-player-identity__status--online'
                    : 'vrh-player-identity__status vrh-player-identity__status--offline';
                status.title = player.onlineMessage ||
                    (player.online ? 'Игрок онлайн' : 'Игрок оффлайн');
            }
        } else if (player.online !== null) {
            root.appendChild(createStatusElement(player));
        }

        if (!prefix && root.getAttribute(PREFIX_ATTR) === '1' && toText(player?.displayPrefix || player?.prefix || player?.rankInfo?.prefix)) {
            const nameNode = root.querySelector('.vrh-player-identity__name');
            const prefixNode = createPrefixElement(player);

            if (nameNode?.parentNode) {
                nameNode.parentNode.insertBefore(prefixNode, nameNode);
            } else {
                root.insertBefore(prefixNode, root.firstChild);
            }
        }

        root.setAttribute(USERNAME_ATTR, player.username || '');
    }

    function replaceUsernameTextNode(target, player, role, options = {}) {
        const username = normalizeUsername(player?.username);

        if (!target || !username) {
            return false;
        }

        const walker = document.createTreeWalker(
            target,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (!node || !node.nodeValue) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    if (!node.parentElement) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    if (node.parentElement.closest?.(`[${ROOT_ATTR}]`)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return node.nodeValue.toLowerCase().includes(username.toLowerCase())
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            }
        );

        const textNode = walker.nextNode();

        if (!textNode) {
            return false;
        }

        const text = textNode.nodeValue || '';
        const index = text.toLowerCase().indexOf(username.toLowerCase());

        if (index < 0) {
            return false;
        }

        const before = text.slice(0, index);
        const after = text.slice(index + username.length);
        const fragment = buildIdentityFragment(player, {
            compact: Boolean(options.compact),
            role,
            showPrefix: options.showPrefix
        });

        const parent = textNode.parentNode;

        if (!parent) {
            return false;
        }

        // Strip stray rank-prefix text (e.g. "[MODER] " or "[] ") left
        // before the username — the identity widget owns its own prefix
        // rendering, and these text nodes cause baseline misalignment.
        const isRankPrefixRemnant = /^\s*(\[[^\]]*\])?\s*$/.test(before);

        if (before && !isRankPrefixRemnant) {
            parent.insertBefore(document.createTextNode(before), textNode);
        }

        parent.insertBefore(fragment, textNode);

        if (after) {
            parent.insertBefore(document.createTextNode(after), textNode);
        }

        parent.removeChild(textNode);

        return true;
    }

    function cleanupDuplicateRoots(target, username) {
        const roots = Array.from(target.querySelectorAll?.(`[${ROOT_ATTR}]`) || []);

        roots.forEach((root) => {
            const rootUsername = root.getAttribute(USERNAME_ATTR) || '';

            if (username && rootUsername.toLowerCase() === username.toLowerCase()) {
                return;
            }

            root.remove();
        });
    }

    function collectTableTargets() {
        const adapter = window.VimeReportDomAdapter;
        const table = adapter?.getReportsTable?.();

        if (!table) {
            return [];
        }

        const rows = adapter?.getReportRows?.() || [];
        const headerCells = Array.from(
            table.querySelectorAll('thead th, thead td')
        );
        const headers = headerCells.map((cell) => toText(cell.textContent).toLowerCase());

        let violatorIndex = -1;
        let reporterIndex = -1;

        headers.forEach((header, index) => {
            if (header.includes('нарушитель')) {
                violatorIndex = index;
            }

            if (header.includes('отправитель') || header.includes('репортер')) {
                reporterIndex = index;
            }
        });

        if (violatorIndex < 0 || reporterIndex < 0) {
            const firstRow = rows[0];
            const fallbackCells = firstRow
                ? Array.from(firstRow.querySelectorAll('th, td'))
                : [];

            if (fallbackCells.length >= 4) {
                violatorIndex = 2;
                reporterIndex = 3;
            }
        }

        if (violatorIndex < 0 || reporterIndex < 0) {
            return [];
        }

        const targets = [];

        rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll('td, th'));

            if (!cells.length) {
                return;
            }

            const violatorCell = cells[violatorIndex];
            const reporterCell = cells[reporterIndex];

            if (violatorCell) {
                targets.push({
                    node: violatorCell,
                    role: 'violator',
                    compact: true,
                    showPrefix: true,
                    text: toText(violatorCell.textContent)
                });
            }

            if (reporterCell) {
                targets.push({
                    node: reporterCell,
                    role: 'reporter',
                    compact: true,
                    showPrefix: true,
                    text: toText(reporterCell.textContent)
                });
            }
        });

        return targets;
    }

    function collectModalTargets() {
        const adapter = window.VimeReportDomAdapter;
        const report = adapter?.getCurrentReport?.();

        if (!adapter?.isReportOpen?.()) {
            return [];
        }

        return [
            {
                node: document.querySelector('#mr_violator'),
                role: 'violator',
                compact: false,
                showPrefix: true,
                text: report?.violator || ''
            },
            {
                node: document.querySelector('#mr_reporter'),
                role: 'reporter',
                compact: false,
                showPrefix: true,
                text: report?.reporter || ''
            }
        ].filter((item) => Boolean(item.node));
    }

    function collectTargets() {
        return [
            ...collectTableTargets(),
            ...collectModalTargets()
        ];
    }

    async function refresh() {
        const identity = window.VimeReportPlayerIdentity;

        if (!identity || typeof identity.getPlayers !== 'function') {
            lastStats = {
                identityNodes: 0,
                processedNodes: 0,
                usernamesCollected: 0,
                applied: 0,
                fallback: 0,
                duplicates: 0
            };

            return lastStats;
        }

        const targets = collectTargets();
        const usernames = [];
        const seen = new Set();
        let duplicates = 0;

        targets.forEach((item) => {
            const node = item.node;
            if (!node || !isTargetVisible(node)) {
                return;
            }

            const currentRoot = getIdentityRoot(node);
            const currentUsername = toText(currentRoot?.getAttribute(USERNAME_ATTR) || '');
            const extracted = extractUsername(item.text || node.textContent || '');

            if (extracted) {
                const key = extracted.toLowerCase();
                if (seen.has(key)) {
                    duplicates += 1;
                } else {
                    seen.add(key);
                    usernames.push(extracted);
                }
            } else if (currentUsername) {
                const key = currentUsername.toLowerCase();
                if (seen.has(key)) {
                    duplicates += 1;
                } else {
                    seen.add(key);
                    usernames.push(currentUsername);
                }
            }
        });

        if (!usernames.length) {
            lastStats = {
                identityNodes: targets.length,
                processedNodes: 0,
                usernamesCollected: 0,
                applied: 0,
                fallback: 0,
                duplicates
            };

            return lastStats;
        }

        const players = await identity.getPlayers(usernames);
        const byName = new Map(
            players.map((player) => [toText(player?.username).toLowerCase(), player])
        );

        let processedNodes = 0;
        let applied = 0;
        let fallback = 0;

        targets.forEach((item) => {
            const node = item.node;
            if (!node || !isTargetVisible(node)) {
                return;
            }

            const text = item.text || node.textContent || '';
            const username = extractUsername(text) || getIdentityRoot(node)?.getAttribute(USERNAME_ATTR) || '';
            const player = byName.get(username.toLowerCase());

            processedNodes += 1;

            if (!player || player.available === false) {
                fallback += 1;
                return;
            }

            cleanupDuplicateRoots(node, player.username);

            const existingRoot = getIdentityRoot(node);

            if (existingRoot && existingRoot.getAttribute(USERNAME_ATTR)?.toLowerCase() === player.username.toLowerCase()) {
                updateExistingIdentity(existingRoot, player);
                applied += 1;
                return;
            }

            const shouldPrefix = shouldRenderPrefix(text, player);
            const replaced = replaceUsernameTextNode(node, player, item.role, {
                compact: item.compact,
                showPrefix: shouldPrefix
            });

            if (!replaced) {
                fallback += 1;
                return;
            }

            applied += 1;
        });

        lastStats = {
            identityNodes: targets.length,
            processedNodes,
            usernamesCollected: usernames.length,
            applied,
            fallback,
            duplicates
        };

        return lastStats;
    }

    function scheduleRefresh() {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }

        refreshTimer = window.setTimeout(() => {
            refreshTimer = null;
            refresh();
        }, 80);
    }

    function debug() {
        const stats = lastStats;

        console.group('[Vime Report Helper] Player Identity UI');
        console.table([stats]);
        console.groupEnd();

        return stats;
    }

    window.VimeReportPlayerIdentityUI = {
        refresh,
        scheduleRefresh,
        debug
    };
})();
