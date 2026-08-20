# 🧠 KUAPAPOH (กั่วป่าโพ้ จีโชว์เมือง) — PROJECT MEMORY

เอกสารบันทึกความจำและบริบททางวิศวกรรม/ธุรกิจถาวร สำหรับโปรเจกต์เว็บไซต์ **กั่วป่าโพ้ จีโชว์เมือง (Kuapapoh)** ย่านเมืองเก่าตะกั่วป่า จังหวัดพังงา

---

## 📌 1. ข้อมูลระบบและลิงก์หลัก (System Identity & Endpoints)

* **Production URL (Cloudflare Pages):** `https://kuapapoh.pages.dev/`
* **Admin CMS Dashboard:** `https://kuapapoh.pages.dev/admin.html`
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
