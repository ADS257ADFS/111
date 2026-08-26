/**
 * Smart Canvas — run button cooldown and node running-state tokens.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasRunState] deps not registered');
        return c;
    }
    function nodes(){ return S().getNodes(); }

function coolRunButton(ms=2000){
    if(!S().runBtn) return 0;
    const token = (S().runBtnCooldownToken = S().runBtnCooldownToken + 1);
    S().runBtn.disabled = true;
    setTimeout(() => {
        if(token === S().runBtnCooldownToken && !S().smartCascadeAnyRunning()) S().runBtn.disabled = false;
    }, ms);
    return token;
}


function coolNodeRunningState(node, ms=2000){
    if(!node) return 0;
    const token = (S().smartRunStateToken = S().smartRunStateToken + 1);
    S().smartNodeRunTokens.set(node.id, token);
    node.running = true;
    setTimeout(() => {
        if(S().smartNodeRunTokens.get(node.id) !== token) return;
        S().smartNodeRunTokens.delete(node.id);
        const current = nodes().find(n => n.id === node.id);
        if(current){
            current.running = false;
            S().render();
        }
    }, ms);
    return token;
}


function clearNodeRunningState(node){
    if(!node) return;
    S().smartNodeRunTokens.delete(node.id);
    node.running = false;
}


function hideCompletedRunTimers(){ 
 let changed = false; 
 nodes().forEach(node => { 
 if(!node || node.type === 'smart-prompt') return; 
 if(node.pending || node.running || node.jimengPending || !node.runFinishedAt || node.runTimerHidden) return; 
 node.runTimerHidden = true; 
 changed = true; 
 }); 
 return changed; 
}

function imageTaskRecoverBodyHtml(node, task, layout){ 
 const querying = Boolean(task.querying); 
 const failedCount = S().smartPendingTasks(node).filter(item => item.failed && item.recoverTaskId).length; 
 const title = querying ? '查询中' : '任务未丢失'; 
 const sub = failedCount > 1 ? `还有 ${failedCount} 个任务可查询` : `任务 ID：${task.recoverTaskId || ''}`; 
 return ` 
 
 
 ${S().escapeHtml(title)} 
 ${S().escapeHtml(sub)} 
 ${querying ? '查询中…' : '查询结果'} 
 
 `; 
}

    const api = Object.freeze({
        registerDeps,
        coolRunButton,
        coolNodeRunningState,
        clearNodeRunningState,
        hideCompletedRunTimers,
        imageTaskRecoverBodyHtml,
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('runState', api);
    global.SmartCanvasRunState = api;
})(window);
