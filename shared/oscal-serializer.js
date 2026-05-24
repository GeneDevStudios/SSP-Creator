/**
 * oscal-serializer.js
 * -------------------
 * Converts an SSP draft (internal model) to a valid OSCAL SSP JSON
 * that AnvilCRAFT's parseOSCALSSP can ingest.
 *
 * AnvilCRAFT reads from:
 *   system-security-plan.control-implementation.implemented-requirements[]
 *
 * Per control it expects:
 *   - implementation-status.state        (mapped from internal implStatus)
 *   - props[name=control-origination]    (mapped from internal controlOrigin)
 *   - by-components[].description        (narrative text)
 *
 * Only controls with a non-null narrative are serialized.
 * Empty controls are silently excluded.
 */

const { randomUUID: uuidv4 } = require('crypto');

// ---------------------------------------------------------------
// Status mapping: internal → OSCAL
// Reverse of AnvilCRAFT's inbound mapping.
// ---------------------------------------------------------------
const STATUS_MAP = {
  implemented:     'implemented',
  partially:       'partial',
  planned:         'planned',
  'not-applicable': 'not-applicable',
};

// ---------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------

/**
 * Serialize an SSP draft to OSCAL JSON.
 *
 * @param {Object} draft          SSP draft row from DB
 * @param {Array}  implementations Array of ssp_implementations rows,
 *                                 each with control_id resolved to
 *                                 { controlId, label } via JOIN
 * @returns {Object}              OSCAL SSP JSON object (not stringified)
 */
function serializeSSP(draft, implementations) {
  const now = new Date().toISOString();

  // Filter to only addressed controls
  const addressed = implementations.filter(
    impl => impl.narrative && impl.narrative.trim().length > 0
  );

  return {
    'system-security-plan': {
      uuid: draft.oscal_uuid || uuidv4(),
      metadata: {
        title:           draft.system_name,
        version:         draft.system_version || '1.0',
        'oscal-version': draft.oscal_version  || '1.1.2',
        'last-modified': now,
        parties: draft.org_name
          ? [{
              uuid:  uuidv4(),
              type:  'organization',
              name:  draft.org_name,
            }]
          : [],
      },
      'import-profile': {
        href: draft.profile_href || '#',
      },
      'system-characteristics': {
        'system-name': draft.system_name,
        description:   `System Security Plan for ${draft.system_name}`,
        'system-ids':  [],
        'system-information': { 'information-types': [] },
        'security-impact-level': {
          'security-objective-confidentiality': 'fips-199-moderate',
          'security-objective-integrity':       'fips-199-moderate',
          'security-objective-availability':    'fips-199-moderate',
        },
        status: { state: 'operational' },
        'authorization-boundary': { description: '' },
      },
      'system-implementation': {
        users:      [],
        components: [
          {
            uuid:   draft.component_uuid || uuidv4(),
            type:   'this-system',
            title:  draft.system_name,
            status: { state: 'operational' },
          },
        ],
      },
      'control-implementation': {
        description: `Control implementations for ${draft.system_name}`,
        'implemented-requirements': addressed.map(impl =>
          serializeImplementation(impl, draft.component_uuid)
        ),
      },
    },
  };
}

// ---------------------------------------------------------------
// Per-control serialization
// ---------------------------------------------------------------

function serializeImplementation(impl, componentUuid) {
  const req = {
    uuid:        uuidv4(),
    'control-id': impl.control_id_str,  // e.g. "ac-1"
  };

  // Implementation status
  if (impl.impl_status) {
    req['implementation-status'] = {
      state: STATUS_MAP[impl.impl_status] || impl.impl_status,
    };
  }

  // Control origination prop (what AnvilCRAFT's parser checks first)
  if (impl.control_origin) {
    req.props = [{
      name:  'control-origination',
      value: impl.control_origin,
    }];
  }

  // Narrative via by-components
  if (impl.narrative) {
    req['by-components'] = [{
      'component-uuid': componentUuid || uuidv4(),
      description:      impl.narrative.trim(),
    }];
  }

  // Remarks if present
  if (impl.remarks && impl.remarks.trim()) {
    req.remarks = impl.remarks.trim();
  }

  return req;
}

// ---------------------------------------------------------------
// Export stats helper (for pre-flight summary)
// ---------------------------------------------------------------

/**
 * Returns a summary of what would be exported.
 * Useful for pre-flight validation UI.
 */
function getExportStats(implementations) {
  const addressed = implementations.filter(
    i => i.narrative && i.narrative.trim().length > 0
  );
  const byStatus = {};
  for (const impl of addressed) {
    const s = impl.impl_status || 'unset';
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  const warnings = [];
  const noStatus = addressed.filter(i => !i.impl_status);
  if (noStatus.length > 0) {
    warnings.push(
      `${noStatus.length} control(s) have narrative but no implementation status set.`
    );
  }
  const noOrigin = addressed.filter(i => !i.control_origin);
  if (noOrigin.length > 0) {
    warnings.push(
      `${noOrigin.length} control(s) have no origin set — AnvilCRAFT will infer origin from by-components count.`
    );
  }

  return {
    total:        implementations.length,
    addressed:    addressed.length,
    skipped:      implementations.length - addressed.length,
    byStatus,
    warnings,
  };
}


// ---------------------------------------------------------------
// Branding
// ---------------------------------------------------------------
const BRANDING_TEXT = 'Generated by Anvil FORGE · GeneDevStudios · genedevstudios.com';

module.exports = { serializeSSP, getExportStats, BRANDING_TEXT };
