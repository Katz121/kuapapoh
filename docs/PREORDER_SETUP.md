# ระบบพรีออเดอร์เสื้อเทศกาลกินผัก · คู่มือเปิดใช้งาน

อัปเดต 2026-09-20 · ของทั้งหมดเขียนเสร็จและทดสอบในเครื่องแล้ว เหลือ 4 ขั้นที่ต้องกดบน Cloudflare/Meta

| ส่วน | ไฟล์ | สถานะ |
|---|---|---|
| หน้าสั่งซื้อ | `preorder/index.html` | เสร็จ |
| API รับออเดอร์ | `functions/api/preorders.js` | เสร็จ |
| API หลังบ้าน | `functions/api/admin/preorders.js` · `functions/api/admin/slip.js` | เสร็จ |
| หน้าจัดการออเดอร์ | `preorder-admin.html` | เสร็จ |
| ตารางฐานข้อมูล | `migrations/0001_preorders.sql` | รอรันบน D1 จริง |
| Meta Pixel | `pixel.js` | รอใส่ Pixel ID |

---

## 1 · สร้างฐานข้อมูล D1 และผูกกับเว็บ

```bash
cd D:/Takuapa
npx wrangler d1 create kuapapoh          # จดค่า database_id ที่ได้
npx wrangler d1 execute kuapapoh --remote --file=migrations/0001_preorders.sql
```

จากนั้นที่ **Cloudflare Dashboard → Workers & Pages → kuapapoh → Settings → Bindings**

* เพิ่ม **D1 database binding** ชื่อตัวแปร `DB` → เลือกฐานข้อมูล `kuapapoh`
* เพิ่มทั้ง Production และ Preview

## 2 · ตั้งรหัสผู้ดูแล (และแจ้งเตือน ถ้าต้องการ)

ที่เดียวกัน หัวข้อ **Environment variables / Secrets**

| ชื่อ | ค่า | จำเป็น |
|---|---|---|
| `ADMIN_TOKEN` | รหัสที่ใช้เข้า `kuapapoh.com/preorder-admin.html` (ตั้งยาว ๆ) | ใช่ |
| `TELEGRAM_BOT_TOKEN` | โทเคนบอท ถ้าอยากให้เด้งเตือนทุกออเดอร์ | ไม่ |
| `TELEGRAM_CHAT_ID` | ไอดีห้องที่จะให้บอทส่งเข้า | ไม่ |

ตั้งเป็น **Secret** (ไม่ใช่ plain text) แล้ว deploy ใหม่หนึ่งรอบให้ค่ามีผล

## 3 · เติมข้อมูลการโอนเงินในหน้าสั่งซื้อ

แก้ที่ `preorder/index.html` บล็อก `var PREORDER = {` บล็อกเดียวจบ

```js
closeText: 'ปิดรับ 5 ต.ค.',            // ป้ายมุมขวาบน
pay: {
  bank: 'ธนาคารกสิกรไทย',
  number: '123-4-56789-0',            // เลขบัญชีหรือเบอร์พร้อมเพย์
  name: 'ชื่อบัญชีตามสมุด',
  qr: '../images/preorder-qr.png'     // ใส่รูป QR ไว้ใน images/ แล้วชี้มาที่นี่ (เว้นว่าง = ไม่โชว์)
}
```

ค่าส่ง (`shipping: 50`) และราคา (`price: 350`) อยู่บล็อกเดียวกัน
**ถ้าแก้ราคา/ค่าส่ง ต้องแก้ `functions/api/_shared.js` ให้ตรงกันด้วย** เพราะยอดจริงคิดที่เซิร์ฟเวอร์

## 4 · Meta Pixel

1. Events Manager → Connect Data Sources → Web → ตั้งชื่อ `Kuapapoh Web` → ได้ตัวเลข Pixel ID
2. เปิด `pixel.js` ใส่เลขในบรรทัด `var PIXEL_ID = '';`
3. deploy แล้วเช็คด้วยส่วนขยาย Meta Pixel Helper ว่าเห็น PageView

Event ที่ยิงให้อัตโนมัติแล้ว

| Event | ยิงเมื่อ | ใช้ทำอะไร |
|---|---|---|
| `PageView` | เปิดหน้าไหนก็ได้ | ทำกลุ่มคนเข้าเว็บ |
| `ViewContent` | เปิดหน้า `/preorder/` | กลุ่มคนสนใจเสื้อ ไว้ยิงแอดตาม |
| `AddToCart` | กดเลือกไซส์ครั้งแรก | คนตั้งใจซื้อ · ใช้ทำ Lookalike |
| `InitiateCheckout` | เริ่มกรอกฟอร์ม | ดูว่าหลุดตรงไหน |
| `Purchase` | ส่งออเดอร์สำเร็จ (ส่งยอดเงินจริง) | วัด ROAS ของแอด |
| `Lead` | กดปุ่ม LINE ตอนระบบมีปัญหา | กันข้อมูลหาย |

---

## ทดสอบในเครื่องก่อน push

```bash
cd D:/Takuapa
cp wrangler.dev.toml wrangler.toml                                   # Pages dev ต้องชื่อนี้เท่านั้น
npx wrangler d1 execute kuapapoh --local --file=migrations/0001_preorders.sql
npx wrangler pages dev --port 8788
# เปิด http://127.0.0.1:8788/preorder/ และ /preorder-admin.html (รหัส devtoken)
rm wrangler.toml                                                     # ห้ามหลุดขึ้น production
```

`wrangler.toml` อยู่ใน `.gitignore` แล้ว ถ้าไฟล์นี้ขึ้น production Pages จะอ่านค่าจากไฟล์แทนที่ผูกไว้ในแดชบอร์ด แล้ว D1 จะชี้ผิดฐาน

## งานประจำวันหลังเปิดรอบ

1. เปิด `kuapapoh.com/preorder-admin.html` ใส่ `ADMIN_TOKEN`
2. ออเดอร์ใหม่ขึ้นสถานะ **ใหม่** → กดดูสลิป → ถ้ายอดตรงเปลี่ยนเป็น **ยืนยันยอด**
3. ปิดรอบแล้วดูแถบสรุปไซส์ด้านบน (เช่น `L · 12 ตัว`) ใช้ตัวเลขนี้สั่งโรงงานรอบเดียว
4. กด **ดาวน์โหลด CSV** ส่งให้คนแพ็ค/จ่าหน้าซอง
5. ของถึง → เปลี่ยนสถานะเป็น **ของพร้อม** แล้วทัก LINE ตามเบอร์ในตาราง

## สิ่งที่ระบบกันไว้แล้ว

* ยอดเงินคิดที่เซิร์ฟเวอร์เสมอ แก้ราคาในเบราว์เซอร์ไม่มีผล
* ไซส์ซ้ำในออเดอร์เดียวถูกยุบรวมอัตโนมัติ (L 2 ตัว + L 1 ตัว = L 3 ตัว)
* สลิปจากกล้องมือถือถูกย่อเป็น webp ก่อนส่ง และจำกัดไม่เกิน 400KB
* ถ้า D1 ล่มหรือยังไม่ได้ผูก ฟอร์มจะขึ้นปุ่ม "คัดลอกรายการแล้วเปิด LINE" ให้ลูกค้าสั่งต่อได้ทันที
* กดยืนยันซ้ำตอนเน็ตหลุดไม่ทำให้เกิดออเดอร์ซ้ำ (ส่ง `clientRef` เดิม ระบบคืนออเดอร์เดิมกลับมา)
* สลิปเก็บคนละตารางกับออเดอร์ หน้าหลังบ้านจึงโหลดเร็วแม้มีหลายร้อยออเดอร์
