"""One-off CDP: fresh-element paint test + reparent test."""
import asyncio
import base64
import json
import os
import sys
import urllib.request

import websockets

STEP1 = r"""
(() => {
  // fresh element at rail position
  const probe = document.createElement('div');
  probe.id = '__paintProbe';
  probe.style.cssText = 'position:fixed;left:16px;top:300px;width:50px;height:200px;background:#ff00ff;z-index:2147483000;';
  document.body.appendChild(probe);
  return 'probe-added';
})()
"""

STEP2 = r"""
(() => {
  const rail = document.querySelector('.shell-primary-rail');
  rail.style.setProperty('background', 'red', 'important');
  rail.style.setProperty('z-index', '2147483000', 'important');
  document.body.appendChild(rail);  // reparent out of .app-shell
  return 'rail-reparented';
})()
"""

CLEANUP = r"""
(() => {
  document.getElementById('__paintProbe')?.remove();
  const rail = document.querySelector('.shell-primary-rail');
  rail.style.removeProperty('background');
  rail.style.removeProperty('z-index');
  document.querySelector('.app-shell').prepend(rail);
  return 'cleaned';
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

        async def snap(name):
            await asyncio.sleep(0.6)
            shot = await send("Page.captureScreenshot", {"format": "png"})
            out = os.path.join(os.environ["TEMP"], name)
            with open(out, "wb") as f:
                f.write(base64.b64decode(shot["result"]["data"]))
            print("SAVED", out)

        print(await send("Runtime.evaluate", {"expression": STEP1, "returnByValue": True}))
        await snap("lb_probe_fresh.png")
        print(await send("Runtime.evaluate", {"expression": STEP2, "returnByValue": True}))
        await snap("lb_rail_reparented.png")
        print(await send("Runtime.evaluate", {"expression": CLEANUP, "returnByValue": True}))


asyncio.run(main())
