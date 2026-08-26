const fs = require('fs');
const path = require('path');

const packageRoot = path.resolve(__dirname, '..');
const staticRoot = path.join(packageRoot, 'runtime', 'service', 'static');
const outputRoot = path.join(staticRoot, 'css', 'dark-desaturated');

const htmlFiles = [
    'index.html',
    'smart-canvas.html',
    'api-settings.html',
    'canvas.html',
    'director3d/index.html',
    'apps/gpt-dock/gpt-chat.html',
    'apps/runninghub-settings/index.html',
    'apps/studio-coding/agent-chat.html',
].map(file => path.join(staticRoot, file));

function splitTopLevel(value, delimiter) {
    const parts = [];
    let start = 0;
    let quote = '';
    let round = 0;
    let square = 0;
    for (let index = 0; index < value.length; index += 1) {
        const char = value[index];
        if (quote) {
            if (char === '\\') index += 1;
            else if (char === quote) quote = '';
            continue;
        }
        if (char === '"' || char === "'") quote = char;
        else if (char === '(') round += 1;
        else if (char === ')') round = Math.max(0, round - 1);
        else if (char === '[') square += 1;
        else if (char === ']') square = Math.max(0, square - 1);
        else if (char === delimiter && round === 0 && square === 0) {
            parts.push(value.slice(start, index));
            start = index + 1;
        }
    }
    parts.push(value.slice(start));
    return parts;
}

function findMatchingBrace(css, openIndex) {
    let depth = 1;
    let quote = '';
    let comment = false;
    for (let index = openIndex + 1; index < css.length; index += 1) {
        const char = css[index];
        const next = css[index + 1];
        if (comment) {
            if (char === '*' && next === '/') {
                comment = false;
                index += 1;
            }
            continue;
        }
        if (quote) {
            if (char === '\\') index += 1;
            else if (char === quote) quote = '';
            continue;
        }
        if (char === '/' && next === '*') {
            comment = true;
            index += 1;
        } else if (char === '"' || char === "'") quote = char;
        else if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) return index;
        }
    }
    return css.length - 1;
}

function scanPreludeEnd(css, start) {
    let quote = '';
    let comment = false;
    let round = 0;
    let square = 0;
    for (let index = start; index < css.length; index += 1) {
        const char = css[index];
        const next = css[index + 1];
        if (comment) {
            if (char === '*' && next === '/') {
                comment = false;
                index += 1;
            }
            continue;
        }
        if (quote) {
            if (char === '\\') index += 1;
            else if (char === quote) quote = '';
            continue;
        }
        if (char === '/' && next === '*') {
            comment = true;
            index += 1;
        } else if (char === '"' || char === "'") quote = char;
        else if (char === '(') round += 1;
        else if (char === ')') round = Math.max(0, round - 1);
        else if (char === '[') square += 1;
        else if (char === ']') square = Math.max(0, square - 1);
        else if (round === 0 && square === 0 && (char === '{' || char === ';')) return index;
    }
    return css.length;
}

function hueAndSaturation(red, green, blue) {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    if (delta === 0) return { hue: 0, saturation: 0, lightness };
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    let hue;
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
    if (hue < 0) hue += 360;
    return { hue, saturation, lightness };
}

function alphaText(alpha) {
    return String(Math.round(alpha * 1000) / 1000).replace(/^0\./, '.');
}

function grayscaleColor(red, green, blue, alpha, original, stats) {
    const color = hueAndSaturation(red, green, blue);
    if (alpha === 0 || color.saturation < 0.0001) return original;
    if (color.hue >= 190 && color.hue <= 250 && color.saturation >= 0.65) {
        stats.bluePreserved += 1;
        return original;
    }
    const gray = Math.round(color.lightness * 255);
    stats.colorsDesaturated += 1;
    if (alpha < 1) return `rgba(${gray}, ${gray}, ${gray}, ${alphaText(alpha)})`;
    return `#${gray.toString(16).padStart(2, '0').repeat(3)}`;
}

function parseHexColor(match, stats) {
    const raw = match.slice(1);
    if (![3, 4, 6, 8].includes(raw.length)) return match;
    const expanded = raw.length <= 4 ? [...raw].map(char => char + char).join('') : raw;
    const red = parseInt(expanded.slice(0, 2), 16);
    const green = parseInt(expanded.slice(2, 4), 16);
    const blue = parseInt(expanded.slice(4, 6), 16);
    const alpha = expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1;
    return grayscaleColor(red, green, blue, alpha, match, stats);
}

function parseChannel(value) {
    const text = value.trim();
    if (text.endsWith('%')) return Math.max(0, Math.min(255, parseFloat(text) * 2.55));
    return Math.max(0, Math.min(255, parseFloat(text)));
}

function parseAlpha(value) {
    const text = String(value ?? '1').trim();
    if (text.endsWith('%')) return Math.max(0, Math.min(1, parseFloat(text) / 100));
    return Math.max(0, Math.min(1, parseFloat(text)));
}

function parseRgbColor(match, body, stats) {
    if (/var\(|calc\(|env\(/i.test(body)) return match;
    const normalized = body.replace(/,/g, ' ');
    const [channelsText, slashAlpha] = normalized.split('/');
    const channels = channelsText.trim().split(/\s+/).filter(Boolean);
    const alphaValue = slashAlpha ?? (channels.length === 4 ? channels.pop() : undefined);
    if (channels.length !== 3) return match;
    const values = channels.map(parseChannel);
    if (values.some(value => !Number.isFinite(value))) return match;
    const alpha = parseAlpha(alphaValue);
    if (!Number.isFinite(alpha)) return match;
    return grayscaleColor(values[0], values[1], values[2], alpha, match, stats);
}

function replaceColors(value, stats) {
    let next = value.replace(/\brgba?\(\s*([^()]*)\)/gi, (match, body) => parseRgbColor(match, body, stats));
    next = next.replace(/#[0-9a-f]{3,8}\b/gi, match => parseHexColor(match, stats));
    return next;
}

function replaceRgbTriplet(value, stats) {
    const match = value.match(/^\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(\s*!important)?\s*$/i);
    if (!match) return value;
    const channels = match.slice(1, 4).map(parseChannel);
    if (channels.some(channel => !Number.isFinite(channel))) return value;
    const color = hueAndSaturation(...channels);
    if (color.saturation < 0.0001) return value;
    if (color.hue >= 190 && color.hue <= 250 && color.saturation >= 0.65) {
        stats.bluePreserved += 1;
        return value;
    }
    const gray = Math.round(color.lightness * 255);
    stats.colorsDesaturated += 1;
    return `${gray}, ${gray}, ${gray}${match[4] || ''}`;
}

function transformDeclarations(body, stats) {
    const output = [];
    for (const rawDeclaration of splitTopLevel(body, ';')) {
        const declaration = rawDeclaration.trim();
        if (!declaration) continue;
        const colon = splitTopLevel(declaration, ':');
        if (colon.length < 2) continue;
        const property = colon.shift().trim();
        const value = colon.join(':').trim();
        const converted = /-rgb$/i.test(property)
            ? replaceRgbTriplet(value, stats)
            : replaceColors(value, stats);
        const containsColor = /\brgba?\s*\(|#[0-9a-f]{3,8}\b/i.test(value)
            || (/-rgb$/i.test(property) && /^\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+/i.test(value));
        if (converted !== value || containsColor) output.push(`${property}:${converted}`);
    }
    return output.join(';');
}

function darkSelector(selector) {
    const trimmed = selector.trim();
    if (!trimmed) return '';
    if (/:not\([^)]*(?:theme-dark|studio-theme-dark)/.test(trimmed)) return '';
    if (/(?:theme-dark|studio-theme-dark|data-theme\s*=\s*["']dark["'])/.test(trimmed)) return trimmed;
    if (trimmed.startsWith(':root')) return trimmed.replace(':root', ':root:where(.theme-dark,.studio-theme-dark)');
    if (trimmed.startsWith('html')) return trimmed.replace(/^html\b/, ':where(html.theme-dark,html.studio-theme-dark)');
    return `:where(html.theme-dark,html.studio-theme-dark) ${trimmed}`;
}

function transformSelectors(prelude) {
    return splitTopLevel(prelude, ',').map(darkSelector).filter(Boolean).join(',');
}

function transformCss(css, stats) {
    let output = '';
    let index = 0;
    while (index < css.length) {
        const end = scanPreludeEnd(css, index);
        if (end >= css.length) break;
        const delimiter = css[end];
        if (delimiter === ';') {
            index = end + 1;
            continue;
        }
        const prelude = css.slice(index, end).replace(/\/\*[\s\S]*?\*\//g, '').trim();
        const close = findMatchingBrace(css, end);
        const body = css.slice(end + 1, close);
        index = close + 1;
        if (!prelude) continue;
        if (prelude.startsWith('@')) {
            const name = prelude.slice(1).split(/[\s({]/, 1)[0].toLowerCase();
            if (['media', 'supports', 'container', 'layer', 'scope', 'starting-style'].includes(name)) {
                const inner = transformCss(body, stats);
                if (inner) output += `${prelude}{${inner}}`;
            }
            continue;
        }
        const declarations = transformDeclarations(body, stats);
        const selectors = declarations ? transformSelectors(prelude) : '';
        if (selectors) {
            output += `${selectors}{${declarations}}\n`;
            stats.rulesWritten += 1;
        }
    }
    return output;
}

function linkedCssFiles(htmlFile) {
    const html = fs.readFileSync(htmlFile, 'utf8');
    const files = [];
    for (const match of html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
        const href = match[1].split(/[?#]/, 1)[0];
        if (!href.endsWith('.css') || href.includes('/dark-desaturated/')) continue;
        const target = href.startsWith('/static/')
            ? path.join(staticRoot, href.slice('/static/'.length))
            : path.resolve(path.dirname(htmlFile), href);
        if (fs.existsSync(target) && !files.includes(target)) files.push(target);
    }
    return files;
}

fs.mkdirSync(outputRoot, { recursive: true });
const summary = [];
for (const htmlFile of htmlFiles) {
    const relativeHtml = path.relative(staticRoot, htmlFile).replace(/\\/g, '/');
    const slug = relativeHtml.replace(/\.html$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    const stats = { rulesWritten: 0, colorsDesaturated: 0, bluePreserved: 0 };
    let generated = '/* Generated by tools/generate-dark-desaturation.js. UI colors only; media pixels are untouched. */\n';
    for (const cssFile of linkedCssFiles(htmlFile)) {
        generated += transformCss(fs.readFileSync(cssFile, 'utf8'), stats);
    }
    generated += 'html:is(.theme-dark,.studio-theme-dark) #studioGenerationCancel{border-color:rgba(151,151,151,.25)!important;color:#7c7c7c!important;box-shadow:0 10px 28px rgba(29,29,29,.14)!important}\n';
    generated += 'html:is(.theme-dark,.studio-theme-dark) #imageHdCancel{border-color:rgba(169,169,169,.22)!important}\n';
    generated += 'html:is(.theme-dark,.studio-theme-dark) #imageEditZoomLabel{color:#a6a6a6!important}\n';
    const outputFile = path.join(outputRoot, `${slug}.css`);
    fs.writeFileSync(outputFile, generated, 'utf8');
    summary.push({ html: relativeHtml, css: path.relative(staticRoot, outputFile).replace(/\\/g, '/'), bytes: Buffer.byteLength(generated), ...stats });
}

console.log(JSON.stringify(summary, null, 2));
