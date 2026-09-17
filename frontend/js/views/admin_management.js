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
      <div class="admin-mgmt-container" style="padding: 16px; max-width: 640px; margin: 0 auto;">
        
        <!-- Header -->
        <div class="card mb-3" style="background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(15,23,42,0.6)); border: 1px solid rgba(59,130,246,0.3);">
          <div style="display:flex; align-items:center; gap: 12px; margin-bottom: 8px;">
            <div style="width: 42px; height: 42px; border-radius: 10px; background: #2563eb; display:flex; align-items:center; justify-content:center; font-size: 20px;">
              🔑
            </div>
            <div>
              <h2 style="font-size: 16px; font-weight: 700; margin: 0; color: #f8fafc;">Adminlar Boshqaruvi</h2>
              <span style="font-size: 12px; color: #94a3b8;">Yagona Bosh Admin boshqaruv markazi</span>
            </div>
          </div>
          <p style="font-size: 12px; color: #cbd5e1; margin: 0; line-height: 1.5;">
            Yangi operatsion adminlarni 15 daqiqalik bir martalik havola orqali yoki Telegram ID orqali qo'shishingiz mumkin.
          </p>
        </div>

        <!-- 15-Minute Invite Generator Card -->
        <div class="card mb-3">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; margin: 0; color: #f8fafc;">
              ⏱ 15 Daqiqalik Taklif Havolasi
            </h3>
            <span class="badge badge-info" style="font-size: 11px;">Bir martalik</span>
          </div>

          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">
            Yaratilgan havola faqat 15 daqiqa davomida amal qiladi va nomzod Telegram orqali kirishi bilan avtomatik Admin huquqini oladi.
          </p>

          <button id="btn-create-invite" class="btn btn-primary btn-block" onclick="AdminManagementView.createInvite()">
            ➕ Yangi Taklif Havolasi Yaratish
          </button>

          <!-- Active Invite Box -->
          <div id="active-invite-box" style="display: none; margin-top: 14px; padding: 12px; background: rgba(15,23,42,0.8); border: 1px solid rgba(59,130,246,0.4); border-radius: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 600; color: #60a5fa;">Faol taklif havolasi:</span>
              <span id="invite-countdown" style="font-size: 12px; font-weight: 700; color: #fbbf24; background: rgba(251,191,36,0.1); padding: 2px 6px; border-radius: 4px;">15:00</span>
            </div>

            <div style="display:flex; gap: 8px; margin-bottom: 10px;">
              <input id="invite-url-input" type="text" readonly style="flex:1; background: #0b0f19; border: 1px solid #334155; color: #f8fafc; font-size: 11px; padding: 6px 10px; border-radius: 6px;" />
              <button class="btn btn-secondary btn-sm" onclick="AdminManagementView.copyInviteUrl()">Нусха</button>
            </div>

            <div style="display:flex; gap: 8px;">
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
        <div class="card mb-3">
          <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #f8fafc;">
            🆔 Telegram ID Orqali Qo'shish
          </h3>
          <div style="display:flex; gap: 8px; margin-bottom: 8px;">
            <input id="manual-admin-id" type="number" placeholder="Telegram ID (masalan: 123456789)" style="flex:1; background: #0b0f19; border: 1px solid #334155; color: #f8fafc; font-size: 12px; padding: 8px 10px; border-radius: 6px;" />
            <input id="manual-admin-name" type="text" placeholder="Ismi" style="width: 110px; background: #0b0f19; border: 1px solid #334155; color: #f8fafc; font-size: 12px; padding: 8px 10px; border-radius: 6px;" />
          </div>
          <button class="btn btn-secondary btn-block btn-sm" onclick="AdminManagementView.addAdminById()">
            Admin Etib Belgilash
          </button>
        </div>

        <!-- Admins List Card -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; margin: 0; color: #f8fafc;">
              👥 Amaldagi Adminlar Ro'yxati
            </h3>
            <button class="btn btn-ghost btn-sm" onclick="AdminManagementView.loadAdminsList()">Yangilash</button>
          </div>
          <div id="admins-list-container">
            <div style="text-align:center; padding: 20px; color: #94a3b8; font-size: 12px;">Yuklanmoqda...</div>
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
        const statusBadge = a.status === "ACTIVE" 
          ? `<span style="color:#22c55e; font-size:11px; font-weight:600;">● Faol</span>`
          : `<span style="color:#ef4444; font-size:11px; font-weight:600;">● Bekor qilingan</span>`;

        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid rgba(51,65,85,0.4);">
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #f8fafc;">
                ${isHead ? '👑 ' : '👨‍💼 '}${Utils.escapeHtml(name)}
                ${isHead ? '<span class="badge badge-primary" style="font-size:10px; margin-left:4px;">Bosh Admin</span>' : ''}
              </div>
              <div style="font-size: 11px; color: #94a3b8;">
                ${Utils.escapeHtml(uTag)} · ${statusBadge}
              </div>
            </div>
            <div>
              ${!isHead && a.status === "ACTIVE" ? `
                <button class="btn btn-ghost btn-sm" style="color:#ef4444; font-size:11px; padding:4px 8px;" onclick="AdminManagementView.revokeAdmin(${a.telegram_id})">
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
