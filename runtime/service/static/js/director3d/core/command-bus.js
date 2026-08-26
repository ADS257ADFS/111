(function(global){
    'use strict';

    function createCommandBus(baseContext = {}){
        function contextWith(extra = {}){
            return {...baseContext, ...extra};
        }

        function execute(command, extraContext = {}){
            if(!command || typeof command.apply !== 'function'){
                throw new Error('Director3D command requires an apply(context) function');
            }
            const context = contextWith(extraContext);
            command.apply(context);
            if(typeof command.revert === 'function') context.history?.push?.(command);
            return true;
        }

        function undo(extraContext = {}){
            return Boolean(baseContext.history?.undo?.(contextWith(extraContext)));
        }

        function redo(extraContext = {}){
            return Boolean(baseContext.history?.redo?.(contextWith(extraContext)));
        }

        return Object.freeze({
            execute,
            undo,
            redo
        });
    }

    global.Director3DCommandBus = Object.freeze({createCommandBus});
})(window);
