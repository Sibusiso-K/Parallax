"""Renders the film's cinematic shots: her talking close-ups and the B-roll, each as a silent 1080p segment."""
import json
import os
import subprocess
import sys
import time

import cv2
import numpy as np

DIR = 'C:/Users/USER/Desktop/Parallax-film'
GEN = f'{DIR}/gen'
AUDIO = f'{DIR}/audio'
SEG = f'{DIR}/seg'
os.makedirs(SEG, exist_ok=True)
FPS = 30
W, H = 1920, 1080
SHAPES = ['ah', 'ee', 'oo', 'fv', 'mm', 'blink']
BOXES = json.load(open(f'{DIR}/face_boxes.json'))


def encoder(path, grade=True, grain=7):
    vf = []
    if grade:
        vf += [f'noise=alls={grain}:allf=t', 'vignette=PI/5.2']
    vf += ['format=yuv420p']
    return subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-vf', ','.join(vf), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', path], stdin=subprocess.PIPE)


def feather(h, w, rx, ry, soft):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / rx) ** 2 + ((yy - h / 2) / ry) ** 2)
    m = np.clip((1.0 - d) * (min(rx, ry) / soft), 0, 1)
    return cv2.GaussianBlur(m, (0, 0), soft / 3)[..., None]


def align(base_gray, frame, still):
    scale = .5
    a = cv2.resize(base_gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA).astype(np.float32)
    b = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA).astype(np.float32)
    m = cv2.resize(still, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_NEAREST)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        _, warp = cv2.findTransformECC(a, b, warp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 150, 1e-5), m, 5)
    except cv2.error as e:
        print('ecc failed', str(e)[:80])
    warp = warp.copy()
    warp[:, 2] /= scale
    h, w = base_gray.shape
    return cv2.warpAffine(frame, warp, (w, h), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)


class Talker:
    """Only the mouth and eye regions are ever recomposed, so a frame costs a few milliseconds."""

    def __init__(self, name):
        self.base = cv2.imread(f'{GEN}/{name}.jpg')
        h, w = self.base.shape[:2]
        gray = cv2.cvtColor(self.base, cv2.COLOR_BGR2GRAY)
        b = BOXES[name]
        mx1, my1, mx2, my2 = b['mouth'][0][:4]
        ex1, ey1, ex2, ey2 = b['eyes'][0][:4]
        fx1, fy1, fx2, fy2 = b['face'][0][:4]
        self.mouth = ((mx1 + mx2) / 2, (my1 + my2) / 2)
        self.eyes = ((ex1 + ex2) / 2, (ey1 + ey2) / 2)
        self.face = ((fx1 + fx2) / 2, (fy1 + fy2) / 2, fx2 - fx1, fy2 - fy1)
        # Only skin and hair that should not move decide the alignment.
        still = np.zeros((h, w), np.uint8)
        still[int(max(0, fy1 - 60)):int(min(h, fy2 + 40)), int(max(0, fx1 - 60)):int(min(w, fx2 + 60))] = 255
        cx, cy = int(self.mouth[0]), int(self.mouth[1])
        mw, mh = mx2 - mx1, my2 - my1
        cv2.ellipse(still, (cx, cy + 12), (int(mw * 1.15), int(mh * 2.4)), 0, 0, 360, 0, -1)
        cv2.ellipse(still, (int(self.eyes[0]), int(self.eyes[1])), (int((ex2 - ex1) * .72), int((ey2 - ey1) * 1.5)), 0, 0, 360, 0, -1)
        # Regions: mouth with jaw, and eyes with lids.
        rx, ry = int(mw * .98), int(mh * 2.15)
        self.mbox = (max(0, cx - rx), max(0, cy + 14 - ry), min(w, cx + rx), min(h, cy + 14 + ry))
        self.mmask = feather(self.mbox[3] - self.mbox[1], self.mbox[2] - self.mbox[0], rx, ry, 38)
        ex, ey = int(self.eyes[0]), int(self.eyes[1])
        erx, ery = int((ex2 - ex1) * .66), int((ey2 - ey1) * 1.45)
        self.ebox = (max(0, ex - erx), max(0, ey - ery), min(w, ex + erx), min(h, ey + ery))
        self.emask = feather(self.ebox[3] - self.ebox[1], self.ebox[2] - self.ebox[0], erx, ery, 20)
        self.crops = {}
        basef = self.base.astype(np.float32)
        for shape in SHAPES:
            frame = align(gray, cv2.imread(f'{GEN}/{name}-{shape}.jpg'), still).astype(np.float32)
            # Each edit drifts a little in overall light: keep its detail, take the base's low frequencies.
            frame = frame + cv2.GaussianBlur(basef - frame, (0, 0), 55)
            x1, y1, x2, y2 = self.ebox if shape == 'blink' else self.mbox
            self.crops[shape] = frame[y1:y2, x1:x2].copy()
        x1, y1, x2, y2 = self.mbox
        self.mbase = basef[y1:y2, x1:x2].copy()
        x1, y1, x2, y2 = self.ebox
        self.ebase = basef[y1:y2, x1:x2].copy()

    def frame(self, weights, blink):
        out = self.base.copy()
        total = sum(weights.values())
        if total > .01:
            mix = self.mbase * max(0.0, 1.0 - total)
            for k, v in weights.items():
                if v > .004:
                    mix = mix + self.crops[k] * v
            x1, y1, x2, y2 = self.mbox
            out[y1:y2, x1:x2] = np.clip(self.mbase * (1 - self.mmask) + mix * self.mmask, 0, 255).astype(np.uint8)
        if blink > .01:
            x1, y1, x2, y2 = self.ebox
            lid = self.ebase * (1 - blink) + self.crops['blink'] * blink
            out[y1:y2, x1:x2] = np.clip(self.ebase * (1 - self.emask) + lid * self.emask, 0, 255).astype(np.uint8)
        return out


LETTERS = {'a': ('ah', 1.0), 'e': ('ee', .85), 'i': ('ee', .8), 'y': ('ee', .55), 'o': ('oo', 1.0), 'u': ('oo', .9), 'w': ('oo', .65), 'f': ('fv', .95), 'v': ('fv', .95), 'm': ('mm', 1.0), 'b': ('mm', .95), 'p': ('mm', .95)}


def track(words, n, start, fps=FPS, lead=.03):
    target = {s: np.zeros(n, np.float32) for s in SHAPES[:-1]}
    for w in words:
        letters = [c for c in w['text'].lower() if c.isalpha()]
        if not letters:
            continue
        step = max(1, int(round(len(letters) / max(1.0, w['dur'] * 9))))
        kept = letters[::step]
        dt = w['dur'] / len(kept)
        for i, c in enumerate(kept):
            shape, strength = LETTERS.get(c, ('ee', .4))
            a = int((start + w['at'] + i * dt - lead) * fps)
            b = int((start + w['at'] + (i + 1) * dt - lead) * fps) + 1
            target[shape][max(a, 0):min(b, n)] = strength
    return target


def smooth(targets, n, fps=FPS):
    state = {s: 0.0 for s in targets}
    attack, release = 1 - np.exp(-1 / (fps * .035)), 1 - np.exp(-1 / (fps * .075))
    out = []
    for f in range(n):
        for s in state:
            t = float(targets[s][f])
            state[s] += (t - state[s]) * (attack if t > state[s] else release)
        tot = sum(state.values())
        k = 1 / tot if tot > 1 else 1
        out.append({s: v * k for s, v in state.items()})
    return out


def blinks(n, seed=7, every=(2.6, 4.8)):
    rng = np.random.default_rng(seed)
    out = np.zeros(n, np.float32)
    t = rng.uniform(.7, 1.6)
    while t * FPS < n:
        c = int(t * FPS)
        for i, v in zip(range(c - 2, c + 5), [.35, .8, 1, 1, .8, .45, .15]):
            if 0 <= i < n:
                out[i] = v
        t += rng.uniform(*every)
    return out


def words_of(key):
    return json.load(open(f'{AUDIO}/{key}.json', encoding='utf-8'))


def camera(cx, cy, zoom, t, shift=0, sway=1.0):
    """A 2x3 matrix: the point (cx, cy) of the 2048 wide still goes to a framed spot, with a little hand in the camera."""
    s = zoom * W / 2048
    rot = np.sin(t * .6) * .09 * sway
    M = cv2.getRotationMatrix2D((cx, cy), rot, s)
    M[0, 2] += W * .5 + shift - cx + (np.sin(t * .9) * 2.4 + np.sin(t * 2.3 + 1) * .8) * sway
    M[1, 2] += H * .5 - cy + (np.cos(t * .7) * 1.7) * sway
    return M


def talk(out, name, line_keys, pre=.5, post=.6, z0=1.12, z1=1.24, fade_in=0.0, fade_out=0.0, seed=7):
    """One unbroken close-up. line_keys: spoken in order with a small gap. Returns when each line starts."""
    t0 = time.time()
    lines = [words_of(k) for k in line_keys]
    starts, at = [], pre
    for line in lines:
        starts.append(at)
        at += line['duration'] + .28
    total = at - .28 + post
    n = int(total * FPS)
    who = Talker(name)
    targets = {s: np.zeros(n, np.float32) for s in SHAPES[:-1]}
    for line, st in zip(lines, starts):
        tr = track(line['words'], n, st)
        for s in targets:
            targets[s] = np.maximum(targets[s], tr[s])
    mouth, blink = smooth(targets, n), blinks(n, seed)
    p = encoder(out)
    fx, fy, fw, fh = who.face
    for f in range(n):
        t = f / FPS
        k = f / max(1, n - 1)
        z = z0 + (z1 - z0) * k
        img = who.frame(mouth[f], float(blink[f]))
        # Her face sits a little right of centre in frame, with room for the eyes.
        M = camera(fx, fy - fh * .02, z, t, shift=W * .10)
        frame = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        g = 1.0
        if fade_in and t < fade_in:
            g = t / fade_in
        if fade_out and t > total - fade_out:
            g = min(g, (total - t) / fade_out)
        if g < 1:
            frame = (frame.astype(np.float32) * max(0, g)).astype(np.uint8)
        p.stdin.write(frame.tobytes())
    p.stdin.close()
    p.wait()
    print(os.path.basename(out), 'frames', n, 'seconds', round(total, 2), 'took', round(time.time() - t0, 1), 'starts', [round(s, 2) for s in starts], flush=True)
    return {'total': total, 'starts': dict(zip(line_keys, starts))}


def still(out, name, seconds, z0=1.02, z1=1.14, x0=0.0, x1=0.0, y0=0.0, y1=0.0, fade_in=0.0, fade_out=0.0, flicker=0.0, seed=3, lift=None):
    """A still with a slow move and a slight perspective drift, so it reads as a lens moving through a space."""
    t0 = time.time()
    img = cv2.imread(f'{GEN}/{name}.jpg') if '/' not in name else cv2.imread(name)
    h, w = img.shape[:2]
    if w != 2048:
        img = cv2.resize(img, (2048, int(h * 2048 / w)), interpolation=cv2.INTER_CUBIC)
        h, w = img.shape[:2]
    n = int(seconds * FPS)
    rng = np.random.default_rng(seed)
    p = encoder(out)
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    for f in range(n):
        t = f / FPS
        k = f / max(1, n - 1)
        e = k  # A constant-speed lens move: no easing inside a cut.
        z = z0 + (z1 - z0) * e
        cx = w / 2 + (x0 + (x1 - x0) * e) * w
        cy = h / 2 + (y0 + (y1 - y0) * e) * h
        view_w, view_h = W / (z * W / w), H / (z * W / w)
        # The far side of the frame drifts a touch less than the near side: a cheap dolly.
        d = 8 * (e - .5)
        quad = np.float32([[cx - view_w / 2 + d, cy - view_h / 2 + d * .4], [cx + view_w / 2 + d * .4, cy - view_h / 2 - d * .3], [cx + view_w / 2 - d, cy + view_h / 2 - d * .4], [cx - view_w / 2 - d * .4, cy + view_h / 2 + d * .3]])
        M = cv2.getPerspectiveTransform(quad, np.float32([[0, 0], [W, 0], [W, H], [0, H]]))
        frame = cv2.warpPerspective(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        g = 1.0
        if flicker:
            g *= 1 - flicker * max(0, rng.normal(.2, .35)) * (rng.random() < .35)
        if fade_in and t < fade_in:
            g *= t / fade_in
        if fade_out and t > seconds - fade_out:
            g *= max(0, (seconds - t) / fade_out)
        if g < .999:
            frame = (frame.astype(np.float32) * g).astype(np.uint8)
        p.stdin.write(frame.tobytes())
    p.stdin.close()
    p.wait()
    print(os.path.basename(out), 'seconds', seconds, 'took', round(time.time() - t0, 1), flush=True)


if __name__ == '__main__':
    what = sys.argv[1:] or ['test']
    if 'test' in what:
        talk(f'{SEG}/t_test.mp4', 'close-golden', ['s1'], fade_in=.6)
