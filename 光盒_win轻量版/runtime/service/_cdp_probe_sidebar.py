"""One-off CDP probe: sidebar recent-item metrics + stylesheet versions (port 9223)."""
import asyncio
import json
import sys
import urllib.request

import websockets

EXPR = r"""
(() => {
  const out = {};
  const item = document.querySelector('.mm-recent-item');
  const items = document.querySelector('.mm-recent-group-items');
  const open = document.querySelector('.mm-recent-open');
  if (item) {
    const cs = getComputedStyle(item);
    const r = item.getBoundingClientRect();
    out.item = { minHeight: cs.minHeight, height: Math.round(r.height * 10) / 10, padding: cs.padding };
  } else { out.item = 'MISSING'; }
  if (items) {
    const cs = getComputedStyle(items);
    out.groupItems = { gap: cs.gap, rowGap: cs.rowGap };
  } else { out.groupItems = 'MISSING'; }
  if (open) {
    const cs = getComputedStyle(open);
    const r = open.getBoundingClientRect();
    out.open = { height: cs.height, rectH: Math.round(r.height * 10) / 10 };
  } else { out.open = 'MISSING'; }
  out.links = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map(l => l.href.split('/').pop())
    .filter(h => /mm-sidebar|design-tokens|minimax/.test(h));
  return JSON.stringify(out, null, 1);
})()
"""


async def main() -> None:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read())
    target = None
    for p in pages:
        url = p.get("url", "")
        if p.get("type") == "page" and "127.0.0.1" in url and "smart-canvas" not in url and "gpt" not in url:
            target = p
            break
    if not target:
        print("PAGES:", [(p.get("type"), p.get("url")) for p in pages])
        sys.exit(1)
    print("PAGE:", target["url"])
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
