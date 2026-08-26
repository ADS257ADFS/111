(function(global){
    'use strict';

    const PRESETS = Object.freeze([
        ['1:1', 1, 1],
        ['3:4', 3, 4],
        ['2:3', 2, 3],
        ['4:3', 4, 3],
        ['16:9', 16, 9],
        ['9:16', 9, 16],
        ['21:9', 21, 9]
    ].map(([key, width, height]) => Object.freeze({
        key,
        label: key,
        width,
        height,
        value: width / height,
        orientation: width === height ? 'square' : (width > height ? 'landscape' : 'portrait')
    })));

    function gcd(a, b){
        let x = Math.abs(Math.round(Number(a) || 1));
        let y = Math.abs(Math.round(Number(b) || 1));
        while(y){
            const t = y;
            y = x % y;
            x = t;
        }
        return Math.max(1, x);
    }

    function normalize(width, height){
        const safeW = Math.max(1, Math.round(Number(width) || 1));
        const safeH = Math.max(1, Math.round(Number(height) || 1));
        const div = gcd(safeW, safeH);
        const w = safeW / div;
        const h = safeH / div;
        return Object.freeze({
            key: `${w}:${h}`,
            label: `${w}:${h}`,
            width: w,
            height: h,
            value: w / h,
            orientation: w === h ? 'square' : (w > h ? 'landscape' : 'portrait')
        });
    }

    function parse(value, custom = {}){
        if(value && typeof value === 'object' && Number(value.width) > 0 && Number(value.height) > 0){
            return normalize(value.width, value.height);
        }
        const key = String(value || '16:9').trim().toLowerCase();
        if(key === 'custom') return normalize(custom.width, custom.height);
        const preset = PRESETS.find(item => item.key.toLowerCase() === key);
        if(preset) return preset;
        const match = key.match(/^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/);
        if(match) return normalize(Number(match[1]), Number(match[2]));
        return PRESETS.find(item => item.key === '16:9');
    }

    function fitFrame(containerWidth, containerHeight, ratio){
        const r = parse(ratio);
        const maxW = Math.max(1, Number(containerWidth) || 1);
        const maxH = Math.max(1, Number(containerHeight) || 1);
        let width = maxW;
        let height = width / r.value;
        if(height > maxH){
            height = maxH;
            width = height * r.value;
        }
        return {
            width: Math.round(width),
            height: Math.round(height),
            x: Math.round((maxW - width) / 2),
            y: Math.round((maxH - height) / 2)
        };
    }

    global.Director3DAspectRatio = Object.freeze({
        PRESETS,
        parse,
        fitFrame
    });
})(window);
