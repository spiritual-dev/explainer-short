# Builds the edit from the source take: reordered segments -> cut points snapped to quiet ->
# long interior pauses tightened -> src/edl.json, out/voice.wav (cleaned), frames/ (graded speaker crops).
# Run from the project folder: python3 src/edit.py [--frames]
# Needs: python3, ffmpeg, numpy, soundfile
# Needs src/transcript.json (word timings of the whole take, from src/transcribe.py) and src/edit.json.
import json, os, subprocess, sys
import numpy as np, soundfile as sf

# Per-film settings live in src/edit.json (see SKILL.md, step 4):
#   {"src": "your-project-folder",
#    "segs": [[start, end, "label"], ...],        # source seconds, in the FILM's order (reorders are allowed)
#    "crop": "crop=1152:1024:404:28",             # 1152x1024 window around the face (1080x960 panel at 0.9375, or its 1:1 centre)
#    "grade": "<ffmpeg filters>", "voice_fx": "<ffmpeg filters>"}   # optional; defaults below
CFG = json.load(open('src/edit.json'))
SRC = os.path.expanduser(CFG['src'])
FPS = CFG.get('fps', 30)
SEGS = [tuple(x) for x in CFG['segs']]
CROP = CFG.get('crop', 'crop=1152:1024:404:28')
GRADE = CFG.get('grade', 'hqdn3d=1.2:1.2:2:2,colorbalance=rs=-0.035:bs=0.04:rm=-0.025:bm=0.025:rh=-0.02:bh=0.02,'
                         'eq=contrast=1.05:saturation=1.03:gamma=0.98,cas=0.35')
VOICE_FX = CFG.get('voice_fx', 'highpass=f=75,afftdn=nr=12:nf=-47:tn=1,equalizer=f=220:t=q:w=1.2:g=-1.5,'
                               'equalizer=f=3200:t=q:w=1.0:g=2,acompressor=threshold=-24dB:ratio=3:attack=8:release=120:makeup=4,'
                               'deesser=i=0.35')

os.makedirs('out', exist_ok=True); os.makedirs('frames', exist_ok=True)
if not os.path.exists('src/audio48k.wav'):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-vn', '-ac', '1', '-ar', '48000', 'src/audio48k.wav'], check=True)
x, sr = sf.read('src/audio48k.wav')
hop = int(0.01 * sr)
rms = np.sqrt(np.convolve(x ** 2, np.ones(int(0.03 * sr)) / int(0.03 * sr), 'same')[::hop])

def quietest(t, win=0.12):
    a, b = int((t - win) / 0.01), int((t + win) / 0.01)
    return (a + int(np.argmin(rms[a:b]))) * 0.01

floor = np.percentile(rms, 10)
thr = floor * 2.4
# Pauses: quiet runs over 0.36 s are tightened to ~0.24 s, except where they overlap a short transcribed word
# (Whisper stretches word boxes across pauses, so only words under 0.6 s count as real speech to protect)
words = [w for s in json.load(open('src/transcript.json')) for w in s['words']]
protect = [(w['t0'] - 0.04, w['t1'] + 0.04) for w in words if w['t1'] - w['t0'] < 0.6]
quiet = rms < thr
pieces = []
for s, e, lab in SEGS:
    s, e = quietest(s, 0.1), quietest(e, 0.08)
    a, b = int(s / 0.01), int(e / 0.01)
    runs, i = [], a
    while i < b:
        if quiet[i]:
            j = i
            while j < b and quiet[j]: j += 1
            if i > a and j < b: runs.append((i * 0.01, j * 0.01))
            i = j
        else: i += 1
    cur = s
    for r0, r1 in runs:
        for p0, p1 in protect:                       # trim the run back off any protected word it touches
            if p0 < r1 and p1 > r0:
                if p0 <= r0: r0 = max(r0, p1)
                else: r1 = min(r1, p0)
        if r1 - r0 > 0.36:
            pieces.append([cur, r0 + 0.12, lab]); cur = r1 - 0.12
    pieces.append([cur, e, lab])

fr = lambda v: round(v * FPS) / FPS          # snap to the source frame grid: picture and sound stay locked
edl, t = [], 0.0
for a, b, lab in pieces:
    a, b = fr(a), fr(b)
    if b - a < 2 / FPS: continue
    edl.append({'src': round(a, 4), 'dur': round(b - a, 4), 't': round(t, 4), 'seg': lab}); t += b - a
json.dump({'pieces': edl, 'dur': round(t, 4), 'fps': FPS}, open('src/edl.json', 'w'), indent=1)
print(len(edl), 'pieces, total', round(t, 2), 's')

# Voice: cut with 6 ms fades at every join (no clicks), then clean
fade = int(0.006 * sr); out = []
for p in edl:
    seg = x[int(p['src'] * sr): int(p['src'] * sr) + int(round(p['dur'] * sr))].copy()
    seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
    out.append(seg)
sf.write('src/voice_raw.wav', np.concatenate(out), sr)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'src/voice_raw.wav', '-af', VOICE_FX, '-ar', '48000', 'out/voice.wav'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'out/voice.wav', '-ac', '1', '-ar', '16000', 'src/cut16k.wav'], check=True)

# Frames: one graded crop per film frame, numbered on the cut timeline
if '--frames' in sys.argv:
    for f in os.listdir('frames'): os.remove(os.path.join('frames', f))
    k = 0
    for p in edl:
        n = int(round(p['dur'] * FPS))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f"{p['src']:.4f}", '-i', SRC, '-frames:v', str(n),
                        '-vf', f'{CROP},{GRADE}', '-q:v', '2', '-start_number', str(k), 'frames/%05d.jpg'], check=True)
        k += n
    print(k, 'frames')
