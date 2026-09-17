/**
 * Avto Sklad — Global Application State
 */

const State = {
  currentRole: localStorage.getItem("avto_sklad_demo_role") || "SUPER_ADMIN",
  currentUser: null,
  currentTab: "dashboard",
  isTelegram: false,
  telegramInitData: "",
  categories: [],
  carModels: [],
  carBrands: [],
  shopSettings: {},

  setRole(role) {
    this.currentRole = role;
    localStorage.setItem("avto_sklad_demo_role", role);
    // If switched to USER, switch to user_catalog tab automatically
    if (role === "USER") {
      this.currentTab = "user_catalog";
    } else if (this.currentTab === "user_catalog") {
      this.currentTab = "dashboard";
    }
  },

  isStaffOrAdmin() {
    return ["SUPER_ADMIN", "ADMIN", "STAFF"].includes(this.currentRole);
  },

  isAdmin() {
    return ["SUPER_ADMIN", "ADMIN"].includes(this.currentRole);
  },

  isSuperAdmin() {
    return this.currentRole === "SUPER_ADMIN";
  }
};
