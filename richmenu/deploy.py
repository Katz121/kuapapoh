"""อัปโหลดริชเมนูขึ้น LINE OA แล้วตั้งเป็นเมนูหลักของทุกคน

ใช้:
    set LINE_CHANNEL_ACCESS_TOKEN=...   (อย่าเก็บ token ไว้ในไฟล์นี้)
    python richmenu/deploy.py richmenu/d-preorder.jpg

ทำอะไรบ้าง: สร้าง rich menu → อัปรูป → ตั้ง default → ลบเมนูเก่าที่ไม่ใช้
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

for _s in (sys.stdout, sys.stderr):   # คอนโซล Windows เป็น cp1252 · ไม่บังคับ utf-8 แล้ว print ไทยจะ crash กลางทาง
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
if not TOKEN:
    sys.exit("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน environment")

API = "https://api.line.me"
API_DATA = "https://api-data.line.me"

SITE = "https://kuapapoh.com"
MAPS = ("https://www.google.com/maps/search/?api=1&query="
        "%E0%B8%96%E0%B8%99%E0%B8%99%E0%B8%A8%E0%B8%A3%E0%B8%B5%E0%B8%95%E0%B8%B0"
        "%E0%B8%81%E0%B8%B1%E0%B9%88%E0%B8%A7%E0%B8%9B%E0%B9%88%E0%B8%B2")
FB = "https://www.facebook.com/profile.php?id=61590430773715"

W, H = 2500, 1686
HALF = 1250          # ช่องพรีออเดอร์กินครึ่งซ้ายเต็มความสูง
QW, QH = 625, 843    # อีกสี่ช่องแบ่งครึ่งขวาเป็น 2x2

# เวิร์กชอปจบไปแล้ว (12-16 ส.ค.) จึงถอดช่องนั้นกับโปสเตอร์หมดอายุออก
# แล้วดันของที่กำลังขายจริง (พรีออเดอร์เสื้อเทศกาลกินผัก) ขึ้นเป็นช่องใหญ่แทน
AREAS = [
    # (x, y, w, h, label, uri) · เรียงให้ตรงกับช่องในภาพ d-preorder.png
    (0, 0, HALF, H, "พรีออเดอร์เสื้อ", f"{SITE}/preorder/"),
    (HALF, 0, QW, QH, "โพ้ช็อป", f"{SITE}/#shop"),
    (HALF + QW, 0, W - HALF - QW, QH, "โพ้ชม", f"{SITE}/#events"),
    (HALF, QH, QW, H - QH, "โพ้พานำ", MAPS),
    (HALF + QW, QH, W - HALF - QW, H - QH, "โพ้บอกข่าว", FB),
]

areas = [
    {
        "bounds": {"x": x, "y": y, "width": w, "height": h},
        "action": {"type": "uri", "uri": uri, "label": label},
    }
    for x, y, w, h, label, uri in AREAS
]

MENU = {
    "size": {"width": W, "height": H},
    "selected": True,          # เปิดเมนูค้างไว้ตอนเข้าแชท
    "name": "กั่วป่าโพ้ · เมนูหลัก",
    "chatBarText": "เมนู",
    "areas": areas,
}


def call(url, data=None, ctype="application/json", method=None):
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if data is not None:
        headers["Content-Type"] = ctype
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        body = r.read().decode()
    return json.loads(body) if body.strip() else {}


def assert_channel(expect_basic, expect_premium):
    """กันอัปเมนูผิด OA · env อาจมี LINE_CHANNEL_ACCESS_TOKEN ของแอคอื่นค้างอยู่
    (เคยเกิดจริง 2026-09-20: token ของ @kuapapoh ค้างใน env แล้วเมนูศิวราขึ้นผิดแอคจนเมนูเดิมถูกลบ)"""
    req = urllib.request.Request(f"{API}/v2/bot/info", headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as r:
        info = json.load(r)
    got = (info.get("basicId"), info.get("premiumId"))
    if expect_basic not in got and expect_premium not in got:
        sys.exit(f"หยุด: token นี้เป็นของ {info.get('displayName')} {got} "
                 f"ไม่ใช่ {expect_premium} · unset LINE_CHANNEL_ACCESS_TOKEN แล้วใช้ CHANNEL_ID+SECRET ของแอคที่ถูก")
    print(f"ยืนยันแอค: {info.get('displayName')} {info.get('premiumId') or info.get('basicId')}")


assert_channel("@239sbnsh", "@kuapapoh")

img = Path(sys.argv[1] if len(sys.argv) > 1 else "richmenu/d-preorder.jpg")

old = call(f"{API}/v2/bot/richmenu/list").get("richmenus", [])

rid = call(f"{API}/v2/bot/richmenu",
           json.dumps(MENU, ensure_ascii=False).encode())["richMenuId"]
print("สร้างเมนู:", rid)

# LINE รับได้ไม่เกิน 1 MB · ไฟล์ PNG ของเมนูนี้เกิน เลยอัปเป็น JPEG
ctype = "image/jpeg" if img.suffix.lower() in (".jpg", ".jpeg") else "image/png"
if img.stat().st_size > 1024 * 1024:
    sys.exit(f"รูปใหญ่เกิน 1 MB ({img.stat().st_size // 1024} KB) · LINE จะไม่รับ")
call(f"{API_DATA}/v2/bot/richmenu/{rid}/content", img.read_bytes(), ctype)
print("อัปรูป:", img.name, f"({img.stat().st_size // 1024} KB)")

call(f"{API}/v2/bot/user/all/richmenu/{rid}", b"", method="POST")
print("ตั้งเป็นเมนูหลักของทุกคนแล้ว")

for m in old:
    call(f"{API}/v2/bot/richmenu/{m['richMenuId']}", method="DELETE")
    print("ลบเมนูเก่า:", m["richMenuId"])
