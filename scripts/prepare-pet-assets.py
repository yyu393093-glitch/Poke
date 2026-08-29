from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets" / "pet"
CROPS = {
    "idle": (28, 18, 426, 300),
    "shake": (8, 25, 160, 160),
    "eating": (8, 52, 215, 229),
    "success": (8, 47, 210, 239),
}

for state, crop in CROPS.items():
    source = Image.open(ROOT / f"capybara-{state}-alpha.png").convert("RGBA")
    subject = source.crop(crop)
    alpha = subject.getchannel("A").point(lambda value: 0 if value < 18 else min(255, int(value * 2.15)))
    subject.putalpha(alpha)
    alpha_box = subject.getchannel("A").getbbox()
    if not alpha_box:
        raise RuntimeError(f"{state}: no visible subject")
    subject = subject.crop(alpha_box)
    edge = max(subject.size)
    canvas_size = int(edge * 1.14)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((canvas_size - subject.width) // 2, (canvas_size - subject.height) // 2))
    canvas.resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / f"capybara-{state}.png", optimize=True)
    print(f"prepared {state}: {subject.size} -> 512x512")
