/**
 * Smart Canvas — node DOM event handlers (click/drag/port/prompt-loop controls).
 * @see docs/refactor/BATCH_RUNBOOK.md D4
 */
(function(global){
    'use strict';

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || global.SmartCanvasCore?.tryDeps?.() || null;
    }

let nodeContextMenu = null;
let nodeContextTarget = null;
let canvasContextMenu = null;

function closeNodeContextMenu(){
    if(nodeContextMenu) nodeContextMenu.hidden = true;
    nodeContextTarget = null;
}

function closeCanvasContextMenu(){
    if(canvasContextMenu) canvasContextMenu.hidden = true;
}

function arrangeAllCanvasNodes(){
    const ctx = d();
    const ids = (ctx.nodes || [])
        .filter(node => !ctx.smartGroupContainingNode?.(node.id))
        .map(node => node.id);
    if(ids.length < 2){
        ctx.toast?.('当前画布没有足够节点可整理');
        return false;
    }
    const previous = {
        selectedId:ctx.selectedId,
        selectedIds:[...(ctx.selectedIds || [])],
        selectedImage:{...(ctx.selectedImage || {nodeId:'', index:-1})}
    };
    ctx.selectedId = '';
    ctx.selectedIds = ids;
    ctx.selectedImage = {nodeId:'', index:-1};
    const arranged = ctx.arrangeSelectedNodes?.();
    ctx.selectedId = previous.selectedId;
    ctx.selectedIds = previous.selectedIds;
    ctx.selectedImage = previous.selectedImage;
    if(arranged){
        ctx.render?.();
        ctx.syncSelectionUi?.();
    }
    return Boolean(arranged);
}

function openPersonalSettings(){
    const target = global.parent !== global ? global.parent : global;
    if(typeof target.openShellSettings === 'function'){
        target.openShellSettings('account');
        return;
    }
    target.postMessage({type:'canvas-open-settings', section:'account'}, global.location.origin);
}

function ensureCanvasContextMenu(){
    if(canvasContextMenu) return canvasContextMenu;
    canvasContextMenu = document.createElement('div');
    canvasContextMenu.className = 'ui-menu node-context-menu canvas-context-menu';
    canvasContextMenu.hidden = true;
    canvasContextMenu.setAttribute('role', 'menu');
    canvasContextMenu.innerHTML = `
        <button class="ui-menu-item" type="button" role="menuitem" data-canvas-context-action="new-canvas"><i data-lucide="file-plus-2"></i><span>新建画布</span></button>
        <button class="ui-menu-item" type="button" role="menuitem" data-canvas-context-action="arrange-all"><i data-lucide="layout-dashboard"></i><span>整理全局</span></button>
        <button class="ui-menu-item" type="button" role="menuitem" data-canvas-context-action="refresh"><i data-lucide="refresh-cw"></i><span>刷新</span></button>
        <button class="ui-menu-item" type="button" role="menuitem" data-canvas-context-action="reset-view"><i data-lucide="scan"></i><span>视角重置</span></button>
        <button class="ui-menu-item" type="button" role="menuitem" data-canvas-context-action="paste"><i data-lucide="clipboard-paste"></i><span>黏贴</span></button>
        <button class="ui-menu-item" type="button" role="menuitem" data-canvas-context-action="undo"><i data-lucide="undo-2"></i><span>撤销</span></button>
        <button class="ui-menu-item" type="button" role="menuitem" data-canvas-context-action="assets"><i data-lucide="folder-open"></i><span>打开资产库</span></button>
        <button class="ui-menu-item" type="button" role="menuitem" data-canvas-context-action="settings"><i data-lucide="settings"></i><span>个人设置</span></button>`;
    canvasContextMenu.addEventListener('click', async event => {
        const button = event.target.closest('[data-canvas-context-action]');
        if(!button) return;
        event.preventDefault();
        event.stopPropagation();
        const action = button.dataset.canvasContextAction;
        closeCanvasContextMenu();
        if(action === 'new-canvas') await d().createNewSmartCanvas?.();
        if(action === 'arrange-all') arrangeAllCanvasNodes();
        if(action === 'refresh'){
            await global.SmartCanvasPersistence?.saveCanvas?.();
            global.location.reload();
        }
        if(action === 'reset-view') global.SmartCanvasViewport?.fitAllNodesViewport?.();
        if(action === 'paste') d().pasteNodes?.();
        if(action === 'undo') d().performUndo?.();
        if(action === 'assets') d().toggleAssetLibrary?.(true);
        if(action === 'settings') openPersonalSettings();
    });
    document.body.appendChild(canvasContextMenu);
    d().refreshIcons?.();
    document.addEventListener('pointerdown', event => {
        if(!canvasContextMenu?.contains(event.target)) closeCanvasContextMenu();
    }, true);
    document.addEventListener('keydown', event => {
        if(event.key === 'Escape') closeCanvasContextMenu();
    });
    global.addEventListener('blur', closeCanvasContextMenu);
    global.addEventListener('resize', closeCanvasContextMenu);
    return canvasContextMenu;
}

function ensureNodeContextMenu(){
    if(nodeContextMenu) return nodeContextMenu;
    nodeContextMenu = document.createElement('div');
    nodeContextMenu.className = 'ui-menu node-context-menu';
    nodeContextMenu.hidden = true;
    nodeContextMenu.setAttribute('role', 'menu');
    nodeContextMenu.innerHTML = `
        <button class="ui-menu-item" type="button" role="menuitem" data-node-context-action="download"><i data-lucide="save"></i><span>另存为...</span></button>
        <button class="ui-menu-item" type="button" role="menuitem" data-node-context-action="add-to-chat"><i data-lucide="message-square-plus"></i><span>添加到对话</span></button>
        <button class="ui-menu-item" type="button" role="menuitem" data-node-context-action="copy"><i data-lucide="copy"></i><span data-node-context-label="copy">复制图片</span></button>
        <button class="ui-menu-item is-danger" type="button" role="menuitem" data-node-context-action="delete"><i data-lucide="trash-2"></i><span>删除</span></button>`;
    nodeContextMenu.addEventListener('click', async event => {
        const button = event.target.closest('[data-node-context-action]');
        const target = nodeContextTarget;
        if(!button || !target) return;
        event.preventDefault();
        event.stopPropagation();
        closeNodeContextMenu();
        if(button.dataset.nodeContextAction === 'add-to-chat'){
            const node = d().nodes.find(item => item.id === target.nodeId);
            const media = node?.images?.[target.imageIndex];
            const url = String(media?.url || '').trim();
            if(!url){
                d().toast?.('当前素材无法添加到对话');
                return;
            }
            const attachment = {
                kind:target.kind,
                url,
                name:String(media?.name || node?.title || `${target.kind}-${target.imageIndex + 1}`)
            };
            const mimeType = media?.mime_type || media?.mimeType || '';
            if(mimeType) attachment.mime_type = mimeType;
            const messageTarget = global.parent !== global ? global.parent : global;
            if(typeof messageTarget.addCanvasAttachmentsToDock === 'function'){
                messageTarget.addCanvasAttachmentsToDock([attachment]);
            } else {
                messageTarget.postMessage({type:'canvas-add-to-chat', attachments:[attachment]}, global.location.origin);
            }
            d().toast?.('已添加到对话附件');
            return;
        }
        if(button.dataset.nodeContextAction === 'copy'){
            d().copySelectedNodes?.([target.nodeId]);
            return;
        }
        if(button.dataset.nodeContextAction === 'delete'){
            d().deleteImage?.(target.nodeId, target.imageIndex);
            return;
        }
        const node = d().nodes.find(item => item.id === target.nodeId);
        const media = (node?.images || []).filter(item => item?.url);
        if(target.imageIndex >= 0 && node?.images?.[target.imageIndex]?.url){
            await d().saveNodeImageAs?.(target.nodeId, target.imageIndex);
        } else if(media.length === 1){
            await d().saveNodeImageAs?.(target.nodeId, node.images.indexOf(media[0]));
        } else if(media.length > 1){
            await d().zipSaveImageItemsAs?.(node?.title || 'canvas-selection', media);
        } else {
            d().toast?.('该对象没有可另存为的内容');
        }
    });
    document.body.appendChild(nodeContextMenu);
    d().refreshIcons?.();
    document.addEventListener('pointerdown', event => {
        if(!nodeContextMenu?.contains(event.target)) closeNodeContextMenu();
    }, true);
    document.addEventListener('keydown', event => {
        if(event.key === 'Escape') closeNodeContextMenu();
    });
    global.addEventListener('blur', closeNodeContextMenu);
    global.addEventListener('resize', closeNodeContextMenu);
    return nodeContextMenu;
}

function openNodeContextMenu(event, nodeId){
    const node = d().nodes.find(item => item.id === nodeId);
    if(!node) return;
    const mediaItem = event.target.closest('.thumb-item,.image-wrap,.smart-group-single-thumb');
    const targetNodeId = mediaItem?.dataset?.refNodeId || nodeId;
    const imageIndex = mediaItem
        ? Number(mediaItem.dataset.refImageIndex ?? mediaItem.dataset.imageIndex ?? 0)
        : -1;
    const targetNode = d().nodes.find(item => item.id === targetNodeId);
    const media = imageIndex >= 0 ? targetNode?.images?.[imageIndex] : null;
    const kind = d().mediaKindForItem?.(media || {});
    const kindLabel = {image:'图片', video:'视频', audio:'音频'}[kind];
    event.preventDefault();
    event.stopPropagation();
    if(!media?.url || !kindLabel){
        closeNodeContextMenu();
        return;
    }
    d().selectedId = nodeId;
    d().selectedIds = [];
    d().selectedImage = imageIndex >= 0 ? {nodeId:targetNodeId, index:imageIndex} : {nodeId:'', index:-1};
    d().hideSelectionGroupBox?.();
    d().focusCanvasForShortcuts?.();
    d().syncSelectionUi?.();
    global.SmartCanvasImageEdit?.hideImageQuickToolbar?.();
    nodeContextTarget = {nodeId:targetNodeId, imageIndex, kind};
    const menu = ensureNodeContextMenu();
    menu.querySelector('[data-node-context-label="copy"]').textContent = `复制${kindLabel}`;
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(event.clientX, global.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(event.clientY, global.innerHeight - rect.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function openCanvasContextMenu(event){
    event.preventDefault();
    event.stopPropagation();
    closeNodeContextMenu();
    d().lastMouseWorld = d().screenToWorld?.(event) || d().lastMouseWorld;
    const menu = ensureCanvasContextMenu();
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(event.clientX, global.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(event.clientY, global.innerHeight - rect.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function bindNodeContextMenuDelegation(){
    const ctx = d();
    if(!ctx) return;
    const world = ctx.world;
    const host = document.getElementById('shell') || world;
    if(!world || !host || host.dataset.nodeContextMenuBound === '1') return;
    host.dataset.nodeContextMenuBound = '1';
    host.addEventListener('contextmenu', event => {
        const nodeEl = event.target.closest?.('.image-node');
        if(nodeEl?.dataset?.id){
            closeCanvasContextMenu();
            openNodeContextMenu(event, nodeEl.dataset.id);
            return;
        }
        if(event.target.closest?.('.conn-hit,.conn-cut,.node-port,.selection-box,.selection-box-capsule,.selection-capsule-bar,.port-link-pick-menu')) return;
        if(event.target !== host && !world.contains(event.target)) return;
        openCanvasContextMenu(event);
    }, true);
}

function ensurePortDragPathElement(){
    const svg = d().world.querySelector('svg.connection-layer');
    if(!svg) return null;
    let path = svg.querySelector('path.port-drag-temp');
    if(!path){
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'port-drag-temp conn-pending');
        path.setAttribute('stroke', 'rgba(135,145,158,0.62)');
        path.setAttribute('stroke-width', '1.15');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(path);
    }
    return path;
}
function clearPortDragVisual(){
    d().world.querySelector('path.port-drag-temp')?.remove();
    d().world.querySelectorAll('.node-port.is-active').forEach(el => el.classList.remove('is-active'));
    d().world.querySelectorAll('.image-node.port-hover').forEach(el => el.classList.remove('port-hover'));
}
async function copyPromptNodeText(value){
    const text = String(value || '');
    if(!text) return false;
    try {
        if(navigator.clipboard?.writeText){
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch(_) {}
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        return copied;
    } catch(_) {
        return false;
    }
}
function bindPromptNodeControls(el, node){
    const selectPromptNode = (focusCanvas=false) => {
        d().hideRunTimerForNode?.(node);
        d().selectedId = node.id;
        d().selectedIds = [];
        d().selectedImage = {nodeId:'', index:-1};
        d().hideSelectionGroupBox?.();
        if(d().smartCascadeAnyRunning?.()) d().smartCascadeSilentSelection = false;
        d().syncSelectionUi?.();
        d().updateComposer?.();
        if(focusCanvas) d().focusCanvasForShortcuts?.();
    };
    el.querySelectorAll('.prompt-node-control:not(.prompt-node-text), .prompt-node-pill').forEach(control => {
        control.addEventListener('mousedown', e => e.stopPropagation());
        control.addEventListener('click', e => {
            e.stopPropagation();
            selectPromptNode(false);
        });
        control.addEventListener('dblclick', e => e.stopPropagation());
    });
    const textEl = el.querySelector('.prompt-node-text');
    if(textEl) {
        bindScrollableText(textEl);
        el.classList.remove('prompt-text-editing');
        textEl.readOnly = true;
        textEl.setAttribute('aria-readonly', 'true');
        textEl.addEventListener('mousedown', e => {
            if(textEl.readOnly){
                e.preventDefault();
                return;
            }
            e.stopPropagation();
        });
        textEl.addEventListener('click', e => {
            if(textEl.readOnly) e.preventDefault();
            e.stopPropagation();
            selectPromptNode(textEl.readOnly);
        });
        textEl.addEventListener('dblclick', e => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            selectPromptNode(false);
        });
    }
    const copyEl = el.querySelector('.prompt-node-copy');
    if(copyEl) copyEl.onclick = async e => {
        e.preventDefault();
        e.stopPropagation();
        const copied = await copyPromptNodeText(textEl?.value ?? node.text ?? '');
        if(!copied){
            if(textEl?.value || node.text) d().toast?.('复制失败');
            return;
        }
        copyEl.classList.add('copied');
        copyEl.title = '已复制';
        copyEl.setAttribute('aria-label', '已复制');
        d().toast?.('文本已复制');
        clearTimeout(copyEl.copyFeedbackTimer);
        copyEl.copyFeedbackTimer = setTimeout(() => {
            copyEl.classList.remove('copied');
            copyEl.title = '复制文本';
            copyEl.setAttribute('aria-label', '复制文本');
        }, 1400);
    };
    const fontRange = el.querySelector('.prompt-node-font-range');
    const applyPromptFontSize = rawValue => {
        const value = Math.max(15, Math.min(32, Math.round(Number(rawValue) || 32)));
        node.promptFontSize = value;
        if(fontRange) fontRange.value = String(value);
        if(textEl) textEl.style.setProperty('--prompt-font-size', `${value}px`);
        const valueEl = el.querySelector('.prompt-node-font-value');
        if(valueEl) valueEl.textContent = `${value}px`;
    };
    if(fontRange) fontRange.oninput = e => {
        e.stopPropagation();
        applyPromptFontSize(e.target.value);
    };
    if(fontRange) fontRange.onchange = () => d().scheduleSave();
    if(fontRange) {
        let fontRangeDragging = false;
        const updateFontRangeFromPointer = event => {
            const rect = fontRange.getBoundingClientRect();
            if(!rect.width) return;
            const min = Number(fontRange.min) || 15;
            const max = Number(fontRange.max) || 32;
            const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            applyPromptFontSize(min + (max - min) * ratio);
        };
        fontRange.onpointerdown = event => {
            if(event.button !== 0 && event.pointerType !== 'touch') return;
            event.preventDefault();
            event.stopPropagation();
            fontRangeDragging = true;
            fontRange.focus({preventScroll:true});
            fontRange.setPointerCapture?.(event.pointerId);
            updateFontRangeFromPointer(event);
        };
        fontRange.onpointermove = event => {
            if(!fontRangeDragging) return;
            event.preventDefault();
            event.stopPropagation();
            updateFontRangeFromPointer(event);
        };
        const finishFontRangeDrag = event => {
            if(!fontRangeDragging) return;
            event.preventDefault();
            event.stopPropagation();
            fontRangeDragging = false;
            if(fontRange.hasPointerCapture?.(event.pointerId)){
                fontRange.releasePointerCapture?.(event.pointerId);
            }
            d().scheduleSave();
        };
        fontRange.onpointerup = finishFontRangeDrag;
        fontRange.onpointercancel = finishFontRangeDrag;
    }
    const presetEdit = el.querySelector('.prompt-preset-edit');
    if(presetEdit) presetEdit.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        d().editPromptPresetForNode(node);
    };
    const toggle = el.querySelector('.prompt-llm-toggle');
    if(toggle) toggle.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        node.llmEnabled = !node.llmEnabled;
        if(node.llmEnabled){
            node.llmProvider = d().resolveChatProviderId(node.llmProvider || '');
            node.llmModel = d().resolveChatModel(node.llmModel || '', node.llmProvider);
            node.promptMaximized = false;
            node.w = Math.max(Number(node.w) || 0, PROMPT_NODE_DEFAULT_WIDTH);
            node.h = d().promptNodeContentHeight(node);
        } else {
            node.promptMaximized = false;
            node.h = PROMPT_NODE_DEFAULT_HEIGHT;
            node.w = Math.max(Number(node.w) || 0, PROMPT_NODE_DEFAULT_WIDTH);
        }
        d().render();
        d().scheduleSave();
    };
    const providerEl = el.querySelector('.prompt-llm-provider');
    if(providerEl) providerEl.onchange = e => {
        e.stopPropagation();
        node.llmProvider = d().resolveChatProviderId(e.target.value);
        node.llmModel = d().resolveChatModel('', node.llmProvider);
        d().render();
        d().scheduleSave();
    };
    const modelEl = el.querySelector('.prompt-llm-model');
    if(modelEl) modelEl.onchange = e => { e.stopPropagation(); node.llmModel = e.target.value; d().scheduleSave(); };
    const instructionEl = el.querySelector('.prompt-llm-instruction');
    if(instructionEl) { bindScrollableText(instructionEl); instructionEl.oninput = e => { node.llmInstruction = e.target.value; d().scheduleSave(); }; }
    const runEl = el.querySelector('.prompt-node-run');
    if(runEl) runEl.onclick = e => { e.preventDefault(); e.stopPropagation(); d().runPromptLLMNode(node.id); };
    const splitResize = el.querySelector('.prompt-node-split-resize');
    if(splitResize){
        splitResize.addEventListener('mousedown', e => {
            if(e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            promptSplitResizeState = {
                nodeId:node.id,
                startY:e.clientY,
                startMainH:d().promptNodeTextHeight(node),
                startInstructionH:d().promptLlmInstructionHeight(node)
            };
            document.body.classList.add('prompt-split-resize');
            document.body.classList.add('smart-node-resize');
            d().capturePendingUndo();
        });
        splitResize.addEventListener('dblclick', e => e.stopPropagation());
    }
}
function bindLoopNodeControls(el, node){
    el.querySelectorAll('.loop-smart-control').forEach(control => {
        control.addEventListener('mousedown', e => e.stopPropagation());
        control.addEventListener('click', e => e.stopPropagation());
        control.addEventListener('dblclick', e => e.stopPropagation());
    });
    const loopNumberBounds = key => {
        if(key === 'loopStart') return {min:1, max:9999};
        if(key === 'imageBatchSize') return {min:1, max:100};
        return {min:1, max:100};
    };
    const normalizeLoopNumber = (key, rawValue) => {
        const bounds = loopNumberBounds(key);
        return Math.max(bounds.min, Math.min(bounds.max, Number(rawValue) || bounds.min));
    };
    const syncLoopNumberUi = (source, key, value) => {
        const control = source?.closest?.('.loop-number-control');
        if(!control) return;
        const display = control.querySelector('.loop-number-trigger strong');
        if(display) display.textContent = value;
        control.querySelectorAll('[data-loop-value]').forEach(cell => {
            cell.classList.toggle('active', Number(cell.dataset.loopValue) === value);
        });
    };
    const setLoopNumber = (key, rawValue, rerender=true, source=null) => {
        const value = normalizeLoopNumber(key, rawValue);
        if(key === 'count') node.count = d().smartLoopCount({count:value});
        if(key === 'loopStart') node.loopStart = value;
        if(key === 'imageBatchSize') node.imageBatchSize = value;
        d().scheduleSave();
        if(rerender) d().render();
        else syncLoopNumberUi(source, key, value);
    };
    el.querySelectorAll('[data-loop-number]').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            setLoopNumber(btn.dataset.loopNumber, btn.dataset.loopValue, true);
        };
    });
    el.querySelectorAll('[data-loop-number-input]').forEach(input => {
        input.oninput = e => {
            e.stopPropagation();
            setLoopNumber(input.dataset.loopNumberInput, input.value, false, input);
        };
        input.onchange = e => {
            e.stopPropagation();
            setLoopNumber(input.dataset.loopNumberInput, input.value, true);
        };
    });
    el.querySelectorAll('[data-loop-mode]').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            node.mode = btn.dataset.loopMode === 'parallel' ? 'parallel' : 'serial';
            d().render();
            d().scheduleSave();
        };
    });
    el.querySelectorAll('[data-loop-toggle]').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            if(btn.dataset.loopToggle === 'image') node.imageInput = !node.imageInput;
            if(btn.dataset.loopToggle === 'prompt') {
                node.showPrompt = !node.showPrompt;
                if(node.showPrompt && !d().smartLoopActivePromptFieldValues(node).length) d().setSmartLoopPromptFieldValues(node, [d().tr('smart.loopDefaultPrompt') || '现在生成第《计数》张卖点图片']);
            }
            d().fitSmartLoopNode(node);
            d().render();
            d().scheduleSave();
        };
    });
    const syncPromptFieldsFromDom = () => {
        const values = [...el.querySelectorAll('[data-loop-prompt-index]')]
            .sort((a, b) => Number(a.dataset.loopPromptIndex) - Number(b.dataset.loopPromptIndex))
            .map(input => d().smartLoopEditorText(input));
        d().setSmartLoopPromptFieldValues(node, values);
    };
    let activePromptEditor = null;
    el.querySelectorAll('.loop-smart-text').forEach(text => {
        bindScrollableText(text);
        text.onfocus = () => { activePromptEditor = text; };
        text.oninput = () => { syncPromptFieldsFromDom(); d().scheduleSave(); };
        text.addEventListener('click', e => {
            const remove = e.target.closest?.('.loop-smart-token-chip button');
            if(!remove) return;
            e.preventDefault();
            e.stopPropagation();
            remove.closest('.loop-smart-token-chip')?.remove();
            syncPromptFieldsFromDom();
            d().scheduleSave();
        });
    });
    el.querySelectorAll('[data-loop-prompt-add]').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            syncPromptFieldsFromDom();
            const values = d().smartLoopPromptFieldValues(node);
            d().setSmartLoopPromptFieldValues(node, [...values, '']);
            d().fitSmartLoopNode(node);
            d().render();
            d().scheduleSave();
        };
    });
    el.querySelectorAll('[data-loop-prompt-delete]').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            syncPromptFieldsFromDom();
            const removeIndex = Number(btn.dataset.loopPromptDelete);
            const values = d().smartLoopPromptFieldValues(node);
            if(values.length <= 1) return;
            values.splice(removeIndex, 1);
            d().setSmartLoopPromptFieldValues(node, values);
            d().fitSmartLoopNode(node);
            d().render();
            d().scheduleSave();
        };
    });
    const firstText = el.querySelector('.loop-smart-text');
    const targetPromptEditor = () => activePromptEditor && el.contains(activePromptEditor) ? activePromptEditor : firstText;
    el.querySelectorAll('[data-loop-token]').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            const text = targetPromptEditor();
            if(!text) return;
            const token = btn.dataset.loopToken || '[[COUNT]]';
            d().insertSmartLoopToken(text, token);
            syncPromptFieldsFromDom();
            d().scheduleSave();
        };
    });
    el.querySelectorAll('[data-loop-run]').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            const loopId = btn.dataset.loopRun || node.id;
            if(d().smartCascadeIsLoopRunning(loopId)){
                d().requestSmartCascadeStop(loopId);
                return;
            }
            d().runSmartCascadeFromLoop(loopId);
        };
    });
}
function bindScrollableText(el){
    if(!el || el.dataset.scrollBound === '1') return;
    el.dataset.scrollBound = '1';
    const stop = e => e.stopPropagation();
    const isLockedPromptText = () => el.classList.contains('prompt-node-text') && el.readOnly;
    const beginSelection = e => {
        if(isLockedPromptText()) return;
        e.stopPropagation();
        d().textSelectionGuard = {
            el,
            scrollTop:el.scrollTop || 0,
            scrollLeft:el.scrollLeft || 0,
            clientY:e.clientY,
            wheelUntil:0,
            active:true
        };
    };
    el.addEventListener('mousedown', beginSelection);
    el.addEventListener('mousemove', e => {
        if(isLockedPromptText()) return;
        e.stopPropagation();
        if(d().textSelectionGuard?.el === el) d().textSelectionGuard.clientY = e.clientY;
    });
    el.addEventListener('mouseup', e => {
        if(isLockedPromptText()) return;
        e.stopPropagation();
        if(d().textSelectionGuard?.el === el) d().textSelectionGuard.active = false;
    });
    el.addEventListener('mouseleave', e => {
        if(isLockedPromptText()) return;
        e.stopPropagation();
        if(d().textSelectionGuard?.el === el) {
            el.scrollTop = d().textSelectionGuard.scrollTop;
            el.scrollLeft = d().textSelectionGuard.scrollLeft;
        }
    });
    el.addEventListener('scroll', () => {
        const guard = d().textSelectionGuard;
        if(!guard || guard.el !== el || !guard.active || Date.now() < guard.wheelUntil) {
            if(guard?.el === el) {
                guard.scrollTop = el.scrollTop || 0;
                guard.scrollLeft = el.scrollLeft || 0;
            }
            return;
        }
        const nextTop = el.scrollTop || 0;
        const prevTop = guard.scrollTop || 0;
        const rect = el.getBoundingClientRect();
        const pointerBelow = Number.isFinite(guard.clientY) && guard.clientY > rect.bottom - 10;
        const pointerAbove = Number.isFinite(guard.clientY) && guard.clientY < rect.top + 10;
        const jumpedToTop = prevTop > Math.max(80, el.clientHeight * 0.45) && nextTop < 4 && !pointerAbove;
        const wrongDirectionJump = pointerBelow && nextTop < prevTop - Math.max(40, el.clientHeight * 0.25);
        if(jumpedToTop || wrongDirectionJump) {
            requestAnimationFrame(() => {
                if(d().textSelectionGuard?.el === el && d().textSelectionGuard.active) {
                    el.scrollTop = prevTop;
                    el.scrollLeft = guard.scrollLeft || 0;
                }
            });
            return;
        }
        guard.scrollTop = nextTop;
        guard.scrollLeft = el.scrollLeft || 0;
    }, {passive:true});
    el.addEventListener('click', stop);
    el.addEventListener('dblclick', stop);
    el.addEventListener('wheel', e => {
        if(isLockedPromptText()) return;
        e.stopPropagation();
        if(d().textSelectionGuard?.el === el) d().textSelectionGuard.wheelUntil = Date.now() + 180;
    }, {passive:true});
}
function updatePortDragVisual(){
    if(!d().portDragState) return;
    const fromNode = d().nodes.find(n => n.id === d().portDragState.fromId);
    if(!fromNode) return;
    const fr = d().nodeRect(fromNode);
    const isOut = d().portDragState.fromPort === 'out';
    const fx = isOut ? fr.x + fr.width : fr.x;
    const fy = fr.y + fr.height / 2;
    const tx = d().portDragState.currentWorld.x;
    const ty = d().portDragState.currentWorld.y;
    const dx = Math.max(50, Math.abs(tx - fx) * 0.45);
    const sign = isOut ? 1 : -1;
    const path = ensurePortDragPathElement();
    if(path) path.setAttribute('d', `M${fx} ${fy} C ${fx + dx * sign} ${fy}, ${tx - dx * sign} ${ty}, ${tx} ${ty}`);
    d().world.querySelectorAll('.node-port.is-active').forEach(el => el.classList.remove('is-active'));
    d().world.querySelectorAll('.image-node.port-hover').forEach(el => el.classList.remove('port-hover'));
    if(d().portDragState.hoverTargetId){
        const targetNodeEl = d().world.querySelector(`.image-node[data-id="${d().portDragState.hoverTargetId}"]`);
        targetNodeEl?.classList.add('port-hover');
        targetNodeEl?.querySelector(`.node-port[data-port="${d().portDragState.hoverPort}"]`)?.classList.add('is-active');
    }
}
function handlePortDrop(drag, e){
    const {targetId, targetPort, hit} = (() => {
        const hitEl = document.elementFromPoint(e.clientX, e.clientY);
        const portEl = hitEl?.closest?.('.node-port');
        const nodeEl = portEl?.closest?.('.image-node') || hitEl?.closest?.('.image-node');
        let id = '', port = '';
        if(nodeEl && nodeEl.dataset.id && nodeEl.dataset.id !== drag.fromId){
            id = nodeEl.dataset.id;
            if(portEl){
                port = portEl.dataset.port;
            } else {
                const rect = nodeEl.getBoundingClientRect();
                port = (e.clientX - rect.left) < rect.width / 2 ? 'in' : 'out';
            }
        }
        return {targetId:id, targetPort:port, hit:hitEl};
    })();
    if(targetId){
        const compatible = (drag.fromPort === 'out' && targetPort === 'in') || (drag.fromPort === 'in' && targetPort === 'out');
        if(!compatible){ d().discardPendingUndo(); d().render(); return; }
        const fromId = drag.fromPort === 'out' ? drag.fromId : targetId;
        const toId = drag.fromPort === 'out' ? targetId : drag.fromId;
        if(d().connectInputNode(fromId, toId)){
            d().commitPendingUndo();
            d().render();
            d().scheduleSave();
        } else {
            d().discardPendingUndo();
            d().render();
        }
        return;
    }
    if(!drag.moved && drag.startWorld && drag.currentWorld){
        const dx = Number(drag.currentWorld.x || 0) - Number(drag.startWorld.x || 0);
        const dy = Number(drag.currentWorld.y || 0) - Number(drag.startWorld.y || 0);
        if(Math.hypot(dx, dy) > 3) drag.moved = true;
    }
    if(!drag.moved){ d().discardPendingUndo(); d().render(); return; }
    if(hit?.closest?.('.composer,.smart-back,.canvas-new-fab,.canvas-empty-hint,.asset-panel,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal,.image-edit-modal,.smart-minimap,.canvas-bottom-chrome')){
        d().discardPendingUndo(); d().render(); return;
    }
    if(window.SmartCanvasPortLinkMenu?.offerAfterPortDrag?.(drag, e)) return;
    d().discardPendingUndo();
    d().render();
}
function pickMediaForSmartNode(nodeId){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*';
    input.multiple = true;
    input.onchange = () => {
        if(input.files?.length) window.SmartCanvasUpload?.handleFiles?.(input.files, nodeId);
        input.remove();
    };
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.click();
}
function queueSmartNodeDrag(e, nodeId, options={}){
    if(e.button !== 0 || e.detail >= 2) return false;
    const promptNode = e.target.closest('.image-node.prompt-smart-node');
    if(promptNode?.classList.contains('prompt-text-editing')
        || promptNode?.querySelector('.prompt-node-text.is-text-editing')) return false;
    const promptText = e.target.closest('.prompt-node-text');
    if(promptText && (!promptText.readOnly || promptText.classList.contains('is-text-editing'))) return false;
    if(e.target.closest('.mini-x, .node-resize-handle, .node-port, select, input, button, .image-delete, .prompt-node-pill, .prompt-node-llm, .prompt-node-split-resize, textarea:not(.prompt-node-text), [data-pending-slot-cancel], .pending-slot-cancel, .pending-slot-footer, .pending-slot-inner, .loading-cell.pending-slot, .pending-batch-grid, .pending-mixed-grid, [data-inline-generation-cancel]')) return false;
    if(!options.preserveClick){
        e.preventDefault();
        e.stopPropagation();
    } else {
        window.SmartCanvasEmptyNodeChrome?.resetDragGesture?.();
    }
    window.getSelection?.()?.removeAllRanges?.();
    if(document.activeElement?.blur) document.activeElement.blur();
    let node = d().nodes.find(n => n.id === nodeId);
    if(!node) return false;
    if(e.altKey) node = d().duplicateForAltDrag(node);
    d().focusCanvasForShortcuts();
    let dragIds = window.SmartCanvasIsolatedFeatures?.resolveDragIds?.(nodeId, e)
        ?? [nodeId];
    const group = dragIds.map(dragId => {
        const n = d().nodes.find(x => x.id === dragId);
        return n ? {id:n.id, ox:Number(n.x) || 0, oy:Number(n.y) || 0} : null;
    }).filter(Boolean);
    const originSmartGroupId = options.originSmartGroupId || d().smartGroupContainingNode(nodeId)?.id || (d().isSmartGroupNode(node) ? nodeId : '') || '';
    d().dragPending = {id:node.id, startX:e.clientX, startY:e.clientY, ox:node.x || 0, oy:node.y || 0, group, groupIds:group.map(item => item.id), ctrlGroup:Boolean(e.ctrlKey), preserveClick:Boolean(options.preserveClick), originSmartGroupId};
    if(!options.skipUndoCapture) d().capturePendingUndo();
    return true;
}
function bindPendingSlotCancelDelegation(){
    const world = d().world;
    if(!world || world.dataset.pendingCancelDelegation === '1') return;
    world.dataset.pendingCancelDelegation = '1';
    const handleCancel = (btn, e) => {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        const nodeEl = btn.closest('.image-node');
        const id = nodeEl?.dataset?.id;
        if(!id) return;
        d().suppressNodeClickUntil = Date.now() + 220;
        const node = d().nodes.find(n => n.id === id);
        const taskId = String(btn.dataset.pendingTaskId || '').trim();
        const taskIndex = Number(btn.dataset.pendingTaskIndex);
        if(taskId) void d().cancelSmartPendingTask?.(node, taskId);
        else if(Number.isFinite(taskIndex)) void d().cancelSmartPendingSlot?.(node, taskIndex);
    };
    world.addEventListener('click', e => {
        const btn = e.target.closest?.('[data-pending-slot-cancel]');
        if(!btn) return;
        handleCancel(btn, e);
    }, true);
}
function formatAudioTime(value){
    const seconds = Number(value);
    if(!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if(hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
function syncAudioCard(audio){
    const card = audio?.closest?.('.media-audio-card');
    if(!card) return;
    const duration = Number(audio.duration);
    const currentTime = Number(audio.currentTime) || 0;
    const progress = Number.isFinite(duration) && duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
    const waveform = card.querySelector('.media-audio-waveform');
    const progressControl = card.querySelector('[data-audio-progress]');
    const currentLabel = card.querySelector('[data-audio-current]');
    const durationLabel = card.querySelector('[data-audio-duration]');
    const toggle = card.querySelector('[data-audio-action="toggle"]');
    if(waveform) waveform.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    if(progressControl){
        progressControl.value = String(Math.round(progress * 1000));
        progressControl.style.setProperty('--audio-progress', `${progress * 100}%`);
    }
    if(currentLabel) currentLabel.textContent = formatAudioTime(currentTime);
    if(durationLabel) durationLabel.textContent = formatAudioTime(duration);
    card.classList.toggle('is-playing', !audio.paused && !audio.ended);
    if(toggle){
        const label = audio.paused || audio.ended ? '播放' : '暂停';
        toggle.title = label;
        toggle.setAttribute('aria-label', label);
    }
}
function bindAudioCardControls(el){
    el.querySelectorAll('.media-audio-card').forEach(card => {
        const audio = card.querySelector('audio');
        if(!audio) return;
        if(audio.dataset.customPlayerBound !== '1'){
            audio.dataset.customPlayerBound = '1';
            audio.addEventListener('loadedmetadata', () => syncAudioCard(audio));
            audio.addEventListener('timeupdate', () => syncAudioCard(audio));
            audio.addEventListener('play', () => syncAudioCard(audio));
            audio.addEventListener('pause', () => syncAudioCard(audio));
            audio.addEventListener('ended', () => syncAudioCard(audio));
        }
        card.querySelectorAll('.media-audio-control,.media-audio-progress,.media-audio-waveform').forEach(control => {
            control.addEventListener('mousedown', e => {
                if(!control.classList.contains('media-audio-progress')) e.preventDefault();
                e.stopPropagation();
            });
            control.addEventListener('dblclick', e => e.stopPropagation());
        });
        card.querySelectorAll('[data-audio-action]').forEach(button => {
            button.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                const action = button.dataset.audioAction;
                if(action === 'toggle'){
                    if(audio.paused || audio.ended) audio.play?.().catch?.(() => {});
                    else audio.pause?.();
                }
                syncAudioCard(audio);
            });
        });
        const progressControl = card.querySelector('[data-audio-progress]');
        progressControl?.addEventListener('input', e => {
            e.stopPropagation();
            const duration = Number(audio.duration);
            if(!Number.isFinite(duration) || duration <= 0) return;
            audio.currentTime = Math.max(0, Math.min(duration, (Number(e.target.value) / 1000) * duration));
            syncAudioCard(audio);
        });
        const waveform = card.querySelector('[data-audio-seek]');
        waveform?.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const duration = Number(audio.duration);
            const rect = waveform.getBoundingClientRect();
            if(!Number.isFinite(duration) || duration <= 0 || rect.width <= 0) return;
            audio.currentTime = Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration));
            syncAudioCard(audio);
        });
        syncAudioCard(audio);
    });
}
function bindNodeEvents(){
    bindPendingSlotCancelDelegation();
    bindNodeContextMenuDelegation();
    d().world.querySelectorAll('.image-node').forEach(el => {
        const id = el.dataset.id;
        const nodeForControls = d().nodes.find(n => n.id === id);
        bindAudioCardControls(el);
        if(nodeForControls?.type === 'smart-prompt') bindPromptNodeControls(el, nodeForControls);
        if(nodeForControls?.type === 'smart-loop') bindLoopNodeControls(el, nodeForControls);
        if(nodeForControls?.type === 'smart-group'){
            el.ondblclick = e => {
                e.preventDefault();
                e.stopPropagation();
                d().selectedId = id;
                d().selectedIds = [];
                d().selectedImage = {nodeId:'', index:-1};
                d().openCreateMenu(e, {groupId:id});
            };
        }
        const emptyNodeHostApi = {
            getNodes: () => d().nodes,
            hideSelectionGroupBox,
            setSelectionMarqueeActive: v => { d().selectionMarqueeActive = v; },
            setSmartCascadeSilentSelection: v => { d().smartCascadeSilentSelection = v; },
            smartCascadeAnyRunning,
            setSelectedId: v => { d().selectedId = v; },
            setSelectedIds: v => { d().selectedIds = v; },
            setSelectedImage: v => { d().selectedImage = v; },
            syncSelectionUi,
            updateComposer,
            focusCanvasForShortcuts,
            scheduleComposerReposition: node => SmartCanvasComposer?.scheduleComposerReposition?.(node)
        };
        window.SmartCanvasEmptyNodeChrome?.bindBlankChromeGestures?.(el, id, emptyNodeHostApi);
        el.onclick = e => {
            e.stopPropagation();
            if(e.target?.closest?.('[data-pending-slot-cancel], [data-inline-generation-cancel]')) return;
            global.SmartCanvasPortLinkMenu?.cancelPending?.();
            if(Date.now() < d().suppressNodeClickUntil) return;
            const node = d().nodes.find(n => n.id === id);
            if(d().selectedIds.length > 1 && d().selectedIds.includes(id)){
                d().selectedId = '';
                d().smartGroupCapsuleOnly = false;
                d().selectionMarqueeActive = true;
                d().syncSelectionUi();
                d().positionSelectionGroupBox();
                window.SmartCanvasIsolatedFeatures?.syncCapsule?.();
                return;
            }
            const parentGroup = d().smartGroupContainingNode(id);
            if(node?.type === 'smart-group' || parentGroup){
                d().showSmartGroupCapsule(node?.type === 'smart-group' ? id : parentGroup.id);
                return;
            }
            const imageItem = e.target.closest('.thumb-item,.image-wrap');
            if(imageItem){
                d().hideSelectionGroupBox();
                d().selectCanvasImage(id, Number(imageItem.dataset.imageIndex || 0));
                return;
            }
            if(window.SmartCanvasIsolatedFeatures?.handleEmptyNodeClick?.(id, e)) return;
            if(window.SmartCanvasEmptyNodeChrome?.isEmptyUploadNode?.(node)
                && window.SmartCanvasEmptyNodeChrome?.isBlankChromeTarget?.(e.target, el)){
                window.SmartCanvasEmptyNodeChrome.openEmptyUploadComposer?.(id, emptyNodeHostApi);
                return;
            }
            d().hideRunTimerForNode(node);
            d().selectedId = id;
            d().selectedIds = [];
            if(d().selectedImage.nodeId !== id) d().selectedImage = {nodeId:'', index:-1};
            d().hideSelectionGroupBox();
            if(d().smartCascadeAnyRunning()) d().smartCascadeSilentSelection = false;
            d().focusCanvasForShortcuts();
            d().render();
        };
        el.ondblclick = e => {
            e.stopPropagation();
            const node = d().nodes.find(n => n.id === id);
            if(node?.type === 'smart-group') return;
            if(window.SmartCanvasIsolatedFeatures?.handleEmptyNodeDoubleClick?.(id, e)) return;
            const imageItem = e.target.closest('.thumb-item,.image-wrap');
            if(imageItem){
                e.preventDefault();
                d().activateImageDoubleClick(id, Number(imageItem.dataset.imageIndex || 0), imageItem);
                return;
            }
            if(node?.type === 'smart-prompt'){
                if(e.target.closest('.prompt-node-control, .prompt-node-pill, .smart-node-input-thumb, .prompt-node-split-resize, .node-resize-handle, .node-port')) return;
                e.preventDefault();
                return;
            }
        };
        el.querySelectorAll('.node-delete').forEach(btn => {
            if(btn.dataset.boundNodeDelete === '1') return;
            btn.dataset.boundNodeDelete = '1';
            btn.addEventListener('pointerdown', event => {
                if(event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                d().suppressNodeClickUntil = Date.now() + 220;
                d().deleteNodeFromButton(id);
            }, true);
        });
        el.querySelectorAll('[data-inline-generation-cancel]').forEach(btn => {
            if(btn.dataset.boundInlineCancel === '1') return;
            btn.dataset.boundInlineCancel = '1';
            btn.addEventListener('pointerdown', e => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation?.();
            }, true);
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                d().cancelSmartNodeGeneration(d().nodes.find(n => n.id === id));
            });
        });
        el.querySelectorAll('[data-smart-group-action]').forEach(btn => {
            btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); }, true);
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                d().runSmartGroupToolbarAction(btn.dataset.nodeId || id, btn.dataset.smartGroupAction);
            });
        });
        el.querySelectorAll('[data-thumb-scroll]').forEach(scroller => {
            scroller.addEventListener('wheel', e => { e.stopPropagation(); }, {passive:false});
        });
        el.querySelectorAll('.image-delete').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation();
                const item = btn.closest('[data-image-index]');
                const targetNodeId = item?.dataset.refNodeId || id;
                const imageIndex = Number(item?.dataset.refImageIndex ?? btn.dataset.imageIndex ?? 0);
                d().deleteImage(targetNodeId, imageIndex);
            });
        });
        el.querySelectorAll('.smart-video-play').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const item = btn.closest('[data-image-index]');
                const targetNodeId = item?.dataset.refNodeId || id;
                const imageIndex = Number(item?.dataset.refImageIndex ?? item?.dataset.imageIndex ?? 0);
                const owner = d().nodes.find(n => n.id === targetNodeId);
                if(d().mediaKindForItem?.(owner?.images?.[imageIndex] || {}) !== 'video') return;
                d().clearImageClickTimer();
                d().suppressImageClickUntil = Date.now() + 260;
                d().hideRunTimerForNode?.(owner);
                d().smartActivateVideoPreview?.(btn);
            }, true);
        });
        el.querySelectorAll('.thumb-item,.image-wrap,.smart-group-single-thumb').forEach(item => {
            item.setAttribute('draggable', 'false');
            item.ondragstart = e => e.preventDefault();
            item.onmousedown = e => {
                if(e.button !== 0 || e.target.closest('.image-delete,.smart-video-play,.media-audio-control,.media-audio-progress,.media-audio-waveform')) return;
                if(e.target.closest('audio')) return;
                const video = e.target.closest('video');
                if(video?.controls){
                    const rect = video.getBoundingClientRect();
                    if(e.clientY >= rect.bottom - Math.min(48, rect.height)) return;
                }
                if(e.detail >= 2){
                    e.preventDefault();
                    e.stopPropagation();
                    d().clearImageClickTimer();
                    d().suppressImageClickUntil = Date.now() + 260;
                    const targetNodeId = item.dataset.refNodeId || id;
                    const imageIndex = Number(item.dataset.refImageIndex ?? item.dataset.imageIndex ?? 0);
                    const owner = d().nodes.find(n => n.id === targetNodeId);
                    const image = owner?.images?.[imageIndex];
                    if(d().mediaKindForItem?.(image || {}) === 'video'){
                        d().smartActivateVideoPreview?.(item);
                        return;
                    }
                }
                if(e.detail >= 2) return;
                if(window.SmartCanvasIsolatedFeatures?.handleThumbMouseDown?.(e, id, item)) return;
                const node = d().nodes.find(n => n.id === id);
                const targetNodeId = item.dataset.refNodeId || id;
                const imageIndex = Number(item.dataset.refImageIndex ?? item.dataset.imageIndex ?? 0);
                if(d().selectedIds.length > 1 && (d().selectedIds.includes(id) || d().selectedIds.includes(targetNodeId))){
                    d().clearImageClickTimer();
                    queueSmartNodeDrag(e, d().selectedIds.includes(id) ? id : targetNodeId);
                    return;
                }
                if(item.classList.contains('co-create-thumb-item')){
                    d().clearImageClickTimer();
                    d().selectCanvasImage(targetNodeId, imageIndex);
                    return;
                }
                if(window.SmartCanvasCoCreate?.isNodeDragSurface?.(node, e.target)){
                    queueSmartNodeDrag(e, id);
                    return;
                }
                d().clearImageClickTimer();
                d().selectCanvasImage(targetNodeId, imageIndex);
                if(item.classList.contains('image-wrap')) queueSmartNodeDrag(e, id);
            };
            item.onclick = e => {
                if(e.target.closest('.image-delete,.smart-video-play,.media-audio-control,.media-audio-progress,.media-audio-waveform')) return;
                if(e.target.closest('video,audio')) return;
                e.preventDefault();
                e.stopPropagation();
                if(Date.now() < (d().suppressImageClickUntil || 0)) return;
                const targetNodeId = item.dataset.refNodeId || id;
                const imageIndex = Number(item.dataset.refImageIndex ?? item.dataset.imageIndex ?? 0);
                const owner = d().nodes.find(n => n.id === targetNodeId);
                const image = owner?.images?.[imageIndex];
                if(d().mediaKindForItem?.(image || {}) === 'video'){
                    d().clearImageClickTimer();
                    d().suppressImageClickUntil = Date.now() + 260;
                    d().hideRunTimerForNode?.(owner);
                    d().smartActivateVideoPreview?.(item);
                    return;
                }
                d().clearImageClickTimer();
                if(d().noteImageClickForDouble(targetNodeId, imageIndex, item)) return;
                d().selectCanvasImage(targetNodeId, imageIndex);
            };
            item.ondblclick = e => {
                if(e.target.closest('.image-delete,.smart-video-play,.media-audio-control,.media-audio-progress,.media-audio-waveform')) return;
                if(e.target.closest('video,audio')) return;
                e.preventDefault();
                e.stopPropagation();
                const targetNodeId = item.dataset.refNodeId || id;
                const imageIndex = Number(item.dataset.refImageIndex ?? item.dataset.imageIndex ?? 0);
                const owner = d().nodes.find(n => n.id === targetNodeId);
                const image = owner?.images?.[imageIndex];
                d().clearImageClickTimer();
                d().suppressImageClickUntil = Date.now() + 260;
                if(d().mediaKindForItem?.(image || {}) === 'video'){
                    d().smartActivateVideoPreview?.(item);
                    return;
                }
                d().activateImageDoubleClick(targetNodeId, imageIndex, item);
            };
        });
        el.querySelectorAll('.thumb-item').forEach(item => {
            item.addEventListener('mousedown', e => {
                if(e.button !== 0 || e.target.closest('.mini-x')) return;
                if(e.detail >= 2) return;
                const node = d().nodes.find(n => n.id === id);
                const coCreateDetach = window.SmartCanvasCoCreate?.allowsThumbDetach?.(node);
                if(window.SmartCanvasCoCreate?.blocksThumbReorder?.(node) && !coCreateDetach) return;
                if(!node) return;
                if(!coCreateDetach && (node.images || []).length <= 1) return;
                e.preventDefault(); e.stopPropagation();
                d().thumbDragState = {nodeId:id, imgIndex:Number(item.dataset.imageIndex || 0), startX:e.clientX, startY:e.clientY, detached:false};
                d().capturePendingUndo();
            });
        });
        el.querySelector('.node-resize-handle')?.addEventListener('mousedown', e => {
            if(e.button !== 0) return;
            e.preventDefault(); e.stopPropagation();
            const node = d().nodes.find(n => n.id === id);
            if(!node || d().isSmartGroupNode(node)) return;
            const rect = d().nodeRect(node);
            const unifiedPrompt = node.type === 'smart-prompt' && node.llmEnabled && node.llmComposerUnified === true;
            if(unifiedPrompt){
                const textEl = el.querySelector('.prompt-node-text');
                const preview = document.createElement('div');
                preview.className = 'prompt-node-resize-preview';
                preview.style.height = `${d().promptNodeTextHeight(node)}px`;
                const previewText = document.createElement('span');
                previewText.textContent = (textEl?.value || textEl?.placeholder || '').trim().slice(0, 80);
                preview.appendChild(previewText);
                textEl?.before(preview);
                el.classList.add('prompt-unified-resizing');
            }
            d().resizeState = {
                id,
                startX:e.clientX,
                startY:e.clientY,
                startW:rect.width,
                startH:rect.height,
                startPromptMainH:node.type === 'smart-prompt' ? d().promptNodeTextHeight(node) : 0,
                startPromptInstrH:node.type === 'smart-prompt' && node.llmEnabled ? d().promptLlmInstructionHeight(node) : 0,
                unifiedPrompt
            };
            document.body.classList.add('smart-node-resize');
            d().capturePendingUndo();
        });
        const beginNodeDrag = e => {
            if(e.button !== 0) return;
            if(e.target?.closest?.('[data-pending-slot-cancel], .pending-slot-cancel, .pending-slot-footer, .pending-slot-inner, .loading-cell.pending-slot, .pending-batch-grid, .pending-mixed-grid, [data-inline-generation-cancel], .run-status-actions, button, .mini-x, .image-delete, .node-port, .node-resize-handle')) return;
            const node = d().nodes.find(n => n.id === id);
            if(node?.type === 'smart-prompt'){
                queueSmartNodeDrag(e, id);
                return;
            }
            if(window.SmartCanvasEmptyNodeChrome?.shouldPreserveClick?.(node, e.target)){
                queueSmartNodeDrag(e, id, { preserveClick: true });
                window.SmartCanvasEmptyNodeChrome?.armBlankOpenOnMouseUp?.(id, emptyNodeHostApi, e.clientX, e.clientY, e.target);
                return;
            }
            if(window.SmartCanvasIsolatedFeatures?.handleNodeDragStart?.(id, e)) return;
        };
        el.querySelectorAll('.node-port').forEach(port => {
            port.addEventListener('mousedown', e => {
                if(e.button !== 0) return;
                e.preventDefault(); e.stopPropagation();
                const portType = port.dataset.port;
                const p = d().screenToWorld(e);
                d().portDragState = {
                    fromId:id,
                    fromPort:portType,
                    startWorld:p,
                    currentWorld:p,
                    hoverTargetId:'',
                    hoverPort:'',
                    moved:false
                };
                shell.classList.add('port-dragging');
                d().capturePendingUndo();
                ensurePortDragPathElement();
                updatePortDragVisual();
            });
            port.addEventListener('click', e => { e.stopPropagation(); });
            port.addEventListener('dblclick', e => { e.stopPropagation(); });
        });
        el.onmousedown = beginNodeDrag;
        el.ondragover = e => d().setSmartDropCopyEffect(e);
        el.ondrop = async e => {
            e.preventDefault();
            e.stopPropagation();
            const payload = await d().resolveSmartImageDropPayload(e.dataTransfer);
            if(payload.type === 'none') return;
            await d().handleSmartImageDropPayload(payload, id);
        };
    });
}
function rectOverlapNode(draggedId, x, y, w, h, excludeIds=[]){
    const cx = x + w/2, cy = y + h/2;
    const excluded = new Set([draggedId, ...(excludeIds || [])]);
    for(const n of d().nodes){
        if(excluded.has(n.id)) continue;
        const r = d().nodeRect(n);
        if(cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height) return n;
    }
    return null;
}
function dragConnectTargetFor(sourceNode, point=d().lastMouseWorld){
    if(!sourceNode || (d().dragState?.group || []).length > 1) return null;
    if(['smart-prompt', 'smart-loop'].includes(sourceNode.type) && point){
        return rectOverlapNode(sourceNode.id, point.x - 1, point.y - 1, 2, 2, d().dragState?.groupIds || []);
    }
    const r = d().nodeRect(sourceNode);
    return rectOverlapNode(sourceNode.id, r.x, r.y, r.width, r.height, d().dragState?.groupIds || []);
}
function canAutoConnectDraggedNode(sourceNode, targetNode){
    if(!sourceNode || !targetNode || sourceNode.id === targetNode.id) return false;
    if(d().isHistoryGroupNode(sourceNode) || d().isHistoryGroupNode(targetNode)) return false;
    const srcGroup = d().smartGroupContainingNode(sourceNode.id);
    if(srcGroup){
        if(d().isSmartGroupNode(targetNode) && targetNode.id === srcGroup.id) return false;
        if(Array.isArray(srcGroup.items) && srcGroup.items.includes(targetNode.id)) return false;
    }
    if(d().isSmartImageNode(sourceNode)) return d().isSmartImageNode(targetNode) || targetNode.type === 'smart-loop' || targetNode.type === 'smart-prompt';
    if(sourceNode.type === 'smart-prompt') return d().isSmartImageNode(targetNode) || targetNode.type === 'smart-loop';
    if(sourceNode.type === 'smart-loop') return d().isSmartImageNode(targetNode);
    return false;
}
function restoreDraggedNodePosition(){
    if(!d().dragState) return;
    (d().dragState.group || [{id:d().dragState.id, ox:d().dragState.ox, oy:d().dragState.oy}]).forEach(item => {
        const n = d().nodes.find(x => x.id === item.id);
        if(n){
            n.x = item.ox;
            n.y = item.oy;
        }
    });
}
function clearDropHighlight(){
    d().world.querySelectorAll('.image-node.drop-target').forEach(el => el.classList.remove('drop-target'));
}
function setDropHighlight(targetId){
    clearDropHighlight();
    if(!targetId) return;
    const el = d().world.querySelector(`.image-node[data-id="${targetId}"]`);
    if(el) el.classList.add('drop-target');
}
    const api = Object.freeze({
        registerDeps,
        ensurePortDragPathElement, clearPortDragVisual, bindPromptNodeControls, bindLoopNodeControls, bindScrollableText, updatePortDragVisual, handlePortDrop, pickMediaForSmartNode, queueSmartNodeDrag, bindNodeEvents, rectOverlapNode, dragConnectTargetFor, canAutoConnectDraggedNode, restoreDraggedNodePosition, clearDropHighlight, setDropHighlight, closeNodeContextMenu, arrangeAllCanvasNodes
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('nodeEvents', api);
    }

    global.SmartCanvasNodeEvents = api;
})(window);
