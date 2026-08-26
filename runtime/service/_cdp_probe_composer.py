"""One-off CDP probe: composer topbar / surface geometry in smart-canvas (port 9223)."""
import asyncio
import json
import sys
import urllib.request

import websockets

EXPR = r"""
(() => {
  const frame = [...document.querySelectorAll('iframe')].find(f => (f.src || '').includes('smart-canvas'));
  const doc = frame && frame.contentDocument;
  if (!doc) return JSON.stringify({ error: 'NO_CANVAS_IFRAME', frames: [...document.querySelectorAll('iframe')].map(f => f.id + ':' + f.src) });
  const document_ = doc;
  const out = {};
  const probe = (name, sel) => {
    const el = document_.querySelector(sel);
    if (!el) { out[name] = 'MISSING'; return null; }
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out[name] = {
      rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
              top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) },
      top: cs.top, height: cs.height, padding: cs.padding, zIndex: cs.zIndex,
      background: cs.backgroundColor, border: cs.border, borderRadius: cs.borderRadius,
    };
    return el;
  };
  probe('card', '#composer .composer-card');
  probe('topbar', '#composer .composer-card-topbar');
  probe('surface', '#composer .composer-card-surface');
  probe('promptRow', '#composer .prompt-row');
  const tb = document_.querySelector('#composer .composer-card-topbar');
  if (tb) {
    const before = getComputedStyle(tb, '::before');
    out.topbarBefore = {
      content: before.content, inset: `${before.top} ${before.right} ${before.bottom} ${before.left}`,
      background: before.backgroundColor, borderRadius: before.borderRadius, height: before.height,
    };
  }
  const btn = document_.querySelector('#composer .composer-asset-shortcut');
  if (btn) {
    const cs = getComputedStyle(btn);
    out.refBtn = { color: cs.color, rect: btn.getBoundingClientRect().x };
  }
  const kind = document_.querySelector('#composer #apiKindToggle button');
  if (kind) { out.kindBtn = { color: getComputedStyle(kind).color }; }
  const left = document_.querySelector('#composer .composer-card-topbar-left');
  if (left) { out.leftGroup = { marginLeft: getComputedStyle(left).marginLeft, x: +left.getBoundingClientRect().x.toFixed(1) }; }
  const tokens = getComputedStyle(document_.documentElement);
  out.tokens = {
    topbarH: tokens.getPropertyValue('--ui-composer-topbar-h'),
    surfaceTop: tokens.getPropertyValue('--ui-composer-surface-top'),
    sideInset: tokens.getPropertyValue('--ui-composer-surface-side-inset'),
  };
  return JSON.stringify(out, null, 1);
})()
"""


async def main() -> None:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read())
    target = None
    for p in pages:
        url = p.get("url", "")
        if p.get("type") == "page" and "127.0.0.1" in url:
            target = p
            break
    if not target:
        print("PAGES:", [(p.get("type"), p.get("url")) for p in pages])
        sys.exit(1)
    print("PAGE:", target["url"].split("?")[0])
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=20 * 1024 * 1024) as ws:
        await ws.send(json.dumps({
            "id": 1, "method": "Runtime.evaluate",
            "params": {"expression": EXPR, "returnByValue": True},
        }))
        while True:
            data = json.loads(await ws.recv())
            if data.get("id") == 1:
                print(data["result"]["result"]["value"])
                break


asyncio.run(main())
