/** Composer two-state height control — grow/shrink upward only; bottom edge stays put. */
(function(global){
    'use strict';

    /* Collapsed prompt field: 63 + 8 (CSS --composer-prompt-h). Inline
       --composer-prompt-h must match or it overrides the stylesheet. */
    const DEFAULT_HEIGHT = 71;
    const MIN_HEIGHT = 71;
    /** Extra chrome only when expanded so the sheet can grow with the field. */
    const SHEET_CHROME_EXPANDED = 150;
    const PIN_PROPS = ['top', 'bottom', 'margin-bottom', 'height', 'transform', 'transform-origin'];

    function maxHeight(){
        return Math.max(MIN_HEIGHT, Math.min(420, Math.round(global.innerHeight * 0.46)));
    }

    function isComposerOpen(composer){
        return composer.classList.contains('open');
    }

    function clearPinStyles(composer){
        PIN_PROPS.forEach(prop => composer.style.removeProperty(prop));
    }

    function pinBottomAnchor(composer){
        if(!isComposerOpen(composer)) return;
        composer.style.setProperty('top', 'auto', 'important');
        composer.style.setProperty('bottom', 'var(--composer-bottom-gap)', 'important');
        composer.style.setProperty('margin-bottom', '0', 'important');
        composer.style.setProperty('height', 'auto', 'important');
        composer.style.setProperty('transform', 'translateX(-50%)', 'important');
        composer.style.setProperty('transform-origin', 'bottom center', 'important');
    }

    function applyHeight(composer, value, expanded = false){
        const height = Math.max(MIN_HEIGHT, Math.round(Number(value) || DEFAULT_HEIGHT));
        const chrome = expanded ? SHEET_CHROME_EXPANDED : 0;
        /* important: beat any stale stylesheet/inline without !important */
        composer.style.setProperty('--composer-prompt-h', `${height}px`, 'important');
        composer.style.setProperty('--composer-sheet-min-h', `${chrome + height}px`, 'important');
        composer.dataset.promptHeight = String(height);
        return height;
    }

    function lockBottomEdge(composer, previousBottom){
        if(!isComposerOpen(composer)) return;
        pinBottomAnchor(composer);
        const afterBottom = composer.getBoundingClientRect().bottom;
        const drift = afterBottom - previousBottom;
        if(Math.abs(drift) <= 0.5) return;
        const computedBottom = Number.parseFloat(global.getComputedStyle(composer).bottom);
        const base = Number.isFinite(computedBottom) ? computedBottom : 0;
        composer.style.setProperty('bottom', `${base - drift}px`, 'important');
    }

    function applyState(composer, toggle, expanded){
        if(!isComposerOpen(composer)){
            clearPinStyles(composer);
            applyHeight(composer, DEFAULT_HEIGHT, false);
            composer.dataset.heightState = 'default';
            toggle.setAttribute('aria-pressed', 'false');
            return;
        }
        const isExpanded = expanded === true;
        const previousBottom = composer.getBoundingClientRect().bottom;
        pinBottomAnchor(composer);
        applyHeight(composer, isExpanded ? maxHeight() : DEFAULT_HEIGHT, isExpanded);
        composer.dataset.heightState = isExpanded ? 'expanded' : 'default';
        toggle.setAttribute('aria-pressed', String(isExpanded));
        toggle.setAttribute('aria-label', isExpanded ? '恢复输入框高度' : '展开输入框');
        toggle.title = isExpanded ? '恢复输入框高度' : '展开输入框';
        lockBottomEdge(composer, previousBottom);
        global.requestAnimationFrame(() => lockBottomEdge(composer, previousBottom));
    }

    function syncOpenState(composer, toggle){
        if(isComposerOpen(composer)) applyState(composer, toggle, composer.dataset.heightState === 'expanded');
        else applyState(composer, toggle, false);
    }

    function init(){
        const composer = document.getElementById('composer');
        const toggle = document.getElementById('composerHeightToggle');
        if(!composer || !toggle || toggle.dataset.composerHeightBound === '1') return;
        toggle.dataset.composerHeightBound = '1';
        applyHeight(composer, DEFAULT_HEIGHT, false);
        syncOpenState(composer, toggle);

        new MutationObserver(() => syncOpenState(composer, toggle)).observe(composer, {
            attributes: true,
            attributeFilter: ['class'],
        });

        toggle.addEventListener('click', event => {
            event.stopPropagation();
            if(!isComposerOpen(composer)) return;
            applyState(composer, toggle, composer.dataset.heightState !== 'expanded');
        });

        global.addEventListener('resize', () => {
            if(!isComposerOpen(composer) || composer.dataset.heightState !== 'expanded') return;
            const previousBottom = composer.getBoundingClientRect().bottom;
            pinBottomAnchor(composer);
            applyHeight(composer, maxHeight(), true);
            lockBottomEdge(composer, previousBottom);
            global.requestAnimationFrame(() => lockBottomEdge(composer, previousBottom));
        });
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})(window);
