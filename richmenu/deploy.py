"""อัปโหลดริชเมนูขึ้น LINE OA แล้วตั้งเป็นเมนูหลักของทุกคน

ใช้:
    set LINE_CHANNEL_ACCESS_TOKEN=...   (อย่าเก็บ token ไว้ในไฟล์นี้)
    python richmenu/deploy.py richmenu/a-poster.png

ทำอะไรบ้าง: สร้าง rich menu → อัปรูป → ตั้ง default → ลบเมนูเก่าที่ไม่ใช้
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
if not TOKEN:
    sys.exit("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน environment")

API = "https://api.line.me"
API_DATA = "https://api-data.line.me"

SITE = "https://kuapapoh.pages.dev"
MAPS = ("https://www.google.com/maps/search/?api=1&query="
        "%E0%B8%96%E0%B8%99%E0%B8%99%E0%B8%A8%E0%B8%A3%E0%B8%B5%E0%B8%95%E0%B8%B0"
        "%E0%B8%81%E0%B8%B1%E0%B9%88%E0%B8%A7%E0%B8%9B%E0%B9%88%E0%B8%B2")
FB = "https://www.facebook.com/profile.php?id=61590430773715"

W, H = 2500, 1686
CW, CH = 833, 843  # ช่องละ 1/3 กว้าง · ครึ่งสูง (ช่องขวาสุดกว้าง 834 ให้เต็มพอดี)

ACTIONS = [
    ("ตารางกิจกรรม", {"type": "uri", "uri": f"{SITE}/#schedule"}),
    ("จุดรวมพล", {"type": "uri", "uri": f"{SITE}/#houses"}),
    ("แผนที่การเดินทาง", {"type": "uri", "uri": MAPS}),
    ("เว็บไซต์โครงการ", {"type": "uri", "uri": f"{SITE}/"}),
    ("เพจกั่วป่าโพ้", {"type": "uri", "uri": FB}),
    # ยังไม่มีลิงก์ร้าน · ให้ส่งข้อความเข้าแชทไปก่อน แอดมินตอบเองใน OA Manager
    ("โพ้ช้อป", {"type": "message", "text": "สนใจโพ้ช้อป"}),
]

areas = []
for i, (label, action) in enumerate(ACTIONS):
    col, row = i % 3, i // 3
    x = col * CW
    areas.append({
        "bounds": {"x": x, "y": row * CH, "width": (W - x) if col == 2 else CW, "height": CH},
        "action": {**action, "label": label},
    })

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


img = Path(sys.argv[1] if len(sys.argv) > 1 else "richmenu/a-poster.png")

old = call(f"{API}/v2/bot/richmenu/list").get("richmenus", [])

rid = call(f"{API}/v2/bot/richmenu",
           json.dumps(MENU, ensure_ascii=False).encode())["richMenuId"]
print("สร้างเมนู:", rid)

call(f"{API_DATA}/v2/bot/richmenu/{rid}/content", img.read_bytes(), "image/png")
print("อัปรูป:", img.name, f"({img.stat().st_size // 1024} KB)")

call(f"{API}/v2/bot/user/all/richmenu/{rid}", b"", method="POST")
print("ตั้งเป็นเมนูหลักของทุกคนแล้ว")

for m in old:
    call(f"{API}/v2/bot/richmenu/{m['richMenuId']}", method="DELETE")
    print("ลบเมนูเก่า:", m["richMenuId"])
