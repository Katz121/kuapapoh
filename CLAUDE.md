# kuapapoh.com · กฎสำหรับ Claude (ในเครื่องและ cloud session)

**อ่าน `PROJECT_MEMORY.md` ก่อนแก้ทุกครั้ง** (โครงสร้างเว็บ, CMS, ระบบพรีออเดอร์, tracking)

## สำคัญ
- repo นี้เป็น **public** · ห้าม commit ข้อมูลลูกค้า, token, key, secret ใดๆ (secrets อยู่ใน Cloudflare Pages เท่านั้น)
- เนื้อหาหลายส่วน (เช่น #shop) ถูก `cms-loader.js` สร้างจาก `content.json` ตอนโหลดหน้า · แก้ HTML อย่างเดียวจะโดนทับ ต้องแก้ `content.json`
- `site.title` ใน `content.json` ต้องตรงกับ `<title>` เสมอ
- แก้หน้าไทยแล้วต้องแก้หน้าอังกฤษ `/en/` ให้ตรงกันด้วย
- ข้อมูลจริงของโปรเจกต์อยู่ในรูป `images/doc-*.jpg` · อ่านก่อนเดาเนื้อหา

## cloud session (claude.ai/code)
- ทำงานบน branch แล้ว push branch เท่านั้น · **ห้าม push ขึ้น `main` เอง** (main = เว็บจริง · เจ้าของ merge + deploy จากเครื่องหลัก)
- ห้ามรัน `wrangler` / deploy / migration กับ D1 จริง

## commit
Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:` ...)
