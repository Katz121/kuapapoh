-- พรีออเดอร์เสื้อเทศกาลกินผัก (งานเจ) · กั่วป่าโพ้
-- รัน: npx wrangler d1 execute kuapapoh --remote --file=migrations/0001_preorders.sql

CREATE TABLE IF NOT EXISTS preorders (
  id          TEXT PRIMARY KEY,           -- KP-XXXXX (โชว์ให้ลูกค้าอ้างอิง)
  created_at  TEXT NOT NULL,              -- ISO8601 UTC
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  contact     TEXT,                       -- LINE / Facebook (ไม่บังคับ)
  items       TEXT NOT NULL,              -- JSON: [{"size":"L","qty":2}]
  qty         INTEGER NOT NULL,
  subtotal    INTEGER NOT NULL,
  shipping    INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  delivery    TEXT NOT NULL,              -- pickup | ship
  address     TEXT,
  note        TEXT,
  has_slip    INTEGER NOT NULL DEFAULT 0,
  client_ref  TEXT,                       -- กันออเดอร์ซ้ำตอนเน็ตหลุดแล้วกดยืนยันใหม่
  ip_hash     TEXT,                       -- ลายนิ้วมือ IP แบบแฮช ใช้นับว่ายิงรัวไหม (ไม่ใช่ IP จริง)
  status      TEXT NOT NULL DEFAULT 'new',-- new | paid | producing | ready | done | cancelled
  admin_note  TEXT
);

CREATE INDEX IF NOT EXISTS idx_preorders_created ON preorders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preorders_status  ON preorders(status);
CREATE INDEX IF NOT EXISTS idx_preorders_phone   ON preorders(phone);
CREATE INDEX IF NOT EXISTS idx_preorders_ip ON preorders(ip_hash, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_preorders_ref ON preorders(client_ref) WHERE client_ref IS NOT NULL;

-- สลิปเก็บแยกตาราง เพื่อให้หน้ารายการโหลดเร็ว (ไม่ลากรูปมาด้วย)
CREATE TABLE IF NOT EXISTS preorder_slips (
  order_id  TEXT PRIMARY KEY REFERENCES preorders(id) ON DELETE CASCADE,
  mime      TEXT NOT NULL,
  data      TEXT NOT NULL,                -- base64 (บีบอัดเป็น webp ฝั่งเบราว์เซอร์แล้ว)
  bytes     INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL
);
