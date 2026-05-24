/**
 * docx-serializer.js
 * ------------------
 * Generates a NIST SP 800-18 aligned Word document (.docx) from
 * a full SSP data object returned by ssp:get-full.
 *
 * Structure:
 *   Cover Page
 *   Table of Contents
 *   Section 1 — System Identification (characterization)
 *   Section 2 — System Description
 *   Section 3 — System Diagrams
 *   Section 4 — Control Implementations (by family)
 *   Signature Block
 *   Branding footer (if enabled)
 */

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, PageBreak, ImageRun, Header, Footer,
  PageNumberElement, ShadingType,
  UnderlineType,
} = require('docx');

const { BRANDING_TEXT } = require('./oscal-serializer');

// ---------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------
const C = {
  dark:      '020617',
  navy:      '0f172a',
  blue:      '3b82f6',
  blueLight: '60a5fa',
  purple:    '6366f1',
  amber:     'f59e0b',
  green:     '059669',
  slate:     '334155',
  muted:     '64748b',
  light:     'f1f5f9',
  white:     'FFFFFF',
  black:     '000000',
  // Status colors
  implemented: '059669',
  partially:   'f59e0b',
  planned:     '3b82f6',
  na:          '94a3b8',
};

// ---------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------
const STATUS_LABELS = {
  implemented:    'Implemented',
  partially:      'Partially Implemented',
  planned:        'Planned',
  'not-applicable': 'Not Applicable',
};

const STATUS_COLORS = {
  implemented:    C.implemented,
  partially:      C.amber,
  planned:        C.blue,
  'not-applicable': C.muted,
};

const ORIGIN_LABELS = {
  system:    'System',
  hybrid:    'Hybrid',
  inherited: 'Inherited',
  customer:  'Customer',
};

// ---------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------
function t(text, opts = {}) {
  return new TextRun({
    text: text || '',
    bold:      opts.bold      || false,
    italics:   opts.italic    || false,
    color:     opts.color     || C.black,
    size:      opts.size      || 22,       // half-points: 22 = 11pt
    font:      opts.font      || 'Calibri',
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
  });
}

function p(children, opts = {}) {
  const runs = Array.isArray(children) ? children : [children];
  return new Paragraph({
    children: runs,
    alignment:    opts.align   || AlignmentType.LEFT,
    spacing:      { before: opts.before || 0, after: opts.after || 120 },
    indent:       opts.indent  ? { left: opts.indent } : undefined,
    heading:      opts.heading || undefined,
    pageBreakBefore: opts.pageBreak || false,
  });
}

function heading1(text, pageBreak = false) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, color: C.navy, font: 'Calibri' })],
    heading:  HeadingLevel.HEADING_1,
    spacing:  { before: 400, after: 200 },
    pageBreakBefore: pageBreak,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.blue } },
  });
}

function heading2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: C.navy, font: 'Calibri' })],
    heading:  HeadingLevel.HEADING_2,
    spacing:  { before: 280, after: 120 },
  });
}

function heading3(text, color = C.navy) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color, font: 'Calibri' })],
    heading:  HeadingLevel.HEADING_3,
    spacing:  { before: 200, after: 80 },
  });
}

function bodyText(text, opts = {}) {
  if (!text) return emptyLine();
  return p(
    t(text, { size: 22, color: opts.color || '1e293b' }),
    { before: 0, after: opts.after || 120, indent: opts.indent }
  );
}

function emptyLine(count = 1) {
  return Array.from({ length: count }, () =>
    new Paragraph({ children: [new TextRun('')], spacing: { after: 0 } })
  );
}

function labelValueRow(label, value, labelColor = C.muted) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, color: labelColor, font: 'Calibri' }),
      new TextRun({ text: value || '—', size: 20, color: '1e293b', font: 'Calibri' }),
    ],
    spacing: { after: 80 },
  });
}

// ---------------------------------------------------------------
// Table helpers — docx v8 uses columnWidths on Table, not cells
// ---------------------------------------------------------------
const TABLE_BORDERS = {
  top:     { style: BorderStyle.SINGLE, size: 4, color: C.slate },
  bottom:  { style: BorderStyle.SINGLE, size: 4, color: C.slate },
  left:    { style: BorderStyle.SINGLE, size: 4, color: C.slate },
  right:   { style: BorderStyle.SINGLE, size: 4, color: C.slate },
  insideH: { style: BorderStyle.SINGLE, size: 2, color: 'e2e8f0' },
  insideV: { style: BorderStyle.SINGLE, size: 2, color: 'e2e8f0' },
};

function infoTable(rows) {
  return new Table({
    columnWidths: [3000, 7000],
    borders: TABLE_BORDERS,
    rows: rows.map(([label, value], idx) =>
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: idx%2===0?'f8fafc':'f1f5f9', fill: idx%2===0?'f8fafc':'f1f5f9' },
            children: [new Paragraph({
              children: [new TextRun({ text: label||'', bold:true, size:20, color:C.navy, font:'Calibri' })],
              spacing: { before:80, after:80 },
              indent:  { left:100 },
            })],
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text:value||'—', size:20, color:'1e293b', font:'Calibri' })],
              spacing: { before:80, after:80 },
              indent:  { left:100 },
            })],
          }),
        ],
      })
    ),
  });
}

function impactTable(confidentiality, integrity, availability, overall) {
  const impactColor = (val) => {
    if (!val) return C.muted;
    if (val === 'High')     return 'dc2626';
    if (val === 'Moderate') return 'f59e0b';
    return '059669';
  };

  const headerCell = (text) => new TableCell({
    shading: { type: ShadingType.SOLID, color:'0f172a', fill:'0f172a' },
    children: [new Paragraph({
      children: [new TextRun({ text, bold:true, size:20, color:C.white, font:'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing:   { before:80, after:80 },
    })],
  });

  const valueCell = (val) => new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text:val||'—', bold:!!val, size:20, color:impactColor(val), font:'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing:   { before:80, after:80 },
    })],
  });

  return new Table({
    columnWidths: [2700, 2700, 2700, 2700],
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({ children: [headerCell('Overall'), headerCell('Confidentiality'), headerCell('Integrity'), headerCell('Availability')] }),
      new TableRow({ children: [valueCell(overall), valueCell(confidentiality), valueCell(integrity), valueCell(availability)] }),
    ],
  });
}



function statusBadgePara(status, origin) {
  const label  = STATUS_LABELS[status]  || status  || '—';
  const oLabel = ORIGIN_LABELS[origin]  || origin  || '—';
  const color  = STATUS_COLORS[status]  || C.muted;
  return new Paragraph({
    children: [
      new TextRun({ text: 'Status: ', bold: true, size: 20, color: C.muted, font: 'Calibri' }),
      new TextRun({ text: label, bold: true, size: 20, color, font: 'Calibri' }),
      new TextRun({ text: '   ', size: 20 }),
      new TextRun({ text: 'Origin: ', bold: true, size: 20, color: C.muted, font: 'Calibri' }),
      new TextRun({ text: oLabel, size: 20, color: '1e293b', font: 'Calibri' }),
    ],
    spacing: { after: 80 },
  });
}

// ---------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------
function buildCoverPage(ssp, characterization, logoData) {
  const children = [];

  // Logo
  if (logoData?.data) {
    try {
      const imgBuf = Buffer.from(logoData.data, 'base64');
      children.push(new Paragraph({
        children: [new ImageRun({
          data: imgBuf,
          transformation: { width: 160, height: 80 },
          type: logoData.mime_type === 'image/png' ? 'png' : 'jpg',
        })],
        spacing: { after: 400 },
      }));
    } catch {}
  }

  // Title block
  children.push(
    ...Array.from({ length: 4 }, () => new Paragraph({ children: [new TextRun('')] })),
    new Paragraph({
      children: [new TextRun({ text: 'SYSTEM SECURITY PLAN', bold: true, size: 52, color: C.navy, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: ssp.system_name, bold: true, size: 40, color: C.blue, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: ssp.org_name || '', size: 28, color: C.muted, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    // Horizontal rule
    new Paragraph({
      children: [new TextRun({ text: '' })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.blue } },
      spacing: { after: 400 },
    }),
    // Meta info
    new Paragraph({
      children: [new TextRun({ text: `Version: ${ssp.system_version || '1.0'}`, size: 22, color: '334155', font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}`, size: 22, color: '334155', font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
  );

  if (characterization?.security_category) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `Security Categorization: ${characterization.security_category}`, bold: true, size: 22, color: STATUS_COLORS[characterization.security_category?.toLowerCase()] || C.navy, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }));
  }

  if (characterization?.system_identifier) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `System ID: ${characterization.system_identifier}`, size: 20, color: C.muted, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }));
  }

  // Page break after cover
  children.push(new Paragraph({ children: [new PageBreak()] }));

  return children;
}

// ---------------------------------------------------------------
// Section 1 — System Identification
// ---------------------------------------------------------------
function buildSection1(ssp, characterization) {
  const c = characterization || {};
  return [
    heading1('Section 1 — System Identification', false),
    heading2('1.1 System Information'),
    infoTable([
      ['System Name',           ssp.system_name],
      ['System Version',        ssp.system_version || '—'],
      ['Organization',          ssp.org_name || '—'],
      ['System Identifier',     c.system_identifier || '—'],
      ['System Type',           c.system_type || '—'],
      ['Operational Status',    c.operational_status || '—'],
      ['Profile / Catalog Ref', ssp.profile_href || '—'],
    ]),
    ...emptyLine(),
    heading2('1.2 Security Categorization (FIPS 199)'),
    impactTable(
      c.impact_confidentiality,
      c.impact_integrity,
      c.impact_availability,
      c.security_category
    ),
    ...emptyLine(),
    ...(c.additional_info ? [
      heading2('1.3 Additional Information'),
      bodyText(c.additional_info),
    ] : []),
  ];
}

// ---------------------------------------------------------------
// Section 2 — System Description
// ---------------------------------------------------------------
function buildSection2(description) {
  const d = description || {};
  const sections = [
    heading1('Section 2 — System Description', true),
  ];

  const addNarrative = (num, title, content) => {
    if (!content) return;
    sections.push(heading2(`${num} ${title}`));
    sections.push(bodyText(content));
    sections.push(...emptyLine());
  };

  addNarrative('2.1', 'General System Description', d.general_description);
  addNarrative('2.2', 'System Function and Purpose',  d.function_purpose);
  addNarrative('2.3', 'System Boundary Description',  d.boundary_description);
  addNarrative('2.4', 'Data Types Processed',         d.data_types);

  if (d.user_types?.length) {
    sections.push(heading2('2.5 User Types'));
    sections.push(new Paragraph({
      children: (d.user_types).map((ut, i) =>
        new TextRun({ text: (i > 0 ? '  ·  ' : '') + ut, size: 22, color: '1e293b', font: 'Calibri' })
      ),
      spacing: { after: 120 },
    }));
    sections.push(...emptyLine());
  }

  if (d.additional_info) {
    sections.push(heading2('2.6 Additional Information'));
    sections.push(bodyText(d.additional_info));
  }

  return sections;
}

// ---------------------------------------------------------------
// Section 3 — System Diagrams
// ---------------------------------------------------------------
function buildSection3(diagrams) {
  const elements = [heading1('Section 3 — System Diagrams', true)];

  const DIAGRAM_LABELS = {
    architecture: { num: '3.1', title: 'Architecture / Network Diagram' },
    boundary:     { num: '3.2', title: 'Authorization Boundary Diagram' },
    dataflow:     { num: '3.3', title: 'Data Flow Diagram' },
  };

  let hasAny = false;
  for (const [type, cfg] of Object.entries(DIAGRAM_LABELS)) {
    const diag = diagrams.find(d => d.diagram_type === type);
    if (!diag?.data) continue;
    hasAny = true;

    elements.push(heading2(`${cfg.num} ${cfg.title}`));

    try {
      const imgBuf = Buffer.from(diag.data, 'base64');
      elements.push(new Paragraph({
        children: [new ImageRun({
          data: imgBuf,
          transformation: { width: 580, height: 380 },
          type: diag.mime_type === 'image/png' ? 'png' : 'jpg',
        })],
        spacing: { after: 120 },
      }));
    } catch {
      elements.push(bodyText('[Image could not be embedded]', { color: C.muted }));
    }

    if (diag.additional_info) {
      elements.push(bodyText(diag.additional_info, { color: C.muted, after: 200 }));
    }
    elements.push(...emptyLine());
  }

  if (!hasAny) {
    elements.push(bodyText('No diagrams have been uploaded for this SSP.', { color: C.muted }));
  }

  return elements;
}

// ---------------------------------------------------------------
// Section 4 — Control Implementations
// ---------------------------------------------------------------
function buildSection4(implementations) {
  const elements = [heading1('Section 4 — Control Implementations', true)];

  if (!implementations?.length) {
    elements.push(bodyText('No control implementations have been documented.', { color: C.muted }));
    return elements;
  }

  // Group by family
  const families = {};
  for (const impl of implementations) {
    const key = impl.group_title || 'Ungrouped';
    if (!families[key]) families[key] = [];
    families[key].push(impl);
  }

  let familyNum = 1;
  for (const [familyTitle, controls] of Object.entries(families)) {
    elements.push(heading2(`4.${familyNum} ${familyTitle}`));

    for (const ctrl of controls) {
      // Control header
      elements.push(new Paragraph({
        children: [
          new TextRun({ text: `${ctrl.label || ctrl.control_id_str}  `, bold: true, size: 24, color: C.navy, font: 'Calibri' }),
          new TextRun({ text: ctrl.title || '', size: 22, color: '334155', font: 'Calibri' }),
        ],
        spacing: { before: 200, after: 80 },
        border: { bottom: { style: BorderStyle.DOTTED, size: 2, color: 'e2e8f0' } },
      }));

      // Status + Origin
      elements.push(statusBadgePara(ctrl.impl_status, ctrl.control_origin));

      // Narrative
      elements.push(new Paragraph({
        children: [new TextRun({ text: 'Implementation Narrative', bold: true, size: 20, color: C.muted, font: 'Calibri' })],
        spacing: { after: 40 },
      }));
      elements.push(new Paragraph({
        children: [new TextRun({ text: ctrl.narrative || '—', size: 21, color: '1e293b', font: 'Calibri' })],
        indent:  { left: 180 },
        spacing: { after: 80 },
      }));

      // Remarks (if present)
      if (ctrl.remarks?.trim()) {
        elements.push(new Paragraph({
          children: [new TextRun({ text: 'Remarks', bold: true, size: 20, color: C.muted, font: 'Calibri' })],
          spacing: { after: 40 },
        }));
        elements.push(new Paragraph({
          children: [new TextRun({ text: ctrl.remarks, italics: true, size: 20, color: C.muted, font: 'Calibri' })],
          indent:  { left: 180 },
          spacing: { after: 120 },
        }));
      }
    }

    familyNum++;
  }

  return elements;
}

// ---------------------------------------------------------------
// Signature block
// ---------------------------------------------------------------
function buildSignatureBlock(ssp) {
  return [
    heading1('Signature Block', true),
    bodyText('By signing below, the designated officials certify that this System Security Plan accurately describes the security controls implemented for the above-referenced information system.'),
    ...emptyLine(2),
    infoTable([
      ['Information System Owner',          ''],
      ['Signature',                          ''],
      ['Date',                               ''],
      ['Information System Security Officer',''],
      ['Signature',                          ''],
      ['Date',                               ''],
      ['Authorizing Official',               ''],
      ['Signature',                          ''],
      ['Date',                               ''],
    ]),
  ];
}

// ---------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------
async function serializeDocx(fullData) {
  const { ssp, characterization, description, diagrams, implementations } = fullData;

  const logoData = fullData.logo || null;

  // Branding is ON by default. Only suppressed when a logo has been uploaded
  // AND the user explicitly unchecked the branding toggle (include_branding === 0).
  const includeBranding = logoData ? logoData.include_branding !== 0 : true;

  // Build all sections
  const allChildren = [
    ...buildCoverPage(ssp, characterization, logoData),
    ...buildSection1(ssp, characterization),
    ...buildSection2(description),
    ...buildSection3(diagrams || []),
    ...buildSection4(implementations || []),
    ...buildSignatureBlock(ssp),
  ];

  // Branding footer — always appended unless explicitly disabled
  if (includeBranding) {
    allChildren.push(
      new Paragraph({
        children: [new TextRun({ text: BRANDING_TEXT, italics: true, size: 16, color: C.muted, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing:   { before: 400, after: 120 },
        border:    { top: { style: BorderStyle.SINGLE, size: 2, color: 'e2e8f0' } },
      })
    );
  }

  const doc = new Document({
    creator:     'Anvil FORGE',
    title:       `System Security Plan — ${ssp.system_name}`,
    description: `NIST SP 800-18 aligned SSP for ${ssp.system_name}`,
    company:     ssp.org_name || 'GeneDevStudios',
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 }, // 1in top/bottom, 0.75in sides
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${ssp.system_name} — System Security Plan`, size: 18, color: C.muted, font: 'Calibri' }),
                new TextRun({ text: '\t', size: 18 }),
                new TextRun({ text: 'Page ', size: 18, color: C.muted, font: 'Calibri' }),
                new PageNumberElement(),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'e2e8f0' } },
              spacing: { after: 120 },
            }),
          ],
        }),
      },
      children: allChildren,
    }],
  });

  return await Packer.toBuffer(doc);
}

module.exports = { serializeDocx };