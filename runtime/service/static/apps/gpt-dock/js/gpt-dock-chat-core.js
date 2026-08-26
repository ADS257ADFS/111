/**
 * GPT Dock Chat - module registry (right dock, separate from studio-chat/agent)
 */
(function(global){
    'use strict';
    const modules = Object.create(null);
    let deps = null;
    const BOUNDARIES = Object.freeze({
        state: 'Dock chat runtime state only.',
        dockApp: 'Right dock GPT chat. Do not import studio-chat-agent-app.'
    });
    function register(name, api){
        if(!name || !api || typeof api !== 'object') throw new Error('[GptDockChatCore] invalid registration');
        modules[name] = Object.freeze({...api, __module: name});
        return modules[name];
    }
    function get(name){ return modules[name] || null; }
    function require(name){
        const mod = get(name);
        if(!mod) throw new Error('[GptDockChatCore] module not registered: ' + name);
        return mod;
    }
    function registerDeps(next){ deps = next; }
    function getDeps(){
        if(!deps) throw new Error('[GptDockChatCore] deps not registered');
        return deps;
    }
    function tryDeps(){ return deps; }
    global.GptDockChatCore = Object.freeze({
        BOUNDARIES, register, get, require, registerDeps,
        get deps(){ return getDeps(); },
        tryDeps
    });
})(window);
