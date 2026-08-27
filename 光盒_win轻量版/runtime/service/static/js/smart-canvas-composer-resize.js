/** Composer two-state height control — grow/shrink upward only; bottom edge stays put. */
(function(global){
    'use strict';

    const DEFAULT_HEIGHT = 84;
    const MIN_HEIGHT = 84;
    /** Non-prompt chrome inside the sheet (topbar + footer + paddings/gaps). */
    const SHEET_CHROME = 140;

    function maxHeight(){
        return Math.max(MIN_HEIGHT, Math.min(420, Math.round(global.innerHeight * 0.46)));
    }

    function pinBottomAnchor(composer){
        // Bottom-anchored sheet: never set top/height in a way that recenters growth.
        composer.style.setProperty('top', 'auto', 'important');
        composer.style.setProperty('bottom', 'var(--composer-bottom-gap)', 'important');
        composer.style.setProperty('margin-bottom', '0', 'important');
        composer.style.setProperty('height', 'auto', 'important');
        composer.style.setProperty('transform', 'translateX(-50%)', 'important');
        composer.style.setProperty('transform-origin', 'bottom center', 'important');
    }

    function applyHeight(composer, value){
        const height = Math.max(MIN_HEIGHT, Math.round(Number(value) || DEFAULT_HEIGHT));
        composer.style.setProperty('--composer-prompt-h', `${height}px`);
        // Keep outer sheet min-height in lockstep so the chrome grows upward with the field.
        composer.style.setProperty('--composer-sheet-min-h', `${SHEET_CHROME + height}px`);
        composer.dataset.promptHeight = String(height);
        return height;
    }

    function lockBottomEdge(composer, previousBottom){
        pinBottomAnchor(composer);
        const afterBottom = composer.getBoundingClientRect().bottom;
        const drift = afterBottom - previousBottom;
        if(Math.abs(drift) <= 0.5) return;
        // Competing rules moved the box; compensate in px so the visible bottom stays fixed.
        const computedBottom = Number.parseFloat(global.getComputedStyle(composer).bottom);
        const base = Number.isFinite(computedBottom) ? computedBottom : 0;
        composer.style.setProperty('bottom', `${base - drift}px`, 'important');
    }

    function applyState(composer, toggle, expanded){
        const isExpanded = expanded === true;
        const previousBottom = composer.getBoundingClientRect().bottom;
        pinBottomAnchor(composer);
        applyHeight(composer, isExpanded ? maxHeight() : DEFAULT_HEIGHT);
        composer.dataset.heightState = isExpanded ? 'expanded' : 'default';
        toggle.setAttribute('aria-pressed', String(isExpanded));
        toggle.setAttribute('aria-label', isExpanded ? '恢复输入框高度' : '展开输入框');
        toggle.title = isExpanded ? '恢复输入框高度' : '展开输入框';
        // Layout may settle one frame later; re-pin so expand never shifts the bottom edge.
        lockBottomEdge(composer, previousBottom);
        global.requestAnimationFrame(() => lockBottomEdge(composer, previousBottom));
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
            if(composer.dataset.heightState !== 'expanded') return;
            const previousBottom = composer.getBoundingClientRect().bottom;
            pinBottomAnchor(composer);
            applyHeight(composer, maxHeight());
            lockBottomEdge(composer, previousBottom);
            global.requestAnimationFrame(() => lockBottomEdge(composer, previousBottom));
        });
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})(window);
