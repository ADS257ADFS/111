/** Composer two-state height control. */
(function(global){
    'use strict';

    const DEFAULT_HEIGHT = 84;
    const MIN_HEIGHT = 84;

    function maxHeight(){
        return Math.max(MIN_HEIGHT, Math.min(420, Math.round(global.innerHeight * 0.46)));
    }

    function applyHeight(composer, value){
        const height = Math.max(MIN_HEIGHT, Math.round(Number(value) || DEFAULT_HEIGHT));
        composer.style.setProperty('--composer-prompt-h', `${height}px`);
        composer.dataset.promptHeight = String(height);
        return height;
    }

    function applyState(composer, toggle, expanded){
        const isExpanded = expanded === true;
        applyHeight(composer, isExpanded ? maxHeight() : DEFAULT_HEIGHT);
        composer.dataset.heightState = isExpanded ? 'expanded' : 'default';
        // Keep bottom edge fixed; height changes only grow/shrink upward.
        composer.style.top = 'auto';
        composer.style.bottom = 'var(--composer-bottom-gap)';
        composer.style.transformOrigin = 'bottom center';
        toggle.setAttribute('aria-pressed', String(isExpanded));
        toggle.setAttribute('aria-label', isExpanded ? '恢复输入框高度' : '展开输入框');
        toggle.title = isExpanded ? '恢复输入框高度' : '展开输入框';
    }

    function init(){
        const composer = document.getElementById('composer');
        const toggle = document.getElementById('composerHeightToggle');
        if(!composer || !toggle || toggle.dataset.composerHeightBound === '1') return;
        toggle.dataset.composerHeightBound = '1';
        applyState(composer, toggle, false);

        toggle.addEventListener('click', event => {
            event.stopPropagation();
            applyState(composer, toggle, composer.dataset.heightState !== 'expanded');
        });

        global.addEventListener('resize', () => {
            if(composer.dataset.heightState === 'expanded') applyHeight(composer, maxHeight());
        });
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})(window);
