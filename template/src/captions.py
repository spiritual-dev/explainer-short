# Captions from the cut's word timings: fixes Whisper's spellings, groups 1-3 words per chip, writes
# src/captions.json (for the page) and src/srt_cues.json (for the .srt, sentence-sized lines).
import json, re
import os
# Per-film spelling fixes and phrases that must stay on one chip: src/caption_fix.json
#   {"fix": {"codex": "Codex"}, "merge": [["going", "to", "gonna"]], "keep": [["your", "term"], ["Claude", "Code"]], "drop_first": "So"}
CF = json.load(open('src/caption_fix.json')) if os.path.exists('src/caption_fix.json') else {}
FIX = CF.get('fix', {})
W = [w for s in json.load(open('src/cut_words.json')) for w in s['words']]
W = [dict(w=w['w'].strip(), t0=w['t0'], t1=w['t1']) for w in W]
if CF.get('drop_first') and W[0]['w'].startswith(CF['drop_first']): W = W[1:]   # Whisper invents a filler ("So") in leading silence; check the energy before trusting it
# two words Whisper splits or normalises, merged back into what was said: "going to" -> "gonna", "awe inspiring" -> "awe-inspiring"
for a, b, into in CF.get('merge', []):
    i = 0
    while i + 1 < len(W):
        if W[i]['w'].lower() == a and re.sub(r'[,.?!]$', '', W[i + 1]['w']).lower() == b:
            W[i] = dict(w=into + re.sub(r'^[^,.?!]*', '', W[i + 1]['w']), t0=W[i]['t0'], t1=W[i + 1]['t1']); del W[i + 1]
        i += 1
out = []
for i, w in enumerate(W):
    t = FIX.get(w['w'], w['w'])
    if t == 'chat' and i + 1 < len(W) and W[i + 1]['w'].startswith('GPT'): W[i + 1]['w'] = 'ChatGPT' + W[i + 1]['w'][3:]; continue   # Whisper splits it
    out.append(dict(w=t, t0=w['t0'], t1=w['t1']))
out[0]['w'] = out[0]['w'][:1].upper() + out[0]['w'][1:]
# keep names and key phrases on one chip
KEEP = {tuple(k) for k in CF.get('keep', [])}
m = []
for w in out:
    if m and (m[-1]['w'], w['w']) in KEEP: m[-1] = dict(w=m[-1]['w'] + ' ' + w['w'], t0=m[-1]['t0'], t1=w['t1'])
    else: m.append(w)
out = m
# chunks: break after punctuation, at 3 words, or before a word that would overflow 19 chars (the chip's width at 56 px)
chunks, cur = [], []
for w in out:
    if cur and (len(cur) == 3 or len(' '.join(x['w'] for x in cur + [w])) > 19): chunks.append(cur); cur = []
    cur.append(w)
    if re.search(r'[,.?!]$', w['w']): chunks.append(cur); cur = []
if cur: chunks.append(cur)
caps = []
for k, c in enumerate(chunks):
    t0 = c[0]['t0']; t1 = chunks[k + 1][0]['t0'] if k + 1 < len(chunks) else c[-1]['t1'] + .4
    t1 = min(t1, c[-1]['t1'] + .6)
    caps.append(dict(t0=round(t0, 2), t1=round(t1, 2), text=' '.join(x['w'] for x in c).rstrip(',.')))
json.dump(caps, open('src/captions.json', 'w'), indent=0)
# .srt lines: sentence-ish groups up to ~42 chars
srt, cur = [], []
for w in out:
    cur.append(w)
    if re.search(r'[.?!]$', w['w']) or len(' '.join(x['w'] for x in cur)) > 38:
        srt.append(dict(t0=cur[0]['t0'], t1=cur[-1]['t1'] + .15, text=' '.join(x['w'] for x in cur))); cur = []
if cur: srt.append(dict(t0=cur[0]['t0'], t1=cur[-1]['t1'] + .3, text=' '.join(x['w'] for x in cur)))
json.dump(srt, open('src/srt_cues.json', 'w'), indent=0)
print(len(caps), 'chips'); print(' | '.join(c['text'] for c in caps))
