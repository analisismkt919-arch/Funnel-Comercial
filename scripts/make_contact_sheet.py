from PIL import Image, ImageDraw
from pathlib import Path

src = Path("entregables/render_seguridad")
files = sorted(src.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[1]))
tw = 420
thumbs = []
for f in files:
    im = Image.open(f).convert("RGB")
    h = int(im.height * tw / im.width)
    thumbs.append(im.resize((tw, h)))
rows = []
for j in range(0, len(thumbs), 2):
    rowh = max(x.height for x in thumbs[j:j + 2]) + 30
    row = Image.new("RGB", (tw * 2 + 20, rowh), "white")
    draw = ImageDraw.Draw(row)
    for k, im in enumerate(thumbs[j:j + 2]):
        x = k * (tw + 20)
        row.paste(im, (x, 25))
        draw.text((x + 5, 5), f"Pagina {j + k + 1}", fill="black")
    rows.append(row)
out = Image.new("RGB", (tw * 2 + 20, sum(r.height for r in rows)), "#dddddd")
y = 0
for row in rows:
    out.paste(row, (0, y))
    y += row.height
out.save(src / "contact-sheet.png")
