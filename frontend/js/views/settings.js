/**
 * Avto Sklad — Settings, Cash Adjustment & Audit Log View
 */

const SettingsView = {
  async render() {
    const container = document.getElementById("tab-content");
    container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

    try {
      const res = await API.get("/settings");
      const s = res.settings || {};
      State.shopSettings = s;

      let auditLogs = [];
      let usersList = [];
      if (State.isAdmin()) {
        const auditRes = await API.get("/audit", { limit: 20 });
        auditLogs = auditRes.logs || [];
        const usersRes = await API.get("/settings/users");
        usersList = usersRes.users || [];
      }

      container.innerHTML = `
        <h2 style="font-size:18px;font-weight:700;color:var(--text-main);margin-bottom:16px">⚙️ Tizim va Do'kon Sozlamalari</h2>

        <!-- System Status & Version Card -->
        <div class="card mb-3" style="background:var(--bg-surface);border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:18px">🚀</span>
                <strong style="font-size:15px;color:var(--text-main)">Avto Sklad Tizimi</strong>
                <span class="badge badge-primary" style="background:rgba(37,99,235,0.2);color:var(--brand-blue);border:1px solid rgba(37,99,235,0.4)">v3.0.0</span>
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
                AI Voice Product Assistant • QR & Barcode Skaner • AI Ovozli Yordamchi (UZ/RU/EN)
              </div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm" onclick="ScannerView.open()">📷 Skaner</button>
              <button class="btn btn-secondary btn-sm" onclick="AIAssistantView.open()">🤖 AI Yordamchi</button>
            </div>
          </div>
        </div>

        <!-- Cash Adjustment Card (Transparent Accounting Rule) -->
        ${State.isSuperAdmin() ? `
        <div class="card mb-3">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div>
              <strong style="font-size:15px;color:var(--text-main)">💰 Kassa Balansini Rasmiy Tuzatish</strong>
              <div style="font-size:12px;color:var(--text-muted)">Joriy hisob: <strong>${Utils.formatUZS(s.current_balance)}</strong></div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="SettingsView.openAdjustModal(${s.current_balance})">
              Tuzatish kiritish
            </button>
          </div>
          <p style="font-size:11px;color:var(--text-dim)">
            * Buxgalteriya qoidasi: Balans shunchaki o'zgartirilmaydi. Har bir tuzatish uchun sabab ko'rsatiladi va audit jurnali hamda tranzaksiyaga yoziladi.
          </p>
        </div>
        ` : ''}

        <!-- Shop Info Form -->
        ${State.isAdmin() ? `
        <div class="card mb-3">
          <h3 style="font-size:15px;font-weight:700;color:var(--text-main);margin-bottom:14px">📍 Do'kon Rekvizitlari</h3>
          <form onsubmit="SettingsView.saveShopInfo(event)">
            <div class="form-group">
              <label class="form-label">Do'kon nomi</label>
              <input type="text" name="shop_name" class="form-control" value="${Utils.escapeHtml(s.shop_name || '')}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Aloqa Telefoni</label>
                <input type="text" name="shop_phone" class="form-control" value="${Utils.escapeHtml(s.shop_phone || '')}">
              </div>
              <div class="form-group">
                <label class="form-label">Telegram Kontakt</label>
                <input type="text" name="shop_telegram" class="form-control" value="${Utils.escapeHtml(s.shop_telegram || '')}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Do'kon Manzili</label>
              <input type="text" name="shop_address" class="form-control" value="${Utils.escapeHtml(s.shop_address || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Ish Vaqti</label>
              <input type="text" name="shop_work_hours" class="form-control" value="${Utils.escapeHtml(s.shop_work_hours || '')}">
            </div>
            <button type="submit" class="btn btn-primary" id="save-shop-btn">Sozlamalarni saqlash</button>
          </form>
        </div>
        ` : ''}

        <!-- Staff & Admin Roles -->
        ${State.isSuperAdmin() && usersList.length > 0 ? `
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px;margin-bottom:20px">
          <h3 style="font-size:15px;font-weight:700;color:var(--text-main);margin-bottom:14px">👥 Xodimlar va Rollar</h3>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
              <thead>
                <tr style="border-bottom:1px solid var(--border);color:var(--text-muted);font-size:11px;text-transform:uppercase">
                  <th style="padding:8px 12px">Foydalanuvchi</th>
                  <th style="padding:8px 12px">Telegram ID</th>
                  <th style="padding:8px 12px">Joriy Rol</th>
                  <th style="padding:8px 12px">Amal</th>
                </tr>
              </thead>
              <tbody>
                ${usersList.map(u => `
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:10px 12px">
                      <strong>${Utils.escapeHtml(u.full_name || 'Nomsiz')}</strong>
                      <div style="font-size:11px;color:var(--text-dim)">@${u.username || '—'}</div>
                    </td>
                    <td style="padding:10px 12px">${u.telegram_id || '—'}</td>
                    <td style="padding:10px 12px">
                      <span class="role-badge role-${u.role.toLowerCase().replace('_', '-')}">${u.role}</span>
                    </td>
                    <td style="padding:10px 12px">
                      <select class="sort-select" onchange="SettingsView.changeUserRole(${u.id}, this.value)">
                        <option value="SUPER_ADMIN" ${u.role === 'SUPER_ADMIN' ? 'selected' : ''}>SUPER_ADMIN</option>
                        <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                        <option value="STAFF" ${u.role === 'STAFF' ? 'selected' : ''}>STAFF</option>
                        <option value="USER" ${u.role === 'USER' ? 'selected' : ''}>USER</option>
                      </select>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}

        <!-- Audit Logs List -->
        ${State.isAdmin() && auditLogs.length > 0 ? `
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px">
          <h3 style="font-size:15px;font-weight:700;color:var(--text-main);margin-bottom:14px">🛡 Xavfsizlik va Audit Jurnali</h3>
          <div style="font-size:12px;line-height:1.7">
            ${auditLogs.map(l => `
              <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <div>
                  <strong style="color:var(--text-main)">[${l.action}]</strong>
                  <span style="color:var(--text-muted);margin-left:6px">${Utils.escapeHtml(l.new_values)}</span>
                </div>
                <div style="font-size:11px;color:var(--text-dim)">
                  ${Utils.escapeHtml(l.user_name)} • ${Utils.formatDateTime(l.created_at)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Sozlamalarni yuklab bo'lmadi</div>
          <div class="empty-desc">${Utils.escapeHtml(err.message)}</div>
        </div>
      `;
    }
  },

  async saveShopInfo(e) {
    e.preventDefault();
    const btn = document.getElementById("save-shop-btn");
    btn.disabled = true;

    const fd = new FormData(e.target);
    const payload = {
      shop_name: fd.get("shop_name"),
      shop_phone: fd.get("shop_phone"),
      shop_telegram: fd.get("shop_telegram"),
      shop_address: fd.get("shop_address"),
      shop_work_hours: fd.get("shop_work_hours")
    };

    try {
      await API.put("/settings", payload);
      Utils.showToast("Do'kon sozlamalari yangilandi!", "success");
      SettingsView.render();
    } catch (err) {
      btn.disabled = false;
    }
  },

  openAdjustModal(currentBalance) {
    const modalRoot = document.getElementById("modal-root");
    modalRoot.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-header">
          <div class="modal-title">💰 Kassa Balansini Tuzatish</div>
          <button class="modal-close-btn" onclick="ProductsView.closeModal()">✕</button>
        </div>
        <form onsubmit="SettingsView.submitAdjust(event, ${currentBalance})">
          <div class="modal-body">
            <div style="background:var(--bg-main);padding:10px;border-radius:var(--radius-sm);margin-bottom:14px;font-size:13px">
              Hozirgi kassa: <strong>${Utils.formatUZS(currentBalance)}</strong>
            </div>
            <div class="form-group">
              <label class="form-label">Yangi Kassa Balansi (UZS) *</label>
              <input type="number" id="adj-balance" class="form-control" required min="0" value="${currentBalance}">
            </div>
            <div class="form-group">
              <label class="form-label">Tuzatish Sababi (Majburiy!) *</label>
              <textarea id="adj-reason" class="form-control" required rows="2" placeholder="Masalan, Kassa inkassatsiyasi, Dastlabki balans to'g'rilash..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="ProductsView.closeModal()">Bekor qilish</button>
            <button type="submit" class="btn btn-primary" id="adj-btn">Tasdiqlash va Yozish</button>
          </div>
        </form>
      </div>
    `;
    document.getElementById("modal-overlay").classList.add("active");
  },

  async submitAdjust(e, currentBalance) {
    e.preventDefault();
    const btn = document.getElementById("adj-btn");
    btn.disabled = true;

    const newBal = parseInt(document.getElementById("adj-balance").value);
    const reason = document.getElementById("adj-reason").value.trim();

    try {
      await API.post("/settings/balance-adjustment", {
        new_balance: newBal,
        reason: reason
      });
      Utils.showToast("Kassa balansi yangilandi va tranzaksiya yozildi!", "success");
      ProductsView.closeModal();
      SettingsView.render();
    } catch (err) {
      btn.disabled = false;
    }
  },

  async changeUserRole(userId, newRole) {
    try {
      await API.put(`/settings/users/${userId}/role`, { role: newRole });
      Utils.showToast("Foydalanuvchi roli yangilandi!", "success");
    } catch (err) {
      Utils.showToast("Rolni yangilashda xato: " + err.message, "error");
    }
  }
};
