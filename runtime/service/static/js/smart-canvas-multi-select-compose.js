/**
 * Multi-selection composer adapter.
 * Keeps selection state ephemeral and creates a real connected target only on run.
 */
(function(global){
    'use strict';

    let session = null;
    let connectPort = null;
    let portDrag = null;

    function d(){ return global.SmartCanvasCore?.tryDeps?.() ?? null; }

    function selectionIds(){
        const deps = d();
        if(!deps) return [];
        return deps.selectedIds?.length ? deps.selectedIds.slice() : (deps.selectedId ? [deps.selectedId] : []);
    }

    function selectedNodes(ids=selectionIds()){
        const deps = d();
        return ids.map(id => deps?.nodes?.find(node => node.id === id)).filter(Boolean);
    }

    function groupRefs(node){
        return (global.SmartCanvasSmartGroup?.smartGroupImageRefs?.(node) || []).map(ref => ({
            ...(ref.item || ref.source || {}),
            nodeId:ref.nodeId || node.id,
            imageIndex:Number.isFinite(Number(ref.index)) ? Number(ref.index) : 0
        }));
    }

    function nodeRefs(node){
        if(global.SmartCanvasSmartGroup?.isSmartGroupNode?.(node)) return groupRefs(node);
        return global.SmartCanvasMediaLayout?.imagesForNode?.(node) || [];
    }

    function uniqueRefs(nodes){
        const seen = new Set();
        const refs = [];
        nodes.forEach(node => nodeRefs(node).forEach(ref => {
            const url = String(ref?.url || '').trim();
            if(!url || seen.has(url)) return;
            seen.add(url);
            refs.push({...ref, url, role:`image_${refs.length + 1}`});
        }));
        return refs;
    }

    function isPromptSource(node){
        return node?.type === 'smart-prompt' || node?.type === 'smart-loop';
    }

    function uniqueIds(ids){
        return Array.from(new Set((ids || []).filter(Boolean)));
    }

    function resolveSelection(){
        const deps = d();
        const ids = selectionIds();
        const nodes = selectedNodes(ids);
        const isSingleGroup = nodes.length === 1 && global.SmartCanvasSmartGroup?.isSmartGroupNode?.(nodes[0]);
        // A single click on a group is a lightweight group selection. It should
        // expose only the group frame/capsule, not synthesize a composer subject.
        if(isSingleGroup && deps?.smartGroupCapsuleOnly) return null;
        if(ids.length < 2 && !isSingleGroup) return null;
        const refs = uniqueRefs(nodes);
        if(!refs.length) return null;
        const imageSourceIds = nodes.filter(node => nodeRefs(node).some(ref => ref?.url)).map(node => node.id);
        const promptSourceIds = nodes.filter(isPromptSource).map(node => node.id);
        const sourceIds = uniqueIds([...imageSourceIds, ...promptSourceIds]);
        if(!imageSourceIds.length) return null;
        return {ids, nodes, refs, imageSourceIds, promptSourceIds, sourceIds, key:ids.slice().sort().join('|')};
    }

    function makeSubject(info){
        const deps = d();
        return {
            id:`multi_${Date.now().toString(36)}_${info.ids.length}`,
            type:'smart-image',
            title:'Selected Images',
            images:[],
            runSettings:deps?.settingsForStorage?.(deps.settings || {}) || {...(deps?.settings || {})},
            inputNodeIds:info.promptSourceIds.slice(),
            _multiSelectCompose:true,
            _selectionKey:info.key
        };
    }

    function composerSubject(){
        const info = resolveSelection();
        if(!info){ session = null; return null; }
        if(!session || session.key !== info.key){
            session = {...info, subject:makeSubject(info)};
        } else {
            session = {...session, ...info};
        }
        // The synthetic composer subject is not stored in the canvas graph. Keep
        // its selected prompt inputs explicitly so the normal upstream-text
        // resolver renders the same preview as a real connected image node.
        session.subject.inputNodeIds = info.promptSourceIds.slice();
        return session.subject;
    }

    function isSubject(subject){ return Boolean(subject?._multiSelectCompose); }

    function referenceImagesForSubject(subject){
        if(!isSubject(subject) || !session || session.subject !== subject) return null;
        return session.refs.slice();
    }

    function selectionAnchor(info=session){
        const bounds = global.SmartCanvasSelectionBox?.selectionGroupWorldBounds?.();
        if(bounds) return {x:bounds.maxX, y:(bounds.minY + bounds.maxY) / 2};
        const rects = (info?.nodes || []).map(node => d()?.nodeRect?.(node)).filter(Boolean);
        if(!rects.length) return null;
        return {
            x:Math.max(...rects.map(rect => rect.x + rect.width)),
            y:(Math.min(...rects.map(rect => rect.y)) + Math.max(...rects.map(rect => rect.y + rect.height))) / 2
        };
    }

    function ensureConnectPort(){
        const host = document.getElementById('selectionBox');
        if(!host) return null;
        if(connectPort?.isConnected) return connectPort;
        connectPort = document.createElement('button');
        connectPort.type = 'button';
        connectPort.className = 'selection-multi-connect-port';
        connectPort.setAttribute('aria-label', '连接选中图片创建节点');
        connectPort.title = '连接选中图片创建节点';
        connectPort.addEventListener('mousedown', beginPortDrag);
        host.appendChild(connectPort);
        return connectPort;
    }

    function ensureDragPath(){
        const world = d()?.world;
        const svg = world?.querySelector('svg.connection-layer');
        if(!svg) return null;
        let path = svg.querySelector('path.selection-multi-port-line');
        if(!path){
            path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'selection-multi-port-line conn-pending');
            path.setAttribute('fill', 'none');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.appendChild(path);
        }
        return path;
    }

    function clearDragPath(){ d()?.world?.querySelector('path.selection-multi-port-line')?.remove(); }

    function drawDragPath(point){
        if(!portDrag?.anchor || !point) return;
        const {x:fx, y:fy} = portDrag.anchor;
        const dx = Math.max(50, Math.abs(point.x - fx) * 0.45);
        ensureDragPath()?.setAttribute('d', `M${fx} ${fy} C ${fx + dx} ${fy}, ${point.x - dx} ${point.y}, ${point.x} ${point.y}`);
    }

    function beginPortDrag(event){
        if(event.button !== 0) return;
        const info = resolveSelection();
        const anchor = selectionAnchor(info);
        if(!info || !anchor) return;
        event.preventDefault();
        event.stopPropagation();
        portDrag = {info, anchor, startX:event.clientX, startY:event.clientY, moved:false};
        d()?.shell?.classList.add('port-dragging');
        window.addEventListener('mousemove', movePortDrag, true);
        window.addEventListener('mouseup', endPortDrag, true);
    }

    function movePortDrag(event){
        if(!portDrag) return;
        if(Math.hypot(event.clientX - portDrag.startX, event.clientY - portDrag.startY) > 3) portDrag.moved = true;
        drawDragPath(d()?.screenToWorld?.(event));
    }

    function endPortDrag(event){
        if(!portDrag) return;
        const drag = portDrag;
        portDrag = null;
        window.removeEventListener('mousemove', movePortDrag, true);
        window.removeEventListener('mouseup', endPortDrag, true);
        d()?.shell?.classList.remove('port-dragging');
        clearDragPath();
        const targetWorld = drag.moved
            ? d()?.screenToWorld?.(event)
            : {x:drag.anchor.x + 220, y:drag.anchor.y};
        const targetScreen = drag.moved
            ? {x:event.clientX, y:event.clientY}
            : d()?.worldToScreen?.(targetWorld.x, targetWorld.y);
        if(!targetWorld || !targetScreen) return;
        global.SmartCanvasPortLinkMenu?.openBlankCreateMenu?.(
            {clientX:targetScreen.x, clientY:targetScreen.y},
            {skipBlocked:true, point:targetWorld, referenceIds:drag.info.sourceIds, anchorWorld:drag.anchor}
        );
    }

    function syncUi(){
        const active = Boolean(composerSubject());
        const marqueeSettled = document.getElementById('selectionBox')?.classList.contains('is-settled');
        const looseMarqueeActive = Boolean(
            active
            && marqueeSettled
            && session?.nodes?.length > 1
            && session.nodes.every(node => !global.SmartCanvasSmartGroup?.isSmartGroupNode?.(node))
        );
        (d()?.shell || document.getElementById('shell'))?.classList.toggle(
            'loose-multi-selection-active',
            looseMarqueeActive
        );
        const port = ensureConnectPort();
        if(port) port.hidden = !looseMarqueeActive;
    }

    function removeTarget(targetId){
        const deps = d();
        deps.nodes = (deps.nodes || []).filter(node => node.id !== targetId);
        if(deps.canvas) deps.canvas.connections = (deps.canvas.connections || []).filter(conn => conn.from !== targetId && conn.to !== targetId);
        (deps.nodes || []).forEach(node => {
            if(Array.isArray(node.inputNodeIds)) node.inputNodeIds = node.inputNodeIds.filter(id => id !== targetId);
        });
    }

    async function runIfActive(){
        const subject = composerSubject();
        if(!subject || !session) return false;
        const deps = d();
        const prompt = String(deps.promptPlainText?.() || '').trim();
        if(!prompt){
            deps.toast?.(deps.tr?.('smart.toastNeedPrompt') || '请输入提示词');
            return true;
        }
        const snapshot = {
            ids:session.ids.slice(),
            sourceIds:session.sourceIds.slice(),
            subject,
            inputThumbOrder:Array.isArray(subject.inputThumbOrder) ? subject.inputThumbOrder.slice() : [],
            anchor:selectionAnchor(session)
        };
        if(!snapshot.anchor || !snapshot.sourceIds.length) return true;
        deps.savePromptDraftForCurrent?.();
        deps.capturePendingUndo?.();
        deps.undoSuppressed = true;
        const target = deps.createImageNodeAt?.({x:snapshot.anchor.x + 220, y:snapshot.anchor.y}, [], {select:false, skipUndo:true});
        deps.undoSuppressed = false;
        if(!target){ deps.discardPendingUndo?.(); return true; }
        if(snapshot.inputThumbOrder.length) target.inputThumbOrder = snapshot.inputThumbOrder.slice();
        snapshot.sourceIds.forEach(sourceId => deps.connectInputNode?.(sourceId, target.id));
        target.promptDraftHtml = subject.promptDraftHtml || deps.promptInput?.innerHTML || '';
        target.promptDraftText = subject.promptDraftText || prompt;
        target.runSettings = deps.settingsForStorage?.(deps.settings || {}) || {...(deps.settings || {})};
        session = null;
        deps.selectedIds = [];
        deps.selectedId = target.id;
        deps.selectedImage = {nodeId:'', index:-1};
        deps.hideSelectionGroupBox?.();
        deps.render?.();
        deps.updateComposer?.();
        try {
            // Upstream text is already absorbed into the composer draft. The
            // normal request path now reads this main input only.
            await deps.runGeneration?.({node:target, skipUndo:true});
            const succeeded = (target.images || []).some(item => item?.url)
                || (target.pendingTasks || []).length > 0
                || Boolean(target.pending || target.running);
            if(succeeded){ deps.commitPendingUndo?.(); return true; }
        } catch(error) {
            console.error('[SmartCanvasMultiSelectCompose] run', error);
        }
        removeTarget(target.id);
        deps.discardPendingUndo?.();
        deps.selectedId = '';
        deps.selectedIds = snapshot.ids;
        deps.selectionMarqueeActive = true;
        deps.render?.();
        deps.positionSelectionGroupBox?.();
        deps.updateComposer?.();
        return true;
    }

    const api = Object.freeze({
        composerSubject,
        referenceImagesForSubject,
        isSubject,
        runIfActive,
        syncUi,
        resolveSelection
    });

    global.SmartCanvasCore?.register?.('multiSelectCompose', api);
    global.SmartCanvasMultiSelectCompose = api;
})(window);
