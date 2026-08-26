/**
 * Smart Canvas — asset library core (categories, load/sync, gallery grid, API).
 * Image assets use the same flat category workflow as prompt assets.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;
    let assetHoverHideTimer = 0;

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || null;
    }

    function S(){
        const c = d();
        if(!c) throw new Error('[SmartCanvasAssetLibrary] deps not registered');
        return c;
    }

function assetCategories(type='image'){
    const library = activeAssetLibrary();
    return (library?.categories || S().assetLibrary.categories || []).filter(cat => (cat.type || 'image') === type);
}
function activeAssetMediaType(){
    return ['audio','video'].includes(S().assetTab) ? S().assetTab : 'image';
}
function assetCategoryById(categoryId=''){
    const id = String(categoryId || '').trim();
    if(!id) return null;
    return assetCategories(activeAssetMediaType()).find(cat => cat.id === id) || null;
}
function assetChildCategories(parentId=''){
    const pid = String(parentId || '').trim();
    return assetCategories(activeAssetMediaType()).filter(cat => String(cat.parent_id || '').trim() === pid);
}
function assetCategoryAncestors(categoryId=''){
    const chain = [];
    let cur = assetCategoryById(categoryId);
    const guard = new Set();
    while(cur && !guard.has(cur.id)){
        guard.add(cur.id);
        chain.unshift(cur);
        const parentId = String(cur.parent_id || '').trim();
        if(!parentId) break;
        cur = assetCategoryById(parentId);
    }
    return chain;
}
function canvasAssetLibraryForCurrentCanvas(){
    if(!S().getCanvasId()) return null;
    const targetId = `canvas_${String(S().getCanvasId()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)}`;
    return assetLibraries().find(lib => lib.canvas_id === S().getCanvasId() || lib.id === targetId) || null;
}
function syncActiveCanvasAssetLibrary(){
    const lib = canvasAssetLibraryForCurrentCanvas();
    if(lib?.id) S().activeAssetLibraryId = lib.id;
}
function normalizeActiveAssetCategory(){
    if(!assetCategoryById(S().activeAssetCategoryId)){
        const roots = assetChildCategories('');
        S().activeAssetCategoryId = roots[0]?.id || '';
    }
}
async function ensureCanvasAssetLibrary(){
    if(!S().getCanvasId()) return null;
    try {
        const data = await fetch('/api/asset-library/ensure-canvas-library', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({canvas_id:S().getCanvasId(), name:S().getCanvas()?.title || ''})
        }).then(async r => {
            if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || S().tr('smart.assetLoadFail'));
            return r.json();
        });
        setAssetLibraryFromResponse(data, {render:false});
        S().activeAssetLibraryId = data.asset_library?.id || S().activeAssetLibraryId;
        if(data.root_category_id && !assetCategoryById(S().activeAssetCategoryId)) S().activeAssetCategoryId = data.root_category_id;
        normalizeActiveAssetCategory();
        return data;
    } catch(e) {
        return null;
    }
}
function setAssetGridSize(size='m'){
    S().assetGridSize = ['s', 'm', 'l'].includes(size) ? size : 'm';
    try { localStorage.setItem(S().ASSET_GRID_SIZE_KEY, S().assetGridSize); } catch(e) {}
    if(S().assetGrid){
        S().assetGrid.classList.remove('size-s', 'size-m', 'size-l');
        S().assetGrid.classList.add(`size-${S().assetGridSize}`);
    }
    document.querySelectorAll('[data-asset-grid-size]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.assetGridSize === S().assetGridSize);
    });
}
function renderAssetBreadcrumb(){
    if(!S().assetBreadcrumb) return;
    const chain = assetCategoryAncestors(S().activeAssetCategoryId);
    if(!chain.length){
        S().assetBreadcrumb.innerHTML = `<button type="button" class="asset-breadcrumb-btn is-current" data-asset-folder-nav="">${S().escapeHtml(S().tr('smart.assetRootFolder'))}</button>`;
        return;
    }
    S().assetBreadcrumb.innerHTML = chain.map((cat, index) => {
        const current = index === chain.length - 1;
        const sep = index ? `<span class="asset-breadcrumb-sep">/</span>` : '';
        return `${sep}<button type="button" class="asset-breadcrumb-btn${current ? ' is-current' : ''}" data-asset-folder-nav="${S().escapeHtml(cat.id)}" title="${S().escapeHtml(cat.name || '')}">${S().escapeHtml(cat.name || S().tr('smart.assetFolder'))}</button>`;
    }).join('');
    S().assetBreadcrumb.querySelectorAll('[data-asset-folder-nav]').forEach(btn => {
        btn.onclick = () => {
            S().activeAssetCategoryId = btn.dataset.assetFolderNav || '';
            normalizeActiveAssetCategory();
            renderAssetLibrary();
        };
    });
}
function assetLibraryContainingCategory(categoryId=''){
    const id = String(categoryId || '').trim();
    if(!id) return null;
    return assetLibraries().find(lib => (lib.categories || []).some(cat => cat.id === id)) || null;
}
function mergeCreatedAssetCategory(data){
    const category = data?.category;
    if(!category?.id) return null;
    S().assetLibrary = data.library || S().assetLibrary;
    let library = assetLibraryContainingCategory(category.id) || assetLibraries().find(lib => lib.id === S().activeAssetLibraryId) || null;
    if(!library) return null;
    if(!Array.isArray(library.categories)) library.categories = [];
    const idx = library.categories.findIndex(cat => cat.id === category.id);
    if(idx >= 0) library.categories[idx] = {...library.categories[idx], ...category};
    else library.categories.push({...category});
    const activeLib = assetLibraries().find(lib => lib.id === (S().assetLibrary.active_library_id || library.id));
    if(activeLib?.id === library.id && Array.isArray(S().assetLibrary.categories)){
        const topIdx = S().assetLibrary.categories.findIndex(cat => cat.id === category.id);
        if(topIdx >= 0) S().assetLibrary.categories[topIdx] = {...assetLibrary.categories[topIdx], ...category};
        else S().assetLibrary.categories.push({...category});
    }
    return library;
}
function bindAssetFolderEvents(){
    S().assetGrid.querySelectorAll('[data-open-asset-folder]').forEach(el => {
        el.onclick = () => {
            S().activeAssetCategoryId = el.dataset.openAssetFolder || '';
            normalizeActiveAssetCategory();
            renderAssetLibrary();
        };
    });
}
async function createAssetFolderAt(parentId='', name=''){
    try {
        if(S().getCanvasId()){
            await ensureCanvasAssetLibrary();
            syncActiveCanvasAssetLibrary();
        }
        if(!S().activeAssetLibraryId){
            const libs = assetLibraries();
            S().activeAssetLibraryId = canvasAssetLibraryForCurrentCanvas()?.id || libs[0]?.id || '';
        }
        if(S().getCanvasId() && !assetLibraries().some(lib => lib.id === S().activeAssetLibraryId)){
            S().toast(S().tr('smart.assetStoryLibraryMissing'));
            return false;
        }
        if(!S().activeAssetLibraryId || !name){
            S().toast(S().tr('smart.assetNoFolder'));
            return false;
        }
        const data = await fetch('/api/asset-library/categories', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                library_id: S().activeAssetLibraryId,
                name,
                type:activeAssetMediaType(),
                parent_id: String(parentId || '')
            })
        }).then(async r => {
            if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || S().tr('smart.assetAddFail'));
            return r.json();
        });
        const library = mergeCreatedAssetCategory(data);
        if(library?.id) S().activeAssetLibraryId = library.id;
        setAssetLibraryFromResponse(data, {render:false});
        return data?.category?.id || '';
    } catch(err){
        S().toast(err.message || S().tr('smart.assetAddFail'));
        return '';
    }
}
async function renameAssetCategory(categoryId, name){
    if(!categoryId || !name) return false;
    try {
        const data = await fetch(`/api/asset-library/categories/${encodeURIComponent(categoryId)}`, {
            method:'PATCH',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({name})
        }).then(async r => {
            if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || S().tr('smart.assetAddFail'));
            return r.json();
        });
        setAssetLibraryFromResponse(data);
        return true;
    } catch(err){
        S().toast(err.message || S().tr('smart.assetAddFail'));
        return false;
    }
}
async function deleteAssetCategory(categoryId){
    if(!categoryId) return false;
    try {
        const data = await fetch(`/api/asset-library/categories/${encodeURIComponent(categoryId)}`, {method:'DELETE'}).then(async r => {
            if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || S().tr('smart.assetAddFail'));
            return r.json();
        });
        setAssetLibraryFromResponse(data);
        if(S().activeAssetCategoryId === categoryId) S().activeAssetCategoryId = '';
        normalizeActiveAssetCategory();
        return true;
    } catch(err){
        S().toast(err.message || S().tr('smart.assetAddFail'));
        return false;
    }
}
async function createAssetFolder(){
    try {
        if(S().getCanvasId()){
            await ensureCanvasAssetLibrary();
            syncActiveCanvasAssetLibrary();
        }
        normalizeActiveAssetCategory();
        if(!S().activeAssetLibraryId){
            const libs = assetLibraries();
            S().activeAssetLibraryId = canvasAssetLibraryForCurrentCanvas()?.id || libs[0]?.id || '';
        }
        if(S().getCanvasId() && !assetLibraries().some(lib => lib.id === S().activeAssetLibraryId)){
            S().toast(S().tr('smart.assetStoryLibraryMissing'));
            return;
        }
        let parent = activeAssetCategory();
        if(!parent){
            const roots = assetChildCategories('');
            if(roots.length){
                S().activeAssetCategoryId = roots[0].id;
                parent = roots[0];
            }
        }
        if(!S().activeAssetLibraryId || !parent?.id){
            S().toast(S().tr('smart.assetNoFolder'));
            return;
        }
        const parentId = parent.id;
        const name = await openAssetNameDialog({
            title: S().tr('smart.assetNewFolder'),
            value: S().tr('smart.assetFolder'),
            placeholder: S().tr('smart.assetFolder')
        });
        if(!name) return;
        const data = await fetch('/api/asset-library/categories', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                library_id: S().activeAssetLibraryId,
                name,
                type:activeAssetMediaType(),
                parent_id: parentId
            })
        }).then(async r => {
            if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || S().tr('smart.assetAddFail'));
            return r.json();
        });
        const library = mergeCreatedAssetCategory(data);
        if(library?.id) S().activeAssetLibraryId = library.id;
        S().activeAssetCategoryId = parentId;
        setAssetLibraryFromResponse(data, {render:false});
        S().activeAssetCategoryId = parentId;
        normalizeActiveAssetCategory();
        renderAssetLibrary();
        S().toast(S().tr('smart.assetFolderCreated'));
    } catch(err){
        S().toast(err.message || S().tr('smart.assetAddFail'));
    }
}
function assetLibraries(){
    return Array.isArray(S().assetLibrary.libraries) && S().assetLibrary.libraries.length ? S().assetLibrary.libraries : [{id:'default', name:'Default asset library', categories:S().assetLibrary.categories || []}];
}
function activeAssetLibrary(){
    const libs = assetLibraries();
    return libs.find(lib => lib.id === S().activeAssetLibraryId) || libs[0] || null;
}
function activeAssetCategory(){
    const cats = assetCategories(activeAssetMediaType());
    if(!cats.length) return null;
    const found = cats.find(cat => cat.id === S().activeAssetCategoryId);
    if(found) return found;
    return assetChildCategories('')[0] || cats[0];
}
async function loadAssetLibrary(){
    try {
        if(S().getCanvasId()) await ensureCanvasAssetLibrary();
        const data = await fetch('/api/asset-library').then(r => r.json());
        setAssetLibraryFromResponse(data, {render:false});
        syncActiveCanvasAssetLibrary();
        normalizeActiveAssetCategory();
        renderAssetLibrary();
    } catch(e) {
        S().toast(S().tr('smart.assetLoadFail'));
    }
}
function refreshAssetLibrarySoon(delay=120){
    clearTimeout(S().assetLibraryRefreshTimer);
    S().assetLibraryRefreshTimer = setTimeout(async () => {
        await loadAssetLibrary();
        if(S().mentionPicker?.classList?.contains('open') && S().mentionSource === 'asset') S().renderMentionPicker('asset');
    }, delay);
}
function handleAssetLibraryUpdatedMessage(data={}){
    const remoteUpdatedAt = Number(data.updated_at || 0);
    if(remoteUpdatedAt && remoteUpdatedAt <= Number(S().assetLibraryUpdatedAt || 0)) return;
    refreshAssetLibrarySoon();
}
function connectAssetLibrarySyncSocket(){
    if(window.parent && window.parent !== window) return;
    const host = window.location.host;
    if(!host) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const clientId = `canvas_asset_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    let socket;
    let retryTimer = null;
    const connect = () => {
        try {
            socket = new WebSocket(`${protocol}://${host}/ws/stats?client_id=${clientId}`);
        } catch(e) {
            retryTimer = setTimeout(connect, 3000);
            return;
        }
        socket.onmessage = event => {
            try {
                const data = JSON.parse(event.data);
                if(data?.type === 'asset_library_updated') handleAssetLibraryUpdatedMessage(data);
            } catch(e) {}
        };
        socket.onclose = () => {
            retryTimer = setTimeout(connect, 3000);
        };
        socket.onerror = () => {
            try { socket.close(); } catch(e) {}
        };
    };
    window.addEventListener('beforeunload', () => {
        clearTimeout(retryTimer);
        try { socket?.close(); } catch(e) {}
    });
    connect();
}
function setAssetLibraryFromResponse(data, options={}){
    S().assetLibrary = data.library || S().assetLibrary;
    S().assetLibraryUpdatedAt = Number(S().assetLibrary.updated_at || S().assetLibraryUpdatedAt || 0);
    const libs = assetLibraries();
    if(!S().activeAssetLibraryId) S().activeAssetLibraryId = S().assetLibrary.active_library_id || libs[0]?.id || '';
    if(S().activeAssetLibraryId && !libs.some(lib => lib.id === S().activeAssetLibraryId)) S().activeAssetLibraryId = libs[0]?.id || '';
    const cats = assetCategories(activeAssetMediaType());
    if(S().activeAssetCategoryId && !cats.some(cat => cat.id === S().activeAssetCategoryId)) S().activeAssetCategoryId = '';
    if(!S().activeAssetCategoryId) S().activeAssetCategoryId = assetChildCategories('')[0]?.id || activeAssetCategory()?.id || '';
    const imageCats = assetCategories('image');
    if(S().mentionAssetCategoryId && !imageCats.some(cat => cat.id === S().mentionAssetCategoryId)) S().mentionAssetCategoryId = '';
    if(!S().mentionAssetCategoryId) S().mentionAssetCategoryId = imageCats[0]?.id || '';
    if(options.render !== false) {
        renderAssetLibrary();
        if(S().mentionPicker?.classList?.contains('open') && S().mentionSource === 'asset') S().renderMentionPicker('asset');
    }
}
function syncComposerAssetShortcuts(){
    const panelOpen = Boolean(S().assetLibraryOpen && S().assetPanel?.classList.contains('open'));
    document.querySelectorAll('[data-composer-asset-library]').forEach(button => {
        const active = panelOpen;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelector('.composer-asset-shortcuts')?.dispatchEvent(new Event('composer-kind-sync'));
}
function toggleAssetLibrary(open){
    if(open === undefined) open = !S().assetLibraryOpen;
    if(!S().assetPanel) return;
    const nextOpen = !!open;
    document.documentElement.classList.toggle('asset-library-open', nextOpen);
    const panel = S().assetPanel;
    panel.inert = !nextOpen;
    panel.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
    if(!nextOpen) hideAssetHoverPreview();
    if(nextOpen) window.SmartCanvasAssetOpenGuard?.arm?.();
    const panelOpen = panel.classList.contains('open');
    if(!nextOpen && panelOpen){
        S().assetLibraryOpen = false;
        S().assetPanel.classList.remove('open');
        if(S().assetToggle){
            S().assetToggle.classList.remove('active');
            S().assetToggle.setAttribute('aria-pressed', 'false');
        }
        syncComposerAssetShortcuts();
        window.SmartCanvasLeftRail?.notifyShellAssetState?.(false);
        return;
    }
    if(S().assetLibraryOpen === nextOpen){
        if(panelOpen !== nextOpen){
            S().assetPanel.classList.toggle('open', nextOpen);
            if(S().assetToggle){
                S().assetToggle.classList.toggle('active', nextOpen);
                S().assetToggle.setAttribute('aria-pressed', nextOpen ? 'true' : 'false');
            }
            if(nextOpen) window.SmartCanvasAssetOpenGuard?.deferParentNotify?.(true);
            else window.SmartCanvasLeftRail?.notifyShellAssetState?.(false);
        }
        syncComposerAssetShortcuts();
        return;
    }
    S().assetLibraryOpen = nextOpen;    S().assetPanel.classList.toggle('open', S().assetLibraryOpen);
    if(S().assetToggle){
        S().assetToggle.classList.toggle('active', S().assetLibraryOpen);
        S().assetToggle.setAttribute('aria-pressed', S().assetLibraryOpen ? 'true' : 'false');
    }
    if(S().assetLibraryOpen){
        loadAssetLibrary();
        window.SmartCanvasAssetOpenGuard?.deferParentNotify?.(true);
    } else {
        window.SmartCanvasLeftRail?.notifyShellAssetState?.(false);
    }
    syncComposerAssetShortcuts();
}
function assetCategoryForMention(){
    const cats = assetCategories('image');
    if(!cats.length) return null;
    return cats.find(cat => cat.id === S().mentionAssetCategoryId)
        || cats.find(cat => (cat.items || []).length)
        || cats[0];
}

const SMART_CANVAS_ASSET_INBOX_KEY = 'smart_canvas_asset_inbox';

function smartVideoFallbackHtml(url, attrs=''){
    const original = S().smartOriginalMediaUrl(url);
    const src = S().displayMediaUrl({url:original});
    return `<video src="${S().escapeHtml(src)}" data-url="${S().escapeAttr(original)}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"${attrs ? ` ${attrs}` : ''}></video>`;
}

function assetNodeImageFromItem(item, fallbackName='asset'){
    const image = {
        url:item?.url || '',
        name:item?.name || fallbackName,
        kind:item?.kind || assetMediaKind(item)
    };
    S().copyMediaSizeFields(item, image);
    if(item?.asset_uris && typeof item.asset_uris === 'object') image.asset_uris = {...item.asset_uris};
    return image;
}

function assetMediaKind(item){
    if(!item) return 'image';
    if(item.kind === 'video' || item.type === 'video') return 'video';
    if(item.kind === 'audio' || item.type === 'audio') return 'audio';
    const mime = String(item.mime_type || item.mimeType || item.type || '').toLowerCase();
    if(mime.startsWith('video/')) return 'video';
    if(mime.startsWith('audio/')) return 'audio';
    if(mime.startsWith('image/')) return 'image';
    const url = String(item.url || item.thumbnail || '').toLowerCase().split('?')[0];
    const name = String(item.name || '').toLowerCase();
    if(/\.(mp4|webm|mov|m4v|avi|mkv)$/.test(url) || /\.(mp4|webm|mov|m4v|avi|mkv)$/.test(name)) return 'video';
    if(/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(url) || /\.(mp3|wav|m4a|aac|ogg|flac)$/.test(name)) return 'audio';
    return 'image';
}
function assetThumbHtml(item){
    const url = S().escapeAttr(item.url || '');
    const thumb = S().escapeAttr(item.thumbnail || item.thumb || item.preview || item.url || '');
    const kind = assetMediaKind(item);
    if(kind === 'video'){
        return `<div class="asset-thumb-wrap"><video class="asset-thumb" src="${url}" data-url="${url}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video><span class="asset-video-badge"><i data-lucide="film"></i>VIDEO</span></div>`;
    }
    if(kind === 'audio'){
        return `<div class="asset-thumb-wrap media-thumb audio-thumb asset-thumb"><i data-lucide="file-audio"></i><span>${S().escapeHtml(item.name || 'Audio')}</span></div>`;
    }
    return `<img class="asset-thumb" src="${thumb}" alt="">`;
}
function renderSimpleAssetCategoryControls(){
    const mediaType = activeAssetMediaType();
    const categories = assetCategories(mediaType);
    const mediaLabel = ({image:'图片', audio:'音频', video:'视频'})[mediaType] || '素材';
    if(!categories.some(category => category.id === S().activeAssetCategoryId)){
        S().activeAssetCategoryId = categories.find(category => (category.items || []).length)?.id || categories[0]?.id || '';
    }
    if(S().assetCategorySelect){
        S().assetCategorySelect.innerHTML = categories.map(category => `<option value="${S().escapeHtml(category.id)}">${S().escapeHtml(category.name || '未命名分类')}</option>`).join('');
        S().assetCategorySelect.value = S().activeAssetCategoryId || '';
    }
    const picker = document.getElementById('assetCategoryPicker');
    const trigger = document.getElementById('assetCategoryTrigger');
    const menu = document.getElementById('assetCategoryMenu');
    const active = categories.find(category => category.id === S().activeAssetCategoryId) || null;
    if(trigger){
        trigger.querySelector('span').textContent = active
            ? `${active.name || '未命名分类'}（${(active.items || []).length}）`
            : '暂无分类';
    }
    if(menu){
        menu.innerHTML = categories.map(category => `
            <div class="asset-category-option ${category.id === S().activeAssetCategoryId ? 'is-active' : ''}" role="option" aria-selected="${category.id === S().activeAssetCategoryId ? 'true' : 'false'}">
                <button class="asset-category-choice" type="button" data-asset-category-choice="${S().escapeHtml(category.id)}">
                    <span>${S().escapeHtml(category.name || '未命名分类')}</span>
                    <span class="asset-category-count">${(category.items || []).length}</span>
                </button>
                <button class="asset-category-rename" type="button" data-rename-asset-category="${S().escapeHtml(category.id)}" title="重命名分类" aria-label="重命名分类 ${S().escapeHtml(category.name || '')}"><i data-lucide="pencil"></i></button>
                <button class="asset-category-delete" type="button" data-delete-asset-category="${S().escapeHtml(category.id)}" title="删除分类" aria-label="删除分类 ${S().escapeHtml(category.name || '')}"><i data-lucide="trash-2"></i></button>
            </div>
        `).join('') || '<div class="asset-empty">暂无分类</div>';
    }
    if(picker && picker.dataset.boundCategoryPicker !== '1'){
        picker.dataset.boundCategoryPicker = '1';
        trigger?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const open = menu?.hidden !== false;
            if(menu) menu.hidden = !open;
            trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        menu?.addEventListener('click', async event => {
            const renameBtn = event.target.closest('[data-rename-asset-category]');
            if(renameBtn){
                event.preventDefault();
                event.stopPropagation();
                const categoryId = renameBtn.dataset.renameAssetCategory || '';
                const category = assetCategoryById(categoryId);
                if(!category) return;
                menu.hidden = true;
                trigger.setAttribute('aria-expanded', 'false');
                const name = await openAssetNameDialog({title:'重命名分类', value:category.name || '', placeholder:'输入分类名称'});
                if(!name || name === category.name) return;
                const renamed = await renameAssetCategory(categoryId, name);
                if(renamed) S().toast?.('分类已重命名');
                return;
            }
            const deleteBtn = event.target.closest('[data-delete-asset-category]');
            if(deleteBtn){
                event.preventDefault();
                event.stopPropagation();
                const categoryId = deleteBtn.dataset.deleteAssetCategory || '';
                const category = assetCategoryById(categoryId);
                if(!category || !global.confirm(`确定删除分类“${category.name || '未命名分类'}”及其中全部${mediaLabel}吗？\n\n此操作不可撤销。`)) return;
                deleteBtn.disabled = true;
                const deleted = await deleteAssetCategory(categoryId);
                if(deleted){
                    S().activeAssetCategoryId = '';
                    normalizeActiveAssetCategory();
                    renderAssetLibrary();
                    S().toast?.('分类及其中内容已删除');
                } else {
                    deleteBtn.disabled = false;
                }
                return;
            }
            const choice = event.target.closest('[data-asset-category-choice]');
            if(!choice) return;
            event.preventDefault();
            event.stopPropagation();
            S().activeAssetCategoryId = choice.dataset.assetCategoryChoice || '';
            normalizeActiveAssetCategory();
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            renderAssetLibrary();
        });
        document.addEventListener('pointerdown', event => {
            if(picker.contains(event.target)) return;
            if(menu) menu.hidden = true;
            trigger?.setAttribute('aria-expanded', 'false');
        });
        document.addEventListener('keydown', event => {
            if(event.key !== 'Escape') return;
            if(menu) menu.hidden = true;
            trigger?.setAttribute('aria-expanded', 'false');
        });
    }
    const addCategoryBtn = document.getElementById('assetImageAddCategory');
    if(addCategoryBtn && addCategoryBtn.dataset.boundAssetCategory !== '1'){
        addCategoryBtn.dataset.boundAssetCategory = '1';
        addCategoryBtn.addEventListener('click', async event => {
            event.preventDefault();
            event.stopPropagation();
            const name = await openAssetNameDialog({title:'新建分类', value:'', placeholder:'输入分类名称'});
            if(!name) return;
            const categoryId = await createAssetFolderAt('', name);
            if(!categoryId) return;
            S().activeAssetCategoryId = categoryId;
            renderAssetLibrary();
            S().toast?.('分类已创建');
        });
    }
    S().refreshIcons?.(picker);
}
function applyAssetReference(item){
    if(!item?.url) return;
    const mediaLabel = ({image:'图片', audio:'音频', video:'视频'})[assetMediaKind(item)] || '素材';
    const node = S().activeComposerNode?.() || S().selectedNode?.();
    if(node){
        const applied = S().addManualReferenceToSelectedNode?.(assetNodeImageFromItem(item), node);
        if(applied !== false){
            hideAssetHoverPreview();
            S().toast?.(`${mediaLabel}已引用到预览区`);
            return;
        }
    }
    importAssetItemToCanvas(item);
    hideAssetHoverPreview();
    S().toast?.(`${mediaLabel}已添加到画布`);
}
function renderAssetGalleryGrid(){
    if(!S().assetGrid) return;
    const cat = activeAssetCategory();
    const items = cat?.items || [];
    const emptyText = ({
        image:S().tr('smart.assetEmpty'),
        audio:'这个分类还没有音频。把画布里的音频拖进来保存。',
        video:'这个分类还没有视频。把画布里的视频拖进来保存。'
    })[activeAssetMediaType()] || S().tr('smart.assetEmpty');
    const itemHtml = items.map(item => {
        const kind = assetMediaKind(item);
        const mediaLabel = ({image:'图片', audio:'音频', video:'视频'})[kind] || '素材';
        const actionIcon = ({image:'image-plus', audio:'audio-lines', video:'film'})[kind] || 'plus';
        return `
        <div class="asset-item" draggable="true" data-asset-id="${S().escapeHtml(item.id)}" data-url="${S().escapeHtml(item.url)}" data-name="${S().escapeHtml(item.name || 'asset')}" data-kind="${S().escapeHtml(assetMediaKind(item))}">
            ${assetThumbHtml(item)}
            <div class="asset-item-actions" aria-label="${mediaLabel}操作">
                <button class="asset-mini-btn asset-reference-btn" type="button" draggable="false" data-reference-asset="${S().escapeHtml(item.id)}" title="添加${mediaLabel}" aria-label="添加${mediaLabel}"><i data-lucide="${actionIcon}"></i></button>
                <button class="asset-mini-btn danger" type="button" draggable="false" data-delete-asset="${S().escapeHtml(item.id)}" title="${S().escapeHtml(S().tr('common.delete'))}" aria-label="${S().escapeHtml(S().tr('common.delete'))}"><i data-lucide="trash-2"></i></button>
            </div>
        </div>
    `;
    }).join('');
    S().assetGrid.innerHTML = itemHtml || `<div class="asset-empty">${S().escapeHtml(emptyText)}</div>`;
    bindAssetItemEvents();
    S().refreshIcons(S().assetPanel);
}
function renderAssetLibrary(){
    if(!S().assetPanel || !S().assetGrid || !S().assetCategorySelect) return;
    if(!['image','prompt','audio','video'].includes(S().assetTab)) S().assetTab = 'image';
    document.querySelectorAll('[data-asset-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.assetTab === S().assetTab));
    const libs = assetLibraries();
    if(!S().activeAssetLibraryId || !libs.some(lib => lib.id === S().activeAssetLibraryId)){
        S().activeAssetLibraryId = canvasAssetLibraryForCurrentCanvas()?.id || S().assetLibrary.active_library_id || libs[0]?.id || '';
    }
    if(S().assetLibrarySelect){
        S().assetLibrarySelect.innerHTML = libs.map(lib => `<option value="${S().escapeHtml(lib.id)}" ${lib.id === S().activeAssetLibraryId ? 'selected' : ''}>${S().escapeHtml(lib.name || S().tr('smart.assetLibrary'))}</option>`).join('');
    }
    const mediaMode = ['image','audio','video'].includes(S().assetTab);
    const promptMode = S().assetTab === 'prompt';
    S().assetPanel.classList.toggle('is-prompt-mode', promptMode);
    window.SmartCanvasLeftRail?.syncAssetPanelModeWidth?.(S().assetTab);
    const imageMode = mediaMode;
    S().assetImageControls.style.display = imageMode ? 'flex' : 'none';
    if(S().assetPromptLibrary) S().assetPromptLibrary.style.display = promptMode ? 'flex' : 'none';
    if(promptMode){
        S().assetDropZone.style.display = 'none';
        S().assetGrid.style.display = 'none';
        window.SmartCanvasAssetPromptUi?.render?.();
        return;
    }
    normalizeActiveAssetCategory();
    renderSimpleAssetCategoryControls();
    const mediaLabel = ({image:'图片', audio:'音频', video:'视频'})[activeAssetMediaType()] || '素材';
    if(S().assetDropZone) S().assetDropZone.textContent = `把画布${mediaLabel}拖到这里保存到当前分类`;
    if(S().assetDropZone) S().assetDropZone.style.display = 'flex';
    if(S().assetGrid) S().assetGrid.style.display = 'grid';
    renderAssetGalleryGrid();
}
function openAssetNameDialog({title='', value='', placeholder='', cancelValue='', multiline=false }={}){
    if(!S().assetDialogBackdrop || !S().assetDialogInput || !S().assetDialogOk || !S().assetDialogCancel) return Promise.resolve(cancelValue);
    return new Promise(resolve => {
        S().assetDialogTitle.textContent = title || S().tr('smart.assetRename');
        S().assetDialogInput.value = value || '';
        S().assetDialogInput.placeholder = placeholder || '';
        S().assetDialogInput.classList.toggle('is-multiline', Boolean(multiline));
        S().assetDialogInput.rows = multiline ? 5 : 1;
        S().assetDialogBackdrop.hidden = false;
        S().assetDialogBackdrop.classList.add('open');
        S().assetDialogInput.focus();
        S().assetDialogInput.select();
        const cleanup = result => {
            S().assetDialogBackdrop.classList.remove('open');
            S().assetDialogBackdrop.hidden = true;
            S().assetDialogOk.onclick = null;
            S().assetDialogCancel.onclick = null;
            S().assetDialogInput.onkeydown = null;
            S().assetDialogBackdrop.onmousedown = null;
            S().assetDialogInput.classList.remove('is-multiline');
            S().assetDialogInput.rows = 1;
            resolve(result);
        };
        S().assetDialogOk.onclick = () => cleanup(S().assetDialogInput.value.trim());
        S().assetDialogCancel.onclick = () => cleanup(cancelValue);
        S().assetDialogInput.onkeydown = event => {
            if(event.key === 'Enter' && !multiline) cleanup(S().assetDialogInput.value.trim());
            if(event.key === 'Enter' && multiline && (event.ctrlKey || event.metaKey)) cleanup(S().assetDialogInput.value.trim());
            if(event.key === 'Escape') cleanup(cancelValue);
        };
        S().assetDialogBackdrop.onmousedown = event => {
            if(event.target === S().assetDialogBackdrop) cleanup(cancelValue);
        };
    });
}
function positionAssetHoverPreview(event){
    if(!S().assetHoverPreview || S().assetHoverPreview.hidden || S().assetHoverPreview.style.display === 'none') return;
    const pad = 14;
    const w = S().assetHoverPreview.offsetWidth || 260;
    const h = S().assetHoverPreview.offsetHeight || 300;
    let left = event.clientX - w - 16;
    if(left < pad) left = event.clientX + 16;
    left = Math.max(pad, Math.min(window.innerWidth - w - pad, left));
    const top = Math.max(pad, Math.min(window.innerHeight - h - pad, event.clientY + 12));
    S().assetHoverPreview.style.left = `${left}px`;
    S().assetHoverPreview.style.top = `${top}px`;
}
function showAssetHoverPreview(event, item){
    if(!S().assetHoverPreview || !item?.url) return;
    clearTimeout(assetHoverHideTimer);
    assetHoverHideTimer = 0;
    if(!S().assetLibraryOpen || !S().assetPanel?.classList.contains('open')){
        hideAssetHoverPreview();
        return;
    }
    let media = S().assetHoverPreview.querySelector('img,video');
    const kind = assetMediaKind(item);
    if(kind === 'audio'){
        hideAssetHoverPreview();
        return;
    }
    if(kind === 'video' && media?.tagName?.toLowerCase() !== 'video'){
        media?.replaceWith(document.createElement('video'));
        media = S().assetHoverPreview.querySelector('video');
    } else if(kind !== 'video' && media?.tagName?.toLowerCase() !== 'img'){
        media?.replaceWith(document.createElement('img'));
        media = S().assetHoverPreview.querySelector('img');
    }
    if(kind === 'video'){
        media.muted = true;
        media.loop = true;
        media.playsInline = true;
        media.preload = 'metadata';
        media.controls = false;
        media.disablePictureInPicture = true;
        media.setAttribute('disablepictureinpicture', '');
        media.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
        if(media.getAttribute('src') !== item.url) media.src = item.url;
        media.play?.().catch(() => {});
    } else {
        if(media.getAttribute('src') !== item.url) media.src = item.url;
        media.alt = 'asset preview';
    }
    S().assetHoverPreview.hidden = false;
    S().assetHoverPreview.style.display = 'block';
    positionAssetHoverPreview(event);
}
function hideAssetHoverPreview(){
    if(!S().assetHoverPreview) return;
    clearTimeout(assetHoverHideTimer);
    assetHoverHideTimer = 0;
    S().assetHoverPreview.style.display = 'none';
    S().assetHoverPreview.hidden = true;
    const media = S().assetHoverPreview.querySelector('img,video');
    media?.pause?.();
    if(media?.tagName?.toLowerCase() === 'video'){
        media.removeAttribute('src');
        media.load?.();
    }
}
function scheduleHideAssetHoverPreview(){
    clearTimeout(assetHoverHideTimer);
    assetHoverHideTimer = window.setTimeout(() => {
        assetHoverHideTimer = 0;
        hideAssetHoverPreview();
    }, 100);
}
function importAssetItemToCanvas(item){
    if(!item?.url) return;
    const point = S().viewportCenter?.();
    if(!point) return;
    S().pushUndo?.();
    const node = S().createImageNodeAt?.(point, [assetNodeImageFromItem(item)], {skipUndo:true, select:true});
    if(!node) return;
    S().selectedId = node.id;
    S().selectedIds = [];
    S().selectedImage = {nodeId:'', index:-1};
    S().render?.();
    S().scheduleSave?.();
}
function bindAssetItemEvents(){
    const items = activeAssetCategory()?.items || [];
    hideAssetHoverPreview();
    S().assetGrid.querySelectorAll('.asset-item').forEach(el => {
        el.addEventListener('mouseenter', event => {
            showAssetHoverPreview(event, {url:el.dataset.url, name:el.dataset.name, kind:el.dataset.kind});
        });
        el.addEventListener('mouseleave', scheduleHideAssetHoverPreview);
        el.addEventListener('dragstart', e => {
            if(e.target.closest('button')){
                e.preventDefault();
                return;
            }
            hideAssetHoverPreview();
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('application/x-smart-asset', JSON.stringify({url:el.dataset.url, name:el.dataset.name, kind:el.dataset.kind}));
            e.dataTransfer.setData('text/plain', el.dataset.url || '');
        });
        el.addEventListener('dblclick', e => {
            if(e.target.closest('button,input')) return;
            e.preventDefault();
            e.stopPropagation();
            const item = items.find(candidate => String(candidate.id) === String(el.dataset.assetId));
            if(item) importAssetItemToCanvas(item);
        });
    });
    S().assetGrid.querySelectorAll('[data-reference-asset]').forEach(btn => {
        btn.onpointerdown = e => e.stopPropagation();
        btn.onmousedown = e => e.stopPropagation();
        btn.ondragstart = e => { e.preventDefault(); e.stopPropagation(); };
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            const item = items.find(candidate => String(candidate.id) === String(btn.dataset.referenceAsset));
            if(item) applyAssetReference(item);
        };
    });
    S().assetGrid.querySelectorAll('[data-delete-asset]').forEach(btn => {
        btn.onpointerdown = e => e.stopPropagation();
        btn.onmousedown = e => e.stopPropagation();
        btn.ondragstart = e => { e.preventDefault(); e.stopPropagation(); };
        btn.onclick = async e => {
            e.preventDefault(); e.stopPropagation();
            btn.disabled = true;
            try {
                const data = await fetch(`/api/asset-library/items/${encodeURIComponent(btn.dataset.deleteAsset)}`, {method:'DELETE'}).then(r => r.json());
                setAssetLibraryFromResponse(data);
            } catch(err){
                btn.disabled = false;
                S().toast(err.message || S().tr('smart.assetAddFail'));
            }
        };
    });
}
async function addUrlToAssetLibrary(url, name='', categoryId='', opts={}){
    const cat = categoryId
        ? assetCategories(activeAssetMediaType()).find(item => item.id === categoryId)
        : activeAssetCategory();
    if(!cat){ S().toast(S().tr('smart.assetNoFolder')); return; }
    const data = await fetch('/api/asset-library/items', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({library_id:S().activeAssetLibraryId, category_id:cat.id, url, name})}).then(async r => {
        if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || S().tr('smart.assetAddFail'));
        return r.json();
    });
    setAssetLibraryFromResponse(data, {render:false});
    if(!opts.skipUiRefresh) renderAssetLibrary();
    if(!opts.skipToast) S().toast(S().tr('smart.assetSaved'));
}
function hasCanvasImageDrag(event){
    return Array.from(event.dataTransfer?.types || []).includes('application/x-smart-canvas-image');
}

function setAssetDragOver(active){
    if(!S().assetDropZone || !S().assetPanel) return;
    S().assetDropZone.classList.toggle('drag-over', !!active);
    S().assetPanel.classList.toggle('drag-over', !!active);
}

function handleAssetPanelDragOver(e){
    if(hasCanvasImageDrag(e) || S().hasSmartImageDropData(e.dataTransfer)){
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setAssetDragOver(true);
    }
}

async function handleAssetPanelDrop(e){
    if(!hasCanvasImageDrag(e) && !S().hasSmartImageDropData(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    setAssetDragOver(false);
    const raw = e.dataTransfer.getData('application/x-smart-canvas-image');
    if(raw){
        try {
            const payload = JSON.parse(raw);
            const items = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.images)
                    ? payload.images
                    : payload?.url ? [payload] : [];
            const valid = items.filter(item => item?.url && assetMediaKind(item) === activeAssetMediaType());
            if(!valid.length){ S().toast('素材类型与当前分类不匹配'); return; }
            for(let i = 0; i < valid.length; i++){
                const item = valid[i];
                await S().addUrlToAssetLibrary(item.url, item.name || '', S().activeAssetCategoryId, {
                    skipUiRefresh: i < valid.length - 1,
                    skipToast: i < valid.length - 1
                });
            }
            return;
        } catch(e) {
            S().toast(S().tr('smart.assetAddFail'));
            return;
        }
    }
    try {
        const payload = await S().resolveSmartImageDropPayload(e.dataTransfer);
        if(payload.type === 'files') {
            const matchingFiles = [...(payload.files || [])].filter(file => assetMediaKind(file) === activeAssetMediaType());
            if(!matchingFiles.length){ S().toast('素材类型与当前分类不匹配'); return; }
            const uploaded = await S().uploadFiles(matchingFiles);
            for(const file of uploaded) if(file?.url && assetMediaKind(file) === activeAssetMediaType()) await S().addUrlToAssetLibrary(file.url, file.name || '', S().activeAssetCategoryId);
        } else if(payload.type === 'localPaths') {
            const imported = await S().importSmartLocalImages(payload.localPaths);
            const matching = imported.filter(file => file?.url && assetMediaKind(file) === activeAssetMediaType());
            if(!matching.length){ S().toast('素材类型与当前分类不匹配'); return; }
            for(const file of matching) await S().addUrlToAssetLibrary(file.url, file.name || '', S().activeAssetCategoryId);
        } else if(payload.type === 'url') {
            if(assetMediaKind({url:payload.url}) !== activeAssetMediaType()){ S().toast('素材类型与当前分类不匹配'); return; }
            await S().addUrlToAssetLibrary(payload.url, S().smartImageNameFromUrl(payload.url), S().activeAssetCategoryId);
        }
    } catch(err) {
        S().toast(err.message || S().tr('smart.assetAddFail'));
    }
}
window.addEventListener('studio-theme-change', event => applyTheme(event.detail?.theme || 'light'));
try {
    const apiChannel = new BroadcastChannel('studio-api');
    apiChannel.onmessage = async event => {
        if(event.data?.type === 'providers-changed' || event.data?.type === 'workflows-changed' || event.data?.type === 'comfy-instances-changed'){
            await refreshSmartConfigFromSettings();
        }
        if(event.data?.type === 'asset_library_updated') handleAssetLibraryUpdatedMessage(event.data);
    };
} catch(e) {}
window.addEventListener('focus', () => {
    if(Date.now() - lastConfigRefreshAt > 1200) refreshSmartConfigFromSettings();
});

async function deleteLocalAssetFromPanel(itemId){
 const item = (S().activeAssetCategory()?.items || []).find(x => x.id === itemId)
 || (S().localAssetLibrary.items || []).find(x => x.id === itemId || x.file === itemId);
 if(!item) return;
 try {
 const data = await fetch('/api/local-assets/delete', {
 method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({names:[item.file || item.id]})
 }).then(async r => {
 if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '删除失败');
 return r.json();
 });
 const localData = await fetch('/api/local-assets').then(r => r.ok ? r.json() : {items:[], tree:null});
 S().setLocalAssetLibraryFromResponse(localData);
 S().renderAssetLibrary();
 S().toast(data.deleted?.length ? '已删除本地素材' : '未找到要删除的本地素材');
 } catch(err){
 S().toast(err.message || '删除失败');
 }
}

function localAssetFolderCategories(){
 const result = [];
 const walk = node => {
 if(!node) return;
 const isRoot = (node.id || node.path || '__root__') === '__root__';
 result.push({
 id: node.id || (node.path ? node.path : '__root__'),
 name: node.name || (node.path ? node.path.split('/').pop() : '全部上传'),
 type: 'image',
 items: (isRoot ? (S().localAssetLibrary.items || []) : (node.items || [])).filter(item => S().assetMediaKind(item) === 'image'),
 readonly: true,
 source: 'local',
 });
 (node.children || []).forEach(walk);
 };
 walk(S().localAssetLibrary.tree || {id:'__root__', name:'全部上传', items:S().localAssetLibrary.items || [], children:[]});
 return result;
}

function localAssetFolderPath(){
 const cat = S().activeAssetCategory();
 return cat && cat.id !== '__root__' ? (cat.id || '') : '';
}

async function addFilesToLocalAssetLibrary(files=[]){
 const supported = [...(files || [])].filter(S().isSupportedUploadFile);
 if(!supported.length) return [];
 const form = new FormData();
 form.append('folder', localAssetFolderPath());
 supported.forEach(file => form.append('files', file, file.name || 'media'));
 const data = await fetch('/api/local-assets/upload', {method:'POST', body:form}).then(async r => {
 if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || S().tr('smart.assetAddFail'));
 return r.json();
 });
 const localData = await fetch('/api/local-assets').then(r => r.ok ? r.json() : {items:[], tree:null});
 S().setLocalAssetLibraryFromResponse(localData);
 S().renderAssetLibrary();
 S().toast(`已保存 ${data.files?.length || 0} 个本地素材`);
 return data.files || [];
}

async function addLocalPathsToLocalAssetLibrary(paths=[]){
 const imported = await S().importSmartLocalImages(paths);
 return addUrlItemsToLocalAssetLibrary(imported.map(item => ({url:item.url, name:item.name || S().smartImageNameFromUrl(item.url)})));
}

async function addUrlItemsToLocalAssetLibrary(items=[]){
 const list = (items || []).filter(item => item?.url);
 if(!list.length) return [];
 const data = await fetch('/api/local-assets/import-urls', {
 method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({folder:localAssetFolderPath(), items:list.map(item => ({url:item.url, name:item.name || S().smartImageNameFromUrl(item.url)}))})
 }).then(async r => {
 if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || S().tr('smart.assetAddFail'));
 return r.json();
 });
 S().setLocalAssetLibraryFromResponse(data);
 S().renderAssetLibrary();
 S().toast(`已保存 ${data.count || 0} 个本地素材`);
 return data.files || [];
}

function readAssetInbox(){
 try {
 const data = JSON.parse(localStorage.getItem(SMART_CANVAS_ASSET_INBOX_KEY) || 'null');
 const items = Array.isArray(data?.items) ? data.items.filter(it => it && it.url) : [];
 if(!items.length) return null;
 if(data.ts && (Date.now() - Number(data.ts)) > 30 * 60 * 1000) return null; // 30 分钟内有效
 return items;
 } catch(e){ return null; }
}

function pasteAssetsFromInbox(){
 const items = readAssetInbox();
 if(!items) return false;
 const center = S().lastMouseWorld || S().viewportCenter();
 const cell = 260; // 网格间距（世界坐标）
 const cols = Math.max(1, Math.min(items.length, Math.ceil(Math.sqrt(items.length))));
 const rows = Math.ceil(items.length / cols);
 const startX = center.x - (cols - 1) * cell / 2;
 const startY = center.y - (rows - 1) * cell / 2;
 S().pushUndo();
 const created = [];
 items.forEach((it, i) => {
 const r = Math.floor(i / cols), c = i % cols;
 const p = {x: startX + c * cell, y: startY + r * cell};
 const node = S().createImageNodeAt(p, [assetNodeImageFromItem(it)], {skipUndo:true, select:false});
 if(node) created.push(node.id);
 });
 S().selectedId = created.length === 1 ? created[0] : '';
 S().selectedIds = created.length > 1 ? created : [];
 S().selectedImage = {nodeId:'', index:-1};
 S().lastNodePasteAt = Date.now();
 try { localStorage.removeItem(SMART_CANVAS_ASSET_INBOX_KEY); } catch(e){}
 S().render();
 S().scheduleSave();
 S().toast(`已粘贴 ${created.length} 个素材到画布`);
 return true;
}

function bindSmartPreviewImageFallbacks(root=document){
 root.querySelectorAll?.('img[data-preview-src][data-original-src]:not([data-preview-fallback-bound])').forEach(img => {
 img.dataset.previewFallbackBound = '1';
 img.addEventListener('error', () => {
 const original = img.dataset.originalSrc || '';
 if(img.dataset.previewKind === 'video'){
 const tpl = document.createElement('template');
 tpl.innerHTML = smartVideoFallbackHtml(original, img.dataset.videoFallbackAttrs || '');
 img.replaceWith(tpl.content.firstElementChild);
 return;
 }
 if(original && img.getAttribute('src') !== original) img.src = original;
 });
 });
}

function bindWorkflowAssetItemEvents(){
 S().assetGrid.querySelectorAll('[data-delete-workflow-asset]').forEach(btn => {
 btn.onclick = async e => {
 e.preventDefault();
 e.stopPropagation();
 const item = (S().activeWorkflowAssetCategory()?.items || []).find(x => x.id === btn.dataset.deleteWorkflowAsset);
 if(!item) return;
 btn.disabled = true;
 try {
 const data = await fetch(`/api/asset-library/items/${encodeURIComponent(item.id)}`, {method:'DELETE'}).then(r => r.json());
 S().setAssetLibraryFromResponse(data);
 } catch(err){
 btn.disabled = false;
 S().toast(err.message || S().tr('smart.assetAddFail'));
 }
 };
 });
}

    function activeAssetTabCategory(){
 return currentAssetTabIsWorkflow() ? activeWorkflowAssetCategory() : S().activeAssetCategory();
}
    function activeWorkflowAssetCategory(){
 const cats = S().workflowAssetCategories();
 if(!cats.length) return null;
 return cats.find(cat => cat.id === S().activeWorkflowAssetCategoryId) || cats[0];
}
    function assetLibraryIsLocal(){
 return S().activeAssetLibraryId === S().LOCAL_ASSET_LIBRARY_ID;
}
    function assetRegisteredUris(item){
 const regs = (item && item.registrations && typeof item.registrations === 'object') ? item.registrations : {};
 const out = {};
 Object.keys(regs).forEach(platform => {
 const reg = regs[platform];
 if(reg && reg.status === 'Active' && reg.asset_uri) out[platform] = reg.asset_uri;
 });
 return out;
}
    function assetSmartClassEntries(){
 const groups = new Map();
 S().assetCategories('image').forEach(cat => {
 (cat.items || []).forEach(item => {
 const flat = Array.isArray(item?.classification?.flat) ? item.classification.flat : [];
 flat.forEach(entry => {
 const key = assetSmartClassKey(entry);
 if(!key) return;
 const prev = groups.get(key) || {
 id:assetSmartClassOptionId(entry),
 dimension:String(entry.dimension || ''),
 label:String(entry.label || entry.dimension || '分类'),
 tag:String(entry.tag || ''),
 count:0
 };
 prev.count += 1;
 groups.set(key, prev);
 });
 });
 });
 return [...groups.values()].sort((a, b) => {
 if(a.label !== b.label) return a.label.localeCompare(b.label, 'zh-CN');
 return b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN');
 });
}
    function assetSmartClassKey(entry){
 if(!entry?.dimension || !entry?.tag) return '';
 return `${String(entry.dimension)}::${String(entry.tag)}`;
}
    function assetSmartClassOptionId(entry){
 const key = assetSmartClassKey(entry);
 return key ? `${S().ASSET_SMART_CATEGORY_PREFIX}${key}` : '';
}
    function currentAssetSourceLibraries(){
 return [
 ...assetLibraries(),
 {id:S().LOCAL_ASSET_LIBRARY_ID, name:'本地素材', categories:S().localAssetFolderCategories(), readonly:true, source:'local'}
 ];
}
    function currentAssetTabCategories(){
 return currentAssetTabIsWorkflow() ? workflowAssetCategories() : assetCategories(activeAssetMediaType());
}
    function currentAssetTabIsWorkflow(){
 return S().assetTab === 'workflow';
}
    function workflowAssetCategories(){
 return assetCategories('workflow');
}
    const api = Object.freeze({
        workflowAssetCategories,
        currentAssetTabIsWorkflow,
        currentAssetTabCategories,
        currentAssetSourceLibraries,
        assetSmartClassOptionId,
        assetSmartClassKey,
        assetSmartClassEntries,
        assetRegisteredUris,
        assetLibraryIsLocal,
        activeWorkflowAssetCategory,
        activeAssetTabCategory,
        registerDeps,
        activeAssetMediaType,
        assetCategories,
        assetCategoryById,
        assetChildCategories,
        assetCategoryAncestors,
        canvasAssetLibraryForCurrentCanvas,
        syncActiveCanvasAssetLibrary,
        normalizeActiveAssetCategory,
        ensureCanvasAssetLibrary,
        setAssetGridSize,
        renderAssetBreadcrumb,
        assetLibraryContainingCategory,
        mergeCreatedAssetCategory,
        bindAssetFolderEvents,
        createAssetFolderAt,
        renameAssetCategory,
        deleteAssetCategory,
        createAssetFolder,
        assetLibraries,
        activeAssetLibrary,
        activeAssetCategory,
        loadAssetLibrary,
        refreshAssetLibrarySoon,
        handleAssetLibraryUpdatedMessage,
        connectAssetLibrarySyncSocket,
        setAssetLibraryFromResponse,
        syncComposerAssetShortcuts,
        toggleAssetLibrary,
        assetCategoryForMention,
        assetMediaKind,
        assetThumbHtml,
        renderAssetGalleryGrid,
        renderAssetLibrary,
        openAssetNameDialog,
        positionAssetHoverPreview,
        showAssetHoverPreview,
        hideAssetHoverPreview,
        bindAssetItemEvents,
        addUrlToAssetLibrary,
        hasCanvasImageDrag,
        setAssetDragOver,
        handleAssetPanelDragOver,
        handleAssetPanelDrop,
        deleteLocalAssetFromPanel,
        readAssetInbox,
        pasteAssetsFromInbox,
        bindSmartPreviewImageFallbacks,
        bindWorkflowAssetItemEvents,
        assetNodeImageFromItem,
        renderSimpleAssetCategoryControls,
        applyAssetReference,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('assetLibrary', api);
    }
    global.SmartCanvasAssetLibrary = api;
})(window);
