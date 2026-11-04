# B-roll -> graded JPEG frame sequences the page can draw: broll/<id>/00000.jpg ... at 30 fps,
# plus broll/index.json ({id: frame count}) for main.js. Run from the project folder: python3 src/broll.py [id ...]
# Per-film settings in src/broll.json (see references/broll.md):
#   {"dir": "~/Downloads/<folder>", "hdr": true, "exposure": 0.85, "grade": "<ffmpeg filters>",
#    "clips": [{"id": "swim", "file": "IMG_4931.MOV", "in": 1494.0, "dur": 2.9, "mode": "pane", "x": 400, "amb": 0.9}]}
# iPhone footage is HLG HDR (BT.2020): with "hdr" it goes through broll/hlg2sdr.cube (src/hlg_lut.py) to SDR BT.709 first.
#   pane:     1215x1080 window at x -> 1080x960 (a downscale; the split stage at native sharpness)
#   ppane:    1080x960 window at y from a vertical clip (no scaling)
#   portrait: the whole vertical clip, 1080x1920 (no scaling)
import json, os, subprocess, sys
C = json.load(open('src/broll.json'))
D = os.path.expanduser(C['dir'])
HDR = C.get('hdr', True)
GRADE = C.get('grade', 'eq=contrast=1.1:saturation=1.08:gamma=0.97,colorbalance=rm=0.015:bm=-0.02,cas=0.3')
only = set(sys.argv[1:])
os.makedirs('broll', exist_ok=True)
if HDR and not os.path.exists('broll/hlg2sdr.cube'):
    subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'hlg_lut.py'), 'broll/hlg2sdr.cube', str(C.get('exposure', .85))], check=True)
idx = json.load(open('broll/index.json')) if os.path.exists('broll/index.json') else {}
for c in C['clips']:
    if only and c['id'] not in only: continue
    out = f"broll/{c['id']}"; os.makedirs(out, exist_ok=True)
    for f in os.listdir(out): os.remove(os.path.join(out, f))
    geo = {'pane': f"crop=1215:1080:{c.get('x', 352)}:0,scale=1080:960:flags=lanczos",
           'ppane': f"crop=1080:960:0:{c.get('y', 480)}",
           'portrait': "scale=1080:1920:flags=lanczos"}[c['mode']]
    tone = ("scale=in_color_matrix=bt2020:in_range=tv:out_range=full,format=rgb48le,lut3d=broll/hlg2sdr.cube" if HDR
            else "scale=out_range=full,format=rgb24")
    vf = f"fps=30,{tone},{GRADE},{geo},format=yuvj444p"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(c['in']), '-t', str(c['dur']), '-i', f"{D}/{c['file']}",
                    '-vf', vf, '-q:v', '2', '-start_number', '0', f"{out}/%05d.jpg"], check=True)
    idx[c['id']] = len(os.listdir(out)); print(c['id'], idx[c['id']], 'frames')
json.dump(idx, open('broll/index.json', 'w'), indent=0)
