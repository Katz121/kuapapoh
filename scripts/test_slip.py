"""ทดสอบระบบตรวจสลิปด้วยสลิปจริง โดยไม่ต้องสั่งของจริง

ทำอะไร: อ่านคิวอาร์ในรูปสลิปด้วยตัวอ่านตัวเดียวกับที่หน้าเว็บใช้ (jsQR)
แล้วส่งเลขอ้างอิงไปถามธนาคารผ่าน Thunder Solution API เหมือนที่ระบบจริงทำทุกอย่าง

ใช้ยังไง:
    set SLIP_VERIFY_KEY=คีย์ของคุณ
    python scripts/test_slip.py "D:/path/to/slip.jpg"
    python scripts/test_slip.py "D:/path/to/slip.jpg" --amount 350

ตัวเลือก:
    --amount  ยอดที่ควรจะเป็น (ใส่แล้วระบบจะบอกว่ายอดตรงไหม)
    --account เลขบัญชีปลายทางที่ควรจะเป็น (ค่าเริ่มต้นคือบัญชีโพ้ช้อป)

ต้องมี: playwright (pip install playwright) และไฟล์ preorder/vendor/jsQR.js ในโปรเจกต์
"""
import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error

ENDPOINT = "https://api.thunder.in.th/v2/verify/bank"
DEFAULT_ACCOUNT = "020256423342"          # ธ.ก.ส. โพ้ช้อป
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSQR = os.path.join(ROOT, "preorder", "vendor", "jsQR.js")


def read_qr(image_path):
    """อ่านคิวอาร์ในรูปด้วย jsQR ตัวเดียวกับหน้าเว็บ · คืนข้อความใน QR หรือ None"""
    from playwright.sync_api import sync_playwright

    with open(image_path, "rb") as handle:
        raw = base64.b64encode(handle.read()).decode()
    ext = os.path.splitext(image_path)[1].lower().lstrip(".") or "jpeg"
    mime = "image/" + ("jpeg" if ext in ("jpg", "jpeg") else ext)
    data_url = f"data:{mime};base64,{raw}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content("<body></body>")
        page.add_script_tag(path=JSQR)
        result = page.evaluate(
            """async (dataUrl) => {
                const img = new Image();
                await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = dataUrl; });
                const side = Math.min(1400, Math.max(img.width, img.height));
                const scale = side / Math.max(img.width, img.height);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const found = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
                return found ? found.data : null;
            }""",
            data_url,
        )
        browser.close()
    return result


def verify(payload, key, amount=None, account=None):
    body = {"payload": payload, "checkDuplicate": True}
    if amount:
        body["amount"] = float(amount)
    if account:
        body["receiverAccount"] = account

    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            # ไม่ส่ง user-agent = โดนด่านกันบอทตีกลับ 403 ตั้งแต่ยังไม่ถึง API
            "User-Agent": "kuapapoh-slip-test/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        raw = error.read().decode()
        try:
            return error.code, json.loads(raw)
        except json.JSONDecodeError:
            return error.code, {"raw": raw}


def main():
    parser = argparse.ArgumentParser(description="ทดสอบตรวจสลิปกับธนาคาร")
    parser.add_argument("image", help="ไฟล์รูปสลิป")
    parser.add_argument("--amount", type=float, default=None, help="ยอดที่ควรจะเป็น")
    parser.add_argument("--account", default=DEFAULT_ACCOUNT, help="เลขบัญชีปลายทางที่ควรจะเป็น")
    args = parser.parse_args()

    key = os.environ.get("SLIP_VERIFY_KEY", "").strip()
    if not key:
        print("ยังไม่ได้ตั้งค่า SLIP_VERIFY_KEY")
        print('  PowerShell:  $env:SLIP_VERIFY_KEY = "คีย์ของคุณ"')
        return 1
    if not os.path.exists(args.image):
        print("ไม่พบไฟล์:", args.image)
        return 1

    print("1) อ่านคิวอาร์ในสลิป...")
    payload = read_qr(args.image)
    if not payload:
        print("   อ่านไม่ได้ · สลิปใบนี้อาจไม่มีคิวอาร์ หรือรูปเบลอ/ถูกครอปจนคิวอาร์หาย")
        print("   ระบบจริงจะยังรับออเดอร์ แต่จะขึ้นป้าย 'ไม่มีเลขอ้างอิง' ให้ทีมงานตรวจเอง")
        return 2
    print("   ได้เลขอ้างอิง:", payload[:60] + ("..." if len(payload) > 60 else ""))

    print("2) ถามธนาคารผ่าน Thunder Solution...")
    status, data = verify(payload, key, args.amount, args.account)
    print("   HTTP", status)

    error = (data or {}).get("error")
    if error:
        code = error.get("code")
        print("   ผล: ไม่ผ่าน ·", code, "·", error.get("message"))
        if code in ("SLIP_NOT_FOUND", "VALIDATION_ERROR"):
            print("   แปลว่า: ธนาคารไม่พบรายการโอนตามสลิปนี้ (สลิปปลอม หรือเก่าเกินกว่าที่ธนาคารเก็บ)")
        elif code == "QUOTA_EXCEEDED":
            print("   แปลว่า: โควตาตรวจสลิปหมด ต้องเติมแพ็ก")
        elif code in ("INVALID_API_KEY", "MISSING_API_KEY"):
            print("   แปลว่า: คีย์ไม่ถูกต้อง")
        return 3

    info = (data or {}).get("data") or {}
    amount = info.get("amount") or {}
    sender = info.get("sender") or {}
    receiver = info.get("receiver") or {}
    print("   ผล: ธนาคารพบรายการนี้จริง")
    print("     เลขรายการธนาคาร:", info.get("transRef") or "-")
    print("     วันที่:", info.get("date") or "-")
    print("     ยอดที่โอนจริง:", amount.get("amount"), "บาท",
          "· ตรงกับที่คาดไว้" if amount.get("match") else ("· ไม่ตรงกับที่คาดไว้" if args.amount else ""))
    print("     ผู้โอน:", sender.get("displayName") or sender.get("name") or "-")
    account_info = receiver.get("account") or {}
    print("     บัญชีปลายทาง:", account_info.get("value") or "-",
          "· เป็นบัญชีของกลุ่ม" if account_info.get("match") else "· ไม่ใช่บัญชีของกลุ่ม")
    print()
    print("ถ้าอยากเห็นเคส 'ระบบยืนยันยอดให้อัตโนมัติ' ต้องเป็นสลิปที่โอนเข้าบัญชีโพ้ช้อป")
    print("ด้วยยอดเท่ากับออเดอร์พอดี (เช่น 350 บาท) แล้วแนบผ่านหน้า kuapapoh.com/preorder")
    return 0


if __name__ == "__main__":
    sys.exit(main())
