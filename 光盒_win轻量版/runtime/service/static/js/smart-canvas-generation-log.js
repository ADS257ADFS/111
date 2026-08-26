/**
 * Smart Canvas — generation run log panel and run snapshot helpers.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasGenerationLog] deps not registered');
        return c;
    }


const SMART_LOG_PREVIEW_NODE_ID = '__smart_log_preview__';
let smartLogPreviewRestore = null;

function smartRunTaskLabel(run){
    const s = run?.settings || {};
    if(run?.kind === 'video') return s.videoModel || 'Video';
    if(s.engine === 'comfy'){
        if(s.comfyMode === 'custom') return s.comfyWorkflow || 'ComfyUI';
        const labels = {text:S().tr('canvas.comfyModeText') || 'Text to Image', enhance:S().tr('canvas.comfyModeEnhance') || 'Enhance', edit:S().tr('canvas.comfyModeEdit') || 'Edit'};
        return labels[s.comfyMode || 'text'] || 'ComfyUI';
    }
return s.model || 'API Image';
}
function smartRunPlatformLabel(run){
    const s = run?.settings || {};
    if(s.engine === 'comfy') return 'ComfyUI';
    if(run?.kind === 'video') return S().videoProviderById(s.videoProvider || '')?.name || s.videoProvider || 'Video';
    return S().apiProviderById(s.provider_id || '')?.name || s.provider_id || 'API';
}
function smartRunRequestMeta(run){
    const s = run?.settings || {};
    if(s.engine === 'comfy') return {workflow_json:s.comfyWorkflow || '', mode:s.comfyMode || 'text'};
    if(run?.kind === 'video') return {provider_id:s.videoProvider || '', model:s.videoModel || '', duration:s.videoDuration || '', aspect_ratio:s.videoAspect || '', resolution:s.videoResolution || ''};
    return {provider_id:s.provider_id || '', model:s.model || '', size:run?.size || '', quality:s.quality || '', n:s.count || 1};
}
function smartRunSnapshot(node, prompt, refs=[], kind='image'){
    const settingsSnapshot = S().cloneSmartSettings(S().settings);
    return {
        nodeId:node?.id || '',
        nodeType:node?.type || 'smart-image',
        kind,
        settings:settingsSnapshot,
        prompt:prompt || '',
        refs:(refs || []).map(ref => ({url:ref.url || '', name:ref.name || 'image', kind:ref.kind || ''})).filter(ref => ref.url),
        size: kind === 'image' && S().isApiLikeEngine(settingsSnapshot.engine) ? S().sizeForRun(settingsSnapshot) : ''
    };
}
function addSmartGenerationLog({run, outputs=[], runMs=0, error=''}) {
    if(!S().canvas) return;
    canvas.logs = canvas.logs || [];
    const entry = {
        id:S().uid('log'),
        createdAt:Date.now(),
        status:error ? 'failed' : 'success',
        platform:smartRunPlatformLabel(run),
        nodeType:run?.nodeType || 'smart-image',
        model:smartRunTaskLabel(run),
        request:smartRunRequestMeta(run),
        prompt:run?.prompt || '',
        outputs:(outputs || []).filter(Boolean),
        refs:run?.refs || [],
        runMs:Number(runMs || 0),
        error:error ? String(error) : ''
    };
    canvas.logs = [entry, ...canvas.logs].slice(0, 500);
    S().scheduleSave();
}
function smartLogPreviewNode(url, kind='image'){
    if(kind === 'video' || S().outputUrlLooksVideo(url)){
        window.open(url, '_blank');
        return;
    }
    const node = {id:'__smart_log_preview__', type:'smart-image', images:[{url, name:'log-preview', kind}], title:kind === 'video' ? 'Video' : 'Image'};
    const prevSelectedId = S().selectedId;
    const prevSelectedImage = {...S().selectedImage};
    S().nodes.push(node);
    try { S().openImageEditor(node.id, 0); }
    finally {
        S().nodes = S().nodes.filter(n => n.id !== node.id);
        S().selectedId = prevSelectedId;
        S().selectedImage = prevSelectedImage;
    }
}
function renderSmartCanvasLog(){
    const logs = S().canvas?.logs || [];
    S().smartLogList.innerHTML = logs.length ? logs.map(log => {
        const thumbs = (log.outputs || []).slice(0, 8).map(url => {
            const safe = S().escapeAttr(url);
            const kind = S().outputUrlLooksVideo(url) ? 'video' : 'image';
            return kind === 'video' ? `<video src="${safe}" data-url="${safe}" data-kind="video" muted playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video>` : `<img src="${safe}" data-url="${safe}" data-kind="image" alt="output">`;
        }).join('');
        const date = new Date(log.createdAt || Date.now()).toLocaleString(window.StudioI18n?.lang() === 'en' ? 'en-US' : 'zh-CN');
        const req = log.request || {};
        const taskId = req.task_id || req.taskId || req.prompt_id || req.promptId || '';
        const backend = req.workflow_json || req.workflow || req.provider_id || req.providerId || req.backend || '';
        const subParts = [
            date,
            `${window.StudioI18n?.lang() === 'en' ? 'outputs' : '输出'} ${(log.outputs || []).length}`,
            taskId ? `ID ${taskId}` : '',
            backend
        ].filter(Boolean);
        return `<div class="log-item ${log.status === 'failed' ? 'failed' : ''}">
            <div class="log-main">
                <div class="log-meta">
                    <span class="log-chip ${log.status === 'failed' ? 'status-failed' : 'status-ok'}">${S().escapeHtml(log.status === 'failed' ? S().tr('canvas.failed') : S().tr('canvas.success'))}</span>
                    <span class="log-chip">${S().escapeHtml(log.platform || '-')}</span>
                    ${log.model ? `<span class="log-chip">${S().escapeHtml(log.model)}</span>` : ''}
                    <span class="log-chip">${S().escapeHtml(S().formatRunDuration(log.runMs || 0))}</span>
                </div>
                <div class="log-subline">${subParts.map(part => `<span title="${S().escapeAttr(part)}">${S().escapeHtml(part)}</span>`).join('')}</div>
                ${log.error ? `<div class="log-error" title="${S().escapeAttr(log.error)}">${S().escapeHtml(log.error)}</div>` : ''}
                <div class="log-prompt" title="${S().escapeAttr(log.prompt || S().tr('canvas.noPromptMeta'))}" data-prompt="${S().escapeAttr(log.prompt || '')}">${S().escapeHtml(log.prompt || S().tr('canvas.noPromptMeta'))}</div>
            </div>
            <div class="log-thumbs">${thumbs}</div>
        </div>`;
    }).join('') : `<div class="log-empty">${S().escapeHtml(S().tr('canvas.noLogs'))}</div>`;
    S().smartLogList.querySelectorAll('[data-url]').forEach(el => {
        el.onclick = e => {
            e.stopPropagation();
            smartLogPreviewNode(el.dataset.url, el.dataset.kind || 'image');
        };
    });
    S().smartLogList.querySelectorAll('[data-prompt]').forEach(el => {
        el.onclick = e => {
            e.stopPropagation();
            const text = el.dataset.prompt || '';
            if(text) navigator.clipboard?.writeText(text).catch(() => {});
            const oldText = el.textContent;
            el.textContent = S().tr('canvas.copied');
            el.classList.add('copied');
            setTimeout(() => {
                el.textContent = oldText;
                el.classList.remove('copied');
            }, 900);
        };
    });
    S().refreshIcons();
}
function openSmartCanvasLog(){
    if(!S().canvas) return;
    renderSmartCanvasLog();
    S().smartLogModal.classList.add('open');
}
function closeSmartCanvasLog(){
    S().smartLogModal.classList.remove('open');
}

function successfulRecentComfyLogOutputs(sourceNodeId='', withinMs=30 * 60 * 1000){
 const cutoff = Date.now() - withinMs;
 const logs = (S().canvas?.logs || [])
 .filter(log => log && log.status === 'success' && Number(log.createdAt || 0) >= cutoff)
 .filter(log => log.request?.workflow_json || String(log.platform || '').toLowerCase().includes('comfy'))
 .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
 const scoped = sourceNodeId ? logs.filter(log => log.nodeId === sourceNodeId) : logs;
 const usable = scoped.length ? scoped : logs.filter(log => !log.nodeId);
 return usable.flatMap(log => (log.outputs || []).map(url => ({url, createdAt:log.createdAt, nodeId:log.nodeId}))).filter(item => item.url);
}

    function cleanupSmartLogPreviewNode(){
    if(S().nodes.some(n => n.id === SMART_LOG_PREVIEW_NODE_ID)) S().nodes = S().nodes.filter(n => n.id !== SMART_LOG_PREVIEW_NODE_ID);
    if(smartLogPreviewRestore){
        S().selectedId = smartLogPreviewRestore.S().selectedId;
        S().selectedImage = smartLogPreviewRestore.S().selectedImage;
        smartLogPreviewRestore = null;
    }
}
    function closeSmartLogLightbox(){
 const box = document.getElementById('smartLogLightbox');
 if(!box) return;
 box.classList.remove('open');
 const img = box.querySelector('img');
 if(img){ img.onerror = null; img.removeAttribute('src'); }
}
    function smartLogOutputItem(output){
 if(typeof output === 'string') return {url:output};
 if(!output || typeof output !== 'object') return null;
 const url = output.url || output.path || output.src || output.uri || '';
 if(!url) return null;
 return S().copyMediaSizeFields(output, {
 url,
 kind:output.kind || output.type || output.mediaKind || '',
 name:output.name || output.filename || ''
 });
}
    function smartLogSizeSummary(log, outputs=[]){
 const req = log?.request || {};
 const requestLabel = S().normalizedSizeLabel(req.size || req.resolution || '');
 const actualLabels = [...new Set(outputs.map(S().imageResolutionLabel).filter(Boolean))];
 if(!actualLabels.length) return '';
 const actualText = actualLabels.slice(0, 3).join(', ');
 const more = actualLabels.length > 3 ? ` +${actualLabels.length - 3}` : '';
 const actualLabel = `${actualText}${more}`;
 if(requestLabel && actualLabels.some(label => label !== requestLabel)){
 return `请求 ${requestLabel} / 实际 ${actualLabel}`;
 }
 return `实际 ${actualLabel}`;
}
    const api = Object.freeze({
        smartLogSizeSummary,
        smartLogOutputItem,
        closeSmartLogLightbox,
        cleanupSmartLogPreviewNode,
        registerDeps,
        smartRunTaskLabel,
        smartRunPlatformLabel,
        smartRunRequestMeta,
        smartRunSnapshot,
        addSmartGenerationLog,
        smartLogPreviewNode,
        renderSmartCanvasLog,
        openSmartCanvasLog,
        closeSmartCanvasLog,
        successfulRecentComfyLogOutputs,
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('generationLog', api);
    global.SmartCanvasGenerationLog = api;
})(window);
