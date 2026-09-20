-- ตรวจสลิปย้อนหลัง + ประวัติทุกการเปลี่ยนแปลงของออเดอร์ + สถานะการซิงก์ Google Sheet
-- รัน: npx wrangler d1 execute kuapapoh --remote --file=migrations/0002_slip_audit.sql

ALTER TABLE preorders ADD COLUMN slip_ref    TEXT;     -- เลขอ้างอิงที่อ่านได้จากคิวอาร์ในตัวสลิป
ALTER TABLE preorders ADD COLUMN slip_hash   TEXT;     -- ลายนิ้วมือไฟล์สลิป (SHA-256)
ALTER TABLE preorders ADD COLUMN sheet_row   INTEGER;  -- แถวใน Google Sheet (ว่าง = ยังไม่ขึ้นชีต)
ALTER TABLE preorders ADD COLUMN sheet_error TEXT;     -- ซิงก์ชีตพลาดเพราะอะไร ไว้กดซิงก์ซ้ำ

-- สลิปใบเดียวกันเอาไปใช้กับสองออเดอร์ไม่ได้
CREATE UNIQUE INDEX IF NOT EXISTS idx_preorders_slip_ref  ON preorders(slip_ref)  WHERE slip_ref  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_preorders_slip_hash ON preorders(slip_hash) WHERE slip_hash IS NOT NULL;

-- ประวัติทุกเหตุการณ์ · ตรวจย้อนหลังได้ว่าใครเปลี่ยนอะไรตอนไหน
CREATE TABLE IF NOT EXISTS preorder_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id  TEXT NOT NULL,
  at        TEXT NOT NULL,              -- ISO8601 UTC
  kind      TEXT NOT NULL,              -- created | slip_attached | status | sheet_synced | sheet_failed | note
  detail    TEXT,                       -- ข้อความอธิบาย เช่น "new → paid"
  actor     TEXT NOT NULL DEFAULT 'system'  -- customer | admin | system
);

CREATE INDEX IF NOT EXISTS idx_events_order ON preorder_events(order_id, at);
