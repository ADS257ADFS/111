(function(global){
    'use strict';

    function createBuiltInTools(){
        return [
            {
                id: 'select',
                label: '选择',
                description: '选择和检查场景对象',
                activate(){},
                deactivate(){}
            }
        ];
    }

    global.Director3DBuiltInTools = Object.freeze({createBuiltInTools});
})(window);
