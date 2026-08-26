/**
 * Smart Canvas — generation engine (API / Comfy / RH / pending tasks / Jimeng poll).
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;
    const activeSmartTaskPolls = new Map();
    const activeJimengPolls = new Set();
    const JIMENG_POLL_INTERVAL = 60000;
    const JIMENG_POLL_MAX = 1440;

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || global.SmartCanvasCore?.tryDeps?.() || null;
    }

    function orderedRunRefs(node, refs){
        const list = Array.isArray(refs) ? refs : [];
        return global.SmartCanvasComposerInputThumbs?.orderedInputThumbItems?.(node, list) || list;
    }

    function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

    function getActiveSmartTaskPolls(){
        return activeSmartTaskPolls;
    }

async function runGeneration(options={}){
    const node = options.node || d().selectedNode();
    if(!node) return;
    if(!options.skipCoCreate && window.SmartCanvasCoCreate?.shouldRun?.(node)) return window.SmartCanvasCoCreate.run(node, options);
    const requestedOverwriteMode = options.overwrite === true;
    const nodeHasImages = (node.images || []).some(img => img?.url);
    const workflowModeRun = d().smartImageUsesWorkflowInput(node, d().smartLoopContext);
    const overwriteMode = requestedOverwriteMode;
    const selectedSelf = global.SmartCanvasReferenceImages?.selectedSelfReferenceForNode?.(node);
    const requestDefaultImages = selectedSelf && !overwriteMode ? [selectedSelf] : null;
    const request = d().buildPromptRequestForNode(node, requestDefaultImages, d().smartLoopContext);
    let prompt = String(options.promptOverride || request.prompt || node?.runPrompt || node?.promptDraftText || '').trim();
    if(!prompt){ d().toast(d().tr('smart.toastNeedPrompt')); return; }
    // The composer preview is the source of truth. A generated node can still
    // carry old runPromptRefs from its parent; never let those hidden refs win
    // over the image(s) currently shown in the bottom preview row.
    const referenceOverride = Array.isArray(options.referenceOverride) ? options.referenceOverride : null;
    const previewRefs = selectedSelf && !overwriteMode ? d().visibleReferenceImagesFor(node) : null;
    const refs = referenceOverride
        ? orderedRunRefs(node, referenceOverride).map((img, index) => ({...img, role:`image_${index + 1}`}))
        : Array.isArray(previewRefs)
        ? orderedRunRefs(node, previewRefs).map((img, index) => ({...img, role:`image_${index + 1}`}))
        : orderedRunRefs(node, request.refs);
    d().persistActiveSmartSettings();
    const previousSettings = d().cloneSmartSettings(d().settings);
    d().settings = {...d().cloneSmartSettings(d().smartSettingsForNode(node) || {}), ...d().cloneSmartSettings(d().settings)};
    if(options.apiKindOverride === 'image' && d().isApiLikeEngine(d().settings.engine)){
        d().settings = {...d().settings, apiKind:'image'};
    }
    if(['2k','4k'].includes(options.resolutionOverride) && d().isApiLikeEngine(d().settings.engine) && d().settings.apiKind !== 'video'){
        d().settings = {...d().settings, resolution:options.resolutionOverride};
    }
    if(['auto','low','medium','high'].includes(options.qualityOverride) && d().isApiLikeEngine(d().settings.engine) && d().settings.apiKind !== 'video'){
        d().settings = {...d().settings, quality:options.qualityOverride};
    }
    if(options.preserveSourceRatio === true && d().isApiLikeEngine(d().settings.engine) && d().settings.apiKind !== 'video'){
        d().settings = {...d().settings, ratio:'source', ratioExplicit:true};
    }
    const customSizeOverride = options.customSizeOverride && Number(options.customSizeOverride.width) > 0 && Number(options.customSizeOverride.height) > 0
        ? {width:Math.round(Number(options.customSizeOverride.width)), height:Math.round(Number(options.customSizeOverride.height))}
        : null;
    if(customSizeOverride && d().isApiLikeEngine(d().settings.engine) && d().settings.apiKind !== 'video'){
        let ratioDivisor=customSizeOverride.width,ratioRemainder=customSizeOverride.height;
        while(ratioRemainder){const next=ratioDivisor%ratioRemainder;ratioDivisor=ratioRemainder;ratioRemainder=next;}
        const customRatio=`${Math.round(customSizeOverride.width/ratioDivisor)}:${Math.round(customSizeOverride.height/ratioDivisor)}`;
        d().settings = {
            ...d().settings,
            resolution:'custom',
            ratio:'custom',
            ratioExplicit:true,
            customRatio,
            customWidth:customSizeOverride.width,
            customHeight:customSizeOverride.height,
            customSize:`${customSizeOverride.width}x${customSizeOverride.height}`
        };
    }
    const outpaintSize = node?.outpaintSize && Number(node.outpaintSize.width) > 0 && Number(node.outpaintSize.height) > 0
        ? {width:Math.round(Number(node.outpaintSize.width)), height:Math.round(Number(node.outpaintSize.height))}
        : null;
    if(
        outpaintSize &&
        d().settings.outpaintResolutionLocked === true &&
        d().isApiLikeEngine(d().settings.engine) &&
        d().settings.apiKind !== 'video'
    ){
        d().settings = {
            ...d().settings,
            resolution:'custom',
            ratio:'',
            customWidth:outpaintSize.width,
            customHeight:outpaintSize.height,
            customSize:`${outpaintSize.width}x${outpaintSize.height}`
        };
    }
    if(options.hdScale && d().isApiLikeEngine(d().settings.engine) && d().settings.apiKind !== 'video'){
        const hdSize = d().scaledImageSizeForSelectedNode(node, options.hdScale);
        d().settings = {
            ...d().settings,
            resolution:'custom',
            ratio:'',
            customWidth:hdSize.width,
            customHeight:hdSize.height,
            customSize:`${hdSize.width}x${hdSize.height}`
        };
    }
    const metaPrompt = options.hiddenPrompt ? '' : prompt;
    const meta = d().snapshotRunMeta(metaPrompt, node.id, options.hiddenPrompt ? '' : request.displayPrompt, refs);
    if(options.hiddenPrompt){
        meta.prompt = '';
        meta.displayPrompt = '';
        meta.promptHtml = '';
        meta.promptText = '';
    }
    const logKind = d().isApiLikeEngine(d().settings.engine) && d().settings.apiKind === 'video' ? 'video' : 'image';
    const runLog = d().smartRunSnapshot(node, options.hiddenPrompt ? '' : prompt, refs, logKind);
    d().rememberRecentSmartSettings(d().settings, node);
    const runLogStart = d().nowMs();
    const expectedCount = d().settings.engine === 'comfy'
        ? (d().settings.comfyMode === 'text' || d().settings.comfyMode === 'enhance' || d().settings.comfyMode === 'edit' || d().settings.comfyMode === 'custom' ? 1 : 1)
        : (d().isApiLikeEngine(d().settings.engine) && d().settings.apiKind === 'video')
        ? d().smartVideoGenerationCount(d().settings)
        : d().effectiveApiRunCount(d().settings);
    const apiConcurrentRun = d().isApiLikeEngine(d().settings.engine);
    const shouldBranchFromImage = nodeHasImages && !workflowModeRun && !overwriteMode;
    const shouldSplitPendingBatch = apiConcurrentRun
        && expectedCount > 1
        && nodeHasImages
        && !workflowModeRun
        && !overwriteMode
        && typeof d().createPendingOutputBatchFromSource === 'function';
    const sourceVisualState = shouldBranchFromImage ? {
        images:(node.images || []).map(img => ({...img})),
        title:node.title,
        w:node.w,
        h:node.h,
        scale:node.scale,
        outputKind:node.outputKind
    } : null;
    if(!options.skipUndo) d().pushUndo();
    let extracted = null;
    let branchNode = null;
    let pendingNodes = [];
    const pendingMeta = nodeHasImages && !workflowModeRun && !overwriteMode ? d().stripRunInputMeta(meta) : meta;
    d().undoSuppressed = true;
    if(shouldSplitPendingBatch){
        pendingNodes = d().createPendingOutputBatchFromSource(node, expectedCount, pendingMeta, {
            connectSource:false,
            selectOutput:true,
            refs,
            outputKind:logKind
        });
        branchNode = pendingNodes[0] || null;
    } else if(shouldBranchFromImage){
        branchNode = d().createPendingOutputFromSource(node, expectedCount, pendingMeta, {connectSource:false, selectOutput:true, refs, outputKind:logKind});
    }
    d().undoSuppressed = false;
    const pendingNode = branchNode || node;
    if(!pendingNodes.length) pendingNodes = [pendingNode];
    pendingNodes.forEach(target => {
        target.pendingOutputKind = logKind;
    });
    if(extracted) pendingNode._runMetaTargetId = extracted.id;
    if(!branchNode){
        pendingNode.pending = Math.max(1, Number(expectedCount) || 1);
        pendingNode.runStartedAt = d().nowMs();
        delete pendingNode.runFinishedAt;
        delete pendingNode.runElapsedMs;
        pendingNode.runTimerHidden = false;
        if(!nodeHasImages) delete pendingNode.typePlaceholder;
        delete pendingNode._cancelledTaskIds;
        delete pendingNode._cancelledPendingSlots;
        delete pendingNode.lastGenerationError;
        const pendingBox = d().pendingBoxSize(pendingNode.pending, {sourceNode:node, refs});
        pendingNode.w = pendingBox.w;
        pendingNode.h = pendingBox.h;
        pendingNode._pendingCellW = pendingBox.cellW;
        pendingNode._pendingCellH = pendingBox.cellH;
        pendingNode._pendingCellAspect = pendingBox.aspect;
        d().attachRunMeta(pendingNode, pendingMeta);
        if(overwriteMode){
            pendingNode._overwriteRun = true;
            pendingNode._overwriteResults = [];
            pendingNode._overwriteMeta = pendingMeta;
        }
    }
    if(apiConcurrentRun){
        pendingNodes.forEach(target => d().coolNodeRunningState(target, 2000));
        d().coolRunButton(2000);
    } else {
        pendingNode.running = true;
        d().runBtn.disabled = true;
    }
    d().render();
    try {
        if(d().settings.engine === 'comfy'){
            await runComfyGeneration(pendingNode, prompt, refs, pendingNode, pendingMeta);
            if(sourceVisualState) d().restoreSourceVisualState(node, sourceVisualState);
            d().addSmartGenerationLog({run:runLog, outputs:(pendingNode.images || []).map(img => img.url).filter(Boolean), runMs:d().nowMs() - runLogStart});
            d().settings = previousSettings;
            return;
        }
        if(d().isApiLikeEngine(d().settings.engine) && d().settings.apiKind === 'video'){
            const outVideos = await runApiVideoGeneration(prompt, refs);
            if(!outVideos.length) throw new Error(d().tr('smart.errNoOutVideos'));
            if(pendingNodes.length > 1){
                pendingNodes.forEach((target, index) => {
                    const output = outVideos[index];
                    if(output) d().finalizePendingNode(target, [output], pendingMeta, 'video');
                    else removeUnusedPendingBranchNode(target, node);
                });
            } else {
                d().finalizePendingNode(pendingNode, outVideos, pendingMeta, 'video');
            }
            if(sourceVisualState) d().restoreSourceVisualState(node, sourceVisualState);
            d().addSmartGenerationLog({run:runLog, outputs:outVideos, runMs:d().nowMs() - runLogStart});
            if(!options.preservePromptInput) d().clearPromptInput({preserveDraft:true});
            d().settings = previousSettings;
            d().scheduleSave();
            return;
        }
        if(d().isApiLikeEngine(d().settings.engine) && d().settings.apiKind === 'audio'){
            const musicRunner = global.SmartCanvasMusic?.runMusicGeneration;
            if(typeof musicRunner !== 'function'){
                throw new Error('音乐生成模块尚未加载,请刷新页面后重试');
            }
            const result = await musicRunner(prompt);
            d().addSmartGenerationLog({run:runLog, outputs:[result?.audio_url].filter(Boolean), runMs:d().nowMs() - runLogStart});
            if(!options.preservePromptInput) d().clearPromptInput({preserveDraft:true});
            d().settings = previousSettings;
            d().scheduleSave();
            return;
        }
        const outImages = d().settings.engine === 'runninghub'
            ? await runRunningHubGeneration(prompt, refs)
            : d().settings.engine === 'modelscope'
            ? await runModelscopeGeneration(prompt, refs)
            : await runApiGeneration(prompt, refs, d().settings, node, options);
        if(d().isApiLikeEngine(d().settings.engine)){
            let completedImages = [];
            const taskIds = Array.isArray(outImages?.taskIds) ? outImages.taskIds : [];
            if(!taskIds.length) throw new Error(d().tr('smart.errRunFailed'));
            if(pendingNodes.length > 1){
                const activePendingNodes = pendingNodes.slice(0, taskIds.length);
                const unusedPendingNodes = pendingNodes.slice(taskIds.length);
                activePendingNodes.forEach((target, index) => {
                    target.pendingTasks = [{taskId:taskIds[index], kind:'image'}];
                    target.pending = 1;
                    target.runStartedAt = d().nowMs();
                    target.runTimerHidden = false;
                    target.running = false;
                });
                unusedPendingNodes.forEach(target => removeUnusedPendingBranchNode(target, node));
                d().render();
                d().scheduleSave();
                await d().saveCanvas();
                const settled = await Promise.allSettled(activePendingNodes.map(target => resumeSmartPendingNode(target)));
                settled.forEach((result, index) => {
                    const target = activePendingNodes[index];
                    if(result.status === 'rejected' && !(target.images || []).length){
                        failGenerationNode(target, result.reason?.message || result.reason || d().tr('smart.errRunFailed'));
                    }
                });
                completedImages = activePendingNodes.flatMap(target => target.images || []);
                if(!completedImages.length){
                    const failed = settled.find(result => result.status === 'rejected');
                    throw failed?.reason || new Error(d().tr('smart.errNoOutImages'));
                }
            } else {
                const cancelledSlots = Array.isArray(pendingNode._cancelledPendingSlots) ? pendingNode._cancelledPendingSlots : [];
                taskIds.forEach((taskId, index) => {
                    if(cancelledSlots.includes(index) && taskId){
                        fetch('/api/generation/cancel', {
                            method:'POST',
                            headers:{'Content-Type':'application/json'},
                            body:JSON.stringify({run_id:taskId})
                        }).catch(() => {});
                    }
                });
                delete pendingNode._cancelledPendingSlots;
                pendingNode.pendingTasks = taskIds
                    .map(taskId => ({taskId, kind:'image'}))
                    .filter((_, index) => !cancelledSlots.includes(index));
                pendingNode.pending = pendingNode.pendingTasks.length;
                pendingNode.runStartedAt = d().nowMs();
                pendingNode.runTimerHidden = false;
                pendingNode.running = false;
                d().render();
                d().scheduleSave();
                await d().saveCanvas();
                await resumeSmartPendingNode(pendingNode);
                if(!(pendingNode.images || []).length){
                    throw new Error(d().tr('smart.errNoOutImages'));
                }
                completedImages = pendingNode.images || [];
            }
            if(outpaintSize) delete node.outpaintSize;
            if(sourceVisualState) d().restoreSourceVisualState(node, sourceVisualState);
            d().addSmartGenerationLog({run:runLog, outputs:completedImages.map(img => img.url).filter(Boolean), runMs:d().nowMs() - runLogStart});
            if(!options.preservePromptInput) d().clearPromptInput({preserveDraft:true});
            d().settings = previousSettings;
            d().scheduleSave();
            return;
        }
        if(!outImages.length) throw new Error(d().tr('smart.errNoOutImages'));
        if(outpaintSize) delete node.outpaintSize;
        if(overwriteMode) d().finalizeOverwritePendingNode(pendingNode, outImages, pendingMeta);
        else d().finalizePendingNode(pendingNode, outImages, pendingMeta);
        if(sourceVisualState) d().restoreSourceVisualState(node, sourceVisualState);
        d().addSmartGenerationLog({run:runLog, outputs:outImages, runMs:d().nowMs() - runLogStart});
        if(!options.preservePromptInput) d().clearPromptInput({preserveDraft:true});
        d().settings = previousSettings;
        d().scheduleSave();
    } catch(e) {
        d().settings = previousSettings;
        if(pendingNodes.length > 1){
            pendingNodes.forEach(target => {
                if(!(target.images || []).length) failGenerationNode(target, e.message || String(e));
            });
        } else {
            failGenerationNode(pendingNode, e.message || String(e));
        }
        if(extracted) d().restoreFromExtraction(node, extracted);
        delete pendingNode._runMetaTargetId;
        d().addSmartGenerationLog({run:runLog, outputs:[], runMs:d().nowMs() - runLogStart, error:e.message || String(e)});
    } finally {
        if(!apiConcurrentRun){
            d().clearNodeRunningState(pendingNode);
            d().runBtn.disabled = false;
        }
        d().render();
    }
}
async function runQuickHdGeneration(resolution='2k', options={}){
    if(!['2k','4k'].includes(resolution)) return;
    const node = d().nodes?.find?.(item => item.id === options.nodeId) || d().selectedNode();
    const selectedImage = d().selectedImage;
    const imageIndex = Number(options.imageIndex ?? selectedImage?.index ?? 0);
    if(!node || !node.images?.[imageIndex]?.url){
        d().toast('请先选择需要高清处理的图片');
        return;
    }
    d().selectedId = node.id;
    d().selectedIds = [];
    d().selectedImage = {nodeId:node.id, index:imageIndex};
    d().syncSelectionUi?.();
    const sourceImage = {
        ...node.images[imageIndex],
        nodeId:node.id,
        imageIndex,
        name:node.images[imageIndex].name || '当前图片',
        selfReference:true
    };
    const resolutionLabel = resolution === '4k' ? '4K' : '2K';
    const prompt = [
        `Upscale and restore the supplied reference image to true ${resolutionLabel} resolution with high-fidelity detail reconstruction.`,
        'Preserve the exact original composition, framing, aspect ratio, subject identity, object positions, colors, lighting, typography, logos, and all visible content.',
        'Recover fine textures and clean edges; reduce blur, noise, pixelation, aliasing, and compression artifacts without plastic over-smoothing.',
        'Do not redesign, crop, add, remove, replace, rotate, or move anything. Do not change any text or brand marks.',
        `Return one clean, sharp ${resolutionLabel} image that is visibly clearer than the reference while remaining compositionally identical.`
    ].join(' ');
    return runGeneration({
        node,
        referenceOverride:[sourceImage],
        resolutionOverride:resolution,
        qualityOverride:'high',
        preserveSourceRatio:true,
        forceStrictSize:true,
        promptOverride:prompt,
        hiddenPrompt:true,
        preservePromptInput:true,
        skipCoCreate:true
    });
}
async function runQuickMultiViewGeneration(options={}){
    const node = d().nodes?.find?.(item => item.id === options.nodeId) || d().selectedNode();
    const imageIndex = Number(options.imageIndex ?? d().selectedImage?.index ?? 0);
    if(!node || !node.images?.[imageIndex]?.url){
        d().toast('请先选择需要生成多视角的图片');
        return;
    }
    d().selectedId = node.id;
    d().selectedImage = {nodeId:node.id, index:imageIndex};
    const sourceImage = {...node.images[imageIndex], nodeId:node.id, imageIndex, name:node.images[imageIndex].name || '当前图片', selfReference:true};
    const prompt = String(options.prompt || global.SmartCanvasMultiView?.promptForAngles?.(
        options.azimuth,
        options.elevation,
        options.label
    ) || '').trim();
    if(!prompt) return;
    return runGeneration({node, referenceOverride:[sourceImage], promptOverride:prompt, hiddenPrompt:true, preservePromptInput:true, skipCoCreate:true});
}
async function runQuickOutpaintGeneration(options={}){
    const node = d().nodes?.find?.(item => item.id === options.nodeId) || d().selectedNode();
    const imageIndex = Number(options.imageIndex ?? d().selectedImage?.index ?? 0);
    if(!node || !node.images?.[imageIndex]?.url){
        d().toast('请先选择需要扩图的图片');
        return;
    }
    const sourceWidth = Math.max(1, Math.round(Number(options.sourceWidth) || Number(node.images[imageIndex].natural_w) || 1));
    const sourceHeight = Math.max(1, Math.round(Number(options.sourceHeight) || Number(node.images[imageIndex].natural_h) || 1));
    const width = Math.max(sourceWidth, Math.round(Number(options.width) || sourceWidth));
    const height = Math.max(sourceHeight, Math.round(Number(options.height) || sourceHeight));
    d().selectedId = node.id;
    d().selectedIds = [];
    d().selectedImage = {nodeId:node.id, index:imageIndex};
    d().syncSelectionUi?.();
    const sourceImage = {...node.images[imageIndex], nodeId:node.id, imageIndex, name:node.images[imageIndex].name || '当前图片', selfReference:true};
    const layoutReference = options.layoutReference?.url
        ? {...options.layoutReference, name:options.layoutReference.name || '扩图布局参考', kind:'image'}
        : null;
    const prompt = String(options.prompt || global.SmartCanvasInlineImageTools?.outpaintPrompt?.({
        sourceWidth,
        sourceHeight,
        width,
        height
    }) || '').trim();
    if(!prompt) return;
    return runGeneration({
        node,
        referenceOverride:layoutReference?[layoutReference,sourceImage]:[sourceImage],
        customSizeOverride:{width,height},
        apiKindOverride:'image',
        qualityOverride:'high',
        forceStrictSize:true,
        promptOverride:prompt,
        hiddenPrompt:true,
        preservePromptInput:true,
        skipCoCreate:true
    });
}
async function runApiGeneration(prompt, refs, runSettings, node=null, options={}){
    if(runSettings == null) runSettings = d().settings;
    if(!runSettings.provider_id || !runSettings.model) throw new Error(d().tr('smart.errNoApiModel'));
    const normalizedRefs = d().normalizeSmartApiRefs(refs, runSettings);
    const count = d().effectiveApiRunCount(runSettings);
    const size = await d().sizeForRunAsync(runSettings, node, normalizedRefs);
    const aspectRatioMap = {
        square:'1:1', portrait:'2:3', landscape:'3:2', portrait43:'3:4', landscape43:'4:3',
        story:'9:16', wide:'16:9', ultrawide:'21:9', ultratall:'9:21'
    };
    const strictSize = options.forceStrictSize === true || (
        runSettings.ratioExplicit === true
        && runSettings.ratio !== 'source'
        && (runSettings.resolution === 'custom' || Boolean(runSettings.ratio))
    );
    const aspectRatio = runSettings.ratio === 'custom'
        ? String(runSettings.customRatio || '')
        : (aspectRatioMap[runSettings.ratio] || '');
    const payload = {
        prompt,
        provider_id:runSettings.provider_id,
        model:runSettings.model,
        size,
        quality:['auto','low','medium','high'].includes(runSettings.quality) ? runSettings.quality : 'low',
        n:1,
        reference_images:d().imageRefsOnly(normalizedRefs),
        aspect_ratio:strictSize ? aspectRatio : '',
        strict_size:strictSize,
    };
    const tasks = await Promise.all(Array.from({length:count}, () => fetch('/api/canvas-image-tasks', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}).then(async r => {
        if(!r.ok) throw new Error(await r.text());
        return r.json();
    })));
    return {taskIds:tasks.map(task => task.task_id).filter(Boolean), count};
}
async function runApiVideoGeneration(prompt, refs, runSettings){
    if(runSettings == null) runSettings = d().settings;
    if(!runSettings.videoModel) throw new Error(d().tr('smart.errNoVideoModel'));
    d().normalizeSmartVideoModeSettings?.(runSettings);
    const capabilities = d().videoModelCapabilities(runSettings.videoModel);
    if(!capabilities?.recognized){
        throw new Error(`未识别视频模型“${runSettings.videoModel}”的能力，请先在 API 设置中改成官网正式模型名`);
    }
    const referenceMode = d().currentVideoReferenceMode(runSettings);
    if(capabilities.modes?.[referenceMode] !== true){
        throw new Error(`视频模型“${runSettings.videoModel}”不支持当前生成模式`);
    }
    d().syncVideoCountFromSettings(runSettings);
    const normalizedRefs = d().normalizeSmartApiRefs(refs, runSettings);
    const allImageRefs = d().imageRefsOnly(normalizedRefs).map((ref, i) => ({
        url: ref.url,
        name: ref.name || `图${i + 1}`,
        role: ref.role || ''
    }));
    const refImages = referenceMode === 'text' ? []
        : referenceMode === 'frames' ? allImageRefs.slice(0, 2).map((ref, index) => ({...ref, role:index === 0 ? 'first_frame' : 'last_frame'}))
        : referenceMode === 'image' ? allImageRefs.slice(0, 1).map(ref => ({...ref, role:'first_frame'}))
        : allImageRefs.map(ref => ({...ref, role:'reference_image'}));
    const allVideoRefs = d().videoRefsOnly(normalizedRefs).map(ref => ref.url).filter(Boolean);
    const refVideos = referenceMode === 'omni' ? allVideoRefs : [];
    const videoOptions = d().videoModelOptions?.(runSettings) || {aspects:[], resolutions:[], audio:'none'};
    const requestedDuration = Math.max(1, Math.min(60, Number(runSettings.videoDuration) || 5));
    const count = d().smartVideoGenerationCount(runSettings);
    const payload = {
        prompt,
        provider_id: runSettings.videoProvider || 'comfly',
        model: runSettings.videoModel || 'veo3-fast',
        duration: capabilities.family === 'seedance-2.0' ? Math.max(4, Math.min(15, requestedDuration)) : requestedDuration,
        aspect_ratio: videoOptions.aspects.length ? (runSettings.videoAspect || videoOptions.aspects[0]) : '',
        resolution: videoOptions.resolutions.length ? (runSettings.videoResolution || videoOptions.resolutions[0]) : '',
        images: refImages,
        videos: refVideos,
        generate_audio: videoOptions.audio === 'always' || (videoOptions.audio === 'toggle' && Boolean(runSettings.videoGenerateAudio)),
        multimodal: referenceMode === 'omni' || referenceMode === 'reference'
    };
    const submitOnce = async () => {
        const response = await fetch('/api/canvas-video', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(payload)
        });
        if(!response.ok) throw new Error(await d().smartResponseErrorMessage(response, d().tr('smart.errRunFailed')));
        return response.json();
    };
    if(d().shouldSerializeSmartVideoRequests(runSettings) || count <= 1){
        const urls = [];
        for(let index = 0; index < count; index++){
            const result = await submitOnce();
            urls.push(...d().resultMediaUrls(result));
        }
        return urls.filter(Boolean);
    }
    const settled = await Promise.all(Array.from({length: count}, () => submitOnce()));
    return settled.flatMap(result => d().resultMediaUrls(result)).filter(Boolean);
}
async function runComfyGeneration(node, prompt, refs, pendingNode, meta){
    const allRefs = refs || [];
    refs = d().imageRefsOnly(allRefs);
    const mode = d().settings.comfyMode || 'text';
    if(mode === 'text') return runComfyText(node, prompt, pendingNode, meta);
    if(mode === 'enhance') return runComfyEnhance(node, refs, pendingNode, meta);
    if(mode === 'edit') return runComfyEdit(node, prompt, refs, pendingNode, meta);
    const workflowName = d().settings.comfyWorkflow || d().comfyWorkflows[0]?.name || '';
    if(!workflowName) throw new Error(d().tr('smart.errNeedWorkflow'));
    const wf = await fetch(`/api/workflows/${encodeURIComponent(workflowName)}`).then(async r => {
        if(!r.ok) throw new Error(await r.text());
        return r.json();
    });
    const fields = wf.config?.fields || [];
    const values = {};
    fields.filter(f => d().comfyFieldKind(f) === 'prompt').forEach((field, index) => {
        values[field.id] = index === 0 ? prompt : (field.default ?? '');
    });
    const assignMediaFields = async (mediaFields, mediaRefs) => {
        for(let i = 0; i < mediaFields.length && i < mediaRefs.length; i++){
            values[mediaFields[i].id] = await comfyNameForRef(mediaRefs[i]);
        }
    };
    await assignMediaFields(fields.filter(f => d().comfyFieldKind(f) === 'image'), refs);
    await assignMediaFields(fields.filter(f => d().comfyFieldKind(f) === 'video'), d().videoRefsOnly(allRefs));
    await assignMediaFields(fields.filter(f => d().comfyFieldKind(f) === 'audio'), d().audioRefsOnly(allRefs));
    fields.filter(f => d().comfyFieldKind(f) === 'setting').forEach(field => {
        if(d().comfyRandomEnabledField(field) && d().smartComfyRandomActive(field.id)){
            values[field.id] = d().smartComfyRandomValue(field);
        } else {
            values[field.id] = d().settings.comfyParams?.[field.id] ?? field.default;
        }
    });
    const result = await fetch(`/api/workflows/${encodeURIComponent(workflowName)}/run`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({config:wf.config || {fields:[]}, fields:values})
    }).then(async r => {
        if(!r.ok) throw new Error(await r.text());
        return r.json();
    });
    const urls = d().resultMediaUrls(result);
    if(!urls.length) throw new Error(d().tr('smart.errComfyNoImages'));
    const kind = d().mediaKindForUrls(urls, result.videos?.length ? 'video' : result.audios?.length ? 'audio' : result.texts?.length ? 'text' : 'image');
    const ext = kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : 'png';
    const out = urls.map((url, i) => ({url, name:`comfy-${i + 1}.${ext}`, kind})).filter(x => x.url);
    if(!out.length) throw new Error(d().tr('smart.errComfyEmpty'));
    const outputUrls = out.map(o => o.url);
    if(pendingNode){
        d().finalizePendingNode(pendingNode, outputUrls, meta, kind);
    } else {
        const created = d().createNode((node.x || 0) + d().nodeRect(node).width + 40, node.y || 0, out);
        d().attachRunMeta(created, meta);
        d().addConnection(node.id, created.id);
    }
    d().clearPromptInput({preserveDraft:true});
    d().scheduleSave();
}
async function runComfyText(node, prompt, pendingNode, meta){
    const data = await fetch('/api/generate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({prompt, width:Number(d().settings.width || 1024), height:Number(d().settings.height || 1024), workflow_json:'Z-Image.json', type:'zimage'})
    }).then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); });
    const out = data.outputs || data.images || [];
    if(!out.length) throw new Error(d().tr('smart.errComfyNoImages'));
    if(pendingNode){
        d().finalizePendingNode(pendingNode, out, meta);
    } else {
        const created = d().createNode((node.x || 0) + d().nodeRect(node).width + 40, node.y || 0, out.map((url, i) => ({url, name:`comfy-${i + 1}.png`})));
        d().attachRunMeta(created, meta);
        d().addConnection(node.id, created.id);
    }
    d().clearPromptInput({preserveDraft:true});
    d().scheduleSave();
}
async function runComfyEnhance(node, refs, pendingNode, meta){
    if(!refs.length) throw new Error(d().tr('smart.errEnhanceNeedRefs'));
    const inputName = await comfyNameForRef(refs[0]);
    const data = await fetch('/api/generate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({workflow_json:'Z-Image-Enhance.json', type:'enhance', params:{"15":{image:inputName},"204":{value:Number(d().settings.enhanceStrength ?? 0.5)}}})
    }).then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); });
    const out = data.outputs || data.images || [];
    if(!out.length) throw new Error(d().tr('smart.errComfyNoImages'));
    if(pendingNode){
        d().finalizePendingNode(pendingNode, out, meta);
    } else {
        const created = d().createNode((node.x || 0) + d().nodeRect(node).width + 40, node.y || 0, out.map((url, i) => ({url, name:`enhance-${i + 1}.png`})));
        d().attachRunMeta(created, meta);
        d().addConnection(node.id, created.id);
    }
    d().scheduleSave();
}
async function runComfyEdit(node, prompt, refs, pendingNode, meta){
    if(!refs.length) throw new Error(d().tr('smart.errEditNeedRefs'));
    const names = [];
    for(const ref of refs.slice(0, 3)) names.push(await comfyNameForRef(ref));
    const data = await fetch('/api/generate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({prompt, workflow_json:'Flux2-Klein.json', type:'klein', params:{"168":{text:prompt},"158":{noise_seed:Math.floor(Math.random()*1000000)},"278":{image:names[0] || ""},"270":{image:names[1] || ""},"292":{image:names[2] || ""},"313":{value:Boolean(names[1])},"314":{value:Boolean(names[2])}}})
    }).then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); });
    const out = data.outputs || data.images || [];
    if(!out.length) throw new Error(d().tr('smart.errComfyNoImages'));
    if(pendingNode){
        d().finalizePendingNode(pendingNode, out, meta);
    } else {
        const created = d().createNode((node.x || 0) + d().nodeRect(node).width + 40, node.y || 0, out.map((url, i) => ({url, name:`edit-${i + 1}.png`})));
        d().attachRunMeta(created, meta);
        d().addConnection(node.id, created.id);
    }
    d().clearPromptInput({preserveDraft:true});
    d().scheduleSave();
}
async function comfyNameForRef(ref){
    if(ref.comfy_name) return ref.comfy_name;
    const response = await fetch(ref.url);
    if(!response.ok) return ref.name || ref.url;
    const blob = await response.blob();
    const form = new FormData();
    form.append('files', blob, ref.name || 'smart-ref.png');
    const data = await fetch('/api/upload', {method:'POST', body:form}).then(async r => {
        if(!r.ok) throw new Error(await r.text());
        return r.json();
    });
    const name = data.files?.[0]?.comfy_name || ref.name || ref.url;
    const node = d().selectedNode();
    const image = node?.images?.find(img => img.url === ref.url);
    if(image) image.comfy_name = name;
    ref.comfy_name = name;
    return name;
}
function smartPendingTasks(node){
    if(!node || !Array.isArray(node.pendingTasks)) return [];
    return node.pendingTasks.filter(task => task && task.taskId);
}
function cancelledPlaceholderKind(node){
    const taskKind = smartPendingTasks(node).find(task => ['image', 'video', 'audio'].includes(task.kind))?.kind;
    const kind = node?.pendingOutputKind || taskKind || node?.outputKind || node?.portLinkKind;
    return ['image', 'video', 'audio'].includes(kind) ? kind : 'image';
}
function convertCancelledNodeToPlaceholder(node, kind){
    node.images = [];
    d().ensureTypedPlaceholder?.(node, kind);
}
function removeUnusedPendingBranchNode(branchNode, sourceNode){
    if(!branchNode) return;
    d().nodes = d().nodes.filter(n => n.id !== branchNode.id);
    d().canvas.connections = (d().canvas.connections || []).filter(c => c.from !== branchNode.id && c.to !== branchNode.id);
    if(d().selectedId === branchNode.id) d().selectedId = sourceNode?.id || '';
}
function removeCancelledCoCreatePanel(node){
    if(!node?.coCreateBatchId) return false;
    if(Number(node.pending) > 0 || smartPendingTasks(node).length) return false;
    if((node.images || []).some(item => item?.url)) return false;
    const nodeId = node.id;
    d().nodes = d().nodes.filter(candidate => candidate.id !== nodeId);
    d().canvas.connections = (d().canvas.connections || []).filter(connection => connection.from !== nodeId && connection.to !== nodeId);
    if(d().selectedId === nodeId) d().selectedId = '';
    if(d().selectedImage?.nodeId === nodeId) d().selectedImage = {nodeId:'', index:-1};
    return true;
}
function failGenerationNode(node, errorMessage){
    if(!node) return;
    const message = String(errorMessage || d().tr('smart.errRunFailed')).trim().slice(0, 220);
    node.pending = 0;
    node.running = false;
    node.runTimerHidden = true;
    delete node.pendingTasks;
    delete node._cancelledPendingSlots;
    delete node._cancelledTaskIds;
    delete node.runStartedAt;
    delete node.runFinishedAt;
    delete node.runElapsedMs;
    node.lastGenerationError = message;
    if(!(node.images || []).some(item => item?.url)){
        convertCancelledNodeToPlaceholder(node, cancelledPlaceholderKind(node));
    }
    d().render();
    d().scheduleSave();
    d().toast(message.slice(0, 160));
}
function cleanupFailedGeneration(pendingNode, branchNode, sourceNode){
    const keepCancelledPlaceholder = Boolean(
        pendingNode?.typePlaceholder === true
        && pendingNode.runTimerHidden === true
        && !pendingNode.pending
        && !pendingNode.running
    );
    pendingNode.pending = 0;
    if(branchNode && !keepCancelledPlaceholder){
        removeUnusedPendingBranchNode(branchNode, sourceNode);
        d().selectedId = sourceNode?.id || d().selectedId;
    } else if(!keepCancelledPlaceholder){
        pendingNode.running = false;
        if(!(pendingNode.images || []).length){
            delete pendingNode.w;
            delete pendingNode.h;
        }
    }
    return keepCancelledPlaceholder;
}
async function cancelSmartPendingSlot(node, slotIndex){
    if(!node || !Number.isFinite(Number(slotIndex))) return;
    const tasks = smartPendingTasks(node);
    const task = tasks[slotIndex];
    if(task?.taskId) return cancelSmartPendingTask(node, task.taskId);
    node._cancelledPendingSlots = Array.isArray(node._cancelledPendingSlots) ? node._cancelledPendingSlots : [];
    if(!node._cancelledPendingSlots.includes(slotIndex)){
        node._cancelledPendingSlots.push(slotIndex);
        node.pending = Math.max(0, Number(node.pending || 0) - 1);
    }
    if(!node.pending && !smartPendingTasks(node).length && !(node.images || []).some(item => item?.url)){
        node.running = false;
        node.runTimerHidden = true;
        delete node.runStartedAt;
        if(!removeCancelledCoCreatePanel(node)) convertCancelledNodeToPlaceholder(node, cancelledPlaceholderKind(node));
    }
    d().render();
    d().scheduleSave();
    d().toast('已取消生成');
}
async function cancelSmartPendingTask(node, taskId){
    if(!node || !taskId) return;
    node._cancelledTaskIds = Array.isArray(node._cancelledTaskIds) ? node._cancelledTaskIds : [];
    if(node._cancelledTaskIds.includes(taskId)) return;
    const tasks = smartPendingTasks(node);
    if(!tasks.some(task => task.taskId === taskId)) return;
    node._cancelledTaskIds.push(taskId);
    activeSmartTaskPolls.delete(taskId);
    node.pendingTasks = tasks.filter(task => task.taskId !== taskId);
    node.pending = Math.max(0, Number(node.pending || 0) - 1);
    const hasImages = (node.images || []).some(item => item?.url);
    const remaining = smartPendingTasks(node);
    if(!node.pending && !remaining.length){
        node.running = false;
        if(!hasImages){
            node.runTimerHidden = true;
            delete node.runStartedAt;
            delete node.runFinishedAt;
            delete node.runElapsedMs;
            if(!removeCancelledCoCreatePanel(node)) convertCancelledNodeToPlaceholder(node, cancelledPlaceholderKind(node));
        } else {
            node.runFinishedAt = d().nowMs();
            if(!node.runStartedAt) node.runStartedAt = node.runFinishedAt;
            node.runElapsedMs = Math.max(0, node.runFinishedAt - Number(node.runStartedAt || node.runFinishedAt));
            node.runTimerHidden = false;
            delete node.pendingTasks;
            delete node._pendingOutputSourceId;
            delete node.pendingOutputKind;
            delete node.w;
            delete node.h;
        }
    }
    d().render();
    d().scheduleSave();
    try {
        await fetch('/api/generation/cancel', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({run_id:taskId})
        });
    } catch(_) {}
    d().toast('已取消生成');
}
async function cancelSmartNodeGeneration(node){
    if(!node) return;
    const taskIds = smartPendingTasks(node).map(task => task.taskId);
    const hasImages = (node.images || []).some(item => item?.url);
    const placeholderKind = cancelledPlaceholderKind(node);
    node.pending = 0;
    node.running = false;
    node.runTimerHidden = true;
    delete node.pendingTasks;
    delete node._cancelledPendingSlots;
    delete node._cancelledTaskIds;
    delete node.runStartedAt;
    delete node.runFinishedAt;
    delete node.runElapsedMs;
    if(!hasImages && !removeCancelledCoCreatePanel(node)) convertCancelledNodeToPlaceholder(node, placeholderKind);
    d().render();
    d().scheduleSave();
    const taskCancels = taskIds.map(run_id => fetch('/api/generation/cancel', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({run_id})
    }));
    await Promise.allSettled(taskCancels);
    d().toast('已取消生成');
}
async function pollSmartCanvasTask(taskId){
    if(!taskId) throw new Error(d().tr('smart.errRunFailed'));
    if(activeSmartTaskPolls.has(taskId)) return activeSmartTaskPolls.get(taskId);
    const promise = (async () => {
        for(let i = 0; i < 900; i++){
            await new Promise(resolve => setTimeout(resolve, 2000));
            const task = await fetch(`/api/canvas-image-tasks/${encodeURIComponent(taskId)}`).then(async r => {
                if(!r.ok) throw new Error(await r.text());
                return r.json();
            });
            if(task.status === 'succeeded') return task.result || {};
            if(task.status === 'failed') throw new Error(task.error || d().tr('smart.errRunFailed'));
            if(task.status === 'cancelled') throw new Error('生成任务已取消');
        }
        throw new Error(d().tr('smart.errRunTimeout'));
    })();
    activeSmartTaskPolls.set(taskId, promise);
    try {
        return await promise;
    } finally {
        activeSmartTaskPolls.delete(taskId);
    }
}
function finalizeSmartPendingTask(node, taskId, images, kind='image'){
    if(!node || !taskId) return;
    node.pendingTasks = smartPendingTasks(node).filter(task => task.taskId !== taskId);
    node.pending = Math.max(0, Number(node.pending || 0) - 1);
    const ext = kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : kind === 'text' ? 'txt' : 'png';
    const additions = (images || []).map((item, i) => {
        const url = typeof item === 'string' ? item : item?.url || '';
        const itemKind = (typeof item === 'object' && item.kind) || kind;
        return d().stripImageGenerationMeta({url, name:(typeof item === 'object' && item.name) || `output-${i + 1}.${ext}`, kind:itemKind, generatedResult:true});
    }).filter(item => item.url);
    if(node._overwriteRun){
        node._overwriteResults = [...(node._overwriteResults || []), ...additions];
        if(!node.pending && smartPendingTasks(node).length === 0){
            d().finalizeOverwritePendingNode(node, node._overwriteResults || [], node._overwriteMeta || null, kind);
            delete node._overwriteMeta;
        }
        return;
    }
    node.images = [...(node.images || []).map(img => d().stripImageGenerationMeta(img)), ...additions];
    if(additions.length) node.outputKind = kind;
    if(!node.pending && smartPendingTasks(node).length === 0){
        delete node.pendingTasks;
        delete node._pendingOutputSourceId;
        delete node.pendingOutputKind;
        delete node._pendingCellW;
        delete node._pendingCellH;
        delete node._pendingCellAspect;
        node.runFinishedAt = d().nowMs();
        if(!node.runStartedAt) node.runStartedAt = node.runFinishedAt;
        node.runElapsedMs = Math.max(0, node.runFinishedAt - Number(node.runStartedAt || node.runFinishedAt));
        node.runTimerHidden = false;
        node.running = false;
        node.title = node.images.length > 1 ? (kind === 'video' ? 'Videos' : kind === 'audio' ? 'Audios' : kind === 'text' ? 'Texts' : 'Group') : (kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : kind === 'text' ? 'Text' : 'Image');
        node.scale = d().mediaNodeDefaultScale(node);
        delete node.w;
        delete node.h;
    }
}
async function resumeSmartPendingNode(node){
    const tasks = smartPendingTasks(node);
    if(!node || !tasks.length) return;
    if(tasks.some(task => task.coCreateGroupIndex != null) && window.SmartCanvasCoCreate?.resumePendingNode){
        return window.SmartCanvasCoCreate.resumePendingNode(node);
    }
    node.pending = Math.max(tasks.length, Number(node.pending || 0) || tasks.length);
    node.running = false;
    d().render();
    const failures = [];
    await Promise.all(tasks.map(async task => {
        try {
            const result = await pollSmartCanvasTask(task.taskId);
            finalizeSmartPendingTask(node, task.taskId, result?.images || [], task.kind || 'image');
            d().render();
            d().scheduleSave();
        } catch(e) {
            node.pendingTasks = smartPendingTasks(node).filter(item => item.taskId !== task.taskId);
            node.pending = Math.max(0, Number(node.pending || 0) - 1);
            failures.push(e);
            const hasImages = (node.images || []).some(item => item?.url);
            const remaining = smartPendingTasks(node);
            if(!node.pending && !remaining.length && !hasImages){
                failGenerationNode(node, e.message || String(e));
            } else {
                d().toast((e.message || d().tr('smart.errRunFailed')).slice(0, 160));
                if(!node.pending && !remaining.length){
                    node.running = false;
                }
                d().render();
                d().scheduleSave();
            }
        }
    }));
    if(failures.length && !(node.images || []).length){
        throw failures[0];
    }
}
function resumeSmartPendingTasks(){
    d().nodes.filter(node => smartPendingTasks(node).length).forEach(node => {
        resumeSmartPendingNode(node).catch(() => {});
    });
}
async function runModelscopeGeneration(prompt, refs, runSettings){
 if(runSettings == null) runSettings = d().settings;
    refs = d().imageRefsOnly(refs);
 const modelKey = runSettings.msgenModel || 'zimage';
 const msModel = d().MS_GEN_MODELS[modelKey] || d().MS_GEN_MODELS.zimage;
 if(msModel.supportsImage && !refs.length) throw new Error(d().tr('smart.errMsNeedRefs'));
 const size = d().apiImageSize(runSettings.msRatio || 'square', runSettings.msResolution || '1k', runSettings.msCustomRatio || '', runSettings.msCustomSize || '');
 const parsed = d().parseSizeValue(size);
 const width = Number(parsed?.width) || 1024;
 const height = Number(parsed?.height) || 1024;
 const imageUrls = [];
 if(msModel.supportsImage || msModel.acceptsImage){
 for(const ref of refs.slice(0, d().SMART_REFERENCE_IMAGE_MAX)){
 if(ref.url) imageUrls.push(await d().urlToBase64(ref.url).catch(() => ref.url));
 }
 }
 const count = Math.max(1, Math.min(8, Number(runSettings.count || 1)));
 const submit = async () => {
 let body;
 if(modelKey === 'zimage') body = {prompt, resolution:`${width}x${height}`};
 else if(modelKey === 'qwen_edit') body = {prompt, image_urls:imageUrls, resolution:`${width}x${height}`};
 else body = {prompt, model:modelKey === 'custom' ? (runSettings.msCustomModel || d().modelscopeImageModels()[0]) : msModel.modelId, image_urls:imageUrls, width, height, size:`${width}x${height}`};
 const data = await fetch(msModel.endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(async r => {
 if(!r.ok) throw new Error(await r.text());
 return r.json();
 });
 return data.url || data.images?.[0] || '';
 };
 const results = await Promise.all(Array.from({length:count}, submit));
 return results.filter(Boolean);
}

async function runQueuedSmartComfyGenerate(payload){
 const task = await d().createSmartComfyTask(payload);
 return d().waitSmartComfyTaskResult(task.task_id);
}

async function runRunningHubGeneration(prompt, refs, runSettings){
 if(runSettings == null) runSettings = d().settings;
    const ref = d().selectedRunningHubRef(runSettings);
 if(!ref) throw new Error(d().tr('smart.rhNeedConfig'));
 const fields = d().rhActiveFields(runSettings);
 if(!fields.length) throw new Error(d().tr('smart.rhNeedFields'));
 const randomValues = {};
 const mode = ref.kind;
 const media = d().rhMediaForRun(prompt, refs);
 const nodeInfoList = await d().rhBuildNodeInfoList(media, runSettings, randomValues);
 const workflowExtras = mode === 'workflow' ? await d().rhBuildWorkflowRequestExtras(media, nodeInfoList, runSettings) : {};
 const endpoint = mode === 'workflow' ? '/api/runninghub/workflow-submit' : '/api/runninghub/submit';
 const body = mode === 'workflow'
 ? {workflowId:ref.id, nodeInfoList, useWallet:runSettings.rhPayment === 'wallet', ...workflowExtras}
 : {webappId:ref.id, nodeInfoList, instanceType:runSettings.rhInstanceType || '', useWallet:runSettings.rhPayment === 'wallet'};
 const submit = await fetch(endpoint, {
 method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify(body)
 }).then(async r => {
 const data = await r.json();
 if(!r.ok || data.success === false) throw new Error(data.detail || data.error || d().tr('smart.rhFailed'));
 return data.data || data;
 });
 const taskId = submit.taskId;
 if(!taskId) throw new Error(d().tr('smart.rhNoTaskId'));
 for(let i = 0; i < 720; i++){
 await sleep(2500);
 const data = await fetch(`/api/runninghub/query?taskId=${encodeURIComponent(taskId)}`).then(async r => {
 const json = await r.json();
 if(!r.ok || json.success === false) throw new Error(json.detail || json.error || d().tr('smart.rhFailed'));
 return json.data || json;
 });
 if(data.status === 'SUCCESS'){
 const urls = d().resultMediaUrls(data.image_items?.length ? data.image_items : (data.urls || []));
 if(!urls.length) throw new Error(d().tr('smart.rhOutputsEmpty'));
 return urls;
 }
 if(data.status === 'FAILED') throw new Error(data.failReason || d().tr('smart.rhFailed'));
 }
 throw new Error(d().tr('smart.rhTimeout'));
}
function startJimengPoll(node){
 if(!node || !node.jimengPending || !node.jimengPending.submitId) return;
 const submitId = node.jimengPending.submitId;
 if(activeJimengPolls.has(submitId)) return;
 activeJimengPolls.add(submitId);
 const nodeId = node.id;
 (async () => {
 try {
 for(let i = 0; i < JIMENG_POLL_MAX; i++){
 await new Promise(resolve => setTimeout(resolve, JIMENG_POLL_INTERVAL));
 const cur = d().nodes.find(n => n.id === nodeId);
 if(!cur || !cur.jimengPending || cur.jimengPending.submitId !== submitId) return;
 if(cur.jimengPending.querying) continue;
 let data;
 try {
 data = await d().fetchJimengQuery(submitId, cur.jimengPending.kind || 'image');
 } catch(err){ continue; }
 const done = applyJimengQueryResult(cur, data);
 if(done) return;
 const after = d().nodes.find(n => n.id === nodeId);
 if(!after || !after.jimengPending || after.jimengPending.submitId !== submitId) return;
 }
 } finally {
 activeJimengPolls.delete(submitId);
 }
 })();
}
async function createSmartComfyTask(payload){
 const res = await fetch('/api/canvas-comfy-tasks', {
 method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify(payload)
 });
 if(!res.ok) throw new Error(await d().smartResponseErrorMessage(res, d().tr('smart.errRunFailed')));
 return res.json();
}

async function waitSmartComfyTaskResult(taskId){
 if(!taskId) throw new Error(d().tr('smart.errRunFailed'));
 while(true){
 const res = await fetch(`/api/canvas-comfy-tasks/${encodeURIComponent(taskId)}`);
 if(!res.ok) throw new Error(await d().smartResponseErrorMessage(res, d().tr('smart.errRunFailed')));
 const data = await res.json();
 const readyResult = data?.result || data?.outputs || data?.images || data?.videos || data?.audios || data?.texts;
 if(readyResult && d().resultMediaUrls(readyResult).length) return data.result || data;
 if(data.status === 'succeeded') return data.result || {};
 if(data.status === 'failed') throw new Error(data.error || d().tr('smart.errRunFailed'));
 await sleep(1600);
 }
}
async function fetchImageTaskQuery(providerId, taskId){
 return fetch('/api/image-task-query', {
 method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({provider_id:providerId || 'comfly', task_id:taskId})
 }).then(async r => {
 if(!r.ok) throw new Error(await r.text());
 return r.json();
 });
}

async function fetchJimengQuery(submitId, kind){
 return fetch('/api/jimeng/query-media', {
 method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({submit_id:submitId, kind:kind || 'image'})
 }).then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); });
}

function handleJimengPendingSignal(node, e){
 if(!(e && e.jimengPending && e.submitId)) return false;
 d().setNodeJimengPending(node, e);
 d().toast((e.message || d().jimengQueueText(e.queueInfo)).slice(0, 160));
 return true;
}

async function queryJimengNow(nodeId){
 const node = d().nodes.find(n => n.id === nodeId);
 if(!node || !node.jimengPending || !node.jimengPending.submitId) return;
 if(node.jimengPending.querying) return;
 const submitId = node.jimengPending.submitId;
 const kind = node.jimengPending.kind || 'image';
 node.jimengPending.querying = true;
 d().render();
 try {
 const data = await fetchJimengQuery(submitId, kind);
 applyJimengQueryResult(node, data);
 } catch(e){
 d().toast((e.message || '查询失败').slice(0, 160));
 } finally {
 if(node.jimengPending) node.jimengPending.querying = false;
 d().render();
 }
}

async function querySmartImageTaskNow(nodeId, localTaskId){
 const node = d().nodes.find(n => n.id === nodeId);
 if(!node) return;
 const task = smartPendingTasks(node).find(item => item.taskId === localTaskId) || d().smartRecoverableImageTask(node);
 if(!task || task.querying) return;
 const recoverTaskId = task.recoverTaskId || d().extractUpstreamTaskId(task.error || '');
 if(!recoverTaskId){
 d().toast('没有任务 ID，无法查询');
 return;
 }
 task.querying = true;
 task.recoverTaskId = recoverTaskId;
 d().render();
 try {
 const data = await fetchImageTaskQuery(d().providerIdForSmartTask(node, task), recoverTaskId);
 if(data.status === 'succeeded'){
 task.failed = false;
 task.querying = false;
 finalizeSmartPendingTask(node, task.taskId, d().resultMediaUrls(data.image_items?.length ? data.image_items : (data.images?.length ? data.images : data)), task.kind || 'image');
 d().render();
 d().scheduleSave();
 return;
 }
 if(data.status === 'failed'){
 task.error = data.error || d().tr('smart.errRunFailed');
 d().toast(task.error.slice(0, 160));
 } else {
 task.error = data.message || '任务仍在生成中，请稍后再查询';
 d().toast(task.error);
 }
 } catch(e){
 task.error = e.message || '查询失败';
 d().toast(task.error.slice(0, 160));
 } finally {
 const latest = smartPendingTasks(node).find(item => item.taskId === localTaskId);
 if(latest) latest.querying = false;
 d().render();
 d().scheduleSave();
 }
}
function jimengImageEditMode(){
 if(d().settings.provider_id !== 'jimeng') return false;
 const node = d().activeComposerNode() || d().selectedNode();
 const refs = node ? d().visibleReferenceImagesFor(node) : [];
 return refs.length > 0;
}
function jimengVideoCommand(){
 const node = d().activeComposerNode() || d().selectedNode();
 const refs = node ? d().visibleReferenceImagesFor(node) : [];
 const imageRefs = d().imageRefsOnly(refs);
 const hasVideoRef = d().videoRefsOnly(refs).length > 0;
 if(hasVideoRef) return 'multimodal2video';
 if(imageRefs.length >= 2) return 'multiframe2video';
 if(imageRefs.length >= 1) return 'image2video';
 return 'text2video';
}
function jimengQueueText(queueInfo){
 const qi = queueInfo || {};
 const idx = qi.queue_idx;
 const len = qi.queue_length;
 if(idx != null && len != null) return `即梦云端排队中（第 ${idx}/${len} 位）`;
 return '即梦云端生成中';
}
function jimengPendingBodyHtml(node, layout){
 const jp = node.jimengPending || {};
 const querying = Boolean(jp.querying);
 const queueText = jimengQueueText(jp.queueInfo);
 return `


 ${d().escapeHtml(queueText)}
 任务未丢失，可继续等待或手动查询
 ${querying ? '查询中…' : '查询结果'}

 `;
}
function setNodeJimengPending(node, signal){
 if(!node || !signal || !signal.submitId) return;
 const prev = node.jimengPending && node.jimengPending.submitId === signal.submitId ? node.jimengPending : null;
 node.jimengPending = {
 submitId:signal.submitId,
 kind:signal.kind || (prev && prev.kind) || 'image',
 queueInfo:signal.queueInfo || (prev && prev.queueInfo) || {},
 message:signal.message || (prev && prev.message) || '',
 startedAt:(prev && prev.startedAt) || d().nowMs(),
 updatedAt:d().nowMs(),
 querying:prev ? prev.querying : false
 };
 node.running = false;
 node.pending = 0;
 delete node.pendingTasks;
 if(!node.runStartedAt) node.runStartedAt = node.jimengPending.startedAt;
 delete node.runFinishedAt;
 delete node.runElapsedMs;
 node.runTimerHidden = false;
 d().render();
 d().scheduleSave();
 startJimengPoll(node);
}
    function finalizeJimengPending(node, urls, kind='image'){
    if(!node) return false;
    const ext = kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : kind === 'text' ? 'txt' : 'png';
    const additions = (urls || []).map((item, i) => {
        const url = typeof item === 'string' ? item : item?.url || '';
        const itemKind = (typeof item === 'object' && item.kind) || kind;
        return d().stripImageGenerationMeta(d().copyMediaSizeFields(item, {url, name:(typeof item === 'object' && item.name) || `output-${i + 1}.${ext}`, kind:itemKind, generatedResult:true}));
    }).filter(item => item.url);
    if(!additions.length) return false;
    delete node.jimengPending;
    d().replaceOutputsToNodeWithHistory(node, additions, kind, null, {skipShift:true});
    node.running = false;
    node.pending = 0;
    node.runFinishedAt = d().nowMs();
    if(!node.runStartedAt) node.runStartedAt = node.runFinishedAt;
    node.runElapsedMs = Math.max(0, node.runFinishedAt - Number(node.runStartedAt || node.runFinishedAt));
    node.runTimerHidden = false;
    d().render();
    d().scheduleSave();
    return true;
}
    function applyJimengQueryResult(node, data){
    if(!node || !data) return false;
    if(data.status === 'succeeded'){
        const kind = data.kind || node.jimengPending?.kind || 'image';
        return finalizeJimengPending(node, data.urls || [], kind);
    }
    if(data.status === 'failed'){
        delete node.jimengPending;
        node.running = false;
        node.pending = 0;
        d().toast((data.error || '即梦任务失败').slice(0, 160));
        d().render();
        d().scheduleSave();
        return true;
    }
    if(node.jimengPending){
        node.jimengPending.queueInfo = data.queue_info || node.jimengPending.queueInfo || {};
        node.jimengPending.message = data.message || node.jimengPending.message || '';
        node.jimengPending.updatedAt = d().nowMs();
    }
    d().render();
    d().scheduleSave();
    return false;
}
    const api = Object.freeze({
        applyJimengQueryResult,
        finalizeJimengPending,
        registerDeps,
        getActiveSmartTaskPolls,
        runGeneration, runQuickHdGeneration, runQuickMultiViewGeneration, runQuickOutpaintGeneration, runApiGeneration, runApiVideoGeneration, runComfyGeneration, runComfyText, runComfyEnhance, runComfyEdit, comfyNameForRef, smartPendingTasks, cancelSmartNodeGeneration, cancelSmartPendingTask, cancelSmartPendingSlot, cleanupFailedGeneration, failGenerationNode, removeUnusedPendingBranchNode, pollSmartCanvasTask, finalizeSmartPendingTask, resumeSmartPendingNode, resumeSmartPendingTasks, runModelscopeGeneration, runQueuedSmartComfyGenerate, runRunningHubGeneration, startJimengPoll,
        createSmartComfyTask, waitSmartComfyTaskResult,
        fetchImageTaskQuery, fetchJimengQuery, handleJimengPendingSignal, queryJimengNow, querySmartImageTaskNow,
        jimengImageEditMode, jimengVideoCommand, jimengQueueText, jimengPendingBodyHtml, setNodeJimengPending,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('generation', api);
    }

    global.SmartCanvasGeneration = api;
})(window);
