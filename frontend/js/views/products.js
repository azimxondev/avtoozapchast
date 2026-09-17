/**
 * Avto Sklad — Products & Catalog View
 */

const ProductsView = {
  state: {
    page: 1,
    limit: 12,
    q: "",
    category_id: "",
    car_model: "",
    condition: "",
    stock_status: "",
    sort_by: "created_desc"
  },

  async render(params = {}) {
    if (params) {
      this.state = { ...this.state, ...params };
    }

    const container = document.getElementById("tab-content");
    container.innerHTML = `
      <!-- Toolbar -->
      <div class="catalog-toolbar">
        <div style="display:flex;gap:10px;align-items:center">
          <div class="search-box-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" id="product-search-input" class="search-input" placeholder="Mahsulot nomi, SKU, avtomobil modeli..." value="${Utils.escapeHtml(this.state.q)}">
          </div>
          ${State.isStaffOrAdmin() ? `
          <button class="btn btn-primary" style="flex-shrink:0" onclick="ProductsView.openAddModal()">
            <span>➕</span> Qo'shish
          </button>
          ` : ''}
        </div>

        <!-- Car Model Filter Chips -->
        <div class="filter-chips-scroll" id="car-model-chips">
          <button class="filter-chip ${!this.state.car_model ? 'active' : ''}" onclick="ProductsView.filterByCar('')">Barchasi</button>
          <button class="filter-chip ${this.state.car_model === 'Cobalt' ? 'active' : ''}" onclick="ProductsView.filterByCar('Cobalt')">Cobalt</button>
          <button class="filter-chip ${this.state.car_model === 'Gentra' ? 'active' : ''}" onclick="ProductsView.filterByCar('Gentra')">Gentra</button>
          <button class="filter-chip ${this.state.car_model === 'Nexia 3' ? 'active' : ''}" onclick="ProductsView.filterByCar('Nexia 3')">Nexia 3</button>
          <button class="filter-chip ${this.state.car_model === 'Tracker 2' ? 'active' : ''}" onclick="ProductsView.filterByCar('Tracker 2')">Tracker 2</button>
          <button class="filter-chip ${this.state.car_model === 'Malibu 2' ? 'active' : ''}" onclick="ProductsView.filterByCar('Malibu 2')">Malibu 2</button>
          <button class="filter-chip ${this.state.car_model === 'Onix' ? 'active' : ''}" onclick="ProductsView.filterByCar('Onix')">Onix</button>
          <button class="filter-chip ${this.state.car_model === 'Spark' ? 'active' : ''}" onclick="ProductsView.filterByCar('Spark')">Spark</button>
        </div>

        <!-- Secondary Filters Row -->
        <div class="toolbar-sub-row">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select class="sort-select" id="cat-filter-select" onchange="ProductsView.filterByCategory(this.value)">
              <option value="">Barcha Toifalar</option>
              ${State.categories.map(c => `
                <option value="${c.id}" ${String(this.state.category_id) === String(c.id) ? 'selected' : ''}>${c.icon} ${c.name}</option>
              `).join('')}
            </select>

            <select class="sort-select" id="stock-filter-select" onchange="ProductsView.filterByStock(this.value)">
              <option value="" ${!this.state.stock_status ? 'selected' : ''}>Qoldiq: Barchasi</option>
              <option value="in_stock" ${this.state.stock_status === 'in_stock' ? 'selected' : ''}>Mavjud</option>
              <option value="low_stock" ${this.state.stock_status === 'low_stock' ? 'selected' : ''}>Kam qolgan</option>
              <option value="out_of_stock" ${this.state.stock_status === 'out_of_stock' ? 'selected' : ''}>Tugagan</option>
            </select>
          </div>

          <select class="sort-select" onchange="ProductsView.sortBy(this.value)">
            <option value="created_desc" ${this.state.sort_by === 'created_desc' ? 'selected' : ''}>Eng yangi</option>
            <option value="price_asc" ${this.state.sort_by === 'price_asc' ? 'selected' : ''}>Arzonroq</option>
            <option value="price_desc" ${this.state.sort_by === 'price_desc' ? 'selected' : ''}>Qimmatroq</option>
            <option value="stock_desc" ${this.state.sort_by === 'stock_desc' ? 'selected' : ''}>Ko'p qoldiq</option>
            <option value="stock_asc" ${this.state.sort_by === 'stock_asc' ? 'selected' : ''}>Kam qoldiq</option>
          </select>
        </div>
      </div>

      <!-- Products Grid Container -->
      <div id="products-grid-container">
        <div class="skeleton" style="height:250px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:250px"></div>
      </div>
    `;

    // Attach search listener
    const searchInput = document.getElementById("product-search-input");
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
    const gridContainer = document.getElementById("products-grid-container");
    if (!gridContainer) return;

    try {
      const data = await API.get("/products", this.state);
      const { items, total, page, total_pages } = data;

      if (items.length === 0) {
        gridContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-title">Mahsulotlar topilmadi</div>
            <div class="empty-desc">Qidiruv mezonlari bo'yicha mos keladigan ehtiyot qism yo'q.</div>
          </div>
        `;
        return;
      }

      gridContainer.innerHTML = `
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:12px">
          Jami <strong>${total}</strong> ta mahsulot topildi
        </div>
        <div class="products-grid">
          ${items.map(p => this.renderProductCard(p)).join('')}
        </div>

        <!-- Pagination -->
        ${total_pages > 1 ? `
        <div class="pagination-container">
          <button class="btn btn-secondary btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="ProductsView.changePage(${page - 1})">
            ← Oldingi
          </button>
          <span class="page-indicator">${page} / ${total_pages}</span>
          <button class="btn btn-secondary btn-sm" ${page >= total_pages ? 'disabled' : ''} onclick="ProductsView.changePage(${page + 1})">
            Keyingi →
          </button>
        </div>
        ` : ''}
      `;
    } catch (err) {
      gridContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Katalogni yuklashda xatolik</div>
          <div class="empty-desc">${Utils.escapeHtml(err.message)}</div>
        </div>
      `;
    }
  },

  renderProductCard(p) {
    const isStaffOrAdmin = State.isStaffOrAdmin();
    const isAdmin = State.isAdmin();

    let stockClass = "stock-in";
    if (p.quantity === 0) stockClass = "stock-out";
    else if (p.quantity <= p.min_stock) stockClass = "stock-low";

    const carTags = (p.car_model || "").split(",").map(m => m.trim()).filter(Boolean);

    return `
      <div class="product-card" onclick="ProductsView.openDetailModal(${p.id})">
        <div class="product-image-box">
          <img src="${p.image_url || 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=400'}" alt="${Utils.escapeHtml(p.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=400'">
          <span class="product-badge-condition ${p.condition === 'NEW' ? 'condition-new' : 'condition-used'}">
            ${p.condition === 'NEW' ? 'Yangi' : 'Ishlatilgan'}
          </span>
          ${p.shelf_location ? `<span class="product-badge-shelf">Polka: ${p.shelf_location}</span>` : ''}
        </div>

        <div class="product-body">
          <div class="product-sku">${p.sku} ${p.brand ? `• ${p.brand}` : ''}</div>
          <h3 class="product-name" title="${Utils.escapeHtml(p.name)}">${Utils.escapeHtml(p.name)}</h3>

          ${carTags.length > 0 ? `
          <div class="product-car-tags">
            ${carTags.slice(0, 3).map(ct => `<span class="car-tag">${Utils.escapeHtml(ct)}</span>`).join('')}
          </div>
          ` : ''}

          <div class="stock-pill ${stockClass}">
            <span>●</span> ${p.quantity} ${p.unit} (${p.stock_label})
          </div>

          <div class="product-pricing">
            <div class="product-selling-price">${Utils.formatUZS(p.selling_price)}</div>
            ${isAdmin ? `<div class="product-cost-price">Tannarx: ${Utils.formatUZS(p.purchase_price)}</div>` : ''}
          </div>

          ${isStaffOrAdmin ? `
          <div class="product-card-actions" onclick="event.stopPropagation()">
            <button class="btn btn-success btn-sm" onclick="StockModal.open('out', ${p.id})">
              Sotish
            </button>
            <button class="btn btn-secondary btn-sm" onclick="StockModal.open('in', ${p.id})">
              Kirim +
            </button>
          </div>
          ` : `
          <button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" onclick="event.stopPropagation(); ProductsView.contactSeller(${p.id})">
            Sotuvchi bilan bog'lanish
          </button>
          `}
        </div>
      </div>
    `;
  },

  filterByCar(carModel) {
    this.state.car_model = carModel;
    this.state.page = 1;
    this.render();
  },

  filterByCategory(catId) {
    this.state.category_id = catId;
    this.state.page = 1;
    this.loadProducts();
  },

  filterByStock(status) {
    this.state.stock_status = status;
    this.state.page = 1;
    this.loadProducts();
  },

  sortBy(sortVal) {
    this.state.sort_by = sortVal;
    this.state.page = 1;
    this.loadProducts();
  },

  changePage(newPage) {
    this.state.page = newPage;
    this.loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * Product Detail Modal with Recent Timeline
   */
  async openDetailModal(productId) {
    const modalRoot = document.getElementById("modal-root");
    modalRoot.innerHTML = `<div class="modal-sheet"><div style="padding:30px;text-align:center">Yuklanmoqda...</div></div>`;
    document.getElementById("modal-overlay").classList.add("active");

    try {
      const data = await API.get(`/products/${productId}`);
      const { product, history } = data;

      modalRoot.innerHTML = `
        <div class="modal-sheet">
          <div class="modal-header">
            <div class="modal-title">
              <span>${product.category_icon || '📦'}</span> ${Utils.escapeHtml(product.name)}
            </div>
            <button class="modal-close-btn" onclick="ProductsView.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="height:180px;border-radius:var(--radius-md);overflow:hidden;margin-bottom:16px;background:var(--bg-surface-elevated)">
              <img src="${product.image_url || 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600'}" style="width:100%;height:100%;object-fit:cover">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
              <div style="background:var(--bg-main);padding:10px;border-radius:var(--radius-sm)">
                <div style="font-size:11px;color:var(--text-dim)">Sotish Narxi:</div>
                <div style="font-size:16px;font-weight:700;color:var(--text-main)">${Utils.formatUZS(product.selling_price)}</div>
              </div>
              ${State.isAdmin() ? `
              <div style="background:var(--bg-main);padding:10px;border-radius:var(--radius-sm)">
                <div style="font-size:11px;color:var(--text-dim)">Birlik Tannarxi:</div>
                <div style="font-size:16px;font-weight:700;color:var(--text-muted)">${Utils.formatUZS(product.purchase_price)}</div>
              </div>
              ` : ''}
            </div>

            <div style="font-size:13px;line-height:1.7;color:var(--text-muted);margin-bottom:16px">
              <div><strong>Artikul (SKU):</strong> ${product.sku}</div>
              <div><strong>Brend:</strong> ${product.brand || '—'}</div>
              <div><strong>Mos avtomobillar:</strong> ${product.car_model || '—'} (${product.compatible_years || 'Barcha yillar'})</div>
              <div><strong>Holati:</strong> ${product.condition === 'NEW' ? 'Yangi' : 'Ishlatilgan'}</div>
              <div><strong>Ombordagi qoldiq:</strong> ${product.quantity} ${product.unit} (Min: ${product.min_stock})</div>
              <div><strong>Tokcha / Joylashuv:</strong> ${product.shelf_location || 'Belgilanmagan'}</div>
              ${product.description ? `<div style="margin-top:8px"><strong>Tavsif:</strong> ${Utils.escapeHtml(product.description)}</div>` : ''}
            </div>

            ${State.isStaffOrAdmin() && history && history.length > 0 ? `
            <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:14px">
              <strong style="font-size:13px;color:var(--text-main)">Oxirgi harakatlar tarixi:</strong>
              <div style="margin-top:8px">
                ${history.map(h => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border)">
                    <div>
                      <strong style="color:${h.type === 'chiqim' ? 'var(--accent-emerald)' : 'var(--brand-blue)'}">
                        ${h.type === 'chiqim' ? 'Sotuv' : 'Kirim'}
                      </strong>
                      <span>${h.quantity} dona (${Utils.formatUZS(h.total_amount)})</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-dim)">
                      ${Utils.formatDateTime(h.created_at)}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}
          </div>

          <div class="modal-footer">
            ${State.isAdmin() ? `
            <button class="btn btn-ghost btn-sm" onclick="ProductsView.openEditModal(${product.id})">Tahrirlash</button>
            <button class="btn btn-danger btn-sm" onclick="ProductsView.confirmDelete(${product.id}, '${Utils.escapeHtml(product.name)}')">Arxivlash</button>
            ` : ''}
            ${State.isStaffOrAdmin() ? `
            <button class="btn btn-success" onclick="StockModal.open('out', ${product.id})">Sotish</button>
            <button class="btn btn-primary" onclick="StockModal.open('in', ${product.id})">Kirim +</button>
            ` : `
            <button class="btn btn-primary" onclick="ProductsView.contactSeller(${product.id})">Sotuvchi bilan bog'lanish</button>
            `}
          </div>
        </div>
      `;
    } catch (err) {
      modalRoot.innerHTML = `
        <div class="modal-sheet">
          <div class="modal-body" style="text-align:center;padding:30px">
            <div>Xatolik: ${Utils.escapeHtml(err.message)}</div>
            <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="ProductsView.closeModal()">Yopish</button>
          </div>
        </div>
      `;
    }
  },

  /**
   * Add Product Modal
   */
  openAddModal() {
    const modalRoot = document.getElementById("modal-root");
    modalRoot.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-header">
          <div class="modal-title">➕ Yangi Mahsulot Qo'shish</div>
          <button class="modal-close-btn" onclick="ProductsView.closeModal()">✕</button>
        </div>
        <form id="add-product-form" onsubmit="ProductsView.submitAddProduct(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Mahsulot Nomi *</label>
              <input type="text" name="name" class="form-control" required placeholder="Masalan, Gentra Oldi Oyna (Original)">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Artikul (SKU) *</label>
                <input type="text" name="sku" class="form-control" required placeholder="GLS-GEN-01">
              </div>
              <div class="form-group">
                <label class="form-label">Toifa *</label>
                <select name="category_id" class="form-control" required>
                  ${State.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Brend</label>
                <input type="text" name="brand" class="form-control" placeholder="GM Genuine, Bosch, Michelin...">
              </div>
              <div class="form-group">
                <label class="form-label">Mos Avtomobil</label>
                <input type="text" name="car_model" class="form-control" placeholder="Cobalt, Gentra, Malibu...">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tannarx (UZS) *</label>
                <input type="number" name="purchase_price" class="form-control" required min="0" placeholder="30000">
              </div>
              <div class="form-group">
                <label class="form-label">Sotish Narxi (UZS) *</label>
                <input type="number" name="selling_price" class="form-control" required min="0" placeholder="50000">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Dastlabki Qoldiq</label>
                <input type="number" name="quantity" class="form-control" min="0" value="0">
              </div>
              <div class="form-group">
                <label class="form-label">Min. Qoldiq (Ogohlantirish)</label>
                <input type="number" name="min_stock" class="form-control" min="0" value="2">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tokcha / Joylashuv (Polka)</label>
                <input type="text" name="shelf_location" class="form-control" placeholder="A-12, B-04...">
              </div>
              <div class="form-group">
                <label class="form-label">Holati</label>
                <select name="condition" class="form-control">
                  <option value="NEW">Yangi (NEW)</option>
                  <option value="USED">Ishlatilgan (USED)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Rasm havolasi (URL)</label>
              <input type="url" name="image_url" class="form-control" placeholder="https://images.unsplash.com/...">
            </div>

            <div class="form-group">
              <label class="form-label">Tavsif (Qo'shimcha)</label>
              <textarea name="description" class="form-control" rows="2" placeholder="O'rnatish xususiyatlari, o'lchamlari..."></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="ProductsView.closeModal()">Bekor qilish</button>
            <button type="submit" class="btn btn-primary" id="save-product-btn">Saqlash</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById("modal-overlay").classList.add("active");
  },

  async submitAddProduct(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById("save-product-btn");
    btn.disabled = true;
    btn.textContent = "Saqlanmoqda...";

    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      sku: formData.get("sku"),
      category_id: parseInt(formData.get("category_id")),
      brand: formData.get("brand") || "",
      car_model: formData.get("car_model") || "",
      purchase_price: parseInt(formData.get("purchase_price")),
      selling_price: parseInt(formData.get("selling_price")),
      quantity: parseInt(formData.get("quantity") || 0),
      min_stock: parseInt(formData.get("min_stock") || 2),
      shelf_location: formData.get("shelf_location") || "",
      condition: formData.get("condition") || "NEW",
      image_url: formData.get("image_url") || "",
      description: formData.get("description") || ""
    };

    try {
      await API.post("/products", payload);
      Utils.showToast("Mahsulot omborga muvaffaqiyatli qo'shildi!", "success");
      ProductsView.closeModal();
      ProductsView.render();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Saqlash";
    }
  },

  /**
   * Edit Product Modal
   */
  async openEditModal(productId) {
    try {
      const data = await API.get(`/products/${productId}`);
      const p = data.product;

      const modalRoot = document.getElementById("modal-root");
      modalRoot.innerHTML = `
        <div class="modal-sheet">
          <div class="modal-header">
            <div class="modal-title">✏️ Mahsulotni Tahrirlash</div>
            <button class="modal-close-btn" onclick="ProductsView.closeModal()">✕</button>
          </div>
          <form id="edit-product-form" onsubmit="ProductsView.submitEditProduct(event, ${productId})">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Mahsulot Nomi *</label>
                <input type="text" name="name" class="form-control" required value="${Utils.escapeHtml(p.name)}">
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Artikul (SKU) *</label>
                  <input type="text" name="sku" class="form-control" required value="${Utils.escapeHtml(p.sku)}">
                </div>
                <div class="form-group">
                  <label class="form-label">Toifa *</label>
                  <select name="category_id" class="form-control" required>
                    ${State.categories.map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Tannarx (UZS)</label>
                  <input type="number" name="purchase_price" class="form-control" min="0" value="${p.purchase_price}">
                </div>
                <div class="form-group">
                  <label class="form-label">Sotish Narxi (UZS)</label>
                  <input type="number" name="selling_price" class="form-control" min="0" value="${p.selling_price}">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Tokcha / Joylashuv</label>
                  <input type="text" name="shelf_location" class="form-control" value="${Utils.escapeHtml(p.shelf_location || '')}">
                </div>
                <div class="form-group">
                  <label class="form-label">Min. Qoldiq</label>
                  <input type="number" name="min_stock" class="form-control" value="${p.min_stock}">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Tavsif</label>
                <textarea name="description" class="form-control" rows="2">${Utils.escapeHtml(p.description || '')}</textarea>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="ProductsView.closeModal()">Bekor qilish</button>
              <button type="submit" class="btn btn-primary" id="edit-save-btn">Saqlash</button>
            </div>
          </form>
        </div>
      `;
    } catch (err) {
      Utils.showToast("Xatolik: " + err.message, "error");
    }
  },

  async submitEditProduct(e, productId) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById("edit-save-btn");
    btn.disabled = true;

    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      sku: formData.get("sku"),
      category_id: parseInt(formData.get("category_id")),
      purchase_price: parseInt(formData.get("purchase_price")),
      selling_price: parseInt(formData.get("selling_price")),
      shelf_location: formData.get("shelf_location") || "",
      min_stock: parseInt(formData.get("min_stock") || 2),
      description: formData.get("description") || ""
    };

    try {
      await API.put(`/products/${productId}`, payload);
      Utils.showToast("Mahsulot ma'lumotlari yangilandi!", "success");
      ProductsView.closeModal();
      ProductsView.loadProducts();
    } catch (err) {
      btn.disabled = false;
    }
  },

  async confirmDelete(productId, productName) {
    if (!confirm(`Haqiqatan ham '${productName}' mahsulotini arxivlamoqchimisiz? Barcha moliyaviy tranzaksiyalar tarixi saqlanadi.`)) {
      return;
    }

    try {
      await API.delete(`/products/${productId}`);
      Utils.showToast("Mahsulot xavfsiz arxivlandi!", "info");
      ProductsView.closeModal();
      ProductsView.loadProducts();
    } catch (err) {
      Utils.showToast("Xatolik: " + err.message, "error");
    }
  },

  contactSeller(productId) {
    const phone = State.shopSettings.shop_phone || "+998 90 123 45 67";
    const tg = State.shopSettings.shop_telegram || "@avto_sklad_admin";
    alert(`Sotuvchi bilan bog'lanish:\n📞 Telefon: ${phone}\n💬 Telegram: ${tg}`);
  },

  closeModal() {
    document.getElementById("modal-overlay").classList.remove("active");
  }
};
