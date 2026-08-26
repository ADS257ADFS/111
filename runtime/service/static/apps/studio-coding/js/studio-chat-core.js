/**
 * Studio Chat — module registry & dependency injection.
 *
 * Isolated from Smart Canvas / index shell. All agent-chat logic lives under static/js/studio-chat/.
 *
 * Module boundaries:
 *   state      — conversation + provider runtime state (agent-chat only)
 *   providers  — API platform load, model pickers
 *   threads    — conversation list, history popover
 *   messages   — bubble render, lightbox
 *   composer   — input, attachments, drag/drop
 *   api        — /api/chat, stream, agent
 *   agentApp   — bootstrap + window exports for HTML onclick
 *
 * Constraints: docs/studio-chat-constraints.md
 */
(function(global){
    'use strict';

    const modules = Object.create(null);
    let deps = null;

    const BOUNDARIES = Object.freeze({
        state: 'Runtime state bag for agent chat. Do not touch canvas/composer/index shell.',
        providers: 'Load/filter API platforms and model selectors. Do not touch message render or threads.',
        threads: 'Conversation CRUD and history popover. Do not touch send/stream API.',
        messages: 'Message bubbles and image preview. Do not touch provider config.',
        composer: 'Composer input, refs, file upload. Do not touch thread list.',
        api: 'Chat HTTP/stream/agent calls. Do not touch DOM except via deps callbacks.',
        agentApp: 'Bootstrap and window facade for agent-chat.html. Do not add canvas logic here.'
    });

    function register(name, api){
        if(!name || !api || typeof api !== 'object') throw new Error('[StudioChatCore] invalid module registration');
        modules[name] = Object.freeze({...api, __module: name});
        return modules[name];
    }

    function get(name){
        return modules[name] || null;
    }

    function require(name){
        const mod = get(name);
        if(!mod) throw new Error(`[StudioChatCore] module not registered: ${name}`);
        return mod;
    }

    function registerDeps(next){
        deps = next;
    }

    function getDeps(){
        if(!deps) throw new Error('[StudioChatCore] deps not registered');
        return deps;
    }

    function tryDeps(){
        return deps;
    }

    global.StudioChatCore = Object.freeze({
        BOUNDARIES,
        register,
        get,
        require,
        registerDeps,
        get deps(){ return getDeps(); },
        tryDeps
    });
})(window);
