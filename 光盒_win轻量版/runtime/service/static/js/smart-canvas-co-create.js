(function(global){
    'use strict';
    const DEFAULT_LINES = 2, MAX_LINES = 6, MIN_LINES = 1;
    let panelEl = null, toggleBarEl = null, switchBtn = null;
    function d(){ return global.SmartCanvasCore?.tryDeps?.() ?? null; }
    function renderApi(){ return global.SmartCanvasCoCreateRender || null; }
    function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function isEnabled(node){ return Boolean(node?.coCreateEnabled); }
    function isSupportedNode(deps, node){
        return Boolean(deps?.isSmartImageNode?.(node) || global.SmartCanvasComposerText?.isTextSubject?.(node));
    }
    function shouldRun(node){ const deps = d(); return Boolean(deps?.isSmartImageNode?.(node) && isEnabled(node)); }
    function defaultPromptLines(){ return Array.from({length: DEFAULT_LINES}, () => ''); }
    function normalizePromptLines(lines){
        const out = (Array.isArray(lines) ? lines : []).slice(0, MAX_LINES).map(line => String(line ?? ''));
        while(out.length < DEFAULT_LINES) out.push('');
        return out;
    }
    function readPromptLinesFromPanel(){
        if(!panelEl) return [];
        return [...panelEl.querySelectorAll('[data-co-create-input]')].map(el => String(el.value || '').trim());
    }
    function validPromptEntries(lines){
        return (lines || []).map((text, index) => ({text: String(text || '').trim(), index})).filter(entry => entry.text);
    }
    function savePromptsToNode(node){
        if(!node || !panelEl) return;
        node.coCreatePrompts = normalizePromptLines([...panelEl.querySelectorAll('[data-co-create-input]')].map(el => el.value || ''));
    }
    function renderPromptLines(lines){
        if(!panelEl) return;
        const list = panelEl.querySelector('[data-co-create-lines]');
        const addBtn = panelEl.querySelector('[data-co-create-add]');
        if(!list) return;
        const normalized = normalizePromptLines(lines).slice(0, MAX_LINES);
        list.innerHTML = normalized.map((line, index) => {
            const canRemove = normalized.length > MIN_LINES;
            return `<div class="co-create-line" data-co-create-line="${index}"><span class="co-create-line-index">${index + 1}</span><textarea class="co-create-line-input" data-co-create-input rows="1" placeholder="输入提示词 ${index + 1}">${escapeHtml(line)}</textarea><button type="button" class="co-create-line-remove" data-co-create-remove="${index}" title="删除" aria-label="删除" ${canRemove ? '' : 'disabled'}><span aria-hidden="true">×</span></button></div>`;
        }).join('');
        if(addBtn) addBtn.disabled = normalized.length >= MAX_LINES;
    }
    function loadPromptsToPanel(node){ if(panelEl) renderPromptLines(normalizePromptLines(node?.coCreatePrompts)); }
    function ensurePanel(composerCard){
        if(panelEl?.isConnected) return panelEl;
        if(!composerCard) return null;
        panelEl = document.createElement('div');
        panelEl.id = 'coCreatePanel';
        panelEl.className = 'co-create-panel';
        panelEl.innerHTML = '<div class="co-create-lines" data-co-create-lines></div><div class="co-create-toolbar"><button type="button" class="co-create-add-btn" data-co-create-add><span class="co-create-add-icon" aria-hidden="true">+</span><span>添加</span></button></div>';
        const promptRow = composerCard.querySelector('.prompt-row');
        if(promptRow) promptRow.insertAdjacentElement('afterend', panelEl);
        else composerCard.appendChild(panelEl);
        bindPanelEvents();
        renderPromptLines(defaultPromptLines());
        return panelEl;
    }
    function removeLegacyBarSlot(){
        document.getElementById('coCreateBarSlot')?.remove();
    }
    function bindSwitchClick(btn){
        if(!btn || btn.dataset.coCreateSwitchBound === '1') return;
        btn.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const deps = d();
            const node = deps?.selectedNode?.();
            if(!isSupportedNode(deps, node)) return;
            setEnabled(node, !isEnabled(node));
            syncComposer(node);
            deps?.scheduleComposerReposition?.(node);
        });
        btn.dataset.coCreateSwitchBound = '1';
    }
    function mountCoCreateSwitchMarkup(host){
        if(!host) return null;
        host.innerHTML = '<span class="co-create-switch-label">共创</span><button type="button" class="co-create-switch" aria-pressed="false" aria-label="共创" data-co-create-switch><span class="co-create-switch-track" aria-hidden="true"><span class="co-create-switch-thumb"></span></span></button>';
        switchBtn = host.querySelector('[data-co-create-switch]');
        bindSwitchClick(switchBtn);
        return switchBtn;
    }
    function ensureToggleBar(actions){
        if(!actions) return null;
        removeLegacyBarSlot();
        if(!toggleBarEl){
            toggleBarEl = document.createElement('div');
            toggleBarEl.className = 'co-create-bar';
            toggleBarEl.dataset.coCreateBar = '1';
            mountCoCreateSwitchMarkup(toggleBarEl);
        } else if(!toggleBarEl.querySelector('.co-create-switch-track')){
            mountCoCreateSwitchMarkup(toggleBarEl);
        } else {
            switchBtn = toggleBarEl.querySelector('[data-co-create-switch]');
            bindSwitchClick(switchBtn);
        }
        if(!actions.contains(toggleBarEl)){
            const kindToggle = actions.querySelector('#apiKindToggle');
            if(kindToggle) actions.insertBefore(toggleBarEl, kindToggle);
            else actions.prepend(toggleBarEl);
        }
        return toggleBarEl;
    }
    function removeLegacyFooterToggle(){
        document.getElementById('coCreateToggleBtn')?.remove();
    }
    function bindPanelEvents(){
        if(!panelEl || panelEl.dataset.coCreateBound === '1') return;
        panelEl.addEventListener('input', () => {
            const node = d()?.selectedNode?.();
            savePromptsToNode(node);
        });
        panelEl.addEventListener('click', event => {
            if(event.target.closest('[data-co-create-add]')){
                event.preventDefault();
                event.stopPropagation();
                const current = readPromptLinesFromPanel();
                if(current.length >= MAX_LINES) return;
                current.push('');
                renderPromptLines(current);
                savePromptsToNode(d()?.selectedNode?.());
                return;
            }
            const removeBtn = event.target.closest('[data-co-create-remove]');
            if(removeBtn){
                event.preventDefault();
                event.stopPropagation();
                const index = Number(removeBtn.dataset.coCreateRemove);
                const current = readPromptLinesFromPanel();
                if(current.length <= MIN_LINES || !Number.isFinite(index)) return;
                current.splice(index, 1);
                renderPromptLines(current);
                savePromptsToNode(d()?.selectedNode?.());
            }
        });
        panelEl.dataset.coCreateBound = '1';
    }
    function setEnabled(node, enabled){
        if(!node) return;
        node.coCreateEnabled = Boolean(enabled);
        if(node.coCreateEnabled && (!Array.isArray(node.coCreatePrompts) || !node.coCreatePrompts.length)) node.coCreatePrompts = defaultPromptLines();
    }
    function syncBarMetrics(composer){
        if(!composer || !toggleBarEl) return;
        toggleBarEl.style.removeProperty('width');
    }
    function syncSwitchVisual(enabled){
        if(!switchBtn) return;
        switchBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        switchBtn.classList.toggle('is-on', enabled);
    }
    function syncComposer(node){
        const deps = d();
        const composer = deps?.composer;
        if(!composer) return;
        const card = composer.querySelector('.composer-card');
        const thumbsRow = deps?.inputThumbsRow;
        const actions = composer.querySelector('#composerCoCreateSlot') || composer.querySelector('.composer-actions');
        removeLegacyFooterToggle();
        const imageNode = deps?.isSmartImageNode?.(node);
        const showBar = isSupportedNode(deps, node);
        composer.classList.toggle('is-image-api-mode', Boolean(imageNode));
        if(!showBar){
            composer.classList.remove('co-create-mode');
            thumbsRow?.classList.remove('has-co-create-slot');
            if(toggleBarEl) toggleBarEl.hidden = true;
            return;
        }
        ensurePanel(card);
        ensureToggleBar(actions);
        if(switchBtn) switchBtn.setAttribute('aria-label', '共创');
        thumbsRow?.classList.remove('has-co-create-slot');
        if(toggleBarEl) toggleBarEl.hidden = false;
        syncBarMetrics(composer);
        const enabled = isEnabled(node) || Boolean(node?.coCreateGroupMeta?.length);
        composer.classList.toggle('co-create-mode', enabled);
        syncSwitchVisual(isEnabled(node) || Boolean(node?.coCreateGroupMeta?.length));
        if(enabled) loadPromptsToPanel(node);
        else if(panelEl) panelEl.querySelector('[data-co-create-lines]')?.replaceChildren?.();
    }
    function promptEntries(node){
        if(node) savePromptsToNode(node);
        return validPromptEntries(node?.coCreatePrompts || readPromptLinesFromPanel());
    }
    function buildRunHelpers(deps){
        return { escapeHtml: deps.escapeHtml || escapeHtml, escapeAttr: deps.escapeAttr || escapeHtml, tr: deps.tr || (k => k), imageForDisplay: deps.imageForDisplay, thumbMediaHtml: deps.thumbMediaHtml, imageResolutionBadgeHtml: deps.imageResolutionBadgeHtml, mediaKindForItem: deps.mediaKindForItem, selectedImage: deps.selectedImage };
    }
    function renderNodeBody(node, layout){ const R = renderApi(), deps = d(); return R?.renderNodeBody && deps ? R.renderNodeBody(node, layout, buildRunHelpers(deps)) : ''; }
    function adjustLayout(node, layout, images, scale){
        const next = renderApi()?.adjustLayout?.(node, layout, images, scale) || null;
        if(next){
            delete node.w;
            delete node.h;
        }
        return next;
    }
    function hasGroupedOutput(node){ return renderApi()?.hasGroupedOutput?.(node) || false; }
    function blocksThumbReorder(node){ return renderApi()?.blocksThumbReorder?.(node) || false; }
    function isNodeDragSurface(node, target){ return renderApi()?.isNodeDragSurface?.(node, target) || false; }
    function allowsThumbDetach(node){ return renderApi()?.allowsThumbDetach?.(node) || false; }
    function stripDetachImage(img){
        if(!img || typeof img !== 'object') return img;
        const out = {...img};
        delete out.coCreateGroupIndex;
        delete out.coCreatePrompt;
        return out;
    }
    function afterImageDetached(node){
        if(!node) return {empty: true};
        const remaining = node.images || [];
        if(!remaining.length){
            delete node.coCreateGroupMeta;
            delete node.coCreateEnabled;
            delete node.coCreatePerGroupCount;
            delete node.coCreatePrompts;
            delete node.coCreateRefAspect;
            return {empty: true};
        }
        const activeGroups = new Set(remaining.map(img => Number(img?.coCreateGroupIndex)).filter(n => Number.isFinite(n)));
        if(Array.isArray(node.coCreateGroupMeta)){
            node.coCreateGroupMeta = node.coCreateGroupMeta.filter(g => activeGroups.has(Number(g?.groupIndex)));
            if(!node.coCreateGroupMeta.length) delete node.coCreateGroupMeta;
        }
        if(!hasGroupedOutput(node)){
            node.title = remaining.length > 1 ? 'Group' : 'Image';
            delete node.coCreateEnabled;
            delete node.coCreatePerGroupCount;
            delete node.coCreatePrompts;
            delete node.coCreateRefAspect;
        }
        delete node.w;
        delete node.h;
        return {empty: false};
    }
    function buildRefsForRun(deps, node){ return deps.buildPromptRequest?.(node, null, true, deps.smartLoopContext)?.refs || []; }
    function nodeHasOutputImages(node){ return (node?.images || []).some(img => img?.url); }
    function buildRunPlan(entries, perGroupCount){
        const count = Math.max(1, Number(perGroupCount) || 1);
        return (entries || []).flatMap((entry, groupIndex) => (
            Array.from({length:count}, (_, itemIndex) => ({
                prompt:String(entry?.text || ''),
                groupIndex,
                itemIndex
            }))
        ));
    }
    function applyPendingBox(node, pendingBox){
        if(!node || !pendingBox) return;
        node.w = pendingBox.w;
        node.h = pendingBox.h;
        node._pendingCellW = pendingBox.cellW;
        node._pendingCellH = pendingBox.cellH;
        node._pendingCellAspect = pendingBox.aspect;
    }
    function prepareReusableSourceTarget(deps, sourceNode, meta, refs, outputKind, runSettings){
        if(!sourceNode) return null;
        const pendingKind = outputKind === 'video' ? 'video' : 'image';
        const pendingBox = deps.pendingBoxSize?.(1, {sourceNode, refs, settings:runSettings}) || null;
        sourceNode.type = 'smart-image';
        sourceNode.images = [];
        // Keep an explicit typed placeholder behind the pending state. If a
        // render happens while a task is being cancelled or rejected, the node
        // can only fall back to the clean media placeholder, never the legacy
        // upload-node panel.
        sourceNode.typePlaceholder = true;
        sourceNode.portLinkKind = pendingKind;
        sourceNode.outputKind = pendingKind;
        sourceNode.title = pendingKind === 'video' ? 'Video' : 'Image';
        sourceNode.pending = 1;
        sourceNode.pendingTasks = [];
        sourceNode.pendingOutputKind = pendingKind;
        sourceNode.runStartedAt = deps.nowMs?.() || Date.now();
        sourceNode.runTimerHidden = false;
        delete sourceNode.runFinishedAt;
        delete sourceNode.runElapsedMs;
        applyPendingBox(sourceNode, pendingBox);
        sourceNode._selectAfterRunId = sourceNode.id;
        deps.attachRunMeta?.(sourceNode, meta);
        return sourceNode;
    }
    function prepareSeparateRunTargets(deps, sourceNode, runPlan, meta, refs, mediaKind, runSettings){
        const plan = (runPlan || []).filter(item => item?.prompt);
        if(!plan.length) return {runNodes:[], runPlan:[]};
        const outputKind = mediaKind === 'video' ? 'video' : 'image';
        let runNodes = [];
        const reuseEmptySource = !nodeHasOutputImages(sourceNode);
        if(reuseEmptySource){
            const sourceTarget = prepareReusableSourceTarget(deps, sourceNode, meta, refs, outputKind, runSettings);
            if(sourceTarget){
                sourceTarget.pending = plan.length;
                const pendingBox = deps.pendingBoxSize?.(plan.length, {sourceNode, refs, settings:runSettings});
                applyPendingBox(sourceTarget, pendingBox);
                runNodes = [sourceTarget];
            }
        } else if(plan.length > 1 && typeof deps.createPendingOutputBatchFromSource === 'function'){
            runNodes = deps.createPendingOutputBatchFromSource(sourceNode, plan.length, meta, {
                connectSource:false,
                selectOutput:true,
                refs,
                stripInputMeta:true,
                outputKind
            }) || [];
        } else {
            const target = prepareRunTarget(deps, sourceNode, 1, meta, refs)?.runNode;
            if(target) runNodes = [target];
        }
        const batchId = `co-create-${Number(meta?.createdAt || deps.nowMs?.() || Date.now())}`;
        if(runNodes.length === 1 && plan.length > 1){
            const runNode = runNodes[0];
            const item = plan[0];
            runNode.pending = plan.length;
            runNode.pendingTasks = [];
            runNode.pendingOutputKind = outputKind;
            runNode.runStartedAt = deps.nowMs?.() || Date.now();
            runNode.runTimerHidden = false;
            runNode.coCreateBatchId = batchId;
            runNode.coCreateGroupIndex = item?.groupIndex ?? 0;
            runNode.coCreateItemIndex = item?.itemIndex ?? 0;
            runNode.coCreatePrompt = item?.prompt || '';
            runNode.runPrompt = item?.prompt || '';
            runNode.runModelPrompt = item?.prompt || '';
            runNode.promptDraftText = item?.prompt || '';
            runNode.promptDraftHtml = deps.escapeHtml?.(item?.prompt || '') || item?.prompt || '';
            delete runNode.coCreateGroupMeta;
            delete runNode.coCreatePerGroupCount;
            delete runNode.coCreatePrompts;
            delete runNode.coCreateEnabled;
            delete runNode.typePlaceholder;
        } else {
            runNodes.slice(0, plan.length).forEach((runNode, index) => {
                const item = plan[index];
                runNode.pending = 1;
                runNode.pendingTasks = [];
                runNode.pendingOutputKind = outputKind;
                runNode.runStartedAt = deps.nowMs?.() || Date.now();
                runNode.runTimerHidden = false;
                runNode.coCreateBatchId = batchId;
                runNode.coCreateGroupIndex = item.groupIndex;
                runNode.coCreateItemIndex = item.itemIndex;
                runNode.coCreatePrompt = item.prompt;
                runNode.runPrompt = item.prompt;
                runNode.runModelPrompt = item.prompt;
                runNode.promptDraftText = item.prompt;
                runNode.promptDraftHtml = deps.escapeHtml?.(item.prompt) || item.prompt;
                delete runNode.coCreateGroupMeta;
                delete runNode.coCreatePerGroupCount;
                delete runNode.coCreatePrompts;
                delete runNode.coCreateEnabled;
            });
        }
        return {runNodes:runNodes.slice(0, Math.max(1, runNodes.length)), runPlan:plan};
    }
    function prepareRunTarget(deps, sourceNode, totalCount, meta, refs){
        if(!nodeHasOutputImages(sourceNode)) return {runNode: sourceNode, branchNode: null};
        const branchNode = deps.createPendingOutputFromSource?.(sourceNode, totalCount, meta, {
            connectSource: false,
            selectOutput: true,
            refs,
            stripInputMeta: true
        }) || null;
        if(!branchNode) return {runNode: sourceNode, branchNode: null};
        deps.selectedId = branchNode.id;
        deps.selectedImage = {nodeId: '', index: -1};
        deps.scheduleComposerReposition?.(branchNode);
        return {runNode: branchNode, branchNode};
    }
    function rollbackBranch(deps, branchNode, sourceNode){
        if(!branchNode) return;
        deps.nodes = (deps.nodes || []).filter(n => n.id !== branchNode.id);
        if(deps.canvas) deps.canvas.connections = (deps.canvas.connections || []).filter(c => c.from !== branchNode.id && c.to !== branchNode.id);
        deps.selectedId = sourceNode?.id || deps.selectedId;
    }
    function rememberRefAspect(node, refs){
        const ref = (refs || []).map(item => item?.item || item).find(img => img?.url);
        if(!ref) return;
        const w = Number(ref.natural_w || ref.width || ref.w || 0);
        const h = Number(ref.natural_h || ref.height || ref.h || 0);
        if(w > 0 && h > 0) node.coCreateRefAspect = w / h;
    }
    function groupMetaCount(node){
        const meta = Array.isArray(node?.coCreateGroupMeta) ? node.coCreateGroupMeta.length : 0;
        if(meta) return meta;
        const prompts = Array.isArray(node?.coCreatePrompts) ? node.coCreatePrompts.filter(Boolean).length : 0;
        return Math.max(1, prompts);
    }
    function finalizeCoCreateNode(deps, node){
        if(!node) return;
        node.pending = 0;
        node.pendingTasks = [];
        node.running = false;
        if(!node.runFinishedAt) node.runFinishedAt = deps.nowMs?.() || Date.now();
        if(!node.runStartedAt) node.runStartedAt = node.runFinishedAt;
        node.runElapsedMs = Math.max(0, node.runFinishedAt - Number(node.runStartedAt || node.runFinishedAt));
        node.runTimerHidden = false;
        node.title = 'Group';
        node.scale = deps.mediaNodeDefaultScale?.(node);
        delete node.w;
        delete node.h;
    }
    async function pollAndFinalizeTask(deps, node, task){
        const result = await deps.pollSmartCanvasTask(task.taskId);
        const additions = (result?.images || []).map((item, i) => {
            const url = typeof item === 'string' ? item : item?.url || '';
            const natural_w = Number(typeof item === 'object' && (item.natural_w || item.width || item.w) || 0) || 0;
            const natural_h = Number(typeof item === 'object' && (item.natural_h || item.height || item.h) || 0) || 0;
            const base = { url, name: (typeof item === 'object' && item.name) || `output-${i + 1}.png`, kind: 'image', generatedResult: true, coCreateGroupIndex: task.coCreateGroupIndex, coCreatePrompt: task.coCreatePrompt };
            if(natural_w > 0 && natural_h > 0){
                base.natural_w = natural_w;
                base.natural_h = natural_h;
            }
            return deps.stripImageGenerationMeta?.(base) || base;
        }).filter(item => item.url);
        node.pendingTasks = (node.pendingTasks || []).filter(t => t.taskId !== task.taskId);
        if(additions.length) node.images = [...(node.images || []), ...additions];
        const perGroup = Math.max(1, Number(node.coCreatePerGroupCount) || 1);
        const expected = groupMetaCount(node) * perGroup;
        const received = (node.images || []).filter(img => img?.generatedResult || img?.coCreateGroupIndex != null).length;
        node.pending = Math.max(0, expected - received);
        if(!(node.pendingTasks || []).length) node.pending = 0;
        node.running = node.pending > 0 || (node.pendingTasks || []).length > 0;
        deps.render?.();
        deps.scheduleSave?.();
    }
    async function resumeCoCreateTasks(deps, node){
        const tasks = [...(node.pendingTasks || [])];
        if(!tasks.length){
            if(Number(node.pending) > 0) finalizeCoCreateNode(deps, node);
            return;
        }
        node.running = true;
        deps.render?.();
        const failures = [];
        await Promise.all(tasks.map(task => pollAndFinalizeTask(deps, node, task).catch(e => { failures.push(e); })));
        finalizeCoCreateNode(deps, node);
        deps.render?.();
        deps.scheduleSave?.();
        deps.syncRunButtonState?.(node);
        global.SmartCanvasComposer?.updateComposer?.();
        if(failures.length && !(node.images || []).length) throw failures[0];
    }
    async function resumePendingNode(node){
        const deps = d();
        if(!deps || !node) return;
        return resumeCoCreateTasks(deps, node);
    }
    function removeSeparateRunTargets(deps, targets, sourceNode){
        const reusableSource = (targets || []).find(target => (
            target?.id === sourceNode?.id
            && !(target.images || []).some(item => item?.url)
        ));
        if(reusableSource){
            const kind = reusableSource.pendingOutputKind === 'video' ? 'video' : 'image';
            reusableSource.pending = 0;
            reusableSource.running = false;
            reusableSource.pendingTasks = [];
            reusableSource.type = 'smart-image';
            reusableSource.typePlaceholder = true;
            reusableSource.portLinkKind = kind;
            reusableSource.outputKind = kind;
            reusableSource.title = kind === 'video' ? 'Video' : 'Image';
            reusableSource.runTimerHidden = true;
            delete reusableSource.w;
            delete reusableSource.h;
            delete reusableSource.pendingOutputKind;
            delete reusableSource._pendingOutputSourceId;
            delete reusableSource._selectAfterRunId;
            delete reusableSource.runStartedAt;
            delete reusableSource.runFinishedAt;
            delete reusableSource.runElapsedMs;
        }
        const ids = new Set((targets || [])
            .filter(target => target && target.id !== sourceNode?.id && !(target.images || []).some(item => item?.url))
            .map(target => target.id));
        if(!ids.size) return;
        deps.nodes = (deps.nodes || []).filter(candidate => !ids.has(candidate.id));
        if(deps.canvas) deps.canvas.connections = (deps.canvas.connections || []).filter(connection => !ids.has(connection.from) && !ids.has(connection.to));
        if(ids.has(deps.selectedId)) deps.selectedId = sourceNode?.id || '';
    }
    function metaForSeparateTarget(meta, spec){
        return {
            ...(meta || {}),
            prompt:spec.prompt,
            displayPrompt:spec.prompt,
            promptText:spec.prompt,
            promptHtml:escapeHtml(spec.prompt)
        };
    }
    async function run(node, options){
        const deps = d();
        if(!deps || !node || !shouldRun(node)) return deps?.runGeneration?.(options);
        savePromptsToNode(node);
        const entries = validPromptEntries(node.coCreatePrompts || readPromptLinesFromPanel());
        if(!entries.length){ deps.toast?.('请至少填写一条提示词'); return; }
        deps.persistActiveSmartSettings?.();
        const previousSettings = deps.cloneSmartSettings?.(deps.settings);
        deps.settings = { ...deps.cloneSmartSettings?.(deps.smartSettingsForNode?.(node) || {}), ...deps.cloneSmartSettings?.(deps.settings) };
        const mediaKind = deps.settings.apiKind === 'video' ? 'video' : 'image';
        if(!deps.isApiLikeEngine?.(deps.settings.engine)){ deps.toast?.('共创模式需要使用 API 模型'); deps.settings = previousSettings; return; }
        if(mediaKind === 'video' && !deps.settings.videoModel){ deps.toast?.(deps.tr?.('smart.errNoVideoModel') || '请选择视频模型'); deps.settings = previousSettings; return; }
        if(mediaKind === 'image' && (!deps.settings.provider_id || !deps.settings.model)){ deps.toast?.(deps.tr?.('smart.errNoApiModel') || '请选择模型'); deps.settings = previousSettings; return; }
        const perGroupCount = mediaKind === 'video'
            ? Math.max(1, Number(deps.smartVideoGenerationCount?.(deps.settings) || 1))
            : Math.max(1, Number(deps.settings.count || 1) || 1);
        const refs = buildRefsForRun(deps, node);
        const runSettings = deps.cloneSmartSettings?.(deps.settings);
        deps.rememberRecentSmartSettings?.(runSettings, node);
        const meta = deps.snapshotRunMeta?.(entries.map(e => e.text).join('\n---\n'), node.id, entries.map(e => e.text).join('\n'), refs);
        const runPlan = buildRunPlan(entries, perGroupCount);
        deps.pushUndo?.();
        const {runNodes} = prepareSeparateRunTargets(deps, node, runPlan, meta, refs, mediaKind, runSettings);
        if(!runNodes.length){
            deps.settings = previousSettings;
            deps.toast?.(deps.tr?.('smart.errRunFailed') || '生成失败');
            return;
        }
        runNodes.forEach(target => deps.coolNodeRunningState?.(target, 2000));
        deps.coolRunButton?.(2000);
        deps.render?.();
        const runLogStart = deps.nowMs?.() || Date.now();
        const runLog = deps.smartRunSnapshot?.(runNodes[0], entries.map(e => e.text).join('\n'), refs, mediaKind);
        const failures = [];
        try {
            if(mediaKind === 'video'){
                const submitted = await Promise.allSettled(entries.map(entry => deps.runApiVideoGeneration?.(entry.text, refs, runSettings)));
                submitted.forEach((result, groupIndex) => {
                    const groupTargets = runNodes.filter(target => Number(target.coCreateGroupIndex) === groupIndex);
                    if(result.status === 'rejected'){
                        failures.push(result.reason);
                        removeSeparateRunTargets(deps, groupTargets, node);
                        return;
                    }
                    const urls = (result.value || []).filter(Boolean);
                    groupTargets.forEach((target, itemIndex) => {
                        const url = urls[itemIndex];
                        if(url) deps.finalizePendingNode?.(target, [url], metaForSeparateTarget(meta, runPlan.find(item => item.groupIndex === groupIndex && item.itemIndex === itemIndex)), 'video');
                        else removeSeparateRunTargets(deps, [target], node);
                    });
                });
                deps.render?.();
                deps.scheduleSave?.();
                await deps.saveCanvas?.();
            } else {
                const submitted = await Promise.allSettled(entries.map(entry => deps.runApiGeneration?.(entry.text, refs, runSettings, node)));
                const activeTargets = [];
                if(runNodes.length === 1 && runPlan.length > 1){
                    const target = runNodes[0];
                    const taskIds = submitted.flatMap(result => (
                        result.status === 'fulfilled'
                            ? (Array.isArray(result.value?.taskIds) ? result.value.taskIds : []).filter(Boolean)
                            : (failures.push(result.reason), [])
                    ));
                    if(!taskIds.length) throw failures[0] || new Error(deps.tr?.('smart.errRunFailed') || '生成失败');
                    target.pendingTasks = taskIds
                        .map(taskId => ({taskId, kind:'image'}))
                        .filter((_, index) => !(Array.isArray(target._cancelledPendingSlots) && target._cancelledPendingSlots.includes(index)));
                    target.pending = target.pendingTasks.length;
                    target.running = false;
                    activeTargets.push(target);
                } else {
                    submitted.forEach((result, groupIndex) => {
                        const groupTargets = runNodes.filter(target => Number(target.coCreateGroupIndex) === groupIndex);
                        if(result.status === 'rejected'){
                            failures.push(result.reason);
                            removeSeparateRunTargets(deps, groupTargets, node);
                            return;
                        }
                        const taskIds = Array.isArray(result.value?.taskIds) ? result.value.taskIds.filter(Boolean) : [];
                        groupTargets.forEach((target, itemIndex) => {
                            const taskId = taskIds[itemIndex];
                            if(!taskId){
                                removeSeparateRunTargets(deps, [target], node);
                                return;
                            }
                            target.pendingTasks = [{taskId, kind:'image'}];
                            target.pending = 1;
                            target.running = false;
                            activeTargets.push(target);
                        });
                    });
                }
                if(!activeTargets.length) throw failures[0] || new Error(deps.tr?.('smart.errRunFailed') || '生成失败');
                deps.render?.();
                deps.scheduleSave?.();
                await deps.saveCanvas?.();
                const settled = await Promise.allSettled(activeTargets.map(target => deps.resumeSmartPendingNode?.(target)));
                settled.forEach(result => { if(result.status === 'rejected') failures.push(result.reason); });
            }
            const outputs = runNodes.flatMap(target => target.images || []).map(img => img.url).filter(Boolean);
            if(!outputs.length) throw failures[0] || new Error(mediaKind === 'video' ? (deps.tr?.('smart.errNoOutVideos') || '未生成视频') : (deps.tr?.('smart.errNoOutImages') || '未生成图片'));
            deps.addSmartGenerationLog?.({ run: runLog, outputs, runMs: (deps.nowMs?.() || Date.now()) - runLogStart });
        } catch(e){
            removeSeparateRunTargets(deps, runNodes, node);
            deps.addSmartGenerationLog?.({ run: runLog, outputs: [], runMs: (deps.nowMs?.() || Date.now()) - runLogStart, error: e.message || String(e) });
            deps.toast?.((e.message || deps.tr?.('smart.errRunFailed') || '生成失败').slice(0, 160));
        } finally {
            deps.settings = previousSettings;
            runNodes.forEach(target => deps.syncRunButtonState?.(target));
            deps.render?.();
            deps.scheduleSave?.();
            global.SmartCanvasComposer?.updateComposer?.();
        }
    }
    async function runGroupedLegacy(node, options){
        const deps = d();
        if(!deps || !node || !shouldRun(node)) return deps?.runGeneration?.(options);
        savePromptsToNode(node);
        const entries = validPromptEntries(node.coCreatePrompts || readPromptLinesFromPanel());
        if(!entries.length){ deps.toast?.('请至少填写一条提示词'); return; }
        deps.persistActiveSmartSettings?.();
        const previousSettings = deps.cloneSmartSettings?.(deps.settings);
        deps.settings = { ...deps.cloneSmartSettings?.(deps.smartSettingsForNode?.(node) || {}), ...deps.cloneSmartSettings?.(deps.settings) };
        const mediaKind = deps.settings.apiKind === 'video' ? 'video' : 'image';
        if(!deps.isApiLikeEngine?.(deps.settings.engine)){ deps.toast?.('共创模式需要使用 API 模型'); deps.settings = previousSettings; return; }
        if(mediaKind === 'video' && !deps.settings.videoModel){ deps.toast?.(deps.tr?.('smart.errNoVideoModel') || '请选择视频模型'); deps.settings = previousSettings; return; }
        if(mediaKind === 'image' && (!deps.settings.provider_id || !deps.settings.model)){ deps.toast?.(deps.tr?.('smart.errNoApiModel') || '请选择模型'); deps.settings = previousSettings; return; }
        const perGroupCount = mediaKind === 'video'
            ? Math.max(1, Number(deps.smartVideoGenerationCount?.(deps.settings) || 1))
            : Math.max(1, Number(deps.settings.count || 1) || 1);
        const totalCount = entries.length * perGroupCount;
        const refs = buildRefsForRun(deps, node);
        const runSettings = deps.cloneSmartSettings?.(deps.settings);
        deps.rememberRecentSmartSettings?.(runSettings, node);
        const meta = deps.snapshotRunMeta?.(entries.map(e => e.text).join('\n---\n'), node.id, entries.map(e => e.text).join('\n'), refs);
        deps.pushUndo?.();
        const {runNode, branchNode} = prepareRunTarget(deps, node, totalCount, meta, refs);
        if(!branchNode) runNode.images = [];
        runNode.coCreateEnabled = true;
        runNode.coCreateGroupMeta = entries.map((entry, i) => ({ groupIndex: i, prompt: entry.text }));
        runNode.coCreatePerGroupCount = perGroupCount;
        runNode.coCreatePrompts = normalizePromptLines(entries.map(e => e.text));
        rememberRefAspect(runNode, refs);
        delete runNode.w;
        delete runNode.h;
        runNode.pending = totalCount;
        runNode.pendingTasks = [];
        runNode.runStartedAt = deps.nowMs?.() || Date.now();
        delete runNode.runFinishedAt;
        runNode.runTimerHidden = false;
        if(meta && !branchNode) deps.attachRunMeta?.(runNode, meta);
        deps.coolNodeRunningState?.(runNode, 2000);
        deps.coolRunButton?.(2000);
        deps.render?.();
        const runLogStart = deps.nowMs?.() || Date.now();
        const runLog = deps.smartRunSnapshot?.(runNode, entries.map(e => e.text).join('\n'), refs, mediaKind);
        try {
            if(mediaKind === 'video'){
                const additions = (await Promise.all(entries.map(async (entry, groupIndex) => {
                    const urls = await deps.runApiVideoGeneration?.(entry.text, refs, runSettings);
                    return (urls || []).map((url, index) => ({
                        url,
                        name:`output-${groupIndex + 1}-${index + 1}.mp4`,
                        kind:'video',
                        generatedResult:true,
                        coCreateGroupIndex:groupIndex,
                        coCreatePrompt:entry.text
                    }));
                }))).flat().filter(item => item.url);
                if(!additions.length) throw new Error(deps.tr?.('smart.errNoOutVideos') || '未生成视频');
                runNode.images = [...(runNode.images || []), ...additions];
                runNode.pending = 0;
                runNode.pendingTasks = [];
                deps.render?.();
                deps.scheduleSave?.();
                await deps.saveCanvas?.();
            } else {
                const flatTasks = (await Promise.all(entries.map(async (entry, groupIndex) => {
                    const result = await deps.runApiGeneration?.(entry.text, refs, runSettings, runNode);
                    return (result?.taskIds || []).map(taskId => ({ taskId, kind: 'image', coCreateGroupIndex: groupIndex, coCreatePrompt: entry.text }));
                }))).flat().filter(task => task.taskId);
                if(!flatTasks.length) throw new Error(deps.tr?.('smart.errRunFailed') || '生成失败');
                runNode.pendingTasks = flatTasks;
                runNode.pending = Math.max(flatTasks.length, totalCount);
                deps.render?.();
                deps.scheduleSave?.();
                await deps.saveCanvas?.();
                await resumeCoCreateTasks(deps, runNode);
                if(!(runNode.images || []).length) throw new Error(deps.tr?.('smart.errNoOutImages') || '未生成图片');
            }
            deps.addSmartGenerationLog?.({ run: runLog, outputs: (runNode.images || []).map(img => img.url).filter(Boolean), runMs: (deps.nowMs?.() || Date.now()) - runLogStart });
        } catch(e){
            runNode.pending = 0;
            runNode.pendingTasks = [];
            rollbackBranch(deps, branchNode, node);
            if(!(runNode.images || []).length && !branchNode){ delete runNode.w; delete runNode.h; }
            deps.addSmartGenerationLog?.({ run: runLog, outputs: [], runMs: (deps.nowMs?.() || Date.now()) - runLogStart, error: e.message || String(e) });
            deps.toast?.((e.message || deps.tr?.('smart.errRunFailed') || '生成失败').slice(0, 160));
        } finally {
            deps.settings = previousSettings;
            finalizeCoCreateNode(deps, runNode);
            deps.syncRunButtonState?.(runNode);
            deps.render?.();
            deps.scheduleSave?.();
            global.SmartCanvasComposer?.updateComposer?.();
        }
    }
    const api = Object.freeze({ DEFAULT_LINES, MAX_LINES, isEnabled, shouldRun, syncComposer, promptEntries, renderNodeBody, adjustLayout, hasGroupedOutput, blocksThumbReorder, isNodeDragSurface, allowsThumbDetach, stripDetachImage, afterImageDetached, buildRunPlan, prepareSeparateRunTargets, run, resumePendingNode, savePromptsToNode, loadPromptsToPanel });
    global.SmartCanvasCore?.register?.('coCreate', api);
    global.SmartCanvasCoCreate = api;
})(window);
