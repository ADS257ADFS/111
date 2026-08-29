/**
 * Smart Canvas - magnetic snap for node connection ports (out port only).
 */
(function(global){
    'use strict';

    const OUT_RADIUS = 25;
    const MAX_OFFSET = 17;
    const EASE = 0.22;
    const RETURN_EASE = 0.26;
    const IDLE_EPS = 0.06;

    const states = new WeakMap();
    let mouseX = -9999;
    let mouseY = -9999;
    let lastMouseX = -9999;
    let lastMouseY = -9999;
    let rafId = 0;
    let dragSourcePort = null;

    function deps(){ return global.SmartCanvasCore?.tryDeps?.() ?? null; }

    function getState(port){
        if(!states.has(port)) states.set(port, {x: 0, y: 0});
        return states.get(port);
    }

    function isOutPort(port){
        return port?.dataset?.port === 'out';
    }

    function portVisible(port, nodeEl){
        if(!port || !nodeEl) return false;
        if(nodeEl.classList.contains('dragging')) return false;
        const shell = deps()?.shell;
        if(shell?.classList.contains('port-dragging')) return nodeEl.classList.contains('port-hover');
        if(nodeEl.classList.contains('selected')) return true;
        if(nodeEl.classList.contains('port-hover')) return true;
        if(nodeEl.classList.contains('port-magnet-out-zone')) return true;
        // Avoid CSS :hover matching every mousemove — class flags only.
        return false;
    }

    function portBaseCenter(port){
        const st = getState(port);
        const rect = port.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2 - st.x,
            y: rect.top + rect.height / 2 - st.y
        };
    }

    function distanceToPort(baseX, baseY){
        return Math.hypot(mouseX - baseX, mouseY - baseY);
    }

    function outPortInMagnetRange(port){
        if(!isOutPort(port)) return false;
        const base = portBaseCenter(port);
        return distanceToPort(base.x, base.y) < OUT_RADIUS;
    }

    function outPortMagnetActive(port, nodeEl){
        if(!isOutPort(port) || !nodeEl) return false;
        if(port === dragSourcePort) return false;
        if(nodeEl.classList.contains('dragging')) return false;
        if(deps()?.shell?.classList.contains('port-dragging')) return false;
        return portVisible(port, nodeEl) || outPortInMagnetRange(port);
    }

    function magnetTarget(baseX, baseY){
        const dx = mouseX - baseX;
        const dy = mouseY - baseY;
        const dist = Math.hypot(dx, dy);
        if(dist >= OUT_RADIUS || dist < 0.5) return {x: 0, y: 0, near: false, inRange: false};
        const t = 1 - dist / OUT_RADIUS;
        const strength = Math.pow(t, 0.55);
        const follow = 0.38 + strength * 0.92;
        let x = dx * follow;
        let y = dy * follow;
        const mag = Math.hypot(x, y);
        if(mag > MAX_OFFSET){
            x *= MAX_OFFSET / mag;
            y *= MAX_OFFSET / mag;
        }
        return {x, y, near: strength > 0.1, inRange: true};
    }

    function applyPortOffset(port, x, y, near){
        port.style.setProperty('--port-magnet-x', `${x.toFixed(2)}px`);
        port.style.setProperty('--port-magnet-y', `${y.toFixed(2)}px`);
        port.classList.toggle('is-magnet-near', near);
    }

    function resetPort(port, st, needFrameRef){
        st.x += (0 - st.x) * RETURN_EASE;
        st.y += (0 - st.y) * RETURN_EASE;
        if(Math.abs(st.x) > IDLE_EPS || Math.abs(st.y) > IDLE_EPS){
            needFrameRef.v = true;
        } else {
            st.x = 0;
            st.y = 0;
        }
        applyPortOffset(port, st.x, st.y, false);
    }

    function tick(){
        rafId = 0;
        const d = deps();
        if(!d?.world) return;

        const needFrame = {v: false};
        const staleZones = d.world.querySelectorAll('.image-node.port-magnet-out-zone');
        for(let i = 0; i < staleZones.length; i++) staleZones[i].classList.remove('port-magnet-out-zone');

        // Out ports only — writing style on every in-port each frame was pure waste.
        const outPorts = d.world.querySelectorAll('.node-port[data-port="out"]');
        if(!outPorts.length) return;

        for(let i = 0; i < outPorts.length; i++){
            const port = outPorts[i];
            const nodeEl = port.closest('.image-node');
            const st = getState(port);

            if(port === dragSourcePort){
                if(st.x || st.y){
                    st.x = 0;
                    st.y = 0;
                    applyPortOffset(port, 0, 0, false);
                }
                continue;
            }

            // Skip layout reads when cursor is far from idle ports.
            if(nodeEl && !portVisible(port, nodeEl) && !st.x && !st.y){
                const nr = nodeEl.getBoundingClientRect();
                const pad = OUT_RADIUS + 48;
                if(
                    mouseX < nr.left - pad || mouseX > nr.right + pad ||
                    mouseY < nr.top - pad || mouseY > nr.bottom + pad
                ) continue;
            }

            const base = portBaseCenter(port);
            const inRange = distanceToPort(base.x, base.y) < OUT_RADIUS;
            if(inRange) nodeEl?.classList.add('port-magnet-out-zone');

            if(!outPortMagnetActive(port, nodeEl)){
                if(st.x || st.y) resetPort(port, st, needFrame);
                continue;
            }

            const target = magnetTarget(base.x, base.y);
            const ease = target.inRange ? EASE : RETURN_EASE;
            st.x += (target.x - st.x) * ease;
            st.y += (target.y - st.y) * ease;

            if(Math.abs(st.x - target.x) > IDLE_EPS || Math.abs(st.y - target.y) > IDLE_EPS) needFrame.v = true;
            if(!target.inRange && Math.abs(st.x) < IDLE_EPS && Math.abs(st.y) < IDLE_EPS){
                st.x = 0;
                st.y = 0;
            }

            applyPortOffset(port, st.x, st.y, target.near || Math.hypot(st.x, st.y) > 1.2);
            if(target.inRange || st.x || st.y) needFrame.v = true;
        }

        if(needFrame.v) scheduleFrame();
    }

    function scheduleFrame(){
        if(rafId) return;
        rafId = requestAnimationFrame(tick);
    }

    function onPointerMove(e){
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        mouseX = e.clientX;
        mouseY = e.clientY;
        if(Math.hypot(dx, dy) < 2 && rafId) return;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        const d = deps();
        if(!d?.world?.querySelector?.('.node-port[data-port="out"]')) return;
        scheduleFrame();
    }

    function onPointerLeave(){
        mouseX = -9999;
        mouseY = -9999;
        scheduleFrame();
    }

    function onPointerDown(e){
        dragSourcePort = e.target?.closest?.('.node-port') || null;
    }

    function onPointerUp(){
        dragSourcePort = null;
        scheduleFrame();
    }

    function bind(){
        const d = deps();
        if(!d?.shell || !d?.world) return false;
        if(d.shell.dataset.portMagnetBound === '1') return true;

        d.shell.addEventListener('mousemove', onPointerMove, {passive: true});
        d.shell.addEventListener('mouseleave', onPointerLeave, {passive: true});
        global.addEventListener('mousemove', onPointerMove, {passive: true});
        d.world.addEventListener('mousedown', onPointerDown, true);
        global.addEventListener('mouseup', onPointerUp, true);
        d.shell.dataset.portMagnetBound = '1';
        return true;
    }

    function boot(){
        if(!bind()) setTimeout(boot, 120);
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    const api = Object.freeze({ bind, scheduleFrame, OUT_RADIUS });
    global.SmartCanvasCore?.register?.('portMagnet', api);
    global.SmartCanvasPortMagnet = api;
})(window);
