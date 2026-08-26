/**

 * Smart Canvas — mode model pools aggregated from all API providers.

 * Canvas menus show model names only; provider is resolved when a model is selected.

 */

(function(global){

    'use strict';



    let bindings = null;

    let providers = [];

    // 自定义模型（固定名字 → 中转站+真实模型绑定），来自 /api/custom-models。
    // 只要某模态存在已绑定的名字，菜单就只显示这些名字；请求仍发真实模型。
    let customModels = null;



    const MODE_SETTINGS = {

        text: {provider: 'llmProvider', model: 'llmModel', onNode: true, field: 'chat_models'},

        image: {provider: 'provider_id', model: 'model', field: 'image_models'},

        video: {provider: 'videoProvider', model: 'videoModel', field: 'video_models'},

        audio: {provider: 'audioProvider', model: 'audioModel', field: 'audio_models'}

    };



    function setBindings(next){

        bindings = next && typeof next === 'object' ? next : null;

    }



    function setProviders(list){

        providers = Array.isArray(list) ? list : [];

    }



    function getBindings(){

        return bindings;

    }



    function setCustomModels(next){

        customModels = next && typeof next === 'object' ? next : null;

    }



    function customRows(mode){

        const rows = Array.isArray(customModels?.[mode]) ? customModels[mode] : [];

        return rows.filter(row => row && String(row.name || '').trim());

    }



    function customEntries(mode){

        return customRows(mode).filter(row => String(row.provider_id || '').trim() && String(row.model || '').trim());

    }



    function customEntryByName(mode, name){

        const target = String(name || '').trim();

        if(!target) return null;

        return customEntries(mode).find(entry => entry.name === target) || null;

    }



    // 每个模态一个全局模型选择：用户选一次，全画布所有节点默认跟随，
    // localStorage 持久化，重启后仍然生效。
    const GLOBAL_ALIAS_KEY = 'lightbox-global-model-alias';

    function readGlobalAliases(){
        try {
            const data = JSON.parse(global.localStorage?.getItem(GLOBAL_ALIAS_KEY) || '{}');
            return data && typeof data === 'object' ? data : {};
        } catch(_err){ return {}; }
    }

    function globalAlias(mode){
        return String(readGlobalAliases()[mode] || '').trim();
    }

    function setGlobalAlias(mode, name){
        if(!mode) return;
        try {
            const data = readGlobalAliases();
            data[mode] = String(name || '').trim();
            global.localStorage?.setItem(GLOBAL_ALIAS_KEY, JSON.stringify(data));
        } catch(_err){}
    }



    function customNameForModel(mode, model, providerId='', preferredAlias=''){

        const target = String(model || '').trim();

        if(!target) return '';

        const list = customEntries(mode);

        // 多个别名可能绑到同一个真实模型：优先返回用户实际选中的那个别名
        const preferred = String(preferredAlias || '').trim();

        if(preferred){
            const hit = list.find(entry => entry.name === preferred && entry.model === target
                && (!providerId || entry.provider_id === providerId));
            if(hit) return hit.name;
        }

        const exact = providerId ? list.find(entry => entry.model === target && entry.provider_id === providerId) : null;

        return (exact || list.find(entry => entry.model === target))?.name || '';

    }



    function getBinding(mode){

        return bindings?.[mode] || null;

    }



    function providerList(){

        if(providers.length) return providers;

        return global.SmartCanvasProviders?.getProviders?.() || [];

    }



    function modelEntries(mode){

        const meta = MODE_SETTINGS[mode];

        if(!meta) return [];

        const field = meta.field;

        const entries = [];

        providerList().forEach(item => {

            if(item?.enabled === false) return;

            (item?.[field] || []).forEach(model => {

                const name = String(model || '').trim();

                if(name) entries.push({model: name, provider_id: item.id});

            });

        });

        return entries;

    }



    function enabledModels(mode){
        const list = getBinding(mode)?.enabled_models;

        if(Array.isArray(list)) return [...new Set(list.filter(Boolean))];

        const fromProviders = modelEntries(mode).map(entry => entry.model);

        return [...new Set(fromProviders)];

    }



    function providerForModel(mode, model){

        const target = String(model || '').trim();

        if(!target) return '';

        const owner = modelEntries(mode).find(entry => entry.model === target);

        if(owner?.provider_id) return owner.provider_id;

        const PS = global.SmartCanvasProviderSelection;

        if(mode === 'image' && PS?.ownerImageProviderForModel) return PS.ownerImageProviderForModel(target) || '';

        if(mode === 'video' && PS?.ownerVideoProviderForModel) return PS.ownerVideoProviderForModel(target) || '';

        if(mode === 'text' && PS?.ownerChatProviderForModel) return PS.ownerChatProviderForModel(target) || '';

        if(mode === 'audio' && PS?.ownerAudioProviderForModel) return PS.ownerAudioProviderForModel(target) || '';

        return String(getBinding(mode)?.provider_id || '').trim();

    }



    function bindingProviderId(mode, model=''){

        const resolved = providerForModel(mode, model);

        if(resolved) return resolved;

        return String(getBinding(mode)?.provider_id || '').trim();

    }



    function defaultModel(mode){

        const binding = getBinding(mode);

        const models = enabledModels(mode);

        const preferred = String(binding?.default_model || '').trim();

        if(preferred && models.includes(preferred)) return preferred;

        return models[0] || '';

    }

    function hasVideoMaterial(node){

        if(!node) return false;

        const media = Array.isArray(node.images) ? node.images.filter(Boolean) : [];

        if(!media.length) return false;

        return media.every(item => {

            if(item?.kind === 'video') return true;

            const mime = String(item?.mime_type || item?.mimeType || '').toLowerCase();

            if(mime.startsWith('video/')) return true;

            return /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(String(item?.url || ''));

        });

    }

    function isVideoOutputNode(node){

        if(!node) return false;

        const media = Array.isArray(node.images) ? node.images.filter(Boolean) : [];

        if(media.length){

            return hasVideoMaterial(node);

        }

        return node.pendingOutputKind === 'video'

            || node.outputKind === 'video'

            || node.portLinkKind === 'video'

            || node.runSettings?.apiKind === 'video';

    }



    function resolveComposerMode(settings, node, modeForFn){

        if(typeof modeForFn === 'function'){

            const fromNode = modeForFn(node);

            if(fromNode) return fromNode;

        }

        if(settings?.apiKind === 'video') return 'video';

        if(settings?.apiKind === 'audio') return 'audio';

        if(node?.llmEnabled || node?.type === 'smart-prompt') return 'text';

        return 'image';

    }



    function currentModel(settings, node, mode){

        const keys = MODE_SETTINGS[mode];

        if(!keys) return '';

        if(keys.onNode && node) return node[keys.model] || defaultModel(mode);

        return settings?.[keys.model] || defaultModel(mode);

    }



    function applyBindingToSettings(settings, mode){

        if(!settings || !mode) return settings;

        const keys = MODE_SETTINGS[mode];

        if(!keys) return settings;

        const customs = customEntries(mode);

        if(customs.length){

            const aliasKey = keys.model + 'Alias';

            const current = String(settings[keys.model] || '').trim();

            // 1) 全局选择最优先（选一次全画布默认），其次是本地记过的别名
            const aliasOwner = customEntryByName(mode, globalAlias(mode))
                || customEntryByName(mode, settings[aliasKey]);

            if(aliasOwner){
                settings[keys.model] = aliasOwner.model;
                settings[keys.provider] = aliasOwner.provider_id;
                settings[aliasKey] = aliasOwner.name;
                return settings;
            }

            // 2) 已有模型就保持不动（选定即锁定），只补齐 provider 和别名记录
            if(current){
                const owner = customs.find(entry => entry.model === current && entry.provider_id === settings[keys.provider])
                    || customs.find(entry => entry.model === current);
                if(owner){
                    settings[keys.provider] = owner.provider_id;
                    settings[aliasKey] = owner.name;
                }
                return settings;
            }

            // 3) 全新状态才落到第一个已绑定的名字
            const first = customs[0];

            settings[keys.model] = first.model;

            settings[keys.provider] = first.provider_id;

            settings[aliasKey] = first.name;

            return settings;

        }

        const models = enabledModels(mode);

        const current = settings[keys.model];

        settings[keys.model] = models.includes(current) ? current : defaultModel(mode);

        settings[keys.provider] = providerForModel(mode, settings[keys.model]) || bindingProviderId(mode);

        return settings;

    }



    function applyBindingToTextNode(node){

        if(!node) return node;

        const customs = customEntries('text');

        if(customs.length){

            const current = String(node.llmModel || '').trim();

            const aliasOwner = customEntryByName('text', globalAlias('text'))
                || customEntryByName('text', node.llmModelAlias);

            if(aliasOwner){
                node.llmModel = aliasOwner.model;
                node.llmProvider = aliasOwner.provider_id;
                node.llmModelAlias = aliasOwner.name;
                return node;
            }

            if(current){
                const owner = customs.find(entry => entry.model === current && entry.provider_id === node.llmProvider)
                    || customs.find(entry => entry.model === current);
                if(owner){
                    node.llmProvider = owner.provider_id;
                    node.llmModelAlias = owner.name;
                }
                return node;
            }

            const first = customs[0];

            node.llmModel = first.model;

            node.llmProvider = first.provider_id;

            node.llmModelAlias = first.name;

            return node;

        }

        const models = enabledModels('text');

        const current = node.llmModel;

        node.llmModel = models.includes(current) ? current : defaultModel('text');

        node.llmProvider = providerForModel('text', node.llmModel) || node.llmProvider || bindingProviderId('text');

        return node;

    }



    function applyAllBindings(settings, node){

        applyBindingToSettings(settings, 'image');

        applyBindingToSettings(settings, 'video');

        applyBindingToSettings(settings, 'audio');

        if(node) applyBindingToTextNode(node);

        return settings;

    }



    global.SmartCanvasModeBindings = {

        setBindings,

        setProviders,

        getBindings,

        setCustomModels,

        customRows,

        customEntries,

        customEntryByName,

        globalAlias,

        setGlobalAlias,

        customNameForModel,

        getBinding,

        enabledModels,

        modelEntries,

        providerForModel,

        bindingProviderId,

        defaultModel,

        hasVideoMaterial,

        isVideoOutputNode,

        resolveComposerMode,

        currentModel,

        applyBindingToSettings,

        applyBindingToTextNode,

        applyAllBindings,

        MODE_SETTINGS

    };

})(window);

