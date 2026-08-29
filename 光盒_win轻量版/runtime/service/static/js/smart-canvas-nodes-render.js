/**
 * Smart Canvas — node DOM render, connections layer, run timer pills.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;
    let runTimerInterval = null;

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || global.SmartCanvasCore?.tryDeps?.() || null;
    }

function renderConnections(){
    const conns = (d().canvas?.connections || []).map((conn, index) => ({...conn, index})).filter(c => d().nodes.some(n => n.id === c.from) && d().nodes.some(n => n.id === c.to));
    const cascadeKeys = d().cascadeConnectionKeys();
    const paths = conns.map(conn => {
        const fromNode = d().nodes.find(n => n.id === conn.from);
        const toNode = d().nodes.find(n => n.id === conn.to);
        const fr = d().nodeRect(fromNode), tr = d().nodeRect(toNode);
        const kind = conn.kind || 'flow';
        const isHistory = kind === 'history';
        const isInsertPreview = d().loopInsertPreview?.index === conn.index;
        const edgeKey = `${conn.from}->${conn.to}`;
        const cascadeState = d().smartCascadeEdgeState(edgeKey);
        const isCascade = !isHistory && (cascadeKeys.has(edgeKey) || Boolean(cascadeState) || isInsertPreview);
        const isPendingLine = Boolean(toNode.pending && !isCascade);
        const fx = isHistory ? fr.x + fr.width / 2 : fr.x + fr.width;
        const fy = isHistory ? fr.y + fr.height : fr.y + fr.height / 2;
        const tx = isHistory ? tr.x + tr.width / 2 : tr.x;
        const ty = isHistory ? tr.y : tr.y + tr.height / 2;
        const dx = Math.max(50, Math.abs(tx - fx) * 0.45);
        const dy = Math.max(36, Math.abs(ty - fy) * 0.45);
        const curve = isHistory
            ? `M${fx} ${fy} C ${fx} ${fy+dy}, ${tx} ${ty-dy}, ${tx} ${ty}`
            : `M${fx} ${fy} C ${fx+dx} ${fy}, ${tx-dx} ${ty}, ${tx} ${ty}`;
        const mx = (fx + tx) / 2, my = (fy + ty) / 2;
        const cls = [
            isPendingLine ? 'conn-pending' : '',
            isCascade ? 'conn-cascade' : '',
            isCascade && cascadeState === 'done' ? 'conn-cascade-done' : '',
            isCascade && Boolean(cascadeState) && cascadeState !== 'done' ? 'conn-cascade-wait' : '',
            isCascade && cascadeState === 'active' ? 'conn-cascade-active' : '',
            isHistory ? 'conn-history' : ''
        ].filter(Boolean).join(' ');
        const color = isHistory ? 'rgba(148,156,168,0.48)' : 'rgba(135,145,158,0.62)';
        const opacity = isPendingLine ? '.68' : '.9';
        const width = '0.5';
        return `<path class="conn-line ${cls}" d="${curve}" stroke="${color}" stroke-width="${width}" fill="none" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"></path><path class="conn-hit" data-conn-index="${conn.index}" d="${curve}" stroke="transparent" stroke-width="14" fill="none"></path><circle class="conn-end" cx="${tx}" cy="${ty}" r="2.6" fill="var(--card)" stroke="${color}" stroke-width="0.5"></circle><g class="conn-cut" data-conn-index="${conn.index}" transform="translate(${mx} ${my})"><circle r="7" fill="var(--card)" stroke="${color}" stroke-width="1.1"></circle><path d="M-2.25 -2.25 L2.25 2.25 M2.25 -2.25 L-2.25 2.25" stroke="${color}" stroke-width="1.2" stroke-linecap="round"></path></g>`;
    }).join('');
    return `<svg class="connection-layer" width="6000" height="4000" viewBox="0 0 6000 4000" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}
function refreshConnectionLayer(){
    const oldSvg = d().world.querySelector('svg.connection-layer');
    if(!oldSvg) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = renderConnections().trim();
    const nextSvg = tpl.content.firstElementChild;
    if(nextSvg) oldSvg.replaceWith(nextSvg);
    bindConnectionEvents();
}
function moveNodeElementsDuringDrag(){
    if(!d().dragState) return;
    const groupItems = d().dragState.group || [{id:d().dragState.id}];
    const draggedIds = groupItems.map(item => item.id);
    draggedIds.forEach(id => {
        const n = d().nodes.find(x => x.id === id);
        const el = d().world.querySelector(`.image-node[data-id="${CSS.escape(id)}"]`);
        if(n && el){
            el.style.left = `${n.x || 0}px`;
            el.style.top = `${n.y || 0}px`;
        }
    });
    const active = d().selectedNode();
    if(active && (d().dragState.group || [{id:d().dragState.id}]).some(item => item.id === active.id)){
        d().positionComposerForNode(active);
    }
    if(d().imageQuickToolbar && !d().imageQuickToolbar.hidden){
        d().positionImageQuickToolbar();
    }
    if(d().selectionMarqueeActive){
        d().positionSelectionGroupBox();
    }
    // Full connection SVG rebuild + hit rebind every drag frame thrash WebView2.
    // Hide lines while dragging; refresh once when drag settles.
    const layer = d().world.querySelector('svg.connection-layer');
    if(layer) layer.style.visibility = 'hidden';
}
function updateNodeElementDuringResize(node, options={}){
    if(!node) return;
    const el = d().world.querySelector(`.image-node[data-id="${CSS.escape(node.id)}"]`);
    if(!el){
        render();
        return;
    }
    if(options.lightweight && node.type === 'smart-prompt' && node.llmEnabled && node.llmComposerUnified === true){
        const width = Math.round(Number(node.w) || d().PROMPT_NODE_DEFAULT_WIDTH);
        const height = d().promptNodeContentHeight(node);
        node.h = height;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        const previewEl = el.querySelector('.prompt-node-resize-preview');
        if(previewEl) previewEl.style.height = `${d().promptNodeTextHeight(node)}px`;
        else {
            const mainWrap = el.querySelector('.prompt-node-text-wrap');
            if(mainWrap) mainWrap.style.height = `${d().promptNodeTextHeight(node)}px`;
        }
        return;
    }
    const imgs = node.images || [];
    const layout = d().imageLayout(imgs, d().nodeScale(node), node);
    el.style.width = `${layout.width}px`;
    el.style.height = `${layout.height}px`;
    const body = el.querySelector('.node-body');
    if(body){
        const loadingSingle = body.querySelector('.loading-cell.single');
        if(loadingSingle){
            loadingSingle.style.width = `${layout.width}px`;
            loadingSingle.style.height = `${layout.height}px`;
        }
        const loadingGrid = body.querySelector('.loading-skeleton');
        if(loadingGrid){
            const count = Math.max(1, Number(node.pending) || 1);
            const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(count))));
            const rows = Math.ceil(count / cols);
            loadingGrid.style.width = `${layout.width}px`;
            loadingGrid.style.height = `${layout.height}px`;
            loadingGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            loadingGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        }
        const grid = body.querySelector('.thumb-grid');
        if(grid){
            grid.style.setProperty('--thumb-cols', layout.cols);
            grid.style.setProperty('--thumb-size', `${layout.thumb}px`);
        }
        const wrap = body.querySelector('.image-wrap');
        if(wrap){
            wrap.style.setProperty('--node-img-w', `${layout.width}px`);
            wrap.style.setProperty('--node-img-h', `${layout.height}px`);
        }
        const media = body.querySelector('.node-img');
        if(media){
            media.style.width = `${layout.width}px`;
            media.style.height = `${layout.height}px`;
        }
        if(node.type === 'smart-prompt' && node.llmEnabled){
            const mainEl = body.querySelector('.prompt-node-text-wrap');
            const instrEl = body.querySelector('.prompt-llm-instruction');
            if(mainEl) mainEl.style.height = `${d().promptNodeTextHeight(node)}px`;
            if(instrEl) instrEl.style.height = `${d().promptLlmInstructionHeight(node)}px`;
            const measured = d().promptNodeContentHeight(node);
            if(!node.promptMaximized) node.h = measured;
            el.style.height = `${node.promptMaximized ? layout.height : measured}px`;
        }
    }
    const active = d().selectedNode();
    if(active?.id === node.id) d().positionComposerForNode(active);
    d().scheduleInteractionLayerRefresh?.();
}
function smartNodeHasLiveMedia(node){
    return Boolean(!node?.pending && (node?.images || []).some(img => d().isVideoMediaItem(img) || d().isAudioMediaItem(img)));
}
function mediaSignaturePartFromElement(itemEl){
    if(itemEl?.dataset?.mediaSignature) return itemEl.dataset.mediaSignature;
    const media = itemEl?.querySelector?.('video,audio,img');
    if(media){
        const tag = media.tagName.toLowerCase();
        const kind = tag === 'video' ? 'video' : tag === 'audio' ? 'audio' : 'image';
        const url = media.dataset?.url || media.dataset?.originalSrc || media.getAttribute('src') || '';
        return `${kind}:${url}`;
    }
    const audioThumb = itemEl?.querySelector?.('.audio-thumb[data-media-url]');
    if(audioThumb) return `audio:${audioThumb.dataset.mediaUrl || ''}`;
    return '';
}
function captureMediaPlaybackState(media){
    if(!media) return null;
    return {
        currentTime:Number.isFinite(media.currentTime) ? media.currentTime : 0,
        paused:Boolean(media.paused),
        playbackRate:Number.isFinite(media.playbackRate) ? media.playbackRate : 1,
        muted:Boolean(media.muted),
        volume:Number.isFinite(media.volume) ? media.volume : 1
    };
}
function restoreMediaPlaybackState(media, state){
    if(!media || !state) return;
    try { media.playbackRate = state.playbackRate || 1; } catch(e) {}
    try { media.muted = state.muted; } catch(e) {}
    try { media.volume = state.volume; } catch(e) {}
    const applyTime = () => {
        if(Number.isFinite(state.currentTime) && state.currentTime > 0 && Math.abs((media.currentTime || 0) - state.currentTime) > 0.2){
            try { media.currentTime = state.currentTime; } catch(e) {}
        }
        if(!state.paused && typeof media.play === 'function'){
            const playPromise = media.play();
            if(playPromise?.catch) playPromise.catch(() => {});
        }
    };
    if(media.readyState >= 1) applyTime();
    else media.addEventListener('loadedmetadata', applyTime, {once:true});
}
function transplantSmartMediaElements(oldNodeEl, newNodeEl){
    const oldItems = [...(oldNodeEl?.querySelectorAll?.('.thumb-item,.image-wrap') || [])];
    const newItems = [...(newNodeEl?.querySelectorAll?.('.thumb-item,.image-wrap') || [])];
    oldItems.forEach((oldItem, index) => {
        const oldMedia = oldItem.querySelector('video,audio');
        if(!oldMedia) return;
        const selector = oldMedia.tagName.toLowerCase();
        const oldUrl = oldMedia.dataset?.url || oldMedia.getAttribute('src') || '';
        const oldSignature = oldItem.dataset?.mediaSignature || `${selector}:${oldUrl}`;
        const newItem = newItems.find(item => item.dataset?.mediaSignature === oldSignature)
            || newItems.find(item => item.querySelector?.(selector)?.dataset?.url === oldUrl)
            || newItems[index];
        const newMedia = newItem?.querySelector?.(selector);
        const newUrl = newMedia?.dataset?.url || newMedia?.getAttribute?.('src') || '';
        if(!newMedia || oldUrl !== newUrl) return;
        const state = captureMediaPlaybackState(oldMedia);
        newMedia.replaceWith(oldMedia);
        restoreMediaPlaybackState(oldMedia, state);
        requestAnimationFrame(() => restoreMediaPlaybackState(oldMedia, state));
    });
}
function captureMediaPlaybackStates(){
    const states = new Map();
    d().world.querySelectorAll('video[data-url], audio[data-url]').forEach(media => {
        const tag = media.tagName.toLowerCase();
        const url = media.dataset.url || media.getAttribute('src') || '';
        if(url) states.set(`${tag}:${url}`, captureMediaPlaybackState(media));
    });
    return states;
}
function restoreMediaPlaybackStates(states){
    if(!states?.size) return;
    d().world.querySelectorAll('video[data-url], audio[data-url]').forEach(media => {
        const tag = media.tagName.toLowerCase();
        const url = media.dataset.url || media.getAttribute('src') || '';
        restoreMediaPlaybackState(media, states.get(`${tag}:${url}`));
    });
}
function formatRunDuration(ms){
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return min ? `${min}:${String(sec).padStart(2, '0')}` : `${sec}s`;
}
function formatRunClock(ms){
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function nodeRunElapsedMs(node){
    if(!node) return 0;
    if(node.runFinishedAt && node.runStartedAt) return Number(node.runElapsedMs) || (Number(node.runFinishedAt) - Number(node.runStartedAt));
    if(node.runStartedAt) return d().nowMs() - Number(node.runStartedAt);
    return 0;
}
function pendingSlotCount(node){
    const tasks = d().smartPendingTasks?.(node) || [];
    return Math.max(Number(node?.pending) || 0, tasks.length, node?.running ? 1 : 0);
}
function shouldShowInlineGenerationCancel(node){
    return pendingSlotCount(node) <= 1;
}
function runInlineCancelHtml(node){
    if(node?.externalImageTaskId) return '';
    if(!node || !shouldShowInlineGenerationCancel(node)) return '';
    const running = Boolean(node.pending || node.running || node.jimengPending || node.queued);
    if(!running) return '';
    return `<button class="run-status-actions run-inline-cancel" type="button" data-inline-generation-cancel aria-label="取消当前生成任务" title="取消当前生成任务">
        <span class="run-status-label">生成中...</span>
        <span class="run-inline-cancel-label">取消</span>
    </button>`;
}
function runTimePillHtml(node){
    if(!node || node.runTimerHidden || node.type === 'smart-prompt') return '';
    const running = Boolean(node.pending || node.running || node.jimengPending || node.queued);
    if(!running) return '';
    return `<div class="run-status-stack">
        <span class="run-time-pill" data-run-timer="${d().escapeHtml(node.id)}">${formatRunClock(nodeRunElapsedMs(node))}</span>
    </div>
    ${runInlineCancelHtml(node)}`;
}
function shouldUseDirectGenerationLoader(node, isActive, hasMedia){
    const pendingCount = Math.max(1, Number(node?.pending) || 1);
    const running = Boolean(node?.pending || node?.running || node?.jimengPending || node?.queued);
    return Boolean(running && !hasMedia && pendingCount <= 1);
}
function ensureRunningLoaders(){
    document.querySelectorAll('.image-node').forEach(nodeEl => {
        const body = nodeEl.querySelector('.node-body');
        if(!body) return;
        const hasMedia = Boolean(body.querySelector('img,video,audio,.media-file-card'));
        const node = d().nodes.find(item => item.id === nodeEl.dataset.id);
        const isActive = Boolean(nodeEl.querySelector('[data-inline-generation-cancel]') || (node && (node.pending || node.running || node.jimengPending || node.queued)));
        const shouldShow = shouldUseDirectGenerationLoader(node, isActive, hasMedia);
        nodeEl.classList.toggle('node-visual-loading', shouldShow);
        // The loader rendered by nodeBodyHtml sits inside .loading-cell. The
        // visual-loading state intentionally hides that placeholder layer, so
        // always keep a separate loader as a direct child of .node-body.
        const directLoader = body.querySelector(':scope > .generation-wave-loader');
        if(shouldShow && !directLoader){
            body.insertAdjacentHTML('beforeend', generationWaveLoaderHtml(true));
        }else if(!shouldShow){
            body.querySelectorAll('[data-auto-running-loader]').forEach(el => el.remove());
        }
    });
}
function hideRunTimerForNode(node){
    if(!node || node.runTimerHidden || node.pending || node.running || !node.runFinishedAt) return false;
    node.runTimerHidden = true;
    d().scheduleSave();
    return true;
}
function refreshRunTimerPills(){
    const active = d().nodes.some(n => n.type !== 'smart-prompt' && !n.runTimerHidden && (n.pending || n.running));
    document.querySelectorAll('[data-run-timer]').forEach(el => {
        const node = d().nodes.find(n => n.id === el.dataset.runTimer);
        const running = Boolean(node && (node.pending || node.running));
        if(!node || node.runTimerHidden || node.type === 'smart-prompt' || !running) {
            el.remove();
            return;
        }
        el.textContent = formatRunClock(nodeRunElapsedMs(node));
        el.classList.remove('done');
    });
    ensureRunningLoaders();
    if(active && !runTimerInterval) runTimerInterval = setInterval(refreshRunTimerPills, 1000);
    if(!active && runTimerInterval){ clearInterval(runTimerInterval); runTimerInterval = null; }
}
function render(){
    // Backdrop filters and long entrance animations are disproportionately
    // expensive once a canvas contains many independent layers. Keep the full
    // treatment for normal canvases and switch dense canvases automatically.
    document.documentElement.classList.add('canvas-performance-mode');
    const mediaStates = captureMediaPlaybackStates();
    const reusableNodes = new Map();
    d().world.querySelectorAll('.image-node').forEach(el => {
        const node = d().nodes.find(n => n.id === el.dataset.id);
        if(smartNodeHasLiveMedia(node)) reusableNodes.set(node.id, el);
    });
    const nodeHtmlEntries = d().nodes
        .slice()
        .sort((a, b) => (d().isSmartGroupNode(a) ? 0 : 1) - (d().isSmartGroupNode(b) ? 0 : 1))
        .map(node => {
        const imgs = node.images || [];
        const isSmartGroup = node.type === 'smart-group';
        const isCompactMember = d().isSmartGroupCompactMember(node);
        const isGroupImageMember = d().isSmartImageNode(node) && d().smartGroupContainingNode(node.id);
        const isImageNodeEarly = node.type === 'smart-image' || !node.type;
        const isCoCreateEarly = window.SmartCanvasCoCreate?.hasGroupedOutput?.(node);
        const isQueuedEarly = Boolean(node.queued && imgs.length === 0 && !node.pending);
        const isActivelyGeneratingEarly = Boolean(node.pending || node.running || node.jimengPending || isQueuedEarly);
        if(isImageNodeEarly && !isSmartGroup && !isCoCreateEarly && !imgs.length && !isActivelyGeneratingEarly && node.typePlaceholder !== true){
            d().ensureTypedPlaceholder?.(node);
        }
        const placeholderKind = idlePlaceholderKind(node);
        const title = isSmartGroup
            ? (node.title === '万能分组' ? '智能分组' : (node.title || '智能分组'))
            : node.type === 'smart-prompt' ? 'Prompt' : node.type === 'smart-loop' ? 'Loop' : (imgs.length > 1 ? 'Group' : imgs.length ? 'Image' : ({image:'Image', video:'Video', audio:'Audio'})[placeholderKind] || 'Image');
        const scale = d().nodeScale(node);
        const layout = d().imageLayout(imgs, scale, node);
        const isPrompt = node.type === 'smart-prompt';
        const isLoop = node.type === 'smart-loop';
        const isImageNode = node.type === 'smart-image' || !node.type;
        const isCoCreate = window.SmartCanvasCoCreate?.hasGroupedOutput?.(node);
        const isQueued = Boolean(node.queued && imgs.length === 0 && !node.pending);
        const isActivelyGenerating = Boolean(node.pending || node.running || node.jimengPending || isQueued);
        const isTypedPlaceholder = Boolean(
            isImageNode &&
            imgs.length === 0 &&
            !node.pending &&
            !node.running &&
            !node.jimengPending &&
            !isQueued &&
            !isSmartGroup &&
            (node.typePlaceholder === true || !isCoCreate)
        );
        const isHistory = d().isHistoryGroupNode(node);
        const isAudioMediaNode = imgs.length === 1 && d().isAudioMediaItem(imgs[0]);
        const isPsdMediaNode = imgs.length === 1 && d().mediaKindForItem(imgs[0]) === 'psd';
        const pendingSlots = pendingSlotCount(node);
        const isGroup = isImageNode && imgs.length > 1 && !isCoCreate && !(pendingSlots > 0);
        const isPending = pendingSlots > 0 && !isCoCreate && !isPrompt;
        const isPendingEmpty = isPending && imgs.length === 0;
        const panelKind = isPrompt ? 'text' : (isTypedPlaceholder ? placeholderKind : '');
        const panelLabel = ({text:'Text', image:'Image', video:'Video', audio:'Audio'})[panelKind] || '';
        const panelLabelIcon = ({text:'align-left', image:'image', video:'square-play', audio:'audio-lines'})[panelKind] || '';
        const body = nodeBodyHtml(node, layout);
        const deleteBtn = isActivelyGenerating ? '' : `<button class="mini-x node-delete" type="button" title="${d().escapeHtml(d().tr('smart.deleteNode'))}"><i data-lucide="trash-2"></i></button>`;
        const failHint = node.lastGenerationError ? d().escapeHtml(String(node.lastGenerationError).slice(0, 120)) : '';
        const hint = failHint || (isSmartGroup ? '双击添加 · 拖入归组 · 选中后生成' : isPendingEmpty ? d().escapeHtml(d().tr('smart.hintPending')) : isPending ? d().escapeHtml(d().tr('smart.hintPending')) : (imgs.length > 1 ? d().escapeHtml(d().tr('smart.hintMulti')) : imgs.length ? d().escapeHtml(d().tr('smart.hintSingle')) : ''));
        const isPendingBatch = isPending && (pendingSlots + imgs.length) > 1;
        const html = `<div class="image-node ${isTypedPlaceholder ? 'typed-placeholder-node' : ''} ${isAudioMediaNode ? 'audio-media-node' : ''} ${isPsdMediaNode ? 'psd-media-node' : ''} ${node.lastGenerationError ? 'node-generation-failed' : ''} ${isGroup ? 'group-node' : ''} ${isCoCreate ? 'co-create-node' : ''} ${isHistory ? 'history-group-node' : ''} ${isPrompt ? 'prompt-smart-node' : ''} ${isLoop ? 'loop-smart-node' : ''} ${isSmartGroup ? 'smart-group-node' : ''} ${isCompactMember ? 'smart-group-member-node' : ''} ${isGroupImageMember ? 'smart-group-image-member' : ''} ${d().isNodeSelected(node.id) ? 'selected' : ''} ${(d().dragState?.groupIds?.includes(node.id) || d().dragState?.id === node.id) ? 'dragging' : ''} ${node.running ? 'node-running' : ''} ${isPending ? 'node-pending' : ''} ${isPendingBatch ? 'node-pending-batch' : ''}" data-id="${d().escapeHtml(node.id)}" style="left:${node.x || 0}px;top:${node.y || 0}px;width:${layout.width}px;height:${layout.height}px">
            ${panelLabel ? `<div class="node-type-label node-type-label-${panelKind}" aria-hidden="true"><i data-lucide="${panelLabelIcon}"></i><span>${panelLabel}</span></div>` : ''}
            ${isSmartGroup ? '<div class="smart-group-frame-hit" data-smart-group-frame-hit="1" aria-hidden="true"></div>' : ''}
            <div class="node-head"><div class="node-title">${title}</div><div class="node-actions">${deleteBtn}</div></div>
            ${!isTypedPlaceholder && !isActivelyGenerating ? `<div class="floating-node-actions"><button class="mini-x node-delete" type="button" title="${d().escapeHtml(d().tr('smart.deleteNode'))}"><i data-lucide="trash-2"></i></button></div>` : ''}
            ${d().smartGroupToolbarHtml(node)}
            ${runTimePillHtml(node)}
            <div class="node-body">${body}</div>
            ${isCompactMember && (isPrompt || isLoop) ? '<div class="smart-group-member-grab" title="拖动移出分组"></div>' : ''}
            <div class="node-hint">${hint}</div>
            ${(imgs.length || node.pending || isQueued || isPrompt || isLoop) && !isPsdMediaNode ? '<div class="node-resize-handle" data-resize="1"></div>' : ''}
            <div class="node-port port-in" data-port="in" title="input"></div>
            <div class="node-port port-out" data-port="out" title="output"></div>
        </div>`;
        return {node, html};
    });
    const tpl = document.createElement('template');
    tpl.innerHTML = nodeHtmlEntries.map(entry => entry.html).join('');
    const renderedNodeEls = new Map();
    nodeHtmlEntries.forEach(entry => {
        const fresh = tpl.content.querySelector(`.image-node[data-id="${CSS.escape(entry.node.id)}"]`);
        if(fresh) renderedNodeEls.set(entry.node.id, fresh);
    });
    const keepEls = new Set();
    reusableNodes.forEach(el => keepEls.add(el));
    [...d().world.childNodes].forEach(child => {
        if(!keepEls.has(child)) child.remove();
    });
    d().world.insertAdjacentHTML('beforeend', renderConnections());
    nodeHtmlEntries.forEach(entry => {
        const fresh = renderedNodeEls.get(entry.node.id);
        if(!fresh) return;
        d().world.appendChild(fresh);
        const reusable = reusableNodes.get(entry.node.id);
        if(reusable){
            transplantSmartMediaElements(reusable, fresh);
            if(reusable !== fresh) reusable.remove();
        }
    });
    restoreMediaPlaybackStates(mediaStates);
    d().bindNodeEvents();
    bindConnectionEvents();
    d().updateComposer();
    d().renderMinimap();
    if(window.lucide){
        try { lucide.createIcons({root:d().world}); }
        catch(_e) { /* never scan the whole document — that freezes WebView2 */ }
    }
    measureSmartNodeImages();
    refreshRunTimerPills();
    d().updateCanvasEmptyHint();
    d().positionImageQuickToolbar();
    if(d().composer?.classList.contains('open')){
        const node = d().selectedNode();
        if(node) d().positionComposerForNode(node);
    }
    window.SmartCanvasPortLinkMenu?.syncPendingLine?.();
    return;
}
function measureSmartNodeImages(){
    d().world.querySelectorAll('.image-node img,.image-node video').forEach(imgEl => {
        const nodeEl = imgEl.closest('.image-node');
        const itemEl = imgEl.closest('[data-image-index]');
        const node = d().nodes.find(n => n.id === nodeEl?.dataset.id);
        const index = Number(itemEl?.dataset.imageIndex ?? 0);
        const image = node?.images?.[index];
        if(imgEl.tagName?.toLowerCase() === 'img' && image?.url) d().bindImageProxyFallback(imgEl, image);
        if(!node || !image || image.natural_w || image.natural_h) return;
        const apply = () => {
            const w = imgEl.naturalWidth || imgEl.videoWidth || 0;
            const h = imgEl.naturalHeight || imgEl.videoHeight || 0;
            if(w <= 0 || h <= 0 || image.natural_w || image.natural_h) return;
            image.natural_w = w;
            image.natural_h = h;
            d().applyThumbDisplaySizeToElement(itemEl, image, Math.max(itemEl?.clientWidth || 0, itemEl?.clientHeight || 0));
            if((node.images || []).length === 1 && !node.w && !node.h){
                const layout = d().singleImageLayout(image, node, d().mediaNodeDefaultScale(node));
                node.w = layout.width;
                node.h = layout.height;
            }
            render();
            d().scheduleSave();
        };
        const isVideo = imgEl.tagName?.toLowerCase() === 'video';
        if(!isVideo && imgEl.complete) apply();
        else imgEl.addEventListener('load', apply, {once:true});
        imgEl.addEventListener('loadedmetadata', apply, {once:true});
    });
}
function bindConnectionEvents(){
    d().world.querySelectorAll('[data-conn-index]').forEach(el => {
        if(el.classList.contains('conn-hit')){
            el.addEventListener('dblclick', e => {
                e.preventDefault(); e.stopPropagation();
                d().disconnectConnection(Number(el.dataset.connIndex));
            });
            return;
        }
        el.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            const index = Number(el.dataset.connIndex);
            d().disconnectConnection(index);
        });
    });
}
/* === D2b node body html === */
function promptNodeBodyHtml(node){
    node.llmProvider = d().resolveChatProviderId(node.llmProvider || '');
    node.llmModel = d().resolveChatModel(node.llmModel || '', node.llmProvider);
    if(node.llmEnabled && node.llmComposerUnified === true){
        const mainTextH = d().promptNodeTextHeight(node);
        const fontSize = Math.max(15, Math.min(32, Math.round(Number(node.promptFontSize) || 32)));
        return `<div class="prompt-node-card prompt-node-card-llm prompt-node-card-unified-llm">
            <div class="prompt-node-text-wrap" style="height:${mainTextH}px;flex:none;">
                <textarea class="prompt-node-text prompt-node-control" readonly data-prompt-edit-lock="1" style="height:100%;flex:none;--prompt-font-size:${fontSize}px;" placeholder="LLM 输出会显示在这里">${d().escapeHtml(node.text || '')}</textarea>
                ${node.running ? '<div class="prompt-node-generating" role="status"><span class="prompt-node-generating-spinner" aria-hidden="true"></span><span>正在生成文本...</span></div>' : ''}
                <button class="prompt-node-copy prompt-node-control" type="button" title="复制文本" aria-label="复制文本"><i data-lucide="copy"></i></button>
            </div>
            <div class="prompt-node-tools">
                <label class="prompt-node-font-size-control prompt-node-control" title="拖动调整字号">
                    <i data-lucide="type"></i>
                    <input class="prompt-node-font-range prompt-node-control" type="range" min="15" max="32" step="1" value="${fontSize}" aria-label="输出字号">
                    <output class="prompt-node-font-value">${fontSize}px</output>
                </label>
            </div>
        </div>`;
    }
    const readonly = 'readonly data-prompt-edit-lock="1"';
    const inputThumbs = d().smartNodeInputThumbsHtml(d().promptNodeInputImages(node));
    const mainTextH = d().promptNodeTextHeight(node);
    const instructionH = d().promptLlmInstructionHeight(node);
    const mainTextStyle = node.llmEnabled ? ` style="height:${mainTextH}px;flex:none;"` : '';
    const llmParams = node.llmEnabled ? `
        <div class="prompt-node-llm">
            <select class="prompt-node-control prompt-llm-provider">${d().chatProviderOptions(node.llmProvider)}</select>
            <select class="prompt-node-control prompt-llm-model">${d().chatModelOptions(node.llmModel, node.llmProvider)}</select>
            <textarea class="prompt-node-control prompt-llm-instruction" style="height:${instructionH}px;flex:none;" placeholder="${d().escapeHtml(d().tr('smart.promptLlmInstructionPlaceholder'))}">${d().escapeHtml(node.llmInstruction || '')}</textarea>
            <div class="prompt-node-llm-actions">
                <button class="prompt-node-run prompt-node-control" type="button" ${node.running ? 'disabled' : ''}><i data-lucide="${node.running ? 'loader-2' : 'play'}"></i><span>${node.running ? d().escapeHtml(d().tr('common.running')) : d().escapeHtml(d().tr('common.run'))}</span></button>
            </div>
        </div>` : '';
    return `<div class="prompt-node-card ${node.llmEnabled ? 'prompt-node-card-llm' : ''}">
        <div class="prompt-node-text-wrap"${mainTextStyle}>
            <textarea class="prompt-node-text prompt-node-control" style="height:100%;" ${readonly} placeholder="${d().escapeHtml(d().tr('smart.promptPlaceholderNode'))}">${d().escapeHtml(node.text || '')}</textarea>
            <button class="prompt-node-copy prompt-node-control" type="button" title="复制文本" aria-label="复制文本"><i data-lucide="copy"></i></button>
        </div>
        ${node.llmEnabled ? '<div class="prompt-node-split-resize" title="拖拽调整上下输入框高度"></div>' : ''}
        <div class="prompt-node-tools">
            <button class="prompt-node-pill prompt-llm-toggle ${node.llmEnabled ? 'active' : ''}" type="button"><i data-lucide="sparkles"></i><span>LLM</span></button>
        </div>
        ${node.llmEnabled ? inputThumbs : ''}
        ${llmParams}
    </div>`;
}
function loopNumberControlHtml({label, value, key, min=1, max=100, quick=[1,2,3,4,5,6,8,10]}){
    const v = Math.max(min, Math.min(max, Number(value) || min));
    return `<div class="loop-number-control">
        <button class="loop-smart-control loop-number-trigger" type="button"><span>${d().escapeHtml(label)}</span><strong>${v}</strong></button>
        <div class="loop-number-popover">
            <div class="loop-number-grid">
                ${quick.map(n => `<button type="button" class="loop-smart-control loop-number-cell ${n === v ? 'active' : ''}" data-loop-number="${d().escapeHtml(key)}" data-loop-value="${n}">${n}</button>`).join('')}
            </div>
            <label class="loop-number-custom">
                <span>${d().escapeHtml(d().tr('common.custom'))}</span>
                <input class="loop-smart-control loop-number-input" type="number" min="${min}" max="${max}" step="1" data-loop-number-input="${d().escapeHtml(key)}" value="${v}">
            </label>
        </div>
    </div>`;
}
function smartLoopTokenLabel(token){
    if(token === '[[COUNT]]' || String(token || '').toLowerCase() === '[count]') return d().tr('canvas.counterToken');
    return token;
}
function smartLoopTokenChipHtml(token){
    return `<span class="loop-smart-token-chip" contenteditable="false" data-token="${d().escapeHtml(token)}"><span>${d().escapeHtml(smartLoopTokenLabel(token))}</span><button type="button" aria-label="${d().escapeHtml(d().tr('common.delete'))}" title="${d().escapeHtml(d().tr('common.delete'))}">×</button></span>`;
}
function smartLoopVariableHtml(text){
    return String(text || '').split(/(\[\[COUNT\]\]|\[count\])/gi).map(part => {
        if(part === '[[COUNT]]' || String(part || '').toLowerCase() === '[count]') return smartLoopTokenChipHtml('[[COUNT]]');
        return d().escapeHtml(part);
    }).join('');
}
function smartLoopEditorText(editor){
    const walk = node => {
        if(node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
        if(node.nodeType !== Node.ELEMENT_NODE) return '';
        if(node.classList?.contains('loop-smart-token-chip')) return node.dataset.token || '';
        if(node.tagName === 'BR') return '\n';
        return [...node.childNodes].map(walk).join('');
    };
    return [...(editor?.childNodes || [])].map(walk).join('').replace(/\u00a0/g, ' ');
}
function insertSmartLoopToken(editor, token){
    if(!editor) return;
    editor.focus();
    const chipWrap = document.createElement('span');
    chipWrap.innerHTML = smartLoopTokenChipHtml(token);
    const chip = chipWrap.firstElementChild;
    const spacer = document.createTextNode(' ');
    const sel = window.getSelection();
    if(sel && sel.rangeCount && editor.contains(sel.anchorNode)){
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(spacer);
        range.insertNode(chip);
        range.setStartAfter(spacer);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        editor.appendChild(chip);
        editor.appendChild(spacer);
    }
}
function smartLoopBodyHtml(node){
    node.count = d().smartLoopCount(node);
    node.mode = node.mode === 'parallel' ? 'parallel' : 'serial';
    node.loopStart = Math.max(1, Number(node.loopStart) || 1);
    node.imageBatchSize = Math.max(1, Math.min(100, Number(node.imageBatchSize) || 1));
    node.showPrompt = Boolean(node.showPrompt);
    node.imageInput = Boolean(node.imageInput);
    const imageCount = d().smartLoopInputImages(node, {index:node.loopStart}).length;
    const loopThumbs = d().smartNodeInputThumbsHtml(d().smartLoopPreviewImages(node));
    const promptItems = d().smartLoopInputPromptItems(node);
    const promptFields = d().smartLoopPromptFieldValues(node);
    const visiblePromptFields = promptFields.length ? promptFields : [''];
    const promptHint = promptItems.length
        ? d().trf('smart.loopPromptHintFound', {n:promptItems.length})
        : d().tr('smart.loopPromptHintVariable');
    const currentUpstreamPrompt = d().smartLoopSelectedInputPrompt(node, {index:node.loopStart});
    const defaultPrompt = d().tr('smart.loopDefaultPrompt') || '现在生成第《计数》张卖点图片';
    const loopRunState = d().smartCascadeRunForLoop(node.id);
    const loopRunning = Boolean(loopRunState);
    const loopStopping = Boolean(loopRunState?.stopRequested);
    return `<div class="loop-smart-card ${node.imageInput ? 'has-image' : ''} ${node.showPrompt ? 'has-prompt' : ''}">
        <div class="loop-smart-row loop-smart-top">
            <div class="loop-smart-seg">
                <button type="button" class="loop-smart-control ${node.mode !== 'parallel' ? 'active' : ''}" data-loop-mode="serial">${d().escapeHtml(d().tr('canvas.loopSerial'))}</button>
                <button type="button" class="loop-smart-control ${node.mode === 'parallel' ? 'active' : ''}" data-loop-mode="parallel" title="${d().escapeHtml(d().tr('smart.loopParallelTip'))}">${d().escapeHtml(d().tr('canvas.loopParallel'))}</button>
            </div>
        </div>
        <div class="loop-smart-row">
            <button class="loop-smart-control loop-smart-toggle ${node.imageInput ? 'active' : ''}" type="button" data-loop-toggle="image"><i data-lucide="image"></i><span>${d().escapeHtml(d().tr('canvas.loopImageToggle'))}</span></button>
            <button class="loop-smart-control loop-smart-toggle ${node.showPrompt ? 'active' : ''}" type="button" data-loop-toggle="prompt"><i data-lucide="text-cursor-input"></i><span>${d().escapeHtml(d().tr('canvas.loopPromptToggle'))}</span></button>
        </div>
        ${node.imageInput ? `<div class="loop-smart-panel">
            ${loopThumbs}
            <div class="loop-smart-mini">
                ${loopNumberControlHtml({label:d().tr('canvas.loopBatchSize'), value:node.imageBatchSize, key:'imageBatchSize', max:100, quick:[1,2,3,4,5,6,8,10]})}
            </div>
            <div class="loop-smart-note">${imageCount ? d().escapeHtml(d().trf('canvas.loopImageWillOutput', {n:imageCount})) : d().escapeHtml(d().tr('canvas.loopImageEmpty'))}</div>
        </div>` : ''}
        ${node.showPrompt ? `<div class="loop-smart-panel prompt-panel">
            ${currentUpstreamPrompt ? `<div class="loop-smart-upstream">
                <div class="loop-smart-upstream-label">${d().escapeHtml(promptHint)}</div>
                <div class="loop-smart-upstream-text">${d().escapeHtml(currentUpstreamPrompt)}</div>
            </div>` : ''}
            <div class="loop-smart-prompt-list">
                ${visiblePromptFields.map((value, index) => `<div class="loop-smart-prompt-item">
                    <div class="loop-smart-prompt-index">${index + 1}</div>
                    <div class="loop-smart-control loop-smart-text" contenteditable="true" data-loop-prompt-index="${index}" data-placeholder="${d().escapeHtml(d().tr('canvas.loopVariablePlaceholder'))}">${smartLoopVariableHtml(value || (index === 0 && !promptFields.length ? defaultPrompt : ''))}</div>
                    <button class="loop-smart-control loop-smart-icon-btn" type="button" data-loop-prompt-delete="${index}" ${visiblePromptFields.length <= 1 ? 'disabled' : ''} title="${d().escapeHtml(d().tr('common.delete'))}" aria-label="${d().escapeHtml(d().tr('common.delete'))}">×</button>
                </div>`).join('')}
            </div>
            <div class="loop-smart-row loop-smart-prompt-actions">
                <button class="loop-smart-control loop-smart-token loop-smart-counter-token" type="button" data-loop-token="[[COUNT]]">${d().escapeHtml(d().tr('canvas.counterToken'))}</button>
                <span class="loop-smart-note">${d().escapeHtml(promptHint)}</span>
                <button class="loop-smart-control loop-smart-add-prompt" type="button" data-loop-prompt-add="1" title="新增" aria-label="新增"><i data-lucide="plus"></i></button>
            </div>
        </div>` : ''}
        <div class="loop-smart-footer">
            ${loopNumberControlHtml({label:d().tr('canvas.loopImageStart'), value:node.loopStart, key:'loopStart', max:9999, quick:[1,2,3,4,5,6,8,10]})}
            ${loopNumberControlHtml({label:d().tr('canvas.loopCount'), value:node.count, key:'count', max:100, quick:[1,2,3,4,5,6,8,10]})}
            <button class="loop-smart-control loop-smart-run ${loopRunning ? 'is-stop' : ''}" type="button" data-loop-run="${d().escapeHtml(node.id)}" ${loopStopping ? 'disabled' : ''}><i data-lucide="${loopRunning ? 'square' : 'workflow'}"></i><span>${d().escapeHtml(loopRunning ? d().smartCascadeStopText(loopStopping) : d().tr('smart.loopRunAll'))}</span></button>
        </div>
    </div>`;
}
function generationWaveLoaderHtml(auto = false){
    /* Full-bleed ImageGeneration-style morph (dots + masked glow). Kept class
       name generation-wave-loader for existing selectors / visual-loading. */
    return `<div class="generation-wave-loader generation-ig-loader"${auto ? ' data-auto-running-loader="1"' : ''} role="img" aria-label="生成中" aria-hidden="true"><span class="generation-ig-dots" aria-hidden="true"></span><span class="generation-ig-glow" aria-hidden="true"></span></div>`;
}

function pendingBatchStyleVars(node){
    const aspect = Number(node?._pendingCellAspect);
    const cellW = Number(node?._pendingCellW);
    const cellH = Number(node?._pendingCellH);
    const vars = [];
    if(Number.isFinite(aspect) && aspect > 0) vars.push(`--pending-aspect:${aspect}`);
    if(Number.isFinite(cellW) && cellW > 0) vars.push(`--pending-cell-w:${Math.round(cellW)}px`);
    if(Number.isFinite(cellH) && cellH > 0) vars.push(`--pending-cell-h:${Math.round(cellH)}px`);
    return vars.length ? vars.join(';') : '';
}
function pendingSlotFooterHtml(taskId, slotIndex, pendingIndex){
    const safeId = taskId ? d().escapeAttr(taskId) : '';
    const taskIdx = Number.isFinite(Number(pendingIndex)) ? Number(pendingIndex) : slotIndex;
    return `<div class="pending-slot-footer"><span class="pending-slot-status" aria-hidden="true">生成中...</span><button class="pending-slot-cancel" type="button" data-pending-slot-cancel data-pending-slot="${slotIndex}" data-pending-task-index="${taskIdx}" data-pending-task-id="${safeId}" aria-label="取消当前生成任务" title="取消当前生成任务">取消</button></div>`;
}
function pendingSlotInnerHtml(node){
    const style = pendingBatchStyleVars(node);
    const coCreateClass = node?.coCreateBatchId ? ' co-create-pending-inner' : '';
    return `<div class="pending-slot-inner${coCreateClass}"${style ? ` style="${style}"` : ''}>${generationWaveLoaderHtml()}</div>`;
}
function pendingSlotCellHtml(node, task, slotIndex, pendingIndex){
    const taskId = task?.taskId || '';
    const style = pendingBatchStyleVars(node);
    return `<div class="loading-cell pending-slot${taskId ? '' : ' pending-slot-waiting'}" data-pending-slot="${slotIndex}"${taskId ? ` data-pending-task-id="${d().escapeAttr(taskId)}"` : ''}${style ? ` style="${style}"` : ''}>
        ${pendingSlotInnerHtml(node)}
        ${pendingSlotFooterHtml(taskId, slotIndex, pendingIndex)}
    </div>`;
}
function pendingGridMeta(totalCount){
    const count = Math.max(1, Number(totalCount) || 1);
    const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(count))));
    const rows = Math.ceil(count / cols);
    return {count, cols, rows};
}
function pendingLoadingBodyHtml(node, layout){
    const tasks = d().smartPendingTasks?.(node) || [];
    const count = Math.max(1, pendingSlotCount(node));
    const gridStyle = pendingBatchStyleVars(node);
    if(count <= 1){
        const taskId = tasks[0]?.taskId || '';
        const innerStyle = pendingBatchStyleVars(node);
        return `<div class="loading-cell single pending-slot${node.running ? ' running' : ''}" style="width:${layout.width}px;height:${layout.height}px${gridStyle ? `;${gridStyle}` : ''}" data-pending-slot="0"${taskId ? ` data-pending-task-id="${d().escapeAttr(taskId)}"` : ''}>${pendingSlotInnerHtml(node)}${pendingSlotFooterHtml(taskId, 0, 0)}</div>`;
    }
    const {cols, rows} = pendingGridMeta(count);
    const slotTasks = tasks.length ? tasks : Array.from({length: count}, () => null);
    const cells = Array.from({length: count}, (_, index) => pendingSlotCellHtml(node, slotTasks[index] || null, index, index)).join('');
    return `<div class="loading-skeleton pending-batch-grid" style="width:${layout.width}px;height:${layout.height}px;${gridStyle};grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${rows}, minmax(0, 1fr))">${cells}</div>`;
}
function pendingMixedDoneCellHtml(node, img, index){
    const display = d().imageForDisplay(img);
    const selected = d().selectedImage.nodeId === node.id && d().selectedImage.index === index;
    const style = pendingBatchStyleVars(node);
    return `<div class="pending-mixed-cell pending-mixed-done"${style ? ` style="${style}"` : ''}>
        <div class="pending-mixed-media thumb-item ${selected ? 'image-selected' : ''}" data-image-index="${index}" data-media-signature="${d().escapeAttr(`${d().mediaKindForItem(display)}:${display?.url || ''}`)}">${d().thumbMediaHtml(display)}${d().imageResolutionBadgeHtml(display)}<button class="mini-x image-delete" type="button" data-image-index="${index}" title="${d().escapeHtml(d().tr('smart.deleteImage'))}"><i data-lucide="trash-2"></i></button></div>
        <div class="pending-mixed-footer" aria-hidden="true"></div>
    </div>`;
}
function pendingMixedLoadingCellHtml(node, task, slotIndex, pendingIndex){
    const taskId = task?.taskId || '';
    const style = pendingBatchStyleVars(node);
    return `<div class="pending-mixed-cell pending-mixed-loading"${taskId ? ` data-pending-task-id="${d().escapeAttr(taskId)}"` : ''} data-pending-slot="${slotIndex}"${style ? ` style="${style}"` : ''}>
        ${pendingSlotInnerHtml(node)}
        <div class="pending-mixed-footer">${pendingSlotFooterHtml(taskId, slotIndex, pendingIndex)}</div>
    </div>`;
}
function typedPlaceholderBodyHtml(kind){
    const safeKind = ['image', 'video', 'audio'].includes(kind) ? kind : 'image';
    const label = ({image:'图片', video:'视频', audio:'音频'})[safeKind];
    const cutout = {
        image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
        video:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 8 6 4-6 4Z"/>',
        audio:'<path d="M3 10v4M6 8v8M9 5v14M12 3v18M15 5v14M18 8v8M21 10v4"/>'
    }[safeKind];
    return `<div class="node-type-placeholder node-type-placeholder-${safeKind}" role="img" aria-label="${label}">
        <svg class="node-type-placeholder-cutout" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${cutout}
        </svg>
    </div>`;
}

function idlePlaceholderKind(node){
    return d().typedPlaceholderKind?.(node) || node?.portLinkKind || node?.outputKind || 'image';
}
function pendingMixedBodyHtml(node, layout, imgs){
    const tasks = d().smartPendingTasks?.(node) || [];
    const pendingCount = Math.max(Number(node?.pending) || 0, tasks.length);
    const total = imgs.length + pendingCount;
    const {cols, rows} = pendingGridMeta(total);
    const imageCells = imgs.map((img, index) => pendingMixedDoneCellHtml(node, img, index)).join('');
    const pendingCells = (tasks.length ? tasks : Array.from({length: pendingCount}, () => null))
        .map((task, index) => pendingMixedLoadingCellHtml(node, task, imgs.length + index, index))
        .join('');
    const gridStyle = pendingBatchStyleVars(node);
    return `<div class="loading-skeleton pending-mixed-grid" style="width:${layout.width}px;height:${layout.height}px;${gridStyle};grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${rows}, minmax(0, 1fr))">${imageCells}${pendingCells}</div>`;
}

function nodeBodyHtml(node, layout){
    if(node.type === 'smart-group') return d().smartGroupBodyHtml(node);
    if(node.type === 'smart-loop') return smartLoopBodyHtml(node);
    if(window.SmartCanvasCoCreate?.hasGroupedOutput?.(node)){
        const coCreateBody = window.SmartCanvasCoCreate.renderNodeBody(node, layout);
        if(coCreateBody) return coCreateBody;
    }
    if(node.type === 'smart-prompt') return promptNodeBodyHtml(node);
    const imgs = (node.images || []).map(imageForDisplay);
    const pendingSlots = pendingSlotCount(node);
    if(pendingSlots > 0 && imgs.length === 0){
        return pendingLoadingBodyHtml(node, layout);
    }
    if(pendingSlots > 0 && imgs.length > 0){
        return pendingMixedBodyHtml(node, layout, imgs);
    }
    if((node.running || node.jimengPending) && imgs.length === 0){
        return pendingLoadingBodyHtml(node, layout);
    }
    if(node.queued && imgs.length === 0){
        return pendingLoadingBodyHtml(node, layout);
    }
    if(node.typePlaceholder === true && imgs.length === 0 && ['image', 'video', 'audio'].includes(node.portLinkKind)){
        return typedPlaceholderBodyHtml(node.portLinkKind);
    }
    if(imgs.length > 1) return `<div class="thumb-grid" style="--thumb-cols:${layout.cols}; --thumb-size:${layout.thumb}px">${imgs.map((img, i) => `<div class="thumb-item ${d().selectedImage.nodeId === node.id && d().selectedImage.index === i ? 'image-selected' : ''}" data-image-index="${i}" data-media-signature="${d().escapeAttr(`${d().mediaKindForItem(img)}:${img?.url || ''}`)}">${d().thumbMediaHtml(img)}${d().imageResolutionBadgeHtml(img)}<button class="mini-x image-delete" type="button" data-image-index="${i}" title="${d().escapeHtml(d().tr('smart.deleteImage'))}"><i data-lucide="trash-2"></i></button></div>`).join('')}</div>`;
    if(imgs[0]) return `<div class="image-wrap ${d().selectedImage.nodeId === node.id && d().selectedImage.index === 0 ? 'image-selected' : ''}" data-image-index="0" data-media-signature="${d().escapeAttr(`${d().mediaKindForItem(imgs[0])}:${imgs[0]?.url || ''}`)}" style="--node-img-w:${layout.width}px;--node-img-h:${layout.height}px">${d().singleMediaHtml(imgs[0], layout.width, layout.height)}${d().imageResolutionBadgeHtml(imgs[0])}<button class="mini-x image-delete" type="button" data-image-index="0" title="${d().escapeHtml(d().tr('smart.deleteImage'))}"><i data-lucide="trash-2"></i></button></div>`;
    return typedPlaceholderBodyHtml(idlePlaceholderKind(node));
}
    const api = Object.freeze({
        registerDeps,
        render, promptNodeBodyHtml, smartLoopBodyHtml, nodeBodyHtml,
        loopNumberControlHtml, smartLoopTokenLabel, smartLoopTokenChipHtml, smartLoopVariableHtml, smartLoopEditorText, insertSmartLoopToken,
        renderConnections, refreshConnectionLayer, moveNodeElementsDuringDrag, updateNodeElementDuringResize, measureSmartNodeImages, bindConnectionEvents, refreshRunTimerPills, hideRunTimerForNode,
        smartNodeHasLiveMedia, mediaSignaturePartFromElement, captureMediaPlaybackState, restoreMediaPlaybackState, transplantSmartMediaElements, captureMediaPlaybackStates, restoreMediaPlaybackStates, formatRunDuration, formatRunClock, nodeRunElapsedMs, runTimePillHtml, shouldUseDirectGenerationLoader
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('nodesRender', api);
    }

    global.SmartCanvasNodesRender = api;
})(window);
