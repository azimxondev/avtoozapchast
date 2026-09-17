/**
 * Avto Sklad — User / Customer Storefront View
 * Clean catalog, vehicle model filters, contact seller, shop location & hours.
 */

const UserCatalogView = {
  state: {
    q: "",
    car_model: "",
    category_id: "",
    page: 1,
    limit: 12
  },

  async render() {
    const container = document.getElementById("tab-content");
    const shop = State.shopSettings || {};

    container.innerHTML = `
      ${State.isUserPreview ? `
      <!-- Compact Admin Preview Bar -->
      <div style="background:rgba(37,99,235,0.12);border:1px solid rgba(59,130,246,0.35);border-radius:8px;padding:6px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;font-size:11px">
        <div style="display:flex;align-items:center;gap:6px;color:#93c5fd">
          <span>👁️</span>
          <span><b>Mijoz ko'rinishi (Preview)</b></span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.toggleUserPreview()" style="padding:2px 8px;font-size:10px;font-weight:700;border-radius:6px">
          👑 Qaytish
        </button>
      </div>
      ` : ''}

      <!-- Storefront Hero -->
      <div style="background:linear-gradient(135deg, #1E293B 0%, #0F172A 100%);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
        <div>
          <h2 style="font-size:18px;font-weight:800;color:white;margin-bottom:4px">🚗 ${Utils.escapeHtml(shop.shop_name || 'Avto Sklad & Ehtiyot Qismlar')}</h2>
          <p style="font-size:12px;color:var(--text-muted)">Original va sifatli avto ehtiyot qismlar ombori. Toshkent bo'yicha yetkazib berish mavjud.</p>
        </div>
        <div style="display:flex;gap:8px">
          <a href="tel:${shop.shop_phone || '+998901234567'}" class="btn btn-success btn-sm">
            📞 Qo'ng'iroq qilish
          </a>
          <button class="btn btn-secondary btn-sm" onclick="UserCatalogView.openLocationModal()">
            📍 Manzil & Ish vaqti
          </button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="catalog-toolbar">
        <div class="search-box-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" id="user-search-input" class="search-input" placeholder="Kerakli ehtiyot qism yoki avtomobilni qidiring..." value="${Utils.escapeHtml(this.state.q)}">
        </div>

        <!-- Car Model Filter Chips -->
        <div class="filter-chips-scroll">
          <button class="filter-chip ${!this.state.car_model ? 'active' : ''}" onclick="UserCatalogView.filterByCar('')">Barchasi</button>
          <button class="filter-chip ${this.state.car_model === 'Cobalt' ? 'active' : ''}" onclick="UserCatalogView.filterByCar('Cobalt')">Cobalt</button>
          <button class="filter-chip ${this.state.car_model === 'Gentra' ? 'active' : ''}" onclick="UserCatalogView.filterByCar('Gentra')">Gentra</button>
          <button class="filter-chip ${this.state.car_model === 'Nexia 3' ? 'active' : ''}" onclick="UserCatalogView.filterByCar('Nexia 3')">Nexia 3</button>
          <button class="filter-chip ${this.state.car_model === 'Tracker 2' ? 'active' : ''}" onclick="UserCatalogView.filterByCar('Tracker 2')">Tracker 2</button>
          <button class="filter-chip ${this.state.car_model === 'Malibu 2' ? 'active' : ''}" onclick="UserCatalogView.filterByCar('Malibu 2')">Malibu 2</button>
          <button class="filter-chip ${this.state.car_model === 'Onix' ? 'active' : ''}" onclick="UserCatalogView.filterByCar('Onix')">Onix</button>
          <button class="filter-chip ${this.state.car_model === 'Spark' ? 'active' : ''}" onclick="UserCatalogView.filterByCar('Spark')">Spark</button>
        </div>
      </div>

      <!-- Products Grid -->
      <div id="user-products-grid">
        <div class="skeleton" style="height:250px"></div>
      </div>
    `;

    const searchInput = document.getElementById("user-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", Utils.debounce((e) => {
        this.state.q = e.target.value.trim();
        this.state.page = 1;
        this.loadProducts();
      }, 350));
    }

    await this.loadProducts();
  },

  async loadProducts() {
    const grid = document.getElementById("user-products-grid");
    if (!grid) return;

    try {
      const data = await API.get("/products", {
        ...this.state,
        sort_by: "created_desc"
      });

      const { items } = data;

      if (items.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Ehtiyot qism topilmadi</div>
            <div class="empty-desc">Boshqa so'z bilan qidirib ko'ring yoki to'g'ridan-to'g'ri sotuvchi bilan bog'laning.</div>
            <a href="tel:${State.shopSettings.shop_phone || '+998901234567'}" class="btn btn-primary btn-sm" style="margin-top:12px">
              📞 Sotuvchiga qo'ng'iroq qilish
            </a>
          </div>
        `;
        return;
      }

      grid.innerHTML = `
        <div class="products-grid">
          ${items.map(p => `
            <div class="product-card" onclick="ProductsView.openDetailModal(${p.id})">
              <div class="product-image-box">
                <img src="${p.image_url || 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=400'}" alt="${Utils.escapeHtml(p.name)}" loading="lazy">
                <span class="product-badge-condition ${p.condition === 'NEW' ? 'condition-new' : 'condition-used'}">
                  ${p.condition === 'NEW' ? 'Yangi' : 'Ishlatilgan'}
                </span>
              </div>
              <div class="product-body">
                <div class="product-sku">${p.sku} ${p.brand ? `• ${p.brand}` : ''}</div>
                <h3 class="product-name">${Utils.escapeHtml(p.name)}</h3>
                <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">
                  Mos: <strong>${p.car_model || 'Universal'}</strong> (${p.compatible_years || 'Barcha yillar'})
                </div>
                <div class="stock-pill ${p.quantity > 0 ? 'stock-in' : 'stock-out'}">
                  ${p.quantity > 0 ? `● Sotuvda mavjud (${p.quantity} ${p.unit})` : `● Qolmagan (Buyurtmaga)`}
                </div>
                <div class="product-pricing">
                  <div class="product-selling-price">${Utils.formatUZS(p.selling_price)}</div>
                </div>
                <button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" onclick="event.stopPropagation(); ProductsView.contactSeller(${p.id})">
                  Sotuvchi bilan bog'lanish
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      grid.innerHTML = `<div class="empty-state">Xatolik: ${Utils.escapeHtml(err.message)}</div>`;
    }
  },

  filterByCar(model) {
    this.state.car_model = model;
    this.state.page = 1;
    this.render();
  },

  openLocationModal() {
    const s = State.shopSettings || {};
    const modalRoot = document.getElementById("modal-root");
    modalRoot.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-header">
          <div class="modal-title">📍 Do'kon Manzili va Ish Vaqti</div>
          <button class="modal-close-btn" onclick="ProductsView.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="font-size:13px;line-height:1.8">
          <div style="background:var(--bg-surface-elevated);border-radius:var(--radius-md);padding:14px;margin-bottom:14px">
            <div><strong>Do'kon nomi:</strong> ${Utils.escapeHtml(s.shop_name || 'Avto Sklad')}</div>
            <div><strong>Manzil:</strong> ${Utils.escapeHtml(s.shop_address || 'Toshkent sh., Sergeli mashina bozori')}</div>
            <div><strong>Ish vaqti:</strong> ${Utils.escapeHtml(s.shop_work_hours || '08:30 - 18:30')}</div>
            <div><strong>Telefon:</strong> <a href="tel:${s.shop_phone || '+998901234567'}" style="color:var(--brand-blue)">${s.shop_phone || '+998 90 123 45 67'}</a></div>
            <div><strong>Telegram:</strong> <a href="https://t.me/${(s.shop_telegram || '@avto_sklad').replace('@', '')}" target="_blank" style="color:var(--brand-blue)">${s.shop_telegram || '@avto_sklad_admin'}</a></div>
          </div>
          <a href="https://yandex.uz/maps/?pt=${s.shop_lon || '69.2195'},${s.shop_lat || '41.2258'}&z=16&l=map" target="_blank" class="btn btn-primary" style="width:100%">
            🗺 Xaritada ko'rish (Yandex Xarita)
          </a>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="ProductsView.closeModal()">Yopish</button>
        </div>
      </div>
    `;
    document.getElementById("modal-overlay").classList.add("active");
  }
};
