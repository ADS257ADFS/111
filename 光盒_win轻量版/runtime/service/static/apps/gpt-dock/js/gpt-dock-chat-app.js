/**
 * GPT Dock Chat — 右侧栏对话（与 studio-chat/agent 不共用）
 */
(function(global){
'use strict';
const Core = global.GptDockChatCore;

function tr(key){ return window.StudioI18n ? StudioI18n.t(key) : key; }
function isDefaultChatTitle(title){
    const raw = String(title || '').trim();
    return !raw || raw === '新对话' || raw === 'New Chat' || raw === '未命名项目' || raw === '未命名对话' || raw === 'Untitled Project' || raw === 'Untitled Chat';
}
function isAutoDerivedChatTitle(title){
    const raw = String(title || '').trim();
    if(!raw || isDefaultChatTitle(raw)) return false;
    const firstUser = (currentConversation?.messages || []).find(item => item && item.role === 'user');
    if(!firstUser) return false;
    const derived = String(firstUser.content || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return Boolean(derived) && raw === derived;
}
function defaultTitle(){ return tr('chat.newConversation'); }
function setChatTitle(title){
    const text = (isDefaultChatTitle(title) || isAutoDerivedChatTitle(title)) ? defaultTitle() : String(title).trim();
    const el = document.getElementById('chatTitle');
    if(el) el.textContent = text;
    if(window.parent !== window){
        try {
            window.parent.postMessage({
                type: 'gpt-dock-chat-title',
                title: text,
                conversation_id: currentConversation?.id || '',
            }, location.origin);
        } catch(e) {}
    }
}
function applyLanguage(lang){
    if(lang && window.StudioI18n) StudioI18n.set(lang);
    document.title = tr('chat.title');
    if(isDefaultChatTitle(currentConversation?.title) || isAutoDerivedChatTitle(currentConversation?.title)) setChatTitle('');
    renderThreads();
}
let dockCanvasGenState = null;
const CHAT_RESULTS_STAY_IN_DOCK = true;

window.addEventListener('message', event => {
    if(event.origin && event.origin !== location.origin) return;
    const data = event.data || {};
    if(data.type === 'studio-lang') applyLanguage(data.lang);
    if(data.type === 'lightbox-compact-mode') document.documentElement.classList.toggle('lightbox-compact-mode', Boolean(data.on));
    if(data.source === 'shell' && data.type === 'dock-shell-new') newConversation();
    if(data.source === 'shell-project-history' && data.type === 'shell-open-chat-conversation' && data.conversation_id){
        void openConversation(String(data.conversation_id), true);
    }
    if(data.source === 'shell-project-history' && data.type === 'shell-chat-conversation-deleted' && data.conversation_id){
        void handleExternalConversationDeleted(String(data.conversation_id));
    }
    if(data.source === 'shell-bridge' && data.type === 'dock-canvas-node-output'){
        onDockCanvasNodeOutput(data.images || []);
    }
    if(data.source === 'shell-bridge' && data.type === 'dock-add-attachments'){
        addExternalRefs(data.attachments || []);
    }
});
window.addEventListener('studio-lang-change', () => {
    document.title = tr('chat.title');
    if(isDefaultChatTitle(currentConversation?.title) || isAutoDerivedChatTitle(currentConversation?.title)) setChatTitle('');
    renderThreads();
});
function uuid(){
    if(crypto?.randomUUID) return crypto.randomUUID();
    return 'u-' + Math.random().toString(16).slice(2) + Date.now();
}

const USER_KEY = 'gpt_chat_browser_user';
const userId = 'lightbox-desktop';
localStorage.setItem(USER_KEY, userId);

let conversations = [];
let currentConversation = null;
let mode = 'chat';
let provider = 'comfly';
let activeChatModel = '';
let activeImageProvider = 'comfly';
let activeImageModel = '';
let apiProviders = [];
let chatProviderModels = {};
let chatRatio = 'square';
let chatResolution = '1k';
let refs = [];
let availableAgentSkills = [];
let activeAgentSkill = '';
const ECOMMERCE_SKILL_ID = 'ecommerce-design';
const ECOMMERCE_WIZARD_TOTAL_STEPS = 6;
const ECOMMERCE_INTERNAL_MARKER = '\n\n[[ECOMMERCE_WORKFLOW_INTERNAL]]\n';
const ECOMMERCE_DESIGN_TYPES = Object.freeze([
    {id:'main-image', label:'商品主图', description:'白底图、营销主图、场景主图或广告图', icon:'image'},
    {id:'detail-page', label:'商品详情页', description:'按内容自动组合模块，可扩展到 10 屏以上', icon:'panels-top-left'},
    {id:'full-set', label:'主图 + 详情页一套', description:'统一风格，成套输出主图与详情页', icon:'package-check'},
]);
const ECOMMERCE_DELIVERY_PLANS = Object.freeze({
    'main-image': [
        {id:'single', label:'1张试做', description:'先确认一张主图方向', summary:'主图1张', confirmLabel:'确认并生成1张'},
        {id:'series-3', label:'3张系列', description:'统一风格，不同主图用途', summary:'系列主图3张', confirmLabel:'确认并生成3张'},
        {id:'series-5', label:'5张系列', description:'白底、营销、场景等智能搭配', summary:'系列主图5张', confirmLabel:'确认并生成5张'},
    ],
    'detail-page': [
        {id:'compact', label:'精简版', description:'约3–5屏，突出核心卖点', summary:'详情页3–5屏', confirmLabel:'确认并生成3–5屏'},
        {id:'standard', label:'标准版', description:'约6–8屏，完整介绍商品', summary:'详情页6–8屏', confirmLabel:'确认并生成6–8屏'},
        {id:'complete', label:'完整版', description:'约10–15屏，按内容自动扩展', summary:'详情页10–15屏', confirmLabel:'确认并生成完整详情页'},
    ],
    'full-set': [
        {id:'light-set', label:'轻量套装', description:'主图3张 + 详情页5屏', summary:'主图3张 + 详情页5屏', confirmLabel:'确认并生成轻量套装'},
        {id:'standard-set', label:'标准套装', description:'主图5张 + 详情页8屏', summary:'主图5张 + 详情页8屏', confirmLabel:'确认并生成标准套装'},
        {id:'complete-set', label:'完整套装', description:'主图5张 + 详情页10–15屏', summary:'主图5张 + 详情页10–15屏', confirmLabel:'确认并生成完整套装'},
    ],
});
const ECOMMERCE_SELLING_POINTS = Object.freeze({
    'main-image': [
        {id:'core-benefit', label:'核心优势'},
        {id:'product-detail', label:'外观与细节'},
        {id:'usage-scene', label:'使用场景'},
        {id:'specification', label:'规格信息'},
        {id:'package-gift', label:'包装 / 礼赠'},
        {id:'promotion', label:'促销信息'},
    ],
    'detail-page': [
        {id:'core-benefit', label:'核心优势'},
        {id:'pain-scene', label:'痛点 / 场景'},
        {id:'product-detail', label:'细节 / 工艺'},
        {id:'usage-method', label:'使用方法'},
        {id:'specification', label:'参数规格'},
        {id:'package-service', label:'包装 / 服务'},
    ],
    'full-set': [
        {id:'core-benefit', label:'核心优势'},
        {id:'pain-scene', label:'痛点 / 场景'},
        {id:'product-detail', label:'细节 / 工艺'},
        {id:'usage-method', label:'使用方法'},
        {id:'specification', label:'参数规格'},
        {id:'package-service', label:'包装 / 服务'},
    ],
});
const ECOMMERCE_STYLES = Object.freeze([
    {id:'minimal', label:'简约', description:'留白清晰、主体突出'},
    {id:'premium', label:'高端奢华', description:'克制高级、强调质感'},
    {id:'guochao', label:'国潮', description:'东方元素、现代构成'},
    {id:'tech', label:'科技感', description:'冷色光效、理性秩序'},
    {id:'natural', label:'清新自然', description:'明亮柔和、自然呼吸'},
    {id:'promotion', label:'促销', description:'强信息层级、高转化氛围'},
    {id:'reference', label:'参考图调性', description:'提取附件的色彩与氛围，不照搬版式'},
]);
function createEcommerceWizardState(){
    return {
        step:1,
        designType:'',
        deliveryPlan:'',
        sellingPoints:[],
        customSellingPoints:'',
        style:'',
        notes:'',
        finished:false,
        materialCount:0,
        awaitingConfirmation:false,
    };
}
let ecommerceWizardState = createEcommerceWizardState();
let agentSkillsLoaded = false;
let skillMenuHome = null;

function positionSkillMenu(){
    const menu = document.getElementById('skillMenu');
    const btn = document.getElementById('skillBtn');
    if(!menu || !btn || menu.classList.contains('hidden')) return;
    skillMenuHome = skillMenuHome || document.getElementById('skillPicker');
    if(menu.parentElement !== document.body) document.body.appendChild(menu);
    const rect = btn.getBoundingClientRect();
    const width = Math.min(268, window.innerWidth - 64);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    menu.style.position = 'fixed';
    menu.style.left = `${left}px`;
    menu.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 10)}px`;
    menu.style.top = 'auto';
    menu.style.width = `${width}px`;
    menu.style.zIndex = '500';
}

function restoreSkillMenu(){
    const menu = document.getElementById('skillMenu');
    const home = skillMenuHome || document.getElementById('skillPicker');
    if(!menu || !home || menu.parentElement === home) return;
    menu.style.position = '';
    menu.style.left = '';
    menu.style.bottom = '';
    menu.style.top = '';
    menu.style.width = '';
    menu.style.zIndex = '';
    home.appendChild(menu);
}

function setSkillMenuOpenState(open){
    document.getElementById('composerBody')?.classList.toggle('skill-menu-open', open);
    document.querySelector('.composer-wrap')?.classList.toggle('skill-menu-open', open);
    document.querySelector('.composer-wrap > .composer')?.classList.toggle('skill-menu-open', open);
    if(open) positionSkillMenu();
    else restoreSkillMenu();
}

function setCanvasDockSkillDevelopmentState(){
    if(!isCanvasDock()) return;
    activeAgentSkill = '';
    closeSkillMenu();
    const btn = document.getElementById('skillBtn');
    const picker = document.getElementById('skillPicker');
    if(btn){
        btn.disabled = true;
        btn.classList.remove('active');
        btn.setAttribute('aria-disabled', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.title = '技能包（开发中）';
        btn.setAttribute('aria-label', '技能包（开发中）');
    }
    picker?.classList.add('is-development');
}
let config = { chat_model: 'gpt-5.5', image_model: 'gpt-image-1' };
const activeTurnTimers = new Set();
let activeDialogRequest = null;

function setSendButtonRunning(running){
    const btn = document.getElementById('sendBtn');
    if(!btn) return;
    btn.classList.toggle('is-stopping', Boolean(running));
    btn.title = running ? '中止任务' : tr('chat.send');
    btn.setAttribute('aria-label', running ? '中止任务' : '发送');
    btn.innerHTML = running
        ? '<span class="send-stop-square" aria-hidden="true"></span>'
        : '<i data-lucide="arrow-up" class="w-5 h-5"></i>';
    lucide.createIcons();
}

function abortError(signal){
    return signal?.reason instanceof Error
        ? signal.reason
        : new DOMException('已中止本次对话任务', 'AbortError');
}

function isAbortError(err){
    return err?.name === 'AbortError' || String(err?.message || '').includes('已中止本次对话任务');
}

function waitForDialogTask(promise, signal){
    if(!signal) return Promise.resolve(promise);
    if(signal.aborted) return Promise.reject(abortError(signal));
    return new Promise((resolve, reject) => {
        const onAbort = () => reject(abortError(signal));
        signal.addEventListener('abort', onAbort, {once:true});
        Promise.resolve(promise).then(
            value => { signal.removeEventListener('abort', onAbort); resolve(value); },
            err => { signal.removeEventListener('abort', onAbort); reject(err); },
        );
    });
}

function cancelDialogRequest(){
    const request = activeDialogRequest;
    if(!request) return false;
    request.cancelled = true;
    fetch('/api/chat/cancel', {
        method:'POST',
        headers:dialogHeaders(request.id),
    }).catch(() => {});
    request.controller.abort(new DOMException('已中止本次对话任务', 'AbortError'));
    activeDialogRequest = null;
    const assistantBubble = request.assistantBubble;
    if(assistantBubble){
        const cancelledText = '已中止本次对话任务。';
        clearDockThinkingFlow(assistantBubble.bubble, assistantBubble);
        if(request.dockMode) setDockReplyPlain(assistantBubble, cancelledText);
        else if(assistantBubble.text) assistantBubble.text.textContent = cancelledText;
        finishAssistantBubbleStreaming(assistantBubble);
        assistantBubble.turnTimer?.stop();
        stopTurnTimers(request.startedAt);
    }
    setSendButtonRunning(false);
    return true;
}

function dockThinkRand(min, max){
    return min + Math.random() * (max - min);
}

const AGENT_STAGE_TEXT = Object.freeze({
    understanding: '正在理解需求和附件…',
    planning: '正在制定执行方案…',
    generating: '正在生成成果…',
    checking: '正在检查成果…',
    repairing: '正在修正未通过的部分…',
    finishing: '正在整理结果说明…',
});
const AGENT_STAGE_TEXT_VALUES = new Set(Object.values(AGENT_STAGE_TEXT));

function agentStageText(stage, fallback){
    const explicit = fixMojibakeText(fallback);
    if(explicit) return explicit.slice(0, 160);
    const key = String(stage || '').trim().toLowerCase();
    return AGENT_STAGE_TEXT[key] || '正在处理任务…';
}

function dockThinkShuffle(list){
    const out = list.slice();
    for(let i = out.length - 1; i > 0; i -= 1){
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function fixMojibakeText(text){
    const s = String(text || '').trim();
    if(!s || /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s)) return s;
    if(!/[ÃÂâÃæÐÑÒÓ]/.test(s)) return s;
    try {
        const bytes = Uint8Array.from(s, ch => ch.charCodeAt(0) & 0xff);
        const decoded = new TextDecoder('utf-8').decode(bytes);
        return /[\u4e00-\u9fff]/.test(decoded) ? decoded : s;
    } catch(e) {
        return s;
    }
}

function providerDisplayName(item){
    const raw = String(item?.name || item?.id || '').trim();
    return fixMojibakeText(raw) || raw || 'API';
}

function formatDockError(raw){
    const text = fixMojibakeText(String(raw || '').trim());
    if(!text) return '请求失败，请稍后重试。';
    try {
        const parsed = JSON.parse(text);
        const inner = parsed?.error;
        const nested = typeof inner === 'string' ? JSON.parse(inner) : inner;
        const msg = nested?.message || nested?.error?.message || parsed?.message || parsed?.detail;
        if(typeof msg === 'string' && msg.trim()) return msg.trim();
    } catch(e) { /* not json */ }
    if(/120/.test(text) && /秒|second/i.test(text)) return '上游 API 限流：请等待约 2 分钟后再试。';
    if(text.length > 220) return `${text.slice(0, 220)}…`;
    return text;
}

class DockThinkingSession {
    constructor(bubble, context){
        this.bubble = bubble;
        this.row = context?.row || bubble?.closest('.bubble-row');
        this.ctx = context || {};
        this.dead = false;
        this.queue = [];
        this.typingTimer = null;
        this.scheduleTimer = null;
        this.recent = new Set();
        this.history = [];
        this.streamEl = null;
        this.prepareDom();
        this.seedQueue();
    }

    prepareDom(){
        if(this.row) this.row.classList.add('dock-is-thinking');
        this.bubble.classList.add('dock-thinking');
        const textEl = this.bubble.querySelector('.bubble-text');
        if(textEl) textEl.style.display = 'none';

        let stage = this.row?.querySelector('.dock-thinking-stage');
        if(!stage && this.row){
            stage = document.createElement('div');
            stage.className = 'dock-thinking-stage';
            stage.innerHTML = '<div class="dock-thinking-flow"><div class="dock-thinking-stream"></div></div>';
            this.row.insertBefore(stage, this.bubble);
        } else if(stage){
            const flow = stage.querySelector('.dock-thinking-flow');
            if(flow) flow.innerHTML = '<div class="dock-thinking-stream"></div>';
        }
        this.streamEl = stage?.querySelector('.dock-thinking-stream') || null;
    }

    seedQueue(){
        const msg = String(this.ctx.message || '');
        const refs = (this.ctx.refs || []).length;
        const items = [];

        if(this.ctx.canvas){
            items.push(['正在读取画布状态…', 2, 180]);
        }
        if(refs){
            items.push([`已接收 ${refs} 个附件`, 1, dockThinkRand(160, 320)]);
            items.push(['正在核对附件内容与类型…', 2, dockThinkRand(320, 560)]);
        }
        if(msg.length > 72){
            items.push(['正在梳理长指令中的目标与约束…', 3, dockThinkRand(420, 700)]);
        } else if(msg.length > 20){
            items.push(['正在理解请求与上下文…', 2, dockThinkRand(280, 520)]);
        } else if(msg){
            items.push(['已接收请求', 1, dockThinkRand(140, 280)]);
        }
        items.push(['正在建立流式连接…', 2, dockThinkRand(300, 520)]);

        this.queue = items.map(([text, weight, pause]) => ({
            text,
            weight: weight || 1,
            pause: pause || dockThinkRand(200, 900),
        }));
    }

    note(text){
        if(this.dead || !text) return;
        const noteText = fixMojibakeText(String(text)).trim().slice(0, 160);
        if(!noteText || this.history.includes(noteText)) return;
        if(this.scheduleTimer){
            clearTimeout(this.scheduleTimer);
            this.scheduleTimer = null;
        }
        this.queue.unshift({
            text: noteText,
            weight: noteText.length > 42 ? 3 : noteText.length > 22 ? 2 : 1,
            pause: dockThinkRand(100, 340),
            priority: true,
        });
        if(!this.typingTimer && !this.scheduleTimer) this.pump();
    }

    record(text){
        const value = String(text || '').trim();
        if(!value || this.history.includes(value)) return;
        this.history.push(value);
        if(this.history.length > 12) this.history.splice(0, this.history.length - 12);
    }

    start(){
        this.pump();
    }

    pump(){
        if(this.dead) return;
        if(this.typingTimer) return;
        const next = this.queue.shift();
        if(!next){
            this.scheduleTimer = window.setTimeout(() => {
                this.scheduleTimer = null;
                this.queue.push({
                    text: dockThinkShuffle(['任务仍在处理中…', '正在等待服务返回…'])[0],
                    weight: 2,
                    pause: dockThinkRand(5000, 8000),
                });
                this.pump();
            }, dockThinkRand(6500, 9000));
            return;
        }

        let text = next.text;
        if(!next.priority){
            let guard = 0;
            while(this.recent.has(text) && guard++ < 6){
                const alt = this.queue.find(item => !this.recent.has(item.text));
                if(alt){
                    text = alt.text;
                    this.queue.splice(this.queue.indexOf(alt), 1);
                    break;
                }
                text = `${text} ·`;
            }
        }
        this.recent.add(text);
        if(this.recent.size > 10) this.recent.delete(this.recent.values().next().value);

        this.typeLine(text, next.weight, () => {
            this.scheduleTimer = window.setTimeout(() => {
                this.scheduleTimer = null;
                this.pump();
            }, next.pause || dockThinkRand(220, 880));
        });
    }

    typeLine(text, weight, done){
        if(this.dead) return;
        if(!this.streamEl){
            this.prepareDom();
            if(!this.streamEl) return done?.();
        }
        const line = document.createElement('div');
        line.className = 'dock-thinking-line is-typing';
        const span = document.createElement('span');
        span.className = 'dock-thinking-text';
        line.appendChild(span);
        this.streamEl.appendChild(line);
        this.record(text);
        requestAnimationFrame(() => line.classList.add('is-visible'));
        if(this.streamEl.children.length > 5){
            const old = this.streamEl.firstChild;
            if(old && old !== line){
                old.classList.add('is-leaving');
                window.setTimeout(() => old.remove(), 560);
            }
        }

        const chars = [...text];
        let i = 0;
        const base = weight >= 3 ? [34, 76] : weight >= 2 ? [20, 48] : [9, 30];

        const step = () => {
            if(this.dead) return;
            if(i >= chars.length){
                line.classList.remove('is-typing');
                this.typingTimer = null;
                done?.();
                return;
            }
            span.textContent += chars[i];
            const ch = chars[i++];
            let delay = dockThinkRand(base[0], base[1]);
            if(ch === ' ') delay *= 0.5;
            if('.,…—·?…'.includes(ch)) delay += dockThinkRand(90, 340);
            if(Math.random() < 0.11) delay += dockThinkRand(180, 520);
            this.typingTimer = window.setTimeout(step, delay);
        };
        step();
    }

    stop(){
        this.dead = true;
        if(this.typingTimer) clearTimeout(this.typingTimer);
        if(this.scheduleTimer) clearTimeout(this.scheduleTimer);
        this.typingTimer = null;
        this.scheduleTimer = null;
    }
}

let dockThinkingCtrl = null;

function stopDockThinkingFlow(){
    dockThinkingCtrl?.stop();
    dockThinkingCtrl = null;
}

function showDockActivityWithReply(assistantBubble){
    const row = assistantBubble?.row;
    const bubble = assistantBubble?.bubble;
    if(!row || !bubble) return;
    row.classList.remove('dock-is-thinking');
    if(row.querySelector('.dock-thinking-stage')) row.classList.add('dock-has-activity');
    bubble.classList.remove('dock-thinking');
    bubble.classList.add('dock-has-reply');
}

function clearDockThinkingFlow(bubble, assistantBubble){
    if(assistantBubble?.thinking){
        assistantBubble.thinking.stop();
        assistantBubble.thinking = null;
    }
    stopDockThinkingFlow();
    const row = assistantBubble?.row || bubble?.closest?.('.bubble-row');
    row?.classList.remove('dock-is-thinking', 'dock-has-activity');
    row?.querySelector('.dock-thinking-stage')?.remove();
    bubble?.classList.remove('dock-thinking');
    bubble?.querySelector('.dock-thinking-flow')?.remove();
}

function startDockThinkingFlow(bubble, context){
    if(!bubble || !(isCanvasDock() || document.body.classList.contains('gpt-dock-canvas-mode'))) return null;
    stopDockThinkingFlow();
    try {
        const session = new DockThinkingSession(bubble, context);
        dockThinkingCtrl = session;
        session.start();
        return session;
    } catch(err) {
        console.error('[dock-thinking]', err);
        return null;
    }
}

async function revealDockReply(assistantBubble, text){
    const t0 = assistantBubble?.thinkT0 || 0;
    const minShow = 700;
    const wait = Math.max(0, minShow - (Date.now() - t0));
    if(wait) await new Promise(resolve => window.setTimeout(resolve, wait));
    clearDockThinkingFlow(assistantBubble?.bubble, assistantBubble);
    const row = assistantBubble?.row;
    row?.classList.remove('dock-is-thinking');
    assistantBubble?.bubble?.classList.remove('dock-thinking');
    assistantBubble?.bubble?.classList.add('dock-has-reply');
    if(assistantBubble?.text){
        assistantBubble.text.style.display = '';
        setBubbleTextContent(assistantBubble.text, text, true);
    }
}

function appendDockReply(assistantBubble, chunk){
    if(!chunk) return;
    if(assistantBubble?.bubble?.dataset?.dockCanvasGen === '1'){
        const prefix = assistantBubble.text?.querySelector('.dock-reply-prefix');
        if(prefix) prefix.textContent = chunk;
        return;
    }
    if(!assistantBubble?.bubble?.classList.contains('dock-has-reply')){
        assistantBubble.thinking?.note('正在输出回答…');
        showDockActivityWithReply(assistantBubble);
        if(assistantBubble.text) assistantBubble.text.style.display = '';
    }
    if(assistantBubble?.text) setBubbleTextContent(assistantBubble.text, chunk, true);
}

function finishAssistantBubbleStreaming(assistantBubble){
    const bubble = assistantBubble?.bubble;
    if(!bubble) return;
    bubble.classList.remove('streaming');
    bubble.querySelectorAll?.('.dock-thinking-line.is-typing')?.forEach(line => line.classList.remove('is-typing'));
    clearDockThinkingFlow(bubble, assistantBubble);
}

function beginDockCanvasGenTracking(assistantBubble, plan){
    dockCanvasGenState = {
        bubble: assistantBubble,
        expected: Math.max(1, Number(plan?.count) || 1),
        images: [],
        baseReply: String(plan?.reply || '').trim(),
    };
}

function onDockCanvasNodeOutput(urls){
    const state = dockCanvasGenState;
    if(!state?.bubble?.text) return;
    (urls || []).forEach(url => {
        const src = String(url || '').trim();
        if(!src || state.images.includes(src)) return;
        state.images.push(src);
        appendDockCanvasThumb(state.bubble, src);
    });
    scrollBottom();
}

function appendDockCanvasThumb(assistantBubble, url){
    const text = assistantBubble?.text;
    if(!text) return;
    let thumbs = text.querySelector('.dock-canvas-sync-thumbs');
    if(!thumbs){
        thumbs = document.createElement('div');
        thumbs.className = 'thumbs dock-canvas-sync-thumbs';
        text.appendChild(thumbs);
    }
    if([...thumbs.querySelectorAll('img')].some(img => img.getAttribute('src') === url)) return;
    const img = document.createElement('img');
    img.className = 'thumb generated';
    img.src = url;
    img.alt = '';
    img.onclick = () => openImagePreview(url);
    thumbs.appendChild(img);
}

function removeDockCanvasGeneratingLine(assistantBubble){
    assistantBubble?.text?.querySelector('.dock-canvas-generating-line')?.remove();
    assistantBubble?.bubble?.removeAttribute('data-dock-canvas-gen');
}

async function waitDockCanvasImagesMapped(expectedCount, timeoutMs = 45000){
    const deadline = Date.now() + timeoutMs;
    while((dockCanvasGenState?.images?.length || 0) < expectedCount && Date.now() < deadline){
        await new Promise(resolve => setTimeout(resolve, 80));
    }
}

function finishDockCanvasGenReply(assistantBubble, baseReply, plan){
    const count = plan?.count || dockCanvasGenState?.expected || dockCanvasGenState?.images?.length || 1;
    const prefix = String(baseReply || plan?.reply || dockCanvasGenState?.baseReply || '').trim();
    const doneLine = `✅ 已在画布生成 ${count} 张图并完成排列。`;
    const finalMsg = prefix ? `${prefix}\n\n${doneLine}` : doneLine;
    const text = assistantBubble?.text;
    if(!text) return finalMsg;
    removeDockCanvasGeneratingLine(assistantBubble);
    let finalEl = text.querySelector('.dock-reply-final');
    if(!finalEl){
        finalEl = document.createElement('div');
        finalEl.className = 'dock-reply-final';
        text.prepend(finalEl);
    }
    finalEl.textContent = finalMsg;
    dockCanvasGenState = null;
    return finalMsg;
}

function showDockCanvasGenerating(assistantBubble, replyText, plan){
    assistantBubble?.thinking?.note('画布生成流程已启动…');
    showDockActivityWithReply(assistantBubble);
    if(assistantBubble?.bubble) assistantBubble.bubble.dataset.dockCanvasGen = '1';
    beginDockCanvasGenTracking(assistantBubble, plan || { count: 1, reply: replyText });
    if(!assistantBubble?.text) return;
    assistantBubble.text.style.display = '';
    const safe = escapeHtml(String(replyText || '').trim());
    const prefix = safe ? `<div class="dock-reply-prefix">${safe}</div>` : '';
    const status = '<div class="dock-canvas-generating-line"><span class="dock-hourglass-spin" aria-hidden="true">⏳</span><span>画布生成中…</span></div>';
    assistantBubble.text.innerHTML = `${prefix}${status}<div class="thumbs dock-canvas-sync-thumbs"></div>`;
}

function setDockReplyPlain(assistantBubble, text){
    if(assistantBubble?.bubble){
        assistantBubble.bubble.hidden = false;
        assistantBubble.bubble.classList.add('dock-has-reply');
    }
    if(assistantBubble?.text){
        assistantBubble.text.hidden = false;
        assistantBubble.text.style.display = '';
        setBubbleTextContent(assistantBubble.text, text, true);
    }
}

function startDockCanvasJob(plan, conversation, updateMeta){
    if(!plan || !global.GptDockCanvasAgent?.executeCanvasPlan) return null;
    global.GptDockCanvasAgent.openCanvasShell?.();
    return global.GptDockCanvasAgent.executeCanvasPlan({
        ...plan,
        provider_id: activeImageProvider,
        model: activeImageModel || config.image_model,
    }, conversation, updateMeta);
}

const SIZE_OPTIONS = {
    square: [['1024x1024','1k'], ['1536x1536','2k']],
    portrait: [['720x1080','1k'], ['1024x1536','2k']],
    portrait43: [['1008x1344','1k'], ['1536x2048','2k']],
    landscape43: [['1344x1008','1k'], ['2048x1536','2k']],
    landscape: [['1080x720','1k'], ['1536x1024','2k']],
    story: [['720x1280','1k'], ['1080x1920','2k']],
    wide: [['1280x720','1k'], ['1920x1080','2k']]
};

const conversationUserId = () => `${userId}-chat`;
const headers = () => ({'Content-Type':'application/json', 'X-User-ID':conversationUserId()});
const dialogHeaders = requestId => ({...headers(), 'X-Dialog-Request-ID':requestId});

function uniqueModels(list){
    const seen = new Set();
    return (list || []).map(item => String(item || '').trim()).filter(item => item && !seen.has(item) && seen.add(item));
}
function shortModelLabel(model){
    const text = String(model || '').trim();
    return text.split('/').pop().split(':')[0] || text;
}
function dockModeBinding(kind){
    const mode = kind === 'chat' ? 'text' : kind;
    return config?.mode_bindings?.[mode] || null;
}
function overviewBoundProviders(kind){
    const field = kind === 'image' ? 'image_models' : 'chat_models';
    const binding = dockModeBinding(kind);
    const enabled = Array.isArray(binding?.enabled_models) ? uniqueModels(binding.enabled_models) : null;
    const enabledSet = enabled ? new Set(enabled) : null;
    const order = new Map((enabled || []).map((model, index) => [model, index]));
    const list = (apiProviders || [])
        .filter(item => item.enabled !== false)
        .map(item => {
            const models = uniqueModels(item[field] || [])
                .filter(model => !enabledSet || enabledSet.has(model))
                .sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER));
            return {...item, [field]:models};
        })
        .filter(item => item[field].length);
    const preferred = String(binding?.default_model || '').trim();
    if(preferred){
        list.sort((a, b) => Number(!(a[field] || []).includes(preferred)) - Number(!(b[field] || []).includes(preferred)));
    }
    return list;
}
function chatProviders(){
    const list = overviewBoundProviders('chat');
    if(list.length) return list;
    return dockModeBinding('chat')
        ? [{id:'', name:'API', chat_models:[], image_models:[]}]
        : [{id:'comfly', name:'API', chat_models:[config.chat_model || 'gpt-4o-mini'], image_models:[config.image_model || 'gpt-image-1']}];
}
function imageProviders(){
    const list = overviewBoundProviders('image');
    if(list.length) return list;
    return dockModeBinding('image')
        ? [{id:'', name:'API', image_models:[], chat_models:[]}]
        : [{id:'comfly', name:'API', image_models:[config.image_model || 'gpt-image-1'], chat_models:[config.chat_model || 'gpt-4o-mini']}];
}
function providerById(id, kind='chat'){
    const list = kind === 'image' ? imageProviders() : chatProviders();
    return list.find(p => p.id === id) || list[0];
}
function currentProviderId(){
    return mode === 'image' ? activeImageProvider : provider;
}
function modelListForCurrent(){
    const item = providerById(currentProviderId(), mode === 'image' ? 'image' : 'chat');
    return uniqueModels(mode === 'image' ? item.image_models : item.chat_models);
}
function currentModel(){
    return mode === 'image' ? activeImageModel : activeChatModel;
}
function renderProviderControls(){
    const providerSelect = document.getElementById('providerSelect');
    const modelSelect = document.getElementById('modelSelect');
    const providers = mode === 'image' ? imageProviders() : chatProviders();
    const pid = currentProviderId();
    if(!providers.some(p => p.id === pid)) {
        if(mode === 'image') activeImageProvider = providers[0]?.id || 'comfly';
        else provider = providers[0]?.id || 'comfly';
    }
    const models = modelListForCurrent();
    if(mode === 'image' && !models.includes(activeImageModel)) activeImageModel = models[0] || config.image_model;
    if(mode !== 'image' && !models.includes(activeChatModel)) activeChatModel = chatProviderModels[provider] && models.includes(chatProviderModels[provider]) ? chatProviderModels[provider] : (models[0] || config.chat_model);
            providerSelect.innerHTML = providers.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === currentProviderId() ? 'selected' : ''}>${escapeHtml(providerDisplayName(p))}</option>`).join('');
    modelSelect.innerHTML = models.map(m => `<option value="${escapeHtml(m)}" ${m === currentModel() ? 'selected' : ''}>${escapeHtml(shortModelLabel(m))}</option>`).join('');
}

async function loadConfig(){
    try {
        const data = await fetch('/api/config').then(r=>r.json());
        config = { ...config, ...data };
        apiProviders = Array.isArray(config.api_providers) ? config.api_providers : [];
        config.chat_model = (config.chat_models || []).find(m => m === 'gpt-5.5') || config.chat_model || 'gpt-5.5';
        config.image_model = config.image_model || ((config.image_models || [])[0]) || 'gpt-image-1';
        const chatProviderList = chatProviders();
        const preferredChatModel = String(dockModeBinding('chat')?.default_model || '').trim();
        const preferredChatProvider = chatProviderList.find(item => (item.chat_models || []).includes(preferredChatModel));
        provider = preferredChatProvider?.id || chatProviderList[0]?.id || '';
        activeChatModel = preferredChatModel || providerById(provider, 'chat')?.chat_models?.[0] || '';
        if(provider) chatProviderModels[provider] = activeChatModel;
        const imageProviderList = imageProviders();
        const preferredImageModel = String(dockModeBinding('image')?.default_model || '').trim();
        const preferredImageProvider = imageProviderList.find(item => (item.image_models || []).includes(preferredImageModel));
        activeImageProvider = preferredImageProvider?.id || imageProviderList[0]?.id || '';
        activeImageModel = preferredImageModel || imageProviderList[0]?.image_models?.[0] || '';
        renderProviderControls();
        updateDockApiButtonLabel();
        updateModelLabel();
    } catch(e) {}
}
try {
    const apiChannel = new BroadcastChannel('studio-api');
    apiChannel.onmessage = async (e) => {
        if(e.data?.type === 'providers-changed'){
            await loadConfig();
            renderProviderControls();
            updateDockApiButtonLabel();
            updateModelLabel();
        }
    };
} catch(e) {}

function setProvider(p) {
    if(mode === 'image') activeImageProvider = p;
    else provider = p;
    const models = modelListForCurrent();
    if(mode === 'image') activeImageModel = models[0] || activeImageModel;
    else {
        activeChatModel = chatProviderModels[provider] && models.includes(chatProviderModels[provider]) ? chatProviderModels[provider] : (models[0] || activeChatModel);
            }
    renderProviderControls();
    updateModelLabel();
}
function setActiveModel(model){
    if(mode === 'image') activeImageModel = model;
    else {
        activeChatModel = model;
        chatProviderModels[provider] = model;
            }
    updateModelLabel();
}

async function loadConversations(){
    const data = await fetch('/api/conversations', {headers:{'X-User-ID':conversationUserId()}}).then(r=>r.json());
    conversations = data.conversations || [];
    renderThreads();
    if(!currentConversation && conversations[0]) await openConversation(conversations[0].id);
    if(!currentConversation) renderMessages([]);
}

function threadListEl(){
    return document.getElementById('threadList');
}

function renderThreads(){
    const list = threadListEl();
    if(!list) return;
    list.innerHTML = '';
    const dockMode = isCanvasDock();
    if(!conversations.length){
        list.innerHTML = dockMode
            ? `<div class="thread-list-empty">${tr('chat.noHistory')}</div>`
            : `<div class="px-3 py-8 text-center text-[11px] font-bold text-gray-300 uppercase tracking-widest">${tr('chat.noHistory')}</div>`;
        return;
    }
    conversations.forEach(item => {
        const row = document.createElement('div');
        row.className = 'thread-row';
        const btn = document.createElement('button');
        btn.className = `thread-item ${currentConversation?.id === item.id ? 'active' : ''}`;
        btn.onclick = () => openConversation(item.id, true);
        const title = `${item.pinned ? '★ ' : ''}${escapeHtml(item.title || defaultTitle())}`;
        const preview = escapeHtml(item.last_message || '');
        btn.innerHTML = dockMode
            ? `<span class="thread-item-title">${title}</span><span class="thread-item-meta">${preview || '暂无对话内容'}</span>`
            : `<div class="text-sm font-bold truncate">${title}</div><div class="text-[11px] opacity-50 truncate mt-1">${preview}</div>`;
        const pin = document.createElement('button');
        pin.className = `thread-action ${item.pinned ? 'active' : ''}`;
        pin.title = item.pinned ? '取消置顶' : '置顶';
        pin.onclick = (event) => toggleConversationPinned(item.id, !item.pinned, event);
        pin.innerHTML = `<i data-lucide="${item.pinned ? 'pin-off' : 'pin'}" class="w-4 h-4"></i>`;
        const rename = document.createElement('button');
        rename.className = 'thread-action';
        rename.title = '重命名';
        rename.onclick = (event) => renameConversation(item.id, item.title || defaultTitle(), event);
        rename.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i>';
        const del = document.createElement('button');
        del.className = 'thread-delete';
        del.title = tr('chat.deleteTitle');
        del.onclick = (event) => deleteConversation(item.id, event);
        del.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
        row.appendChild(btn);
        row.appendChild(pin);
        row.appendChild(rename);
        row.appendChild(del);
        list.appendChild(row);
    });
    refreshHistoryIcons();
}

function refreshHistoryIcons(){
    lucide.createIcons();
}

async function newConversation(){
    const data = await fetch('/api/conversations', {method:'POST', headers:headers(), body:JSON.stringify({title:'未命名对话'})}).then(r=>r.json());
    currentConversation = data.conversation;
    if(isCanvasDock()){
        global.GptDockCanvasAgent.markConversationFresh(currentConversation);
        try {
            await updateConversationMeta(currentConversation.id, { awaiting_new_canvas: true, canvas_id: '' });
        } catch(e) {}
    }
    setChatTitle(currentConversation.title);
    await loadConversations();
    renderMessages([]);
    toggleHistory(false);
    if(activeAgentSkill === ECOMMERCE_SKILL_ID) resetEcommerceWizard();
}

async function openConversation(id, closePanel=false){
    const data = await fetch(`/api/conversations/${id}`, {headers:{'X-User-ID':conversationUserId()}}).then(r=>r.json());
    currentConversation = data.conversation;
    setChatTitle(currentConversation.title);
    renderThreads();
    renderMessages(currentConversation.messages || []);
    if(isCanvasDock()) global.GptDockCanvasAgent.onOpenConversation(currentConversation);
    if(closePanel) toggleHistory(false);
}

async function handleExternalConversationDeleted(id){
    if(currentConversation?.id === id){
        currentConversation = null;
        setChatTitle('');
        renderMessages([]);
    }
    await loadConversations();
}

async function deleteConversation(id, event){
    event.stopPropagation();
    if(!confirm(tr('chat.deleteConfirm'))) return;
    await fetch(`/api/conversations/${id}`, {method:'DELETE', headers:{'X-User-ID':conversationUserId()}});
    const deletedCurrent = currentConversation?.id === id;
    if(deletedCurrent){ currentConversation = null; setChatTitle(''); renderMessages([]); }
    await loadConversations();
    if(deletedCurrent && conversations[0]) await openConversation(conversations[0].id);
}

async function updateConversationMeta(id, patch){
    const data = await fetch(`/api/conversations/${id}`, {
        method:'PATCH',
        headers:headers(),
        body:JSON.stringify(patch)
    }).then(async r => {
        if(!r.ok) throw new Error(await r.text());
        return r.json();
    });
    if(currentConversation?.id === id){
        currentConversation = data.conversation;
        setChatTitle(currentConversation.title);
    }
    await loadConversations();
    return data.conversation;
}

async function renameConversation(id, title, event){
    event?.stopPropagation?.();
    const next = prompt('新的对话名称', title || defaultTitle());
    if(!next || next.trim() === title) return;
    try {
        await updateConversationMeta(id, {title:next.trim()});
    } catch(e) {
        alert('重命名失败');
    }
}

async function toggleConversationPinned(id, pinned, event){
    event?.stopPropagation?.();
    try {
        await updateConversationMeta(id, {pinned});
    } catch(e) {
        alert('置顶操作失败');
    }
}

async function toggleHistory(force, event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const pop = document.getElementById('historyPopover');
    if(!pop) return;
    const shouldOpen = typeof force === 'boolean' ? force : !pop.classList.contains('open');
    pop.classList.toggle('open', shouldOpen);
    if(shouldOpen) {
        try { await loadConversations(); } catch(e) { renderThreads(); }
        refreshHistoryIcons();
    }
}

document.addEventListener('click', (event) => {
    const actions = document.querySelector('.top-actions');
    if(actions && !actions.contains(event.target)) toggleHistory(false);
    const skillPicker = document.getElementById('skillPicker');
    const skillMenu = document.getElementById('skillMenu');
    if(skillMenu?.contains(event.target)) return;
    if(skillPicker && !skillPicker.contains(event.target)) closeSkillMenu();
});

function setMode(next){
    const previousMode = mode;
    mode = next === 'image' ? 'image' : 'chat';
    document.getElementById('chatModeBtn').classList.toggle('active', mode === 'chat');
    document.getElementById('imageModeBtn').classList.toggle('active', mode === 'image');
    document.getElementById('imageControls').classList.toggle('hidden', mode !== 'image');
    renderProviderControls();
    updateModelLabel();
    if(previousMode !== mode){
        currentConversation = null;
        conversations = [];
        setChatTitle('');
        renderMessages([]);
        loadConversations().catch(() => renderMessages([]));
    }
}

function updateModelLabel(){
    const label = mode === 'image'
        ? (activeImageModel || config.image_model || 'Image')
        : (activeChatModel || config.chat_model || 'Chat');
    document.getElementById('modelLabel').textContent = label;
    updateDockApiButtonLabel();
}

function updateDockApiButtonLabel(){
    const btnLabel = document.getElementById('dockApiBtnLabel');
    if(btnLabel) btnLabel.textContent = shortModelLabel(activeChatModel || config.chat_model || 'Chat');
}

function renderDockApiPanel(){
    const panel = document.getElementById('dockApiPanel');
    if(!panel) return;
    const chatProviderList = chatProviders();
    const imageProviderList = imageProviders();
    if(!chatProviderList.some(p => p.id === provider)) provider = chatProviderList[0]?.id || provider;
    if(!imageProviderList.some(p => p.id === activeImageProvider)) activeImageProvider = imageProviderList[0]?.id || activeImageProvider;
    const chatModels = uniqueModels(providerById(provider, 'chat')?.chat_models || []);
    const imageModels = uniqueModels(providerById(activeImageProvider, 'image')?.image_models || []);
    if(!chatModels.includes(activeChatModel)) activeChatModel = chatModels[0] || activeChatModel;
    if(!imageModels.includes(activeImageModel)) activeImageModel = imageModels[0] || activeImageModel;

    panel.innerHTML = `
        <div class="dock-api-popover-head">
            <span>模型设置</span>
            <button type="button" onclick="closeDockApiPanel()" title="关闭" aria-label="关闭"><i data-lucide="x"></i></button>
        </div>
        <div class="dock-api-section">
            <label>语言模型</label>
            <div class="dock-api-select-row">
                <select id="dockChatProviderSelect" class="dock-api-select" onchange="setDockChatProvider(this.value)">
                    ${chatProviderList.map(p => `<option value="${escapeAttr(p.id)}" ${p.id === provider ? 'selected' : ''}>${escapeHtml(providerDisplayName(p))}</option>`).join('')}
                </select>
                <select id="dockChatModelSelect" class="dock-api-select" onchange="setDockChatModel(this.value)">
                    ${chatModels.map(m => `<option value="${escapeAttr(m)}" ${m === activeChatModel ? 'selected' : ''}>${escapeHtml(shortModelLabel(m))}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="dock-api-section">
            <label>生图模型</label>
            <div class="dock-api-select-row">
                <select id="dockImageProviderSelect" class="dock-api-select" onchange="setDockImageProvider(this.value)">
                    ${imageProviderList.map(p => `<option value="${escapeAttr(p.id)}" ${p.id === activeImageProvider ? 'selected' : ''}>${escapeHtml(providerDisplayName(p))}</option>`).join('')}
                </select>
                <select id="dockImageModelSelect" class="dock-api-select" onchange="setDockImageModel(this.value)">
                    ${imageModels.map(m => `<option value="${escapeAttr(m)}" ${m === activeImageModel ? 'selected' : ''}>${escapeHtml(shortModelLabel(m))}</option>`).join('')}
                </select>
            </div>
        </div>`;
    lucide.createIcons();
    updateDockApiButtonLabel();
}

function setDockChatProvider(pid){
    provider = pid;
    const models = uniqueModels(providerById(provider, 'chat')?.chat_models || []);
    activeChatModel = chatProviderModels[provider] && models.includes(chatProviderModels[provider]) ? chatProviderModels[provider] : (models[0] || activeChatModel);
    renderDockApiPanel();
    renderProviderControls();
    updateModelLabel();
}

function setDockChatModel(model){
    activeChatModel = model;
    chatProviderModels[provider] = model;
    renderDockApiPanel();
    updateModelLabel();
}

function setDockImageProvider(pid){
    activeImageProvider = pid;
    const models = uniqueModels(providerById(activeImageProvider, 'image')?.image_models || []);
    activeImageModel = models[0] || activeImageModel;
    renderDockApiPanel();
    updateModelLabel();
}

function setDockImageModel(model){
    activeImageModel = model;
    renderDockApiPanel();
    updateModelLabel();
}

function toggleDockApiPanel(event){
    event?.stopPropagation?.();
    const panel = document.getElementById('dockApiPanel');
    const btn = document.getElementById('dockApiBtn');
    if(!panel || !btn) return;
    const willOpen = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willOpen);
    panel.classList.toggle('open', willOpen);
    btn.classList.toggle('open', willOpen);
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if(willOpen) renderDockApiPanel();
}

function closeDockApiPanel(){
    document.getElementById('dockApiPanel')?.classList.add('hidden');
    document.getElementById('dockApiPanel')?.classList.remove('open');
    document.getElementById('dockApiBtn')?.classList.remove('open');
    document.getElementById('dockApiBtn')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', () => closeDockApiPanel());

function setChatRatio(next, preferredSize = ''){
    chatRatio = next;
    ['square','portrait','portrait43','landscape43','landscape','story','wide'].forEach(item => {
        document.getElementById(`chat-ratio-${item}`).classList.toggle('active', item === next);
    });
    if(preferredSize){ const match = SIZE_OPTIONS[next].find(([value]) => value === preferredSize); if(match) chatResolution = match[1]; }
    updateChatResolutionUI();
}

function setChatResolution(next){ chatResolution = next; updateChatResolutionUI(); }
function updateChatResolutionUI(){
    document.getElementById('chat-res-1k').classList.toggle('active', chatResolution === '1k');
    document.getElementById('chat-res-2k').classList.toggle('active', chatResolution === '2k');
}

function currentChatSize(){
    const options = SIZE_OPTIONS[chatRatio] || SIZE_OPTIONS.square;
    const match = options.find(([, label]) => label === chatResolution) || options[0];
    return match[0];
}

function messageTimestamp(value){
    if(value === null || value === undefined || value === '') return 0;
    const numeric = Number(value);
    if(Number.isFinite(numeric) && numeric > 0){
        return numeric < 100000000000 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatTurnElapsed(milliseconds){
    const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if(hours) return `${hours}h ${minutes}m ${seconds}s`;
    if(minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function stopTurnTimers(startedAt, endedAt = Date.now()){
    const start = messageTimestamp(startedAt);
    [...activeTurnTimers]
        .filter(timer => timer.startedAt === start)
        .forEach(timer => timer.stop(endedAt));
}

function disposeAllTurnTimers(){
    [...activeTurnTimers].forEach(timer => timer.dispose());
}

function appendTurnTimer(box, startedAt, endedAt = 0, beforeElement = null){
    const start = messageTimestamp(startedAt);
    if(!start) return null;
    const requestedFinish = messageTimestamp(endedAt);
    const isActiveTurn = activeDialogRequest?.startedAt === start;
    const finish = isActiveTurn ? 0 : requestedFinish;
    const timerRow = document.createElement('div');
    timerRow.className = 'dock-turn-timing';
    timerRow.dataset.state = finish ? 'complete' : 'running';
    timerRow.dataset.startedAt = String(start);
    const label = document.createElement('div');
    label.className = 'dock-turn-timing-label';
    label.setAttribute('aria-live', finish ? 'off' : 'polite');
    label.innerHTML = '<span class="dock-turn-timing-text"></span><i data-lucide="chevron-right" aria-hidden="true"></i>';
    timerRow.appendChild(label);
    if(beforeElement?.parentNode === box) box.insertBefore(timerRow, beforeElement);
    else box.appendChild(timerRow);
    const text = label.querySelector('.dock-turn-timing-text');
    let intervalId = null;
    let stopped = Boolean(finish);
    const render = value => {
        const prefix = timerRow.dataset.state === 'complete' ? '已完成' : '处理中';
        if(text) text.textContent = `${prefix} ${formatTurnElapsed(value - start)}`;
    };
    const controller = {
        element: timerRow,
        startedAt:start,
        dispose(){
            if(intervalId) window.clearInterval(intervalId);
            intervalId = null;
            activeTurnTimers.delete(controller);
        },
        stop(value = Date.now()){
            if(stopped) return;
            if(activeDialogRequest?.startedAt === start) return;
            stopped = true;
            controller.dispose();
            timerRow.dataset.state = 'complete';
            label.setAttribute('aria-live', 'off');
            render(Math.max(start, messageTimestamp(value) || Date.now()));
        },
    };
    if(finish){
        render(Math.max(start, finish));
    } else {
        render(Date.now());
        intervalId = window.setInterval(() => render(Date.now()), 250);
        activeTurnTimers.add(controller);
    }
    return controller;
}

function renderMessages(messages){
    const box = document.getElementById('messages');
    disposeAllTurnTimers();
    box.innerHTML = '';
    if(!messages.length){
        renderEcommerceWizard();
        renderEcommerceConfirmationActions();
        return;
    }
    let turnStartedAt = 0;
    messages.forEach((msg, index) => {
        if(msg.role === 'user'){
            turnStartedAt = messageTimestamp(msg.created_at);
            addMessageBubble(msg);
            return;
        }
        const isCurrentTurn = Boolean(
            activeDialogRequest
            && turnStartedAt
            && !messages.slice(index + 1).some(item => item.role === 'user')
        );
        const viewMessage = msg.role === 'assistant' && turnStartedAt
            ? {
                ...msg,
                _turnStartedAt: isCurrentTurn ? activeDialogRequest.startedAt : turnStartedAt,
                _turnEndedAt: isCurrentTurn ? 0 : messageTimestamp(msg.created_at),
            }
            : msg;
        addMessageBubble(viewMessage);
        if(msg.role === 'assistant') turnStartedAt = 0;
    });
    if(turnStartedAt && activeDialogRequest){
        activeDialogRequest.turnTimer = appendTurnTimer(
            box,
            activeDialogRequest.startedAt || turnStartedAt,
        );
    }
    renderEcommerceWizard();
    renderEcommerceConfirmationActions();
    scrollBottom();
}

function createMessageImageThumb(ref){
    const thumbButton = document.createElement('button');
    const thumbLabel = ref?.name || '预览图片';
    thumbButton.type = 'button';
    thumbButton.className = 'message-image-thumb';
    thumbButton.title = thumbLabel;
    thumbButton.setAttribute('aria-label', thumbLabel);
    const thumbImage = document.createElement('img');
    thumbImage.src = ref?.url || '';
    thumbImage.alt = '';
    thumbImage.loading = 'lazy';
    thumbButton.appendChild(thumbImage);
    thumbButton.onclick = () => openImagePreview(ref.url);
    return thumbButton;
}

function createAttachmentChip(ref, { removeIndex = -1, sent = false } = {}){
    const chip = document.createElement('div');
    chip.className = `ref-chip${sent ? ' message-attachment-chip' : ''}`;
    if(ref?.kind === 'image'){
        const preview = document.createElement('img');
        preview.className = 'ref-preview';
        preview.src = ref.url || '';
        preview.alt = '';
        preview.loading = 'lazy';
        chip.appendChild(preview);
    } else {
        const preview = document.createElement('span');
        preview.className = 'ref-preview';
        preview.innerHTML = `<i data-lucide="${attachmentIcon(ref || {})}"></i>`;
        chip.appendChild(preview);
    }
    const copy = document.createElement('span');
    copy.className = 'ref-copy';
    copy.innerHTML = `<div class="ref-name">${escapeHtml(ref?.name || '文件')}</div><div class="ref-kind">${escapeHtml(ref?.kind || 'file')}${ref?.extracted_text ? ' · 已读取' : ''}</div>`;
    chip.appendChild(copy);
    if(removeIndex >= 0){
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `移除 ${ref?.name || '附件'}`);
        remove.textContent = '×';
        remove.onclick = () => removeRef(removeIndex);
        chip.appendChild(remove);
    }
    if(sent && ref?.url){
        const activate = () => {
            if(ref.kind === 'image') openImagePreview(ref.url);
            else window.open(ref.url, '_blank', 'noopener,noreferrer');
        };
        chip.tabIndex = 0;
        chip.setAttribute('role', 'button');
        chip.setAttribute('aria-label', ref.name || '打开附件');
        chip.onclick = activate;
        chip.onkeydown = event => {
            if(event.key === 'Enter' || event.key === ' '){
                event.preventDefault();
                activate();
            }
        };
    }
    return chip;
}

function createUserMessageAttachmentTray(refs){
    const items = Array.isArray(refs) ? refs.filter(Boolean) : [];
    if(!items.length) return null;
    const tray = document.createElement('div');
    tray.className = 'message-attachment-tray';
    items.forEach(ref => tray.appendChild(createAttachmentChip(ref, { sent:true })));
    return tray;
}

function addMessageBubble(msg){
    const box = document.getElementById('messages');
    const row = document.createElement('div');
    row.className = `bubble-row ${msg.role === 'user' ? 'user' : 'assistant'}`;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${msg.role === 'user' ? 'user' : 'assistant'}`;
    const text = document.createElement('div');
    const userAttachmentTray = msg.role === 'user'
        ? createUserMessageAttachmentTray(msg.attachments)
        : null;
    const galleryUrls = messageImageUrls(msg, {
        includeAttachmentImages: msg.role !== 'user',
    });
    const imageFirstResult = msg.presentation === 'image' && galleryUrls.length > 0;
    const assistantImageOnly = msg.role === 'assistant' && galleryUrls.length > 0 && msg.success !== false;
    if(assistantImageOnly) bubble.classList.add('dock-image-only');
    const imageAction = ['generate_image', 'edit_image'].includes(String(msg.agent_action || ''));
    const looksLikeGenerating = /正在生成|生成中|稍等|working|generating/i.test(String(msg.content || ''));
    const restoredGeneratingImage = msg.role === 'assistant'
        && imageAction
        && msg.status !== 'done'
        && galleryUrls.length === 0
        && (msg.status === 'generating' || looksLikeGenerating);
    let displayText = msg.type === 'image' || msg.type === 'image_gallery'
        ? ((msg.content && msg.content !== '已为你生成图片。') ? msg.content : tr('chat.generated'))
        : (msg.content || '');
    if(msg.role === 'user') displayText = ecommerceVisibleMessageContent(displayText);
    if(assistantImageOnly || restoredGeneratingImage) displayText = '';
    if(galleryUrls.length > 1){
        displayText = stripMarkdownImages(displayText) || displayText;
    }
    text.className = 'bubble-text';
    setBubbleTextContent(text, displayText, msg.role === 'assistant');
    if(assistantImageOnly || restoredGeneratingImage) text.hidden = true;
    bubble.appendChild(text);
    appendMessageSources(bubble, msg.citations || []);
    const rawArtifacts = Array.isArray(msg.artifacts) && msg.artifacts.length ? msg.artifacts : (msg.artifact ? [msg.artifact] : []);
    const artifacts = rawArtifacts.filter(artifact => artifact?.validation?.passed !== false);
    if(!imageFirstResult){
        artifacts.forEach(artifact => appendArtifactCard(bubble, artifact, artifact.validation || msg.validation));
    }
    if(msg.attachments?.length && msg.role !== 'user'){
        const galleryUrlSet = new Set(galleryUrls);
        const visibleAttachments = msg.attachments.filter(ref => !(ref?.kind === 'image' && galleryUrlSet.has(ref.url)));
        if(visibleAttachments.length){
            const thumbs = document.createElement('div');
            thumbs.className = 'thumbs';
            visibleAttachments.forEach(ref => {
                if(ref.kind === 'image'){
                    thumbs.appendChild(createMessageImageThumb(ref));
                } else {
                    thumbs.insertAdjacentHTML('beforeend', `<div class="message-file"><i data-lucide="${attachmentIcon(ref)}" class="w-4 h-4"></i><span>${escapeHtml(ref.name || ref.kind || '??')}</span></div>`);
                }
            });
            bubble.appendChild(thumbs);
        }
    }
    if(msg.actions?.length){
        const actionNote = document.createElement('div');
        actionNote.className = 'message-file';
        actionNote.style.marginTop = '9px';
        actionNote.textContent = `已执行 ${msg.actions.length} 个画布操作`;
        bubble.appendChild(actionNote);
    }
    const galleryList = galleryUrls;
    if(galleryList.length){
        appendDockImageGallery(bubble, galleryList);
    }
    if(imageFirstResult && artifacts[0]){
        appendImageResultActions(bubble, artifacts[0], artifacts[0].validation || msg.validation);
    }
    if(restoredGeneratingImage){
        bubble.classList.add('streaming', 'dock-restored-generating-bubble');
        if(!galleryList.length) bubble.hidden = true;
        attachRestoredGeneratingFlow(row, bubble, msg);
    }
    // Show model badge for assistant messages
    if(msg.role === 'assistant' && msg.model && !assistantImageOnly && !restoredGeneratingImage){
        const badge = document.createElement('div');
        const modelShort = msg.model.split('/').pop().split(':')[0];
        badge.className = 'dock-model-badge';
        badge.style.cssText = `margin-top:8px;opacity:.45;letter-spacing:.06em;`;
        badge.textContent = modelShort;
        bubble.appendChild(badge);
    }
    if(userAttachmentTray){
        row.classList.add('has-message-attachments');
        row.appendChild(userAttachmentTray);
    }
    row.appendChild(bubble);
    box.appendChild(row);
    const turnTimer = msg.role === 'assistant' && msg._turnStartedAt
        ? appendTurnTimer(box, msg._turnStartedAt, msg._turnEndedAt, row)
        : null;
    lucide.createIcons();
    return {row, bubble, text, turnTimer};
}

function formatArtifactBytes(value){
    let size = Math.max(0, Number(value || 0));
    const units = ['B','KB','MB','GB'];
    let unit = 0;
    while(size >= 1024 && unit < units.length - 1){ size /= 1024; unit += 1; }
    return `${unit ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

function artifactValidationLabel(validation){
    if(!validation?.passed) return '检查未通过';
    if(validation.review_status === 'intelligent') return '智能复检通过';
    if(validation.review_status === 'structural_only') return '仅完成结构检查';
    return '结构检查通过';
}

function artifactValidationStatusClass(validation){
    if(validation?.review_status === 'intelligent') return 'intelligent';
    return 'structural';
}

function appendArtifactCard(bubble, artifact, validation){
    if(!bubble || !artifact?.url) return;
    const card = document.createElement('div');
    card.className = 'dock-artifact-card';
    if(String(artifact.mime_type || '').startsWith('image/')){
        const preview = document.createElement('a');
        preview.className = 'dock-artifact-preview';
        preview.href = artifact.url;
        preview.target = '_blank';
        preview.rel = 'noopener noreferrer';
        const image = document.createElement('img');
        image.src = artifact.url;
        image.alt = artifact.name || '生成成果';
        preview.appendChild(image);
        card.appendChild(preview);
    }
    const body = document.createElement('div');
    body.className = 'dock-artifact-body';
    const title = document.createElement('strong');
    title.textContent = artifact.name || '生成成果';
    const meta = document.createElement('span');
    const dimensions = artifact.width && artifact.height ? `${artifact.width} × ${artifact.height}px` : '';
    meta.textContent = [dimensions, formatArtifactBytes(artifact.size)].filter(Boolean).join(' · ');
    const state = document.createElement('span');
    const resultClass = validation?.passed ? 'passed' : 'failed';
    state.className = `dock-artifact-state ${resultClass} ${artifactValidationStatusClass(validation)}`;
    state.textContent = artifactValidationLabel(validation);
    const actions = document.createElement('div');
    actions.className = 'dock-artifact-actions';
    const open = document.createElement('a');
    open.href = artifact.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = '打开成果';
    const download = document.createElement('a');
    download.href = artifact.download_url || artifact.url;
    download.textContent = '保存文件';
    actions.append(open, download);
    body.append(title, meta, state, actions);
    card.appendChild(body);
    bubble.appendChild(card);
}

function appendImageResultActions(bubble, artifact, validation){
    if(!bubble || !artifact?.url) return;
    const row = document.createElement('div');
    row.className = 'dock-image-result-actions';
    const meta = document.createElement('span');
    const dimensions = artifact.width && artifact.height ? `${artifact.width} × ${artifact.height}px` : '';
    meta.textContent = [dimensions, artifact.size ? formatArtifactBytes(artifact.size) : ''].filter(Boolean).join(' · ');
    const state = document.createElement('span');
    state.className = `dock-image-result-state ${validation?.passed ? 'passed' : 'failed'}`;
    state.textContent = artifactValidationLabel(validation);
    const download = document.createElement('a');
    download.href = artifact.download_url || artifact.url;
    download.title = '保存图片';
    download.setAttribute('aria-label', '保存图片');
    download.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i>';
    row.append(meta, state, download);
    bubble.appendChild(row);
}

function appendMessageSources(bubble, citations){
    if(!bubble || !Array.isArray(citations) || !citations.length) return;
    const seen = new Set();
    const valid = citations.filter(item => {
        const key = `${item?.type || ''}|${item?.url || item?.file_id || ''}|${item?.title || ''}`;
        if(!key || seen.has(key)) return false;
        seen.add(key);
        return Boolean(item?.url || item?.title);
    }).slice(0, 12);
    if(!valid.length) return;
    const block = document.createElement('div');
    block.className = 'dock-message-sources';
    const label = document.createElement('div');
    label.className = 'dock-message-sources-label';
    label.textContent = '来源';
    block.appendChild(label);
    const list = document.createElement('div');
    list.className = 'dock-message-sources-list';
    valid.forEach((item, index) => {
        const title = String(item.title || item.url || `来源 ${index + 1}`).trim();
        const url = String(item.url || '').trim();
        const chip = document.createElement(url.startsWith('http://') || url.startsWith('https://') ? 'a' : 'span');
        chip.className = 'dock-message-source-chip';
        chip.textContent = `${index + 1} · ${title}`;
        chip.title = title;
        if(chip.tagName === 'A'){
            chip.href = url;
            chip.target = '_blank';
            chip.rel = 'noopener noreferrer';
        }
        list.appendChild(chip);
    });
    block.appendChild(list);
    bubble.appendChild(block);
}

function attachRestoredGeneratingFlow(row, bubble, msg){
    if(!row || row.querySelector('.dock-restored-generating-stage')) return;
    const done = Math.max(0, Number(msg.progress_done || (msg.image_urls || []).length || 0));
    const total = Math.max(done || 0, Number(msg.progress_total || msg.count || 1));
    const model = shortModelLabel(msg.model || activeImageModel || activeChatModel || 'image model');
    const stage = document.createElement('div');
    stage.className = 'dock-thinking-stage dock-restored-generating-stage';
    stage.innerHTML = '<div class="dock-thinking-flow"><div class="dock-thinking-stream"></div></div>';
    row.insertBefore(stage, bubble);
    const stream = stage.querySelector('.dock-thinking-stream');
    if(!stream) return;
    const baseLines = [
        `background image job restored · ${model}`,
        done > 0 ? `generated ${done}/${total} images · still working` : `waiting for first image · ${total} total`,
        'refresh did not stop the upstream task',
        'listening for saved results…',
    ];
    let index = 0;
    const pushLine = (text) => {
        const line = document.createElement('div');
        line.className = 'dock-thinking-line is-typing';
        const span = document.createElement('span');
        span.className = 'dock-thinking-text';
        line.appendChild(span);
        stream.appendChild(line);
        requestAnimationFrame(() => line.classList.add('is-visible'));
        if(stream.children.length > 5){
            const old = stream.firstChild;
            old?.classList.add('is-leaving');
            window.setTimeout(() => old?.remove(), 560);
        }
        const chars = [...String(text || '')];
        let cursor = 0;
        const tick = () => {
            if(!document.body.contains(line)) return;
            if(cursor >= chars.length){
                line.classList.remove('is-typing');
                window.setTimeout(() => line.classList.add('is-leaving'), 1600);
                window.setTimeout(() => line.remove(), 2300);
                return;
            }
            span.textContent += chars[cursor++];
            window.setTimeout(tick, 18 + Math.random() * 32);
        };
        tick();
    };
    pushLine(baseLines[0]);
    const timer = window.setInterval(() => {
        if(!document.body.contains(stage)){
            window.clearInterval(timer);
            return;
        }
        pushLine(baseLines[(++index) % baseLines.length]);
    }, 2100);
    if(msg.id && currentConversation?.id){
        const poll = window.setInterval(async () => {
            if(!document.body.contains(stage)){
                window.clearInterval(poll);
                return;
            }
            try {
                const data = await fetch(`/api/conversations/${currentConversation.id}`, {headers:{'X-User-ID':conversationUserId()}}).then(r => r.json());
                const next = data.conversation;
                const updated = next?.messages?.find(item => item.id === msg.id);
                if(!updated) return;
                const nextDone = Math.max(0, Number(updated.progress_done || (updated.image_urls || []).length || 0));
                const nextTotal = Math.max(nextDone || 0, Number(updated.progress_total || updated.count || total || 1));
                if(updated.status === 'done' || updated.status === 'error' || nextDone !== done){
                    currentConversation = next;
                    setChatTitle(currentConversation.title);
                    renderMessages(currentConversation.messages || []);
                    if(updated.status !== 'generating') window.clearInterval(poll);
                } else if(index % 2 === 0){
                    pushLine(nextDone > 0 ? `saved progress ${nextDone}/${nextTotal} ? still working` : `background job alive ? ${nextTotal} total`);
                }
            } catch(err) {
                // Keep the restored typing animation alive; the next poll may succeed.
            }
        }, 2600);
    }
}

function attachmentIcon(ref){
    if(ref.kind === 'video') return 'video';
    if(ref.kind === 'audio') return 'audio-lines';
    if((ref.name || '').toLowerCase().match(/\.psd$/)) return 'layers-3';
    if((ref.name || '').toLowerCase().match(/\.pptx?$/)) return 'presentation';
    if((ref.name || '').toLowerCase().match(/\.docx?$/)) return 'file-text';
    if((ref.name || '').toLowerCase().match(/\.pdf$/)) return 'file-type-2';
    return 'file';
}

async function uploadFiles(files){
    if(!files?.length) return;
    const form = new FormData();
    for(const file of [...files].slice(0, 8 - refs.length)){
        form.append('files', file);
    }
    const data = await fetch('/api/ai/upload', {method:'POST', body:form}).then(async r => {
        const body = await r.json();
        if(!r.ok) throw new Error(body.detail || '文件上传失败');
        return body;
    }).catch(error => { alert(error.message || '文件上传失败'); return {files:[]}; });
    refs.push(...(data.files || []));
    renderRefs();
    syncEcommerceWizardAfterAttachmentChange();
}

function renderRefs(){
    const strip = document.getElementById('refStrip');
    strip.innerHTML = '';
    refs.forEach((ref, index) => strip.appendChild(createAttachmentChip(ref, { removeIndex:index })));
    lucide.createIcons();
}

function addExternalRefs(items=[]){
    const room = Math.max(0, 8 - refs.length);
    if(!room) return 0;
    const knownUrls = new Set(refs.map(ref => String(ref?.url || '').trim()).filter(Boolean));
    const additions = [];
    for(const item of Array.isArray(items) ? items : []){
        const url = String(item?.url || '').trim();
        if(!url || knownUrls.has(url)) continue;
        const requestedKind = String(item?.kind || '').toLowerCase();
        const kind = ['image','video','audio','document'].includes(requestedKind) ? requestedKind : 'image';
        const ref = {kind, url, name:String(item?.name || `${kind}-${refs.length + additions.length + 1}`)};
        const mimeType = String(item?.mime_type || item?.mimeType || '').trim();
        if(mimeType) ref.mime_type = mimeType;
        additions.push(ref);
        knownUrls.add(url);
        if(additions.length >= room) break;
    }
    if(!additions.length) return 0;
    refs.push(...additions);
    renderRefs();
    syncEcommerceWizardAfterAttachmentChange();
    return additions.length;
}

function removeRef(i){
    refs.splice(i,1);
    renderRefs();
    syncEcommerceWizardAfterAttachmentChange();
}

function ecommerceWizardActive(){
    return activeAgentSkill === ECOMMERCE_SKILL_ID && !ecommerceWizardState.finished;
}

function ecommerceImageRef(ref){
    const kind = String(ref?.kind || '').toLowerCase();
    const name = String(ref?.name || ref?.url || '').toLowerCase();
    return kind === 'image' || /\.(png|jpe?g|webp|gif|bmp|avif)(?:$|[?#])/.test(name);
}

function ecommerceConversationMaterialRefs(){
    const messages = currentConversation?.messages || [];
    for(let index = messages.length - 1; index >= 0; index -= 1){
        const message = messages[index];
        if(message?.role !== 'user') continue;
        const candidates = [
            ...(Array.isArray(message.attachments) ? message.attachments : []),
            ...(Array.isArray(message.reference_images) ? message.reference_images : []),
        ];
        const images = candidates.filter(ecommerceImageRef);
        if(images.length) return images;
    }
    return [];
}

function ecommerceWizardHasMaterial(){
    return refs.some(ecommerceImageRef) || ecommerceConversationMaterialRefs().length > 0;
}

function ecommerceDesignTypeLabel(){
    return ECOMMERCE_DESIGN_TYPES.find(item => item.id === ecommerceWizardState.designType)?.label || '';
}

function ecommerceDeliveryPlan(){
    return (ECOMMERCE_DELIVERY_PLANS[ecommerceWizardState.designType] || [])
        .find(item => item.id === ecommerceWizardState.deliveryPlan) || null;
}

function ecommerceStyleLabel(){
    return ECOMMERCE_STYLES.find(item => item.id === ecommerceWizardState.style)?.label || '';
}

function ecommerceSellingPointLabels(){
    const options = ECOMMERCE_SELLING_POINTS[ecommerceWizardState.designType] || [];
    return ecommerceWizardState.sellingPoints
        .map(id => options.find(item => item.id === id)?.label)
        .filter(Boolean);
}

function ecommerceWizardProgress(){
    return Array.from({length:ECOMMERCE_WIZARD_TOTAL_STEPS}, (_, index) => {
        const number = index + 1;
        const status = number < ecommerceWizardState.step ? ' done' : (number === ecommerceWizardState.step ? ' current' : '');
        return `<span class="ecommerce-wizard-progress-dot${status}" aria-hidden="true"></span>`;
    }).join('');
}

function ecommerceWizardSummary(){
    const items = [];
    if(ecommerceWizardState.designType) items.push(`<span><b>类型</b>${escapeHtml(ecommerceDesignTypeLabel())}</span>`);
    if(ecommerceWizardState.deliveryPlan) items.push(`<span><b>交付</b>${escapeHtml(ecommerceDeliveryPlan()?.summary || '')}</span>`);
    if(ecommerceWizardState.sellingPoints.length || ecommerceWizardState.customSellingPoints.trim()){
        const count = ecommerceWizardState.sellingPoints.length + (ecommerceWizardState.customSellingPoints.trim() ? 1 : 0);
        items.push(`<span><b>卖点</b>${count} 项</span>`);
    }
    if(ecommerceWizardState.style) items.push(`<span><b>风格</b>${escapeHtml(ecommerceStyleLabel())}</span>`);
    return items.length ? `<div class="ecommerce-wizard-summary">${items.join('')}</div>` : '';
}

function ecommerceWizardBackButton(){
    if(ecommerceWizardState.step <= 1) return '';
    return `<button type="button" class="ecommerce-wizard-link" onclick="ecommerceWizardBack()"><i data-lucide="arrow-left"></i>上一步</button>`;
}

function renderEcommerceWizardStep(){
    const step = ecommerceWizardState.step;
    if(step === 1){
        return `<div class="ecommerce-wizard-step">
            <h3>你要生成什么？</h3>
            <p>选择后自动进入下一步。</p>
            <div class="ecommerce-wizard-choice-grid ecommerce-wizard-choice-grid-three">
                ${ECOMMERCE_DESIGN_TYPES.map(item => `<button type="button" class="ecommerce-wizard-choice" onclick="selectEcommerceDesignType('${item.id}')">
                    <i data-lucide="${item.icon}"></i>
                    <span><b>${item.label}</b><small>${item.description}</small></span>
                    <i data-lucide="chevron-right" class="ecommerce-wizard-choice-arrow"></i>
                </button>`).join('')}
            </div>
        </div>`;
    }
    if(step === 2){
        const attached = refs.length
            ? `<div class="ecommerce-wizard-hint warning"><i data-lucide="info"></i><span>检测到 ${refs.length} 个附件，但还没有商品图片。</span></div>`
            : '<div class="ecommerce-wizard-hint"><i data-lucide="image-up"></i><span>请上传清晰的商品实拍图、包装图或白底图。</span></div>';
        return `<div class="ecommerce-wizard-step">
            <h3>上传商品素材图</h3>
            <p>上传成功后会自动进入卖点提炼。</p>
            ${attached}
            <button type="button" class="ecommerce-wizard-upload" onclick="openEcommerceMaterialPicker()">
                <i data-lucide="upload"></i><span><b>选择商品图片</b><small>支持 PNG、JPG、WEBP，可一次上传多张</small></span>
            </button>
        </div>`;
    }
    if(step === 3){
        const plans = ECOMMERCE_DELIVERY_PLANS[ecommerceWizardState.designType] || [];
        return `<div class="ecommerce-wizard-step">
            <h3>选择交付规模</h3>
            <p>系列内容会保持同一风格，并按不同用途规划。</p>
            <div class="ecommerce-wizard-choice-grid ecommerce-wizard-choice-grid-three">
                ${plans.map(item => `<button type="button" class="ecommerce-wizard-choice ecommerce-delivery-choice" onclick="selectEcommerceDeliveryPlan('${item.id}')">
                    <i data-lucide="layers-3"></i>
                    <span><b>${item.label}</b><small>${item.description}</small></span>
                    <i data-lucide="chevron-right" class="ecommerce-wizard-choice-arrow"></i>
                </button>`).join('')}
            </div>
        </div>`;
    }
    if(step === 4){
        const options = ECOMMERCE_SELLING_POINTS[ecommerceWizardState.designType] || [];
        const canContinue = ecommerceWizardState.sellingPoints.length > 0 || ecommerceWizardState.customSellingPoints.trim();
        return `<div class="ecommerce-wizard-step">
            <h3>选择卖点提炼方向</h3>
            <p>可多选，也可以自己输入；勾选方向不等于虚构商品事实。</p>
            <div class="ecommerce-wizard-multi">
                ${options.map(item => {
                    const selected = ecommerceWizardState.sellingPoints.includes(item.id);
                    return `<button type="button" class="ecommerce-wizard-pill${selected ? ' selected' : ''}" aria-pressed="${selected ? 'true' : 'false'}" onclick="toggleEcommerceSellingPoint('${item.id}')">
                        <i data-lucide="${selected ? 'check' : 'plus'}"></i>${item.label}
                    </button>`;
                }).join('')}
            </div>
            <label class="ecommerce-wizard-field">
                <span>自定义卖点</span>
                <textarea rows="2" placeholder="例如：当天采摘、单果约 2–3 斤（只填写真实信息）" oninput="updateEcommerceCustomSellingPoints(this.value)">${escapeHtml(ecommerceWizardState.customSellingPoints)}</textarea>
            </label>
            <button id="ecommerceSellingPointConfirm" type="button" class="ecommerce-wizard-primary" onclick="confirmEcommerceSellingPoints()" ${canContinue ? '' : 'disabled'}>确认卖点</button>
        </div>`;
    }
    if(step === 5){
        return `<div class="ecommerce-wizard-step">
            <h3>选择设计风格</h3>
            <p>选择后进入确认稿设置。</p>
            <div class="ecommerce-wizard-style-grid">
                ${ECOMMERCE_STYLES.map(item => `<button type="button" class="ecommerce-wizard-style" onclick="selectEcommerceStyle('${item.id}')">
                    <span><b>${item.label}</b><small>${item.description}</small></span>
                    <i data-lucide="chevron-right"></i>
                </button>`).join('')}
            </div>
        </div>`;
    }
    return `<div class="ecommerce-wizard-step">
        <h3>生成生图前确认稿</h3>
        <p>Skill 会一次列出全部图片或屏幕的实际文字与简短信息排版，确认后才生图。</p>
        <label class="ecommerce-wizard-field">
            <span>补充备注（选填）</span>
            <textarea rows="3" placeholder="例如：淘宝详情页、移动端 750px 宽、不要写价格" oninput="updateEcommerceNotes(this.value)">${escapeHtml(ecommerceWizardState.notes)}</textarea>
        </label>
        <button type="button" class="ecommerce-wizard-primary ecommerce-wizard-generate" onclick="startEcommerceBrief()">
            <i data-lucide="file-check-2"></i>生成确认稿
        </button>
    </div>`;
}

function renderEcommerceWizard(){
    const box = document.getElementById('messages');
    if(!box) return;
    document.getElementById('ecommerceWizardRow')?.remove();
    const visible = ecommerceWizardActive();
    if(!visible) return;
    const row = document.createElement('div');
    row.id = 'ecommerceWizardRow';
    row.className = 'bubble-row assistant ecommerce-flow-row';
    row.innerHTML = `<div class="bubble assistant ecommerce-flow-bubble"><section id="ecommerceWizard" class="ecommerce-wizard" aria-label="电商设计对话式引导">
    <div class="ecommerce-wizard-head">
        <div><span class="ecommerce-wizard-kicker">电商设计</span><strong>步骤 ${ecommerceWizardState.step} / ${ECOMMERCE_WIZARD_TOTAL_STEPS}</strong></div>
        <div class="ecommerce-wizard-progress" aria-label="当前第 ${ecommerceWizardState.step} 步">${ecommerceWizardProgress()}</div>
        <button type="button" class="ecommerce-wizard-reset" onclick="resetEcommerceWizard()" title="重新开始" aria-label="重新开始"><i data-lucide="rotate-ccw"></i></button>
    </div>
    ${ecommerceWizardSummary()}
    ${renderEcommerceWizardStep()}
    <div class="ecommerce-wizard-foot">${ecommerceWizardBackButton()}<span>输入框始终可用，确认稿通过后才生图</span></div>
    </section></div>`;
    box.appendChild(row);
    lucide.createIcons();
    scrollBottom();
}

function resetEcommerceWizard(){
    ecommerceWizardState = createEcommerceWizardState();
    renderEcommerceWizard();
}

function closeEcommerceWizard(){
    ecommerceWizardState.finished = true;
    renderEcommerceWizard();
}

function syncEcommerceWizardAfterAttachmentChange(){
    if(!ecommerceWizardActive()) return;
    const hasMaterial = ecommerceWizardHasMaterial();
    if(ecommerceWizardState.step === 2 && hasMaterial){
        ecommerceWizardState.step = 3;
    } else if(ecommerceWizardState.step > 2 && !hasMaterial){
        ecommerceWizardState.step = 2;
    }
    renderEcommerceWizard();
}

function selectEcommerceDesignType(designType){
    if(!ECOMMERCE_DESIGN_TYPES.some(item => item.id === designType)) return;
    if(ecommerceWizardState.designType !== designType){
        ecommerceWizardState.deliveryPlan = '';
        ecommerceWizardState.sellingPoints = [];
        ecommerceWizardState.customSellingPoints = '';
        ecommerceWizardState.style = '';
        ecommerceWizardState.notes = '';
    }
    ecommerceWizardState.designType = designType;
    ecommerceWizardState.step = ecommerceWizardHasMaterial() ? 3 : 2;
    renderEcommerceWizard();
}

function openEcommerceMaterialPicker(){
    document.getElementById('chatFileInput')?.click();
}

function selectEcommerceDeliveryPlan(planId){
    const plans = ECOMMERCE_DELIVERY_PLANS[ecommerceWizardState.designType] || [];
    if(!plans.some(item => item.id === planId)) return;
    ecommerceWizardState.deliveryPlan = planId;
    ecommerceWizardState.step = 4;
    renderEcommerceWizard();
}

function toggleEcommerceSellingPoint(pointId){
    const options = ECOMMERCE_SELLING_POINTS[ecommerceWizardState.designType] || [];
    if(!options.some(item => item.id === pointId)) return;
    const current = new Set(ecommerceWizardState.sellingPoints);
    if(current.has(pointId)) current.delete(pointId);
    else current.add(pointId);
    ecommerceWizardState.sellingPoints = [...current];
    renderEcommerceWizard();
}

function updateEcommerceCustomSellingPoints(value){
    ecommerceWizardState.customSellingPoints = String(value || '');
    const confirm = document.getElementById('ecommerceSellingPointConfirm');
    if(confirm) confirm.disabled = !(ecommerceWizardState.sellingPoints.length || ecommerceWizardState.customSellingPoints.trim());
}

function confirmEcommerceSellingPoints(){
    if(!ecommerceWizardState.sellingPoints.length && !ecommerceWizardState.customSellingPoints.trim()) return;
    ecommerceWizardState.step = 5;
    renderEcommerceWizard();
}

function selectEcommerceStyle(styleId){
    if(!ECOMMERCE_STYLES.some(item => item.id === styleId)) return;
    ecommerceWizardState.style = styleId;
    ecommerceWizardState.step = 6;
    renderEcommerceWizard();
}

function updateEcommerceNotes(value){
    ecommerceWizardState.notes = String(value || '');
}

function ecommerceWizardBack(){
    const previous = {2:1, 3:1, 4:3, 5:4, 6:5};
    ecommerceWizardState.step = previous[ecommerceWizardState.step] || 1;
    renderEcommerceWizard();
}

function ecommerceWorkflowPayload(phase){
    return {
        phase,
        design_type:ecommerceWizardState.designType,
        design_type_label:ecommerceDesignTypeLabel(),
        delivery_plan:ecommerceWizardState.deliveryPlan,
        delivery_summary:ecommerceDeliveryPlan()?.summary || '',
        selling_point_directions:ecommerceSellingPointLabels(),
        custom_selling_points:ecommerceWizardState.customSellingPoints.trim(),
        style:ecommerceWizardState.style,
        style_label:ecommerceStyleLabel(),
        notes:ecommerceWizardState.notes.trim(),
        attachment_count:ecommerceWizardState.materialCount || refs.length || ecommerceConversationMaterialRefs().length,
    };
}

function buildEcommerceBriefPrompt(){
    return `请整理本次设计确认稿。${ECOMMERCE_INTERNAL_MARKER}${JSON.stringify(ecommerceWorkflowPayload('brief'))}`;
}

function ecommerceVisibleMessageContent(content){
    const text = String(content || '');
    return text.includes(ECOMMERCE_INTERNAL_MARKER)
        ? text.split(ECOMMERCE_INTERNAL_MARKER)[0].trim()
        : text;
}

function removeEcommerceConfirmationActions(){
    document.getElementById('ecommerceConfirmationActions')?.remove();
}

function renderEcommerceConfirmationActions(){
    removeEcommerceConfirmationActions();
    if(activeAgentSkill !== ECOMMERCE_SKILL_ID || !ecommerceWizardState.awaitingConfirmation) return;
    const box = document.getElementById('messages');
    const assistantRows = box ? [...box.querySelectorAll('.bubble-row.assistant')] : [];
    const lastAssistantRow = assistantRows[assistantRows.length - 1];
    const bubble = lastAssistantRow?.querySelector('.bubble.assistant');
    if(!bubble) return;
    const actions = document.createElement('div');
    actions.id = 'ecommerceConfirmationActions';
    actions.className = 'ecommerce-confirm-actions';
    actions.innerHTML = `<button type="button" class="ecommerce-confirm-edit" onclick="focusEcommerceRevisionInput()"><i data-lucide="pencil"></i>修改内容</button>
        <button type="button" class="ecommerce-confirm-generate" onclick="confirmEcommerceGeneration()"><i data-lucide="sparkles"></i>${escapeHtml(ecommerceDeliveryPlan()?.confirmLabel || '确认并生成')}</button>`;
    bubble.appendChild(actions);
    lucide.createIcons();
    scrollBottom();
}

function focusEcommerceRevisionInput(){
    const input = document.getElementById('messageInput');
    if(!input) return;
    input.placeholder = '直接输入修改，例如：第2张标题改成…，删除第5屏…';
    input.focus();
}

async function startEcommerceBrief(){
    if(!ecommerceWizardActive() || activeDialogRequest) return;
    if(!ecommerceWizardHasMaterial()){
        ecommerceWizardState.step = 2;
        renderEcommerceWizard();
        return;
    }
    if(!ecommerceWizardState.designType){
        ecommerceWizardState.step = 1;
        renderEcommerceWizard();
        return;
    }
    if(!ecommerceWizardState.deliveryPlan){
        ecommerceWizardState.step = 3;
        renderEcommerceWizard();
        return;
    }
    if(!ecommerceWizardState.sellingPoints.length && !ecommerceWizardState.customSellingPoints.trim()){
        ecommerceWizardState.step = 4;
        renderEcommerceWizard();
        return;
    }
    if(!ecommerceWizardState.style){
        ecommerceWizardState.step = 5;
        renderEcommerceWizard();
        return;
    }
    ecommerceWizardState.materialCount = refs.length || ecommerceConversationMaterialRefs().length;
    const message = buildEcommerceBriefPrompt();
    closeEcommerceWizard();
    await sendMessage({message, displayMessage:'请整理本次设计确认稿。'});
    ecommerceWizardState.awaitingConfirmation = true;
    renderEcommerceConfirmationActions();
}

async function confirmEcommerceGeneration(){
    if(activeDialogRequest || !ecommerceWizardState.awaitingConfirmation) return;
    ecommerceWizardState.awaitingConfirmation = false;
    removeEcommerceConfirmationActions();
    const message = `确认以上文字与信息排版，按确认稿开始生成全部交付内容。${ECOMMERCE_INTERNAL_MARKER}${JSON.stringify(ecommerceWorkflowPayload('generate'))}`;
    await sendMessage({message, displayMessage:'确认以上内容，开始生成全部交付内容。'});
}

const AGENT_SKILL_PRESENTATION = Object.freeze({
    'ecommerce-design': {icon:'shopping-bag', description:'商品主图、营销图与详情页模块设计'},
    'wechat-long-image': {icon:'smartphone', description:'移动端长图排版与内容分段'},
    'poster-graphic-design': {icon:'pen-tool', description:'海报、KV 与品牌平面物料'},
    'film-comic-design': {icon:'clapperboard', description:'角色、场景、分镜与漫剧视觉'},
    'ppt-design': {icon:'presentation', description:'演示结构、版式与视觉统一'},
});
const DEFAULT_AGENT_SKILL_PRESENTATION = Object.freeze({icon:'sparkles'});
const AGENT_SKILL_DIVIDER_AFTER = new Set(['poster-graphic-design', 'film-comic-design']);
const SKILL_IDLE_ICON = 'sparkles';

function renderSkillButtonIcon(active){
    const slot = document.getElementById('skillBtnIcon');
    if(!slot) return;
    const icon = active ? agentSkillPresentation(active).icon : SKILL_IDLE_ICON;
    if(slot.tagName !== 'I'){
        const el = document.createElement('i');
        el.id = 'skillBtnIcon';
        el.className = 'w-4 h-4';
        el.setAttribute('data-lucide', icon);
        slot.replaceWith(el);
        lucide.createIcons();
        return;
    }
    if(slot.getAttribute('data-lucide') !== icon){
        slot.setAttribute('data-lucide', icon);
        lucide.createIcons();
    }
}

function agentSkillPresentation(item){
    const preset = AGENT_SKILL_PRESENTATION[item?.id] || {};
    return {
        icon: preset.icon || DEFAULT_AGENT_SKILL_PRESENTATION.icon,
        description: preset.description || String(item?.description || '项目内技能').replace(/\s+/g, ' ').trim(),
        dividerAfter: AGENT_SKILL_DIVIDER_AFTER.has(item?.id),
    };
}

function renderSkillMenu(){
    const list = document.getElementById('skillMenuList');
    const btn = document.getElementById('skillBtn');
    if(!list || !btn) return;
    const active = availableAgentSkills.find(item => item.id === activeAgentSkill);
    btn.classList.toggle('active', Boolean(activeAgentSkill));
    btn.title = active ? `技能包：${active.name}` : '技能包';
    btn.setAttribute('aria-label', btn.title);
    renderSkillButtonIcon(active);
    const rows = availableAgentSkills;
    if(!rows.length){
        list.innerHTML = '<div class="skill-menu-state">暂无可用技能</div>';
        lucide.createIcons();
        return;
    }
    list.innerHTML = rows.map(item => {
        const selected = item.id === activeAgentSkill;
        const presentation = agentSkillPresentation(item);
        return `<button type="button" class="skill-menu-item${selected ? ' selected' : ''}" role="menuitemradio" aria-checked="${selected ? 'true' : 'false'}" title="${selected ? '再次点击取消此技能' : escapeAttr(item.name)}" onclick="selectAgentSkill('${escapeAttr(item.id)}')">
            <span class="skill-menu-icon"><i data-lucide="${escapeAttr(presentation.icon)}" class="w-4 h-4"></i></span>
            <span class="skill-menu-copy"><span class="skill-menu-name">${escapeHtml(item.name)}</span><span class="skill-menu-description">${escapeHtml(presentation.description)}</span></span>
            <i data-lucide="check" class="skill-menu-check"></i>
        </button>`;
    }).join('');
    lucide.createIcons();
}

async function loadAgentSkills(force=false){
    if(agentSkillsLoaded && !force) return availableAgentSkills;
    const list = document.getElementById('skillMenuList');
    if(list) list.innerHTML = '<div class="skill-menu-state">正在读取…</div>';
    try {
        const res = await fetch('/api/chat/skills', {headers:{'X-User-ID':conversationUserId()}});
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        availableAgentSkills = Array.isArray(data.skills) ? data.skills : [];
        agentSkillsLoaded = true;
        if(activeAgentSkill && !availableAgentSkills.some(item => item.id === activeAgentSkill)) activeAgentSkill = '';
        renderSkillMenu();
    } catch(err) {
        if(list) list.innerHTML = '<div class="skill-menu-state">技能包读取失败，请稍后重试</div>';
    }
    return availableAgentSkills;
}

function playSkillMenuEnter(menu){
    menu?.classList.remove('is-entering');
}

async function toggleSkillMenu(event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const menu = document.getElementById('skillMenu');
    const btn = document.getElementById('skillBtn');
    if(!menu || !btn) return;
    if(isCanvasDock() || btn.disabled) return;
    const willOpen = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !willOpen);
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    setSkillMenuOpenState(willOpen);
    if(willOpen){
        playSkillMenuEnter(menu);
        await loadAgentSkills();
        positionSkillMenu();
    } else {
        menu.classList.remove('is-entering');
    }
}

function closeSkillMenu(){
    const menu = document.getElementById('skillMenu');
    menu?.classList.remove('is-entering');
    menu?.classList.add('hidden');
    document.getElementById('skillBtn')?.setAttribute('aria-expanded', 'false');
    setSkillMenuOpenState(false);
}

function selectAgentSkill(skillId){
    if(isCanvasDock()) return;
    const previousSkill = activeAgentSkill;
    activeAgentSkill = activeAgentSkill === skillId ? '' : (availableAgentSkills.some(item => item.id === skillId) ? skillId : '');
    renderSkillMenu();
    closeSkillMenu();
    if(activeAgentSkill === ECOMMERCE_SKILL_ID && previousSkill !== ECOMMERCE_SKILL_ID){
        resetEcommerceWizard();
    } else if(previousSkill === ECOMMERCE_SKILL_ID && activeAgentSkill !== ECOMMERCE_SKILL_ID){
        ecommerceWizardState.awaitingConfirmation = false;
        removeEcommerceConfirmationActions();
        closeEcommerceWizard();
    } else {
        renderEcommerceWizard();
    }
    if(activeAgentSkill !== ECOMMERCE_SKILL_ID) document.getElementById('messageInput')?.focus();
}

window.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.items || [])].filter(x => x.kind === 'file' && x.type.startsWith('image/')).map(x => x.getAsFile());
    if(files.length) uploadFiles(files);
});

const composerBody = document.getElementById('composerBody');
composerBody.addEventListener('dragover', e => {
    if(!hasFiles(e.dataTransfer?.items)) return;
    e.preventDefault();
    composerBody.classList.add('drag-over');
});
composerBody.addEventListener('dragleave', e => {
    if(!composerBody.contains(e.relatedTarget)) composerBody.classList.remove('drag-over');
});
composerBody.addEventListener('drop', e => {
    if(!hasFiles(e.dataTransfer?.items)) return;
    e.preventDefault();
    composerBody.classList.remove('drag-over');
    uploadFiles(e.dataTransfer?.files || []);
});

function hasFiles(items){ return [...(items || [])].some(item => item.kind === 'file'); }
function autoGrow(el){ el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 150) + 'px'; }
function handleKey(e){
    if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        if(!activeDialogRequest) sendMessage();
    }
}

async function sendMessage(options={}){
    if(activeDialogRequest){
        cancelDialogRequest();
        return;
    }
    const input = document.getElementById('messageInput');
    const explicitMessage = typeof options.message === 'string' ? options.message.trim() : input.value.trim();
    const selectedSkill = availableAgentSkills.find(item => item.id === activeAgentSkill);
    const attachmentMessage = selectedSkill
        ? `请使用已选择的「${selectedSkill.name}」技能处理这些附件。若需求信息不足，请严格按该技能的引导模式开始，不要只做通用附件分析。`
        : '请读取并分析这些附件。';
    const message = explicitMessage || (refs.length ? attachmentMessage : '');
    if(!message) return;
    const displayMessage = typeof options.displayMessage === 'string'
        ? options.displayMessage.trim()
        : ecommerceVisibleMessageContent(message);
    const requestController = new AbortController();
    const dialogRequest = {id:uuid(), controller:requestController, cancelled:false};
    activeDialogRequest = dialogRequest;
    setSendButtonRunning(true);
    const pendingRefs = refs.slice();
    refs = [];
    renderRefs();
    input.value = '';
    autoGrow(input);
    const dockMode = isCanvasDock();
    if(!currentConversation){
        currentConversation = {id:'', title:'未命名对话', messages:[]};
        document.getElementById('messages').innerHTML = '';
    }
    const turnStartedAt = Date.now();
    dialogRequest.startedAt = turnStartedAt;
    addMessageBubble({role:'user', content:displayMessage, attachments:pendingRefs, created_at:turnStartedAt});
    const assistantBubble = addMessageBubble({
        role:'assistant',
        content: dockMode ? '' : (mode === 'image' ? tr('chat.generatingImage') : ''),
        _turnStartedAt: turnStartedAt,
    });
    dialogRequest.assistantBubble = assistantBubble;
    dialogRequest.dockMode = dockMode;
    if(dockMode || mode === 'chat') assistantBubble.bubble.classList.add('streaming');
    const dockCanvasBridge = Boolean(global.GptDockCanvasAgent?.canvasBridgeEnabled?.());
    if(dockMode){
        assistantBubble.thinkT0 = Date.now();
        assistantBubble.thinking = startDockThinkingFlow(assistantBubble.bubble, {
            row: assistantBubble.row,
            message,
            canvas: dockCanvasBridge && global.GptDockCanvasAgent?.wantsCanvasGenerate?.(message),
            refs: pendingRefs,
            model: activeChatModel || config.chat_model,
            provider: provider,
        });
    }
    scrollBottom();
    let canvasJobPromise = null;
    const canvasImageTaskId = dockMode && mode === 'image' ? `dock-image-${dialogRequest.id}` : '';
    if(dockMode && !CHAT_RESULTS_STAY_IN_DOCK && !activeAgentSkill && dockCanvasBridge && global.GptDockCanvasAgent?.wantsCanvasGenerate?.(message)){
        const localPlan = global.GptDockCanvasAgent.localCanvasPlan(message, pendingRefs);
        if(localPlan){
            showDockCanvasGenerating(assistantBubble, localPlan.reply, localPlan);
            canvasJobPromise = startDockCanvasJob(localPlan, currentConversation, updateConversationMeta);
        }
    }
    try {
        if(dockMode){
            await streamDockAgentMessage(message, pendingRefs, assistantBubble, canvasJobPromise, requestController.signal, dialogRequest.id);
        } else if(mode === 'chat') {
            await streamChatMessage(message, pendingRefs, assistantBubble, requestController.signal, dialogRequest.id);
        } else {
            postCanvasImageTask('start', canvasImageTaskId, {size:currentChatSize()});
            const data = await fetch('/api/chat', {
                method:'POST',
                headers:dialogHeaders(dialogRequest.id),
                signal:requestController.signal,
                body:JSON.stringify({
                    conversation_id: currentConversation.id || '',
                    message,
                    mode,
                    size: currentChatSize(),
                    model: activeChatModel || config.chat_model,
                    image_model: activeImageModel || config.image_model,
                    reference_images: pendingRefs,
                    provider: activeImageProvider,
                    agent_skill: activeAgentSkill,
                })
            }).then(async r => { if(!r.ok) throw new Error((await r.json()).detail || tr('chat.requestFailed')); return r.json(); });
            postCanvasImageTask('done', canvasImageTaskId, {images:chatResponseImageUrls(data)});
            currentConversation = data.conversation;
            setChatTitle(currentConversation.title);
            renderMessages(currentConversation.messages || []);
            await loadConversations();
        }
    } catch(err) {
        postCanvasImageTask('error', canvasImageTaskId);
        if(dialogRequest.cancelled || isAbortError(err)){
            const cancelledText = '已中止本次对话任务。';
            clearDockThinkingFlow(assistantBubble?.bubble, assistantBubble);
            if(dockMode) setDockReplyPlain(assistantBubble, cancelledText);
            else if(assistantBubble?.text) assistantBubble.text.textContent = cancelledText;
            finishAssistantBubbleStreaming(assistantBubble);
            return;
        }
        if(dockMode && assistantBubble?.bubble){
            await revealDockReply(assistantBubble, formatDockError(err.message));
            finishAssistantBubbleStreaming(assistantBubble);
        } else {
            const prior = currentConversation?.messages || [];
            const hasUser = prior.some(m => m.role === 'user' && m.content === message);
            const next = hasUser ? prior : [...prior, {
                role:'user', content:message, attachments:pendingRefs, created_at:turnStartedAt,
            }];
            renderMessages([...next, {
                role:'assistant', content:formatDockError(err.message), created_at:Date.now(),
            }]);
        }
    } finally {
        finishAssistantBubbleStreaming(assistantBubble);
        const ownsActiveRequest = activeDialogRequest === dialogRequest;
        if(ownsActiveRequest){
            activeDialogRequest = null;
            setSendButtonRunning(false);
        }
        if(ownsActiveRequest || dialogRequest.cancelled){
            assistantBubble.turnTimer?.stop();
            stopTurnTimers(dialogRequest.startedAt);
        }
        if(ecommerceWizardState.awaitingConfirmation && activeAgentSkill === ECOMMERCE_SKILL_ID){
            renderEcommerceConfirmationActions();
        }
        scrollBottom();
    }
}

function isCanvasDock(){
    return global.GptDockCanvasAgent?.isCanvasDock?.() || false;
}

function postCanvasImageTask(phase, taskId, extra={}){
    if(CHAT_RESULTS_STAY_IN_DOCK) return;
    if(!isCanvasDock() || window.parent === window || !taskId) return;
    window.parent.postMessage({
        source:'gpt-dock',
        type:'dock-canvas-image-task',
        phase,
        task_id:taskId,
        ...extra,
    }, location.origin);
}

function chatResponseImageUrls(data){
    const message = data?.message || {};
    const candidates = [
        ...(Array.isArray(message.image_urls) ? message.image_urls : []),
        message.image_url,
        ...(Array.isArray(message.attachments) ? message.attachments.map(item => item?.url) : []),
    ];
    return uniqueImageUrls(candidates);
}

async function readDockStreamError(res){
    try {
        const data = await res.json();
        if(res.status === 404 || data.detail === 'Not Found'){
            return '接口未就绪：请完全关闭并重启 Infinite Canvas 后再试。';
        }
        if(typeof data.detail === 'string') return fixMojibakeText(data.detail);
        return tr('chat.requestFailed');
    } catch(e) {
        try {
            const raw = await res.text();
            const parsed = JSON.parse(raw);
            if(typeof parsed.detail === 'string') return fixMojibakeText(parsed.detail);
            if(typeof parsed.message === 'string') return fixMojibakeText(parsed.message);
        } catch(err) { /* ignore */ }
        return `请求失败 (${res.status})`;
    }
}

async function streamDockSmartAgentMessage(message, pendingRefs, assistantBubble, signal, requestId){
    const canvasImageTaskId = isCanvasDock() ? `dock-agent-image-${requestId}` : '';
    let canvasImageTaskStarted = false;
    const startCanvasImageTask = () => {
        if(canvasImageTaskStarted || !canvasImageTaskId) return;
        canvasImageTaskStarted = true;
        postCanvasImageTask('start', canvasImageTaskId, {size:currentChatSize()});
    };
    const payload = {
        conversation_id: currentConversation.id || '',
        message,
        mode: 'agent',
        provider,
        model: activeChatModel || config.chat_model,
        image_provider: activeImageProvider,
        image_model: activeImageModel || config.image_model,
        size: currentChatSize(),
        reference_images: pendingRefs,
        dock_canvas: false,
        agent_skill: activeAgentSkill,
    };

    assistantBubble.thinking?.note('正在连接处理服务…');

    const consumeAgentStream = async (res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let pendingReply = '';
        while(true){
            const {value, done} = await reader.read();
            if(done) break;
            buffer += decoder.decode(value, {stream:true});
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for(const eventText of events){
                const line = eventText.split('\n').find(item => item.startsWith('data:'));
                if(!line) continue;
                let event;
                try { event = JSON.parse(line.slice(5).trim()); } catch(err) { continue; }
                if(event.type === 'meta' && event.conversation){
                    currentConversation = event.conversation;
                    setChatTitle(currentConversation.title);
                }
                if(event.type === 'status' && event.text){
                    if(event.stage === 'generating') startCanvasImageTask();
                    assistantBubble.thinking?.note(agentStageText(event.stage, event.text));
                    scrollBottom();
                }
                if(event.type === 'delta'){
                    const chunk = event.delta || '';
                    if(chunk){
                        pendingReply += chunk;
                        appendDockReply(assistantBubble, pendingReply);
                        scrollBottom();
                    }
                }
                if(event.type === 'gallery_progress' && event.url && event.purpose !== 'long_image_screen'){
                    startCanvasImageTask();
                    appendDockStreamingImage(assistantBubble, event.url, event.completed, event.total, event.purpose);
                    scrollBottom();
                }
                if(event.type === 'error'){
                    if(canvasImageTaskStarted) postCanvasImageTask('error', canvasImageTaskId);
                    const msg = formatDockError(event.detail);
                    await revealDockReply(assistantBubble, msg);
                    finishAssistantBubbleStreaming(assistantBubble);
                    throw new Error(msg);
                }
                if(event.type === 'done'){
                    const imageUrls = chatResponseImageUrls({message:event.message});
                    if(imageUrls.length){
                        startCanvasImageTask();
                        postCanvasImageTask('done', canvasImageTaskId, {images:imageUrls});
                    } else if(canvasImageTaskStarted){
                        postCanvasImageTask('error', canvasImageTaskId);
                    }
                    finishAssistantBubbleStreaming(assistantBubble);
                    currentConversation = event.conversation || currentConversation;
                    setChatTitle(currentConversation?.title || '');
                    renderMessages(currentConversation.messages || []);
                    loadConversations().catch(() => {});
                }
            }
        }
        finishAssistantBubbleStreaming(assistantBubble);
    };

    const tryStream = async () => {
        const res = await fetch('/api/chat/stream', { method:'POST', headers:dialogHeaders(requestId), body:JSON.stringify(payload), signal });
        if(!res.ok || !res.body){
            return false;
        }
        const ct = res.headers.get('content-type') || '';
        if(!ct.includes('text/event-stream')){
            return false;
        }
        assistantBubble.thinking?.note('处理通道已连接，正在等待结果…');
        await consumeAgentStream(res);
        return true;
    };

    try {
        if(await tryStream()) return;
    } catch(err) {
        if(signal?.aborted || isAbortError(err)){
            if(canvasImageTaskStarted) postCanvasImageTask('error', canvasImageTaskId);
            throw err;
        }
        if(err?.message && !String(err.message).includes('接口')) throw err;
        console.warn('[dock-agent] stream failed, using POST fallback', err);
    }

    assistantBubble.thinking?.note('正在切换备用处理通道…');
    let data;
    try {
        data = await fetch('/api/chat', {
            method:'POST',
            headers:dialogHeaders(requestId),
            signal,
            body:JSON.stringify(payload)
        }).then(async r => { if(!r.ok) throw new Error(await readDockStreamError(r)); return r.json(); });
    } catch(err) {
        if(canvasImageTaskStarted) postCanvasImageTask('error', canvasImageTaskId);
        throw err;
    }
    const fallbackImageUrls = chatResponseImageUrls(data);
    if(fallbackImageUrls.length){
        startCanvasImageTask();
        postCanvasImageTask('done', canvasImageTaskId, {images:fallbackImageUrls});
    } else if(canvasImageTaskStarted){
        postCanvasImageTask('error', canvasImageTaskId);
    }
    finishAssistantBubbleStreaming(assistantBubble);
    currentConversation = data.conversation;
    setChatTitle(currentConversation.title);
    renderMessages(currentConversation.messages || []);
    await loadConversations();
}

async function streamDockAgentMessage(message, pendingRefs, assistantBubble, existingCanvasJob, signal, requestId){
    if(CHAT_RESULTS_STAY_IN_DOCK || activeAgentSkill){
        return streamDockSmartAgentMessage(message, pendingRefs, assistantBubble, signal, requestId);
    }
    const bridgeEnabled = Boolean(global.GptDockCanvasAgent?.canvasBridgeEnabled?.());
    const needsCanvas = bridgeEnabled && global.GptDockCanvasAgent.wantsCanvasGenerate(message);
    const hasDocument = pendingRefs.some(ref => ref?.kind === 'document');
    if(!bridgeEnabled || (hasDocument && !needsCanvas)){
        return streamDockSmartAgentMessage(message, pendingRefs, assistantBubble, signal, requestId);
    }
    let observation = {};
    let canvasPlan = null;
    let pendingReply = '';
    let skipDoneRender = false;
    let canvasJobPromise = existingCanvasJob || null;

    if(needsCanvas && !canvasJobPromise){
        const localPlan = global.GptDockCanvasAgent.localCanvasPlan(message, pendingRefs);
        if(localPlan){
            canvasPlan = localPlan;
            pendingReply = localPlan.reply;
            showDockCanvasGenerating(assistantBubble, pendingReply, localPlan);
            scrollBottom();
            canvasJobPromise = startDockCanvasJob(localPlan, currentConversation, updateConversationMeta);
        }
        global.GptDockCanvasAgent.observeCanvas().then(obs => { observation = obs || {}; }).catch(() => {});
    } else if(needsCanvas && canvasJobPromise){
        canvasPlan = global.GptDockCanvasAgent.localCanvasPlan(message, pendingRefs);
        if(canvasPlan) pendingReply = canvasPlan.reply;
        global.GptDockCanvasAgent.observeCanvas().then(obs => { observation = obs || {}; }).catch(() => {});
    }

    const body = {
        conversation_id: currentConversation.id || '',
        message,
        mode: 'chat',
        dock_canvas: Boolean(global.GptDockCanvasAgent?.canvasBridgeEnabled?.()),
        provider,
        model: activeChatModel || config.chat_model,
        image_provider: activeImageProvider,
        image_model: activeImageModel || config.image_model,
        reference_images: pendingRefs,
        canvas_observation: global.GptDockCanvasAgent?.canvasBridgeEnabled?.() ? observation : {},
        agent_skill: activeAgentSkill,
    };

    assistantBubble.thinking?.note('正在发送请求…');
    let res = await fetch('/api/chat/stream', { method:'POST', headers:dialogHeaders(requestId), body:JSON.stringify(body), signal });

    if(res.status === 404){
        assistantBubble.thinking?.note('正在切换备用处理通道…');
        res = await fetch('/api/gpt-dock/agent/stream', { method:'POST', headers:dialogHeaders(requestId), body:JSON.stringify(body), signal });
    }

    if(res.ok) assistantBubble.thinking?.note('处理通道已连接，正在等待结果…');

    if(!res.ok){
        canvasPlan = global.GptDockCanvasAgent.localCanvasPlan(message, pendingRefs);
        if(!canvasPlan) throw new Error(await readDockStreamError(res));
        pendingReply = canvasPlan.reply;
        showDockCanvasGenerating(assistantBubble, pendingReply, canvasPlan);
        scrollBottom();
        if(!canvasJobPromise){
            canvasJobPromise = startDockCanvasJob(canvasPlan, currentConversation, updateConversationMeta);
        }
        skipDoneRender = true;
    } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while(true){
            const {value, done} = await reader.read();
            if(done) break;
            buffer += decoder.decode(value, {stream:true});
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for(const eventText of events){
                const line = eventText.split('\n').find(item => item.startsWith('data:'));
                if(!line) continue;
                let event;
                try { event = JSON.parse(line.slice(5).trim()); } catch(err) { continue; }
                if(event.type === 'meta' && event.conversation){
                    currentConversation = event.conversation;
                    setChatTitle(currentConversation.title);
                }
                if(event.type === 'status' && event.text){
                    assistantBubble.thinking?.note(agentStageText(event.stage, event.text));
                }
                if(event.type === 'delta'){
                    const chunk = event.delta || '';
                    if(chunk){
                        pendingReply += chunk;
                        appendDockReply(assistantBubble, pendingReply);
                        scrollBottom();
                    }
                }
                if(event.type === 'canvas_plan'){
                    canvasPlan = event.plan || null;
                    skipDoneRender = true;
                    if(event.reply) pendingReply = event.reply;
                    showDockCanvasGenerating(assistantBubble, pendingReply || canvasPlan?.reply || '正在画布上生成…', canvasPlan);
                    scrollBottom();
                    if(canvasPlan && !canvasJobPromise){
                        canvasJobPromise = startDockCanvasJob(canvasPlan, currentConversation, updateConversationMeta);
                    }
                }
                if(event.type === 'error'){
                    const msg = formatDockError(event.detail);
                    await revealDockReply(assistantBubble, msg);
                    finishAssistantBubbleStreaming(assistantBubble);
                    return;
                }
                if(event.type === 'done'){
                    finishAssistantBubbleStreaming(assistantBubble);
                    currentConversation = event.conversation || currentConversation;
                    setChatTitle(currentConversation?.title || '');
                    const finalText = pendingReply || event.message?.content || '';
                    if(finalText && !assistantBubble.bubble.classList.contains('dock-has-reply')){
                        await revealDockReply(assistantBubble, finalText);
                    } else if(finalText && !canvasPlan && !canvasJobPromise){
                        appendDockReply(assistantBubble, finalText);
                    } else if(!finalText && !canvasPlan){
                        clearDockThinkingFlow(assistantBubble.bubble, assistantBubble);
                    }
                    if(!skipDoneRender) renderMessages(currentConversation.messages || []);
                }
            }
        }
        finishAssistantBubbleStreaming(assistantBubble);
        if(!pendingReply && !canvasPlan && !skipDoneRender){
            await revealDockReply(assistantBubble, formatDockError('连接中断，未收到模型回复'));
        }
        if(!canvasPlan && global.GptDockCanvasAgent.wantsCanvasGenerate(message)){
            canvasPlan = global.GptDockCanvasAgent.localCanvasPlan(message, pendingRefs);
            if(canvasPlan){
                pendingReply = canvasPlan.reply;
                showDockCanvasGenerating(assistantBubble, pendingReply, localPlan);
                scrollBottom();
                if(!canvasJobPromise){
                    canvasJobPromise = startDockCanvasJob(canvasPlan, currentConversation, updateConversationMeta);
                }
                skipDoneRender = true;
            }
        }
    }

    if(canvasJobPromise){
        try {
            await waitForDialogTask(canvasJobPromise, signal);
            const expected = canvasPlan?.count || dockCanvasGenState?.expected || 1;
            await waitDockCanvasImagesMapped(expected);
            const imageUrls = uniqueImageUrls(dockCanvasGenState?.images || []);
            const finalMsg = finishDockCanvasGenReply(assistantBubble, pendingReply || canvasPlan?.reply || '', canvasPlan);
            const msgs = [...(currentConversation?.messages || [])];
            const last = msgs[msgs.length - 1];
            if(last?.role === 'assistant'){
                last.content = finalMsg;
                if(imageUrls.length){
                    last.type = imageUrls.length > 1 ? 'image_gallery' : 'image';
                    last.image_url = imageUrls[0];
                    last.image_urls = imageUrls;
                    last.attachments = imageUrls.map(url => ({ kind: 'image', url, name: '' }));
                    last.status = 'done';
                    last.progress_done = imageUrls.length;
                    last.progress_total = imageUrls.length;
                }
            }
            renderMessages(msgs);
            await loadConversations();
        } catch(err){
            if(signal?.aborted || isAbortError(err)) throw err;
            dockCanvasGenState = null;
            assistantBubble?.bubble?.removeAttribute('data-dock-canvas-gen');
            const base = pendingReply || canvasPlan?.reply || '';
            const errMsg = `${base}\n\n⚠️ ${err.message || '画布操作失败'}`;
            setDockReplyPlain(assistantBubble, errMsg);
            renderMessages([...(currentConversation?.messages || []), {role:'assistant', content: errMsg}]);
        }
    } else if(skipDoneRender){
        await loadConversations();
    }
}

async function streamChatMessage(message, pendingRefs, assistantBubble, signal, requestId){
    const currentProvider = provider;
    const currentChatModel = activeChatModel || config.chat_model;

    const res = await fetch('/api/chat/stream', {
        method:'POST',
        headers:dialogHeaders(requestId),
        signal,
        body:JSON.stringify({
            conversation_id: currentConversation.id || '',
            message,
            mode:'chat',
            model: currentChatModel,
            provider: currentProvider,
            reference_images: pendingRefs,
            agent_skill: activeAgentSkill,
        })
    });
    if(!res.ok) throw new Error((await res.json()).detail || tr('chat.requestFailed'));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    while(true){
        const {value, done} = await reader.read();
        if(done) break;
        buffer += decoder.decode(value, {stream:true});
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for(const eventText of events){
            const line = eventText.split('\n').find(item => item.startsWith('data:'));
            if(!line) continue;
            const event = JSON.parse(line.slice(5).trim());
            if(event.type === 'meta'){
                currentConversation = event.conversation;
                setChatTitle(currentConversation.title);
            }
            if(event.type === 'delta'){
                fullText += event.delta || '';
                setBubbleTextContent(assistantBubble.text, fullText, true);
                scrollBottom();
            }
            if(event.type === 'error') throw new Error(event.detail || tr('chat.requestFailed'));
            if(event.type === 'done'){
                finishAssistantBubbleStreaming(assistantBubble);
                currentConversation = event.conversation;
                setChatTitle(currentConversation.title);
                renderMessages(currentConversation.messages || []);
                await loadConversations();
            }
        }
    }
    finishAssistantBubbleStreaming(assistantBubble);
}

function scrollBottom(){ requestAnimationFrame(() => { const box = document.getElementById('messages'); if(box) box.scrollTop = box.scrollHeight; }); }

function openImagePreview(url){
    if(window.parent !== window && url){
        window.parent.postMessage({
            source:'gpt-dock',
            type:'dock-open-image-preview',
            url,
            name:'对话图片',
        }, location.origin);
        return;
    }
    const box = document.getElementById('imageLightbox');
    const img = document.getElementById('imageLightboxImg');
    if(!box || !img || !url) return;
    img.src = url;
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
}

function closeImagePreview(){
    const box = document.getElementById('imageLightbox');
    const img = document.getElementById('imageLightboxImg');
    if(!box || !img) return;
    box.hidden = true;
    img.removeAttribute('src');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (event) => {
    if(event.key === 'Escape'){
        closeImagePreview();
        closeSkillMenu();
    }
});
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
function escapeAttr(str){ return escapeHtml(str); }

function extractMarkdownImageUrls(content){
    const urls = [];
    const re = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    while((match = re.exec(String(content || ''))) !== null){
        urls.push(match[2]);
    }
    return urls;
}

function stripMarkdownImages(content){
    return String(content || '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function uniqueImageUrls(urls){
    const seen = new Set();
    return [...(urls || [])]
        .map(url => String(url || '').trim())
        .filter(url => {
            if(!url || seen.has(url)) return false;
            seen.add(url);
            return true;
        });
}

function messageImageUrls(msg, { includeAttachmentImages = true } = {}){
    const completedPartial = msg?.status === 'partial'
        && Number(msg?.completed_screen_count || 0) > 0;
    if(msg?.role === 'assistant' && msg?.success === false && !completedPartial) return [];
    const urls = [];
    if(Array.isArray(msg?.image_urls)) urls.push(...msg.image_urls);
    if(msg?.image_url) urls.push(msg.image_url);
    if(includeAttachmentImages && Array.isArray(msg?.attachments)){
        msg.attachments.forEach(ref => {
            if(ref?.kind === 'image' && ref.url) urls.push(ref.url);
        });
    }
    urls.push(...extractMarkdownImageUrls(msg?.content));
    return uniqueImageUrls(urls);
}

function appendDockImageGallery(bubble, urls){
    urls = uniqueImageUrls(urls);
    if(!bubble || !urls.length) return;
    if(urls.length === 1){
        const img = document.createElement('img');
        img.className = 'generated';
        img.src = urls[0];
        img.loading = 'lazy';
        img.onclick = () => openImagePreview(urls[0]);
        bubble.appendChild(img);
        return;
    }
    const gallery = document.createElement('div');
    gallery.className = 'dock-img-gallery';
    const hero = document.createElement('div');
    hero.className = 'dock-img-hero';
    const heroImg = document.createElement('img');
    heroImg.src = urls[0];
    heroImg.alt = '';
    heroImg.loading = 'lazy';
    heroImg.onclick = () => openImagePreview(heroImg.src);
    hero.appendChild(heroImg);
    const zoom = document.createElement('button');
    zoom.type = 'button';
    zoom.className = 'dock-img-zoom';
    zoom.title = '预览';
    zoom.innerHTML = '<i data-lucide="maximize-2" class="w-4 h-4"></i>';
    zoom.onclick = () => openImagePreview(heroImg.src);
    hero.appendChild(zoom);
    const thumbs = document.createElement('div');
    thumbs.className = 'dock-img-thumbs';
    urls.forEach((url, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `dock-img-thumb${index === 0 ? ' active' : ''}`;
        btn.innerHTML = `<img src="${escapeAttr(url)}" alt="">`;
        btn.onclick = () => {
            heroImg.src = url;
            thumbs.querySelectorAll('.dock-img-thumb').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
        };
        thumbs.appendChild(btn);
    });
    gallery.appendChild(hero);
    gallery.appendChild(thumbs);
    bubble.appendChild(gallery);
    lucide.createIcons();
}

function appendDockStreamingImage(assistantBubble, url, completed, total, purpose=''){
    const bubble = assistantBubble?.bubble || assistantBubble;
    if(!bubble || !url) return;
    assistantBubble?.thinking?.note(`已完成 ${Number(completed) || 1}/${Math.max(1, Number(total) || 1)} 张图片`);
    showDockActivityWithReply(assistantBubble);
    bubble.hidden = false;
    if(assistantBubble?.text) assistantBubble.text.hidden = true;

    let gallery = bubble.querySelector('.dock-img-gallery-streaming');
    let heroImg;
    let thumbs;
    let progressLabel;
    if(!gallery){
        gallery = document.createElement('div');
        gallery.className = 'dock-img-gallery dock-img-gallery-streaming';
        progressLabel = document.createElement('div');
        progressLabel.className = 'dock-img-streaming-label';
        const hero = document.createElement('div');
        hero.className = 'dock-img-hero';
        heroImg = document.createElement('img');
        heroImg.alt = '';
        heroImg.loading = 'eager';
        heroImg.onclick = () => openImagePreview(heroImg.src);
        hero.appendChild(heroImg);
        const zoom = document.createElement('button');
        zoom.type = 'button';
        zoom.className = 'dock-img-zoom';
        zoom.title = '预览';
        zoom.innerHTML = '<i data-lucide="maximize-2" class="w-4 h-4"></i>';
        zoom.onclick = () => openImagePreview(heroImg.src);
        hero.appendChild(zoom);
        thumbs = document.createElement('div');
        thumbs.className = 'dock-img-thumbs';
        gallery.append(progressLabel, hero, thumbs);
        bubble.appendChild(gallery);
    } else {
        heroImg = gallery.querySelector('.dock-img-hero img');
        thumbs = gallery.querySelector('.dock-img-thumbs');
        progressLabel = gallery.querySelector('.dock-img-streaming-label');
    }

    if([...thumbs.querySelectorAll('.dock-img-thumb')].some(item => item.dataset.url === url)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dock-img-thumb active';
    btn.dataset.url = url;
    const done = Number(completed || thumbs.children.length + 1);
    const expected = Number(total || completed || 1);
    const finishedScreen = purpose === 'long_image_screen_preview';
    btn.title = finishedScreen ? `第 ${done} / ${expected} 屏成品` : `第 ${done} / ${expected} 张`;
    btn.innerHTML = `<img src="${escapeAttr(url)}" alt="">`;
    btn.onclick = () => {
        heroImg.src = url;
        thumbs.querySelectorAll('.dock-img-thumb').forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
    };
    thumbs.querySelectorAll('.dock-img-thumb').forEach(item => item.classList.remove('active'));
    thumbs.appendChild(btn);
    heroImg.src = url;
    if(progressLabel){
        progressLabel.textContent = finishedScreen
            ? `第 ${done}/${expected} 屏成品已完成，可立即查看`
            : `已完成 ${done}/${expected} 张`;
    }
    thumbs.scrollTop = thumbs.scrollHeight;
    lucide.createIcons();
}

function inlineAssistantMarkdownHtml(content){
    return escapeHtml(String(content || ''))
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        .replace(/\*/g, '');
}

function assistantMarkdownHtml(content){
    const blocks = [];
    let paragraph = [];
    let listItems = [];
    let listTag = '';
    const flushParagraph = () => {
        if(!paragraph.length) return;
        blocks.push(`<p>${paragraph.map(inlineAssistantMarkdownHtml).join('<br>')}</p>`);
        paragraph = [];
    };
    const flushList = () => {
        if(!listItems.length) return;
        blocks.push(`<${listTag}>${listItems.map(item => `<li>${inlineAssistantMarkdownHtml(item)}</li>`).join('')}</${listTag}>`);
        listItems = [];
        listTag = '';
    };
    String(content || '').replace(/\r\n?/g, '\n').split('\n').forEach(rawLine => {
        const line = rawLine.trim();
        const bullet = /^[-*+]\s+(.+)$/.exec(line);
        const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
        const heading = /^(#{1,6})\s+(.+)$/.exec(line);
        if(bullet || numbered){
            flushParagraph();
            const nextTag = numbered ? 'ol' : 'ul';
            if(listTag && listTag !== nextTag) flushList();
            listTag = nextTag;
            listItems.push((bullet || numbered)[1]);
            return;
        }
        flushList();
        if(heading){
            flushParagraph();
            const level = Math.min(4, heading[1].length + 1);
            blocks.push(`<h${level}>${inlineAssistantMarkdownHtml(heading[2])}</h${level}>`);
            return;
        }
        if(!line){ flushParagraph(); return; }
        paragraph.push(line);
    });
    flushParagraph();
    flushList();
    return blocks.join('');
}

function setBubbleTextContent(textEl, content, markdown=false){
    if(!textEl) return;
    const value = String(content || '');
    textEl.classList.toggle('is-markdown', Boolean(markdown));
    if(markdown){
        textEl.innerHTML = assistantMarkdownHtml(value);
        return;
    }
    textEl.textContent = value;
}

async function bootstrap() {
    applyLanguage();
    if(isCanvasDock()){
        document.documentElement.classList.add('gpt-dock-canvas-mode');
        document.body.classList.add('gpt-dock-canvas-mode');
        setCanvasDockSkillDevelopmentState();
        document.getElementById('dockApiPanel')?.addEventListener('click', event => event.stopPropagation());
        mode = 'chat';
        const input = document.getElementById('messageInput');
        if(input) input.placeholder = '像 ChatGPT 一样对话，也可直接说「帮我画一张…」';
    } else {
        setChatRatio('square');
        setChatResolution('1k');
    }
    await loadConfig();
    if(isCanvasDock()) updateDockApiButtonLabel();
    await loadConversations();
    lucide.createIcons();
}
const windowExports = {
    newConversation,
    toggleHistory,
    setMode,
    setProvider,
    setActiveModel,
    setDockChatProvider,
    setDockChatModel,
    setDockImageProvider,
    setDockImageModel,
    toggleDockApiPanel,
    closeDockApiPanel,
    setChatRatio,
    setChatResolution,
    sendMessage,
    autoGrow,
    handleKey,
    closeImagePreview,
    closeSkillMenu,
    removeRef,
    openImagePreview,
    uploadFiles,
    selectAgentSkill,
    toggleSkillMenu,
    resetEcommerceWizard,
    ecommerceWizardBack,
    selectEcommerceDesignType,
    openEcommerceMaterialPicker,
    selectEcommerceDeliveryPlan,
    toggleEcommerceSellingPoint,
    updateEcommerceCustomSellingPoints,
    confirmEcommerceSellingPoints,
    selectEcommerceStyle,
    updateEcommerceNotes,
    startEcommerceBrief,
    focusEcommerceRevisionInput,
    confirmEcommerceGeneration
};
Object.assign(global, windowExports);
Core.register('dockApp', Object.freeze({ bootstrap, ...windowExports }));
Core.register('state', Object.freeze({
    getState(){
        return {
            currentConversation, conversations, mode, provider, activeChatModel,
            activeImageProvider, activeImageModel, apiProviders, chatProviderModels,
            chatRatio, chatResolution, refs, availableAgentSkills, activeAgentSkill, config, userId
        };
    }
}));
if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => { bootstrap().catch(console.error); });
} else {
    bootstrap().catch(console.error);
}
})(window);
