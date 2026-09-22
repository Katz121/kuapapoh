ALTER TABLE visits ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE visits ADD COLUMN bot_reason TEXT;
ALTER TABLE visits ADD COLUMN asn INTEGER;       -- request.cf.asn
ALTER TABLE visits ADD COLUMN content TEXT;      -- utm_content (ภาพแอด)
ALTER TABLE visits ADD COLUMN fbp TEXT;          -- cookie _fbp
ALTER TABLE visits ADD COLUMN fbc TEXT;          -- cookie _fbc (มีเวลาคลิกจริงในตัว · backfill ใช้ได้แม้แถวนั้นไม่มี fbclid)
ALTER TABLE visits ADD COLUMN meta_status TEXT;  -- ผลส่ง CAPI สด: 'ok' | 'skip:<why>' | 'err:<code>'
CREATE INDEX IF NOT EXISTS idx_visits_bot ON visits(is_bot, day);
-- ย้อนติดธงบอทรีวิวแอดรอบ 2026-09-21
UPDATE visits SET is_bot = 1, bot_reason = 'meta-ad-review-burst'
 WHERE at >= '2026-09-21T14:57:40' AND at < '2026-09-21T14:58:30';
-- เติม content จาก path เดิมที่มี utm_content
UPDATE visits SET content = substr(path, instr(lower(path),'utm_content=')+12,
  CASE WHEN instr(substr(path, instr(lower(path),'utm_content=')+12), '&') > 0
       THEN instr(substr(path, instr(lower(path),'utm_content=')+12), '&') - 1 ELSE 80 END)
 WHERE content IS NULL AND instr(lower(path),'utm_content=') > 0;
