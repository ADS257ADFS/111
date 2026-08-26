/**
 * Smart Canvas — studio shell agent observation and canvas actions.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasAgentActions] deps not registered');
        return c;
    }
    function nodes(){ return S().getNodes(); }

function canvasAgentObservation(){
    const canvas = S().canvas;
    const nodeList = nodes();
    return {
        canvas:{id:canvas?.id || '', title:canvas?.title || '', node_count:nodeList.length, connection_count:(canvas?.connections || []).length},
        selected_node_id:S().selectedId || '',
        nodes:nodeList.slice(0, 120).map(node => ({
            id:node.id,
            type:node.type,
            title:node.title || '',
            prompt:node.promptDraftText || node.text || '',
            image_count:(node.images || []).length,
            running:Boolean(node.running || node.pending),
            x:Math.round(Number(node.x) || 0),
            y:Math.round(Number(node.y) || 0)
        })),
        connections:(canvas?.connections || []).slice(0, 240).map(conn => ({from:conn.from, to:conn.to, kind:conn.kind || 'flow'}))
    };
}

function externalImageItems(payload){
    const raw = Array.isArray(payload?.images) ? payload.images : [];
    return raw.map((item, index) => {
        const image = typeof item === 'string' ? {url:item} : {...(item || {})};
        const url = String(image.url || image.image_url || '').trim();
        if(!url) return null;
        return {
            ...image,
            url,
            name:image.name || `chat-image-${index + 1}.png`,
            kind:'image',
            generatedResult:true,
        };
    }).filter(Boolean);
}

function externalImagePendingBox(size){
    const match = String(size || '').match(/(\d+)\s*x\s*(\d+)/i);
    const natural = match ? {w:Number(match[1]), h:Number(match[2])} : {w:1024, h:1024};
    return S().displayBoxFromNaturalSize(natural);
}

function syncExternalImageTask(payload={}){
    const taskId = String(payload.task_id || '').trim();
    if(!taskId) return {ok:false};
    const phase = String(payload.phase || '').trim();
    let node = nodes().find(item => item.externalImageTaskId === taskId);
    if(phase === 'start'){
        if(node) return {ok:true, node_ids:[node.id]};
        const center = S().viewportCenter();
        const box = externalImagePendingBox(payload.size);
        const nodeList = nodes();
        let rightEdge = -Infinity;
        nodeList.forEach(item => {
            const rect = S().nodeRect(item);
            const edge = Number(rect?.x) + Number(rect?.width);
            if(Number.isFinite(edge)) rightEdge = Math.max(rightEdge, edge);
        });
        S().pushUndo();
        node = {
            id:S().uid('smart'),
            type:'smart-image',
            x:Math.round(Number.isFinite(rightEdge) ? rightEdge + Math.max(96, box.w * 0.25) : center.x - box.w / 2),
            y:Math.round(center.y - box.h / 2),
            title:'Image',
            images:[],
            pending:1,
            w:box.w,
            h:box.h,
            scale:S().MEDIA_NODE_DEFAULT_SCALE,
            created_at:Date.now(),
            runStartedAt:S().nowMs(),
            runTimerHidden:false,
            externalImageTaskId:taskId,
        };
        nodeList.push(node);
        S().render();
        const rect = S().nodeRect(node);
        const focusScale = Math.max(
            S().viewport.scale,
            Math.min(0.82,
                (S().shell.clientWidth - 120) / Math.max(1, rect.width),
                (S().shell.clientHeight - 160) / Math.max(1, rect.height)
            )
        );
        S().animateViewportTo({
            x:S().shell.clientWidth / 2 - (rect.x + rect.width / 2) * focusScale,
            y:S().shell.clientHeight / 2 - (rect.y + rect.height / 2) * focusScale,
            scale:focusScale,
        }, {duration:280});
        S().refreshRunTimerPills();
        S().scheduleSave();
        return {ok:true, node_ids:[node.id]};
    }
    if(!node) return {ok:false};
    if(phase === 'error'){
        S().nodes = nodes().filter(item => item.id !== node.id);
        S().render();
        S().scheduleSave();
        return {ok:true, node_ids:[]};
    }
    if(phase !== 'done') return {ok:false};
    const images = externalImageItems(payload);
    if(!images.length) return syncExternalImageTask({...payload, phase:'error'});
    node.images = [images[0]];
    node.pending = 0;
    node.running = false;
    node.runFinishedAt = S().nowMs();
    node.runElapsedMs = Math.max(0, node.runFinishedAt - Number(node.runStartedAt || node.runFinishedAt));
    node.runTimerHidden = true;
    delete node.externalImageTaskId;
    delete node.w;
    delete node.h;
    const nodeIds = [node.id];
    const spread = Math.max(280, S().nodeRect(node).width + 24);
    images.slice(1).forEach((image, index) => {
        const next = {
            id:S().uid('smart'),
            type:'smart-image',
            x:node.x + spread * (index + 1),
            y:node.y,
            title:'Image',
            images:[image],
            scale:S().MEDIA_NODE_DEFAULT_SCALE,
            created_at:Date.now(),
        };
        nodes().push(next);
        nodeIds.push(next.id);
    });
    S().render();
    S().scheduleSave();
    return {ok:true, node_ids:nodeIds};
}

async function executeCanvasAgentActions(actions=[]){
    const center = S().viewportCenter();
    let offset = 0;
    const results = [];
    const fastStage = actions.length === 1 && actions[0]?.type === 'batch_generate_images' && actions[0]?.stage_only;
    if(!fastStage) S().pushUndo();
    S().undoSuppressed = true;
    for(const action of actions.slice(0, 8)){
        const point = {x:center.x + offset, y:center.y + offset};
        try {
            let result = {};
            if(action.type === 'new_canvas'){
                S().undoSuppressed = false;
                await S().createNewSmartCanvas();
                S().undoSuppressed = true;
                if(action.title && S().canvas){
                    S().canvas.title = String(action.title).slice(0, 80);
                    S().scheduleSave();
                }
            } else if(action.type === 'create_prompt_node'){
                const node = S().createPromptNode(point.x - 250, point.y - 154);
                node.text = String(action.prompt || '');
                result.node_id = node.id;
                S().render();
            } else if(action.type === 'create_loop_node'){
                const node = S().createLoopNode(point.x - 170, point.y - 84);
                node.count = Math.max(1, Math.min(100, Number(action.count) || 1));
                result.node_id = node.id;
                S().render();
            } else if(action.type === 'create_upload_node'){
                result.node_id = S().createImageNodeAt(point)?.id || '';
            } else if(action.type === 'connect_nodes'){
                if(!nodes().some(node => node.id === action.from_id) || !nodes().some(node => node.id === action.to_id)) throw new Error('连接节点不存在');
                S().addConnection(action.from_id, action.to_id, 'flow');
            } else if(action.type === 'delete_node'){
                if(!nodes().some(node => node.id === action.node_id)) throw new Error('节点不存在');
                S().deleteNode(action.node_id);
            } else if(action.type === 'clear_canvas'){
                S().nodes = [];
                if(S().canvas) S().canvas.connections = [];
                S().selectedId = '';
                S().render();
            } else if(action.type === 'update_node'){
                const node = nodes().find(item => item.id === action.node_id);
                if(!node) throw new Error('节点不存在');
                if(action.field === 'title') node.title = String(action.value || '').slice(0, 120);
                else if(action.field === 'prompt') S().setPromptDraftForNode(node, String(action.value || ''));
                else throw new Error('不支持修改该字段');
                S().render();
            } else if(action.type === 'generate_image' && String(action.prompt || '').trim()){
                const node = S().createImageNodeAt(point);
                S().selectedId = node.id;
                S().setPromptDraftForNode(node, String(action.prompt).trim());
                S().render();
                S().updateComposer();
                S().undoSuppressed = false;
                await S().runGeneration();
                S().undoSuppressed = true;
                result.node_id = node.id;
            } else if(action.type === 'batch_generate_images'){
                const runStagedIds = Array.isArray(action.run_staged_node_ids)
                    ? action.run_staged_node_ids.filter(Boolean)
                    : null;
                const aspectKey = String(action.aspect_ratio || '').trim();
                const aspectRunSettings = (() => {
                    const map = {
                        square: { ratio: 'square' },
                        portrait: { ratio: 'portrait' },
                        landscape: { ratio: 'landscape' },
                        portrait43: { ratio: 'portrait43' },
                        landscape43: { ratio: 'landscape43' },
                        story: { ratio: 'story' },
                        wide: { ratio: 'wide' },
                        '1:1': { ratio: 'square' },
                        '3:4': { ratio: 'portrait43' },
                        '4:3': { ratio: 'landscape43' },
                        '16:9': { ratio: 'wide' },
                        '9:16': { ratio: 'story' },
                    };
                    return map[aspectKey] || {};
                })();
                const pendingBoxForAspect = () => {
                    const presetKey = aspectRunSettings.ratio || 'square';
                    const preset = S().PANORAMA_RATIO_PRESETS[presetKey] || S().PANORAMA_RATIO_PRESETS.square;
                    return S().displayBoxFromNaturalSize({ w: preset.w * 640, h: preset.h * 640 });
                };
                if(runStagedIds?.length){
                    for(const nodeId of runStagedIds){
                        const node = nodes().find(item => item.id === nodeId);
                        if(!node) continue;
                        S().undoSuppressed = false;
                        await S().runGeneration({
                            node,
                            promptOverride: String(node.runPrompt || node.promptDraftText || '').trim(),
                        });
                        S().undoSuppressed = true;
                    }
                    result.node_ids = runStagedIds;
                } else {
                    const count = Math.max(1, Math.min(12, Number(action.count) || 1));
                    const prompts = Array.isArray(action.prompts) ? action.prompts : [];
                    const basePrompt = String(action.prompt || '').trim();
                    const refUrls = (Array.isArray(action.reference_urls) ? action.reference_urls : []).filter(Boolean);
                    const refImages = refUrls.map((url, i) => ({ url, name: `ref-${i + 1}` }));
                    const batchProvider = String(action.provider_id || '').trim();
                    const batchModel = String(action.model || '').trim();
                    const created = [];
                    const spread = Math.max(280, 220);
                    const startX = center.x - ((count - 1) * spread) / 2;
                    const buildRunSettings = () => ({
                        engine: 'api',
                        apiKind: 'image',
                        resolution: '1k',
                        ...(batchProvider ? { provider_id: batchProvider } : {}),
                        ...(batchModel ? { model: batchModel } : {}),
                        ...aspectRunSettings,
                    });
                    for(let i = 0; i < count; i += 1){
                        const px = startX + i * spread;
                        const py = center.y;
                        const prompt = String(prompts[i] || basePrompt || `Variation ${i + 1}`).trim();
                        const pendingBox = pendingBoxForAspect();
                        if(action.stage_only){
                            let node;
                            if(refImages.length){
                                node = S().createImageNodeAt({ x: px, y: py }, refImages.slice(0, 4), { select: false, skipUndo: true });
                            } else {
                                node = {
                                    id: S().uid('smart'),
                                    type: 'smart-image',
                                    x: Math.round(px - pendingBox.w / 2),
                                    y: Math.round(py - pendingBox.h / 2),
                                    title: 'Image',
                                    images: [],
                                    scale: S().MEDIA_NODE_DEFAULT_SCALE,
                                    created_at: Date.now(),
                                };
                                nodes().push(node);
                            }
                            node.pending = 1;
                            node.runStartedAt = S().nowMs();
                            node.runTimerHidden = false;
                            node.running = false;
                            node.w = pendingBox.w;
                            node.h = pendingBox.h;
                            node.runPrompt = prompt;
                            node.promptDraftText = prompt;
                            node.runSettings = buildRunSettings();
                            delete node.promptDraftHtml;
                            delete node.promptDraftTouched;
                            created.push(node.id);
                        } else {
                            const node = refImages.length
                                ? S().createImageNodeAt({ x: px, y: py }, refImages.slice(0, 4), { select: false, skipUndo: true })
                                : S().createImageNodeAt({ x: px, y: py }, [], { select: false, skipUndo: true });
                            S().setPromptDraftForNode(node, prompt);
                            node.runSettings = buildRunSettings();
                            created.push(node.id);
                        }
                    }
                    S().render();
                    S().refreshRunTimerPills();
                    if(action.stage_only){
                        S().selectedId = '';
                        S().selectedImage = { nodeId: '', index: -1 };
                        S().updateComposer();
                        const focusNode = nodes().find(item => item.id === created[0]);
                        if(focusNode){
                            const rect = S().nodeRect(focusNode);
                            S().centerViewportOnWorldPoint({
                                x: (rect.x || 0) + (rect.width || 0) / 2,
                                y: (rect.y || 0) + (rect.height || 0) / 2,
                            });
                        }
                    } else {
                        for(const nodeId of created){
                            const node = nodes().find(item => item.id === nodeId);
                            if(!node) continue;
                            S().selectedId = nodeId;
                            S().updateComposer();
                            S().undoSuppressed = false;
                            await S().runGeneration();
                            S().undoSuppressed = true;
                        }
                    }
                    result.node_ids = created;
                }
            }
            results.push({type:action.type, ok:true, ...result});
        } catch(error) {
            results.push({type:action.type, ok:false, error:String(error?.message || error).slice(0, 240)});
        }
        offset += 42;
    }
    S().undoSuppressed = false;
    S().scheduleSave();
    return results;
}

    const api = Object.freeze({ registerDeps, canvasAgentObservation, executeCanvasAgentActions, syncExternalImageTask });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('agentActions', api);
    global.SmartCanvasAgentActions = api;
})(window);
