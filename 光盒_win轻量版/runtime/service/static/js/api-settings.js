let providers = [];
let selectedId = '';
let overviewOpen = false;
// 我的模型：固定别名 → 中转站+真实模型绑定（/api/custom-models）
let customModelsOpen = false;
let customModels = null;
let customModelsSaveTimer = null;
const CUSTOM_MODEL_MODES = [
    ['image', '图片', 'image_models'],
    ['text', '文本', 'chat_models'],
    ['video', '视频', 'video_models'],
    ['audio', '音频', 'audio_models']
];
/** 主路径：按用途分类；次要：中转站管理 */
let apiView = 'category'; // category | stations
let activeCategory = 'image'; // image | text | video | audio
let selectedDisplayIndex = 0;
/** 拉取选择器：为某个显示名绑定时，锁定用途并单选 */
let pickerBindMode = false;
let pickerLockedCat = null; // image|chat|video|audio|null
const CATEGORY_LABELS = { image:'图片', text:'文本', video:'视频', audio:'音频' };
const providerList = document.getElementById('providerList');
const displayNameList = document.getElementById('displayNameList');
const bindingPanel = document.getElementById('bindingPanel');
const bindingBody = document.getElementById('bindingBody');
const bindingTitle = document.getElementById('bindingTitle');
const bindingSub = document.getElementById('bindingSub');
const bindingStatusPill = document.getElementById('bindingStatusPill');
const stationEditor = document.getElementById('stationEditor');
const editorTitle = document.getElementById('editorTitle');
const editorSub = document.getElementById('editorSub');
const statusEl = document.getElementById('status');
const nameInput = document.getElementById('nameInput');
const idInput = document.getElementById('idInput');
const baseInput = document.getElementById('baseInput');
const protocolInput = document.getElementById('protocolInput');
const keyInput = document.getElementById('keyInput');
const keyHint = document.getElementById('keyHint');
const settingsContent = document.getElementById('settingsContent');
const recommendContent = document.getElementById('recommendContent');
const recommendPanel = document.getElementById('recommendPanel');
const providerOnboardingCard = document.getElementById('providerOnboardingCard');
const imageModelList = document.getElementById('imageModelList');
const chatModelList = document.getElementById('chatModelList');
const videoModelList = document.getElementById('videoModelList');
const audioModelList = document.getElementById('audioModelList');
const recommendApiOverlay = document.getElementById('recommendApiOverlay');
const recommendApiList = document.getElementById('recommendApiList');
const EXAMPLE_BASE_URL = 'https://api.example.com/v1';
const JIMENG_DEFAULT_IMAGE_MODELS = ['jimeng-image-2k', 'jimeng-image-4k'];
const JIMENG_DEFAULT_VIDEO_MODELS = ['jimeng-video-720p', 'jimeng-video-1080p', 'seedance2.0fast_vip', 'seedance2.0_vip'];
const REMOVED_PROVIDER_IDS = new Set(['modelscope','runninghub','volcengine','jimeng']);
const ONBOARDING_GUIDES = {};
let recommendInlineOpen = false;
let providerDragId = '';
const RECOMMENDED_APIS = [
    {
        name:'APIMART',
        base_url:'https://api.apimart.ai',
        protocol:'apimart',
        register_url:'https://apimart.ai/zh/register',
        tagKeys:['api.tagImageModels','api.tagVideoModels','api.tagLlmModels'],
        icons:['IMG','VID','LLM'],
        summaryKey:'api.recommendApimartSummary',
        advantages:['模型类型覆盖广', '适合多节点混合工作流', '异步协议适合长任务']
    },
    {
        name:'FHL',
        base_url:'https://www.fhl.mom',
        protocol:'openai',
        register_url:'https://www.fhl.mom/register',
        tagKeys:['Codex','api.tagGptImage2'],
        icons:['CODEX','GPT','IMG'],
        summaryKey:'api.recommendFhlSummary',
        advantages:['OpenAI 兼容接入', '配置路径简单', '适合图像与代码相关模型']
    }
];

function categoryMeta(mode){
    return CUSTOM_MODEL_MODES.find(row => row[0] === mode) || CUSTOM_MODEL_MODES[0];
}
function pickerCatForMode(mode){
    return mode === 'text' ? 'chat' : mode;
}
function modeForPickerCat(cat){
    return cat === 'chat' ? 'text' : cat;
}
function refreshIcons(){ if(window.lucide) lucide.createIcons(); }
function tr(key){ return window.StudioI18n ? window.StudioI18n.t(key) : key; }
function trf(key, vars={}){
    let text = tr(key);
    Object.entries(vars).forEach(([name, value]) => {
        text = text.replaceAll(`{${name}}`, String(value ?? ''));
    });
    return text;
}
function setStatus(text){ statusEl.textContent = text || ''; }
function broadcastStudioApiChange(type='providers-changed'){
    const message = { type, updated_at:Date.now() };
    try { new BroadcastChannel('studio-api').postMessage(message); } catch(e) {}
    try { window.parent?.postMessage(message, '*'); } catch(e) {}
    try { window.top?.postMessage(message, '*'); } catch(e) {}
}
function normalizeId(value){
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 40);
}
// 平台 Key 按 ID 写入 API/.env；ID 一旦创建就保持稳定，避免改名或中文名称导致 Key 看起来丢失。
function deriveIdFromName(name, existingId){
    if(existingId) return existingId;
    let id = normalizeId(name);
    if(!id){
        id = 'api-' + Math.random().toString(36).slice(2, 8);
    }
    let candidate = id, i = 2;
    while(providers.some(p => p.id === candidate)){
        candidate = `${id}-${i++}`;
    }
    return candidate;
}
function updateIdPreview(){
    const item = provider();
    if(!item) return;
    const isBuiltin = item.id === 'comfly' || item.id === 'jimeng';
    const idPreview = document.getElementById('idPreview');
    if(!idPreview) return;
    if(isBuiltin){
        idPreview.textContent = item.id;
        return;
    }
    idPreview.textContent = deriveIdFromName(nameInput.value, item.id);
}
function provider(){
    return visibleProviders().find(item => item.id === selectedId) || visibleProviders()[0] || null;
}
function visibleProviders(){
    return (providers || []).filter(item => !REMOVED_PROVIDER_IDS.has(String(item?.id || '').toLowerCase()));
}
function isFixedProvider(itemOrId){
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
    return id === 'jimeng';
}
function unique(values){
    const seen = new Set();
    return values.map(v => String(v || '').trim()).filter(v => v && !seen.has(v) && seen.add(v));
}
function syncEditor(){
    const item = provider();
    if(!item) return;
    const oldId = item.id;
    const isBuiltin = item.id === 'comfly' || item.id === 'jimeng';
    const nextId = isBuiltin ? item.id : deriveIdFromName(nameInput.value, item.id);
    item.id = nextId;
    if(oldId !== item.id) selectedId = item.id;
    item.name = nameInput.value.trim() || item.id;
    const selectedProtocol = item.id === 'jimeng' ? 'jimeng' : (protocolInput?.value || 'openai');
    item.base_url = selectedProtocol === 'jimeng' ? '' : baseInput.value.trim();
    item.protocol = selectedProtocol;
    item.image_generation_endpoint = '';
    item.image_edit_endpoint = '';
    const key = keyInput.value.trim();
    if(key) item.api_key = key;
}
function updateProtocolFromInput(){
    const item = provider();
    if(!item || !protocolInput || item.id === 'jimeng') return;
    const value = String(protocolInput.value || 'openai').toLowerCase();
    item.protocol = ['openai', 'apimart', 'gemini', 'jimeng'].includes(value) ? value : 'openai';
    if(item.protocol === 'jimeng') item.base_url = '';
    document.body.classList.toggle('show-jimeng', item.protocol === 'jimeng');
    clearVerifyResult();
}
function openRecommendApi(){
    recommendInlineOpen = true;
    syncRecommendView();
    renderRecommendApi();
    renderProviderOnboarding(provider());
}
function closeRecommendApi(){
    if(recommendApiOverlay) recommendApiOverlay.style.display = 'none';
    recommendInlineOpen = false;
    syncRecommendView();
    renderRecommendApi();
    renderEditor();
}
function syncRecommendView(){
    if(settingsContent) settingsContent.hidden = recommendInlineOpen;
    if(recommendContent) recommendContent.hidden = !recommendInlineOpen;
    const recommendTitle = recommendContent?.querySelector('.editor-title');
    const recommendSub = recommendContent?.querySelector('.editor-sub');
    if(recommendTitle) recommendTitle.textContent = tr('api.recommendPanelTitle');
    if(recommendSub) recommendSub.textContent = tr('api.recommendPanelSub');
    document.body.classList.toggle('show-recommend-mode', recommendInlineOpen);
}
function renderRecommendApi(){
    if(!recommendPanel) return;
    if(!recommendInlineOpen){
        recommendPanel.innerHTML = '';
        return;
    }
    const html = RECOMMENDED_APIS.map((api, index) => `
        <section class="recommend-card recommend-platform-card" style="--recommend-index:${index}">
            <div class="recommend-platform-info">
                <div class="recommend-platform-head">
                    <div>
                        <div class="recommend-name"><span>${escapeHtml(api.name)}</span></div>
                    </div>
                    <span class="recommend-badge">${escapeHtml(api.protocol === 'apimart' ? 'APIMart' : 'OpenAI')}</span>
                </div>
                <p class="recommend-platform-summary">${escapeHtml(tr(api.summaryKey))}</p>
                <div class="recommend-tags">
                    ${(api.tagKeys || []).map(tag => `<span class="recommend-tag">${escapeHtml(tag.startsWith('api.') ? tr(tag) : tag)}</span>`).join('')}
                </div>
            </div>
            <div class="recommend-platform-setup">
                <div class="recommend-setup-title">${escapeHtml(tr('api.recommendQuickSetup'))}</div>
                <div class="recommend-quick-stack recommend-setup-flow">
                    <div class="recommend-guide-source onboarding-rh-source-group">
                        <div class="onboarding-rh-source-label">${escapeHtml(tr('api.getKey'))}</div>
                        <div class="onboarding-key-actions onboarding-rh-key-actions recommend-single-action">
                            <a class="onboarding-key-btn recommend-guide-key-btn" href="${escapeAttr(api.register_url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="key-round" class="w-3.5 h-3.5"></i><span>${escapeHtml(tr('api.getKey'))}</span></a>
                        </div>
                    </div>
                    <div class="recommend-flow-arrow onboarding-flow-arrow recommend-guide-arrow" aria-hidden="true"><span></span><b></b></div>
                    <div class="recommend-guide-save">
                        <label class="onboarding-key-field onboarding-rh-row-field">
                            <span>API Key</span>
                            <input type="password" data-recommend-key="${index}" placeholder="${escapeAttr(trf('api.recommendKeyPlaceholder', {name:api.name}))}">
                        </label>
                        <button class="onboarding-save-btn recommend-guide-save-btn" type="button" onclick="saveRecommendedApi(${index})"><span>${escapeHtml(tr('api.save'))}</span></button>
                    </div>
                </div>
            </div>
        </section>
    `).join('');
    recommendPanel.innerHTML = `
        <div class="onboarding-head">
            <div>
                <div class="onboarding-title">${escapeHtml(tr('api.recommendPanelTitle'))}</div>
                <div class="onboarding-desc">${escapeHtml(tr('api.recommendPanelDesc'))}</div>
            </div>
        </div>
        <div class="recommend-api-body recommend-inline-body">${html}</div>
        <div class="recommend-note">${escapeHtml(tr('api.recommendApiNote'))}</div>
    `;
    refreshIcons();
}
function recommendedProviderForApi(api){
    let item = providers.find(provider => String(provider.name || '').toLowerCase() === api.name.toLowerCase());
    if(item) return item;
    const baseId = normalizeId(api.name) || 'custom-api';
    let id = baseId;
    let suffix = 2;
    while(providers.some(provider => provider.id === id)) id = `${baseId}-${suffix++}`;
    item = {
        id,
        name:api.name,
        base_url:api.base_url,
        protocol:api.protocol,
        image_generation_endpoint:'',
        image_edit_endpoint:'',
        enabled:true,
        primary:false,
        image_models:[],
        chat_models:[],
        video_models:[],
        audio_models:[],
        has_key:false,
        key_preview:''
    };
    providers.push(item);
    return item;
}
async function saveRecommendedApi(index){
    const api = RECOMMENDED_APIS[index];
    if(!api) return;
    const input = recommendPanel?.querySelector(`[data-recommend-key="${index}"]`);
    const key = input?.value.trim() || '';
    if(!key){ alert(tr('api.enterApiKey')); return; }
    const item = recommendedProviderForApi(api);
    selectedId = item.id;
    overviewOpen = false;
    recommendInlineOpen = false;
    syncRecommendView();
    renderProviderList();
    renderEditor();
    keyInput.value = key;
    if(protocolInput){
        protocolInput.value = api.protocol;
        protocolInput.dispatchEvent(new Event('change'));
    }
    syncEditor();
    const ok = await saveProviders();
    if(ok) setStatus(trf('api.recommendSaved', {name:api.name}));
}
function sortedProviders(){
    const order = ['jimeng'];
    return visibleProviders().sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        if(ai === -1 && bi === -1) return 0;
        if(ai === -1) return 1;
        if(bi === -1) return -1;
        return ai - bi;
    });
}
function providerDragAttrs(item){
    if(isFixedProvider(item)) return '';
    const id = escapeAttr(item.id);
    return ` draggable="true" data-provider-id="${id}" ondragstart="handleProviderDragStart(event,'${id}')" ondragover="handleProviderDragOver(event,'${id}')" ondrop="handleProviderDrop(event,'${id}')" ondragend="handleProviderDragEnd()"`;
}
function renderProviderList(){
    if(!providerList) return;
    const providerCards = sortedProviders().map(item => {
        const active = apiView === 'stations' && !overviewOpen && item.id === selectedId ? 'active' : '';
        const stateClass = item.enabled === false ? 'is-disabled' : (item.has_key ? 'has-key' : 'missing-key');
        const protocolLabel = String(item.protocol || 'openai').toUpperCase();
        return `
            <button class="provider-card provider-card-sortable ${active} ${stateClass}" type="button" onclick="selectProvider('${escapeHtml(item.id)}')"${providerDragAttrs(item)}>
                <span class="provider-drag-handle" aria-hidden="true"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span>
                <span class="provider-mark"><i data-lucide="${item.has_key ? 'key-round' : 'key'}" class="w-4 h-4"></i></span>
                <span class="provider-info">
                    <div class="provider-name">${escapeHtml(item.name || item.id)}</div>
                    <div class="provider-meta">${escapeHtml(item.base_url || '未配置地址')}</div>
                </span>
                <span class="provider-side-meta">
                    <span class="provider-status-dot"></span>
                    <span class="provider-protocol-pill">${escapeHtml(protocolLabel)}</span>
                </span>
            </button>
        `;
    }).join('');
    providerList.innerHTML = providerCards || '<div class="provider-empty-hint">还没有中转站，点下方新增</div>';
    refreshIcons();
    syncApiModeTabs();
}

function syncApiModeTabs(){
    const onStations = apiView === 'stations';
    document.body.classList.toggle('api-view-category', !onStations);
    document.body.classList.toggle('api-view-stations', onStations);
    document.body.classList.toggle('show-custom-models', !onStations);
    document.querySelectorAll('[data-api-category]').forEach(btn => {
        const on = !onStations && btn.dataset.apiCategory === activeCategory;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.getElementById('apiStationsBtn')?.classList.toggle('is-active', onStations);
    if(displayNameList) displayNameList.hidden = onStations;
    if(providerList) providerList.hidden = !onStations;
    const addBtn = document.getElementById('addProviderBtn');
    if(addBtn) addBtn.hidden = !onStations;
    if(bindingPanel) bindingPanel.hidden = onStations;
    if(stationEditor) stationEditor.hidden = !onStations;
    const sideTitle = document.getElementById('apiSideTitle');
    const sideNote = document.getElementById('apiSideNote');
    const pageSub = document.getElementById('apiPageSub');
    if(sideTitle) sideTitle.textContent = onStations ? '① 选择中转站' : `① ${CATEGORY_LABELS[activeCategory] || ''}显示名`;
    if(sideNote){
        sideNote.hidden = onStations;
        sideNote.textContent = '画布底部模型菜单显示这些名字；未绑定的会置灰。';
    }
    if(pageSub){
        pageSub.textContent = onStations
            ? '中转站只负责连接与模型库存；回到分类页把真实模型绑到显示名'
            : '先选用途分类 → 点画布显示名 → 绑中转站里的真实模型';
    }
}

function selectPlatformsMode(){
    selectStationsView();
}

function selectStationsView(){
    // 分类页未打开中转站表单，勿 sync 空表单覆盖真实配置
    if(apiView === 'stations') syncEditor();
    apiView = 'stations';
    customModelsOpen = false;
    overviewOpen = false;
    recommendInlineOpen = false;
    syncRecommendView?.();
    const first = sortedProviders().find(item => item.id === selectedId) || sortedProviders()[0];
    if(first){
        selectedId = first.id;
        renderEditor();
    } else {
        renderProviderList();
        syncApiModeTabs();
    }
}

async function selectApiCategory(mode){
    if(!CUSTOM_MODEL_MODES.some(row => row[0] === mode)) mode = 'image';
    apiView = 'category';
    activeCategory = mode;
    overviewOpen = false;
    customModelsOpen = true;
    document.body.classList.remove('show-provider-overview');
    await ensureCustomModelsLoaded();
    const rows = Array.isArray(customModels?.[mode]) ? customModels[mode] : [];
    if(selectedDisplayIndex >= rows.length) selectedDisplayIndex = 0;
    renderDisplayNameList();
    renderBindingPanel();
    syncApiModeTabs();
    refreshIcons();
}

function renderDisplayNameList(){
    if(!displayNameList || !customModels) return;
    const rows = Array.isArray(customModels[activeCategory]) ? customModels[activeCategory] : [];
    if(!rows.length){
        displayNameList.innerHTML = '<div class="provider-empty-hint">该分类暂无显示名</div>';
        return;
    }
    displayNameList.innerHTML = rows.map((row, index) => {
        const bound = !!(row.provider_id && row.model);
        const active = index === selectedDisplayIndex ? 'active' : '';
        const owner = visibleProviders().find(item => item.id === row.provider_id);
        return `
            <button class="provider-card display-name-card ${active} ${bound ? 'has-key' : 'missing-key'}" type="button" onclick="selectDisplayName(${index})">
                <span class="provider-mark"><i data-lucide="${bound ? 'link-2' : 'unplug'}" class="w-4 h-4"></i></span>
                <span class="provider-info">
                    <div class="provider-name">${escapeHtml(row.name || `未命名 ${index + 1}`)}</div>
                    <div class="provider-meta">${bound
                        ? escapeHtml(`${owner?.name || row.provider_id} · ${row.model}`)
                        : '未绑定中转站模型'}</div>
                </span>
                <span class="provider-side-meta">
                    <span class="provider-status-dot"></span>
                </span>
            </button>
        `;
    }).join('');
    refreshIcons();
}

function selectDisplayName(index){
    selectedDisplayIndex = Math.max(0, Number(index) || 0);
    renderDisplayNameList();
    renderBindingPanel();
}

async function ensureCustomModelsLoaded(){
    if(customModels) return true;
    try {
        const data = await fetch('/api/custom-models', {cache:'no-store'}).then(r => r.json());
        customModels = data.models || {};
        return true;
    } catch(err) {
        setStatus('加载画布显示名失败');
        customModels = null;
        return false;
    }
}

function renderBindingPanel(){
    if(!bindingBody) return;
    const rows = Array.isArray(customModels?.[activeCategory]) ? customModels[activeCategory] : [];
    const row = rows[selectedDisplayIndex];
    const [, title, listKey] = categoryMeta(activeCategory);
    if(!row){
        if(bindingTitle) bindingTitle.textContent = `${title}显示名`;
        if(bindingSub) bindingSub.textContent = '该分类还没有可绑定的显示名';
        if(bindingStatusPill){
            bindingStatusPill.textContent = '无';
            bindingStatusPill.className = 'binding-status-pill is-unbound';
        }
        bindingBody.innerHTML = '<div class="binding-empty">该分类暂无显示名</div>';
        return;
    }
    const bound = !!(row.provider_id && row.model);
    const options = visibleProviders().filter(item => item.enabled !== false);
    const owner = options.find(item => item.id === row.provider_id);
    const suggestions = unique(owner?.[listKey] || []);
    const datalistId = `bindingModelOptions-${activeCategory}-${selectedDisplayIndex}`;
    if(bindingTitle) bindingTitle.textContent = row.name;
    if(bindingSub) bindingSub.textContent = `用途：${title} · 只拉取/选用本类模型，绑到这个画布显示名`;
    if(bindingStatusPill){
        bindingStatusPill.textContent = bound ? '已绑定' : '未绑定';
        bindingStatusPill.className = `binding-status-pill ${bound ? 'is-bound' : 'is-unbound'}`;
    }
    bindingBody.innerHTML = `
        <section class="block binding-block">
            <div class="block-head">
                <div>
                    <div class="block-title">② 选择中转站</div>
                    <div class="block-desc">中转站在「中转站」页管理连接与 Key；这里只挑选要用哪一家</div>
                </div>
                <button class="ghost-btn" type="button" onclick="selectStationsView()"><i data-lucide="server" class="w-3.5 h-3.5"></i><span>管理中转站</span></button>
            </div>
            <div class="form">
                <label class="field">
                    <span class="label">中转站</span>
                    <div class="field-frame">
                        <select id="bindingProviderSelect" onchange="updateBindingProvider(this.value)">
                            <option value="">未绑定</option>
                            ${options.map(item => `<option value="${escapeAttr(item.id)}" ${item.id === row.provider_id ? 'selected' : ''}>${escapeHtml(item.name || item.id)}</option>`).join('')}
                        </select>
                    </div>
                </label>
            </div>
        </section>
        <section class="block binding-block">
            <div class="block-head">
                <div>
                    <div class="block-title">③ 绑定真实${title}模型</div>
                    <div class="block-desc">可从已选用列表联想，或拉取上游后只勾选本类模型</div>
                </div>
                <div class="models-toolbar-actions">
                    <button class="action-btn primary-btn" type="button" onclick="fetchModelsForBinding()" ${row.provider_id ? '' : 'disabled'}>
                        <i data-lucide="download-cloud" class="w-3.5 h-3.5"></i>
                        <span>拉取${title}模型</span>
                    </button>
                </div>
            </div>
            <div class="form">
                <label class="field">
                    <span class="label">真实模型名</span>
                    <div class="field-frame">
                        <input id="bindingModelInput" type="text" list="${datalistId}" value="${escapeAttr(row.model || '')}" placeholder="例如 gpt-4.1 / hailuo-02" oninput="updateBindingModel(this.value)">
                    </div>
                    <datalist id="${datalistId}">${suggestions.map(model => `<option value="${escapeAttr(model)}"></option>`).join('')}</datalist>
                    <span class="hint">${suggestions.length ? `该站已有 ${suggestions.length} 个${title}模型可联想` : (row.provider_id ? `该站还没有${title}模型库存，请先拉取` : '先选择中转站')}</span>
                </label>
            </div>
        </section>
    `;
    refreshIcons();
}

function updateBindingProvider(providerId){
    updateCustomModel(activeCategory, selectedDisplayIndex, 'provider_id', providerId);
    if(providerId) selectedId = providerId;
    renderDisplayNameList();
    renderBindingPanel();
}

function updateBindingModel(model){
    updateCustomModel(activeCategory, selectedDisplayIndex, 'model', model);
    renderDisplayNameList();
    if(bindingStatusPill){
        const row = customModels?.[activeCategory]?.[selectedDisplayIndex];
        const bound = !!(row?.provider_id && row?.model);
        bindingStatusPill.textContent = bound ? '已绑定' : '未绑定';
        bindingStatusPill.className = `binding-status-pill ${bound ? 'is-bound' : 'is-unbound'}`;
    }
}

async function fetchModelsForBinding(){
    const row = customModels?.[activeCategory]?.[selectedDisplayIndex];
    if(!row?.provider_id){
        alert('请先选择中转站');
        return;
    }
    selectedId = row.provider_id;
    // 同步表单到该中转站，便于 fetchModels 读 base/key
    const item = provider();
    if(!item){
        alert('找不到该中转站');
        return;
    }
    if(nameInput) nameInput.value = item.name || '';
    if(idInput) idInput.value = item.id || '';
    if(baseInput) baseInput.value = item.base_url || '';
    if(protocolInput) protocolInput.value = item.protocol || 'openai';
    pickerBindMode = true;
    pickerLockedCat = pickerCatForMode(activeCategory);
    await fetchModels();
}

function handleProviderDragStart(event, id){
    const item = providers.find(provider => provider.id === id);
    if(!item || isFixedProvider(item)){
        event.preventDefault();
        return;
    }
    providerDragId = id;
    event.currentTarget.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
}
function handleProviderDragOver(event, id){
    if(!providerDragId || providerDragId === id || isFixedProvider(id)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    providerList?.querySelectorAll('.provider-card-drop-target').forEach(el => el.classList.remove('provider-card-drop-target'));
    event.currentTarget.classList.add('provider-card-drop-target');
}
function handleProviderDrop(event, targetId){
    event.preventDefault();
    providerList?.querySelectorAll('.provider-card-drop-target').forEach(el => el.classList.remove('provider-card-drop-target'));
    const sourceId = providerDragId || event.dataTransfer.getData('text/plain');
    providerDragId = '';
    if(!sourceId || sourceId === targetId || isFixedProvider(sourceId) || isFixedProvider(targetId)) return;
    const sourceIndex = providers.findIndex(item => item.id === sourceId);
    const targetIndex = providers.findIndex(item => item.id === targetId);
    if(sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = providers.splice(sourceIndex, 1);
    const adjustedTargetIndex = providers.findIndex(item => item.id === targetId);
    providers.splice(adjustedTargetIndex, 0, moved);
    renderProviderList();
    saveProviders();
}
function handleProviderDragEnd(){
    providerDragId = '';
    providerList?.querySelectorAll('.is-dragging,.provider-card-drop-target').forEach(el => {
        el.classList.remove('is-dragging', 'provider-card-drop-target');
    });
}
function renderEditor(){
    const item = provider();
    if(!item) return;
    apiView = 'stations';
    customModelsOpen = false;
    document.body.classList.remove('show-provider-overview', 'show-custom-models');
    editorTitle.textContent = item.name || item.id;
    if(editorSub) editorSub.textContent = '只负责连上中转站、填 Key、按用途拉取可用模型';
    nameInput.value = item.name || '';
    idInput.value = item.id || '';
    updateIdPreview();
    clearVerifyResult();
    baseInput.placeholder = EXAMPLE_BASE_URL;
    baseInput.value = item.base_url || '';
    if(protocolInput) protocolInput.value = item.id === 'jimeng' ? 'jimeng' : (item.protocol || 'openai');
    keyInput.value = '';
    keyInput.placeholder = item.has_key ? `${tr('api.keepCurrentKey')} ${item.key_preview || ''}` : tr('api.enterKey');
    keyHint.textContent = item.has_key ? `${tr('api.keySaved')}${item.key_env || 'API/.env'}` : tr('api.noKey');
    const isJimeng = item.id === 'jimeng' || String(protocolInput?.value || item.protocol || '').toLowerCase() === 'jimeng';
    if(isJimeng){
        item.base_url = '';
        item.protocol = 'jimeng';
        keyInput.placeholder = '即梦 CLI 使用本机 dreamina login，无需 API Key';
        keyHint.textContent = '请先在终端安装 dreamina CLI，并执行 dreamina login';
    }
    document.body.classList.toggle('show-jimeng', isJimeng);
    renderProviderOnboarding(item);
    renderRecommendApi();
    const deleteBtn = document.getElementById('deleteBtn');
    if(deleteBtn) deleteBtn.style.display = isFixedProvider(item) ? 'none' : 'inline-flex';
    renderModels('image');
    renderModels('chat');
    renderModels('video');
    renderModels('audio');
    renderProviderList();
    syncApiModeTabs();
}

function aggregateModelsByKind(kind){
    const key = modelListKey(kind);
    const byModel = new Map();
    visibleProviders().forEach(item => {
        unique(item[key] || []).forEach(model => {
            const name = String(model || '').trim();
            if(!name) return;
            if(!byModel.has(name)) byModel.set(name, []);
            byModel.get(name).push({id:item.id, name:item.name || item.id, alias:String(item.model_aliases?.[name] || '').trim()});
        });
    });
    return [...byModel.entries()]
        .map(([model, sources]) => ({model, sources}));
}

function overviewModelLabel(item){
    return item?.sources?.find(source => source.alias)?.alias || item?.model || '';
}

// 总览为只读库存页：仅展示各中转站已拉取的模型，绑定在「我的模型」里操作。
function renderOverviewModelList(kind){
    const list = kind === 'image' ? imageModelList : kind === 'video' ? videoModelList : kind === 'audio' ? audioModelList : chatModelList;
    const models = aggregateModelsByKind(kind);
    if(!models.length){
        list.innerHTML = `<div class="empty">${escapeHtml(tr('api.noModels'))}</div>`;
        return;
    }
    list.innerHTML = models.map(item => {
        const label = overviewModelLabel(item);
        return `
        <div class="model-row overview-model-row">
            <span class="overview-model-name" title="${escapeAttr(item.model)}">${escapeHtml(label)}</span>
            <span class="overview-model-actions">
              <span class="overview-model-providers">
                ${item.sources.map(source => `<button class="overview-model-provider" type="button" data-overview-provider="${escapeAttr(source.id)}" onclick="selectProvider(this.dataset.overviewProvider)" title="打开 ${escapeAttr(source.name)}">${escapeHtml(source.name)}</button>`).join('')}
              </span>
            </span>
        </div>
    `;
    }).join('');
}

function renderModelOverview(){
    overviewOpen = true;
    customModelsOpen = false;
    document.body.classList.remove('show-custom-models');
    document.body.classList.add('show-provider-overview');
    editorTitle.textContent = tr('api.overviewTitle');
    if(editorSub) editorSub.textContent = tr('api.overviewSub');
    renderOverviewModelList('image');
    renderOverviewModelList('chat');
    renderOverviewModelList('video');
    renderOverviewModelList('audio');
    renderProviderList();
    refreshIcons();
}

function selectOverview(){
    if(!overviewOpen) syncEditor();
    recommendInlineOpen = false;
    syncRecommendView();
    renderRecommendApi();
    renderModelOverview();
}

async function selectCustomModels(){
    await selectApiCategory(activeCategory || 'image');
}

function renderCustomModelsView(){
    // 旧四宫格视图已由分类绑定面板替代；保留函数以免外部调用报错。
    renderDisplayNameList();
    renderBindingPanel();
}

function updateCustomModel(mode, index, field, value){
    const row = customModels?.[mode]?.[index];
    if(!row) return;
    row[field] = String(value || '').trim();
    // 换中转站后刷新该行的模型联想列表；改模型名时不重渲，避免输入框失焦。
    if(field === 'provider_id') renderCustomModelsView();
    scheduleCustomModelsSave();
}

function scheduleCustomModelsSave(){
    clearTimeout(customModelsSaveTimer);
    customModelsSaveTimer = setTimeout(saveCustomModels, 600);
}

async function saveCustomModels(){
    if(!customModels) return;
    setStatus('正在保存画布显示名...');
    try {
        const res = await fetch('/api/custom-models', {
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({models:customModels})
        });
        if(!res.ok) throw new Error((await res.json()).detail || '保存画布显示名失败');
        setStatus('画布显示名已保存');
        broadcastStudioApiChange('providers-changed');
    } catch(err) {
        setStatus(err.message || '保存画布显示名失败');
    }
}

// 归一化出可比对的键："Seedream 5.0 Lite" → seedream50lite / seedream5lite
function customMatchKeys(value){
    const raw = String(value || '').toLowerCase();
    const keys = new Set();
    const base = raw.replace(/[^a-z0-9]+/g, '');
    if(base) keys.add(base);
    const noPointZero = raw.replace(/(\d)\.0(?![0-9])/g, '$1').replace(/[^a-z0-9]+/g, '');
    if(noPointZero) keys.add(noPointZero);
    return [...keys];
}

function autoMatchCustomModels(){
    if(!customModels) return;
    const options = visibleProviders().filter(item => item.enabled !== false);
    let matched = 0, missing = 0;
    CUSTOM_MODEL_MODES.forEach(([mode,, listKey]) => {
        (customModels[mode] || []).forEach(row => {
            if(row.provider_id && row.model) return;
            const aliasKeys = customMatchKeys(row.name);
            if(!aliasKeys.length) return;
            let best = null;
            options.forEach(item => {
                unique(item[listKey] || []).forEach(model => {
                    const modelKeys = customMatchKeys(model);
                    let score = 0;
                    aliasKeys.forEach(aliasKey => {
                        modelKeys.forEach(modelKey => {
                            if(modelKey === aliasKey) score = Math.max(score, 3);
                            else if(modelKey.includes(aliasKey) || aliasKey.includes(modelKey)) score = Math.max(score, 2);
                        });
                    });
                    if(!score) return;
                    const len = model.length;
                    if(!best || score > best.score || (score === best.score && len < best.len)){
                        best = {provider_id:item.id, model, score, len};
                    }
                });
            });
            if(best){
                row.provider_id = best.provider_id;
                row.model = best.model;
                matched += 1;
            } else {
                missing += 1;
            }
        });
    });
    renderCustomModelsView();
    if(matched) scheduleCustomModelsSave();
    setStatus(matched
        ? `智能匹配完成：已绑定 ${matched} 个${missing ? `，${missing} 个没找到，需手动填写` : ''}`
        : (missing ? `没有匹配到模型，请先在各中转站「拉取模型」后再试` : '所有名字都已绑定'));
}

function showVerifyResult(html){ const el = document.getElementById('verifyResult'); if(el){ el.style.display = 'block'; el.innerHTML = html; } }
function clearVerifyResult(){ const el = document.getElementById('verifyResult'); if(el){ el.style.display = 'none'; el.innerHTML = ''; } }
function currentProviderApiKey(){
    return keyInput.value.trim();
}

async function probeAsync(){
    const item = provider();
    if(!item) return;
    const btn = document.getElementById('probeAsyncBtn');
    const baseUrl = baseInput.value.trim();
    if(!baseUrl){ alert('请先填写请求地址'); return; }
    if(btn){ btn.disabled = true; btn.querySelector('span').textContent = '检测中...'; }
    showVerifyResult(`<span style="color:var(--muted);font-size:11px;font-weight:600">正在检测协议类型...</span>`);
    try {
        const apiKey = currentProviderApiKey();
        const data = await fetch('/api/providers/probe-async', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, provider_id: item.id })
        }).then(async r => {
            if(!r.ok) throw new Error((await r.json()).detail || '请求失败');
            return r.json();
        });
        const isAsync = data.ok === true;
        // 自动设置协议下拉
        if(protocolInput && protocolInput.value !== 'gemini'){
            protocolInput.value = isAsync ? 'apimart' : 'openai';
            // 触发 change 以便其他地方同步
            protocolInput.dispatchEvent(new Event('change'));
        }
        const rawJson = JSON.stringify(data.raw, null, 2);
        const probeMessage = String(data.message || '');
        const hideTasksEndpointTip = probeMessage.includes('/v1/tasks/');
        const color = isAsync ? 'var(--ui-success-text)' : data.ok === null ? 'var(--ui-warning-text)' : 'var(--ui-text-secondary)';
        const icon = isAsync ? '✓' : '⚠';
        const proto = isAsync ? 'APIMart 异步' : 'OpenAI 兼容';
        showVerifyResult(`
            ${hideTasksEndpointTip ? '' : `<div style="font-size:11px;font-weight:600;color:${color}">${icon} ${escapeHtml(probeMessage)}</div>`}
            <div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:2px">协议已自动设置为：<strong style="color:var(--text)">${proto}</strong></div>
            <details style="margin-top:6px">
                <summary style="font-size:11px;color:var(--muted);cursor:pointer;font-weight:600;user-select:none">▸ 查看原始响应 (HTTP ${data.status_code})</summary>
                <pre style="margin-top:6px;padding:10px 12px;border-radius:10px;background:var(--soft);border:1px solid var(--line-2);font-size:11px;font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;color:var(--text);max-height:200px;overflow:auto">${escapeHtml(rawJson)}</pre>
            </details>`);
    } catch(e){
        const keepManualProtocol = (protocolInput?.value || '') === 'gemini';
        if(protocolInput && !keepManualProtocol){ protocolInput.value = 'openai'; protocolInput.dispatchEvent(new Event('change')); }
        const suffix = keepManualProtocol ? '，已保留当前手动选择的协议' : '，协议已设为 OpenAI 兼容';
        showVerifyResult(`<div style="font-size:11px;font-weight:600;color:var(--ui-warning-text)">⚠ ${escapeHtml(e.message || String(e))}${suffix}</div>`);
    } finally {
        if(btn){ btn.disabled = false; btn.querySelector('span').textContent = '验证协议'; refreshIcons(); }
    }
}

async function testConnection(){
    const item = provider();
    if(!item) return;
    const btn = document.getElementById('testUrlBtn');
    const baseUrl = baseInput.value.trim();
    const isJimeng = item.id === 'jimeng' || (protocolInput?.value || '') === 'jimeng';
    if(!baseUrl && !isJimeng){ alert('请先填写请求地址'); return; }
    if(btn){ btn.disabled = true; btn.querySelector('span').textContent = tr('api.testingUrl') || '验证中...'; }
    showVerifyResult(`<span style="color:var(--muted);font-size:11px;font-weight:600">验证中...</span>`);
    try {
        const apiKey = currentProviderApiKey();
        const data = await fetch('/api/providers/test-connection', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, provider_id: item.id, protocol: protocolInput?.value || 'openai' })
        }).then(async r => {
            if(!r.ok) throw new Error((await r.json()).detail || (tr('api.urlInvalid') || '验证失败'));
            return r.json();
        });
        if(data.ok){
            // 存入 picker 状态并启用「选择模型」按钮，但不自动弹出
            updateDiscoveryResult(data);
            const openBtn = document.getElementById('openPickerBtn');
            if(openBtn){ openBtn.disabled = false; openBtn.style.opacity = '1'; }
            const jimengNote = isJimeng ? `<div style="margin-top:6px;color:var(--ui-success-text);font-size:11px;font-weight:600">即梦 CLI 已可用，可在画布里选择“即梦 CLI”生成。</div>` : '';
            const connectionSummary = window.ModelDiscoveryStatus?.summarize(data);
            const connectionModelText = isJimeng
                ? `找到 ${data.model_count} 个模型`
                : (connectionSummary?.label || `找到 ${data.model_count} 个模型`);
            showVerifyResult(`<span style="color:var(--ui-success-text);font-size:11px;font-weight:600">✓ 地址验证通过 · ${escapeHtml(connectionModelText)}</span>${jimengNote}`);
        } else {
            showVerifyResult(`
                <div style="font-size:11px;font-weight:600;color:var(--ui-warning-text)">⚠ 地址验证未通过 (HTTP ${data.status})</div>
                <div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:3px">${escapeHtml((data.message || '').slice(0,200))}</div>`);
        }
    } catch(e){
        showVerifyResult(`<div style="font-size:11px;font-weight:600;color:var(--ui-warning-text)">⚠ ${escapeHtml(e.message || String(e))}</div>`);
    } finally {
        if(btn){ btn.disabled = false; btn.querySelector('span').textContent = tr('api.testUrl') || '验证地址'; }
    }
}
let lastFetchedAll = [];          // 全部模型 id 列表
let lastFetchedSuggestion = null; // 后端自动分类建议
let lastFetchedSupplements = new Set();
let lastDiscoveryResponse = null;

function updateDiscoveryResult(data){
    lastDiscoveryResponse = data && typeof data === 'object' ? data : null;
    lastFetchedAll = window.ModelDiscoveryStatus
        ? window.ModelDiscoveryStatus.modelIds(lastDiscoveryResponse)
        : (data?.all || []);
    lastFetchedSupplements = window.ModelDiscoveryStatus
        ? new Set(window.ModelDiscoveryStatus.supplementedIds(lastDiscoveryResponse))
        : new Set();
    lastFetchedSuggestion = {
        image: new Set(data.image_models || []),
        chat: new Set(data.chat_models || []),
        video: new Set(data.video_models || []),
        audio: new Set(data.audio_models || []),
    };
    renderPickerDiscoveryStatus();
}

function renderPickerDiscoveryStatus(){
    const statusEl = document.getElementById('pickerDiscoveryStatus');
    const diagnostics = document.getElementById('pickerDiscoveryDiagnostics');
    const body = diagnostics?.querySelector('.picker-discovery-diagnostics-body');
    const helper = window.ModelDiscoveryStatus;
    if(!statusEl || !diagnostics || !body) return;
    if(!lastDiscoveryResponse || !helper){
        statusEl.textContent = '';
        statusEl.className = 'picker-discovery-status';
        body.textContent = '暂无拉取诊断';
        return;
    }
    const summary = helper.summarize(lastDiscoveryResponse);
    statusEl.textContent = summary.label;
    statusEl.className = `picker-discovery-status is-${summary.kind}`;
    const rows = helper.safeAttempts(lastDiscoveryResponse);
    body.replaceChildren();
    if(!rows.length){
        body.textContent = '暂无拉取诊断';
        return;
    }
    rows.forEach(row => {
        const line = document.createElement('div');
        line.className = 'picker-discovery-attempt';
        const parts = [
            row.path || '—',
            row.auth || '—',
            `HTTP ${row.status}`,
            `${row.pages} 页`,
            `${row.models} 个模型`
        ];
        if(row.pagination) parts.push(row.pagination);
        if(row.completeness) parts.push(row.completeness);
        line.textContent = parts.join(' · ');
        body.appendChild(line);
        if(row.error){
            const error = document.createElement('div');
            error.className = 'picker-discovery-error';
            error.textContent = row.error;
            body.appendChild(error);
        }
    });
}

async function fetchModels(){
    const item = provider();
    if(!item) return;
    syncEditor();
    const btn = document.getElementById('fetchModelsBtn');
    const baseUrl = baseInput.value.trim();
    const apiKey = currentProviderApiKey();
    const isJimeng = item.id === 'jimeng' || (protocolInput?.value || '') === 'jimeng';
    if(!baseUrl && !isJimeng){ alert('请先填写请求地址'); return; }
    if(btn){ btn.disabled = true; btn.querySelector('span').textContent = tr('api.fetchingModels') || '拉取中...'; }
    setStatus(tr('api.fetchingModels') || '正在从上游拉取模型列表...');
    try {
        const data = await fetch('/api/providers/fetch-models', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({base_url:baseUrl, api_key:apiKey, provider_id:item.id, protocol:protocolInput?.value || 'openai'})
        }).then(async r => {
            if(!r.ok) throw new Error((await r.json()).detail || (tr('api.urlInvalid') || '拉取失败'));
            return r.json();
        });
        updateDiscoveryResult(data);
        const openBtn = document.getElementById('openPickerBtn');
        if(openBtn){ openBtn.disabled = false; openBtn.style.opacity = '1'; }
        const discoverySummary = window.ModelDiscoveryStatus?.summarize(data);
        setStatus(`${discoverySummary?.label || `可选择 ${lastFetchedAll.length} 个模型`} · 点「选择模型」勾选要导入的`);
        openModelPicker();
    } catch(e){
        alert('拉取失败：' + (e.message || e));
        setStatus('拉取失败');
    } finally {
        if(btn){ btn.disabled = false; btn.querySelector('span').textContent = tr('api.fetchModels') || '拉取模型'; }
    }
}

// —— 模型选择器浮层 ——
// 每个模型只归一类（根据用户已配置 或 关键字猜测）；勾选 = 纳入该分类
let pickerState = { category: {}, selected: {} };
let pickerVisibleIds = [];
function openModelPicker(){
    const item = provider();
    if(!item || !lastFetchedAll.length){ alert('没有拉取到模型'); return; }
    renderPickerDiscoveryStatus();
    const existing = { image: new Set(item.image_models||[]), chat: new Set(item.chat_models||[]), video: new Set(item.video_models||[]), audio: new Set(item.audio_models||[]) };
    const allIds = new Set([...lastFetchedAll, ...(item.image_models||[]), ...(item.chat_models||[]), ...(item.video_models||[]), ...(item.audio_models||[])]);
    pickerState = { category: {}, selected: {} };
    allIds.forEach(id => {
        // 类别归属：用户已配置 > 关键字建议 > 默认 chat
        let cat;
        if(existing.image.has(id)) cat = 'image';
        else if(existing.video.has(id)) cat = 'video';
        else if(existing.audio.has(id)) cat = 'audio';
        else if(existing.chat.has(id)) cat = 'chat';
        else if(lastFetchedSuggestion?.image?.has(id)) cat = 'image';
        else if(lastFetchedSuggestion?.video?.has(id)) cat = 'video';
        else if(lastFetchedSuggestion?.audio?.has(id)) cat = 'audio';
        else cat = 'chat';
        pickerState.category[id] = cat;
        // 绑定模式：默认只勾选当前显示名已绑模型；库存模式：勾选已在列表里的
        if(pickerBindMode){
            const row = customModels?.[activeCategory]?.[selectedDisplayIndex];
            pickerState.selected[id] = !!(row?.model && row.model === id);
        } else {
            pickerState.selected[id] = existing.image.has(id)
                || existing.chat.has(id)
                || existing.video.has(id)
                || existing.audio.has(id);
        }
    });
    const defaultCat = pickerLockedCat || 'all';
    document.querySelectorAll('.picker-cat-tab').forEach(t => {
        const cat = t.dataset.cat;
        const locked = !!pickerLockedCat;
        t.classList.toggle('active', cat === defaultCat);
        t.hidden = locked && cat !== 'all' && cat !== pickerLockedCat;
        if(locked && cat === 'all') t.hidden = true;
    });
    const pickerTitle = document.getElementById('pickerTitle');
    const applyBtn = document.getElementById('pickerApplyBtn');
    if(pickerBindMode){
        const label = CATEGORY_LABELS[activeCategory] || '';
        if(pickerTitle) pickerTitle.textContent = `选择要绑到「${customModels?.[activeCategory]?.[selectedDisplayIndex]?.name || ''}」的${label}模型`;
        if(applyBtn) applyBtn.textContent = '绑到此显示名';
    } else {
        if(pickerTitle) pickerTitle.textContent = '从上游拉取的模型清单';
        if(applyBtn) applyBtn.textContent = '应用到模型列表';
    }
    document.getElementById('modelPickerOverlay').style.display = 'flex';
    renderModelPicker();
}
function closeModelPicker(){
    document.getElementById('modelPickerOverlay').style.display = 'none';
    pickerBindMode = false;
    pickerLockedCat = null;
    document.querySelectorAll('.picker-cat-tab').forEach(t => { t.hidden = false; });
}
function renderModelPicker(){
    const filter = (document.getElementById('pickerFilter')?.value || '').toLowerCase();
    const currentTab = pickerLockedCat || document.querySelector('.picker-cat-tab.active')?.dataset.cat || 'all';
    const ids = Object.keys(pickerState.category).sort();
    // 各分类总数 / 已选数
    const totals = { all: ids.length, image:0, chat:0, video:0, audio:0 };
    const selecteds = { all:0, image:0, chat:0, video:0, audio:0 };
    ids.forEach(id => {
        const cat = pickerState.category[id];
        totals[cat]++;
        if(pickerState.selected[id]){ selecteds[cat]++; selecteds.all++; }
    });
    // 过滤显示：绑定模式下强制只看当前用途
    const list = ids.filter(id => {
        if(filter && !id.toLowerCase().includes(filter)) return false;
        if(pickerLockedCat) return pickerState.category[id] === pickerLockedCat;
        if(currentTab === 'all') return true;
        return pickerState.category[id] === currentTab;
    });
    pickerVisibleIds = list;
    document.getElementById('pickerCount').textContent = `共 ${totals.all} 个模型 · 当前显示 ${list.length} 个${pickerLockedCat ? ` · 仅${CATEGORY_LABELS[modeForPickerCat(pickerLockedCat)] || pickerLockedCat}` : ''}`;
    document.querySelectorAll('.picker-cat-tab').forEach(tab => {
        const cat = tab.dataset.cat;
        tab.querySelector('.cat-count').textContent = `${selecteds[cat]}/${totals[cat]}`;
    });
    // 列表
    const html = list.map((id, index) => {
        const checked = pickerState.selected[id];
        const supplementBadge = lastFetchedSupplements.has(id) ? '<span class="picker-supplement-badge">内置兼容</span>' : '';
        return `
            <div class="picker-row ${checked?'has-sel':''}" onclick="togglePickerRowByIndex(${index})">
                <div class="picker-checkbox ${checked?'checked':''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="picker-model-name" title="${escapeAttr(id)}">${escapeHtml(id)}</div>
                ${supplementBadge}
            </div>
        `;
    }).join('');
    document.getElementById('pickerList').innerHTML = html || `<div style="padding:32px;text-align:center;color:var(--faint);font-size:12px">无匹配本类模型</div>`;
    // 底部汇总
    const sumImage = document.getElementById('sumImage');
    const sumChat = document.getElementById('sumChat');
    const sumVideo = document.getElementById('sumVideo');
    const sumAudio = document.getElementById('sumAudio');
    const sumUnsel = document.getElementById('sumUnsel');
    if(sumImage){ sumImage.textContent = `生图 ${selecteds.image}`; sumImage.classList.toggle('picker-sum-chip-empty', selecteds.image === 0); }
    if(sumChat){ sumChat.textContent = `LLM ${selecteds.chat}`; sumChat.classList.toggle('picker-sum-chip-empty', selecteds.chat === 0); }
    if(sumVideo){ sumVideo.textContent = `视频 ${selecteds.video}`; sumVideo.classList.toggle('picker-sum-chip-empty', selecteds.video === 0); }
    if(sumAudio){ sumAudio.textContent = `音频 ${selecteds.audio}`; sumAudio.classList.toggle('picker-sum-chip-empty', selecteds.audio === 0); }
    if(sumUnsel){ sumUnsel.textContent = `未选 ${totals.all - selecteds.all}`; }
}
function togglePickerRow(id){
    if(pickerBindMode){
        // 单选：只保留当前点中的模型
        Object.keys(pickerState.selected).forEach(key => { pickerState.selected[key] = false; });
        pickerState.selected[id] = true;
        // 若分类与锁定用途不一致，强制归入锁定用途
        if(pickerLockedCat) pickerState.category[id] = pickerLockedCat;
    } else {
        pickerState.selected[id] = !pickerState.selected[id];
    }
    renderModelPicker();
}
function togglePickerRowByIndex(index){
    const id = pickerVisibleIds[index];
    if(typeof id !== 'string') return;
    togglePickerRow(id);
}
function selectPickerCat(cat){
    document.querySelectorAll('.picker-cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
    renderModelPicker();
}
function applyModelPicker(){
    const item = provider(); if(!item) return;
    if(pickerBindMode){
        const selectedIdModel = Object.entries(pickerState.selected).find(([, sel]) => sel)?.[0];
        if(!selectedIdModel){
            alert('请先勾选一个模型');
            return;
        }
        const cat = pickerLockedCat || pickerState.category[selectedIdModel] || 'chat';
        const listKey = modelListKey(cat);
        item[listKey] = unique([...(item[listKey] || []), selectedIdModel]);
        updateCustomModel(activeCategory, selectedDisplayIndex, 'provider_id', item.id);
        updateCustomModel(activeCategory, selectedDisplayIndex, 'model', selectedIdModel);
        setStatus(`已绑到「${customModels?.[activeCategory]?.[selectedDisplayIndex]?.name || ''}」· ${selectedIdModel}`);
        closeModelPicker();
        renderDisplayNameList();
        renderBindingPanel();
        // 同步库存到中转站，避免下次联想为空
        saveProviders();
        return;
    }
    const image = [], chat = [], video = [], audio = [];
    Object.entries(pickerState.selected).forEach(([id, sel]) => {
        if(!sel) return;
        const cat = pickerState.category[id];
        if(cat === 'image') image.push(id);
        else if(cat === 'video') video.push(id);
        else if(cat === 'audio') audio.push(id);
        else chat.push(id);
    });
    item.image_models = image;
    item.chat_models = chat;
    item.video_models = video;
    item.audio_models = audio;
    renderModels('image'); renderModels('chat'); renderModels('video'); renderModels('audio');
    setStatus(`已应用 · 生图 ${image.length} / LLM ${chat.length} / 视频 ${video.length} / 音频 ${audio.length}，点保存生效`);
    closeModelPicker();
}
async function saveKeyOnly(){
    const item = provider();
    if(!item) return;
    const key = keyInput.value.trim();
    if(!key){ alert(tr('api.enterKeyAlert') || '请输入 Key'); return; }
    item.api_key = key;
    const ok = await saveProviders();
    if(ok) keyInput.value = '';
}
async function clearKeyOnly(){
    const item = provider();
    if(!item) return;
    if(!item.has_key && !keyInput.value){ return; }
    if(!confirm(tr('api.confirmClearKey') || '确认清除当前 Key？')) return;
    item._clearKey = true;
    const ok = await saveProviders();
    if(ok) keyInput.value = '';
}
function modelListKey(kind){
    if(kind === 'image') return 'image_models';
    if(kind === 'video') return 'video_models';
    if(kind === 'audio') return 'audio_models';
    return 'chat_models';
}
function renderModels(kind){
    const item = provider();
    const key = modelListKey(kind);
    const list = kind === 'image' ? imageModelList : kind === 'video' ? videoModelList : kind === 'audio' ? audioModelList : chatModelList;
    const models = item?.[key] || [];
    if(!models.length){
        list.innerHTML = `<div class="empty">${tr('api.noModels')}</div>`;
        return;
    }
    list.innerHTML = models.map((model, index) => `
        <div class="model-row">
            <input value="${escapeAttr(model)}" oninput="updateModel('${kind}', ${index}, this.value)">
            <button class="icon-btn" type="button" onclick="removeModel('${kind}', ${index})" title="删除"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
    `).join('');
    refreshIcons();
}
function selectProvider(id){
    if(isProviderTemporarilyHidden(providers.find(item => item.id === id))) return;
    recommendInlineOpen = false;
    syncRecommendView();
    renderRecommendApi();
    if(apiView === 'stations') syncEditor();
    selectedId = id;
    overviewOpen = false;
    apiView = 'stations';
    renderEditor();
}
function addProvider(){
    recommendInlineOpen = false;
    syncRecommendView();
    renderRecommendApi();
    if(apiView === 'stations') syncEditor();
    let id = 'custom-api';
    let index = 2;
    while(providers.some(item => item.id === id)) id = `custom-api-${index++}`;
    providers.push({id, name:'API', base_url:'', protocol:'openai', image_generation_endpoint:'', image_edit_endpoint:'', enabled:true, primary:false, image_models:[], chat_models:[], video_models:[], audio_models:[], has_key:false, key_preview:''});
    selectedId = id;
    overviewOpen = false;
    apiView = 'stations';
    renderEditor();
}
function deleteProvider(){
    const item = provider();
    if(!item) return;
    if(isFixedProvider(item)){ alert(tr('api.defaultNoDelete') || '默认平台不能删除'); return; }
    if(providers.length <= 1){ alert(tr('api.keepOne')); return; }
    providers = providers.filter(p => p.id !== item.id);
    selectedId = providers[0]?.id || '';
    renderEditor();
    saveProviders();
}
function addModel(kind){
    const item = provider();
    const key = modelListKey(kind);
    item[key] = [...(item[key] || []), ''];
    renderModels(kind);
}
function updateModel(kind, index, value){
    const item = provider();
    const key = modelListKey(kind);
    item[key][index] = value;
}
function removeModel(kind, index){
    const item = provider();
    const key = modelListKey(kind);
    item[key].splice(index, 1);
    renderModels(kind);
}
async function loadProviders(){
    setStatus(tr('api.loading'));
    try {
        const data = await fetch('/api/providers').then(r => r.json());
        providers = data.providers || [];
        selectedId = sortedProviders()[0]?.id || '';
        await selectApiCategory(activeCategory || 'image');
        setStatus('');
    } catch(err) {
        setStatus(tr('api.loadFailed'));
    }
}
async function saveProviders(){
    if(apiView === 'stations') syncEditor();
    const activeProviders = visibleProviders();
    activeProviders.forEach(item => {
        item.id = normalizeId(item.id);
        item.protocol = ['openai', 'apimart', 'gemini'].includes(String(item.protocol || '').toLowerCase()) ? String(item.protocol).toLowerCase() : 'openai';
        item.image_generation_endpoint = '';
        item.image_edit_endpoint = '';
        item.image_models = unique(item.image_models || []);
        item.chat_models = unique(item.chat_models || []);
        item.video_models = unique(item.video_models || []);
        item.audio_models = unique(item.audio_models || []);
    });
    if(new Set(activeProviders.map(item => item.id)).size !== activeProviders.length){
        alert(tr('api.duplicateId'));
        return false;
    }
    setStatus(tr('api.saving'));
    try {
        const res = await fetch('/api/providers', {
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(activeProviders.map(item => ({
                id:item.id,
                name:item.name,
                base_url:item.base_url,
                protocol:item.protocol || 'openai',
                image_generation_endpoint:item.image_generation_endpoint || '',
                image_edit_endpoint:item.image_edit_endpoint || '',
                enabled:item.enabled !== false,
                primary:false,
                image_models:item.image_models || [],
                chat_models:item.chat_models || [],
                video_models:item.video_models || [],
                audio_models:item.audio_models || [],
                model_aliases:item.model_aliases || {},
                api_key:item.api_key || undefined,
                clear_key:item._clearKey === true
            })))
        });
        if(!res.ok) throw new Error((await res.json()).detail || tr('api.saveFailed'));
        const data = await res.json();
        providers = data.providers || providers;
        providers.forEach(item => {
            delete item.api_key;
            delete item._clearKey;
        });
        selectedId = provider()?.id || visibleProviders()[0]?.id || '';
        if(apiView === 'category'){
            renderDisplayNameList();
            renderBindingPanel();
            syncApiModeTabs();
        } else if(overviewOpen) {
            renderModelOverview();
        } else {
            renderEditor();
        }
        setStatus(tr('api.saved'));
        broadcastStudioApiChange('providers-changed');
        return true;
    } catch(err) {
        setStatus(err.message || tr('api.saveFailed'));
        return false;
    }
}
function isProviderTemporarilyHidden(item){
    return !item || REMOVED_PROVIDER_IDS.has(String(item.id || '').toLowerCase());
}
function applyProviderOnboardingDefaults(id){
    const item = providers.find(provider => provider.id === id);
    if(!item) return;
    if(id === 'jimeng'){
        item.base_url = '';
        item.protocol = 'jimeng';
        item.image_models = unique([...(item.image_models || []), ...JIMENG_DEFAULT_IMAGE_MODELS]);
        item.video_models = unique([...(item.video_models || []), ...JIMENG_DEFAULT_VIDEO_MODELS]);
    }
    selectedId = item.id;
    renderEditor();
    setStatus('已显示默认配置，填写 Key 后点击保存生效');
}
function renderProviderOnboarding(item){
    if(!providerOnboardingCard) return;
    providerOnboardingCard.hidden = true;
    document.body.classList.toggle('show-provider-onboarding', false);
    providerOnboardingCard.innerHTML = '';
}
function refreshProviderOnboarding(){
    renderProviderOnboarding(provider());
    refreshIcons();
}
function escapeHtml(str){
    return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function escapeAttr(str){ return escapeHtml(str).replace(/`/g, '&#96;'); }
window.addEventListener('message', event => {
    if(event.data?.type === 'studio-theme' && window.StudioTheme) window.StudioTheme.set(event.data.theme);
    if(event.data?.type === 'shell-settings-pane-visible') {
        requestAnimationFrame(() => {
            syncRecommendView();
            if(recommendInlineOpen) renderRecommendApi();
            else if(apiView === 'category') selectApiCategory(activeCategory || 'image');
            else if(overviewOpen) renderModelOverview();
            else renderEditor();
            refreshIcons();
        });
    }
    if(event.data?.type === 'studio-lang' && window.StudioI18n) {
        window.StudioI18n.set(event.data.lang);
        if(recommendInlineOpen) renderRecommendApi();
        else if(apiView === 'category') selectApiCategory(activeCategory || 'image');
        else if(overviewOpen) renderModelOverview();
        else renderEditor();
    }
});
recommendApiOverlay?.addEventListener('mousedown', event => {
    if(event.target === recommendApiOverlay) closeRecommendApi();
});
window.addEventListener('studio-lang-change', () => {
    syncRecommendView();
    if(recommendInlineOpen) renderRecommendApi();
    else if(apiView === 'category') selectApiCategory(activeCategory || 'image');
    else if(overviewOpen) renderModelOverview();
    else renderEditor();
});
window.onload = () => {
    if(window.StudioTheme) window.StudioTheme.apply();
    if(window.StudioI18n) window.StudioI18n.apply();
    syncRecommendView();
    loadProviders();
    // 平台名输入时实时预览生成的 ID
    if(nameInput) nameInput.addEventListener('input', updateIdPreview);
    if(protocolInput) protocolInput.addEventListener('change', updateProtocolFromInput);
    if(keyInput) keyInput.addEventListener('input', refreshProviderOnboarding);
};
