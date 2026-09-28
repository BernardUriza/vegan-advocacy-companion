#!/usr/bin/env python3
"""receipt-collage.py — apila los PNG de receipt-shots en un solo collage con caption por recibo.

  python3 scripts/receipt-collage.py <dir-con-index.json> <salida.png> ["Título"]
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src = Path(sys.argv[1]); out = Path(sys.argv[2]); title = sys.argv[3] if len(sys.argv) > 3 else ''
index = [i for i in json.loads((src / 'index.json').read_text()) if i.get('ok')]
W = 900; PAD = 18; CAP = 34; GAP = 14
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 20)
    tfont = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
except Exception:
    font = tfont = ImageFont.load_default()
shots = []
for i in index:
    im = Image.open(i['file']).convert('RGB')
    if im.width != W - 2 * PAD:
        r = (W - 2 * PAD) / im.width
        im = im.resize((W - 2 * PAD, int(im.height * r)), Image.LANCZOS)
    shots.append((i, im))
H = PAD + (60 if title else 0) + sum(CAP + im.height + GAP for _, im in shots) + PAD
canvas = Image.new('RGB', (W, H), '#f0f2f5')
d = ImageDraw.Draw(canvas)
y = PAD
if title:
    d.text((PAD, y), title, fill='#050505', font=tfont); y += 60
for i, im in shots:
    d.text((PAD, y), i.get('where', ''), fill='#65676b', font=font); y += CAP
    d.rectangle([PAD - 2, y - 2, PAD + im.width + 1, y + im.height + 1], outline='#ced0d4')
    canvas.paste(im, (PAD, y)); y += im.height + GAP
canvas.save(out, optimize=True)
print(json.dumps({'ok': True, 'out': str(out), 'shots': len(shots), 'size': [W, H]}))
