/* ==========================================================================
 * Job Costing – PDF Export (client-side, jsPDF + autoTable)
 * Produces a professional multi-page PDF matching the desktop print layout.
 * Requires jsPDF and jsPDF-autoTable loaded via CDN before this script.
 * ========================================================================== */

/* global jspdf, state, els, toNumber, money, pct,
          FIXED_RATE_NORMAL, FIXED_RATE_OT15, FIXED_RATE_OT20 */

(function () {
  'use strict';

  // ── Brand colours (ABP Induction) ──────────────────────────────────────
  const BRAND_ORANGE = [244, 127, 74];    // #f47f4a
  const DARK_CHARCOAL = [38, 38, 38];     // #262626
  const HEADER_BG = [240, 240, 240];
  const GRID_COLOUR = [200, 200, 200];
  const WHITE = [255, 255, 255];
  const BLACK = [0, 0, 0];

  // ── Helpers ────────────────────────────────────────────────────────────
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function R(v) { return 'R ' + num(v).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pctFmt(v) { return num(v).toFixed(2) + '%'; }

  // Pre-loaded logo image data URL (set before generating PDF)
  var _logoDataUrl = null;

  // Load logo.png from /Assets/logo.png as a base64 data URL
  function loadLogo() {
    if (_logoDataUrl) return Promise.resolve(_logoDataUrl);
    return fetch('/Assets/logo.png')
      .then(function (res) {
        if (!res.ok) throw new Error('Logo not found');
        return res.blob();
      })
      .then(function (blob) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onloadend = function () {
            _logoDataUrl = reader.result;
            resolve(_logoDataUrl);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      })
      .catch(function () { _logoDataUrl = null; return null; });
  }

  // Draw the company logo image (or fallback text if image failed to load)
  function drawLogo(doc, x, y, width, height) {
    if (_logoDataUrl) {
      try {
        doc.addImage(_logoDataUrl, 'PNG', x, y, width, height);
        return;
      } catch (e) { /* fall through to text fallback */ }
    }
    // Fallback: draw text logo
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(...BRAND_ORANGE);
    doc.text('ABP', x + 3, y + height * 0.58);
    doc.setFontSize(10);
    doc.setTextColor(...DARK_CHARCOAL);
    doc.text('INDUCTION', x + 3, y + height * 0.88);
    doc.setTextColor(...BLACK);
  }

  // Draw a section title with an underline
  function drawSectionTitle(doc, title, x, y, pageWidth, marginRight) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...DARK_CHARCOAL);
    doc.text(title, x, y);
    const underY = y + 2;
    doc.setDrawColor(...GRID_COLOUR);
    doc.setLineWidth(0.5);
    doc.line(x, underY, pageWidth - marginRight, underY);
    doc.setTextColor(...BLACK);
    return underY + 6;
  }

  // ── Main export function ───────────────────────────────────────────────
  async function exportJobCostingPdf() {
    // Check that jsPDF loaded
    if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
      alert('PDF library failed to load. Please check your internet connection and refresh the page.');
      return;
    }
    // Pre-load the logo image before generating
    await loadLogo();
    // Gather current form data
    const companyName = (els.companyName.selectedOptions[0]?.dataset.name || '').trim() || '-';
    const jobNo = els.jobNo.value.trim() || '-';
    const customerOrderNo = els.customerOrderNo.value.trim() || '-';
    const ticketNo = els.ticketNo.value.trim() || '-';
    const quoteNo = els.quoteNo.value.trim() || '-';
    const category = els.category.value || '-';
    const description = els.description.value.trim() || '-';

    const actualNormal = num(els.actualNormal.value);
    const actualOt15 = num(els.actualOt15.value);
    const actualOt20 = num(els.actualOt20.value);
    const allocNormal = num(els.allocNormal.value);
    const allocOt15 = num(els.allocOt15.value);
    const allocOt20 = num(els.allocOt20.value);
    const revenue = num(els.revenue.value);

    const normalTotal = actualNormal * FIXED_RATE_NORMAL;
    const ot15Total = actualOt15 * FIXED_RATE_OT15;
    const ot20Total = actualOt20 * FIXED_RATE_OT20;
    const totalLabourCost = normalTotal + ot15Total + ot20Total;

    const totalMaterialCost = state.materials.reduce(
      (sum, m) => sum + num(m.qty) * num(m.costPrice), 0
    );
    const totalCost = totalMaterialCost + totalLabourCost;
    const grossProfit = revenue - totalCost;
    const markupPct = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;
    const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const costPctVal = revenue > 0 ? (totalCost / revenue) * 100 : 0;

    const allocatedHours = allocNormal + allocOt15 + allocOt20;
    const actualHours = actualNormal + actualOt15 + actualOt20;
    const hoursVariance = allocatedHours - actualHours;
    const hourlyCost = actualHours > 0 ? totalLabourCost / actualHours : 0;
    const hoursCostImpact = hoursVariance * hourlyCost;

    const dateStr = new Date().toISOString().slice(0, 10);

    // ── Create PDF ─────────────────────────────────────────────────────
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const mLeft = 15;
    const mRight = 15;
    const contentW = pageWidth - mLeft - mRight;
    let y = 15;

    // ── Shared footer on every page ────────────────────────────────────
    function drawFooter(pageNum, totalPages) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text('ABP Induction  ·  Job Costing Report', mLeft, pageHeight - 8);
      doc.text('Page ' + pageNum + ' of ' + totalPages, pageWidth - mRight, pageHeight - 8, { align: 'right' });
      doc.setTextColor(...BLACK);
    }

    // ── PAGE HEADER ─────────────────────────────────────────────────────
    function drawPageHeader() {
      y = 15;
      // Logo
      drawLogo(doc, mLeft, y, 38, 18);

      // Customer / Order info
      const infoX = mLeft + 44;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...DARK_CHARCOAL);
      doc.text('Customer: ' + companyName, infoX, y + 7);
      doc.setFontSize(10);
      doc.text('Order No: ' + jobNo, infoX, y + 14);

      // Date – right-aligned
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Date: ' + dateStr, pageWidth - mRight, y + 7, { align: 'right' });

      // Separator
      y += 22;
      doc.setDrawColor(...GRID_COLOUR);
      doc.setLineWidth(0.5);
      doc.line(mLeft, y, pageWidth - mRight, y);
      y += 6;
    }

    drawPageHeader();

    // ── JOB DETAILS ─────────────────────────────────────────────────────
    y = drawSectionTitle(doc, 'Job Details', mLeft, y, pageWidth, mRight);

    const detailRows = [
      ['Customer', companyName],
      ['Customer Order No', customerOrderNo],
      ['Description', description],
      ['Ticket No', ticketNo],
      ['Quote No', quoteNo],
      ['Category', category]
    ];

    doc.setFontSize(9.5);
    detailRows.forEach(function (row) {
      doc.setFont('helvetica', 'bold');
      doc.text(row[0], mLeft + 2, y);
      doc.setFont('helvetica', 'normal');
      // Wrap description if long
      if (row[0] === 'Description') {
        var lines = doc.splitTextToSize(row[1], contentW - 48);
        doc.text(lines, mLeft + 46, y);
        y += Math.max(5, lines.length * 4.5);
      } else {
        doc.text(row[1], mLeft + 46, y);
        y += 5.5;
      }
    });

    y += 4;

    // ── LABOUR TABLE (Actual, Excl. VAT) ─────────────────────────────
    y = drawSectionTitle(doc, 'Labour (Actual, Excl. VAT)', mLeft, y, pageWidth, mRight);

    doc.autoTable({
      startY: y,
      margin: { left: mLeft, right: mRight },
      theme: 'grid',
      headStyles: {
        fillColor: HEADER_BG,
        textColor: BLACK,
        fontStyle: 'bold',
        fontSize: 9.5,
        cellPadding: 3
      },
      bodyStyles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: contentW * 0.38 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' }
      },
      head: [['Type', 'Hours', 'Rate', 'Total Cost (Excl. VAT)']],
      body: [
        ['Normal', actualNormal.toFixed(2), FIXED_RATE_NORMAL.toFixed(2), R(normalTotal)],
        ['Overtime @1.5', actualOt15.toFixed(2), FIXED_RATE_OT15.toFixed(2), R(ot15Total)],
        ['Overtime @2.0', actualOt20.toFixed(2), FIXED_RATE_OT20.toFixed(2), R(ot20Total)]
      ],
      foot: [['', '', 'Total (Excl. VAT)', R(totalLabourCost)]],
      footStyles: {
        fillColor: HEADER_BG,
        textColor: BLACK,
        fontStyle: 'bold',
        fontSize: 9.5,
        halign: 'right',
        cellPadding: 3
      },
      didParseCell: function (data) {
        if (data.section === 'foot' && data.column.index < 2) {
          data.cell.styles.fillColor = WHITE;
          data.cell.styles.lineWidth = 0;
        }
      }
    });

    y = doc.lastAutoTable.finalY + 8;

    // ── TECHNICIANS TABLE ────────────────────────────────────────────
    if (state.technicians.length > 0) {
      y = drawSectionTitle(doc, 'Technicians Assigned', mLeft, y, pageWidth, mRight);

      var techBody = state.technicians.map(function (t) {
        return [
          t.technicianName || '-',
          num(t.hours).toFixed(2),
          t.isMainTechnician ? 'Yes' : ''
        ];
      });

      doc.autoTable({
        startY: y,
        margin: { left: mLeft, right: mRight },
        theme: 'grid',
        headStyles: {
          fillColor: HEADER_BG,
          textColor: BLACK,
          fontStyle: 'bold',
          fontSize: 9.5,
          cellPadding: 3
        },
        bodyStyles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: contentW * 0.50 },
          1: { halign: 'right' },
          2: { halign: 'center' }
        },
        head: [['Technician', 'Hours', 'Main']],
        body: techBody
      });

      y = doc.lastAutoTable.finalY + 8;
    }

    // ── MATERIALS TABLE ──────────────────────────────────────────────
    y = drawSectionTitle(doc, 'Materials (Excl. VAT)', mLeft, y, pageWidth, mRight);

    var matBody = state.materials.map(function (m) {
      var total = num(m.qty) * num(m.costPrice);
      return [
        m.item || '-',
        m.description || '-',
        num(m.qty).toFixed(2),
        num(m.costPrice).toFixed(2),
        R(total)
      ];
    });

    if (matBody.length === 0) {
      matBody = [['No materials entered', '', '', '', '']];
    }

    // Height reserved for the page header on continuation pages
    const headerHeight = 40;

    doc.autoTable({
      startY: y,
      margin: { left: mLeft, right: mRight, top: headerHeight },
      theme: 'grid',
      headStyles: {
        fillColor: HEADER_BG,
        textColor: BLACK,
        fontStyle: 'bold',
        fontSize: 9.5,
        cellPadding: 3
      },
      bodyStyles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: contentW * 0.16 },
        1: { cellWidth: contentW * 0.38 },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' }
      },
      head: [['Material', 'Description', 'Qty', 'Cost Price', 'Total Cost']],
      body: matBody,
      foot: [['', '', '', 'Total Material Cost (Excl. VAT)', R(totalMaterialCost)]],
      footStyles: {
        fillColor: HEADER_BG,
        textColor: BLACK,
        fontStyle: 'bold',
        fontSize: 9.5,
        halign: 'right',
        cellPadding: 3
      },
      didParseCell: function (data) {
        if (data.section === 'foot' && data.column.index < 3) {
          data.cell.styles.fillColor = WHITE;
          data.cell.styles.lineWidth = 0;
        }
      },
      // Auto page-break: put header on new page
      showHead: 'everyPage',
      didDrawPage: function (data) {
        // Draw page header on every continuation page (page > 1 of this table)
        if (data.pageNumber > 1) {
          drawPageHeader();
        }
      }
    });

    y = doc.lastAutoTable.finalY + 10;

    // Check if we need a new page for the summary section
    if (y > pageHeight - 110) {
      doc.addPage();
      drawPageHeader();
    }

    // ── FINANCIAL SUMMARY ────────────────────────────────────────────
    y = drawSectionTitle(doc, 'Financial Summary (Excl. VAT)', mLeft, y, pageWidth, mRight);

    var summaryRows = [
      ['Revenue', R(revenue)],
      ['Material Cost', R(totalMaterialCost)],
      ['Labour Cost', R(totalLabourCost)],
      ['Total Cost', R(totalCost)]
    ];

    // Draw key-value rows for financial summary
    doc.setFontSize(10);
    summaryRows.forEach(function (row) {
      doc.setFont('helvetica', 'normal');
      doc.text(row[0], mLeft + 4, y);
      doc.setFont('helvetica', 'bold');
      doc.text(row[1], pageWidth - mRight - 4, y, { align: 'right' });
      y += 6;
    });

    // Separator before profit metrics
    doc.setDrawColor(...GRID_COLOUR);
    doc.setLineWidth(0.3);
    doc.line(mLeft, y - 1, pageWidth - mRight, y - 1);
    y += 2;

    var profitRows = [
      ['Gross Profit', R(grossProfit)],
      ['Mark-up (%)', totalCost === 0 ? '#DIV/0!' : pctFmt(markupPct)],
      ['Gross Margin (%)', revenue === 0 ? '#DIV/0!' : pctFmt(marginPct)],
      ['Cost in %', revenue === 0 ? '#DIV/0!' : pctFmt(costPctVal)]
    ];

    profitRows.forEach(function (row) {
      doc.setFont('helvetica', 'normal');
      doc.text(row[0], mLeft + 4, y);
      doc.setFont('helvetica', 'bold');
      // Color gross profit green / red
      if (row[0] === 'Gross Profit') {
        var gp = grossProfit;
        doc.setTextColor(gp >= 0 ? 34 : 200, gp >= 0 ? 139 : 50, gp >= 0 ? 34 : 50);
      }
      doc.text(row[1], pageWidth - mRight - 4, y, { align: 'right' });
      doc.setTextColor(...BLACK);
      y += 6;
    });

    y += 6;

    // Check space for next tables
    if (y > pageHeight - 80) {
      doc.addPage();
      drawPageHeader();
    }

    // ── ALLOCATED HOURS & RATES ──────────────────────────────────────
    y = drawSectionTitle(doc, 'Allocated Hours & Rates (Excl. VAT)', mLeft, y, pageWidth, mRight);

    doc.autoTable({
      startY: y,
      margin: { left: mLeft, right: mRight },
      theme: 'grid',
      headStyles: {
        fillColor: HEADER_BG,
        textColor: BLACK,
        fontStyle: 'bold',
        fontSize: 9.5,
        cellPadding: 3
      },
      bodyStyles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: contentW * 0.50 },
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      head: [['Type', 'Rate', 'Allocated Hrs']],
      body: [
        ['Normal', FIXED_RATE_NORMAL.toFixed(2), allocNormal.toFixed(2)],
        ['Overtime @1.5', FIXED_RATE_OT15.toFixed(2), allocOt15.toFixed(2)],
        ['Overtime @2.0', FIXED_RATE_OT20.toFixed(2), allocOt20.toFixed(2)]
      ]
    });

    y = doc.lastAutoTable.finalY + 8;

    // Check space
    if (y > pageHeight - 60) {
      doc.addPage();
      drawPageHeader();
    }

    // ── ACTUAL & VARIANCE ────────────────────────────────────────────
    y = drawSectionTitle(doc, 'Actual & Variance (Excl. VAT)', mLeft, y, pageWidth, mRight);

    doc.autoTable({
      startY: y,
      margin: { left: mLeft, right: mRight },
      theme: 'grid',
      headStyles: {
        fillColor: HEADER_BG,
        textColor: BLACK,
        fontStyle: 'bold',
        fontSize: 9.5,
        cellPadding: 3
      },
      bodyStyles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: contentW * 0.50 },
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      head: [['Type', 'Actual Hrs', 'Amount / Variance']],
      body: [
        ['Normal', actualNormal.toFixed(2), R(normalTotal)],
        ['Overtime @1.5', actualOt15.toFixed(2), R(ot15Total)],
        ['Overtime @2.0', actualOt20.toFixed(2), R(ot20Total)],
        ['Over/Under (Hours)', hoursVariance.toFixed(2), hoursVariance.toFixed(2)],
        ['Hr Cost Impact', '-', R(hoursCostImpact)]
      ]
    });

    // ── Page numbers (footer) ────────────────────────────────────────
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(p, totalPages);
    }

    // ── Save / Download ──────────────────────────────────────────────
    var filename = 'Job_Costing_' + (jobNo !== '-' ? jobNo : 'Draft') + '_' + dateStr + '.pdf';
    doc.save(filename);
  }

  // ── Expose & bind button ───────────────────────────────────────────────
  window.exportJobCostingPdf = exportJobCostingPdf;

  // Bind button when DOM is ready
  function bindExportButton() {
    var btn = document.getElementById('export-pdf');
    if (btn) {
      btn.addEventListener('click', exportJobCostingPdf);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindExportButton);
  } else {
    bindExportButton();
  }
})();
