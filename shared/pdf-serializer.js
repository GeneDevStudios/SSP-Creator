/**
 * pdf-serializer.js
 * -----------------
 * Generates a NIST SP 800-18 aligned PDF from a full SSP data object.
 * Uses pdf-lib (pure JS, no native deps, no Chromium).
 *
 * Structure mirrors docx-serializer.js:
 *   Cover Page
 *   Section 1 — System Identification
 *   Section 2 — System Description
 *   Section 3 — System Diagrams
 *   Section 4 — Control Implementations
 *   Signature Block
 *   Branding footer
 */

const { PDFDocument, rgb, StandardFonts, PageSizes, LineCapStyle } = require('pdf-lib');
const { BRANDING_TEXT } = require('./oscal-serializer');

// ---------------------------------------------------------------
// Page layout constants (Letter size)
// ---------------------------------------------------------------
const PAGE_W        = 612;
const PAGE_H        = 792;
const MARGIN_LEFT   = 72;   // 1 inch
const MARGIN_RIGHT  = 72;
const MARGIN_TOP    = 72;
const MARGIN_BOTTOM = 72;
const CONTENT_W     = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

// ---------------------------------------------------------------
// Color helpers — pdf-lib uses 0-1 RGB
// ---------------------------------------------------------------
const C = {
  black:     rgb(0,      0,      0),
  white:     rgb(1,      1,      1),
  navy:      rgb(0.06,   0.09,   0.16),
  navyLight: rgb(0.12,   0.18,   0.30),
  blue:      rgb(0.23,   0.51,   0.96),
  blueLight: rgb(0.38,   0.64,   0.98),
  purple:    rgb(0.39,   0.40,   0.95),
  amber:     rgb(0.96,   0.62,   0.04),
  green:     rgb(0.02,   0.59,   0.41),
  red:       rgb(0.86,   0.15,   0.15),
  slate:     rgb(0.20,   0.25,   0.33),
  muted:     rgb(0.39,   0.45,   0.55),
  light:     rgb(0.95,   0.96,   0.98),
  lightAlt:  rgb(0.94,   0.95,   0.97),
  border:    rgb(0.89,   0.91,   0.94),
};

const STATUS_COLORS = {
  implemented:    C.green,
  partially:      C.amber,
  planned:        C.blue,
  'not-applicable': C.muted,
};
const STATUS_LABELS = {
  implemented:    'Implemented',
  partially:      'Partially Implemented',
  planned:        'Planned',
  'not-applicable': 'Not Applicable',
};
const ORIGIN_LABELS = {
  system:    'System',
  hybrid:    'Hybrid',
  inherited: 'Inherited',
  customer:  'Customer',
};

// ---------------------------------------------------------------
// Page manager — handles pagination automatically
// ---------------------------------------------------------------
class PageManager {
  constructor(pdfDoc, fonts) {
    this.doc       = pdfDoc;
    this.fonts     = fonts;
    this.pages     = [];
    this.pageNums  = [];
    this.y         = 0;
    this.pageIndex = 0;
    this._addPage();
  }

  _addPage() {
    const page = this.doc.addPage(PageSizes.Letter);
    this.pages.push(page);
    this.y = PAGE_H - MARGIN_TOP;
    this.pageIndex = this.pages.length - 1;
    return page;
  }

  get page() { return this.pages[this.pageIndex]; }
  get pageNum() { return this.pageIndex + 1; }

  // Ensure there's enough vertical space; add page if not
  ensureSpace(needed) {
    if (this.y - needed < MARGIN_BOTTOM) {
      this._addPage();
    }
  }

  // Draw text with word-wrap, returns height used
  text(str, opts = {}) {
    if (!str) return 0;
    const font   = opts.bold ? this.fonts.bold : this.fonts.regular;
    const size   = opts.size   || 10;
    const color  = opts.color  || C.navy;
    const x      = opts.x      || MARGIN_LEFT + (opts.indent || 0);
    const maxW   = opts.maxW   || (CONTENT_W - (opts.indent || 0));
    const lineH  = size * 1.5;

    // Word wrap
    const words = str.split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const w = font.widthOfTextAtSize(test, size);
      if (w > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    let totalH = 0;
    for (const l of lines) {
      this.ensureSpace(lineH + 4);
      this.y -= lineH;
      this.page.drawText(l, { x, y: this.y, size, font, color });
      totalH += lineH;
    }
    if (opts.after !== undefined) {
      this.y -= opts.after;
      totalH += opts.after;
    }
    return totalH;
  }

  space(h) { this.y -= h; }

  line(color = C.border, thickness = 0.5) {
    this.page.drawLine({
      start: { x: MARGIN_LEFT, y: this.y },
      end:   { x: PAGE_W - MARGIN_RIGHT, y: this.y },
      thickness, color,
    });
  }

  // Filled rectangle
  rect(x, y, w, h, color) {
    this.page.drawRectangle({ x, y, width: w, height: h, color });
  }

  // Outlined rectangle
  rectBorder(x, y, w, h, color, thickness = 0.5) {
    this.page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: thickness, color: undefined });
  }

  // New page with header
  newPage(ssp) {
    this._addPage();
    this._drawPageHeader(ssp);
  }

  _drawPageHeader(ssp) {
    const font = this.fonts.regular;
    const size = 8;
    const y    = PAGE_H - 40;
    this.page.drawText(`${ssp.system_name} — System Security Plan`, {
      x: MARGIN_LEFT, y, size, font, color: C.muted,
    });
    const pageStr = `Page ${this.pageNum}`;
    const pw = font.widthOfTextAtSize(pageStr, size);
    this.page.drawText(pageStr, {
      x: PAGE_W - MARGIN_RIGHT - pw, y, size, font, color: C.muted,
    });
    this.page.drawLine({
      start: { x: MARGIN_LEFT, y: y - 6 },
      end:   { x: PAGE_W - MARGIN_RIGHT, y: y - 6 },
      thickness: 0.5, color: C.border,
    });
    this.y = y - 24;
  }
}

// ---------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------
function drawHeading1(pm, text, ssp) {
  pm.ensureSpace(60);
  pm.space(16);
  const y = pm.y;
  pm.rect(MARGIN_LEFT, y - 2, CONTENT_W, 28, C.navy);
  pm.page.drawText(text, {
    x: MARGIN_LEFT + 10, y: y + 6,
    size: 13, font: pm.fonts.bold, color: C.white,
  });
  pm.y = y - 14;
}

function drawHeading2(pm, text) {
  pm.ensureSpace(40);
  pm.space(12);
  pm.page.drawText(text, {
    x: MARGIN_LEFT, y: pm.y,
    size: 11, font: pm.fonts.bold, color: C.navy,
  });
  pm.y -= 4;
  pm.line(C.blue, 0.75);
  pm.space(8);
}

function drawHeading3(pm, text, color = C.navy) {
  pm.ensureSpace(30);
  pm.space(8);
  pm.page.drawText(text, {
    x: MARGIN_LEFT, y: pm.y,
    size: 10, font: pm.fonts.bold, color,
  });
  pm.space(6);
}

// ---------------------------------------------------------------
// Info table (two-column label/value)
// ---------------------------------------------------------------
function drawInfoTable(pm, rows) {
  const rowH   = 20;
  const labelW = CONTENT_W * 0.32;
  const valueW = CONTENT_W * 0.68;

  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i];
    pm.ensureSpace(rowH + 4);
    const y    = pm.y;
    const bg   = i % 2 === 0 ? C.light : C.lightAlt;

    // Row background
    pm.rect(MARGIN_LEFT, y - rowH + 4, CONTENT_W, rowH, bg);

    // Label
    pm.page.drawText(label || '', {
      x: MARGIN_LEFT + 6, y: y - 11,
      size: 9, font: pm.fonts.bold, color: C.navy,
    });

    // Value — truncate if too long
    const valStr = (value || '—').toString();
    const maxChars = Math.floor(valueW / 5.5);
    const display = valStr.length > maxChars ? valStr.slice(0, maxChars - 1) + '…' : valStr;
    pm.page.drawText(display, {
      x: MARGIN_LEFT + labelW + 6, y: y - 11,
      size: 9, font: pm.fonts.regular, color: C.navyLight,
    });

    // Divider
    pm.page.drawLine({
      start: { x: MARGIN_LEFT, y: y - rowH + 4 },
      end:   { x: PAGE_W - MARGIN_RIGHT, y: y - rowH + 4 },
      thickness: 0.3, color: C.border,
    });
    // Column divider
    pm.page.drawLine({
      start: { x: MARGIN_LEFT + labelW, y },
      end:   { x: MARGIN_LEFT + labelW, y: y - rowH + 4 },
      thickness: 0.3, color: C.border,
    });

    pm.y -= rowH;
  }

  // Table border
  const tableH = rows.length * rowH;
  pm.rectBorder(MARGIN_LEFT, pm.y + 4, CONTENT_W, tableH, C.slate, 0.5);
  pm.space(10);
}

// ---------------------------------------------------------------
// FIPS 199 Impact table (four columns)
// ---------------------------------------------------------------
function drawImpactTable(pm, overall, confidentiality, integrity, availability) {
  const cols    = ['Overall', 'Confidentiality', 'Integrity', 'Availability'];
  const values  = [overall, confidentiality, integrity, availability];
  const colW    = CONTENT_W / 4;
  const headerH = 18;
  const valueH  = 22;

  pm.ensureSpace(headerH + valueH + 10);

  const startY = pm.y;

  // Header row background
  pm.rect(MARGIN_LEFT, startY - headerH + 4, CONTENT_W, headerH, C.navy);
  cols.forEach((col, i) => {
    const cx = MARGIN_LEFT + i * colW + colW / 2;
    const tw = pm.fonts.bold.widthOfTextAtSize(col, 8);
    pm.page.drawText(col, {
      x: cx - tw / 2, y: startY - 11,
      size: 8, font: pm.fonts.bold, color: C.white,
    });
  });

  // Value row
  const valueY = startY - headerH;
  pm.rect(MARGIN_LEFT, valueY - valueH + 4, CONTENT_W, valueH, C.lightAlt);

  const impactColor = (v) => {
    if (!v) return C.muted;
    if (v === 'High')     return C.red;
    if (v === 'Moderate') return C.amber;
    return C.green;
  };

  values.forEach((val, i) => {
    const display = val || '—';
    const cx = MARGIN_LEFT + i * colW + colW / 2;
    const tw = pm.fonts.bold.widthOfTextAtSize(display, 10);
    pm.page.drawText(display, {
      x: cx - tw / 2, y: valueY - 13,
      size: 10, font: val ? pm.fonts.bold : pm.fonts.regular,
      color: impactColor(val),
    });
  });

  // Column dividers
  for (let i = 1; i < 4; i++) {
    pm.page.drawLine({
      start: { x: MARGIN_LEFT + i * colW, y: startY + 4 },
      end:   { x: MARGIN_LEFT + i * colW, y: valueY - valueH + 4 },
      thickness: 0.3, color: C.border,
    });
  }

  // Border
  pm.rectBorder(MARGIN_LEFT, valueY - valueH + 4, CONTENT_W, headerH + valueH, C.slate, 0.5);

  pm.y = valueY - valueH - 6;
  pm.space(10);
}

// ---------------------------------------------------------------
// Control entry
// ---------------------------------------------------------------
function drawControl(pm, ctrl, ssp) {
  // Estimate height needed
  const narrativeLines = Math.ceil((ctrl.narrative || '').length / 90) + 1;
  const estimatedH = 60 + narrativeLines * 15;
  if (pm.y - estimatedH < MARGIN_BOTTOM + 40) {
    pm.newPage(ssp);
  }

  // Control header bar
  const barY = pm.y;
  pm.rect(MARGIN_LEFT, barY - 18, CONTENT_W, 20, C.lightAlt);
  pm.page.drawText(`${ctrl.label || ctrl.control_id_str}  ${ctrl.title || ''}`, {
    x: MARGIN_LEFT + 6, y: barY - 12,
    size: 9, font: pm.fonts.bold, color: C.navy,
  });
  pm.y = barY - 22;

  // Status + Origin pills
  const status      = STATUS_LABELS[ctrl.impl_status]  || ctrl.impl_status  || '—';
  const statusColor = STATUS_COLORS[ctrl.impl_status]  || C.muted;
  const origin      = ORIGIN_LABELS[ctrl.control_origin] || ctrl.control_origin || '—';

  pm.page.drawText('Status: ', { x: MARGIN_LEFT + 4, y: pm.y, size: 8, font: pm.fonts.bold, color: C.muted });
  pm.page.drawText(status, { x: MARGIN_LEFT + 38, y: pm.y, size: 8, font: pm.fonts.bold, color: statusColor });
  pm.page.drawText('  Origin: ', { x: MARGIN_LEFT + 38 + pm.fonts.bold.widthOfTextAtSize(status, 8) + 4, y: pm.y, size: 8, font: pm.fonts.bold, color: C.muted });
  const originX = MARGIN_LEFT + 38 + pm.fonts.bold.widthOfTextAtSize(status, 8) + 4 + pm.fonts.bold.widthOfTextAtSize('  Origin: ', 8);
  pm.page.drawText(origin, { x: originX, y: pm.y, size: 8, font: pm.fonts.regular, color: C.navyLight });
  pm.y -= 14;

  // Narrative label
  pm.page.drawText('Implementation Narrative:', {
    x: MARGIN_LEFT + 4, y: pm.y,
    size: 8, font: pm.fonts.bold, color: C.muted,
  });
  pm.y -= 12;

  // Narrative text with word wrap
  pm.text(ctrl.narrative || '—', { size: 9, indent: 12, color: C.navyLight, after: 4 });

  // Remarks
  if (ctrl.remarks?.trim()) {
    pm.page.drawText('Remarks:', { x: MARGIN_LEFT + 4, y: pm.y, size: 8, font: pm.fonts.bold, color: C.muted });
    pm.y -= 12;
    pm.text(ctrl.remarks, { size: 8, indent: 12, color: C.muted, after: 2 });
  }

  // Bottom divider
  pm.space(6);
  pm.line(C.border, 0.3);
  pm.space(8);
}

// ---------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------
async function buildCoverPage(pm, ssp, characterization, logoData) {
  const page = pm.page;
  const { width, height } = page.getSize();

  // Dark header band
  pm.rect(0, height - 180, width, 180, C.navy);

  // Logo
  let logoY = height - 60;
  if (logoData?.data) {
    try {
      const imgBuf = Buffer.from(logoData.data, 'base64');
      const img = logoData.mime_type === 'image/png'
        ? await pm.doc.embedPng(imgBuf)
        : await pm.doc.embedJpg(imgBuf);
      const dims = img.scaleToFit(120, 50);
      page.drawImage(img, { x: MARGIN_LEFT, y: height - MARGIN_TOP - dims.height, width: dims.width, height: dims.height });
      logoY = height - MARGIN_TOP - dims.height - 10;
    } catch {}
  }

  // Title
  const titleY = height - 100;
  const title = 'SYSTEM SECURITY PLAN';
  const titleW = pm.fonts.bold.widthOfTextAtSize(title, 22);
  page.drawText(title, {
    x: (width - titleW) / 2, y: titleY,
    size: 22, font: pm.fonts.bold, color: C.white,
  });

  // System name
  const nameW = pm.fonts.bold.widthOfTextAtSize(ssp.system_name, 16);
  page.drawText(ssp.system_name, {
    x: (width - nameW) / 2, y: titleY - 28,
    size: 16, font: pm.fonts.bold, color: C.blueLight,
  });

  // Org
  if (ssp.org_name) {
    const orgW = pm.fonts.regular.widthOfTextAtSize(ssp.org_name, 11);
    page.drawText(ssp.org_name, {
      x: (width - orgW) / 2, y: titleY - 48,
      size: 11, font: pm.fonts.regular, color: rgb(0.7, 0.8, 0.9),
    });
  }

  // Meta box
  const boxY = height - 260;
  pm.rect(MARGIN_LEFT, boxY - 100, CONTENT_W, 100, C.light);
  pm.rectBorder(MARGIN_LEFT, boxY - 100, CONTENT_W, 100, C.border, 0.5);

  const metaRows = [
    ['Version',                ssp.system_version || '1.0'],
    ['Date',                   new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })],
    ['System Identifier',      characterization?.system_identifier || '—'],
    ['Security Categorization',characterization?.security_category || '—'],
    ['Operational Status',     characterization?.operational_status || '—'],
  ];

  metaRows.forEach(([label, value], i) => {
    const rowY = boxY - 16 - i * 18;
    page.drawText(`${label}:`, { x: MARGIN_LEFT + 10, y: rowY, size: 9, font: pm.fonts.bold, color: C.muted });
    page.drawText(value, { x: MARGIN_LEFT + 160, y: rowY, size: 9, font: pm.fonts.regular, color: C.navy });
  });

  // Reset cursor below meta box
  pm.y = boxY - 120;
}

// ---------------------------------------------------------------
// Main serializer
// ---------------------------------------------------------------
async function serializePdf(fullData) {
  const { ssp, characterization, description, diagrams, implementations } = fullData;
  const logoData = fullData.logo || null;
  const includeBranding = logoData ? logoData.include_branding !== 0 : true;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`System Security Plan — ${ssp.system_name}`);
  pdfDoc.setAuthor('Anvil FORGE · GeneDevStudios');
  pdfDoc.setCreator('Anvil FORGE');
  pdfDoc.setProducer('GeneDevStudios · genedevstudios.com');

  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold:    await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic:  await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  };

  const pm = new PageManager(pdfDoc, fonts);

  // ── Cover Page ──────────────────────────────────────────────
  await buildCoverPage(pm, ssp, characterization, logoData);

  // ── Section 1 — System Identification ───────────────────────
  pm.newPage(ssp);
  drawHeading1(pm, 'Section 1 — System Identification', ssp);
  pm.space(12);

  drawHeading2(pm, '1.1 System Information');
  drawInfoTable(pm, [
    ['System Name',           ssp.system_name],
    ['System Version',        ssp.system_version || '—'],
    ['Organization',          ssp.org_name || '—'],
    ['System Identifier',     characterization?.system_identifier || '—'],
    ['System Type',           characterization?.system_type || '—'],
    ['Operational Status',    characterization?.operational_status || '—'],
    ['Profile / Catalog Ref', ssp.profile_href || '—'],
  ]);

  drawHeading2(pm, '1.2 Security Categorization (FIPS 199)');
  drawImpactTable(pm,
    characterization?.security_category,
    characterization?.impact_confidentiality,
    characterization?.impact_integrity,
    characterization?.impact_availability,
  );

  if (characterization?.additional_info) {
    drawHeading2(pm, '1.3 Additional Information');
    pm.text(characterization.additional_info, { size: 9, color: C.navyLight, after: 8 });
  }

  // ── Section 2 — System Description ──────────────────────────
  pm.newPage(ssp);
  drawHeading1(pm, 'Section 2 — System Description', ssp);
  pm.space(12);

  const descSections = [
    ['2.1 General System Description', description?.general_description],
    ['2.2 System Function and Purpose',  description?.function_purpose],
    ['2.3 System Boundary Description',  description?.boundary_description],
    ['2.4 Data Types Processed',         description?.data_types],
  ];

  for (const [heading, content] of descSections) {
    if (!content) continue;
    drawHeading2(pm, heading);
    pm.text(content, { size: 9, color: C.navyLight, after: 12 });
  }

  if (description?.user_types?.length) {
    drawHeading2(pm, '2.5 User Types');
    pm.text(description.user_types.join('  ·  '), { size: 9, color: C.navyLight, after: 12 });
  }

  if (description?.additional_info) {
    drawHeading2(pm, '2.6 Additional Information');
    pm.text(description.additional_info, { size: 9, color: C.navyLight, after: 8 });
  }

  // ── Section 3 — System Diagrams ─────────────────────────────
  pm.newPage(ssp);
  drawHeading1(pm, 'Section 3 — System Diagrams', ssp);
  pm.space(12);

  const DIAGRAM_META = {
    architecture: '3.1 Architecture / Network Diagram',
    boundary:     '3.2 Authorization Boundary Diagram',
    dataflow:     '3.3 Data Flow Diagram',
  };

  let hasDiagrams = false;
  for (const [type, heading] of Object.entries(DIAGRAM_META)) {
    const diag = (diagrams || []).find(d => d.diagram_type === type);
    if (!diag?.data) continue;
    hasDiagrams = true;
    drawHeading2(pm, heading);
    try {
      const imgBuf = Buffer.from(diag.data, 'base64');
      const img = diag.mime_type === 'image/png'
        ? await pdfDoc.embedPng(imgBuf)
        : await pdfDoc.embedJpg(imgBuf);
      const maxW = CONTENT_W;
      const maxH = 260;
      const dims = img.scaleToFit(maxW, maxH);
      pm.ensureSpace(dims.height + 20);
      pm.page.drawImage(img, {
        x: MARGIN_LEFT + (CONTENT_W - dims.width) / 2,
        y: pm.y - dims.height,
        width: dims.width, height: dims.height,
      });
      pm.y -= dims.height + 10;
    } catch {
      pm.text('[Image could not be embedded]', { size: 9, color: C.muted, after: 8 });
    }
    if (diag.additional_info) {
      pm.text(diag.additional_info, { size: 8, color: C.muted, after: 12 });
    }
    pm.space(10);
  }

  if (!hasDiagrams) {
    pm.text('No diagrams have been uploaded for this SSP.', { size: 9, color: C.muted, after: 8 });
  }

  // ── Section 4 — Control Implementations ─────────────────────
  pm.newPage(ssp);
  drawHeading1(pm, 'Section 4 — Control Implementations', ssp);
  pm.space(12);

  if (!implementations?.length) {
    pm.text('No control implementations have been documented.', { size: 9, color: C.muted });
  } else {
    // Group by family
    const families = {};
    for (const impl of implementations) {
      const key = impl.group_title || 'Ungrouped';
      if (!families[key]) families[key] = [];
      families[key].push(impl);
    }

    let familyNum = 1;
    for (const [familyTitle, controls] of Object.entries(families)) {
      drawHeading2(pm, `4.${familyNum} ${familyTitle}`);
      for (const ctrl of controls) {
        drawControl(pm, ctrl, ssp);
      }
      familyNum++;
    }
  }

  // ── Signature Block ──────────────────────────────────────────
  pm.newPage(ssp);
  drawHeading1(pm, 'Signature Block', ssp);
  pm.space(12);
  pm.text(
    'By signing below, the designated officials certify that this System Security Plan accurately describes the security controls implemented for the above-referenced information system.',
    { size: 9, color: C.navyLight, after: 20 }
  );

  const sigRows = [
    ['Information System Owner', ''],
    ['Signature', ''],
    ['Date', ''],
    ['ISSO', ''],
    ['Signature', ''],
    ['Date', ''],
    ['Authorizing Official', ''],
    ['Signature', ''],
    ['Date', ''],
  ];
  drawInfoTable(pm, sigRows);

  // ── Branding footer ──────────────────────────────────────────
  if (includeBranding) {
    pm.ensureSpace(40);
    pm.space(20);
    pm.line(C.border, 0.5);
    pm.space(8);
    const bw = pm.fonts.italic.widthOfTextAtSize(BRANDING_TEXT, 7);
    pm.page.drawText(BRANDING_TEXT, {
      x: (PAGE_W - bw) / 2, y: pm.y,
      size: 7, font: pm.fonts.italic, color: C.muted,
    });
  }

  // ── Page numbers on cover ────────────────────────────────────
  // Cover page doesn't get a header — skip index 0
  // Already handled by newPage() calls above

  return await pdfDoc.save();
}

module.exports = { serializePdf };
