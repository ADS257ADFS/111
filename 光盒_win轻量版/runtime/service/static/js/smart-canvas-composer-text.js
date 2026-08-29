/**
 * Smart Canvas — unified bottom-composer adapter for LLM text nodes.
 * Text keeps the existing smart-prompt node and /api/canvas-llm route; image/video
 * settings remain on the existing media generation path.
 */
(function(global){
    'use strict';

    const UNIFIED_TEXT_DEFAULT_WIDTH = 460;
    // 150px body + the unified card chrome (80px) = the 230px audio placeholder height.
    const UNIFIED_TEXT_DEFAULT_MAIN_HEIGHT = 150;
    const UNIFIED_TEXT_DEFAULT_FONT_SIZE = 16;
    const TEXT_OUTPUT_COUNT = 1;

    function applyUnifiedTextDefaultSize(node){
        if(!node) return;
        node.w = UNIFIED_TEXT_DEFAULT_WIDTH;
        node.promptMainHeight = UNIFIED_TEXT_DEFAULT_MAIN_HEIGHT;
        node.promptFontSize = UNIFIED_TEXT_DEFAULT_FONT_SIZE;
    }

    function d(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function replaceSettings(deps, next){
        if(!deps) return null;
        const target = deps.settings && typeof deps.settings === 'object' ? deps.settings : {};
        const source = next && typeof next === 'object' ? next : {};
        if(target !== source){
            Object.keys(target).forEach(key => delete target[key]);
            Object.assign(target, source);
        }
        deps.settings = target;
        return target;
    }

    // 菜单行内容：公司图标 + 模型名（悬停时下方上滑一句话说明）+ 选中对号
    function modelChoiceInner(label, esc){
        const BI = global.ModelBrandIcons;
        const icon = BI ? `<span class="mode-model-ico">${BI.iconFor(label)}</span>` : '';
        const check = BI ? `<span class="mode-model-check">${BI.CHECK_SVG}</span>` : '';
        const desc = BI?.descFor ? BI.descFor(label) : '';
        const descHtml = desc ? `<span class="mode-model-desc">${esc(desc)}</span>` : '';
        return `${icon}<span class="mode-model-copy"><span class="mode-model-title-row"><span class="mode-model-name">${esc(label)}</span></span>${descHtml}</span>${check}`;
    }

    function isTextSubject(node){
        return Boolean(node && node.type === 'smart-prompt' && node.llmEnabled && node.llmComposerUnified === true);
    }

    function activeTextSubject(){
        const deps = d();
        const active = deps?.activeComposerSubject;
        if(isTextSubject(active)) return active;
        const selected = deps?.selectedNode?.();
        return isTextSubject(selected) ? selected : null;
    }

    function modeFor(node=null){
        const deps = d();
        const subject = node || deps?.selectedNode?.();
        if(isTextSubject(subject)) return 'text';
        if(global.SmartCanvasModeBindings?.isVideoOutputNode?.(subject)) return 'video';
        if(subject?.portLinkKind === 'audio' || subject?.outputKind === 'audio') return 'audio';
        const apiKind = deps?.settings?.apiKind;
        if(apiKind === 'video') return 'video';
        if(apiKind === 'audio') return 'audio';
        return 'image';
    }

    function syncMediaSettingsFromNode(settings, node){
        if(!settings || !node || isTextSubject(node)) return settings;
        const mode = modeFor(node);
        if(mode === 'audio'){
            settings.engine = 'api';
            settings.apiKind = 'audio';
        } else if(mode === 'video'){
            settings.engine = 'api';
            settings.apiKind = 'video';
        } else if(mode === 'image'){
            if(settings.apiKind === 'video' || settings.apiKind === 'audio') settings.apiKind = 'image';
        }
        return settings;
    }

    function syncApiButtonLabel(node){
        const label = document.getElementById('composerApiSettingsBtnLabel');
        const icon = document.getElementById('composerApiSettingsBtnIcon');
        const button = document.getElementById('composerApiSettingsBtn');
        const alias = global.SmartCanvasModeBindings?.customNameForModel?.('text', node?.llmModel, node?.llmProvider, node?.llmModelAlias);
        const text = alias || node?.llmModel || 'LLM模型';
        if(label) label.textContent = text;
        if(icon && global.ModelBrandIcons) icon.innerHTML = global.ModelBrandIcons.iconFor(text);
        if(button){
            button.title = text;
            button.setAttribute('aria-label', `当前模型：${text}`);
        }
    }

    function saveInputIfActive(node=null){
        const deps = d();
        const subject = node || activeTextSubject();
        if(!deps || !isTextSubject(subject) || !deps.promptInput) return false;
        subject.llmInstruction = deps.promptPlainText?.() || '';
        subject.llmProvider = deps.resolveChatProviderId?.(subject.llmProvider || '') || subject.llmProvider || '';
        subject.llmModel = deps.resolveChatModel?.(subject.llmModel || '', subject.llmProvider) || subject.llmModel || '';
        return true;
    }

    function loadInput(node){
        const deps = d();
        if(!deps || !isTextSubject(node)) return false;
        deps.setPromptText?.(node.llmInstruction || '');
        if(deps.promptInput){
            deps.promptInput.dataset.placeholder = '输入给 LLM 的内容…';
            delete deps.promptInput.dataset.preserveDraftOnce;
        }
        return true;
    }

    function referencesFor(node){
        if(!isTextSubject(node)) return null;
        const deps = d();
        let primaryRefs = [];
        try { primaryRefs = deps?.promptNodeInputMediaForLLM?.(node) || []; } catch(_error) {}
        const refs = primaryRefs.length ? primaryRefs : (deps?.inputImagesFor?.(node) || []);
        const sources = (node.inputNodeIds || []).map(id => deps?.nodes?.find(item => item.id === id)).filter(Boolean);
        const sourceRefs = sources.flatMap(source => {
            let items = [];
            try { items = deps?.outputImagesForNode?.(source) || []; } catch(_error) {}
            if(!items.length && Array.isArray(source?.images)) items = source.images.filter(item => item?.url);
            return items.map((item, index) => ({
                item,
                nodeId:source.id,
                imageIndex:Number.isFinite(Number(item?.imageIndex)) ? Number(item.imageIndex) : index
            }));
        });
        const normalizedRefs = refs.length ? refs : sourceRefs.map(entry => ({
            ...entry.item,
            nodeId:entry.nodeId,
            imageIndex:entry.imageIndex
        }));
        return normalizedRefs.map((ref, index) => {
            const match = sourceRefs.find(entry => entry.item?.url && entry.item.url === ref?.url);
            return {
                ...ref,
                nodeId:ref?.nodeId || match?.nodeId || '',
                imageIndex:Number.isFinite(Number(ref?.imageIndex)) ? Number(ref.imageIndex) : (match?.imageIndex ?? index)
            };
        });
    }

    function renderControls(node){
        const deps = d();
        if(!deps || !isTextSubject(node)) return false;
        const MB = global.SmartCanvasModeBindings;
        if(MB) MB.applyBindingToTextNode(node);
        node.llmProvider = deps.resolveChatProviderId?.(node.llmProvider || MB?.bindingProviderId('text') || '') || node.llmProvider || '';
        node.llmModel = deps.resolveChatModel?.(node.llmModel || '', node.llmProvider) || node.llmModel || MB?.defaultModel('text') || '';
        const customs = MB?.customRows?.('text') || [];
        const esc = deps.escapeHtml || (v => String(v));
        let listHtml = '';
        if(customs.length){
            // 自定义名字菜单：全部固定名字都显示；未绑定的置灰。
            const bound = entry => entry.provider_id && entry.model;
            // 高亮优先跟随用户实际点选的别名（多个别名可能绑同一个真实模型）
            let activeIdx = customs.findIndex(entry => bound(entry) && entry.name === node.llmModelAlias && entry.model === node.llmModel);
            if(activeIdx < 0) activeIdx = customs.findIndex(entry => bound(entry) && entry.model === node.llmModel && entry.provider_id === node.llmProvider);
            if(activeIdx < 0) activeIdx = customs.findIndex(entry => bound(entry) && entry.model === node.llmModel);
            listHtml = customs.map((entry, idx) => bound(entry)
                ? `<button type="button" class="mode-model-choice ${idx === activeIdx ? 'active' : ''}" data-mode-model-select="text" data-mode-model-value="${esc(entry.name)}">${modelChoiceInner(entry.name, esc)}</button>`
                : `<button type="button" class="mode-model-choice is-unbound" disabled title="未绑定，请在 API 设置 · 画布显示名中绑定平台">${modelChoiceInner(entry.name, esc)}</button>`).join('');
        } else {
            const models = MB?.enabledModels('text') || [];
            listHtml = models.map(model => `<button type="button" class="mode-model-choice ${model === node.llmModel ? 'active' : ''}" data-mode-model-select="text" data-mode-model-value="${esc(model)}">${modelChoiceInner(model, esc)}</button>`).join('');
        }
        deps.composerHeadParams.innerHTML = listHtml
            ? `<div class="composer-submenu-stack composer-model-menu" data-mode-model-menu="text">
                <div class="composer-submenu-section">
                    <div class="composer-submenu-label">模型选择</div>
                    <div class="composer-mode-model-list" data-mode-model-list="text">${listHtml}</div>
                </div>
            </div>`
            : `<div class="muted-note">请先在 API 设置中配置文本模型</div>`;
        deps.dynamicParams.innerHTML = '';

        deps.composerHeadParams.querySelectorAll('[data-mode-model-select]').forEach(button => {
            const apply = () => {
                const value = button.dataset.modeModelValue;
                const custom = MB?.customEntryByName?.('text', value);
                if(custom){
                    node.llmProvider = custom.provider_id;
                    node.llmModel = custom.model;
                    node.llmModelAlias = custom.name;
                    MB?.setGlobalAlias?.('text', custom.name);
                } else {
                    node.llmProvider = deps.resolveChatProviderId?.(MB?.providerForModel('text', value) || MB?.bindingProviderId('text', value) || '') || node.llmProvider;
                    node.llmModel = deps.resolveChatModel?.(value, node.llmProvider) || value;
                    node.llmModelAlias = '';
                }
                renderControls(node);
                deps.scheduleSave?.();
            };
            // pointerdown 即应用，避免菜单在按下与抬起之间被重渲染时丢失
            // click（与图像/视频/音频菜单同一处理）；click 留给键盘触发。
            button.onpointerdown = event => {
                if(event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                button.dataset.modelPicked = '1';
                apply();
            };
            button.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                if(button.dataset.modelPicked === '1'){
                    delete button.dataset.modelPicked;
                    return;
                }
                apply();
            };
        });
        syncApiButtonLabel(node);
        global.lucide?.createIcons?.();
        return true;
    }

    function syncTextSingleOutput(node){
        const deps = d();
        if(!deps || !isTextSubject(node)) return;
        const sizeWrap = document.getElementById('composerSizeWrap');
        const changed = Number(node.llmCount || TEXT_OUTPUT_COUNT) !== TEXT_OUTPUT_COUNT;
        node.llmCount = TEXT_OUTPUT_COUNT;
        if(sizeWrap){
            sizeWrap.hidden = true;
            sizeWrap.classList?.remove('open');
        }
        document.getElementById('composerSizeBtn')?.setAttribute('aria-expanded', 'false');
        if(changed) deps.scheduleSave?.();
    }

    function ensureRunBinding(){
        const button = d()?.runBtn;
        if(!button || button.dataset.composerTextRunBound === '1') return;
        button.dataset.composerTextRunBound = '1';
        button.addEventListener('click', async event => {
            if(!isTextSubject(d()?.selectedNode?.())) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            await runIfActive();
        }, true);
    }

    function syncComposer(node){
        const deps = d();
        if(!deps?.composer) return false;
        const textMode = isTextSubject(node);
        deps.composer.classList.toggle('composer-text-mode', textMode);
        const toggle = document.getElementById('apiKindToggle');
        const activeMode = modeFor(node);
        toggle?.querySelectorAll('[data-kind]').forEach(button => button.classList.toggle('active', button.dataset.kind === activeMode));
        const kindLabel = document.getElementById('composerKindBtnLabel');
        if(kindLabel) kindLabel.textContent = ({audio:'音频', text:'文本', image:'图片', video:'视频'})[activeMode] || '图片';
        // audio / video 模式:主动触发一次 dynamic params 渲染,否则切到 audio 后底部 params 不会刷新
        if(!textMode && (activeMode === 'audio' || activeMode === 'video')){
            try { global.SmartCanvasComposerParams?.renderDynamicParams?.(); } catch(_e) {}
        }
        if(!textMode) return false;
        const apiWrap = document.getElementById('composerApiSettingsWrap');
        const sizeWrap = document.getElementById('composerSizeWrap');
        const videoReferenceWrap = document.getElementById('composerVideoReferenceWrap');
        const videoReferencePanel = document.getElementById('composerVideoReferencePanel');
        const videoReferenceButton = document.getElementById('composerVideoReferenceBtn');
        if(apiWrap) apiWrap.hidden = false;
        if(sizeWrap) sizeWrap.hidden = true;
        if(videoReferenceWrap){
            videoReferenceWrap.hidden = true;
            videoReferenceWrap.classList.remove('open');
        }
        if(videoReferencePanel) videoReferencePanel.innerHTML = '';
        videoReferenceButton?.setAttribute('aria-expanded', 'false');
        deps.composer.classList.remove('is-image-api-mode');
        deps.inputThumbsRow?.classList?.remove('has-co-create-slot');
        ensureRunBinding();
        renderControls(node);
        syncTextSingleOutput(node);
        deps.syncRunButtonState?.(node);
        global.SmartCanvasCoCreate?.syncComposer?.(node);
        return true;
    }

    function copyTextNodeState(target, source){
        target.title = source.title || 'Text';
        target.llmEnabled = true;
        target.llmComposerUnified = true;
        target.llmProvider = source.llmProvider || '';
        target.llmModel = source.llmModel || '';
        target.llmInstruction = source.llmInstruction || '';
        target.llmCount = TEXT_OUTPUT_COUNT;
        target.text = '';
        target.w = source.w || target.w;
        target.promptMainHeight = source.promptMainHeight;
        target.promptFontSize = source.promptFontSize || UNIFIED_TEXT_DEFAULT_FONT_SIZE;
    }

    function createTextRunSiblings(source, count){
        const deps = d();
        if(!deps || !isTextSubject(source) || count <= 1) return [source];
        const rect = deps.nodeRect?.(source) || {width:source.w || 500, height:source.h || 166};
        const startX = Number(source.x || 0);
        const startY = Number(source.y || 0);
        const stepX = Math.max(260, Number(rect.width || 500) + 48);
        const stepY = Math.max(190, Number(rect.height || 166) + 36);
        const inputIds = Array.from(new Set((source.inputNodeIds || []).filter(Boolean)));
        const nodes = [source];
        source.text = '';
        for(let i = 1; i < count; i += 1){
            const col = i % 2;
            const row = Math.floor(i / 2);
            const node = deps.createPromptNode?.(startX + col * stepX, startY + row * stepY, {select:false, skipUndo:true});
            if(!node) continue;
            copyTextNodeState(node, source);
            inputIds.forEach(sourceId => deps.connectInputNode?.(sourceId, node.id));
            nodes.push(node);
        }
        return nodes;
    }

    function mediaNodeHasOutput(node){
        return Boolean((node?.images || []).some(item => item?.url) || node?.running || Number(node?.pending || 0) > 0);
    }

    function textNodeHasOutput(node){
        return Boolean(String(node?.text || '').trim() || node?.running || Number(node?.pending || 0) > 0);
    }

    function boundsForNodes(nodes=[]){
        const rects = nodes.map(node => d()?.nodeRect?.(node)).filter(Boolean);
        if(!rects.length) return null;
        return {
            maxX:Math.max(...rects.map(rect => Number(rect.x || 0) + Number(rect.width || 0))),
            minY:Math.min(...rects.map(rect => Number(rect.y || 0))),
            maxY:Math.max(...rects.map(rect => Number(rect.y || 0) + Number(rect.height || 0)))
        };
    }

    function selectCreatedNode(deps, node){
        deps.selectedIds = [];
        deps.selectedId = node.id;
        deps.selectedImage = {nodeId:'', index:-1};
        deps.selectionMarqueeActive = false;
        deps.hideSelectionGroupBox?.();
        deps.render?.();
        deps.updateComposer?.();
        deps.scheduleSave?.();
    }

    function createConnectedTextNode(sourceIds, sourceNodes=[]){
        const deps = d();
        const ids = Array.from(new Set((sourceIds || []).filter(Boolean)));
        const nodes = sourceNodes.length ? sourceNodes : ids.map(id => deps?.nodes?.find(node => node.id === id)).filter(Boolean);
        const bounds = boundsForNodes(nodes);
        if(!deps || !ids.length || !bounds) return false;
        deps.savePromptDraftForCurrent?.();
        deps.capturePendingUndo?.();
        const node = deps.createPromptNode?.(bounds.maxX + 140, (bounds.minY + bounds.maxY) / 2 - 83, {select:false, skipUndo:true});
        if(!node){ deps.discardPendingUndo?.(); return false; }
        node.title = 'Text';
        node.llmEnabled = true;
        node.llmComposerUnified = true;
        node.llmCount = TEXT_OUTPUT_COUNT;
        applyUnifiedTextDefaultSize(node);
        node.llmProvider = deps.resolveChatProviderId?.(node.llmProvider || '') || node.llmProvider || 'comfly';
        node.llmModel = deps.resolveChatModel?.(node.llmModel || '', node.llmProvider) || node.llmModel || '';
        ids.forEach(sourceId => deps.connectInputNode?.(sourceId, node.id));
        selectCreatedNode(deps, node);
        deps.commitPendingUndo?.();
        return true;
    }

    function createConnectedMediaNode(sourceNode, kind){
        const deps = d();
        const rect = deps?.nodeRect?.(sourceNode);
        if(!deps || !sourceNode?.id || !rect) return false;
        saveInputIfActive(sourceNode);
        deps.capturePendingUndo?.();
        const target = deps.createImageNodeAt?.({
            x:Number(rect.x || 0) + Number(rect.width || 0) + 220,
            y:Number(rect.y || 0) + Number(rect.height || 0) / 2
        }, [], {select:false, skipUndo:true});
        if(!target){ deps.discardPendingUndo?.(); return false; }
        const nextSettings = deps.cloneSmartSettings?.(deps.settings || {}) || {...(deps.settings || {})};
        if(kind === 'audio'){
            nextSettings.engine = 'api';
            nextSettings.apiKind = 'audio';
        } else {
            nextSettings.engine = 'api';
            nextSettings.apiKind = kind;
        }
        target.title = ({audio:'Audio', video:'Video', image:'Image'})[kind] || 'Image';
        target.portLinkKind = kind;
        target.outputKind = kind;
        target.typePlaceholder = true;
        global.SmartCanvasNodeModel?.applyTypedPlaceholderDefaultSize?.(target, kind, {force:true});
        target.runSettings = deps.settingsForStorage?.(nextSettings) || nextSettings;
        deps.connectInputNode?.(sourceNode.id, target.id);
        replaceSettings(deps, deps.smartSettingsForNode?.(target) || nextSettings);
        selectCreatedNode(deps, target);
        deps.commitPendingUndo?.();
        return true;
    }

    function switchMode(kind){
        const deps = d();
        const node = deps?.selectedNode?.();
        if(!deps || !['text','image','video','audio'].includes(kind)) return false;
        if(!node && kind === 'text'){
            const info = global.SmartCanvasMultiSelectCompose?.resolveSelection?.();
            if(info?.sourceIds?.length) return createConnectedTextNode(info.sourceIds, info.nodes || []);
            return false;
        }
        if(!node) return false;
        const current = modeFor(node);
        if(current === kind) return true;

        if(kind === 'text'){
            if(!deps.isSmartImageNode?.(node)){
                const info = global.SmartCanvasMultiSelectCompose?.resolveSelection?.();
                if(info?.sourceIds?.length) return createConnectedTextNode(info.sourceIds, info.nodes || []);
                return false;
            }
            if(mediaNodeHasOutput(node)){
                return createConnectedTextNode([node.id], [node]);
            }
            deps.savePromptDraftForCurrent?.();
            deps.pushUndo?.();
            node._composerMediaState = {
                title:node.title,
                scale:node.scale,
                runSettings:node.runSettings ? deps.settingsForStorage?.(node.runSettings) : null,
                promptDraftHtml:node.promptDraftHtml || '',
                promptDraftText:node.promptDraftText || ''
            };
            const textState = node._composerTextState || {};
            node.type = 'smart-prompt';
            node.title = 'Text';
            node.text = textState.text || '';
            delete node.typePlaceholder;
            delete node.portLinkKind;
            delete node.outputKind;
            node.llmEnabled = true;
            node.llmComposerUnified = true;
            node.llmCount = TEXT_OUTPUT_COUNT;
            applyUnifiedTextDefaultSize(node);
            node.llmProvider = deps.resolveChatProviderId?.(textState.llmProvider || '') || 'comfly';
            node.llmModel = deps.resolveChatModel?.(textState.llmModel || '', node.llmProvider) || '';
            node.llmInstruction = textState.llmInstruction || '';
            node.h = deps.PROMPT_NODE_DEFAULT_HEIGHT || 308;
        } else if(isTextSubject(node)){
            if(textNodeHasOutput(node)){
                return createConnectedMediaNode(node, kind);
            }
            saveInputIfActive(node);
            deps.pushUndo?.();
            node._composerTextState = {
                text:node.text || '',
                llmProvider:node.llmProvider || '',
                llmModel:node.llmModel || '',
                llmInstruction:node.llmInstruction || ''
            };
            const mediaState = node._composerMediaState || {};
            node.type = 'smart-image';
            node.title = ({audio:'Audio', video:'Video', image:'Image'})[kind] || mediaState.title || 'Image';
            node.images = [];
            node.portLinkKind = kind;
            node.outputKind = kind;
            node.typePlaceholder = true;
            node.scale = Number(mediaState.scale) || deps.mediaNodeDefaultScale?.(node) || 1;
            delete node.w;
            delete node.h;
            global.SmartCanvasNodeModel?.applyTypedPlaceholderDefaultSize?.(node, kind, {force:true});
            const nextSettings = deps.cloneSmartSettings?.(mediaState.runSettings || deps.settings || {}) || {...(deps.settings || {})};
            if(kind === 'audio'){
                nextSettings.engine = 'api';
                nextSettings.apiKind = 'audio';
            } else {
                nextSettings.engine = 'api';
                nextSettings.apiKind = kind;
            }
            node.runSettings = deps.settingsForStorage?.(nextSettings) || nextSettings;
            node.promptDraftHtml = mediaState.promptDraftHtml || '';
            node.promptDraftText = mediaState.promptDraftText || '';
            replaceSettings(deps, deps.smartSettingsForNode?.(node) || nextSettings);
        } else if(deps.isSmartImageNode?.(node)){
            if(mediaNodeHasOutput(node)) return createConnectedMediaNode(node, kind);
            deps.pushUndo?.();
            const nextSettings = deps.cloneSmartSettings?.(node.runSettings || deps.settings || {}) || {...(deps.settings || {})};
            if(kind === 'audio'){
                nextSettings.engine = 'api';
                nextSettings.apiKind = 'audio';
            } else {
                nextSettings.engine = 'api';
                nextSettings.apiKind = kind;
            }
            node.title = ({audio:'Audio', video:'Video', image:'Image'})[kind] || 'Image';
            node.portLinkKind = kind;
            node.outputKind = kind;
            node.typePlaceholder = true;
            global.SmartCanvasNodeModel?.applyTypedPlaceholderDefaultSize?.(node, kind, {force:true});
            node.runSettings = deps.settingsForStorage?.(nextSettings) || nextSettings;
            replaceSettings(deps, deps.smartSettingsForNode?.(node) || nextSettings);
        } else {
            return false;
        }

        deps.selectedId = node.id;
        deps.selectedIds = [];
        deps.selectedImage = {nodeId:'', index:-1};
        deps.render?.();
        deps.updateComposer?.();
        deps.scheduleSave?.();
        return true;
    }

    async function runIfActive(){
        const deps = d();
        const node = deps?.selectedNode?.();
        if(!isTextSubject(node)) return false;
        saveInputIfActive(node);
        node.llmCount = TEXT_OUTPUT_COUNT;
        if(typeof deps.runPromptLLMNode !== 'function'){
            deps.toast?.('文本运行模块尚未就绪，请刷新后重试');
            return true;
        }
        const coCreate = global.SmartCanvasCoCreate;
        if(coCreate?.isEnabled?.(node)){
            const entries = coCreate.promptEntries?.(node) || [];
            if(!entries.length){
                deps.toast?.('请至少填写一条提示词');
                return true;
            }
            const perPromptCount = TEXT_OUTPUT_COUNT;
            const runPrompts = entries.flatMap(entry => Array.from({length:perPromptCount}, () => entry.text));
            deps.capturePendingUndo?.();
            const runNodes = createTextRunSiblings(node, runPrompts.length);
            runNodes.forEach((item, index) => {
                item.llmInstruction = runPrompts[index] || runPrompts[0] || '';
                item.coCreateEnabled = true;
                item.coCreatePrompts = entries.map(entry => entry.text);
                item.coCreatePerGroupCount = perPromptCount;
                item.coCreateGroupIndex = Math.floor(index / perPromptCount);
            });
            deps.selectedId = node.id;
            deps.selectedIds = [];
            deps.selectedImage = {nodeId:'', index:-1};
            deps.render?.();
            deps.updateComposer?.();
            deps.commitPendingUndo?.();
            for(const item of runNodes) await deps.runPromptLLMNode(item.id);
            deps.scheduleSave?.();
            return true;
        }
        await deps.runPromptLLMNode(node.id);
        return true;
    }

    const api = Object.freeze({
        applyUnifiedTextDefaultSize,
        isTextSubject,
        activeTextSubject,
        modeFor,
        syncMediaSettingsFromNode,
        saveInputIfActive,
        loadInput,
        referencesFor,
        createConnectedTextNode,
        createConnectedMediaNode,
        renderControls,
        ensureRunBinding,
        syncComposer,
        switchMode,
        runIfActive
    });
    global.SmartCanvasCore?.register?.('composerText', api);
    global.SmartCanvasComposerText = api;
})(window);
