/**
 * Avto Sklad — Dashboard View
 */

const DashboardView = {
  async render() {
    const container = document.getElementById("tab-content");
    container.innerHTML = `
      <div class="skeleton" style="height:140px;margin-bottom:20px"></div>
      <div class="skeleton" style="height:80px;margin-bottom:20px"></div>
      <div class="skeleton" style="height:200px"></div>
    `;

    try {
      const data = await API.get("/analytics/overview");
      const { current_balance, today, inventory } = data;

      container.innerHTML = `
        <!-- Hero Balance Card -->
        <div class="balance-hero-card">
          <div class="hero-header">
            <span class="hero-label">
              <span>💰</span> Kassa & Sklad Balansi
            </span>
            <button class="formula-pill-btn" onclick="DashboardView.openFormulaModal(${current_balance})">
              <span>ℹ️</span> Nega bu summa?
            </button>
          </div>
          <div class="hero-balance-amount">
            <span>${Utils.formatUZS(current_balance).replace(" UZS", "")}</span>
            <span class="hero-balance-currency">UZS</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap">
            <span>Bugungi sof foyda: <strong style="color:var(--accent-emerald)">+${Utils.formatUZS(today.profit)}</strong></span>
            <span>Ombordagi tovarlar: <strong>${inventory.total_quantity} dona</strong></span>
          </div>
        </div>

        <!-- Quick Action Buttons -->
        ${State.isStaffOrAdmin() ? `
        <div class="quick-actions-grid">
          <button class="action-card-btn action-sale" onclick="StockModal.open('out')">
            <div class="action-icon-circle">🛒</div>
            <span class="action-label">Sotish (Chiqim)</span>
          </button>
          <button class="action-card-btn action-purchase" onclick="StockModal.open('in')">
            <div class="action-icon-circle">📥</div>
            <span class="action-label">Kirim (Xarid)</span>
          </button>
          <button class="action-card-btn action-product" onclick="ProductsView.openAddModal()">
            <div class="action-icon-circle">➕</div>
            <span class="action-label">Yangi Mahsulot</span>
          </button>
        </div>
        ` : ''}

        <!-- Today & Inventory Metrics Grid -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Bugungi Tushum</span>
              <span class="metric-icon">📈</span>
            </div>
            <div class="metric-value metric-positive">+${Utils.formatUZS(today.revenue)}</div>
            <div class="metric-sub">${today.items_sold} dona tovar sotildi</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Bugungi Xaridlar</span>
              <span class="metric-icon">📉</span>
            </div>
            <div class="metric-value metric-negative">-${Utils.formatUZS(today.expenses)}</div>
            <div class="metric-sub">${today.items_received} dona tovar qabul qilindi</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Bugungi Sof Foyda</span>
              <span class="metric-icon">✨</span>
            </div>
            <div class="metric-value ${today.profit >= 0 ? 'metric-positive' : 'metric-negative'}">
              ${today.profit >= 0 ? '+' : ''}${Utils.formatUZS(today.profit)}
            </div>
            <div class="metric-sub">Sotuv narxi - Tannarx</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Sklad Tannarxi</span>
              <span class="metric-icon">📦</span>
            </div>
            <div class="metric-value">${Utils.formatUZS(inventory.total_cost_value)}</div>
            <div class="metric-sub">Potensial: ${Utils.formatUZS(inventory.potential_selling_value)}</div>
          </div>
        </div>

        <!-- Low Stock Alert Banner -->
        ${inventory.low_stock_count > 0 || inventory.out_of_stock_count > 0 ? `
        <div class="alert-card">
          <div class="alert-header">
            <span class="alert-title">
              <span>⚠️</span> Kam qolgan va tugagan tovarlar (${inventory.low_stock_count + inventory.out_of_stock_count} ta)
            </span>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('products', { stock_status: 'low_stock' })">
              Barchasini ko'rish →
            </button>
          </div>
          <div>
            ${inventory.low_stock_items.map(p => `
              <div class="alert-item-row">
                <div>
                  <strong style="color:var(--text-main)">${Utils.escapeHtml(p.name)}</strong>
                  <div style="font-size:11px;color:var(--text-dim)">SKU: ${p.sku} | Polka: ${p.shelf_location || '—'}</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="stock-pill ${p.quantity === 0 ? 'stock-out' : 'stock-low'}">
                    ${p.quantity} ${p.unit} qoldi (min: ${p.min_stock})
                  </span>
                  ${State.isStaffOrAdmin() ? `
                  <button class="btn btn-primary btn-sm" onclick="StockModal.open('in', ${p.id})">
                    Kirim +
                  </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Quick Inventory Valuation Card -->
        <div class="chart-section" style="margin-top:12px">
          <div class="chart-title" style="margin-bottom:12px">🏢 Sklad Umumiy Qiymati va Potensial Foyda</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px">
            <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-md)">
              <div style="font-size:11px;color:var(--text-muted)">Jami mahsulot turlari</div>
              <div style="font-size:18px;font-weight:700;color:var(--text-main)">${inventory.total_products} xil</div>
            </div>
            <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-md)">
              <div style="font-size:11px;color:var(--text-muted)">Ombordagi umumiy qoldiq</div>
              <div style="font-size:18px;font-weight:700;color:var(--text-main)">${inventory.total_quantity} dona</div>
            </div>
            <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-md)">
              <div style="font-size:11px;color:var(--text-muted)">Potensial yalpi foyda</div>
              <div style="font-size:18px;font-weight:700;color:var(--accent-emerald)">+${Utils.formatUZS(inventory.potential_profit)}</div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Dashboard ma'lumotlarini yuklab bo'lmadi</div>
          <div class="empty-desc">${Utils.escapeHtml(err.message)}</div>
          <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="DashboardView.render()">Qayta urinish</button>
        </div>
      `;
    }
  },

  /**
   * Transparent Formula Modal ("Nega bu summa o'zgardi?")
   */
  async openFormulaModal(currentBalance) {
    const modalContent = document.getElementById("modal-root");
    modalContent.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-header">
          <div class="modal-title">
            <span>ℹ️</span> Hisob-kitob Shaffofligi
          </div>
          <button class="modal-close-btn" onclick="DashboardView.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
            Avto Sklad tizimida birorta ham raqam sababsiz o'zgarmaydi. Kassa va byudjet har bir sotuv, xarid va operatsiya asosida shaffof shakllanadi.
          </p>

          <div class="formula-box">
            <div style="font-size:11px;color:#94A3B8;margin-bottom:4px;text-transform:uppercase">Buxgalteriya formulasi:</div>
            <div class="formula-code">
              Joriy Balans = Boshlang'ich Kassa - Xaridlar + Sotuvlar
            </div>
          </div>

          <div class="formula-step-card">
            <div class="step-num">1</div>
            <div>
              <strong style="color:var(--text-main);font-size:13px">Kirim (Stock In / Xarid):</strong>
              <p style="font-size:12px;color:var(--text-muted)">Tovarlar xarid qilinganda ombor qoldig'i oshadi, to'lov esa kassa balansidan ayiriladi (Kredit).</p>
            </div>
          </div>

          <div class="formula-step-card">
            <div class="step-num">2</div>
            <div>
              <strong style="color:var(--text-main);font-size:13px">Sotuv (Stock Out / Chiqim):</strong>
              <p style="font-size:12px;color:var(--text-muted)">Tovar mijozga sotilganda ombor qoldig'i kamayadi, tushum kassa balansiga qo'shiladi (Debet).</p>
            </div>
          </div>

          <div class="formula-step-card">
            <div class="step-num">3</div>
            <div>
              <strong style="color:var(--text-main);font-size:13px">Sof Foyda Qoidasi:</strong>
              <p style="font-size:12px;color:var(--text-muted)">Sof foyda = (Sotish narxi - Birlik tannarxi) × Sotilgan miqdor. Tizim avtomatik tarzda har bir dona tovardan olingan foydani qayd etadi.</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="DashboardView.closeModal()">Yopish</button>
          <button class="btn btn-primary" onclick="DashboardView.closeModal(); App.navigate('transactions')">Tranzaksiyalar tarixini ko'rish</button>
        </div>
      </div>
    `;

    document.getElementById("modal-overlay").classList.add("active");
  },

  closeModal() {
    document.getElementById("modal-overlay").classList.remove("active");
  }
};
