/**
 * Smart Canvas — compact footer previews for assets and saved prompts.
 */
(function(global){
    'use strict';

    const state = { mode:'image', assetsLoaded:false, promptsLoaded:false, hoverHideTimer:0 };
    const els = {};

    function icon(name){
        const node = document.createElement('i');
        node.dataset.lucide = name;
        return node;
    }

    function refreshIcons(root=document){
        global.lucide?.createIcons?.({ attrs:{ 'stroke-width':1.5 }, nameAttr:'data-lucide', root });
    }

    function currentMode(){
        return document.querySelector('#apiKindToggle [data-kind].active')?.dataset.kind
            || global.SmartCanvasComposerText?.modeFor?.(null)
            || 'image';
    }

    function closeWrap(wrap, button, panel){
        wrap?.classList.remove('open');
        button?.setAttribute('aria-expanded', 'false');
        if(panel){
            panel.setAttribute('aria-hidden', 'true');
            panel.hidden = true;
        }
        hideAssetHoverPreview(true);
    }

    function closeAll(except){
        if(except !== els.assetWrap) closeWrap(els.assetWrap, els.assetBtn, els.assetPanel);
        if(except !== els.promptWrap) closeWrap(els.promptWrap, els.promptBtn, els.promptPanel);
    }

    function showEmpty(body, iconName, text){
        body.replaceChildren();
        const empty = document.createElement('div');
        empty.className = 'composer-mini-preview-empty';
        empty.append(icon(iconName));
        const label = document.createElement('span');
        label.textContent = text;
        empty.append(label);
        body.append(empty);
        refreshIcons(empty);
    }

    function assetType(item, category){
        return String(item?.kind || item?.type || category?.type || 'image').toLowerCase();
    }

    function flattenAssets(payload){
        const libraries = payload?.library?.libraries || [];
        const desired = state.mode === 'video' ? 'video' : 'image';
        const items = [];
        libraries.forEach(library => {
            (library.categories || []).forEach(category => {
                (category.items || []).forEach(item => {
                    const type = assetType(item, category);
                    if(type === desired) items.push({ ...item, kind:type, categoryName:category.name || '' });
                });
            });
            (library.items || []).forEach(item => {
                const type = assetType(item);
                if(type === desired) items.push({ ...item, kind:type });
            });
        });
        return items.slice(0, 60);
    }

    function ensureAssetHoverPreview(){
        if(els.assetHoverPreview) return els.assetHoverPreview;
        const preview = document.createElement('div');
        preview.className = 'composer-asset-hover-preview';
        preview.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.className = 'composer-asset-hover-preview-name';
        preview.append(name);
        document.body.append(preview);
        els.assetHoverPreview = preview;
        return preview;
    }

    function positionAssetHoverPreview(anchor){
        const preview = els.assetHoverPreview;
        if(!preview || !anchor) return;
        const anchorRect = anchor.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();
        const width = previewRect.width || 240;
        const height = previewRect.height || 280;
        const gap = 10;
        const edge = 12;
        let left = anchorRect.right + gap;
        if(left + width > window.innerWidth - edge) left = anchorRect.left - width - gap;
        left = Math.max(edge, Math.min(left, window.innerWidth - width - edge));
        let top = anchorRect.top + (anchorRect.height - height) / 2;
        top = Math.max(edge, Math.min(top, window.innerHeight - height - edge));
        preview.style.left = `${Math.round(left)}px`;
        preview.style.top = `${Math.round(top)}px`;
    }

    function hideAssetHoverPreview(immediate=false){
        window.clearTimeout(state.hoverHideTimer);
        state.hoverHideTimer = 0;
        const preview = els.assetHoverPreview;
        if(!preview) return;
        const finish = () => {
            preview.classList.remove('is-visible');
            preview.setAttribute('aria-hidden', 'true');
            const video = preview.querySelector('video');
            video?.pause?.();
        };
        if(immediate) finish();
        else state.hoverHideTimer = window.setTimeout(finish, 70);
    }

    function showAssetHoverPreview(anchor, item){
        if(!item?.url) return;
        window.clearTimeout(state.hoverHideTimer);
        state.hoverHideTimer = 0;
        const preview = ensureAssetHoverPreview();
        const currentMedia = preview.querySelector('.composer-asset-hover-preview-media');
        currentMedia?.remove();
        const media = document.createElement(item.kind === 'video' ? 'video' : 'img');
        media.className = 'composer-asset-hover-preview-media';
        media.src = item.url;
        if(item.kind === 'video'){
            media.muted = true;
            media.loop = true;
            media.playsInline = true;
            media.preload = 'metadata';
            media.autoplay = true;
        } else {
            media.alt = item.name || '素材预览';
        }
        preview.prepend(media);
        preview.querySelector('.composer-asset-hover-preview-name').textContent = item.name || item.categoryName || '未命名素材';
        preview.setAttribute('aria-hidden', 'false');
        positionAssetHoverPreview(anchor);
        media.addEventListener('load', () => positionAssetHoverPreview(anchor), { once:true });
        media.addEventListener('loadedmetadata', () => positionAssetHoverPreview(anchor), { once:true });
        requestAnimationFrame(() => {
            positionAssetHoverPreview(anchor);
            preview.classList.add('is-visible');
            const playback = media.play?.();
            playback?.catch?.(() => {});
        });
    }

    function renderAssets(items){
        hideAssetHoverPreview(true);
        els.assetCount.textContent = `${items.length} 项`;
        if(!items.length){
            showEmpty(els.assetBody, 'library', state.mode === 'video' ? '暂无视频素材' : '暂无图片素材');
            return;
        }
        els.assetBody.replaceChildren();
        items.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'composer-preview-asset-item';
            button.title = item.name || '使用素材';
            const thumb = document.createElement('span');
            thumb.className = 'composer-preview-asset-thumb';
            if(item.url){
                const media = document.createElement(item.kind === 'video' ? 'video' : 'img');
                media.src = item.url;
                media.alt = item.name || '';
                if(item.kind === 'video'){
                    media.muted = true;
                    media.preload = 'metadata';
                    media.playsInline = true;
                }
                thumb.append(media);
            } else {
                thumb.append(icon(item.kind === 'video' ? 'film' : 'image'));
            }
            const name = document.createElement('span');
            name.className = 'composer-preview-asset-name';
            name.textContent = item.name || item.categoryName || '未命名素材';
            button.append(thumb, name);
            button.addEventListener('click', () => {
                hideAssetHoverPreview(true);
                global.SmartCanvasAssetLibrary?.applyAssetReference?.(item);
                closeAll();
            });
            button.addEventListener('pointerenter', () => showAssetHoverPreview(button, item));
            button.addEventListener('pointerleave', () => hideAssetHoverPreview());
            button.addEventListener('focus', () => showAssetHoverPreview(button, item));
            button.addEventListener('blur', () => hideAssetHoverPreview());
            els.assetBody.append(button);
        });
        refreshIcons(els.assetBody);
    }

    function flattenPrompts(payload){
        const libraries = payload?.library?.libraries || [];
        const prompts = [];
        libraries.forEach(library => {
            (library.items || []).forEach(item => prompts.push({ ...item, libraryName:library.name || '' }));
            (library.categories || []).forEach(category => {
                (category.items || []).forEach(item => prompts.push({ ...item, categoryName:category.name || '', libraryName:library.name || '' }));
            });
        });
        return prompts.slice(0, 10);
    }

    function promptText(item){
        return String(item?.positive || item?.prompt || item?.text || item?.content || '').trim();
    }

    function insertPrompt(item){
        const text = promptText(item);
        if(!text) return;
        const input = document.getElementById('promptInput');
        if(!input) return;
        global.SmartCanvasPromptInput?.setPromptText?.(text);
        if(input.textContent !== text) input.textContent = text;
        input.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:text }));
        input.focus({ preventScroll:true });
        closeAll();
    }

    function renderPrompts(items){
        els.promptCount.textContent = `${items.length} 条`;
        if(!items.length){
            showEmpty(els.promptBody, 'message-square-text', '暂无保存的提示词');
            return;
        }
        els.promptBody.replaceChildren();
        items.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'composer-preview-prompt-item';
            const title = document.createElement('strong');
            title.textContent = item.name || item.title || '未命名提示词';
            const preview = document.createElement('small');
            preview.textContent = promptText(item) || item.categoryName || item.libraryName || '点击使用';
            button.append(title, preview);
            button.addEventListener('click', () => insertPrompt(item));
            els.promptBody.append(button);
        });
    }

    async function loadAssets(){
        els.assetCount.textContent = '加载中';
        showEmpty(els.assetBody, 'loader-circle', '正在读取资产库');
        try {
            const response = await fetch('/api/asset-library', { cache:'no-store' });
            if(!response.ok) throw new Error(`HTTP ${response.status}`);
            renderAssets(flattenAssets(await response.json()));
            state.assetsLoaded = true;
        } catch(error){
            console.warn('[footer-previews] asset library:', error);
            els.assetCount.textContent = '读取失败';
            showEmpty(els.assetBody, 'circle-alert', '资产库暂时无法读取');
        }
    }

    async function loadPrompts(){
        els.promptCount.textContent = '加载中';
        showEmpty(els.promptBody, 'loader-circle', '正在读取提示词');
        try {
            const response = await fetch('/api/prompt-libraries', { cache:'no-store' });
            if(!response.ok) throw new Error(`HTTP ${response.status}`);
            renderPrompts(flattenPrompts(await response.json()));
            state.promptsLoaded = true;
        } catch(error){
            console.warn('[footer-previews] prompt library:', error);
            els.promptCount.textContent = '读取失败';
            showEmpty(els.promptBody, 'circle-alert', '提示词暂时无法读取');
        }
    }

    // 不再弹独立小面板：按钮直接开合真正的资产库面板。
    // 资产库按钮 = 媒体标签页；提示词按钮 = 提示词标签页；再点一次收起。
    function toggle(kind){
        const AL = global.SmartCanvasAssetLibrary;
        const deps = global.SmartCanvasCore?.tryDeps?.();
        if(!AL || !deps) return;
        const isAsset = kind === 'asset';
        const panelOpen = document.documentElement.classList.contains('asset-library-open');
        const onPromptTab = deps.assetTab === 'prompt';
        const onWantedTab = isAsset ? !onPromptTab : onPromptTab;
        if(panelOpen && onWantedTab){
            AL.toggleAssetLibrary(false);
        } else {
            if(isAsset){
                if(onPromptTab) deps.assetTab = 'image';
            } else {
                deps.assetTab = 'prompt';
            }
            global.SmartCanvasComposerParams?.closeComposerApiSettings?.();
            AL.toggleAssetLibrary(true);
            AL.renderAssetLibrary();
        }
        syncPanelButtons();
    }

    // 面板也可能从别处开合（顶栏按钮/Esc），监听状态类保持按钮高亮同步
    function syncPanelButtons(){
        const deps = global.SmartCanvasCore?.tryDeps?.();
        const panelOpen = document.documentElement.classList.contains('asset-library-open');
        const onPromptTab = deps?.assetTab === 'prompt';
        els.assetBtn?.classList.toggle('active', panelOpen && !onPromptTab);
        els.assetBtn?.setAttribute('aria-expanded', String(panelOpen && !onPromptTab));
        els.promptBtn?.classList.toggle('active', panelOpen && onPromptTab);
        els.promptBtn?.setAttribute('aria-expanded', String(panelOpen && onPromptTab));
    }

    function syncMode(){
        const next = currentMode();
        if(next !== state.mode){
            state.mode = next;
            state.assetsLoaded = false;
        }
        const hidden = next === 'audio';
        els.assetWrap.hidden = hidden;
        els.promptWrap.hidden = hidden;
        if(hidden) closeAll();
    }

    function init(){
        Object.assign(els, {
            assetWrap:document.getElementById('composerAssetPreviewWrap'),
            assetBtn:document.getElementById('composerAssetPreviewBtn'),
            assetPanel:document.getElementById('composerAssetPreviewPanel'),
            assetBody:document.getElementById('composerAssetPreviewBody'),
            assetCount:document.getElementById('composerAssetPreviewCount'),
            promptWrap:document.getElementById('composerPromptPreviewWrap'),
            promptBtn:document.getElementById('composerPromptPreviewBtn'),
            promptPanel:document.getElementById('composerPromptPreviewPanel'),
            promptBody:document.getElementById('composerPromptPreviewBody'),
            promptCount:document.getElementById('composerPromptPreviewCount')
        });
        if(!els.assetBtn || !els.promptBtn) return;

        els.assetBtn.addEventListener('click', event => { event.stopPropagation(); toggle('asset'); });
        els.promptBtn.addEventListener('click', event => { event.stopPropagation(); toggle('prompt'); });
        // 旧的独立小面板永久隐藏（按钮现在直接控制资产库面板）
        if(els.assetPanel) els.assetPanel.hidden = true;
        if(els.promptPanel) els.promptPanel.hidden = true;
        // 资产库面板开合状态（含从顶栏/Esc 触发的）→ 同步按钮高亮
        new MutationObserver(syncPanelButtons)
            .observe(document.documentElement, { attributes:true, attributeFilter:['class'] });
        syncPanelButtons();

        const toggleRoot = document.getElementById('apiKindToggle');
        toggleRoot?.addEventListener('click', () => queueMicrotask(syncMode));
        if(toggleRoot){
            new MutationObserver(syncMode).observe(toggleRoot, { subtree:true, attributes:true, attributeFilter:['class'] });
        }
        syncMode();
        showEmpty(els.assetBody, 'library', '暂无图片素材');
        showEmpty(els.promptBody, 'message-square-text', '暂无保存的提示词');
        closeAll();
        refreshIcons();
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
    else init();
})(window);
