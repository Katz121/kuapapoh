"""ถอดพื้นกระดาษครีมออกจากงานศิลป์ Codex -> PNG โปร่งใส + ครอปชิ้นที่ใช้จริง

ทำไมต้องทำ: gpt-image-2 คืนภาพพื้นครีมทึบ · ถ้าวางทับกระดาษด้วย multiply
จะเห็นเป็น "สี่เหลี่ยม" ชัดเจน · ต้องคีย์พื้นออกให้เหลือแต่หมึกกับสี

วิธี: alpha = ระยะห่างสีจากสีกระดาษ (soft threshold) · เก็บ RGB เดิมไว้
"""
import sys
import numpy as np
from PIL import Image

ART = "D:/Takuapa/poh-brand/a3/art"


def key_paper(path, t0=10.0, t1=34.0):
    """คืน RGBA ที่พื้นกระดาษกลายเป็นโปร่งใส"""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    # สีกระดาษ = ค่ามัธยฐานของขอบภาพ (ขอบเป็นพื้นเปล่าเสมอ)
    edge = np.concatenate([
        a[:12].reshape(-1, 3), a[-12:].reshape(-1, 3),
        a[:, :12].reshape(-1, 3), a[:, -12:].reshape(-1, 3),
    ])
    paper = np.median(edge, axis=0)
    dist = np.abs(a - paper).max(axis=2)
    alpha = np.clip((dist - t0) / (t1 - t0), 0.0, 1.0)
    out = np.dstack([a, alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA"), paper


def bbox_of(img, thresh=12):
    al = np.asarray(img)[:, :, 3]
    ys, xs = np.where(al > thresh)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def save(img, name):
    img.save(f"{ART}/{name}")
    print(f"  -> {name} {img.size}")


def main():
    # ── 1. ARCH -> canopy (ยอดซุ้ม) + base (พุ่มโคน) ──────────────────
    arch, paper = key_paper(f"{ART}/arch.png")
    print(f"arch paper={paper.astype(int)} size={arch.size}")
    W, H = arch.size
    save(arch, "arch_cut.png")

    canopy = arch.crop((0, 0, W, int(H * 0.44)))
    b = bbox_of(canopy)
    if b:
        canopy = canopy.crop(b)
    save(canopy, "canopy.png")

    base = arch.crop((0, int(H * 0.74), W, H))
    b = bbox_of(base)
    if b:
        base = base.crop(b)
    save(base, "base.png")

    # ── 2. TOWN → ตัดขอบบน/ล่างที่ว่าง เหลือเฉพาะแถบเมือง ───────────────
    try:
        town, p = key_paper(f"{ART}/town.png", t0=8, t1=40)
        print(f"town paper={p.astype(int)} size={town.size}")
        tw, th = town.size
        # ตัดขอบดอกไม้ล่างทิ้ง (ซ้ำธีมพฤกษศาสตร์กับแถบวัตถุดิบ) เหลือตึก+เรือ+คลื่น
        band = town.crop((0, int(th * 0.17), tw, int(th * 0.80)))
        save(band, "town_band.png")
    except FileNotFoundError:
        print("town.png ยังไม่มี")

    # ── 3. INGREDIENTS → แยกเป็น 6 ชิ้น (คุมขนาดรายชิ้นได้) ─────────────
    try:
        ing, p = key_paper(f"{ART}/ingredients.png", t0=14, t1=40)
        print(f"ingredients paper={p.astype(int)} size={ing.size}")
        # จุดตัด = ร่องว่างจริงระหว่างตัวอย่างพืช (วัดจาก column ink profile)
        cuts = [0, 279, 528, 801, 1018, 1250, ing.width]
        runs = list(zip(cuts[:-1], cuts[1:]))
        print(f"  แยก {len(runs)} ชิ้น: {runs}")
        for i, (x0, x1) in enumerate(runs, 1):
            piece = ing.crop((x0, 0, x1, ing.height))
            # ล้าง noise กระดาษทิ้งก่อน ไม่งั้น bbox บวมจนตัวอย่างถูกย่อจนเล็ก
            arr = np.asarray(piece).copy()
            arr[:, :, 3] = np.where(arr[:, :, 3] < 70, 0, arr[:, :, 3])
            piece = Image.fromarray(arr, "RGBA")
            # bbox ที่ alpha สูงพอ (พิกเซลจาง ๆ สีครีมมองไม่เห็นแต่ทำ bbox บวม)
            b = bbox_of(piece, thresh=150)
            if b:
                x0b, y0b, x1b, y1b = b
                piece = piece.crop((max(0, x0b - 6), max(0, y0b - 6),
                                    min(piece.width, x1b + 6), min(piece.height, y1b + 6)))
            save(piece, f"ing{i}.png")
    except FileNotFoundError:
        print("ingredients.png ยังไม่มี")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
