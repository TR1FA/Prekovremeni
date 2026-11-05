"""Crta ikonice aplikacije (sat + zlatni plus na navy podlozi). python tools/make_icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
NAVY, BLUE, GOLD, WHITE = (31, 56, 100), (46, 83, 149), (201, 162, 39), (255, 255, 255)
S = 1024  # crtamo veliko pa smanjujemo (glatke ivice)


def draw(rounded: bool, pad: float) -> Image.Image:
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=NAVY)
    else:
        d.rectangle([0, 0, S, S], fill=NAVY)
    # gornji sjaj (plava traka kao u Excel zaglavlju)
    c = S / 2
    r = (S / 2) * (1 - pad) * 0.78
    cx, cy = c - r * 0.08, c - r * 0.02
    w = int(r * 0.15)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=WHITE, width=w)
    # oznake sati
    import math
    for i in range(12):
        a = math.radians(i * 30)
        r1, r2 = r * (0.74 if i % 3 == 0 else 0.80), r * 0.86
        d.line([cx + r1 * math.sin(a), cy - r1 * math.cos(a), cx + r2 * math.sin(a), cy - r2 * math.cos(a)],
               fill=WHITE, width=int(w * (0.55 if i % 3 == 0 else 0.35)))
    # kazaljke (oko 10:10 -> prekovremeno uvece ;)
    def hand(deg, length, width, col):
        a = math.radians(deg)
        x, y = cx + length * math.sin(a), cy - length * math.cos(a)
        d.line([cx, cy, x, y], fill=col, width=width)
        d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=col)
    hand(300, r * 0.42, int(w * 0.75), WHITE)
    hand(60, r * 0.62, int(w * 0.55), WHITE)
    d.ellipse([cx - w * 0.6, cy - w * 0.6, cx + w * 0.6, cy + w * 0.6], fill=GOLD)
    # zlatni plus u krugu dolje desno
    br = r * 0.40
    bx, by = cx + r * 0.80, cy + r * 0.80
    d.ellipse([bx - br - w * 0.45, by - br - w * 0.45, bx + br + w * 0.45, by + br + w * 0.45], fill=NAVY)
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=GOLD)
    pw, pl = int(br * 0.26), br * 0.55
    d.rounded_rectangle([bx - pl, by - pw / 2, bx + pl, by + pw / 2], radius=pw // 2, fill=NAVY)
    d.rounded_rectangle([bx - pw / 2, by - pl, bx + pw / 2, by + pl], radius=pw // 2, fill=NAVY)
    return im


def main():
    OUT.mkdir(exist_ok=True)
    base = draw(rounded=True, pad=0.10)
    full = draw(rounded=False, pad=0.10)       # iOS sam zaobljuje
    mask = draw(rounded=False, pad=0.30)       # Android maskable: sadrzaj u sigurnoj zoni
    for name, im, size in [("icon-192.png", base, 192), ("icon-512.png", base, 512),
                           ("apple-touch-icon.png", full, 180), ("icon-maskable-512.png", mask, 512),
                           ("favicon.png", base, 64)]:
        im.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print("ok", name)


if __name__ == "__main__":
    main()
