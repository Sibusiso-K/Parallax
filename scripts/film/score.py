"""The score: synthesised here, so there is nothing to license. Warm in gold, minor at night, resolving when the lights come back."""
import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
N = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(name):
    return 440.0 * 2 ** ((N[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)


class Score:
    def __init__(self, seconds, seed=11):
        self.n = int(seconds * SR)
        self.pad = np.zeros((self.n, 2), np.float32)
        self.keys = np.zeros((self.n, 2), np.float32)
        self.low = np.zeros((self.n, 2), np.float32)
        self.fx = np.zeros((self.n, 2), np.float32)
        self.rng = np.random.default_rng(seed)

    def _add(self, bus, t0, sig):
        i = int(t0 * SR)
        if i >= self.n:
            return
        j = min(self.n, i + len(sig))
        bus[i:j] += sig[:j - i].astype(np.float32)

    def chord(self, t0, dur, notes, amp=.1, bright=1.0, attack=1.4, release=1.8, bus=None):
        """A slow pad: slightly detuned partials, breathing a little."""
        m = int((dur + release) * SR)
        t = np.arange(m) / SR
        env = np.clip(t / attack, 0, 1) ** 1.6 * np.clip((dur + release - t) / release, 0, 1) ** 1.3
        env = env * (1 + .06 * np.sin(2 * np.pi * .13 * t + self.rng.uniform(0, 6)))
        out = np.zeros((m, 2), np.float32)
        for name in notes:
            f = hz(name)
            for h, a in ((1, 1), (2, .28 * bright), (3, .1 * bright), (4, .04 * bright)):
                for d, pan in ((-.0016, .3), (.0016, .7)):
                    ph = self.rng.uniform(0, 6.28)
                    s = np.sin(2 * np.pi * f * h * (1 + d) * t + ph) * a
                    out[:, 0] += (s * (1 - pan)).astype(np.float32)
                    out[:, 1] += (s * pan).astype(np.float32)
        out = out / max(1, len(notes)) * env[:, None].astype(np.float32) * amp
        self._add(bus if bus is not None else self.pad, t0, out)

    def piano(self, t0, name, vel=.5, pan=.5, decay=3.2):
        """Felt piano: inharmonic partials, a soft hammer, upper partials dying first."""
        f = hz(name)
        m = int(min(decay * 2.4, 7) * SR)
        t = np.arange(m) / SR
        s = np.zeros(m, np.float32)
        b = .00035
        for k, a in ((1, 1), (2, .42), (3, .2), (4, .1), (5, .05), (6, .025)):
            fk = f * k * np.sqrt(1 + b * k * k)
            if fk > 9000:
                continue
            s += (np.sin(2 * np.pi * fk * t) * a * np.exp(-t * (1 + k * .75) / decay * 1.5)).astype(np.float32)
        s *= np.clip(t / .007, 0, 1).astype(np.float32)
        thump = self.rng.normal(0, 1, m).astype(np.float32) * np.exp(-t * 90).astype(np.float32) * .05
        sos = butter(2, 900, 'lp', fs=SR, output='sos')
        s = s + sosfilt(sos, thump).astype(np.float32)
        s *= vel * .22
        self._add(self.keys, t0, np.stack([s * (1 - pan), s * pan], 1))

    def drone(self, t0, dur, name, amp=.1, pulse=0.0):
        m = int((dur + 2) * SR)
        t = np.arange(m) / SR
        f = hz(name)
        env = np.clip(t / 1.5, 0, 1) * np.clip((dur + 2 - t) / 2, 0, 1)
        if pulse:
            env = env * (.62 + .38 * np.sin(2 * np.pi * pulse * t) ** 2)
        s = (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.002 * t) + .12 * np.sin(2 * np.pi * f * 3.003 * t)) * env * amp
        self._add(self.low, t0, np.stack([s, s], 1).astype(np.float32))

    def sub_hit(self, t0, amp=.55, f0=74, f1=34, dur=2.4):
        m = int(dur * SR)
        t = np.arange(m) / SR
        ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t * 7)) / SR
        s = np.sin(ph) * np.exp(-t * 2.3) * amp
        noise = self.rng.normal(0, 1, m) * np.exp(-t * 34) * .12
        s = s + sosfilt(butter(2, 400, 'lp', fs=SR, output='sos'), noise)
        self._add(self.fx, t0, np.stack([s, s], 1).astype(np.float32))

    def riser(self, t0, dur, amp=.1):
        m = int(dur * SR)
        t = np.arange(m) / SR
        k = t / dur
        noise = self.rng.normal(0, 1, (m, 2))
        out = np.zeros((m, 2))
        for c in range(2):
            out[:, c] = sosfilt(butter(2, [500, 7000], 'bp', fs=SR, output='sos'), noise[:, c])
        out *= (k ** 2.6)[:, None] * amp
        self._add(self.fx, t0, out.astype(np.float32))

    def tick(self, t0, vel=.05):
        m = int(.09 * SR)
        t = np.arange(m) / SR
        s = np.sin(2 * np.pi * 1850 * t) * np.exp(-t * 95) * vel
        self._add(self.fx, t0, np.stack([s, s], 1).astype(np.float32))

    def mix(self):
        ir_len = int(2.8 * SR)
        t = np.arange(ir_len) / SR
        ir = np.stack([self.rng.normal(0, 1, ir_len) * np.exp(-t * 2.3), self.rng.normal(0, 1, ir_len) * np.exp(-t * 2.3)], 1)
        sos = butter(2, 3800, 'lp', fs=SR, output='sos')
        ir = sosfilt(sos, ir, axis=0)
        ir /= np.sqrt((ir ** 2).sum(0))
        dry = self.pad + self.keys * .95 + self.low * .9
        wet = np.stack([fftconvolve(dry[:, c], ir[:, c])[:self.n] for c in range(2)], 1)
        return (dry * .72 + wet * .55 + self.fx).astype(np.float32)


GOLD = ['D2', 'A2', 'D3', 'F#3', 'A3', 'C#4', 'E4']
NIGHT = ['Bb1', 'F2', 'D3', 'F3', 'A3', 'C4']
DM = ['D2', 'A2', 'D3', 'F3', 'A3']
TITLE = ['D2', 'A2', 'D3', 'A3', 'D4', 'E4']
CYCLE = [(['D2', 'A2', 'F#3', 'A3', 'D4'], ['D4', 'F#4', 'A4', 'E4']), (['B1', 'F#2', 'D3', 'F#3', 'B3'], ['B3', 'D4', 'F#4', 'D4']), (['G1', 'D2', 'B2', 'D3', 'G3', 'B3'], ['G3', 'B3', 'D4', 'B3']), (['A1', 'E2', 'C#3', 'E3', 'A3'], ['A3', 'C#4', 'E4', 'C#4'])]


def build(c, total):
    """c: the cue times from the edit."""
    s = Score(total + 3)
    # Gold: the promise.
    s.chord(0, c['montage_night'] - 0, GOLD, amp=.13, bright=1.1)
    for t, n, v in ((.9, 'A4', .34), (2.5, 'F#4', .3), (4.2, 'E4', .34), (5.0, 'A4', .38), (5.5, 'D5', .4)):
        s.piano(t, n, v, .55)
    # Night: the hit, then the minor.
    s.sub_hit(c['montage_night'], .62)
    s.chord(c['montage_night'], c['title'] - c['montage_night'] - .6, NIGHT, amp=.12, bright=.5, attack=.3)
    s.drone(c['montage_night'], c['title'] - c['montage_night'], 'D1', .12, pulse=.45)
    s.piano(c['night_talk'] + 4.4, 'A3', .28, .4, 5)
    s.piano(c['night_talk'] + 6.8, 'F3', .25, .4, 5)
    s.piano(c['night_talk'] + 9.2, 'D3', .25, .4, 5)
    # The title lifts.
    s.riser(c['title'] - 2.2, 2.2, .07)
    s.sub_hit(c['title'], .4, 60, 36)
    s.chord(c['title'], 3.2, TITLE, amp=.17, bright=1.2, attack=.25, release=2.2)
    s.piano(c['title'], 'D5', .45, .5, 5)
    s.piano(c['title'] + .02, 'A4', .4, .5, 5)
    # The app: patient, curious, moving.
    def run(t0, t1, level=1.0, beat=.5):
        t = t0
        i = 0
        while t < t1 - .4:
            notes, arp = CYCLE[i % 4]
            bar = beat * 8
            s.chord(t, min(bar, t1 - t), notes, amp=.085 * level, bright=.8, attack=.8, release=1.5)
            for j in range(8):
                when = t + j * beat
                if when < t1 - .2:
                    s.piano(when, arp[j % 4], (.17 + .04 * (j % 4 == 0)) * level, .35 + .3 * (j % 2), 2.2)
            t += bar
            i += 1
    run(c['title'] + 2.4, c['lever_cut'], 1.0)
    # The lever: everything drops out.
    s.sub_hit(c['lever'], .8, 86, 30, 3)
    s.chord(c['lever'], c['s4'] - c['lever'] + 1, DM, amp=.1, bright=.45, attack=.15)
    s.drone(c['lever'], c['s4'] - c['lever'] + 1, 'D1', .14, pulse=.8)
    # The swarm at work: quiet ticks that quicken as the agents report.
    t = c['board']
    gap = .62
    while t < c['s4'] - .6:
        s.tick(t, .05)
        t += gap
        gap = max(.26, gap * .985)
    for k in c['node_hits']:
        s.piano(k, 'D5', .22, .62, 2.4)
        s.piano(k + .09, 'A4', .18, .4, 2.4)
    # Her words: almost nothing under them.
    s.chord(c['s4'], c['reveal'] - c['s4'], ['D2', 'A2', 'F3'], amp=.06, bright=.3, attack=1.5)
    s.piano(c['s4'] + 11.2, 'F4', .16, .5, 6)
    s.riser(c['reveal'] - 1.4, 1.4, .05)
    s.sub_hit(c['reveal'], .36, 55, 32)
    s.chord(c['reveal'], c['daylight'] - c['reveal'], NIGHT, amp=.08, bright=.35, attack=.5)
    # Daylight: the resolve.
    s.riser(c['daylight'] - 1.8, 1.8, .06)
    s.chord(c['daylight'], c['any'] - c['daylight'], GOLD, amp=.17, bright=1.25, attack=.3, release=2.5)
    for i, n in enumerate(['D4', 'A4', 'D5', 'E5', 'F#5', 'A5']):
        s.piano(c['daylight'] + i * .24, n, .42 - i * .03, .35 + i * .06, 4.5)
    # Any founder, and the proof: confident, a little quicker.
    run(c['any'], c['end'] - .3, 1.15, .44)
    # Her last words: one chord, then air.
    s.piano(c['end'] + .1, 'D3', .42, .42, 9)
    s.piano(c['end'] + .12, 'A3', .36, .48, 9)
    s.piano(c['end'] + .14, 'F#4', .34, .55, 9)
    s.piano(c['end'] + 3.6, 'E5', .24, .6, 7)
    s.chord(c['end'], total - c['end'], ['D2', 'A2', 'D3'], amp=.05, bright=.3, attack=2)
    return s.mix()
