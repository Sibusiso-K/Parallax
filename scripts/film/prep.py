"""Fonts, the trimmed narration, and the still panels the film needs."""
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont

DIR = Path('C:/Users/USER/Desktop/Parallax-film')
REPO = Path('C:/Users/USER/Desktop/Parallax-photoreal')
FONTS = DIR / 'fonts'
FONTS.mkdir(exist_ok=True)
NM = REPO / 'node_modules'


def ttf(src, out, wght=None, family=None):
    if (FONTS / out).exists():
        return
    f = TTFont(src)
    f.flavor = None
    if wght is not None and 'fvar' in f:
        f = instancer.instantiateVariableFont(f, {'wght': wght})
    if family:
        for rec in f['name'].names:
            if rec.nameID in (1, 4, 16):
                rec.string = family
            if rec.nameID == 6:
                rec.string = family.replace(' ', '')
    f.save(FONTS / out)


ttf(NM / '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2', 'InstrumentSerif.ttf', family='Instrument Serif')
ttf(NM / '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'Geist.ttf', 450, 'Geist Film')
ttf(NM / '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'GeistSemi.ttf', 600, 'Geist Film Semi')
ttf(NM / '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2', 'GeistMono.ttf', 450, 'Geist Mono Film')
GEN = DIR / 'gen'
PANEL = DIR / 'panel'
PANEL.mkdir(exist_ok=True)
serif = lambda s: ImageFont.truetype(str(FONTS / 'InstrumentSerif.ttf'), s)
sans = lambda s: ImageFont.truetype(str(FONTS / 'Geist.ttf'), s)
semi = lambda s: ImageFont.truetype(str(FONTS / 'GeistSemi.ttf'), s)
mono = lambda s: ImageFont.truetype(str(FONTS / 'GeistMono.ttf'), s)
BOX = json.load(open(DIR / 'face_boxes.json'))

# --- Six edits of one mouth: the trick, shown ---
x1, y1, x2, y2 = BOX['close-golden']['mouth'][0][:4]
cx, cy = (x1 + x2) // 2, (y1 + y2) // 2 + 6
cw, ch = 300, 170
W, H = 2048, 1152
sheet = Image.new('RGB', (W, H), (12, 10, 9))
names = [('ah', 'ah'), ('ee', 'ee'), ('oo', 'oo'), ('fv', 'f, v'), ('mm', 'm, b, p'), ('blink', 'blink')]
pad, gap = 110, 40
tw = (W - pad * 2 - gap * 2) // 3
th = int(tw * ch / cw)
top = (H - th * 2 - gap - 90) // 2
d = ImageDraw.Draw(sheet)
for i, (shape, label) in enumerate(names):
    im = Image.open(GEN / f'close-golden-{shape}.jpg').convert('RGB')
    if shape == 'blink':
        ex1, ey1, ex2, ey2 = BOX['close-golden']['eyes'][0][:4]
        c = ((ex1 + ex2) // 2, (ey1 + ey2) // 2)
    else:
        c = (cx, cy)
    crop = im.crop((c[0] - cw // 2, c[1] - ch // 2, c[0] + cw // 2, c[1] + ch // 2)).resize((tw, th), Image.LANCZOS)
    px, py = pad + (i % 3) * (tw + gap), top + (i // 3) * (th + gap + 44)
    sheet.paste(crop, (px, py))
    d.text((px, py + th + 8), label, font=sans(28), fill=(214, 206, 196))
sheet.save(PANEL / 'mouths.jpg', quality=93)

# --- The eval table: real output of npm run eval, first run and now ---
def terminal(name, title, lines, colour):
    im = Image.new('RGB', (2048, 1152), (10, 12, 18))
    d = ImageDraw.Draw(im)
    d.text((150, 210), title, font=serif(76), fill=(244, 240, 232))
    y = 350
    d.text((150, y), '$ npm run eval', font=mono(36), fill=(150, 160, 178))
    y += 76
    for row in lines:
        fill = (214, 220, 232)
        if 'guard_attacks' in row:
            fill = colour
        if row.startswith('Suite'):
            fill = (130, 140, 158)
        d.text((150, y), row, font=mono(36), fill=fill)
        y += 62
    im.save(PANEL / f'{name}.jpg', quality=93)


terminal('eval-first', 'First run', ['Suite                 Result  Measured', 'guard_attacks         FAIL    450 attempts; 231 blocked; 219 leaked'], (255, 120, 104))
terminal('eval-now', 'Now', ['Suite                 Result  Measured', 'guard_attacks         PASS    450 attempts; 450 blocked; 0 leaked', 'determinism           PASS    12 comparisons; 0 mismatches', 'context_engineering   PASS    540 slices; character-based estimates', 'engine_truth          PASS    10 candidates; 5 breakpoints; 0 mismatches', 'document_parsing      PASS    38 correct; 0 wrong', 'Network attempts: 0. No API key needed.'], (120, 226, 160))

# --- Built on Meta: every model, one job ---
im = Image.new('RGB', (2048, 1152), (10, 12, 18))
d = ImageDraw.Draw(im)
d.text((170, 150), 'Built on Meta', font=serif(92), fill=(244, 240, 232))
rows = [('Muse Image', 'paints the room, the person, her mouth, the repaint'), ('SAM 3.1', 'makes the photograph touchable, finds the clause'), ('Muse Wonder', 'conducts the swarm, writes her words'), ('Muse Spark', 'specialists, reading, live search, the Art Director'), ('Muse Voice', 'hears a question asked out loud')]
y = 330
for name, job in rows:
    d.text((170, y), name, font=semi(44), fill=(244, 240, 232))
    d.text((620, y + 3), job, font=sans(40), fill=(176, 184, 198))
    y += 92
d.text((170, y + 44), 'All of it built during the hackathon, 27 Oct to 4 Nov 2026.', font=sans(38), fill=(232, 200, 148))
im.save(PANEL / 'meta.jpg', quality=93)
print('panels done')
