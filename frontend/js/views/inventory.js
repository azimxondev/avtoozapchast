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
      <div class="inventory-view-container" style="padding: 14px; max-width: 720px; margin: 0 auto;">
        
        <!-- Inventory Valuation KPIs -->
        <div class="kpi-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <div class="kpi-card" style="background:#121826; border: 1px solid #1e293b; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#94a3b8;">Jami Tovar Soni</div>
            <div id="inv-total-qty" style="font-size:18px; font-weight:700; color:#f8fafc; margin-top:2px;">...</div>
            <div id="inv-total-types" style="font-size:11px; color:#60a5fa; margin-top:2px;">... tur</div>
          </div>
          <div class="kpi-card" style="background:#121826; border: 1px solid #1e293b; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#94a3b8;">Kam Qolgan / Tugagan</div>
            <div id="inv-alert-count" style="font-size:18px; font-weight:700; color:#ef4444; margin-top:2px;">...</div>
            <div style="font-size:11px; color:#f59e0b; margin-top:2px;">zudlik bilan kirim</div>
          </div>
          <div class="kpi-card" style="background:#121826; border: 1px solid #1e293b; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#94a3b8;">Ombor Tannarxi</div>
            <div id="inv-cost-val" style="font-size:14px; font-weight:700; color:#38bdf8; margin-top:2px;">...</div>
            <div style="font-size:10px; color:#64748b;">xarid narxida</div>
          </div>
          <div class="kpi-card" style="background:#121826; border: 1px solid #1e293b; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#94a3b8;">Kutilayotgan Foyda</div>
            <div id="inv-projected-profit" style="font-size:14px; font-weight:700; color:#22c55e; margin-top:2px;">...</div>
            <div style="font-size:10px; color:#64748b;">to'liq sotilganda</div>
          </div>
        </div>

        <!-- Action & Filter Bar -->
        <div style="display:flex; gap:8px; margin-bottom: 12px;">
          <input id="inv-search-input" type="text" placeholder="Qidirish (nomi, artikul, model)..." 
            style="flex:1; background:#0b0f19; border:1px solid #334155; color:#f8fafc; font-size:12px; padding:8px 12px; border-radius:8px;"
            oninput="InventoryView.onSearch(this.value)" />
          <button class="btn btn-primary btn-sm" onclick="StockModal.open('kirim')">
            + Kirim Qilish
          </button>
        </div>

        <!-- Filter Tabs -->
        <div style="display:flex; gap:6px; margin-bottom: 14px; overflow-x:auto;">
          <button id="tab-inv-all" class="btn btn-secondary btn-sm" onclick="InventoryView.setFilter('all')" style="border-radius:20px; font-size:11px;">
            Barchasi
          </button>
          <button id="tab-inv-low" class="btn btn-ghost btn-sm" onclick="InventoryView.setFilter('low')" style="border-radius:20px; font-size:11px; color:#fbbf24;">
            ⚠️ Kam Qolganlar
          </button>
          <button id="tab-inv-out" class="btn btn-ghost btn-sm" onclick="InventoryView.setFilter('out')" style="border-radius:20px; font-size:11px; color:#ef4444;">
            🔴 Tugaganlar
          </button>
        </div>

        <!-- Product List -->
        <div id="inv-items-list">
          <div style="text-align:center; padding: 24px; color:#94a3b8;">Ombor ma'lumotlari yuklanmoqda...</div>
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
      this.rawProducts = res.products || [];

      // Compute valuations
      let totalQty = 0;
      let totalCost = 0;
      let totalSell = 0;
      let alertCount = 0;

      this.rawProducts.forEach(p => {
        const q = p.quantity || 0;
        const bp = p.purchase_price || 0;
        const sp = p.selling_price || 0;
        const minQ = p.min_stock || 2;

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
      if (list) list.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">Xatolik: ${e.message}</div>`;
    }
  },

  renderItems() {
    const listEl = document.getElementById("inv-items-list");
    if (!listEl) return;

    let filtered = this.rawProducts.filter(p => {
      const q = p.quantity || 0;
      const minQ = p.min_stock || 2;

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
        <div style="text-align:center; padding: 32px 16px; color:#94a3b8;">
          <div style="font-size:24px; margin-bottom:8px;">📦</div>
          <div style="font-size:13px; font-weight:600;">Hech qanday tovar topilmadi</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(p => {
      const q = p.quantity || 0;
      const minQ = p.min_stock || 2;
      let badge = `<span style="background:rgba(34,197,94,0.15); color:#22c55e; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">Mavjud: ${q} dona</span>`;
      if (q === 0) {
        badge = `<span style="background:rgba(239,68,68,0.15); color:#ef4444; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">Tugagan (0 dona)</span>`;
      } else if (q <= minQ) {
        badge = `<span style="background:rgba(251,191,36,0.15); color:#fbbf24; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">Kam qoldi: ${q} dona</span>`;
      }

      const shelf = p.shelf_location ? `<span style="color:#64748b; font-size:11px; margin-left:6px;">📍 ${Utils.escapeHtml(p.shelf_location)}</span>` : '';

      return `
        <div class="card mb-2" style="padding:12px; border-radius:10px; background:#121826; border:1px solid #1e293b;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
            <div style="flex:1;">
              <div style="font-size:13px; font-weight:600; color:#f8fafc; line-height:1.3;">
                ${Utils.escapeHtml(p.name)}
              </div>
              <div style="font-size:11px; color:#94a3b8; margin-top:2px;">
                <span>${Utils.escapeHtml(p.car_model || '')}</span> · 
                <code style="background:#0b0f19; padding:1px 4px; border-radius:4px; font-size:10px;">${Utils.escapeHtml(p.sku)}</code>
                ${shelf}
              </div>
            </div>
            <div>
              ${badge}
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:8px; border-top:1px solid rgba(51,65,85,0.4);">
            <div>
              <div style="font-size:10px; color:#64748b;">Tannarx / Sotuv:</div>
              <div style="font-size:12px; font-weight:600; color:#f8fafc;">
                ${Utils.formatCurrency(p.purchase_price)} <span style="color:#64748b;">→</span> <span style="color:#22c55e;">${Utils.formatCurrency(p.selling_price)}</span>
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-ghost btn-sm" style="font-size:11px; padding:4px 8px;" onclick="StockModal.openWithProduct(${p.id}, 'kirim')">
                + Kirim
              </button>
              <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="StockModal.openWithProduct(${p.id}, 'chiqim')">
                Sotish
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }
};
