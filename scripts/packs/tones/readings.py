"""The readings of the hanzi behind the pin games' pinyin, for the per-item tone check (2026-10-24).
   python scripts/packs/tones/readings.py <hanzi list .json> [<out .json>]
The list comes from `node scripts/packs/tones/hanzi.js --list <file>` (every sim line, option and bank word, and every
pack word with hanzi). Writes scripts/packs/tones/hanzi-readings.json (committed; the tests read it, no Python there):
  chars: { 字: [every reading pypinyin knows, tone marks] }   the dictionary check (买 mǎi never mài)
  ctx:   { 一句话: [the reading of each Han character in this phrase] }   the context check (爱好 hào, 你好 hǎo)
Re-run it when a sim or a pack word with hanzi changes: scripts/test-pack-tones.js says so when a string is missing.
Needs pypinyin (pip install pypinyin; 0.55 on this PC, 2026-10-24)."""
import json, sys, pathlib, unicodedata
from pypinyin import pinyin, Style

here = pathlib.Path(__file__).resolve().parent
src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else here / 'hanzi-readings.json'
strings = json.loads(src.read_text(encoding='utf-8'))

def is_han(c):
    return 'CJK UNIFIED' in unicodedata.name(c, '') or '㐀' <= c <= '鿿'

chars, ctx = {}, {}
for s in strings:
    han = [c for c in s if is_han(c)]
    if not han:
        continue
    for c in han:
        if c not in chars:
            chars[c] = pinyin(c, style=Style.TONE, heteronym=True)[0]
    # the phrase-aware reading, one per Han character (the non-Han parts dropped)
    r = pinyin(s, style=Style.TONE, heteronym=False, errors='ignore')
    flat = [x[0] for x in r]
    if len(flat) != len(han):   # a run pypinyin kept whole: read character by character instead
        flat = [pinyin(c, style=Style.TONE)[0][0] for c in han]
    ctx[s] = flat

out.write_text(json.dumps({'about': 'pypinyin readings of the hanzi behind the pin games\' pinyin (scripts/packs/tones/readings.py); chars = every reading of a character, ctx = the reading of each Han character inside its phrase', 'chars': dict(sorted(chars.items())), 'ctx': dict(sorted(ctx.items()))}, ensure_ascii=False, indent=0), encoding='utf-8')
print('chars', len(chars), 'phrases', len(ctx), '->', out)
