"""The edit. Every segment has an exact length, so captions, voice and score can be placed by arithmetic."""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, 'C:/Users/USER/Desktop/Parallax-film')
import cine  # noqa: E402
import score  # noqa: E402

DIR = Path('C:/Users/USER/Desktop/Parallax-film')
SEG = DIR / 'seg'
RAW = DIR / 'raw'
AUDIO = DIR / 'audio'
OUT = Path('C:/Users/USER/Desktop/Parallax-photoreal/film-out')
OUT.mkdir(exist_ok=True)
REPO_PLATE = 'C:/Users/USER/Desktop/Parallax-photoreal/assets/derived/photo-demo-src/plate.jpg'
FPS = 30
timeline = []   # (file, seconds)
lines = []      # (key, start, offset, length): voice
caps = []       # (start, end, style, text)
marks = {}
t_now = 0.0
FORCE = set(sys.argv[1:])


def dur(key):
    return json.load(open(AUDIO / f'{key}.json', encoding='utf-8'))


def text_of(key):
    d = dur(key)
    return d['text']


def say(key, at, caption=True, offset=0.0, length=None):
    d = dur(key)
    n = length or d['duration'] - offset
    lines.append((key, at, offset, n))
    if caption:
        caps.append((at, at + n + .05, 'Cap', d['text']))


def tag(start, end, text, style='Tag'):
    caps.append((start, end, style, text))


def done(path):
    return path.exists() and path.stat().st_size > 1000 and path.stem not in FORCE and 'all' not in FORCE


def place(name, seconds):
    global t_now
    timeline.append((SEG / f'{name}.mp4', seconds))
    start = t_now
    t_now += seconds
    return start


def crop_filter(zoom):
    if not zoom:
        return ''
    cx, cy, z = zoom
    w, h = 1920 / z, 1080 / z
    x = min(max(0, cx - w / 2), 1920 - w)
    y = min(max(0, cy - h / 2), 1080 - h)
    return f'crop={int(w)}:{int(h)}:{int(x)}:{int(y)},scale=1920:1080:flags=lanczos,'


def clip(name, take, a, b, seconds, zoom=None):
    """From a filmed take. Speed comes from the arithmetic: (b - a) of real time fills `seconds` of film."""
    out = SEG / f'{name}.mp4'
    if not done(out):
        k = seconds / (b - a)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(a), '-t', str(b - a + .4), '-i', str(RAW / f'{take}.mp4'), '-vf', f'setpts=(PTS-STARTPTS)*{k:.5f},fps={FPS},{crop_filter(zoom)}format=yuv420p', '-t', str(seconds), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', str(out)], check=True)
        print(name, 'ok', flush=True)
    return place(name, seconds)


LEVER = None


def lever(name, a, b, seconds, zoom=None):
    """The lever take is still frames with timestamps. Only the frames a cut needs are encoded."""
    global LEVER
    out = SEG / f'{name}.mp4'
    if not done(out):
        if LEVER is None:
            rows = open(RAW / 'lever/list.txt').read().split('\n')
            LEVER, t = [], 0.0
            for i in range(0, len(rows) - 1, 2):
                if rows[i].startswith('file') and rows[i + 1].startswith('duration'):
                    d = float(rows[i + 1].split()[1])
                    LEVER.append((t, d, rows[i].split("'")[1]))
                    t += d
        k = seconds / (b - a)
        pick = [f for f in LEVER if f[0] + f[1] > a and f[0] < b]
        with open(RAW / f'lever/{name}.txt', 'w') as f:
            for t, d, file in pick:
                span = min(t + d, b) - max(t, a)
                f.write(f"file '{file}'\nduration {max(.001, span * k):.4f}\n")
            f.write(f"file '{pick[-1][2]}'\n")
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(RAW / f'lever/{name}.txt'), '-vf', f'fps={FPS},{crop_filter(zoom)}scale=1920:1080:flags=bilinear,format=yuv420p', '-t', str(seconds), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', str(out)], check=True)
        print(name, 'ok', flush=True)
    return place(name, seconds)


def still(name, source, seconds, **kw):
    out = SEG / f'{name}.mp4'
    if not done(out):
        cine.still(str(out), source, seconds, **kw)
    return place(name, seconds)


def talk(name, face, keys, **kw):
    out = SEG / f'{name}.mp4'
    meta = SEG / f'{name}.json'
    if not done(out) or not meta.exists():
        info = cine.talk(str(out), face, keys, **kw)
        json.dump(info, open(meta, 'w'))
    info = json.load(open(meta))
    start = place(name, info['total'])
    for k in keys:
        say(k, start + info['starts'][k])
    return start, info


def black(name, seconds):
    out = SEG / f'{name}.mp4'
    if not done(out):
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', f'color=c=0x07080c:s=1920x1080:r={FPS}', '-t', str(seconds), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', str(out)], check=True)
    return place(name, seconds)


def build():
    # --- Cold open ---
    start, _ = talk('a1', 'close-golden', ['s1'], pre=.7, post=.4, fade_in=.7, z0=1.16, z1=1.26)
    still('a2', 'b-pen', .85, z0=1.06, z1=1.12, x0=-.01, x1=.01)
    still('a3', 'b-hands', .85, z0=1.03, z1=1.09)
    marks['montage_night'] = t_now
    still('a4', 'b-invoices', .8, z0=1.05, z1=1.1)
    still('a5', 'b-staff', .85, z0=1.04, z1=1.09)
    marks['night_talk'] = t_now
    talk('a6', 'close-night', ['s2'], pre=.35, post=.45, z0=1.2, z1=1.3, seed=21)
    s = still('a7', 'b-alone', 4.3, z0=1.02, z1=1.08, x0=.01, x1=-.01, flicker=.1)
    say('n1', s + .2)
    s = still('a8', 'b-dawn', 5.2, z0=1.03, z1=1.1, y0=.02, y1=-.01)
    say('n2', s + .2)
    tag(s + .1, s + 5.1, 'R12.4 billion in invoices older than 30 days,\\Nunpaid by South African government departments alone.\\N{\\fs24\\c&HC8C8C8&}National Treasury data, Q2 2025, via Engineering News, March 2026', 'Stat')
    s = still('a9', REPO_PLATE, 2.8, z0=1.0, z1=1.06)
    say('n3', s + .15)
    marks['title'] = t_now
    s = black('a10', 2.1)
    tag(s, s + 2.1, 'Parallax', 'Title')
    tag(s, s + 2.1, 'Step inside a big decision before you make it.', 'Sub')
    # --- The real app ---
    s = clip('b1', 'intake', 33, 88, 4.1)
    say('n4', s + .1)
    tag(s, s + 8, 'Real app, recorded live and sped up. Built during the hackathon.', 'Tag')
    s = clip('b2', 'intake', 157.8, 171.4, 4.6)
    say('n5', s + .1)
    tag(s + .1, s + 4.5, 'muse-spark-1.3 reads the story. Code checks every quote.', 'Tag2')
    s = clip('b3', 'intake', 171.5, 187.5, 5.5)
    say('n6', s + .1)
    s = clip('b4', 'intake', 187.8, 192.2, 2.7)
    say('n7', s + .05)
    # --- The room ---
    s = clip('c1', 'room', 6.3, 57.0, 6.8)
    say('n8', s + .1)
    tag(s + .1, s + 6.7, 'muse-image-1.0 painted it. sam-3.1 masks are the hit-test layer.', 'Tag')
    s = clip('c2', 'room', 57.2, 59.9, 2.7)
    say('s3', s + .5, caption=False, length=1.9)
    caps.append((s + .5, s + 2.5, 'Cap', 'I took the contract.'))
    s = still('c3', str(DIR / 'panel/mouths.jpg'), 6.0, z0=1.0, z1=1.05)
    say('n9', s + .05)
    # --- The lever ---
    s = lever('d1', 20.4, 54.0, 3.7)
    say('n10', s + .05)
    marks['lever_cut'] = t_now
    marks['lever'] = t_now + .15
    lever('d2', 54.0, 56.9, 2.9)
    s = lever('d3', 88, 91, 2.0, zoom=(285, 850, 2.3))
    tag(s, s + 2.0, 'The figure on the paper comes from the engine, never a model.', 'Tag')
    # --- The board ---
    marks['board'] = t_now
    node_hits = []
    s = lever('e1', 123.3, 132, 5.9, zoom=(1035, 470, 1.32))
    say('n13', s + .05)
    tag(s, s + 5.9, 'muse-wonder-1.0 conducts. muse-spark-1.3 specialists run in parallel.', 'Tag')
    node_hits += [s + 2.2, s + 4.4]
    s = lever('e2', 132, 138, 7.5, zoom=(1035, 520, 1.3))
    say('n14', s + .05)
    tag(s, s + 7.5, 'Tool calls run the real engine. Binary search finds the longest delay.', 'Tag')
    node_hits += [s + 6.3]
    s = lever('e3', 165, 169, 6.4, zoom=(1035, 600, 1.36))
    say('n15', s + .03)
    tag(s, s + 6.4, 'web_search, then code opens the page and looks for the figure.', 'Tag')
    node_hits += [s + 5]
    s = lever('e4', 141, 154, 8.2, zoom=(1035, 470, 1.32))
    say('n16', s + .02)
    tag(s, s + 8.2, 'muse-image-1.0 repaints. muse-spark-1.3 looks at the result.', 'Tag')
    node_hits += [s + 7.6]
    marks['node_hits'] = node_hits
    # --- Her words. The audio runs whole; the picture cuts to the app and back ---
    marks['s4'] = t_now
    info = dur('s4')
    total = .3 + info['duration'] + .4
    out = SEG / 'f_full.mp4'
    if not done(out):
        cine.talk(str(out), 'close-night', ['s4'], pre=.3, post=.4, z0=1.18, z1=1.34, seed=33)
    cut1, cut2 = 6.6, 12.2
    for name, a, b in (('f1', 0, cut1), ('f3', cut2, total)):
        o = SEG / f'{name}.mp4'
        if not done(o):
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(a), '-t', str(b - a), '-i', str(out), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-an', str(o)], check=True)
    s0 = place('f1', cut1)
    lever('f2', 165, 170.6, cut2 - cut1)
    tag(s0 + cut1, s0 + cut2, 'The same words, in the app. Every figure checked sentence by sentence.', 'Tag')
    place('f3', total - cut2)
    lines.append(('s4', s0 + .3, 0, info['duration']))
    caps.append((s0 + .3, s0 + .3 + info['duration'] * .44, 'Cap', 'In this future, I said yes to the corporate staff-lunch client, and bought the second fridge.'))
    caps.append((s0 + .3 + info['duration'] * .44, s0 + .3 + info['duration'] * .72, 'Cap', 'By month four, late payment left my cash at -R29,000.'))
    caps.append((s0 + .3 + info['duration'] * .72, s0 + .3 + info['duration'] + .1, 'Cap', 'I wish I had got the payment date in writing, before I said yes.'))
    tag(s0, s0 + 6, 'Written live by muse-wonder-1.0, from her story. Film close-up rendered from the same mouth edits.', 'Tag')
    marks['reveal'] = t_now
    s = lever('g1', 184, 204, 3.2)
    tag(s + .4, s + 3.1, 'The room behind her, repainted live. The Art Director passed it.', 'Tag')
    # --- The fix ---
    s = lever('h1', 206.6, 243.9, 4.7)
    say('n17', s + .05)
    marks['daylight'] = t_now + .9
    s = lever('h2', 243.9, 247.4, 3.0)
    say('n18', s + .05)
    tag(s + .3, s + 3.0, 'Lowest cash: -R29,000 to R7,000. From the engine.', 'Tag')
    lever('h3', 248, 270.5, 2.8)
    lever('h4', 298.7, 304.5, 2.4)
    # --- Any founder ---
    marks['any'] = t_now
    s = clip('i1', 'salon', 16, 131.5, 3.5)
    say('n19', s + .05)
    tag(s, s + 3.5, 'One paragraph. About a minute, live. Sped up here.', 'Tag')
    clip('i2', 'salon', 138.6, 148.2, 3.7)
    s = clip('i3', 'contract', 40, 110, 3.6)
    say('n20', s + .03)
    clip('i4', 'contract', CONTRACT_END - 7, CONTRACT_END - .2, 3.9)
    s = clip('i5', 'filmstudio', 59.4, 68.2, 3.0)
    say('n21', s + .02)
    # --- Proof ---
    s = still('j1', str(DIR / 'panel/eval-first.jpg'), 6.3, z0=1.0, z1=1.03)
    say('n22', s + .1)
    still('j2', str(DIR / 'panel/eval-now.jpg'), 6.6, z0=1.0, z1=1.03)
    s = still('j3', str(DIR / 'panel/meta.jpg'), 5.2, z0=1.0, z1=1.02)
    say('n23', s + .05)
    # --- The last words ---
    marks['end'] = t_now
    talk('k1', 'close-golden', ['s5', 's6'], pre=.35, post=.6, z0=1.24, z1=1.34, fade_out=.5, seed=44)
    s = black('k2', 3.7)
    tag(s, s + 3.7, 'Parallax', 'Title')
    tag(s, s + 3.7, 'One possible future, not a prediction.', 'Sub')
    tag(s + .2, s + 3.7, 'Fictional person. Images: Muse Image. Voices: synthetic, Microsoft en-ZA neural via edge-tts. Not financial advice.\\NTeam Sonar: Sibusiso Khumalo, Lethabo Masilo Hoaeane. Built during the hackathon. github.com/Sibusiso-K/Parallax', 'Foot')


ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Geist Film,40,&H00FFFFFF,&H00FFFFFF,&H80000000,&H64000000,0,0,0,0,100,100,0,0,1,2.2,1.6,2,260,260,62,1
Style: Tag,Geist Film,26,&H00FFFFFF,&H00FFFFFF,&H00141414,&H96141414,0,0,0,0,100,100,0,0,3,9,0,7,44,44,40,1
Style: Tag2,Geist Film,26,&H00FFFFFF,&H00FFFFFF,&H00141414,&H96141414,0,0,0,0,100,100,0,0,3,9,0,9,44,44,40,1
Style: Stat,Instrument Serif,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,0,2.4,5,180,180,0,1
Style: Title,Instrument Serif,176,&H00F4F0E8,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,-1,0,1,0,0,5,0,0,70,1
Style: Sub,Geist Film,38,&H00D8D4CC,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,0,0,420,1
Style: Foot,Geist Film,24,&H00A8A49C,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,120,120,66,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def stamp(t):
    t = max(0, t)
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'


def write_ass():
    rows = [ASS_HEAD]
    for a, b, style, text in sorted(caps):
        fade = {'Cap': '{\\fad(90,90)}', 'Tag': '{\\fad(220,220)}', 'Tag2': '{\\fad(220,220)}', 'Stat': '{\\fad(500,400)}', 'Title': '{\\fad(500,500)}', 'Sub': '{\\fad(800,500)}', 'Foot': '{\\fad(600,300)}'}[style]
        rows.append(f'Dialogue: 0,{stamp(a)},{stamp(b)},{style},,0,0,0,,{fade}{text}\n')
    (DIR / 'film.ass').write_text(''.join(rows), encoding='utf-8')


def read_mp3(key):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(AUDIO / f'{key}.mp3'), '-f', 'f32le', '-ac', '1', '-ar', str(score.SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def write_audio(total):
    t0 = time.time()
    voice = np.zeros(int((total + 3) * score.SR), np.float32)
    for key, at, offset, length in lines:
        a = read_mp3(key)[int(offset * score.SR):int((offset + length) * score.SR)]
        # A short fade so a trimmed line never clicks.
        f = min(len(a), int(.03 * score.SR))
        a[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
        i = int(at * score.SR)
        voice[i:i + len(a)] += a[:len(voice) - i]
    music = score.build(marks, total)
    n = min(len(voice), len(music))
    voice, music = voice[:n], music[:n]
    # Duck the score under the voice, with a soft release.
    win = int(.05 * score.SR)
    env = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, 'same'))
    env = np.clip(env / (np.percentile(env[env > 1e-4], 75) + 1e-6), 0, 1)
    rel = int(.45 * score.SR)
    held = np.convolve(env, np.ones(rel) / rel, 'same')
    gain = 1 - .62 * np.clip(np.maximum(env, held * 1.6), 0, 1)
    mix = music * gain[:, None] * .95 + np.stack([voice, voice], 1) * 1.15
    # Soft limit, then write.
    peak = np.abs(mix).max()
    mix = np.tanh(mix / max(peak, 1e-6) * 1.15) * .94
    (mix.astype(np.float32)).tofile(DIR / 'mix.f32')
    print('audio', round(time.time() - t0, 1), 's, peak was', round(float(peak), 3), flush=True)


def final(total):
    with open(DIR / 'concat.txt', 'w') as f:
        for path, seconds in timeline:
            f.write(f"file '{path.as_posix()}'\n")
    fonts = (DIR / 'fonts').as_posix().replace(':', '\\:')
    ass = (DIR / 'film.ass').as_posix().replace(':', '\\:')
    out = OUT / 'parallax-demo.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(DIR / 'concat.txt'), '-f', 'f32le', '-ar', str(score.SR), '-ac', '2', '-i', str(DIR / 'mix.f32'), '-filter_complex', f"[0:v]fps={FPS},ass='{ass}':fontsdir='{fonts}',format=yuv420p[v];[1:a]loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000[a]", '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(out)], check=True)
    print('wrote', out, round(out.stat().st_size / 1e6, 1), 'MB', flush=True)


if __name__ == '__main__':
    t0 = time.time()
    CONTRACT_END = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(RAW / 'contract.mp4')], capture_output=True, text=True).stdout.strip())
    build()
    total = t_now
    print('TOTAL', round(total, 2), 'seconds', flush=True)
    for k in ('montage_night', 'night_talk', 'title', 'lever', 'board', 's4', 'reveal', 'daylight', 'any', 'end'):
        print(k, round(marks[k], 2))
    write_ass()
    write_audio(total)
    final(total)
    print('took', round(time.time() - t0, 1))
