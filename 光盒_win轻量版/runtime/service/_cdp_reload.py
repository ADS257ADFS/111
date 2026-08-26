"""One-off: hard-reload the Lightbox shell page over CDP (port 9223)."""
import asyncio
import json
import urllib.request

import websockets


async def main() -> None:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read())
    target = next(p for p in pages if p.get("type") == "page" and "127.0.0.1" in p.get("url", ""))
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=20 * 1024 * 1024) as ws:
        await ws.send(json.dumps({"id": 1, "method": "Page.reload", "params": {"ignoreCache": True}}))
        data = json.loads(await ws.recv())
        print("RELOADED", data)


asyncio.run(main())
