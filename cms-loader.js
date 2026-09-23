/**
 * กั่วป่าโพ้ · Dynamic CMS Engine & Typography Hydrator
 * รองรับการจัดการฟอนต์, การเพิ่ม/ลบ/จัดหมวดหมู่สินค้า, กิจกรรม, และรูปภาพอิสระ 100%
 * ป้องกันการโดนทับเมื่อมีการ git pull / git push
 */
(function() {
  const STORAGE_KEY = 'KUAPAPOH_CONTENT_DATA';
  const CONFIG_KEY = 'KUAPAPOH_SYNC_CONFIG';

  // Dynamic Font Loader Helper
  function applyTypography(typo) {
    if (!typo) return;
    try {
      const headingFont = typo.headingFont || 'Bai Jamjuree';
      const bodyFont = typo.bodyFont || 'IBM Plex Sans Thai';
      const baseSize = typo.baseSize || '16px';
      const headingWeight = typo.headingWeight || '700';

      // Load fonts from Google Fonts if not already loaded
      const fontsToLoad = [headingFont, bodyFont];
      if (typo.customGoogleFont) fontsToLoad.push(typo.customGoogleFont);
      
      const fontFamilies = [...new Set(fontsToLoad)].map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&');
      const fontUrl = `https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`;
      
      let linkEl = document.getElementById('dynamic-google-fonts');
      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.id = 'dynamic-google-fonts';
        linkEl.rel = 'stylesheet';
        document.head.appendChild(linkEl);
      }
      linkEl.href = fontUrl;

      // Apply CSS variables & Styles
      document.documentElement.style.setProperty('--display', `'${headingFont}', sans-serif`);
      document.documentElement.style.setProperty('--body', `'${bodyFont}', sans-serif`);
      if (baseSize) document.body.style.fontSize = baseSize;
      
      let styleTag = document.getElementById('dynamic-typo-style');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-typo-style';
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = `
        h1, h2, h3, .tag, .brand-badge, .kicker, .six-num { font-family: '${headingFont}', sans-serif !important; font-weight: ${headingWeight} !important; }
        body, p, span, a, li, input, textarea, button { font-family: '${bodyFont}', sans-serif; }
      `;
    } catch (e) {
      console.warn('Typography loading error:', e);
    }
  }

  // เขียนทับข้อความเฉพาะเมื่อค่าต่างจากของเดิม · กัน LCP/เลย์เอาต์ขยับ
  // เพราะการเซ็ต textContent/innerHTML ซ้ำค่าจะทำให้เบราว์เซอร์จัดเลย์เอาต์ใหม่
  // (เรียกใช้โดยคง guard เดิมของแต่ละจุดไว้ พฤติกรรมอื่นไม่เปลี่ยน)
  function setText(el, v) {
    if (el.textContent !== v) el.textContent = v;
  }
  function setHTML(el, v) {
    if (el.innerHTML !== v) el.innerHTML = v;
  }

  // Current shop mode: the vegetarian-festival shirt (pre-order round) leads,
  // then the heritage shirt + Poh Sparkling Tea.
  // (old placeholder products in saved CMS data stay hidden).
  const SHOP_PRODUCT_IDS = ['je-shirt', 'je-bag', 'shirt', 'poh'];

  // ═══ รายการสินค้าอยู่ในโค้ด ไม่ใช่ในข้อมูลที่บันทึกไว้ ═══
  // เพราะเครื่องที่เคยเปิดหน้า admin จะอ่านจาก localStorage ก่อนเสมอ
  // ถ้าปล่อยให้ข้อมูลเก่ากำหนดรายการสินค้า สินค้าใหม่จะไม่ขึ้น และบางเครื่องกริดจะว่างเปล่า
  // ข้อมูลที่บันทึกไว้จะถูกใช้แค่ "ทับข้อความ" ของสินค้าที่มีอยู่ในรายการนี้เท่านั้น
  const PRODUCT_CATALOGUE = {
    'je-shirt': {
      "id": "je-shirt",
      "category": "เสื้อผ้า & แฟชั่น",
      "tag": "พรีออเดอร์ · เทศกาลกินผัก",
      "name": "เสื้อเทศกาลกินผัก กั่วป่าโพ้",
      "price": 350,
      "priceLabel": "฿350",
      "desc": "เสื้อยืดสีขาว อกซ้ายเป็นตราผ้ากันเปื้อนกั่วป่าโพ้สีแดง ด้านหลังรวมสัญลักษณ์เทศกาลกินผักของตะกั่วป่า ศาลเจ้า มังกร เสือ และเตาไฟ",
      "meta": "ผ้าฝ้าย 100% เกรด 32 คอมบ์ · ไซส์ผู้ใหญ่ S-2XL และไซส์เด็ก S-L",
      "image": "images/je-shirt.webp",
      "imageWidth": 1400,
      "imageHeight": 935,
      "imageAlt": "ลายหลังเสื้อเทศกาลกินผักกั่วป่าโพ้ ศาลเจ้า มังกร เสือ และเตาไฟ",
      "hasModal": true,
      "modalId": "modal-je",
      "modalCta": "🧧 ดูลายเสื้อ & ตารางไซส์ →",
      "shotOverlay": "🧧 ดูลายเสื้อ",
      "status": "preorder",
      "buyUrl": "preorder/",
      "buyLabel": "สั่งพรีออเดอร์"
    },
    'je-bag': {
      "id": "je-bag",
      "category": "กระเป๋า & ของใช้",
      "tag": "จำนวนจำกัด · เทศกาลกินผัก",
      "name": "กระเป๋าผ้าเทศกาลกินผัก กั่วป่าโพ้",
      "price": 250,
      "priceLabel": "฿250",
      "desc": "กระเป๋าผ้าลายเดียวกับเสื้อเทศกาลกินผัก รวมศาลเจ้า มังกร เสือ เตาไฟ ประทัด และตัวหนังสือ KUAPAPOH ลองหาน้องจำปูนที่แอบอยู่ในลายด้วย ทำจำนวนจำกัด ช้าหมดอด",
      "meta": "ผ้าแคนวาส · 13 x 15 นิ้ว · เหลือง / แดง",
      "image": "images/je-bag-red-friends.webp",
      "imageWidth": 1080,
      "imageHeight": 1350,
      "imageAlt": "กระเป๋าผ้าสีแดงลายเทศกาลกินผัก มีน้องจำปูนสามตัวเกาะหูกระเป๋า",
      "shotStyle": "photo",
      "hasModal": true,
      "modalId": "modal-bag",
      "modalCta": "👜 ดูกระเป๋า 2 สี & เรื่องน้องจำปูน →",
      "shotOverlay": "👜 ดูทั้งคอลเลกชัน",
      "status": "preorder",
      "buyUrl": "preorder/#bag",
      "buyLabel": "สั่งกระเป๋า"
    },
    'shirt': {
      "id": "shirt",
      "tag": "Official Merch",
      "name": "เสื้อยืดกั่วป่าโพ้ KUAPAPOH",
      "price": 350,
      "priceLabel": "฿350",
      "desc": "เสื้อยืดสีดำพรีเมียม สกรีนตรากั่วป่าโพ้ที่อกซ้าย ด้านหลังจัดเต็มกราฟิกลายรวมอัตลักษณ์ตะกั่วป่า 6 อ.",
      "meta": "ผ้าฝ้าย Comb 100% · ไซส์ M · L · XL · 2XL",
      "image": "images/shirt-poh.webp",
      "hasModal": true,
      "modalTag": "Official Heritage Merch",
      "modalLead": "เสื้อยืดสีดำพรีเมียม ถ่ายทอดเรื่องราวและสถาปัตยกรรมมีชีวิตของย่านเมืองเก่าตะกั่วป่า จังหวัดพังงา ออกแบบร่วมกับศิลปินและคนในชุมชน",
      "modalDelivery": "จัดส่งทั่วประเทศ",
      "modalNote": "* มีจำหน่ายเฉพาะไซส์ M · L · XL · 2XL | ผ้าฝ้าย Cotton 100% เกรด Comb ผ้านุ่ม ใส่สบาย ระบายอากาศดี | คลิกแท็บ \"ภาพ 2D\" ที่แกลเลอรีเพื่อดูลวดลายกราฟิกแบบเต็มตา",
      "gallery": [
        {
          "label": "แบบ 1",
          "src": "images/model-shirt-1.webp"
        },
        {
          "label": "แบบ 2",
          "src": "images/model-shirt-2.webp"
        },
        {
          "label": "แบบ 3",
          "src": "images/model-shirt-3.webp"
        },
        {
          "label": "ภาพ 2D",
          "src": "images/shirt-poh.webp"
        }
      ],
      "category": "เสื้อผ้า & แฟชั่น",
      "status": "available"
    },
    'poh': {
      "id": "poh",
      "category": "เครื่องดื่ม",
      "tag": "เครื่องดื่มของเมือง",
      "name": "Poh Sparkling Tea · ชาซ่ากั่วป่าโพ้",
      "price": 159,
      "priceLabel": "฿159",
      "desc": "ชาสปาร์กลิงจากวัตถุดิบพังงา ดาหลา ส้มแขก ลูกจันทน์ มิ้นท์ และกระเจี๊ยบ ออกแบบรสชาติโดยกลุ่มกั่วป่าโพ้ ดื่มหนึ่งขวด เมืองเก่าได้ผลิบาน",
      "meta": "0% แอลกอฮอล์ · 275 ml. · ขวดแก้ว",
      "image": "images/poh-bottle.webp",
      "imageWidth": 960,
      "imageHeight": 720,
      "imageAlt": "ขวด Poh Sparkling Tea คู่แก้วน้ำแข็ง วางบนขอบหน้าต่างตึกเก่า",
      "shotStyle": "photo",
      "hasModal": true,
      "modalId": "modal-poh",
      "modalCta": "🌸 อ่านเรื่องราวในขวด →",
      "shotOverlay": "🌸 อ่านเรื่องราว"
    },
  };

  function mergeProduct(base, saved) {
    if (!saved || typeof saved !== 'object') return Object.assign({}, base);
    const merged = Object.assign({}, base);
    // รับเฉพาะช่องที่ทีมงานแก้ได้จากหน้า admin · ช่องโครงสร้าง (id, ลิงก์, ขนาดภาพ) ยึดตามโค้ด
    ['tag', 'name', 'price', 'priceLabel', 'desc', 'meta', 'image', 'imageAlt', 'category',
     'modalCta', 'modalLead', 'modalNote', 'modalDelivery', 'shotOverlay'].forEach((key) => {
      if (saved[key] !== undefined && saved[key] !== null && saved[key] !== '') merged[key] = saved[key];
    });
    if (Array.isArray(saved.gallery) && saved.gallery.length) merged.gallery = saved.gallery;
    return merged;
  }

  function limitShopProducts(data) {
    if (!data) return data;
    if (!data.shop || typeof data.shop !== 'object') data.shop = {};
    const saved = Array.isArray(data.shop.products) ? data.shop.products : [];
    data.shop.products = SHOP_PRODUCT_IDS.map((id) => {
      const base = PRODUCT_CATALOGUE[id];
      if (!base) return null;
      return mergeProduct(base, saved.find((item) => item && item.id === id));
    }).filter(Boolean);
    if (data.shop.heading === 'ของที่ระลึกจากย่าน<br>ทำด้วยมือ ถ่ายทอดด้วยใจ' || data.shop.heading === 'เสื้อยืดจากย่าน<br>ทำด้วยมือ ถ่ายทอดด้วยใจ') {
      data.shop.heading = 'เสื้อยืดจากย่าน<br>ถ่ายทอดด้วยใจ';
    }
    return data;
  }

  // การ์ดลอยมุมจอ · เครื่องที่เคยเปิด admin จะอ่านข้อมูลเก่าใน localStorage ไม่โหลด content.json
  // เปลี่ยนสินค้าที่โปรโมตเมื่อไร ให้แก้ค่าที่นี่และขยับ rev · ข้อมูลเก่าที่ rev ไม่ตรงจะถูกแทนที่
  const FLOATING_BADGE = {
    rev: '2026-09-23-bag', enabled: true, tag: 'ใหม่ · จำนวนจำกัด', title: 'กระเป๋าผ้ากินผัก กั่วป่าโพ้',
    price: 250, priceLabel: '฿250', image: 'images/je-bag-red-friends.webp', ctaText: 'สั่งกระเป๋า →', target: 'preorder/#bag'
  };

  function applyContent(data) {
    if (!data) return;
    data = limitShopProducts(data);
    if (!data.floatingBadge || data.floatingBadge.rev !== FLOATING_BADGE.rev) {
      data.floatingBadge = Object.assign({}, FLOATING_BADGE);
    }

    try {
      // 0. Typography Management
      if (data.typography) {
        applyTypography(data.typography);
      }

      // 0.1 Section Visibility Toggle
      if (data.sections) {
        const toggleSec = (id, visible) => {
          const el = document.getElementById(id);
          if (el) el.style.display = visible ? '' : 'none';
        };
        if ('houses' in data.sections) toggleSec('houses', data.sections.houses);
        if ('origin' in data.sections) toggleSec('origin', data.sections.origin);
        if ('six' in data.sections) toggleSec('six', data.sections.six);
        if ('events' in data.sections) toggleSec('events', data.sections.events);
        if ('shop' in data.sections) toggleSec('shop', data.sections.shop);
        if ('contact' in data.sections) toggleSec('contact', data.sections.contact);
      }

      
      // Floating Sticky Merch Badge
      const stickyBadge = document.getElementById('stickyMerchBadge');
      if (stickyBadge && data.floatingBadge) {
        if (data.floatingBadge.enabled === false) {
          stickyBadge.style.display = 'none';
        } else {
          stickyBadge.style.display = '';
          const sTag = document.getElementById('stickyBadgeTag');
          const sTitle = document.getElementById('stickyBadgeTitle');
          const sPrice = document.getElementById('stickyBadgePrice');
          const sImg = document.getElementById('stickyBadgeImg');
          const sCta = document.getElementById('stickyBadgeCta');
          
          if (sTag && data.floatingBadge.tag) setText(sTag, data.floatingBadge.tag);
          if (sTitle && data.floatingBadge.title) setText(sTitle, data.floatingBadge.title);
          if (sPrice) setText(sPrice, data.floatingBadge.priceLabel || `฿${data.floatingBadge.price || 350}`);
          if (sImg && data.floatingBadge.image) sImg.src = data.floatingBadge.image;
          if (sCta && data.floatingBadge.ctaText) setText(sCta, data.floatingBadge.ctaText);
        }
      }

      // 1. Site Title & Meta
      if (data.site) {
        if (data.site.title && document.title !== data.site.title) document.title = data.site.title;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && data.site.description && metaDesc.content !== data.site.description) metaDesc.content = data.site.description;
      }

      // 2. Hero Section (LCP: header.hero p.sub · เขียนทับเฉพาะค่าที่ต่าง กัน render delay)
      if (data.hero) {
        const kicker = document.querySelector('.hero .kicker');
        if (kicker && data.hero.kicker) setText(kicker, data.hero.kicker);

        const h1 = document.querySelector('.hero h1');
        if (h1 && data.hero.title) {
          setHTML(h1, `${data.hero.title}<em>${data.hero.titleEm || ''}</em>`);
        }

        const sub = document.querySelector('.hero .sub, .hero .lede');
        if (sub && data.hero.subtitle) setText(sub, data.hero.subtitle);

        const chips = document.querySelectorAll('.hero .hero-meta .chip');
        if (chips.length && data.hero.chips) {
          data.hero.chips.forEach((c, i) => { if (chips[i]) setText(chips[i], c); });
        }

        const btnExplore = document.querySelector('.hero-cta a[data-cta="explore"]');
        if (btnExplore) {
          if (data.hero.btnExplore) setText(btnExplore, data.hero.btnExplore);
          if (data.hero.btnExploreUrl) btnExplore.href = data.hero.btnExploreUrl;
        }

        const btnMap = document.querySelector('.hero-cta a[target="_blank"]');
        if (btnMap) {
          if (data.hero.btnMap) setText(btnMap, data.hero.btnMap);
          if (data.hero.mapUrl) btnMap.href = data.hero.mapUrl;
        }

        const heroRow = document.querySelector('.hero-row');
        if (heroRow && Array.isArray(data.hero.artworks)) {
          // ใช้ข้อมูลชุดเดียวกันเพื่อให้ภาพ คำบรรยาย และ alt ไม่คลาดเคลื่อนจาก CMS
          const artworkSizes = [[900, 1092], [900, 1142], [900, 1121], [900, 908]];
          const label = heroRow.querySelector('.hero-row-label');
          if (label && data.hero.artworksLabel) label.textContent = data.hero.artworksLabel;
          heroRow.querySelectorAll('figure').forEach(figure => figure.remove());
          data.hero.artworks.forEach((artwork, index) => {
            const figure = document.createElement('figure');
            const img = document.createElement('img');
            const caption = artwork.caption || '';
            const size = artworkSizes[index] || [900, 1092];
            img.src = artwork.src || '';
            img.width = size[0];
            img.height = size[1];
            if (index === 0) img.fetchPriority = 'high';
            else { img.loading = 'lazy'; img.decoding = 'async'; }
            // caption เป็นชื่อชุดผลงาน ไม่ใช่คำบรรยายภาพ · เอามาต่อเป็น alt แล้วจะอ่านไม่รู้เรื่อง
            img.alt = artwork.alt || 'ภาพวาดชุด Peranakan Charm โดย ติณณภพ งานสถิร';
            const figcaption = document.createElement('figcaption');
            figcaption.textContent = caption;
            figure.append(img, figcaption);
            heroRow.appendChild(figure);
          });
        }
      }

      // 3. Houses Section (Dynamic List)
      if (data.houses) {
        const hSec = document.getElementById('houses');
        if (hSec) {
          const tag = hSec.querySelector('.tag');
          if (tag && data.houses.tag) tag.innerHTML = data.houses.tag;
          const h2 = hSec.querySelector('h2');
          if (h2 && data.houses.heading) h2.innerHTML = data.houses.heading;
          const lede = hSec.querySelector('.lede');
          if (lede && data.houses.lede) lede.innerHTML = data.houses.lede;

          const housesContainer = hSec.querySelector('.houses');
          if (housesContainer && Array.isArray(data.houses.items) && data.houses.items.length > 0) {
            housesContainer.innerHTML = '';
            data.houses.items.forEach((item, idx) => {
              const art = document.createElement('article');
              art.className = 'house rise';
              
              const logoHtml = item.logo ? `
                <img class="logo" src="${item.logo}" width="300" height="300" loading="lazy" decoding="async" alt="${item.logoCap || 'ตราสัญลักษณ์'}">
                <p class="logo-cap">${item.logoCap || 'ตราสัญลักษณ์'}</p>
              ` : '';
              const useHtml = item.use ? `<p class="use">${item.use}</p>` : '';
              const snapClass = item.no === '305' ? 'snap wide' : 'snap';
              const snapW = 400;
              const snapH = item.no === '305' ? 300 : 533;
              const lineW = item.no === '305' ? 388 : (item.no === '109' ? 226 : 237);
              const lineH = item.no === '305' ? 250 : (item.no === '109' ? 334 : 403);

              art.innerHTML = `
                <p class="no">${item.no || (idx+1)}<small>${item.name || ''}</small></p>
                <div class="shotwrap">
                  <div class="plate">
                    ${item.line ? `<img src="${item.line}" width="${lineW}" height="${lineH}" loading="lazy" decoding="async" alt="ภาพลายเส้น ${item.name || ''}">` : ''}
                  </div>
                  ${item.photo ? `<img class="${snapClass}" src="${item.photo}" width="${snapW}" height="${snapH}" loading="lazy" decoding="async" alt="ภาพถ่าย ${item.name || ''}">` : ''}
                </div>
                <div class="body">
                  <h3>${item.title || item.name || ''}</h3>
                  <p>${item.desc || ''}</p>
                  ${logoHtml}
                  ${useHtml}
                </div>
              `;
              housesContainer.appendChild(art);
            });
          }

          const conclusion = hSec.querySelector('.wrap > p.rise:last-child, .wrap > p:last-child');
          if (conclusion && data.houses.conclusion) conclusion.innerHTML = data.houses.conclusion;
        }
      }


      // 3.5 Events Section (นิทรรศการที่กำลังจัดแสดง)
      if (data.events) {
        const evSec = document.getElementById('events');
        if (evSec) {
          if (data.events.enabled === false) {
            evSec.style.display = 'none';
          } else {
            evSec.style.display = '';
            const set = (sel, val, html) => {
              const el = evSec.querySelector(sel);
              if (el && val) { if (html) setHTML(el, val); else setText(el, val); }
            };
            set('.tag', data.events.tag, true);
            set('h2', data.events.heading, true);
            set('.lede', data.events.lede, true);

            const ev = Array.isArray(data.events.items) ? data.events.items[0] : null;
            if (ev) {
              const img = evSec.querySelector('.ev-poster img');
              if (img && ev.image) { img.src = ev.image; if (ev.imageAlt) img.alt = ev.imageAlt; }
              set('.ev-kicker', ev.kicker);
              const t = evSec.querySelector('.ev-title');
              if (t && ev.title) {
                t.innerHTML = ev.title + (ev.titleEn ? `<span lang="en">${ev.titleEn}</span>` : '');
              }
              const by = evSec.querySelector('.ev-by');
              if (by && ev.by) {
                by.innerHTML = ev.by + (ev.byEn ? `<small lang="en">${ev.byEn}</small>` : '');
              }
              set('.ev-body > p:not(.ev-kicker):not(.ev-by):not(.ev-hash)', ev.desc, true);
              const meta = evSec.querySelector('.ev-meta');
              if (meta && (ev.date || ev.place)) {
                meta.innerHTML = '';
                const row = (dt, dd) => {
                  const d = document.createElement('div');
                  d.innerHTML = `<dt>${dt}</dt><dd>${dd}</dd>`;
                  meta.appendChild(d);
                };
                if (ev.date) row('ช่วงเวลา', ev.date);
                if (ev.time) row('เวลา', ev.time);
                if (ev.place) row('สถานที่', ev.place);
              }
              set('.ev-hash', ev.hashtag);
              const cta = evSec.querySelector('.ev-body .btn');
              if (cta) {
                if (ev.ctaText) setText(cta, ev.ctaText);
                if (ev.link) cta.href = ev.link;
              }
            }

            // ประวัติศิลปินแยกเป็นก้อนข้อมูล เพื่อให้แก้เฉพาะเนื้อหาส่วนนี้ได้โดยไม่กระทบรายละเอียดงาน
            if (data.events.artist) {
              const artist = data.events.artist;
              set('.ev-artist-h', artist.heading);
              set('.ev-artist-body .label-en', artist.kickerEn);
              const artistImg = evSec.querySelector('.ev-artist-photo img');
              if (artistImg && artist.image) { artistImg.src = artist.image; if (artist.imageAlt) artistImg.alt = artist.imageAlt; }
              const artistName = evSec.querySelector('.ev-artist-name');
              if (artistName && artist.name) artistName.firstChild.textContent = artist.name;
              const nameEn = evSec.querySelector('.ev-artist-name small');
              if (nameEn && artist.nameEn) nameEn.textContent = artist.nameEn;
              const artistBody = evSec.querySelector('.ev-artist-body');
              if (artistBody && Array.isArray(artist.paragraphs)) {
                artistBody.querySelectorAll(':scope > p:not(.label-en):not(.ev-artist-name)').forEach(p => p.remove());
                const quote = artistBody.querySelector('.ev-quote');
                artist.paragraphs.forEach(paragraph => {
                  const p = document.createElement('p');
                  p.textContent = paragraph;
                  artistBody.insertBefore(p, quote);
                });
              }
              const quoteText = evSec.querySelector('.ev-quote');
              if (quoteText && artist.quote) quoteText.firstChild.textContent = artist.quote;
              set('.ev-quote cite', artist.quoteCite);
              const ig = evSec.querySelector('.ev-ig');
              if (ig) {
                if (artist.igUrl) ig.href = artist.igUrl;
                if (artist.igLabel) ig.textContent = artist.igLabel;
              }
            }

            // แกลเลอรีสร้างจากข้อมูลเพื่อให้จำนวนภาพและคำบรรยายเปลี่ยนได้โดยไม่ต้องแก้ HTML หลัก
            if (data.events.gallery) {
              const gallery = data.events.gallery;
              set('.ev-gallery-h', gallery.heading);
              set('.ev-gallery > .muted', gallery.lede);
              const galleryGrid = evSec.querySelector('.ev-gallery-grid');
              if (galleryGrid && Array.isArray(gallery.items)) {
                galleryGrid.innerHTML = '';
                gallery.items.forEach(item => {
                  const figure = document.createElement('figure');
                  const img = document.createElement('img');
                  img.src = item.src || '';
                  img.width = 1400;
                  img.height = 1050;
                  img.loading = 'lazy';
                  img.decoding = 'async';
                  img.alt = item.caption || '';
                  const caption = document.createElement('figcaption');
                  caption.textContent = item.caption || '';
                  figure.append(img, caption);
                  galleryGrid.appendChild(figure);
                });
              }
            }

            // ตารางเปิดเข้าชมของสามบ้าน
            const openList = evSec.querySelector('.ev-open ul');
            if (openList && Array.isArray(data.events.openings) && data.events.openings.length) {
              openList.innerHTML = '';
              data.events.openings.forEach(o => {
                const li = document.createElement('li');
                li.innerHTML = `<b>${o.no || ''}</b><div>${o.title || ''}<span>${o.days || ''}</span></div>`;
                openList.appendChild(li);
              });
            }
            set('.ev-open-h', data.events.openingsHeading);
          }
        }
      }

      // 4. Origin Section
      if (data.origin) {
        const oSec = document.getElementById('origin');
        if (oSec) {
          const tag = oSec.querySelector('.tag');
          if (tag && data.origin.tag) tag.textContent = data.origin.tag;
          const h2 = oSec.querySelector('h2');
          if (h2 && data.origin.heading) h2.innerHTML = data.origin.heading;
          const bq = oSec.querySelector('.bigquote');
          if (bq && data.origin.quote) bq.textContent = data.origin.quote;
          const p = oSec.querySelector('.origin-grid p:not(.bigquote)');
          if (p && data.origin.body) p.innerHTML = data.origin.body;
          const figcap = oSec.querySelector('figcaption');
          if (figcap && data.origin.caption) figcap.textContent = data.origin.caption;
          const originImg = oSec.querySelector('.framed img');
          if (originImg && data.origin.photo) originImg.src = data.origin.photo;
        }
      }

      // 5. Six Pillars Section (Dynamic List)
      if (data.six) {
        const sSec = document.getElementById('six');
        if (sSec) {
          const tag = sSec.querySelector('.tag');
          if (tag && data.six.tag) tag.textContent = data.six.tag;
          const h2 = sSec.querySelector('h2');
          if (h2 && data.six.heading) h2.innerHTML = data.six.heading;

          const sixContainer = sSec.querySelector('.sixgrid');
          if (sixContainer && Array.isArray(data.six.items)) {
            sixContainer.innerHTML = '';
            data.six.items.forEach((item, idx) => {
              const div = document.createElement('div');
              div.className = 'six-item';
              div.innerHTML = `
                <b>${item.title || ''}</b>
                <p>${item.desc || ''}</p>
              `;
              sixContainer.appendChild(div);
            });
          }
        }
      }

      // 6. Shop Section (Dynamic Products, Category Filter Tabs & Modal)
      if (data.shop) {
        const shopSec = document.getElementById('shop');
        if (shopSec) {
          const tag = shopSec.querySelector('.tag');
          if (tag && data.shop.tag) tag.textContent = data.shop.tag;
          const h2 = shopSec.querySelector('h2');
          if (h2 && data.shop.heading) h2.innerHTML = data.shop.heading;
          const lede = shopSec.querySelector('.lede');
          if (lede && data.shop.lede) lede.innerHTML = data.shop.lede;

          const products = Array.isArray(data.shop.products) ? data.shop.products : [];

          // Category Filter Tabs
          const categories = ['ทั้งหมด'];
          products.forEach(p => {
            if (p.category && !categories.includes(p.category)) {
              categories.push(p.category);
            }
          });

          let filterNav = shopSec.querySelector('.shop-filter-nav');
          // Tabs only help with a real catalogue; 2 products fit on screen already
          if (!filterNav && categories.length > 2 && products.length > 3) {
            filterNav = document.createElement('div');
            filterNav.className = 'shop-filter-nav rise';
            filterNav.style.cssText = 'display:flex;gap:.5rem;flex-wrap:wrap;margin:1.2rem 0 1.8rem;justify-content:center';
            const shopGrid = shopSec.querySelector('.shop-grid');
            if (shopGrid) shopGrid.parentNode.insertBefore(filterNav, shopGrid);
          }

          if (filterNav) {
            filterNav.innerHTML = '';
            categories.forEach(cat => {
              const catBtn = document.createElement('button');
              catBtn.type = 'button';
              catBtn.className = `filter-chip ${cat === 'ทั้งหมด' ? 'is-active' : ''}`;
              catBtn.style.cssText = `
                padding: .4rem .9rem; border-radius: 20px; font-weight: 600; font-size: .85rem;
                border: 1.5px solid var(--ink); background: ${cat === 'ทั้งหมด' ? 'var(--ink)' : 'transparent'};
                color: ${cat === 'ทั้งหมด' ? 'var(--yellow)' : 'var(--ink)'}; cursor: pointer; transition: all .15s;
              `;
              catBtn.textContent = cat;
              catBtn.onclick = () => {
                filterNav.querySelectorAll('button').forEach(b => {
                  b.style.background = 'transparent';
                  b.style.color = 'var(--ink)';
                });
                catBtn.style.background = 'var(--ink)';
                catBtn.style.color = 'var(--yellow)';
                
                const cards = shopSec.querySelectorAll('.shop-card');
                cards.forEach(c => {
                  const cardCat = c.getAttribute('data-category') || '';
                  if (cat === 'ทั้งหมด' || cardCat === cat) {
                    c.style.display = '';
                  } else {
                    c.style.display = 'none';
                  }
                });
              };
              filterNav.appendChild(catBtn);
            });
          }

          // Render Dynamic Product Cards
          const shopGrid = shopSec.querySelector('.shop-grid');
          if (shopGrid) {
            shopGrid.classList.toggle('single-product', products.length === 1);
            shopGrid.classList.toggle('two-products', products.length === 2);
            shopGrid.classList.toggle('three-products', products.length === 3);
            shopGrid.innerHTML = '';
            products.forEach((prod) => {
              const art = document.createElement('article');
              art.className = 'shop-card rise';
              art.setAttribute('data-category', prod.category || 'ทั่วไป');

              const priceText = prod.priceLabel || `฿${prod.price || 0}`;
              const metaHtml = `<p class="shop-meta">${prod.meta || '&nbsp;'}</p>`;
              const modalId = prod.modalId || 'modal-shirt';
              const modalBtnHtml = prod.hasModal ? `
                <button type="button" class="shop-more-btn" data-open-modal="${modalId}">
                  ${prod.modalCta || '📷 ดูภาพถ่ายแบบ & ลายเสื้อ →'}
                </button>
              ` : '';

              // buyUrl = ลิงก์ในเว็บเรา (เช่น หน้าพรีออเดอร์) · ไม่ใส่ = ไปที่ LINE เหมือนเดิม
              const buyHref = prod.buyUrl || data.shop.lineUrl || '#';
              const buyTargetAttr = prod.buyUrl ? '' : ' target="_blank" rel="noopener"';
              let buyBtnHtml = `<a class="shop-buy" href="${buyHref}"${buyTargetAttr}>${prod.buyLabel || 'สั่งซื้อ'}</a>`;
              if (prod.status === 'soldout') {
                buyBtnHtml = `<span class="shop-buy" style="background:#888;color:#fff;cursor:not-allowed;border-color:#666">สินค้าหมด</span>`;
              } else if (prod.status === 'preorder') {
                buyBtnHtml = `<a class="shop-buy" href="${buyHref}"${buyTargetAttr} style="background:var(--red-deep,var(--red));color:#fff;border-color:var(--ink)">${prod.buyLabel || 'สั่งจอง (Pre-Order)'}</a>`;
              } else if (prod.status === 'coming_soon') {
                buyBtnHtml = `<span class="shop-buy" style="background:var(--rule);color:var(--muted);cursor:default">รอเปิดขาย</span>`;
              }

              art.innerHTML = `
                <div class="shop-shot${prod.shotStyle === 'photo' ? ' photo' : ''}" ${prod.hasModal ? `data-open-modal="${modalId}" title="คลิกดูภาพขยายและแกลเลอรี"` : ''}>
                  ${prod.tag ? `<span class="shop-tag">${prod.tag}</span>` : ''}
                  ${prod.image ? `<img src="${prod.image}" width="${prod.imageWidth || 360}" height="${prod.imageHeight || 255}" loading="lazy" decoding="async" alt="${prod.imageAlt || prod.name || ''}">` : ''}
                  ${prod.hasModal ? `<span class="shop-shot-overlay">${prod.shotOverlay || '🔍 ดู 4 ภาพ'}</span>` : ''}
                </div>
                <div class="shop-body">
                  <h3>${prod.name || ''}</h3>
                  <p class="shop-desc">${prod.desc || ''}</p>
                  ${modalBtnHtml}
                  ${metaHtml}
                  <div class="shop-foot">
                    <span class="shop-price">${priceText}</span>
                    ${buyBtnHtml}
                  </div>
                </div>
              `;
              shopGrid.appendChild(art);
            });
          }

          // Re-bind modal triggers for newly rendered buttons
          document.querySelectorAll('[data-open-modal]').forEach(btn => {
            btn.onclick = () => {
              const id = btn.getAttribute('data-open-modal');
              const dlg = document.getElementById(id);
              if (dlg) { dlg.showModal(); document.body.style.overflow = 'hidden'; }
            };
          });

          // Guide
          const gHeading = shopSec.querySelector('.shop-guide h3');
          if (gHeading && data.shop.guideHeading) gHeading.textContent = data.shop.guideHeading;

          const gItems = shopSec.querySelectorAll('.shop-guide-item');
          if (gItems.length >= 2) {
            if (data.shop.onlineTitle) gItems[0].querySelector('b').textContent = data.shop.onlineTitle;
            if (data.shop.onlineDesc) gItems[0].querySelector('p').textContent = data.shop.onlineDesc;
            if (data.shop.pickupTitle) gItems[1].querySelector('b').textContent = data.shop.pickupTitle;
            if (data.shop.pickupDesc) {
              const pEl = gItems[1].querySelector('p');
              if (pEl) {
                if (data.shop.pickupMapUrl) {
                  pEl.innerHTML = `แวะชมและรับสินค้าจริงได้ที่บ้าน 78 Studio Takuapa ถนนศรีตะกั่วป่า (<a href="${data.shop.pickupMapUrl}" target="_blank" rel="noopener" style="text-decoration:underline;color:var(--ink);font-weight:600">📍 เปิดแผนที่นำทาง</a>)`;
                } else {
                  pEl.textContent = data.shop.pickupDesc;
                }
              }
            }
          }

          const lineCta = shopSec.querySelector('.shop-guide > a.btn');
          if (lineCta) {
            if (data.shop.lineCta) lineCta.textContent = data.shop.lineCta;
            if (data.shop.lineUrl) lineCta.href = data.shop.lineUrl;
          }
        }

        // Shirt Modal Dialog
        const modal = document.getElementById('modal-shirt');
        const shirt = (data.shop.products || []).find(p => p.id === 'shirt') || (data.shop.products || [])[0];
        if (modal && shirt && shirt.id !== 'poh') {
          const mTitle = modal.querySelector('#modal-shirt-title');
          if (mTitle && shirt.name) mTitle.textContent = shirt.name;
          const mPrice = modal.querySelector('.dialog-price');
          if (mPrice && (shirt.priceLabel || shirt.price)) {
            mPrice.innerHTML = `${shirt.priceLabel || '฿' + shirt.price} <small>${shirt.modalDelivery || 'จัดส่งทั่วประเทศ'}</small>`;
          }
          const mLead = modal.querySelector('.dialog-lead');
          if (mLead && shirt.modalLead) mLead.textContent = shirt.modalLead;
          const mNote = modal.querySelector('.dialog-note');
          if (mNote && shirt.modalNote) mNote.innerHTML = shirt.modalNote;
          const mSubnote = modal.querySelector('.dialog-subnote');
          if (mSubnote) {
            mSubnote.textContent = `ราคา ${shirt.price || 350} บาท | ระบุไซส์ (M, L, XL, 2XL) และจำนวนทาง LINE ได้ทันที`;
          }

          // Modal Gallery Photos
          if (shirt.gallery && shirt.gallery.length) {
            const thumbs = modal.querySelectorAll('.dialog-thumb');
            shirt.gallery.forEach((gItem, gIdx) => {
              const th = thumbs[gIdx];
              if (th && gItem.src) {
                th.setAttribute('data-src', gItem.src);
                const thImg = th.querySelector('img');
                if (thImg) thImg.src = gItem.src;
                if (gIdx === 0) {
                  const mainImg = modal.querySelector('#shirt-gallery-main');
                  if (mainImg) mainImg.src = gItem.src;
                }
              }
            });
          }
        }
      }

      // 7. Contact Section
      if (data.contact) {
        const cSec = document.getElementById('contact');
        if (cSec) {
          const tag = cSec.querySelector('.tag');
          if (tag && data.contact.tag) tag.textContent = data.contact.tag;
          const h2 = cSec.querySelector('h2');
          if (h2 && data.contact.heading) h2.innerHTML = data.contact.heading;
          const p = cSec.querySelector('.wrap > .rise > p');
          if (p && data.contact.desc) p.textContent = data.contact.desc;

          const clistLinks = cSec.querySelectorAll('.clist li a');
          if (clistLinks.length >= 5) {
            if (data.contact.phone) { clistLinks[0].textContent = data.contact.phone; clistLinks[0].href = data.contact.phoneTel || `tel:${data.contact.phone.replace(/\s/g, '')}`; }
            if (data.contact.email) { clistLinks[1].textContent = data.contact.email; clistLinks[1].href = data.contact.emailMailto || `mailto:${data.contact.email}`; }
            if (data.contact.facebookText) { clistLinks[2].textContent = data.contact.facebookText; clistLinks[2].href = data.contact.facebookUrl; }
            if (data.contact.lineText) { clistLinks[3].textContent = data.contact.lineText; clistLinks[3].href = data.contact.lineUrl; }
            if (data.contact.locationText) { clistLinks[4].textContent = data.contact.locationText; clistLinks[4].href = data.contact.locationUrl; }
          }
        }
      }

      // 8. Footer
      if (data.footer) {
        const foot = document.querySelector('footer');
        if (foot) {
          const b = foot.querySelector('b');
          if (b && data.footer.title) b.textContent = data.footer.title;
        }
      }

      // Trigger scroll reveal on newly rendered items
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              obs.unobserve(entry.target);
            }
          });
        }, { rootMargin: '0px 0px -40px 0px' });
        document.querySelectorAll('.rise:not(.in)').forEach(el => io.observe(el));
      } else {
        document.querySelectorAll('.rise').forEach(el => el.classList.add('in'));
      }

    } catch (err) {
      console.warn('CMS Hydration warning:', err);
    }
  }

  // Priority Loading:
  // 1. LocalStorage (instant hydration)
  let localRaw = null;
  try {
    localRaw = localStorage.getItem(STORAGE_KEY);
    if (localRaw) {
      const localData = JSON.parse(localRaw);
      applyContent(localData);
    }
  } catch (e) {}

  // 2. Cloud Sync
  let syncConfig = null;
  try {
    const rawConfig = localStorage.getItem(CONFIG_KEY);
    if (rawConfig) syncConfig = JSON.parse(rawConfig);
  } catch (e) {}

  if (syncConfig && syncConfig.cloudUrl) {
    fetch(syncConfig.cloudUrl, { headers: syncConfig.apiKey ? { 'X-Master-Key': syncConfig.apiKey, 'Authorization': `Bearer ${syncConfig.apiKey}` } : {} })
      .then(res => res.json())
      .then(resData => {
        const content = resData.record || resData.data || resData;
        if (content && typeof content === 'object') {
          applyContent(content);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(content)); } catch(e){}
        }
      })
      .catch(err => console.log('Cloud sync fetch fallback to local.'));
  } else if (!localRaw) {
    // 3. Fallback to content.json
    fetch('content.json?v=' + Date.now())
      .then(r => r.json())
      .then(data => { applyContent(data); })
      .catch(() => {});
  }
})();
