/**
 * Avto Sklad — QR & Barcode Scanner View
 * Real-time camera viewfinder, BarcodeDetector API, manual fallback, and stock actions.
 */

const ScannerView = {
  stream: null,
  videoElement: null,
  detector: null,
  scanInterval: null,
  isScanning: false,
  facingMode: "environment", // prefer rear camera
  hasTorch: false,
  torchOn: false,

  open() {
    this.renderUI();
    this.startCamera();
  },

  close() {
    this.stopCamera();
    const overlay = document.getElementById("scanner-modal-overlay");
    if (overlay) overlay.remove();
  },

  renderUI() {
    // Remove if existing
    const existing = document.getElementById("scanner-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "scanner-modal-overlay";
    overlay.className = "scanner-overlay";
    overlay.innerHTML = `
      <!-- Scanner Top Bar -->
      <div class="scanner-header">
        <div class="scanner-title-group">
          <span class="scanner-icon">📷</span>
          <div>
            <div class="scanner-title">QR & Shtrix-kod Skaneri</div>
            <div class="scanner-subtitle">Mahsulot kodini kameraga qarating</div>
          </div>
        </div>
        <button class="scanner-close-btn" onclick="ScannerView.close()" title="Yopish">✕</button>
      </div>

      <!-- Center Viewfinder Container -->
      <div style="display:flex;flex-direction:column;align-items:center;width:100%">
        <div class="scanner-viewport-wrapper" id="scanner-viewport">
          <video id="scanner-video" class="scanner-video" playsinline muted autoplay></video>
          <div class="scanner-reticle">
            <div class="reticle-corner top-left"></div>
            <div class="reticle-corner top-right"></div>
            <div class="reticle-corner bottom-left"></div>
            <div class="reticle-corner bottom-right"></div>
            <div class="scanner-laser"></div>
          </div>
        </div>
        <div class="scanner-hint" id="scanner-status-hint">Kod qidirilmoqda...</div>
      </div>

      <!-- Controls & Manual Fallback Drawer -->
      <div style="width:100%;max-width:440px;margin:0 auto">
        <div class="scanner-controls">
          <button id="scanner-torch-btn" class="scanner-tool-btn" onclick="ScannerView.toggleTorch()" style="display:none">
            <span>🔦</span> <span id="torch-label">Chiroq</span>
          </button>
          <button class="scanner-tool-btn" onclick="ScannerView.flipCamera()">
            <span>🔄</span> Kamera
          </button>
          <button class="scanner-tool-btn" onclick="ScannerView.toggleManualInput()">
            <span>⌨️</span> Qo'lda kiritish
          </button>
        </div>

        <!-- Manual input fallback -->
        <div id="scanner-manual-drawer" class="scanner-manual-box" style="display:none">
          <input type="text" id="manual-barcode-input" class="form-control" placeholder="Artikul yoki Barcode kiriting (masalan, GLS-GEN-01)..." style="flex:1">
          <button class="btn btn-primary" onclick="ScannerView.submitManualCode()">Topish</button>
        </div>

        <!-- Dynamic Result Container -->
        <div id="scanner-result-container"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.videoElement = document.getElementById("scanner-video");
  },

  async startCamera() {
    this.stopCamera();
    const hint = document.getElementById("scanner-status-hint");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Kameradan foydalanish imkoni mavjud emas (Brauzer ruxsat bermadi).");
      }

      const constraints = {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      // Check flashlight/torch capability
      const track = this.stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        this.hasTorch = true;
        const torchBtn = document.getElementById("scanner-torch-btn");
        if (torchBtn) torchBtn.style.display = "inline-flex";
      }

      this.initDetector();
    } catch (err) {
      console.warn("Camera error:", err);
      if (hint) {
        hint.innerHTML = `<span style="color:var(--accent-rose)">⚠️ Kamera ochilmadi: ${err.message || 'Ruxsat berilmadi'}. Pastdagi "Qo'lda kiritish" tugmasidan foydalaning.</span>`;
      }
      this.toggleManualInput(true);
    }
  },

  stopCamera() {
    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  },

  flipCamera() {
    this.facingMode = this.facingMode === "environment" ? "user" : "environment";
    this.startCamera();
  },

  async toggleTorch() {
    if (!this.stream || !this.hasTorch) return;
    const track = this.stream.getVideoTracks()[0];
    try {
      this.torchOn = !this.torchOn;
      await track.applyConstraints({
        advanced: [{ torch: this.torchOn }]
      });
      const lbl = document.getElementById("torch-label");
      if (lbl) lbl.textContent = this.torchOn ? "O'chirish" : "Chiroq";
    } catch (e) {
      console.warn("Torch failed:", e);
    }
  },

  toggleManualInput(forceShow = null) {
    const drawer = document.getElementById("scanner-manual-drawer");
    if (!drawer) return;
    const shouldShow = forceShow !== null ? forceShow : drawer.style.display === "none";
    drawer.style.display = shouldShow ? "flex" : "none";
    if (shouldShow) {
      const inp = document.getElementById("manual-barcode-input");
      if (inp) inp.focus();
    }
  },

  submitManualCode() {
    const inp = document.getElementById("manual-barcode-input");
    if (!inp || !inp.value.trim()) {
      Utils.showToast("Iltimos, kodni kiriting", "warning");
      return;
    }
    this.handleDetectedCode(inp.value.trim());
  },

  async initDetector() {
    this.isScanning = true;
    
    // Check if BarcodeDetector is supported natively in modern Chrome / Android / Safari 17+
    if ("BarcodeDetector" in window) {
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        this.detector = new BarcodeDetector({ formats: supported });
      } catch (e) {
        this.detector = null;
      }
    }

    // Scanning loop every 250ms
    this.scanInterval = setInterval(async () => {
      if (!this.isScanning || !this.videoElement || this.videoElement.readyState < 2) return;

      if (this.detector) {
        try {
          const barcodes = await this.detector.detect(this.videoElement);
          if (barcodes && barcodes.length > 0) {
            const rawVal = barcodes[0].rawValue;
            if (rawVal) {
              this.handleDetectedCode(rawVal);
            }
          }
        } catch (e) {
          // Frame drop or detection skip
        }
      }
    }, 250);
  },

  async handleDetectedCode(code) {
    if (!this.isScanning && !code) return;
    this.isScanning = false; // pause scanning

    // Sound effect or haptic feedback if supported in Telegram / Mobile
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
    }

    const hint = document.getElementById("scanner-status-hint");
    if (hint) hint.innerHTML = `<span style="color:#60A5FA">🔎 Kod aniqlandi: <b>${Utils.escapeHtml(code)}</b>. Qidirilmoqda...</span>`;

    try {
      const res = await API.get("/scanner/lookup", { code });
      if (res && res.product) {
        this.renderResult(res.product);
      }
    } catch (err) {
      const resContainer = document.getElementById("scanner-result-container");
      if (resContainer) {
        resContainer.innerHTML = `
          <div class="scan-result-card" style="border-color:var(--accent-rose)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <span style="font-size:24px">⚠️</span>
              <div>
                <div style="font-weight:700;color:var(--accent-rose)">Mahsulot topilmadi</div>
                <div style="font-size:12px;color:var(--text-muted)">Kod: ${Utils.escapeHtml(code)}</div>
              </div>
            </div>
            <p style="font-size:13px;color:var(--text-main);margin-bottom:14px">
              Ushbu shtrix-kod yoki SKU ombor bazasida mavjud emas.
            </p>
            <div style="display:flex;gap:10px">
              <button class="btn btn-secondary" style="flex:1" onclick="ScannerView.resumeScanning()">Qayta skanerlash</button>
              ${State.isStaffOrAdmin() ? `
                <button class="btn btn-primary" style="flex:1" onclick="ScannerView.quickAddNewProduct('${Utils.escapeHtml(code)}')">
                  ➕ Yangi tovar sifatida qo'shish
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }
    }
  },

  resumeScanning() {
    const resContainer = document.getElementById("scanner-result-container");
    if (resContainer) resContainer.innerHTML = "";
    const hint = document.getElementById("scanner-status-hint");
    if (hint) hint.innerHTML = "Kod qidirilmoqda...";
    this.isScanning = true;
  },

  renderResult(p) {
    const resContainer = document.getElementById("scanner-result-container");
    if (!resContainer) return;

    const isStaff = State.isStaffOrAdmin();
    const qty = p.quantity;
    const unit = p.unit || "dona";

    let badgeClass = "badge-success";
    if (p.stock_badge === "OUT_OF_STOCK") badgeClass = "badge-danger";
    else if (p.stock_badge === "LOW_STOCK") badgeClass = "badge-warning";

    resContainer.innerHTML = `
      <div class="scan-result-card">
        <div class="scan-result-header">
          <div>
            <div style="font-size:11px;color:var(--brand-blue);font-weight:700;text-transform:uppercase">${Utils.escapeHtml(p.category_name || 'Ehtiyot qism')}</div>
            <h3 style="font-size:16px;font-weight:700;color:var(--text-main);margin-top:2px">${Utils.escapeHtml(p.name)}</h3>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Artikul: <b>${Utils.escapeHtml(p.sku)}</b> ${p.barcode ? `| Shtrix-kod: <b>${Utils.escapeHtml(p.barcode)}</b>` : ''}</div>
          </div>
          <span class="badge ${badgeClass}">${Utils.escapeHtml(p.stock_label || 'Mavjud')}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;background:var(--bg-surface);border-radius:var(--radius-md);margin-bottom:14px">
          <div>
            <div style="font-size:11px;color:var(--text-muted)">Ombordagi qoldiq</div>
            <div style="font-size:16px;font-weight:800;color:${p.stock_color || 'var(--text-main)'}">${qty} ${Utils.escapeHtml(unit)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted)">Sotish narxi</div>
            <div style="font-size:16px;font-weight:800;color:var(--accent-emerald)">${Utils.formatMoney(p.selling_price)}</div>
          </div>
          ${isStaff && p.purchase_price ? `
            <div>
              <div style="font-size:11px;color:var(--text-muted)">Tannarx (Kirim)</div>
              <div style="font-size:13px;font-weight:600;color:var(--text-muted)">${Utils.formatMoney(p.purchase_price)}</div>
            </div>
          ` : ''}
          <div>
            <div style="font-size:11px;color:var(--text-muted)">Joylashuv (Polka)</div>
            <div style="font-size:13px;font-weight:600;color:var(--text-main)">${Utils.escapeHtml(p.shelf_location || 'Belgilanmagan')}</div>
          </div>
        </div>

        <!-- Action Buttons based on Role -->
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="ScannerView.openProductDetail(${p.id})">
            👁️ Batafsil
          </button>
          ${isStaff ? `
            <button class="btn btn-primary btn-sm" style="flex:1" onclick="ScannerView.triggerStockIn(${p.id})">
              📥 Kirim
            </button>
            <button class="btn btn-danger btn-sm" style="flex:1" onclick="ScannerView.triggerStockOut(${p.id})">
              📤 Sotuv
            </button>
          ` : ''}
          <button class="btn btn-ghost btn-sm" onclick="ScannerView.resumeScanning()" title="Boshqa tovar skanerlash">
            🔄 Yangi skan
          </button>
        </div>
      </div>
    `;
  },

  openProductDetail(productId) {
    this.close();
    if (typeof ProductsView !== "undefined" && ProductsView.openDetailModal) {
      ProductsView.openDetailModal(productId);
    }
  },

  triggerStockIn(productId) {
    this.close();
    if (typeof StockModal !== "undefined" && StockModal.openStockInModal) {
      StockModal.openStockInModal(productId);
    }
  },

  triggerStockOut(productId) {
    this.close();
    if (typeof StockModal !== "undefined" && StockModal.openStockOutModal) {
      StockModal.openStockOutModal(productId);
    }
  },

  quickAddNewProduct(code) {
    this.close();
    if (typeof ProductsView !== "undefined" && ProductsView.openAddModal) {
      ProductsView.openAddModal();
      // Pre-fill barcode or SKU
      setTimeout(() => {
        const skuInput = document.querySelector('input[name="sku"]');
        const barcodeInput = document.querySelector('input[name="barcode"]');
        if (barcodeInput) barcodeInput.value = code;
        else if (skuInput) skuInput.value = code;
      }, 150);
    }
  }
};
