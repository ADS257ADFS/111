/**
 * Shell project history center.
 * Canvas history drawer for general, ecommerce and film-comic projects.
 */
(function(global){
    'use strict';

    const VIEW_KEY = 'shell_project_history_view';
    function savedView(){
        try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; }
        catch(_err) { return 'grid'; }
    }
    const state = {records:[], type:'all', query:'', sort:'updated-desc', view:savedView(), loading:false};
    let lastFocused = null;
    let canvasOpenRequest = 0;

    function modalEl(){ return document.getElementById('shellProjectHistoryModal'); }
    function listEl(){ return document.getElementById('shellProjectHistoryList'); }
    function isEmbedded(){ return Boolean(modalEl()?.classList.contains('shell-project-history-embedded')); }
    function isOpen(){
        const modal = modalEl();
        if(isEmbedded()) return Boolean(modal?.classList.contains('active') && global.SmartCanvasShellSettings?.isOpen?.());
        return Boolean(modal?.classList.contains('open'));
    }
    function setPanelCopy(title, searchPlaceholder){
        const modal = modalEl();
        const heading = document.getElementById('shellProjectHistoryTitle');
        const search = document.getElementById('shellProjectHistorySearch');
        if(modal) modal.setAttribute('aria-label', title);
        if(heading) heading.textContent = title;
        if(search) search.placeholder = searchPlaceholder;
    }
    function resetAllCanvasFilters(){
        const modal = modalEl();
        state.type = 'all';
        state.query = '';
        modal?.querySelectorAll('[data-project-filter]').forEach(button => {
            button.classList.toggle('active', button.dataset.projectFilter === 'all');
        });
        const search = document.getElementById('shellProjectHistorySearch');
        if(search) search.value = '';
    }
    function escapeText(value){
        return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function formatTime(value){
        const timestamp = Number(value || 0);
        if(!timestamp) return '暂无时间';
        try { return new Date(timestamp).toLocaleString('zh-CN', {hour12:false}); }
        catch(_err) { return '暂无时间'; }
    }
    function formatCompactTime(value){
        const timestamp = Number(value || 0);
        if(!timestamp) return '--/-- --:--';
        try {
            const date = new Date(timestamp);
            const pad = number => String(number).padStart(2, '0');
            return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        } catch(_err) {
            return '--/-- --:--';
        }
    }
    function smartCanvasShellUrl(id){
        const frame = document.getElementById('frame-canvas');
        const raw = frame?.dataset?.src || frame?.getAttribute('src') || '/static/smart-canvas.html';
        try {
            const url = new URL(raw, location.origin);
            url.searchParams.set('id', id);
            return `${url.pathname}${url.search}${url.hash}`;
        } catch(_err) {
            return `/static/smart-canvas.html?id=${encodeURIComponent(id)}&v=2026.08.01.21`;
        }
    }
    function getActiveCanvasIdFromFrame(){
        const frame = global.getActiveCanvasFrame?.() || document.getElementById('frame-canvas');
        if(!frame) return '';
        let href = frame.src || '';
        try { href = frame.contentWindow?.location?.href || href; } catch(_err) {}
        try { return new URL(href, location.origin).searchParams.get('id') || ''; }
        catch(_err) { return ''; }
    }
    function canvasPageActive(){
        return Boolean(global.isCanvasPageActive?.() || document.querySelector('#frame-canvas.active'));
    }
    function normalizeCanvas(item){
        const rawKind = String(item.kind || '').toLowerCase();
        const canvasKind = rawKind === 'ecommerce' || item.icon === 'shopping-bag'
            ? 'ecommerce'
            : ['film-comic', 'film_comic', 'comic', 'drama'].includes(rawKind) || item.icon === 'clapperboard'
                ? 'film-comic'
                : 'general';
        const nodeCount = Number(item.node_count || 0);
        return {
            key:`canvas:${item.id}`,
            id:String(item.id || ''),
            type:'project',
            canvasKind,
            title:String(item.title || '未命名项目'),
            createdAt:Number(item.created_at || 0),
            updatedAt:Number(item.updated_at || 0),
            nodeCount,
            searchable:String(item.title || ''),
        };
    }
    async function fetchCanvasRecords(){
        const response = await fetch('/api/canvases');
        if(!response.ok) throw new Error(await response.text());
        const data = await response.json();
        return (data.canvases || [])
            .filter(item => item.id && !item.deleted_at)
            .map(normalizeCanvas);
    }
    function showError(message){
        const error = document.getElementById('shellProjectHistoryError');
        if(!error) return;
        error.hidden = !message;
        error.textContent = message || '';
    }
    async function renameRecord(item, title){
        const nextTitle = String(title || '').trim();
        if(!nextTitle || nextTitle === item.title) return;
        const response = await fetch(`/api/canvases/${encodeURIComponent(item.id)}/metadata`, {
            method:'PATCH',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({title:nextTitle}),
        });
        if(!response.ok) throw new Error(await response.text());
        const data = await response.json();
        const saved = data.canvas;
        item.title = String(saved?.title || nextTitle);
        item.updatedAt = Number(saved?.updated_at || Date.now());
        item.searchable = item.title;
    }
    async function deleteRecord(item){
        const response = await fetch(`/api/canvases/${encodeURIComponent(item.id)}`, {method:'DELETE'});
        if(!response.ok) throw new Error(await response.text());
        state.records = state.records.filter(record => record.key !== item.key);
    }
    function visibleRecords(){
        const query = state.query.trim().toLocaleLowerCase('zh-CN');
        const records = state.records.filter(item => {
            if(state.type !== 'all' && item.canvasKind !== state.type) return false;
            if(!query) return true;
            return `${item.title} ${item.searchable}`.toLocaleLowerCase('zh-CN').includes(query);
        });
        const byTitle = (a, b) => a.title.localeCompare(b.title, 'zh-CN', {numeric:true, sensitivity:'base'});
        records.sort((a, b) => {
            if(state.sort === 'created-desc') return b.createdAt - a.createdAt;
            if(state.sort === 'created-asc') return a.createdAt - b.createdAt;
            if(state.sort === 'title-asc') return byTitle(a, b);
            if(state.sort === 'title-desc') return byTitle(b, a);
            return b.updatedAt - a.updatedAt;
        });
        return records;
    }
    function categoryMeta(kind){
        if(kind === 'ecommerce') return {label:'电商画布', icon:'shopping-bag'};
        if(kind === 'film-comic') return {label:'漫剧画布', icon:'clapperboard'};
        return {label:'通用画布', icon:'panels-top-left'};
    }
    function displayRecordTitle(item){
        const title = String(item?.title || '').trim();
        const withoutCanvasSuffix = title.replace(/\s*画布$/u, '').trim();
        if(!withoutCanvasSuffix || ['智能', '电商', '漫剧', '未命名', '未命名记录'].includes(withoutCanvasSuffix)) return '未命名项目';
        return withoutCanvasSuffix;
    }
    function cardHtml(item){
        const isActive = item.id === getActiveCanvasIdFromFrame() && canvasPageActive();
        const category = categoryMeta(item.canvasKind);
        const displayTitle = displayRecordTitle(item);
        const fullTime = `修改于 ${formatTime(item.updatedAt)}`;
        return `<article class="shell-project-card ${isActive ? 'active' : ''}" data-project-key="${escapeText(item.key)}" data-project-type="${escapeText(item.type)}" data-project-kind="${escapeText(item.canvasKind)}">
            <button class="shell-project-card-open" type="button" data-project-open="${escapeText(item.key)}">
                <span class="shell-project-card-icon shell-project-card-icon--${item.canvasKind}"><i data-lucide="${category.icon}"></i></span>
                <span class="shell-project-card-copy">
                    <span class="shell-project-card-category">${category.label}</span>
                    <span class="shell-project-card-title" title="${escapeText(displayTitle)}">${escapeText(displayTitle)}</span>
                    <span class="shell-project-card-meta"><span class="shell-project-card-nodes"><i data-lucide="boxes"></i>${item.nodeCount} 个节点</span><span class="shell-project-card-time" title="${escapeText(fullTime)}">${escapeText(formatCompactTime(item.updatedAt))}</span></span>
                </span>
            </button>
            <span class="shell-project-card-actions">
                <button class="shell-project-card-action shell-project-card-rename" type="button" data-project-rename="${escapeText(item.key)}" title="修改名称" aria-label="修改 ${escapeText(displayTitle)} 的名称">
                    <i data-lucide="pencil"></i>
                </button>
                <button class="shell-project-card-action shell-project-card-delete" type="button" data-project-delete="${escapeText(item.key)}" title="删除" aria-label="删除 ${escapeText(displayTitle)}">
                    <i data-lucide="trash-2"></i>
                </button>
            </span>
        </article>`;
    }
    function applyViewMode(){
        const list = listEl();
        if(list) list.dataset.view = state.view;
        modalEl()?.querySelectorAll('[data-project-view]').forEach(button => {
            const active = button.dataset.projectView === state.view;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }
    function beginRename(item){
        const card = Array.from(listEl()?.querySelectorAll('[data-project-key]') || [])
            .find(element => element.dataset.projectKey === item.key);
        if(!card || card.classList.contains('is-renaming')) return;
        card.classList.add('is-renaming');
        const form = document.createElement('form');
        form.className = 'shell-project-card-rename-form';
        form.innerHTML = `<label>项目名称</label>
            <input class="ui-input shell-project-card-rename-input" type="text" maxlength="120" value="${escapeText(displayRecordTitle(item))}" aria-label="项目名称">
            <div>
                <button type="button" data-rename-cancel>取消</button>
                <button type="submit" class="primary">保存</button>
            </div>`;
        card.appendChild(form);
        const input = form.querySelector('input');
        let saving = false;
        const cancel = () => {
            if(saving) return;
            form.remove();
            card.classList.remove('is-renaming');
            card.querySelector('[data-project-rename]')?.focus?.();
        };
        const save = async () => {
            const title = input.value.trim();
            if(!title){
                input.setCustomValidity('名称不能为空');
                input.reportValidity();
                return;
            }
            if(title === item.title){ cancel(); return; }
            saving = true;
            input.disabled = true;
            form.querySelectorAll('button').forEach(button => { button.disabled = true; });
            try {
                await renameRecord(item, title);
                showError('');
                render();
            } catch(_err) {
                saving = false;
                input.disabled = false;
                form.querySelectorAll('button').forEach(button => { button.disabled = false; });
                showError('名称修改失败，请稍后重试');
                input.focus();
                input.select();
            }
        };
        form.addEventListener('submit', event => {
            event.preventDefault();
            void save();
        });
        form.querySelector('[data-rename-cancel]').addEventListener('click', cancel);
        input.addEventListener('input', () => input.setCustomValidity(''));
        input.addEventListener('keydown', event => {
            if(event.key === 'Escape'){
                event.preventDefault();
                cancel();
            }
        });
        form.addEventListener('focusout', () => {
            setTimeout(() => {
                if(!saving && form.isConnected && !form.contains(document.activeElement)) void save();
            }, 0);
        });
        input.focus();
        input.select();
    }
    function render(){
        const list = listEl();
        if(!list) return;
        applyViewMode();
        const records = visibleRecords();
        const count = document.getElementById('shellProjectHistoryCount');
        if(count) count.textContent = `${records.length} 条记录`;
        list.innerHTML = records.length
            ? records.map(cardHtml).join('')
            : '<div class="shell-project-history-empty"><i data-lucide="search-x"></i><span>没有找到符合条件的项目</span></div>';
        list.querySelectorAll('[data-project-open]').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                const item = state.records.find(record => record.key === button.dataset.projectOpen);
                if(item) void openRecord(item);
            });
        });
        list.querySelectorAll('[data-project-rename]').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const item = state.records.find(record => record.key === button.dataset.projectRename);
                if(item) beginRename(item);
            });
        });
        list.querySelectorAll('[data-project-delete]').forEach(button => {
            button.addEventListener('click', async event => {
                event.preventDefault();
                event.stopPropagation();
                const item = state.records.find(record => record.key === button.dataset.projectDelete);
                if(!item) return;
                if(!global.confirm(`确定删除“${displayRecordTitle(item)}”这个项目吗？此操作无法撤销。`)) return;
                button.disabled = true;
                try {
                    await deleteRecord(item);
                    showError('');
                    render();
                } catch(_err) {
                    button.disabled = false;
                    showError('记录删除失败，请稍后重试');
                }
            });
        });
        try { global.lucide?.createIcons?.(); } catch(_err) {}
    }
    function setLoading(loading){
        state.loading = Boolean(loading);
        const list = listEl();
        applyViewMode();
        if(list) list.setAttribute('aria-busy', loading ? 'true' : 'false');
        if(loading && list){
            list.innerHTML = '<div class="shell-project-history-empty"><span class="shell-project-history-spinner"></span><span>正在读取项目…</span></div>';
        }
    }
    async function load(){
        if(state.loading) return;
        if(isEmbedded()) setPanelCopy('历史记录', '搜索历史记录');
        setLoading(true);
        const canvases = await Promise.allSettled([fetchCanvasRecords()]);
        state.records = canvases[0].status === 'fulfilled' ? canvases[0].value : [];
        setLoading(false);
        render();
        showError(canvases[0].status === 'rejected' ? '历史记录读取失败，请稍后重试' : '');
    }
    async function saveCurrentCanvas(frame){
        try {
            const save = frame?.contentWindow?.SmartCanvasPersistence?.saveCanvas;
            if(typeof save === 'function') await save();
        } catch(_err) {}
    }
    async function openCanvasRecord(item){
        const id = item?.id || '';
        if(!id) return;
        const request = ++canvasOpenRequest;
        const frame = document.getElementById('frame-canvas');
        const activeFrame = global.getActiveCanvasFrame?.() || document.getElementById('frame-canvas');
        if(!frame) return;
        const activeCanvasId = getActiveCanvasIdFromFrame();
        closeHost();
        if(id === activeCanvasId){
            if(!frame.classList.contains('active')){
                const trigger = document.querySelector('[data-shell-primary-nav="canvas"]');
                global.switchUI?.(trigger, 'canvas');
            }
            return;
        }
        await saveCurrentCanvas(activeFrame);
        if(request !== canvasOpenRequest) return;
        const nextUrl = smartCanvasShellUrl(id);
        if(!frame.classList.contains('active')){
            const trigger = document.querySelector('[data-shell-primary-nav="canvas"]');
            global.switchUI?.(trigger, 'canvas');
        }
        try {
            frame.contentWindow.location.replace(nextUrl);
        } catch(_err) {
            frame.src = nextUrl;
        }
    }
    async function openRecord(item){
        await openCanvasRecord(item);
    }
    function setHistoryChromeOpen(open){
        document.documentElement.classList.toggle('shell-history-open', Boolean(open));
        const button = document.getElementById('shellCanvasProjectMenuBtn');
        button?.setAttribute('aria-expanded', open ? 'true' : 'false');
        button?.classList.toggle('active', Boolean(open));
        const frame = global.getActiveCanvasFrame?.() || document.getElementById('frame-canvas');
        try { frame?.contentDocument?.documentElement?.classList?.toggle('history-panel-open', Boolean(open)); } catch(_err) {}
    }
    function open(mode = 'history'){
        const modal = modalEl();
        if(!modal) return;
        // 元素可能正嵌在用户中心弹窗里作汇总页，抽屉模式先收回 body 并剥掉嵌入态
        if(modal.parentElement !== document.body) document.body.appendChild(modal);
        modal.classList.remove('shell-settings-pane', 'shell-settings-history-pane', 'shell-project-history-embedded', 'active');
        delete modal.dataset.shellSettingsPane;
        setPanelCopy(mode === 'all-canvases' ? '所有画布' : '历史记录', mode === 'all-canvases' ? '搜索画布' : '搜索历史记录');
        if(modal.dataset.bound !== '1') init();
        lastFocused = document.activeElement;
        global.closeShellAssetLibrary?.();
        global.SmartCanvasShellUserMenu?.close?.({ immediate: true });
        global.SmartCanvasShellSettings?.close?.();
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        void modal.offsetWidth;
        modal.classList.add('open');
        setHistoryChromeOpen(true);
        void load();
    }
    function close(){
        const modal = modalEl();
        if(!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        setHistoryChromeOpen(false);
        global.setTimeout(() => {
            if(!modal.classList.contains('open') && !isEmbedded()) modal.hidden = true;
        }, 260);
        if(lastFocused?.isConnected) lastFocused.focus?.();
        lastFocused = null;
    }
    function closeHost(){
        // 嵌在用户中心里时，打开某条记录应当关掉整个用户中心弹窗
        if(isEmbedded()){
            global.SmartCanvasShellSettings?.close?.();
            return;
        }
        close();
    }
    function openAllCanvases(){
        resetAllCanvasFilters();
        open('all-canvases');
    }
    function toggle(force){
        const next = force === undefined ? !isOpen() : Boolean(force);
        next ? open() : close();
    }
    function init(){
        const modal = modalEl();
        if(!modal || modal.dataset.bound === '1') return;
        document.body.appendChild(modal);
        modal.hidden = true;
        modal.dataset.bound = '1';
        modal.querySelectorAll('[data-project-filter]').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                state.type = button.dataset.projectFilter || 'all';
                modal.querySelectorAll('[data-project-filter]').forEach(item => item.classList.toggle('active', item === button));
                render();
            });
        });
        document.getElementById('shellProjectHistorySearch')?.addEventListener('input', event => {
            state.query = event.target.value || '';
            render();
        });
        document.getElementById('shellProjectHistorySort')?.addEventListener('change', event => {
            state.sort = event.target.value || 'updated-desc';
            render();
        });
        modal.querySelectorAll('[data-project-view]').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                const view = button.dataset.projectView === 'list' ? 'list' : 'grid';
                if(state.view === view) return;
                state.view = view;
                try { localStorage.setItem(VIEW_KEY, view); } catch(_err) {}
                applyViewMode();
            });
        });
        modal.querySelectorAll('[data-project-history-close]').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                close();
            });
        });
        applyViewMode();
        document.addEventListener('keydown', event => {
            if(event.key === 'Escape' && isOpen()){
                event.preventDefault();
                close();
            }
        });
    }

    global.SmartCanvasShellHistory = Object.freeze({init, load, open, openAllCanvases, close, toggle, isOpen, openCanvasRecord});
    global.closeShellCanvasHistory = close;
    global.isShellCanvasHistoryOpen = isOpen;
    global.openCanvasHistory = () => toggle();
})(window);
