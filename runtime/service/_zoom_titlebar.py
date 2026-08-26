"""One-off: zoom into the window-controls corner of the titlebar screenshot."""
import os

from PIL import Image

tmp = os.environ["TEMP"]
im = Image.open(os.path.join(tmp, "titlebar_check.png"))
w, _ = im.size
crop = im.crop((w - 140, 0, w, 30))
crop = crop.resize((crop.width * 4, crop.height * 4), 0)
out = os.path.join(tmp, "titlebar_zoom.png")
crop.save(out)
print(out)
