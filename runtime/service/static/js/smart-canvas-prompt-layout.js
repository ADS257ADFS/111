/**
 * Smart Canvas — prompt-node and loop-node layout sizing helpers.
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
        if(!c) throw new Error('[SmartCanvasPromptLayout] deps not registered');
        return c;
    }


const PROMPT_SPLIT_PREVIEW_DEFAULT_H = 70;
const PROMPT_SPLIT_PREVIEW_MIN_H = 40;
const PROMPT_SPLIT_PREVIEW_MAX_H = 220;
const UNIFIED_PROMPT_MIN_WIDTH = 400;

function smartNodeInputThumbRows(count){
    return count ? Math.ceil(Math.min(10, count) / 5) : 0;
}

function smartNodeInputThumbsHeight(images){
    const rows = smartNodeInputThumbRows((images || []).length);
    return rows ? rows * 44 + (rows - 1) * 6 + 8 : 0;
}

function promptNodeInputImages(node){
    if(!node?.llmEnabled) return [];
    return promptNodeInputMediaForLLM(node).filter(img => img?.url);
}

function promptNodeInputMediaForLLM(node){
    const refs = S().smartImageUsesWorkflowInput(node) ? S().workflowInputImagesFor(node) : S().inputImagesFor(node);
    return (refs || []).filter(ref => ref?.url);
}

function smartNodeInputThumbsHtml(images, opts={}){
    const refs = (images || []).filter(img => img?.url);
    if(!refs.length) return '';
    const limit = Math.min(10, refs.length);
    const items = refs.slice(0, limit).map((img, index) => {
        const label = opts.labelPrefix ? `${opts.labelPrefix}${index + 1}` : (window.StudioI18n?.lang?.() === 'en' ? `Image ${index + 1}` : `图${index + 1}`);
        const media = S().isAudioMediaItem(img)
            ? `<div class="media-thumb audio-thumb"><i data-lucide="file-audio"></i><span>${S().escapeHtml(img.name || 'Audio')}</span></div>`
            : S().isVideoMediaItem(img)
            ? `<video src="${S().escapeHtml(img.url)}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video>`
            : `<img src="${S().escapeHtml(img.url)}" alt="">`;
        return `<div class="smart-node-input-thumb" title="${S().escapeHtml(label)}">${media}<span class="smart-node-input-badge">${S().escapeHtml(label)}</span></div>`;
    }).join('');
    const more = refs.length > limit ? `<div class="smart-node-input-thumb smart-node-input-more">+${refs.length - limit}</div>` : '';
    return `<div class="smart-node-input-thumbs">${items}${more}</div>`;
}

function promptNodeTextHeight(node){
    const h = Number(node?.promptMainHeight);
    if(!Number.isFinite(h)) return S().PROMPT_NODE_TEXT_DEFAULT_H;
    const rounded = Math.round(h);
    if(node?.llmComposerUnified === true) return Math.max(S().PROMPT_NODE_TEXT_MIN_H, rounded);
    return Math.max(S().PROMPT_NODE_TEXT_MIN_H, Math.min(S().PROMPT_NODE_TEXT_MAX_H, rounded));
}

function promptLlmInstructionHeight(node){
 const h = Number(node?.llmInstructionHeight);
 if(!Number.isFinite(h)) return S().PROMPT_LLM_INSTRUCTION_DEFAULT_H;
 return Math.max(S().PROMPT_LLM_INSTRUCTION_MIN_H, Math.min(S().PROMPT_LLM_INSTRUCTION_MAX_H, Math.round(h)));
}


function promptNodeContentHeight(node){
    const gap = 8;
    const pad = 24;
    let height = pad + promptNodeTextHeight(node);
    if(node?.llmEnabled && node?.llmComposerUnified === true){
        return Math.round(height + gap + 48);
    }
    if(!node?.llmEnabled){
        height += gap + 24;
        return Math.round(height);
    }
    height += gap + S().PROMPT_SPLIT_RESIZE_BAR_H;
    height += gap + 24;
    const thumbH = smartNodeInputThumbsHeight(promptNodeInputImages(node));
    if(thumbH) height += gap + thumbH;
    let llmBlock = 26;
    llmBlock += 5 + promptLlmInstructionHeight(node);
    llmBlock += 5 + 26;
    height += gap + llmBlock;
    return Math.round(height);
}

function syncPromptNodeElementHeights(node, nodeEl=null, options={}){
    if(!node || node.type !== 'smart-prompt') return;
    const el = nodeEl || S().world?.querySelector?.(`.image-node[data-id="${CSS.escape(node.id)}"]`);
    if(!el) return;
    const width = Math.round(Number(node.w) || S().PROMPT_NODE_DEFAULT_WIDTH);
    let height = Math.round(Number(node.h) || S().PROMPT_NODE_DEFAULT_HEIGHT);
    if(node.llmEnabled){
        const measured = promptNodeContentHeight(node);
        height = node.llmComposerUnified === true ? measured : (node.promptMaximized ? Math.max(measured, height) : measured);
        if(node.llmComposerUnified === true) node.promptMaximized = false;
        node.h = height;
    }
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    const mainEl = el.querySelector('.prompt-node-text');
    const instrEl = el.querySelector('.prompt-llm-instruction');
    if(mainEl && node.llmEnabled) mainEl.style.height = `${promptNodeTextHeight(node)}px`;
    if(instrEl) instrEl.style.height = `${promptLlmInstructionHeight(node)}px`;
    if(options.refreshConnections !== false) S().refreshConnectionLayer();
}

function promptNodeExpandedHeight(node){
    return promptNodeContentHeight(node);
}

function promptNodeLayoutSize(node){
    const explicitW = Number(node?.w);
    const unifiedWidth = node?.llmEnabled && node?.llmComposerUnified === true && Number.isFinite(explicitW);
    const width = unifiedWidth
        ? Math.max(UNIFIED_PROMPT_MIN_WIDTH, explicitW)
        : (!Number.isFinite(explicitW) || S().PROMPT_NODE_LEGACY_WIDTHS.has(explicitW) ? S().PROMPT_NODE_DEFAULT_WIDTH : explicitW);
    if(node?.llmEnabled){
        const measured = promptNodeContentHeight(node);
        if(node.llmComposerUnified === true) return {width:Math.round(width), height:measured};
        if(node.promptMaximized){
            const explicitH = Number(node?.h);
            return {width:Math.round(width), height:Math.round(Math.max(measured, Number.isFinite(explicitH) ? explicitH : measured))};
        }
        return {width:Math.round(width), height:measured};
    }
    const explicitH = Number(node?.h);
    const fallbackH = S().PROMPT_NODE_DEFAULT_HEIGHT;
    const height = !Number.isFinite(explicitH) || S().PROMPT_NODE_LEGACY_HEIGHTS.has(explicitH)
        ? fallbackH
        : Math.max(explicitH, fallbackH);
    return {width:Math.round(width), height:Math.round(height)};
}

function fitSmartLoopNode(node){
    if(!node || node.type !== 'smart-loop') return;
    node.w = S().smartLoopWidth(node);
    node.h = S().smartLoopHeight(node);
}


function clampPromptSplitHeights(mainH, instrH){
    let nextMain = mainH;
    let nextInstr = instrH;
    if(nextMain < S().PROMPT_NODE_TEXT_MIN_H){
        nextInstr -= S().PROMPT_NODE_TEXT_MIN_H - nextMain;
        nextMain = S().PROMPT_NODE_TEXT_MIN_H;
    }
    if(nextInstr < S().PROMPT_LLM_INSTRUCTION_MIN_H){
        nextMain -= S().PROMPT_LLM_INSTRUCTION_MIN_H - nextInstr;
        nextInstr = S().PROMPT_LLM_INSTRUCTION_MIN_H;
    }
    nextMain = Math.max(S().PROMPT_NODE_TEXT_MIN_H, Math.min(S().PROMPT_NODE_TEXT_MAX_H, nextMain));
    nextInstr = Math.max(S().PROMPT_LLM_INSTRUCTION_MIN_H, Math.min(S().PROMPT_LLM_INSTRUCTION_MAX_H, nextInstr));
    return {mainH:nextMain, instrH:nextInstr};
}

function updatePromptSplitDuringResize(node, dy){
    if(!node?.llmEnabled || !S().promptSplitResizeState) return;
    const {mainH, instrH} = clampPromptSplitHeights(
        S().promptSplitResizeState.startMainH + dy,
        S().promptSplitResizeState.startInstructionH - dy
    );
    node.promptMainHeight = Math.round(mainH);
    node.llmInstructionHeight = Math.round(instrH);
    node.promptMaximized = false;
    node.h = promptNodeContentHeight(node);
    S().updateNodeElementDuringResize(node);
}
    function promptNodePromptItems(node){
 const text = String(node?.text || '').trim();
 if(!text) return [];
 if(node?.promptSplitEnabled !== true) return [text];
 const sep = promptNodeSeparator(node);
 if(!sep) return [text];
 const items = text.split(sep).map(item => item.trim()).filter(Boolean);
 return items.length > 1 ? items : [text];
}
    function promptNodeSeparator(node){
 const raw = String(node?.promptSeparator ?? ';');
 return raw === '' ? ';' : raw;
}
    function promptNodeSplitExtraHeight(node){
 if(node?.promptSplitEnabled !== true) return 0;
 return 25 + promptNodeSplitPreviewHeight(node) + S().PROMPT_SPLIT_RESIZE_BAR_H;
}
    function promptNodeSplitPreviewHeight(node){
 const h = Number(node?.promptSplitPreviewHeight);
 if(!Number.isFinite(h)) return PROMPT_SPLIT_PREVIEW_DEFAULT_H;
 return Math.max(PROMPT_SPLIT_PREVIEW_MIN_H, Math.min(PROMPT_SPLIT_PREVIEW_MAX_H, Math.round(h)));
}
    function promptNodeUpstreamPromptItems(node, ctx=smartLoopContext){
 const seen = new Set();
 return S().inputNodesFor(node).flatMap(input => promptTextItemsForNode(input, ctx)).map(text => String(text || '').trim()).filter(text => {
 if(!text || seen.has(text)) return false;
 seen.add(text);
 return true;
 });
}
    function promptNodeUpstreamPromptText(node, ctx=smartLoopContext){
 return promptNodeUpstreamPromptItems(node, ctx).join('\n\n');
}
    function promptNodeLLMInputText(node, ctx=smartLoopContext){
 const upstream = promptNodeUpstreamPromptText(node, ctx).trim();
 const instruction = String(node?.llmInstruction || '').trim() || promptNodePromptItems(node).join('\n\n').trim();
 return [upstream, instruction].filter(Boolean).join('\n\n');
}
    function promptNodeMinHeight(node){
 return node?.llmEnabled ? promptNodeContentHeight(node) : 380 + promptNodeSplitExtraHeight(node);
}
    function syncPromptNodeHeightForSplit(node, prevExtra=0){
 if(!node) return;
 const nextExtra = promptNodeSplitExtraHeight(node);
 const explicitH = Number(node.h);
 const currentH = Number.isFinite(explicitH) ? explicitH : 0;
 const fallbackH = promptNodeMinHeight(node);
 node.h = Math.max(fallbackH, currentH ? currentH - Math.max(0, prevExtra) + nextExtra : fallbackH);
 node.w = Math.max(Number(node.w) || 0, S().PROMPT_NODE_DEFAULT_WIDTH);
}
    function refreshPromptNodeSegmentsUi(el, node){
 const items = promptNodePromptItems(node);
 const count = el.querySelector('.prompt-node-split-count');
 if(count) count.textContent = `${items.length || 0} 段`;
 const list = el.querySelector('.prompt-node-segments');
 if(list){
 list.innerHTML = items.length
 ? items.map((item, index) => ` ${index + 1} ${S().escapeHtml(item)} `).join('')
 : '';
 }
}
    function promptTextItemsForNode(node, ctx=smartLoopContext){
 if(!node) return [];
 if(node.type === 'smart-prompt') return promptNodePromptItems(node);
 if(node.type === 'smart-loop'){
 const text = S().smartLoopPrompt(node, ctx);
 return text ? [text] : [];
 }
 if(node.type === 'smart-group') return S().smartGroupMembers(node).flatMap(member => promptTextItemsForNode(member, ctx));
 return [];
}
    const api = Object.freeze({
        promptTextItemsForNode,
        refreshPromptNodeSegmentsUi,
        syncPromptNodeHeightForSplit,
        promptNodeMinHeight,
        promptNodeLLMInputText,
        promptNodeUpstreamPromptText,
        promptNodeUpstreamPromptItems,
        promptNodeSplitPreviewHeight,
        promptNodeSplitExtraHeight,
        promptNodeSeparator,
        promptNodePromptItems,
        registerDeps,
        smartNodeInputThumbRows,
        smartNodeInputThumbsHeight,
        promptNodeInputImages,
        promptNodeInputMediaForLLM,
        smartNodeInputThumbsHtml,
        promptNodeTextHeight,
        promptLlmInstructionHeight,
        promptNodeContentHeight,
        syncPromptNodeElementHeights,
        promptNodeExpandedHeight,
        promptNodeLayoutSize,
        fitSmartLoopNode,
        clampPromptSplitHeights,
        updatePromptSplitDuringResize
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('promptLayout', api);
    }
    global.SmartCanvasPromptLayout = api;
})(window);
