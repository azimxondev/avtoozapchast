/**
 * Avto Sklad — Global Application State
 * Supports real-time role switching (Admin -> User Preview -> Admin)
 */

const State = {
  currentRole: localStorage.getItem("avto_sklad_demo_role") || "HEAD_ADMIN",
  actualRole: localStorage.getItem("avto_sklad_demo_role") || "HEAD_ADMIN",
  isUserPreview: false,
  currentUser: null,
  currentTab: "dashboard",
  isTelegram: false,
  telegramInitData: "",
  categories: [],
  carModels: [],
  carBrands: [],
  shopSettings: {},

  initRole(serverRole) {
    const mapped = (serverRole === "SUPER_ADMIN" || serverRole === "HEAD_ADMIN") ? "HEAD_ADMIN" : (serverRole || "USER");
    this.actualRole = mapped;
    if (!this.isUserPreview) {
      this.currentRole = mapped;
    }
  },

  togglePreview() {
    if (!this.canSwitchRole()) return;
    this.isUserPreview = !this.isUserPreview;
    if (this.isUserPreview) {
      this.currentRole = "USER";
      this.currentTab = "user_catalog";
    } else {
      this.currentRole = this.actualRole;
      this.currentTab = "dashboard";
    }
  },

  setRole(role) {
    const mapped = (role === "SUPER_ADMIN" || role === "HEAD_ADMIN") ? "HEAD_ADMIN" : role;
    this.currentRole = mapped;
    this.actualRole = mapped;
    this.isUserPreview = false;
    localStorage.setItem("avto_sklad_demo_role", mapped);
    if (mapped === "USER") {
      this.currentTab = "user_catalog";
    } else if (this.currentTab === "user_catalog") {
      this.currentTab = "dashboard";
    }
  },

  isStaffOrAdmin() {
    return ["HEAD_ADMIN", "SUPER_ADMIN", "ADMIN", "STAFF"].includes(this.currentRole);
  },

  isAdmin() {
    return ["HEAD_ADMIN", "SUPER_ADMIN", "ADMIN"].includes(this.currentRole);
  },

  isSuperAdmin() {
    return this.currentRole === "HEAD_ADMIN" || this.currentRole === "SUPER_ADMIN";
  },

  canSwitchRole() {
    return ["HEAD_ADMIN", "SUPER_ADMIN", "ADMIN"].includes(this.actualRole);
  }
};
