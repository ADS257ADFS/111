(function(global){
    'use strict';

    const PRIMITIVES = Object.freeze([
        {id:'mannequin', label:'基础人偶', geometryRef:'primitive:mannequin'},
        {id:'cube', label:'立方体', geometryRef:'primitive:cube'},
        {id:'cylinder', label:'圆柱', geometryRef:'primitive:cylinder'},
        {id:'sphere', label:'球体', geometryRef:'primitive:sphere'},
        {id:'plane', label:'平面', geometryRef:'primitive:plane'},
        {id:'wall', label:'墙面', geometryRef:'primitive:wall'}
    ]);

    function list(){
        return PRIMITIVES.slice();
    }

    function get(modelId){
        return PRIMITIVES.find(item => item.id === String(modelId || '')) || null;
    }

    function createObject(modelId, {id, index = 1} = {}){
        const item = get(modelId);
        const objectId = String(id || '');
        if(!item || !objectId) return null;
        const isFlat = item.geometryRef === 'primitive:plane';
        const isWall = item.geometryRef === 'primitive:wall';
        return {
            id:objectId,
            type:item.geometryRef === 'primitive:mannequin' ? 'character' : 'mesh',
            name:`${item.label} ${Math.max(1, Number(index) || 1)}`,
            parentId:'',
            childrenIds:[],
            visible:true,
            locked:false,
            transform:{
                position:[0, isFlat ? 0.01 : (isWall ? 1 : 0.5), 0],
                rotation:[0, 0, 0, 1],
                scale:[1, 1, 1],
                pivot:[0, 0, 0]
            },
            geometryRef:item.geometryRef,
            materialIds:['mat_default'],
            components:{},
            metadata:{libraryId:item.id, color:'#d8dbe0'},
            extensions:{}
        };
    }

    global.Director3DPrimitiveCatalog = Object.freeze({list, get, createObject});
})(window);
