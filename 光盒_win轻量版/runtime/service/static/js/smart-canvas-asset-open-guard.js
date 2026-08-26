/**
 * Prevent asset panel dismiss on open gesture; disable shell blank-click in peek mode.
 */
(function(global){
    'use strict';

    const GUARD_MS = 900;
    let shellBound = false;

    function arm(ms = GUARD_MS){
        global.__assetPanelOpenGuardUntil = Date.now() + Math.max(120, Number(ms) || GUARD_MS);
    }

    function active(){
        return Boolean(global.__assetPanelOpenGuardUntil && Date.now() < global.__assetPanelOpenGuardUntil);
    }

    function shouldIgnoreDismissTarget(target){
        if(!target) return false;
        return Boolean(target.closest?.(
            '.asset-panel,.asset-dialog-backdrop,#assetDialogBackdrop,.asset-prompt-detail,' +
            '.selection-box,.selection-box-capsule,.selection-capsule-bar,#selectionCapsuleAssetBtn'
        ));
    }

    function bindShell(){
        if(shellBound) return;
        const shell = document.getElementById('shell');
        if(!shell) return;
        shellBound = true;
        const prevOnClick = shell.onclick;
        if(typeof prevOnClick === 'function'){
            shell.onclick = event => {
                if(global.document.documentElement.classList.contains('is-shell-asset-peek')) {
                    if(shouldIgnoreDismissTarget(event.target)) return;
                    return;
                }
                if(active() && shouldIgnoreDismissTarget(event.target)) return;
                return prevOnClick.call(shell, event);
            };
        }
    }

    function deferParentNotify(open, delay = 48){
        const run = () => {
            try { global.SmartCanvasLeftRail?.notifyShellAssetState?.(open); } catch(e) {}
        };
        if(typeof global.requestAnimationFrame === 'function'){
            global.requestAnimationFrame(() => global.setTimeout(run, delay));
        } else {
            global.setTimeout(run, delay);
        }
    }

    const api = Object.freeze({ arm, active, bindShell, deferParentNotify });
    global.SmartCanvasAssetOpenGuard = api;
    global.addEventListener('DOMContentLoaded', bindShell);
    if(document.readyState !== 'loading') bindShell();
})(window);
