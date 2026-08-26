/**
 * Smart Canvas — canvas undo stack (snapshot push/pop).
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
        if(!c) throw new Error('[SmartCanvasUndo] deps not registered');
        return c;
    }

function capturePendingUndo(){ S().pendingUndoSnapshot = snapshotForUndo(); }

function commitPendingUndo(){
    if(S().pendingUndoSnapshot){
        S().undoStack.push(S().pendingUndoSnapshot);
        if(S().undoStack.length > S().UNDO_LIMIT) S().undoStack.shift();
        S().pendingUndoSnapshot = null;
    }
}

function discardPendingUndo(){ S().pendingUndoSnapshot = null; }

function snapshotForUndo(){
    return {
        nodes: JSON.parse(JSON.stringify(S().nodes)),
        connections: JSON.parse(JSON.stringify(S().canvas?.connections || [])),
        selectedId: S().selectedId,
        selectedIds: S().selectedIds.slice(),
        selectedImage: {...S().selectedImage}
    };
}

function pushUndo(){
    if(S().undoSuppressed) return;
    if(!S().canvas) return;
    S().undoStack.push(snapshotForUndo());
    if(S().undoStack.length > S().UNDO_LIMIT) S().undoStack.shift();
}

function performUndo(){
    if(!S().undoStack.length){ S().toast(S().tr('smart.toastNoUndo')); return; }
    const snap = S().undoStack.pop();
    S().undoSuppressed = true;
    S().nodes = snap.nodes;
    if(S().canvas) S().canvas.connections = snap.connections;
    S().selectedId = snap.selectedId;
    S().selectedIds = snap.selectedIds;
    S().selectedImage = snap.selectedImage;
    S().activeComposerSubject = null;
    S().lastComposerNodeId = '';
    S().render();
    S().scheduleSave();
    S().undoSuppressed = false;
    S().toast(S().tr('smart.toastUndone'));
}

    const api = Object.freeze({
        registerDeps,
        capturePendingUndo,
        commitPendingUndo,
        discardPendingUndo,
        snapshotForUndo,
        pushUndo,
        performUndo
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('undo', api);
    }
    global.SmartCanvasUndo = api;
})(window);
