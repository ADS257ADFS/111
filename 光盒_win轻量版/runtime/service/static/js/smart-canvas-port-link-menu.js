/**
 * Smart Canvas — port drag release picker.
 * Drag to empty canvas → flowing pending line + type menu (no node until pick).
 */
(function(global){
    'use strict';

    const MAIN_OPTIONS = Object.freeze([
        {id:'text', label:'文本', desc:'LLM 对话与提示词编排', icon:'message-square-text'},
        {id:'image', label:'图片', desc:'AI 图片生成节点', icon:'image'},
        {id:'video', label:'视频', desc:'AI 视频生成节点', icon:'film'},
        {id:'audio', label:'音频', desc:'AI 音频生成节点', icon:'audio-lines'}
    ]);

    const BOTTOM_OPTIONS = Object.freeze([
        {id:'director', label:'导演台', desc:'3D场景搭建与时间线编排', icon:'clapperboard'}
    ]);

    const ASSET_OPTIONS = Object.freeze([
        {id:'upload-assets', label:'上传', desc:'上传图片、视频或音频素材', icon:'upload-cloud'}
    ]);

    const DISABLED_OPTION_IDS = new Set(['director']);

    const ALL_OPTION_IDS = Object.freeze([
        ...MAIN_OPTIONS.map(opt => opt.id),
        ...BOTTOM_OPTIONS.map(opt => opt.id),
        ...ASSET_OPTIONS.map(opt => opt.id)
    ]);

    const BLOCKED_DROP_SELECTOR = '.composer,.smart-back,.canvas-new-fab,.canvas-empty-hint,.asset-panel,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal,.image-edit-modal,.smart-minimap,.canvas-bottom-chrome';

    let menuEl = null;
    let pending = null;
    let ignoreNextShellClick = false;
    let enterTimer = 0;
    let menuIconsReady = false;

    function deps(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function imageOptionBlockedForPending(){
        if(!pending || pending.dragFromPort !== 'out') return false;
        const source = deps()?.nodes?.find(node => node.id === pending.dragFromId);
        return global.SmartCanvasModeBindings?.hasVideoMaterial?.(source) === true;
    }

    function syncPendingOptionAvailability(menu=menuEl){
        const imageOption = menu?.querySelector?.('[data-port-link-kind="image"]');
        if(!imageOption) return;
        const disabled = imageOptionBlockedForPending();
        imageOption.disabled = disabled;
        imageOption.classList.toggle('is-disabled', disabled);
        if(disabled){
            imageOption.setAttribute('aria-disabled', 'true');
            imageOption.dataset.portLinkDisabled = '1';
            imageOption.classList.remove('is-hover');
        } else {
            imageOption.removeAttribute('aria-disabled');
            delete imageOption.dataset.portLinkDisabled;
        }
    }

    function renderOptionItem(opt){
        const disabled = DISABLED_OPTION_IDS.has(opt.id);
        const badge = disabled
            ? '<span class="port-link-pick-alert" title="暂不可用" aria-label="暂不可用"><i data-lucide="circle-alert"></i></span>'
            : '';
        const disabledAttrs = disabled ? ' disabled aria-disabled="true" data-port-link-disabled="1"' : '';
        const disabledClass = disabled ? ' is-disabled' : '';
        return (
            `<button type="button" class="port-link-pick-item${disabledClass}" data-port-link-kind="${opt.id}"${disabledAttrs}>` +
            `<span class="port-link-pick-icon"><i data-lucide="${opt.icon}"></i></span>` +
            `<span class="port-link-pick-copy">` +
            `<span class="port-link-pick-title-row"><span class="port-link-pick-title">${opt.label}</span>${badge}</span>` +
            `<span class="port-link-pick-desc">${opt.desc}</span>` +
            `</span></button>`
        );
    }

    function renderMenuBody(){
        const mainItems = MAIN_OPTIONS.map(renderOptionItem).join('');
        const bottomItems = BOTTOM_OPTIONS.map(renderOptionItem).join('');
        const assetItems = ASSET_OPTIONS.map(renderOptionItem).join('');
        return (
            `<div class="port-link-pick-shell">` +
            `<span class="port-link-pick-glider" aria-hidden="true"></span>` +
            `<div class="port-link-pick-head">引用该节点生成</div>` +
            `<div class="port-link-pick-inner">` +
            `<div class="port-link-pick-list">${mainItems}</div>` +
            `<div class="port-link-pick-divider" aria-hidden="true"></div>` +
            `<div class="port-link-pick-list port-link-pick-list-bottom">` +
            `<div class="port-link-pick-section-label">辅助工具</div>` +
            `${bottomItems}</div>` +
            `<div class="port-link-pick-divider" aria-hidden="true"></div>` +
            `<div class="port-link-pick-list port-link-pick-list-assets">` +
            `<div class="port-link-pick-section-label">添加资源</div>` +
            `${assetItems}</div>` +
            `</div></div>`
        );
    }

    function ensureMenu(){
        if(menuEl) return menuEl;
        menuEl = document.createElement('div');
        menuEl.id = 'portLinkPickMenu';
        menuEl.className = 'port-link-pick-menu';
        menuEl.innerHTML = renderMenuBody();
        menuEl.addEventListener('mousedown', e => e.stopPropagation(), true);
        menuEl.addEventListener('click', e => {
            const btn = e.target.closest('[data-port-link-kind]');
            if(!btn) return;
            e.preventDefault();
            e.stopPropagation();
            if(btn.disabled || btn.dataset.portLinkDisabled === '1') return;
            pickKind(btn.dataset.portLinkKind);
        }, true);
        menuEl.querySelectorAll('.port-link-pick-item').forEach(bindItemHoverMotion);
        document.body.appendChild(menuEl);
        return menuEl;
    }

    function bindItemHoverMotion(item){
        if(item.dataset.boundPortLinkMotion === '1') return;
        item.dataset.boundPortLinkMotion = '1';
        if(item.disabled || item.dataset.portLinkDisabled === '1') return;
        const moveGlider = () => {
            if(item.disabled || item.dataset.portLinkDisabled === '1') return;
            const shell = item.closest('.port-link-pick-shell');
            if(!shell) return;
            const shellRect = shell.getBoundingClientRect();
            const itemRect = item.getBoundingClientRect();
            shell.style.setProperty('--port-link-glider-x', `${itemRect.left - shellRect.left}px`);
            shell.style.setProperty('--port-link-glider-y', `${itemRect.top - shellRect.top}px`);
            shell.style.setProperty('--port-link-glider-width', `${itemRect.width}px`);
            shell.style.setProperty('--port-link-glider-height', `${itemRect.height}px`);
            shell.classList.add('has-item-glider');
        };
        item.addEventListener('mouseenter', () => {
            if(item.disabled || item.dataset.portLinkDisabled === '1') return;
            item.classList.add('is-hover');
            moveGlider();
        });
        item.addEventListener('focus', moveGlider);
        item.addEventListener('mouseleave', () => item.classList.remove('is-hover'));
        const shell = item.closest('.port-link-pick-shell');
        if(shell && shell.dataset.boundPortLinkGlider !== '1'){
            shell.dataset.boundPortLinkGlider = '1';
            shell.addEventListener('mouseleave', () => shell.classList.remove('has-item-glider'));
            shell.addEventListener('focusout', event => {
                if(!shell.contains(event.relatedTarget)) shell.classList.remove('has-item-glider');
            });
        }
    }

    function positionMenu(clientX, clientY){
        const menu = ensureMenu();
        const w = 232;
        const h = 422;
        const left = Math.max(12, Math.min(window.innerWidth - w - 12, clientX + 8));
        const top = Math.max(12, Math.min(window.innerHeight - h - 12, clientY + 6));
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.style.setProperty('--port-link-origin-x', `${Math.max(16, Math.min(w - 16, clientX - left))}px`);
        menu.style.setProperty('--port-link-origin-y', `${Math.max(12, Math.min(h - 12, clientY - top))}px`);
    }

    function refreshMenuIcons(menu){
        if(menuIconsReady || !menu || !global.lucide) return;
        try { global.lucide.createIcons({root:menu}); }
        catch(_e) { global.lucide.createIcons(); }
        menuIconsReady = !menu.querySelector('i[data-lucide]');
    }

    function scheduleComposerRefresh(){
        const d = deps();
        if(!d) return;
        // A microtask runs before the browser can paint the newly opened menu.
        // Defer composer reconciliation until the first visible frame instead.
        requestAnimationFrame(() => setTimeout(() => {
            try { d.updateComposer?.(); } catch(err) { console.error('[SmartCanvasPortLinkMenu] updateComposer', err); }
        }, 0));
    }

    function prepare(){
        const menu = ensureMenu();
        refreshMenuIcons(menu);
        return menu;
    }

    function playMenuEnter(){
        const menu = ensureMenu();
        window.clearTimeout(enterTimer);
        menu.classList.remove('is-entering');
        // Do not force a synchronous full-page layout here. On large canvases
        // this used to stall the event loop between the two clicks of a
        // double-click. The menu is visible immediately; animation is optional.
        menu.classList.add('is-entering');
        enterTimer = window.setTimeout(() => menu.classList.remove('is-entering'), 190);
    }

    function openMenu(clientX, clientY){
        const d = deps();
        const menu = ensureMenu();
        menu.classList.remove('open', 'is-entering');
        syncPendingOptionAvailability(menu);
        positionMenu(clientX, clientY);
        menu.classList.add('open');
        playMenuEnter();
        ignoreNextShellClick = true;
        d?.shell?.classList.add('port-link-menu-open');
        refreshMenuIcons(menu);
        d?.updateCanvasEmptyHint?.();
    }

    function closeMenu(){
        if(!menuEl) return;
        menuEl.classList.remove('open', 'is-entering');
        deps()?.shell?.classList.remove('port-link-menu-open');
    }

    function ensurePendingLine(){
        const d = deps();
        const svg = d?.world?.querySelector('svg.connection-layer');
        if(!svg) return null;
        let path = svg.querySelector('path.port-link-pending-line');
        if(!path){
            path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'port-link-pending-line conn-pending');
            path.setAttribute('fill', 'none');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.appendChild(path);
        }
        return path;
    }

    function clearPendingLine(){
        deps()?.world?.querySelector('path.port-link-pending-line')?.remove();
    }

    function syncPendingLine(){
        if(!pending) return;
        const d = deps();
        const fromNode = d?.nodes?.find(n => n.id === pending.dragFromId);
        const isOut = pending.dragFromPort === 'out';
        let fx, fy;
        if(pending.anchorWorld){
            fx = pending.anchorWorld.x;
            fy = pending.anchorWorld.y;
        } else {
            if(!fromNode || !d?.nodeRect) return;
            const fr = d.nodeRect(fromNode);
            fx = isOut ? fr.x + fr.width : fr.x;
            fy = fr.y + fr.height / 2;
        }
        const tx = pending.point.x;
        const ty = pending.point.y;
        const dx = Math.max(50, Math.abs(tx - fx) * 0.45);
        const sign = isOut ? 1 : -1;
        const path = ensurePendingLine();
        if(path){
            path.setAttribute('d', `M${fx} ${fy} C ${fx + dx * sign} ${fy}, ${tx - dx * sign} ${ty}, ${tx} ${ty}`);
        }
    }

    function buildPresetSettings(kind, d){
        const base = d.cloneSmartSettings?.(d.settings || {}) || {};
        if(kind === 'video'){
            base.engine = 'api';
            base.apiKind = 'video';
        } else if(kind === 'audio'){
            base.engine = 'api';
            base.apiKind = 'audio';
        } else if(kind === 'director'){
            base.engine = 'comfy';
            base.comfyMode = 'custom';
        } else if(kind === 'world3d'){
            base.engine = 'comfy';
            base.comfyMode = 'custom';
        } else {
            base.engine = 'api';
            base.apiKind = 'image';
        }
        return d.settingsForStorage?.(base) || base;
    }

    function applyImagePreset(node, kind){
        const d = deps();
        if(!node || !d) return;
        node.portLinkKind = kind;
        node.runSettings = buildPresetSettings(kind, d);
        if(['image', 'video', 'audio'].includes(kind)) node.typePlaceholder = true;
        if(kind === 'audio'){
            node.outputKind = 'audio';
            node.title = 'Audio';
        }
        else if(kind === 'video'){
            node.outputKind = 'video';
            node.title = 'Video';
        }
        else if(kind === 'director') node.title = '导演台';
        else if(kind === 'world3d') node.title = '3D世界';
        else {
            node.outputKind = 'image';
            node.title = 'Image';
        }
        global.SmartCanvasNodeModel?.applyTypedPlaceholderDefaultSize?.(node, kind, {force:true});
    }

    function createNodeForKind(kind, point, d){
        if(kind === 'text'){
            const promptNode = d.createPromptNode(point.x - 210, point.y - 100, {select:false, skipUndo:true});
            if(!promptNode) return null;
            promptNode.llmEnabled = true;
            promptNode.llmComposerUnified = true;
            promptNode.title = 'Prompt';
            global.SmartCanvasComposerText?.applyUnifiedTextDefaultSize?.(promptNode);
            return promptNode;
        }
        const node = d.createImageNodeAt(point, [], {select:false, skipUndo:true});
        if(!node) return null;
        applyImagePreset(node, kind);
        return node;
    }

    function cancelPending(){
        if(!pending) return false;
        pending = null;
        clearPendingLine();
        closeMenu();
        const d = deps();
        d?.discardPendingUndo?.();
        d?.updateCanvasEmptyHint?.();
        return true;
    }

    function pickKind(kind){
        if(DISABLED_OPTION_IDS.has(kind)) return;
        if(kind === 'image' && imageOptionBlockedForPending()) return;
        if(!pending || !ALL_OPTION_IDS.includes(kind)) return;
        if(kind === 'upload-assets'){
            const d = deps();
            const snapshot = {...pending};
            pending = null;
            clearPendingLine();
            closeMenu();
            if(!d) return;

            // This menu item imports media directly. Do not create an empty
            // upload node while the native file picker is still pending.
            d.discardPendingUndo?.();
            d.pendingGroupUploadPoint = snapshot.point ? {...snapshot.point} : d.viewportCenter?.();
            d.uploadTargetId = '';
            d.selectedId = '';
            d.selectedIds = [];
            d.selectedImage = {nodeId:'', index:-1};
            d.updateComposer?.();
            d.updateCanvasEmptyHint?.();

            const input = d.fileInput;
            if(!input){
                d.pendingGroupUploadPoint = null;
                return;
            }
            input.value = '';
            input.click();
            return;
        }
        const d = deps();
        const snapshot = {...pending};
        pending = null;
        clearPendingLine();
        closeMenu();
        if(!d) return;
        d.capturePendingUndo?.();
        const created = createNodeForKind(kind, snapshot.point, d);
        if(!created){
            d.discardPendingUndo?.();
            return;
        }
        const newId = created.id;
        if(snapshot.mode === 'blank'){
            const referenceIds = Array.isArray(snapshot.referenceIds) && snapshot.referenceIds.length
                ? snapshot.referenceIds
                : (snapshot.referenceId ? [snapshot.referenceId] : []);
            Array.from(new Set(referenceIds.filter(Boolean))).forEach(referenceId => d.connectInputNode(referenceId, newId));
        } else {
            const fromId = snapshot.dragFromPort === 'out' ? snapshot.dragFromId : newId;
            const toId = snapshot.dragFromPort === 'out' ? newId : snapshot.dragFromId;
            d.connectInputNode(fromId, toId);
        }
        d.selectedId = newId;
        d.selectedIds = [];
        d.selectedImage = {nodeId:'', index:-1};
        if(kind !== 'text'){
            d.settings = d.smartSettingsForNode?.(created) || d.settings;
        }
        d.updateComposer?.();
        d.commitPendingUndo?.();
        d.render?.();
        d.scheduleSave?.();
        d.updateCanvasEmptyHint?.();
        if(kind === 'director'){
            window.setTimeout(() => {
                global.SmartCanvasDirector3DBridge?.openDirectorNode?.(newId);
            }, 0);
        }
    }

    function openBlankCreateMenu(event, options = {}){
        const d = deps();
        if(!d || !event) return false;
        if(!options.skipBlocked){
            const hitEl = document.elementFromPoint(event.clientX, event.clientY);
            if(hitEl?.closest?.(BLOCKED_DROP_SELECTOR)) return false;
        }
        const point = options.point || d.screenToWorld?.(event);
        if(!point) return false;
        if(pending && pending.mode !== 'blank') return false;

        d.shell?.classList.add('port-link-menu-open');
        d.canvasEmptyHint?.classList.remove('open');

        if(pending){
            pending = null;
            clearPendingLine();
            d.discardPendingUndo?.();
        }

        const referenceIds = Array.isArray(options.referenceIds) ? options.referenceIds.filter(Boolean) : [];
        const referenceId = referenceIds[0] || d.selectedId || (Array.isArray(d.selectedIds) && d.selectedIds.length === 1 ? d.selectedIds[0] : '');
        pending = {
            mode: 'blank',
            point: {x: point.x, y: point.y},
            referenceId,
            referenceIds,
            anchorWorld:options.anchorWorld || null,
            dragFromId: referenceId,
            dragFromPort: 'out'
        };
        if(referenceId || options.anchorWorld) syncPendingLine();
        else clearPendingLine();
        d.selectedId = '';
        d.selectedIds = [];
        d.selectedImage = {nodeId:'', index:-1};
        openMenu(event.clientX, event.clientY);
        scheduleComposerRefresh();
        return true;
    }

    function portDragMovedEnough(drag){
        if(drag?.moved) return true;
        if(!drag?.startWorld || !drag?.currentWorld) return false;
        const dx = Number(drag.currentWorld.x || 0) - Number(drag.startWorld.x || 0);
        const dy = Number(drag.currentWorld.y || 0) - Number(drag.startWorld.y || 0);
        return Math.hypot(dx, dy) > 3;
    }

    function offerAfterPortDrag(drag, e){
        const d = deps();
        if(!d || !portDragMovedEnough(drag)) return false;
        const hitEl = document.elementFromPoint(e.clientX, e.clientY);
        if(hitEl?.closest?.(BLOCKED_DROP_SELECTOR)) return false;
        const point = drag.currentWorld || d.screenToWorld?.(e);
        if(!point) return false;
        pending = {
            mode: 'port-drag',
            dragFromId: drag.fromId,
            dragFromPort: drag.fromPort,
            point: {x: point.x, y: point.y}
        };
        d.selectedId = '';
        d.selectedIds = [];
        d.selectedImage = {nodeId:'', index:-1};
        openMenu(e.clientX, e.clientY);
        scheduleComposerRefresh();
        syncPendingLine();
        return true;
    }

    function handleShellClick(e){
        if(!pending) return false;
        if(ignoreNextShellClick){
            ignoreNextShellClick = false;
            return true;
        }
        if(e.target.closest('.port-link-pick-menu')) return true;
        cancelPending();
        return true;
    }

    function isOpen(){
        return Boolean(pending);
    }

    const api = Object.freeze({
        offerAfterPortDrag,
        openBlankCreateMenu,
        handleShellClick,
        cancelPending,
        pickKind,
        isOpen,
        closeMenu,
        syncPendingLine,
        prepare
    });

    global.SmartCanvasCore?.register?.('portLinkMenu', api);
    global.SmartCanvasPortLinkMenu = api;
})(window);
