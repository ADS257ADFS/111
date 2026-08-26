(function(global){
    'use strict';

    function createHistory(options = {}){
        const limit = Math.max(1, Number(options.limit || 80));
        const undoStack = [];
        const redoStack = [];

        function trim(){
            while(undoStack.length > limit) undoStack.shift();
        }

        function push(entry){
            if(!entry || typeof entry.revert !== 'function') return false;
            undoStack.push(entry);
            redoStack.length = 0;
            trim();
            return true;
        }

        function undo(context = {}){
            const entry = undoStack.pop();
            if(!entry) return false;
            entry.revert(context);
            redoStack.push(entry);
            return true;
        }

        function redo(context = {}){
            const entry = redoStack.pop();
            if(!entry) return false;
            entry.apply(context);
            undoStack.push(entry);
            trim();
            return true;
        }

        function clear(){
            undoStack.length = 0;
            redoStack.length = 0;
        }

        return Object.freeze({
            push,
            undo,
            redo,
            clear,
            canUndo: () => undoStack.length > 0,
            canRedo: () => redoStack.length > 0,
            size: () => ({undo: undoStack.length, redo: redoStack.length})
        });
    }

    global.Director3DHistory = Object.freeze({createHistory});
})(window);
