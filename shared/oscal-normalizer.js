/**
 * oscal-normalizer.js
 * -------------------
 * Shared utility. Converts OSCAL catalog JSON (NIST native or AnvilCRAFT
 * derivative) into the SSP Generator's internal normalized model.
 *
 * Internal model shape:
 * {
 *   meta: { title, version, oscalVersion, lastModified, sourceFormat },
 *   groups: [
 *     {
 *       groupId: string,
 *       title: string,
 *       controls: [
 *         {
 *           controlId: string,
 *           label: string|null,
 *           title: string,
 *           statement: string|null,
 *           guidance: string|null,
 *           objectives: [{ objectiveId, label, prose }],
 *           enhancements: [ ...same shape, recursive ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * FUTURE: when AnvilCRAFT exposes a catalog API, this normalizer runs
 * at ingest time in the admin panel. The internal model stays the same —
 * only the source changes.
 */

// ---------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------

/**
 * Normalize a raw catalog JSON object into the internal model.
 * Auto-detects format (OSCAL native vs AnvilCRAFT derivative).
 *
 * @param  {Object} raw  Parsed JSON from uploaded catalog file
 * @returns {Object}     Normalized catalog object
 * @throws  {Error}      If format is unrecognized or required fields missing
 */
function normalizeCatalog(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid catalog: expected a JSON object.');
  }

  // Detect envelope
  const root = raw.catalog || raw;

  if (!root.groups && !root.controls) {
    throw new Error(
      'Unrecognized catalog format: no "groups" or "controls" found at root.'
    );
  }

  const sourceFormat = detectSourceFormat(root);
  const meta         = extractMeta(root, sourceFormat);
  const groups       = extractGroups(root);

  return { meta, groups };
}

// ---------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------

function detectSourceFormat(root) {
  // AnvilCRAFT catalogs carry a metadata.source or props marker.
  // NIST OSCAL uses metadata.oscal-version.
  // Fall back to 'oscal' if ambiguous — normalizer handles both.
  if (root.metadata?.source === 'anvilcraft') return 'anvilcraft';
  if (root.metadata?.['oscal-version'])        return 'oscal';
  // Heuristic: AnvilCRAFT wraps controls in groups with numeric ids
  return 'oscal';
}

// ---------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------

function extractMeta(root, sourceFormat) {
  const m = root.metadata || {};
  return {
    title:        m.title        || 'Untitled Catalog',
    version:      m.version      || '1.0',
    oscalVersion: m['oscal-version'] || null,
    lastModified: m['last-modified'] || null,
    sourceFormat,
  };
}

// ---------------------------------------------------------------
// Groups + Controls extraction
// ---------------------------------------------------------------

function extractGroups(root) {
  const rawGroups = root.groups || [];

  // Some catalogs (AnvilCRAFT format) put top-level controls outside groups
  const ungrouped = root.controls || [];

  const result = rawGroups.map((g, idx) => ({
    groupId:  g.id    || `group-${idx}`,
    title:    g.title || 'Untitled Group',
    controls: (g.controls || []).map(normalizeControl),
  }));

  // Wrap any top-level orphan controls into a synthetic group
  if (ungrouped.length > 0) {
    result.push({
      groupId:  'ungrouped',
      title:    'General',
      controls: ungrouped.map(normalizeControl),
    });
  }

  return result;
}

// ---------------------------------------------------------------
// Individual control normalization
// ---------------------------------------------------------------

function normalizeControl(ctrl) {
  const label     = extractProp(ctrl, 'label');
  const statement = extractStatement(ctrl);
  const guidance  = extractGuidance(ctrl);
  const objectives = extractObjectives(ctrl);
  const enhancements = (ctrl.controls || []).map(normalizeControl); // recursive

  return {
    controlId:    ctrl.id    || '',
    label:        label      || null,
    title:        ctrl.title || 'Untitled Control',
    statement:    statement  || null,
    guidance:     guidance   || null,
    objectives,
    enhancements,
  };
}

// ---------------------------------------------------------------
// Parts parsing helpers
// ---------------------------------------------------------------

/**
 * Extract the primary statement prose from a control's parts.
 * Handles both NIST OSCAL (`part.name === 'statement'`) and
 * AnvilCRAFT format (direct `prose` field).
 */
function extractStatement(ctrl) {
  // Direct prose (AnvilCRAFT simplified format)
  if (ctrl.prose) return ctrl.prose;

  // OSCAL parts array
  const parts = ctrl.parts || [];
  const stmtPart = parts.find(p => p.name === 'statement');
  if (!stmtPart) return null;

  // Statement may have sub-parts — join them all
  return collectProse(stmtPart);
}

/**
 * Recursively collect all prose text from a part and its sub-parts.
 */
function collectProse(part) {
  const lines = [];
  if (part.prose) lines.push(part.prose.trim());
  for (const sub of (part.parts || [])) {
    const subProse = collectProse(sub);
    if (subProse) lines.push(subProse);
  }
  return lines.join('\n') || null;
}

/**
 * Extract supplemental guidance prose.
 */
function extractGuidance(ctrl) {
  const parts = ctrl.parts || [];
  const guidancePart = parts.find(p => p.name === 'guidance');
  return guidancePart ? collectProse(guidancePart) : null;
}

/**
 * Extract assessment objectives from a control's parts.
 * Returns flat array of { objectiveId, label, prose }.
 */
function extractObjectives(ctrl) {
  const parts = ctrl.parts || [];
  const objPart = parts.find(
    p => p.name === 'assessment-objective' || p.name === 'objective'
  );
  if (!objPart) return [];

  return flattenObjectives(objPart);
}

function flattenObjectives(part, acc = []) {
  // Leaf objective: has prose and no further objective sub-parts
  const subObjectives = (part.parts || []).filter(
    p => p.name === 'objective' || p.name === 'assessment-objective'
  );

  if (part.prose && subObjectives.length === 0) {
    acc.push({
      objectiveId: part.id    || '',
      label:       extractProp(part, 'label') || null,
      prose:       part.prose.trim(),
    });
  }

  for (const sub of subObjectives) {
    flattenObjectives(sub, acc);
  }

  return acc;
}

// ---------------------------------------------------------------
// Props helper
// ---------------------------------------------------------------

function extractProp(node, name) {
  const props = node.props || [];
  const prop  = props.find(p => p.name === name);
  return prop ? prop.value : null;
}

// ---------------------------------------------------------------
// Validation
// ---------------------------------------------------------------

/**
 * Validate a normalized catalog object.
 * Returns { valid: bool, errors: string[] }
 */
function validateNormalized(normalized) {
  const errors = [];

  if (!normalized.meta?.title) errors.push('Missing catalog title.');
  if (!normalized.groups || normalized.groups.length === 0) {
    errors.push('Catalog contains no groups or controls.');
  }

  let controlCount = 0;
  for (const group of (normalized.groups || [])) {
    for (const ctrl of (group.controls || [])) {
      if (!ctrl.controlId) errors.push(`Control missing id in group "${group.groupId}".`);
      if (!ctrl.title)     errors.push(`Control "${ctrl.controlId}" missing title.`);
      controlCount++;
    }
  }

  if (controlCount === 0) errors.push('Catalog contains no controls.');

  return { valid: errors.length === 0, errors };
}

module.exports = { normalizeCatalog, validateNormalized };
