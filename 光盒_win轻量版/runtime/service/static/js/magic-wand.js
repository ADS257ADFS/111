(function(root, factory){
    const api = factory();
    if(typeof module === 'object' && module.exports) module.exports = api;
    root.MagicWand = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
    function matches(data, offset, target, tolerance){
        return Math.max(
            Math.abs(data[offset] - target[0]),
            Math.abs(data[offset + 1] - target[1]),
            Math.abs(data[offset + 2] - target[2]),
            Math.abs(data[offset + 3] - target[3])
        ) <= tolerance;
    }

    function selectByColor(imageData, seedX, seedY, tolerance=32, contiguous=true){
        const data = imageData?.data;
        const width = Math.max(0, Number(imageData?.width || 0));
        const height = Math.max(0, Number(imageData?.height || 0));
        const size = width * height;
        const mask = new Uint8Array(size);
        if(!data || !size) return mask;
        const x = Math.max(0, Math.min(width - 1, Math.floor(seedX)));
        const y = Math.max(0, Math.min(height - 1, Math.floor(seedY)));
        const seed = y * width + x;
        const offset = seed * 4;
        const target = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
        const limit = Math.max(0, Math.min(255, Number(tolerance) || 0));

        if(!contiguous){
            for(let index = 0; index < size; index++){
                if(matches(data, index * 4, target, limit)) mask[index] = 1;
            }
            return mask;
        }

        const visited = new Uint8Array(size);
        const queue = new Int32Array(size);
        let head = 0;
        let tail = 0;
        queue[tail++] = seed;
        visited[seed] = 1;
        while(head < tail){
            const index = queue[head++];
            if(!matches(data, index * 4, target, limit)) continue;
            mask[index] = 1;
            const px = index % width;
            const py = (index / width) | 0;
            if(px > 0 && !visited[index - 1]){ visited[index - 1] = 1; queue[tail++] = index - 1; }
            if(px + 1 < width && !visited[index + 1]){ visited[index + 1] = 1; queue[tail++] = index + 1; }
            if(py > 0 && !visited[index - width]){ visited[index - width] = 1; queue[tail++] = index - width; }
            if(py + 1 < height && !visited[index + width]){ visited[index + width] = 1; queue[tail++] = index + width; }
        }
        return mask;
    }

    function invertMask(mask){
        const result = new Uint8Array(mask?.length || 0);
        for(let index = 0; index < result.length; index++) result[index] = mask[index] ? 0 : 1;
        return result;
    }

    function unionMasks(left, right){
        const length = Math.max(left?.length || 0, right?.length || 0);
        const result = new Uint8Array(length);
        for(let index = 0; index < length; index++) result[index] = left?.[index] || right?.[index] ? 1 : 0;
        return result;
    }

    function applyMaskToAlpha(rgba, mask){
        const pixels = Math.min(mask?.length || 0, Math.floor((rgba?.length || 0) / 4));
        for(let index = 0; index < pixels; index++){
            if(mask[index]) rgba[index * 4 + 3] = 0;
        }
        return rgba;
    }

    return {selectByColor, invertMask, unionMasks, applyMaskToAlpha};
});
