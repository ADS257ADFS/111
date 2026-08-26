const fs = require('fs');
const content = fs.readFileSync('D:/Infinite-Canvas-main-Windows/static/angle.html', 'utf8');
let open = 0, close = 0;
let inString = false, stringChar = '';
for (let i = 0; i < content.length; i++) {
  const ch = content[i];
  const prev = content[i-1];
  if (!inString) {
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
    } else if (ch === '{') open++;
    else if (ch === '}') close++;
  } else {
    if (ch === stringChar && prev !== '\\') {
      inString = false;
    }
  }
}
console.log('Current: open=' + open + ' close=' + close + ' diff=' + (open-close));

const lines = content.split(/\r?\n/);
let depth = 0;
lines.forEach((line, idx) => {
  const openL = (line.match(/\{/g) || []).length;
  const closeL = (line.match(/\}/g) || []).length;
  depth += openL - closeL;
  if (depth < 0) {
    console.log('Negative depth at line ' + (idx+1) + ': ' + line.trim().substring(0,100));
  }
});
console.log('Final depth: ' + depth);
