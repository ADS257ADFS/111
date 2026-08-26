/**
 * Studio Chat — Creation mode coding agent page (isolated).
 * HTML shell: static/agent-chat.html
 */
(function(global){
'use strict';

const Core = global.StudioChatCore;
const Coding = global.StudioChatCodingAgent;

function tr(key){ return window.StudioI18n ? StudioI18n.t(key) : key; }
function defaultTitle(){ return 'Coding 对话'; }

function setChatTitle(title){
    const el = document.getElementById('chatTitle');
    if(el) el.textContent = title || defaultTitle();
}

function applyLanguage(lang){
    if(lang && window.StudioI18n) StudioI18n.set(lang);
    document.title = 'Coding Agent';
    if(!currentConversation?.title || currentConversation.title === '新对话') setChatTitle('');
}

let pendingShellConversationId = '';
let bootstrapReady = false;

function openShellConversation(id){
    pendingShellConversationId = String(id || '').trim();
    if(!bootstrapReady || !pendingShellConversationId) return;
    const nextId = pendingShellConversationId;
    pendingShellConversationId = '';
    openConversation(nextId, true).catch(() => {
        pendingShellConversationId = nextId;
    });
}

window.addEventListener('message', event => {
    if(event.origin && event.origin !== location.origin) return;
    const data = event.data || {};
    if(data.type === 'studio-lang') applyLanguage(data.lang);
    if(data.source === 'shell-project-history' && data.type === 'shell-open-agent-conversation'){
        openShellConversation(data.conversation_id);
    }
});
window.addEventListener('studio-lang-change', () => {
    document.title = 'Coding Agent';
    if(!currentConversation?.title || currentConversation.title === '新对话') setChatTitle('');
});

function uuid(){
    if(crypto?.randomUUID) return crypto.randomUUID();
    return 'u-' + Math.random().toString(16).slice(2) + Date.now();
}

const USER_KEY = 'gpt_chat_browser_user';
const userId = 'lightbox-desktop';
localStorage.setItem(USER_KEY, userId);

let currentConversation = null;
let conversations = [];
let provider = 'comfly';
let activeChatModel = '';
let apiProviders = [];
let chatProviderModels = {};
let refs = [];
let config = { chat_model: 'gpt-5.5', image_model: 'gpt-image-1' };
let activeImageProvider = 'comfly';
let activeImageModel = '';
let imageProviderModels = {};

const PERMISSION_KEY = 'coding_permission_level';
const SKILL_KEY = 'coding_agent_skill';
const PERMISSION_LABELS = { ask: '请求批准', auto: '替我审批', full: '完全访问权限' };
let permissionLevel = localStorage.getItem(PERMISSION_KEY) || 'ask';
if(!PERMISSION_LABELS[permissionLevel]) permissionLevel = 'ask';
let codingSkills = [];
let activeSkill = localStorage.getItem(SKILL_KEY) || '';

const conversationUserId = () => `${userId}-agent`;
const headers = () => ({ 'Content-Type': 'application/json', 'X-User-ID': conversationUserId() });

function uniqueModels(list){
    const seen = new Set();
    return (list || []).map(item => String(item || '').trim()).filter(item => item && !seen.has(item) && seen.add(item));
}

function pickCodingChatModel(models){
    const list = uniqueModels(models).filter(m => !/image/i.test(String(m)));
    const fast = list.find(m => /gpt-5|4o|claude|sonnet|deepseek|qwen/i.test(m) && !/pro|customtools|image/i.test(m));
    return fast || list[0] || config.chat_model || 'gpt-4o-mini';
}

function chatProviders(){
    const list = (apiProviders || []).filter(p => p.enabled !== false && (p.chat_models || []).length);
    return list.length ? list : [{ id:'comfly', name:'API', chat_models:[config.chat_model || 'gpt-4o-mini'] }];
}

function providerById(id){
    return chatProviders().find(p => p.id === id) || chatProviders()[0];
}

function shortModelLabel(model){
    const text = String(model || '').trim();
    if(!text) return 'Model';
    return text.split('/').pop().split(':')[0];
}

function imageProviders(){
    const list = (apiProviders || []).filter(p => p.enabled !== false && (p.image_models || []).length);
    return list.length ? list : [{ id:'comfly', name:'API', image_models:[config.image_model || 'gpt-image-1'] }];
}

function imageProviderById(id){
    return imageProviders().find(p => p.id === id) || imageProviders()[0];
}

function pickImageModel(models){
    const list = uniqueModels(models);
    const gpt = list.find(m => /gpt-image/i.test(m));
    return gpt || list[0] || config.image_model || 'gpt-image-1';
}

function renderAgentSettingsPanel(){
    const chatProvSel = document.getElementById('agentChatProviderSelect');
    const chatModelSel = document.getElementById('agentChatModelSelect');
    const imgProvSel = document.getElementById('agentImageProviderSelect');
    const imgModelSel = document.getElementById('agentImageModelSelect');
    if(!chatProvSel || !chatModelSel) return;
    const providers = chatProviders();
    chatProvSel.innerHTML = providers.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || p.id)}</option>`).join('');
    chatProvSel.value = providers.some(p => p.id === provider) ? provider : providers[0].id;
    provider = chatProvSel.value;
    const models = uniqueModels(providerById(provider).chat_models);
    chatModelSel.innerHTML = models.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    activeChatModel = chatProviderModels[provider] && models.includes(chatProviderModels[provider])
        ? chatProviderModels[provider]
        : pickCodingChatModel(models);
    chatModelSel.value = activeChatModel;
    if(imgProvSel && imgModelSel){
        const imgProviders = imageProviders();
        imgProvSel.innerHTML = imgProviders.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || p.id)}</option>`).join('');
        imgProvSel.value = imgProviders.some(p => p.id === activeImageProvider) ? activeImageProvider : imgProviders[0].id;
        activeImageProvider = imgProvSel.value;
        const imageModels = uniqueModels(imageProviderById(activeImageProvider).image_models);
        imgModelSel.innerHTML = imageModels.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
        activeImageModel = imageProviderModels[activeImageProvider] && imageModels.includes(imageProviderModels[activeImageProvider])
            ? imageProviderModels[activeImageProvider]
            : pickImageModel(imageModels);
        imgModelSel.value = activeImageModel;
    }
    updateModelLabel();
}

function setAgentImageProvider(next){
    activeImageProvider = next;
    renderAgentSettingsPanel();
}

function setAgentImageModel(model){
    activeImageModel = model;
    imageProviderModels[activeImageProvider] = model;
}

function syncSkillMenu(){
    document.querySelectorAll('[data-skill]').forEach(el => {
        const id = el.dataset.skill || '';
        const active = id === (activeSkill || '');
        el.classList.toggle('active', active);
        el.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    const label = document.getElementById('composerSkillLabel');
    if(!label) return;
    if(!activeSkill){
        label.textContent = 'Skill';
        return;
    }
    const item = codingSkills.find(s => s.id === activeSkill);
    label.textContent = item?.name || activeSkill;
}

function setActiveSkill(skillId, event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    activeSkill = String(skillId || '').trim();
    localStorage.setItem(SKILL_KEY, activeSkill);
    syncSkillMenu();
    toggleComposerSkillMenu(false);
}

async function toggleComposerSkillMenu(force, event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const panel = document.getElementById('composerSkillMenu');
    const btn = document.getElementById('composerSkillBtn');
    if(!panel) return;
    const shouldOpen = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', shouldOpen);
    btn?.classList.toggle('active', shouldOpen);
    btn?.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if(shouldOpen){
        toggleComposerModelMenu(false);
        toggleComposerPermissionMenu(false);
    }
}

function renderSkillMenu(){
    const list = document.getElementById('composerSkillList');
    if(!list) return;
    const items = [{ id: '', name: '无 Skill', description: '通用 Coding Agent' }, ...codingSkills];
    list.innerHTML = items.map(item => `
        <button type="button" class="composer-mode-option${item.id === activeSkill ? ' active' : ''}" data-skill="${escapeHtml(item.id)}" onclick="setActiveSkill('${escapeHtml(item.id)}', event)" role="menuitemradio" aria-checked="${item.id === activeSkill ? 'true' : 'false'}">
            <span class="composer-mode-option-inner">
                <span class="composer-mode-option-title">${escapeHtml(item.name || item.id || 'Skill')}</span>
                <span class="composer-mode-option-hint">${escapeHtml(item.description || '')}</span>
            </span>
        </button>
    `).join('');
    syncSkillMenu();
}

async function loadCodingSkills(){
    try {
        const data = await fetch('/api/studio-coding/skills').then(r => r.json());
        codingSkills = Array.isArray(data?.skills) ? data.skills : [];
        if(activeSkill && !codingSkills.some(s => s.id === activeSkill)){
            activeSkill = '';
            localStorage.setItem(SKILL_KEY, '');
        }
        renderSkillMenu();
    } catch(e) {
        renderSkillMenu();
    }
}

function syncPermissionMenu(){
    document.querySelectorAll('[data-permission]').forEach(el => {
        const active = el.dataset.permission === permissionLevel;
        el.classList.toggle('active', active);
        el.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    const label = document.getElementById('composerPermissionLabel');
    if(label) label.textContent = PERMISSION_LABELS[permissionLevel] || PERMISSION_LABELS.ask;
}

function setPermissionLevel(level, event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if(!PERMISSION_LABELS[level]) return;
    permissionLevel = level;
    localStorage.setItem(PERMISSION_KEY, level);
    syncPermissionMenu();
    toggleComposerPermissionMenu(false);
}

async function toggleComposerPermissionMenu(force, event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const panel = document.getElementById('composerPermissionMenu');
    const btn = document.getElementById('composerPermissionBtn');
    if(!panel) return;
    const shouldOpen = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', shouldOpen);
    btn?.classList.toggle('active', shouldOpen);
    btn?.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if(shouldOpen) toggleComposerModelMenu(false);
}

function setAgentChatProvider(next){
    provider = next;
    renderAgentSettingsPanel();
}

function setActiveModel(model){
    activeChatModel = model;
    chatProviderModels[provider] = model;
    updateModelLabel();
}

function updateModelLabel(){
    const chat = shortModelLabel(activeChatModel || config.chat_model || 'Chat');
    const topLabel = document.getElementById('modelLabel');
    if(topLabel) topLabel.textContent = chat;
    const composerModelLabel = document.getElementById('composerModelLabel');
    if(composerModelLabel) composerModelLabel.textContent = chat;
}

async function toggleComposerModelMenu(force, event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const panel = document.getElementById('apiSettingsPanel');
    const btn = document.getElementById('composerModelBtn');
    if(!panel) return;
    const shouldOpen = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', shouldOpen);
    btn?.classList.toggle('active', shouldOpen);
    btn?.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if(shouldOpen){
        renderAgentSettingsPanel();
        global.lucide?.createIcons?.();
    }
}

async function loadConfig(){
    try {
        const data = await fetch('/api/config').then(r => r.json());
        config = { ...config, ...data };
        apiProviders = Array.isArray(config.api_providers) ? config.api_providers : [];
        const providers = chatProviders();
        provider = providers.some(p => p.id === provider) ? provider : (providers[0]?.id || 'comfly');
        activeChatModel = chatProviderModels[provider] || pickCodingChatModel(providerById(provider).chat_models);
        renderAgentSettingsPanel();
    } catch(e) {}
}

try {
    const apiChannel = new BroadcastChannel('studio-api');
    apiChannel.onmessage = async e => {
        if(e.data?.type === 'providers-changed'){
            await loadConfig();
            renderAgentSettingsPanel();
            updateModelLabel();
        }
    };
} catch(e) {}

async function loadConversations(){
    const data = await fetch('/api/conversations', { headers: { 'X-User-ID': conversationUserId() } }).then(r => r.json());
    conversations = data.conversations || [];
    renderThreads();
    if(!currentConversation && conversations[0]) await openConversation(conversations[0].id);
    if(!currentConversation) renderMessages([]);
}

function renderThreads(){
    const list = document.getElementById('threadList');
    if(!list) return;
    list.innerHTML = '';
    if(!conversations.length){
        list.innerHTML = `<div class="px-3 py-8 text-center text-[11px] font-bold text-gray-300 uppercase tracking-widest">${tr('chat.noHistory')}</div>`;
        return;
    }
    conversations.forEach(item => {
        const row = document.createElement('div');
        row.className = 'thread-row';
        const btn = document.createElement('button');
        btn.className = `thread-item ${currentConversation?.id === item.id ? 'active' : ''}`;
        btn.onclick = () => openConversation(item.id, true);
        btn.innerHTML = `<div class="text-sm font-bold truncate">${item.pinned ? '★ ' : ''}${escapeHtml(item.title || defaultTitle())}</div><div class="text-[11px] opacity-50 truncate mt-1">${escapeHtml(item.last_message || '')}</div>`;
        const pin = document.createElement('button');
        pin.className = `thread-action ${item.pinned ? 'active' : ''}`;
        pin.title = item.pinned ? '取消置顶' : '置顶';
        pin.onclick = event => toggleConversationPinned(item.id, !item.pinned, event);
        pin.innerHTML = `<i data-lucide="${item.pinned ? 'pin-off' : 'pin'}" class="w-4 h-4"></i>`;
        const rename = document.createElement('button');
        rename.className = 'thread-action';
        rename.title = '重命名';
        rename.onclick = event => renameConversation(item.id, item.title || defaultTitle(), event);
        rename.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i>';
        const del = document.createElement('button');
        del.className = 'thread-delete';
        del.title = tr('chat.deleteTitle');
        del.onclick = event => deleteConversation(item.id, event);
        del.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
        row.appendChild(btn);
        row.appendChild(pin);
        row.appendChild(rename);
        row.appendChild(del);
        list.appendChild(row);
    });
    global.lucide?.createIcons?.();
}

async function newConversation(){
    const data = await fetch('/api/conversations', {
        method:'POST',
        headers: headers(),
        body: JSON.stringify({ title:'Coding 对话' }),
    }).then(r => r.json());
    currentConversation = data.conversation;
    setChatTitle(currentConversation.title || defaultTitle());
    await loadConversations();
    renderMessages([]);
    toggleHistory(false);
}

async function openConversation(id, closePanel=false){
    const data = await fetch(`/api/conversations/${id}`, { headers: { 'X-User-ID': conversationUserId() } }).then(r => r.json());
    currentConversation = data.conversation;
    setChatTitle(currentConversation.title || defaultTitle());
    renderThreads();
    renderMessages(currentConversation.messages || []);
    if(closePanel) toggleHistory(false);
}

async function deleteConversation(id, event){
    event.stopPropagation();
    if(!confirm(tr('chat.deleteConfirm'))) return;
    await fetch(`/api/conversations/${id}`, { method:'DELETE', headers: headers() });
    const deletedCurrent = currentConversation?.id === id;
    if(deletedCurrent){ currentConversation = null; setChatTitle(defaultTitle()); renderMessages([]); }
    await loadConversations();
    if(deletedCurrent && conversations[0]) await openConversation(conversations[0].id);
}

async function updateConversationMeta(id, patch){
    const data = await fetch(`/api/conversations/${id}`, {
        method:'PATCH',
        headers: headers(),
        body: JSON.stringify(patch),
    }).then(async r => {
        if(!r.ok) throw new Error(await r.text());
        return r.json();
    });
    if(currentConversation?.id === id){
        currentConversation = data.conversation;
        setChatTitle(currentConversation.title || defaultTitle());
    }
    await loadConversations();
    return data.conversation;
}

async function renameConversation(id, title, event){
    event?.stopPropagation?.();
    const next = prompt('新的对话名称', title || defaultTitle());
    if(!next || next.trim() === title) return;
    try {
        await updateConversationMeta(id, { title: next.trim() });
    } catch(e) {
        alert('重命名失败');
    }
}

async function toggleConversationPinned(id, pinned, event){
    event?.stopPropagation?.();
    try {
        await updateConversationMeta(id, { pinned });
    } catch(e) {
        alert('置顶操作失败');
    }
}

async function toggleHistory(force, event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const pop = document.getElementById('historyPopover');
    const shouldOpen = typeof force === 'boolean' ? force : !pop.classList.contains('open');
    pop.classList.toggle('open', shouldOpen);
    if(shouldOpen){
        try { await loadConversations(); } catch(e) { renderThreads(); }
        global.lucide?.createIcons?.();
    }
}

document.addEventListener('click', event => {
    const actions = document.querySelector('.top-actions');
    if(actions && !actions.contains(event.target)) toggleHistory(false);
    const modelWrap = document.querySelector('.composer-pill-model')?.closest('.composer-pill-wrap');
    if(modelWrap && !modelWrap.contains(event.target)) toggleComposerModelMenu(false);
    const permWrap = document.querySelector('.composer-pill-permission')?.closest('.composer-pill-wrap');
    if(permWrap && !permWrap.contains(event.target)) toggleComposerPermissionMenu(false);
});

function renderMessages(messages){
    const box = document.getElementById('messages');
    if(!box) return;
    box.innerHTML = '';
    if(!messages.length){
        const empty = document.createElement('div');
        empty.className = 'm-auto text-center opacity-20 coding-empty-state';
        empty.innerHTML = `<i data-lucide="code-2" class="w-14 h-14 mx-auto stroke-[1px]"></i><div class="text-[10px] font-black tracking-[0.5em] uppercase mt-4">CODING AGENT</div><div class="text-[11px] mt-3 opacity-70">写代码 · 生图 · 运行命令 · 磁盘清理（Codex 风格）</div>`;
        box.appendChild(empty);
        global.lucide?.createIcons?.();
    } else {
        messages.forEach(msg => addMessageBubble(msg));
    }
    scrollBottom();
}

function addMessageBubble(msg, insertBefore){
    const box = document.getElementById('messages');
    const row = document.createElement('div');
    row.className = `bubble-row ${msg.role === 'user' ? 'user' : 'assistant'}`;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${msg.role === 'user' ? 'user' : 'assistant'}`;
    const text = document.createElement('div');
    text.textContent = msg.content || '';
    text.className = 'bubble-text';
    bubble.appendChild(text);
    if(msg.attachments?.length){
        const thumbs = document.createElement('div');
        thumbs.className = 'thumbs';
        msg.attachments.forEach(ref => {
            if(ref.kind === 'image') thumbs.insertAdjacentHTML('beforeend', `<img class="thumb" src="${escapeHtml(ref.url)}" title="${escapeHtml(ref.name || '')}">`);
            else thumbs.insertAdjacentHTML('beforeend', `<div class="message-file"><i data-lucide="file-text" class="w-4 h-4"></i><span>${escapeHtml(ref.name || ref.kind || '文件')}</span></div>`);
        });
        bubble.appendChild(thumbs);
    }
    if(msg.image_url){
        const img = document.createElement('img');
        img.className = 'generated';
        img.src = msg.image_url;
        img.alt = '生成的图片';
        img.onclick = () => openImagePreview(msg.image_url);
        bubble.appendChild(img);
    }
    if(msg.role === 'assistant' && msg.model){
        const badge = document.createElement('div');
        badge.style.cssText = 'margin-top:8px;font-size:10px;font-weight:600;opacity:.45;letter-spacing:.06em;';
        badge.textContent = shortModelLabel(msg.model);
        bubble.appendChild(badge);
    }
    row.appendChild(bubble);
    if(insertBefore && insertBefore.parentElement === box) box.insertBefore(row, insertBefore);
    else box.appendChild(row);
    global.lucide?.createIcons?.();
    const thinking = {
        note(line){
            if(!line) return;
            const el = bubble.querySelector('.coding-thinking') || (() => {
                const node = document.createElement('div');
                node.className = 'coding-thinking';
                bubble.insertBefore(node, text);
                return node;
            })();
            el.textContent = line;
        },
    };
    return { row, bubble, text, thinking, showApproval(event){
        return new Promise(resolve => {
            const box = bubble.querySelector('.coding-approval') || (() => {
                const node = document.createElement('div');
                node.className = 'coding-approval';
                bubble.insertBefore(node, text);
                return node;
            })();
            box.innerHTML = `<div class="coding-approval-summary">⚠️ 需要你点「批准」才会继续：${escapeHtml(event.summary || '操作')}</div>
                <div class="coding-approval-actions">
                    <button type="button" class="coding-approval-deny">拒绝</button>
                    <button type="button" class="coding-approval-approve">批准</button>
                </div>`;
            box.querySelector('.coding-approval-approve').onclick = () => { box.remove(); resolve(true); };
            box.querySelector('.coding-approval-deny').onclick = () => { box.remove(); resolve(false); };
            scrollBottom();
        });
    } };
}

async function uploadFiles(files){
    if(!files?.length) return;
    const form = new FormData();
    for(const file of [...files].slice(0, 8 - refs.length)){
        form.append('files', file);
    }
    const data = await fetch('/api/ai/upload', { method:'POST', body: form }).then(async r => {
        const body = await r.json();
        if(!r.ok) throw new Error(body.detail || '文件上传失败');
        return body;
    }).catch(error => { alert(error.message || '文件上传失败'); return { files:[] }; });
    refs.push(...(data.files || []));
    renderRefs();
}

function renderRefs(){
    const strip = document.getElementById('refStrip');
    if(!strip) return;
    strip.innerHTML = refs.map((ref, i) => `<div class="ref-chip">
        ${ref.kind === 'image' ? `<img class="ref-preview" src="${escapeHtml(ref.url)}">` : `<span class="ref-preview"><i data-lucide="file-text"></i></span>`}
        <span style="min-width:0"><div class="ref-name">${escapeHtml(ref.name || '文件')}</div><div class="ref-kind">${escapeHtml(ref.kind || 'file')}</div></span>
        <button onclick="removeRef(${i})">×</button>
    </div>`).join('');
    global.lucide?.createIcons?.();
}

function removeRef(i){ refs.splice(i, 1); renderRefs(); }

const COMPOSER_CHROME_HEIGHT = 98;
const COMPOSER_INPUT_MIN = 59;
const COMPOSER_INPUT_MAX = 360;
const COMPOSER_HEIGHT_KEY = 'coding_composer_input_height';

function getComposerShell(){
    return document.getElementById('composerV2') || document.querySelector('.agent-shell .composer-v2');
}

function readComposerInputHeight(){
    const saved = parseInt(localStorage.getItem(COMPOSER_HEIGHT_KEY) || '', 10);
    if(Number.isFinite(saved)) return Math.max(COMPOSER_INPUT_MIN, Math.min(COMPOSER_INPUT_MAX, saved));
    return COMPOSER_INPUT_MIN;
}

function applyComposerInputHeight(height, remember=true){
    const shell = getComposerShell();
    const input = document.getElementById('messageInput');
    if(!shell || !input) return;
    const next = Math.max(COMPOSER_INPUT_MIN, Math.min(COMPOSER_INPUT_MAX, Math.round(height)));
    shell.style.setProperty('--composer-input-height', `${next}px`);
    shell.style.minHeight = `${COMPOSER_CHROME_HEIGHT + next}px`;
    input.style.height = `${next}px`;
    if(remember) localStorage.setItem(COMPOSER_HEIGHT_KEY, String(next));
}

function bindComposerResize(){
    const handle = document.getElementById('composerResizeHandle');
    if(!handle || handle.dataset.bound) return;
    handle.dataset.bound = '1';
    applyComposerInputHeight(readComposerInputHeight(), false);
    let startY = 0;
    let startHeight = COMPOSER_INPUT_MIN;
    const onMove = e => applyComposerInputHeight(startHeight + (startY - e.clientY));
    const onUp = e => {
        document.body.classList.remove('is-composer-resizing');
        if(e?.pointerId != null){
            try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };
    handle.addEventListener('pointerdown', e => {
        if(e.button !== 0) return;
        e.preventDefault();
        startY = e.clientY;
        const input = document.getElementById('messageInput');
        startHeight = input?.offsetHeight >= COMPOSER_INPUT_MIN ? input.offsetHeight : readComposerInputHeight();
        document.body.classList.add('is-composer-resizing');
        handle.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    });
}

function autoGrow(el){
    if(!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_INPUT_MAX)}px`;
}

function handleKey(e){
    if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        sendMessage();
    }
}

async function sendMessage(){
    const input = document.getElementById('messageInput');
    const message = input.value.trim() || (refs.length ? '请读取并分析这些附件。' : '');
    if(!message) return;
    const btn = document.getElementById('sendBtn');
    btn.disabled = true;
    const pendingRefs = refs.slice();
    refs = [];
    renderRefs();
    input.value = '';
    autoGrow(input);
    if(!currentConversation){
        currentConversation = { id:'', title: defaultTitle(), messages:[] };
        document.getElementById('messages').innerHTML = '';
    }
    addMessageBubble({ role:'user', content: message, attachments: pendingRefs });
    const assistantBubble = addMessageBubble({ role:'assistant', content: '' });
    assistantBubble.bubble.classList.add('streaming');
    scrollBottom();
    try {
        await Coding.streamCodingAgent({
            headers: headers(),
            body: {
                conversation_id: currentConversation?.id || '',
                message,
                model: activeChatModel || config.chat_model,
                image_model: activeImageModel || config.image_model,
                image_provider: activeImageProvider || provider,
                provider,
                permission_level: permissionLevel,
                agent_skill: activeSkill || '',
                reference_images: pendingRefs,
            },
        }, assistantBubble, {
            onMeta(conversation){
                currentConversation = conversation;
                setChatTitle(conversation.title || defaultTitle());
            },
            onApprovalRequired(event){
                return assistantBubble.showApproval(event);
            },
            onDone(conversation){
                currentConversation = conversation;
                setChatTitle(conversation.title || defaultTitle());
                renderMessages(conversation.messages || []);
                loadConversations().catch(() => {});
            },
        });
    } catch(err){
        assistantBubble.bubble.classList.remove('streaming');
        assistantBubble.text.textContent = err.message || tr('chat.requestFailed');
    } finally {
        btn.disabled = false;
        scrollBottom();
    }
}

function scrollBottom(){
    requestAnimationFrame(() => {
        const box = document.getElementById('messages');
        if(box) box.scrollTop = box.scrollHeight;
    });
}

function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
}

async function checkCodingAgentHealth(){
    try {
        const res = await fetch('/api/studio-coding/health');
        if(!res.ok) throw new Error('missing');
        const data = await res.json();
        window.__codingAgentEngine = data?.engine || '';
        return Boolean(data?.ok) && String(data?.engine || '').includes('v5');
    } catch(e) {
        return false;
    }
}

function showCodingAgentBanner(outdated){
    const box = document.getElementById('messages');
    if(!box || box.querySelector('.coding-health-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'coding-health-banner';
    banner.innerHTML = outdated
        ? '<strong>Coding Agent 版本过旧</strong><br>请关闭 run.bat 窗口，重新双击 run.bat 启动，然后按 Ctrl+F5 强刷。当前引擎：' + escapeHtml(window.__codingAgentEngine || 'unknown')
        : '<strong>Coding Agent 后端未就绪</strong><br>请关闭黑色命令行窗口，重新双击 run.bat 启动，然后按 Ctrl+F5 刷新本页。';
    box.prepend(banner);
}

function openImagePreview(url){
    if(!url) return;
    window.open(url, '_blank');
}

async function bootstrap(){
    applyLanguage();
    setChatTitle(defaultTitle());
    renderMessages([]);
    syncPermissionMenu();
    await loadCodingSkills();
    const healthy = await checkCodingAgentHealth();
    if(!healthy){
        let outdated = false;
        try {
            const res = await fetch('/api/studio-coding/health');
            outdated = res.ok;
        } catch(e) {}
        showCodingAgentBanner(outdated);
    }
    await loadConfig();
    renderAgentSettingsPanel();
    updateModelLabel();
    bindComposerResize();
    try { await loadConversations(); } catch(e) { renderMessages([]); }
    bootstrapReady = true;
    if(pendingShellConversationId){
        const nextId = pendingShellConversationId;
        pendingShellConversationId = '';
        try { await openConversation(nextId, true); }
        catch(_err) { pendingShellConversationId = nextId; }
    }
    global.lucide?.createIcons?.();
}

const windowExports = {
    newConversation,
    toggleHistory,
    toggleComposerModelMenu,
    toggleComposerPermissionMenu,
    toggleComposerSkillMenu,
    setActiveSkill,
    setPermissionLevel,
    setAgentChatProvider,
    setAgentImageProvider,
    setAgentImageModel,
    setActiveModel,
    sendMessage,
    autoGrow,
    handleKey,
    removeRef,
    uploadFiles,
    openImagePreview,
};

Object.assign(global, windowExports);
Core.register('codingApp', Object.freeze({ bootstrap, ...windowExports }));

if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => { bootstrap().catch(console.error); });
} else {
    bootstrap().catch(console.error);
}

})(window);
