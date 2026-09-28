#!/usr/bin/env python3
"""receipt-collage.py — apila los PNG de receipt-shots en un solo collage con caption por recibo.

  python3 scripts/receipt-collage.py <dir-con-index.json> <salida.png> ["Título"] [--pairs photos.json]

--pairs: layout de PARES (2026-09-28, Bernard: "imágenes al lado de cada comentario ... de animales
reales que demuestren o sugieran lo contrario"). photos.json = [{slug, file, caption, artist, license}]
alineado por `slug` con index.json; cada fila = recibo a la izquierda, foto + caption + crédito a la derecha.

--social (con --pairs): versión vertical 1080px "tipo post" (2026-09-28, Bernard: "más llamativa y menos
estructurada... descripciones más pequeñas o referidas"). Fondo oscuro, la foto del animal es el héroe
COMPLETA (sin recorte, esquinas redondas, ligera inclinación, alternando lado), debajo la micro-leyenda, la frase
resaltada RECORTADA del screenshot real (línea del autor + banda amarilla ± contexto) como burbuja, y "grupo · edad";
número en círculo por tarjeta y créditos en un pie pequeño. photos.json admite `short` (micro-leyenda). --anon tapa el nombre del autor con
"Commenter N" y la mención azul a Bernard con una barra del color de la burbuja (nada más del render cambia).
--cards <dir> escribe además cada tarjeta como PNG propio (card-1.png…; título solo en la 1, créditos solo en la última).
"""
import argparse, json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


def parse_args(argv):
    ap = argparse.ArgumentParser(prog='receipt-collage.py')
    ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('title', nargs='?', default='')
    ap.add_argument('--pairs'); ap.add_argument('--cards')
    ap.add_argument('--social', action='store_true'); ap.add_argument('--anon', action='store_true')
    return ap.parse_intermixed_args(argv)


def die(msg):
    print(json.dumps({'ok': False, 'error': msg}), file=sys.stderr); sys.exit(2)


opts = parse_args(sys.argv[1:])
pairs_file = opts.pairs
src = Path(opts.src); out = Path(opts.out); title = opts.title
index = [i for i in json.loads((src / 'index.json').read_text()) if i.get('ok')]
if not index: die(f'0 recibos usables (ok:true) en {src / "index.json"}; no se escribe imagen')
W = 900; PAD = 18; CAP = 34; GAP = 14
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 20)
    tfont = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
except Exception:
    font = tfont = ImageFont.load_default()
SOCIAL = opts.social; ANON = opts.anon
cards_dir = opts.cards


def yellow_bands(im):
    px = im.convert('RGB').load(); w, h = im.size; bands = []; cur = None
    for y in range(h):
        n = sum(1 for x in range(0, w, 2) if px[x, y][0] > 200 and px[x, y][1] > 200 and px[x, y][2] < 120)
        if n > 3 and cur is None: cur = y
        if n <= 3 and cur is not None: bands.append((cur, y)); cur = None
    if cur is not None: bands.append((cur, h))
    return bands


def quote_crop(im, author_h=30, ctx=6):
    bands = yellow_bands(im)
    if im.height <= 220 or not bands: return im
    y0, y1 = max(0, bands[0][0] - ctx), min(im.height, bands[-1][1] + ctx)
    if y0 <= author_h + 4: return im.crop((0, 0, im.width, y1))
    head = im.crop((0, 0, im.width, author_h)); body = im.crop((0, y0, im.width, y1)); sep = 16
    out = Image.new('RGB', (im.width, author_h + sep + body.height), im.getpixel((2, 2)))
    out.paste(head, (0, 0)); out.paste(body, (0, author_h + sep))
    dd = ImageDraw.Draw(out)
    for k in range(3): dd.ellipse([10 + k * 12, author_h + 5, 14 + k * 12, author_h + 9], fill='#8a8d91')
    return out


def anonymize(im, n, author_h=30):
    px = im.load(); w, h = im.size; bg = im.getpixel((2, 2)); d = ImageDraw.Draw(im)
    name_x = max((x for x in range(w) for y in range(author_h) if all(c > 215 for c in px[x, y])), default=0)
    d.rectangle([0, 0, name_x + 8, author_h - 1], fill=bg)
    d.text((9, 23), f'Commenter {n}', fill='#e4e6eb', font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 20, index=1), anchor='ls')
    link = [(x, y) for y in range(author_h, h) for x in range(w) if 90 <= px[x, y][0] <= 130 and 150 <= px[x, y][1] <= 180 and px[x, y][2] >= 235]
    while link:
        y0 = link[0][1]; band = [(x, y) for x, y in link if y0 - 4 <= y <= y0 + 26]; link = [t for t in link if t not in band]
        xs = [x for x, _ in band]; ys = [y for _, y in band]
        if max(xs) - min(xs) > 100: d.rectangle([min(xs) - 3, min(ys) - 6, max(xs) + 3, max(ys) + 6], fill=bg)
    return im


def rounded(im, r):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], r, fill=255)
    out = im.convert('RGBA'); out.putalpha(m); return out


def drop_shadow(canvas, im, xy, blur=18, off=(0, 10), alpha=150):
    sh = Image.new('RGBA', (im.width + blur * 4, im.height + blur * 4), (0, 0, 0, 0))
    a = im.split()[-1].point(lambda v: v * alpha // 255)
    sh.paste((0, 0, 0, 255), (blur * 2, blur * 2), a); sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(sh, (xy[0] - blur * 2 + off[0], xy[1] - blur * 2 + off[1]))


def fit(im, w, max_h):
    r = min(w / im.width, max_h / im.height)
    return im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)


def wrap(text, f, width):
    words, lines, cur = text.split(), [], ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if f.getlength(t) <= width: cur = t
        else: lines.append(cur); cur = w_
    if cur: lines.append(cur)
    return lines


def social(index, photos_file, out, title, cards_dir=None):
    photos = {p['slug']: p for p in json.loads(Path(photos_file).read_text())}
    W, M = 1080, 40; PW, PH_MAX, GAP = 920, 640, 44
    HB = '/System/Library/Fonts/Helvetica.ttc'
    tf = ImageFont.truetype(HB, 46, index=1); nf = ImageFont.truetype(HB, 26, index=1)
    wf = ImageFont.truetype(HB, 20); lf = ImageFont.truetype(HB, 22); cf = ImageFont.truetype(HB, 18)
    while tf.getlength(title) > W - 2 * M and tf.size > 36: tf = ImageFont.truetype(HB, tf.size - 2, index=1)
    cards = []
    for n, i in enumerate(index, 1):
        ph = photos.get(i.get('slug'))
        if not ph: continue
        q = quote_crop(Image.open(i['file']).convert('RGB'))
        if ANON: q = anonymize(q, n)
        bw = 740 if q.width <= 900 else 820; q = q.resize((bw, round(q.height * bw / q.width)), Image.LANCZOS)
        chip = Image.new('RGB', (bw + 24, q.height + 24), q.getpixel((2, 2))); chip.paste(q, (12, 12))
        chip = rounded(chip, 16)
        pim = fit(Image.open(Path(photos_file).parent / ph['file']).convert('RGB'), PW, PH_MAX)
        pim = rounded(pim, 24).rotate((0.8, -0.6, 0.7, -0.8, 0.5)[(n - 1) % 5], Image.BICUBIC, expand=True)
        cards.append((n, i, ph, pim, chip))
    if not cards: die(f'0 tarjetas: ningún slug de index.json tiene foto en {photos_file}; no se escribe imagen')
    credits = 'Photos: ' + ' · '.join(f"{n} {ph.get('artist', '')} {ph.get('license', '')}".strip() for n, _, ph, *_ in cards)
    cl = wrap(credits, cf, W - 2 * M)
    rows = [pim.height + 12 + 32 + chip.height + 34 for *_, pim, chip in cards]
    H = M + 46 + 30 + sum(rows) + (len(cards) - 1) * GAP + 24 + len(cl) * 24 + M
    def draw_card(canvas, y, card):
        n, i, ph, pim, chip = card; left = n % 2 == 1
        px = M if left else W - M - pim.width
        drop_shadow(canvas, pim, (px, y)); canvas.alpha_composite(pim, (px, y))
        d = ImageDraw.Draw(canvas)
        bx = (px - 8) if left else (px + pim.width - 40); by = y - 8
        d.ellipse([bx, by, bx + 48, by + 48], fill='#f7b928')
        d.text((bx + 24, by + 25), str(n), fill='#18191a', font=nf, anchor='mm')
        tx = px + 8 if left else px + pim.width - 8
        d.text((tx, y + pim.height + 12), f"{n} · {ph.get('short') or ph['caption']}", fill='#c7cad0', font=lf, anchor='la' if left else 'ra')
        cx = (px + 8) if left else (px + pim.width - 8 - chip.width); cy = y + pim.height + 12 + 32
        drop_shadow(canvas, chip, (cx, cy), blur=14, off=(0, 8), alpha=200); canvas.alpha_composite(chip, (cx, cy))
        d = ImageDraw.Draw(canvas)
        d.text((cx + 12, cy + chip.height + 6), i.get('where', ''), fill='#8a8d91', font=wf)
        return pim.height + 12 + 32 + chip.height + 34

    def draw_credits(canvas, y):
        d = ImageDraw.Draw(canvas)
        for l in cl: d.text((M, y), l, fill='#6f7378', font=cf); y += 24

    canvas = Image.new('RGBA', (W, H), '#18191a')
    ImageDraw.Draw(canvas).text((M, M), title, fill='#e4e6eb', font=tf); y = M + 46 + 30
    for k, card in enumerate(cards):
        y += draw_card(canvas, y, card) + (GAP if k < len(cards) - 1 else 24)
    draw_credits(canvas, y)
    canvas.convert('RGB').save(out, optimize=True)
    result = {'ok': True, 'out': str(out), 'cards': len(cards), 'size': [W, H]}
    if cards_dir:
        Path(cards_dir).mkdir(parents=True, exist_ok=True); result['card_files'] = []
        for k, card in enumerate(cards):
            first, last = k == 0, k == len(cards) - 1
            ch = (M + 46 + 30 if first else M) + rows[k] + (24 + len(cl) * 24 if last else 0) + M
            cc = Image.new('RGBA', (W, ch), '#18191a'); yy = M
            if first: ImageDraw.Draw(cc).text((M, M), title, fill='#e4e6eb', font=tf); yy += 46 + 30
            yy += draw_card(cc, yy, card)
            if last: draw_credits(cc, yy + 24)
            cf_path = Path(cards_dir) / f'card-{card[0]}.png'; cc.convert('RGB').save(cf_path, optimize=True)
            result['card_files'].append({'file': str(cf_path), 'size': [W, ch]})
    print(json.dumps(result))

if SOCIAL and pairs_file:
    social(index, pairs_file, out, title, cards_dir); sys.exit(0)
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
if pairs_file:
    photos = {p['slug']: p for p in json.loads(Path(pairs_file).read_text())}
    LW, RW, GUT = 760, 430, 20
    W2 = PAD + LW + GUT + RW + PAD
    sfont = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 17) if font is not tfont else font
    rows = []
    for i, im in shots:
        ph = photos.get(i.get('slug'))
        r = LW / im.width; left = im.resize((LW, int(im.height * r)), Image.LANCZOS)
        right = cap_lines = None
        if ph:
            pim = Image.open(Path(pairs_file).parent / ph['file']).convert('RGB')
            r2 = RW / pim.width; pim = pim.resize((RW, int(pim.height * r2)), Image.LANCZOS)
            maxh = max(left.height, 300)
            if pim.height > maxh:
                top = (pim.height - maxh) // 2; pim = pim.crop((0, top, RW, top + maxh))
            right = pim
            credit = f"{ph.get('artist') or ''} · {ph.get('license') or ''}".strip(' ·')
            cap_lines = [(l, font, '#050505') for l in wrap(ph.get('caption', ''), font, RW)] + [(l, sfont, '#65676b') for l in wrap(credit, sfont, RW)]
        caph = (sum(26 if f is font else 20 for _, f, _ in cap_lines) + 10) if right else 0
        rh = max(left.height, (right.height + caph) if right else 0)
        rows.append((i, left, right, cap_lines, rh))
    H2 = PAD + (60 if title else 0) + sum(CAP + rh + GAP for *_, rh in rows) + PAD
    canvas = Image.new('RGB', (W2, H2), '#f0f2f5'); d = ImageDraw.Draw(canvas); y = PAD
    if title:
        d.text((PAD, y), title, fill='#050505', font=tfont); y += 60
    for i, left, right, cap_lines, rh in rows:
        d.text((PAD, y), i.get('where', ''), fill='#65676b', font=font); y += CAP
        d.rectangle([PAD - 2, y - 2, PAD + LW + 1, y + left.height + 1], outline='#ced0d4')
        canvas.paste(left, (PAD, y))
        if right:
            x = PAD + LW + GUT; block = right.height + caph
            yy = y + max(0, (left.height - block) // 2) if left.height > block else y
            canvas.paste(right, (x, yy))
            d.rectangle([x - 2, yy - 2, x + RW + 1, yy + right.height + 1], outline='#ced0d4')
            cy = yy + right.height + 8
            for text, f, col in cap_lines:
                d.text((x, cy), text, fill=col, font=f); cy += 26 if f is font else 20
        y += rh + GAP
    canvas.save(out, optimize=True)
    print(json.dumps({'ok': True, 'out': str(out), 'shots': len(rows), 'paired': sum(1 for r in rows if r[2]), 'size': [W2, H2]}))
else:
    canvas.save(out, optimize=True)
    print(json.dumps({'ok': True, 'out': str(out), 'shots': len(shots), 'size': [W, H]}))
