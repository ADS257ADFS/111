/**
 * Minimal shell toolbar icons — matched to Lucide weight, centered in 24x24.
 */
(function(global){
    'use strict';

    const SVG_ATTR = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

    const agent = `<svg class="studio-shell-icon studio-shell-icon-agent" ${SVG_ATTR}><path d="M2.5 5.75a3.75 3.75 0 0 1 3.75-3.75H11.25"/><path d="M2.5 5.75V21.5H21.5V12.5"/><path class="studio-shell-icon-agent-pen" d="M9.25 16.25 21.5 4.75"/></svg>`;
    const CANVAS_CORNERS = 'M2.5 2.5H7M2.5 2.5V7M21.5 2.5H17M21.5 2.5V7M2.5 21.5H7M2.5 21.5V17M21.5 21.5H17M21.5 21.5V17';
    const CANVAS_DOTS = [8.5, 12, 15.5].flatMap(y => [8.5, 12, 15.5].map(x => `<circle cx="${x}" cy="${y}" r="1.2" fill="currentColor" stroke="none"/>`)).join('');
    const canvas = `<svg class="studio-shell-icon studio-shell-icon-canvas" ${SVG_ATTR}><path d="${CANVAS_CORNERS}"/>${CANVAS_DOTS}</svg>`;
    const asset = `<svg class="studio-shell-icon studio-shell-icon-asset" ${SVG_ATTR}><path d="M20 17a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.9a2 2 0 0 1-1.69-.9l-.81-1.2a2 2 0 0 0-1.67-.9H8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z"/><path d="M2 8v11a2 2 0 0 0 2 2h14"/></svg>`;

    global.StudioShellIcons = Object.freeze({ agent, canvas, asset });
})(window);
