/**
 * Smart Canvas — isolated feature integration (single entry for deps + hooks).
 *
 * Modules owned by this layer (edit these, not smart-canvas.js):
 *   smart-canvas-selection-capsule-*.js     — 选区胶囊 / 批量删除
 *   smart-canvas-smart-group-membership.js  — 组内拖进拖出 / 空组解散
 *   smart-canvas-dblclick-viewport.js       — 双击图片/提示词视角拉近与恢复
 *   smart-canvas-empty-node-chrome.js       — 空白上传节点空白区点击/双击
 *
 * smart-canvas.js only calls SmartCanvasIsolatedFeatures.* hooks below.
 */
(function(global){
    'use strict';

    const capsule = () => global.SmartCanvasSelectionCapsule;
    const capsuleDelete = () => global.SmartCanvasSelectionCapsuleDelete;
    const capsuleSelection = () => global.SmartCanvasSelectionCapsuleSelection;
    const groupMembership = () => global.SmartCanvasSmartGroupMembership;
    const dblclickViewport = () => global.SmartCanvasDblClickViewport;
    const emptyNodeChrome = () => global.SmartCanvasEmptyNodeChrome;

    let host = null;

    function install(nextHost){
        if(!nextHost) return;
        host = nextHost;
        capsule()?.registerCapsuleDeps?.({
            getSelectedNodeIds: host.selectedNodeIds,
            get selectedIds(){ return host.getSelectedIds(); },
            set selectedIds(v){ host.setSelectedIds(v); },
            get selectedId(){ return host.getSelectedId(); },
            set selectedId(v){ host.setSelectedId(v); },
            get nodes(){ return host.getNodes(); },
            set nodes(v){ host.setNodes(v); },
            get canvas(){ return host.getCanvas(); },
            set canvas(v){ host.setCanvas(v); },
            groupSelectedNodes: host.groupSelectedNodes,
            arrangeSelectedNodes: host.arrangeSelectedNodes,
            ungroupNode: host.ungroupNode,
            deleteNode: host.deleteNode,
            disconnectConnections: host.disconnectConnections,
            refreshConnectionLayer: host.refreshConnectionLayer,
            deleteNodesBatch: (...args) => capsuleDelete()?.deleteNodesBatch?.(...args),
            pushUndo: host.pushUndo,
            get undoSuppressed(){ return host.getUndoSuppressed(); },
            set undoSuppressed(v){ host.setUndoSuppressed(v); },
            addUrlToAssetLibrary: host.addUrlToAssetLibrary,
            zipDownloadImageItems: host.zipDownloadImageItems,
            imageForDisplay: host.imageForDisplay,
            isSmartGroupNode: host.isSmartGroupNode,
            smartGroupMembers: host.smartGroupMembers,
            smartGroupImageRefs: host.smartGroupImageRefs,
            toggleAssetLibrary: host.toggleAssetLibrary,
            loadAssetLibrary: host.loadAssetLibrary,
            renderAssetLibrary: host.renderAssetLibrary,
            assetCategories: host.assetCategories,
            get activeAssetCategoryId(){ return host.getActiveAssetCategoryId(); },
            set activeAssetCategoryId(v){ host.setActiveAssetCategoryId(v); },
            hideSelectionGroupBox: host.hideSelectionGroupBox,
            positionSelectionGroupBox: host.positionSelectionGroupBox,
            render: host.render,
            scheduleSave: host.scheduleSave,
            tr: host.tr,
            toast: host.toast,
            escapeHtml: host.escapeHtml,
            refreshIcons: host.refreshIcons,
            isHistoryGroupNode: host.isHistoryGroupNode,
            get selectedImage(){ return host.getSelectedImage(); },
            set selectedImage(v){ host.setSelectedImage(v); }
        });
        groupMembership()?.registerDeps?.({
            get nodes(){ return host.getNodes(); },
            get selectedIds(){ return host.getSelectedIds(); },
            isSmartGroupNode: host.isSmartGroupNode,
            smartGroupMembers: host.smartGroupMembers,
            smartGroupContainingNode: host.smartGroupContainingNode,
            smartGroupHitBounds: host.smartGroupHitBounds,
            nodeRect: host.nodeRect,
            addDraggedNodesToSmartGroup: host.addDraggedNodesToSmartGroup,
            pruneSmartGroupMembershipsForNode: host.pruneSmartGroupMembershipsForNode,
            cleanupEmptySmartGroups: host.cleanupEmptySmartGroups,
            arrangeSmartGroupMembers: host.arrangeSmartGroupMembers,
            createImageNodeAt: host.createImageNodeAt,
            stripImageGenerationMeta: host.stripImageGenerationMeta,
            inheritNodeMetaFromImage: host.inheritNodeMetaFromImage,
            clearDetachedRunInputRefs: host.clearDetachedRunInputRefs,
            pushUndo: host.pushUndo
        });
    }

    function onMarqueeFinished(selectedIds){
        capsuleSelection()?.onMarqueeFinished?.(selectedIds);
        const syncMultiSelectUi = () => global.SmartCanvasMultiSelectCompose?.syncUi?.();
        if(typeof global.queueMicrotask === 'function') global.queueMicrotask(syncMultiSelectUi);
        else global.setTimeout(syncMultiSelectUi, 0);
    }

    function syncCapsule(){
        capsule()?.sync?.();
    }

    function clearCapsule(){
        capsule()?.clear?.();
        global.SmartCanvasMultiSelectCompose?.syncUi?.();
    }

    function resolveDragIds(nodeId, e){
        const resolved = groupMembership()?.resolveDragIds?.(nodeId, e);
        if(resolved) return resolved;
        const selectedIds = host?.getSelectedIds?.() || [];
        const node = host?.getNodes?.()?.find?.(n => n.id === nodeId);
        if(host?.isSmartGroupNode?.(node)){
            return [node.id, ...(host.smartGroupMembers(node) || []).map(member => member.id)];
        }
        if(selectedIds.length > 1 && selectedIds.includes(nodeId)) return selectedIds.slice();
        return selectedIds.includes(nodeId) ? selectedIds.slice() : [nodeId];
    }

    function dragInvoke(){
        return {
            engageWholeGroup: host?.engageSmartGroup,
            queueDrag: host?.queueSmartNodeDrag,
            capturePendingUndo: host?.capturePendingUndo,
            screenToWorld: host?.screenToWorld
        };
    }

    function handleThumbMouseDown(e, hostNodeId, item){
        const invoke = dragInvoke();
        return Boolean(groupMembership()?.handleThumbMouseDown?.({
            e,
            hostNodeId,
            item,
            engageWholeGroup: invoke.engageWholeGroup,
            queueDrag: invoke.queueDrag,
            capturePendingUndo: invoke.capturePendingUndo,
            screenToWorld: invoke.screenToWorld
        }));
    }

    function handleNodeDragStart(nodeId, e){
        return Boolean(groupMembership()?.beginNodeDrag?.({
            nodeId,
            e,
            engageWholeGroup: host?.engageSmartGroup,
            queueDrag: host?.queueSmartNodeDrag,
            isCoCreateDragSurface: (node, target) => global.SmartCanvasCoCreate?.isNodeDragSurface?.(node, target)
        }));
    }

    function tryDragIntoGroup(draggedNodes, smartGroupTarget){
        return Boolean(groupMembership()?.tryDragIntoGroup?.(draggedNodes, smartGroupTarget));
    }

    function pruneDraggedMembersOut(dragState){
        return Boolean(groupMembership()?.pruneDraggedMembersOut?.(dragState));
    }

    function handleDeleteHotkey(e, ctx){
        return Boolean(capsuleDelete()?.handleHotkey?.(e, ctx));
    }

    function handleImageDoubleClick(nodeId, imageIndex = 0, imageEl = null){
        return Boolean(dblclickViewport()?.activateImage?.(nodeId, imageIndex, imageEl));
    }

    function handlePromptDoubleClick(node){
        return Boolean(dblclickViewport()?.activatePrompt?.(node?.id));
    }

    function emptyNodeEventPayload(nodeId, e){
        const node = host?.getNodes?.()?.find?.(n => n.id === nodeId);
        if(!node) return null;
        return {
            target: e?.target || null,
            currentTarget: e?.currentTarget || null,
            preventDefault: () => e?.preventDefault?.(),
            stopPropagation: () => e?.stopPropagation?.(),
            __emptyNodeRef: node,
            __emptyNodeApi: {
                getNodes: host?.getNodes,
                hideSelectionGroupBox: host?.hideSelectionGroupBox,
                setSelectionMarqueeActive: host?.setSelectionMarqueeActive,
                setSmartCascadeSilentSelection: host?.setSmartCascadeSilentSelection,
                smartCascadeAnyRunning: host?.smartCascadeAnyRunning,
                setSelectedId: host?.setSelectedId,
                setSelectedIds: host?.setSelectedIds,
                setSelectedImage: host?.setSelectedImage,
                syncSelectionUi: host?.syncSelectionUi,
                updateComposer: host?.updateComposer,
                focusCanvasForShortcuts: host?.focusCanvasForShortcuts,
                scheduleComposerReposition: host?.scheduleComposerReposition
            }
        };
    }

    function handleEmptyNodeClick(nodeId, e){
        const payload = emptyNodeEventPayload(nodeId, e);
        if(!payload) return false;
        return Boolean(emptyNodeChrome()?.handleBlankClick?.(nodeId, payload));
    }

    function handleEmptyNodeDoubleClick(nodeId, e){
        const payload = emptyNodeEventPayload(nodeId, e);
        if(!payload) return false;
        return Boolean(emptyNodeChrome()?.handleBlankDoubleClick?.(nodeId, payload));
    }

    const api = Object.freeze({
        install,
        onMarqueeFinished,
        syncCapsule,
        clearCapsule,
        resolveDragIds,
        handleThumbMouseDown,
        handleNodeDragStart,
        tryDragIntoGroup,
        pruneDraggedMembersOut,
        handleDeleteHotkey,
        handleImageDoubleClick,
        handlePromptDoubleClick,
        handleEmptyNodeClick,
        handleEmptyNodeDoubleClick
    });

    global.SmartCanvasCore?.register?.('isolatedFeatures', api);
    global.SmartCanvasIsolatedFeatures = api;
})(window);
