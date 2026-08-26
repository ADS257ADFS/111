(function(global){
    'use strict';

    function createCatalog(){
        const tools = new Map();

        function add(tool){
            if(!tool || typeof tool.id !== 'string' || !tool.id.trim()){
                throw new Error('Director3D tool requires a stable id');
            }
            const id = tool.id.trim();
            tools.set(id, Object.freeze({...tool, id}));
            return tools.get(id);
        }

        function remove(id){
            return tools.delete(String(id || ''));
        }

        function get(id){
            return tools.get(String(id || '')) || null;
        }

        function list(){
            return Array.from(tools.values());
        }

        function setActiveToolState(context, id){
            const store = context?.store;
            if(!store?.patchState) return;
            const state = store.getState?.() || {};
            store.patchState({
                tool: {
                    ...(state.tool || {}),
                    activeTool: id
                }
            });
        }

        function activate(id, context = {}){
            const nextId = String(id || '');
            const nextTool = get(nextId);
            if(!nextTool) return false;
            const state = context.store?.getState?.() || {};
            const previousId = state.tool?.activeTool || '';
            const previousTool = get(previousId);
            if(previousId === nextId) return true;

            const command = {
                id: `tool.activate.${nextId}`,
                label: `切换工具：${nextTool.label || nextId}`,
                apply(ctx){
                    previousTool?.deactivate?.(ctx);
                    nextTool.activate?.(ctx);
                    setActiveToolState(ctx, nextId);
                },
                revert(ctx){
                    nextTool.deactivate?.(ctx);
                    previousTool?.activate?.(ctx);
                    setActiveToolState(ctx, previousId);
                }
            };

            if(context.commandBus?.execute) context.commandBus.execute(command, context);
            else command.apply(context);
            return true;
        }

        return Object.freeze({
            add,
            remove,
            get,
            list,
            activate
        });
    }

    global.Director3DToolCatalog = Object.freeze({createCatalog});
})(window);
