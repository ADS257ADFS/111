(function(global){
    'use strict';
    let deps = null;
    let searchQuery = '';
    let selectedRootId = '';
    let expandedRootIds = new Set();
    let openGalleryCategoryId = '';
    let mountedGalleryCategoryId = '';
    let pinnedVisibleIds = new Set();
    let lastCategoriesSignature = '';
    let lastUiStateSignature = '';
    let galleryGridDirty = false;
    let iconsRefreshPending = false;
    let treeEventsBound = false;
    let bound = false;
    const LEGACY_PRESET_ROOT_NAMES = new Set(['场景', '道具', '风格', '音效', 'Others', 'Scenes', 'Props', 'Styles']);
    const PINNED_TOP_ROOT_ID = 'characters';
    const PINNED_TOP_ROOT_NAMES = new Set(['角色', '素材库', 'Characters']);
    function isPinnedTopRoot(cat){
        if(!cat?.id) return false;
        const name = String(cat?.name || '').trim();
        return String(cat.id) === PINNED_TOP_ROOT_ID || PINNED_TOP_ROOT_NAMES.has(name);
    }
    function displayRootFolderName(cat){
        if(isPinnedTopRoot(cat)) return tr('smart.assetPinnedLibraryFolder', '通用文件夹');
        return cat?.name || tr('smart.assetFolder');
    }
    function sortByOrder(a, b){
        const ao = Number(a?.sort_order || 0);
        const bo = Number(b?.sort_order || 0);
        if(ao !== bo) return ao - bo;
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
    }
    function sortRootFolders(roots){
        return roots.slice().sort((a, b) => {
            const aPinned = isPinnedTopRoot(a) ? 0 : 1;
            const bPinned = isPinnedTopRoot(b) ? 0 : 1;
            if(aPinned !== bPinned) return aPinned - bPinned;
            return sortByOrder(a, b);
        });
    }
    function registerDeps(next){ deps = next; }
    function d(){ return deps; }
    function tr(key, fallback){ return d()?.tr?.(key) || fallback || key; }
    function escapeHtml(value){ return d()?.escapeHtml?.(value) ?? String(value ?? ''); }
    function getViewMode(){ return openGalleryCategoryId ? 'gallery' : 'folders'; }
    function getOpenGalleryCategoryId(){ return openGalleryCategoryId; }
    function shouldRenderGalleryGrid(){
        if(!openGalleryCategoryId || mountedGalleryCategoryId !== openGalleryCategoryId) return false;
        if(!galleryGridDirty) return false;
        galleryGridDirty = false;
        return true;
    }
    function consumeIconsRefresh(){
        if(!iconsRefreshPending) return false;
        iconsRefreshPending = false;
        return true;
    }
    function applyGalleryViewMode(){
        const grid = document.getElementById('assetGrid');
        if(!grid) return;
        grid.classList.remove('view-list', 'size-s', 'size-l');
        grid.classList.add('view-card', 'size-m');
    }
    function notifyCategoriesChanged(){
        lastCategoriesSignature = '';
        galleryGridDirty = true;
    }
    function uiStateSignature(){
        return [
            openGalleryCategoryId,
            mountedGalleryCategoryId,
            selectedRootId,
            searchQuery,
            [...expandedRootIds].sort().join(',')
        ].join('|');
    }
    function resetToFolders(){
        openGalleryCategoryId = '';
        mountedGalleryCategoryId = '';
        unmountInlineGallery();
    }
    function categoryById(id){ return d()?.assetCategoryById?.(id) || null; }
    function isHiddenRootFolder(cat){
        const name = String(cat?.name || '').trim();
        return name === '全部' || name === 'Root' || name === tr('smart.assetRootFolder', '根目录');
    }
    function isLegacyPresetRoot(cat){
        const name = String(cat?.name || '').trim();
        if(!LEGACY_PRESET_ROOT_NAMES.has(name)) return false;
        if((cat?.items || []).length) return false;
        return !childFolders(cat.id).length;
    }
    function rootFolders(){
        const api = d();
        if(!api) return [];
        return (api.assetChildCategories?.('') || []).filter(cat => cat?.id && !isHiddenRootFolder(cat) && !isLegacyPresetRoot(cat));
    }
    function childFolders(parentId){
        return (d()?.assetChildCategories?.(parentId) || []).filter(cat => cat?.id).slice().sort(sortByOrder);
    }
    function hasDirectItems(cat){ return Boolean((cat?.items || []).length); }
    function shouldShowCategory(cat){
        if(!cat?.id) return false;
        if(isHiddenRootFolder(cat)) return false;
        if(isPinnedTopRoot(cat)) return true;
        if(isLegacyPresetRoot(cat)) return false;
        if(pinnedVisibleIds.has(cat.id)) return true;
        if(hasDirectItems(cat)) return true;
        return childFolders(cat.id).some(child => shouldShowCategory(child));
    }
    function listChildrenForRoot(parentId){
        return childFolders(parentId).filter(cat => !isHiddenRootFolder(cat) && !isLegacyPresetRoot(cat));
    }
    function displayChildFolders(parentId){
        return listChildrenForRoot(parentId).filter(cat => shouldShowCategory(cat) || pinnedVisibleIds.has(cat.id));
    }
    function visibleRootFolders(){
        return rootFolders().filter(cat => shouldShowCategory(cat));
    }
    function categoriesSignature(){
        return (d()?.assetCategories?.('image') || [])
            .map(cat => `${cat.id}|${cat.parent_id || ''}|${cat.sort_order || 0}|${(cat.items || []).length}|${cat.name || ''}`)
            .sort()
            .join(';');
    }
    function folderMatchesSearch(cat, children){
        const q = searchQuery.trim().toLowerCase();
        if(!q) return true;
        const labels = [String(cat?.name || '').toLowerCase(), displayRootFolderName(cat).toLowerCase()];
        if(isPinnedTopRoot(cat)) labels.push('角色', 'characters', '通用文件夹', '素材库');
        if(labels.some(label => label.includes(q))) return true;
        return (children || []).some(child => String(child?.name || '').toLowerCase().includes(q));
    }
    function isRootExpanded(rootId, children){
        if(!children.length) return false;
        return expandedRootIds.has(rootId) || Boolean(searchQuery.trim());
    }
    function preserveGalleryShell(){
        const shell = document.getElementById('assetInlineGalleryShell');
        const host = document.getElementById('assetInlineGalleryHost');
        if(shell && host && shell.parentElement !== host) host.appendChild(shell);
    }
    function unmountInlineGallery(){
        const shell = document.getElementById('assetInlineGalleryShell');
        const host = document.getElementById('assetInlineGalleryHost');
        const browser = document.getElementById('assetFolderBrowser');
        if(shell){
            shell.setAttribute('hidden', '');
            shell.classList.remove('is-open');
            if(host && shell.parentElement !== host) host.appendChild(shell);
        }
        if(host){
            host.hidden = true;
            host.setAttribute('aria-hidden', 'true');
        }
        browser?.classList.remove('is-gallery-view');
        mountedGalleryCategoryId = '';
    }
    function mountInlineGallery(categoryId){
        const api = d();
        const shell = document.getElementById('assetInlineGalleryShell');
        const host = document.getElementById('assetInlineGalleryHost');
        const browser = document.getElementById('assetFolderBrowser');
        if(!shell || !host || !categoryId) return false;
        preserveGalleryShell();
        host.hidden = false;
        host.setAttribute('aria-hidden', 'false');
        host.appendChild(shell);
        shell.removeAttribute('hidden');
        shell.classList.add('is-open');
        browser?.classList.add('is-gallery-view');
        mountedGalleryCategoryId = categoryId;
        api?.setActiveAssetCategoryId?.(categoryId);
        return true;
    }
    function galleryShellMountedInSlot(categoryId){
        const shell = document.getElementById('assetInlineGalleryShell');
        const host = document.getElementById('assetInlineGalleryHost');
        return Boolean(shell && host && host.contains(shell) && !host.hidden && !shell.hasAttribute('hidden') && mountedGalleryCategoryId === categoryId);
    }
    function updateFolderTreeClasses(){
        const tree = document.getElementById('assetFolderTree');
        if(!tree) return;
        tree.querySelectorAll('.asset-folder-root-block').forEach(block => {
            const rootId = block.dataset.rootId || '';
            const children = listChildrenForRoot(rootId);
            const hasChildren = block.dataset.hasChildren === '1';
            const expanded = hasChildren && isRootExpanded(rootId, children);
            block.classList.toggle('is-expanded', expanded);
            block.querySelector('.asset-folder-child-list')?.classList.toggle('is-collapsed', !expanded);
            const row = block.querySelector('.asset-folder-root-row');
            row?.classList.toggle('is-selected', selectedRootId === rootId);
        });
        tree.querySelectorAll('.asset-folder-child-row').forEach(row => {
            const id = row.dataset.toggleGallery || '';
            row.classList.toggle('is-open', openGalleryCategoryId === id);
        });
        const deleteBtn = document.getElementById('assetRootFolderDeleteBtn');
        if(deleteBtn) deleteBtn.disabled = !selectedRootId;
    }
    function applyGalleryPanel(){
        if(openGalleryCategoryId){
            const needsMount = mountedGalleryCategoryId !== openGalleryCategoryId || !galleryShellMountedInSlot(openGalleryCategoryId);
            if(needsMount){
                if(!mountInlineGallery(openGalleryCategoryId)){
                    openGalleryCategoryId = '';
                    unmountInlineGallery();
                    return;
                }
                galleryGridDirty = true;
            }
            if(galleryGridDirty){
                d()?.renderAssetGalleryGrid?.();
                galleryGridDirty = false;
            }
            updateGalleryViewbar();
            applyGalleryViewMode();
            return;
        }
        updateGalleryViewbar();
        if(mountedGalleryCategoryId) unmountInlineGallery();
    }
    function syncFolderTreeState(){
        updateFolderTreeClasses();
        applyGalleryPanel();
    }
    function closeInlineGallery(){
        openGalleryCategoryId = '';
        unmountInlineGallery();
        const grid = document.getElementById('assetGrid');
        if(grid) grid.innerHTML = '';
        updateFolderTreeClasses();
    }
    function openInlineGallery(categoryId){
        if(!categoryId) return;
        const cat = categoryById(categoryId);
        const parentId = String(cat?.parent_id || '').trim();
        if(parentId){
            expandedRootIds.add(parentId);
            selectedRootId = parentId;
        } else {
            selectedRootId = categoryId;
        }
        pinnedVisibleIds.add(categoryId);
        openGalleryCategoryId = categoryId;
        galleryGridDirty = true;
        renderFolderTree();
    }
    function toggleInlineGallery(categoryId){
        if(!categoryId) return;
        if(openGalleryCategoryId === categoryId && galleryShellMountedInSlot(categoryId)) return;
        openInlineGallery(categoryId);
    }
    function toggleRootExpanded(rootId){
        if(!rootId) return;
        if(expandedRootIds.has(rootId)) expandedRootIds.delete(rootId);
        else expandedRootIds.add(rootId);
        lastUiStateSignature = uiStateSignature();
        syncFolderTreeState();
    }
    async function reorderFolders(parentId, orderedIds){
        const api = d();
        if(!api || !orderedIds?.length) return false;
        const libraryId = api.getActiveAssetLibraryId?.() || '';
        if(!libraryId) return false;
        try {
            const data = await fetch('/api/asset-library/categories/reorder', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({library_id: libraryId, parent_id: String(parentId || ''), ordered_ids: orderedIds})
            }).then(async r => {
                if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '排序失败');
                return r.json();
            });
            api.setAssetLibraryFromResponse?.(data, {render:false});
            notifyCategoriesChanged();
            renderFolderTree();
            return true;
        } catch(err) {
            api.toast?.(err?.message || '文件夹排序失败');
            return false;
        }
    }
    async function ensureLibraryReady(){
        const api = d();
        if(!api) return false;
        if(api.getCanvasId?.()){ await api.ensureCanvasAssetLibrary?.(); api.syncActiveCanvasAssetLibrary?.(); }
        if(!api.getActiveAssetLibraryId?.()){
            const lib = api.canvasAssetLibraryForCurrentCanvas?.() || api.assetLibraries?.()?.[0];
            if(lib?.id) api.setActiveAssetLibraryId?.(lib.id);
        }
        return Boolean(api.getActiveAssetLibraryId?.() || api.assetLibraries?.()?.length);
    }
    async function createFolder(parentId){
        const api = d();
        if(!api) return false;
        if(!(await ensureLibraryReady())){ api.toast?.(tr('smart.assetStoryLibraryMissing')); return false; }
        const name = await api.openAssetNameDialog?.({ title: tr('smart.assetNewFolder'), value: tr('smart.assetFolder'), placeholder: tr('smart.assetFolder') });
        if(!name) return false;
        const newId = await api.createAssetFolderAt?.(parentId || '', name);
        if(!newId) return false;
        pinnedVisibleIds.add(newId);
        notifyCategoriesChanged();
        if(parentId){
            expandedRootIds.add(parentId);
            openGalleryCategoryId = newId;
            galleryGridDirty = true;
        } else {
            selectedRootId = newId;
        }
        renderFolderTree();
        api.renderAssetLibrary?.();
        api.toast?.(tr('smart.assetFolderCreated'));
        return true;
    }
    async function renameFolder(categoryId, currentName){
        const api = d();
        if(!api || !categoryId) return;
        const name = await api.openAssetNameDialog?.({ title: tr('smart.assetRenameFolder'), value: currentName || '', placeholder: tr('smart.assetFolder') });
        if(!name) return;
        await api.renameAssetCategory?.(categoryId, name);
        notifyCategoriesChanged();
        api.renderAssetLibrary?.();
        renderFolderTree();
    }
    async function deleteFolder(categoryId){
        const api = d();
        if(!api || !categoryId) return;
        const cat = api.assetCategoryById?.(categoryId);
        if((cat?.items || []).length){ api.toast?.(tr('smart.assetDeleteChildrenFirst')); return; }
        if(childFolders(categoryId).length){ api.toast?.(tr('smart.assetDeleteChildrenFirst')); return; }
        if(!confirm(tr('smart.assetDeleteFolderConfirm'))) return;
        const ok = await api.deleteAssetCategory?.(categoryId);
        if(!ok) return;
        pinnedVisibleIds.delete(categoryId);
        if(selectedRootId === categoryId) selectedRootId = '';
        expandedRootIds.delete(categoryId);
        if(openGalleryCategoryId === categoryId) openGalleryCategoryId = '';
        if(mountedGalleryCategoryId === categoryId) mountedGalleryCategoryId = '';
        notifyCategoriesChanged();
        api.renderAssetLibrary?.();
        renderFolderTree();
    }
    function openGallery(categoryId){
        const api = d();
        if(!api || !categoryId) return;
        pinnedVisibleIds.add(categoryId);
        openGalleryCategoryId = categoryId;
        galleryGridDirty = true;
        const cat = categoryById(categoryId);
        const parentId = String(cat?.parent_id || '').trim();
        if(parentId) expandedRootIds.add(parentId);
        else selectedRootId = categoryId;
        api.setActiveAssetCategoryId?.(categoryId);
        notifyCategoriesChanged();
        renderFolderTree();
        api.renderAssetLibrary?.();
    }
    function backToFolders(){
        const openCat = categoryById(openGalleryCategoryId);
        const parentId = String(openCat?.parent_id || '').trim();
        closeInlineGallery();
        selectedRootId = parentId || '';
        lastUiStateSignature = uiStateSignature();
        renderFolderTree();
        d()?.renderAssetLibrary?.();
    }
    function folderCountLabel(cat){
        const childCount = childFolders(cat?.id || '').length;
        const itemCount = (cat?.items || []).length;
        if(childCount && itemCount) return `${childCount} ${tr('smart.assetFolder', 'folders')} · ${itemCount} ${tr('smart.assetImages', 'images')}`;
        if(childCount) return `${childCount} ${tr('smart.assetFolder', 'folders')}`;
        return `${itemCount} ${tr('smart.assetImages', 'images')}`;
    }
    function renderChildBlock(child, parentId){
        const actions = `<div class="asset-folder-row-actions"><button type="button" class="asset-folder-action-icon-btn" data-child-action="rename" data-category-id="${escapeHtml(child.id)}" title="${escapeHtml(tr('smart.assetRenameFolder'))}" aria-label="${escapeHtml(tr('smart.assetRenameFolder'))}"><i data-lucide="pencil"></i></button><button type="button" class="asset-folder-action-icon-btn danger" data-child-action="delete" data-category-id="${escapeHtml(child.id)}" title="${escapeHtml(tr('common.delete'))}" aria-label="${escapeHtml(tr('common.delete'))}"><i data-lucide="trash-2"></i></button></div>`;
        return `<article class="asset-folder-card asset-folder-child-block" data-child-block="${escapeHtml(child.id)}" data-folder-drag="${escapeHtml(child.id)}" data-drag-parent="${escapeHtml(parentId)}" draggable="true"><button type="button" class="asset-folder-card-open asset-folder-child-row" data-toggle-gallery="${escapeHtml(child.id)}" title="${escapeHtml(child.name || '')}"><span class="asset-folder-card-icon"><i data-lucide="folder"></i></span><span class="asset-folder-card-copy"><span class="asset-folder-card-name">${escapeHtml(child.name || tr('smart.assetFolder'))}</span></span></button>${actions}</article>`;
    }
    function renderRootBlock(root){
        const children = listChildrenForRoot(root.id).filter(child => {
            const q = searchQuery.trim().toLowerCase();
            return !q || String(child.name || '').toLowerCase().includes(q) || String(root.name || '').toLowerCase().includes(q);
        });
        const hasChildren = children.length > 0;
        const rootActions = `<div class="asset-folder-row-actions"><button type="button" class="asset-folder-action-icon-btn" data-root-action="new-child" data-category-id="${escapeHtml(root.id)}" title="${escapeHtml(tr('smart.assetNewFolder'))}" aria-label="${escapeHtml(tr('smart.assetNewFolder'))}"><i data-lucide="folder-plus"></i></button><button type="button" class="asset-folder-action-icon-btn" data-root-action="rename" data-category-id="${escapeHtml(root.id)}" title="${escapeHtml(tr('smart.assetRenameFolder'))}" aria-label="${escapeHtml(tr('smart.assetRenameFolder'))}"><i data-lucide="pencil"></i></button><button type="button" class="asset-folder-action-icon-btn danger" data-root-action="delete" data-category-id="${escapeHtml(root.id)}" title="${escapeHtml(tr('common.delete'))}" aria-label="${escapeHtml(tr('common.delete'))}"><i data-lucide="trash-2"></i></button></div>`;
        const childList = hasChildren
            ? `<div class="asset-folder-child-list${isRootExpanded(root.id, children) ? '' : ' is-collapsed'}">${children.map(child => renderChildBlock(child, root.id)).join('')}</div>`
            : '';
        return `<article class="asset-folder-card asset-folder-root-block${hasChildren ? ' has-children' : ''}" data-root-id="${escapeHtml(root.id)}" data-has-children="${hasChildren ? '1' : '0'}" data-folder-drag="${escapeHtml(root.id)}" data-drag-parent="" draggable="true"><button type="button" class="asset-folder-card-open asset-folder-root-row" data-root-select="${escapeHtml(root.id)}" data-root-has-gallery="1"><span class="asset-folder-card-icon"><i data-lucide="folder"></i></span><span class="asset-folder-card-copy"><span class="asset-folder-card-name">${escapeHtml(displayRootFolderName(root))}</span></span>${hasChildren ? `<i data-lucide="chevron-down" class="asset-folder-card-chevron"></i>` : ''}</button>${rootActions}${childList}</article>`;
    }

    function renderFolderViewbar(){
        if(openGalleryCategoryId){
            const cat = categoryById(openGalleryCategoryId);
            const parentId = String(cat?.parent_id || '').trim();
            const parent = parentId ? categoryById(parentId) : null;
            return `<button type="button" class="asset-folder-back-btn" data-folder-parent="${escapeHtml(parentId)}" ${parentId ? '' : 'disabled'} aria-label="${escapeHtml(tr('common.back', 'Back'))}"><i data-lucide="arrow-left"></i></button><div class="asset-folder-breadcrumb"><button type="button" data-folder-home>${escapeHtml(tr('smart.assetImages', 'Image assets'))}</button><i data-lucide="chevron-right"></i>${parent ? `<button type="button" data-folder-open="${escapeHtml(parent.id)}">${escapeHtml(displayRootFolderName(parent))}</button><i data-lucide="chevron-right"></i>` : ''}<span class="asset-folder-breadcrumb-current">${escapeHtml(cat?.name || tr('smart.assetFolder'))}</span></div>`;
        }
        return '';
    }
    function updateGalleryViewbar(){
        const host = document.getElementById('assetGalleryBreadcrumb');
        if(!host) return;
        host.innerHTML = renderFolderViewbar();
        host.hidden = !openGalleryCategoryId;
        iconsRefreshPending = true;
    }
    function bindFolderDragEvents(tree){
        if(!tree || tree.dataset.folderDragBound === '1') return;
        tree.dataset.folderDragBound = '1';
        let dragId = '';
        let dragParentId = '';
        tree.addEventListener('dragstart', e => {
            if(e.target.closest('.asset-inline-gallery,.asset-item,.asset-inline-grid,.asset-inline-drop-zone')) return;
            const row = e.target.closest('[data-folder-drag]');
            if(!row || e.target.closest('.asset-folder-row-actions,[data-root-action],[data-child-action],[data-root-toggle]')) {
                e.preventDefault();
                return;
            }
            dragId = row.dataset.folderDrag || '';
            dragParentId = row.dataset.dragParent || '';
            row.classList.add('is-dragging');
            if(e.dataTransfer){
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', dragId);
            }
        });
        tree.addEventListener('dragend', () => {
            dragId = '';
            dragParentId = '';
            tree.querySelectorAll('.is-dragging,.is-drag-over').forEach(el => el.classList.remove('is-dragging', 'is-drag-over'));
        });
        tree.addEventListener('dragover', e => {
            const row = e.target.closest('[data-folder-drag]');
            if(!row || !dragId || row.dataset.folderDrag === dragId) return;
            if((row.dataset.dragParent || '') !== dragParentId) return;
            e.preventDefault();
            tree.querySelectorAll('[data-folder-drag].is-drag-over').forEach(el => {
                if(el !== row) el.classList.remove('is-drag-over');
            });
            row.classList.add('is-drag-over');
        });
        tree.addEventListener('dragleave', e => {
            const row = e.target.closest('[data-folder-drag]');
            if(row) row.classList.remove('is-drag-over');
        });
        tree.addEventListener('drop', async e => {
            const row = e.target.closest('[data-folder-drag]');
            if(!row || !dragId || row.dataset.folderDrag === dragId) return;
            if((row.dataset.dragParent || '') !== dragParentId) return;
            e.preventDefault();
            row.classList.remove('is-drag-over');
            const parentId = dragParentId;
            const siblings = parentId
                ? listChildrenForRoot(parentId).map(item => item.id)
                : sortRootFolders(visibleRootFolders()).map(item => item.id);
            const fromIndex = siblings.indexOf(dragId);
            const toIndex = siblings.indexOf(row.dataset.folderDrag || '');
            if(fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
            const next = siblings.slice();
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            await reorderFolders(parentId, next);
        });
    }
    function bindFolderTreeEvents(){
        const tree = document.getElementById('assetFolderTree');
        if(!tree || treeEventsBound) return;
        treeEventsBound = true;
        tree.addEventListener('click', async e => {
            const toggleBtn = e.target.closest('[data-root-toggle]');
            if(toggleBtn){
                e.preventDefault(); e.stopPropagation();
                toggleRootExpanded(toggleBtn.dataset.rootToggle || '');
                return;
            }
            const menuAction = e.target.closest('[data-root-action]');
            if(menuAction){
                e.preventDefault(); e.stopPropagation();
                const action = menuAction.dataset.rootAction || '';
                const categoryId = menuAction.dataset.categoryId || '';
                const root = categoryById(categoryId);
                if(action === 'new-child') await createFolder(categoryId);
                else if(action === 'rename') await renameFolder(categoryId, root?.name || '');
                else if(action === 'delete') await deleteFolder(categoryId);
                return;
            }
            const childMenuAction = e.target.closest('[data-child-action]');
            if(childMenuAction){
                e.preventDefault(); e.stopPropagation();
                const action = childMenuAction.dataset.childAction || '';
                const categoryId = childMenuAction.dataset.categoryId || '';
                const child = categoryById(categoryId);
                if(action === 'rename') await renameFolder(categoryId, child?.name || '');
                else if(action === 'delete') await deleteFolder(categoryId);
                return;
            }
            const galleryRow = e.target.closest('[data-toggle-gallery]');
            if(galleryRow){
                if(e.target.closest('.asset-folder-row-actions,[data-child-action]')) return;
                e.preventDefault(); e.stopPropagation();
                toggleInlineGallery(galleryRow.dataset.toggleGallery || '');
                return;
            }
            const row = e.target.closest('[data-root-select]');
            if(!row || e.target.closest('.asset-folder-row-actions,[data-root-action]')) return;
            const id = row.dataset.rootSelect || '';
            selectedRootId = id;
            const children = listChildrenForRoot(id);
            if(children.length) expandedRootIds.add(id);
            const root = categoryById(id);
            const previewId = hasDirectItems(root) ? id : (children.find(hasDirectItems)?.id || children[0]?.id || id);
            openInlineGallery(previewId);
        });
        tree.addEventListener('click', e => {
            const back = e.target.closest('[data-folder-back]');
            if(!back) return;
            e.preventDefault();
            if(openGalleryCategoryId) backToFolders();
            else {
                selectedRootId = '';
                renderFolderTree();
            }
        });
    }
    function renderFolderTree(){
        const tree = document.getElementById('assetFolderTree');
        if(!tree) return;
        preserveGalleryShell();
        const roots = sortRootFolders(visibleRootFolders());
        const visibleRoots = roots.filter(root => folderMatchesSearch(root, displayChildFolders(root.id)));
        const cards = visibleRoots.map(root => renderRootBlock(root));
        if(!cards.length){
            tree.innerHTML = `<div class="asset-folder-tree-empty">${escapeHtml(tr('smart.assetFolderTreeEmpty'))}</div>`;
            closeInlineGallery();
            return;
        }
        if(openGalleryCategoryId && !visibleRoots.some(root => root.id === openGalleryCategoryId || listChildrenForRoot(root.id).some(child => child.id === openGalleryCategoryId))){
            const openCat = categoryById(openGalleryCategoryId);
            if(openCat && !shouldShowCategory(openCat) && !hasDirectItems(openCat)){
                openGalleryCategoryId = '';
                mountedGalleryCategoryId = '';
            }
        }
        if(!openGalleryCategoryId || !categoryById(openGalleryCategoryId)){
            const firstRoot = visibleRoots[0];
            const children = firstRoot ? displayChildFolders(firstRoot.id) : [];
            selectedRootId = firstRoot?.id || '';
            if(children.length) expandedRootIds.add(firstRoot.id);
            openGalleryCategoryId = firstRoot
                ? (hasDirectItems(firstRoot) ? firstRoot.id : (children.find(hasDirectItems)?.id || children[0]?.id || firstRoot.id))
                : '';
            galleryGridDirty = Boolean(openGalleryCategoryId);
        }
        tree.innerHTML = `<div class="asset-folder-card-grid">${cards.join('')}</div>`;
        bindFolderTreeEvents();
        bindFolderDragEvents(tree);
        iconsRefreshPending = true;
        lastUiStateSignature = uiStateSignature();
        syncFolderTreeState();
    }
    function bindOnce(){
        if(bound) return;
        bound = true;
        const search = document.getElementById('assetFolderSearch');
        search?.addEventListener('input', () => { searchQuery = search.value || ''; renderFolderTree(); });
        document.getElementById('assetRootFolderAddBtn')?.addEventListener('click', async e => { e.preventDefault(); await createFolder(''); });
        document.getElementById('assetRootFolderDeleteBtn')?.addEventListener('click', async e => { e.preventDefault(); if(!selectedRootId){ d()?.toast?.(tr('smart.assetSelectRootFirst')); return; } await deleteFolder(selectedRootId); });
        document.getElementById('assetGalleryBreadcrumb')?.addEventListener('click', event => {
            const home = event.target.closest('[data-folder-home]');
            if(home){
                event.preventDefault();
                closeInlineGallery();
                return;
            }
            const open = event.target.closest('[data-folder-open]');
            if(open){
                event.preventDefault();
                openInlineGallery(open.dataset.folderOpen || '');
                return;
            }
            const back = event.target.closest('[data-folder-parent]');
            if(back && !back.disabled){
                event.preventDefault();
                openInlineGallery(back.dataset.folderParent || '');
            }
        });
        applyGalleryViewMode();
    }
    function render(){
        bindOnce();
        const catSig = categoriesSignature();
        const uiSig = uiStateSignature();
        const tree = document.getElementById('assetFolderTree');
        const needRebuild = catSig !== lastCategoriesSignature || !tree?.querySelector('.asset-folder-root-block');
        if(needRebuild){
            lastCategoriesSignature = catSig;
            renderFolderTree();
            return;
        }
        if(uiSig === lastUiStateSignature && !galleryGridDirty) return;
        lastUiStateSignature = uiSig;
        syncFolderTreeState();
    }
    function onImageTabActivated(){
        searchQuery = '';
        selectedRootId = '';
        expandedRootIds.clear();
        openGalleryCategoryId = '';
        mountedGalleryCategoryId = '';
        galleryGridDirty = false;
        unmountInlineGallery();
        lastCategoriesSignature = '';
        lastUiStateSignature = '';
        const search = document.getElementById('assetFolderSearch');
        if(search) search.value = '';
    }
    const api = Object.freeze({
        registerDeps, render, resetToFolders, getViewMode, getOpenGalleryCategoryId,
        onImageTabActivated, backToFolders, openGallery, notifyCategoriesChanged,
        shouldRenderGalleryGrid, consumeIconsRefresh, applyGalleryViewMode
    });
    global.SmartCanvasCore?.register?.('assetLibraryUi', api);
    global.SmartCanvasAssetLibraryUi = api;
})(window);
