/* =====================================================
   AVTO SKLAD — Telegram WebApp & Auth Context
   ===================================================== */

const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
}

const initData = tg?.initData || "";
const initUser = tg?.initDataUnsafe?.user || null;

let currentUser = initUser;
let userRole = "user";
let isAdmin = false;
let isHeadAdmin = false;

function setAuthRole(roleInfo) {
    userRole = roleInfo.role || "user";
    isAdmin = !!roleInfo.is_admin;
    isHeadAdmin = !!roleInfo.is_head_admin;
}
