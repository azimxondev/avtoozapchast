/**
 * Avto Sklad — Lightweight High-DPI Canvas Charts
 */

const Charts = {
  /**
   * Render Multi-Bar Comparison Chart (Revenue, Expenses, Profit)
   */
  renderTimelineBarChart(canvasId, points) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    if (!points || points.length === 0) {
      ctx.fillStyle = "#64748B";
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Ushbu davr uchun grafik ma'lumotlari mavjud emas", width / 2, height / 2);
      return;
    }

    // Find max value
    let maxVal = 0;
    points.forEach(p => {
      maxVal = Math.max(maxVal, p.day_revenue || p.month_revenue || 0, p.day_expenses || p.month_expenses || 0);
    });
    if (maxVal === 0) maxVal = 100000;
    maxVal = maxVal * 1.15; // padding top

    const paddingLeft = 45;
    const paddingBottom = 25;
    const paddingTop = 15;
    const chartWidth = width - paddingLeft - 10;
    const chartHeight = height - paddingBottom - paddingTop;

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748B";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = paddingTop + (chartHeight / gridSteps) * i;
      const val = Math.round(maxVal - (maxVal / gridSteps) * i);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();

      let valText = val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}k`;
      ctx.fillText(valText, paddingLeft - 6, y + 3);
    }

    // Draw Bars
    const groupWidth = chartWidth / points.length;
    const barWidth = Math.max(4, Math.min(16, (groupWidth - 8) / 2));

    points.forEach((p, idx) => {
      const xCenter = paddingLeft + groupWidth * idx + groupWidth / 2;
      const rev = p.day_revenue || p.month_revenue || 0;
      const exp = p.day_expenses || p.month_expenses || 0;

      const revH = (rev / maxVal) * chartHeight;
      const expH = (exp / maxVal) * chartHeight;

      // Revenue bar (Blue)
      ctx.fillStyle = "#2563EB";
      ctx.beginPath();
      ctx.roundRect(xCenter - barWidth - 1, paddingTop + chartHeight - revH, barWidth, revH, [3, 3, 0, 0]);
      ctx.fill();

      // Expense bar (Amber)
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.roundRect(xCenter + 1, paddingTop + chartHeight - expH, barWidth, expH, [3, 3, 0, 0]);
      ctx.fill();

      // Label below
      const label = (p.day_date || p.month_date || "").slice(-5);
      ctx.fillStyle = "#94A3B8";
      ctx.textAlign = "center";
      ctx.fillText(label, xCenter, height - 8);
    });
  }
};
