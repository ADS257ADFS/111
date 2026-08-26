"""One-off CDP: live-test the .app-shell position fix."""
import asyncio
import base64
import json
import os
import sys
import urllib.request

import websockets

APPLY = r"""
(() => {
  const el = document.querySelector('.app-shell');
  el.style.setProperty('position', 'relative', 'important');
  el.style.setProperty('inset', 'auto', 'important');
  el.style.setProperty('margin-top', '28px', 'important');
  el.style.setProperty('width', '100%', 'important');
  el.style.setProperty('height', 'calc(100vh - 28px)', 'important');
  return 'applied';
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

        print(await send("Runtime.evaluate", {"expression": APPLY, "returnByValue": True}))
        await asyncio.sleep(0.8)
        shot = await send("Page.captureScreenshot", {"format": "png"})
        out = os.path.join(os.environ["TEMP"], "lb_fix_test.png")
        with open(out, "wb") as f:
            f.write(base64.b64decode(shot["result"]["data"]))
        print("SAVED", out)


asyncio.run(main())
