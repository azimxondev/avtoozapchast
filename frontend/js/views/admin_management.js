/**
 * Avto Sklad — Admin Management View (Head Admin Only)
 * 15-minute single-use invite links, admin roster, and access control.
 */

const AdminManagementView = {
  activeTimer: null,

  async render(container) {
    if (State.currentRole !== "SUPER_ADMIN" && !State.currentUser?.is_super_admin) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h3>Ruxsat Cheklangan</h3>
          <p>Ushbu bo'lim faqat Yagona Bosh Admin (Head Admin) uchun mo'ljallangan.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-mgmt-container">
        
        <!-- Head Admin VIP Banner Card -->
        <div class="admin-hero-card">
          <div class="admin-hero-header">
            <div class="admin-hero-icon">👑</div>
            <div class="admin-hero-title">
              <h2>Adminlar Boshqaruvi</h2>
              <span>Bosh Admin Markazi (Head Admin)</span>
            </div>
          </div>
          <p class="admin-hero-desc">
            Yangi operatsion adminlarni 15 daqiqalik bir martalik xavfsiz havola orqali yoki Telegram ID orqali qo'shishingiz mumkin.
          </p>
        </div>

        <!-- 15-Minute Invite Generator Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span>⏱</span> 15 Daqiqalik Taklif Havolasi
            </div>
            <span class="badge badge-info">Bir martalik</span>
          </div>

          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5;">
            Yaratilgan havola faqat 15 daqiqa davomida amal qiladi va nomzod Telegram orqali kirishi bilan avtomatik Admin huquqini oladi.
          </p>

          <button id="btn-create-invite" class="btn btn-primary btn-block" onclick="AdminManagementView.createInvite()">
            <span>➕</span> Yangi Taklif Havolasi Yaratish
          </button>

          <!-- Active Invite Box -->
          <div id="active-invite-box" class="invite-active-box" style="display: none;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 600; color: #38BDF8;">Faol taklif havolasi:</span>
              <span id="invite-countdown" class="invite-timer-pill">15:00</span>
            </div>

            <div class="invite-url-field">
              <input id="invite-url-input" type="text" readonly />
              <button class="btn btn-secondary btn-sm" onclick="AdminManagementView.copyInviteUrl()">Нусха</button>
            </div>

            <div class="invite-action-buttons">
              <button id="btn-share-invite" class="btn btn-primary btn-sm" style="flex:1;" onclick="AdminManagementView.shareInvite()">
                ✈️ Telegramda Ulashish
              </button>
              <button id="btn-revoke-invite" class="btn btn-danger btn-sm" onclick="AdminManagementView.revokeCurrentInvite()">
                Bekor Qilish
              </button>
            </div>
          </div>
        </div>

        <!-- Add Admin by Telegram ID Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span>🆔</span> Telegram ID Orqali Qo'shish
            </div>
            <span class="badge badge-primary">Tezkor</span>
          </div>
          <div style="display:flex; gap: 8px; margin-bottom: 10px;">
            <input id="manual-admin-id" type="number" placeholder="Telegram ID (masalan: 123456789)" style="flex:1;" />
            <input id="manual-admin-name" type="text" placeholder="Ismi" style="width: 120px;" />
          </div>
          <button class="btn btn-secondary btn-block btn-sm" onclick="AdminManagementView.addAdminById()">
            Admin Etib Belgilash
          </button>
        </div>

        <!-- Admins List Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span>👥</span> Amaldagi Adminlar Ro'yxati
            </div>
            <button class="btn btn-ghost btn-sm" onclick="AdminManagementView.loadAdminsList()">Yangilash</button>
          </div>
          <div id="admins-list-container">
            <div style="text-align:center; padding: 24px; color: var(--text-dim); font-size: 12px;">Yuklanmoqda...</div>
          </div>
        </div>

      </div>
    `;

    await this.loadAdminsList();
  },

  currentInviteToken: null,
  currentInviteUrl: null,

  async createInvite() {
    const btn = document.getElementById("btn-create-invite");
    if (btn) btn.disabled = true;

    try {
      const res = await API.post("/admin-management/invites", {});
      if (res && res.status === "success") {
        this.currentInviteToken = res.token;
        this.currentInviteUrl = res.invite_url;

        const box = document.getElementById("active-invite-box");
        const input = document.getElementById("invite-url-input");
        if (box && input) {
          box.style.display = "block";
          input.value = res.invite_url;
        }

        Utils.showToast("15 daqiqalik taklif havolasi yaratildi!", "success");
        this.startCountdown(res.expires_in_seconds || 900);
      }
    } catch (e) {
      Utils.showToast(e.message || "Xatolik yuz berdi", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  startCountdown(seconds) {
    if (this.activeTimer) clearInterval(this.activeTimer);
    let rem = seconds;

    const el = document.getElementById("invite-countdown");
    const updateDisplay = () => {
      if (!el) return;
      if (rem <= 0) {
        el.innerText = "Muddati tugadi";
        el.style.color = "#ef4444";
        clearInterval(this.activeTimer);
        return;
      }
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      el.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      rem--;
    };

    updateDisplay();
    this.activeTimer = setInterval(updateDisplay, 1000);
  },

  copyInviteUrl() {
    if (!this.currentInviteUrl) return;
    navigator.clipboard.writeText(this.currentInviteUrl).then(() => {
      Utils.showToast("Havola nusxalandi!", "success");
    }).catch(() => {
      Utils.showToast("Nusxalab bo'lmadi", "error");
    });
  },

  shareInvite() {
    if (!this.currentInviteUrl) return;
    const shareText = encodeURIComponent("Auto Sklad ombor boshqaruvi uchun Admin taklif havolasi (15 daqiqa amal qiladi):");
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(this.currentInviteUrl)}&text=${shareText}`;
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  },

  async revokeCurrentInvite() {
    if (!this.currentInviteToken) return;
    if (!confirm("Haqiqatan ham ushbu taklif havolasini bekor qilmoqchimisiz?")) return;

    try {
      await API.delete(`/admin-management/invites/${this.currentInviteToken}/revoke`);
      Utils.showToast("Taklif havolasi bekor qilindi.", "info");
      const box = document.getElementById("active-invite-box");
      if (box) box.style.display = "none";
      if (this.activeTimer) clearInterval(this.activeTimer);
      this.currentInviteToken = null;
      this.currentInviteUrl = null;
    } catch (e) {
      Utils.showToast(e.message || "Xatolik", "error");
    }
  },

  async addAdminById() {
    const idInput = document.getElementById("manual-admin-id");
    const nameInput = document.getElementById("manual-admin-name");
    const tid = parseInt(idInput?.value || "0");
    const name = (nameInput?.value || "").trim() || `Admin ${tid}`;

    if (!tid || isNaN(tid)) {
      Utils.showToast("Iltimos, to'g'ri Telegram ID kiriting", "warning");
      return;
    }

    try {
      const res = await API.post("/admin-management/admins/by-id", {
        telegram_id: tid,
        first_name: name
      });
      Utils.showToast(res.message || "Admin qo'shildi!", "success");
      if (idInput) idInput.value = "";
      if (nameInput) nameInput.value = "";
      await this.loadAdminsList();
    } catch (e) {
      Utils.showToast(e.message || "Xatolik", "error");
    }
  },

  async loadAdminsList() {
    const listEl = document.getElementById("admins-list-container");
    if (!listEl) return;

    try {
      const res = await API.get("/admin-management/admins");
      const admins = res.admins || [];

      if (!admins.length) {
        listEl.innerHTML = `<div style="text-align:center; padding: 16px; color:#94a3b8; font-size:12px;">Adminlar mavjud emas</div>`;
        return;
      }

      listEl.innerHTML = admins.map(a => {
        const isHead = a.role === "HEAD_ADMIN";
        const name = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.username || `Admin ${a.telegram_id}`;
        const uTag = a.username ? `@${a.username}` : `ID: ${a.telegram_id}`;
        const initial = (a.first_name || a.username || 'A')[0].toUpperCase();
        const statusBadge = a.status === "ACTIVE" 
          ? `<span class="badge badge-success"><span class="status-dot-active"></span> Faol</span>`
          : `<span class="badge badge-danger"><span class="status-dot-revoked"></span> Bekor qilingan</span>`;

        return `
          <div class="admin-roster-item">
            <div class="admin-user-cell">
              <div class="admin-avatar-circle ${isHead ? 'admin-avatar-head' : 'admin-avatar-regular'}">
                ${isHead ? '👑' : initial}
              </div>
              <div>
                <div class="admin-meta-title">
                  <span>${Utils.escapeHtml(name)}</span>
                  ${isHead ? '<span class="badge badge-warning" style="font-size:10px;">Bosh Admin</span>' : ''}
                </div>
                <div class="admin-meta-sub">
                  <span>${Utils.escapeHtml(uTag)}</span>
                  <span>·</span>
                  ${statusBadge}
                </div>
              </div>
            </div>
            <div>
              ${!isHead && a.status === "ACTIVE" ? `
                <button class="btn btn-ghost btn-sm" style="color:#ef4444; font-size:11px;" onclick="AdminManagementView.revokeAdmin(${a.telegram_id})">
                  O'chirish
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join("");

    } catch (e) {
      listEl.innerHTML = `<div style="text-align:center; padding:16px; color:#ef4444; font-size:12px;">Yuklashda xatolik: ${e.message}</div>`;
    }
  },

  async revokeAdmin(telegramId) {
    if (!confirm(`Haqiqatan ham ushbu foydalanuvchining (ID: ${telegramId}) adminlik huquqini bekor qilmoqchimisiz?`)) return;

    try {
      await API.delete(`/admin-management/admins/${telegramId}`);
      Utils.showToast("Adminlik huquqi bekor qilindi.", "info");
      await this.loadAdminsList();
    } catch (e) {
      Utils.showToast(e.message || "Xatolik", "error");
    }
  }
};
