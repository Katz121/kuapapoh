# 🧠 KUAPAPOH (กั่วป่าโพ้ จีโชว์เมือง) · PROJECT MEMORY

เอกสารบันทึกความจำและบริบททางวิศวกรรม/ธุรกิจถาวร สำหรับโปรเจกต์เว็บไซต์ **กั่วป่าโพ้ จีโชว์เมือง (Kuapapoh)** ย่านเมืองเก่าตะกั่วป่า จังหวัดพังงา

---

## 📌 1. ข้อมูลระบบและลิงก์หลัก (System Identity & Endpoints)

* **Production URL:** `https://kuapapoh.com/` (custom domain + www · ผูกกับ Pages project `kuapapoh` เมื่อ 2026-09-11 · `https://kuapapoh.pages.dev/` ยังใช้ได้)
* **Admin CMS Dashboard:** `https://kuapapoh.com/admin.html`
* **Admin Passcode (รหัสผ่านเริ่มต้น):** `78109` (หรือ `admin`)
* **GitHub Repository:** `https://github.com/Katz121/kuapapoh.git` (Branch: `main`)
* **Framework:** Vanilla Jamstack (Zero-Build Static HTML5 / CSS3 / ES6 Vanilla JS)
* **Hosting / Edge CDN:** Cloudflare Pages (Auto-deploy on `git push origin main`)

---

## 🎯 2. จุดประสงค์ของเว็บไซต์ (Core Purpose & Principles)

* **เป้าหมายหลัก:** แสดงผล ถ่ายทอดอัตลักษณ์ และโปรโมทโครงการ **กั่วป่าโพ้ จีโชว์เมือง (Creative Cultural District - Takua Pa)** สนับสนุนโดย CEA และ สจล.
* **ความเร็วและความเสถียร:** ออกแบบให้โหลดเร็วที่สุดบนมือถือ (LCP < 1.0s) เพื่อให้ผู้ที่สแกน QR Code จากโปสเตอร์หรือกดลิงก์จากโซเชียลเปิดได้ทันทีโดยไม่มีหน้าขาวหรือรอโหลด Bundle
* **ความคงทน (Future-Proof):** ใช้ Native Web Standards ไม่มี Framework ขนาดใหญ่ ทำให้ไม่มีปัญหา Dependency Decay หรือเซิร์ฟเวอร์ล่ม

---

## 📋 3. กฎและข้อกำหนดเฉพาะของเนื้อหา (Content & Business Directives)

### 3.1 👕 เสื้อยืดกั่วป่าโพ้ (Official Heritage Merch)
* **ราคา:** **350 บาท** (ปรับจาก 390 บาท)
* **ขนาดไซส์ (Size Chart):** เหลือเฉพาะ **M · L · XL · 2XL** (ตัดไซส์อื่นออกทั้งหมด)
  * M: อก 36" / ยาว 26"
  * L: อก 40" / ยาว 28"
  * XL: อก 44" / ยาว 29"
  * 2XL: อก 48" / ยาว 30"
* **ภาพใน Modal Gallery:** มี 4 ภาพ (ภาพถ่ายแบบ 1, 2, 3 และภาพ 2D กราฟิกลายเสื้อรวม 6 อ. คมชัดเต็มตา)
* **ตารางไซส์:** นำภาพตารางไซส์เดิมออกเนื่องจากมี HTML Table ในตัวแล้ว

### 3.1.1 🧧 เสื้อเทศกาลกินผัก (งานเจ · รอบพรีออเดอร์ · เริ่ม 2026-09-20)
* **ราคา:** **350 บาท** ทุกไซส์ รวมไซส์เด็ก · ค่าส่งไปรษณีย์ 50 บาทต่อออเดอร์ (รับเองที่บ้าน 78 ไม่มีค่าส่ง)
* **ตัวเสื้อ:** สีขาว ผ้าฝ้าย 100% เกรด 32 คอมบ์ · อกซ้ายตราผ้ากันเปื้อน "กั่วป่าโพ้" สีแดง · หลังเป็นบล็อกกราฟิกเทศกาลกินผัก (ศาลเจ้า มังกร เสือ เตาไฟ ประทัด + KUAPAPOH)
* **ไซส์ผู้ใหญ่:** S 32"/25" · M 36"/26" · L 40"/28" · XL 44"/30" · 2XL 48"/31"
* **ไซส์เด็ก:** S 23.5"/16" · M 27.5"/18" · L 31.5"/20"
* **ช่องทางสั่ง:** หน้า `kuapapoh.com/preorder/` (ฟอร์มหน้าเดียว → Cloudflare D1) · LINE เป็นตัวสำรองเท่านั้น
* **หลังบ้าน:** `kuapapoh.com/preorder-admin.html` (ใส่ `ADMIN_TOKEN`) · มีสรุปยอดไซส์ไว้สั่งโรงงาน + ดาวน์โหลด CSV
* **คู่มือเปิดใช้งาน:** `docs/PREORDER_SETUP.md` (D1 binding · ADMIN_TOKEN · ข้อมูลบัญชีโอน · Pixel ID)
* **จ่ายเงิน:** คิวอาร์พร้อมเพย์สร้างในหน้าเว็บเอง (`preorder/promptpay.js` · EMVCo + CRC16) ฝังยอดของออเดอร์นั้น ยอดเปลี่ยนคิวอาร์เปลี่ยนตาม · ใส่เบอร์พร้อมเพย์ที่ `PREORDER.pay.promptpay` ที่เดียว
* **ตรวจสลิปย้อนหลัง:** อ่านคิวอาร์ในตัวสลิปด้วย jsQR เก็บ `slip_ref` + `slip_hash` (unique ทั้งคู่) · สลิปใบเดิมใช้ซ้ำสองออเดอร์ไม่ได้ · ทุกเหตุการณ์ลง `preorder_events` · ค้นย้อนหลังจากเลขออเดอร์/ชื่อ/เบอร์/เลขอ้างอิงสลิป
* **Google Sheet:** ออเดอร์เด้งขึ้นชีตทันทีผ่าน Apps Script Web App (`docs/google-sheet-apps-script.js`) · ชีตของวา id `1bzw2chFI7Xp8UQUmSvnpCca9O2Y8kJc6YCU06w_bEl0` · env `SHEETS_WEBHOOK_URL` + `SHEETS_SECRET` · ชีตล่มไม่กระทบลูกค้า มีปุ่มซิงก์ซ้ำในหน้าหลังบ้าน
* **ราคา/ค่าส่งอยู่ 2 ที่ ต้องแก้ให้ตรงกันเสมอ:** `preorder/index.html` (บล็อก `PREORDER`) และ `functions/api/_shared.js` (ยอดจริงคิดที่เซิร์ฟเวอร์)

### 3.1.2 👜 กระเป๋าผ้าเทศกาลกินผัก + น้องจำปูน
* **สถานะ:** `coming_soon` · ของขายจริงในคอลเลกชันเทศกาลกินผัก (คู่กับเสื้อ) · **ราคา/เนื้อผ้า/ขนาด ยังไม่เคาะ** ห้ามใส่ตัวเลขราคาที่ไหน (การ์ด/modal/JSON-LD ใช้ `เร็ว ๆ นี้` · JSON-LD ไม่มี `offers`) · ปุ่มใน modal เป็นปุ่ม LINE `https://line.me/R/ti/p/%40kuapapoh` ข้อความ "ทักไลน์ให้แจ้งเตือนเมื่อเปิดขาย"
* **id สินค้า:** `je-bag` วางลำดับที่ 2 ต่อจาก `je-shirt` · หมวดใหม่ `กระเป๋า & ของใช้` · tag `เตรียมเปิดขาย · เทศกาลกินผัก` · modal ใหม่ `modal-bag` (แกลเลอรี thumbs 6 ภาพ (กระเป๋าล้วน · วาสั่งตัดภาพท่าทาง+แบบร่างออก ดูยัดเยียด) + เรื่องน้องจำปูน + รายการสเปกสั้น)
* **สเปกที่ประกาศได้:** 2 สี เหลือง · แดง · ลายสกรีนชุดเดียวกับเสื้อเทศกาลกินผัก (ศาลเจ้า มังกร เสือ เตาไฟ ประทัด + KUAPAPOH) มีน้องจำปูนแอบในลาย · พรีเซนเตอร์ น้องจำปูน (สะกด "จำปูน" ทุกที่ · อังกฤษ "Jampoon") · modal มีรายการสเปก `สี: เหลือง · แดง` / `เนื้อผ้า: เร็ว ๆ นี้` / `ขนาด: เร็ว ๆ นี้` / `ราคา: เร็ว ๆ นี้` (อังกฤษ "Coming soon") · ชนิดผ้า/ขนาด/ราคา = "เร็ว ๆ นี้" จนกว่าจะเคาะ · ห้ามระบุวันขาย
* **ไฟล์ภาพ (`images/`):** `je-bag-red-friends.webp` · `je-bag-yellow-friends.webp` · `je-bag-red-jampoon.webp` · `je-bag-yellow-jampoon.webp` · `je-bag-red.webp` · `je-bag-yellow.webp` (ทั้งหมด 1080×1350) · การ์ดใช้ `je-bag-red-friends.webp`
* **แตะ 5 ไฟล์เสมอ:** `index.html` (การ์ด + `modal-bag` + lede + JSON-LD Product ไม่มี offers) · `cms-loader.js` (`SHOP_PRODUCT_IDS` + `PRODUCT_CATALOGUE`) · `content.json` (`shop.products` + `shop.categories` + `shop.lede`) · `en-index.html` (การ์ด + modal อังกฤษสั้น + CSS/JS dialog) · หน้านี้
* **กริด 4 การ์ด:** หน้าไทยใช้ `.shop-grid` ฐาน (4 คอลัมน์ที่ ≥1020px อยู่แล้ว ไม่ต้องมีคลาสเสริม) · หน้าอังกฤษเพิ่มคลาส `.shop-grid.four-products` + CSS เองเพราะฐานเดิมไม่มีกฎ 4 คอลัมน์
* **เรื่องน้องจำปูน (ใช้ได้แค่นี้ ห้ามแต่งเพิ่ม):** แรงบันดาลใจจากดอกจำปูน ดอกไม้ประจำจังหวัดพังงาในคำขวัญจังหวัด · เขียวคืองอกใหม่ เหลืองคือโตเต็มที่ หัวกลีบเขียวตัวกลีบเหลือง · มาจากเวที PHANGNGA MASCOT DESIGN CONTEST (โจทย์เจ้าหน้าที่ฝ่ายประชาสัมพันธ์และฝ่ายสร้างความสุขประจำจังหวัดพังงา) **ได้รางวัลอันดับ 3** · ผู้ออกแบบ **พี่เบิร์ด** (เครดิตใน modal "ออกแบบคาแรกเตอร์โดย พี่เบิร์ด" · อังกฤษ "Character designed by P' Bird") · ปีนี้ใส่ชุดขาวเป็นพรีเซนเตอร์กระเป๋าเทศกาลกินผักตะกั่วป่า · ห้ามเขียนเกินนี้ (ห้ามชื่อรางวัล ปี เงินรางวัล) · ห้ามใส่วันที่เทศกาล

### 3.2 🏮 จุดรับสินค้าหน้าร้าน (Store Pickup Location)
* **ข้อความ:** "รับสินค้าได้ที่บ้าน 78 Studio Takuapa ถนนศรีตะกั่วป่า"
* **พิกัด GPS:** `8.827130055794738, 98.36498044583587`
* **ข้อห้าม:** **ห้ามแสดงตัวเลขพิกัดแบบดิบ ๆ** ต้องครอบด้วยข้อความลิงก์ `📍 เปิดแผนที่นำทาง` ที่เปิด Google Maps แบบปลอดภัย

### 3.3 💰 วัตถุประสงค์รายได้ POH SHOP (Community Fund)
* **ข้อความกำกับส่วน Shop (Lede):**
  > *"สินค้าและของสะสมที่ออกแบบจากอัตลักษณ์เมืองเก่าตะกั่วป่า ร่วมกับช่างฝีมือและคนในชุมชน **รายได้ทั้งหมดจะนำมาสมทบเป็นกองทุนของกลุ่มกั่วป่าโพ้ เพื่อใช้ในการฟื้นฟู ขับเคลื่อนกิจกรรม และดำเนินงานพัฒนาเมืองสร้างสรรค์อย่างต่อเนื่องในปีถัด ๆ ไป**"*

---

## 🎨 4. โครงสร้างและการจัดวางหน้าเว็บ (UI & Layout Specifications)

### 4.1 🏷️ การ์ดลอยสินค้าติดตามหน้าจอ (Floating Sticky Merch Card)
* ลอยมุมขวาล่าง (`bottom: 24px, right: 24px`) สไตล์ Heritage Stamp
* **คลิกตรงไหนก็ได้บนการ์ด** (รูปภาพ, ข้อความ, ราคา, พื้นที่ว่าง) จะเลื่อน (Smooth Scroll) ไปยัง `#shop` ทันที
* **ปุ่มกากบาท `×`** ทำหน้าที่ซ่อนการ์ดชั่วคราว (`e.stopPropagation()`) โดยไม่นำทาง
* **Smart Visibility:** ซ่อนตัวอัตโนมัติ (Fade Out) เมื่อผู้ใช้เลื่อนหน้าจอมาถึงส่วน `#shop` และแสดงกลับมาเมื่อเลื่อนออก
* สามารถเปิด/ปิด, แก้ไขข้อความ, ราคา, และรูปภาพได้จากหน้า Admin

### 4.2 🏛️ ส่วนสามพื้นที่หลัก (Three Houses: บ้าน 78 · 109 · 305)
* โครงสร้าง 3 คอลัมน์สมบูรณ์บน Desktop (`148px 1fr 1.12fr`):
  * **Col 1:** ตัวเลขสีชมพูมาเจนต้าขนาดใหญ่ (`78`, `109`, `305`) + ชื่อสถานที่
  * **Col 2:** แผ่นเพลตสีเหลือง (Aspect Ratio 4:5) ลายเส้นอาคารสีน้ำเงินเข้ม + ภาพถ่ายจริงสแนปช็อตแขวนมุมขวาล่าง
  * **Col 3:** หัวข้อสีน้ำเงินโคบอลต์ + ประวัติความเป็นมา + หมายเหตุการใช้งานสีชมพู + โลโก้

### 4.3 🛍️ ส่วน POH SHOP (โพ้ช็อป)
* การ์ดสินค้า 4 ชิ้นจัดแบบ **Equal-Height Grid**
* หัวข้อสินค้าจำกัด 2 บรรทัด (`min-height: 2.7em`) เพื่อให้คำบรรยายเริ่มต้นที่ระดับความสูงเดียวกัน
* เส้นประ, แถบราคา (`฿350 / ฿120 / ฿150 / ฿290`), และปุ่ม `สั่งซื้อ` อยู่บนระนาบแนวนอนเดียวกัน 100%
* มีปุ่มกรองหมวดหมู่สินค้าอัตโนมัติ (Category Filter Tabs)

---

## ⚙️ 5. สถาปัตยกรรมทางวิศวกรรม (Engineering Architecture)

### 5.1 🛡️ ระบบป้องกัน Git ทับข้อมูล (Anti-Git Overwrite Engine)
* ข้อมูลเว็บไซต์มี 4 ลำดับชั้นในการ Hydrate (`cms-loader.js`):
  1. **Remote Cloud Storage** (ถ้ามีการเชื่อมต่อ URL ใน Admin เช่น JSONBin / Cloudflare KV)
  2. **LocalStorage** (`KUAPAPOH_CONTENT_DATA`)
  3. **Local JSON** (`content.json`)
  4. **Static SSR DOM** (`index.html`)
* **ผลลัพธ์:** การ `git pull` หรือ `git push` โค้ด HTML ใหม่ จะ**ไม่มีวันเขียนทับหรือทำลายข้อมูล**ที่ทีมงานแก้ไขผ่านหน้า Admin

### 5.2 🔤 ระบบจัดการฟอนต์ (Typography Manager)
* ปรับแต่ง Heading Font (Bai Jamjuree, Kanit, Prompt, Chakra Petch, ฯลฯ) และ Body Font (IBM Plex Sans Thai, Sarabun, ฯลฯ) ได้จากหน้า Admin พร้อม Live Preview
* ดึง Google Fonts และคำนวณ CSS Variables (`--display`, `--body`) แบบไดนามิก

### 5.3 🖼️ ระบบบีบอัดภาพในตัว (Client-Side Auto Compression)
* ป้องกันปัญหา LocalStorage Quota Exceeded (5MB Limit)
* ฟังก์ชัน `compressImage()` ใน `admin.html` จะย่อภาพให้มีขนาดด้านยาวไม่เกิน 1200px และแปลงเป็น `image/webp` (Quality 0.85) อัตโนมัติ ทำให้ไฟล์เหลือขนาดเพียง 40KB - 100KB

### 5.4 🔒 มาตรฐานความปลอดภัยและ SEO
* **Security Headers (`_headers`):** `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
* **Performance:** `CLS = 0.00`, Lazy Loading พร้อมระบุ `width`/`height` บนรูปภาพทุกใบ
* **SEO:** `robots.txt`, `sitemap.xml`, OpenGraph, Twitter Cards, และ Schema.org JSON-LD (`TouristDestination` & `ItemList`) ครบถ้วน

### 5.4.1 🧾 ระบบพรีออเดอร์ (Cloudflare Pages Functions + D1)
* `functions/api/preorders.js` รับออเดอร์ · `functions/api/admin/*.js` อ่าน/อัปเดตสถานะ + ดูสลิป · `functions/api/_shared.js` เก็บราคา ไซส์ และตัวตรวจรหัสผู้ดูแล
* ตาราง `preorders` + `preorder_slips` (สลิปแยกตาราง หน้าหลังบ้านจะได้ไม่ลากรูปมาทั้งก้อน)
* **ไม่มี D1 ผูกไว้ = ฟอร์มไม่พัง** ขึ้นปุ่มคัดลอกรายการแล้วเปิด LINE ให้แทน
* **`wrangler.toml` อยู่ใน .gitignore โดยตั้งใจ** ใช้เฉพาะตอนเทสในเครื่อง (`cp wrangler.dev.toml wrangler.toml`) ถ้าหลุดขึ้น production Pages จะอ่าน binding จากไฟล์แทนแดชบอร์ด
* สินค้าใหม่ต้องใส่ทั้ง `content.json` และ `PRODUCT_FALLBACKS` ใน `cms-loader.js` เพราะเครื่องที่เคยเปิดหน้า admin จะอ่านจาก localStorage ไม่แตะ content.json

### 5.5 🔎 SEO รอบ 2 (2026-09-15)
* **`content.json` → `site.title` / `site.description` ต้องตรงกับ `<title>` / `<meta name="description">` ใน `index.html` เสมอ** · cms-loader เขียนทับ title ทุกครั้งที่หน้าโหลด และ Googlebot รัน JS จึงเห็นค่าจาก content.json
* **โดเมนเดียว:** `functions/_middleware.js` 301 `kuapapoh.pages.dev` และ `www.kuapapoh.com` → `kuapapoh.com`
* **หน้าอังกฤษ `/en/`** (`en/index.html`) เป็น static ล้วน ไม่ผ่าน CMS · แก้เนื้อหาหน้าไทยเรื่องไหน (ราคา สินค้า วันเปิด นิทรรศการ) ต้องแก้ `/en/` ตามด้วย · hreflang th/en/x-default อยู่ทั้งสองหน้า + sitemap
* ส่วน FAQ (`#faq`) มี `FAQPage` ใน JSON-LD คู่กัน · แก้คำถามต้องแก้ทั้งสองที่ให้ตรงกันทุกตัวอักษร
* `llms.txt` สรุปข้อเท็จจริงให้ AI search · `404.html` คืน status 404 · `robots.txt` อนุญาต AI crawler ชัดเจน

---

## 📈 6. สถิติคนเข้าเว็บ + Meta Pixel (เริ่ม 2026-09-20)

**Pixel ID `1560330288622338` (Kuapapoh Web · ธุรกิจของ Siwatid Singhakarn) · ใส่แล้ว 2026-09-21** · สร้างผ่าน API ไม่ได้ (MCP ไม่มีคำสั่ง · token ไม่มี ads_management) ต้องกดใน Business Settings → ชุดข้อมูล

* `pixel.js` ยิงทุก event เข้า `POST /api/track` → ตาราง `visits` ใน D1 เสมอ · ถ้าใส่ Pixel ID แล้วจะยิงเข้า Meta เพิ่มอีกทางพร้อมกัน
* ทุก event มี `event_id` ของตัวเอง · วันที่มี Pixel แล้วเอาของเก่าส่งย้อนเข้า Conversions API ได้โดย Meta ไม่นับซ้ำ (คอลัมน์ `sent_meta` ไว้กันส่งซ้ำรอบสอง)
* เก็บ `fbclid` + `utm_*` ทั้งรอบการเข้าเว็บ · คนกดจากแอดเข้าหน้าแรกก่อนแล้วค่อยไปสั่ง ยังผูกยอดกลับไปหาแอดได้
* ดูผลที่ `kuapapoh.com/stats.html` (รหัสเดียวกับหน้าแอดมิน) · มีกรวยลูกค้า เปิดเว็บ → ดูเสื้อ → เลือกไซส์ → เริ่มกรอก → สั่งสำเร็จ
* ความเป็นส่วนตัว: เก็บไอดีสุ่มฝั่งเบราว์เซอร์ ไม่เก็บชื่อ/เบอร์ · ไอพีแฮชแล้วใช้กันสแปมอย่างเดียว · referrer เก็บแค่ชื่อโดเมน
* ด่านกันยิงมั่ว: รับเฉพาะชื่อ event ที่รู้จัก · บอดี้ไม่เกิน 4KB · 300 ครั้ง/10 นาที/ไอพี · `event_id` ซ้ำถูกทิ้ง
* ไมเกรชัน `migrations/0004_visits.sql` (รันขึ้น production แล้ว)
* **เอาข้อมูลไปใช้ต่อ**
  * ตาราง "ยอดขายมาจากทางไหน" ในหน้าสถิติ · Purchase ทุกรายการผูก `order_id` ไว้ ต่อกับตาราง `preorders` ได้ตรงๆ
  * ปุ่มดาวน์โหลด CSV (`/api/admin/visits-export?days=N`) เปิดใน Excel/Sheet ได้ · ไม่ส่ง `ip_hash` ออกไปในไฟล์
  * `scripts/meta_backfill.py` ส่งย้อนเข้า Meta Conversions API · ดูก่อนด้วย `--days 7` แล้วเติม `--send`
    ใช้ `event_id` กันนับซ้ำ · แปลง `fbclid` เป็น `fbc` · ดึงชื่อ/เบอร์จากออเดอร์มาแฮช SHA-256 ให้ Meta จับคู่คนได้แม่นขึ้น
    ⚠️ Meta นับเป็นคอนเวอร์ชันของแอดเฉพาะ event ที่ย้อนหลังไม่เกิน 7 วัน

### Meta Pixel

* สคริปต์กลาง `pixel.js` โหลดทั้งหน้าไทย หน้าอังกฤษ และหน้าพรีออเดอร์ · ใส่ Pixel ID ที่บรรทัดเดียวในไฟล์นั้น (ว่าง = ไม่ยิงอะไรเลย ไม่มี error)
* Event: `PageView` · `ViewContent` (เปิดหน้าพรีออเดอร์) · `AddToCart` (เลือกไซส์ครั้งแรก) · `InitiateCheckout` (เริ่มกรอก) · `Purchase` (ส่งออเดอร์สำเร็จ ส่งยอดจริง) · `Lead` (กดไป LINE ตอนระบบมีปัญหา)
* เรียกผ่าน `window.kpTrack('ชื่อ event', { value: ... })` เสมอ ห้ามเรียก `fbq` ตรง เพราะหน้าจะพังถ้ายังไม่ได้ใส่ ID
