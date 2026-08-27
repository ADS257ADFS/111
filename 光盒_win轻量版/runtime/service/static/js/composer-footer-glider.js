(function(){
    'use strict';

    const TARGET_SELECTOR = [
        '#composerApiSettingsBtn',
        '#composerVideoReferenceBtn',
        '#composerKindBtn',
        '#composerSizeBtn'
    ].join(',');
    const MODE_TARGET_SELECTOR = 'button[data-kind]';
    const ASSET_MODE_TARGET_SELECTOR = 'button[data-composer-asset-library]';
    const MODE_HOVER_CLASS = 'is-mode-hover';

    function targetFrom(node, bar){
        const button = node instanceof Element ? node.closest(TARGET_SELECTOR) : null;
        return button && bar.contains(button) ? button : null;
    }

    function moveGlider(bar, button){
        const glider = bar.querySelector('.composer-footer-glider');
        if(!glider || !button) return;
        const barRect = bar.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        if(!barRect.width || !buttonRect.width) return;
        glider.style.setProperty('--composer-glider-x', `${buttonRect.left - barRect.left}px`);
        glider.style.setProperty('--composer-glider-y', `${buttonRect.top - barRect.top}px`);
        glider.style.setProperty('--composer-glider-width', `${buttonRect.width}px`);
        glider.style.setProperty('--composer-glider-height', `${buttonRect.height}px`);
        glider.classList.add('is-visible');
    }

    function hideGlider(bar){
        bar.querySelector('.composer-footer-glider')?.classList.remove('is-visible');
    }

    function currentTarget(bar){
        const buttons = [...bar.querySelectorAll(TARGET_SELECTOR)];
        return buttons.find(button => button.matches(':hover'))
            || buttons.find(button => button.matches(':focus-visible'))
            || bar.querySelector('.composer-tool-wrap.open > button');
    }

    function syncGlider(bar){
        const button = currentTarget(bar);
        if(button) moveGlider(bar, button);
        else hideGlider(bar);
    }

    function bind(bar){
        if(!bar || typeof Node !== 'function' || !(bar instanceof Node) || bar.dataset.composerGliderBound === '1') return;
        const glider = document.createElement('span');
        glider.className = 'composer-footer-glider';
        glider.setAttribute('aria-hidden', 'true');
        bar.prepend(glider);

        bar.addEventListener('pointerover', event => {
            const button = targetFrom(event.target, bar);
            if(button) moveGlider(bar, button);
        });
        bar.addEventListener('pointerout', event => {
            const nextButton = targetFrom(event.relatedTarget, bar);
            if(nextButton){
                moveGlider(bar, nextButton);
                return;
            }
            requestAnimationFrame(() => syncGlider(bar));
        });
        bar.addEventListener('focusin', event => {
            const button = targetFrom(event.target, bar);
            if(button) moveGlider(bar, button);
        });
        bar.addEventListener('focusout', () => requestAnimationFrame(() => syncGlider(bar)));
        bar.addEventListener('click', () => requestAnimationFrame(() => syncGlider(bar)));

        const observer = new MutationObserver(() => requestAnimationFrame(() => syncGlider(bar)));
        observer.observe(bar, {subtree:true, attributes:true, attributeFilter:['class']});
        if(typeof ResizeObserver === 'function') new ResizeObserver(() => syncGlider(bar)).observe(bar);
        window.addEventListener('blur', () => hideGlider(bar));
        bar.dataset.composerGliderBound = '1';
    }

    function modeTargetSelector(group){
        return group?.classList?.contains('composer-asset-shortcuts')
            ? ASSET_MODE_TARGET_SELECTOR
            : MODE_TARGET_SELECTOR;
    }

    function modeTargetFrom(node, group){
        const button = node instanceof Element ? node.closest(modeTargetSelector(group)) : null;
        return button && group.contains(button) ? button : null;
    }

    function moveModeGlider(group, button){
        const glider = group.querySelector('.composer-mode-glider');
        if(!glider || !button) return;
        const groupRect = group.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        if(!groupRect.width || !buttonRect.width) return;
        glider.style.setProperty('--composer-mode-glider-x', `${buttonRect.left - groupRect.left}px`);
        glider.style.setProperty('--composer-mode-glider-y', `${buttonRect.top - groupRect.top + 2}px`);
        glider.style.setProperty('--composer-mode-glider-width', `${buttonRect.width}px`);
        glider.style.setProperty('--composer-mode-glider-height', `${Math.max(0, buttonRect.height - 4)}px`);
        glider.classList.add('is-visible');
    }

    function activeModeButton(group){
        return group.querySelector(`${modeTargetSelector(group)}.active`);
    }

    function clearModeHover(group){
        group.querySelectorAll(`${modeTargetSelector(group)}.${MODE_HOVER_CLASS}`).forEach(button => {
            button.classList.remove(MODE_HOVER_CLASS);
        });
    }

    function setModeHover(group, button){
        clearModeHover(group);
        if(button && !button.classList.contains('active')) button.classList.add(MODE_HOVER_CLASS);
    }

    function syncModeGlider(group){
        // Selected accent capsule stays on the active mode only.
        // Hover uses a white pill on the button itself (like 批量), not the glider.
        const button = activeModeButton(group);
        if(button) moveModeGlider(group, button);
        else group.querySelector('.composer-mode-glider')?.classList.remove('is-visible');
    }

    function bindMode(group){
        if(!group || typeof Node !== 'function' || !(group instanceof Node) || group.dataset.composerModeGliderBound === '1') return;
        const glider = document.createElement('span');
        glider.className = 'composer-mode-glider';
        glider.setAttribute('aria-hidden', 'true');
        group.prepend(glider);

        group.addEventListener('click', event => {
            const button = modeTargetFrom(event.target, group);
            if(button) button.blur();
            clearModeHover(group);
            requestAnimationFrame(() => syncModeGlider(group));
        });
        group.addEventListener('pointerover', event => {
            const button = modeTargetFrom(event.target, group);
            if(button) setModeHover(group, button);
        });
        group.addEventListener('pointerout', event => {
            const nextButton = modeTargetFrom(event.relatedTarget, group);
            if(nextButton){
                setModeHover(group, nextButton);
                return;
            }
            clearModeHover(group);
        });
        group.addEventListener('focusin', event => {
            const button = modeTargetFrom(event.target, group);
            if(button) setModeHover(group, button);
        });
        group.addEventListener('focusout', () => {
            clearModeHover(group);
        });
        group.addEventListener('composer-kind-sync', () => {
            clearModeHover(group);
            requestAnimationFrame(() => syncModeGlider(group));
        });

        const observer = new MutationObserver(() => requestAnimationFrame(() => syncModeGlider(group)));
        observer.observe(group, {subtree:true, attributes:true, attributeFilter:['class']});
        if(typeof ResizeObserver === 'function') new ResizeObserver(() => syncModeGlider(group)).observe(group);
        window.addEventListener('blur', () => {
            clearModeHover(group);
            syncModeGlider(group);
        });
        group.dataset.composerModeGliderBound = '1';
        requestAnimationFrame(() => syncModeGlider(group));
    }

    function init(){
        bind(document.querySelector('.composer-footer-bar'));
        bindMode(document.getElementById('apiKindToggle'));
        bindMode(document.querySelector('.composer-asset-shortcuts'));
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})();
