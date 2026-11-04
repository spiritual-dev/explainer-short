# Word-level transcript: src/transcribe.py <audio16k.wav> <out.json> [model]   (default small.en)
# Use for the whole take (src/transcript.json), the cut (src/cut_words.json) and the final mix (speech check).
import json, sys
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else "small.en", device="cpu", compute_type="int8")
segs, _ = m.transcribe(sys.argv[1], word_timestamps=True, vad_filter=False, beam_size=5)
out = []
for s in segs:
    out.append({"t0": round(s.start, 2), "t1": round(s.end, 2), "text": s.text.strip(),
                "words": [{"w": w.word, "t0": round(w.start, 2), "t1": round(w.end, 2)} for w in s.words]})
    print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text.strip()}")
json.dump(out, open(sys.argv[2], "w"), indent=1)
