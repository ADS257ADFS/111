/**
 * Interactive dot grid for an empty Smart Canvas.
 */
(function(global){
    'use strict';

    const CELL = 24;
    const DOT_RADIUS = .5;
    const PROXIMITY = 170;
    const SHOCK_RADIUS = 250;
    const SHOCK_STRENGTH = 15;
    const RESISTANCE = 200;
    const SPRING_STRENGTH = 68;
    const SPRING_DAMPING = 3.8;
    const BASE_RGB = {r:62, g:62, b:62};
    const ACTIVE_RGB = {r:10, g:132, b:255};
    const LIGHT_BASE_RGB = {r:224, g:225, b:226};
    const LIGHT_ACTIVE_RGB = {r:10, g:132, b:255};
    const dots = [];
    const pointer = {x:-10000, y:-10000, lastX:0, lastY:0, lastTime:0, vx:0, vy:0};
    let canvas = null;
    let context = null;
    let shell = null;
    let empty = false;
    let active = false;
    let frame = 0;
    let lastFrameTime = 0;
    let resizeObserver = null;
    let bound = false;
    let baseRgb = BASE_RGB;
    let activeRgb = ACTIVE_RGB;
    let cell = CELL;
    let dotRadius = DOT_RADIUS;

    function readNativeGridMetric(name, fallback){
        const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }

    function isDark(){
        const root = document.documentElement;
        return root.classList.contains('theme-dark') || root.classList.contains('studio-theme-dark');
    }

    function buildGrid(){
        if(!canvas || !shell) return;
        cell = readNativeGridMetric('--lightbox-native-grid-size', CELL);
        dotRadius = readNativeGridMetric('--lightbox-native-grid-dot', DOT_RADIUS);
        const width = Math.max(1, shell.clientWidth || global.innerWidth || 1);
        const height = Math.max(1, shell.clientHeight || global.innerHeight || 1);
        const dpr = Math.max(1, global.devicePixelRatio || 1);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context = canvas.getContext('2d');
        context?.setTransform(dpr, 0, 0, dpr, 0, 0);
        dots.length = 0;
        for(let y = cell / 2; y < height; y += cell){
            for(let x = cell / 2; x < width; x += cell){
                dots.push({x, y, ox:0, oy:0, vx:0, vy:0, ix:0, iy:0});
            }
        }
    }

    function applyInertiaResistance(dot, dt){
        const speed = Math.hypot(dot.ix, dot.iy);
        if(speed <= 0) return;
        const nextSpeed = Math.max(0, speed - RESISTANCE * dt);
        const scale = nextSpeed / speed;
        dot.ix *= scale;
        dot.iy *= scale;
    }

    function draw(time){
        frame = 0;
        if(!active || !context || !canvas) return;
        const dpr = Math.max(1, global.devicePixelRatio || 1);
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;
        const dt = Math.min(.034, Math.max(.001, lastFrameTime ? (time - lastFrameTime) / 1000 : .016));
        lastFrameTime = time;
        context.clearRect(0, 0, width, height);
        for(const dot of dots){
            dot.vx += -dot.ox * SPRING_STRENGTH * dt;
            dot.vy += -dot.oy * SPRING_STRENGTH * dt;
            const damping = Math.exp(-SPRING_DAMPING * dt);
            dot.vx *= damping;
            dot.vy *= damping;
            dot.ox += (dot.vx + dot.ix) * dt;
            dot.oy += (dot.vy + dot.iy) * dt;
            applyInertiaResistance(dot, dt);

            const dx = dot.x - pointer.x;
            const dy = dot.y - pointer.y;
            const distance = Math.hypot(dx, dy);
            const proximity = Math.max(0, 1 - distance / PROXIMITY);
            if(proximity > 0){
                context.shadowColor = `rgba(${activeRgb.r},${activeRgb.g},${activeRgb.b},${proximity * .78})`;
                context.shadowBlur = 4 + proximity * 10;
                const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * proximity);
                const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * proximity);
                const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * proximity);
                context.fillStyle = `rgb(${r},${g},${b})`;
            } else {
                context.shadowBlur = 0;
                context.fillStyle = `rgb(${baseRgb.r},${baseRgb.g},${baseRgb.b})`;
            }
            context.beginPath();
            context.arc(dot.x + dot.ox, dot.y + dot.oy, dotRadius, 0, Math.PI * 2);
            context.fill();
        }
        context.shadowBlur = 0;
        frame = global.requestAnimationFrame(draw);
    }

    function start(){
        if(frame || !active) return;
        lastFrameTime = 0;
        frame = global.requestAnimationFrame(draw);
    }

    function stop(){
        if(frame) global.cancelAnimationFrame(frame);
        frame = 0;
        lastFrameTime = 0;
        context?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
    }

    function sync(){
        const dark = isDark();
        baseRgb = dark ? BASE_RGB : LIGHT_BASE_RGB;
        activeRgb = dark ? ACTIVE_RGB : LIGHT_ACTIVE_RGB;
        const next = Boolean(empty);
        document.documentElement.classList.toggle('canvas-empty-dot-grid-active', next);
        if(next === active) return;
        active = next;
        if(active){
            buildGrid();
            start();
        } else {
            stop();
        }
    }

    function move(event){
        if(!active) return;
        const now = performance.now();
        const dt = pointer.lastTime ? Math.max(8, now - pointer.lastTime) : 16;
        const dx = event.clientX - pointer.lastX;
        const dy = event.clientY - pointer.lastY;
        pointer.vx = Math.max(-5000, Math.min(5000, dx / dt * 1000));
        pointer.vy = Math.max(-5000, Math.min(5000, dy / dt * 1000));
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.lastX = event.clientX;
        pointer.lastY = event.clientY;
        pointer.lastTime = now;
        const speed = Math.hypot(pointer.vx, pointer.vy);
        if(speed <= 100) return;
        for(const dot of dots){
            const distance = Math.hypot(dot.x - pointer.x, dot.y - pointer.y);
            if(distance >= PROXIMITY) continue;
            const strength = (1 - distance / PROXIMITY) * .0035;
            dot.ix += pointer.vx * strength;
            dot.iy += pointer.vy * strength;
        }
    }

    function shock(event){
        if(!active || event.target?.closest?.('button,input,textarea,select,[contenteditable="true"]')) return;
        for(const dot of dots){
            const dx = dot.x - event.clientX;
            const dy = dot.y - event.clientY;
            const distance = Math.hypot(dx, dy);
            if(distance <= 0 || distance >= SHOCK_RADIUS) continue;
            const displacement = (1 - distance / SHOCK_RADIUS) * SHOCK_STRENGTH;
            const unitX = dx / distance;
            const unitY = dy / distance;
            dot.ox += unitX * displacement;
            dot.oy += unitY * displacement;
            dot.ix += unitX * displacement * 8;
            dot.iy += unitY * displacement * 8;
        }
    }

    function bind(){
        if(bound || !shell) return;
        bound = true;
        shell.addEventListener('pointermove', move, {passive:true});
        shell.addEventListener('pointerleave', () => {
            pointer.x = -10000;
            pointer.y = -10000;
            pointer.lastTime = 0;
        }, {passive:true});
        shell.addEventListener('click', shock, {passive:true});
        if(global.ResizeObserver){
            resizeObserver = new ResizeObserver(buildGrid);
            resizeObserver.observe(shell);
        } else {
            global.addEventListener('resize', buildGrid, {passive:true});
        }
        const root = document.documentElement;
        if(root && typeof Node === 'function' && root instanceof Node){
            new MutationObserver(sync).observe(root, {attributes:true, attributeFilter:['class']});
        }
    }

    function setEmpty(next){
        empty = false;
        document.documentElement.classList.remove('canvas-empty-dot-grid-active');
        active = false;
        stop();
    }

    global.SmartCanvasEmptyDotGrid = Object.freeze({setEmpty});
})(window);
