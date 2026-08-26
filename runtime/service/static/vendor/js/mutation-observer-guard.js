/** Ignore transient MutationObserver targets that are not live DOM nodes. */
(function(global){
    'use strict';

    const prototype = global.MutationObserver?.prototype;
    if(!prototype || prototype.safeObserveInstalled) return;
    const nativeObserve = prototype.observe;

    prototype.observe = function(target, options){
        if(!target || typeof target.nodeType !== 'number') return;
        try {
            return nativeObserve.call(this, target, options);
        } catch(error) {
            if(error instanceof TypeError) return;
            throw error;
        }
    };

    Object.defineProperty(prototype, 'safeObserveInstalled', {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
    });
})(window);
