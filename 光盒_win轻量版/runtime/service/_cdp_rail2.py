"""One-off CDP experiment: stacking/paint diagnosis for the left rail."""
import asyncio
import base64
import json
import os
import sys
import urllib.request

import websockets

PROBE = r"""
(() => {
  const out = {};
  const q = s => document.querySelector(s);
  const info = (name, el) => {
    if (!el) { out[name] = 'MISSING'; return; }
    const cs = getComputedStyle(el);
    out[name] = { z: cs.zIndex, pos: cs.position, transform: cs.transform,
      pe: cs.pointerEvents, isolation: cs.isolation, opacity: cs.opacity,
      mixBlend: cs.mixBlendMode, contain: cs.contain, willChange: cs.willChange };
  };
  info('rail', q('.shell-primary-rail'));
  info('stage', q('.stage'));
  info('iframe', q('#frame-canvas'));
  info('appShell', q('.app-shell'));
  const rail = q('.shell-primary-rail');
  const stage = q('.stage');
  out.domOrder = rail && stage ? (rail.compareDocumentPosition(stage) & 4 ? 'rail-then-stage' : 'stage-then-rail') : '?';
  out.railParent = rail?.parentElement?.className || '?';
  out.stageParent = stage?.parentElement?.className || '?';
  return JSON.stringify(out, null, 1);
})()
"""

MARK = r"""
(() => {
  const rail = document.querySelector('.shell-primary-rail');
  rail.style.setProperty('background', 'red', 'important');
  rail.style.setProperty('z-index', '99999', 'important');
  return 'marked';
})()
"""

UNMARK = r"""
(() => {
  const rail = document.querySelector('.shell-primary-rail');
  rail.style.removeProperty('background');
  rail.style.removeProperty('z-index');
  return 'unmarked';
})()
"""


async def main() -> None:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read())
    target = next((p for p in pages if p.get("type") == "page" and "127.0.0.1" in p.get("url", "")), None)
    if not target:
        sys.exit("NO PAGE")
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=50 * 1024 * 1024) as ws:
        mid = 0

        async def send(method, params=None):
            nonlocal mid
            mid += 1
            await ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
            while True:
                data = json.loads(await ws.recv())
                if data.get("id") == mid:
                    return data

        r = await send("Runtime.evaluate", {"expression": PROBE, "returnByValue": True})
        print(r["result"]["result"]["value"])

        print(await send("Runtime.evaluate", {"expression": MARK, "returnByValue": True}))
        await asyncio.sleep(0.5)
        shot = await send("Page.captureScreenshot", {"format": "png"})
        out = os.path.join(os.environ["TEMP"], "lb_rail_marked.png")
        with open(out, "wb") as f:
            f.write(base64.b64decode(shot["result"]["data"]))
        print("SAVED", out)
        print(await send("Runtime.evaluate", {"expression": UNMARK, "returnByValue": True}))


asyncio.run(main())
