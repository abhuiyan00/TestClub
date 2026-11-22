"""Render the slide snapshots a course's notes and questions refer to.

Only slides referenced in public/content/<course>/course.json are rendered, cropped to the slide body
(header bands, footers and logos removed, see tools/crops.json) and saved as 800 px WebP files in
public/content/<course>/slides/. Lecture PDFs stay on your machine; they are never copied into the repo.

Usage:
  python tools/slides.py --course adb --lecture 1 --pdf "path/to/lecture.pdf"
  python tools/slides.py --course isa --lecture 3 --pdf "path/to/combined.pdf" --force

Options:
  --crop T,B,L,R   override the crop fractions from tools/crops.json
  --force          re-render images that already exist
  --list           print the referenced slide numbers and exit

Requires: pip install -r tools/requirements.txt
"""
import argparse
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTH = 800


def referenced(course: dict, lecture: int) -> list[int]:
    notes = course["lectures"].get(str(lecture), {})
    refs = {int(f["slide"]) for f in notes.get("facts", []) + notes.get("formulas", [])}
    refs |= {int(q["slide"]) for q in course["questions"] if q["l"] == lecture}
    return sorted(refs)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--course", required=True)
    ap.add_argument("--lecture", required=True, type=int)
    ap.add_argument("--pdf")
    ap.add_argument("--crop")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    course_dir = os.path.join(ROOT, "public", "content", a.course)
    with open(os.path.join(course_dir, "course.json"), encoding="utf-8") as f:
        course = json.load(f)
    refs = referenced(course, a.lecture)
    if a.list:
        print(" ".join(map(str, refs)))
        return 0
    if not a.pdf:
        ap.error("--pdf is required unless --list is given")

    with open(os.path.join(ROOT, "tools", "crops.json"), encoding="utf-8") as f:
        crops = json.load(f)
    t, b, l, r = (float(x) for x in a.crop.split(",")) if a.crop else crops.get(a.course, [0, 0, 0, 0])
    # Boxes (fractions of the finished image) painted over example blocks that show hostnames, logins or third-party screenshots.
    with open(os.path.join(ROOT, "tools", "redactions.json"), encoding="utf-8") as f:
        redactions = json.load(f).get(a.course, {})

    import pymupdf
    from PIL import Image, ImageDraw

    doc = pymupdf.open(a.pdf)
    out_dir = os.path.join(course_dir, "slides")
    os.makedirs(out_dir, exist_ok=True)
    made, skipped, missing = 0, 0, []
    for n in refs:
        path = os.path.join(out_dir, f"L{a.lecture}-{n}.webp")
        if os.path.exists(path) and not a.force:
            skipped += 1
            continue
        if not 1 <= n <= doc.page_count:
            missing.append(n)
            continue
        page = doc[n - 1]
        zoom = (WIDTH * 2) / page.rect.width  # render at twice the target width, then downsample
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        w, h = im.size
        im = im.crop((round(w * l), round(h * t), round(w * (1 - r)), round(h * (1 - b))))
        im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        boxes = redactions.get(f"L{a.lecture}-{n}", [])
        if boxes:
            draw = ImageDraw.Draw(im)
            for x0, y0, x1, y1 in boxes:
                draw.rectangle((x0 * im.width, y0 * im.height, x1 * im.width, y1 * im.height), fill=(236, 237, 240), outline=(205, 208, 214))
        im.save(path, "WEBP", quality=72, method=6)
        made += 1
    print(f"{a.course} L{a.lecture}: {made} rendered, {skipped} kept, referenced {len(refs)}")
    if missing:
        print(f"  slide numbers beyond the PDF's {doc.page_count} pages: {missing}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
