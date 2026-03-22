"""
Remove outer black around the circular Gold Bridge Bid logo by flood-filling
from image edges. Only pixels connected to the border through near-black
pixels are cleared — inner dark artwork stays intact.

Usage (from repo root):
  python goldbridgebid/scripts/transparent-logo-bg.py
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

# Tunable: outer matte is pure/near black; keep below bridge/sky/navy tones
def is_outer_matte(r: int, g: int, b: int) -> bool:
    return r <= 32 and g <= 32 and b <= 32


def flood_transparent_edge(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    visited = bytearray(w * h)

    def idx(x: int, y: int) -> int:
        return y * w + x

    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            if is_outer_matte(r, g, b):
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, _ = px[x, y]
            if is_outer_matte(r, g, b):
                q.append((x, y))

    while q:
        x, y = q.popleft()
        i = idx(x, y)
        if visited[i]:
            continue
        r, g, b, a = px[x, y]
        if not is_outer_matte(r, g, b):
            continue
        visited[i] = 1
        px[x, y] = (r, g, b, 0)
        for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[idx(nx, ny)]:
                q.append((nx, ny))

    return img


def trim_to_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    if bbox:
        return img.crop(bbox)
    return img


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    public_logo = root / "public" / "logo.png"
    app_icon = root / "src" / "app" / "icon.png"

    for path in (public_logo, app_icon):
        if not path.is_file():
            print(f"skip (missing): {path}")
            continue
        out = flood_transparent_edge(Image.open(path))
        out = trim_to_alpha(out)
        out.save(path, format="PNG", optimize=True)
        print(f"updated: {path}")


if __name__ == "__main__":
    main()
