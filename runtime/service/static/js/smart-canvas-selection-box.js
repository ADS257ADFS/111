/**
 * Smart Canvas — multi-select marquee box positioning and marquee finish helpers.
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
        if(!c) throw new Error('[SmartCanvasSelectionBox] deps not registered');
        return c;
    }

    function nodes(){
        return S().getNodes();
    }

function selectionGroupWorldBounds(){
    const ids = S().selectedNodeIds();
    if(!ids.length) return null;
    const rects = ids.map(id => {
        const node = nodes().find(n => n.id === id);
        return node ? S().nodeRect(node) : null;
    }).filter(Boolean);
    if(ids.length === 1){
        const solo = nodes().find(n => n.id === ids[0]);
        if(S().isSmartGroupNode(solo)){
            S().smartGroupMembers(solo).forEach(member => {
                const rect = S().nodeRect(member);
                if(rect) rects.push(rect);
            });
        }
    }
    if(!rects.length) return null;
    const pad = 10 / Math.max(S().viewport.scale, 0.06);
    return {
        minX: Math.min(...rects.map(r => r.x)) - pad,
        minY: Math.min(...rects.map(r => r.y)) - pad,
        maxX: Math.max(...rects.map(r => r.x + r.width)) + pad,
        maxY: Math.max(...rects.map(r => r.y + r.height)) + pad
    };
}

function hideSelectionGroupBox(){
    S().selectionMarqueeActive = false;
    S().smartGroupCapsuleOnly = false;
    if(!S().selectionBox) return;
    S().selectionBox.style.display = 'none';
    S().selectionBox.style.width = '0px';
    S().selectionBox.style.height = '0px';
    S().selectionBox.classList.remove('is-dragging', 'is-settled');
    window.SmartCanvasIsolatedFeatures?.clearCapsule?.();
    S().selectionBoxCapsule?.setAttribute('hidden', '');
}

function updateSelectionCapsule(){
    if(!S().selectionMarqueeActive) return;
    window.SmartCanvasIsolatedFeatures?.syncCapsule?.();
}

function positionSelectionGroupBox(){
    if(!S().selectionMarqueeActive || !S().selectionBox) return;
    const bounds = selectionGroupWorldBounds();
    if(!bounds){
        hideSelectionGroupBox();
        return;
    }
    const tl = S().worldToScreen(bounds.minX, bounds.minY);
    const br = S().worldToScreen(bounds.maxX, bounds.maxY);
    S().selectionBox.style.display = 'block';
    S().selectionBox.style.outline = 'none';
    S().selectionBox.classList.remove('is-dragging');
    S().selectionBox.classList.add('is-settled');
    S().selectionBox.style.left = `${tl.x}px`;
    S().selectionBox.style.top = `${tl.y}px`;
    S().selectionBox.style.width = `${Math.max(0, br.x - tl.x)}px`;
    S().selectionBox.style.height = `${Math.max(0, br.y - tl.y)}px`;
    updateSelectionCapsule();
}

function updateSelectionBox(event){
    if(!S().selectionState) return;
    const sx = S().selectionState.startScreen.x, sy = S().selectionState.startScreen.y;
    const dragDist = Math.hypot(event.clientX - sx, event.clientY - sy);
    if(dragDist < 2) return;
    const x = Math.min(sx, event.clientX), y = Math.min(sy, event.clientY);
    S().selectionBox.style.display = 'block';
    S().selectionBox.style.outline = 'none';
    S().selectionBox.classList.add('is-dragging');
    S().selectionBox.classList.remove('is-settled');
    window.SmartCanvasIsolatedFeatures?.clearCapsule?.();
    S().selectionBoxCapsule?.setAttribute('hidden', '');
    S().selectionBox.style.left = `${x}px`;
    S().selectionBox.style.top = `${y}px`;
    S().selectionBox.style.width = `${Math.abs(event.clientX - sx)}px`;
    S().selectionBox.style.height = `${Math.abs(event.clientY - sy)}px`;
}

function collapseSelectedGroupMembers(rawIds){
    const ids = [...new Set((rawIds || []).filter(Boolean))];
    if(ids.length < 2) return ids;
    const selectedIdSet = new Set(ids);
    const nestedMemberIds = new Set();
    ids.forEach(id => {
        const node = nodes().find(item => item.id === id);
        if(!S().isSmartGroupNode(node)) return;
        (S().smartGroupMembers(node) || []).forEach(member => {
            if(member?.id && selectedIdSet.has(member.id)) nestedMemberIds.add(member.id);
        });
    });
    return ids.filter(id => !nestedMemberIds.has(id));
}

function finishSelection(event){
    if(!S().selectionState) return;
    const sx = S().selectionState.startScreen.x, sy = S().selectionState.startScreen.y;
    const dragDist = Math.hypot(event.clientX - sx, event.clientY - sy);
    if(dragDist < 4){
        S().selectionState = null;
        S().selectionBox.style.display = 'none';
        S().selectionBox.style.width = '0px';
        S().selectionBox.style.height = '0px';
        S().selectionBox.classList.remove('is-dragging', 'is-settled');
        if(S().selectionMarqueeActive) positionSelectionGroupBox();
        return;
    }
    const a = S().selectionState.startWorld;
    const b = S().screenToWorld(event);
    const minX = Math.min(a.x, b.x), minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x, b.x), maxY = Math.max(a.y, b.y);
    const rawMarqueeIds = nodes().filter(node => {
        const r = S().nodeRect(node);
        return r.x < maxX && r.x + r.width > minX && r.y < maxY && r.y + r.height > minY;
    }).map(n => n.id);
    const marqueeIds = collapseSelectedGroupMembers(rawMarqueeIds);
    S().selectedIds = marqueeIds.length > 1 ? marqueeIds : [];
    S().selectedId = marqueeIds.length === 1 ? marqueeIds[0] : '';
    S().selectedImage = {nodeId:'', index:-1};
    S().smartGroupCapsuleOnly = false;
    S().selectionState = null;
    S().selectionJustFinished = true;
    if(marqueeIds.length > 1){
        S().selectionMarqueeActive = true;
        window.SmartCanvasIsolatedFeatures?.onMarqueeFinished?.(marqueeIds);
        positionSelectionGroupBox();
    } else {
        hideSelectionGroupBox();
    }
    S().focusCanvasForShortcuts();
    // Marquee selection does not mutate node content. Keep media elements and
    // the connection layer intact instead of rebuilding the full canvas.
    if(typeof S().syncSelectionUi === 'function') S().syncSelectionUi();
    else S().render();
    // Multi-selection owns a synthetic composer subject. Refreshing only the
    // selection outline leaves the bottom composer collapsed and its automatic
    // image references stale, so always resync the composer after marquee end.
    S().updateComposer?.();
    if(marqueeIds.length === 1){
        const selectedNode = nodes().find(node => node.id === marqueeIds[0]);
        if(S().isSmartGroupNode(selectedNode)){
            S().showSmartGroupCapsule?.(selectedNode.id);
        }
    }
    setTimeout(() => { S().selectionJustFinished = false; }, 0);
}

function layoutNodesInGrid(nodeList, originX, originY, gap=24){
    const list = (nodeList || []).filter(Boolean);
    if(!list.length) return originY;
    const columns = Math.max(1, Math.ceil(Math.sqrt(list.length)));
    const rows = Math.ceil(list.length / columns);
    const rects = list.map(node => S().nodeRect(node));
    const columnWidths = Array.from({length:columns}, () => 40);
    const rowHeights = Array.from({length:rows}, () => 40);
    rects.forEach((rect, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        columnWidths[column] = Math.max(columnWidths[column], Number(rect.width) || 40);
        rowHeights[row] = Math.max(rowHeights[row], Number(rect.height) || 40);
    });
    const columnX = [];
    const rowY = [];
    let x = originX;
    columnWidths.forEach(width => {
        columnX.push(x);
        x += width + gap;
    });
    let y = originY;
    rowHeights.forEach(height => {
        rowY.push(y);
        y += height + gap;
    });
    list.forEach((node, index) => {
        node.x = Math.round(columnX[index % columns]);
        node.y = Math.round(rowY[Math.floor(index / columns)]);
    });
    return y;
}

function arrangeSelectedNodes(){
    const ids = S().selectedNodeIds();
    if(ids.length < 2){
        S().toast('请至少选择两个节点再整理');
        return false;
    }
    const selected = ids.map(id => nodes().find(n => n.id === id)).filter(Boolean);
    const topLevel = selected.filter(node => !S().smartGroupContainingNode(node.id));
    if(topLevel.length < 2){
        S().toast('请至少选择两个顶层节点再整理');
        return false;
    }

    const anchorRects = topLevel.map(node => S().nodeRect(node));
    const originX = Math.min(...anchorRects.map(rect => rect.x));
    const originY = Math.min(...anchorRects.map(rect => rect.y));
    const nodeById = new Map(topLevel.map(node => [node.id, node]));
    const adjacency = new Map(topLevel.map(node => [node.id, new Set()]));
    const connectedIds = new Set();
    (S().getCanvas()?.connections || []).forEach(conn => {
        if(!conn || conn.from === conn.to || !nodeById.has(conn.from) || !nodeById.has(conn.to)) return;
        adjacency.get(conn.from).add(conn.to);
        connectedIds.add(conn.from);
        connectedIds.add(conn.to);
    });
    const connectedNodes = topLevel.filter(node => connectedIds.has(node.id));
    const isolatedNodes = topLevel
        .filter(node => !connectedIds.has(node.id))
        .sort((a, b) => {
            const ra = S().nodeRect(a), rb = S().nodeRect(b);
            const dy = (Number(ra.y) || 0) - (Number(rb.y) || 0);
            return Math.abs(dy) > 1 ? dy : (Number(ra.x) || 0) - (Number(rb.x) || 0);
        });

    // Collapse cycles into one component, then rank the component DAG. Every
    // upstream component is therefore placed left of all its downstreams.
    let visitIndex = 0;
    const indices = new Map();
    const lowLinks = new Map();
    const stack = [];
    const onStack = new Set();
    const components = [];
    const visit = id => {
        indices.set(id, visitIndex);
        lowLinks.set(id, visitIndex);
        visitIndex += 1;
        stack.push(id);
        onStack.add(id);
        adjacency.get(id).forEach(nextId => {
            if(!indices.has(nextId)){
                visit(nextId);
                lowLinks.set(id, Math.min(lowLinks.get(id), lowLinks.get(nextId)));
            } else if(onStack.has(nextId)){
                lowLinks.set(id, Math.min(lowLinks.get(id), indices.get(nextId)));
            }
        });
        if(lowLinks.get(id) !== indices.get(id)) return;
        const component = [];
        let current = '';
        do {
            current = stack.pop();
            onStack.delete(current);
            component.push(current);
        } while(current !== id);
        components.push(component);
    };
    connectedNodes.forEach(node => { if(!indices.has(node.id)) visit(node.id); });

    const componentOf = new Map();
    components.forEach((component, componentIndex) => component.forEach(id => componentOf.set(id, componentIndex)));
    const componentEdges = components.map(() => new Set());
    const indegree = components.map(() => 0);
    adjacency.forEach((targets, fromId) => targets.forEach(toId => {
        const fromComponent = componentOf.get(fromId);
        const toComponent = componentOf.get(toId);
        if(fromComponent === toComponent || componentEdges[fromComponent].has(toComponent)) return;
        componentEdges[fromComponent].add(toComponent);
        indegree[toComponent] += 1;
    }));
    const ranks = components.map(() => 0);
    const queue = components.map((_, index) => index).filter(index => indegree[index] === 0);
    for(let queueIndex = 0; queueIndex < queue.length; queueIndex += 1){
        const componentIndex = queue[queueIndex];
        componentEdges[componentIndex].forEach(nextIndex => {
            ranks[nextIndex] = Math.max(ranks[nextIndex], ranks[componentIndex] + 1);
            indegree[nextIndex] -= 1;
            if(indegree[nextIndex] === 0) queue.push(nextIndex);
        });
    }

    const layers = new Map();
    connectedNodes.forEach(node => {
        const rank = ranks[componentOf.get(node.id)] || 0;
        if(!layers.has(rank)) layers.set(rank, []);
        layers.get(rank).push(node);
    });
    const orderedLayers = [...layers.keys()].sort((a, b) => a - b).map(rank => {
        const layerNodes = layers.get(rank).slice().sort((a, b) => {
            const ra = S().nodeRect(a), rb = S().nodeRect(b);
            const dy = (Number(ra.y) || 0) - (Number(rb.y) || 0);
            return Math.abs(dy) > 1 ? dy : (Number(ra.x) || 0) - (Number(rb.x) || 0);
        });
        const rects = layerNodes.map(node => S().nodeRect(node));
        return {
            nodes:layerNodes,
            rects,
            width:Math.max(...rects.map(rect => Math.max(40, Number(rect.width) || 40))),
            height:rects.reduce((sum, rect) => sum + Math.max(40, Number(rect.height) || 40), 0) + Math.max(0, rects.length - 1) * 36
        };
    });

    S().pushUndo();
    let connectedHeight = 0;
    if(orderedLayers.length){
        connectedHeight = Math.max(...orderedLayers.map(layer => layer.height));
        let x = originX;
        orderedLayers.forEach(layer => {
            let y = originY + Math.max(0, (connectedHeight - layer.height) / 2);
            layer.nodes.forEach((node, index) => {
                const rect = layer.rects[index];
                node.x = Math.round(x + (layer.width - rect.width) / 2);
                node.y = Math.round(y);
                y += rect.height + 36;
            });
            x += layer.width + 96;
        });
    }
    if(isolatedNodes.length){
        const isolatedOriginY = connectedHeight > 0 ? originY + connectedHeight + 120 : originY;
        layoutNodesInGrid(isolatedNodes, originX, isolatedOriginY, 48);
    }
    S().render();
    S().scheduleSave();
    if(S().selectionMarqueeActive) positionSelectionGroupBox();
    S().toast('已按上下游关系整理');
    return true;
}

    const api = Object.freeze({
        registerDeps,
        selectionGroupWorldBounds,
        hideSelectionGroupBox,
        updateSelectionCapsule,
        positionSelectionGroupBox,
        updateSelectionBox,
        finishSelection,
        layoutNodesInGrid,
        arrangeSelectedNodes,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('selectionBox', api);
    }
    global.SmartCanvasSelectionBox = api;
})(window);
