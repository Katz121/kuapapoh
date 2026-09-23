-- 0006_stats.sql · ตารางเส้นกำกับเหตุการณ์ + index กราฟ stats
-- รันซ้ำได้ ใช้ IF NOT EXISTS และ INSERT แบบไม่ซ้ำทั้งหมด

CREATE TABLE IF NOT EXISTS stat_markers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_stat_markers_day ON stat_markers(day);

-- index ตาม report ข้อ 6.3 เร่ง query หน้า stats ที่กรอง day + is_bot + event
CREATE INDEX IF NOT EXISTS idx_visits_day_bot_event ON visits(day, is_bot, event);
CREATE INDEX IF NOT EXISTS idx_visits_session ON visits(session);

-- markers เริ่มต้น ใส่แบบไม่ซ้ำถ้ารันซ้ำ
INSERT INTO stat_markers (day, label, created_at)
SELECT '2026-09-21', 'เปิดแอดเสื้อ', '2026-09-23T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM stat_markers WHERE day = '2026-09-21' AND label = 'เปิดแอดเสื้อ');

INSERT INTO stat_markers (day, label, created_at)
SELECT '2026-09-21', 'LINE broadcast เสื้อ', '2026-09-23T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM stat_markers WHERE day = '2026-09-21' AND label = 'LINE broadcast เสื้อ');

INSERT INTO stat_markers (day, label, created_at)
SELECT '2026-09-23', 'เปิดแอดกระเป๋า', '2026-09-23T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM stat_markers WHERE day = '2026-09-23' AND label = 'เปิดแอดกระเป๋า');

INSERT INTO stat_markers (day, label, created_at)
SELECT '2026-09-23', 'LINE broadcast กระเป๋า', '2026-09-23T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM stat_markers WHERE day = '2026-09-23' AND label = 'LINE broadcast กระเป๋า');
