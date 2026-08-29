/**
 * Smart Canvas — isolated object-to-object alignment and spacing guides.
 */
(function(global){
    'use strict';

    const STORAGE_KEY = 'smart_canvas_smart_guides';
    const SNAP_SCREEN_PX = 8;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    let enabled = true;
    let overlay = null;

    try {
        const stored = global.localStorage?.getItem(STORAGE_KEY);
        enabled = stored === null || stored === '1';
    } catch(_error) {
        enabled = true;
    }

    function rectOf(input){
        const x = Number(input?.x) || 0;
        const y = Number(input?.y) || 0;
        const width = Math.max(0, Number(input?.width) || 0);
        const height = Math.max(0, Number(input?.height) || 0);
        return {
            id:input?.id || '',
            x,
            y,
            width,
            height,
            left:x,
            right:x + width,
            top:y,
            bottom:y + height,
            centerX:x + width / 2,
            centerY:y + height / 2,
        };
    }

    function intervalsOverlap(a1, a2, b1, b2){
        return Math.min(a2, b2) >= Math.max(a1, b1);
    }

    function alignCandidates(moving, candidates, axis, threshold){
        const horizontal = axis === 'x';
        const movingAnchors = horizontal
            ? [moving.left, moving.centerX, moving.right]
            : [moving.top, moving.centerY, moving.bottom];
        const results = [];
        candidates.forEach(candidate => {
            const target = rectOf(candidate);
            const targetAnchors = horizontal
                ? [target.left, target.centerX, target.right]
                : [target.top, target.centerY, target.bottom];
            movingAnchors.forEach(movingValue => {
                targetAnchors.forEach(targetValue => {
                    const delta = targetValue - movingValue;
                    if(Math.abs(delta) > threshold) return;
                    results.push({
                        axis,
                        kind:'align',
                        delta,
                        priority:0,
                        guide:horizontal
                            ? {
                                axis:'x',
                                kind:'align',
                                position:targetValue,
                                x1:targetValue,
                                y1:Math.min(moving.top, target.top),
                                x2:targetValue,
                                y2:Math.max(moving.bottom, target.bottom),
                                targetId:target.id,
                            }
                            : {
                                axis:'y',
                                kind:'align',
                                position:targetValue,
                                x1:Math.min(moving.left, target.left),
                                y1:targetValue,
                                x2:Math.max(moving.right, target.right),
                                y2:targetValue,
                                targetId:target.id,
                            },
                    });
                });
            });
        });
        return results;
    }

    function spacingCandidates(moving, candidates, axis, threshold){
        const horizontal = axis === 'x';
        const results = [];
        for(let i = 0; i < candidates.length; i++){
            const first = rectOf(candidates[i]);
            for(let j = i + 1; j < candidates.length; j++){
                const second = rectOf(candidates[j]);
                const before = horizontal
                    ? (first.left <= second.left ? first : second)
                    : (first.top <= second.top ? first : second);
                const after = before === first ? second : first;
                if(horizontal){
                    if(before.right > moving.left || moving.right > after.left) continue;
                    if(
                        !intervalsOverlap(moving.top, moving.bottom, before.top, before.bottom)
                        || !intervalsOverlap(moving.top, moving.bottom, after.top, after.bottom)
                    ) continue;
                    const leftGap = moving.left - before.right;
                    const rightGap = after.left - moving.right;
                    const delta = (rightGap - leftGap) / 2;
                    if(Math.abs(delta) > threshold) continue;
                    const snappedLeft = moving.left + delta;
                    const snappedRight = moving.right + delta;
                    const y = moving.centerY;
                    results.push({
                        axis:'x',
                        kind:'spacing',
                        delta,
                        priority:1,
                        guides:[
                            {axis:'x', kind:'spacing', x1:before.right, y1:y, x2:snappedLeft, y2:y},
                            {axis:'x', kind:'spacing', x1:snappedRight, y1:y, x2:after.left, y2:y},
                        ],
                    });
                } else {
                    if(before.bottom > moving.top || moving.bottom > after.top) continue;
                    if(
                        !intervalsOverlap(moving.left, moving.right, before.left, before.right)
                        || !intervalsOverlap(moving.left, moving.right, after.left, after.right)
                    ) continue;
                    const topGap = moving.top - before.bottom;
                    const bottomGap = after.top - moving.bottom;
                    const delta = (bottomGap - topGap) / 2;
                    if(Math.abs(delta) > threshold) continue;
                    const snappedTop = moving.top + delta;
                    const snappedBottom = moving.bottom + delta;
                    const x = moving.centerX;
                    results.push({
                        axis:'y',
                        kind:'spacing',
                        delta,
                        priority:1,
                        guides:[
                            {axis:'y', kind:'spacing', x1:x, y1:before.bottom, x2:x, y2:snappedTop},
                            {axis:'y', kind:'spacing', x1:x, y1:snappedBottom, x2:x, y2:after.top},
                        ],
                    });
                }
            }
        }
        return results;
    }

    function bestAxisCandidate(items){
        return items.sort((a, b) => {
            const distance = Math.abs(a.delta) - Math.abs(b.delta);
            if(Math.abs(distance) > 0.0001) return distance;
            return a.priority - b.priority;
        })[0] || null;
    }

    function computeSnap(input={}){
        const moving = rectOf(input.movingRect);
        const candidates = (input.candidates || []).map(rectOf);
        const threshold = Math.max(0, Number(input.threshold) || 0);
        if(!moving.width || !moving.height || !candidates.length || !threshold){
            return {dx:0, dy:0, guides:[]};
        }
        const xChoice = bestAxisCandidate([
            ...alignCandidates(moving, candidates, 'x', threshold),
            ...spacingCandidates(moving, candidates, 'x', threshold),
        ]);
        const yChoice = bestAxisCandidate([
            ...alignCandidates(moving, candidates, 'y', threshold),
            ...spacingCandidates(moving, candidates, 'y', threshold),
        ]);
        const guides = [];
        [xChoice, yChoice].forEach(choice => {
            if(!choice) return;
            if(Array.isArray(choice.guides)) guides.push(...choice.guides);
            else if(choice.guide) guides.push(choice.guide);
        });
        return {
            dx:xChoice?.delta || 0,
            dy:yChoice?.delta || 0,
            guides,
        };
    }

    function dragItems(ctx, dragState){
        const items = dragState?.group?.length
            ? dragState.group
            : [{id:dragState?.id}];
        return items.map(item => ctx.nodes?.find(node => node.id === item.id)).filter(Boolean);
    }

    function unionRect(ctx, nodes){
        const rects = nodes.map(node => rectOf({...ctx.nodeRect(node), id:node.id}));
        if(!rects.length) return null;
        const left = Math.min(...rects.map(rect => rect.left));
        const top = Math.min(...rects.map(rect => rect.top));
        const right = Math.max(...rects.map(rect => rect.right));
        const bottom = Math.max(...rects.map(rect => rect.bottom));
        return rectOf({x:left, y:top, width:right - left, height:bottom - top});
    }

    function visibleCandidateRects(ctx, excludedIds){
        // Use model geometry only — per-node querySelector on every mousemove
        // was a major drag hitch with many nodes.
        return (ctx.nodes || []).filter(node => !excludedIds.has(node.id))
            .map(node => rectOf({...ctx.nodeRect(node), id:node.id}))
            .filter(rect => rect.width && rect.height);
    }

    function ensureOverlay(ctx){
        if(overlay?.isConnected) return overlay;
        if(!ctx?.shell || !global.document?.createElementNS) return null;
        overlay = global.document.createElementNS(SVG_NS, 'svg');
        overlay.classList.add('smart-guide-overlay');
        overlay.setAttribute('aria-hidden', 'true');
        ctx.shell.appendChild(overlay);
        return overlay;
    }

    function screenPoint(ctx, x, y){
        const scale = Number(ctx.viewport?.scale) || 1;
        return {
            x:x * scale + (Number(ctx.viewport?.x) || 0),
            y:y * scale + (Number(ctx.viewport?.y) || 0),
        };
    }

    function renderGuides(ctx, guides){
        const layer = ensureOverlay(ctx);
        if(!layer) return;
        layer.replaceChildren();
        guides.forEach(guide => {
            const start = screenPoint(ctx, guide.x1, guide.y1);
            const end = screenPoint(ctx, guide.x2, guide.y2);
            const line = global.document.createElementNS(SVG_NS, 'line');
            line.classList.add('smart-guide-line', `is-${guide.kind || 'align'}`);
            line.setAttribute('x1', String(start.x));
            line.setAttribute('y1', String(start.y));
            line.setAttribute('x2', String(end.x));
            line.setAttribute('y2', String(end.y));
            layer.appendChild(line);
        });
        layer.classList.toggle('visible', guides.length > 0);
    }

    function clear(){
        if(!overlay) return;
        overlay.replaceChildren();
        overlay.classList.remove('visible');
    }

    function applyDrag(ctx, dragState){
        if(!enabled || !ctx || !dragState){
            clear();
            return {dx:0, dy:0, guides:[]};
        }
        const dragged = dragItems(ctx, dragState);
        const movingRect = unionRect(ctx, dragged);
        if(!movingRect){
            clear();
            return {dx:0, dy:0, guides:[]};
        }
        const excludedIds = new Set(dragged.map(node => node.id));
        const candidates = visibleCandidateRects(ctx, excludedIds);
        const threshold = SNAP_SCREEN_PX / Math.max(0.05, Number(ctx.viewport?.scale) || 1);
        const snap = computeSnap({movingRect, candidates, threshold});
        if(snap.dx || snap.dy){
            dragged.forEach(node => {
                node.x = (Number(node.x) || 0) + snap.dx;
                node.y = (Number(node.y) || 0) + snap.dy;
            });
        }
        renderGuides(ctx, snap.guides);
        return snap;
    }

    function syncToggle(button){
        if(!button) return;
        button.classList.toggle('active', enabled);
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        const label = `智能参考线 · 点击${enabled ? '关闭' : '开启'}`;
        button.setAttribute('title', label);
        button.setAttribute('aria-label', label);
    }

    function notifyParent(){
        try {
            if(global.parent && global.parent !== global){
                global.parent.postMessage({ type:'canvas-smart-guides-state', enabled }, global.location.origin);
            }
        } catch(_error) {}
    }

    function setEnabled(next, button){
        enabled = Boolean(next);
        try {
            global.localStorage?.setItem(STORAGE_KEY, enabled ? '1' : '0');
        } catch(_error) {}
        if(!enabled) clear();
        syncToggle(button || global.document?.getElementById?.('canvasSmartGuidesToggle'));
        notifyParent();
        return enabled;
    }

    function bindToggle(button){
        if(!button) return;
        syncToggle(button);
        if(button.dataset.boundSmartGuides === '1') return;
        button.dataset.boundSmartGuides = '1';
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            setEnabled(!enabled, button);
        });
        button.addEventListener('mousedown', event => event.stopPropagation(), true);
    }

    const api = Object.freeze({
        STORAGE_KEY,
        SNAP_SCREEN_PX,
        computeSnap,
        applyDrag,
        clear,
        bindToggle,
        isEnabled:() => enabled,
        setEnabled,
    });

    global.SmartCanvasCore?.register?.('smartGuides', api);
    global.SmartCanvasSmartGuides = api;
    global.addEventListener('message', event => {
        if(event.origin && event.origin !== global.location.origin) return;
        if(event.data?.type === 'canvas-smart-guides-set') setEnabled(event.data.enabled);
        if(event.data?.type === 'canvas-smart-guides-query') notifyParent();
    });
    global.setTimeout(notifyParent, 0);
})(window);
