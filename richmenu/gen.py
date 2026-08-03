"""สร้าง HTML ริชเมนู 3 แบบ · เรนเดอร์เป็น PNG 2500x1686 ด้วย
    python scripts/render_covers_png.py --width 1250 --height 843 D:/Takuapa/richmenu/*.html
"""
from pathlib import Path

HERE = Path(__file__).parent

S = 'stroke="currentColor" fill="none" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"'

ICONS = {
    # ปฏิทิน
    "schedule": f'<svg viewBox="0 0 100 100"><rect x="12" y="22" width="76" height="66" rx="8" {S}/>'
                f'<path d="M12 42h76M32 12v20M68 12v20" {S}/>'
                f'<path d="M32 58h8M46 58h8M60 58h8M32 72h8M46 72h8" {S}/></svg>',
    # ตึกแถวสามหลัง (ล้อภาพลายเส้นในเว็บ)
    "houses": f'<svg viewBox="0 0 100 100"><path d="M8 88V44l14-12 14 12v44" {S}/>'
              f'<path d="M36 88V32l14-14 14 14v56" {S}/>'
              f'<path d="M64 88V44l14-12 14 12v44" {S}/>'
              f'<path d="M18 60h8M46 52h8M74 60h8M42 88v-14h16v14" {S}/>'
              f'<path d="M4 88h92" {S}/></svg>',
    # หมุดแผนที่
    "map": f'<svg viewBox="0 0 100 100"><path d="M50 92C50 92 78 64 78 42a28 28 0 1 0-56 0c0 22 28 50 28 50z" {S}/>'
           f'<circle cx="50" cy="41" r="11" {S}/></svg>',
    # ลูกโลก
    "web": f'<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" {S}/>'
           f'<path d="M12 50h76" {S}/>'
           f'<path d="M50 12c14 12 14 64 0 76-14-12-14-64 0-76z" {S}/>'
           f'<path d="M22 26c16 10 40 10 56 0M22 74c16-10 40-10 56 0" {S}/></svg>',
    # เฟซบุ๊ก
    "fb": f'<svg viewBox="0 0 100 100"><rect x="14" y="14" width="72" height="72" rx="16" {S}/>'
          f'<path d="M62 34h-8a9 9 0 0 0-9 9v43M38 54h22" {S}/></svg>',
    # กล่องข้อความ
    "ask": f'<svg viewBox="0 0 100 100"><path d="M86 54c0 17-16 30-36 30a44 44 0 0 1-11-1.4L18 90l4-15C15 69 14 62 14 54c0-17 16-30 36-30s36 13 36 30z" {S}/>'
           f'<path d="M36 50h28M36 64h16" {S}/></svg>',
}

CELLS = [
    ("schedule", "SCHEDULE", "ตารางกิจกรรม"),
    ("houses", "THREE HOUSES", "สามพื้นที่หลัก"),
    ("map", "HOW TO GET THERE", "แผนที่การเดินทาง"),
    ("web", "WEBSITE", "เว็บไซต์โครงการ"),
    ("fb", "FACEBOOK", "เพจกั่วป่าโพ้"),
    ("ask", "ASK US", "สอบถามข้อมูล"),
]

PAL = dict(yellow="#FFE81C", magenta="#EC0A72", cobalt="#1E3FA8",
           red="#F4331F", paper="#FBF7EC", ink="#101538")

# (bg, fg) ต่อช่อง · เรียงตาม CELLS
VARIANTS = {
    "a-poster": {
        "note": "พื้นเหลืองโปสเตอร์ · เส้นหมึกหนา",
        "skin": [(PAL["yellow"], PAL["ink"])] * 6,
        "extra": """
.cell{border-right:5px solid #101538;border-bottom:5px solid #101538}
.cell:nth-child(3n){border-right:0}
.cell:nth-child(n+4){border-bottom:0}
.cell:nth-child(5){background:#EC0A72;color:#FBF7EC}
.en{opacity:.7}
""",
    },
    "b-blocks": {
        "note": "บล็อกสีสลับแบบโปสเตอร์งาน",
        "skin": [
            (PAL["magenta"], PAL["paper"]),
            (PAL["yellow"], PAL["ink"]),
            (PAL["cobalt"], PAL["paper"]),
            (PAL["paper"], PAL["ink"]),
            (PAL["red"], PAL["paper"]),
            (PAL["ink"], PAL["yellow"]),
        ],
        "extra": """
.cell{box-shadow:0 0 0 3px rgba(16,21,56,.14) inset}
.en{opacity:.72}
""",
    },
    "c-paper": {
        "note": "พื้นกระดาษ เรียบ · ไอคอนสีตามพาเลต",
        "skin": [(PAL["paper"], PAL["ink"])] * 6,
        "extra": """
.cell{border-right:2px solid rgba(16,21,56,.18);border-bottom:2px solid rgba(16,21,56,.18)}
.cell:nth-child(3n){border-right:0}
.cell:nth-child(n+4){border-bottom:0}
.cell:nth-child(1) .ico{color:#EC0A72}
.cell:nth-child(2) .ico{color:#1E3FA8}
.cell:nth-child(3) .ico{color:#F4331F}
.cell:nth-child(4) .ico{color:#1E3FA8}
.cell:nth-child(5) .ico{color:#EC0A72}
.cell:nth-child(6) .ico{color:#F4331F}
.en{opacity:.55}
.th{font-size:32px}
""",
    },
}

HEAD = """<!doctype html><html lang="th"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bai+Jamjuree:wght@600;700&family=IBM+Plex+Sans+Thai:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="_base.css">
<style>%s</style></head><body>
"""

for name, v in VARIANTS.items():
    rows = []
    for (key, en, th), (bg, fg) in zip(CELLS, v["skin"]):
        rows.append(
            f'<div class="cell" style="background:{bg};color:{fg}">'
            f'<div class="ico">{ICONS[key]}</div>'
            f'<div><div class="en">{en}</div><div class="th">{th}</div></div></div>'
        )
    html = HEAD % v["extra"] + "\n".join(rows) + "\n</body></html>"
    out = HERE / f"{name}.html"
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out.name}  ({v['note']})")
