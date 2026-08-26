/**
 * Smart Canvas — prompt preset panel + prompt template library overlay.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || null;
    }

    function S(){
        const c = d();
        if(!c) throw new Error('[SmartCanvasPromptTemplates] deps not registered');
        return c;
    }

function loadPromptPresets(){
    try {
        const list = JSON.parse(localStorage.getItem(S().PROMPT_PRESETS_KEY) || '[]');
        S().promptPresets = Array.isArray(list) ? list.filter(p => p?.id && typeof p.text === 'string') : [];
    } catch(e) {
        S().promptPresets = [];
    }
}
function savePromptPresets(){
    localStorage.setItem(S().PROMPT_PRESETS_KEY, JSON.stringify(S().promptPresets));
}
function defaultPromptTemplateGroups(){
    return [
        {id:'view', name:S().tr('smart.tplCatView')},
        {id:'storyboard', name:S().tr('smart.tplCatStoryboard')},
        {id:'character', name:S().tr('smart.tplCatCharacter')},
        {id:'product', name:S().tr('smart.tplCatProduct')},
        {id:'lighting', name:S().tr('smart.tplCatLighting')},
        {id:'mine', name:S().tr('smart.tplCatMine')}
    ];
}
function loadPromptTemplateGroups(){
    try {
        const list = JSON.parse(localStorage.getItem(S().PROMPT_TEMPLATE_GROUPS_KEY) || '[]');
        const valid = Array.isArray(list) ? list.filter(g => g?.id && g?.name) : [];
        const defaults = defaultPromptTemplateGroups();
        S().promptTemplateGroups = defaults.map(group => valid.find(g => g.id === group.id) || group);
        valid.filter(g => !S().promptTemplateGroups.some(x => x.id === g.id)).forEach(g => S().promptTemplateGroups.push(g));
    } catch(e) {
        S().promptTemplateGroups = defaultPromptTemplateGroups();
    }
}
function savePromptTemplateGroups(){
    localStorage.setItem(S().PROMPT_TEMPLATE_GROUPS_KEY, JSON.stringify(S().promptTemplateGroups));
}
function loadPromptTemplateOverrides(){
    try {
        const data = JSON.parse(localStorage.getItem(S().PROMPT_TEMPLATE_OVERRIDES_KEY) || '{}');
        S().promptTemplateOverrides = {
            hiddenBuiltinIds:Array.isArray(data.hiddenBuiltinIds) ? data.hiddenBuiltinIds : [],
            editedBuiltins:data.editedBuiltins && typeof data.editedBuiltins === 'object' ? data.editedBuiltins : {}
        };
    } catch(e) {
        S().promptTemplateOverrides = {hiddenBuiltinIds:[], editedBuiltins:{}};
    }
}
function savePromptTemplateOverrides(){
    localStorage.setItem(S().PROMPT_TEMPLATE_OVERRIDES_KEY, JSON.stringify(S().promptTemplateOverrides));
}
async function loadPromptTemplates(){
    try {
        const data = await fetch('/api/prompt-libraries').then(r => r.ok ? r.json() : {library:{libraries:[]}});
        S().promptLibraries = Array.isArray(data.library?.libraries)
            ? data.library.libraries.filter(lib => lib?.id !== 'system' && !lib?.readonly)
            : [];
        S().builtinPromptTemplates = [];
        if(!S().promptLibraries.some(lib => lib.id === S().activePromptLibraryId)) S().activePromptLibraryId = S().promptLibraries[0]?.id || 'mine';
        renderPromptLibrarySelect();
    } catch(e) {
        S().builtinPromptTemplates = [];
        S().promptLibraries = [];
    }
}
function activePromptLibrary(){
    return S().promptLibraries.find(lib => lib.id === S().activePromptLibraryId) || S().promptLibraries[0] || {id:'mine', name:'我的提示词库', readonly:false, items:[]};
}
function renderPromptLibrarySelect(){
    if(!S().promptTemplateLibrarySelect) return;
    S().promptTemplateLibrarySelect.innerHTML = S().promptLibraries.map(lib => `<option value="${S().escapeAttr(lib.id)}" ${lib.id === S().activePromptLibraryId ? 'selected' : ''}>${S().escapeHtml(lib.name || '提示词库')}</option>`).join('');
}
function promptTemplateItems(){
    const activeLibrary = activePromptLibrary();
    if(activeLibrary.id !== 'system'){
        return (activeLibrary.items || []).filter(t => t?.id && t?.positive).map(t => ({
            ...t,
            sourceId:t.id,
            builtin:false,
            remote:true,
            libraryId:activeLibrary.id
        }));
    }
    const hidden = new Set(S().promptTemplateOverrides.hiddenBuiltinIds || []);
    const builtins = S().builtinPromptTemplates
        .filter(t => !hidden.has(t.id))
        .map(t => ({...t, ...(S().promptTemplateOverrides.editedBuiltins?.[t.id] || {}), builtin:true}));
    const mine = S().promptPresets.map(p => ({
        id:`mine:${p.id}`,
        sourceId:p.id,
        name:p.name || S().tr('smart.promptPresetUnnamed'),
        category:p.category || 'mine',
        scene:'My prompt preset',
        positive:p.text || '',
        negative:'',
        params:{},
        builtin:false
    }));
    return [...builtins, ...mine];
}
function promptTemplateText(template, mode='positive'){
    const positive = String(template?.positive || '').trim();
    if(mode === 'positive' || !template?.builtin) return positive;
    const negative = String(template?.negative || '').trim();
    const params = Object.entries(template?.params || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    return [positive, negative ? `Negative prompt:\n${negative}` : '', params ? `Params:\n${params}` : ''].filter(Boolean).join('\n\n');
}
function promptTemplateName(template){
    if(window.StudioI18n?.lang?.() === 'en' && template?.name_en) return template.name_en;
    return template?.name || '';
}
function promptTemplateScene(template){
    if(window.StudioI18n?.lang?.() === 'en' && template?.scene_en) return template.scene_en;
    return template?.scene || '';
}
function promptTemplateSearchText(template){
    return [
        template?.name,
        template?.name_en,
        template?.scene,
        template?.scene_en,
        template?.positive,
        template?.negative
    ].join(' ').toLowerCase();
}
function promptTemplateCategoryLabel(category){
    if(category === 'all') return S().tr('smart.tplAll');
    const builtin = {
        view:S().tr('smart.tplCatView'),
        storyboard:S().tr('smart.tplCatStoryboard'),
        character:S().tr('smart.tplCatCharacter'),
        product:S().tr('smart.tplCatProduct'),
        lighting:S().tr('smart.tplCatLighting'),
        mine:S().tr('smart.tplCatMine')
    };
    return builtin[category] || S().promptTemplateGroups.find(g => g.id === category)?.name || category;
}
function promptTemplateSelectedItem(){
    return promptTemplateItems().find(item => item.id === S().promptTemplateSelectedId) || promptTemplateItems()[0] || null;
}
function currentPromptPreset(id){
    return S().promptPresets.find(p => p.id === id) || null;
}
function defaultPromptPresetName(text){
    return (String(text || '').trim().split(/\r?\n/)[0] || S().tr('smart.promptPresetDefault')).slice(0, 28);
}
function promptPresetPanelNode(){
    return S().getNodes().find(n => n.id === S().promptPresetPanel?.dataset.nodeId) || null;
}
function setPromptPresetStatus(text='', tone=''){
    if(!S().promptPresetStatus) return;
    S().promptPresetStatus.textContent = text;
    S().promptPresetStatus.classList.toggle('warn', tone === 'warn');
    S().promptPresetStatus.classList.toggle('ok', tone === 'ok');
}
function resetPromptPresetDeleteState(){
    S().promptPresetDeleteArmed = false;
    if(S().promptPresetDelete){
        S().promptPresetDelete.textContent = S().tr('common.delete');
        S().promptPresetDelete.classList.remove('confirm-danger');
    }
}
function createPromptPresetFromNode(node, {openPanel=true, openTemplatePanel=false}={}){
    const text = String(node?.text || '').trim();
    if(!text){ S().toast(S().tr('smart.promptPresetEmpty')); return null; }
    const preset = {id:S().uid('preset'), name:defaultPromptPresetName(text), text, createdAt:Date.now(), updatedAt:Date.now()};
    S().promptPresets.unshift(preset);
    savePromptPresets();
    if(node) node.promptPresetId = preset.id;
    S().render();
    S().scheduleSave();
    if(openPanel) openPromptPresetPanel(node?.id || '', preset.id, {status:S().tr('smart.promptPresetSavedNew'), tone:'ok'});
    if(openTemplatePanel) {
        S().promptTemplateCategory = 'mine';
        S().promptTemplateSelectedId = `mine:${preset.id}`;
        S().promptTemplateEditing = true;
        openPromptTemplatePanel(node?.id || '', S().promptTemplateSelectedId);
    }
    return preset;
}
function createPromptPresetFromComposer(){
    const text = S().promptPlainText();
    if(!text){ S().toast(S().tr('smart.promptPresetEmpty')); return null; }
    const preset = {id:S().uid('preset'), name:defaultPromptPresetName(text), text, category:'mine', createdAt:Date.now(), updatedAt:Date.now()};
    S().promptPresets.unshift(preset);
    savePromptPresets();
    S().savePromptDraftForCurrent();
    S().scheduleSave();
    return preset;
}
function savePromptNodeAsPreset(node){
    createPromptPresetFromNode(node);
}
function renderPromptPresetPanel(selectedId='', message=''){
    if(!S().promptPresetSelect) return;
    resetPromptPresetDeleteState();
    S().promptPresetSelect.innerHTML = S().promptPresets.length
        ? S().promptPresets.map(p => `<option value="${S().escapeHtml(p.id)}" ${p.id === S().selectedId ? 'selected' : ''}>${S().escapeHtml(p.name || S().tr('smart.promptPresetUnnamed'))}</option>`).join('')
        : `<option value="">${S().escapeHtml(S().tr('smart.promptPresetNone'))}</option>`;
    const preset = currentPromptPreset(S().selectedId) || S().promptPresets[0] || null;
    if(preset && S().promptPresetSelect.value !== preset.id) S().promptPresetSelect.value = preset.id;
    S().promptPresetName.value = preset?.name || '';
    S().promptPresetText.value = preset?.text || '';
    const hasPreset = Boolean(preset);
    const nodeHasText = Boolean(String(promptPresetPanelNode()?.text || '').trim());
    S().promptPresetApply.disabled = !hasPreset;
    S().promptPresetDelete.disabled = !hasPreset;
    S().promptPresetSave.disabled = !hasPreset;
    if(S().promptPresetNew) S().promptPresetNew.disabled = !nodeHasText;
    setPromptPresetStatus(message || (hasPreset ? S().tr('smart.promptPresetPanelHint') : S().tr('smart.promptPresetPanelEmpty')));
}
function openPromptPresetPanel(nodeId='', presetId='', options={}){
    if(!S().promptPresetPanel) return;
    S().promptPresetPanel.dataset.nodeId = nodeId || '';
    const node = S().getNodes().find(n => n.id === nodeId);
    const preferred = presetId || node?.promptPresetId || S().promptPresets[0]?.id || '';
    renderPromptPresetPanel(preferred, options.status || '');
    if(options.tone) setPromptPresetStatus(options.status || '', options.tone);
    const nodeEl = nodeId ? S().world.querySelector(`.image-node[data-id="${CSS.escape(nodeId)}"]`) : null;
    const rect = nodeEl?.getBoundingClientRect();
    const shellRect = S().shell.getBoundingClientRect();
    const maxLeft = Math.max(18, shellRect.width - 410);
    const maxTop = Math.max(18, shellRect.height - 330);
    const left = rect ? Math.min(maxLeft, Math.max(18, rect.right - shellRect.left + 12)) : 80;
    const top = rect ? Math.min(maxTop, Math.max(18, rect.top - shellRect.top)) : 80;
    S().promptPresetPanel.style.left = `${left}px`;
    S().promptPresetPanel.style.top = `${top}px`;
    S().promptPresetPanel.classList.add('open');
    S().refreshIcons(S().promptPresetPanel);
}
function closePromptPresetPanel(){
    S().promptPresetPanel?.classList.remove('open');
    resetPromptPresetDeleteState();
}
function promptTemplateScrollSnapshot(){
    if(!S().promptTemplatePanel) return null;
    return {
        panelTop:S().promptTemplatePanel.scrollTop || 0,
        tabLeft:S().promptTemplatePanel.querySelector('.prompt-template-tabs')?.scrollLeft || 0,
        listTop:S().promptTemplatePanel.querySelector('.prompt-template-list')?.scrollTop || 0,
        detailTop:S().promptTemplatePanel.querySelector('.prompt-template-preview-content')?.scrollTop || 0
    };
}
function restorePromptTemplateScroll(snapshot){
    if(!snapshot || !S().promptTemplatePanel) return;
    requestAnimationFrame(() => {
        S().promptTemplatePanel.scrollTop = snapshot.panelTop || 0;
        const tabs = S().promptTemplatePanel.querySelector('.prompt-template-tabs');
        const list = S().promptTemplatePanel.querySelector('.prompt-template-list');
        const detail = S().promptTemplatePanel.querySelector('.prompt-template-preview-content');
        if(tabs) tabs.scrollLeft = snapshot.tabLeft || 0;
        if(list) list.scrollTop = snapshot.listTop || 0;
        if(detail) detail.scrollTop = snapshot.detailTop || 0;
    });
}
function renderPromptTemplatePanel(options={}){
    if(!S().promptTemplatePanel || !S().promptTemplateBody || !S().promptTemplateCats) return;
    renderPromptLibrarySelect();
    const scrollSnapshot = options.preserveScroll === false ? null : promptTemplateScrollSnapshot();
    const query = String(S().promptTemplateSearch?.value || '').trim().toLowerCase();
    const allTemplates = promptTemplateItems();
    const categories = [{id:'all', name:S().tr('smart.tplAll')}, ...promptTemplateGroups.map(group => ({...group, name:promptTemplateCategoryLabel(group.id)}))];
    const groupCounts = allTemplates.reduce((map, item) => {
        map[item.category || 'mine'] = (map[item.category || 'mine'] || 0) + 1;
        return map;
    }, {all:allTemplates.length});
    S().promptTemplateCats.innerHTML = S().promptTemplateGroupEditMode ? `
        <div class="prompt-template-group-panel">
            <div class="prompt-template-group-title">
                <div>
                    <strong>${S().escapeHtml(S().tr('smart.tplGroupManage'))}</strong>
                    <span>${S().escapeHtml(S().tr('smart.tplGroupHint'))}</span>
                </div>
                <div class="prompt-template-group-tools">
                    <button type="button" data-template-cat-new><i data-lucide="plus"></i><span>${S().escapeHtml(S().tr('smart.tplAdd'))}</span></button>
                    <button type="button" class="primary" data-template-group-edit><i data-lucide="check"></i><span>${S().escapeHtml(S().tr('smart.tplDone'))}</span></button>
                </div>
            </div>
            <div class="prompt-template-group-list">
                ${S().promptTemplateGroups.map(group => `
                    <div class="prompt-template-group-row ${['view','storyboard','character','product','lighting','mine'].includes(group.id) ? '' : 'has-delete'}">
                        <button type="button" class="group-name ${group.id === S().promptTemplateCategory ? 'active' : ''}" data-template-cat="${S().escapeHtml(group.id)}">
                            <span>${S().escapeHtml(promptTemplateCategoryLabel(group.id))}</span>
                            <small>${groupCounts[group.id] || 0}</small>
                        </button>
                        <button type="button" class="group-tool" data-template-cat-edit="${S().escapeHtml(group.id)}" title="${S().escapeAttr(S().tr('smart.tplRename'))}"><i data-lucide="pencil"></i></button>
                        ${['view','storyboard','character','product','lighting','mine'].includes(group.id) ? '' : `<button type="button" class="group-tool danger" data-template-cat-delete="${S().escapeHtml(group.id)}" title="${S().escapeAttr(S().tr('common.delete'))}"><i data-lucide="trash-2"></i></button>`}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : `
        <div class="prompt-template-nav">
            <div class="prompt-template-tabs">
                ${categories.map(cat => `
                    <button type="button" class="${cat.id === S().promptTemplateCategory ? 'active' : ''}" data-template-cat="${S().escapeHtml(cat.id)}">
                        <span>${S().escapeHtml(cat.name)}</span>
                        <small>${groupCounts[cat.id] || 0}</small>
                    </button>
                `).join('')}
            </div>
            <button type="button" class="prompt-template-manage-groups" data-template-group-edit><i data-lucide="settings-2"></i><span>${S().escapeHtml(S().tr('smart.tplManageGroups'))}</span></button>
        </div>
    `;
    const items = allTemplates.filter(item => {
        if(S().promptTemplateCategory !== 'all' && item.category !== S().promptTemplateCategory) return false;
        if(!query) return true;
        return promptTemplateSearchText(item).includes(query);
    });
    if(items.length && !items.some(item => item.id === S().promptTemplateSelectedId)) S().promptTemplateSelectedId = items[0].id;
    const selected = items.find(item => item.id === S().promptTemplateSelectedId) || items[0] || null;
    const selectedPreset = selected?.builtin || selected?.remote
        ? {id:selected.id, name:selected.name || '', text:selected.positive || '', category:selected.category || 'storyboard', builtin:Boolean(selected.builtin)}
        : (selected ? currentPromptPreset(selected.sourceId) : null);
    const target = S().promptTemplatePanel.dataset.target || 'node';
    const node = S().getNodes().find(n => n.id === S().promptTemplatePanel.dataset.nodeId);
    const activeLibrary = activePromptLibrary();
    const canEditCurrentLibrary = activeLibrary.id !== 'system' && !activeLibrary.readonly;
    const editMode = Boolean(S().promptTemplateEditing && selectedPreset);
    S().promptTemplateBody.innerHTML = `
        <div class="prompt-template-list">
            <div class="prompt-template-list-tools">
                <button type="button" data-template-save-current><i data-lucide="bookmark-plus"></i><span>${S().escapeHtml(S().tr('smart.tplSaveCurrent'))}</span></button>
                <button type="button" data-template-new><i data-lucide="file-plus-2"></i><span>${S().escapeHtml(S().tr('smart.tplNewTemplate'))}</span></button>
            </div>
            ${items.length ? items.map(item => `<button type="button" class="prompt-template-card ${item.id === selected?.id ? 'active' : ''}" data-template-id="${S().escapeHtml(item.id)}">
                <span class="prompt-template-card-top">
                    <span class="prompt-template-name">${S().escapeHtml(promptTemplateName(item))}</span>
                    <span class="prompt-template-source">${S().escapeHtml(item.builtin ? S().tr('smart.tplBuiltin') : S().tr('smart.tplMine'))}</span>
                </span>
                <span class="prompt-template-scene">${S().escapeHtml(promptTemplateScene(item) || item.positive || '')}</span>
                <span class="prompt-template-tag">${S().escapeHtml(promptTemplateCategoryLabel(item.category || 'mine'))}</span>
            </button>`).join('') : `<div class="prompt-template-list-empty">${S().escapeHtml(S().tr('smart.tplNoMatches'))}</div>`}
        </div>
        <div class="prompt-template-detail">
            ${selected ? `
                <div class="prompt-template-detail-head">
                    <div>
                        <strong>${S().escapeHtml(promptTemplateName(selected) || '')}</strong>
                        <span>${S().escapeHtml(promptTemplateCategoryLabel(selected.category || ''))} 路 ${S().escapeHtml(selected.builtin ? S().tr('smart.tplBuiltinTemplate') : S().tr('smart.tplMineTemplate'))}</span>
                    </div>
                    ${editMode ? '' : `
                        <div class="prompt-template-icon-actions">
                            <button type="button" ${selected?.builtin || !canEditCurrentLibrary ? 'disabled' : ''} data-template-edit title="${S().escapeAttr(S().tr('smart.tplEditTemplate'))}"><i data-lucide="pencil"></i><span>${S().escapeHtml(S().tr('common.edit'))}</span></button>
                            <button type="button" ${selected?.builtin || !canEditCurrentLibrary ? 'disabled' : ''} class="danger" data-template-delete title="${S().escapeAttr(S().tr('smart.tplDeleteTemplate'))}"><i data-lucide="trash-2"></i><span>${S().escapeHtml(S().tr('common.delete'))}</span></button>
                        </div>
                    `}
                </div>
            ${editMode ? `
                <div class="prompt-template-edit-fields">
                    <label>${S().escapeHtml(S().tr('smart.tplName'))}</label>
                    <input data-template-edit-name value="${S().escapeAttr(selectedPreset.name || '')}" placeholder="${S().escapeAttr(S().tr('smart.tplName'))}">
                    <label>${S().escapeHtml(S().tr('smart.tplGroup'))}</label>
                    <select data-template-edit-category>
                        ${S().promptTemplateGroups.map(group => `<option value="${S().escapeAttr(group.id)}" ${group.id === (selectedPreset.category || selected?.category || 'mine') ? 'selected' : ''}>${S().escapeHtml(promptTemplateCategoryLabel(group.id))}</option>`).join('')}
                    </select>
                    <label>${S().escapeHtml(S().tr('smart.tplContent'))}</label>
                    <textarea data-template-edit-text placeholder="${S().escapeAttr(S().tr('smart.tplContent'))}">${S().escapeHtml(selectedPreset.text || '')}</textarea>
                </div>
            ` : `
                <div class="prompt-template-preview-content">
                <div class="prompt-template-section">
                    <label>${S().escapeHtml(S().tr('smart.tplPositive'))}</label>
                    <p>${S().escapeHtml(selected?.positive || '')}</p>
                </div>
                ${selected?.negative ? `<div class="prompt-template-section">
                    <label>${S().escapeHtml(S().tr('smart.tplNegative'))}</label>
                    <p>${S().escapeHtml(selected.negative)}</p>
                </div>` : ''}
                ${Object.keys(selected?.params || {}).length ? `<div class="prompt-template-section">
                    <label>${S().escapeHtml(S().tr('smart.tplParams'))}</label>
                    <p>${S().escapeHtml(Object.entries(selected.params).map(([k,v]) => `${k}: ${v}`).join('\n'))}</p>
                </div>` : ''}
                </div>
            `}
            <div class="prompt-template-actions">
                ${editMode ? `
                    <button type="button" data-template-edit-cancel><i data-lucide="x"></i><span>${S().escapeHtml(S().tr('common.cancel'))}</span></button>
                    <button type="button" class="danger" data-template-delete><i data-lucide="trash-2"></i><span>${S().escapeHtml(S().tr('common.delete'))}</span></button>
                    <button type="button" class="primary" data-template-edit-save><i data-lucide="save"></i><span>${S().escapeHtml(S().tr('common.save'))}</span></button>
                ` : `
                    <button type="button" data-template-apply="positive"><i data-lucide="corner-down-left"></i><span>${S().escapeHtml(S().tr('smart.tplApplyPositive'))}</span></button>
                    <button type="button" class="primary" data-template-apply="full"><i data-lucide="wand-sparkles"></i><span>${S().escapeHtml(S().tr('smart.tplApplyFull'))}</span></button>
                `}
            </div>
            ` : `<div class="prompt-template-empty">${S().escapeHtml(S().tr('smart.tplPickOrCreate'))}</div>`}
        </div>
    `;
    S().refreshIcons(S().promptTemplatePanel);
    restorePromptTemplateScroll(scrollSnapshot);
}
function activePromptTemplateNodeId(){
    return S().promptTemplatePanel?.classList?.contains('open') && S().promptTemplatePanel.dataset.target !== 'composer' ? (S().promptTemplatePanel.dataset.nodeId || '') : '';
}
function syncComposerTemplateButton(){
    if(!S().composerTemplateBtn || !S().promptTemplatePanel) return;
    const active = S().promptTemplatePanel.classList.contains('open') && S().promptTemplatePanel.dataset.target === 'composer';
    S().composerTemplateBtn.classList.toggle('active', active);
    S().composerTemplateBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
}
function openPromptTemplatePanel(nodeId='', templateId='', options={}){
    if(!S().promptTemplatePanel) return;
    const target = options.target === 'composer' ? 'composer' : 'node';
    S().promptTemplatePanel.dataset.target = target;
    S().promptTemplatePanel.dataset.nodeId = nodeId || '';
    if(S().promptTemplatePanel.parentElement !== S().shell) S().shell.appendChild(S().promptTemplatePanel);
    if(templateId) S().promptTemplateSelectedId = templateId;
    if(!S().promptTemplateSelectedId) S().promptTemplateSelectedId = promptTemplateItems()[0]?.id || '';
    renderPromptTemplatePanel();
    S().promptTemplatePanel.classList.add('open');
    if(target === 'node' && nodeId){
        S().selectedId = nodeId;
        S().selectedIds = [];
        S().selectedImage = {nodeId:'', index:-1};
    }
    S().syncSelectionUi?.();
    syncComposerTemplateButton();
    S().promptTemplateSearch?.focus();
}
function closePromptTemplatePanel(){
    S().promptTemplatePanel?.classList.remove('open');
    syncComposerTemplateButton();
}
function applyPromptTemplateToNode(mode='positive'){
    const template = promptTemplateItems().find(item => item.id === S().promptTemplateSelectedId);
    if(!template) return;
    if(S().promptTemplatePanel?.dataset.target === 'composer'){
        const text = promptTemplateText(template, mode);
        S().setPromptText(text);
        delete S().promptInput.dataset.preserveDraftOnce;
        S().savePromptDraftForCurrent();
        S().renderInputThumbsRow(S().selectedNode());
        closePromptTemplatePanel();
        S().scheduleSave();
        return;
    }
    const node = S().getNodes().find(n => n.id === S().promptTemplatePanel?.dataset.nodeId);
    if(!node) return;
    node.text = promptTemplateText(template, mode);
    node.promptPresetId = template.builtin ? '' : template.sourceId || '';
    closePromptTemplatePanel();
    S().render();
    S().scheduleSave();
}
async function saveCurrentPromptAsTemplate(){
    const library = activePromptLibrary();
    if(library.id === 'system' || library.readonly){ S().toast('请选择可编辑的提示词库'); return; }
    const text = S().promptTemplatePanel?.dataset.target === 'composer'
        ? S().promptPlainText()
        : String(S().getNodes().find(n => n.id === S().promptTemplatePanel?.dataset.nodeId)?.text || '').trim();
    if(!text){ S().toast(S().tr('smart.promptPresetEmpty')); return; }
    try {
        const data = await fetch('/api/prompt-libraries/items', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({library_id:library.id, name:defaultPromptPresetName(text), category:S().promptTemplateCategory === 'all' ? 'mine' : S().promptTemplateCategory, positive:text, scene:'My prompt preset'})
        }).then(async r => {
            if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '保存失败');
            return r.json();
        });
        S().promptLibraries = data.library?.libraries || S().promptLibraries;
        S().activePromptLibraryId = library.id;
        S().promptTemplateCategory = data.item?.category || 'mine';
        S().promptTemplateSelectedId = data.item?.id || '';
        S().promptTemplateEditing = true;
        renderPromptTemplatePanel({preserveScroll:false});
    } catch(err) {
        S().toast(err.message || '保存失败');
    }
}
async function createBlankPromptTemplate(){
    const library = activePromptLibrary();
    if(library.id === 'system' || library.readonly){ S().toast('请选择可编辑的提示词库'); return; }
    const category = S().promptTemplateCategory && S().promptTemplateCategory !== 'all' ? S().promptTemplateCategory : 'mine';
    try {
        const data = await fetch('/api/prompt-libraries/items', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({library_id:library.id, name:S().tr('smart.tplNewTemplateName'), category, positive:'New prompt', scene:'My prompt preset'})
        }).then(async r => {
            if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '创建失败');
            return r.json();
        });
        S().promptLibraries = data.library?.libraries || S().promptLibraries;
        S().activePromptLibraryId = library.id;
        S().promptTemplateCategory = category;
        S().promptTemplateSelectedId = data.item?.id || '';
        S().promptTemplateEditing = true;
        renderPromptTemplatePanel({preserveScroll:false});
    } catch(err) {
        S().toast(err.message || '创建失败');
    }
}
async function savePromptTemplateEdit(){
    const item = promptTemplateSelectedItem();
    if(!item) return;
    const name = S().promptTemplatePanel.querySelector('[data-template-edit-name]')?.value?.trim() || '';
    const text = S().promptTemplatePanel.querySelector('[data-template-edit-text]')?.value?.trim() || '';
    const category = S().promptTemplatePanel.querySelector('[data-template-edit-category]')?.value || 'mine';
    if(!name || !text){ S().toast(S().tr('smart.tplRequired')); return; }
    if(item.remote){
        try {
            const data = await fetch(`/api/prompt-libraries/items/${encodeURIComponent(item.id)}`, {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({library_id:item.libraryId || activePromptLibrary().id, name, category, positive:text, scene:item.scene || '', negative:item.negative || ''})
            }).then(async r => {
                if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '保存失败');
                return r.json();
            });
            S().promptLibraries = data.library?.libraries || S().promptLibraries;
            S().promptTemplateSelectedId = data.item?.id || item.id;
        } catch(err) {
            S().toast(err.message || '保存失败');
            return;
        }
    } else if(item.builtin){
        S().promptTemplateOverrides.editedBuiltins = S().promptTemplateOverrides.editedBuiltins || {};
        S().promptTemplateOverrides.editedBuiltins[item.id] = {
            ...(S().promptTemplateOverrides.editedBuiltins[item.id] || {}),
            name,
            positive:text,
            category
        };
        savePromptTemplateOverrides();
    } else {
        const preset = currentPromptPreset(item.sourceId);
        if(!preset) return;
        const idx = S().promptPresets.findIndex(p => p.id === preset.id);
        if(idx >= 0) S().promptPresets[idx] = {...promptPresets[idx], name, text, category, updatedAt:Date.now()};
        savePromptPresets();
        S().getNodes().forEach(node => { if(node.promptPresetId === preset.id) node.text = text; });
    }
    S().promptTemplateEditing = false;
    renderPromptTemplatePanel();
    S().render();
    S().scheduleSave();
}
async function deletePromptTemplate(){
    const item = promptTemplateSelectedItem();
    if(!item) return;
    if(item.remote){
        try {
            const data = await fetch(`/api/prompt-libraries/items/${encodeURIComponent(item.id)}`, {method:'DELETE'}).then(async r => {
                if(!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '删除失败');
                return r.json();
            });
            S().promptLibraries = data.library?.libraries || S().promptLibraries;
        } catch(err) {
            S().toast(err.message || '删除失败');
            return;
        }
    } else if(item.builtin){
        S().promptTemplateOverrides.hiddenBuiltinIds = [...new Set([...(S().promptTemplateOverrides.hiddenBuiltinIds || []), item.id])];
        savePromptTemplateOverrides();
    } else {
        S().promptPresets = S().promptPresets.filter(p => p.id !== item.sourceId);
        S().getNodes().forEach(node => { if(node.promptPresetId === item.sourceId) node.promptPresetId = ''; });
        savePromptPresets();
    }
    S().promptTemplateSelectedId = '';
    S().promptTemplateEditing = false;
    renderPromptTemplatePanel({preserveScroll:false});
    S().render();
    S().scheduleSave();
}
function createPromptTemplateGroup(){
    const name = window.prompt(S().tr('smart.tplNewGroupPrompt'), S().tr('smart.tplNewGroupDefault'));
    if(!String(name || '').trim()) return;
    const group = {id:S().uid('tpl_group'), name:String(name).trim().slice(0, 24)};
    S().promptTemplateGroups.push(group);
    savePromptTemplateGroups();
    S().promptTemplateCategory = group.id;
    renderPromptTemplatePanel({preserveScroll:false});
}
function renamePromptTemplateGroup(groupId){
    const group = S().promptTemplateGroups.find(g => g.id === groupId);
    if(!group) return;
    const name = window.prompt(S().tr('smart.tplGroupNamePrompt'), group.name || '');
    if(!String(name || '').trim()) return;
    group.name = String(name).trim().slice(0, 24);
    savePromptTemplateGroups();
    renderPromptTemplatePanel();
}
function deletePromptTemplateGroup(groupId){
    if(['view','storyboard','character','product','lighting','mine'].includes(groupId)){
        renamePromptTemplateGroup(groupId);
        return;
    }
    if(!window.confirm(S().tr('smart.tplDeleteGroupConfirm'))) return;
    S().promptTemplateGroups = S().promptTemplateGroups.filter(g => g.id !== groupId);
    S().promptPresets = S().promptPresets.map(p => p.category === groupId ? {...p, category:'mine'} : p);
    Object.entries(S().promptTemplateOverrides.editedBuiltins || {}).forEach(([id, item]) => {
        if(item?.category === groupId) S().promptTemplateOverrides.editedBuiltins[id] = {...item, category:'mine'};
    });
    if(S().promptTemplateCategory === groupId) S().promptTemplateCategory = 'all';
    savePromptTemplateGroups();
    savePromptPresets();
    savePromptTemplateOverrides();
    renderPromptTemplatePanel({preserveScroll:false});
}
function editPromptPresetForNode(node){
    openPromptTemplatePanel(node?.id || '', node?.promptPresetId ? `mine:${node.promptPresetId}` : '');
}
function activePromptTemplateGroups(){ 
 const lib = activePromptLibrary(); 
 // 系统库的分组也以后端 categories 为准，与素材库管理共用同一份分组数据（可重命名/删除并同步）。 
 const fromLib = Array.isArray(lib?.categories) ? lib.categories.filter(c => c?.id && c?.name) : []; 
 if(fromLib.length) return fromLib; 
 if(!lib || lib.id === 'system') return S().promptTemplateGroups; 
 return []; 
}

    const api = Object.freeze({
        registerDeps,
        loadPromptPresets,
        savePromptPresets,
        defaultPromptTemplateGroups,
        loadPromptTemplateGroups,
        savePromptTemplateGroups,
        loadPromptTemplateOverrides,
        savePromptTemplateOverrides,
        loadPromptTemplates,
        activePromptLibrary,
        renderPromptLibrarySelect,
        promptTemplateItems,
        promptTemplateText,
        promptTemplateName,
        promptTemplateScene,
        promptTemplateSearchText,
        promptTemplateCategoryLabel,
        promptTemplateSelectedItem,
        currentPromptPreset,
        defaultPromptPresetName,
        promptPresetPanelNode,
        setPromptPresetStatus,
        resetPromptPresetDeleteState,
        createPromptPresetFromNode,
        createPromptPresetFromComposer,
        savePromptNodeAsPreset,
        renderPromptPresetPanel,
        openPromptPresetPanel,
        closePromptPresetPanel,
        promptTemplateScrollSnapshot,
        restorePromptTemplateScroll,
        renderPromptTemplatePanel,
        activePromptTemplateNodeId,
        syncComposerTemplateButton,
        openPromptTemplatePanel,
        closePromptTemplatePanel,
        applyPromptTemplateToNode,
        saveCurrentPromptAsTemplate,
        createBlankPromptTemplate,
        savePromptTemplateEdit,
        deletePromptTemplate,
        createPromptTemplateGroup,
        renamePromptTemplateGroup,
        deletePromptTemplateGroup,
        editPromptPresetForNode,
        activePromptTemplateGroups,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('promptTemplates', api);
    }
    global.SmartCanvasPromptTemplates = api;
})(window);
