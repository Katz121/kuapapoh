# POH — เมื่อเมืองท่ากลับมาผลิบาน · A3 Poster Production Prompts

โปสเตอร์ A3 (297×420 mm · 3508×4961 px @300dpi)

## หลักการ (อย่าข้าม)

1. **โมเดลเจนภาพห้ามเขียนตัวอักษร** — ทุก prompt ปิดท้ายด้วย negative "NO TEXT" · ตัวหนังสือไทย/อังกฤษทั้งหมดทำใน HTML แล้ว render ทับ
2. **ขวดคือของจริง** — ใช้ `assets/real-bottle-cut@2x.png` (cutout จากรูปถ่ายขวดจริง) ห้ามให้ AI วาดขวดใหม่ เพราะฉลาก Poh / SPARKLING TEA / 275 ml จะเพี้ยน
3. **รันทีละ job (sequential)** — Codex `$imagegen` มี race condition ถ้ารันขนาน ไฟล์จะทับกัน
4. Codex ต้องใช้ `--dangerously-bypass-approvals-and-sandbox` ถึงจะเขียนไฟล์ได้

## STYLE BLOCK (ใส่ในทุก prompt · ห้ามแก้ค่าสี)

```
STYLE: Antique botanical apothecary plate crossed with modern premium
beverage branding. Hand-painted gouache and watercolour over fine
copperplate ink line-work. Aged cream printmaking paper with visible
soft fibre grain and gentle plate-tone. Matte, printed, tactile —
absolutely no glossy digital gradients, no 3D render, no photo-bash,
no lens blur, no vignette.

PALETTE (strict, no other hues):
  deep indigo navy   #12246C   (ink, engraving, deep shadow)
  torch-ginger coral #E06A72   (primary flower body)
  deep rose          #C1435A   (flower core, shadow petals)
  pale blush         #F6CFC9   (petal highlight)
  antique gold       #C9A227   (hairline accents only, sparing)
  warm cream paper   #FBF3E2   (ground)
  muted sage         #7E9A6E   (stems, leaves)

LIGHT: flat, even, north-facing studio light like a scanned 19th-century
botanical print. No dramatic spotlighting.

QUALITY: museum archival giclée print, 300dpi, razor-sharp petal edges,
delicate stipple and cross-hatch shading, colour separation clean.

NEGATIVE — MUST NOT APPEAR: any text, letters, words, numbers, captions,
labels, signatures, watermarks, logos, brand marks, QR codes, borders
with writing, bottles, cans, glasses, cups, people, faces, hands, modern
cars, power lines, plastic, neon, HDR glow.
```

---

## JOB 1 · `art/arch.png` — ซุ้มดาหลาโอบขวด (1024×1536)

```
Create a vertical BOTANICAL ARCH composition on warm cream paper.

SUBJECT: Etlingera elatior (torch ginger / ดอกดาหลา) rendered as a
Victorian scientific botanical specimen — the true species: a tight
conical waxy bract-head of overlapping lance-shaped petals, coral-pink
outer bracts fading to pale blush at the tip, a deep rose crown at the
apex, mounted on a long clean straight stem with a slight sway.

COMPOSITION — this is the critical instruction:
Arrange the flowers as a symmetrical ARCH / WREATH that frames a tall
EMPTY VERTICAL CORRIDOR down the exact centre of the image.
- The centre corridor is roughly 34% of the image width and runs from
  12% height to 96% height. It must remain COMPLETELY EMPTY —
  bare cream paper, nothing painted in it, not even a faint leaf tip.
- Two large hero blooms (one upper-left at ~22% height, one upper-right
  at ~18% height) lean inward over the top of the corridor, their petal
  tips almost meeting but leaving a clean gap.
- Descending each side: three progressively smaller buds and half-open
  bracts, plus long sword-shaped sage-green leaves and slender stems
  that curve outward, away from the corridor.
- The bottom left and bottom right corners carry a low cluster of
  leaves and one closed bud each, framing the base.

RENDERING: layered translucent watercolour washes, each petal edged
with a fine indigo ink outline, cross-hatched shadow where petals
overlap, tiny dry-brush texture on the bracts. Stems in muted sage with
indigo line accents. A few loose graphite construction lines left
visible like an unfinished plate — botanical-study charm.

BACKGROUND: flat warm cream #FBF3E2 paper only. No scene, no sky,
no frame, no ornament.

[+ STYLE BLOCK]
```

---

## JOB 2 · `art/town.png` — ตะกั่วป่า + คลื่นอันดามัน (1536×1024)

```
Create a wide PANORAMIC ENGRAVING band on warm cream paper.

SUBJECT: the old port town of Takua Pa, Phang-nga, Thailand, drawn as a
19th-century steel-plate engraving in deep indigo ink on cream.

LEFT TWO-THIRDS: a continuous terrace of Sino-Portuguese shophouses —
two storeys, arched colonnade walkway at street level, tall louvred
shutters above, stucco pilasters, scalloped parapet roofline, hanging
paper lanterns under the arcade. Draw them in strict one-point
perspective receding gently to the left. Fine parallel-line hatching
for wall tone, denser cross-hatch inside the arcade shadows.

RIGHT THIRD: the shoreline. Two traditional wooden trading junks with
furled sails moored at a timber pier, ropes and pilings drawn in fine
line. Behind them the Andaman Sea rises into ONE large curling wave in
the manner of a Japanese woodblock crest — indigo outline, white paper
left bare for the foam, small round spray dots along the breaking edge.
The wave crest reaches about 70% of the band height and does NOT touch
the shophouses.

TONE GRADIENT: the ink is densest along the bottom edge of the band and
dissolves upward — the top 20% of the image must fade to bare cream
paper with nothing drawn in it, so the band can sit under other artwork.
Same fade on the far left and far right 6% edges.

MOOD: quiet, historical, hand-inked. Not a photo, not a 3D render.

[+ STYLE BLOCK]
```

---

## JOB 3 · `art/ingredients.png` — แถบวัตถุดิบ 6 ชนิด (1536×1024)

```
Create a SPECIMEN ROW: six separate botanical studies on warm cream
paper, evenly spaced left to right in a single horizontal line, each one
isolated with generous empty cream space around it — like six cut-outs
from a herbarium sheet. They must NOT touch or overlap each other.

Left to right, in this exact order:
1. TEA — a sprig of Camellia sinensis: three glossy serrated green
   leaves and one downy silver bud, plus a small loose pile of dried
   rolled dark tea leaves at its base.
2. TORCH GINGER — a single half-open ดาหลา bloom on a short cut stem,
   coral-pink waxy bracts, seen three-quarter on.
3. GARCINIA (ส้มแขก) — one whole ribbed yellow-orange garcinia fruit
   with its deep vertical grooves and a small green calyx, beside one
   half-fruit showing the pale segmented interior, plus two dried dark
   amber slices.
4. NUTMEG (ลูกจันทน์) — one nutmeg fruit split open to reveal the brown
   seed wrapped in bright crimson lacy mace, plus two loose dried
   nutmeg seeds.
5. MINT (มิ้น) — a fresh mint sprig, four pairs of opposite crinkled
   ovate leaves, sage-green with indigo vein lines.
6. ROSELLE (กระเจี๊ยบ) — three deep-crimson fleshy roselle calyces with
   their pointed lobes, one fresh and glossy, two dried and curled.

RENDERING: precise watercolour-and-ink botanical study, each specimen
with a soft cast shadow no larger than a pencil stroke, fine indigo
outline, natural species-accurate colour but kept inside the palette.

BACKGROUND: flat warm cream #FBF3E2, completely plain. No shelf,
no table, no frame, no scale bar, no numbering, no handwriting.

[+ STYLE BLOCK]
```

---

## JOB 4 (สำรอง) · `art/paper.png` — เท็กซ์เจอร์กระดาษ (1024×1536)

```
A blank sheet of aged warm-cream printmaking paper #FBF3E2, seen flat
from directly above under even light. Visible cotton-rag fibre, faint
mottling, a barely-there foxing speckle in the corners, soft deckled
plate impression. Nothing printed on it. Completely empty. No text,
no marks, no objects, no shadows of objects.

[+ STYLE BLOCK]
```

---

## คำสั่งรัน (sequential เท่านั้น)

```bash
codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox \
  "ใช้ \$imagegen gpt-image-2 คุณภาพสูงสุด ขนาด 1024x1536 สร้างภาพตาม brief แล้วบันทึกที่ D:/Takuapa/poh-brand/a3/art/arch.png · brief: <JOB 1> · บันทึกไฟล์ให้สำเร็จก่อนตอบ"
# รอให้จบ แล้วค่อยรัน JOB 2 · JOB 3
md5sum D:/Takuapa/poh-brand/a3/art/*.png   # เช็คว่าไม่มีไฟล์ซ้ำ
```

## ขั้นคีย์พื้นกระดาษ (ห้ามข้าม)

โมเดลคืนภาพ **พื้นครีมทึบ** · ถ้าเอาไปวางทับกระดาษด้วย `mix-blend-mode:multiply`
จะเห็นเป็น "สี่เหลี่ยม" ชัดเจนกลางโปสเตอร์ ต้องคีย์พื้นออกก่อน

```bash
python D:/Takuapa/poh-brand/a3/prep_art.py
```
สคริปต์นี้ทำ 3 อย่าง:
1. คีย์พื้นครีมเป็น alpha (วัดสีกระดาษจากขอบภาพ · soft threshold) → `arch_cut.png`
2. ครอป `arch.png` เป็น `canopy.png` (ยอดซุ้มคลุมขวด) · `town_band.png` (ตัดขอบดอกไม้ล่างทิ้ง ไม่ให้ซ้ำกับแถบวัตถุดิบ)
3. ตัด `ingredients.png` เป็น 6 ชิ้น `ing1..ing6.png` ตามร่องว่างจริง (x = 279/528/801/1018/1250)
   · ต้องล้าง alpha < 70 ทิ้งก่อนหา bbox ไม่งั้นพิกเซลจาง ๆ สีครีมทำ bbox บวมจนตัวอย่างพืชถูกย่อจนเล็กผิดรูป

## ขั้นประกอบ

```bash
python D:/workFull/scripts/render_covers_png.py --width 3508 --height 4961 \
  D:/Takuapa/poh-brand/a3/poster.html
```
ตัวหนังสือไทยทั้งหมดอยู่ใน `poster.html` (Noto Serif Thai + IBM Plex Sans Thai) ·
ขวดจริงวางเป็น `<img>` ทับตรงกลางซุ้มดาหลา

แล้ว export เป็นไฟล์ส่งโรงพิมพ์ (เรนเดอร์ได้ 3508×4960 · A3 จริงคือ 3508×4961 ต่างกัน 1px):
```python
im = Image.open('poster.png').convert('RGB').resize((3508,4961), Image.LANCZOS)
im.save('POH-A3-300dpi.png', dpi=(300,300))
im.save('POH-A3-300dpi.jpg', quality=95, dpi=(300,300), subsampling=0)
```

## บันทึกจากการรันจริง (2026-08-04)

- เครื่องนี้ **ไม่มี `OPENAI_API_KEY` ใน env** → Codex ตกไปใช้ built-in image gen แทน CLI `gpt-image-2`
  แต่ยังคืนขนาดที่ขอถูกต้อง (1024×1536 / 1536×1024) และคุณภาพใช้งานได้ · ถ้าอยากได้ gpt-image-2 ตรง ๆ ต้อง set key ก่อน
- `codex exec` แบบ background **ต้องต่อ `< /dev/null`** ไม่งั้นค้างรอ stdin แล้วตายเงียบ
- JOB 2 (ภาพแกะสลักเมือง) ใช้เวลานานสุด ~10 นาที · JOB 1 ~2 นาที
- กับดักที่เจอ: `<svg class="grain">` ถ้าใส่แค่ `inset:0` Chromium จะให้ขนาด intrinsic 300×150
  → เห็นเป็นแผ่นเกรนสี่เหลี่ยมมุมซ้ายบน · ต้องระบุ `width/height` เป็น px ตรง ๆ
