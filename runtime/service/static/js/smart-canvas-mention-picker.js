/**
 * Smart Canvas — @-mention image picker (composer prompt tokens).
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;
    let mentionInsertMode = '';
    let mentionAnchorEl = null;

    function registerDeps(next){
        deps = next;
    }

    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasMentionPicker] deps not registered');
        return c;
    }

function mentionTokenHtml(img){
    if(!img?.url) return '';
    const name = img.alias || img.name || '鍥剧墖';
    const kind = S().mediaKindForItem(img);
    const media = kind === 'video'
        ? `<video src="${S().escapeHtml(img.url)}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video>`
        : `<img src="${S().escapeHtml(img.url)}" alt="">`;
    return `<span class="mention-image-token" contenteditable="false" data-url="${S().escapeHtml(img.url)}" data-kind="${S().escapeHtml(kind)}" data-name="${S().escapeHtml(name)}" data-node-id="${S().escapeHtml(img.nodeId || '')}" data-image-index="${S().escapeHtml(img.imageIndex ?? '')}">${media}<span>${S().escapeHtml(name)}</span></span>`;
}

function mentionTokenMediaHtml(img, kind=S().mediaKindForItem(img)){ 
 if(kind === 'audio'){ 
 return ` `; 
 } 
 if(kind === 'video'){ 
 return `<video src="${S().escapeHtml(img.url)}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video>`; 
 } 
 return `<img src="${S().escapeHtml(img.url)}" alt="">`; 
}


function mentionOptionMediaHtml(img){ 
 const kind = S().mediaKindForItem(img); 
 if(kind === 'audio'){ 
 return ` ${S().escapeHtml(img.alias || img.name || 'Audio')} `; 
 } 
 return kind === 'video'
    ? `<video src="${S().escapeHtml(img.url)}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video>`
    : `<img src="${S().escapeHtml(img.url)}" alt="">`; 
}


function promptHtmlWithMentionTokens(text, refs=[]){
    const value = String(text || '');
    const items = (refs || []).filter(ref => ref?.url && ref?.name).sort((a, b) => String(b.name || '').length - String(a.name || '').length);
    if(!value || !items.length || !value.includes('@')) return '';
    let html = '';
    let index = 0;
    while(index < value.length){
        if(value[index] === '@'){
            const hit = items.find(ref => value.slice(index + 1, index + 1 + String(ref.name || '').length) === String(ref.name || ''));
            if(hit){
                html += mentionTokenHtml(hit);
                index += 1 + String(hit.name || '').length;
                continue;
            }
        }
        html += S().escapeHtml(value[index]);
        index += 1;
    }
    return html;
}

function inputMentionCandidateImages(node){
    const current = node ? S().lineImagesFor(node) : [];
    const seen = new Set();
    return current.filter(img => {
        if(!img?.url || seen.has(img.url)) return false;
        seen.add(img.url);
        return true;
    }).map((img, index) => ({
        ...img,
        mentionId:`mention_${index}_${Math.random().toString(36).slice(2, 7)}`,
        alias:img.name || `鍥剧墖${index + 1}`
    }));
}

function assetMentionCandidateImages(categoryId=''){
    const cats = S().assetCategories('image');
    const cat = cats.find(c => c.id === categoryId) || S().assetCategoryForMention();
    if(!cat) return [];
    S().mentionAssetCategoryId = cat.id;
    const items = (cat.items || []).map(item => ({...item, categoryName:cat.name || '', categoryId:cat.id}));
    const seen = new Set();
    return items.filter(item => {
        if(!item?.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
    }).map((item, index) => ({
        url:item.url,
        kind:S().assetMediaKind(item),
        name:item.name || `璧勪骇${index + 1}`,
        alias:item.name || `璧勪骇${index + 1}`,
        role:'asset',
        categoryName:item.categoryName || '',
        mentionId:`asset_${index}_${Math.random().toString(36).slice(2, 7)}`
    }));
}

function mentionCandidateImages(node, source=S().mentionSource){
    return source === 'asset' ? assetMentionCandidateImages(S().mentionAssetCategoryId) : inputMentionCandidateImages(node);
}

function collectMentionedImagesFromPrompt(){
    const images = [];
    S().collectPromptParts().forEach(part => {
        if(part.type === 'image' && part.url) images.push(part);
    });
    return images;
}

function closeMentionPicker(){
    S().mentionPicker.classList.remove('open');
    S().mentionPicker.innerHTML = '';
}

function saveMentionRange(){
    const sel = window.getSelection();
    if(sel && sel.rangeCount && S().promptInput.contains(sel.anchorNode)){
        S().mentionRange = sel.getRangeAt(0).cloneRange();
    }
}

function textBeforeCaret(){
    const sel = window.getSelection();
    if(!sel || !sel.rangeCount || !S().promptInput.contains(sel.anchorNode)) return '';
    const range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(S().promptInput);
    range.setEnd(sel.anchorNode, sel.anchorOffset);
    return range.toString();
}

function positionMentionPickerAtCaret(){
    const row = S().promptInput.closest('.prompt-row');
    const rowRect = row.getBoundingClientRect();
    let caretRect = null;
    const sel = window.getSelection();
    if(sel && sel.rangeCount){
        const range = sel.getRangeAt(0).cloneRange();
        caretRect = range.getClientRects()[0] || range.getBoundingClientRect();
    }
    const inputRect = S().promptInput.getBoundingClientRect();
    const pickerWidth = S().mentionPicker.offsetWidth || 340;
    const maxLeft = Math.max(4, rowRect.width - pickerWidth - 4);
    const rawLeft = (caretRect?.left || inputRect.left) - rowRect.left - 6;
    const rawTop = (caretRect?.bottom || inputRect.top + 24) - rowRect.top + 2;
    const left = Math.max(4, Math.min(rawLeft, maxLeft));
    const top = Math.max(2, rawTop);
    S().mentionPicker.style.left = `${left}px`;
    S().mentionPicker.style.top = `${top}px`;
}

function renderMentionPicker(source){
    const node = S().selectedNode();
    const inputItems = inputMentionCandidateImages(node);
    const assetCats = S().assetCategories('image');
    const currentAssetCat = S().assetCategoryForMention();
    const assetItems = assetMentionCandidateImages(currentAssetCat?.id || '');
    const hasInput = inputItems.length > 0;
    const hasAssets = assetCats.some(cat => (cat.items || []).some(item => item?.url));
    S().mentionSource = source || (hasInput ? 'input' : 'asset');
    if(S().mentionSource === 'input' && !hasInput && hasAssets) S().mentionSource = 'asset';
    if(S().mentionSource === 'asset' && !hasAssets && hasInput) S().mentionSource = 'input';
    if(!hasInput && !hasAssets){ closeMentionPicker(); return; }
    const candidates = (S().mentionSource === 'asset' ? assetItems : inputItems).slice(0, 36);
    const body = candidates.length ? `<div class="mention-option-grid">${candidates.map((img, i) => `
            <button class="mention-option" type="button" data-mention-index="${i}">
                ${S().mediaKindForItem(img) === 'video' ? `<video src="${S().escapeHtml(img.url)}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video>` : `<img src="${S().escapeHtml(img.url)}" alt="">`}
                <span>${S().escapeHtml(img.alias)}</span>
            </button>
        `).join('')}</div>` : `<div class="mention-empty">${S().escapeHtml(S().tr('smart.mentionEmpty'))}</div>`;
    const folderChips = (S().mentionSource === 'asset' && assetCats.length)
        ? assetCats.map(cat => {
            const label = cat.name || S().tr('smart.assetFolder');
            return `<button class="mention-folder-chip ${cat.id === S().mentionAssetCategoryId ? 'active' : ''}" type="button" data-mention-folder="${S().escapeHtml(cat.id)}" title="${S().escapeHtml(label)}">${S().escapeHtml(label)}</button>`;
          }).join('')
        : '';
    S().mentionPicker.innerHTML = `
        <div class="mention-picker-shell">
            <div class="mention-source-tabs">
                <button class="mention-source-tab ${S().mentionSource === 'input' ? 'active' : ''}" type="button" data-mention-source="input" title="${S().escapeHtml(S().tr('smart.mentionInput'))}" ${hasInput ? '' : 'disabled'}>
                    <i data-lucide="image"></i><span>${S().escapeHtml(S().tr('smart.mentionInput'))}</span>
                </button>
                <button class="mention-source-tab ${S().mentionSource === 'asset' ? 'active' : ''}" type="button" data-mention-source="asset" title="${S().escapeHtml(S().tr('smart.mentionAssets'))}" ${hasAssets ? '' : 'disabled'}>
                    <i data-lucide="library"></i><span>${S().escapeHtml(S().tr('smart.mentionAssets'))}</span>
                </button>
            </div>
            <div class="mention-folder-chips ${folderChips ? '' : 'hidden'}">
                ${folderChips}
            </div>
            <div class="mention-content">
                ${body}
            </div>
        </div>
    `;
    S().mentionPicker._items = candidates;
    positionMentionPickerAtCaret();
    S().mentionPicker.classList.add('open');
    S().mentionPicker.querySelectorAll('[data-mention-source]').forEach(btn => {
        btn.addEventListener('mousedown', e => {
            e.preventDefault(); e.stopPropagation();
            if(btn.disabled) return;
            renderMentionPicker(btn.dataset.mentionSource);
        });
    });
    S().mentionPicker.querySelectorAll('[data-mention-folder]').forEach(btn => {
        btn.addEventListener('mousedown', e => {
            e.preventDefault(); e.stopPropagation();
            S().mentionAssetCategoryId = btn.dataset.mentionFolder || '';
            renderMentionPicker('asset');
        });
    });
    S().mentionPicker.querySelectorAll('[data-mention-index]').forEach(btn => {
        btn.addEventListener('mousedown', e => {
            e.preventDefault(); e.stopPropagation();
            insertMentionToken(S().mentionPicker._items[Number(btn.dataset.mentionIndex)]);
        });
    });
    S().refreshIcons();
}

function showMentionPicker(){
    const node = S().selectedNode();
    const hasInput = inputMentionCandidateImages(node).length > 0;
    S().mentionSource = hasInput ? 'input' : 'asset';
    renderMentionPicker(S().mentionSource);
}

function maybeOpenMentionPicker(){
    saveMentionRange();
    const before = textBeforeCaret();
    if(/@$/.test(before)) showMentionPicker();
    else closeMentionPicker();
}

function insertMentionToken(img){
    if(!img?.url) return;
    S().promptInput.focus();
    const sel = window.getSelection();
    if(S().mentionRange){
        sel.removeAllRanges();
        sel.addRange(S().mentionRange);
    }
    const range = sel.rangeCount ? sel.getRangeAt(0) : document.createRange();
    let removedAt = false;
    if(range.startContainer?.nodeType === Node.TEXT_NODE && range.startOffset > 0){
        const text = range.startContainer.textContent || '';
        if(text[range.startOffset - 1] === '@'){
            range.setStart(range.startContainer, range.startOffset - 1);
            range.deleteContents();
            removedAt = true;
        }
    }
    if(!removedAt) {
        const walker = document.createTreeWalker(S().promptInput, NodeFilter.SHOW_TEXT);
        let lastText = null;
        while(walker.nextNode()) lastText = walker.currentNode;
        if(lastText && /@$/.test(lastText.textContent || '')) {
            lastText.textContent = lastText.textContent.slice(0, -1);
            range.selectNodeContents(S().promptInput);
            range.collapse(false);
        }
    }
    const token = document.createElement('span');
    token.className = 'mention-image-token';
    token.contentEditable = 'false';
    token.dataset.url = img.url;
    token.dataset.name = img.alias || img.name || '鍥剧墖';
    token.dataset.kind = S().mediaKindForItem(img);
    token.dataset.nodeId = img.nodeId || '';
    token.dataset.imageIndex = String(img.imageIndex ?? '');
    token.innerHTML = token.dataset.kind === 'video'
        ? `<video src="${S().escapeHtml(img.url)}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video><span>${S().escapeHtml(token.dataset.name)}</span>`
        : `<img src="${S().escapeHtml(img.url)}" alt=""><span>${S().escapeHtml(token.dataset.name)}</span>`;
    range.insertNode(token);
    const spacer = document.createTextNode(' ');
    token.after(spacer);
    range.setStartAfter(spacer);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    closeMentionPicker();
    S().promptInput.focus();
    S().renderInputThumbsRow(S().selectedNode());
}

function placeMentionPickerInComposerCard(){ 
 const card = S().promptInput?.closest?.('.composer-card'); 
 if(card && S().mentionPicker.parentElement !== card) card.appendChild(S().mentionPicker); 
}


function placeMentionPickerInPromptRow(){ 
 const row = S().promptInput?.closest?.('.prompt-row'); 
 if(row && S().mentionPicker.parentElement !== row) row.insertBefore(S().mentionPicker, S().promptResize || null); 
}


function toggleAssetMentionPickerFromThumbs(){ 
 if(!S().selectedNode()) return; 
 if(mentionInsertMode === 'manual-ref'){ 
 closeMentionPicker(); 
 return; 
 } 
 mentionInsertMode = 'manual-ref'; 
 S().renderInputThumbsRow(S().selectedNode()); 
 mentionAnchorEl = S().inputThumbsRow?.querySelector('[data-input-add-reference]') || S().inputThumbsRow; 
 renderMentionPicker('asset'); 
}



    const api = Object.freeze({
        registerDeps,
        mentionTokenHtml,
        mentionTokenMediaHtml,
        mentionOptionMediaHtml,
        promptHtmlWithMentionTokens,
        inputMentionCandidateImages,
        assetMentionCandidateImages,
        mentionCandidateImages,
        collectMentionedImagesFromPrompt,
        closeMentionPicker,
        saveMentionRange,
        textBeforeCaret,
        positionMentionPickerAtCaret,
        renderMentionPicker,
        showMentionPicker,
        maybeOpenMentionPicker,
        insertMentionToken,
        placeMentionPickerInComposerCard,
        placeMentionPickerInPromptRow,
        toggleAssetMentionPickerFromThumbs
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('mentionPicker', api);
    }
    global.SmartCanvasMentionPicker = api;
})(window);
