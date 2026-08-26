"""One-off CDP probe: why is .shell-primary-rail invisible?"""
import asyncio
import json
import sys
import urllib.request

import websockets

EXPR = r"""
(() => {
  const out = {};
  const rail = document.querySelector('.shell-primary-rail');
  if (!rail) return JSON.stringify({rail: 'MISSING'});
  const r = rail.getBoundingClientRect();
  out.rect = { x: r.x, y: r.y, w: r.width, h: r.height };
  out.chain = [];
  let el = rail;
  while (el && el !== document) {
    const cs = getComputedStyle(el);
    out.chain.push({
      tag: el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ').slice(0,3).join('.'),
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
      transform: cs.transform === 'none' ? undefined : cs.transform,
      clipPath: cs.clipPath === 'none' ? undefined : cs.clipPath,
      filter: cs.filter === 'none' ? undefined : cs.filter,
      contentVisibility: cs.contentVisibility !== 'visible' ? cs.contentVisibility : undefined,
      zIndex: cs.zIndex, position: cs.position,
    });
    el = el.parentElement;
  }
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  out.elementFromPoint = (() => {
    const t = document.elementFromPoint(cx, cy);
    return t ? t.tagName + (t.id ? '#' + t.id : '') + '.' + String(t.className).split(' ').slice(0,4).join('.') : 'null';
  })();
  const items = rail.querySelectorAll('.shell-primary-rail-item');
  out.itemCount = items.length;
  if (items.length) {
    const ics = getComputedStyle(items[0]);
    const ir = items[0].getBoundingClientRect();
    out.firstItem = { display: ics.display, opacity: ics.opacity, color: ics.color,
      bg: ics.backgroundColor, rect: {x: ir.x, y: ir.y, w: ir.width, h: ir.height},
      svg: items[0].querySelector('svg') ? 'has-svg' : (items[0].innerHTML || '').slice(0, 80) };
  }
  out.railBg = getComputedStyle(rail).backgroundColor;
  out.htmlClass = document.documentElement.className;
  return JSON.stringify(out, null, 1);
})()
"""


async def main() -> None:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read())
    target = next((p for p in pages if p.get("type") == "page" and "127.0.0.1" in p.get("url", "")), None)
    if not target:
        print("NO PAGE", [(p.get("type"), p.get("url")) for p in pages])
        sys.exit(1)
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=20 * 1024 * 1024) as ws:
        await ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                                  "params": {"expression": EXPR, "returnByValue": True}}))
        while True:
            data = json.loads(await ws.recv())
            if data.get("id") == 1:
                print(data.get("result", {}).get("result", {}).get("value", data))
                break


asyncio.run(main())
