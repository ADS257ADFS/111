/**
 * Smart Canvas — create/clone smart nodes on canvas.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasNodeFactory] deps not registered');
        return c;
    }

function createNode(x, y, images=[], options={}){
    if(!options.skipUndo) S().pushUndo();
    const nodeImages = (images || []).map(img => ({...img}));
    const node = {id:S().uid('smart'), type:'smart-image', x, y, title:nodeImages.length > 1 ? 'Group' : nodeImages.length ? 'Image' : 'Image', images:nodeImages, created_at:Date.now()};
    if(!nodeImages.length) S().ensureTypedPlaceholder?.(node, 'image');
    node.scale = nodeImages.length > 1 ? S().MEDIA_GROUP_DEFAULT_SCALE : S().mediaNodeDefaultScale(node);
    S().inheritNodeMetaFromImage(node);
    S().nodes.push(node);
    if(options.select !== false) S().selectedId = node.id;
    S().render();
    S().scheduleSave();
    return node;
}


function createPromptNode(x, y, options={}){
    if(!options.skipUndo) S().pushUndo();
    const providerId = S().resolveChatProviderId();
    const node = {
        id:S().uid('prompt'),
        type:'smart-prompt',
        x,
        y,
        w:S().PROMPT_NODE_DEFAULT_WIDTH,
        h:S().PROMPT_NODE_DEFAULT_HEIGHT,
        title:'Prompt',
        text:'',
        llmEnabled:false,
        llmProvider:providerId,
        llmModel:S().resolveChatModel('', providerId),
        llmInstruction:'',
        created_at:Date.now()
    };
    S().nodes.push(node);
    if(options.select !== false) S().selectedId = node.id;
    S().render();
    S().scheduleSave();
    return node;
}


function createLoopNode(x, y, options={}){
    if(!options.skipUndo) S().pushUndo();
    const node = {id:S().uid('loop'), type:'smart-loop', x, y, w:340, h:168, title:'Loop', count:1, mode:'serial', showPrompt:false, imageInput:false, loopStart:1, imageBatchSize:1, variablePrompt:'', created_at:Date.now()};
    S().nodes.push(node);
    if(options.select !== false) S().selectedId = node.id;
    S().render();
    S().scheduleSave();
    return node;
}


function cloneSmartNode(node, dx=0, dy=0){
    const copy = JSON.parse(JSON.stringify(node));
    copy.id = S().uid(
        node.type === 'smart-prompt'
            ? 'prompt'
            : node.type === 'smart-loop'
            ? 'loop'
            : 'smart'
    );
    copy.x = (Number(node.x) || 0) + dx;
    copy.y = (Number(node.y) || 0) + dy;
    copy.running = false;
    copy.pending = 0;
    delete copy.runStartedAt;
    delete copy.runFinishedAt;
    delete copy.runElapsedMs;
    delete copy.runTimerHidden;
    return copy;
}


function createImageNodeAt(point, images=[], options={}){
    const layout = S().imageLayout(images || [], S().mediaNodeDefaultScale({type:'smart-image', images:images || []}), {type:'smart-image', images:images || []});
    return createNode((point?.x || 0) - Math.round(layout.width / 2), (point?.y || 0) - Math.round(layout.height / 2), images, options);
}


function duplicateSmartNodeMediaToCanvas(node, imageIndex){ 
 const source = node?.images?.[imageIndex]; 
 const item = S().imageForDisplay(source); 
 if(!node || !item?.url){ S().toast('没有可导出到画布的素材'); return; } 
 S().pushUndo(); 
 const rect = S().nodeRect(node); 
 const point = {x:rect.x + rect.width + 220, y:rect.y + rect.height / 2}; 
 const copy = {...item}; 
 const newNode = createImageNodeAt(point, [copy], {select:true, skipUndo:true}); 
 S().selectedIds = []; 
 S().selectedImage = {nodeId:newNode.id, index:0}; 
 S().render(); 
 S().scheduleSave(); 
 S().toast('已添加到画布'); 
}

    const api = Object.freeze({
        registerDeps,
        createNode,
        createPromptNode,
        createLoopNode,
        cloneSmartNode,
        createImageNodeAt,
        duplicateSmartNodeMediaToCanvas,
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('nodeFactory', api);
    global.SmartCanvasNodeFactory = api;
})(window);
