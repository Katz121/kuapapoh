# Tracking v2 · spec (kuapapoh.com)

เป้าหมาย: ข้อมูลที่ Meta และหน้า stats ได้รับต้อง "จริงและมีค่า" · ตัดบอท · ส่ง server event สดเข้า Pixel ที่แอดใช้ · รู้ว่าภาพแอดไหนขายได้

## ปัญหาที่เจอ (2026-09-22)
- ใช้ 2 Pixel · A `1560330288622338` ไม่มีแคมเปญไหนใช้ (เช็คแล้ว) · แอด Sales optimize Purchase บน B `1621493986432899` เท่านั้น
- บอทรีวิวแอดของ Meta ยิง PageView→ViewContent→InitiateCheckout ~20 ไอพีภายใน 30 วินาที (2026-09-21 14:57:46–14:58:20 UTC) ปนเข้า D1 และถูก backfill ส่งเข้า B
- B ไม่มี server event สด (backfill มือเท่านั้น) · Meta แนะนำส่งภายใน 1 ชม.
- ไม่เก็บ utm_content → ไม่รู้ว่าภาพ goldenhour/mural/fullshirt ตัวไหนพาคนซื้อ
- ไม่เก็บ cookie `_fbp`/`_fbc` → match quality ต่ำ

## งาน

### 1. `migrations/0005_visits_quality.sql` (additive เท่านั้น · ห้าม DROP)
```sql
ALTER TABLE visits ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE visits ADD COLUMN bot_reason TEXT;
ALTER TABLE visits ADD COLUMN asn INTEGER;       -- request.cf.asn
ALTER TABLE visits ADD COLUMN content TEXT;      -- utm_content (ภาพแอด)
ALTER TABLE visits ADD COLUMN fbp TEXT;          -- cookie _fbp
ALTER TABLE visits ADD COLUMN meta_status TEXT;  -- ผลส่ง CAPI สด: 'ok' | 'skip:<why>' | 'err:<code>'
CREATE INDEX IF NOT EXISTS idx_visits_bot ON visits(is_bot, day);
-- ย้อนติดธงบอทรีวิวแอดรอบ 2026-09-21
UPDATE visits SET is_bot = 1, bot_reason = 'meta-ad-review-burst'
 WHERE at >= '2026-09-21T14:57:40' AND at < '2026-09-21T14:58:30';
-- เติม content จาก path เดิมที่มี utm_content
UPDATE visits SET content = substr(path, instr(path,'utm_content=')+12,
  CASE WHEN instr(substr(path, instr(path,'utm_content=')+12), '&') > 0
       THEN instr(substr(path, instr(path,'utm_content=')+12), '&') - 1 ELSE 40 END)
 WHERE content IS NULL AND instr(path,'utm_content=') > 0;
```

### 2. `pixel.js`
- `PIXEL_IDS = ['1621493986432899']` (ตัด A ออก · อัปเดตคอมเมนต์ว่าทำไม)
- เก็บ `utm_content` เข้า campaign (ใน sessionStorage `kp_cnt` เหมือนตัวอื่น) และส่งเป็น `content`
- อ่าน cookie `_fbp` และ `_fbc` (ถ้ามี) ส่งเป็น `fbp` / `fbc` ใน payload
- ส่ง `wd: navigator.webdriver === true`
- ถ้า `navigator.webdriver === true` → **ไม่เรียก fbq** (ยังส่งเข้า /api/track เพื่อให้ server ติดธงบอท)
- ห้ามเปลี่ยน API `window.kpTrack` / `kpPending`

### 3. `functions/api/_meta.js` (ไฟล์ใหม่) · ส่ง Conversions API
- `export async function sendCapi(env, event)` · POST `https://graph.facebook.com/v21.0/{env.META_PIXEL_ID}/events` body `{data:[event], access_token, appsecret_proof?}`
- `appsecret_proof` = HMAC-SHA256(key=META_APP_SECRET, msg=META_CAPI_TOKEN) hex ด้วย crypto.subtle (ใส่เมื่อมี secret)
- คืน `{ ok, status, code }` · ห้าม throw · timeout ~4s ด้วย AbortController
- `export async function sha256Hex(text)` · normalize ตามกฎ Meta (trim + lowercase)
- `export function phoneForMeta(phone)` · ตัวเลขล้วน, 0 นำหน้า → 66 (ดู `phone_for_meta` ใน scripts/meta_backfill.py ให้ตรงกัน)

### 4. `functions/api/track.js`
- เปลี่ยน signature เป็น `onRequestPost(context)` แล้วใช้ `context.waitUntil` (ดูแบบใน preorders.js บรรทัด ~201)
- รับเพิ่ม: `content`(80) `fbp`(120) `fbc`(300) `wd`
- **ตรวจบอท** → `is_bot`, `bot_reason`:
  - UA เต็ม match `/facebookexternalhit|facebookcatalog|Facebot|meta-externalagent|meta-externalfetcher|bot\b|crawler|spider|HeadlessChrome|Lighthouse|PTST|python-requests|curl\//i` → `ua`
  - `cf.asn` อยู่ใน `[32934, 63293, 54115]` (ASN ของ Meta) → `asn-meta`
  - `wd === true` → `webdriver`
  - ไม่มี UA → `no-ua`
  - เก็บ `asn` ทุกแถว (ไว้พิสูจน์ย้อนหลังว่าบอทมาจาก ASN ไหน)
- rate limit เดิมคงไว้
- INSERT เพิ่มคอลัมน์ใหม่
- **CAPI สด** (หลัง insert สำเร็จ ผ่าน waitUntil):
  - ส่งเมื่อ: `!is_bot` และมี `env.META_PIXEL_ID` + `env.META_CAPI_TOKEN` และ event อยู่ใน EVENTS
  - ไม่ส่ง → `meta_status='skip:bot'` หรือ `'skip:nocfg'`
  - `user_data`: `client_ip_address` = cf-connecting-ip (**ส่งอย่างเดียว ห้ามเก็บลง DB**), `client_user_agent` = UA เต็ม (ห้ามเก็บ), `fbc` = cookie `_fbc` ถ้ามี ไม่งั้นสร้าง `fb.1.<ms ตอนนี้>.<fbclid>` ถ้ามี fbclid, `fbp`, `external_id` = sha256(visitor), `country` = sha256(lower(cf.country))
  - Purchase ที่มี `order_id` → ดึง `name, phone` จาก `preorders` แล้วใส่ `ph`, `fn`, `ln` แฮชแบบเดียวกับ backfill
  - `event_id` = eventId เดิม (dedup กับ browser) · `event_time` = วินาทีตอนนี้ · `action_source:'website'` · `event_source_url` = `https://kuapapoh.com` + path
  - `custom_data` เมื่อมี value: `{currency, value, content_ids:['je-shirt'], content_type:'product', order_id?}`
  - ผล ok → `UPDATE visits SET sent_meta=1, meta_status='ok' WHERE event_id=?` · พลาด → `meta_status='err:<status/code>'`
- ห้าม log ข้อมูลส่วนตัว · ทุก error เงียบ ตอบ 204 เหมือนเดิม

### 5. `functions/api/admin/visits.js` + `stats.html`
- ทุก query ที่นับสถิติ เพิ่ม `AND is_bot = 0`
- เพิ่ม query: จำนวนแถวบอทในช่วง (`bots`)
- เพิ่ม query **ภาพแอดไหนขายได้** (เฉพาะ is_bot=0, content ไม่ว่าง): group by `content` → `people_vc` (COUNT DISTINCT visitor ที่ ViewContent), `people_ic` (InitiateCheckout), `orders` (Purchase), `revenue`
  - ⚠️ utm_content ติดแค่ pageview แรกของ session · ให้ผูก content ระดับ `session`: `WITH s AS (SELECT session, MAX(content) content FROM visits WHERE day>=? AND is_bot=0 AND content IS NOT NULL GROUP BY session)` แล้ว join event ตาม session
- เพิ่ม query สถานะ CAPI สด: `GROUP BY meta_status` ในช่วง
- `stats.html`: เพิ่มตาราง "ภาพแอดไหนพาคนซื้อ" + บรรทัด "ตัดบอทออกแล้ว N แถว" + "ส่งเข้า Meta สด: ok X / err Y" · สไตล์ตามตารางเดิมในไฟล์
- `visits-export.js`: เพิ่มคอลัมน์ใหม่ใน CSV

### 6. `scripts/meta_backfill.py`
- WHERE เพิ่ม `is_bot = 0`
- `--resend` ต้องมี `--since YYYY-MM-DDTHH:MM` คู่กันเสมอ ไม่งั้น exit พร้อมข้อความ (กันส่งประวัติซ้ำทั้งก้อน เพราะ Meta ไม่ dedup server+server)
- ใส่ `fbp` ถ้ามีในแถว

## กติกา
- โค้ดสไตล์เดียวกับไฟล์เดิม: คอมเมนต์ภาษาไทยสั้นๆ บอก "ทำไม" · ไม่ใช้ em-dash
- ห้าม git init / commit / push · ห้ามรัน wrangler ขึ้น remote · ห้ามแตะ secrets
- ทดสอบ syntax: `node --check` ทุกไฟล์ JS ที่แก้ · `python -m py_compile scripts/meta_backfill.py`
- จบแล้วสรุปไฟล์ที่แก้ + จุดที่ไม่แน่ใจ
