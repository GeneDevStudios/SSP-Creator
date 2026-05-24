import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════
// Shared design tokens (same as App.jsx)
// ═══════════════════════════════════════════════════════════════════
const S = {
  font: "'IBM Plex Sans', 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', monospace",
  bg0:'#020617', bg1:'#0f172a', bg2:'#1e293b', bg3:'#334155',
  t1:'#f1f5f9', t2:'#e2e8f0', t3:'#cbd5e1', t4:'#94a3b8', t5:'#64748b',
  blue:'#3b82f6', blueLight:'#60a5fa', green:'#059669', amber:'#f59e0b', purple:'#6366f1',
  input: { padding:'8px 12px',borderRadius:6,border:'1px solid #334155',backgroundColor:'#0f172a',color:'#e2e8f0',fontSize:13,outline:'none',width:'100%',fontFamily:"'IBM Plex Sans', sans-serif",boxSizing:'border-box' },
  textarea: { padding:'8px 12px',borderRadius:6,border:'1px solid #334155',backgroundColor:'#0f172a',color:'#e2e8f0',fontSize:13,outline:'none',width:'100%',fontFamily:"'IBM Plex Sans', sans-serif",resize:'vertical',boxSizing:'border-box',lineHeight:1.6 },
  select: { padding:'8px 12px',borderRadius:6,border:'1px solid #334155',backgroundColor:'#0f172a',color:'#e2e8f0',fontSize:13,outline:'none',fontFamily:"'IBM Plex Sans', sans-serif",cursor:'pointer',width:'100%' },
  label: { fontSize:11,color:'#64748b',fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4,display:'block' },
  btn: (bg='#3b82f6',c='#fff') => ({ padding:'8px 16px',borderRadius:8,border:'none',backgroundColor:bg,color:c,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'IBM Plex Sans', sans-serif",display:'flex',alignItems:'center',gap:6,justifyContent:'center' }),
  btnOutline: { padding:'8px 16px',borderRadius:8,border:'1px solid #334155',backgroundColor:'transparent',color:'#94a3b8',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'IBM Plex Sans', sans-serif",display:'flex',alignItems:'center',gap:6 },
};

const forge = window.forge;

// ═══════════════════════════════════════════════════════════════════
// Shared auto-save hook
// ═══════════════════════════════════════════════════════════════════
function useAutoSave(saveFn, deps, delay = 900) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const timerRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaving(true);
      try { await saveFn(); setSaved(true); setTimeout(()=>setSaved(false), 2000); }
      catch {}
      finally { setSaving(false); }
    }, delay);
  }, deps);

  return { saving, saved };
}

// ═══════════════════════════════════════════════════════════════════
// Field components
// ═══════════════════════════════════════════════════════════════════
function Field({ label, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={S.select}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SaveIndicator({ saving, saved }) {
  return (
    <span style={{ fontSize:11,fontFamily:S.mono,color:saved?'#34d399':S.t5,transition:'color 0.3s',marginLeft:'auto' }}>
      {saving ? 'Saving…' : saved ? '✓ Saved' : ''}
    </span>
  );
}

function SectionCard({ title, color = '#3b82f6', children }) {
  return (
    <div style={{ backgroundColor:S.bg1,borderRadius:10,border:`1px solid ${S.bg3}`,overflow:'hidden',marginBottom:20 }}>
      <div style={{ padding:'12px 20px',borderBottom:`1px solid ${S.bg3}`,borderLeft:`4px solid ${color}`,display:'flex',alignItems:'center',gap:8 }}>
        <span style={{ fontSize:13,fontWeight:700,color:S.t1 }}>{title}</span>
      </div>
      <div style={{ padding:20 }}>{children}</div>
    </div>
  );
}

function AdditionalInfo({ value, onChange }) {
  return (
    <div style={{ marginTop:16,paddingTop:16,borderTop:`1px solid ${S.bg3}` }}>
      <label style={{ ...S.label,color:S.t5 }}>Additional Information <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0 }}>(optional — any other relevant details)</span></label>
      <textarea value={value||''} onChange={e=>onChange(e.target.value)} style={{ ...S.textarea,minHeight:70 }} placeholder="Any other relevant information for this section…" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM CHARACTERIZATION SCREEN
// ═══════════════════════════════════════════════════════════════════
export function CharacterizationScreen({ sspId }) {
  const [data, setData] = useState({
    systemIdentifier:'', securityCategory:'',
    impactConfidentiality:'', impactIntegrity:'', impactAvailability:'',
    operationalStatus:'', systemType:'', additionalInfo:'',
  });
  const [logo, setLogo]           = useState(null);  // { filename, mimeType, data, includeBranding }
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      forge.ssp.getCharacterization({ sspId }),
      forge.ssp.getLogo({ sspId }),
    ]).then(([char, logoRow]) => {
      if (char) setData({
        systemIdentifier:      char.system_identifier      || '',
        securityCategory:      char.security_category      || '',
        impactConfidentiality: char.impact_confidentiality || '',
        impactIntegrity:       char.impact_integrity       || '',
        impactAvailability:    char.impact_availability    || '',
        operationalStatus:     char.operational_status     || '',
        systemType:            char.system_type            || '',
        additionalInfo:        char.additional_info        || '',
      });
      if (logoRow) {
        setLogo(logoRow);
        setLogoPreview(`data:${logoRow.mime_type};base64,${logoRow.data}`);
      }
      setLoading(false);
    });
  }, [sspId]);

  const set = (field) => (val) => setData(prev => ({ ...prev, [field]: val }));

  const { saving, saved } = useAutoSave(
    () => forge.ssp.saveCharacterization({ sspId, data }),
    [data.systemIdentifier, data.securityCategory, data.impactConfidentiality,
     data.impactIntegrity, data.impactAvailability, data.operationalStatus,
     data.systemType, data.additionalInfo]
  );

  const handleLogoUpload = async () => {
    setLogoUploading(true);
    const result = await forge.ssp.saveLogo({ sspId });
    if (result.success) {
      const logoRow = await forge.ssp.getLogo({ sspId });
      if (logoRow) {
        setLogo(logoRow);
        setLogoPreview(`data:${logoRow.mime_type};base64,${logoRow.data}`);
      }
    }
    setLogoUploading(false);
  };

  const handleLogoDelete = async () => {
    await forge.ssp.deleteLogo({ sspId });
    setLogo(null);
    setLogoPreview(null);
  };

  const handleBrandingToggle = async (val) => {
    setLogo(prev => ({ ...prev, include_branding: val ? 1 : 0 }));
    await forge.ssp.setBranding({ sspId, includeBranding: val });
  };

  const IMPACT = [
    { value:'', label:'— Select —' },
    { value:'Low', label:'Low' },
    { value:'Moderate', label:'Moderate' },
    { value:'High', label:'High' },
  ];

  if (loading) return <div style={{ padding:40,color:S.t5,fontSize:13 }}>Loading…</div>;

  return (
    <div style={{ padding:'28px 32px',maxWidth:860,overflowY:'auto' }}>
      <div style={{ display:'flex',alignItems:'center',marginBottom:24 }}>
        <div>
          <div style={{ fontSize:18,fontWeight:800,color:S.t1 }}>System Characterization</div>
          <div style={{ fontSize:12,color:S.t5,marginTop:2 }}>NIST SP 800-18 Section 1 — System Identification</div>
        </div>
        <SaveIndicator saving={saving} saved={saved} />
      </div>

      {/* Logo & Branding */}
      <SectionCard title="Organization Logo & Branding" color='#06b6d4'>
        <div style={{ display:'flex',gap:24,alignItems:'flex-start' }}>
          {/* Logo preview / upload area */}
          <div style={{ flexShrink:0 }}>
            {logoPreview ? (
              <div style={{ width:160,height:80,borderRadius:8,border:`1px solid ${S.bg3}`,backgroundColor:S.bg2,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}>
                <img src={logoPreview} alt="Logo" style={{ maxWidth:'100%',maxHeight:'100%',objectFit:'contain' }} />
              </div>
            ) : (
              <div style={{ width:160,height:80,borderRadius:8,border:`2px dashed ${S.bg3}`,backgroundColor:S.bg2,display:'flex',alignItems:'center',justifyContent:'center' }}>
                <span style={{ fontSize:11,color:S.t5 }}>No logo</span>
              </div>
            )}
            <div style={{ display:'flex',gap:6,marginTop:8 }}>
              <button onClick={handleLogoUpload} disabled={logoUploading}
                style={{ ...S.btn('#06b6d4'),padding:'5px 10px',fontSize:11,flex:1,opacity:logoUploading?0.6:1 }}>
                {logoUploading ? '…' : logo ? 'Replace' : 'Upload'}
              </button>
              {logo && (
                <button onClick={handleLogoDelete}
                  style={{ ...S.btnOutline,padding:'5px 8px',fontSize:11,color:'#f87171',borderColor:'#dc262633' }}>
                  ✕
                </button>
              )}
            </div>
            <div style={{ fontSize:10,color:S.t5,marginTop:4,textAlign:'center' }}>PNG or JPG</div>
          </div>

          {/* Branding settings */}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12,color:S.t4,lineHeight:1.6,marginBottom:14 }}>
              Your logo appears on the cover page and page headers of exported Word and PDF documents.
            </div>
            <label style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'10px 14px',borderRadius:8,border:`1px solid ${S.bg3}`,backgroundColor:S.bg2 }}>
              <input
                type="checkbox"
                checked={logo ? !!logo.include_branding : true}
                onChange={e => handleBrandingToggle(e.target.checked)}
                disabled={!logo}
                style={{ accentColor:S.blue,width:14,height:14 }}
              />
              <div>
                <div style={{ fontSize:12,fontWeight:600,color:logo?S.t2:S.t5 }}>Include Anvil FORGE attribution</div>
                <div style={{ fontSize:11,color:S.t5,marginTop:1,fontStyle:'italic' }}>
                  "Generated by Anvil FORGE · GeneDevStudios · genedevstudios.com"
                </div>
              </div>
            </label>
            {!logo && (
              <div style={{ fontSize:11,color:S.t5,marginTop:8 }}>Upload a logo to enable branding options.</div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* System Identification */}
      <SectionCard title="System Identification" color={S.blue}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
          <Field label="System Identifier" span={2}>
            <input value={data.systemIdentifier} onChange={e=>set('systemIdentifier')(e.target.value)} style={S.input} placeholder="Agency-assigned system identifier (e.g. GSS-001)" />
          </Field>
          <Field label="Operational Status">
            <SelectField value={data.operationalStatus} onChange={set('operationalStatus')} options={[
              { value:'', label:'— Select —' },
              { value:'Operational', label:'Operational' },
              { value:'Under Development', label:'Under Development' },
              { value:'Under Major Modification', label:'Under Major Modification' },
            ]} />
          </Field>
          <Field label="System Type">
            <SelectField value={data.systemType} onChange={set('systemType')} options={[
              { value:'', label:'— Select —' },
              { value:'General Support System', label:'General Support System' },
              { value:'Major Application', label:'Major Application' },
            ]} />
          </Field>
        </div>
      </SectionCard>

      {/* Security Categorization */}
      <SectionCard title="Security Categorization (FIPS 199)" color={S.purple}>
        <div style={{ fontSize:12,color:S.t4,marginBottom:14,lineHeight:1.5 }}>
          Categorize per FIPS 199. The overall system categorization is the high-water mark across all three impact levels.
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:14 }}>
          <Field label="Overall Categorization">
            <SelectField value={data.securityCategory} onChange={set('securityCategory')} options={IMPACT} />
          </Field>
          <Field label="Confidentiality">
            <SelectField value={data.impactConfidentiality} onChange={set('impactConfidentiality')} options={IMPACT} />
          </Field>
          <Field label="Integrity">
            <SelectField value={data.impactIntegrity} onChange={set('impactIntegrity')} options={IMPACT} />
          </Field>
          <Field label="Availability">
            <SelectField value={data.impactAvailability} onChange={set('impactAvailability')} options={IMPACT} />
          </Field>
        </div>
        {(data.impactConfidentiality || data.impactIntegrity || data.impactAvailability) && (() => {
          const levels = { Low:1, Moderate:2, High:3 };
          const vals = [data.impactConfidentiality, data.impactIntegrity, data.impactAvailability].filter(Boolean);
          const max = vals.reduce((a,b) => levels[b]>levels[a]?b:a, vals[0]);
          if (!data.securityCategory && max) return (
            <div style={{ marginTop:10,fontSize:11,color:S.amber,display:'flex',alignItems:'center',gap:6 }}>
              ⚠ Suggested overall categorization based on high-water mark: <strong>{max}</strong>
            </div>
          );
        })()}
        <AdditionalInfo value={data.additionalInfo} onChange={set('additionalInfo')} />
      </SectionCard>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SYSTEM DESCRIPTION SCREEN
// ═══════════════════════════════════════════════════════════════════
export function DescriptionScreen({ sspId }) {
  const [data, setData] = useState({
    generalDescription:'', functionPurpose:'', boundaryDescription:'',
    dataTypes:'', userTypes:[], additionalInfo:'',
  });
  const [loading, setLoading] = useState(true);

  const USER_TYPE_OPTIONS = ['Internal Staff','Contractors','General Public','Other'];

  useEffect(() => {
    forge.ssp.getDescription({ sspId }).then(d => {
      if (d) setData({
        generalDescription:  d.general_description  || '',
        functionPurpose:     d.function_purpose      || '',
        boundaryDescription: d.boundary_description  || '',
        dataTypes:           d.data_types            || '',
        userTypes:           Array.isArray(d.user_types) ? d.user_types : [],
        additionalInfo:      d.additional_info       || '',
      });
      setLoading(false);
    });
  }, [sspId]);

  const set = (field) => (val) => setData(prev => ({ ...prev, [field]: val }));

  const toggleUserType = (type) => {
    setData(prev => ({
      ...prev,
      userTypes: prev.userTypes.includes(type)
        ? prev.userTypes.filter(t=>t!==type)
        : [...prev.userTypes, type],
    }));
  };

  const { saving, saved } = useAutoSave(
    () => forge.ssp.saveDescription({ sspId, data }),
    [data.generalDescription, data.functionPurpose, data.boundaryDescription,
     data.dataTypes, JSON.stringify(data.userTypes), data.additionalInfo]
  );

  if (loading) return <div style={{ padding:40,color:S.t5,fontSize:13 }}>Loading…</div>;

  return (
    <div style={{ padding:'28px 32px',maxWidth:860,overflowY:'auto' }}>
      <div style={{ display:'flex',alignItems:'center',marginBottom:24 }}>
        <div>
          <div style={{ fontSize:18,fontWeight:800,color:S.t1 }}>System Description</div>
          <div style={{ fontSize:12,color:S.t5,marginTop:2 }}>NIST SP 800-18 Section 2 — System Description</div>
        </div>
        <SaveIndicator saving={saving} saved={saved} />
      </div>

      <SectionCard title="General Description" color={S.blue}>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <Field label="General System Description">
            <textarea value={data.generalDescription} onChange={e=>set('generalDescription')(e.target.value)} style={{ ...S.textarea,minHeight:120 }} placeholder="Provide a general description of the system — what it is, what it does, and who it serves." />
          </Field>
          <Field label="System Function and Purpose">
            <textarea value={data.functionPurpose} onChange={e=>set('functionPurpose')(e.target.value)} style={{ ...S.textarea,minHeight:100 }} placeholder="Describe the primary functions and business purpose of the system." />
          </Field>
        </div>
        <AdditionalInfo value={data.additionalInfo} onChange={set('additionalInfo')} />
      </SectionCard>

      <SectionCard title="System Boundary" color={S.purple}>
        <Field label="System Boundary Description">
          <textarea value={data.boundaryDescription} onChange={e=>set('boundaryDescription')(e.target.value)} style={{ ...S.textarea,minHeight:120 }} placeholder="Define what is inside and outside the authorization boundary. Include hardware, software, and network components within scope." />
        </Field>
      </SectionCard>

      <SectionCard title="Data and Users" color={S.amber}>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <Field label="Data Types Processed">
            <textarea value={data.dataTypes} onChange={e=>set('dataTypes')(e.target.value)} style={{ ...S.textarea,minHeight:80 }} placeholder="Describe the types of data processed, stored, or transmitted by the system (e.g. PII, financial data, health records)." />
          </Field>
          <div>
            <label style={S.label}>User Types</label>
            <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
              {USER_TYPE_OPTIONS.map(type => (
                <label key={type} style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'8px 14px',borderRadius:8,border:`1px solid ${data.userTypes.includes(type)?S.blue:S.bg3}`,backgroundColor:data.userTypes.includes(type)?S.blue+'22':'transparent',transition:'all 0.15s',fontSize:13,color:data.userTypes.includes(type)?S.blueLight:S.t4,fontFamily:S.font }}>
                  <input type="checkbox" checked={data.userTypes.includes(type)} onChange={()=>toggleUserType(type)} style={{ accentColor:S.blue }} />
                  {type}
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM DIAGRAMS SCREEN
// ═══════════════════════════════════════════════════════════════════
export function DiagramsScreen({ sspId }) {
  const [diagrams, setDiagrams]   = useState({});
  const [previews, setPreviews]   = useState({});
  const [notes, setNotes]         = useState({ architecture:'', boundary:'', dataflow:'' });
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(null);

  const DIAGRAM_TYPES = [
    { key:'architecture', label:'Architecture / Network Diagram',      color:S.blue,   description:'High-level system architecture showing major components, networks, and interconnections.' },
    { key:'boundary',     label:'Authorization Boundary Diagram',      color:S.purple, description:'Visual representation of the authorization boundary, showing what is in and out of scope.' },
    { key:'dataflow',     label:'Data Flow Diagram',                   color:S.amber,  description:'Diagram showing how data moves through the system, including external interfaces.' },
  ];

  const loadDiagrams = async () => {
    const rows = await forge.ssp.getDiagrams({ sspId });
    const map = {}; const noteMap = { architecture:'', boundary:'', dataflow:'' };
    for (const r of rows) {
      map[r.diagram_type] = r;
      noteMap[r.diagram_type] = r.additional_info || '';
    }
    setDiagrams(map);
    setNotes(noteMap);

    // Load preview data for existing diagrams
    const previewMap = {};
    for (const r of rows) {
      const d = await forge.ssp.getDiagramData({ id: r.id });
      if (d) previewMap[r.diagram_type] = `data:${d.mime_type};base64,${d.data}`;
    }
    setPreviews(previewMap);
    setLoading(false);
  };

  useEffect(() => { loadDiagrams(); }, [sspId]);

  const handleUpload = async (diagramType) => {
    setUploading(diagramType);
    const result = await forge.ssp.saveDiagram({ sspId, diagramType, additionalInfo: notes[diagramType] || null });
    if (result.success) {
      await loadDiagrams();
    }
    setUploading(null);
  };

  const handleDelete = async (id, diagramType) => {
    await forge.ssp.deleteDiagram({ id });
    setDiagrams(prev => { const n={...prev}; delete n[diagramType]; return n; });
    setPreviews(prev => { const n={...prev}; delete n[diagramType]; return n; });
  };

  const saveNote = useCallback(async (diagramType, value) => {
    if (diagrams[diagramType]) {
      await forge.ssp.saveDiagramNote({ sspId, diagramType, additionalInfo: value });
    }
  }, [sspId, diagrams]);

  if (loading) return <div style={{ padding:40,color:S.t5,fontSize:13 }}>Loading…</div>;

  return (
    <div style={{ padding:'28px 32px',maxWidth:860,overflowY:'auto' }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:18,fontWeight:800,color:S.t1 }}>System Diagrams</div>
        <div style={{ fontSize:12,color:S.t5,marginTop:2 }}>NIST SP 800-18 Section 2 — Attach architecture, boundary, and data flow diagrams (PNG or JPG)</div>
      </div>

      {DIAGRAM_TYPES.map(({ key, label, color, description }) => {
        const existing   = diagrams[key];
        const preview    = previews[key];
        const isUploading = uploading === key;

        return (
          <div key={key} style={{ backgroundColor:S.bg1,borderRadius:10,border:`1px solid ${S.bg3}`,overflow:'hidden',marginBottom:20 }}>
            <div style={{ padding:'12px 20px',borderBottom:`1px solid ${S.bg3}`,borderLeft:`4px solid ${color}`,display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:700,color:S.t1 }}>{label}</div>
                <div style={{ fontSize:11,color:S.t5,marginTop:2 }}>{description}</div>
              </div>
              {existing && (
                <span style={{ fontSize:10,padding:'2px 8px',borderRadius:4,backgroundColor:S.green+'22',color:'#34d399',fontWeight:600 }}>Uploaded</span>
              )}
            </div>
            <div style={{ padding:20 }}>
              {preview ? (
                <div style={{ marginBottom:14 }}>
                  <img src={preview} alt={label} style={{ maxWidth:'100%',maxHeight:300,borderRadius:8,border:`1px solid ${S.bg3}`,objectFit:'contain',backgroundColor:S.bg2 }} />
                  <div style={{ fontSize:11,color:S.t5,marginTop:6,fontFamily:S.mono }}>{existing?.filename}</div>
                </div>
              ) : (
                <div style={{ border:`2px dashed ${S.bg3}`,borderRadius:8,padding:30,textAlign:'center',marginBottom:14,backgroundColor:S.bg2 }}>
                  <div style={{ fontSize:13,color:S.t5,marginBottom:4 }}>No diagram uploaded</div>
                  <div style={{ fontSize:11,color:S.t5 }}>PNG or JPG, any size</div>
                </div>
              )}

              <div style={{ display:'flex',gap:8,marginBottom:14 }}>
                <button onClick={()=>handleUpload(key)} disabled={isUploading}
                  style={{ ...S.btn(color),padding:'6px 14px',fontSize:12,opacity:isUploading?0.6:1 }}>
                  {isUploading ? 'Uploading…' : existing ? 'Replace Diagram' : 'Upload Diagram'}
                </button>
                {existing && (
                  <button onClick={()=>handleDelete(existing.id, key)}
                    style={{ ...S.btnOutline,padding:'6px 12px',fontSize:12,color:'#f87171',borderColor:'#dc262633' }}>
                    Remove
                  </button>
                )}
              </div>

              <div style={{ paddingTop:14,borderTop:`1px solid ${S.bg3}` }}>
                <label style={{ ...S.label,color:S.t5 }}>Additional Information <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0 }}>(optional)</span></label>
                <textarea
                  value={notes[key]||''}
                  onChange={e => setNotes(prev=>({...prev,[key]:e.target.value}))}
                  onBlur={e => saveNote(key, e.target.value)}
                  style={{ ...S.textarea,minHeight:60 }}
                  placeholder="Notes about this diagram — version, tool used, date, any caveats…"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
