# Blur private content in real dsh-reach-point screenshots.
# Keeps the rail strip (x 350-395) visible; blurs sidebar + all chat text + preview card.
# Usage: python scripts/blur-rail.py <in.png> <out.png>
import sys
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGB')
w, h = img.size

mask = Image.new('L', (w, h), 0)
mpx = mask.load()

# 1) left sidebar (session titles / workspace names) — x 0..348
for y in range(0, h):
    for x in range(0, 350):
        mpx[x, y] = 255

# 2) chat content + preview card — right of the rail (x >= 396)
#    rail spans x 354..390; keep a small margin: blur from x=396 onward
for y in range(0, h):
    for x in range(396, w):
        mpx[x, y] = 255

# strong blur + pixelation for guaranteed unreadability
blurred = img.filter(ImageFilter.GaussianBlur(radius=12))
blurred = blurred.filter(ImageFilter.GaussianBlur(radius=9))
small = img.resize((w // 16, h // 16), Image.BILINEAR).resize((w, h), Image.BILINEAR)
blended = Image.blend(blurred, small, 0.5)
out = Image.composite(blended, img, mask)
out.save(dst)
print(f'ok: {dst} ({w}x{h})')
