"""One-off CDP: isolate why the rail never paints."""
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
  const rail = document.querySelector('.shell-primary-rail');
  out.anims = rail.getAnimations({subtree: true}).map(a => ({
    name: a.animationName || a.id || 'anon', state: a.playState,
    effect: String(a.effect?.target?.className || '').slice(0, 40)
  }));
  const cs = getComputedStyle(rail);
  out.style = {
    contentVisibility: cs.contentVisibility, contain: cs.contain,
    willChange: cs.willChange, animation: cs.animation, transition: cs.transition.slice(0, 120),
    inset: `${cs.left} ${cs.top}`, width: cs.width, height: cs.height,
    overflow: cs.overflow, maskImage: cs.maskImage, translate: cs.translate,
    scale: cs.scale, rotate: cs.rotate, offsetPath: cs.offsetPath,
  };
  // paint isolation test: hide iframe & stage, mark rail
  document.querySelector('#frame-canvas').style.setProperty('display', 'none', 'important');
  const stage = document.querySelector('.stage');
  stage.style.setProperty('background', '#204020', 'important');
  rail.style.setProperty('background', 'red', 'important');
  rail.style.setProperty('z-index', '2147483000', 'important');
  return JSON.stringify(out, null, 1);
})()
"""

RESTORE = r"""
(() => {
  document.querySelector('#frame-canvas').style.removeProperty('display');
  document.querySelector('.stage').style.removeProperty('background');
  const rail = document.querySelector('.shell-primary-rail');
  rail.style.removeProperty('background');
  rail.style.removeProperty('z-index');
  return 'restored';
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
        await asyncio.sleep(0.6)
        shot = await send("Page.captureScreenshot", {"format": "png"})
        out = os.path.join(os.environ["TEMP"], "lb_rail_isolated.png")
        with open(out, "wb") as f:
            f.write(base64.b64decode(shot["result"]["data"]))
        print("SAVED", out)
        print(await send("Runtime.evaluate", {"expression": RESTORE, "returnByValue": True}))


asyncio.run(main())
