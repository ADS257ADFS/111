        function generateUUID() {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                try { return crypto.randomUUID(); } catch (e) { }
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        const CID = localStorage.getItem("client_id") || generateUUID();
        localStorage.setItem("client_id", CID);
        const ACTIVE_PAGE_KEY = 'studio_active_page';
        const LOCAL_NAV_COLLAPSED_KEY = 'studio_local_nav_collapsed';
        const SIDEBAR_PINNED_KEY = 'studio_sidebar_pinned';
        const GPT_DOCK_WIDTH_KEY = 'studio_gpt_dock_width';
        const GPT_DOCK_COLLAPSED_KEY = 'studio_gpt_dock_collapsed';
        const GPT_DOCK_VISUAL_INSET = 12;
        const GPT_DOCK_RESIZER_WIDTH = 18;
        const GPT_DOCK_CLOSE_MOTION_MS = 360;
        const DEFAULT_PAGE_ID = 'canvas';
        const PAGE_IDS = ['agent-chat','gpt-chat','canvas','api-settings','runninghub-settings'];
        const LOCAL_PAGE_IDS = [];
        const PROJECT_URL = '';
        let appInfo = { version:'', repo_url:'', version_url:'' };
        let gptDockCloseTimer = 0;

        function getActiveCanvasFrame() {
            return document.getElementById('frame-canvas');
        }

        function getActiveCanvasPageId() {
            return 'canvas';
        }

        window.getActiveCanvasFrame = getActiveCanvasFrame;
        window.getActiveCanvasPageId = getActiveCanvasPageId;

        function setSidebarPinned(pinned, options = {}) {
            const sidebar = document.getElementById('studioSidebar');
            const logo = document.getElementById('sidebarLogoToggle');
            if(!sidebar) return;
            sidebar.classList.toggle('is-pinned', pinned);
            if(!pinned) {
                sidebar.classList.add('is-collapsing');
                window.setTimeout(() => sidebar.classList.remove('is-collapsing'), 360);
            } else {
                sidebar.classList.remove('is-collapsing');
            }
            if(logo) {
                logo.setAttribute('aria-pressed', pinned ? 'true' : 'false');
                logo.title = pinned ? '收起导航栏' : '固定导航栏';
            }
            if(!options.skipRemember) localStorage.setItem(SIDEBAR_PINNED_KEY, pinned ? '1' : '0');
        }

        function toggleSidebarPinned(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const sidebar = document.getElementById('studioSidebar');
            setSidebarPinned(!sidebar?.classList.contains('is-pinned'));
        }

        function restoreSidebarPinned() {
            setSidebarPinned(localStorage.getItem(SIDEBAR_PINNED_KEY) === '1', { skipRemember:true });
        }

        function setLocalNavCollapsed(collapsed, options = {}) {
            const group = document.getElementById('local-nav-group');
            const toggle = document.getElementById('local-nav-toggle');
            if(group) group.classList.toggle('is-collapsed', collapsed);
            if(toggle) {
                toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                toggle.title = collapsed ? '展开侧栏' : '收起侧栏';
            }
            if(!options.skipRemember) localStorage.setItem(LOCAL_NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
        }

        function toggleLocalNav() {
            const group = document.getElementById('local-nav-group');
            setLocalNavCollapsed(!group?.classList.contains('is-collapsed'));
        }

        function gptDockFrameSrc(){
            const raw = document.getElementById('frame-gpt-dock')?.dataset?.src || '/static/apps/gpt-dock/gpt-chat.html';
            const url = new URL(raw, location.origin);
            if(!url.searchParams.has('dock')) url.searchParams.set('dock', '1');
            return url.pathname + url.search;
        }

        function needsGptDockFrameReload(frame) {
            if(!frame) return false;
            const want = new URL(gptDockFrameSrc(), location.origin);
            const cur = frame.src ? new URL(frame.src, location.origin) : null;
            if(!cur) return true;
            if(cur.searchParams.get('dock') !== '1') return true;
            const wantVersion = want.searchParams.get('v') || '';
            const curVersion = cur.searchParams.get('v') || '';
            return Boolean(wantVersion && curVersion !== wantVersion);
        }

        function loadGptDockFrame() {
            const dockFrame = document.getElementById('frame-gpt-dock');
            if (dockFrame && (!dockFrame.src || needsGptDockFrameReload(dockFrame))) {
                dockFrame.src = gptDockFrameSrc();
            }
            if (dockFrame) {
                syncThemeToFrame(dockFrame);
                syncLanguageToFrame(dockFrame);
            }
        }

        function syncDockShellChatTitle(title, conversationId) {
            const el = document.getElementById('dockShellChatTitle');
            if(!el) return;
            const raw = String(title || '').trim();
            const isDefault = !raw || raw === '新对话' || raw === 'New Chat' || raw === '未命名项目' || raw === '未命名对话' || raw === 'Untitled Project' || raw === 'Untitled Chat';
            el.textContent = isDefault ? '未命名对话' : raw;
            if (conversationId !== undefined) {
                dockShellCurrentConversationId = String(conversationId || '');
            }
        }

        const DOCK_CHAT_USER_ID = 'lightbox-desktop-chat';
        let dockShellCurrentConversationId = '';
        let dockTitleMenuHideTimer = 0;

        function dockChatUserId() {
            return DOCK_CHAT_USER_ID;
        }

        function escapeDockMenuText(value) {
            return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function formatDockRelativeTime(value) {
            let timestamp = Number(value || 0);
            // Support second-based timestamps from older conversation files.
            if (timestamp > 0 && timestamp < 1e12) timestamp *= 1000;
            const elapsed = Math.max(0, Date.now() - timestamp);
            const minute = 60 * 1000;
            const hour = 60 * minute;
            const day = 24 * hour;
            if (!timestamp || elapsed < minute) return '刚刚';
            if (elapsed < hour) return `${Math.floor(elapsed / minute)}分钟`;
            if (elapsed < day) return `${Math.floor(elapsed / hour)}小时`;
            return `${Math.floor(elapsed / day)}天`;
        }

        function formatDockConversationMeta(item) {
            // Match left-sidebar project meta: "Np · 刚刚/N分钟/N小时/N天" (no 前).
            const count = Number(
                item?.message_count
                ?? item?.messages_count
                ?? item?.messageCount
                ?? item?.count
                ?? (Array.isArray(item?.messages)
                    ? item.messages.filter(message => message?.role !== 'system').length
                    : 0)
                ?? 0
            ) || 0;
            const time = formatDockRelativeTime(item?.updated_at ?? item?.updatedAt);
            return `${count}p · ${time}`;
        }

        function normalizeDockMenuTitle(title) {
            const raw = String(title || '').trim();
            if (!raw || raw === '新对话' || raw === 'New Chat' || raw === '未命名项目' || raw === '未命名对话' || raw === 'Untitled Project' || raw === 'Untitled Chat') {
                return '未命名对话';
            }
            return raw;
        }

        async function fetchDockConversations() {
            const response = await fetch('/api/conversations', { headers: { 'X-User-ID': dockChatUserId() } });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            return data.conversations || [];
        }

        function renderDockTitleMenu(conversations) {
            const list = document.getElementById('dockShellMenuHistoryList');
            if (!list) return;
            if (!conversations.length) {
                list.innerHTML = '<div class="dock-chrome-menu-empty">暂无历史对话</div>';
                return;
            }
            list.innerHTML = conversations.map(item => {
                const id = String(item.id || '');
                const title = normalizeDockMenuTitle(item.title);
                const rawTitle = String(item.title || '').trim() || '未命名对话';
                const time = formatDockConversationMeta(item);
                const active = id && id === dockShellCurrentConversationId ? ' is-active' : '';
                return `<div class="dock-chrome-menu-item${active}" role="menuitem">
                    <button type="button" class="dock-chrome-menu-item-open" data-conversation-id="${escapeDockMenuText(id)}" data-conversation-title="${escapeDockMenuText(rawTitle)}">
                        <span class="dock-chrome-menu-item-title">${escapeDockMenuText(title)}</span>
                    </button>
                    <span class="dock-chrome-menu-item-time">${escapeDockMenuText(time)}</span>
                    <span class="dock-chrome-menu-item-actions">
                        <button type="button" class="dock-chrome-menu-item-rename" data-conversation-id="${escapeDockMenuText(id)}" data-conversation-title="${escapeDockMenuText(rawTitle)}" title="重命名" aria-label="重命名">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button type="button" class="dock-chrome-menu-item-delete" data-conversation-id="${escapeDockMenuText(id)}" title="删除" aria-label="删除">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </span>
                </div>`;
            }).join('');
            if (window.lucide) window.lucide.createIcons();
        }

        async function renameDockConversation(btn) {
            const id = btn.getAttribute('data-conversation-id');
            const currentTitle = btn.getAttribute('data-conversation-title') || '未命名对话';
            if (!id) return;
            const next = prompt('新的对话名称', currentTitle);
            if (!next || next.trim() === currentTitle) return;
            const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': dockChatUserId(),
                },
                body: JSON.stringify({ title: next.trim() }),
            });
            if (!response.ok) throw new Error(await response.text());
            const conversations = await fetchDockConversations();
            renderDockTitleMenu(conversations);
            schedulePositionDockTitleMenu();
        }

        async function deleteDockConversation(btn) {
            const id = btn.getAttribute('data-conversation-id');
            if (!id) return;
            if (!confirm('确定删除这条对话吗？')) return;
            const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: { 'X-User-ID': dockChatUserId() },
            });
            if (!response.ok) throw new Error(await response.text());
            postToGptDockFrame({
                source: 'shell-project-history',
                type: 'shell-chat-conversation-deleted',
                conversation_id: id,
            });
            if (id === dockShellCurrentConversationId) dockShellCurrentConversationId = '';
            const conversations = await fetchDockConversations();
            renderDockTitleMenu(conversations);
            schedulePositionDockTitleMenu();
        }

        function positionDockTitleMenu() {
            const menu = document.getElementById('dockShellTitleMenu');
            const anchor = document.getElementById('dockShellTitleMenuBtn');
            if (!menu || menu.hidden || !anchor) return;
            const rect = anchor.getBoundingClientRect();
            const gap = 2;
            const edge = 12;
            const menuWidth = menu.offsetWidth || 176;
            const menuHeight = menu.offsetHeight || 240;
            let left = rect.left;
            let top = rect.bottom + gap;
            if (left + menuWidth > window.innerWidth - edge) {
                left = Math.max(edge, window.innerWidth - edge - menuWidth);
            }
            if (top + menuHeight > window.innerHeight - edge) {
                top = Math.max(edge, rect.top - gap - menuHeight);
            }
            menu.style.left = `${Math.round(left)}px`;
            menu.style.top = `${Math.round(top)}px`;
        }

        function schedulePositionDockTitleMenu() {
            positionDockTitleMenu();
            requestAnimationFrame(() => {
                positionDockTitleMenu();
                requestAnimationFrame(positionDockTitleMenu);
            });
        }

        function ensureDockTitleMenuTopLayer() {
            const menu = document.getElementById('dockShellTitleMenu');
            if (!menu || menu.dataset.topLayer === '1') return;
            document.body.appendChild(menu);
            menu.dataset.topLayer = '1';
        }

        function setDockTitleMenuIframeBlock(open) {
            const frame = document.getElementById('frame-gpt-dock');
            if (!frame) return;
            if (open) {
                if (frame.dataset.dockMenuPeSaved === undefined) {
                    frame.dataset.dockMenuPeSaved = frame.style.pointerEvents || '';
                }
                frame.style.pointerEvents = 'none';
                return;
            }
            if (frame.dataset.dockMenuPeSaved !== undefined) {
                frame.style.pointerEvents = frame.dataset.dockMenuPeSaved;
                delete frame.dataset.dockMenuPeSaved;
            } else {
                frame.style.removeProperty('pointer-events');
            }
        }

        function setDockTitleMenuOpen(open) {
            const menu = document.getElementById('dockShellTitleMenu');
            const btn = document.getElementById('dockShellTitleMenuBtn');
            if (!menu || !btn) return;
            const on = Boolean(open);
            window.clearTimeout(dockTitleMenuHideTimer);
            dockTitleMenuHideTimer = 0;
            if (on) {
                ensureDockTitleMenuTopLayer();
                menu.hidden = false;
            }
            btn.setAttribute('aria-expanded', on ? 'true' : 'false');
            btn.classList.toggle('is-open', on);
            document.documentElement.classList.toggle('dock-title-menu-open', on);
            setDockTitleMenuIframeBlock(on);
            if (on) {
                schedulePositionDockTitleMenu();
                requestAnimationFrame(() => {
                    if (btn.getAttribute('aria-expanded') !== 'true') return;
                    menu.classList.add('is-visible');
                    schedulePositionDockTitleMenu();
                });
                return;
            }
            menu.classList.remove('is-visible');
            dockTitleMenuHideTimer = window.setTimeout(() => {
                if (!menu.classList.contains('is-visible')) menu.hidden = true;
                dockTitleMenuHideTimer = 0;
            }, 240);
        }

        function toggleDockTitleMenu(force) {
            const menu = document.getElementById('dockShellTitleMenu');
            const btn = document.getElementById('dockShellTitleMenuBtn');
            if (!menu || !btn) return;
            const nextOpen = typeof force === 'boolean'
                ? force
                : btn.getAttribute('aria-expanded') !== 'true';
            if (!nextOpen) {
                setDockTitleMenuOpen(false);
                return;
            }
            setDockTitleMenuOpen(true);
            fetchDockConversations()
                .then(conversations => {
                    renderDockTitleMenu(conversations);
                    schedulePositionDockTitleMenu();
                })
                .catch(() => {
                    renderDockTitleMenu([]);
                    schedulePositionDockTitleMenu();
                });
        }

        function initDockTitleMenu() {
            const toggleBtn = document.getElementById('dockShellTitleMenuBtn');
            const menu = document.getElementById('dockShellTitleMenu');
            const list = document.getElementById('dockShellMenuHistoryList');
            if (!toggleBtn || !menu || toggleBtn.dataset.bound) return;
            toggleBtn.dataset.bound = '1';

            toggleBtn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                toggleDockTitleMenu();
            });

            list?.addEventListener('click', event => {
                const renameBtn = event.target.closest('.dock-chrome-menu-item-rename');
                if (renameBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    renameDockConversation(renameBtn).catch(() => {});
                    return;
                }
                const deleteBtn = event.target.closest('.dock-chrome-menu-item-delete');
                if (deleteBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteDockConversation(deleteBtn).catch(() => {});
                    return;
                }
                const openBtn = event.target.closest('.dock-chrome-menu-item-open');
                if (!openBtn) return;
                event.preventDefault();
                const conversationId = openBtn.getAttribute('data-conversation-id');
                if (!conversationId) return;
                postToGptDockFrame({
                    source: 'shell-project-history',
                    type: 'shell-open-chat-conversation',
                    conversation_id: conversationId,
                });
                toggleDockTitleMenu(false);
            });

            document.addEventListener('click', event => {
                if (menu.hidden) return;
                if (menu.contains(event.target)) return;
                if (toggleBtn.contains(event.target)) return;
                toggleDockTitleMenu(false);
            });

            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && !menu.hidden) toggleDockTitleMenu(false);
            });

            window.addEventListener('resize', () => {
                if (!menu.hidden) schedulePositionDockTitleMenu();
            });
        }

        function syncGptDockVisibility(pageId, options = {}) {
            const onCanvas = pageId === 'canvas';
            document.documentElement.classList.toggle('studio-hide-gpt-dock', !onCanvas);
            const openButton = document.getElementById('gptDockOpenBtn');
            if(openButton){
                openButton.hidden = !onCanvas;
                openButton.setAttribute('aria-hidden', onCanvas ? 'false' : 'true');
            }
            syncTopUserButtonDockPosition();
            window.SmartCanvasShellUserMenu?.reposition?.();
            syncCanvasComposerDockInset();
            if (onCanvas && !document.documentElement.classList.contains('gpt-dock-collapsed')) {
                if(options.deferLoad) {
                    window.requestAnimationFrame(() => window.setTimeout(loadGptDockFrame, 0));
                } else {
                    loadGptDockFrame();
                }
            }
        }

        function isShellAssetLibraryOpen() {
            return document.getElementById('toolbarAssetBtn')?.getAttribute('aria-pressed') === 'true';
        }

        const SHELL_ASSET_PANEL_WIDTH_KEY = 'smart_canvas_asset_panel_width';
        // Keep the shell peek viewport wide enough for the left rail plus the
        // asset panel, so the panel can slide out from the rail's right edge.
        const SHELL_ASSET_PANEL_LEFT = 16;
        const SHELL_ASSET_PANEL_FIXED = 396;

        function readShellAssetPanelWidth() {
            return SHELL_ASSET_PANEL_FIXED;
        }

        function setShellAssetPeekWidth(panelWidth) {
            const width = SHELL_ASSET_PANEL_FIXED;
            document.documentElement.style.setProperty('--shell-asset-peek-width', `${SHELL_ASSET_PANEL_LEFT + width}px`);
            return width;
        }

        function syncShellAssetPeekWidth() {
            try { localStorage.setItem(SHELL_ASSET_PANEL_WIDTH_KEY, String(SHELL_ASSET_PANEL_FIXED)); } catch(e) {}
            return setShellAssetPeekWidth(SHELL_ASSET_PANEL_FIXED);
        }

        function beginShellAssetOverlayClose() {
            document.documentElement.classList.add('shell-asset-closing');
        }

        function finishShellAssetOverlayClose() {
            setShellAssetOverlayMode(false);
            requestAnimationFrame(() => {
                document.documentElement.classList.remove('shell-asset-closing');
            });
        }

        function syncShellAssetToolbar(open) {
            document.documentElement.classList.toggle('shell-asset-library-open', Boolean(open));
            const assetBtn = document.getElementById('toolbarAssetBtn');
            if(!assetBtn) return;
            assetBtn.classList.toggle('active', Boolean(open));
            assetBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
        }

        function syncShellAssetLibraryChrome(open) {
            const want = Boolean(open);
            if(want) {
                closeShellCanvasHistory();
                syncShellAssetToolbar(true);
                syncShellAssetPeekWidth();
                setShellAssetOverlayMode(true);
                syncShellLeftRailRecessed();
                return;
            }
            syncShellAssetToolbar(false);
            syncShellLeftRailRecessed();
            if(!isCanvasPageActive() && document.documentElement.classList.contains('shell-asset-overlay-mode')) {
                beginShellAssetOverlayClose();
                finishShellAssetOverlayClose();
                return;
            }
            setShellAssetOverlayMode(false);
        }

        function ensureCanvasFrameLoaded() {
            const frame = getActiveCanvasFrame();
            if(frame && !frame.src) frame.src = frame.dataset.src;
            return frame;
        }

        function setShellAssetOverlayMode(open) {
            const wantOverlay = Boolean(open) && !isCanvasPageActive();
            document.documentElement.classList.toggle('shell-asset-overlay-mode', wantOverlay);
            const frame = getActiveCanvasFrame();
            if(frame) frame.classList.toggle('shell-asset-peek', wantOverlay);
            const backdrop = document.getElementById('shellAssetBackdrop');
            if(backdrop) {
                backdrop.hidden = !wantOverlay;
                backdrop.setAttribute('aria-hidden', wantOverlay ? 'false' : 'true');
            }
            primeCanvasAssetPeek(wantOverlay);
        }

        function primeCanvasAssetPeek(active) {
            const frame = ensureCanvasFrameLoaded();
            if(!frame) return;
            try {
                frame.contentWindow?.document?.documentElement?.classList?.toggle('is-shell-asset-peek', Boolean(active));
            } catch(e) {}
            postToCanvasFrame({ type: 'shell-asset-overlay', active: Boolean(active) });
        }

        function driveCanvasAssetLibraryOpen() {
            const frame = ensureCanvasFrameLoaded();
            if(!frame) return;
            if(!isCanvasPageActive()) {
                syncShellAssetPeekWidth();
                primeCanvasAssetPeek(true);
            }
            try {
                const ctx = frame.contentWindow?.SmartCanvasCore?.tryDeps?.();
                if(ctx?.toggleAssetLibrary) {
                    const panelOpen = Boolean(ctx.assetPanel?.classList?.contains('open'));
                    if(!ctx.assetLibraryOpen || !panelOpen) ctx.toggleAssetLibrary(true);
                    return;
                }
            } catch(e) {}
            postToCanvasFrame({ type: 'set-asset-library-open', open: true });
        }

        function openShellAssetLibrary(options = {}) {
            const fromCanvas = Boolean(options.fromCanvas);
            globalThis.SmartCanvasShellUserMenu?.close?.({ immediate: true });
            globalThis.SmartCanvasShellSettings?.close?.();
            if(!fromCanvas && !isCanvasPageActive()) {
                if(isShellAssetLibraryOpen()) return;
                syncShellAssetToolbar(true);
                syncShellAssetPeekWidth();
                setShellAssetOverlayMode(true);
                syncShellLeftRailRecessed();
                postToCanvasFrame({ type: 'set-asset-library-open', open: true });
                return;
            }
            if(!fromCanvas && isShellAssetLibraryOpen()) return;
            ensureCanvasFrameLoaded();
            if(!fromCanvas) closeShellCanvasHistory();
            syncShellAssetToolbar(true);
            setShellAssetOverlayMode(true);
            syncShellLeftRailRecessed();
            if(fromCanvas) return;
            driveCanvasAssetLibraryOpen();
        }

        function closeShellAssetLibrary(options = {}) {
            const fromCanvas = Boolean(options.fromCanvas);
            syncShellAssetToolbar(false);
            syncShellLeftRailRecessed();
            if(!isCanvasPageActive()) {
                beginShellAssetOverlayClose();
                if(!fromCanvas) {
                    postToCanvasFrame({ type: 'set-asset-library-open', open: false, silent: true });
                }
                finishShellAssetOverlayClose();
                return;
            }
            setShellAssetOverlayMode(false);
            if(fromCanvas) return;
            try {
                const ctx = getActiveCanvasFrame()?.contentWindow?.SmartCanvasCore?.tryDeps?.();
                if(ctx?.assetPanel?.classList?.contains('open') || ctx?.assetLibraryOpen){
                    ctx.toggleAssetLibrary(false);
                }
            } catch(e) {}
            postToCanvasFrame({ type: 'set-asset-library-open', open: false });
        }

        function toggleShellAssetLibrary(force) {
            const nextOpen = force === undefined ? !isShellAssetLibraryOpen() : Boolean(force);
            if(nextOpen) openShellAssetLibrary();
            else closeShellAssetLibrary();
        }

        window.isShellAssetLibraryOpen = isShellAssetLibraryOpen;
        window.syncShellAssetLibraryChrome = syncShellAssetLibraryChrome;
        window.openShellAssetLibrary = openShellAssetLibrary;
        window.closeShellAssetLibrary = closeShellAssetLibrary;
        window.toggleShellAssetLibrary = toggleShellAssetLibrary;

        function syncShellLeftRailRecessed() {
            document.documentElement.classList.remove('shell-left-rail-recessed');
            postToCanvasFrame({ type: 'shell-left-rail-recessed', recessed: false });
        }

        function shellCanvasProjectTitle(value) {
            const title = String(value || '').trim();
            if(!title || title === '智能画布' || title === 'Smart Canvas') return '未命名画布';
            return title;
        }

        function syncShellCanvasProjectState(data = {}) {
            const button = document.getElementById('shellCanvasProjectMenuBtn');
            const title = document.getElementById('shellCanvasProjectTitle');
            if(title && Object.prototype.hasOwnProperty.call(data, 'title')) {
                title.textContent = shellCanvasProjectTitle(data.title);
                title.title = title.textContent;
            }
            if(button && Object.prototype.hasOwnProperty.call(data, 'history_open')) {
                const open = Boolean(data.history_open);
                button.setAttribute('aria-expanded', open ? 'true' : 'false');
                button.classList.toggle('active', open);
            }
        }

        function toggleShellCanvasProjectHistory(force) {
            const button = document.getElementById('shellCanvasProjectMenuBtn');
            if(!button) return;
            const current = button.getAttribute('aria-expanded') === 'true';
            const next = force === undefined ? !current : Boolean(force);
            button.setAttribute('aria-expanded', next ? 'true' : 'false');
            button.classList.toggle('active', next);
            window.SmartCanvasShellHistory?.toggle?.(next);
        }

        window.syncShellCanvasProjectState = syncShellCanvasProjectState;
        window.toggleShellCanvasProjectHistory = toggleShellCanvasProjectHistory;

        function setShellPrimaryRailActive(section) {
            document.querySelectorAll('[data-shell-primary-nav]').forEach(button => {
                if(button.dataset.shellPrimaryNav === section) button.setAttribute('data-shell-primary-active', 'true');
                else button.removeAttribute('data-shell-primary-active');
            });
        }

        function initFloatingToolbar() {
            initShellCanvasHistory();
            initShellSettings();
            initCanvasComposerInsetObservers();
            const floatingToolbar = document.querySelector('.floating-toolbar');
            if(floatingToolbar && !floatingToolbar.dataset.gliderBound) {
                floatingToolbar.dataset.gliderBound = '1';
                const moveGlider = button => {
                    if(!button) return;
                    const toolbarRect = floatingToolbar.getBoundingClientRect();
                    const buttonRect = button.getBoundingClientRect();
                    if(!toolbarRect.height || !buttonRect.height) return;
                    floatingToolbar.style.setProperty('--rail-glider-y', `${buttonRect.top - toolbarRect.top}px`);
                    floatingToolbar.classList.add('has-item-glider');
                };
                floatingToolbar.querySelectorAll('.tool-button').forEach(button => {
                    button.addEventListener('pointerenter', () => moveGlider(button));
                    button.addEventListener('pointerdown', () => {
                        button.dataset.railPointerPress = '1';
                    });
                    button.addEventListener('focus', () => {
                        // Pointer clicks also focus buttons. Only keyboard focus should
                        // recreate the hover capsule after the pointer has left.
                        if(button.matches(':focus-visible')) moveGlider(button);
                    });
                    button.addEventListener('click', () => {
                        const pointerTriggered = button.dataset.railPointerPress === '1';
                        delete button.dataset.railPointerPress;
                        if(!pointerTriggered) return;
                        requestAnimationFrame(() => {
                            floatingToolbar.classList.remove('has-item-glider');
                            button.blur();
                        });
                    });
                });
                floatingToolbar.addEventListener('pointerleave', () => {
                    // Pointer hover owns the glider while the pointer is over the rail.
                    // A clicked tool can retain DOM focus after the pointer leaves; that
                    // focus must not leave the white hover capsule stranded behind it.
                    floatingToolbar.classList.remove('has-item-glider');
                });
                floatingToolbar.addEventListener('focusout', () => {
                    requestAnimationFrame(() => {
                        if(!floatingToolbar.contains(document.activeElement)) {
                            floatingToolbar.classList.remove('has-item-glider');
                        }
                    });
                });
            }
            const assetBackdrop = document.getElementById('shellAssetBackdrop');
            if(assetBackdrop && !assetBackdrop.dataset.bound) {
                assetBackdrop.dataset.bound = '1';
                assetBackdrop.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if(isShellAssetLibraryOpen()) closeShellAssetLibrary();
                });
            }
            const assetBtn = document.getElementById('toolbarAssetBtn');
            if(assetBtn && !assetBtn.dataset.bound) {
                assetBtn.dataset.bound = '1';
                assetBtn.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if(window._assetLibraryGhostClickUntil && Date.now() < window._assetLibraryGhostClickUntil){
                        window._assetLibraryGhostClickUntil = 0;
                        return;
                    }
                    toggleShellCanvasProjectHistory(false);
                    toggleShellAssetLibrary();
                });
            }
            const projectMenuBtn = document.getElementById('shellCanvasProjectMenuBtn');
            if(projectMenuBtn && !projectMenuBtn.dataset.bound) {
                projectMenuBtn.dataset.bound = '1';
                projectMenuBtn.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if(!isCanvasPageActive()) ensureCanvasShellVisible();
                    if(isShellAssetLibraryOpen()) closeShellAssetLibrary();
                    toggleShellCanvasProjectHistory();
                });
                document.addEventListener('click', event => {
                    if(projectMenuBtn.getAttribute('aria-expanded') !== 'true') return;
                    const target = event.target;
                    if(!(target instanceof Element)) return;
                    if(target.closest('#shellProjectHistoryModal, #mmSideAll, #mmSidebar, .shell-primary-rail, #shellCanvasProjectMenuBtn')) return;
                    toggleShellCanvasProjectHistory(false);
                });
                document.addEventListener('keydown', event => {
                    if(event.key === 'Escape' && projectMenuBtn.getAttribute('aria-expanded') === 'true') {
                        toggleShellCanvasProjectHistory(false);
                    }
                });
                document.querySelectorAll('#frame-canvas').forEach(frame => {
                    frame.addEventListener('load', () => {
                        if(frame.classList.contains('active')) postToCanvasFrame({ type:'shell-request-canvas-project-state' });
                    });
                });
            }
            const newBtn = document.getElementById('shellNewCanvasBtn');
            if(newBtn && !newBtn.dataset.bound) {
                newBtn.dataset.bound = '1';
                newBtn.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if(!isCanvasPageActive()) {
                        ensureCanvasShellVisible();
                    }
                    toggleShellCanvasProjectHistory(false);
                    postToCanvasFrame({ type: 'shell-new-canvas' });
                });
            }
            const railUserBtn = document.getElementById('shellRailUserBtn');
            if(railUserBtn && !railUserBtn.dataset.bound) {
                railUserBtn.dataset.bound = '1';
                railUserBtn.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.SmartCanvasShellSettings?.open?.('account');
                });
            }
            document.querySelectorAll('[data-shell-primary-nav]').forEach(button => {
                if(button.dataset.primaryNavBound === '1') return;
                button.dataset.primaryNavBound = '1';
                button.addEventListener('click', () => {
                    const section = button.dataset.shellPrimaryNav || 'canvas';
                    if(section !== 'canvas') return;
                    setShellPrimaryRailActive('canvas');
                    button.blur();
                    if(!document.getElementById('frame-canvas')?.classList.contains('active')) {
                        switchUI(null, 'canvas');
                    }
                    // Switching modes from the rail is itself a chrome interaction:
                    // the target canvas must not answer with recessed chrome, which
                    // would slide the rail (and this very button) off screen.
                    // Repeats cover a still-booting iframe; the reveal is idempotent.
                    [0, 600, 1500].forEach(delay => setTimeout(
                        () => postToCanvasFrame({ type: 'shell-reveal-empty-chrome' }), delay));
                    closeGptDock();
                });
            });
        }

        function clampGptDockWidth(width) {
            if (document.documentElement.classList.contains('lightbox-desktop-native')) {
                const tokens = getComputedStyle(document.documentElement);
                const minWidth = parseFloat(tokens.getPropertyValue('--ui-chat-dock-width-min')) || 360;
                const maxWidth = parseFloat(tokens.getPropertyValue('--ui-chat-dock-width-max')) || 488;
                const baseWidth = parseFloat(tokens.getPropertyValue('--ui-chat-dock-width-base')) || 221;
                const ratio = parseFloat(tokens.getPropertyValue('--ui-chat-dock-width-ratio')) || .126;
                return Math.round(Math.max(minWidth, Math.min(maxWidth, baseWidth + (window.innerWidth * ratio))));
            }
            const maxWidth = Math.min(1200, Math.max(420, window.innerWidth - 180));
            return Math.max(420, Math.min(maxWidth, Math.round(width)));
        }

        function readGptDockWidth() {
            return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chat-dock-width'), 10) || 420;
        }

        function readGptDockEdge() {
            return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chat-dock-edge')) || 0;
        }

        function syncCanvasComposerDockInset() {
            const root = document.documentElement;
            const dockUnavailable = root.classList.contains('gpt-dock-collapsed')
                || root.classList.contains('studio-hide-gpt-dock');
            // 桌面端为并排布局（画布右缘随对话栏让位），画布不再被对话栏遮盖，
            // composer 无需左侧避让。
            const sideBySide = root.classList.contains('lightbox-desktop-native');
            const rawWidth = parseFloat(getComputedStyle(root).getPropertyValue('--chat-dock-width')) || 0;
            const inset = (dockUnavailable || sideBySide) ? 0 : Math.max(0, rawWidth);
            const motion = document.body.classList.contains('is-dock-resizing')
                ? '0ms linear'
                : '260ms cubic-bezier(.3, 0, 0, 1)';
            const frame = getActiveCanvasFrame();
            const rightInset = readCanvasComposerRightInset(frame);
            const agentControlWidth = document.getElementById('gptDockOpenBtn')?.getBoundingClientRect().width || 112;
            try {
                const canvasRoot = frame?.contentDocument?.documentElement;
                canvasRoot?.style.setProperty('--shell-chat-dock-width', `${inset}px`);
                canvasRoot?.style.setProperty('--shell-right-panel-width', `${rightInset}px`);
                canvasRoot?.style.setProperty('--shell-agent-control-reserve', dockUnavailable ? `${Math.ceil(agentControlWidth) + 24}px` : '16px');
                canvasRoot?.style.setProperty('--shell-chat-dock-motion', motion);
            } catch(e) {}
        }

        /* 面板改在右侧：返回面板从右缘向内侵入的宽度 */
        function visiblePanelRightIntrusion(element, open, viewportWidth) {
            if (!open || !element || element.hidden) return 0;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 ? Math.max(0, viewportWidth - rect.left) : 0;
        }

        function readCanvasComposerRightInset(frame = getActiveCanvasFrame()) {
            const canvasWidth = frame?.contentWindow?.innerWidth || window.innerWidth;
            let intrusion = 0;
            const assetOpen = isShellAssetLibraryOpen();
            if (assetOpen) {
                let assetIntrusion = 0;
                try {
                    const assetPanel = frame?.contentDocument?.getElementById('assetPanel');
                    assetIntrusion = visiblePanelRightIntrusion(
                        assetPanel, assetPanel?.classList.contains('open'), canvasWidth
                    );
                } catch(e) {}
                if (!assetIntrusion) {
                    const peekWidth = parseFloat(
                        getComputedStyle(document.documentElement).getPropertyValue('--shell-asset-peek-width')
                    );
                    assetIntrusion = peekWidth || (SHELL_ASSET_PANEL_LEFT + readShellAssetPanelWidth());
                }
                intrusion = Math.max(intrusion, assetIntrusion);
            }

            const userMenu = document.getElementById('shellUserMenu');
            intrusion = Math.max(
                intrusion,
                visiblePanelRightIntrusion(userMenu, userMenu?.classList.contains('open'), window.innerWidth)
            );

            if (!intrusion) return 0;
            return Math.min(canvasWidth, Math.ceil(intrusion));
        }

        let canvasComposerInsetFrame = 0;
        let canvasComposerInsetAnimationStart = 0;

        function scheduleCanvasComposerInsetSync(animate = true) {
            if (canvasComposerInsetFrame) cancelAnimationFrame(canvasComposerInsetFrame);
            if (animate) canvasComposerInsetAnimationStart = performance.now();
            const paint = now => {
                syncCanvasComposerDockInset();
                if (animate && now - canvasComposerInsetAnimationStart < 340) {
                    canvasComposerInsetFrame = requestAnimationFrame(paint);
                } else {
                    canvasComposerInsetFrame = 0;
                }
            };
            canvasComposerInsetFrame = requestAnimationFrame(paint);
        }

        function initCanvasComposerInsetObservers() {
            const root = document.documentElement;
            if (root.dataset.composerInsetObserversBound === '1') return;
            root.dataset.composerInsetObserversBound = '1';
            const observer = new MutationObserver(() => scheduleCanvasComposerInsetSync(true));
            [
                document.getElementById('toolbarAssetBtn'),
                document.getElementById('shellUserMenu')
            ].filter(element => element && typeof Node === 'function' && element instanceof Node).forEach(element => {
                observer.observe(element, {
                    attributes: true,
                    attributeFilter: ['class', 'hidden', 'style', 'aria-hidden', 'aria-pressed']
                });
            });
            window.addEventListener('resize', () => scheduleCanvasComposerInsetSync(false));
            scheduleCanvasComposerInsetSync(false);
        }

        function isGptDockCollapsed() {
            const root = document.documentElement;
            return root.classList.contains('gpt-dock-collapsed')
                || root.classList.contains('studio-hide-gpt-dock');
        }

        function syncTopUserButtonDockPosition() {
            const userButton = document.getElementById('topUserBtn');
            if (!userButton) return;
            userButton.style.removeProperty('right');
        }

        function applyDockGeometry() {
            const root = document.documentElement;
            const dock = document.querySelector('.gpt-dock');
            const resizer = document.getElementById('gptDockResizer');
            if (!dock) return;
            if (root.classList.contains('lightbox-compact-mode')) {
                ['width', 'left', 'right', 'transform', 'visibility', 'pointer-events'].forEach(property => {
                    dock.style.removeProperty(property);
                });
                resizer?.style.setProperty('display', 'none', 'important');
                resizer?.style.setProperty('pointer-events', 'none', 'important');
                return;
            }
            const collapsed = isGptDockCollapsed();
            const width = readGptDockWidth();
            const edge = readGptDockEdge();
            syncTopUserButtonDockPosition(collapsed, width, 0, edge);
            // 对话栏右锚定（MiniMax 全局面板布局：左侧栏 / 中画布 / 右对话栏）
            dock.style.setProperty('width', `${width}px`, 'important');
            dock.style.setProperty('right', `${edge}px`, 'important');
            dock.style.setProperty('left', 'auto', 'important');
            if (collapsed) {
                dock.style.setProperty('transform', 'translate3d(calc(100% + 28px), 0, 0)', 'important');
                dock.style.setProperty('pointer-events', 'none', 'important');
                dock.style.setProperty(
                    'visibility',
                    root.classList.contains('gpt-dock-closing') ? 'visible' : 'hidden',
                    'important'
                );
            } else {
                dock.style.setProperty('visibility', 'visible', 'important');
                dock.style.setProperty('pointer-events', 'auto', 'important');
                dock.style.setProperty('transform', 'translate3d(0, 0, 0)', 'important');
            }
            window.SmartCanvasShellUserMenu?.reposition?.();
            if (!resizer) return;
            if (collapsed || root.classList.contains('lightbox-desktop-native')) {
                resizer.style.setProperty('display', 'none', 'important');
                resizer.style.setProperty('pointer-events', 'none', 'important');
                return;
            }
            resizer.style.removeProperty('display');
            // 对话栏在右侧：拖拽条贴其左缘
            const visualLeft = dock.getBoundingClientRect().left + GPT_DOCK_VISUAL_INSET;
            const left = Math.round(visualLeft - (GPT_DOCK_RESIZER_WIDTH / 2));
            resizer.style.setProperty('position', 'fixed', 'important');
            resizer.style.setProperty('top', '0', 'important');
            resizer.style.setProperty('bottom', '0', 'important');
            resizer.style.setProperty('left', `${left}px`, 'important');
            resizer.style.setProperty('right', 'auto', 'important');
            resizer.style.setProperty('width', `${GPT_DOCK_RESIZER_WIDTH}px`, 'important');
            resizer.style.setProperty('z-index', '999', 'important');
            resizer.style.setProperty('pointer-events', 'auto', 'important');
        }

        function scheduleDockGeometrySync() {
            applyDockGeometry();
            requestAnimationFrame(() => requestAnimationFrame(applyDockGeometry));
            window.setTimeout(applyDockGeometry, 280);
        }
        window.refreshGptDockGeometry = scheduleDockGeometrySync;

        function finishGptDockClose() {
            window.clearTimeout(gptDockCloseTimer);
            gptDockCloseTimer = 0;
            const root = document.documentElement;
            if (!root.classList.contains('gpt-dock-collapsed')) return;
            root.classList.remove('gpt-dock-closing');
            const dock = document.querySelector('.gpt-dock');
            dock?.style.setProperty('visibility', 'hidden', 'important');
        }

        function bindDockGeometrySync() {
            const dock = document.querySelector('.gpt-dock');
            if (!dock || dock.dataset.geometryBound === '1') return;
            dock.dataset.geometryBound = '1';
            dock.addEventListener('transitionend', event => {
                if (event.target !== dock) return;
                if (event.propertyName === 'transform' || event.propertyName === 'left' || event.propertyName === 'right' || event.propertyName === 'width') {
                    if (event.propertyName === 'transform'
                        && document.documentElement.classList.contains('gpt-dock-closing')) {
                        finishGptDockClose();
                    }
                    applyDockGeometry();
                }
            });
        }

        function setGptDockWidth(width, remember = true) {
            const next = clampGptDockWidth(width);
            document.documentElement.style.setProperty('--chat-dock-width', `${next}px`);
            applyDockGeometry();
            syncCanvasComposerDockInset();
            if (remember) localStorage.setItem(GPT_DOCK_WIDTH_KEY, String(next));
            return next;
        }

        function setGptDockCollapsed(collapsed) {
            const root = document.documentElement;
            const wasCollapsed = root.classList.contains('gpt-dock-collapsed');
            window.clearTimeout(gptDockCloseTimer);
            gptDockCloseTimer = 0;
            root.classList.toggle('gpt-dock-closing', collapsed && !wasCollapsed);
            root.classList.toggle('gpt-dock-collapsed', collapsed);
            applyDockGeometry();
            if (collapsed && !wasCollapsed) {
                gptDockCloseTimer = window.setTimeout(finishGptDockClose, GPT_DOCK_CLOSE_MOTION_MS);
            } else if (collapsed) {
                finishGptDockClose();
            }
            syncCanvasComposerDockInset();
            localStorage.setItem(GPT_DOCK_COLLAPSED_KEY, collapsed ? '1' : '0');
            const openBtn = document.getElementById('gptDockOpenBtn');
            if (openBtn) {
                openBtn.title = collapsed ? '展开右侧面板' : '收起右侧面板';
                openBtn.setAttribute('aria-label', collapsed ? '展开右侧面板' : '收起右侧面板');
                openBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            }
            const closeBtn = document.getElementById('gptDockCloseBtn');
            if (closeBtn) {
                closeBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            }
        }

        function openGptDock() {
            if (document.documentElement.classList.contains('studio-hide-gpt-dock')) return;
            loadGptDockFrame();
            setGptDockCollapsed(false);
        }

        window.openGptDock = openGptDock;

        function closeGptDock() {
            setGptDockCollapsed(true);
        }

        window.closeGptDock = closeGptDock;

        function toggleGptDock() {
            if (document.documentElement.classList.contains('gpt-dock-collapsed')) openGptDock();
            else closeGptDock();
        }

        function initGptDockControls() {
            if (document.documentElement.classList.contains('lightbox-desktop-native')) {
                setGptDockWidth(window.innerWidth, false);
            } else {
                const savedWidth = parseInt(localStorage.getItem(GPT_DOCK_WIDTH_KEY) || '', 10);
                if (savedWidth) {
                    setGptDockWidth(savedWidth, false);
                }
            }
            setGptDockCollapsed(true);
            loadGptDockFrame();
            const closeBtn = document.getElementById('gptDockCloseBtn');
            if (closeBtn && !closeBtn.dataset.bound) {
                closeBtn.dataset.bound = '1';
                closeBtn.addEventListener('click', event => {
                    event.preventDefault();
                    closeGptDock();
                });
            }
            const newBtn = document.getElementById('dockShellNewBtn');
            if (newBtn && !newBtn.dataset.bound) {
                newBtn.dataset.bound = '1';
                newBtn.addEventListener('click', event => {
                    event.preventDefault();
                    postToGptDockFrame({ source: 'shell', type: 'dock-shell-new' });
                });
            }
            initDockTitleMenu();
            if (window.lucide) window.lucide.createIcons();
            bindDockGeometrySync();
            scheduleDockGeometrySync();
            const resizer = document.getElementById('gptDockResizer');
            if (resizer?.dataset.bound === '1') return;
            let resizing = false;
            let resizeFrame = 0;
            let pendingDockWidth = null;
            const paintDockWidth = () => {
                resizeFrame = 0;
                if (pendingDockWidth == null) return;
                setGptDockWidth(pendingDockWidth, false);
            };
            const stopResize = () => {
                if (!resizing) return;
                resizing = false;
                if (resizeFrame) {
                    cancelAnimationFrame(resizeFrame);
                    resizeFrame = 0;
                }
                if (pendingDockWidth != null) {
                    setGptDockWidth(pendingDockWidth, true);
                    pendingDockWidth = null;
                }
                document.body.classList.remove('is-dock-resizing');
                syncCanvasComposerDockInset();
            };
            const onPointerMove = event => {
                if (resizing) {
                    // 右锚定：宽度 = 视口右缘到指针的距离
                    pendingDockWidth = window.innerWidth - event.clientX - readGptDockEdge();
                    if (!resizeFrame) resizeFrame = requestAnimationFrame(paintDockWidth);
                }
            };
            const onPointerUp = () => {
                stopResize();
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('pointercancel', onPointerUp);
            };
            const beginDockResize = event => {
                if (document.documentElement.classList.contains('gpt-dock-collapsed')) return;
                if (event.button != null && event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget?.setPointerCapture?.(event.pointerId);
                resizing = true;
                pendingDockWidth = readGptDockWidth();
                document.body.classList.add('is-dock-resizing');
                syncCanvasComposerDockInset();
                postToCanvasFrame({ type: 'canvas-clear-selection' });
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
                window.addEventListener('pointercancel', onPointerUp);
            };
            if (resizer && resizer.dataset.bound !== '1') {
                resizer.dataset.bound = '1';
                resizer.addEventListener('pointerdown', beginDockResize);
            }
            window.addEventListener('resize', () => {
                setGptDockWidth(readGptDockWidth(), false);
                scheduleDockGeometrySync();
            });
        }

        function restoreLocalNav(id) {
            const savedCollapsed = localStorage.getItem(LOCAL_NAV_COLLAPSED_KEY) === '1';
            setLocalNavCollapsed(savedCollapsed && !LOCAL_PAGE_IDS.includes(id), { skipRemember:true });
        }

        function switchUI(el, id, options = {}) {
            if(!PAGE_IDS.includes(id)) id = DEFAULT_PAGE_ID;
            document.querySelectorAll('.nav-item,.side-pill,.tool-button').forEach(n => n.classList.remove('active'));
            if(el) el.classList.add('active');
            document.querySelectorAll('iframe').forEach(f => f.classList.remove('active'));
            const target = document.getElementById('frame-' + id);
            target.classList.add('active');
            if (!target.src) target.src = target.dataset.src;
            if(!options.skipRemember) localStorage.setItem(ACTIVE_PAGE_KEY, id);
            // sync theme to newly activated iframe
            syncThemeToFrame(target);
            syncLanguageToFrame(target);
            if(LOCAL_PAGE_IDS.includes(id)) {
                setLocalNavCollapsed(false, { skipRemember:true });
            } else {
                setLocalNavCollapsed(localStorage.getItem(LOCAL_NAV_COLLAPSED_KEY) === '1', { skipRemember:true });
            }
            // Notify the canvas iframe when switching back to it.
            if (id === 'canvas' && target.src) {
                try { target.contentWindow?.postMessage({ type: 'canvas-focus' }, '*'); } catch(e) {}
                setShellAssetOverlayMode(isShellAssetLibraryOpen());
                syncShellLeftRailRecessed();
            }
            syncGptDockVisibility(id, { deferLoad:Boolean(options.deferGptDock) });
            const canvasPage = id === 'canvas';
            if(canvasPage) setShellPrimaryRailActive('canvas');
            document.documentElement.classList.toggle('studio-page-canvas', canvasPage);
            if (!canvasPage) {
                closeShellCanvasHistory();
                closeShellAssetLibrary();
                closeShellSettings();
            }
        }
        window.switchUI = switchUI;

        function postToCanvasFrame(message, attempt = 0) {
            const frame = getActiveCanvasFrame();
            if(!frame) return;
            if(!frame.src) frame.src = frame.dataset.src;
            const deliver = () => {
                try { frame.contentWindow?.postMessage(message, '*'); } catch(e) {}
            };
            if(frame.contentWindow) {
                deliver();
                return;
            }
            if(attempt >= 40) return;
            window.setTimeout(() => postToCanvasFrame(message, attempt + 1), 50);
        }
        function postToGptDockFrame(message, attempt = 0) {
            const frame = document.getElementById('frame-gpt-dock');
            if(!frame) return;
            if(!frame.src || needsGptDockFrameReload(frame)) frame.src = gptDockFrameSrc();
            const deliver = () => {
                try { frame.contentWindow?.postMessage(message, '*'); } catch(e) {}
            };
            if(frame.contentWindow) {
                deliver();
                return;
            }
            if(attempt >= 40) return;
            window.setTimeout(() => postToGptDockFrame(message, attempt + 1), 50);
        }

        function relayCanvasAttachmentsToDock(items) {
            const attachments = (Array.isArray(items) ? items : [])
                .filter(item => item && typeof item.url === 'string' && item.url.trim())
                .slice(0, 8);
            if(!attachments.length) return;
            const frame = document.getElementById('frame-gpt-dock');
            if(!frame) return;
            const message = {
                source: 'shell-bridge',
                type: 'dock-add-attachments',
                attachments
            };
            const waitForLoad = !frame.src || needsGptDockFrameReload(frame);
            if(waitForLoad) frame.addEventListener('load', () => postToGptDockFrame(message), {once:true});
            openGptDock();
            if(!waitForLoad) postToGptDockFrame(message);
        }
        window.addCanvasAttachmentsToDock = relayCanvasAttachmentsToDock;

        function ensureCanvasShellVisible() {
            const frame = document.getElementById('frame-canvas');
            if(frame && !frame.src) frame.src = frame.dataset.src;
            if(!frame?.classList.contains('active')) {
                const trigger = document.querySelector('[data-canvas-main="1"]');
                switchUI(trigger, 'canvas');
            }
            if(!document.documentElement.classList.contains('gpt-dock-collapsed')) loadGptDockFrame();
        }

        const dockImagePreviewState = {
            url:'',
            name:'对话图片',
            scale:1,
            naturalWidth:0,
            naturalHeight:0,
        };

        function renderDockImagePreviewScale() {
            const panel = document.getElementById('dockImagePreview');
            const image = panel?.querySelector('.dock-image-preview-image');
            const label = panel?.querySelector('[data-preview-scale]');
            if(!image || !dockImagePreviewState.naturalWidth || !dockImagePreviewState.naturalHeight) return;
            image.style.width = `${Math.max(1, Math.round(dockImagePreviewState.naturalWidth * dockImagePreviewState.scale))}px`;
            image.style.height = `${Math.max(1, Math.round(dockImagePreviewState.naturalHeight * dockImagePreviewState.scale))}px`;
            if(label) label.textContent = `${Math.round(dockImagePreviewState.scale * 100)}%`;
        }

        function fitDockImagePreview() {
            const panel = document.getElementById('dockImagePreview');
            const viewport = panel?.querySelector('.dock-image-preview-viewport');
            if(!viewport || !dockImagePreviewState.naturalWidth || !dockImagePreviewState.naturalHeight) return;
            dockImagePreviewState.scale = Math.min(
                1,
                Math.max(.1, (viewport.clientWidth - 56) / dockImagePreviewState.naturalWidth),
                Math.max(.1, (viewport.clientHeight - 56) / dockImagePreviewState.naturalHeight)
            );
            renderDockImagePreviewScale();
            viewport.scrollTo({left:0, top:0});
        }

        function setDockImagePreviewScale(nextScale) {
            dockImagePreviewState.scale = Math.max(.1, Math.min(4, Number(nextScale) || 1));
            renderDockImagePreviewScale();
        }

        function closeDockImagePreview() {
            const panel = document.getElementById('dockImagePreview');
            if(!panel) return;
            panel.hidden = true;
            panel.querySelector('.dock-image-preview-image')?.removeAttribute('src');
            document.documentElement.classList.remove('dock-image-preview-open');
        }

        function sendDockPreviewImageToCanvas() {
            const url = dockImagePreviewState.url;
            if(!url) return;
            const taskId = `dock-preview-${Date.now()}`;
            const image = {url, name:dockImagePreviewState.name || '对话图片.png'};
            ensureCanvasShellVisible();
            window.setTimeout(() => {
                postToCanvasFrame({
                    type:'canvas-external-image-task',
                    task_id:taskId,
                    phase:'start',
                    size:`${dockImagePreviewState.naturalWidth || 1024}x${dockImagePreviewState.naturalHeight || 1024}`,
                });
                postToCanvasFrame({
                    type:'canvas-external-image-task',
                    task_id:taskId,
                    phase:'done',
                    images:[image],
                });
            }, 80);
            closeDockImagePreview();
        }

        function quoteDockPreviewImageToChat() {
            const url = dockImagePreviewState.url;
            if(!url) return;
            closeDockImagePreview();
            relayCanvasAttachmentsToDock([{
                kind:'image',
                url,
                name:dockImagePreviewState.name || '对话图片.png',
            }]);
        }

        function ensureDockImagePreview() {
            let panel = document.getElementById('dockImagePreview');
            if(panel) return panel;
            panel = document.createElement('div');
            panel.id = 'dockImagePreview';
            panel.className = 'dock-image-preview';
            panel.hidden = true;
            panel.innerHTML = `
                <div class="dock-image-preview-backdrop" data-preview-action="close"></div>
                <section class="dock-image-preview-dialog" role="dialog" aria-modal="true" aria-label="图片预览">
                    <header class="dock-image-preview-header">
                        <div class="dock-image-preview-title">
                            <i data-lucide="image"></i>
                            <span>图片预览</span>
                        </div>
                        <div class="dock-image-preview-zoom" aria-label="图片缩放">
                            <button type="button" data-preview-action="zoom-out" title="缩小"><i data-lucide="minus"></i></button>
                            <span data-preview-scale>100%</span>
                            <button type="button" data-preview-action="zoom-in" title="放大"><i data-lucide="plus"></i></button>
                            <button type="button" data-preview-action="fit" title="适应窗口"><i data-lucide="scan"></i><span>适应</span></button>
                        </div>
                        <button type="button" class="dock-image-preview-close" data-preview-action="close" title="关闭"><i data-lucide="x"></i></button>
                    </header>
                    <div class="dock-image-preview-viewport">
                        <div class="dock-image-preview-canvas"><img class="dock-image-preview-image" alt="对话图片预览"></div>
                    </div>
                    <footer class="dock-image-preview-footer">
                        <button type="button" class="dock-image-preview-secondary" data-preview-action="quote"><i data-lucide="quote"></i><span>引用到对话</span></button>
                        <button type="button" class="dock-image-preview-primary" data-preview-action="canvas"><i data-lucide="panel-top-open"></i><span>发送到画布</span></button>
                    </footer>
                </section>`;
            panel.addEventListener('click', event => {
                const action = event.target.closest('[data-preview-action]')?.dataset.previewAction;
                if(action === 'close') closeDockImagePreview();
                if(action === 'zoom-out') setDockImagePreviewScale(dockImagePreviewState.scale - .1);
                if(action === 'zoom-in') setDockImagePreviewScale(dockImagePreviewState.scale + .1);
                if(action === 'fit') fitDockImagePreview();
                if(action === 'canvas') sendDockPreviewImageToCanvas();
                if(action === 'quote') quoteDockPreviewImageToChat();
            });
            panel.querySelector('.dock-image-preview-image').addEventListener('load', event => {
                dockImagePreviewState.naturalWidth = event.currentTarget.naturalWidth || 1;
                dockImagePreviewState.naturalHeight = event.currentTarget.naturalHeight || 1;
                fitDockImagePreview();
            });
            document.body.appendChild(panel);
            window.lucide?.createIcons?.();
            return panel;
        }

        function openDockImagePreview(url, name='对话图片') {
            const src = String(url || '').trim();
            if(!src) return;
            const panel = ensureDockImagePreview();
            dockImagePreviewState.url = src;
            dockImagePreviewState.name = String(name || '对话图片').trim() || '对话图片';
            dockImagePreviewState.scale = 1;
            dockImagePreviewState.naturalWidth = 0;
            dockImagePreviewState.naturalHeight = 0;
            panel.hidden = false;
            document.documentElement.classList.add('dock-image-preview-open');
            panel.querySelector('.dock-image-preview-image').src = src;
        }

        function isShellEditableTarget(target) {
            const el = target || document.activeElement;
            return !!el?.closest?.('input, textarea, select, option, [contenteditable="true"]');
        }

        function shouldRelayCanvasClipboard(event) {
            if(!isCanvasPageActive()) return false;
            if(!(event.ctrlKey || event.metaKey) || event.altKey) return false;
            const key = String(event.key || '').toLowerCase();
            if(key !== 'c' && key !== 'v') return false;
            if(isShellEditableTarget(event.target)) return false;
            if(key === 'c') {
                const selectionText = window.getSelection?.().toString() || '';
                if(selectionText) return false;
            }
            return true;
        }

        window.addEventListener('keydown', event => {
            if(event.key === 'Escape' && !document.getElementById('dockImagePreview')?.hidden){
                closeDockImagePreview();
                return;
            }
            // Parent shell often holds focus (sidebar/titlebar/iframe element).
            // Relay Ctrl/Cmd+C·V into the canvas frame so copy/paste still works.
            if(shouldRelayCanvasClipboard(event)){
                const key = String(event.key || '').toLowerCase();
                event.preventDefault();
                postToCanvasFrame({
                    type: 'shell-canvas-clipboard',
                    action: key === 'c' ? 'copy' : 'paste',
                });
            }
        }, true);

        function shouldSwitchShellCanvas(canvasId) {
            const activeId = getActiveCanvasIdFromFrame();
            // URL 无 id = 当前内存画布；reload 会抹掉刚 stage 的节点，禁止误切换
            if(!canvasId || !activeId) return false;
            return canvasId !== activeId;
        }

        function switchShellCanvas(canvasId) {
            if(!canvasId) return;
            const frame = getActiveCanvasFrame();
            if(!frame) return;
            frame.src = smartCanvasShellUrl(canvasId);
        }

        function relayDockBridgeResult(data) {
            if(!DOCK_CANVAS_BRIDGE_ENABLED) return;
            postToGptDockFrame({
                source: 'shell-bridge',
                ...data,
                type: 'dock-canvas-bridge-result',
            });
        }

        const DOCK_CANVAS_BRIDGE_ENABLED = false;

        function handleDockCanvasBridge(data) {
            if(!DOCK_CANVAS_BRIDGE_ENABLED) return;
            ensureCanvasShellVisible();
            const request_id = data.request_id || '';
            if(data.op === 'observe') {
                postToCanvasFrame({ type: 'canvas-agent-observe', request_id });
                return;
            }
            if(data.op === 'actions') {
                postToCanvasFrame({ type: 'canvas-agent-actions', request_id, actions: data.actions || [] });
                return;
            }
            if(data.op === 'new-canvas') {
                postToCanvasFrame({
                    type: 'canvas-agent-actions',
                    request_id,
                    actions: [{ type: 'new_canvas', title: data.title || '鏅鸿兘鐢诲竷' }],
                });
            }
        }

        window.isCanvasPageActive = isCanvasPageActive;

        function isCanvasPageActive() {
            return Boolean(document.querySelector('#frame-canvas.active'));
        }

        function getActiveCanvasIdFromFrame() {
            const frame = getActiveCanvasFrame();
            if(!frame?.src) return '';
            try {
                return new URL(frame.src, location.origin).searchParams.get('id') || '';
            } catch(e) {
                return '';
            }
        }

        function smartCanvasShellUrl(id) {
            const base = '/static/smart-canvas.html?v=2026.08.27.footfix1';
            return id ? `${base}&id=${encodeURIComponent(id)}` : base;
        }

        function isShellCanvasHistoryOpen() {
            return Boolean(window.SmartCanvasShellHistory?.isOpen?.());
        }

        function initShellSettings() {
            window.SmartCanvasShellSettings?.init?.();
        }

        function initShellCanvasHistory() {
            window.SmartCanvasShellHistory?.init?.();
        }

        function openCanvasHistory() {
            window.SmartCanvasShellHistory?.toggle?.();
        }
        window.openCanvasHistory = openCanvasHistory;

        function forwardStudioApiChange(data) {
            if(!data || !['providers-changed','workflows-changed','comfy-instances-changed','runninghub-settings-changed'].includes(data.type)) return;
            document.querySelectorAll('iframe').forEach(iframe => {
                try {
                    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(data, '*');
                } catch(e) {}
            });
        }

        function isCanvasFrameMessage(event) {
            return [...document.querySelectorAll('#frame-canvas')]
                .some(frame => frame.contentWindow && event.source === frame.contentWindow);
        }

          let canvasEmptyChromePeekTimer = 0;

          function applyCanvasEmptyChromePeek(left=false, right=false) {
              if(canvasEmptyChromePeekTimer) clearTimeout(canvasEmptyChromePeekTimer);
              canvasEmptyChromePeekTimer = 0;
              const root = document.documentElement;
              const recessed = root.classList.contains('canvas-empty-chrome-recessed');
              root.classList.toggle('canvas-empty-left-peek', recessed && Boolean(left));
              root.classList.toggle('canvas-empty-right-peek', recessed && Boolean(right));
          }

          function syncCanvasEmptyChromePeek(left=false, right=false, immediate=false) {
              const root = document.documentElement;
              if(!root.classList.contains('canvas-empty-chrome-recessed')) return applyCanvasEmptyChromePeek();
              if(left || right || immediate) return applyCanvasEmptyChromePeek(left, right);
              if(canvasEmptyChromePeekTimer) clearTimeout(canvasEmptyChromePeekTimer);
              canvasEmptyChromePeekTimer = setTimeout(() => applyCanvasEmptyChromePeek(), 220);
          }

          const emptyChromeToolbar = document.querySelector('.shell-primary-rail');
          const emptyChromeDockButton = document.querySelector('.dock-open-btn');

        window.addEventListener('message', event => {
            const fromCanvas = isCanvasFrameMessage(event);
            if (!fromCanvas && event.origin && event.origin !== location.origin) return;
            const data = event.data || {};
            if(fromCanvas && data.type === 'canvas-open-help-center') {
                window.openShellSettings?.('help');
                return;
            }
            if(fromCanvas && data.type === 'canvas-open-settings') {
                window.openShellSettings?.(data.section || 'account');
                return;
            }
            if(fromCanvas && data.type === 'canvas-project-state') {
                syncShellCanvasProjectState(data);
                return;
            }
            if(fromCanvas && data.type === 'canvas-add-to-chat') {
                relayCanvasAttachmentsToDock(data.attachments);
                return;
            }
            if(data.source === 'gpt-dock' && data.type === 'dock-canvas-bridge') {
                if(DOCK_CANVAS_BRIDGE_ENABLED) handleDockCanvasBridge(data);
                return;
            }
            if(data.source === 'gpt-dock' && data.type === 'dock-canvas-image-task') {
                ensureCanvasShellVisible();
                postToCanvasFrame({
                    type:'canvas-external-image-task',
                    task_id:data.task_id || '',
                    phase:data.phase || '',
                    size:data.size || '',
                    images:Array.isArray(data.images) ? data.images : [],
                });
                return;
            }
            if(data.source === 'gpt-dock' && data.type === 'dock-open-image-preview') {
                openDockImagePreview(data.url, data.name);
                return;
            }
            if(data.source === 'gpt-dock' && data.type === 'dock-switch-canvas') {
                if(DOCK_CANVAS_BRIDGE_ENABLED) switchShellCanvas(data.canvas_id);
                return;
            }
            if(data.source === 'gpt-dock' && data.type === 'dock-open-canvas') {
                if(!DOCK_CANVAS_BRIDGE_ENABLED) return;
                const trigger = document.querySelector('[data-canvas-main="1"]');
                switchUI(trigger, 'canvas');
                return;
            }
            if(data.type === 'canvas-agent-observation') {
                if(DOCK_CANVAS_BRIDGE_ENABLED) relayDockBridgeResult(data);
                return;
            }
            if(data.type === 'canvas-agent-results') {
                if(!DOCK_CANVAS_BRIDGE_ENABLED) return;
                relayDockBridgeResult(data);
                const canvasId = data.observation?.canvas?.id || '';
                if(shouldSwitchShellCanvas(canvasId)) {
                    switchShellCanvas(canvasId);
                }
                return;
            }
            if(data.type === 'dock-canvas-node-output') {
                if(!DOCK_CANVAS_BRIDGE_ENABLED) return;
                postToGptDockFrame({
                    source: 'shell-bridge',
                    type: 'dock-canvas-node-output',
                    node_id: data.node_id || '',
                    images: data.images || [],
                });
                return;
            }
            if (data.type === 'open-api-settings') {
                const trigger = document.querySelector(`.floating-toolbar [onclick*="'api-settings'"],.floating-toolbar [onclick*='"api-settings"']`) || document.querySelector(`[onclick*="'api-settings'"],[onclick*='"api-settings"']`);
                switchUI(trigger, 'api-settings');
                return;
            }
            if (data.type === 'canvas-asset-library-state') {
                if (!data.open) closeShellAssetLibrary({ fromCanvas: true });
                return;
            }
              if(fromCanvas && data.type === 'canvas-empty-chrome-state') {
                  document.documentElement.classList.toggle('canvas-empty-chrome-recessed', Boolean(data.recessed));
                  if(!data.recessed) syncCanvasEmptyChromePeek(false, false, true);
                  return;
              }
              if(fromCanvas && data.type === 'canvas-empty-chrome-peek') {
                  const keepLeft = Boolean(data.left) || Boolean(emptyChromeToolbar?.matches(':hover'));
                  const keepRight = Boolean(data.right) || Boolean(emptyChromeDockButton?.matches(':hover'));
                  syncCanvasEmptyChromePeek(keepLeft, keepRight);
                  return;
              }
            if (data.type === 'shell-asset-panel-width') {
                if(!isCanvasPageActive()) setShellAssetPeekWidth(data.width);
                scheduleCanvasComposerInsetSync(true);
                return;
            }
            if (data.type === 'gpt-dock-chat-title') {
                syncDockShellChatTitle(data.title, data.conversation_id);
                return;
            }
            if (data.type === 'open-canvas') {
                const trigger = document.querySelector('[data-canvas-main="1"]');
                switchUI(trigger, 'canvas');
                return;
            }
            forwardStudioApiChange(data);
        });

        try {
            const studioApiChannel = new BroadcastChannel('studio-api');
            studioApiChannel.onmessage = event => forwardStudioApiChange(event.data);
        } catch(e) {}

        function restoreActivePage() {
            restoreSidebarPinned();
            initFloatingToolbar();
            initGptDockControls();
            const requestedPage = new URLSearchParams(location.search).get('page') || '';
            const id = PAGE_IDS.includes(requestedPage) ? requestedPage : DEFAULT_PAGE_ID;
            localStorage.setItem(ACTIVE_PAGE_KEY, id);
            restoreLocalNav(id);
            const trigger = document.querySelector(`.floating-toolbar [onclick*="'${id}'"],.floating-toolbar [onclick*='"${id}"']`) || document.querySelector(`[onclick*="'${id}'"],[onclick*='"${id}"']`);
            switchUI(trigger, id, { skipRemember:true, deferGptDock:true });
            const clearBooting = () => document.documentElement.classList.remove('studio-route-booting');
            if (document.documentElement.classList.contains('lightbox-shader-intro-active')) {
                window.addEventListener('lightbox-shader-intro-done', clearBooting, { once: true });
                window.setTimeout(clearBooting, 12000);
            } else {
                clearBooting();
            }
        }
        document.addEventListener('DOMContentLoaded', restoreActivePage, { once:true });

        async function syncStatus() {
            try {
                const res = await fetch(`/api/queue_status?client_id=${CID}`);
                const data = await res.json();
                const monitor = document.getElementById('nano-monitor');
                const queueVal = document.getElementById('queue-val');
                const logoDot = document.getElementById('logo-dot');
                const total = data.total || 0;
                const pos = data.position || 0;
                if (pos > 0) {
                    monitor.classList.add('is-busy');
                    queueVal.innerText = `${pos}/${total}`;
                    logoDot.style.backgroundColor = 'var(--ui-accent)';
                } else {
                    monitor.classList.remove('is-busy');
                    queueVal.innerText = total > 0 ? total : '0';
                    logoDot.style.backgroundColor = 'var(--text)';
                }
            } catch (e) { }
        }

        const host = window.location.host;
        if (host) {
            const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
            const ws = new WebSocket(`${protocol}://${host}/ws/stats?client_id=${CID}`);
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'stats') {
                    document.getElementById('online-val').innerText = data.online_count;
                } else if (data.type === 'cloud_status') {
                    const iframe = document.querySelector('iframe.active');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage(data, '*');
                    }
                } else if (data.type === 'canvas_updated') {
                    const iframe = document.querySelector('iframe.active');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage(data, '*');
                    }
                } else if (data.type === 'asset_library_updated') {
                    document.querySelectorAll('iframe').forEach(iframe => {
                        if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(data, '*');
                    });
                }
            };
            setInterval(syncStatus, 2000);
        }

        // --- Desktop window controls ---

        function syncThemeToFrame(iframe) {
            const theme = (window.StudioTheme || {get: () => 'light'}).get();
            try {
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({ type: 'studio-theme', theme }, '*');
                }
            } catch (e) {}
        }

        function broadcastTheme(theme, options = {}) {
            let next = theme;
            if (window.StudioTheme) {
                next = options.alreadyApplied
                    ? window.StudioTheme.normalize(theme)
                    : window.StudioTheme.set(theme);
            }
            document.querySelectorAll('iframe').forEach(f => syncThemeToFrame(f));
            updateThemeIcon(next);
            return next;
        }

        function updateThemeIcon(theme) {}

        function toggleTheme() {
            if (!window.StudioTheme) return;
            try {
                const next = typeof window.StudioTheme.toggle === 'function'
                    ? window.StudioTheme.toggle(window)
                    : window.StudioTheme.cycle();
                updateThemeIcon(next);
            } catch (err) {
                console.error('[theme] toggle failed', err);
            }
        }
        window.toggleTheme = toggleTheme;

        function syncLanguageToFrame(frame) {
            if(!window.StudioI18n) return;
            try {
                frame.contentWindow?.postMessage({ type:'studio-lang', lang:window.StudioI18n.lang() }, '*');
            } catch(e) {}
        }

        function broadcastLanguage() {
            document.querySelectorAll('iframe').forEach(frame => {
                try {
                    frame.contentWindow?.postMessage({ type:'studio-lang', lang:window.StudioI18n.lang() }, '*');
                } catch(e) {}
            });
        }

        // listen for theme changes triggered by theme.js
        window.addEventListener('studio-theme-change', (e) => {
            updateThemeIcon(e.detail.theme);
        });

        // init icon state on load
        window.addEventListener('DOMContentLoaded', () => {
            if(window.lucide) lucide.createIcons();
            const theme = window.StudioTheme ? window.StudioTheme.get() : 'light';
            updateThemeIcon(theme);
            if(window.StudioI18n) window.StudioI18n.apply();
            broadcastLanguage();
            loadAppInfo();
        });

        // sync theme when iframe loads
        document.querySelectorAll('iframe').forEach(f => {
            f.addEventListener('load', () => {
                syncThemeToFrame(f);
                syncLanguageToFrame(f);
                if(f.id === 'frame-canvas') scheduleCanvasComposerInsetSync(false);
            });
        });

        function openProjectPage() {
            const url = String(appInfo.repo_url || PROJECT_URL || '').trim();
            if(url) window.open(url, '_blank', 'noopener');
        }

        function compactVersion(value) {
            const text = String(value || '').trim();
            const parts = text.match(/\d+/g) || [];
            if(parts.length >= 3) return `${parts[1]}.${parts[2]}`;
            return text.replace(/^v/i, '') || '-';
        }

        function versionLabel(value, mode = 'full') {
            const text = String(value || '').trim();
            if(!text) return 'v-';
            return mode === 'compact' ? `v${compactVersion(text)}` : `v${text.replace(/^v/i, '')}`;
        }

        function setProjectVersionBadge(version) {
            const badge = document.getElementById('project-version-badge');
            if(!badge) return;
            const full = versionLabel(version);
            badge.replaceChildren();
            if(version) {
                const compactSpan = document.createElement('span');
                compactSpan.className = 'project-version-compact';
                compactSpan.textContent = versionLabel(version, 'compact');
                const fullSpan = document.createElement('span');
                fullSpan.className = 'project-version-full';
                fullSpan.textContent = full;
                badge.append(compactSpan, fullSpan);
            } else {
                badge.textContent = 'v-';
            }
            badge.title = window.StudioI18n?.lang?.() === 'en'
                ? `Current version: ${full}`
                : `当前版本：${full}`;
        }

        async function loadAppInfo() {
            try {
                const info = await fetch('/api/app-info', { cache:'no-store' }).then(r => r.json());
                appInfo = {...appInfo, ...info};
                setProjectVersionBadge(String(appInfo.version || '').trim());
            } catch(e) {}
        }
