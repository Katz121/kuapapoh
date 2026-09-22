-- backfill ป้ายแอดให้แถวเก่าที่มาจากลิงก์เปล่า (มี adid ใน fbclid แต่ไม่มี utm)
-- กฎเดียวกับ track.js: medium ว่าง + fbclid มี adid 3 แบบ (YWRpZA/FkaWQ/hZGlk)
-- หัว IwcGRvZg (pdof) ไม่ใช่สัญญาณแอด · ห้ามใช้

-- 1) นับก่อน ว่าโดนกี่แถว (รันดูก่อนเสมอ)
SELECT COUNT(*) AS ad_no_utm_rows
FROM visits
WHERE (medium IS NULL OR medium = '')
  AND fbclid IS NOT NULL
  AND (instr(fbclid, 'YWRpZA') > 0 OR instr(fbclid, 'FkaWQ') > 0 OR instr(fbclid, 'hZGlk') > 0);

-- 2) อัปเดตแถวเก่า · มี utm/campaign/content อยู่แล้วห้ามทับ
UPDATE visits
SET source = 'facebook',
    medium = 'paid',
    campaign = COALESCE(NULLIF(campaign, ''), '(ad-no-utm)'),
    content = COALESCE(NULLIF(content, ''), 'ไม่ทราบภาพ')
WHERE (medium IS NULL OR medium = '')
  AND fbclid IS NOT NULL
  AND (instr(fbclid, 'YWRpZA') > 0 OR instr(fbclid, 'FkaWQ') > 0 OR instr(fbclid, 'hZGlk') > 0);
