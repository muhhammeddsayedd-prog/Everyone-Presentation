"""Visual comparison of the 1.4.0 render with the supplied reference (local QA only).

Inputs (git-ignored): .local/cycle7/visual/ref/p-NN.png (reference PDF rasterised at 1920 px)
and .local/cycle7/visual/mine/p-NN.png (render-1-4.mts output rasterised at 1920 px).
Writes side-by-side, overlay and difference images to .local/cycle7/visual/compare/ and prints a JSON
table of measured element bands (non-background bounding boxes) for each compared page pair.
The reference contains real people: its images never leave .local/.

Run from the repository root:  python -X utf8 development/cycle7/visual/compare.py
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[3] / '.local/cycle7/visual'
BG = np.array([241, 241, 241])
# Reference page -> rendered page. The reference splits five options 2 + 3 (with a deliberately empty
# picture); 1.4.0 splits them 3 + 2, so reference 9 (pair) is compared with render 10 and vice versa.
PAIRS = [(1, 1), (2, 2), (3, 3), (8, 8), (9, 10), (10, 9), (17, 17), (18, 18), (33, 33), (35, 35)]


def bands(image):
    a = np.asarray(image.convert('RGB')).astype(int)
    diff = np.abs(a - BG).sum(axis=2) > 10
    rows = diff.any(axis=1)
    out, start = [], None
    for y, v in enumerate(list(rows) + [False]):
        if v and start is None:
            start = y
        if not v and start is not None:
            cols = np.where(diff[start:y].any(axis=0))[0]
            groups = []
            for x in cols:
                if groups and x - groups[-1][1] > 25:
                    groups.append([int(x), int(x)])
                elif groups:
                    groups[-1][1] = int(x)
                else:
                    groups.append([int(x), int(x)])
            out.append({'y': [start, y - 1], 'x': groups})
            start = None
    return out


def highlight(image):
    a = np.asarray(image.convert('RGB')).astype(int)
    m = (a[:, :, 0] > 230) & (a[:, :, 1] > 230) & (a[:, :, 2] < 60)
    ys, xs = np.where(m)
    return None if not len(xs) else [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


def main():
    out = ROOT / 'compare'
    out.mkdir(parents=True, exist_ok=True)
    table = []
    for ref, mine in PAIRS:
        a = Image.open(ROOT / f'ref/p-{ref:02d}.png').convert('RGB')
        b = Image.open(ROOT / f'mine/p-{mine:02d}.png').convert('RGB')
        assert a.size == b.size == (1920, 1080), (ref, a.size, b.size)
        side = Image.new('RGB', (3840, 1080), 'white')
        side.paste(a, (0, 0))
        side.paste(b, (1920, 0))
        side.save(out / f'side-{ref:02d}.png')
        Image.blend(a, b, 0.5).save(out / f'overlay-{ref:02d}.png')
        ImageChops.invert(ImageChops.difference(a, b)).save(out / f'diff-{ref:02d}.png')
        table.append({'reference_page': ref, 'render_page': mine, 'reference': bands(a), 'render': bands(b), 'highlight': [highlight(a), highlight(b)]})
    (out / 'bands.json').write_text(json.dumps(table, indent=1), encoding='utf-8')
    for row in table:
        print(f"== ref {row['reference_page']} / render {row['render_page']}  highlight {row['highlight']}")
        for side in ('reference', 'render'):
            print(f'  {side:9}', '; '.join(f"y{b['y'][0]}-{b['y'][1]} " + ','.join(f'x{g[0]}-{g[1]}' for g in b['x']) for b in row[side]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
