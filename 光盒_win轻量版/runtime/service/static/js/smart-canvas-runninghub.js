/**
 * Smart Canvas — RunningHub field parsing, param state, workflow fetch, request build.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    function d(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    const RH_KNOWN_FIELD_OPTIONS = {
        aspectRatio:['1:1','16:9','9:16','4:3','3:4','4:5','5:4','3:2','2:3','21:9','9:21'],
        aspect_ratio:['1:1','16:9','9:16','4:3','3:4','4:5','5:4','3:2','2:3','21:9','9:21'],
        ratio:['1:1','16:9','9:16','21:9','9:21','4:3','3:4','4:5','5:4','3:2','2:3'],
        resolution:['1k','2k','4k','8k'],
        size:['512','768','1024','1280','1536','2048'],
        quality:['low','medium','high','best'],
        scheduler:['normal','karras','exponential','sgm_uniform','simple','ddim_uniform'],
        sampler:['euler','euler_ancestral','heun','dpm_2','dpm_2_ancestral','lms','dpmpp_2m','dpmpp_sde','ddim','uni_pc']
    };

    function rhParamKey(nodeId, fieldName){
        return `${nodeId ?? ''}::${fieldName ?? ''}`;
    }

    function rhFieldKind(field){
        const type = String(field?.fieldType || '').trim().toUpperCase();
        if(type === 'IMAGE') return 'image';
        if(type === 'VIDEO') return 'video';
        if(type === 'AUDIO') return 'audio';
        if(type === 'SLIDER') return 'slider';
        if(['NUMBER','FLOAT','INTEGER','INT'].includes(type)) return 'number';
        if(['BOOLEAN','BOOL'].includes(type)) return 'boolean';
        const key = `${field?.fieldName || ''} ${field?.fieldValue || ''}`.toLowerCase();
        if(/\b(image|img|mask|photo|picture)\b/.test(key) || /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(key)) return 'image';
        if(/\b(video|movie|mp4)\b/.test(key) || /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(key)) return 'video';
        if(/\b(audio|sound|music|voice)\b/.test(key) || /\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(key)) return 'audio';
        return 'text';
    }

    function rhFieldRole(field){
        const kind = rhFieldKind(field);
        if(['image','video','audio','number','slider','boolean'].includes(kind)) return kind;
        const text = `${field?.fieldName || ''} ${field?.label || ''} ${field?.group || ''}`.toLowerCase();
        if(/prompt|positive|negative|text|caption|description|关键词|提示词|正向|负向/.test(text)) return 'prompt';
        return 'text';
    }

    function rhExtractFieldOptions(field){
        const candidates = [field?.fieldData, field?.options, field?.list, field?.values, field?.enum, field?.choices, field?.items, field?.selectOptions, field?.dropdown];
        for(const candidate of candidates){
            if(!Array.isArray(candidate) || !candidate.length) continue;
            if(candidate.every(x => ['string','number'].includes(typeof x))) return candidate.map(String);
            if(candidate.every(x => x && typeof x === 'object' && ('value' in x || 'label' in x || 'name' in x))){
                return candidate.map(x => x.value ?? x.label ?? x.name).filter(v => v !== undefined && v !== null).map(String);
            }
        }
        const name = String(field?.fieldName || '').trim();
        if(name){
            if(RH_KNOWN_FIELD_OPTIONS[name]) return RH_KNOWN_FIELD_OPTIONS[name].map(String);
            const hit = Object.keys(RH_KNOWN_FIELD_OPTIONS).find(k => k.toLowerCase() === name.toLowerCase());
            if(hit) return RH_KNOWN_FIELD_OPTIONS[hit].map(String);
        }
        return null;
    }

    function rhDefaultValue(field){
        let value = field?.fieldValue;
        if(Array.isArray(value)) value = value[0];
        if(value === undefined || value === null || typeof value === 'object') return '';
        return String(value);
    }

    function rhIsWorkflowLinkValue(value){
        return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && Number.isInteger(value[1]);
    }

    function rhRandomEnabled(field){
        return rhFieldKind(field) === 'number' && field?.random_enabled === true;
    }

    function settingsFrom(sourceSettings){
        const deps = d();
        return sourceSettings || deps?.settings || null;
    }

    function smartRhRandomValuesRef(){
        const deps = d();
        return deps?.smartRhRandomValues || {};
    }

    function smartRhRandomActiveFor(sourceSettings, key){
        const settings = settingsFrom(sourceSettings);
        if(!settings) return true;
        settings.rhRandomActive = settings.rhRandomActive || {};
        return settings.rhRandomActive[key] !== false;
    }

    function smartRhRandomActive(key){
        return smartRhRandomActiveFor(null, key);
    }

    function smartRhRandomValue(field){
        const deps = d();
        const fn = deps?.smartComfyRandomValue;
        if(typeof fn !== 'function'){
            return rhDefaultValue(field);
        }
        return fn({
            input:field.fieldName,
            name:field.label || field.fieldName,
            min:field.min,
            max:field.max,
            step:field.step,
            type:'number'
        });
    }

    function toggleSmartRhRandom(key){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return;
        const field = rhActiveFields().find(f => rhParamKey(f.nodeId, f.fieldName) === key);
        if(!rhRandomEnabled(field)) return;
        settings.rhRandomActive = settings.rhRandomActive || {};
        settings.rhRandomActive[key] = !smartRhRandomActive(key);
        deps?.persistActiveSmartSettings?.();
        deps?.renderDynamicParams?.();
        deps?.scheduleSave?.();
    }

    function rhEntryFields(entry){
        return Array.isArray(entry?.fields) ? entry.fields : [];
    }

    function rhUsableFields(fields){
        const list = Array.isArray(fields) ? fields : [];
        if(!list.length) return [];
        const enabled = list.filter(f => f.enabled === true);
        return enabled.length ? enabled : list;
    }

    function rhWorkflowJsonFromSources(...sources){
        for(const source of sources){
            if(source && typeof source === 'object' && Object.keys(source).length) return source;
        }
        return {};
    }

    function sortRunningHubFields(fields){
        return [...(fields || [])].sort((a, b) => {
            const ak = rhFieldKind(a), bk = rhFieldKind(b);
            if(ak === 'image' && bk === 'image'){
                const ao = Number(a.imageOrder) || 9999;
                const bo = Number(b.imageOrder) || 9999;
                if(ao !== bo) return ao - bo;
            }
            if(ak === 'image' && bk !== 'image') return -1;
            if(ak !== 'image' && bk === 'image') return 1;
            return String(a.nodeId || '').localeCompare(String(b.nodeId || ''), undefined, {numeric:true}) || String(a.fieldName || '').localeCompare(String(b.fieldName || ''));
        });
    }

    function rhCurrentKind(sourceSettings){
        const deps = d();
        const fn = deps?.selectedRunningHubRef;
        if(typeof fn !== 'function') return 'app';
        return fn(sourceSettings)?.kind || 'app';
    }

    function rhActiveFields(sourceSettings){
        const deps = d();
        const fn = deps?.selectedRunningHubRef;
        if(typeof fn !== 'function') return [];
        const ref = fn(sourceSettings);
        let fields = rhEntryFields(ref?.entry);
        if(ref?.kind === 'workflow'){
            const cache = deps?.runningHubWorkflowCache || {};
            const cached = cache[ref.id];
            if(Array.isArray(cached?.fields) && cached.fields.length) fields = cached.fields;
        }
        fields = rhUsableFields(fields);
        return sortRunningHubFields(fields);
    }

    function rhFieldIndexes(fields){
        const counters = {image:0, video:0, audio:0};
        const map = {};
        sortRunningHubFields(fields).forEach(field => {
            const kind = rhFieldKind(field);
            if(['image','video','audio'].includes(kind)){
                map[rhParamKey(field.nodeId, field.fieldName)] = counters[kind]++;
            }
        });
        return map;
    }

    function rhParamValue(field, media=null, sourceSettings=null, fields=null, randomValues=null){
        const settings = settingsFrom(sourceSettings);
        if(!settings) return '';
        randomValues = randomValues || smartRhRandomValuesRef();
        settings.rhParams = settings.rhParams || {};
        const key = rhParamKey(field.nodeId, field.fieldName);
        const param = settings.rhParams[key];
        const kind = rhFieldKind(field);
        if(['image','video','audio'].includes(kind)){
            const idx = rhFieldIndexes(fields || rhActiveFields(settings))[key] || 0;
            const up = media?.[kind]?.[idx]?.url || '';
            if(rhCurrentKind(settings) === 'workflow' && kind === 'image' && field.required !== true && !up) return '';
            return up || param?.value || rhDefaultValue(field);
        }
        if(rhRandomEnabled(field) && smartRhRandomActiveFor(settings, key)){
            if(randomValues[key] === undefined) randomValues[key] = smartRhRandomValue(field);
            return randomValues[key];
        }
        if(rhFieldRole(field) === 'prompt') return param?.value ?? (media?.prompt || rhDefaultValue(field));
        return param?.value ?? rhDefaultValue(field);
    }

    function rhUserParamValue(field){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        settings.rhParams = settings.rhParams || {};
        const key = rhParamKey(field.nodeId, field.fieldName);
        return settings.rhParams[key]?.value ?? '';
    }

    function rhPromptPlaceholder(field){
        const deps = d();
        const tr = deps?.tr || (k => k);
        return rhDefaultValue(field) || field?.label || field?.fieldName || tr('smart.promptPlaceholder');
    }

    function rhDefaultPromptSuggestion(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings || settings.engine !== 'runninghub') return '';
        const fields = rhActiveFields().filter(field => rhFieldRole(field) === 'prompt');
        for(const field of fields){
            const value = rhDefaultValue(field).trim();
            if(value) return value;
        }
        return '';
    }

    function runningHubRunNeedsPrompt(sourceSettings){
        const settings = settingsFrom(sourceSettings);
        if(!settings || settings.engine !== 'runninghub') return true;
        const fields = rhActiveFields(settings);
        const promptFields = fields.filter(field => rhFieldRole(field) === 'prompt');
        if(!promptFields.length) return false;
        return promptFields.some(field => field.required === true && !rhDefaultValue(field).trim());
    }

    async function ensureRunningHubWorkflow(workflowId){
        const deps = d();
        const cache = deps?.runningHubWorkflowCache;
        if(!cache) return null;
        workflowId = String(workflowId || '').trim();
        if(!workflowId) return null;
        if(cache[workflowId]) return cache[workflowId];
        const res = await fetch(`/api/runninghub/workflows/${encodeURIComponent(workflowId)}`);
        if(!res.ok){
            delete cache[workflowId];
            return null;
        }
        const data = await res.json();
        cache[workflowId] = data.workflow || null;
        return cache[workflowId];
    }

    async function currentRunningHubWorkflowConfig(sourceSettings){
        const deps = d();
        const fn = deps?.selectedRunningHubRef;
        if(typeof fn !== 'function') return null;
        const ref = fn(sourceSettings);
        if(ref?.kind !== 'workflow') return null;
        const cached = await ensureRunningHubWorkflow(ref.id).catch(() => null);
        return {
            ...(ref.entry || {}),
            ...(cached || {}),
            workflowId:ref.id,
            fields:Array.isArray(cached?.fields) && cached.fields.length ? cached.fields : rhEntryFields(ref.entry),
            optionalImageMode:ref.entry?.optionalImageMode || cached?.optionalImageMode || 'prune-workflow',
            workflowJson:rhWorkflowJsonFromSources(cached?.workflowJson, ref.entry?.workflowJson, ref.entry?.raw?.workflowJson, ref.entry?.raw?.prompt)
        };
    }

    function rhMediaForRun(prompt, refs){
        const deps = d();
        const imageRefsOnly = deps?.imageRefsOnly;
        const videoRefsOnly = deps?.videoRefsOnly;
        const audioRefsOnly = deps?.audioRefsOnly;
        const cleanRefs = (refs || []).filter(ref => ref?.url);
        return {
            refs:cleanRefs,
            image:typeof imageRefsOnly === 'function' ? imageRefsOnly(cleanRefs) : cleanRefs,
            video:typeof videoRefsOnly === 'function' ? videoRefsOnly(cleanRefs) : [],
            audio:typeof audioRefsOnly === 'function' ? audioRefsOnly(cleanRefs) : [],
            prompt:String(prompt || '').trim()
        };
    }

    function rhRequiredLabel(field){
        return field?.label || field?.fieldName || `#${field?.nodeId || ''}`;
    }

    function rhPruneWorkflowForMissingFields(workflowJson, missingFields){
        if(!workflowJson || typeof workflowJson !== 'object' || !missingFields?.length) return null;
        const workflow = JSON.parse(JSON.stringify(workflowJson));
        const removeIds = new Set();
        missingFields.forEach(field => {
            const node = workflow[String(field.nodeId)];
            if(node?.inputs && Object.prototype.hasOwnProperty.call(node.inputs, field.fieldName)){
                delete node.inputs[field.fieldName];
            }
            if(node && (!node.inputs || !Object.keys(node.inputs).length)){
                removeIds.add(String(field.nodeId));
            }
        });
        removeIds.forEach(id => delete workflow[id]);
        Object.values(workflow).forEach(node => {
            if(!node?.inputs || typeof node.inputs !== 'object') return;
            Object.entries(node.inputs).forEach(([name, value]) => {
                if(rhIsWorkflowLinkValue(value) && removeIds.has(String(value[0]))) delete node.inputs[name];
            });
        });
        return workflow;
    }

    async function rhBuildWorkflowRequestExtras(media, nodeInfoList, sourceSettings){
        const config = await currentRunningHubWorkflowConfig(sourceSettings);
        if(!config || (config.optionalImageMode || 'prune-workflow') !== 'prune-workflow') return {};
        const fields = rhActiveFields(sourceSettings);
        const indexes = rhFieldIndexes(fields);
        const missingOptional = [];
        for(const field of fields){
            if(rhFieldKind(field) !== 'image') continue;
            const key = rhParamKey(field.nodeId, field.fieldName);
            const idx = indexes[key] || 0;
            const hasInput = Boolean(media.image?.[idx]?.url);
            if(field.required === true && !hasInput) throw new Error(`RunningHub 工作流缺少必选图片：${rhRequiredLabel(field)}`);
            if(field.required !== true && !hasInput) missingOptional.push(field);
        }
        if(!missingOptional.length) return {};
        missingOptional.forEach(field => {
            const key = rhParamKey(field.nodeId, field.fieldName);
            const idx = nodeInfoList.findIndex(item => rhParamKey(item.nodeId, item.fieldName) === key);
            if(idx >= 0) nodeInfoList.splice(idx, 1);
        });
        const workflow = rhPruneWorkflowForMissingFields(config.workflowJson || {}, missingOptional);
        return workflow ? {workflow} : {};
    }

    async function rhUploadValueIfNeeded(value, sourceSettings){
        const deps = d();
        const tr = deps?.tr || (k => k);
        const settings = settingsFrom(sourceSettings);
        const text = String(value || '').trim();
        if(!text) return '';
        if(!/^https?:\/\//i.test(text) && !text.startsWith('/output/') && !text.startsWith('/assets/')) return text;
        const res = await fetch('/api/runninghub/upload-asset', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({url:text, useWallet:(settings || {}).rhPayment === 'wallet'})
        });
        const data = await res.json();
        if(!res.ok || data.success === false) throw new Error(data.detail || data.error || tr('smart.rhUploadFailed'));
        return data.data?.fileName || text;
    }

    async function rhBuildNodeInfoList(media, sourceSettings=null, randomValues=null){
        randomValues = randomValues || smartRhRandomValuesRef();
        const settings = settingsFrom(sourceSettings);
        const fields = rhActiveFields(settings);
        const result = [];
        const indexes = rhFieldIndexes(fields);
        const mode = rhCurrentKind(settings);
        for(const field of fields){
            const kind = rhFieldKind(field);
            const key = rhParamKey(field.nodeId, field.fieldName);
            if(mode === 'workflow' && field.sourceFromUpstream === false && !['image','video','audio'].includes(kind)) continue;
            if(mode === 'workflow' && kind === 'image'){
                const idx = indexes[key] || 0;
                if(field.required !== true && !media.image?.[idx]?.url) continue;
            }
            let value = rhParamValue(field, media, settings, fields, randomValues);
            if(rhFieldRole(field) === 'prompt' && !String(value || '').trim()) value = rhDefaultValue(field);
            if(['image','video','audio'].includes(kind)) value = await rhUploadValueIfNeeded(value, settings);
            if(['number','slider'].includes(kind) && String(value ?? '').trim() !== '' && !Number.isNaN(Number(value))) value = Number(value);
            result.push({nodeId:field.nodeId, fieldName:field.fieldName, fieldValue:value});
        }
        return result;
    }

    function parseRunningHubEntryKey(value){
 const text = String(value || '').trim();
 const match = text.match(/^(app|workflow):(.+)$/);
 return match ? {kind:match[1], id:match[2].trim()} : null;
}
    function runningHubAllEntries(){
 return [
 ...runningHubEntries('app').map(entry => ({kind:'app', id:runningHubEntryId(entry, 'app'), entry})).filter(x => x.id),
 ...runningHubEntries('workflow').map(entry => ({kind:'workflow', id:runningHubEntryId(entry, 'workflow'), entry})).filter(x => x.id)
 ];
}
    function selectedRunningHubRef(sourceSettings=null){
        const deps = d();
        const settings = settingsFrom(sourceSettings);
        const globalSettings = deps?.settings;
        const all = runningHubAllEntries();
        const parsed = parseRunningHubEntryKey(settings.rhConfigKey || '');
        let ref = parsed ? all.find(item => item.kind === parsed.kind && item.id === parsed.id) : null;
        if(!ref && all.length) ref = all[0];
        if(ref && sourceSettings == null && globalSettings){
            globalSettings.rhConfigKey = runningHubEntryKey(ref.kind, ref.id);
        }
        return ref || null;
    }
    function runningHubEntries(kind){
 const provider = runningHubProvider();
 const key = kind === 'workflow' ? 'rh_workflows' : 'rh_apps';
 return Array.isArray(provider?.[key]) ? provider[key].filter(item => item?.enabled !== false && item?.hidden !== true) : [];
}
    function runningHubEntryId(entry, kind){
 return String(kind === 'workflow' ? (entry?.workflowId || entry?.id || '') : (entry?.appId || entry?.webappId || entry?.id || '')).trim();
}
    function runningHubEntryKey(kind, id){
 return `${kind}:${String(id || '').trim()}`;
}
    function runningHubEntryLabel(entry, kind){
 const id = runningHubEntryId(entry, kind);
 return entry?.title || entry?.name || (kind === 'workflow' ? `Workflow ${id}` : `AI App ${id}`);
}
    function runningHubProvider(){
 return (d()?.apiProviders || []).find(p => p.id === 'runninghub' && p.enabled !== false) || null;
}
    const api = Object.freeze({
        runningHubProvider,
        runningHubEntryLabel,
        runningHubEntryKey,
        runningHubEntryId,
        runningHubEntries,
        selectedRunningHubRef,
        runningHubAllEntries,
        parseRunningHubEntryKey,
        RH_KNOWN_FIELD_OPTIONS,
        rhParamKey,
        rhFieldKind,
        rhFieldRole,
        rhExtractFieldOptions,
        rhDefaultValue,
        rhIsWorkflowLinkValue,
        rhRandomEnabled,
        smartRhRandomActive,
        smartRhRandomActiveFor,
        toggleSmartRhRandom,
        smartRhRandomValue,
        rhParamValue,
        rhUserParamValue,
        rhPromptPlaceholder,
        rhDefaultPromptSuggestion,
        rhFieldIndexes,
        sortRunningHubFields,
        rhActiveFields,
        rhCurrentKind,
        rhEntryFields,
        rhUsableFields,
        rhWorkflowJsonFromSources,
        runningHubRunNeedsPrompt,
        ensureRunningHubWorkflow,
        currentRunningHubWorkflowConfig,
        rhMediaForRun,
        rhRequiredLabel,
        rhPruneWorkflowForMissingFields,
        rhBuildWorkflowRequestExtras,
        rhUploadValueIfNeeded,
        rhBuildNodeInfoList,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('runninghub', api);
    }

    global.SmartCanvasRunningHub = api;
})(window);
