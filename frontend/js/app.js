/**
 * Avto Sklad — Main Application Controller & Router
 */

const App = {
  async init() {
    console.log("[App] Avto Sklad Mini App initsializatsiya qilinmoqda...");

    // 1. Check Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      State.isTelegram = true;
      State.telegramInitData = window.Telegram.WebApp.initData;
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.enableClosingConfirmation();
      console.log("[App] Telegram WebApp muhitida ishga tushdi.");

      // Hide standalone demo banner in Telegram
      const demoBanner = document.getElementById("standalone-demo-banner");
      if (demoBanner) demoBanner.style.display = "none";
    } else {
      State.isTelegram = false;
      console.log("[App] Standalone Demo rejimida ishga tushdi.");

      // Check URL query param: ?role=user / ?role=admin / ?role=head_admin
      const urlParams = new URLSearchParams(window.location.search);
      const rParam = urlParams.get("role");
      if (rParam) {
        const mapped = rParam.toUpperCase() === "HEAD_ADMIN" ? "SUPER_ADMIN" : rParam.toUpperCase();
        State.currentRole = mapped;
      }
    }

    // 2. Load Current User info
    try {
      const authRes = await API.get("/auth/me");
      State.currentUser = authRes.user;
      State.initRole(authRes.user.role);
    } catch (e) {
      console.warn("Auth check fallback:", e);
    }

    // 3. Preload categories and shop settings
    try {
      const catRes = await API.get("/categories");
      State.categories = catRes.categories || [];

      const setRes = await API.get("/settings");
      State.shopSettings = setRes.settings || {};
    } catch (e) {
      console.warn("Preload warning:", e);
    }

    // 4. Update UI Header & Role Selector
    this.updateRoleBadge();
    const roleSelect = document.getElementById("demo-role-select");
    if (roleSelect) {
      roleSelect.value = State.currentRole;
    }

    // 5. Setup Theme & DND
    const savedTheme = localStorage.getItem("avto_sklad_theme") || "dark";
    this.setTheme(savedTheme);
    this.initDND();

    // 6. Setup Navigation
    this.renderNav();

    // 7. Route to initial tab
    const initialTab = State.currentRole === "USER" ? "user_catalog" : "dashboard";
    this.navigate(initialTab);

    // Remove loading screen
    const loader = document.getElementById("app-loading-screen");
    if (loader) loader.style.display = "none";
  },

  updateRoleBadge() {
    const badge = document.getElementById("header-role-badge");
    if (!badge) return;

    const actual = State.actualRole;

    // Faqat Bosh Admin va Adminlar uchun ko'rinadi — Oddiy mijozlar uchun yashiriladi
    if (actual === "USER" && !State.isUserPreview) {
      badge.style.display = "none";
      badge.innerHTML = "";
      badge.onclick = null;
      return;
    }

    badge.style.display = "inline-flex";

    if (State.isUserPreview) {
      badge.className = "role-badge role-preview-active clickable";
      badge.innerHTML = `<span class="preview-dot"></span><span>Mijoz rejimi</span> <span class="badge-arrow">↩</span>`;
      badge.title = "Boshqaruv (Admin) rejimiga qaytish uchun bosing";
      badge.onclick = () => App.toggleUserPreview();
      return;
    }

    if (actual === "HEAD_ADMIN" || actual === "SUPER_ADMIN") {
      badge.className = "role-badge role-super-admin clickable";
      badge.innerHTML = `<span>👑 Bosh Admin</span> <span class="badge-arrow">⇄</span>`;
      badge.title = "Mijoz (Xaridor) ko'rinishiga o'tish uchun bosing";
      badge.onclick = () => App.toggleUserPreview();
    } else if (actual === "ADMIN" || actual === "STAFF") {
      badge.className = "role-badge role-admin clickable";
      badge.innerHTML = `<span>⚡ Admin</span> <span class="badge-arrow">⇄</span>`;
      badge.title = "Mijoz (Xaridor) ko'rinishiga o'tish uchun bosing";
      badge.onclick = () => App.toggleUserPreview();
    } else {
      badge.style.display = "none";
      badge.innerHTML = "";
      badge.onclick = null;
    }
  },

  toggleUserPreview() {
    if (!State.canSwitchRole()) return;
    State.togglePreview();
    this.updateRoleBadge();
    this.renderNav();
    this.navigate(State.currentTab);
    if (State.isUserPreview) {
      Utils.showToast("👁️ Mijoz ko'rinishi faollashdi. Tovar va narxlar xaridorlarga qanday ko'rinishini tekshirishingiz mumkin.", "info");
    } else {
      Utils.showToast("👑 Boshqaruv (Admin) rejimiga qaytildi.", "success");
    }
  },

  async refreshData() {
    const btn = document.getElementById("app-refresh-btn");
    if (btn) btn.style.transform = "rotate(360deg)";
    try {
      // Re-verify auth
      const authRes = await API.get("/auth/me");
      State.currentUser = authRes.user;
      State.initRole(authRes.user.role);
      this.updateRoleBadge();
      this.renderNav();

      // Re-fetch categories & shop settings
      const [catRes, setRes] = await Promise.all([
        API.get("/categories").catch(() => ({ categories: [] })),
        API.get("/settings").catch(() => ({ settings: {} }))
      ]);
      if (catRes.categories) State.categories = catRes.categories;
      if (setRes.settings) State.shopSettings = setRes.settings;

      // Re-render active view
      this.navigate(State.currentTab);
      Utils.showToast("🔄 Ma'lumotlar yangilandi!", "success");
    } catch (e) {
      console.error("Refresh error:", e);
      Utils.showToast("Yangilashda xatolik yuz berdi", "error");
    } finally {
      setTimeout(() => {
        if (btn) btn.style.transform = "none";
      }, 500);
    }
  },

  onRoleChange(newRole) {
    State.setRole(newRole);
    this.updateRoleBadge();
    this.renderNav();
    const targetTab = newRole === "USER" ? "user_catalog" : "dashboard";
    this.navigate(targetTab);
    Utils.showToast(`Rol o'zgartirildi: ${newRole}`, "info");
  },

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("avto_sklad_theme", theme);
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.textContent = theme === "dark" ? "🌙" : "☀️";
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    this.setTheme(next);
  },

  initDND() {
    const isDnd = localStorage.getItem("avto_sklad_dnd") === "true";
    this.setDND(isDnd, false);
  },

  setDND(enabled, notify = true) {
    localStorage.setItem("avto_sklad_dnd", enabled ? "true" : "false");
    window.AVTO_SKLAD_DND = enabled;
    const btn = document.getElementById("dnd-toggle-btn");
    if (btn) {
      btn.textContent = enabled ? "🔕" : "🔔";
      btn.title = enabled 
        ? "Bezovta qilinmasin: YOQILGAN (Bildirishnomalar cheklangan)" 
        : "Bildirishnomalar: FAOL";
      btn.style.opacity = enabled ? "0.6" : "1";
    }
    if (notify) {
      if (enabled) {
        Utils.showToast("🔕 Bezovta qilinmasin rejimi yoqildi (Bildirishnomalar o'chirildi)", "info");
      } else {
        Utils.showToast("🔔 Bildirishnomalar yoqildi", "success");
      }
    }
  },

  toggleDND() {
    const current = localStorage.getItem("avto_sklad_dnd") === "true";
    this.setDND(!current, true);
  },

  renderNav() {
    const nav = document.getElementById("bottom-nav");
    if (!nav) return;

    if (State.currentRole === "USER") {
      nav.innerHTML = `
        <button class="nav-item ${State.currentTab === 'user_catalog' ? 'active' : ''}" onclick="App.navigate('user_catalog')">
          <span class="nav-icon">🛒</span>
          <span>Katalog</span>
        </button>
        <button class="nav-item" onclick="UserCatalogView.openLocationModal()">
          <span class="nav-icon">📍</span>
          <span>Do'kon & Manzil</span>
        </button>
        ${State.isUserPreview ? `
          <button class="nav-item" onclick="App.toggleUserPreview()" style="color:#FBBF24; font-weight:700;">
            <span class="nav-icon">👑</span>
            <span>Admin Rejim</span>
          </button>
        ` : ''}
      `;
    } else {
      const isSuper = State.currentRole === "SUPER_ADMIN" || State.currentRole === "HEAD_ADMIN" || State.currentUser?.is_super_admin;
      nav.innerHTML = `
        <button class="nav-item ${State.currentTab === 'dashboard' ? 'active' : ''}" onclick="App.navigate('dashboard')">
          <span class="nav-icon">📊</span>
          <span>Boshqaruv</span>
        </button>
        <button class="nav-item ${State.currentTab === 'products' ? 'active' : ''}" onclick="App.navigate('products')">
          <span class="nav-icon">🏷</span>
          <span>Katalog</span>
        </button>
        <button class="nav-item ${State.currentTab === 'inventory' ? 'active' : ''}" onclick="App.navigate('inventory')">
          <span class="nav-icon">📦</span>
          <span>Ombor</span>
        </button>
        <button class="nav-item ${State.currentTab === 'transactions' ? 'active' : ''}" onclick="App.navigate('transactions')">
          <span class="nav-icon">📜</span>
          <span>Kassa</span>
        </button>
        ${isSuper ? `
          <button class="nav-item ${State.currentTab === 'admin_management' ? 'active' : ''}" onclick="App.navigate('admin_management')">
            <span class="nav-icon">🔑</span>
            <span>Adminlar</span>
          </button>
        ` : `
          <button class="nav-item ${State.currentTab === 'analytics' ? 'active' : ''}" onclick="App.navigate('analytics')">
            <span class="nav-icon">📈</span>
            <span>Tahlil</span>
          </button>
        `}
      `;
    }
  },

  navigate(tabName, params = null) {
    State.currentTab = tabName;
    this.renderNav();

    // Close any open modals
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.classList.remove("active");

    window.scrollTo({ top: 0, behavior: 'smooth' });
    const content = document.getElementById("tab-content");

    switch (tabName) {
      case "dashboard":
        DashboardView.render();
        break;
      case "products":
        ProductsView.render(params);
        break;
      case "inventory":
        if (content) InventoryView.render(content);
        break;
      case "transactions":
        TransactionsView.render(params);
        break;
      case "analytics":
        AnalyticsView.render();
        break;
      case "admin_management":
        if (content) AdminManagementView.render(content);
        break;
      case "user_catalog":
        UserCatalogView.render();
        break;
      case "settings":
        SettingsView.render();
        break;
      default:
        DashboardView.render();
    }
  }
};

// Start application when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
