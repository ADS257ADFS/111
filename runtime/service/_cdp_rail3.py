"""One-off CDP: confirm backdrop-filter paint failure hypothesis."""
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
  out.railCount = document.querySelectorAll('.shell-primary-rail').length;
  const cs = getComputedStyle(rail);
  out.railBackdrop = cs.backdropFilter;
  out.railFilter = cs.filter;
  out.htmlClip = getComputedStyle(document.documentElement).clipPath;
  out.bodyClip = getComputedStyle(document.body).clipPath;
  out.stageClip = getComputedStyle(document.querySelector('.stage')).clipPath;
  out.shellClip = getComputedStyle(document.querySelector('.app-shell')).clipPath;
  out.frameCss = [...document.querySelectorAll('link[href*="desktop-window-frame"]')].map(l => l.href);
  const composer = document.querySelector('.canvas-composer, .shell-canvas-composer, [class*="composer"]');
  out.composerClass = composer ? composer.className.slice(0, 80) : 'MISSING';
  if (composer) out.composerBackdrop = getComputedStyle(composer).backdropFilter;
  return JSON.stringify(out, null, 1);
})()
"""

KILL_BF = r"""
(() => {
  const rail = document.querySelector('.shell-primary-rail');
  rail.style.setProperty('backdrop-filter', 'none', 'important');
  rail.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
  return 'backdrop-off';
})()
"""

RESTORE = r"""
(() => {
  const rail = document.querySelector('.shell-primary-rail');
  rail.style.removeProperty('backdrop-filter');
  rail.style.removeProperty('-webkit-backdrop-filter');
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

        print(await send("Runtime.evaluate", {"expression": KILL_BF, "returnByValue": True}))
        await asyncio.sleep(0.6)
        shot = await send("Page.captureScreenshot", {"format": "png"})
        out = os.path.join(os.environ["TEMP"], "lb_rail_nobf.png")
        with open(out, "wb") as f:
            f.write(base64.b64decode(shot["result"]["data"]))
        print("SAVED", out)
        print(await send("Runtime.evaluate", {"expression": RESTORE, "returnByValue": True}))


asyncio.run(main())
