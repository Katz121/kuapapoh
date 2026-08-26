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

  // Current shop mode: the public catalog currently sells the shirt only.
  function limitShopToShirt(data) {
    if (data?.shop && Array.isArray(data.shop.products)) {
      data.shop.products = data.shop.products
        .filter(product => product.id === 'shirt' || String(product.name || '').includes('เสื้อ'))
        .slice(0, 1);
      data.shop.categories = ['ทั้งหมด', 'เสื้อผ้า & แฟชั่น'];
      if (data.shop.heading === 'ของที่ระลึกจากย่าน<br>ทำด้วยมือ ถ่ายทอดด้วยใจ' || data.shop.heading === 'เสื้อยืดจากย่าน<br>ทำด้วยมือ ถ่ายทอดด้วยใจ') {
        data.shop.heading = 'เสื้อยืดจากย่าน<br>ถ่ายทอดด้วยใจ';
      }
    }
    return data;
  }

  function applyContent(data) {
    if (!data) return;
    data = limitShopToShirt(data);

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
          
          if (sTag && data.floatingBadge.tag) sTag.textContent = data.floatingBadge.tag;
          if (sTitle && data.floatingBadge.title) sTitle.textContent = data.floatingBadge.title;
          if (sPrice) sPrice.textContent = data.floatingBadge.priceLabel || `฿${data.floatingBadge.price || 350}`;
          if (sImg && data.floatingBadge.image) sImg.src = data.floatingBadge.image;
          if (sCta && data.floatingBadge.ctaText) sCta.textContent = data.floatingBadge.ctaText;
        }
      }

      // 1. Site Title & Meta
      if (data.site) {
        if (data.site.title) document.title = data.site.title;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && data.site.description) metaDesc.content = data.site.description;
      }

      // 2. Hero Section
      if (data.hero) {
        const kicker = document.querySelector('.hero .kicker');
        if (kicker && data.hero.kicker) kicker.textContent = data.hero.kicker;

        const h1 = document.querySelector('.hero h1');
        if (h1 && data.hero.title) {
          h1.innerHTML = `${data.hero.title}<em>${data.hero.titleEm || ''}</em>`;
        }

        const sub = document.querySelector('.hero .sub, .hero .lede');
        if (sub && data.hero.subtitle) sub.textContent = data.hero.subtitle;

        const chips = document.querySelectorAll('.hero .hero-meta .chip');
        if (chips.length && data.hero.chips) {
          data.hero.chips.forEach((c, i) => { if (chips[i]) chips[i].textContent = c; });
        }

        const btnExplore = document.querySelector('.hero-cta a[href="#houses"]');
        if (btnExplore && data.hero.btnExplore) btnExplore.textContent = data.hero.btnExplore;

        const btnMap = document.querySelector('.hero-cta a[target="_blank"]');
        if (btnMap) {
          if (data.hero.btnMap) btnMap.textContent = data.hero.btnMap;
          if (data.hero.mapUrl) btnMap.href = data.hero.mapUrl;
        }

        const heroFigures = document.querySelectorAll('.hero-row figure img');
        if (heroFigures.length >= 3) {
          if (data.hero.line78) heroFigures[0].src = data.hero.line78;
          if (data.hero.line109) heroFigures[1].src = data.hero.line109;
          if (data.hero.line305) heroFigures[2].src = data.hero.line305;
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

          const sixContainer = sSec.querySelector('.six-grid');
          if (sixContainer && Array.isArray(data.six.items)) {
            sixContainer.innerHTML = '';
            data.six.items.forEach((item, idx) => {
              const div = document.createElement('div');
              div.className = 'six-item rise';
              div.innerHTML = `
                <div class="six-num">0${idx+1}</div>
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
          if (!filterNav && categories.length > 2) {
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
            shopGrid.innerHTML = '';
            products.forEach((prod) => {
              const art = document.createElement('article');
              art.className = 'shop-card rise';
              art.setAttribute('data-category', prod.category || 'ทั่วไป');
              
              const priceText = prod.priceLabel || `฿${prod.price || 0}`;
              const metaHtml = `<p class="shop-meta">${prod.meta || '&nbsp;'}</p>`;
              const modalBtnHtml = prod.hasModal ? `
                <button type="button" class="shop-more-btn" data-open-modal="modal-shirt">
                  📷 ดูภาพถ่ายแบบ & ลายเสื้อ →
                </button>
              ` : '';

              let buyBtnHtml = `<a class="shop-buy" href="${data.shop.lineUrl || '#'}" target="_blank" rel="noopener">สั่งซื้อ</a>`;
              if (prod.status === 'soldout') {
                buyBtnHtml = `<span class="shop-buy" style="background:#888;color:#fff;cursor:not-allowed;border-color:#666">สินค้าหมด</span>`;
              } else if (prod.status === 'preorder') {
                buyBtnHtml = `<a class="shop-buy" href="${data.shop.lineUrl || '#'}" target="_blank" rel="noopener" style="background:var(--cobalt);color:#fff">สั่งจอง (Pre-Order)</a>`;
              } else if (prod.status === 'coming_soon') {
                buyBtnHtml = `<span class="shop-buy" style="background:var(--rule);color:var(--muted);cursor:default">เร็ว ๆ นี้</span>`;
              }

              art.innerHTML = `
                <div class="shop-shot" ${prod.hasModal ? 'data-open-modal="modal-shirt" title="คลิกดูภาพขยายและแกลเลอรี"' : ''}>
                  ${prod.tag ? `<span class="shop-tag">${prod.tag}</span>` : ''}
                  ${prod.image ? `<img src="${prod.image}" width="360" height="255" loading="lazy" decoding="async" alt="${prod.name || ''}">` : ''}
                  ${prod.hasModal ? `<span class="shop-shot-overlay">🔍 ดู 4 ภาพ</span>` : ''}
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
        if (modal && data.shop.products && data.shop.products[0]) {
          const shirt = data.shop.products[0];
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
    fetch('content.json')
      .then(r => r.json())
      .then(data => { applyContent(data); })
      .catch(() => {});
  }
})();
