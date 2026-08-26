"""One-off CDP: open the gpt dock, report its box + radius."""
import asyncio
import json
import sys
import urllib.request

import websockets

OPEN = r"""
(() => { document.getElementById('gptDockOpenBtn')?.click(); return 'clicked'; })()
"""

PROBE = r"""
(() => {
  const dock = document.querySelector('.gpt-dock');
  const cs = getComputedStyle(dock);
  const r = dock.getBoundingClientRect();
  return JSON.stringify({
    rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    radius: cs.borderRadius, visibility: cs.visibility, opacity: cs.opacity,
    transform: cs.transform, bg: cs.backgroundColor,
    htmlClass: document.documentElement.className,
  }, null, 1);
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

        print(await send("Runtime.evaluate", {"expression": OPEN, "returnByValue": True}))
        await asyncio.sleep(1.2)
        r = await send("Runtime.evaluate", {"expression": PROBE, "returnByValue": True})
        print(r["result"]["result"]["value"])


asyncio.run(main())
