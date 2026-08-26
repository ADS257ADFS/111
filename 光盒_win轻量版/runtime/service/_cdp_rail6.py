"""One-off CDP: find the paint-suppressing property on .app-shell."""
import asyncio
import json
import sys
import urllib.request

import websockets

PROBE = r"""
(() => {
  const el = document.querySelector('.app-shell');
  const cs = getComputedStyle(el);
  const keys = ['maskImage','webkitMaskImage','maskBorder','filter','backdropFilter',
    'clipPath','clip','opacity','visibility','display','contentVisibility','contain',
    'mixBlendMode','isolation','transformStyle','perspective','offsetPath','willChange',
    'containerType','overflow','width','height','background'];
  const out = { styles: {} };
  keys.forEach(k => { out.styles[k] = cs[k]; });
  out.children = [...el.children].map(c => {
    const ccs = getComputedStyle(c);
    const r = c.getBoundingClientRect();
    return { tag: c.tagName + '.' + String(c.className).split(' ').slice(0,2).join('.'),
      display: ccs.display, vis: ccs.visibility, op: ccs.opacity,
      rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` };
  });
  out.attrs = [...el.attributes].map(a => a.name + '=' + String(a.value).slice(0,60));
  return JSON.stringify(out, null, 1);
})()
"""


async def main() -> None:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read())
    target = next((p for p in pages if p.get("type") == "page" and "127.0.0.1" in p.get("url", "")), None)
    if not target:
        sys.exit("NO PAGE")
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=50 * 1024 * 1024) as ws:
        await ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                                  "params": {"expression": PROBE, "returnByValue": True}}))
        while True:
            data = json.loads(await ws.recv())
            if data.get("id") == 1:
                print(data["result"]["result"]["value"])
                break


asyncio.run(main())
