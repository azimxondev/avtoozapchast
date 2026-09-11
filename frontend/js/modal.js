/* =====================================================
   AVTO SKLAD — Modal & Sheet Management JS
   ===================================================== */

function showModal(id) {
    const overlay = document.getElementById("modal-overlay");
    const target = document.getElementById(id);
    if (overlay) overlay.classList.remove("hidden");
    if (target) target.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeModal(id) {
    const target = document.getElementById(id);
    if (target) target.classList.add("hidden");
}

function closeAllModals() {
    document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.classList.add("hidden");
    document.body.style.overflow = "";

    const fab = document.querySelector(".fab");
    if (fab && currentTab !== "products") fab.remove();
}
