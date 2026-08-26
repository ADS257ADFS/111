(function(global){
    'use strict';

    function safeSize(width, height){
        return {
            width: Math.max(1, Math.round(Number(width) || 1)),
            height: Math.max(1, Math.round(Number(height) || 1))
        };
    }

    function computeShotFrame({width, height, aspectRatio} = {}){
        const size = safeSize(width, height);
        const ratio = global.Director3DAspectRatio.parse(aspectRatio || '16:9');
        const padding = Math.max(18, Math.round(Math.min(size.width, size.height) * 0.06));
        const innerWidth = Math.max(1, size.width - padding * 2);
        const innerHeight = Math.max(1, size.height - padding * 2);
        const frame = global.Director3DAspectRatio.fitFrame(innerWidth, innerHeight, ratio);
        return Object.freeze({
            ...frame,
            x: frame.x + padding,
            y: frame.y + padding,
            label: ratio.label,
            aspectRatio: ratio
        });
    }

    function computeQuadFrames({width, height} = {}){
        const size = safeSize(width, height);
        const halfW = Math.floor(size.width / 2);
        const halfH = Math.floor(size.height / 2);
        return Object.freeze([
            {id: 'perspective', label: '透视', x: 0, y: 0, width: halfW, height: halfH},
            {id: 'top', label: '顶视', x: halfW, y: 0, width: size.width - halfW, height: halfH},
            {id: 'front', label: '正视', x: 0, y: halfH, width: halfW, height: size.height - halfH},
            {id: 'side', label: '侧视', x: halfW, y: halfH, width: size.width - halfW, height: size.height - halfH}
        ]);
    }

    function describeViewport({viewMode, width, height, aspectRatio} = {}){
        const size = safeSize(width, height);
        const mode = ['panorama', 'shot', 'quad', 'front', 'side', 'top'].includes(viewMode) ? viewMode : 'panorama';
        if(mode === 'quad'){
            return Object.freeze({
                mode,
                frames: computeQuadFrames(size),
                dimOutsideFrame: false
            });
        }
        if(mode === 'shot'){
            return Object.freeze({
                mode,
                frames: [computeShotFrame({...size, aspectRatio})],
                dimOutsideFrame: true
            });
        }
        if(['front', 'side', 'top'].includes(mode)){
            return Object.freeze({
                mode,
                frames: [Object.freeze({id: mode, label: mode, x: 0, y: 0, width: size.width, height: size.height})],
                dimOutsideFrame: false
            });
        }
        return Object.freeze({
            mode: 'panorama',
            frames: [Object.freeze({id: 'panorama', label: '全景', x: 0, y: 0, width: size.width, height: size.height})],
            dimOutsideFrame: false
        });
    }

    global.Director3DViewportLayout = Object.freeze({
        computeShotFrame,
        computeQuadFrames,
        describeViewport
    });
})(window);
