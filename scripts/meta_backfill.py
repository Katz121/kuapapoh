"""ส่งสถิติที่เก็บไว้เองย้อนเข้า Meta ผ่าน Conversions API

ใช้ตอนไหน: วันที่สร้าง Meta Pixel เสร็จแล้ว และอยากให้ Meta เห็นข้อมูลช่วงก่อนหน้า
ที่เว็บเก็บไว้เอง (ตาราง visits ใน D1) เพื่อเอาไปสอนระบบหาลูกค้าและวัดผลแอด

ทำไมส่งย้อนหลังได้: ทุกแถวมี event_id ของตัวเอง Meta จึงรู้ว่าไม่ใช่รายการซ้ำ
กับที่ Pixel ยิงสดๆ · และคอลัมน์ sent_meta กันไม่ให้ส่งซ้ำรอบสอง

⚠️ Meta รับ event ย้อนหลังได้ไม่เกิน 7 วันสำหรับการวัดผลแอด
   ที่เก่ากว่านั้นส่งได้แต่จะใช้ได้แค่เป็นข้อมูลประกอบ ไม่ถูกนับเป็นคอนเวอร์ชันของแอด

ใช้:
    set META_PIXEL_ID=...
    set META_CAPI_TOKEN=...            (Events Manager → Settings → Generate access token)
    python scripts/meta_backfill.py --days 7            ← ดูก่อนว่าจะส่งอะไร (ยังไม่ส่งจริง)
    python scripts/meta_backfill.py --days 7 --send     ← ส่งจริงแล้วปั๊ม sent_meta = 1

ตัวเลือก: --test-code TESTxxxxx  ส่งเข้า Test Events ใน Events Manager ก่อน จะได้เห็นว่ารับจริง
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

DB = "kuapapoh"
GRAPH = "https://graph.facebook.com/v21.0"
BATCH = 500                     # Meta รับได้สูงสุด 1000 ต่อคำขอ · เผื่อไว้ครึ่งหนึ่ง
SITE = "https://kuapapoh.com"


def d1(sql):
    """สั่ง SQL ผ่าน wrangler · ใช้สิทธิ์ที่ล็อกอินไว้ในเครื่อง ไม่ต้องมีคีย์ในไฟล์นี้"""
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql],
        capture_output=True, text=True, encoding="utf-8", shell=(os.name == "nt"),
    )
    if result.returncode != 0:
        sys.exit("wrangler ล้มเหลว:\n" + (result.stderr or "")[-1500:])
    text = result.stdout
    start = text.find("[")
    if start < 0:
        sys.exit("อ่านคำตอบจาก wrangler ไม่ได้:\n" + text[-1500:])
    return json.loads(text[start:])[-1]["results"]


def sha(value):
    """Meta รับข้อมูลลูกค้าเป็นค่าแฮชเท่านั้น · ของดิบไม่เคยออกจากเครื่องนี้"""
    text = str(value or "").strip().lower()
    if not text:
        return None
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def phone_for_meta(phone):
    """เบอร์ไทยต้องเป็นรูปแบบสากลก่อนแฮช ไม่งั้นจับคู่กับบัญชีผู้ใช้ไม่ติด"""
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if not digits:
        return None
    if digits.startswith("0"):
        digits = "66" + digits[1:]
    return sha(digits)


def build_event(row, orders, test_code=None):
    at = datetime.fromisoformat(row["at"].replace("Z", "+00:00"))
    user_data = {}

    # fbc = รหัสที่ผูกคลิกจากแอดเข้ากับการซื้อ · รูปแบบนี้ Meta กำหนดไว้ตายตัว
    # cookie _fbc มีเวลาคลิกจริงอยู่แล้ว ใช้ก่อน · ไม่มีค่อยประกอบจาก fbclid
    if row.get("fbc"):
        user_data["fbc"] = row["fbc"]
    elif row.get("fbclid"):
        user_data["fbc"] = f"fb.1.{int(at.timestamp() * 1000)}.{row['fbclid']}"
    if row.get("fbp"):
        user_data["fbp"] = row["fbp"]
    if row.get("country"):
        user_data["country"] = sha(row["country"])

    # ออเดอร์จริงมีชื่อกับเบอร์ · ใส่แบบแฮชไปด้วย Meta จะจับคู่คนได้แม่นขึ้นมาก
    order = orders.get(row.get("order_id") or "")
    if order:
        if order.get("phone"):
            user_data["ph"] = phone_for_meta(order["phone"])
        if order.get("email"):
            user_data["em"] = sha(str(order["email"]).strip().lower())
        name = str(order.get("name") or "").split()
        if name:
            user_data["fn"] = sha(name[0])
            if len(name) > 1:
                user_data["ln"] = sha(name[-1])

    # ประเทศอย่างเดียวกว้างเกิน Meta ตีกลับทั้งชุด (subcode 2804050) · ต้องมี fbc หรือเบอร์ถึงจะส่ง
    # ไอพีเราเก็บแบบแฮช ส่งเป็น client_ip_address ไม่ได้ · user agent อย่างเดียวก็ไม่พอให้จับคู่
    if not (user_data.get("fbc") or user_data.get("ph")):
        return None
    # ไม่ส่ง client_user_agent · คอลัมน์ ua ใน D1 เก็บแค่ชื่อเบราว์เซอร์ ("Chrome") ไม่ใช่ UA เต็ม
    # และ Meta ต้องการ UA คู่กับ IP เสมอ ส่ง UA เดี่ยวๆ = คำเตือน "ขาดที่อยู่ IP" ใน Events Manager

    event = {
        "event_name": row["event"],
        "event_time": int(at.timestamp()),
        "event_id": row["event_id"],
        "action_source": "website",
        "event_source_url": SITE + (row.get("path") or "/"),
        "user_data": {k: v for k, v in user_data.items() if v},
    }
    if row.get("value"):
        event["custom_data"] = {
            "currency": row.get("currency") or "THB",
            "value": float(row["value"]),
            "content_ids": ["je-shirt"],
            "content_type": "product",
        }
        if row.get("order_id"):
            event["custom_data"]["order_id"] = row["order_id"]
    if test_code:
        event["test_event_code"] = test_code
    return event


def _proof(token):
    """token ของแอปที่เปิด Require App Secret (เช่น punkam-ads) ต้องแนบ appsecret_proof"""
    secret = os.environ.get("META_APP_SECRET")
    if not secret:
        return ""
    import hmac
    return "&appsecret_proof=" + hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()


def send(pixel_id, token, events, test_code=None):
    payload = {"data": events}
    if test_code:
        payload["test_event_code"] = test_code
    request = urllib.request.Request(
        f"{GRAPH}/{pixel_id}/events?access_token={token}" + _proof(token),
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json", "user-agent": "kuapapoh-backfill/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7, help="ย้อนหลังกี่วัน (ค่าเริ่มต้น 7 = ช่วงที่ Meta นับเป็นคอนเวอร์ชัน)")
    parser.add_argument("--send", action="store_true", help="ส่งจริง · ไม่ใส่ = แค่แสดงให้ดู")
    parser.add_argument("--test-code", help="test_event_code จาก Events Manager")
    parser.add_argument("--resend", action="store_true",
                        help="ส่งซ้ำทุกรายการ (ไม่ดู/ไม่แก้ sent_meta) · ใช้ตอนเพิ่ม Pixel ตัวใหม่")
    parser.add_argument("--since", help="ใช้คู่กับ --resend · จำกัดช่วงเวลาที่ส่งซ้ำ เช่น 2026-09-20T14:00")
    parser.add_argument("--events", default="Purchase,InitiateCheckout,AddToCart,ViewContent",
                        help="ส่งเฉพาะ event เหล่านี้ (คั่นด้วยจุลภาค)")
    args = parser.parse_args()

    # --resend ต้องมี --since คู่กันเสมอ กัน Meta ส่งประวัติซ้ำทั้งก้อน (Meta ไม่ dedup server+server)
    if args.resend and not args.since:
        sys.exit("--resend ต้องใส่ --since YYYY-MM-DDTHH:MM คู่กันเสมอ เพื่อจำกัดช่วงที่ส่งซ้ำ")

    pixel_id = os.environ.get("META_PIXEL_ID")
    token = os.environ.get("META_CAPI_TOKEN")
    if args.send and not (pixel_id and token):
        sys.exit("ยังไม่ได้ตั้ง META_PIXEL_ID กับ META_CAPI_TOKEN ใน environment")

    wanted = [e.strip() for e in args.events.split(",") if e.strip()]
    since = (datetime.now(timezone.utc) + timedelta(hours=7) - timedelta(days=args.days - 1)).strftime("%Y-%m-%d")
    quoted = ",".join("'" + e.replace("'", "") + "'" for e in wanted)

    resend_cond = f"at >= '{args.since}'" if args.resend else "sent_meta = 0"
    rows = d1(
        "SELECT id, at, event, event_id, path, fbclid, fbp, fbc, value, currency, order_id, country, ua "
        f"FROM visits WHERE {resend_cond} AND is_bot = 0 AND day >= '{since}' AND event IN ({quoted}) "
        "ORDER BY id ASC LIMIT 5000"
    )
    if not rows:
        print(f"ไม่มีรายการค้างส่งในช่วง {args.days} วันล่าสุด")
        return

    order_ids = sorted({r["order_id"] for r in rows if r.get("order_id")})
    orders = {}
    if order_ids:
        listed = ",".join("'" + i.replace("'", "") + "'" for i in order_ids)
        for order in d1(f"SELECT id, name, phone, email FROM preorders WHERE id IN ({listed})"):
            orders[order["id"]] = order

    events, skipped, ids = [], 0, []
    for row in rows:
        event = build_event(row, orders, args.test_code)
        if event is None:
            skipped += 1
            continue
        events.append(event)
        ids.append(row["id"])

    print(f"พบค้างส่ง {len(rows)} รายการ · ส่งได้ {len(events)} · ข้าม {skipped} (ไม่มีข้อมูลให้ Meta จับคู่)")
    if not events:
        return

    if not args.send:
        print("\nตัวอย่างรายการแรกที่จะส่ง (ยังไม่ส่งจริง · ใส่ --send เมื่อพร้อม):")
        print(json.dumps(events[0], ensure_ascii=False, indent=2))
        return

    sent = 0
    for start in range(0, len(events), BATCH):
        chunk = events[start:start + BATCH]
        chunk_ids = ids[start:start + BATCH]
        answer = send(pixel_id, token, chunk, args.test_code)
        received = answer.get("events_received", 0)
        print(f"ส่งไป {len(chunk)} · Meta รับ {received} · fbtrace {answer.get('fbtrace_id', '-')}")
        if received:
            # ปั๊มทีละก้อนทันที · เน็ตหลุดกลางทางแล้วรันใหม่จะไม่ส่งของเดิมซ้ำ
            # resend ก็ต้องปั๊มด้วย · ไม่งั้นรอบ --send ปกติทีหลังจะส่งแถวเดิมซ้ำ (Meta ไม่ dedup server+server)
            d1(f"UPDATE visits SET sent_meta = 1 WHERE id IN ({','.join(str(i) for i in chunk_ids)})")
            sent += received
        time.sleep(1)

    print(f"\nเสร็จ · ส่งเข้า Meta ทั้งหมด {sent} รายการ" + " · ปั๊ม sent_meta แล้ว")


if __name__ == "__main__":
    main()
