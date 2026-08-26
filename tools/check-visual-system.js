#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const staticRoot = path.join(projectRoot, 'runtime', 'service', 'static');
const baselinePath = path.join(__dirname, 'visual-system-baseline.json');
const reportOnly = process.argv.includes('--report');

function walk(directory, extensions) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'vendor' || entry.name === 'dark-desaturated') continue;
            files.push(...walk(fullPath, extensions));
            continue;
        }
        if (extensions.has(path.extname(entry.name))) files.push(fullPath);
    }
    return files;
}

function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function count(source, pattern) {
    return Array.from(source.matchAll(pattern)).length;
}

const cssFiles = walk(path.join(staticRoot, 'css'), new Set(['.css']))
    .filter(file => path.basename(file) !== 'design-tokens.css');
const cssSource = cssFiles.map(file => stripComments(fs.readFileSync(file, 'utf8'))).join('\n');
const colorValues = Array.from(
    cssSource.matchAll(/(?:^|[;{])\s*(?:--[-\w]+|color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline|fill|stroke|box-shadow|text-shadow)\s*:\s*([^;{}]+)/gmi),
    match => match[1]
).join('\n');
const consumerFiles = walk(staticRoot, new Set(['.html', '.js']));
const consumerSource = consumerFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');

const metrics = {
    hardcodedColors: count(colorValues, /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\(\s*(?:\d|\.\d)/gi),
    fontSizeLiterals: count(cssSource, /font-size\s*:\s*\d*\.?\d+(?:px|rem|em)\b/gi),
    fontWeightLiterals: count(cssSource, /font-weight\s*:\s*\d+\b/gi),
    borderRadiusLiterals: count(cssSource, /border-radius\s*:\s*\d*\.?\d+(?:px|rem|em|%)\b/gi),
    shadowLiterals: count(cssSource, /(?:box|text)-shadow\s*:\s*(?!none\b|var\()[^;}]+/gi),
    zIndexLiterals: count(cssSource, /z-index\s*:\s*-?\d+\b/gi),
    motionLiterals: count(cssSource, /(?:transition(?:-duration)?|animation(?:-duration)?)\s*:[^;}]*\b\d*\.?\d+m?s\b/gi),
    backdropFilters: count(cssSource, /(?:-webkit-)?backdrop-filter\s*:\s*(?!none\b)[^;}]+/gi),
    importantRules: count(cssSource, /!important\b/gi)
};

const consumers = {
    input: count(consumerSource, /\bui-input\b/g),
    menu: count(consumerSource, /\bui-menu(?!-)\b/g),
    menuItem: count(consumerSource, /\bui-menu-item\b/g)
};

const failures = [];
if (/font-weight\s*:\s*520\b/i.test(cssSource)) failures.push('仍存在非标准 font-weight: 520');
if (consumers.input < 3) failures.push(`.ui-input 真实消费者少于 3（当前 ${consumers.input}）`);
if (consumers.menu < 2) failures.push(`.ui-menu 真实消费者少于 2（当前 ${consumers.menu}）`);
// M71 removes the canvas-history entry from the blank-canvas context menu.
if (consumers.menuItem < 12) failures.push(`.ui-menu-item 真实消费者少于 12（当前 ${consumers.menuItem}）`);

const htmlFiles = walk(staticRoot, new Set(['.html']));
const sharedVersionsByEntry = new Map();
for (const asset of ['design-tokens.css', 'ui-primitives.css', 'minimax-visual.css']) {
    const references = [];
    for (const file of htmlFiles) {
        const source = fs.readFileSync(file, 'utf8');
        const pattern = new RegExp(`${asset.replace('.', '\\.')}\\?v=([^"']+)`, 'g');
        for (const match of source.matchAll(pattern)) references.push({ file, version: match[1] });
    }
    if (references.length !== 8) failures.push(`${asset} 应有 8 个入口引用，当前 ${references.length}`);
    for (const reference of references) {
        const entry = path.relative(projectRoot, reference.file);
        if (!/^[0-9A-Za-z._-]+$/.test(reference.version)) failures.push(`${entry} 的 ${asset} 缓存版本无效`);
        if (!sharedVersionsByEntry.has(entry)) sharedVersionsByEntry.set(entry, []);
        sharedVersionsByEntry.get(entry).push(reference.version);
    }
}
for (const [entry, versions] of sharedVersionsByEntry) {
    if (versions.length !== 3 || new Set(versions).size !== 1) {
        failures.push(`${entry} 的三张共享样式缓存版本不一致`);
    }
}

if (!reportOnly) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    for (const [name, value] of Object.entries(metrics)) {
        if (!(name in baseline)) failures.push(`baseline 缺少 ${name}`);
        else if (value > baseline[name]) failures.push(`${name} 增加：${baseline[name]} → ${value}`);
    }
}

console.log(JSON.stringify({ metrics, consumers }, null, 2));
if (failures.length) {
    console.error('\n视觉系统检查失败：');
    failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
} else {
    console.log(reportOnly ? '\n视觉系统统计完成。' : '\n视觉系统检查通过。');
}
