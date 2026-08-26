/**
 * Smart Canvas — smart-group membership drag (in / out / auto-dissolve).
 * Edit group drag behavior here; do not scatter logic across smart-canvas.js.
 */
(function(global){
    'use strict';

    let deps = null;
    function registerDeps(next){ deps = next; }
    function d(){ return deps; }

    function isSmartGroupInteractiveTarget(target){
        return !!target?.closest?.(
            '.thumb-item, .image-wrap, .image-delete, .node-port, .node-resize-handle, .mini-x, button, input, textarea, select, .prompt-node-control, .prompt-node-pill, .smart-node-input-thumb'
        );
    }

    function isWholeGroupDragSurface(e){
        const target = e?.target;
        if(!target) return false;
        if(target.closest?.(
            '[data-smart-group-frame-hit], .node-head, .node-actions, .smart-group-empty, .smart-group-toolbar, [data-smart-group-action]'
        )) return true;
        const groupEl = target.closest?.('.image-node.smart-group-node');
        if(!groupEl) return false;
        if(isSmartGroupInteractiveTarget(target)) return false;
        return !!target.closest?.('.smart-group-card, .node-body, .node-hint, .run-status-stack, .floating-node-actions');
    }

    function resolveDragIds(nodeId, e){
        const api = d();
        if(!api) return [nodeId];
        const node = api.nodes?.find?.(n => n.id === nodeId);
        if(!node) return [nodeId];
        const selectedIds = api.selectedIds || [];

        if(api.isSmartGroupNode?.(node)){
            if(isWholeGroupDragSurface(e)){
                return [node.id, ...api.smartGroupMembers(node).map(member => member.id)];
            }
            return [nodeId];
        }

        const parentGroup = api.smartGroupContainingNode?.(nodeId);
        if(!parentGroup){
            if(selectedIds.length > 1 && selectedIds.includes(nodeId)) return selectedIds.slice();
            return selectedIds.includes(nodeId) ? selectedIds.slice() : [nodeId];
        }

        if(selectedIds.length > 1){
            const inSameGroup = selectedIds.filter(id => api.smartGroupContainingNode?.(id)?.id === parentGroup.id);
            if(inSameGroup.length > 1) return inSameGroup.slice();
            if(selectedIds.includes(nodeId)) return selectedIds.slice();
        }

        return [nodeId];
    }

    function extractAbsorbedImage(groupId, imageIndex, worldPoint){
        const api = d();
        const group = api.nodes?.find?.(n => n.id === groupId);
        if(!group || !api.isSmartGroupNode?.(group)) return null;
        const images = group.images || [];
        const img = images[imageIndex];
        if(!img?.url) return null;
        group.images = images.filter((_, index) => index !== imageIndex);
        if(!group.images.length){
            delete group.w;
            delete group.h;
        }
        const point = worldPoint || {x:(Number(group.x) || 0) + 48, y:(Number(group.y) || 0) + 72};
        const node = api.createImageNodeAt?.(point, [api.stripImageGenerationMeta?.({...img}) || {...img}], {select:false, skipUndo:true});
        if(!node) return null;
        api.inheritNodeMetaFromImage?.(node);
        api.clearDetachedRunInputRefs?.(node);
        api.cleanupEmptySmartGroups?.();
        if((group.images || []).length || api.smartGroupMembers?.(group).length){
            api.arrangeSmartGroupMembers?.(group, {skipUndo:true});
        }
        return node;
    }

    function handleThumbMouseDown(payload){
        const api = d();
        if(!api || !payload?.e || !payload.item) return false;
        const e = payload.e;
        const hostNodeId = payload.hostNodeId;
        const item = payload.item;
        const node = api.nodes?.find?.(n => n.id === hostNodeId);
        if(!node) return false;

        const targetNodeId = item.dataset.refNodeId || hostNodeId;
        const imageIndex = Number(item.dataset.refImageIndex ?? item.dataset.imageIndex ?? 0);

        if(api.isSmartGroupNode?.(node)){
            if(isWholeGroupDragSurface(e)){
                payload.engageWholeGroup?.(node.id, e);
                return true;
            }
            if(targetNodeId === hostNodeId){
                payload.capturePendingUndo?.();
                const world = payload.screenToWorld?.(e) || null;
                const created = extractAbsorbedImage(hostNodeId, imageIndex, world);
                if(created?.id) payload.queueDrag?.(e, created.id, {skipUndoCapture:true, originSmartGroupId: hostNodeId});
                return Boolean(created?.id);
            }
            payload.queueDrag?.(e, targetNodeId);
            return true;
        }

        if(api.smartGroupContainingNode?.(hostNodeId)){
            payload.queueDrag?.(e, targetNodeId || hostNodeId);
            return true;
        }

        return false;
    }

    function isMemberOutsideGroup(member, group){
        const api = d();
        if(!member || !group) return false;
        const groupRect = api.nodeRect?.(group);
        const rect = api.nodeRect?.(member);
        if(!groupRect || !rect) return false;
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        return !(cx >= groupRect.x && cx <= groupRect.x + groupRect.width && cy >= groupRect.y && cy <= groupRect.y + groupRect.height);
    }

    function pruneDraggedMembersOut(dragState){
        const api = d();
        if(!api || !dragState) return false;
        const touchedGroups = new Set();
        let changed = false;
        (dragState.group || [{id: dragState.id}]).forEach(item => {
            const member = api.nodes?.find?.(n => n.id === item.id);
            const memberGroup = member ? api.smartGroupContainingNode?.(member.id) : null;
            if(!member || !memberGroup) return;
            if(!isMemberOutsideGroup(member, memberGroup)) return;
            if(api.pruneSmartGroupMembershipsForNode?.(member)){
                changed = true;
                touchedGroups.add(memberGroup.id);
            }
        });
        touchedGroups.forEach(groupId => {
            const group = api.nodes?.find?.(n => n.id === groupId);
            if(group && api.isSmartGroupNode?.(group) && api.smartGroupMembers?.(group).length){
                api.arrangeSmartGroupMembers?.(group, {skipUndo:true});
            }
        });
        return changed;
    }

    function tryDragIntoGroup(draggedNodes, smartGroupTarget){
        const api = d();
        if(!api || !smartGroupTarget) return false;
        const list = (draggedNodes || []).filter(Boolean);
        if(!list.length) return false;
        return Boolean(api.addDraggedNodesToSmartGroup?.(list, smartGroupTarget));
    }

    function beginNodeDrag(payload){
        const api = d();
        if(!api || !payload?.e || !payload.nodeId) return false;
        const e = payload.e;
        const nodeId = payload.nodeId;
        const node = api.nodes?.find?.(n => n.id === nodeId);
        const selectedIds = api.selectedIds || [];
        if(selectedIds.length > 1 && selectedIds.includes(nodeId)){
            payload.queueDrag?.(e, nodeId);
            return true;
        }
        if(api.isSmartGroupNode?.(node)){
            if(isWholeGroupDragSurface(e)){
                payload.engageWholeGroup?.(nodeId, e);
                return true;
            }
            payload.queueDrag?.(e, nodeId);
            return true;
        }
        if(api.smartGroupContainingNode?.(nodeId)){
            payload.queueDrag?.(e, nodeId);
            return true;
        }
        if(payload.isCoCreateDragSurface?.(node, e.target)){
            payload.queueDrag?.(e, nodeId);
            return true;
        }
        if(e.target?.closest?.('.thumb-item,.image-wrap,[data-pending-slot-cancel],.pending-slot-cancel,.pending-slot-footer,.pending-slot-inner,.loading-cell.pending-slot,.pending-batch-grid,.pending-mixed-grid,[data-inline-generation-cancel],button')) return false;
        payload.queueDrag?.(e, nodeId);
        return true;
    }

    const api = Object.freeze({
        registerDeps,
        isWholeGroupDragSurface,
        resolveDragIds,
        extractAbsorbedImage,
        handleThumbMouseDown,
        beginNodeDrag,
        pruneDraggedMembersOut,
        tryDragIntoGroup
    });

    global.SmartCanvasCore?.register?.('smartGroupMembership', api);
    global.SmartCanvasSmartGroupMembership = api;
})(window);
