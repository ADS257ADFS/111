(function(global){
    'use strict';

    function createElement(className){
        const element = document.createElement('div');
        element.className = className;
        return element;
    }

    function applyRect(element, rect){
        element.style.left = `${rect.x}px`;
        element.style.top = `${rect.y}px`;
        element.style.width = `${rect.width}px`;
        element.style.height = `${rect.height}px`;
    }

    function createShotMask(container){
        const mask = createElement('director3d-shot-mask');
        const pieces = ['top', 'right', 'bottom', 'left'].map(name => {
            const piece = createElement(`director3d-shot-mask-piece ${name}`);
            mask.appendChild(piece);
            return piece;
        });
        const frame = createElement('director3d-shot-frame');
        ['tl', 'tr', 'br', 'bl'].forEach(name => {
            const corner = createElement(`director3d-shot-corner ${name}`);
            frame.appendChild(corner);
        });
        mask.appendChild(frame);
        container.appendChild(mask);
        return {mask, pieces, frame};
    }

    function setShotMask(maskApi, viewport, shotFrame){
        const {mask, pieces, frame} = maskApi;
        mask.hidden = false;
        applyRect(pieces[0], {x:0, y:0, width:viewport.width, height:shotFrame.y});
        applyRect(pieces[1], {x:shotFrame.x + shotFrame.width, y:shotFrame.y, width:viewport.width - shotFrame.x - shotFrame.width, height:shotFrame.height});
        applyRect(pieces[2], {x:0, y:shotFrame.y + shotFrame.height, width:viewport.width, height:viewport.height - shotFrame.y - shotFrame.height});
        applyRect(pieces[3], {x:0, y:shotFrame.y, width:shotFrame.x, height:shotFrame.height});
        applyRect(frame, shotFrame);
        frame.dataset.aspectRatio = shotFrame.aspectRatio?.label || shotFrame.label || '';
    }

    function hideShotMask(maskApi){
        maskApi.mask.hidden = true;
    }

    function createQuadLayer(container){
        const layer = createElement('director3d-quad-layer');
        container.appendChild(layer);
        return layer;
    }

    function setQuadLabels(layer, frames){
        layer.hidden = false;
        layer.innerHTML = frames.map(frame => `
            <div class="director3d-quad-label" data-director3d-quad-frame="${frame.id}" style="left:${frame.x}px;top:${frame.y}px;width:${frame.width}px;height:${frame.height}px">
                <span>${frame.label}</span>
            </div>
        `).join('');
    }

    function createFallbackStage(container){
        const fallback = createElement('director3d-viewport-fallback');
        fallback.textContent = '3D 视口初始化中';
        container.appendChild(fallback);
        return {
            render(){},
            resize(){},
            exportImage(){ return ''; },
            dispose(){ fallback.remove(); }
        };
    }

    global.Director3DViewportOverlay = Object.freeze({
        createElement,
        createShotMask,
        setShotMask,
        hideShotMask,
        createQuadLayer,
        setQuadLabels,
        createFallbackStage
    });
})(window);
