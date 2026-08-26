const state = {base_url:'https://www.runninghub.cn', apps:[], workflows:[], has_key:false, key_preview:''};
let activeTab = 'apps';
let editingIndex = -1;
let draftFields = [];
let draftWorkflow = {};

const $ = id => document.getElementById(id);
const baseUrlInput = $('baseUrlInput');
const keyInput = $('keyInput');
const keyState = $('keyState');
const statusEl = $('status');
const entryList = $('entryList');
const addEntryBtn = $('addEntryBtn');
const entryDialog = $('entryDialog');
const entryForm = $('entryForm');
const titleInput = $('entryTitleInput');
const remoteIdInput = $('entryRemoteIdInput');
const nodeInfoInput = $('nodeInfoInput');
const workflowFileInput = $('workflowFileInput');
const inspectSummary = $('inspectSummary');

function escapeHtml(value){
    return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function setStatus(message='', tone=''){
    statusEl.textContent = message;
    statusEl.className = `status ${tone}`.trim();
}

function refreshIcons(){ if(window.lucide) window.lucide.createIcons(); }

function entries(){ return activeTab === 'apps' ? state.apps : state.workflows; }
function remoteKey(){ return activeTab === 'apps' ? 'appId' : 'workflowId'; }

function broadcastChange(){
    const message = {type:'runninghub-settings-changed'};
    try { new BroadcastChannel('studio-api').postMessage(message); } catch(e) {}
    try { window.parent?.postMessage(message, '*'); } catch(e) {}
}

function renderConnection(){
    baseUrlInput.value = state.base_url || 'https://www.runninghub.cn';
    keyState.textContent = state.has_key ? `已配置 ${state.key_preview || ''}` : '未配置';
}

function renderEntries(){
    const list = entries();
    addEntryBtn.querySelector('span').textContent = activeTab === 'apps' ? '新增 AI 应用' : '新增工作流';
    document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === activeTab));
    if(!list.length){
        entryList.innerHTML = `<div class="empty"><i data-lucide="${activeTab === 'apps' ? 'boxes' : 'workflow'}"></i><strong>暂无${activeTab === 'apps' ? ' AI 应用' : '工作流'}</strong><small>点击右上角新增，保存后即可在无限画布调用。</small></div>`;
        refreshIcons();
        return;
    }
    entryList.innerHTML = list.map((entry, index) => `
        <article class="entry-card">
            <div class="entry-top">
                <div><div class="entry-title">${escapeHtml(entry.title)}</div><div class="entry-id">${escapeHtml(entry[remoteKey()] || '')}</div></div>
                <button class="switch ${entry.enabled !== false ? 'on' : ''}" type="button" data-toggle="${index}" aria-label="启用或停用"></button>
            </div>
            <div class="entry-meta"><span class="chip">参数 ${Array.isArray(entry.fields) ? entry.fields.length : 0}</span>${activeTab === 'workflows' ? `<span class="chip">${Object.keys(entry.workflowJson || {}).length ? 'JSON 已就绪' : '未保存 JSON'}</span>` : ''}</div>
            <div class="entry-actions"><button class="ghost" type="button" data-edit="${index}"><i data-lucide="pencil"></i>编辑</button><span class="spacer"></span><button class="ghost danger" type="button" data-delete="${index}"><i data-lucide="trash-2"></i>删除</button></div>
        </article>`).join('');
    entryList.querySelectorAll('[data-toggle]').forEach(button => button.onclick = () => toggleEntry(Number(button.dataset.toggle)));
    entryList.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => openDialog(Number(button.dataset.edit)));
    entryList.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => deleteEntry(Number(button.dataset.delete)));
    refreshIcons();
}

async function request(url, options={}){
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if(!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
    return data;
}

async function loadSettings(){
    setStatus('正在加载...');
    try {
        Object.assign(state, await request('/api/runninghub/settings', {cache:'no-store'}));
        state.apps = Array.isArray(state.apps) ? state.apps : [];
        state.workflows = Array.isArray(state.workflows) ? state.workflows : [];
        renderConnection();
        renderEntries();
        setStatus('');
    } catch(error){ setStatus(error.message || '加载失败', 'error'); }
}

async function persistSettings({includeKey=false, clearKey=false}={}){
    const payload = {base_url:baseUrlInput.value, apps:state.apps, workflows:state.workflows, clear_key:clearKey};
    if(includeKey && keyInput.value.trim()) payload.api_key = keyInput.value.trim();
    const data = await request('/api/runninghub/settings', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    Object.assign(state, data);
    keyInput.value = '';
    renderConnection();
    renderEntries();
    broadcastChange();
    return data;
}

function openDialog(index=-1){
    editingIndex = index;
    const entry = index >= 0 ? entries()[index] : null;
    draftFields = Array.isArray(entry?.fields) ? JSON.parse(JSON.stringify(entry.fields)) : [];
    draftWorkflow = entry?.workflowJson && typeof entry.workflowJson === 'object' ? JSON.parse(JSON.stringify(entry.workflowJson)) : {};
    $('dialogTitle').textContent = `${entry ? '编辑' : '新增'}${activeTab === 'apps' ? ' AI 应用' : '工作流'}`;
    $('dialogHint').textContent = activeTab === 'apps' ? '填写应用 ID，并粘贴详情页提供的 nodeInfoList。' : '输入工作流 ID 自动读取；失败时选择导出的 API JSON。';
    $('remoteIdLabel').textContent = activeTab === 'apps' ? 'AI 应用 ID' : '工作流 ID';
    remoteIdInput.placeholder = activeTab === 'apps' ? 'webappId' : 'workflowId';
    titleInput.value = entry?.title || '';
    remoteIdInput.value = entry?.[remoteKey()] || '';
    nodeInfoInput.value = activeTab === 'apps' && draftFields.length ? JSON.stringify(draftFields.map(field => ({nodeId:field.nodeId,fieldName:field.fieldName,fieldValue:field.fieldValue})), null, 2) : '';
    $('nodeInfoField').hidden = activeTab !== 'apps';
    $('workflowFileField').hidden = activeTab !== 'workflows';
    workflowFileInput.value = '';
    updateInspectSummary();
    entryDialog.showModal();
    refreshIcons();
}

function closeDialog(){ entryDialog.close(); }

function updateInspectSummary(){
    inspectSummary.textContent = draftFields.length ? `已识别 ${draftFields.length} 个参数` : '尚未识别参数';
    inspectSummary.classList.toggle('ok', draftFields.length > 0);
}

async function inspectEntry(){
    const id = remoteIdInput.value.trim();
    if(!id) throw new Error(`请填写${activeTab === 'apps' ? '应用' : '工作流'} ID`);
    if(activeTab === 'apps'){
        let nodeInfoList;
        try { nodeInfoList = JSON.parse(nodeInfoInput.value || '[]'); } catch(e) { throw new Error('nodeInfoList 不是有效 JSON'); }
        if(!Array.isArray(nodeInfoList)) throw new Error('nodeInfoList 必须是数组');
        const data = await request('/api/runninghub/apps/inspect', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({webappId:id,nodeInfoList})});
        draftFields = data.fields || [];
    } else {
        const file = workflowFileInput.files?.[0];
        let url = '/api/runninghub/workflows/inspect';
        let workflow;
        if(file){
            try { workflow = JSON.parse(await file.text()); } catch(e) { throw new Error('工作流文件不是有效 JSON'); }
            url = '/api/runninghub/workflows/import';
        }
        const data = await request(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({workflowId:id,workflow})});
        draftFields = data.fields || [];
        draftWorkflow = data.workflowJson || {};
    }
    updateInspectSummary();
}

async function saveEntry(event){
    event.preventDefault();
    try {
        if(!draftFields.length) await inspectEntry();
        const entry = {id:entries()[editingIndex]?.id || '', title:titleInput.value.trim(), enabled:entries()[editingIndex]?.enabled !== false, fields:draftFields, [remoteKey()]:remoteIdInput.value.trim()};
        if(activeTab === 'workflows'){ entry.workflowJson = draftWorkflow; entry.optionalImageMode = 'prune-workflow'; }
        if(editingIndex >= 0) entries()[editingIndex] = entry;
        else entries().push(entry);
        setStatus('正在保存...');
        await persistSettings();
        closeDialog();
        setStatus('已保存', 'ok');
    } catch(error){ setStatus(error.message || '保存失败', 'error'); }
}

async function toggleEntry(index){
    entries()[index].enabled = entries()[index].enabled === false;
    try { await persistSettings(); setStatus('已更新', 'ok'); } catch(error){ entries()[index].enabled = !entries()[index].enabled; renderEntries(); setStatus(error.message, 'error'); }
}

async function deleteEntry(index){
    const entry = entries()[index];
    if(!entry || !confirm(`确认删除“${entry.title}”？`)) return;
    const removed = entries().splice(index, 1)[0];
    try { await persistSettings(); setStatus('已删除', 'ok'); } catch(error){ entries().splice(index, 0, removed); renderEntries(); setStatus(error.message, 'error'); }
}

document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { activeTab = button.dataset.tab; renderEntries(); });
addEntryBtn.onclick = () => openDialog(-1);
$('saveSettingsBtn').onclick = async () => { try { setStatus('正在保存...'); await persistSettings({includeKey:true}); setStatus('设置已保存', 'ok'); } catch(error){ setStatus(error.message, 'error'); } };
$('clearKeyBtn').onclick = async () => { if(!confirm('确认清除 RunningHub API Key？')) return; try { await persistSettings({clearKey:true}); setStatus('Key 已清除', 'ok'); } catch(error){ setStatus(error.message, 'error'); } };
$('inspectBtn').onclick = async () => { try { setStatus('正在识别参数...'); await inspectEntry(); setStatus('参数识别完成', 'ok'); } catch(error){ setStatus(error.message, 'error'); } };
entryForm.onsubmit = saveEntry;
$('dialogCloseBtn').onclick = closeDialog;
$('entryCancelBtn').onclick = closeDialog;
window.addEventListener('message', event => { if(event.data?.type === 'studio-theme'){ document.documentElement.classList.toggle('theme-dark', event.data.theme === 'dark'); } });

loadSettings();
refreshIcons();
