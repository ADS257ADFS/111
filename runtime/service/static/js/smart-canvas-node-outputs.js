/**
 * Smart Canvas — node output replacement, history groups, layout shift on generate.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasNodeOutputs] deps not registered');
        return c;
    }

    function nodes(){
        return S().getNodes();
    }

    function setNodes(v){
        S().setNodes(v);
    }

    function canvasConnections(){
        return S().getCanvas()?.connections || [];
    }

function pushRightSideNodes(sourceNode, delta){
    const shift = Math.ceil(Number(delta) || 0);
    if(!sourceNode || shift <= 0) return;
    const sourceRight = (Number(sourceNode.x) || 0) + S().nodeRect(sourceNode).width - shift;
    const downstreamIds = new Set(S().downstreamNodesForId(sourceNode.id).map(n => n.id));
    nodes().forEach(n => {
        if(!n || n.id === sourceNode.id) return;
        const r = S().nodeRect(n);
        const shouldShift = downstreamIds.has(n.id) || (Number(r.x) > sourceRight && Math.abs((Number(r.y) || 0) - (Number(sourceNode.y) || 0)) < 520);
        if(shouldShift) n.x = (Number(n.x) || 0) + shift;
    });
}
function cascadeOutputTitle(kind='image', count=1){
    if(Number(count) > 1) return kind === 'video' ? 'Videos' : kind === 'audio' ? 'Audios' : kind === 'text' ? 'Texts' : 'Group';
    return kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : kind === 'text' ? 'Text' : kind === 'file' ? 'File' : 'Image';
}
function cleanHistoryImages(images=[]){
    const seen = new Set();
    return (images || [])
        .filter(img => img?.url)
        .map(img => S().stripImageGenerationMeta({...img}))
        .filter(img => {
            const key = `${img.kind || ''}|${img.url || ''}`;
            if(seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}
function hasHistoryConnection(nodeId, groupId){
    return Boolean(nodeId && groupId && canvasConnections().some(conn => conn.from === nodeId && conn.to === groupId && (conn.kind || 'flow') === 'history'));
}
function demoteHistoryGroupNode(group){
    if(!group) return;
    delete group.historyFor;
    delete group.isHistoryGroup;
    if(group.title === '历史分组'){
        const count = (group.images || []).length;
        group.title = count > 1 ? 'Group' : count === 1 ? 'Image' : S().tr('smart.createImportNode');
    }
}
function historyGroupForNode(node){
    if(!node?.id) return null;
    let matched = null;
    nodes().forEach(n => {
        if(!S().isHistoryGroupNode(n) || n.historyFor !== node.id) return;
        if(hasHistoryConnection(node.id, n.id)){
            if(!matched) matched = n;
        } else {
            demoteHistoryGroupNode(n);
        }
    });
    return matched;
}
function positionHistoryGroupForNode(node, group){
    if(!node || !group) return;
    const r = S().nodeRect(node);
    const gr = S().nodeRect(group);
    if(!Number.isFinite(Number(group.x))) group.x = Math.round((Number(node.x) || 0) + Math.max(0, (r.width - gr.width) / 2));
    if(!Number.isFinite(Number(group.y))) group.y = Math.round((Number(node.y) || 0) + r.height + 56);
}
function ensureHistoryGroupForNode(node){
    if(!node?.id) return null;
    let group = historyGroupForNode(node);
    if(!group){
        const r = S().nodeRect(node);
        group = {
            id:S().uid('smart'),
            type:'smart-image',
            x:Math.round(Number(node.x || 0)),
            y:Math.round(Number(node.y || 0) + r.height + 56),
            title:'历史分组',
            images:[],
            historyFor:node.id,
            isHistoryGroup:true,
            scale:S().MEDIA_GROUP_DEFAULT_SCALE,
            created_at:Date.now()
        };
        nodes().push(group);
    }
    group.type = 'smart-image';
    group.title = '历史分组';
    group.isHistoryGroup = true;
    group.historyFor = node.id;
    if(!Number.isFinite(Number(group.scale))) group.scale = S().MEDIA_GROUP_DEFAULT_SCALE;
    S().addConnection(node.id, group.id, 'history');
    positionHistoryGroupForNode(node, group);
    return group;
}
function replaceOutputsToNodeWithHistory(node, additions, kind='image', meta=null, options={}){
    if(!node || !additions?.length) return [];
    const beforeRight = (Number(node.x) || 0) + S().nodeRect(node).width;
    const existing = cleanHistoryImages(node.images || []);
    const next = cleanHistoryImages(additions);
    if(!next.length) return [];
    const history = existing.length ? ensureHistoryGroupForNode(node) : historyGroupForNode(node);
    if(history){
        const archived = cleanHistoryImages([...existing, ...(history.images || [])]);
        history.images = archived;
        history.title = '历史分组';
        history.outputKind = kind;
        history.scale = S().MEDIA_GROUP_DEFAULT_SCALE;
        delete history.w;
        delete history.h;
    }
    node.images = next;
    node.pending = 0;
    node.running = false;
    delete node.pendingTasks;
    node.runFinishedAt = S().nowMs();
    if(!node.runStartedAt) node.runStartedAt = meta?.createdAt || node.runFinishedAt;
    node.runElapsedMs = Math.max(0, node.runFinishedAt - Number(node.runStartedAt || node.runFinishedAt));
    node.runTimerHidden = false;
    node.outputKind = kind;
    node.title = cascadeOutputTitle(kind, node.images.length);
    node.scale = node.images.length > 1 ? S().MEDIA_GROUP_DEFAULT_SCALE : S().MEDIA_NODE_DEFAULT_SCALE;
    delete node.w;
    delete node.h;
    if(meta) attachRunMeta(node, meta);
    const afterRight = (Number(node.x) || 0) + S().nodeRect(node).width;
    const skipShift = options.skipShift || Boolean(S().smartLoopContext?.nodeId);
    if(!skipShift) pushRightSideNodes(node, afterRight - beforeRight + 36);
    S().selectedImage = {nodeId:'', index:-1};
    return next;
}
function replaceOutputsToNodeDirect(node, additions, kind='image', meta=null){
    if(!node || !additions?.length) return [];
    const next = cleanHistoryImages(additions);
    if(!next.length) return [];
    node.images = next;
    node.pending = 0;
    node.running = false;
    delete node.pendingTasks;
    node.runFinishedAt = S().nowMs();
    if(!node.runStartedAt) node.runStartedAt = meta?.createdAt || node.runFinishedAt;
    node.runElapsedMs = Math.max(0, node.runFinishedAt - Number(node.runStartedAt || node.runFinishedAt));
    node.runTimerHidden = false;
    node.outputKind = kind;
    node.title = cascadeOutputTitle(kind, node.images.length);
    node.scale = node.images.length > 1 ? S().MEDIA_GROUP_DEFAULT_SCALE : S().MEDIA_NODE_DEFAULT_SCALE;
    delete node.w;
    delete node.h;
    if(meta) attachRunMeta(node, meta);
    S().selectedImage = {nodeId:'', index:-1};
    return next;
}
function finalizeOverwritePendingNode(node, urls, meta, kind='image'){
    const ext = kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : kind === 'text' ? 'txt' : 'png';
    const additions = (urls || []).map((item, i) => {
        const url = typeof item === 'string' ? item : item?.url || '';
        const itemKind = (typeof item === 'object' && item.kind) || kind;
        return S().stripImageGenerationMeta({url, name:(typeof item === 'object' && item.name) || `regenerate-${i + 1}.${ext}`, kind:itemKind, generatedResult:true});
    }).filter(item => item.url);
    replaceOutputsToNodeDirect(node, additions, kind, meta);
    delete node?._overwriteRun;
    delete node?._overwriteResults;
    return additions;
}
function appendOutputsToNode(node, additions, kind='image', options={}){
    if(!node || !additions?.length) return [];
    const beforeRight = (Number(node.x) || 0) + S().nodeRect(node).width;
    const existing = (node.images || []).filter(img => img?.url).map(img => S().stripImageGenerationMeta(img));
    const next = additions.map(img => S().stripImageGenerationMeta({...img}));
    node.images = [...existing, ...next];
    node.pending = 0;
    node.running = false;
    node.runFinishedAt = S().nowMs();
    if(!node.runStartedAt) node.runStartedAt = node.runFinishedAt;
    node.runElapsedMs = Math.max(0, node.runFinishedAt - Number(node.runStartedAt || node.runFinishedAt));
    node.runTimerHidden = false;
    node.outputKind = kind;
    node.title = node.images.length > 1 ? (kind === 'video' ? 'Videos' : kind === 'audio' ? 'Audios' : kind === 'text' ? 'Texts' : 'Group') : (kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : kind === 'text' ? 'Text' : kind === 'file' ? 'File' : 'Image');
    delete node.w;
    delete node.h;
    const afterRight = (Number(node.x) || 0) + S().nodeRect(node).width;
    const skipShift = options.skipShift || Boolean(S().smartLoopContext?.nodeId);
    if(!skipShift) pushRightSideNodes(node, afterRight - beforeRight + 36);
    return next;
}
function appendLoopOutputsToNode(node, additions, kind='image', ctx){
    if(ctx === undefined) ctx = S().smartLoopContext;
    if(!node || !additions?.length) return [];
    const runState = ctx?.runState;
    if(runState && !runState.loopAppendInitialized) runState.loopAppendInitialized = new Set();
    const initialized = runState?.loopAppendInitialized;
    if(initialized && !initialized.has(node.id)){
        initialized.add(node.id);
        const existing = cleanHistoryImages(node.images || []);
        if(existing.length){
            const history = ensureHistoryGroupForNode(node);
            history.images = cleanHistoryImages([...existing, ...(history.images || [])]);
            history.title = '历史分组';
            history.outputKind = kind;
            history.scale = S().MEDIA_GROUP_DEFAULT_SCALE;
            delete history.w;
            delete history.h;
        }
        node.images = [];
    }
    return appendOutputsToNode(node, additions, kind, {skipShift:true});
}

function expectedOutputSize(sourceSettings=S().settings){
    if(sourceSettings.engine === 'comfy'){
        if(sourceSettings.comfyMode === 'text'){
            const w = Number(sourceSettings.width) || 1024;
            const h = Number(sourceSettings.height) || 1024;
            return {w, h};
        }
        return {w:1024, h:1024};
    }
    const sizeStr = S().sizeForRun(sourceSettings);
    const parsed = S().parseSizeValue(sizeStr);
    if(parsed){
        return {w: Number(parsed.width) || 1024, h: Number(parsed.height) || 1024};
    }
    return {w:1024, h:1024};
}

function explicitRequestOutputSizeForPending(sourceSettings=S().settings){
    if(S().isApiLikeEngine(sourceSettings.engine) && sourceSettings.apiKind !== 'video'){
        const parsed = S().parseSizeValue(S().sizeForRun(sourceSettings));
        if(parsed) return {w:Number(parsed.width) || 1024, h:Number(parsed.height) || 1024};
    }
    if(sourceSettings.engine === 'comfy' && sourceSettings.comfyMode === 'text'){
        const w = Number(sourceSettings.width) || 1024;
        const h = Number(sourceSettings.height) || 1024;
        return {w, h};
    }
    return null;
}

function pendingAspectFromSettings(sourceSettings=S().settings){
    const settings = sourceSettings || {};
    const ratioValue = settings.apiKind === 'video' ? settings.videoAspect : settings.ratio;
    const customValue = settings.apiKind === 'video' ? settings.videoCustomRatio : settings.customRatio;
    const named = {
        square:1,
        portrait:2 / 3,
        landscape:3 / 2,
        portrait43:3 / 4,
        landscape43:4 / 3,
        story:9 / 16,
        wide:16 / 9,
        ultrawide:21 / 9,
        ultratall:9 / 21,
        '1:1':1,
        '2:3':2 / 3,
        '3:2':3 / 2,
        '3:4':3 / 4,
        '4:3':4 / 3,
        '9:16':9 / 16,
        '16:9':16 / 9,
        '21:9':21 / 9,
        '9:21':9 / 21
    };
    if(Number(named[ratioValue]) > 0) return Number(named[ratioValue]);
    const raw = String(ratioValue === 'custom' ? customValue : ratioValue || '').trim();
    const parts = raw.split(/[:xX*]/).map(Number);
    return parts.length === 2 && parts[0] > 0 && parts[1] > 0 ? parts[0] / parts[1] : 0;
}

function pendingSizeFromImageRef(img){
    const w = Number(img?.natural_w || img?.width || 0);
    const h = Number(img?.natural_h || img?.height || 0);
    return w > 0 && h > 0 ? {w, h} : null;
}

function pendingSourceBoxSize(options={}){
    const sourceNode = options.sourceNode || null;
    if(sourceNode && (sourceNode.images || []).length){
        const rect = S().nodeRect(sourceNode);
        if(rect.width > 24 && rect.height > 24) return {w:Math.round(rect.width), h:Math.round(rect.height), display:true};
    }
    const ref = (options.refs || []).find(img => img?.url);
    const refSize = pendingSizeFromImageRef(ref);
    if(refSize) return refSize;
    const refNode = ref?.nodeId ? nodes().find(n => n.id === ref.nodeId) : null;
    if(refNode){
        const rect = S().nodeRect(refNode);
        if(rect.width > 24 && rect.height > 24) return {w:Math.round(rect.width), h:Math.round(rect.height), display:true};
    }
    return null;
}

function displayBoxFromNaturalSize(size){
    const layout = S().singleImageLayout(
        {natural_w:size?.w || size?.width || 1024, natural_h:size?.h || size?.height || 1024},
        {type:'smart-image', images:[{}]},
        S().MEDIA_NODE_DEFAULT_SCALE
    );
    return {w:layout.width, h:layout.height};
}

function displayBoxFromAspect(aspect){
    const safeAspect = Number(aspect);
    if(!(safeAspect > 0)) return null;
    return displayBoxFromNaturalSize(safeAspect >= 1
        ? {w:Math.round(1024 * safeAspect), h:1024}
        : {w:1024, h:Math.round(1024 / safeAspect)}
    );
}

function pendingBaseBoxSize(options={}){
    const sourceSettings = options.settings || S().settings;
    const requestSize = explicitRequestOutputSizeForPending(sourceSettings);
    if(requestSize) return displayBoxFromNaturalSize(requestSize);
    const requestAspect = pendingAspectFromSettings(sourceSettings);
    if(requestAspect > 0 && String(sourceSettings.ratio || '') !== 'source'){
        return displayBoxFromAspect(requestAspect);
    }
    const sourceSize = pendingSourceBoxSize(options);
    if(sourceSize?.display) return {w:sourceSize.w, h:sourceSize.h};
    if(sourceSize) return displayBoxFromNaturalSize(sourceSize);
    return displayBoxFromNaturalSize(expectedOutputSize(sourceSettings));
}

function pendingBoxSize(count, options={}){
    const base = pendingBaseBoxSize(options);
    const aspect = base.w / Math.max(1, base.h);
    const c = Math.max(1, Number(count) || 1);
    if(c <= 1){
        return {w:Math.round(base.w), h:Math.round(base.h), cellW:Math.round(base.w), cellH:Math.round(base.h), aspect:base.w / Math.max(1, base.h)};
    }
    const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(c))));
    const rows = Math.ceil(c / cols);
    const cellMax = Math.max(96, Math.min(220, Math.max(base.w, base.h) * 0.42));
    let cellW, cellH;
    if(base.w >= base.h){
        cellW = cellMax;
        cellH = Math.max(40 * S().MEDIA_NODE_DEFAULT_SCALE, Math.round(cellMax / aspect));
    } else {
        cellH = cellMax;
        cellW = Math.max(40 * S().MEDIA_NODE_DEFAULT_SCALE, Math.round(cellMax * aspect));
    }
    const GAP = 8;
    const PAD = 16;
    const w = cols * cellW + (cols - 1) * GAP + PAD;
    const h = rows * cellH + (rows - 1) * GAP + PAD;
    return {w, h, cellW, cellH, aspect:cellW / Math.max(1, cellH)};
}

function snapshotRunMeta(prompt, sourceId, displayPrompt='', refs=[]){
    return {
        prompt,
        displayPrompt:displayPrompt || S().promptPlainText() || prompt,
        promptHtml: S().promptInput ? S().promptInput.innerHTML : '',
        promptText: S().promptPlainText(),
        promptRefs:(refs || []).map(ref => ({url:ref.url || '', name:ref.name || '', nodeId:ref.nodeId || '', imageIndex:ref.imageIndex ?? ''})).filter(ref => ref.url),
        inputRefs:(refs || []).map(ref => ({url:ref.url || '', name:ref.name || '', nodeId:ref.nodeId || '', imageIndex:ref.imageIndex ?? '', kind:ref.kind || ''})).filter(ref => ref.url),
        sourceNodeId:sourceId,
        settings:JSON.parse(JSON.stringify(S().settings)),
        createdAt:Date.now()
    };
}

function attachRunMeta(targetNode, meta){
    if(!targetNode || !meta) return;
    targetNode.runPrompt = meta.displayPrompt || meta.promptText || meta.prompt;
    targetNode.runModelPrompt = meta.prompt;
    targetNode.runPromptRefs = meta.promptRefs || [];
    targetNode.runInputRefs = (meta.inputRefs || meta.promptRefs || []).map(ref => ({
        url:ref.url || '',
        name:ref.name || '',
        nodeId:ref.nodeId || '',
        imageIndex:ref.imageIndex ?? '',
        kind:ref.kind || ''
    })).filter(ref => ref.url);
    targetNode.runSettings = meta.settings;
    if(meta.sourceNodeId) targetNode.sourceNodeId = meta.sourceNodeId;
    else delete targetNode.sourceNodeId;
    targetNode.runAt = meta.createdAt;
    // 淇濆瓨鍙紪杈戠殑 @-鎻愬強琛ㄥ崟鍒拌崏绋垮瓧娈碉紝鏂逛究鐐硅緭鍑鸿妭鐐规椂杩樺師鍘熷鍙紪杈戝舰寮?
    if(meta.promptHtml != null){
        const htmlHasToken = String(meta.promptHtml || '').includes('mention-image-token');
        const rebuiltHtml = htmlHasToken ? '' : S().promptHtmlWithMentionTokens(meta.displayPrompt || meta.promptText || '', meta.promptRefs || []);
        targetNode.promptDraftHtml = htmlHasToken ? meta.promptHtml : (rebuiltHtml || meta.promptHtml);
        targetNode.promptDraftText = meta.promptText || '';
    }
    targetNode.images = (targetNode.images || []).map(img => S().stripImageGenerationMeta(img));
}

function stripRunInputMeta(meta){
    if(!meta) return meta;
    const cleanPrompt = meta.promptText || meta.displayPrompt || meta.prompt || '';
    return {
        ...meta,
        promptHtml:S().escapeHtml(cleanPrompt),
        promptText:cleanPrompt,
        promptRefs:[],
        inputRefs:meta.inputRefs || meta.promptRefs || [],
        sourceNodeId:''
    };
}

function nextOutputPositionForSource(sourceNode, pendingBox, options={}){
    const sourceRect = S().nodeRect(sourceNode);
    const gap = 28;
    const width = Math.max(1, Number(pendingBox?.w) || 260);
    const height = Math.max(1, Number(pendingBox?.h) || 180);
    const y = Number(sourceRect.y) || 0;
    let x = (Number(sourceRect.x) || 0) + (Number(sourceRect.width) || 0) + 80;
    const occupied = nodes()
        .filter(node => node && node.id !== sourceNode.id)
        .map(node => S().nodeRect(node));
    let collision = null;
    do {
        collision = occupied.find(rect => {
            const left = Number(rect?.x) || 0;
            const top = Number(rect?.y) || 0;
            const right = left + (Number(rect?.width) || 0);
            const bottom = top + (Number(rect?.height) || 0);
            return x < right + gap
                && x + width + gap > left
                && y < bottom + gap
                && y + height + gap > top;
        });
        if(collision){
            x = (Number(collision.x) || 0) + (Number(collision.width) || 0) + gap;
        }
    } while(collision);
    return {x, y};
}

function createPendingOutputFromSource(sourceNode, expectedCount, meta, options={}){
    const pendingKind = ['image', 'video', 'audio'].includes(options.outputKind) ? options.outputKind : 'image';
    const pendingBox = pendingBoxSize(expectedCount, {sourceNode, refs:options.refs || meta?.promptRefs || []});
    const pos = options.position || nextOutputPositionForSource(sourceNode, pendingBox);
    const output = {
        id:S().uid('smart'),
        type:'smart-image',
        x:pos.x,
        y:pos.y,
        title:({image:'Image', video:'Video', audio:'Audio'})[pendingKind],
        images:[],
        pending:Math.max(1, Number(expectedCount) || 1),
        pendingOutputKind:pendingKind,
        runStartedAt:S().nowMs(),
        runTimerHidden:false,
        w:pendingBox.w,
        h:pendingBox.h,
        scale:S().MEDIA_NODE_DEFAULT_SCALE,
        created_at:Date.now(),
        // Keep the source explicit so cancelling a temporary output can remove
        // it synchronously instead of rendering one frame as an empty uploader.
        _pendingOutputSourceId:sourceNode.id
    };
    output._selectAfterRunId = options.selectOutput ? output.id : sourceNode.id;
    nodes().push(output);
    if(options.connectSource === false) S().addConnection(sourceNode.id, output.id, 'flow');
    else S().connectInputNode(sourceNode.id, output.id);
    attachRunMeta(output, options.stripInputMeta ? stripRunInputMeta(meta) : meta);
    S().selectedId = sourceNode.id;
    S().selectedImage = {nodeId:'', index:-1};
    return output;
}

function createPendingOutputBatchFromSource(sourceNode, expectedCount, meta, options={}){
    const count = Math.max(1, Number(expectedCount) || 1);
    if(count === 1) return [createPendingOutputFromSource(sourceNode, 1, meta, options)];
    const singleBox = pendingBoxSize(1, {sourceNode, refs:options.refs || meta?.promptRefs || []});
    const gap = 28;
    const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(count))));
    const rows = Math.ceil(count / cols);
    const batchBox = {
        w:cols * singleBox.w + (cols - 1) * gap,
        h:rows * singleBox.h + (rows - 1) * gap
    };
    const start = nextOutputPositionForSource(sourceNode, batchBox);
    return Array.from({length:count}, (_, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return createPendingOutputFromSource(sourceNode, 1, meta, {
            ...options,
            position:{
                x:start.x + col * (singleBox.w + gap),
                y:start.y + row * (singleBox.h + gap)
            }
        });
    });
}

function createParallelLoopOutputNode(templateNode, sourceNode, roundIndex, roundOffset=0){
    const rect = S().nodeRect(templateNode);
    const output = S().cloneSmartNode(templateNode, 0, 0);
    output.id = S().uid('smart');
    output.type = 'smart-image';
    output.x = (Number(templateNode.x) || 0) + (Number(rect.width) || 260) + 80;
    output.y = (Number(templateNode.y) || 0) + roundOffset * ((Number(rect.height) || 180) + 28);
    output.title = `Image ${roundIndex}`;
    output.images = [];
    output.pending = 0;
    output.running = false;
    output.created_at = Date.now();
    delete output.w;
    delete output.h;
    delete output.historyFor;
    delete output.isHistoryGroup;
    delete output.sourceNodeId;
    delete output.runAt;
    delete output.runPrompt;
    delete output.runModelPrompt;
    delete output.runPromptRefs;
    delete output.runInputRefs;
    nodes().push(output);
    S().connectInputNode(sourceNode.id, output.id);
    return output;
}

function extractCurrentImagesToSource(node, meta=null){
    const imgs = (node.images || []).slice();
    if(!imgs.length) return null;
    const r = S().nodeRect(node);
    const newX = (node.x || 0) - Math.max(280, r.width + 60);
    const source = {
        id: S().uid('smart'),
        type: 'smart-image',
        x: newX,
        y: node.y || 0,
        title: imgs.length > 1 ? 'Group' : 'Image',
        // 鎶藉嚭鍒颁笂娓告簮鑺傜偣鐨勫浘鐗囧彧淇濈暀"鍘熷绱犳潗"璇箟锛氭竻绌?runPrompt / runSettings /
        // sourceNodeId / runAt / promptDraftHtml / promptDraftText 绛?鐢熸垚"鐩稿叧瀛楁锛?
        // 閬垮厤涓婃父鍥剧墖缁ф壙涓嬫父杈撳嚭鐨勬彁绀鸿瘝淇℃伅
        images: imgs.map(img => S().stripImageGenerationMeta({...img})),
        created_at: Date.now()
    };
    if(Number.isFinite(Number(node.w))) source.w = node.w;
    if(Number.isFinite(Number(node.h))) source.h = node.h;
    if(Number.isFinite(Number(node.scale))) source.scale = node.scale;
    nodes().push(source);
    S().connectInputNode(source.id, node.id);
    node.images = [];
    delete node.w;
    delete node.h;
    return source;
}

function finalizePendingNode(pendingNode, urls, meta, kind='image'){
    if(!pendingNode) return;
    const ext = kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : kind === 'text' ? 'txt' : 'png';
    const imgs = urls.map((item, i) => {
        const url = typeof item === 'string' ? item : item?.url || '';
        const itemKind = (typeof item === 'object' && item.kind) || kind;
        return {url, name:(typeof item === 'object' && item.name) || `output-${i + 1}.${ext}`, kind:itemKind, generatedResult:true};
    }).filter(img => img.url);
    pendingNode.images = imgs;
    pendingNode.pending = 0;
    pendingNode.runFinishedAt = S().nowMs();
    if(!pendingNode.runStartedAt) pendingNode.runStartedAt = meta?.createdAt || pendingNode.runFinishedAt;
    pendingNode.runElapsedMs = Math.max(0, pendingNode.runFinishedAt - Number(pendingNode.runStartedAt || pendingNode.runFinishedAt));
    pendingNode.runTimerHidden = false;
    pendingNode.outputKind = kind;
    if(imgs.length > 1) pendingNode.title = kind === 'video' ? 'Videos' : kind === 'audio' ? 'Audios' : kind === 'text' ? 'Texts' : 'Group';
    else pendingNode.title = kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : kind === 'text' ? 'Text' : kind === 'file' ? 'File' : 'Image';
    pendingNode.scale = S().mediaNodeDefaultScale(pendingNode);
    delete pendingNode.w;
    delete pendingNode.h;
    const metaTarget = pendingNode._runMetaTargetId ? nodes().find(n => n.id === pendingNode._runMetaTargetId) : pendingNode;
    if(metaTarget) attachRunMeta(metaTarget, meta);
    pendingNode.images = (pendingNode.images || []).map(img => S().stripImageGenerationMeta(img));
    if(imgs.length && kind === 'image'){
        try {
            window.parent?.postMessage({
                type: 'dock-canvas-node-output',
                node_id: pendingNode.id,
                images: imgs.map(img => img.url).filter(Boolean),
            }, location.origin);
        } catch(e) {}
    }
    S().selectedId = pendingNode._selectAfterRunId || pendingNode.id;
    delete pendingNode._runMetaTargetId;
    delete pendingNode._selectAfterRunId;
    delete pendingNode._pendingOutputSourceId;
    delete pendingNode.pendingOutputKind;
    if(S().activeComposerSubject?.id && S().selectedId === S().activeComposerSubject.id) S().lastComposerNodeId = `${S().selectedId}:node`;
    S().selectedImage = {nodeId:'', index:-1};
}

function restoreFromExtraction(node, extracted){
    if(!node || !extracted) return;
    node.images = extracted.images.slice();
    if(Number.isFinite(Number(extracted.w))) node.w = extracted.w;
    if(Number.isFinite(Number(extracted.h))) node.h = extracted.h;
    setNodes(nodes().filter(n => n.id !== extracted.id));
    const canvas = S().getCanvas();
    canvas.connections = (canvas.connections || []).filter(c => !(c.from === extracted.id && c.to === node.id));
    if(Array.isArray(node.inputNodeIds)){
        node.inputNodeIds = node.inputNodeIds.filter(id => id !== extracted.id);
    }
}

function restoreSourceVisualState(node, state){
    if(!node || !state) return;
    node.images = (state.images || []).map(img => ({...img}));
    node.title = state.title || (node.images.length > 1 ? 'Group' : 'Image');
    ['w','h','scale','outputKind'].forEach(key => {
        if(state[key] === undefined) delete node[key];
        else node[key] = state[key];
    });
}

    const api = Object.freeze({
        registerDeps,
        pushRightSideNodes,
        cascadeOutputTitle,
        cleanHistoryImages,
        hasHistoryConnection,
        demoteHistoryGroupNode,
        historyGroupForNode,
        positionHistoryGroupForNode,
        ensureHistoryGroupForNode,
        replaceOutputsToNodeWithHistory,
        replaceOutputsToNodeDirect,
        finalizeOverwritePendingNode,
        appendOutputsToNode,
        appendLoopOutputsToNode,
        expectedOutputSize,
        explicitRequestOutputSizeForPending,
        pendingAspectFromSettings,
        pendingSizeFromImageRef,
        pendingSourceBoxSize,
        displayBoxFromNaturalSize,
        displayBoxFromAspect,
        pendingBaseBoxSize,
        pendingBoxSize,
        snapshotRunMeta,
        attachRunMeta,
        stripRunInputMeta,
        nextOutputPositionForSource,
        createPendingOutputFromSource,
        createPendingOutputBatchFromSource,
        createParallelLoopOutputNode,
        extractCurrentImagesToSource,
        finalizePendingNode,
        restoreFromExtraction,
        restoreSourceVisualState,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('nodeOutputs', api);
    }
    global.SmartCanvasNodeOutputs = api;
})(window);
