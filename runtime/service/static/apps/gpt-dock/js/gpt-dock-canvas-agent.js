/**
 * GPT Dock canvas agent — isolated bridge + orchestration (canvas sidebar only).
 */
(function(global){
'use strict';

/** Set false to keep dock chat as a standalone agent (no canvas observe/actions/switch). */
const CANVAS_BRIDGE_ENABLED = false;

const BRIDGE_SOURCE = 'gpt-dock';
let pendingBridge = new Map();
let bridgeReady = false;

function canvasBridgeEnabled(){
    return CANVAS_BRIDGE_ENABLED;
}

function isCanvasDock(){
    try {
        if(document.documentElement.classList.contains('gpt-dock-canvas-mode')) return true;
        if(document.body?.classList.contains('gpt-dock-canvas-mode')) return true;
        if(new URLSearchParams(location.search).get('dock') === '1') return true;
        if(window.name === 'frame-gpt-dock') return true;
        if(window.frameElement?.id === 'frame-gpt-dock') return true;
        return window.parent !== window && window.parent.document?.getElementById?.('frame-gpt-dock')?.contentWindow === window;
    } catch(e) {
        return new URLSearchParams(location.search).get('dock') === '1';
    }
}

function postShell(payload){
    if(!canvasBridgeEnabled() || !isCanvasDock()) return;
    window.parent.postMessage({ ...payload, source: BRIDGE_SOURCE }, location.origin);
}

function requestId(){
    return `dock-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function waitBridge(request_id, timeoutMs = 120000){
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingBridge.delete(request_id);
            reject(new Error('画布响应超时'));
        }, timeoutMs);
        pendingBridge.set(request_id, { resolve, reject, timer });
    });
}

function handleBridgeResult(data){
    const pending = pendingBridge.get(data.request_id);
    if(!pending) return;
    clearTimeout(pending.timer);
    pendingBridge.delete(data.request_id);
    pending.resolve(data);
}

function initBridgeListener(){
    if(bridgeReady) return;
    bridgeReady = true;
    window.addEventListener('message', event => {
        if(event.origin && event.origin !== location.origin) return;
        const data = event.data || {};
        if(data.source !== 'shell-bridge') return;
        if(data.type === 'dock-canvas-bridge-result' || data.type === 'canvas-agent-results' || data.type === 'canvas-agent-observation'){
            handleBridgeResult({ ...data, type: 'dock-canvas-bridge-result' });
        }
    });
}

async function observeCanvas(){
    if(!canvasBridgeEnabled()) return {};
    initBridgeListener();
    if(!isCanvasDock()) return {};
    const request_id = requestId();
    postShell({ type: 'dock-canvas-bridge', op: 'observe', request_id });
    const result = await waitBridge(request_id, 15000);
    return result.observation || {};
}

async function runCanvasActions(actions){
    if(!canvasBridgeEnabled()) return { results: [], observation: {} };
    initBridgeListener();
    if(!isCanvasDock() || !actions?.length) return { results: [], observation: {} };
    const request_id = requestId();
    postShell({ type: 'dock-canvas-bridge', op: 'actions', request_id, actions });
    const result = await waitBridge(request_id, 600000);
    return { results: result.results || [], observation: result.observation || {} };
}

function switchCanvas(canvasId){
    if(!canvasBridgeEnabled() || !canvasId || !isCanvasDock()) return;
    postShell({ type: 'dock-switch-canvas', canvas_id: canvasId });
}

async function ensureCanvasForConversation(conversation, needsNew){
    if(!canvasBridgeEnabled() || !isCanvasDock()) return '';
    if(needsNew){
        const request_id = requestId();
        postShell({ type: 'dock-canvas-bridge', op: 'new-canvas', request_id, title: conversation?.title || '智能画布' });
        const result = await waitBridge(request_id, 30000);
        return result.observation?.canvas?.id || result.canvas_id || '';
    }
    return String(conversation?.canvas_id || '').trim();
}

async function stageCanvasBatch(plan){
    initBridgeListener();
    const batchBase = buildBatchGenerateAction(plan);
    const { results, observation } = await runCanvasActions([{ ...batchBase, stage_only: true }]);
    const failed = (results || []).filter(item => item && item.ok === false);
    if(failed.length){
        throw new Error(failed[0]?.error || '画布节点创建失败');
    }
    const nodeIds = results.find(item => item.type === 'batch_generate_images')?.node_ids || [];
    return { batchBase, nodeIds, canvasId: observation?.canvas?.id || '', results, observation };
}

async function runStagedCanvasBatch(batchBase, nodeIds){
    if(!nodeIds?.length) return { results: [], observation: {} };
    const { results, observation } = await runCanvasActions([{
        ...batchBase,
        run_staged_node_ids: nodeIds,
    }]);
    const failed = (results || []).filter(item => item && item.ok === false);
    if(failed.length){
        throw new Error(failed[0]?.error || '画布生图失败');
    }
    return { results, observation };
}

async function executeCanvasPlan(plan, conversation, updateMeta){
    if(!canvasBridgeEnabled()) return null;
    openCanvasShell();
    initBridgeListener();
    const needsNew = shouldCreateNewCanvas(conversation);

    if(needsNew){
        await ensureCanvasForConversation(conversation, true);
    }

    const staged = await stageCanvasBatch(plan);
    if(staged.canvasId){
        linkConversationCanvas(conversation, staged.canvasId, updateMeta).catch(err => {
            console.warn('[dock-canvas] link canvas failed', err);
        });
    }

    const runOut = await runStagedCanvasBatch(staged.batchBase, staged.nodeIds);
    return {
        results: [...(staged.results || []), ...(runOut.results || [])],
        canvasId: runOut.observation?.canvas?.id || staged.canvasId,
        nodeIds: staged.nodeIds,
    };
}

function shouldCreateNewCanvas(conversation){
    if(!conversation) return false;
    return Boolean(conversation.awaiting_new_canvas);
}

function openCanvasShell(){
    if(!canvasBridgeEnabled() || !isCanvasDock()) return;
    postShell({ type: 'dock-open-canvas' });
}

function postStageToShell(plan){
    if(!canvasBridgeEnabled() || !isCanvasDock() || !plan) return;
    initBridgeListener();
    openCanvasShell();
    const batchBase = buildBatchGenerateAction(plan);
    postShell({
        type: 'dock-canvas-bridge',
        op: 'actions',
        request_id: requestId(),
        actions: [{ ...batchBase, stage_only: true }],
    });
}

function buildBatchGenerateAction(plan){
    return {
        type: 'batch_generate_images',
        count: plan.count || 1,
        prompts: plan.prompts || [],
        reference_urls: plan.reference_urls || [],
        aspect_ratio: plan.aspect_ratio || 'auto',
        provider_id: plan.provider_id || '',
        model: plan.model || '',
    };
}

async function linkConversationCanvas(conversation, canvasId, updateMeta){
    if(!conversation?.id || !canvasId || !updateMeta) return;
    await updateMeta(conversation.id, {
        canvas_id: canvasId,
        awaiting_new_canvas: false,
    });
    conversation.canvas_id = canvasId;
    conversation.awaiting_new_canvas = false;
}

function markConversationFresh(conversation){
    if(!canvasBridgeEnabled()) return;
    if(!conversation) return;
    conversation.awaiting_new_canvas = true;
    conversation.canvas_id = '';
}

function onOpenConversation(conversation){
    if(!canvasBridgeEnabled()) return;
    if(!isCanvasDock() || !conversation?.canvas_id) return;
    switchCanvas(conversation.canvas_id);
}

function filterReferenceUrls(message, refs){
    if(!shouldUseReferenceImages(message, refs)) return [];
    return (refs || []).map(item => item?.url || item).filter(Boolean);
}

function shouldUseReferenceImages(message, refs){
    if(!refs?.length) return false;
    return /参考|参照|按这[张幅个]?|照着|同款|similar|based on|from (this|the) (image|photo|picture)|用(上传|附件|这张)|跟这张|like this/i.test(String(message || ''));
}

function wantsCanvasGenerate(message){
    if(!canvasBridgeEnabled()) return false;
    const text = String(message || '');
    return /生成|生图|做图|出图|特写|主图|详情|海报|画布|排列|批量|来张|来几张|帮我做|帮我生成|画一|画张|画个|来画|generate|create image/i.test(text);
}

function countFromMessage(message){
    const text = String(message || '');
    const m = text.match(/(\d{1,2})\s*[张个幅]/);
    if(m) return Math.max(1, Math.min(12, Number(m[1])));
    const cn = {一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
    for(const [ch, n] of Object.entries(cn)){
        if(text.includes(`${ch}张`) || text.includes(`${ch}个`)) return n;
    }
    if(/多张|若干|一批/.test(text)) return 4;
    return 1;
}

function localCanvasPlan(message, refs){
    if(!wantsCanvasGenerate(message)) return null;
    const count = countFromMessage(message);
    const isCloseup = /特写|close|macro/i.test(message);
    const antiCombined = 'single standalone image only, no collage, no grid, no split screen, no stacked images, no series sheet, no poster layout';
    const variants = [
        'extreme close-up product detail, shallow depth of field, studio light',
        'macro texture shot, premium commercial photography',
        '45-degree hero angle, clean background, soft shadow',
        'side profile detail, minimal composition',
        'top-down flat lay, balanced whitespace',
        'environmental lifestyle context, natural light',
        'dramatic rim light, high contrast',
        'soft diffused light, elegant minimal style',
    ];
    const prompts = [];
    for(let i = 0; i < count; i += 1){
        const variant = variants[i % variants.length];
        prompts.push(isCloseup
            ? `image ${i + 1} of ${count}, ${variant}, subject from: ${message.slice(0, 180)}, ${antiCombined}`
            : `image ${i + 1} of ${count}, Commercial visual variant, ${variant}, theme: ${message.slice(0, 180)}, ${antiCombined}`);
    }
    const refUrls = filterReferenceUrls(message, refs);
    const msg = String(message || '');
    const aspectRatio = /3\s*[：:]\s*4|3:4|竖图|竖版/i.test(msg) ? 'portrait43'
        : /4\s*[：:]\s*3|4:3/i.test(msg) ? 'landscape43'
        : /16\s*[：:]\s*9|16:9|横图|横版/i.test(msg) ? 'wide'
        : /9\s*[：:]\s*16|9:16/i.test(msg) ? 'story'
        : /1\s*[：:]\s*1|1:1|方图|正方形/i.test(msg) ? 'square'
        : 'auto';
    return {
        count,
        prompts,
        reference_urls: refUrls,
        aspect_ratio: aspectRatio,
        reply: `好的，正在画布上为你生成 ${count} 张${isCloseup ? '特写' : '方案'}图，并自动对齐排列。`,
    };
}

const api = Object.freeze({
    canvasBridgeEnabled,
    isCanvasDock,
    observeCanvas,
    runCanvasActions,
    switchCanvas,
    shouldCreateNewCanvas,
    openCanvasShell,
    postStageToShell,
    stageCanvasBatch,
    executeCanvasPlan,
    markConversationFresh,
    onOpenConversation,
    localCanvasPlan,
    wantsCanvasGenerate,
});

global.GptDockCanvasAgent = api;
global.GptDockChatCore?.register?.('canvasAgent', api);

})(window);
