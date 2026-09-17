/**
 * Avto Sklad — Dedicated Inventory View
 * Warehouse stock control, valuation, low stock warnings, shelf locations.
 */

const InventoryView = {
  currentFilter: "all", // 'all' | 'low' | 'out'
  searchQuery: "",
  selectedCar: "",

  async render(container) {
    if (State.currentRole === "USER") {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h3>Ruxsat Cheklangan</h3>
          <p>Ushbu bo'lim faqat ombor xodimlari va adminlar uchun mo'ljallangan.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="inventory-view-container" style="padding: 12px 14px; max-width: 760px; margin: 0 auto;">
        
        <!-- Inventory Valuation KPIs -->
        <div class="kpi-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px;">
          <div class="card" style="padding:14px; border-radius:14px; background:linear-gradient(145deg, rgba(18,26,44,0.85) 0%, rgba(12,18,32,0.85) 100%);">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Jami Tovar Soni</div>
            <div id="inv-total-qty" style="font-size:20px; font-weight:800; color:#fff; margin-top:4px;">...</div>
            <div id="inv-total-types" style="font-size:11px; color:var(--primary); font-weight:600; margin-top:2px;">... tur</div>
          </div>
          <div class="card" style="padding:14px; border-radius:14px; background:linear-gradient(145deg, rgba(18,26,44,0.85) 0%, rgba(12,18,32,0.85) 100%);">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Kam Qolgan / Tugagan</div>
            <div id="inv-alert-count" style="font-size:20px; font-weight:800; color:var(--danger); margin-top:4px;">...</div>
            <div style="font-size:11px; color:var(--warning); font-weight:600; margin-top:2px;">zudlik bilan kirim</div>
          </div>
          <div class="card" style="padding:14px; border-radius:14px; background:linear-gradient(145deg, rgba(18,26,44,0.85) 0%, rgba(12,18,32,0.85) 100%);">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Ombor Tannarxi</div>
            <div id="inv-cost-val" style="font-size:16px; font-weight:800; color:var(--info); margin-top:4px;">...</div>
            <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">xarid narxida</div>
          </div>
          <div class="card" style="padding:14px; border-radius:14px; background:linear-gradient(145deg, rgba(18,26,44,0.85) 0%, rgba(12,18,32,0.85) 100%);">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Kutilayotgan Foyda</div>
            <div id="inv-projected-profit" style="font-size:16px; font-weight:800; color:var(--success); margin-top:4px;">...</div>
            <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">to'liq sotilganda</div>
          </div>
        </div>

        <!-- Action & Filter Bar -->
        <div style="display:flex; gap:10px; margin-bottom: 12px; align-items:center;">
          <div style="flex:1; position:relative;">
            <input id="inv-search-input" type="text" class="form-control" placeholder="Qidirish (nomi, artikul, model)..." 
              style="padding-left:12px; font-size:13px;"
              oninput="InventoryView.onSearch(this.value)" />
          </div>
          <button class="btn btn-primary" style="flex-shrink:0;" onclick="StockModal.open('kirim')">
            + Kirim
          </button>
        </div>

        <!-- Filter Tabs -->
        <div style="display:flex; gap:8px; margin-bottom: 14px; overflow-x:auto; padding-bottom:4px;">
          <button id="tab-inv-all" class="btn btn-secondary btn-sm" onclick="InventoryView.setFilter('all')" style="border-radius:20px; font-size:12px;">
            Barchasi
          </button>
          <button id="tab-inv-low" class="btn btn-ghost btn-sm" onclick="InventoryView.setFilter('low')" style="border-radius:20px; font-size:12px; color:var(--warning);">
            ⚠️ Kam Qolganlar
          </button>
          <button id="tab-inv-out" class="btn btn-ghost btn-sm" onclick="InventoryView.setFilter('out')" style="border-radius:20px; font-size:12px; color:var(--danger);">
            🔴 Tugaganlar
          </button>
        </div>

        <!-- Product List -->
        <div id="inv-items-list">
          <div style="text-align:center; padding: 30px; color:var(--text-muted);">
            <div class="skeleton" style="height:60px; margin-bottom:8px; border-radius:12px;"></div>
            <div class="skeleton" style="height:60px; margin-bottom:8px; border-radius:12px;"></div>
            <div class="skeleton" style="height:60px; border-radius:12px;"></div>
          </div>
        </div>

      </div>
    `;

    await this.loadInventoryData();
  },

  setFilter(filter) {
    this.currentFilter = filter;
    ["all", "low", "out"].forEach(f => {
      const btn = document.getElementById(`tab-inv-${f}`);
      if (btn) {
        if (f === filter) {
          btn.className = "btn btn-secondary btn-sm";
        } else {
          btn.className = "btn btn-ghost btn-sm";
        }
      }
    });
    this.renderItems();
  },

  onSearch(val) {
    this.searchQuery = val.trim().toLowerCase();
    this.renderItems();
  },

  rawProducts: [],

  async loadInventoryData() {
    try {
      const res = await API.get("/products", { limit: 200 });
      this.rawProducts = res.items || res.products || [];

      // Compute valuations
      let totalQty = 0;
      let totalCost = 0;
      let totalSell = 0;
      let alertCount = 0;

      this.rawProducts.forEach(p => {
        const q = Number(p.quantity) || 0;
        const bp = Number(p.purchase_price) || 0;
        const sp = Number(p.selling_price) || 0;
        const minQ = Number(p.min_stock) || 2;

        totalQty += q;
        totalCost += (q * bp);
        totalSell += (q * sp);

        if (q <= minQ) alertCount++;
      });

      const profit = totalSell - totalCost;

      const qtyEl = document.getElementById("inv-total-qty");
      const typesEl = document.getElementById("inv-total-types");
      const alertEl = document.getElementById("inv-alert-count");
      const costEl = document.getElementById("inv-cost-val");
      const profEl = document.getElementById("inv-projected-profit");

      if (qtyEl) qtyEl.innerText = `${totalQty.toLocaleString()} dona`;
      if (typesEl) typesEl.innerText = `${this.rawProducts.length} xil mahsulot`;
      if (alertEl) alertEl.innerText = `${alertCount} ta tovar`;
      if (costEl) costEl.innerText = Utils.formatCurrency(totalCost);
      if (profEl) profEl.innerText = `+${Utils.formatCurrency(profit)}`;

      this.renderItems();
    } catch (e) {
      const list = document.getElementById("inv-items-list");
      if (list) list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--danger);">Xatolik: ${Utils.escapeHtml(e.message)}</div>`;
    }
  },

  renderItems() {
    const listEl = document.getElementById("inv-items-list");
    if (!listEl) return;

    let filtered = this.rawProducts.filter(p => {
      const q = Number(p.quantity) || 0;
      const minQ = Number(p.min_stock) || 2;

      if (this.currentFilter === "low" && !(q > 0 && q <= minQ)) return false;
      if (this.currentFilter === "out" && q !== 0) return false;

      if (this.searchQuery) {
        const text = `${p.name} ${p.sku} ${p.car_model || ''} ${p.brand || ''}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-title">Hech qanday tovar topilmadi</div>
          <div class="empty-desc">Tanlangan mezonlar bo'yicha mahsulot mavjud emas.</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(p => {
      const q = Number(p.quantity) || 0;
      const minQ = Number(p.min_stock) || 2;
      let stockClass = "badge-success";
      let stockText = `Mavjud: ${q} dona`;
      if (q === 0) {
        stockClass = "badge-danger";
        stockText = `Tugagan (0 dona)`;
      } else if (q <= minQ) {
        stockClass = "badge-warning";
        stockText = `Kam qoldi: ${q} dona`;
      }

      const shelf = p.shelf_location ? `<span style="color:var(--text-dim); font-size:11px; margin-left:6px;">📍 ${Utils.escapeHtml(p.shelf_location)}</span>` : '';

      return `
        <div class="card mb-2" style="padding:14px; border-radius:12px; transition:transform 0.15s ease;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div style="flex:1; padding-right:8px;">
              <div style="font-size:14px; font-weight:700; color:#fff; line-height:1.35;">
                ${Utils.escapeHtml(p.name)}
              </div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                ${p.car_model ? `<span class="badge" style="background:rgba(59,130,246,0.12); color:#60a5fa; padding:1px 6px; font-size:10px;">${Utils.escapeHtml(p.car_model)}</span>` : ''}
                <code style="background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; font-size:11px; color:#cbd5e1; font-family:monospace;">${Utils.escapeHtml(p.sku)}</code>
                ${shelf}
              </div>
            </div>
            <div>
              <span class="badge ${stockClass}">${stockText}</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:10px; border-top:1px solid var(--border-color);">
            <div>
              <div style="font-size:10px; color:var(--text-dim); font-weight:600; text-transform:uppercase;">Tannarx / Sotuv</div>
              <div style="font-size:13px; font-weight:700; color:var(--text-main); margin-top:2px;">
                ${Utils.formatCurrency(p.purchase_price)} <span style="color:var(--text-dim);">→</span> <span style="color:var(--success);">${Utils.formatCurrency(p.selling_price)}</span>
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-sm" onclick="StockModal.open('in', ${p.id})">
                + Kirim
              </button>
              <button class="btn btn-success btn-sm" onclick="StockModal.open('out', ${p.id})">
                Sotish
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }
};
