/**
 * Smart Canvas — selection capsule shell (markup / bind / sync orchestration).
 *
 * Feature modules (edit these for behavior changes):
 *   smart-canvas-selection-capsule-shared.js     — deps + media helpers
 *   smart-canvas-selection-capsule-selection.js  — multi-select snapshot / delete targets
 *   smart-canvas-selection-capsule-group.js      — 打组 / 解组
 *   smart-canvas-selection-capsule-asset.js      — 存入素材库
 *   smart-canvas-selection-capsule-download.js   — 批量下载
 *   smart-canvas-selection-capsule-delete.js     — 批量删除 + Delete 快捷键
 */
(function(global){
    'use strict';

    const CAPSULE_MARKUP_VERSION = '2026.07.23.069';

    let bound = false;

    const mod = {
        shared: () => global.SmartCanvasSelectionCapsuleShared,
        selection: () => global.SmartCanvasSelectionCapsuleSelection,
        group: () => global.SmartCanvasSelectionCapsuleGroup,
        disconnect: () => global.SmartCanvasSelectionCapsuleDisconnect,
        arrange: () => global.SmartCanvasSelectionCapsuleArrange,
        asset: () => global.SmartCanvasSelectionCapsuleAsset,
        download: () => global.SmartCanvasSelectionCapsuleDownload,
        delete: () => global.SmartCanvasSelectionCapsuleDelete
    };

    function ensureMarkup(){
        const capsule = document.getElementById('selectionBoxCapsule');
        if(!capsule) return capsule;
        if(capsule.dataset.capsuleMarkupVersion !== CAPSULE_MARKUP_VERSION){
            capsule.dataset.capsuleMarkupVersion = CAPSULE_MARKUP_VERSION;
            capsule.dataset.capsuleReady = '';
            bound = false;
        }
        if(capsule.dataset.capsuleReady === '1') return capsule;
        capsule.dataset.capsuleReady = '1';
        capsule.innerHTML = (
            '<div class="selection-capsule-bar" role="toolbar" aria-label="选区操作">' +
            '<span class="selection-capsule-glider" aria-hidden="true"></span>' +
            '<button type="button" class="selection-capsule-btn" id="selectionCapsuleGroupBtn" title="打组">' +
            '<i data-lucide="group"></i><span>打组</span></button>' +
            '<button type="button" class="selection-capsule-btn" id="selectionCapsuleDisconnectBtn" title="消除所选对象的全部连线">' +
            '<i data-lucide="unlink-2"></i><span>消除连线</span></button>' +
            '<button type="button" class="selection-capsule-btn" id="selectionCapsuleArrangeBtn" title="按上下游关系整理">' +
            '<i data-lucide="workflow"></i><span>整理</span></button>' +
            '<button type="button" class="selection-capsule-btn" id="selectionCapsuleAssetBtn" title="资产库">' +
            (global.StudioShellIcons?.asset || '<svg class="studio-shell-icon studio-shell-icon-asset" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 17a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.9a2 2 0 0 1-1.69-.9l-.81-1.2a2 2 0 0 0-1.67-.9H8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z"/><path d="M2 8v11a2 2 0 0 0 2 2h14"/></svg>') +
            '<span>资产库</span></button>' +
            '<button type="button" class="selection-capsule-btn" id="selectionCapsuleDownloadBtn" title="批量下载">' +
            '<i data-lucide="download"></i><span>下载</span></button>' +
            '<button type="button" class="selection-capsule-btn is-danger" id="selectionCapsuleDeleteBtn" title="批量删除">' +
            '<i data-lucide="trash-2"></i><span>删除</span></button>' +
            '</div>'
        );
        return capsule;
    }

    function capsuleButton(target){
        return target?.closest?.('.selection-capsule-btn') || null;
    }

    function moveGlider(bar, button){
        const glider = bar?.querySelector?.('.selection-capsule-glider');
        if(!glider || !button) return;
        const barRect = bar.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        if(!barRect.width || !buttonRect.width) return;
        glider.style.setProperty('--sc-glider-x', `${buttonRect.left - barRect.left}px`);
        glider.style.setProperty('--sc-glider-width', `${buttonRect.width}px`);
        glider.classList.add('is-visible');
    }

    function hideGlider(bar){
        bar?.querySelector?.('.selection-capsule-glider')?.classList.remove('is-visible');
    }

    function handleCapsuleClick(event){
        if(!mod.shared()?.d?.()) return;
        const target = event.target.closest('#selectionCapsuleGroupBtn, #selectionCapsuleDisconnectBtn, #selectionCapsuleArrangeBtn, #selectionCapsuleAssetBtn, #selectionCapsuleDownloadBtn, #selectionCapsuleDeleteBtn');
        if(!target) return;
        event.preventDefault();
        event.stopPropagation();
        if(target.id === 'selectionCapsuleGroupBtn') mod.group()?.handleGroupAction?.(sync);
        else if(target.id === 'selectionCapsuleDisconnectBtn') mod.disconnect()?.handleDisconnectAction?.(sync);
        else if(target.id === 'selectionCapsuleArrangeBtn') mod.arrange()?.handleArrangeAction?.(sync);
        else if(target.id === 'selectionCapsuleAssetBtn') mod.asset()?.openAssetLibrary?.();
        else if(target.id === 'selectionCapsuleDownloadBtn') mod.download()?.handleDownloadAction?.();
        else if(target.id === 'selectionCapsuleDeleteBtn') mod.delete()?.handleCapsuleDelete?.();
    }

    function bindOnce(){
        if(bound) return;
        const capsule = ensureMarkup();
        if(!capsule) return;
        bound = true;
        const bar = capsule.querySelector('.selection-capsule-bar');
        bar?.addEventListener('pointerover', event => {
            const button = capsuleButton(event.target);
            if(button) moveGlider(bar, button);
        });
        bar?.addEventListener('pointerout', event => {
            const nextButton = capsuleButton(event.relatedTarget);
            if(nextButton) moveGlider(bar, nextButton);
            else hideGlider(bar);
        });
        bar?.addEventListener('focusin', event => {
            const button = capsuleButton(event.target);
            if(button) moveGlider(bar, button);
        });
        bar?.addEventListener('focusout', () => hideGlider(bar));
        capsule.addEventListener('pointerdown', e => {
            if(e.target.closest('#selectionCapsuleAssetBtn')) window.SmartCanvasAssetOpenGuard?.arm?.();
            e.stopPropagation();
            e.stopImmediatePropagation?.();
        }, true);
        capsule.addEventListener('mousedown', e => {
            e.stopPropagation();
        });
        capsule.addEventListener('click', e => {
            handleCapsuleClick(e);
            e.stopPropagation();
        });
        mod.asset()?.bindAssetMenuDismiss?.();
    }

    function sync(){
        const api = mod.shared()?.d?.();
        const capsule = ensureMarkup();
        if(!capsule) return;
        bindOnce();
        if(!api) return;
        const ids = mod.shared()?.readSelectionIds?.() || [];
        if(ids.length > 1) mod.selection()?.refreshMultiSelectSnapshot?.(ids);
        const deleteTargets = mod.selection()?.getDeleteTargetIds?.() || [];
        const activeCount = Math.max(ids.length, deleteTargets.length);
        if(activeCount <= 0){
            mod.selection()?.clearMultiSelectSnapshot?.();
            capsule.setAttribute('hidden', '');
            mod.asset()?.closeAssetMenu?.();
            return;
        }
        capsule.removeAttribute('hidden');
        mod.group()?.syncGroupButton?.();
        mod.disconnect()?.syncDisconnectButton?.();
        mod.arrange()?.syncArrangeButton?.();
        mod.asset()?.syncAssetButton?.();
        mod.download()?.syncDownloadButton?.();
        const deleteBtn = document.getElementById('selectionCapsuleDeleteBtn');
        if(deleteBtn) deleteBtn.disabled = deleteTargets.length <= 0;
        api.refreshIcons?.();
    }

    function clear(){
        mod.asset()?.closeAssetMenu?.();
        document.getElementById('selectionBoxCapsule')?.setAttribute('hidden', '');
    }

    function registerCapsuleDeps(next){
        mod.shared()?.registerSharedDeps?.(next);
    }

    const api = Object.freeze({
        registerCapsuleDeps,
        sync,
        clear
    });

    global.SmartCanvasCore?.register?.('selectionCapsule', api);
    global.SmartCanvasSelectionCapsule = api;
})(window);
