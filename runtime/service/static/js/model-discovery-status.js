(function(root, factory){
    const api = factory();
    if(typeof module === 'object' && module.exports) module.exports = api;
    if(root) root.ModelDiscoveryStatus = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
    const labels = {
        verified: total => `已验证完整 · 共 ${total} 个模型`,
        unknown: total => `上游接口仅公开 ${total} 个模型 · 无法确认后台全量`,
        failed: () => '没有可用模型目录'
    };

    function totalFor(data){
        const total = Number(data?.total);
        return Number.isFinite(total) && total >= 0 ? total : modelIds(data).length;
    }

    function summarize(data){
        const kind = data?.completeness === 'verified' || data?.completeness === 'unknown'
            ? data.completeness
            : 'failed';
        const total = totalFor(data);
        const supplementCount = supplementedIds(data).length;
        if(!supplementCount) return {kind, label: labels[kind](total)};
        const upstreamCount = Math.max(0, total - supplementCount);
        if(kind === 'verified') return {kind, label: `已验证上游 ${upstreamCount} 个模型 · 内置兼容 ${supplementCount} 个`};
        if(kind === 'unknown') return {kind, label: `上游接口公开 ${upstreamCount} 个模型 · 内置兼容 ${supplementCount} 个 · 无法确认后台全量`};
        return {kind, label: `没有可用上游模型目录 · 内置兼容 ${supplementCount} 个`};
    }

    function modelIds(data){
        const seen = new Set();
        return (Array.isArray(data?.all) ? data.all : []).reduce((ids, value) => {
            if(typeof value !== 'string') return ids;
            const id = value.trim();
            if(id && !seen.has(id)) {
                seen.add(id);
                ids.push(id);
            }
            return ids;
        }, []);
    }

    function supplementedIds(data){
        const available = new Set(modelIds(data));
        const seen = new Set();
        return (Array.isArray(data?.supplemented_models) ? data.supplemented_models : []).reduce((ids, value) => {
            if(typeof value !== 'string') return ids;
            const id = value.trim();
            if(id && available.has(id) && !seen.has(id)) {
                seen.add(id);
                ids.push(id);
            }
            return ids;
        }, []);
    }

    function pathFor(value){
        try {
            const url = new URL(String(value || ''));
            if(url.protocol !== 'http:' && url.protocol !== 'https:') return '';
            return url.pathname || '/';
        } catch(error) {
            return '';
        }
    }

    function safeUrlPath(value){
        const token = String(value || '');
        return pathFor(token.startsWith('//') ? `https:${token}` : token);
    }

    function safeError(value){
        return String(value || '')
            .replace(/(^|[\s(=])((?:[a-z][a-z0-9+.-]*:\S+|\/\/\S+))/gim, (_, prefix, token) => `${prefix}${safeUrlPath(token)}`)
            .replace(/[?#][^\s]*/g, '')
            .replace(/\bauthorization\s*[:=]\s*[^\r\n]*/gi, 'Authorization: [redacted]')
            .replace(/\b(bearer\s+)([^\s,;]+)/gi, '$1[redacted]')
            .replace(/\bauthorization(?:\s*[:=]\s*|\s+)(?:(?:basic|bearer|token)\s+)?[^\s,;]+/gi, 'Authorization: [redacted]')
            .replace(/\b(x(?:[_ -]?goog)?[_ -]?api[_ -]?key|api[_ -]?key|token|secret|password)\s*(?:[:=]\s*|\s+)[^\s,;]+/gi, '$1=[redacted]')
            .slice(0, 300);
    }

    function authName(value){
        const name = String(value || '').trim().toLowerCase();
        return ['bearer', 'x-api-key', 'api-key', 'x-goog-api-key'].includes(name) ? name : '';
    }

    function nonNegativeNumber(value){
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : 0;
    }

    function safeAttempts(data){
        return (Array.isArray(data?.attempts) ? data.attempts : []).map(attempt => {
            const row = {
                path: pathFor(attempt?.url),
                auth: authName(attempt?.auth),
                status: nonNegativeNumber(attempt?.status),
                pages: nonNegativeNumber(attempt?.pages_fetched),
                models: nonNegativeNumber(attempt?.model_count)
            };
            if(typeof attempt?.pagination_strategy === 'string' && attempt.pagination_strategy) row.pagination = attempt.pagination_strategy;
            if(attempt?.completeness === 'verified' || attempt?.completeness === 'unknown') row.completeness = attempt.completeness;
            const error = safeError(attempt?.error);
            if(error) row.error = error;
            return row;
        });
    }

    return {summarize, safeAttempts, modelIds, supplementedIds};
});
