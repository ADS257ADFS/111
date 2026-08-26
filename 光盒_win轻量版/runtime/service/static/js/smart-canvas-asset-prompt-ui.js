(function(global){
    'use strict';
    let deps = null;
    let openDetailId = '';
    let activeCategoryId = 'mine';
    let lastRenderSig = '';
    let promptEventsBound = false;
    let promptOutsideBound = false;
    function registerDeps(next){ deps = next; bindPromptEvents(); }
    function d(){ return deps; }
    function tr(key, fallback){ return d()?.tr?.(key) || fallback || key; }
    function escapeHtml(value){ return d()?.escapeHtml?.(value) ?? String(value ?? ''); }
    function promptRoot(){ return document.getElementById('assetPromptLibrary'); }
    function closeCategoryMenu(){
        const menu = document.getElementById('assetPromptCategoryMenu');
        const trigger = document.getElementById('assetPromptCategoryTrigger');
        if(menu) menu.hidden = true;
        trigger?.setAttribute('aria-expanded', 'false');
    }
    function editableLibraries(){
        return (d()?.getPromptLibraries?.() || []).filter(lib => lib.id !== 'system' && !lib.readonly);
    }
    function findPromptItem(id){
        const api = d();
        const activePromptLibraryId = api?.getActivePromptLibraryId?.() || '';
        const lib = editableLibraries().find(item => item.id === activePromptLibraryId) || editableLibraries()[0];
        const item = (lib?.items || []).find(p => p.id === id);
        return {lib, item};
    }
    function promptCategories(lib){
        const categories = (lib?.categories || [])
            .filter(item => item && item.id)
            .map(item => ({...item, id:String(item.id), name:String(item.name || '未命名分类')}));
        if(!categories.some(item => item.id === 'mine')){
            categories.unshift({id:'mine', name:'未分类', folder:false});
        }
        return categories;
    }
    function activeEditableLibrary(){
        const api = d();
        const activePromptLibraryId = api?.getActivePromptLibraryId?.() || '';
        return editableLibraries().find(item => item.id === activePromptLibraryId) || editableLibraries()[0] || null;
    }
    async function ensureEditableLibrary(){
        const api = d();
        let lib = editableLibraries()[0];
        if(lib) return lib;
        const data = await fetch('/api/prompt-libraries', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({name:'My prompts'})
        }).then(async r => {
            if(!r.ok) throw new Error(await r.text());
            return r.json();
        });
        api?.setPromptLibraries?.(data.library?.libraries || api.getPromptLibraries?.() || []);
        lib = editableLibraries()[0];
        if(lib?.id) api?.setActivePromptLibraryId?.(lib.id);
        return lib;
    }
    async function copyTextToClipboard(text){
        const value = String(text || '');
        if(navigator.clipboard?.writeText){
            await navigator.clipboard.writeText(value);
            return;
        }
        const el = document.createElement('textarea');
        el.value = value;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        el.remove();
    }
    function detailInnerHtml(item){
        const {lib} = findPromptItem(item.id);
        const categories = promptCategories(lib);
        return `
            <label class="asset-prompt-classify">
                <span><i data-lucide="folder-input"></i>归类到</span>
                <select data-prompt-category="${escapeHtml(item.id)}" aria-label="选择提示词分类">
                    ${categories.map(category => `<option value="${escapeHtml(category.id)}" ${category.id === (item.category || 'mine') ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}
                </select>
            </label>
            <textarea class="asset-prompt-detail-text" placeholder="提示词内容">${escapeHtml(item.positive || '')}</textarea>
            <div class="asset-prompt-detail-actions">
                <button class="asset-soft-btn" type="button" data-prompt-detail-copy><i data-lucide="copy"></i><span>复制</span></button>
                <button class="asset-soft-btn is-primary" type="button" data-prompt-detail-save><i data-lucide="save"></i><span>保存修改</span></button>
            </div>
        `;
    }
    function bindDetailPanel(row, id){
        const api = d();
        const panel = row?.querySelector?.('.asset-prompt-detail');
        if(!panel || panel.dataset.boundPromptDetail === id) return;
        panel.dataset.boundPromptDetail = id;
        const textInput = panel.querySelector('.asset-prompt-detail-text');
        panel.querySelector('[data-prompt-detail-copy]').onclick = async event => {
            event.stopPropagation();
            try {
                await copyTextToClipboard(textInput.value || '');
                api?.toast?.('提示词已复制');
            } catch(_) {
                api?.toast?.('复制失败');
            }
        };
        panel.querySelector('[data-prompt-detail-save]').onclick = async event => {
            event.stopPropagation();
            const {lib, item} = findPromptItem(id);
            if(!lib || !item) return;
            const text = (textInput.value || '').trim();
            const name = item.name || api?.defaultPromptPresetName?.(text);
            if(!text){ api?.toast?.('提示词不能为空'); return; }
            try {
                const data = await fetch(`/api/prompt-libraries/items/${encodeURIComponent(id)}`, {
                    method:'PATCH',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({library_id:lib.id, name, category:item.category || 'mine', positive:text, scene:item.scene || 'My prompt', negative:item.negative || ''})
                }).then(async r => {
                    if(!r.ok) throw new Error(await api?.smartResponseErrorMessage?.(r, '保存提示词失败'));
                    return r.json();
                });
                api?.setPromptLibraries?.(data.library?.libraries || api.getPromptLibraries?.() || []);
                openDetailId = '';
                lastRenderSig = '';
                render();
                api?.toast?.('提示词已保存');
            } catch(e) {
                api?.toast?.(e?.message || '保存提示词失败');
            }
        };
    }
    function syncExpandState(){
        const root = promptRoot();
        if(!root) return;
        const api = d();
        let needsIcons = false;
        root.querySelectorAll('.asset-prompt-item').forEach(row => {
            const id = row.dataset.promptId || '';
            const shouldOpen = Boolean(id && id === openDetailId);
            row.classList.toggle('is-open', shouldOpen);
            let detail = row.querySelector('.asset-prompt-detail');
            if(shouldOpen){
                if(!detail){
                    const {lib, item} = findPromptItem(id);
                    if(!lib || !item) return;
                    detail = document.createElement('div');
                    detail.className = 'asset-prompt-detail';
                    detail.innerHTML = detailInnerHtml(item);
                    row.appendChild(detail);
                    bindDetailPanel(row, id);
                    needsIcons = true;
                }
            } else if(detail){
                delete detail.dataset.boundPromptDetail;
                detail.remove();
            }
        });
        if(needsIcons) api?.refreshIcons?.();
    }
    function closeDetail(){
        openDetailId = '';
        syncExpandState();
    }
    function toggleDetail(id){
        if(!id) return;
        openDetailId = openDetailId === id ? '' : id;
        syncExpandState();
    }
    function openDetail(id){
        if(!id) return;
        openDetailId = id;
        syncExpandState();
    }
    function computeRenderSig(lib, items, libs, activeId){
        return JSON.stringify({
            activeId: activeId || '',
            activeCategoryId,
            libs: libs.map(item => `${item.id}|${item.name || ''}`),
            categories: promptCategories(lib).map(item => `${item.id}|${item.name || ''}|${item.sort_order || 0}`),
            items: items.map(item => `${item.id}|${item.name || ''}|${item.category || 'mine'}|${item.updated_at || 0}|${(item.positive || '').slice(0, 120)}`)
        });
    }
    function bindPromptEvents(){
        const root = promptRoot();
        if(!root || promptEventsBound) return;
        promptEventsBound = true;
        root.addEventListener('click', event => {
            const categoryTrigger = event.target?.closest?.('#assetPromptCategoryTrigger');
            if(categoryTrigger){
                event.preventDefault();
                event.stopPropagation();
                const menu = document.getElementById('assetPromptCategoryMenu');
                const open = menu?.hidden !== false;
                if(menu) menu.hidden = !open;
                categoryTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
                return;
            }
            const categoryRename = event.target?.closest?.('[data-rename-prompt-category]');
            if(categoryRename){
                event.preventDefault();
                event.stopPropagation();
                renameCategory(categoryRename.dataset.renamePromptCategory || '');
                return;
            }
            const categoryDelete = event.target?.closest?.('[data-delete-prompt-category]');
            if(categoryDelete){
                event.preventDefault();
                event.stopPropagation();
                deleteCategory(categoryDelete.dataset.deletePromptCategory || '');
                return;
            }
            const categoryChoice = event.target?.closest?.('[data-prompt-category-choice]');
            if(categoryChoice){
                event.preventDefault();
                event.stopPropagation();
                activeCategoryId = categoryChoice.dataset.promptCategoryChoice || 'mine';
                closeDetail();
                closeCategoryMenu();
                lastRenderSig = '';
                render();
                return;
            }
            const openBtn = event.target?.closest?.('[data-prompt-open]');
            if(openBtn){
                event.preventDefault();
                event.stopPropagation();
                toggleDetail(openBtn.dataset.promptOpen || '');
                return;
            }
            const renameBtn = event.target?.closest?.('[data-prompt-rename]');
            if(renameBtn){
                event.preventDefault();
                event.stopPropagation();
                renameTemplate(renameBtn.dataset.promptRename || '');
                return;
            }
            const applyBtn = event.target?.closest?.('[data-prompt-apply]');
            if(applyBtn){
                event.preventDefault();
                event.stopPropagation();
                applyTemplate(applyBtn.dataset.promptApply || '');
                return;
            }
            const addBtn = event.target?.closest?.('#assetPromptAdd');
            if(addBtn){
                event.preventDefault();
                event.stopPropagation();
                addTemplate();
                return;
            }
            const addCategoryBtn = event.target?.closest?.('#assetPromptAddCategory');
            if(addCategoryBtn){
                event.preventDefault();
                event.stopPropagation();
                createCategory();
                return;
            }
            const deleteBtn = event.target?.closest?.('[data-prompt-delete]');
            if(deleteBtn){
                event.preventDefault();
                event.stopPropagation();
                deleteTemplate(deleteBtn.dataset.promptDelete || '');
            }
        });
        root.addEventListener('change', async event => {
            const target = event.target;
            if(target?.matches?.('[data-prompt-category]')){
                await assignCategory(target.dataset.promptCategory || '', target.value || 'mine');
            }
        });
        if(!promptOutsideBound){
            promptOutsideBound = true;
            document.addEventListener('pointerdown', event => {
                const picker = document.getElementById('assetPromptCategoryFilter');
                if(picker?.contains(event.target)) return;
                closeCategoryMenu();
            });
            document.addEventListener('keydown', event => {
                if(event.key === 'Escape') closeCategoryMenu();
            });
        }
    }
    function eventHitsElement(event, element){
        if(!event || !element) return false;
        const rect = element.getBoundingClientRect();
        if(rect.width <= 0 || rect.height <= 0) return false;
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }
    async function createCategory(){
        const api = d();
        const lib = activeEditableLibrary();
        if(!lib){ api?.toast?.('提示词库不可用'); return; }
        const name = await api?.openAssetNameDialog?.({
            title:'新建分类',
            value:'',
            placeholder:'输入分类名称'
        });
        if(!name) return;
        try {
            const data = await fetch(`/api/prompt-libraries/${encodeURIComponent(lib.id)}/folders`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({name})
            }).then(async r => {
                if(!r.ok) throw new Error(await r.text());
                return r.json();
            });
            api?.setPromptLibraries?.(data.library?.libraries || api.getPromptLibraries?.() || []);
            activeCategoryId = data.folder?.id || 'all';
            closeDetail();
            lastRenderSig = '';
            render();
            api?.toast?.('分类已创建');
        } catch(e) {
            api?.toast?.('创建分类失败');
        }
    }
    async function renameCategory(categoryId){
        const api = d();
        const lib = activeEditableLibrary();
        const category = promptCategories(lib).find(item => item.id === categoryId);
        if(!lib || !category) return;
        closeCategoryMenu();
        const name = await api?.openAssetNameDialog?.({
            title:'重命名分类',
            value:category.name || '',
            placeholder:'输入分类名称'
        });
        if(!name || name === category.name) return;
        try {
            const data = await fetch(`/api/prompt-libraries/${encodeURIComponent(lib.id)}/folders/${encodeURIComponent(categoryId)}`, {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({name})
            }).then(async r => {
                if(!r.ok) throw new Error(await r.text());
                return r.json();
            });
            api?.setPromptLibraries?.(data.library?.libraries || api.getPromptLibraries?.() || []);
            lastRenderSig = '';
            render();
            api?.toast?.('分类已重命名');
        } catch(e) {
            api?.toast?.('重命名分类失败');
        }
    }
    async function deleteCategory(categoryId){
        const api = d();
        const lib = activeEditableLibrary();
        const category = promptCategories(lib).find(item => item.id === categoryId);
        if(!lib || !category) return;
        const count = (lib.items || []).filter(item => (item.category || 'mine') === categoryId).length;
        if(!global.confirm(`确定删除分类“${category.name || '未命名分类'}”及其中 ${count} 条提示词吗？\n\n此操作不可撤销。`)) return;
        try {
            const data = await fetch(`/api/prompt-libraries/${encodeURIComponent(lib.id)}/folders/${encodeURIComponent(categoryId)}`, {
                method:'DELETE'
            }).then(async r => {
                if(!r.ok) throw new Error(await r.text());
                return r.json();
            });
            const libraries = data.library?.libraries || api?.getPromptLibraries?.() || [];
            api?.setPromptLibraries?.(libraries);
            const nextLib = libraries.find(item => item.id === lib.id) || libraries[0] || null;
            const nextCategories = promptCategories(nextLib);
            activeCategoryId = nextCategories.find(item => item.id === 'mine')?.id || nextCategories[0]?.id || 'mine';
            openDetailId = '';
            lastRenderSig = '';
            render();
            api?.toast?.('分类及其中提示词已删除');
        } catch(e) {
            api?.toast?.('删除分类失败');
        }
    }
    async function assignCategory(id, category){
        const api = d();
        const {lib, item} = findPromptItem(id);
        if(!lib || !item) return;
        const nextCategory = category || 'mine';
        try {
            const data = await fetch(`/api/prompt-libraries/items/${encodeURIComponent(id)}`, {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    library_id:lib.id,
                    name:item.name,
                    category:nextCategory,
                    positive:item.positive,
                    scene:item.scene || 'My prompt',
                    negative:item.negative || ''
                })
            }).then(async r => {
                if(!r.ok) throw new Error(await r.text());
                return r.json();
            });
            api?.setPromptLibraries?.(data.library?.libraries || api.getPromptLibraries?.() || []);
            if(activeCategoryId !== nextCategory) openDetailId = '';
            lastRenderSig = '';
            render();
            api?.toast?.('提示词已归类');
        } catch(e) {
            lastRenderSig = '';
            render();
            api?.toast?.('归类失败');
        }
    }
    async function deleteTemplate(id){
        const api = d();
        if(!id || !global.confirm('删除这个提示词？')) return;
        try {
            const data = await fetch(`/api/prompt-libraries/items/${encodeURIComponent(id)}`, {
                method:'DELETE'
            }).then(async r => {
                if(!r.ok) throw new Error(await r.text());
                return r.json();
            });
            api?.setPromptLibraries?.(data.library?.libraries || api.getPromptLibraries?.() || []);
            if(openDetailId === id) openDetailId = '';
            lastRenderSig = '';
            render();
            api?.toast?.('提示词已删除');
        } catch(e) {
            api?.toast?.('删除提示词失败');
        }
    }
    function applyTemplate(id){
        const api = d();
        const {item} = findPromptItem(id);
        if(!item) return;
        api?.setPromptText?.(item.positive || '');
        api?.savePromptDraftForCurrent?.();
        api?.renderInputThumbsRow?.(api?.selectedNode?.());
        api?.scheduleSave?.();
        api?.toast?.('已应用提示词');
    }
    async function renameTemplate(id){
        const api = d();
        const {lib, item} = findPromptItem(id);
        if(!lib || !item) return;
        const name = await api?.openAssetNameDialog?.({
            title:'重命名提示词',
            value:item.name || '',
            placeholder:'输入提示词名称'
        });
        if(!name || name === item.name) return;
        try {
            const data = await fetch(`/api/prompt-libraries/items/${encodeURIComponent(id)}`, {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    library_id:lib.id,
                    name,
                    category:item.category || 'mine',
                    positive:item.positive || '',
                    scene:item.scene || 'My prompt',
                    negative:item.negative || ''
                })
            }).then(async r => {
                if(!r.ok) throw new Error(await api?.smartResponseErrorMessage?.(r, '重命名提示词失败'));
                return r.json();
            });
            api?.setPromptLibraries?.(data.library?.libraries || api.getPromptLibraries?.() || []);
            lastRenderSig = '';
            render();
            api?.toast?.('提示词已重命名');
        } catch(e) {
            api?.toast?.(e?.message || '重命名提示词失败');
        }
    }
    async function addTemplate(){
        const api = d();
        try {
            const lib = await ensureEditableLibrary();
            if(!lib){ api?.toast?.('Prompt library unavailable'); return; }
            const value = await api?.openAssetNameDialog?.({title:'Add prompt', value:api?.promptPlainText?.(), placeholder:'Enter prompt text', multiline:true});
            if(!value) return;
            const name = await api?.openAssetNameDialog?.({title:'Prompt name', value:api?.defaultPromptPresetName?.(value), placeholder:'Prompt name'});
            if(!name) return;
            const categories = promptCategories(lib);
            const category = categories.some(item => item.id === activeCategoryId)
                ? activeCategoryId
                : 'mine';
            const data = await fetch('/api/prompt-libraries/items', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({library_id:lib.id, name, category, positive:value, scene:'My prompt'})
            }).then(async r => {
                if(!r.ok) throw new Error(await r.text());
                return r.json();
            });
            api?.setPromptLibraries?.(data.library?.libraries || api.getPromptLibraries?.() || []);
            api?.setActivePromptLibraryId?.(lib.id);
            lastRenderSig = '';
            render();
            api?.toast?.('提示词已保存');
        } catch(e) {
            api?.toast?.('保存提示词失败');
        }
    }
    function handleToolHit(event){
        if(d()?.getAssetTab?.() !== 'prompt') return false;
        const addPromptBtn = document.getElementById('assetPromptAdd');
        const addCategoryBtn = document.getElementById('assetPromptAddCategory');
        if(addPromptBtn && (event.target?.closest?.('#assetPromptAdd') || eventHitsElement(event, addPromptBtn))){
            event.preventDefault();
            event.stopPropagation();
            addTemplate();
            return true;
        }
        if(addCategoryBtn && (event.target?.closest?.('#assetPromptAddCategory') || eventHitsElement(event, addCategoryBtn))){
            event.preventDefault();
            event.stopPropagation();
            createCategory();
            return true;
        }
        return false;
    }
    function renderItemHtml(item){
        const isOpen = item.id === openDetailId;
        return `
            <div class="asset-prompt-item ${isOpen ? 'is-open' : ''}" data-prompt-id="${escapeHtml(item.id)}">
                <div class="asset-prompt-item-head">
                    <button class="asset-prompt-main" type="button" data-prompt-open="${escapeHtml(item.id)}">
                        <span>${escapeHtml(item.name || '未命名提示词')}</span>
                        <small>${escapeHtml(item.positive || item.scene || '')}</small>
                    </button>
                    <button class="asset-prompt-rename" type="button" data-prompt-rename="${escapeHtml(item.id)}" title="重命名提示词" aria-label="重命名提示词"><i data-lucide="pencil"></i></button>
                    <button class="asset-prompt-apply" type="button" data-prompt-apply="${escapeHtml(item.id)}" title="应用提示词" aria-label="应用提示词"><i data-lucide="corner-down-left"></i></button>
                    <button class="asset-prompt-delete" type="button" data-prompt-delete="${escapeHtml(item.id)}" title="删除提示词" aria-label="删除提示词"><i data-lucide="trash-2"></i></button>
                </div>
                ${isOpen ? `<div class="asset-prompt-detail">${detailInnerHtml(item)}</div>` : ''}
            </div>
        `;
    }
    function renderGroupedItems(items, categories){
        const visibleItems = items.filter(item => (item.category || 'mine') === activeCategoryId);
        if(!visibleItems.length){
            return '<div class="asset-empty">当前分类还没有提示词</div>';
        }
        return visibleItems.map(renderItemHtml).join('');
    }
    function render(){
        bindPromptEvents();
        const api = d();
        const assetPromptLibrary = promptRoot();
        if(!assetPromptLibrary) return;
        const promptLibraries = api?.getPromptLibraries?.() || [];
        let activePromptLibraryId = api?.getActivePromptLibraryId?.() || '';
        const libs = editableLibraries();
        const lib = libs.find(item => item.id === activePromptLibraryId) || libs[0] || promptLibraries.find(item => item.id !== 'system') || null;
        if(lib?.id){
            activePromptLibraryId = lib.id;
            api?.setActivePromptLibraryId?.(lib.id);
        }
        const items = (lib?.items || []).slice().sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
        const categories = promptCategories(lib);
        if(!categories.some(category => category.id === activeCategoryId)){
            activeCategoryId = categories.find(category => category.id === 'mine')?.id || categories[0]?.id || 'mine';
        }
        const visibleItems = items.filter(item => (item.category || 'mine') === activeCategoryId);
        const sig = computeRenderSig(lib, items, libs, activePromptLibraryId);
        if(sig === lastRenderSig){
            syncExpandState();
            return;
        }
        lastRenderSig = sig;
        if(openDetailId && !visibleItems.some(item => item.id === openDetailId)) openDetailId = '';
        assetPromptLibrary.innerHTML = `
            <div class="asset-prompt-tools">
                <div id="assetPromptCategoryFilter" class="asset-category-picker asset-prompt-category-picker">
                    <button id="assetPromptCategoryTrigger" class="asset-category-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
                        <span>${escapeHtml((categories.find(category => category.id === activeCategoryId)?.name || '未命名分类'))}（${visibleItems.length}）</span><i data-lucide="chevron-down"></i>
                    </button>
                    <div id="assetPromptCategoryMenu" class="asset-category-menu" role="listbox" hidden>
                    ${categories.map(category => {
                        const count = items.filter(item => (item.category || 'mine') === category.id).length;
                        return `<div class="asset-category-option ${activeCategoryId === category.id ? 'is-active' : ''}" role="option" aria-selected="${activeCategoryId === category.id ? 'true' : 'false'}">
                            <button class="asset-category-choice" type="button" data-prompt-category-choice="${escapeHtml(category.id)}"><span>${escapeHtml(category.name)}</span><span class="asset-category-count">${count}</span></button>
                            <button class="asset-category-rename" type="button" data-rename-prompt-category="${escapeHtml(category.id)}" title="重命名分类" aria-label="重命名分类 ${escapeHtml(category.name)}"><i data-lucide="pencil"></i></button>
                            <button class="asset-category-delete" type="button" data-delete-prompt-category="${escapeHtml(category.id)}" title="删除分类" aria-label="删除分类 ${escapeHtml(category.name)}"><i data-lucide="trash-2"></i></button>
                        </div>`;
                    }).join('')}
                    </div>
                </div>
                <button id="assetPromptAddCategory" class="asset-prompt-category-add is-icon-only" type="button" title="新建分类" aria-label="新建分类"><i data-lucide="folder-plus"></i></button>
                <button id="assetPromptAdd" class="asset-prompt-add" type="button"><i data-lucide="bookmark-plus"></i><span>新增提示词</span></button>
            </div>
            <div class="asset-prompt-list">
                ${renderGroupedItems(items, categories)}
            </div>
        `;
        let addPromptBtn = document.getElementById('assetPromptAdd');
        const promptTools = assetPromptLibrary.querySelector('.asset-prompt-tools');
        if(!addPromptBtn && promptTools){
            addPromptBtn = document.createElement('button');
            addPromptBtn.id = 'assetPromptAdd';
            promptTools.appendChild(addPromptBtn);
        }
        if(addPromptBtn){
            addPromptBtn.className = 'asset-prompt-add';
            addPromptBtn.type = 'button';
            addPromptBtn.title = 'Add prompt';
            addPromptBtn.innerHTML = '<i data-lucide="plus"></i><span>新增提示词</span>';
        }
        if(openDetailId){
            const row = assetPromptLibrary.querySelector(`.asset-prompt-item[data-prompt-id="${CSS.escape(openDetailId)}"]`);
            if(row) bindDetailPanel(row, openDetailId);
        }
        api?.refreshIcons?.();
    }
    const api = Object.freeze({
        registerDeps,
        render,
        closeDetail,
        openDetail,
        toggleDetail,
        handleToolHit,
        editableLibraries,
        ensureEditableLibrary,
        addTemplate,
        applyTemplate,
        renameTemplate,
        createCategory,
        renameCategory,
        deleteCategory,
        assignCategory
    });
    global.SmartCanvasCore?.register?.('assetPromptUi', api);
    global.SmartCanvasAssetPromptUi = api;
})(window);
