-- ผลการตรวจสลิปกับระบบธนาคาร (ผ่าน Thunder Solution API)
-- รัน: npx wrangler d1 execute kuapapoh --remote --file=migrations/0003_slip_verify.sql

ALTER TABLE preorders ADD COLUMN slip_checked   TEXT;     -- เวลาที่ตรวจ (ISO8601) · ว่าง = ยังไม่ได้ตรวจ
ALTER TABLE preorders ADD COLUMN slip_verified  INTEGER;  -- 1 = ธนาคารยืนยันว่าโอนจริง · 0 = ไม่ผ่าน · ว่าง = ตรวจไม่ได้
ALTER TABLE preorders ADD COLUMN slip_note      TEXT;     -- ผลตรวจแบบอ่านได้ เช่น "เงินเข้าจริง ยอดตรง บัญชีตรง"
ALTER TABLE preorders ADD COLUMN slip_amount    REAL;     -- ยอดที่ธนาคารบอกว่าโอนมาจริง
ALTER TABLE preorders ADD COLUMN slip_sender    TEXT;     -- ชื่อผู้โอนตามข้อมูลธนาคาร
ALTER TABLE preorders ADD COLUMN slip_trans_ref TEXT;     -- เลขรายการของธนาคาร

CREATE INDEX IF NOT EXISTS idx_preorders_verified ON preorders(slip_verified);
