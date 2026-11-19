"""Original electro-cinematic score for the Kraków film, synthesised from scratch with numpy.
Locked to src/timeline.js (impacts, whooshes, sections) so picture and sound hit together.
Usage: python3 tools/music.py timeline.json out.wav
"""
import json, sys, math
import numpy as np

SR = 44100
TL = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
DUR = TL['DURATION'] + 0.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
SEC = TL['SECTIONS']

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR

def add(sig, t0, gain=1.0, pan=0.0, sigR=None):
    i0 = int(round(t0 * SR))
    if i0 >= N: return
    a = sig if sigR is None else sig
    b = sig if sigR is None else sigR
    if i0 < 0: a = a[-i0:]; b = b[-i0:]; i0 = 0
    n = min(len(a), N - i0)
    gl = gain * math.cos((pan + 1) * math.pi / 4) * 1.414
    gr = gain * math.sin((pan + 1) * math.pi / 4) * 1.414
    L[i0:i0 + n] += a[:n] * gl; R[i0:i0 + n] += b[:n] * gr

def fft_filter(x, fn):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * fn(f), len(x))
lp = lambda fc, o=2: (lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * o)))
hp = lambda fc, o=2: (lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * o)))
bp = lambda lo, hi: (lambda f: lp(hi)(f) * hp(lo)(f))

def stft_sweep(x, cutoff_fn, kind='lp', q=2):
    """Time-varying filter by overlap-add STFT. cutoff_fn(t_sec)->Hz"""
    n = 2048; hop = 512; win = np.hanning(n)
    out = np.zeros(len(x) + n); norm = np.zeros(len(x) + n)
    f = np.fft.rfftfreq(n, 1 / SR)
    xp = np.concatenate([x, np.zeros(n)])
    for s in range(0, len(x), hop):
        seg = xp[s:s + n] * win
        fc = cutoff_fn(s / SR)
        if kind == 'lp': g = lp(fc, q)(f)
        elif kind == 'hp': g = hp(fc, q)(f)
        else: g = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / 0.6) ** 2)
        out[s:s + n] += np.fft.irfft(np.fft.rfft(seg) * g, n) * win
        norm[s:s + n] += win ** 2
    return (out / np.maximum(norm, 1e-6))[:len(x)]

def saw(f, t, phase=0.0): return 2 * ((f * t + phase) % 1.0) - 1
def env_ad(n_or_t, a, d):
    t = n_or_t
    return np.minimum(t / max(a, 1e-4), 1) * np.exp(-np.maximum(t - a, 0) / d)

# ---------------- instruments ----------------
def kick(big=1.0):
    t = tt(0.45)
    f = 45 + 110 * np.exp(-t * 35) * big
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5) + 0.25 * np.exp(-t * 220) * rng.standard_normal(len(t))
    return np.tanh(s * 1.6 * big)

def clap():
    t = tt(0.35); n = rng.standard_normal(len(t))
    e = sum(np.exp(-np.maximum(t - d, 0) * 45) * (t >= d) for d in (0, 0.011, 0.023)) + 0.6 * np.exp(-t * 12)
    return fft_filter(n, bp(900, 3500)) * e * 0.9

def snare():
    t = tt(0.3); n = rng.standard_normal(len(t))
    return fft_filter(n, bp(1500, 8000)) * np.exp(-t * 18) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.5

def hat(open_=False):
    t = tt(0.35 if open_ else 0.08); n = rng.standard_normal(len(t))
    return fft_filter(n, hp(7500, 3)) * np.exp(-t * (9 if open_ else 55)) * 0.55

def shaker():
    t = tt(0.12); n = rng.standard_normal(len(t))
    return fft_filter(n, bp(5000, 11000)) * env_ad(t, 0.03, 0.03) * 0.4

def boom(k=1.0, dur=2.2):
    t = tt(dur)
    f = 28 + 70 * np.exp(-t * 3.5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    noise = fft_filter(rng.standard_normal(len(t)), lp(900)) * np.exp(-t * 6) * 0.8
    hit = fft_filter(rng.standard_normal(len(t)), bp(80, 2500)) * np.exp(-t * 22) * 1.2
    return np.tanh((s * 1.3 + noise + hit) * 1.5 * k) * k

def crash(dur=2.5):
    t = tt(dur); n = rng.standard_normal(len(t))
    metal = sum(np.sin(2 * np.pi * f * t + rng.random() * 6) for f in (3120, 4370, 5230, 6890, 8110, 9470)) * 0.08
    return (fft_filter(n, hp(4500, 2)) * 0.6 + metal) * np.exp(-t * 1.8)

def taiko(f0=70):
    t = tt(1.0)
    f = f0 * (1 + 0.6 * np.exp(-t * 25))
    return np.tanh((np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) + fft_filter(rng.standard_normal(len(t)), lp(500)) * np.exp(-t * 30) * 0.6) * 2)

def whoosh(d, up=True):
    t = tt(d); n = rng.standard_normal(len(t))
    u = t / d
    fc_fn = (lambda s: 150 * (40 ** min(s / d, 1))) if up else (lambda s: 6000 * (0.03 ** min(s / d, 1)))
    s = stft_sweep(n, fc_fn, kind='bp')
    e = (u ** 2.2) * (1 - np.clip((u - 0.92) / 0.08, 0, 1))
    return s * e

def riser(d, f0=110, f1=880):
    t = tt(d); u = t / d
    f = f0 * (f1 / f0) ** (u ** 1.6)
    ph = np.cumsum(f) / SR
    s = sum(saw(f * r, t, 0) for r in (1, 1.006, 0.994)) / 3
    s = stft_sweep(s, lambda x: 300 + 9000 * (x / d) ** 2)
    n = stft_sweep(rng.standard_normal(len(t)), lambda x: 400 + 12000 * (x / d) ** 2.5, 'hp')
    return (s * 0.5 + n * 0.35) * u ** 2

def pluck(m, d=0.35, bright=1.0):
    t = tt(d); f = mtof(m); s = np.zeros(len(t))
    for h in range(1, 14):
        if f * h > 16000: break
        s += np.sin(2 * np.pi * f * h * t) / h * np.exp(-t * (4 + h * 2.2 / bright))
    return s * env_ad(t, 0.002, 10) * 0.6

def bell(m, d=2.5):
    t = tt(d); f = mtof(m)
    idx = 3.0 * np.exp(-t * 2.5)
    return np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t * 1.6) * 0.5

def piano(m, d=2.0):
    t = tt(d); f = mtof(m); s = np.zeros(len(t))
    for h in range(1, 10):
        fh = f * h * math.sqrt(1 + 0.0004 * h * h)
        s += np.sin(2 * np.pi * fh * t) * (0.8 ** h) * np.exp(-t * (1.2 + h * 0.6))
    return s * env_ad(t, 0.003, 10) * 0.55

def supersaw(ms, d, cutoff=4000, voices=7, det=0.012, attack=0.02, release=0.3):
    t = tt(d)
    sl = np.zeros(len(t)); sr = np.zeros(len(t))
    for m in ms:
        f = mtof(m)
        for v in range(voices):
            dd = (v - (voices - 1) / 2) / ((voices - 1) / 2) * det
            s = saw(f * (1 + dd), t, rng.random())
            if v % 2: sl += s
            else: sr += s
    e = np.minimum(t / attack, 1) * np.clip((d - t) / release, 0, 1)
    k = 1 / (voices * len(ms)) * 2.2
    return fft_filter(sl, lp(cutoff)) * e * k, fft_filter(sr, lp(cutoff)) * e * k

def bass_note(m, d, cutoff=900, sub=0.6):
    t = tt(d); f = mtof(m)
    s = saw(f, t) * 0.6 + np.sin(2 * np.pi * f * t) * sub + (np.sign(np.sin(2 * np.pi * f * 0.5 * t)) * 0.0)
    e = env_ad(t, 0.004, d * 0.9) * np.clip((d - t) / 0.02, 0, 1)
    return fft_filter(s, lp(cutoff)) * e

def choir(ms, d):
    t = tt(d); s = np.zeros(len(t))
    for m in ms:
        for v in range(4): s += saw(mtof(m) * (1 + (v - 1.5) * 0.004), t, rng.random())
    s = fft_filter(s, lambda f: (np.exp(-0.5 * ((f - 700) / 200) ** 2) + 0.8 * np.exp(-0.5 * ((f - 1150) / 250) ** 2) + 0.4 * np.exp(-0.5 * ((f - 2600) / 400) ** 2)))
    e = np.minimum(t / 0.8, 1) * np.clip((d - t) / 0.8, 0, 1)
    return s * e * 0.12 / len(ms)

def reverb_ir(d=2.8, seed=1, damp=4000):
    r = np.random.default_rng(seed); t = tt(d)
    ir = r.standard_normal(len(t)) * np.exp(-t * 6.9 / d)
    return fft_filter(ir, lp(damp)) * 0.08

def convolve(x, ir):
    n = len(x) + len(ir)
    nf = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(ir, nf), nf)[:len(x)]

# ---------------- arrangement ----------------
CH = {
    'Am': ([57, 60, 64, 69], 45), 'F': ([53, 57, 60, 65], 41), 'C': ([55, 60, 64, 67], 48), 'G': ([55, 59, 62, 67], 43),
    'Dm': ([57, 62, 65, 69], 50), 'E': ([56, 59, 64, 68], 40), 'Em': ([55, 59, 64, 67], 40),
}
BEAT = 0.5
music_L = np.zeros(N); music_R = np.zeros(N)  # sidechained bus (pads/bass)
kicks = []

def add_bus(sig, t0, gain=1.0, pan=0.0, sigR=None):
    global L, R
    sL, sR = L, R
    L, R = music_L, music_R
    add(sig, t0, gain, pan, sigR)
    L, R = sL, sR

def pad_seq(chords, t0, step, gain=0.35, cutoff=2600, octave=0, bus=True):
    for i, c in enumerate(chords):
        ms = [m + octave for m in CH[c][0]]
        a, b = supersaw(ms, step + 0.35, cutoff=cutoff, attack=0.08, release=0.35)
        (add_bus if bus else add)(a, t0 + i * step, gain, 0, b)

def bass_seq(chords, t0, step, gain=0.5, pattern='8ths', cutoff=800):
    for i, c in enumerate(chords):
        root = CH[c][1]
        cs = t0 + i * step
        if pattern == '8ths':
            for k in range(int(step / 0.25)):
                if k % 2 == 0: continue
                add_bus(bass_note(root + (12 if k % 4 == 3 else 0), 0.22, cutoff), cs + k * 0.25, gain)
        elif pattern == '16ths':
            for k in range(int(step / 0.125)):
                add_bus(bass_note(root + (12 if k % 8 in (3, 6) else 0), 0.11, cutoff), cs + k * 0.125, gain * (1.0 if k % 2 == 0 else 0.7))
        elif pattern == 'funk':
            for k, (off, dd, o) in enumerate([(0, 0.2, 0), (0.375, 0.1, 12), (0.75, 0.2, 7), (1.25, 0.1, 0), (1.5, 0.3, 10)]):
                if off < step: add_bus(bass_note(root + o, dd, 1200), cs + off, gain)
        elif pattern == 'long':
            add_bus(bass_note(root, step, cutoff, 0.9), cs, gain)

def drums(t0, t1, kick_g=1.0, clap_g=0.5, hat_g=0.25, open_g=0.18, sixteenth=False, half=False):
    t = t0
    i = 0
    while t < t1 - 1e-6:
        beat = i % 4
        if not half or beat in (0, 2):
            add(kick(), t, kick_g); kicks.append(t)
        if (beat in (1, 3) and not half) or (half and beat == 2): add(clap(), t, clap_g, 0.05)
        add(hat(), t + 0.25, hat_g, 0.3); add(hat(True), t + 0.25, open_g * (1 if beat % 2 else 0.5), -0.25)
        if sixteenth:
            add(hat(), t + 0.125, hat_g * 0.5, 0.35); add(hat(), t + 0.375, hat_g * 0.5, 0.35)
        t += BEAT; i += 1

def arp(notes, t0, t1, step=0.125, gain=0.18, inst=pluck, pan_sway=0.4, oct_up=12):
    t = t0; i = 0
    while t < t1 - 1e-6:
        m = notes(t)[i % len(notes(t))] + (oct_up if (i // len(notes(t))) % 2 else 0)
        add(inst(m), t, gain, pan_sway * math.sin(i * 0.9))
        t += step; i += 1

def chord_at(prog, t0, step):
    def f(t):
        k = min(int((t - t0) // step), len(prog) - 1)
        return CH[prog[max(k, 0)]][0]
    return f

# 1. INTRO (0-5.05): space drone, heartbeat, riser into the dive
t = tt(5.3)
drone = np.sin(2 * np.pi * 55 * t) * 0.5 + np.sin(2 * np.pi * 82.4 * t) * 0.18
drone *= np.minimum(t / 1.5, 1) * 0.6
add(drone, 0, 0.55)
a, b = supersaw([57, 64, 71, 76], 5.3, cutoff=1400, attack=1.5, release=0.6, det=0.008)
add(a, 0, 0.22, 0, b)
for i, tb in enumerate([0.5, 1.5, 2.5, 3.2, 3.8, 4.3]): add(taiko(55), tb, 0.35 + i * 0.07)
add(riser(2.0, 90, 1200), 3.05, 0.5)
for b2 in [57 + 12, 64 + 12, 71 + 12, 76]: add(bell(b2, 3.0), 0.2 + (b2 % 5) * 0.25, 0.08, 0.3)

# 2. ERUPTION (5.05-8.5)
for im in TL['IMPACTS']:
    tm, k = im['t'], im['k']
    if SEC['memorial'][0] <= tm < SEC['memorial'][1]: continue
    add(boom(k, 2.0 if k > 0.75 else 1.4), tm, 0.85 * k)
    if k >= 0.6: add(crash(2.2 if k > 0.8 else 1.4), tm, 0.35 * k, 0.15)
    add(taiko(65), tm, 0.35 * k, -0.1)
pad_seq(['Am', 'Am'], 5.05, 1.725, gain=0.4, cutoff=3500)
for k in range(12): add(bass_note(33, 0.11, 600), 6.5 + k * 0.125, 0.5)
for k in range(8): add(bass_note(33 + (k % 2) * 12, 0.12, 900), 7.5 + k * 0.125, 0.55)
for k in range(16): add(snare(), 7.5 + k * (0.0625 if k > 7 else 0.125) * (1 if k <= 7 else 1), 0.15 + k * 0.02)
add(riser(1.4, 220, 1760), 7.1, 0.45)

# 3. OLD TOWN (8.5-20)
OT = ['Am', 'F', 'C', 'G', 'Am', 'F']
drums(8.5, 20.0, sixteenth=False)
pad_seq(OT, 8.5, 2.0, gain=0.3, cutoff=2400)
bass_seq(OT, 8.5, 2.0, gain=0.5, pattern='8ths')
arp(chord_at(OT, 8.5, 2.0), 9.5, 20.0, 0.125, 0.12)
add(riser(1.8, 160, 1300), 16.2, 0.35)

# 4. KAZIMIERZ (20-30): evening groove, warmer
KZ = ['Dm', 'Am', 'F', 'E', 'Dm']
drums(20.0, 30.0, kick_g=0.9, clap_g=0.4, hat_g=0.18, open_g=0.12, half=False)
for k in range(int(10 / 0.25)): add(shaker(), 20 + k * 0.25, 0.5 if k % 2 else 0.3, 0.4)
pad_seq(KZ, 20.0, 2.0, gain=0.24, cutoff=1500, octave=0)
bass_seq(KZ, 20.0, 2.0, gain=0.55, pattern='funk')
for i, c in enumerate(KZ):
    for k, off in enumerate([0.0, 0.75, 1.25]):
        for m in CH[c][0][:3]: add(piano(m + 12, 1.2), 20 + i * 2 + off, 0.09, -0.2 + k * 0.2)
add(riser(1.2, 200, 1600), 28.6, 0.35)

# 5. EXPERIENCES (30-43): driving
EX = ['Am', 'F', 'C', 'G', 'Am', 'F', 'E']
drums(30.0, 42.75, kick_g=1.0, clap_g=0.5, hat_g=0.25, open_g=0.16, sixteenth=True)
pad_seq(EX, 30.0, 2.0, gain=0.3, cutoff=3200, octave=12)
bass_seq(EX, 30.0, 2.0, gain=0.5, pattern='16ths', cutoff=900)
arp(chord_at(EX, 30.0, 2.0), 30.0, 42.75, 0.125, 0.13, inst=lambda m: pluck(m, 0.3, 1.6))
for tb in TL['TABLEAUX'][1:]: add(snare(), tb - 0.25, 0.25); add(snare(), tb - 0.125, 0.3)

# 6. WIELICZKA (43-49.2): crystalline cavern
w0, w1 = SEC['wieliczka']
add_bus(choir([57, 64, 69, 72], w1 - w0 + 0.6), w0, 1.0)
for i, tb in enumerate(np.arange(w0, w1 - 0.2, 0.25)):
    m = [69, 72, 76, 79, 81, 84, 81, 76][i % 8]
    add(bell(m, 2.0), tb, 0.12, math.sin(i) * 0.6)
for tb in np.arange(w0, w1, 1.0): add(taiko(50), tb, 0.45); kicks.append(tb)
add_bus(bass_note(33, w1 - w0, 300, 1.0), w0, 0.5)
add(riser(1.5, 300, 2400), 45.6, 0.18)
t = tt(3); add(sum(np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t * 1.2) for f in (2093, 2637, 3136, 4186)) * 0.08, 47.0, 1.0, 0.2)

# 7. MEMORIAL (49.2-55.2): silence and a few solemn notes
m0, m1 = SEC['memorial']
a, b = supersaw([45, 52, 57], m1 - m0 + 0.5, cutoff=700, attack=1.5, release=1.8, det=0.006)
add(a, m0, 0.22, 0, b)
for tb, m in [(49.8, 69), (51.0, 64), (52.2, 72), (53.4, 71), (54.2, 69)]: add(piano(m, 3.0), tb, 0.14, 0.1)

# 8. MARCH (55.2-65.5): from fragile to bright
MA = ['C', 'G', 'Am', 'F', 'C']
ma0 = 55.5
arp(chord_at(MA, ma0, 2.0), ma0, 65.25, 0.25, 0.12, inst=lambda m: piano(m + 12, 1.2), oct_up=0)
pad_seq(MA, ma0, 2.0, gain=0.22, cutoff=1800)
for k in range(8): add(hat(), 59.5 + k * 0.5 + 0.25, 0.15, 0.3)
drums(61.5, 65.0, kick_g=0.85, clap_g=0.4, hat_g=0.2, open_g=0.12, sixteenth=True)
bass_seq(['Am', 'F'], 61.5, 2.0, gain=0.45, pattern='8ths')
add(riser(2.4, 140, 2200), 63.0, 0.5)
for k in range(24): add(snare(), 63.5 + (k * 0.0625 if k < 16 else 1.0 + (k - 16) * 0.05), 0.1 + k * 0.015)

# 9. FINALE (65.5-75)
FI = ['F', 'G', 'Am', 'G']
drums(65.5, 72.0, kick_g=1.15, clap_g=0.55, hat_g=0.25, open_g=0.18, sixteenth=True)
pad_seq(FI, 65.5, [2.0, 2.0, 1.0, 1.5][0], gain=0.36, cutoff=5200, octave=12)
for i, (c, st, d) in enumerate([('F', 65.5, 2.0), ('G', 67.5, 1.0), ('G', 68.5, 1.0), ('Am', 69.5, 1.0), ('F', 70.5, 0.75), ('G', 71.25, 0.75)]):
    a, b = supersaw([m + 12 for m in CH[c][0]], d + 0.2, cutoff=6000, attack=0.01, release=0.2); add_bus(a, st, 0.32, 0, b)
    bass_seq([c], st, d, gain=0.55, pattern='16ths', cutoff=1100)
arp(chord_at(['F', 'F', 'G', 'G', 'Am', 'Am', 'F', 'G'], 65.5, 0.85), 65.5, 72.0, 0.125, 0.12, inst=lambda m: pluck(m + 12, 0.3, 2.0))
# final chord: huge C major, long tail
a, b = supersaw([48, 55, 60, 64, 67, 72, 76], 3.2, cutoff=5000, attack=0.01, release=2.6)
add(a, 72.0, 0.55, 0, b)
add(bass_note(36, 3.0, 400, 1.0), 72.0, 0.7)
add(boom(1.0, 3.0), 72.0, 0.9)
for m in (84, 88, 91, 96): add(bell(m, 3.0), 72.0 + (m % 7) * 0.05, 0.12, (m % 3 - 1) * 0.5)

# whooshes
for (a0, a1) in TL['WHOOSHES']:
    if SEC['memorial'][0] <= a0 < SEC['memorial'][1]: continue
    w = whoosh(a1 - a0)
    add(w, a0, 0.5, -0.6, np.roll(w, 300))

# ---------------- mixdown ----------------
# sidechain the bus to the kicks
sc = np.ones(N)
for kt in kicks:
    i0 = int(kt * SR); n = int(0.28 * SR)
    if i0 >= N: continue
    seg = 1 - 0.65 * np.exp(-np.arange(min(n, N - i0)) / SR / 0.09)
    sc[i0:i0 + len(seg)] = np.minimum(sc[i0:i0 + len(seg)], seg)
L += music_L * sc; R += music_R * sc
# memorial: duck everything that leaked in, keep it hushed
tline = np.arange(N) / SR
quiet = 1 - 0.55 * (np.clip((tline - 49.3) / 0.6, 0, 1) * (1 - np.clip((tline - 55.0) / 0.6, 0, 1)))
L *= quiet; R *= quiet
# reverb send
irL, irR = reverb_ir(2.6, 1), reverb_ir(2.6, 2)
wet_amt = 0.35 + 0.5 * np.exp(-0.5 * ((tline - 46.5) / 2.0) ** 2) + 0.4 * np.exp(-0.5 * ((tline - 52) / 2.5) ** 2) + 0.3 * np.clip((tline - 72) / 1, 0, 1)
L = L + convolve(L, irL) * wet_amt; R = R + convolve(R, irR) * wet_amt
# master: highpass rumble, gentle glue, fade-in/out, limiter
L = fft_filter(L, hp(28, 2)); R = fft_filter(R, hp(28, 2))
fade = np.clip(tline / 0.25, 0, 1) * np.clip((DUR - tline) / 0.8, 0, 1)
L *= fade; R *= fade
peak = np.percentile(np.abs(np.concatenate([L, R])), 99.7)
L /= peak; R /= peak
L = np.tanh(L * 1.1) * 0.89; R = np.tanh(R * 1.1) * 0.89
st = (np.stack([L, R], 1) * 32767).astype(np.int16)
import wave
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
print('wrote', OUT, f'{DUR}s')
