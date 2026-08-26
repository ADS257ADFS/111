"""One-off CDP diagnostics for the running Lightbox shell (port 9223)."""
import asyncio
import json
import sys
import urllib.request

import websockets

EXPR = r"""
(() => {
  const out = {};
  out.htmlClass = document.documentElement.className;
  const probe = (name, sel) => {
    const el = document.querySelector(sel);
    if (!el) { out[name] = 'MISSING'; return; }
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out[name] = {
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
      transform: cs.transform, zIndex: cs.zIndex, position: cs.position,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      clipPath: cs.clipPath,
    };
  };
  probe('rail', '.shell-primary-rail');
  probe('appShell', '.app-shell');
  probe('stage', '.stage');
  probe('gptDock', '.gpt-dock');
  probe('dockOpenBtn', '.dock-open-btn');
  probe('topUserBtn', '.top-user-btn');
  probe('titlebar', '.lightbox-native-titlebar');
  out.errors = window.__lbErrors || 'no-hook';
  return JSON.stringify(out, null, 1);
})()
"""


async def main() -> None:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read())
    target = None
    for p in pages:
        if p.get("type") == "page" and "127.0.0.1" in p.get("url", ""):
            target = p
            break
    if not target:
        print("PAGES:", [(p.get("type"), p.get("url")) for p in pages])
        sys.exit(1)
    print("PAGE:", target["url"])
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=20 * 1024 * 1024) as ws:
        msg_id = 0
        logs = []

        async def send(method, params=None):
            nonlocal msg_id
            msg_id += 1
            await ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
            while True:
                data = json.loads(await ws.recv())
                if data.get("id") == msg_id:
                    return data
                m = data.get("method", "")
                if m in ("Log.entryAdded", "Runtime.consoleAPICalled", "Runtime.exceptionThrown"):
                    logs.append(data)

        await send("Log.enable")
        await send("Runtime.enable")
        # give buffered log entries a moment to replay
        try:
            while True:
                data = json.loads(await asyncio.wait_for(ws.recv(), timeout=2.0))
                m = data.get("method", "")
                if m in ("Log.entryAdded", "Runtime.consoleAPICalled", "Runtime.exceptionThrown"):
                    logs.append(data)
        except asyncio.TimeoutError:
            pass

        result = await send("Runtime.evaluate", {"expression": EXPR, "returnByValue": True})
        print("=== DOM STATE ===")
        print(result.get("result", {}).get("result", {}).get("value", result))

        print("=== LOGS (%d) ===" % len(logs))
        for entry in logs[:40]:
            m = entry["method"]
            p = entry.get("params", {})
            if m == "Log.entryAdded":
                e = p.get("entry", {})
                print(f"[{e.get('level')}] {e.get('source')}: {str(e.get('text'))[:300]} @{e.get('url','')}:{e.get('lineNumber','')}")
            elif m == "Runtime.exceptionThrown":
                d = p.get("exceptionDetails", {})
                print("[exception]", str(d.get("text")), str(d.get("exception", {}).get("description"))[:400])
            else:
                args = " ".join(str(a.get("value", a.get("description", "")))[:200] for a in p.get("args", []))
                print(f"[console.{p.get('type')}] {args}")


asyncio.run(main())
