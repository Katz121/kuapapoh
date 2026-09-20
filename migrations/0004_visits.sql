-- เก็บสถิติคนเข้าเว็บด้วยตัวเอง ระหว่างที่ยังไม่มี Meta Pixel
-- รัน: npx wrangler d1 execute kuapapoh --remote --file=migrations/0004_visits.sql
--
-- ทำไมต้องเก็บเอง: Pixel เริ่มนับวันที่ติดตั้ง ของก่อนหน้านั้นหายหมด
-- ตารางนี้เก็บไว้ก่อน พอมี Pixel ID แล้วค่อยส่งย้อนเข้า Conversions API ได้
-- โดยใช้ event_id กันไม่ให้ Meta นับซ้ำกับที่ Pixel ยิงเอง

CREATE TABLE IF NOT EXISTS visits (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT NOT NULL,      -- ISO8601 UTC
  day       TEXT NOT NULL,      -- YYYY-MM-DD เวลาไทย · ไว้จัดกลุ่มรายวันตรงกับที่คนอ่านเข้าใจ
  event     TEXT NOT NULL,      -- PageView | ViewContent | AddToCart | InitiateCheckout | Purchase | Lead
  event_id  TEXT,               -- ไอดีรายการ · ส่งเข้า Conversions API ทีหลังแล้วไม่ถูกนับซ้ำ
  visitor   TEXT,               -- ไอดีสุ่มฝั่งเบราว์เซอร์ · ไม่ผูกกับชื่อหรือเบอร์ใคร
  session   TEXT,               -- ไอดีรอบการเข้าเว็บ (ปิดแท็บแล้วหาย)
  path      TEXT,               -- หน้าที่อยู่ตอนยิง
  referrer  TEXT,               -- โดเมนที่พามา เช่น facebook.com (ไม่เก็บ URL เต็ม)
  source    TEXT,               -- utm_source
  medium    TEXT,               -- utm_medium
  campaign  TEXT,               -- utm_campaign
  fbclid    TEXT,               -- ติดมากับลิงก์จากเฟซบุ๊ก · เป็นกุญแจเชื่อมยอดขายกลับไปหาแอด
  value     REAL,               -- ยอดเงินของรายการนั้น (เฉพาะ Purchase/Checkout)
  currency  TEXT,
  order_id  TEXT,               -- ผูกกับตารางออเดอร์ได้ตรงๆ เมื่อเป็น Purchase
  country   TEXT,               -- จาก Cloudflare
  ua        TEXT,               -- เบราว์เซอร์แบบย่อ ไม่ใช่ user-agent เต็ม
  ip_hash   TEXT,               -- ไอพีที่แฮชแล้ว · ใช้กันสแปมอย่างเดียว ย้อนกลับเป็นไอพีไม่ได้
  sent_meta INTEGER NOT NULL DEFAULT 0   -- 1 = ส่งเข้า Meta ย้อนหลังแล้ว
);

-- ยิงซ้ำจากการรีเฟรชหรือเน็ตกระตุก ไม่ควรกลายเป็นสองแถว
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_event_id ON visits(event_id) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visits_day     ON visits(day, event);
CREATE INDEX IF NOT EXISTS idx_visits_at      ON visits(at);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor);
CREATE INDEX IF NOT EXISTS idx_visits_ip      ON visits(ip_hash, at);
CREATE INDEX IF NOT EXISTS idx_visits_fbclid  ON visits(fbclid) WHERE fbclid IS NOT NULL;
