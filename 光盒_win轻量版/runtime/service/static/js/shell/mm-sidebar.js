/**
 * MiniMax 式左侧栏：新建画布 / 资产中心 / Skill / 全部创作 + 最近创作 + 底部用户。
 * 只做编排——数据与动作全部复用现有壳层能力：
 *   - 画布列表 / 改名 / 删除: /api/canvases（与 shell/history.js 同一套接口）
 *   - 打开画布: SmartCanvasShellHistory.openCanvasRecord
 *   - 资产库: #toolbarAssetBtn；新建: #shellNewCanvasBtn；对话/Skill: openGptDock
 *   - 用户菜单: SmartCanvasShellUserMenu；设置: SmartCanvasShellSettings
 */
(function(global){
    'use strict';

    const NAME_KEY = 'studio_user_display_name';
    const AVATAR_KEY = 'studio_user_avatar';
    const COLLAPSE_KEY = 'mm_sidebar_collapsed';
    const ASSET_TREE_STATE_KEY = 'mm_sidebar_asset_tree';
    const ASSET_FOLDER_KEY = 'mm_sidebar_asset_folders';
    const ASSET_KIND_VIEW_KEY = 'mm_sidebar_asset_kind_view';
    const THUMB_CACHE_KEY = 'mm_sidebar_thumbs';
    const ASSET_KIND_TITLES = {
        image: '图片资产',
        prompt: '提示词',
        video: '视频资产',
        audio: '音频资产',
    };
    const ASSET_KIND_EMPTY = {
        image: '暂无图片资产\n点击右上角上传图标，或从画布拖入',
        prompt: '暂无提示词\n点击右上角新建图标添加；可复制、编辑并引用到输入栏',
        video: '暂无视频资产\n点击右上角上传图标，或从画布拖入',
        audio: '暂无音频资产\n点击右上角上传图标，或从画布拖入',
    };
    const ASSET_KIND_ACCEPT = {
        image: 'image/*,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg',
        video: 'video/*,.mp4,.webm,.mov,.m4v,.avi,.mkv',
        audio: 'audio/*,.mp3,.wav,.flac,.aac,.m4a,.ogg',
    };
    const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|psd)([?#]|$)/i;
    const AUDIO_EXT_RE = /\.(mp3|wav|flac|aac|m4a|ogg)([?#]|$)/i;
    let assetFolderMenu = null;
    let assetFolderMenuTarget = null;
    let activeAssetKind = '';
    let kindViewMode = 'grid';
    let kindAssetsLoading = false;
    let kindAssetsSaving = false;
    let kindDropDepth = 0;
    const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v|avi|mkv)([?#]|$)/i;
    let records = [];
    let loading = false;
    let reloadTimer = 0;
    let thumbsLoading = false;
    let recentMenuItem = null;
    let recentMenuRow = null;

    const byId = id => document.getElementById(id);

    function esc(value){
        return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    /* 与 shell/history.js 相同的标题口径 */
    function displayTitle(item){
        const raw = String(item?.title || '').trim().replace(/\s*画布$/u, '').trim();
        if(!raw || ['智能','电商','漫剧','未命名','未命名记录'].includes(raw)) return '未命名项目';
        return raw;
    }

    function formatMeta(item){
        const timestamp = Number(item?.updated_at || 0);
        const elapsed = Math.max(0, Date.now() - timestamp);
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        const time = !timestamp || elapsed < minute
            ? '刚刚'
            : elapsed < hour
                ? `${Math.floor(elapsed / minute)}分钟`
                : elapsed < day
                    ? `${Math.floor(elapsed / hour)}小时`
                    : `${Math.floor(elapsed / day)}天`;
        const nodes = `${Number(item?.node_count || 0)}p`;
        return `${nodes} · ${time}`;
    }

    function closeRecentMenus(){
        byId('mmSidebarRecentList')?.querySelectorAll('.mm-recent-item.menu-open').forEach(row => {
            row.classList.remove('menu-open');
            const trigger = row.querySelector('.mm-recent-menu-trigger');
            trigger?.setAttribute('aria-expanded', 'false');
        });
        const menu = byId('mmRecentMenu');
        if(menu) menu.hidden = true;
        recentMenuItem = null;
        recentMenuRow = null;
    }

    function positionRecentMenu(trigger, menu){
        if(!trigger || !menu) return;
        const triggerRect = trigger.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const gap = 4;
        const edge = 8;
        const left = Math.max(edge, Math.min(global.innerWidth - menuRect.width - edge, triggerRect.right - menuRect.width));
        const roomBelow = global.innerHeight - triggerRect.bottom - edge;
        const top = roomBelow >= menuRect.height + gap
            ? triggerRect.bottom + gap
            : Math.max(edge, triggerRect.top - menuRect.height - gap);
        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
    }

    async function deleteRecentItem(item){
        if(!item || !global.confirm(`确定删除“${displayTitle(item)}”这个画布吗？此操作无法撤销。`)) return;
        try {
            const response = await fetch(`/api/canvases/${encodeURIComponent(item.id)}`, { method:'DELETE' });
            if(!response.ok) throw new Error(await response.text());
            records = records.filter(record => record.id !== item.id);
            render();
        } catch(_e) {
            global.alert?.('删除失败，请稍后重试');
        }
    }

    function ensureRecentMenu(){
        let menu = byId('mmRecentMenu');
        if(menu) return menu;
        menu = document.createElement('div');
        menu.id = 'mmRecentMenu';
        menu.className = 'mm-recent-menu';
        menu.setAttribute('role', 'menu');
        menu.hidden = true;
        menu.innerHTML = `
            <button class="mm-recent-rename" type="button" role="menuitem"><i data-lucide="pencil"></i><span>重命名</span></button>
            <button class="mm-recent-delete" type="button" role="menuitem"><i data-lucide="trash-2"></i><span>删除</span></button>`;
        menu.addEventListener('mousedown', event => {
            event.stopPropagation();
        });
        menu.addEventListener('pointerdown', event => {
            event.stopPropagation();
        });
        menu.addEventListener('click', event => event.stopPropagation());
        menu.querySelector('.mm-recent-rename')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const item = recentMenuItem;
            const row = recentMenuRow;
            closeRecentMenus();
            if(item && row) beginRename(row, item);
        });
        menu.querySelector('.mm-recent-delete')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const item = recentMenuItem;
            closeRecentMenus();
            void deleteRecentItem(item);
        });
        document.body.appendChild(menu);
        try { global.lucide?.createIcons?.(); } catch(_e) {}
        return menu;
    }

    function toggleRecentMenu(trigger, row, item){
        const menu = ensureRecentMenu();
        const wasOpen = recentMenuRow === row && !menu.hidden;
        closeRecentMenus();
        if(wasOpen || !trigger || !row || !item) return;
        recentMenuItem = item;
        recentMenuRow = row;
        row.classList.add('menu-open');
        trigger.setAttribute('aria-expanded', 'true');
        menu.hidden = false;
        // Measure after paint so fixed menu is not positioned with a zero box.
        requestAnimationFrame(() => {
            if(recentMenuRow !== row || menu.hidden) return;
            positionRecentMenu(trigger, menu);
        });
        positionRecentMenu(trigger, menu);
    }

    /* —— 缩略图：取画布里第一张图片，按 updated_at 缓存避免重复拉全量 —— */
    function readThumbCache(){
        try { return JSON.parse(localStorage.getItem(THUMB_CACHE_KEY) || '{}') || {}; }
        catch(_e) { return {}; }
    }

    function writeThumbCache(cache){
        try { localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify(cache)); } catch(_e) {}
    }

    function firstImageUrl(canvas){
        for(const node of (canvas?.nodes || [])){
            for(const image of (node?.images || [])){
                const url = String(image?.url || '');
                if(url && !VIDEO_URL_RE.test(url)) return url;
            }
        }
        return '';
    }

    function applyThumb(id, url){
        if(!url) return;
        const list = byId('mmSidebarRecentList');
        let holder = null;
        try { holder = list?.querySelector(`.mm-recent-item[data-canvas-id="${CSS.escape(String(id))}"] .mm-recent-thumb`); }
        catch(_e) {}
        if(!holder || holder.querySelector('img')) return;
        const image = document.createElement('img');
        image.alt = '';
        image.loading = 'lazy';
        image.addEventListener('error', () => image.remove());
        image.src = url;
        holder.innerHTML = '';
        holder.appendChild(image);
    }

    async function loadThumbs(){
        if(thumbsLoading) return;
        thumbsLoading = true;
        try {
            const cache = readThumbCache();
            let dirty = false;
            for(const item of records.slice(0, 24)){
                const id = String(item.id);
                const stamp = Number(item.updated_at || 0);
                const cached = cache[id];
                if(cached && Number(cached.u) === stamp){
                    applyThumb(id, cached.url);
                    continue;
                }
                try {
                    const response = await fetch(`/api/canvases/${encodeURIComponent(id)}`);
                    if(!response.ok) continue;
                    const url = firstImageUrl((await response.json())?.canvas);
                    cache[id] = { u: stamp, url };
                    dirty = true;
                    applyThumb(id, url);
                } catch(_e) {}
            }
            Object.keys(cache).forEach(id => {
                if(!records.some(record => String(record.id) === id)){
                    delete cache[id];
                    dirty = true;
                }
            });
            if(dirty) writeThumbCache(cache);
        } finally {
            thumbsLoading = false;
        }
    }

    function activeCanvasId(){
        const frame = byId('frame-canvas');
        if(!frame) return '';
        let href = frame.src || '';
        try { href = frame.contentWindow?.location?.href || href; } catch(_e) {}
        try { return new URL(href, location.origin).searchParams.get('id') || ''; }
        catch(_e) { return ''; }
    }

    async function load(){
        if(loading) return;
        loading = true;
        try {
            const response = await fetch('/api/canvases');
            if(!response.ok) throw new Error(await response.text());
            const data = await response.json();
            records = (data.canvases || [])
                .filter(item => item.id && !item.deleted_at)
                .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
            render();
        } catch(_e) {
            /* 读取失败时保留现有列表 */
        } finally {
            loading = false;
        }
    }

    function scheduleReload(delay = 400){
        global.clearTimeout(reloadTimer);
        reloadTimer = global.setTimeout(() => void load(), delay);
    }

    const RECENT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
    const GROUP_STATE_KEY = 'mm_sidebar_groups';

    function readGroupState(){
        try { return JSON.parse(localStorage.getItem(GROUP_STATE_KEY) || '{}') || {}; }
        catch(_e) { return {}; }
    }

    function groupOpen(name){
        const state = readGroupState();
        // 最近创作默认展开，更早默认收起
        if(state[name] === undefined) return name === 'recent';
        return Boolean(state[name]);
    }

    function setGroupOpen(name, open){
        const state = readGroupState();
        state[name] = Boolean(open);
        try { localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(state)); } catch(_e) {}
    }

    function itemHtml(item, activeId){
        return `
            <div class="mm-recent-item ${String(item.id) === activeId ? 'active' : ''}" data-canvas-id="${esc(item.id)}">
                <button class="mm-recent-open" type="button" title="${esc(displayTitle(item))}">
                    <span class="mm-recent-thumb"><i data-lucide="image"></i></span>
                    <span class="mm-recent-name">${esc(displayTitle(item))}</span>
                </button>
                <span class="mm-recent-meta" data-updated-at="${esc(item.updated_at || 0)}" data-node-count="${esc(item.node_count || 0)}">${esc(formatMeta(item))}</span>
                <span class="mm-recent-actions">
                    <button class="mm-recent-menu-trigger" type="button" title="更多" aria-label="更多项目操作" aria-haspopup="menu" aria-expanded="false"><i data-lucide="ellipsis"></i></button>
                </span>
            </div>`;
    }

    function groupHtml(name, label, items, activeId){
        if(!items.length && name === 'older') return '';
        const open = groupOpen(name);
        const body = items.length
            ? items.map(item => itemHtml(item, activeId)).join('')
            : '<div class="mm-recent-empty">暂无画布</div>';
        return `
            <div class="mm-recent-group ${open ? '' : 'is-collapsed'}" data-group="${name}">
                <button class="mm-recent-group-head" type="button" aria-expanded="${open ? 'true' : 'false'}">
                    <span>${esc(label)}</span>
                    <i data-lucide="chevron-down"></i>
                </button>
                <div class="mm-recent-group-items">${body}</div>
            </div>`;
    }

    function render(){
        const list = byId('mmSidebarRecentList');
        if(!list) return;
        closeRecentMenus();
        const activeId = activeCanvasId();
        const cutoff = Date.now() - RECENT_WINDOW_MS;
        const recent = records.filter(item => Number(item.updated_at || 0) >= cutoff);
        const older = records.filter(item => Number(item.updated_at || 0) < cutoff);
        list.innerHTML = groupHtml('recent', '最近创作', recent, activeId)
            + groupHtml('older', '更早', older, activeId);
        try { global.lucide?.createIcons?.(); } catch(_e) {}
        void loadThumbs();
        list.querySelectorAll('.mm-recent-group-head').forEach(head => {
            head.addEventListener('click', event => {
                event.preventDefault();
                const group = head.closest('.mm-recent-group');
                if(!group) return;
                const open = group.classList.contains('is-collapsed');
                group.classList.toggle('is-collapsed', !open);
                head.setAttribute('aria-expanded', open ? 'true' : 'false');
                setGroupOpen(group.dataset.group, open);
            });
        });
        list.querySelectorAll('.mm-recent-item').forEach(row => {
            const item = records.find(record => String(record.id) === row.dataset.canvasId);
            if(!item) return;
            row.querySelector('.mm-recent-open')?.addEventListener('click', event => {
                // Ignore clicks that actually landed on the ellipsis (or its children).
                if(event.target?.closest?.('.mm-recent-actions, .mm-recent-menu-trigger')) return;
                event.preventDefault();
                void global.SmartCanvasShellHistory?.openCanvasRecord?.({ id: String(item.id) });
                global.setTimeout(render, 600);
            });
            const trigger = row.querySelector('.mm-recent-menu-trigger');
            if(!trigger) return;
            trigger.addEventListener('pointerdown', event => {
                // Keep the document outside-click closer from seeing this press.
                event.stopPropagation();
            });
            trigger.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                toggleRecentMenu(trigger, row, item);
            });
        });
    }

    function beginRename(row, item){
        if(row.querySelector('.mm-recent-rename-input')) return;
        const openBtn = row.querySelector('.mm-recent-open');
        if(!openBtn) return;
        row.classList.add('is-renaming');
        const input = document.createElement('input');
        input.className = 'ui-input mm-recent-rename-input';
        input.type = 'text';
        input.maxLength = 120;
        input.value = displayTitle(item);
        openBtn.replaceWith(input);
        let done = false;
        const finish = async commit => {
            if(done) return;
            done = true;
            const title = input.value.trim();
            if(commit && title && title !== item.title){
                try {
                    const response = await fetch(`/api/canvases/${encodeURIComponent(item.id)}/metadata`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title }),
                    });
                    if(!response.ok) throw new Error(await response.text());
                    const saved = (await response.json())?.canvas;
                    item.title = String(saved?.title || title);
                } catch(_e) {
                    global.alert?.('名称修改失败，请稍后重试');
                }
            }
            render();
        };
        input.addEventListener('keydown', event => {
            if(event.key === 'Enter'){ event.preventDefault(); void finish(true); }
            if(event.key === 'Escape'){ event.preventDefault(); void finish(false); }
        });
        input.addEventListener('blur', () => void finish(true));
        input.focus();
        input.select();
    }

    function syncUser(){
        let name = '用户';
        let avatar = '';
        try {
            name = localStorage.getItem(NAME_KEY) || '用户';
            avatar = localStorage.getItem(AVATAR_KEY) || '';
        } catch(_e) {}
        const nameEl = byId('mmSidebarUserName');
        if(nameEl) nameEl.textContent = name;
        const holder = byId('mmSidebarAvatar');
        if(holder){
            const image = holder.querySelector('img');
            const fallback = holder.querySelector('i, svg');
            if(image){
                image.hidden = !avatar;
                if(avatar) image.src = avatar;
                else image.removeAttribute('src');
            }
            if(fallback) fallback.style.display = avatar ? 'none' : '';
        }
    }

    function setSidebarCollapsed(collapsed){
        document.documentElement.classList.toggle('mm-sidebar-collapsed', Boolean(collapsed));
        try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch(_e) {}
    }

    function readAssetTreeState(){
        try {
            const saved = JSON.parse(localStorage.getItem(ASSET_TREE_STATE_KEY) || '{}');
            return saved && typeof saved === 'object' ? saved : {};
        } catch(_e) {
            return {};
        }
    }

    function writeAssetTreeState(){
        const tree = byId('mmAssetTree');
        if(!tree) return;
        const state = { root: !tree.classList.contains('is-collapsed'), folders: {} };
        tree.querySelectorAll('.mm-asset-tree-folder').forEach(folder => {
            state.folders[folder.dataset.assetKind] = !folder.classList.contains('is-collapsed');
        });
        try { localStorage.setItem(ASSET_TREE_STATE_KEY, JSON.stringify(state)); } catch(_e) {}
    }

    function setAssetTreeOpen(open, persist = true){
        const tree = byId('mmAssetTree');
        const trigger = byId('mmSideAssets');
        if(!tree || !trigger) return;
        tree.classList.toggle('is-collapsed', !open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        if(persist) writeAssetTreeState();
    }

    function readKindViewMode(){
        try {
            const saved = localStorage.getItem(ASSET_KIND_VIEW_KEY);
            return saved === 'list' ? 'list' : 'grid';
        } catch(_e) {
            return 'grid';
        }
    }

    function writeKindViewMode(mode){
        kindViewMode = mode === 'list' ? 'list' : 'grid';
        try { localStorage.setItem(ASSET_KIND_VIEW_KEY, kindViewMode); } catch(_e) {}
    }

    function setKindViewMode(mode){
        writeKindViewMode(mode);
        const body = byId('mmKindPanelBody');
        const gridBtn = byId('mmKindViewGrid');
        const listBtn = byId('mmKindViewList');
        if(body) body.dataset.kindView = kindViewMode;
        gridBtn?.classList.toggle('is-active', kindViewMode === 'grid');
        listBtn?.classList.toggle('is-active', kindViewMode === 'list');
        gridBtn?.setAttribute('aria-pressed', kindViewMode === 'grid' ? 'true' : 'false');
        listBtn?.setAttribute('aria-pressed', kindViewMode === 'list' ? 'true' : 'false');
    }

    function mediaKindOfAsset(item){
        const kind = String(item?.kind || item?.type || item?.media_kind || '').toLowerCase();
        if(['image', 'prompt', 'video', 'audio'].includes(kind)) return kind;
        const mime = String(item?.mime_type || item?.mime || '').toLowerCase();
        if(mime.startsWith('video/')) return 'video';
        if(mime.startsWith('audio/')) return 'audio';
        if(mime.startsWith('image/')) return 'image';
        const url = String(item?.url || item?.thumbnail || item?.thumb_url || item?.preview_url || item?.file || item?.name || '');
        if(VIDEO_URL_RE.test(url)) return 'video';
        if(AUDIO_EXT_RE.test(url)) return 'audio';
        if(IMAGE_EXT_RE.test(url)) return 'image';
        if(item?.prompt || item?.text || item?.positive) return 'prompt';
        return 'image';
    }

    function mediaKindOfFile(file){
        const mime = String(file?.type || '').toLowerCase();
        const name = String(file?.name || '');
        if(mime.startsWith('video/') || VIDEO_URL_RE.test(name)) return 'video';
        if(mime.startsWith('audio/') || AUDIO_EXT_RE.test(name)) return 'audio';
        if(mime.startsWith('image/') || IMAGE_EXT_RE.test(name)) return 'image';
        return '';
    }

    function assetDisplayName(item){
        return String(item?.name || item?.title || item?.filename || '未命名素材').trim() || '未命名素材';
    }

    function assetThumbUrl(item){
        return String(item?.thumbnail || item?.thumb_url || item?.preview_url || item?.url || '').trim();
    }

    function syncKindPanelAddButton(){
        const addBtn = byId('mmKindPanelAdd');
        const label = byId('mmKindPanelAddLabel');
        const fileInput = byId('mmKindPanelFile');
        if(!addBtn) return;
        const isPrompt = activeAssetKind === 'prompt';
        const iconName = isPrompt ? 'plus' : 'upload';
        const title = isPrompt ? '新建提示词' : '上传资产';
        if(label) label.textContent = isPrompt ? '新建' : '上传';
        addBtn.title = title;
        addBtn.setAttribute('aria-label', title);
        addBtn.disabled = kindAssetsSaving;
        addBtn.querySelectorAll(':scope > i, :scope > svg').forEach(node => node.remove());
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        addBtn.insertBefore(icon, addBtn.firstChild);
        if(fileInput){
            fileInput.accept = ASSET_KIND_ACCEPT[activeAssetKind] || '';
            fileInput.value = '';
        }
        try { global.lucide?.createIcons?.(); } catch(_e) {}
    }

    async function copyTextToClipboard(text){
        const value = String(text || '');
        if(!value) return false;
        try {
            if(navigator.clipboard?.writeText){
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch(_e) {}
        try {
            const area = document.createElement('textarea');
            area.value = value;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.left = '-9999px';
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand('copy');
            area.remove();
            return ok;
        } catch(_e) {
            return false;
        }
    }

    function postToCanvas(message){
        const frame = document.getElementById('frame-canvas');
        try { frame?.contentWindow?.postMessage(message, '*'); } catch(_e) {}
    }

    function absoluteAssetUrl(url){
        const raw = String(url || '').trim();
        if(!raw) return '';
        if(/^(https?:|data:|blob:)/i.test(raw)) return raw;
        try { return new URL(raw, global.location.origin).href; } catch(_e) { return raw; }
    }

    async function importCanvasUrlsToKindPanel(items){
        if(!activeAssetKind || activeAssetKind === 'prompt'){
            toastKindMessage('请先打开图片/视频/音频资产面板');
            return;
        }
        const list = (items || [])
            .map(item => ({
                url: absoluteAssetUrl(item?.url),
                name: String(item?.name || 'media').trim() || 'media',
                kind: String(item?.kind || '').toLowerCase(),
            }))
            .filter(item => item.url && (!item.kind || item.kind === activeAssetKind || (
                activeAssetKind === 'image' && !item.kind
            )));
        if(!list.length){
            toastKindMessage(`请拖入${ASSET_KIND_TITLES[activeAssetKind] || '对应'}素材`);
            return;
        }
        kindAssetsSaving = true;
        syncKindPanelAddButton();
        try {
            const data = await fetch('/api/local-assets/import-urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folder: activeAssetKind,
                    items: list.map(item => ({ url: item.url, name: item.name })),
                }),
            }).then(async r => {
                if(!r.ok){
                    const detail = await r.json().catch(() => ({}));
                    throw new Error(detail?.detail || await r.text() || '导入失败');
                }
                return r.json();
            });
            toastKindMessage(`已保存 ${data?.count || list.length} 个资产`);
            await loadKindPanelAssets(activeAssetKind);
        } catch(error) {
            toastKindMessage(error?.message || '从画布导入失败');
        } finally {
            kindAssetsSaving = false;
            syncKindPanelAddButton();
        }
    }

    function tryImportCanvasDropAtPoint(clientX, clientY, items){
        const panel = byId('mmSidebarKindPanel');
        const body = byId('mmKindPanelBody');
        if(!panel || panel.hidden || !body || !activeAssetKind || activeAssetKind === 'prompt') return false;
        const rect = body.getBoundingClientRect();
        if(clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;
        void importCanvasUrlsToKindPanel(items);
        return true;
    }

    function setKindPanelDropActive(active){
        const body = byId('mmKindPanelBody');
        const drop = byId('mmKindPanelDrop');
        body?.classList.toggle('is-drop-active', Boolean(active));
        if(drop){
            drop.hidden = !active;
            drop.setAttribute('aria-hidden', active ? 'false' : 'true');
        }
    }

    function toastKindMessage(message){
        if(global.toast){
            try { global.toast(message); return; } catch(_e) {}
        }
        if(global.SmartCanvasShellToast?.show){
            try { global.SmartCanvasShellToast.show(message); return; } catch(_e) {}
        }
        try { console.info(message); } catch(_e) {}
    }

    function renderKindPanelItems(items){
        const empty = byId('mmKindPanelEmpty');
        const grid = byId('mmKindPanelGrid');
        if(!empty || !grid) return;
        const list = Array.isArray(items) ? items : [];
        if(!list.length){
            empty.hidden = false;
            empty.textContent = ASSET_KIND_EMPTY[activeAssetKind] || '暂无内容';
            grid.hidden = true;
            grid.innerHTML = '';
            return;
        }
        empty.hidden = true;
        grid.hidden = false;
        const icon = {
            image: 'image',
            prompt: 'text',
            video: 'film',
            audio: 'music-2',
        }[activeAssetKind] || 'file';
        grid.innerHTML = list.map(item => {
            const name = esc(assetDisplayName(item));
            const thumb = assetThumbUrl(item);
            const bodyText = String(item?.positive || item?.text || item?.prompt || '').trim();
            const preview = esc(bodyText);
            if(activeAssetKind === 'prompt'){
                const id = esc(String(item?.id || ''));
                const libraryId = esc(String(item?.library_id || ''));
                return `<div class="mm-kind-item mm-kind-item-prompt" data-prompt-id="${id}" data-library-id="${libraryId}" data-prompt-name="${name}">
                    <div class="mm-kind-item-prompt-body">
                        <span class="mm-kind-item-name">${name}</span>
                        <span class="mm-kind-item-preview">${preview || '（空提示词）'}</span>
                        <textarea class="mm-kind-item-editor" hidden rows="4">${preview}</textarea>
                    </div>
                    <div class="mm-kind-item-actions">
                        <button type="button" class="mm-kind-item-action" data-prompt-action="copy" title="复制提示词" aria-label="复制提示词"><i data-lucide="copy"></i><span>复制</span></button>
                        <button type="button" class="mm-kind-item-action" data-prompt-action="edit" title="编辑提示词" aria-label="编辑提示词"><i data-lucide="pencil"></i><span>编辑</span></button>
                        <button type="button" class="mm-kind-item-action" data-prompt-action="apply" title="引用到画布输入栏" aria-label="引用到画布输入栏"><i data-lucide="corner-down-left"></i><span>引用</span></button>
                        <button type="button" class="mm-kind-item-action" data-prompt-action="save" hidden title="保存修改" aria-label="保存修改"><i data-lucide="save"></i><span>保存</span></button>
                        <button type="button" class="mm-kind-item-action" data-prompt-action="cancel" hidden title="取消" aria-label="取消"><span>取消</span></button>
                    </div>
                </div>`;
            }
            const thumbHtml = thumb
                ? `<img src="${esc(thumb)}" alt="">`
                : `<i data-lucide="${icon}"></i>`;
            return `<button type="button" class="mm-kind-item" title="${name}">
                <span class="mm-kind-item-thumb">${thumbHtml}</span>
                <span class="mm-kind-item-name">${name}</span>
            </button>`;
        }).join('');
        try { global.lucide?.createIcons?.(); } catch(_e) {}
    }

    function setPromptItemEditing(card, editing){
        if(!card) return;
        card.classList.toggle('is-editing', Boolean(editing));
        const preview = card.querySelector('.mm-kind-item-preview');
        const editor = card.querySelector('.mm-kind-item-editor');
        const editBtn = card.querySelector('[data-prompt-action="edit"]');
        const saveBtn = card.querySelector('[data-prompt-action="save"]');
        const cancelBtn = card.querySelector('[data-prompt-action="cancel"]');
        const copyBtn = card.querySelector('[data-prompt-action="copy"]');
        const applyBtn = card.querySelector('[data-prompt-action="apply"]');
        if(preview) preview.hidden = Boolean(editing);
        if(editor){
            editor.hidden = !editing;
            if(editing){
                editor.focus();
                editor.setSelectionRange(editor.value.length, editor.value.length);
            }
        }
        if(editBtn) editBtn.hidden = Boolean(editing);
        if(copyBtn) copyBtn.hidden = Boolean(editing);
        if(applyBtn) applyBtn.hidden = Boolean(editing);
        if(saveBtn) saveBtn.hidden = !editing;
        if(cancelBtn) cancelBtn.hidden = !editing;
    }

    async function handlePromptItemAction(action, card){
        if(!card || !action) return;
        const id = card.dataset.promptId || '';
        const editor = card.querySelector('.mm-kind-item-editor');
        const preview = card.querySelector('.mm-kind-item-preview');
        const currentText = String(editor?.value || preview?.textContent || '').trim();
        if(action === 'copy'){
            const ok = await copyTextToClipboard(currentText);
            toastKindMessage(ok ? '已复制提示词' : '复制失败');
            return;
        }
        if(action === 'apply'){
            if(!currentText){
                toastKindMessage('提示词为空');
                return;
            }
            postToCanvas({ type: 'shell-apply-prompt', text: currentText });
            toastKindMessage('已引用到画布输入栏');
            return;
        }
        if(action === 'edit'){
            setPromptItemEditing(card, true);
            return;
        }
        if(action === 'cancel'){
            if(editor && preview) editor.value = preview.textContent || '';
            setPromptItemEditing(card, false);
            return;
        }
        if(action === 'save'){
            if(!id){
                toastKindMessage('无法保存：缺少提示词 ID');
                return;
            }
            const nextText = String(editor?.value || '').trim();
            if(!nextText){
                toastKindMessage('提示词不能为空');
                return;
            }
            try {
                const data = await fetch(`/api/prompt-libraries/items/${encodeURIComponent(id)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        positive: nextText,
                        name: card.dataset.promptName || undefined,
                    }),
                }).then(async r => {
                    if(!r.ok){
                        const detail = await r.json().catch(() => ({}));
                        throw new Error(detail?.detail || await r.text() || '保存失败');
                    }
                    return r.json();
                });
                void data;
                if(preview) preview.textContent = nextText;
                setPromptItemEditing(card, false);
                toastKindMessage('提示词已更新');
            } catch(error) {
                toastKindMessage(error?.message || '保存失败');
            }
        }
    }

    async function loadLocalKindAssets(kind){
        const response = await fetch('/api/local-assets', { cache: 'no-store' });
        if(!response.ok) throw new Error(await response.text());
        const data = await response.json();
        const raw = Array.isArray(data) ? data
            : Array.isArray(data?.items) ? data.items
            : Array.isArray(data?.assets) ? data.assets
            : [];
        return raw.filter(item => mediaKindOfAsset(item) === kind);
    }

    async function loadPromptKindAssets(){
        const response = await fetch('/api/prompt-libraries', { cache: 'no-store' });
        if(!response.ok) throw new Error(await response.text());
        const data = await response.json();
        const libraries = Array.isArray(data?.library?.libraries)
            ? data.library.libraries
            : Array.isArray(data?.libraries) ? data.libraries : [];
        return libraries
            .filter(lib => lib && lib.id !== 'system' && !lib.readonly)
            .flatMap(lib => (Array.isArray(lib.items) ? lib.items : []).map(item => ({
                ...item,
                kind: 'prompt',
                name: item?.name || '未命名提示词',
                text: item?.positive || item?.text || '',
                library_id: lib.id,
            })))
            .filter(item => item.id);
    }

    async function loadKindPanelAssets(kind){
        if(kindAssetsLoading) return;
        kindAssetsLoading = true;
        const empty = byId('mmKindPanelEmpty');
        if(empty){
            empty.hidden = false;
            empty.textContent = '加载中…';
        }
        byId('mmKindPanelGrid')?.setAttribute('hidden', '');
        try {
            const filtered = kind === 'prompt'
                ? await loadPromptKindAssets()
                : await loadLocalKindAssets(kind);
            if(activeAssetKind === kind) renderKindPanelItems(filtered);
        } catch(_e) {
            if(activeAssetKind === kind) renderKindPanelItems([]);
        } finally {
            kindAssetsLoading = false;
        }
    }

    async function ensurePromptLibrary(){
        const response = await fetch('/api/prompt-libraries', { cache: 'no-store' });
        if(!response.ok) throw new Error(await response.text());
        const data = await response.json();
        const libraries = Array.isArray(data?.library?.libraries)
            ? data.library.libraries
            : Array.isArray(data?.libraries) ? data.libraries : [];
        const existing = libraries.find(lib => lib && lib.id !== 'system' && !lib.readonly);
        if(existing) return existing;
        const created = await fetch('/api/prompt-libraries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: '我的提示词' }),
        }).then(async r => {
            if(!r.ok) throw new Error(await r.text());
            return r.json();
        });
        const next = Array.isArray(created?.library?.libraries)
            ? created.library.libraries.find(lib => lib && lib.id !== 'system' && !lib.readonly)
            : null;
        if(!next) throw new Error('无法创建提示词库');
        return next;
    }

    async function addPromptAsset(){
        const positive = String(global.prompt?.('输入提示词内容', '') || '').trim();
        if(!positive) return;
        const defaultName = positive.slice(0, 24) || '未命名提示词';
        const name = String(global.prompt?.('提示词名称', defaultName) || '').trim() || defaultName;
        kindAssetsSaving = true;
        syncKindPanelAddButton();
        try {
            const lib = await ensurePromptLibrary();
            const data = await fetch('/api/prompt-libraries/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    library_id: lib.id,
                    name,
                    category: 'mine',
                    positive,
                    scene: '侧栏资产',
                }),
            }).then(async r => {
                if(!r.ok) throw new Error(await r.text());
                return r.json();
            });
            void data;
            toastKindMessage('提示词已保存');
            await loadKindPanelAssets('prompt');
        } catch(error) {
            toastKindMessage(error?.message || '保存提示词失败');
            global.alert?.(error?.message || '保存提示词失败');
        } finally {
            kindAssetsSaving = false;
            syncKindPanelAddButton();
        }
    }

    async function uploadKindFiles(fileList){
        if(activeAssetKind === 'prompt'){
            toastKindMessage('提示词请使用「新建」添加');
            return;
        }
        const files = [...(fileList || [])].filter(file => mediaKindOfFile(file) === activeAssetKind);
        if(!files.length){
            toastKindMessage(`请选择${ASSET_KIND_TITLES[activeAssetKind] || '对应'}文件`);
            return;
        }
        kindAssetsSaving = true;
        syncKindPanelAddButton();
        const empty = byId('mmKindPanelEmpty');
        if(empty && !byId('mmKindPanelGrid')?.childElementCount){
            empty.hidden = false;
            empty.textContent = '上传中…';
        }
        try {
            const form = new FormData();
            form.append('folder', activeAssetKind || '');
            files.forEach(file => form.append('files', file, file.name || 'media'));
            const data = await fetch('/api/local-assets/upload', {
                method: 'POST',
                body: form,
            }).then(async r => {
                if(!r.ok){
                    const detail = await r.json().catch(() => ({}));
                    throw new Error(detail?.detail || await r.text() || '上传失败');
                }
                return r.json();
            });
            toastKindMessage(`已保存 ${data?.count || data?.files?.length || files.length} 个资产`);
            await loadKindPanelAssets(activeAssetKind);
        } catch(error) {
            toastKindMessage(error?.message || '上传失败');
            global.alert?.(error?.message || '上传失败');
            if(activeAssetKind) await loadKindPanelAssets(activeAssetKind);
        } finally {
            kindAssetsSaving = false;
            syncKindPanelAddButton();
        }
    }

    function handleKindPanelAdd(){
        if(!activeAssetKind || kindAssetsSaving) return;
        if(activeAssetKind === 'prompt'){
            void addPromptAsset();
            return;
        }
        byId('mmKindPanelFile')?.click();
    }

    function openAssetKindPanel(kind){
        const next = String(kind || '').toLowerCase();
        if(!ASSET_KIND_TITLES[next]) return;
        activeAssetKind = next;
        kindDropDepth = 0;
        setKindPanelDropActive(false);
        const sidebar = byId('mmSidebar');
        const panel = byId('mmSidebarKindPanel');
        const title = byId('mmKindPanelTitle');
        if(!sidebar || !panel) return;
        if(title) title.textContent = ASSET_KIND_TITLES[next];
        setKindViewMode(kindViewMode);
        syncKindPanelAddButton();
        sidebar.classList.add('is-kind-panel-open');
        panel.hidden = false;
        panel.setAttribute('aria-hidden', 'false');
        void loadKindPanelAssets(next);
        try { global.lucide?.createIcons?.(); } catch(_e) {}
    }

    function closeAssetKindPanel(){
        activeAssetKind = '';
        kindDropDepth = 0;
        setKindPanelDropActive(false);
        const sidebar = byId('mmSidebar');
        const panel = byId('mmSidebarKindPanel');
        sidebar?.classList.remove('is-kind-panel-open');
        if(panel){
            panel.hidden = true;
            panel.setAttribute('aria-hidden', 'true');
        }
        const fileInput = byId('mmKindPanelFile');
        if(fileInput) fileInput.value = '';
    }

    function setAssetFolderOpen(folder, open, persist = true){
        if(!folder) return;
        folder.classList.toggle('is-collapsed', !open);
        folder.querySelector(':scope > .mm-asset-tree-folder-row > button')?.setAttribute('aria-expanded', open ? 'true' : 'false');
        if(open) renderAssetFolderChildren(folder);
        if(persist) writeAssetTreeState();
    }

    function readAssetFolders(){
        try {
            const saved = JSON.parse(localStorage.getItem(ASSET_FOLDER_KEY) || '{}');
            return saved && typeof saved === 'object' ? saved : {};
        } catch(_e) { return {}; }
    }

    function writeAssetFolders(folders){
        try { localStorage.setItem(ASSET_FOLDER_KEY, JSON.stringify(folders)); } catch(_e) {}
    }

    function renderAssetFolderChildren(folder){
        const children = folder?.querySelector('.mm-asset-tree-children');
        if(!children) return;
        const folders = readAssetFolders()[folder.dataset.assetKind] || [];
        children.innerHTML = folders.length
            ? folders.map(name => `<div class="mm-asset-tree-child"><i data-lucide="folder"></i><span>${esc(name)}</span></div>`).join('')
            : '<div class="mm-asset-tree-empty">该文件夹暂无素材</div>';
        try { global.lucide?.createIcons?.(); } catch(_e) {}
    }

    function ensureAssetFolderMenu(){
        if(assetFolderMenu) return assetFolderMenu;
        assetFolderMenu = document.createElement('div');
        assetFolderMenu.className = 'mm-asset-folder-menu';
        assetFolderMenu.setAttribute('role', 'menu');
        assetFolderMenu.hidden = true;
        assetFolderMenu.innerHTML = '<button type="button" role="menuitem" data-asset-folder-action="new"><i data-lucide="folder-plus"></i><span>新建文件夹</span></button><button type="button" role="menuitem" data-asset-folder-action="move"><i data-lucide="folder-input"></i><span>移动到</span></button>';
        assetFolderMenu.addEventListener('click', event => {
            const action = event.target.closest('[data-asset-folder-action]')?.dataset.assetFolderAction;
            const folder = assetFolderMenuTarget;
            if(!action || !folder) return;
            event.preventDefault();
            if(action === 'new'){
                const name = global.prompt?.('新建文件夹名称', '新文件夹')?.trim();
                if(name){
                    const state = readAssetFolders();
                    const list = Array.isArray(state[folder.dataset.assetKind]) ? state[folder.dataset.assetKind] : [];
                    if(!list.includes(name)) list.push(name);
                    state[folder.dataset.assetKind] = list;
                    writeAssetFolders(state);
                    setAssetFolderOpen(folder, true);
                }
            } else if(action === 'move') {
                global.alert?.('移动到功能将在素材接入后启用');
            }
            closeAssetFolderMenu();
        });
        document.body.appendChild(assetFolderMenu);
        try { global.lucide?.createIcons?.(); } catch(_e) {}
        return assetFolderMenu;
    }

    function closeAssetFolderMenu(){
        if(assetFolderMenu) assetFolderMenu.hidden = true;
        assetFolderMenuTarget = null;
        byId('mmAssetTree')?.querySelectorAll('.mm-asset-folder-menu-trigger').forEach(button => button.setAttribute('aria-expanded', 'false'));
    }

    function openAssetFolderMenu(trigger, folder){
        const menu = ensureAssetFolderMenu();
        const wasOpen = assetFolderMenuTarget === folder && !menu.hidden;
        closeAssetFolderMenu();
        if(wasOpen) return;
        assetFolderMenuTarget = folder;
        trigger.setAttribute('aria-expanded', 'true');
        menu.hidden = false;
        const rect = trigger.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        menu.style.left = `${Math.max(8, rect.right - menuRect.width)}px`;
        menu.style.top = `${Math.min(global.innerHeight - menuRect.height - 8, rect.bottom + 4)}px`;
    }

    function restoreAssetTreeState(){
        const state = readAssetTreeState();
        setAssetTreeOpen(Boolean(state.root), false);
        byId('mmAssetTree')?.querySelectorAll('.mm-asset-tree-folder').forEach(folder => {
            renderAssetFolderChildren(folder);
            setAssetFolderOpen(folder, Boolean(state.folders?.[folder.dataset.assetKind]), false);
        });
    }

    function bind(){ 
        byId('mmSidebarToggle')?.addEventListener('click', event => {
            event.preventDefault();
            setSidebarCollapsed(true);
        });
        byId('mmSidebarReopen')?.addEventListener('click', event => {
            event.preventDefault();
            setSidebarCollapsed(false);
        });
        byId('mmSideNewCanvas')?.addEventListener('click', event => {
            event.preventDefault();
            byId('shellNewCanvasBtn')?.click();
            scheduleReload(900);
        });
        byId('mmSideAssets')?.addEventListener('click', event => {
            event.preventDefault();
            const tree = byId('mmAssetTree');
            setAssetTreeOpen(Boolean(tree?.classList.contains('is-collapsed')));
        });
        byId('mmAssetTreeFolders')?.addEventListener('click', event => {
            const button = event.target.closest('.mm-asset-tree-folder-btn[data-asset-kind]');
            if(!button) return;
            event.preventDefault();
            event.stopPropagation();
            openAssetKindPanel(button.dataset.assetKind);
        });
        byId('mmKindPanelBack')?.addEventListener('click', event => {
            event.preventDefault();
            closeAssetKindPanel();
        });
        byId('mmKindPanelAdd')?.addEventListener('click', event => {
            event.preventDefault();
            handleKindPanelAdd();
        });
        byId('mmKindPanelFile')?.addEventListener('change', event => {
            const input = event.target;
            const files = input?.files;
            void uploadKindFiles(files);
            if(input) input.value = '';
        });
        byId('mmKindPanelGrid')?.addEventListener('click', event => {
            const actionBtn = event.target.closest('[data-prompt-action]');
            const card = event.target.closest('.mm-kind-item-prompt');
            if(!actionBtn || !card) return;
            event.preventDefault();
            event.stopPropagation();
            void handlePromptItemAction(actionBtn.dataset.promptAction, card);
        });
        const kindBody = byId('mmKindPanelBody');
        kindBody?.addEventListener('dragenter', event => {
            if(!activeAssetKind || activeAssetKind === 'prompt') return;
            if(![...(event.dataTransfer?.types || [])].includes('Files')) return;
            event.preventDefault();
            kindDropDepth += 1;
            setKindPanelDropActive(true);
        });
        kindBody?.addEventListener('dragover', event => {
            if(!activeAssetKind || activeAssetKind === 'prompt') return;
            if(![...(event.dataTransfer?.types || [])].includes('Files')) return;
            event.preventDefault();
            if(event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            setKindPanelDropActive(true);
        });
        kindBody?.addEventListener('dragleave', event => {
            if(!activeAssetKind || activeAssetKind === 'prompt') return;
            event.preventDefault();
            kindDropDepth = Math.max(0, kindDropDepth - 1);
            if(kindDropDepth === 0) setKindPanelDropActive(false);
        });
        kindBody?.addEventListener('drop', event => {
            if(!activeAssetKind || activeAssetKind === 'prompt') return;
            event.preventDefault();
            kindDropDepth = 0;
            setKindPanelDropActive(false);
            void uploadKindFiles(event.dataTransfer?.files);
        });
        byId('mmKindViewGrid')?.addEventListener('click', event => {
            event.preventDefault();
            setKindViewMode('grid');
        });
        byId('mmKindViewList')?.addEventListener('click', event => {
            event.preventDefault();
            setKindViewMode('list');
        });
        byId('mmSideSkill')?.addEventListener('click', event => {
            event.preventDefault();
            // Skill 能力位于对话栏 composer：打开对话栏即到达
            global.openGptDock?.();
        });
        byId('mmSideAll')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const history = global.SmartCanvasShellHistory;
            history?.init?.();
            if(history?.isOpen?.()){
                history.close();
                return;
            }
            if(history?.openAllCanvases){
                history.openAllCanvases();
            } else if(global.openCanvasHistory){
                global.openCanvasHistory();
            } else {
                document.getElementById('shellCanvasProjectMenuBtn')?.click();
            }
        });
        byId('mmSideSettings')?.addEventListener('click', event => {
            event.preventDefault();
            global.SmartCanvasShellSettings?.open?.('help');
        });
        // 画布状态变化（新建 / 改名 / 打开）时刷新最近创作
        global.addEventListener('message', event => {
            const data = event?.data;
            if(data?.type === 'canvas-project-state') scheduleReload(500);
            if(data?.type === 'shell-try-import-canvas-assets'){
                const frame = document.getElementById('frame-canvas');
                const rect = frame?.getBoundingClientRect?.();
                if(!rect) return;
                const clientX = Number(data.clientX) + rect.left;
                const clientY = Number(data.clientY) + rect.top;
                tryImportCanvasDropAtPoint(clientX, clientY, data.items || []);
            }
        });
        // 用户菜单里改名时实时同步侧栏
        document.addEventListener('input', event => {
            if(event.target?.id === 'shellUserNameInput'){
                const nameEl = byId('mmSidebarUserName');
                if(nameEl) nameEl.textContent = event.target.value || '用户';
            }
        });
        document.addEventListener('pointerdown', event => {
            const target = event.target;
            if(!(target instanceof Element)) return;
            if(!target.closest('.mm-recent-actions, .mm-recent-menu-trigger, .mm-recent-menu')) closeRecentMenus();
            if(!target.closest('.mm-asset-folder-menu-trigger, .mm-asset-folder-menu')) closeAssetFolderMenu();
        });
        document.addEventListener('click', event => {
            const target = event.target;
            if(!(target instanceof Element)) return;
            if(!target.closest('.mm-recent-actions, .mm-recent-menu-trigger, .mm-recent-menu')) closeRecentMenus();
            if(!target.closest('.mm-asset-folder-menu-trigger, .mm-asset-folder-menu')) closeAssetFolderMenu();
        });
        document.addEventListener('keydown', event => {
            if(event.key === 'Escape'){
                if(activeAssetKind){
                    closeAssetKindPanel();
                    return;
                }
                closeRecentMenus();
                closeAssetFolderMenu();
            }
        });
        global.setInterval(() => {
            byId('mmSidebarRecentList')?.querySelectorAll('.mm-recent-meta').forEach(meta => {
                meta.textContent = formatMeta({
                    updated_at:Number(meta.dataset.updatedAt || 0),
                    node_count:Number(meta.dataset.nodeCount || 0),
                });
            });
        }, 60 * 1000);
    }

    function init(){
        if(!byId('mmSidebar')) return;
        kindViewMode = readKindViewMode();
        bind();
        syncUser();
        restoreAssetTreeState();
        setKindViewMode(kindViewMode);
        try { setSidebarCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch(_e) {}
        void load();
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    global.MMSidebar = Object.freeze({
        refresh: () => void load(),
        syncUser,
        openAssetKindPanel,
        closeAssetKindPanel,
        tryImportCanvasDropAtPoint,
        importCanvasUrlsToKindPanel,
    });
})(window);
