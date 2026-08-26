"""One-off CDP screenshot: full page + cropped composer area (port 9223)."""
import asyncio
import base64
import io
import json
import sys
import urllib.request

import websockets
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Administrator\Desktop\光盒_win轻量版\verification-composer.png"

LOCATE = r"""
(() => {
  const frame = [...document.querySelectorAll('iframe')].find(f => (f.src || '').includes('smart-canvas'));
  const doc = frame && frame.contentDocument;
  if (!doc) return JSON.stringify({ error: 'NO_IFRAME' });
  const card = doc.querySelector('#composer .composer-card');
  if (!card) return JSON.stringify({ error: 'NO_CARD' });
  const fr = frame.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  return JSON.stringify({
    x: fr.x + cr.x, y: fr.y + cr.y, w: cr.width, h: cr.height,
    dpr: window.devicePixelRatio,
  });
})()
"""


async def main() -> None:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read())
    target = next(p for p in pages if p.get("type") == "page" and "127.0.0.1" in p.get("url", ""))
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024) as ws:
        msg_id = 0

        async def send(method, params=None):
            nonlocal msg_id
            msg_id += 1
            await ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
            while True:
                data = json.loads(await ws.recv())
                if data.get("id") == msg_id:
                    return data

        loc = await send("Runtime.evaluate", {"expression": LOCATE, "returnByValue": True})
        info = json.loads(loc["result"]["result"]["value"])
        print("card:", info)
        if "error" in info:
            sys.exit(1)
        shot = await send("Page.captureScreenshot", {"format": "png"})
        raw = base64.b64decode(shot["result"]["data"])
        img = Image.open(io.BytesIO(raw))
        dpr = info["dpr"]
        pad = 30
        box = (
            max(0, int((info["x"] - pad) * dpr)),
            max(0, int((info["y"] - pad) * dpr)),
            min(img.width, int((info["x"] + info["w"] + pad) * dpr)),
            min(img.height, int((info["y"] + info["h"] + pad) * dpr)),
        )
        crop = img.crop(box)
        scale = 2
        crop = crop.resize((crop.width * scale, crop.height * scale), Image.LANCZOS)
        crop.save(OUT)
        print("SAVED", OUT, "size", crop.size)


asyncio.run(main())
