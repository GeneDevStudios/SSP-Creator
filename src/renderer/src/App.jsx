import { CharacterizationScreen, DescriptionScreen, DiagramsScreen } from "./SystemScreens.jsx";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — matches AnvilCRAFT exactly
// ═══════════════════════════════════════════════════════════════════
const S = {
  font: "'IBM Plex Sans', 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', monospace",
  bg0:'#020617', bg1:'#0f172a', bg2:'#1e293b', bg3:'#334155',
  t1:'#f1f5f9', t2:'#e2e8f0', t3:'#cbd5e1', t4:'#94a3b8', t5:'#64748b',
  blue:'#3b82f6', blueLight:'#60a5fa', green:'#059669', red:'#dc2626',
  purple:'#6366f1', amber:'#f59e0b', cyan:'#06b6d4',
  input: { padding:'8px 12px',borderRadius:6,border:'1px solid #334155',backgroundColor:'#0f172a',color:'#e2e8f0',fontSize:13,outline:'none',width:'100%',fontFamily:"'IBM Plex Sans', sans-serif",boxSizing:'border-box' },
  textarea: { padding:'8px 12px',borderRadius:6,border:'1px solid #334155',backgroundColor:'#0f172a',color:'#e2e8f0',fontSize:13,outline:'none',width:'100%',fontFamily:"'IBM Plex Sans', sans-serif",resize:'vertical',boxSizing:'border-box',lineHeight:1.6 },
  btn: (bg='#3b82f6',c='#fff') => ({ padding:'8px 16px',borderRadius:8,border:'none',backgroundColor:bg,color:c,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'IBM Plex Sans', sans-serif",display:'flex',alignItems:'center',gap:6,justifyContent:'center' }),
  btnOutline: { padding:'8px 16px',borderRadius:8,border:'1px solid #334155',backgroundColor:'transparent',color:'#94a3b8',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'IBM Plex Sans', sans-serif",display:'flex',alignItems:'center',gap:6,justifyContent:'center' },
  select: { padding:'8px 12px',borderRadius:6,border:'1px solid #334155',backgroundColor:'#0f172a',color:'#e2e8f0',fontSize:13,outline:'none',fontFamily:"'IBM Plex Sans', sans-serif",cursor:'pointer',width:'100%' },
  label: { fontSize:11,color:'#64748b',fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4,display:'block' },
  card: { backgroundColor:'#0f172a',borderRadius:10,border:'1px solid #334155' },
};

// IPC bridge — window.forge is injected by preload.js
const forge = window.forge;

// ═══════════════════════════════════════════════════════════════════
// STATUS / ORIGIN
// ═══════════════════════════════════════════════════════════════════
const STATUS_OPTIONS = [
  { value:'',              label:'— Select Status —',    color:'#64748b' },
  { value:'implemented',   label:'Implemented',           color:'#34d399' },
  { value:'partially',     label:'Partially Implemented', color:'#f59e0b' },
  { value:'planned',       label:'Planned',               color:'#60a5fa' },
  { value:'not-applicable',label:'Not Applicable',        color:'#64748b' },
];
const ORIGIN_OPTIONS = [
  { value:'',          label:'— Select Origin —' },
  { value:'system',    label:'System' },
  { value:'hybrid',    label:'Hybrid' },
  { value:'inherited', label:'Inherited' },
  { value:'customer',  label:'Customer' },
];
const statusColor = v => STATUS_OPTIONS.find(s=>s.value===v)?.color||'#64748b';
const statusLabel = v => STATUS_OPTIONS.find(s=>s.value===v)?.label||'—';

// ═══════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════
const ShieldIcon   = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1L2 4v4c0 3.3 2.7 5.7 6 6.7C11.3 13.7 14 11.3 14 8V4L8 1z"/></svg>;
const PlusIcon     = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v12M2 8h12"/></svg>;
const DownloadIcon = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 10V3M5 7l3 3 3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"/></svg>;
const TrashIcon    = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/></svg>;
const GearIcon     = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.54 11.54l1.41 1.41M3.05 12.95l1.42-1.42M11.54 4.46l1.41-1.41"/></svg>;
const UploadIcon   = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 10V3M5 6l3-3 3 3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"/></svg>;
const ChevronIcon  = ({open}) => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{transform:open?'rotate(90deg)':'rotate(0deg)',transition:'transform 0.15s'}}><path d="M6 4l4 4-4 4"/></svg>;
const InfoIcon     = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="7"/><path d="M8 7v4M8 5v.5"/></svg>;
const FileIcon     = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z"/><path d="M9 1v4h4"/></svg>;
const BackupIcon   = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H5a3 3 0 000 6h1"/><path d="M9 12l2 2 2-2"/><path d="M11 10v4"/></svg>;
const RestoreIcon  = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8a6 6 0 106-6H5"/><path d="M2 4v4h4"/></svg>;
const CopyIcon     = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="9" height="9" rx="1"/><path d="M3 11V3a1 1 0 011-1h8"/></svg>;

// ═══════════════════════════════════════════════════════════════════
// UPDATE BANNER
// ═══════════════════════════════════════════════════════════════════
function UpdateBanner() {
  const [state, setState] = useState(null); // null | 'available' | 'downloading' | 'ready'
  const [progress, setProgress] = useState(0);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!forge?.updater) return;
    const cleanups = [
      forge.updater.on('updater:available',   (i) => { setState('available'); setInfo(i); }),
      forge.updater.on('updater:progress',    (p) => { setState('downloading'); setProgress(Math.round(p.percent||0)); }),
      forge.updater.on('updater:downloaded',  (i) => { setState('ready'); setInfo(i); }),
    ];
    return () => cleanups.forEach(fn => fn?.());
  }, []);

  if (!state) return null;

  const configs = {
    available:   { bg: S.blue,  text: `Version ${info?.version} is available — downloading…` },
    downloading: { bg: S.blue,  text: `Downloading update… ${progress}%` },
    ready:       { bg: S.green, text: `Version ${info?.version} downloaded. Restart to update.` },
  };
  const cfg = configs[state];

  return (
    <div style={{ backgroundColor:cfg.bg, padding:'8px 20px', display:'flex', alignItems:'center', gap:12, fontSize:12, fontWeight:600, color:'#fff' }}>
      <InfoIcon />
      <span style={{ flex:1 }}>{cfg.text}</span>
      {state === 'ready' && (
        <button onClick={() => forge.updater.installNow()} style={{ ...S.btn('#fff', cfg.bg), padding:'4px 12px', fontSize:11 }}>
          Restart Now
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CHANGELOG MODAL
// ═══════════════════════════════════════════════════════════════════
function ChangelogModal({ onClose }) {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    forge.app.fetchChangelog()
      .then(result => {
        if (result?.success) {
          setReleases(result.releases);
        } else {
          setError(result?.error || 'Could not load release notes.');
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Simple markdown → JSX: bold, bullets, headers
  const renderBody = (body) => {
    if (!body) return <span style={{ color:S.t5, fontSize:12, fontStyle:'italic' }}>No release notes provided.</span>;
    return body.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <div key={i} style={{ fontSize:12, fontWeight:700, color:S.blueLight, marginTop:10, marginBottom:4 }}>{line.slice(3)}</div>;
      if (line.startsWith('### ')) return <div key={i} style={{ fontSize:11, fontWeight:700, color:S.t3, marginTop:8, marginBottom:2 }}>{line.slice(4)}</div>;
      if (line.startsWith('* ') || line.startsWith('- ')) return (
        <div key={i} style={{ display:'flex', gap:8, fontSize:12, color:S.t3, lineHeight:1.6, paddingLeft:4 }}>
          <span style={{ color:S.blueLight, flexShrink:0 }}>·</span>
          <span>{line.slice(2)}</span>
        </div>
      );
      if (line.trim() === '') return <div key={i} style={{ height:4 }} />;
      return <div key={i} style={{ fontSize:12, color:S.t4, lineHeight:1.6 }}>{line}</div>;
    });
  };

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }} onClick={onClose}>
      <div style={{ width:580, maxHeight:'80vh', display:'flex', flexDirection:'column', backgroundColor:S.bg1, borderRadius:14, border:`1px solid ${S.bg3}`, overflow:'hidden' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'20px 24px 16px', borderBottom:`1px solid ${S.bg3}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:S.t1 }}>What's New</div>
            <div style={{ fontSize:11, color:S.t5, marginTop:2 }}>Anvil FORGE — Release History</div>
          </div>
          <button onClick={onClose} style={{ ...S.btnOutline, padding:'4px 10px', fontSize:12 }}>Close</button>
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', flex:1, padding:'8px 0' }}>
          {loading && (
            <div style={{ padding:40, textAlign:'center', color:S.t5, fontSize:13 }}>Loading releases…</div>
          )}
          {error && (
            <div style={{ padding:24, margin:16, borderRadius:8, backgroundColor:'#dc262222', border:'1px solid #dc262244', color:'#f87171', fontSize:12 }}>
              Could not load release notes. Check your internet connection.<br/>
              <span style={{ color:S.t5, fontSize:11 }}>{error}</span>
            </div>
          )}
          {!loading && !error && releases.length === 0 && (
            <div style={{ padding:40, textAlign:'center', color:S.t5, fontSize:13 }}>No releases found.</div>
          )}
          {!loading && !error && releases.map((release, idx) => (
            <div key={release.id} style={{ padding:'16px 24px', borderBottom: idx < releases.length-1 ? `1px solid ${S.bg2}` : 'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <span style={{ fontSize:14, fontWeight:800, color:S.t1, fontFamily:S.mono }}>{release.tag_name}</span>
                {release.prerelease && (
                  <span style={{ fontSize:9, padding:'2px 6px', borderRadius:4, backgroundColor:S.amber+'22', color:S.amber, fontWeight:700, textTransform:'uppercase' }}>Pre-release</span>
                )}
                {idx === 0 && !release.prerelease && (
                  <span style={{ fontSize:9, padding:'2px 6px', borderRadius:4, backgroundColor:S.green+'22', color:'#34d399', fontWeight:700, textTransform:'uppercase' }}>Latest</span>
                )}
                <span style={{ fontSize:11, color:S.t5, marginLeft:'auto' }}>{formatDate(release.published_at)}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                {renderBody(release.body)}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 24px', borderTop:`1px solid ${S.bg3}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:11, color:S.t5 }}>{releases.length} release{releases.length !== 1 ? 's' : ''} total</span>
          <a href="https://github.com/GeneDevStudios/SSP-Creator/releases" target="_blank" rel="noreferrer"
            style={{ fontSize:11, color:S.blueLight, textDecoration:'none', fontWeight:600 }}>
            View on GitHub ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════
function Topbar({ view, onNavigate, appVersion, onShowChangelog }) {
  return (
    <div style={{ background:`linear-gradient(135deg,${S.bg1},${S.bg2})`, borderBottom:`1px solid ${S.bg3}`, padding:'10px 24px', display:'flex', alignItems:'center', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color:S.blueLight }}><ShieldIcon /></span>
        <span title="Formalized OSCAL Risk Governance Editor" style={{ fontSize:16, fontWeight:800, color:S.t1 }}>Anvil <span style={{ color:S.blueLight }}>FORGE</span></span>
        <span style={{ fontSize:10, color:S.t5, fontFamily:S.mono }}>GeneDevStudios</span>
        {appVersion && (
          <button onClick={onShowChangelog} title="What's New"
            style={{ fontSize:9, color:S.t5, fontFamily:S.mono, padding:'1px 5px', borderRadius:3, border:`1px solid ${S.bg3}`, background:'transparent', cursor:'pointer', transition:'border-color 0.15s, color 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=S.blueLight;e.currentTarget.style.color=S.blueLight;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=S.bg3;e.currentTarget.style.color=S.t5;}}>
            v{appVersion}
          </button>
        )}
      </div>
      <div style={{ flex:1 }} />
      <div style={{ display:'flex', gap:4 }}>
        {[{id:'dashboard',label:'SSP Drafts'},{id:'catalogs',label:'Catalogs'}].map(tab => (
          <button key={tab.id} onClick={() => onNavigate(tab.id)}
            style={{ padding:'5px 14px', borderRadius:6, border:'none', backgroundColor:view===tab.id?S.blue:'transparent', color:view===tab.id?'#fff':S.t4, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:S.font }}>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function Dashboard({ onOpen }) {
  const [ssps, setSsps]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [backupMsg, setBackupMsg]       = useState(null); // { type:'success'|'error', text }
  const [restoreResult, setRestoreResult] = useState(null); // { newSspId, systemName, warnings[] }
  const [restoring, setRestoring] = useState(false);
  const [duplicating, setDuplicating] = useState(null); // sspId currently being duplicated

  const load = () => forge.ssp.list().then(setSsps).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    await forge.ssp.delete({ id: deleteId });
    setDeleteId(null); load();
  };

  const handleBackup = async (sspId) => {
    const result = await forge.ssp.exportBackup({ sspId });
    if (result?.canceled) return;
    if (result?.success) {
      setBackupMsg({ type:'success', text:'Backup saved successfully.' });
    } else {
      setBackupMsg({ type:'error', text: result?.error || 'Backup failed.' });
    }
    setTimeout(() => setBackupMsg(null), 3500);
  };

  const handleRestore = async () => {
    setRestoring(true);
    const result = await forge.ssp.importBackup();
    setRestoring(false);
    if (result?.canceled) return;
    if (result?.success) {
      await load();
      setRestoreResult({ newSspId: result.newSspId, systemName: result.systemName, warnings: result.warnings || [] });
    } else {
      setBackupMsg({ type:'error', text: result?.error || 'Restore failed.' });
      setTimeout(() => setBackupMsg(null), 4000);
    }
  };

  const handleDuplicate = async (sspId) => {
    setDuplicating(sspId);
    const result = await forge.ssp.duplicate({ sspId });
    setDuplicating(null);
    if (result?.success) {
      await load();
      setBackupMsg({ type:'success', text:`"${result.systemName}" created.` });
    } else {
      setBackupMsg({ type:'error', text: result?.error || 'Duplicate failed.' });
    }
    setTimeout(() => setBackupMsg(null), 3500);
  };

  const statusBadge = (s) => {
    const cfg = { draft:{bg:S.blue+'22',c:S.blueLight}, exported:{bg:S.green+'22',c:'#34d399'}, archived:{bg:S.bg3,c:S.t5} };
    const {bg,c} = cfg[s]||cfg.draft;
    return <span style={{ fontSize:10,padding:'2px 7px',borderRadius:4,backgroundColor:bg,color:c,fontWeight:600,textTransform:'uppercase',fontFamily:S.mono }}>{s}</span>;
  };

  return (
    <div style={{ flex:1, overflow:'auto', padding:'32px 24px', maxWidth:860, margin:'0 auto', width:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:S.t1 }}>SSP Drafts</div>
          <div style={{ fontSize:13, color:S.t5, marginTop:2 }}>Build and export OSCAL System Security Plans</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleRestore} disabled={restoring} style={{ ...S.btnOutline, padding:'10px 16px', opacity:restoring?0.6:1 }}>
            <RestoreIcon /> {restoring ? 'Restoring…' : 'Import Backup'}
          </button>
          <button onClick={() => setShowNew(true)} style={{ ...S.btn(), padding:'10px 20px' }}><PlusIcon /> New SSP</button>
        </div>
      </div>

      {backupMsg && (
        <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:8, fontSize:12, fontWeight:600,
          backgroundColor: backupMsg.type==='success' ? S.green+'22' : '#dc262622',
          color: backupMsg.type==='success' ? '#34d399' : '#f87171',
          border:`1px solid ${backupMsg.type==='success' ? S.green+'44' : '#dc262644'}` }}>
          {backupMsg.text}
        </div>
      )}

      {loading && <div style={{ color:S.t5, fontSize:13, textAlign:'center', padding:40 }}>Loading…</div>}

      {!loading && ssps.length === 0 && (
        <div style={{ textAlign:'center', padding:60, backgroundColor:S.bg1, borderRadius:12, border:`1px dashed ${S.bg3}` }}>
          <div style={{ color:S.t5, fontSize:14, marginBottom:16 }}>No SSP drafts yet.</div>
          <button onClick={() => setShowNew(true)} style={{ ...S.btn(), margin:'0 auto' }}><PlusIcon /> Create Your First SSP</button>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {ssps.map(ssp => (
          <div key={ssp.id} style={{ ...S.card, padding:'16px 20px', display:'flex', alignItems:'center', gap:16, transition:'border-color 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=S.blue}
            onMouseLeave={e=>e.currentTarget.style.borderColor=S.bg3}>
            <div onClick={() => onOpen(ssp.id)} style={{ display:'flex', alignItems:'center', gap:16, flex:1, cursor:'pointer', minWidth:0 }}>
              <div style={{ width:36,height:36,borderRadius:8,backgroundColor:S.blue+'22',color:S.blueLight,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><FileIcon /></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:S.t1, marginBottom:2 }}>{ssp.system_name}</div>
                <div style={{ fontSize:11, color:S.t5 }}>{ssp.catalog_name} {ssp.org_name?`• ${ssp.org_name}`:''}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ marginBottom:4 }}>{statusBadge(ssp.status)}</div>
                <div style={{ fontSize:10, color:S.t5, fontFamily:S.mono }}>{ssp.addressed_controls||0} controls addressed</div>
              </div>
              <div style={{ fontSize:10, color:S.t5, flexShrink:0, minWidth:80, textAlign:'right' }}>
                {new Date(ssp.updated_at).toLocaleDateString()}
              </div>
            </div>
            <button onClick={() => handleBackup(ssp.id)} style={{ ...S.btnOutline, padding:'5px 8px', borderColor:'transparent', color:S.t5, flexShrink:0 }} title="Export Backup">
              <BackupIcon />
            </button>
            <button onClick={() => handleDuplicate(ssp.id)} disabled={duplicating===ssp.id} style={{ ...S.btnOutline, padding:'5px 8px', borderColor:'transparent', color:duplicating===ssp.id?S.t5:S.t5, flexShrink:0, opacity:duplicating===ssp.id?0.5:1 }} title="Duplicate">
              <CopyIcon />
            </button>
            <button onClick={() => setDeleteId(ssp.id)} style={{ ...S.btnOutline, padding:'5px 8px', borderColor:'transparent', color:S.t5, flexShrink:0 }} title="Delete">
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      {showNew && <NewSspModal onClose={() => setShowNew(false)} onCreate={(id) => { setShowNew(false); onOpen(id); }} />}

      {restoreResult && (
        <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }} onClick={() => setRestoreResult(null)}>
          <div style={{ width:420,padding:28,backgroundColor:S.bg1,borderRadius:14,border:`1px solid ${S.bg3}` }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:16,fontWeight:700,color:S.t1,marginBottom:8 }}>SSP Restored</div>
            <div style={{ fontSize:13,color:S.t4,marginBottom:restoreResult.warnings.length?12:20 }}>
              <span style={{ color:S.t2,fontWeight:600 }}>{restoreResult.systemName}</span> has been restored as a new draft.
            </div>
            {restoreResult.warnings.length > 0 && (
              <div style={{ marginBottom:20, padding:'10px 14px', borderRadius:8, backgroundColor:S.amber+'18', border:`1px solid ${S.amber}44` }}>
                <div style={{ fontSize:11,fontWeight:700,color:S.amber,marginBottom:6 }}>⚠ Warnings</div>
                {restoreResult.warnings.map((w,i) => (
                  <div key={i} style={{ fontSize:11,color:S.t4,lineHeight:1.5 }}>{w}</div>
                ))}
              </div>
            )}
            <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
              <button onClick={() => setRestoreResult(null)} style={S.btnOutline}>Dismiss</button>
              <button onClick={() => { setRestoreResult(null); onOpen(restoreResult.newSspId); }} style={S.btn()}>Open SSP</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }} onClick={() => setDeleteId(null)}>
          <div style={{ width:380,padding:28,backgroundColor:S.bg1,borderRadius:14,border:`1px solid ${S.bg3}` }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:16,fontWeight:700,color:S.t1,marginBottom:8 }}>Delete SSP Draft?</div>
            <div style={{ fontSize:13,color:S.t4,marginBottom:20 }}>This permanently deletes the draft and all control data. This cannot be undone.</div>
            <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={S.btnOutline}>Cancel</button>
              <button onClick={handleDelete} style={S.btn('#dc2626')}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NEW SSP MODAL
// ═══════════════════════════════════════════════════════════════════
function NewSspModal({ onClose, onCreate }) {
  const [catalogs, setCatalogs]   = useState([]);
  const [catalogId, setCatalogId] = useState('');
  const [systemName, setSystemName]         = useState('');
  const [systemVersion, setSystemVersion]   = useState('');
  const [orgName, setOrgName]               = useState('');
  const [profileHref, setProfileHref]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    forge.catalog.list().then(list => {
      const active = list.filter(c => c.is_active);
      setCatalogs(active);
      if (active.length === 1) setCatalogId(active[0].id);
    });
  }, []);

  const handleCreate = async () => {
    if (!catalogId)         return setError('Select a catalog.');
    if (!systemName.trim()) return setError('System name is required.');
    setLoading(true); setError('');
    try {
      const ssp = await forge.ssp.create({ catalogId, systemName:systemName.trim(), systemVersion:systemVersion.trim()||undefined, orgName:orgName.trim()||undefined, profileHref:profileHref.trim()||undefined });
      onCreate(ssp.id);
    } catch(e) { setError(e.message); setLoading(false); }
  };

  return (
    <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }} onClick={onClose}>
      <div style={{ width:480,padding:32,backgroundColor:S.bg1,borderRadius:14,border:`1px solid ${S.bg3}` }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:18,fontWeight:700,color:S.t1,marginBottom:4 }}>New SSP Draft</div>
        <div style={{ fontSize:12,color:S.t4,marginBottom:24 }}>Create a new System Security Plan. Fill in control details after creation.</div>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <div>
            <label style={S.label}>Framework Catalog</label>
            <select value={catalogId} onChange={e=>setCatalogId(e.target.value)} style={S.select}>
              <option value="">— Select Catalog —</option>
              {catalogs.map(c=><option key={c.id} value={c.id}>{c.name} ({c.version})</option>)}
            </select>
            {catalogs.length===0&&<div style={{ fontSize:11,color:S.amber,marginTop:4 }}>No active catalogs. Import one in the Catalogs tab first.</div>}
          </div>
          <div>
            <label style={S.label}>System Name *</label>
            <input value={systemName} onChange={e=>setSystemName(e.target.value)} style={S.input} placeholder="e.g. My Cloud Platform" maxLength={128} onKeyDown={e=>e.key==='Enter'&&handleCreate()} />
          </div>
          <div style={{ display:'flex',gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={S.label}>Version</label>
              <input value={systemVersion} onChange={e=>setSystemVersion(e.target.value)} style={S.input} placeholder="1.0" maxLength={32} />
            </div>
            <div style={{ flex:2 }}>
              <label style={S.label}>Organization</label>
              <input value={orgName} onChange={e=>setOrgName(e.target.value)} style={S.input} placeholder="Organization name" maxLength={128} />
            </div>
          </div>
          <div>
            <label style={S.label}>Profile Reference URL <span style={{ color:S.t5,fontWeight:400,textTransform:'none',letterSpacing:0 }}>(optional)</span></label>
            <input value={profileHref} onChange={e=>setProfileHref(e.target.value)} style={S.input} placeholder="https://csrc.nist.gov/…" maxLength={512} />
          </div>
        </div>
        {error&&<div style={{ marginTop:12,padding:'8px 12px',borderRadius:6,backgroundColor:'#dc262622',color:'#f87171',fontSize:12 }}>{error}</div>}
        <div style={{ display:'flex',gap:8,marginTop:24,justifyContent:'flex-end' }}>
          <button onClick={onClose} style={S.btnOutline}>Cancel</button>
          <button onClick={handleCreate} disabled={loading} style={{ ...S.btn(),opacity:loading?0.6:1 }}>{loading?'Creating…':'Create SSP'}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CATALOGS VIEW
// ═══════════════════════════════════════════════════════════════════
function CatalogsView() {
  const [catalogs, setCatalogs]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [importing, setImporting] = useState(false);
  const [nameOverride, setNameOverride]       = useState('');
  const [versionOverride, setVersionOverride] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success'|'error', text }
  const [showFormatRef, setShowFormatRef] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => forge.catalog.list().then(setCatalogs).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleImport = async () => {
    const { canceled, filePath } = await forge.catalog.importFile();
    if (canceled) return;
    setImporting(true); setStatus(null);
    const result = await forge.catalog.ingest({ filePath, nameOverride:nameOverride.trim()||undefined, versionOverride:versionOverride.trim()||undefined });
    setImporting(false);
    if (result.success) {
      setStatus({ type:'success', text:`"${result.name}" imported — ${result.groupCount} groups.` });
      setNameOverride(''); setVersionOverride('');
      load();
    } else {
      setStatus({ type:'error', text: result.error });
    }
  };

  const toggleActive = async (id, isActive) => {
    await forge.catalog.setActive({ id, isActive: !isActive });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this catalog? All SSP drafts using it will be affected.')) return;
    await forge.catalog.delete({ id }); load();
  };

  return (
    <div style={{ flex:1, overflow:'auto', padding:'32px 24px', maxWidth:800, margin:'0 auto', width:'100%' }}>
      <div style={{ fontSize:22, fontWeight:800, color:S.t1, marginBottom:4 }}>Catalogs</div>
      <div style={{ fontSize:13, color:S.t5, marginBottom:28 }}>Import OSCAL-formatted framework catalogs. Supports NIST 800-53, CIS, and any AnvilCRAFT-compatible catalog.</div>

      {/* Import card */}
      <div style={{ ...S.card, padding:24, marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:S.t1, marginBottom:4 }}>Import Catalog</div>
        <div style={{ fontSize:12, color:S.t4, marginBottom:16 }}>Select a catalog JSON file. Accepts NIST OSCAL or AnvilCRAFT format — the normalizer handles both.</div>
        <div style={{ display:'flex', gap:12, marginBottom:14 }}>
          <div style={{ flex:2 }}>
            <label style={S.label}>Name Override <span style={{ color:S.t5,fontWeight:400,textTransform:'none',letterSpacing:0 }}>(optional)</span></label>
            <input value={nameOverride} onChange={e=>setNameOverride(e.target.value)} style={S.input} placeholder="e.g. NIST SP 800-53 Rev 5" maxLength={128} />
          </div>
          <div style={{ flex:1 }}>
            <label style={S.label}>Version Override</label>
            <input value={versionOverride} onChange={e=>setVersionOverride(e.target.value)} style={S.input} placeholder="5.1.1" maxLength={32} />
          </div>
        </div>
        <button onClick={handleImport} disabled={importing} style={{ ...S.btn(), opacity:importing?0.6:1 }}>
          <UploadIcon /> {importing ? 'Importing…' : 'Choose Catalog JSON…'}
        </button>
        {status && (
          <div style={{ marginTop:10, padding:'8px 12px', borderRadius:6, backgroundColor:status.type==='success'?S.green+'22':'#dc262622', color:status.type==='success'?'#34d399':'#f87171', fontSize:12 }}>
            {status.text}
          </div>
        )}
      </div>

      {/* Catalog list */}
      <div style={{ ...S.card, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:`1px solid ${S.bg3}`, fontSize:13, fontWeight:600, color:S.t2 }}>Installed Catalogs</div>
        {loading && <div style={{ padding:20, color:S.t5, fontSize:12, textAlign:'center' }}>Loading…</div>}
        {!loading && catalogs.length === 0 && <div style={{ padding:20, color:S.t5, fontSize:12, textAlign:'center' }}>No catalogs imported yet.</div>}
        {catalogs.map((cat, i) => (
          <div key={cat.id} style={{ padding:'12px 20px', borderTop:i>0?`1px solid ${S.bg3}`:undefined, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:S.t1 }}>{cat.name}</div>
              <div style={{ fontSize:10, color:S.t5, fontFamily:S.mono, marginTop:1 }}>v{cat.version} · {cat.source_format} · {cat.group_count} groups · {cat.control_count} controls · added {new Date(cat.created_at).toLocaleDateString()}</div>
            </div>
            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, backgroundColor:cat.is_active?S.green+'22':'#dc262622', color:cat.is_active?'#34d399':'#f87171', fontWeight:600, textTransform:'uppercase' }}>{cat.is_active?'Active':'Inactive'}</span>
            <button onClick={() => toggleActive(cat.id, cat.is_active)} style={{ ...S.btnOutline, padding:'4px 10px', fontSize:11 }}>{cat.is_active?'Deactivate':'Activate'}</button>
            <button onClick={() => handleDelete(cat.id)} style={{ ...S.btnOutline, padding:'4px 8px', color:S.t5, borderColor:'transparent' }} title="Delete"><TrashIcon /></button>
          </div>
        ))}
      </div>

      <div style={{ marginTop:16, padding:'12px 16px', borderRadius:8, backgroundColor:S.blue+'11', border:`1px solid ${S.blue}22` }}>
        <div style={{ fontSize:11, color:S.blueLight, fontWeight:600, marginBottom:4, display:'flex', alignItems:'center', gap:4 }}><InfoIcon /> Tip</div>
        <div style={{ fontSize:11, color:S.t4, lineHeight:1.5 }}>Download the official NIST 800-53 Rev 5 OSCAL catalog from: <span style={{ fontFamily:S.mono, color:S.blueLight }}>github.com/usnistgov/oscal-content</span> — file: <span style={{ fontFamily:S.mono }}>nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json</span></div>
      </div>

      {/* Format Reference Panel */}
      <div style={{ marginTop:12, borderRadius:8, border:`1px solid ${S.bg3}`, overflow:'hidden' }}>
        <button
          onClick={() => setShowFormatRef(o => !o)}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 16px', background:'transparent', border:'none', cursor:'pointer', color:S.t4, fontSize:12, fontWeight:600, fontFamily:S.font, textAlign:'left' }}>
          <ChevronIcon open={showFormatRef} />
          <span style={{ color:S.t3 }}>Catalog JSON Format Reference</span>
          <span style={{ marginLeft:'auto', fontSize:10, color:S.t5, fontWeight:400 }}>NIST OSCAL · AnvilCRAFT</span>
        </button>

        {showFormatRef && (() => {
          const SCHEMA = `{
  "catalog": {
    "uuid": "your-uuid-here",
    "metadata": {
      "title": "Framework Name",
      "version": "2024",
      "oscal-version": "1.1.2",
      "last-modified": "2024-01-01T00:00:00Z"
    },
    "groups": [
      {
        "id": "group-id",
        "title": "Group Title",
        "controls": [
          {
            "id": "ctrl-1",
            "title": "Control Title",
            "props": [
              { "name": "label", "value": "1.1" }
            ],
            "parts": [
              {
                "id": "ctrl-1_smt",
                "name": "statement",
                "prose": "Control requirement text."
              },
              {
                "id": "ctrl-1_obj",
                "name": "assessment-objective",
                "parts": [
                  {
                    "id": "ctrl-1_obj.a",
                    "name": "objective",
                    "props": [{ "name": "label", "value": "1.1(a)" }],
                    "prose": "Objective text."
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}`;
          const handleCopy = () => {
            navigator.clipboard.writeText(SCHEMA).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          };
          return (
            <div style={{ borderTop:`1px solid ${S.bg3}`, backgroundColor:S.bg0 }}>
              <div style={{ padding:'12px 16px 8px', display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ fontSize:11, color:S.t4, lineHeight:1.6 }}>
                  Both <span style={{ color:S.blueLight, fontWeight:600 }}>NIST OSCAL</span> and <span style={{ color:S.blueLight, fontWeight:600 }}>AnvilCRAFT</span> catalog formats are accepted — the normalizer detects and handles both automatically.
                  The structure below shows the canonical OSCAL schema. Key fields:
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:11, color:S.t4 }}>
                  {[
                    ['catalog.uuid', 'Any UUID string — uniquely identifies this catalog'],
                    ['metadata.title', 'Display name shown in the app'],
                    ['metadata.version', 'Version string (e.g. "Rev 5", "v8.1")'],
                    ['groups[].id', 'Short ID for the control family (e.g. "ac", "cm")'],
                    ['controls[].id', 'Unique control ID (e.g. "ac-1", "cm-2.1")'],
                    ['props[name=label].value', 'Human-readable label shown in the sidebar (e.g. "AC-1")'],
                    ['parts[name=statement].prose', 'The control requirement text'],
                    ['parts[name=assessment-objective]', 'Nested objectives — each becomes an assessable row in CRAFT'],
                  ].map(([field, desc]) => (
                    <div key={field} style={{ display:'flex', gap:8, alignItems:'baseline' }}>
                      <span style={{ fontFamily:S.mono, color:S.cyan, fontSize:10, flexShrink:0, minWidth:240 }}>{field}</span>
                      <span style={{ color:S.t5 }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ position:'relative', margin:'0 16px 16px' }}>
                <pre style={{ margin:0, padding:'14px 16px', backgroundColor:S.bg1, borderRadius:6, border:`1px solid ${S.bg3}`, fontSize:11, fontFamily:S.mono, color:S.t3, lineHeight:1.6, overflow:'auto', maxHeight:340, whiteSpace:'pre' }}>
                  {SCHEMA}
                </pre>
                <button
                  onClick={handleCopy}
                  style={{ position:'absolute', top:8, right:8, ...S.btn(copied ? S.green : S.bg3, copied ? '#fff' : S.t4), padding:'3px 10px', fontSize:10, fontWeight:600 }}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONTROL TREE
// ═══════════════════════════════════════════════════════════════════
function ControlTreeNode({ control, depth, selectedId, onSelect, implMap }) {
  const [open, setOpen] = useState(false);
  const hasEnh  = (control.enhancements||[]).length > 0;
  const done    = !!(implMap[control.id]?.narrative?.trim());
  const selected = selectedId === control.id;
  return (
    <div>
      <div onClick={() => { onSelect(control); if(hasEnh) setOpen(o=>!o); }}
        style={{ display:'flex',alignItems:'center',gap:6,padding:`4px ${8+depth*12}px`,cursor:'pointer',borderRadius:4,margin:'1px 4px',backgroundColor:selected?S.blue+'33':'transparent',borderLeft:selected?`2px solid ${S.blue}`:'2px solid transparent',transition:'background 0.1s' }}
        onMouseEnter={e=>{ if(!selected) e.currentTarget.style.backgroundColor=S.bg3+'66'; }}
        onMouseLeave={e=>{ if(!selected) e.currentTarget.style.backgroundColor='transparent'; }}>
        {hasEnh?<span style={{ color:S.t5,flexShrink:0 }}><ChevronIcon open={open} /></span>:<span style={{ width:12,flexShrink:0 }} />}
        <span style={{ width:8,height:8,borderRadius:'50%',flexShrink:0,backgroundColor:done?'#34d399':S.bg3,border:`1px solid ${done?'#34d399':S.bg3}` }} />
        <span style={{ fontSize:11,fontFamily:S.mono,color:selected?S.blueLight:S.t5,flexShrink:0 }}>{control.label||control.control_id}</span>
        <span style={{ fontSize:11,color:selected?S.t2:S.t4,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{control.title}</span>
      </div>
      {open&&hasEnh&&(control.enhancements||[]).map(e=><ControlTreeNode key={e.id} control={e} depth={depth+1} selectedId={selectedId} onSelect={onSelect} implMap={implMap} />)}
    </div>
  );
}

function GroupNode({ group, selectedId, onSelect, implMap }) {
  const [open, setOpen] = useState(true);
  const done  = (group.controls||[]).filter(c=>!!(implMap[c.id]?.narrative?.trim())).length;
  const total = (group.controls||[]).length;
  return (
    <div>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:'flex',alignItems:'center',gap:8,padding:'5px 10px',cursor:'pointer',borderTop:`1px solid ${S.bg3}22` }}>
        <ChevronIcon open={open} />
        <span style={{ fontSize:11,fontWeight:700,color:S.t3,flex:1 }}>{group.title}</span>
        <span style={{ fontSize:10,fontFamily:S.mono,color:done===total&&total>0?'#34d399':S.t5 }}>{done}/{total}</span>
      </div>
      {open&&(group.controls||[]).map(c=><ControlTreeNode key={c.id} control={c} depth={0} selectedId={selectedId} onSelect={onSelect} implMap={implMap} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONTROL DETAIL PANE
// ═══════════════════════════════════════════════════════════════════
function ControlDetailPane({ control, implStatus, controlOrigin, narrative, remarks, saving, saved, onChange }) {
  return (
    <div style={{ padding:'24px 28px', maxWidth:800 }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:6 }}>
          <span style={{ fontSize:12,fontFamily:S.mono,fontWeight:700,color:S.blueLight,backgroundColor:S.blue+'22',padding:'3px 8px',borderRadius:4 }}>{control.label||control.control_id}</span>
          {implStatus&&<span style={{ fontSize:11,padding:'2px 8px',borderRadius:4,backgroundColor:statusColor(implStatus)+'22',color:statusColor(implStatus),fontWeight:600 }}>{statusLabel(implStatus)}</span>}
          <span style={{ marginLeft:'auto',fontSize:11,color:saved?'#34d399':S.t5,fontFamily:S.mono,transition:'color 0.3s' }}>{saving?'Saving…':saved?'✓ Saved':''}</span>
        </div>
        <div style={{ fontSize:16,fontWeight:700,color:S.t1,lineHeight:1.4 }}>{control.title}</div>
      </div>
      {control.statement&&(
        <div style={{ backgroundColor:S.bg1,borderRadius:8,padding:'12px 16px',marginBottom:20,borderLeft:`3px solid ${S.blue}` }}>
          <div style={{ fontSize:10,color:S.t5,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6 }}>Control Statement</div>
          <div style={{ fontSize:12,color:S.t3,lineHeight:1.6 }}>{control.statement}</div>
        </div>
      )}
      {(control.objectives||[]).length>0&&(
        <div style={{ backgroundColor:S.bg1,borderRadius:8,padding:'12px 16px',marginBottom:20,borderLeft:`3px solid ${S.purple}` }}>
          <div style={{ fontSize:10,color:S.t5,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:8 }}>Assessment Objectives</div>
          {(control.objectives||[]).map(obj=>(
            <div key={obj.objective_id} style={{ display:'flex',gap:10,marginBottom:6,paddingLeft:(obj.depth||0)*14,opacity:obj.isContainer?0.6:1 }}>
              <span style={{ fontSize:10,fontFamily:S.mono,color:S.purple,fontWeight:700,flexShrink:0,marginTop:1 }}>{obj.label||obj.objective_id}</span>
              {obj.prose&&<span style={{ fontSize:12,color:S.t4,lineHeight:1.5 }}>{obj.prose}</span>}
            </div>
          ))}
        </div>
      )}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16 }}>
        <div>
          <label style={S.label}>Implementation Status</label>
          <select value={implStatus} onChange={e=>onChange('implStatus',e.target.value)} style={S.select}>
            {STATUS_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Control Origin</label>
          <select value={controlOrigin} onChange={e=>onChange('controlOrigin',e.target.value)} style={S.select}>
            {ORIGIN_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Implementation Narrative <span style={{ color:S.t5,fontWeight:400,textTransform:'none',letterSpacing:0 }}>— Required for export</span></label>
        <textarea value={narrative} onChange={e=>onChange('narrative',e.target.value)} style={{ ...S.textarea,minHeight:160 }} placeholder="Describe how this control is implemented. This maps directly into AnvilCRAFT on import." />
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Remarks <span style={{ color:S.t5,fontWeight:400,textTransform:'none',letterSpacing:0 }}>(optional)</span></label>
        <textarea value={remarks} onChange={e=>onChange('remarks',e.target.value)} style={{ ...S.textarea,minHeight:70 }} placeholder="Additional notes or context." />
      </div>
      {narrative.trim()&&(
        <div style={{ backgroundColor:S.bg2,borderRadius:8,padding:'10px 14px',border:`1px solid ${S.bg3}` }}>
          <div style={{ fontSize:10,color:S.t5,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6,display:'flex',alignItems:'center',gap:4 }}><InfoIcon /> OSCAL Output Preview</div>
          <pre style={{ fontSize:10,fontFamily:S.mono,color:S.t4,margin:0,whiteSpace:'pre-wrap',lineHeight:1.5 }}>{JSON.stringify({"control-id":control.control_id||control.label,"implementation-status":{state:implStatus||"—"},"props":controlOrigin?[{"name":"control-origination","value":controlOrigin}]:[],"by-components":[{"description":narrative.trim().slice(0,120)+(narrative.length>120?'…':'')}]},null,2)}</pre>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT MODAL
// ═══════════════════════════════════════════════════════════════════
function ExportModal({ sspId, systemName, onClose }) {
  const [stats, setStats]           = useState(null);
  const [sectionWarnings, setSectionWarnings] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [exporting, setExporting]   = useState(null);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, char, desc, diags] = await Promise.all([
          forge.ssp.preflight({ sspId }),
          forge.ssp.getCharacterization({ sspId }),
          forge.ssp.getDescription({ sspId }),
          forge.ssp.getDiagrams({ sspId }),
        ]);
        setStats(s);

        // Section completeness warnings
        const warns = [];
        if (!char?.security_category)   warns.push('Security categorization not set (System Info).');
        if (!char?.operational_status)  warns.push('Operational status not set (System Info).');
        if (!desc?.general_description) warns.push('General system description is empty (Description).');
        if (!desc?.boundary_description)warns.push('System boundary description is empty (Description).');
        if (!diags?.length)             warns.push('No system diagrams uploaded (Diagrams).');
        setSectionWarnings(warns);
      } catch(e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [sspId]);

  const handleExport = async (format) => {
    setExporting(format); setError('');
    let r;
    if (format === 'oscal') r = await forge.ssp.export({ sspId });
    else if (format === 'docx') r = await forge.ssp.exportDocx({ sspId });
    else if (format === 'pdf')  r = await forge.ssp.exportPdf({ sspId });
    else if (format === 'csv')  r = await forge.ssp.exportCsv({ sspId });
    setExporting(null);
    if (r?.success) setResult({ ...r, format });
    else if (r && !r.canceled) setError(r.error || 'Export failed.');
  };

  const canExport = stats && stats.addressed > 0;

  const FORMAT_CARDS = [
    {
      id:    'oscal',
      label: 'OSCAL JSON',
      desc:  'Import directly into AnvilCRAFT. Machine-readable OSCAL 1.1.2 format.',
      color: S.blue,
      icon:  '{}',
    },
    {
      id:    'docx',
      label: 'Word Document',
      desc:  'SP 800-18 aligned SSP document. Share with auditors, AOs, or stakeholders.',
      color: '#2563eb',
      icon:  'W',
    },
    {
      id:    'pdf',
      label: 'PDF Document',
      desc:  'Read-only distribution format. Share with stakeholders who do not need to edit.',
      color: '#dc2626',
      icon:  'PDF',
    },
    {
      id:    'csv',
      label: 'CSV Spreadsheet',
      desc:  'Control-level export: ID, title, status, origin, and narrative. Open in Excel.',
      color: S.green,
      icon:  'CSV',
    },
  ];

  if (result) {
    const formatLabel = result.format === 'oscal' ? 'OSCAL JSON' : result.format === 'docx' ? 'Word Document' : result.format === 'pdf' ? 'PDF Document' : 'CSV Spreadsheet';
    return (
      <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }}>
        <div style={{ width:480,padding:32,backgroundColor:S.bg1,borderRadius:14,border:`1px solid ${S.bg3}`,textAlign:'center' }}>
          <div style={{ fontSize:40,marginBottom:12 }}>✓</div>
          <div style={{ fontSize:16,fontWeight:700,color:S.t1,marginBottom:4 }}>{formatLabel} Exported</div>
          <div style={{ fontSize:12,color:S.t4,marginBottom:12 }}>Saved to:</div>
          <div style={{ fontSize:11,fontFamily:S.mono,color:S.blueLight,padding:'8px 12px',backgroundColor:S.bg2,borderRadius:6,marginBottom:20,wordBreak:'break-all',textAlign:'left' }}>{result.filePath}</div>
          {result.format === 'oscal' && result.stats && (
            <div style={{ fontSize:12,color:S.t5,marginBottom:20 }}>{result.stats.addressed} controls exported · ready for AnvilCRAFT import</div>
          )}
          <div style={{ display:'flex',gap:8,justifyContent:'center' }}>
            <button onClick={()=>forge.shell.showFile({filePath:result.filePath})} style={S.btnOutline}>Show in Explorer</button>
            <button onClick={onClose} style={S.btn()}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }} onClick={onClose}>
      <div style={{ width:700,padding:32,backgroundColor:S.bg1,borderRadius:14,border:`1px solid ${S.bg3}` }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:18,fontWeight:700,color:S.t1,marginBottom:4 }}>Export SSP</div>
        <div style={{ fontSize:12,color:S.t4,marginBottom:20 }}>Choose your export format.</div>

        {/* Stats row */}
        {loading && <div style={{ color:S.t5,fontSize:13,textAlign:'center',padding:16 }}>Checking…</div>}
        {stats && (
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:20 }}>
            {[{label:'Total Controls',value:stats.totalCatalogControls,color:S.t3},{label:'Addressed',value:stats.addressed,color:'#34d399'},{label:'Skipped',value:stats.skipped,color:S.t5}].map(({label,value,color})=>(
              <div key={label} style={{ backgroundColor:S.bg2,borderRadius:8,padding:'10px 12px',textAlign:'center' }}>
                <div style={{ fontSize:22,fontWeight:800,color,fontFamily:S.mono }}>{value}</div>
                <div style={{ fontSize:10,color:S.t5,marginTop:2,textTransform:'uppercase',letterSpacing:1 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Status breakdown */}
        {stats && Object.keys(stats.byStatus||{}).length>0 && (
          <div style={{ backgroundColor:S.bg2,borderRadius:8,padding:'10px 12px',marginBottom:16,display:'flex',gap:8,flexWrap:'wrap' }}>
            {Object.entries(stats.byStatus).map(([k,v])=>(
              <span key={k} style={{ fontSize:11,padding:'2px 8px',borderRadius:4,backgroundColor:statusColor(k)+'22',color:statusColor(k),fontWeight:600 }}>{statusLabel(k)}: {v}</span>
            ))}
          </div>
        )}

        {/* Control warnings */}
        {stats?.warnings?.length>0 && (
          <div style={{ backgroundColor:S.amber+'11',border:`1px solid ${S.amber}33`,borderRadius:8,padding:'10px 12px',marginBottom:10 }}>
            <div style={{ fontSize:11,fontWeight:600,color:S.amber,marginBottom:4 }}>⚠ Control Warnings</div>
            {stats.warnings.map((w,i)=><div key={i} style={{ fontSize:11,color:S.t3 }}>{w}</div>)}
          </div>
        )}

        {/* Section completeness warnings */}
        {sectionWarnings.length>0 && (
          <div style={{ backgroundColor:S.blue+'11',border:`1px solid ${S.blue}22`,borderRadius:8,padding:'10px 12px',marginBottom:10 }}>
            <div style={{ fontSize:11,fontWeight:600,color:S.blueLight,marginBottom:4 }}>ℹ Incomplete Sections</div>
            <div style={{ fontSize:11,color:S.t4,marginBottom:4 }}>These sections are optional but recommended for a complete SSP document:</div>
            {sectionWarnings.map((w,i)=><div key={i} style={{ fontSize:11,color:S.t4,marginBottom:1 }}>· {w}</div>)}
          </div>
        )}

        {/* No controls warning */}
        {stats && stats.addressed===0 && (
          <div style={{ backgroundColor:'#dc262622',border:`1px solid #dc262633`,borderRadius:8,padding:'10px 12px',marginBottom:10,fontSize:12,color:'#f87171' }}>
            No controls have narrative text. Add narrative to at least one control before exporting.
          </div>
        )}

        {/* Format cards — 2x2 grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          {FORMAT_CARDS.map(fmt => (
            <button key={fmt.id} onClick={()=>canExport&&handleExport(fmt.id)}
              disabled={!canExport||!!exporting}
              style={{ padding:16,borderRadius:10,border:`1px solid ${canExport?fmt.color+'44':S.bg3}`,backgroundColor:canExport?fmt.color+'11':S.bg2,cursor:canExport?'pointer':'not-allowed',textAlign:'left',opacity:(!canExport||!!exporting)?0.5:1,transition:'all 0.15s',fontFamily:S.font }}>
              <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                <div style={{ width:32,height:32,borderRadius:6,backgroundColor:fmt.color+'22',color:fmt.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,fontFamily:S.mono }}>
                  {exporting===fmt.id ? '…' : fmt.icon}
                </div>
                <span style={{ fontSize:13,fontWeight:700,color:S.t1 }}>{fmt.label}</span>
              </div>
              <div style={{ fontSize:11,color:S.t5,lineHeight:1.5 }}>{fmt.desc}</div>
            </button>
          ))}
        </div>

        {error && <div style={{ marginBottom:16,padding:'8px 12px',borderRadius:6,backgroundColor:'#dc262622',color:'#f87171',fontSize:12 }}>{error}</div>}

        <div style={{ display:'flex',justifyContent:'flex-end' }}>
          <button onClick={onClose} style={S.btnOutline}>Cancel</button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// WORKSPACE
// ═══════════════════════════════════════════════════════════════════
function Workspace({ sspId, onBack }) {
  const [ssp, setSsp]             = useState(null);
  const [catalog, setCatalog]     = useState(null);
  const [implMap, setImplMap]     = useState({});
  const [selectedControl, setSelectedControl] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('controls');
  const [sectionStatus, setSectionStatus] = useState({ characterization:false, description:false, diagrams:false });
  const [implStatus, setImplStatus]     = useState('');
  const [controlOrigin, setControlOrigin] = useState('');
  const [narrative, setNarrative] = useState('');
  const [remarks, setRemarks]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [groupFilter, setGroupFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');
  const [showExport, setShowExport]     = useState(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    (async () => {
      const data = await forge.ssp.get({ id: sspId });
      if (!data) return;
      setSsp(data.ssp);
      const map = {};
      for (const impl of (data.implementations||[])) map[impl.control_id] = impl;
      setImplMap(map);
      const [cat, char, desc, diags] = await Promise.all([
        forge.catalog.getTree({ catalogId: data.ssp.catalog_id }),
        forge.ssp.getCharacterization({ sspId }),
        forge.ssp.getDescription({ sspId }),
        forge.ssp.getDiagrams({ sspId }),
      ]);
      setCatalog(cat);
      setSectionStatus({
        characterization: !!(char?.system_identifier || char?.security_category || char?.operational_status),
        description:      !!(desc?.general_description || desc?.function_purpose),
        diagrams:         Array.isArray(diags) && diags.length > 0,
      });
      setLoading(false);
    })();
  }, [sspId]);

  // Refresh section status when switching away from a tab
  const handleTabChange = async (tabId) => {
    if (activeTab !== 'controls' && activeTab !== tabId) {
      const [char, desc, diags] = await Promise.all([
        forge.ssp.getCharacterization({ sspId }),
        forge.ssp.getDescription({ sspId }),
        forge.ssp.getDiagrams({ sspId }),
      ]);
      setSectionStatus({
        characterization: !!(char?.system_identifier || char?.security_category || char?.operational_status),
        description:      !!(desc?.general_description || desc?.function_purpose),
        diagrams:         Array.isArray(diags) && diags.length > 0,
      });
    }
    setActiveTab(tabId);
  };

  useEffect(() => {
    if (!selectedControl) return;
    const impl = implMap[selectedControl.id];
    setImplStatus(impl?.impl_status||'');
    setControlOrigin(impl?.control_origin||'');
    setNarrative(impl?.narrative||'');
    setRemarks(impl?.remarks||'');
    setSaved(false);
  }, [selectedControl?.id]);

  const triggerSave = useCallback(() => {
    if (!selectedControl) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      await forge.ssp.saveControl({ sspId, controlId:selectedControl.id, data:{ implStatus:implStatus||null, controlOrigin:controlOrigin||null, narrative:narrative||null, remarks:remarks||null } });
      setImplMap(prev=>({...prev,[selectedControl.id]:{...prev[selectedControl.id],impl_status:implStatus,control_origin:controlOrigin,narrative,remarks}}));
      setSaved(true); setTimeout(()=>setSaved(false),2000);
      setSaving(false);
    }, 800);
  }, [selectedControl,sspId,implStatus,controlOrigin,narrative,remarks]);

  useEffect(() => { if (selectedControl) triggerSave(); }, [implStatus,controlOrigin,narrative,remarks]);

  const allControls = useMemo(() => {
    if (!catalog) return [];
    const flat=[]; const walk=(cs)=>{ for(const c of cs){flat.push(c);walk(c.enhancements||[]);} };
    for(const g of (catalog.groups||[])) walk(g.controls||[]);
    return flat;
  },[catalog]);

  const stats = useMemo(() => {
    const total=allControls.length; const addressed=allControls.filter(c=>implMap[c.id]?.narrative?.trim()).length;
    return {total,addressed,pct:total>0?Math.round(addressed/total*100):0};
  },[allControls,implMap]);

  const filteredGroups = useMemo(() => {
    if (!catalog) return [];
    return (catalog.groups||[]).filter(g=>groupFilter==='all'||g.id===groupFilter).map(g=>({
      ...g,controls:(g.controls||[]).filter(c=>{
        const done=!!(implMap[c.id]?.narrative?.trim());
        if(statusFilter==='complete'&&!done) return false;
        if(statusFilter==='empty'&&done) return false;
        if(searchQuery){ const q=searchQuery.toLowerCase(); return (c.control_id||'').toLowerCase().includes(q)||(c.title||'').toLowerCase().includes(q)||(c.label||'').toLowerCase().includes(q); }
        return true;
      }),
    })).filter(g=>g.controls.length>0);
  },[catalog,groupFilter,statusFilter,searchQuery,implMap]);

  if (loading) return <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:S.t5,fontSize:13 }}>Loading…</div>;

  const TABS = [
    { id:'characterization', label:'System Info',  done: sectionStatus.characterization },
    { id:'description',      label:'Description',  done: sectionStatus.description },
    { id:'diagrams',         label:'Diagrams',      done: sectionStatus.diagrams },
    { id:'controls',         label:`Controls`,      done: stats.addressed > 0, count: `${stats.addressed}/${stats.total}` },
  ];

  return (
    <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
      {/* Workspace topbar */}
      <div style={{ background:`linear-gradient(135deg,${S.bg1},${S.bg2})`,borderBottom:`1px solid ${S.bg3}`,padding:'8px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
        <button onClick={onBack} style={{ ...S.btnOutline,padding:'4px 10px',fontSize:11 }}>← Drafts</button>
        <div style={{ width:1,height:24,backgroundColor:S.bg3 }} />
        <div>
          <div style={{ fontSize:13,fontWeight:700,color:S.t1 }}>{ssp?.system_name}</div>
          <div style={{ fontSize:10,color:S.t5 }}>{catalog?.name}{ssp?.org_name?` · ${ssp.org_name}`:''}</div>
        </div>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex',alignItems:'center',gap:8,backgroundColor:S.bg0,borderRadius:8,padding:'5px 10px',border:`1px solid ${S.bg3}` }}>
          <div style={{ width:70,height:3,backgroundColor:S.bg3,borderRadius:2,overflow:'hidden' }}>
            <div style={{ width:`${stats.pct}%`,height:'100%',backgroundColor:stats.pct>=80?'#34d399':stats.pct>=40?S.amber:S.blue,transition:'width 0.3s',borderRadius:2 }} />
          </div>
          <span style={{ fontSize:11,fontFamily:S.mono,color:S.t4 }}>{stats.addressed}/{stats.total}</span>
          <span style={{ fontSize:10,color:S.t5 }}>{stats.pct}%</span>
        </div>
        <button onClick={()=>setShowExport(true)} style={{ ...S.btn(),padding:'5px 12px',fontSize:11 }}><DownloadIcon /> Export</button>
      </div>

      {/* Tab bar */}
      <div style={{ backgroundColor:S.bg1,borderBottom:`1px solid ${S.bg3}`,padding:'0 16px',display:'flex',gap:2,flexShrink:0 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>handleTabChange(tab.id)}
            style={{ padding:'10px 16px',border:'none',borderBottom:activeTab===tab.id?`2px solid ${S.blue}`:'2px solid transparent',backgroundColor:'transparent',color:activeTab===tab.id?S.blueLight:S.t5,fontSize:12,fontWeight:activeTab===tab.id?700:500,cursor:'pointer',fontFamily:S.font,transition:'color 0.15s',marginBottom:-1,display:'flex',alignItems:'center',gap:5 }}>
            {tab.done
              ? <span style={{ width:6,height:6,borderRadius:'50%',backgroundColor:'#34d399',flexShrink:0 }} />
              : <span style={{ width:6,height:6,borderRadius:'50%',backgroundColor:S.bg3,flexShrink:0 }} />
            }
            {tab.label}
            {tab.count && <span style={{ fontSize:10,fontFamily:S.mono,color:activeTab===tab.id?S.blueLight:S.t5,marginLeft:2 }}>({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex:1,overflow:'hidden',display:'flex' }}>
        {activeTab === 'characterization' && (
          <div style={{ flex:1,overflowY:'auto' }}><CharacterizationScreen sspId={sspId} /></div>
        )}
        {activeTab === 'description' && (
          <div style={{ flex:1,overflowY:'auto' }}><DescriptionScreen sspId={sspId} /></div>
        )}
        {activeTab === 'diagrams' && (
          <div style={{ flex:1,overflowY:'auto' }}><DiagramsScreen sspId={sspId} /></div>
        )}
        {activeTab === 'controls' && (
          <div style={{ flex:1,display:'flex',overflow:'hidden' }}>
            {/* Sidebar */}
            <div style={{ width:290,flexShrink:0,backgroundColor:S.bg1,borderRight:`1px solid ${S.bg3}`,display:'flex',flexDirection:'column',overflow:'hidden' }}>
              <div style={{ padding:'8px 8px 6px',borderBottom:`1px solid ${S.bg3}`,display:'flex',flexDirection:'column',gap:5 }}>
                <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={{ ...S.input,fontSize:11,padding:'5px 8px' }} placeholder="Search controls…" />
                <div style={{ display:'flex',gap:3 }}>
                  <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{ ...S.select,flex:1,fontSize:10,padding:'3px 5px' }}>
                    <option value="all">All Families</option>
                    {(catalog?.groups||[]).map(g=><option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                  <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ ...S.select,flex:1,fontSize:10,padding:'3px 5px' }}>
                    <option value="all">All Status</option>
                    <option value="complete">Complete</option>
                    <option value="empty">Empty</option>
                  </select>
                </div>
              </div>
              <div style={{ flex:1,overflowY:'auto',padding:'4px 0' }}>
                {filteredGroups.map(g=><GroupNode key={g.id} group={g} selectedId={selectedControl?.id} onSelect={setSelectedControl} implMap={implMap} />)}
                {filteredGroups.length===0&&<div style={{ padding:20,textAlign:'center',color:S.t5,fontSize:12 }}>No controls match filters.</div>}
              </div>
            </div>
            {/* Detail pane */}
            <div style={{ flex:1,overflowY:'auto' }}>
              {!selectedControl ? (
                <div style={{ height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:S.t5,fontSize:13 }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ marginBottom:8,opacity:0.3 }}><ShieldIcon /></div>
                    Select a control from the sidebar to begin.
                  </div>
                </div>
              ) : (
                <ControlDetailPane
                  control={selectedControl}
                  implStatus={implStatus} controlOrigin={controlOrigin}
                  narrative={narrative} remarks={remarks}
                  saving={saving} saved={saved}
                  onChange={(f,v)=>{ if(f==='implStatus')setImplStatus(v); if(f==='controlOrigin')setControlOrigin(v); if(f==='narrative')setNarrative(v); if(f==='remarks')setRemarks(v); }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {showExport&&<ExportModal sspId={sspId} systemName={ssp?.system_name||'ssp'} onClose={()=>setShowExport(false)} />}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView]               = useState('dashboard');
  const [sspId, setSspId]             = useState(null);
  const [appVersion, setAppVersion]   = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    forge?.app.version().then(setAppVersion).catch(()=>{});
  }, []);

  const openSsp = (id) => { setSspId(id); setView('workspace'); };
  const closeWorkspace = () => { setSspId(null); setView('dashboard'); };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', backgroundColor:S.bg0, fontFamily:S.font, color:S.t2 }}>
      <UpdateBanner />
      {view !== 'workspace' && (
        <Topbar view={view} onNavigate={setView} appVersion={appVersion} onShowChangelog={() => setShowChangelog(true)} />
      )}
      {view === 'dashboard' && <Dashboard onOpen={openSsp} />}
      {view === 'catalogs'  && <CatalogsView />}
      {view === 'workspace' && sspId && <Workspace sspId={sspId} onBack={closeWorkspace} />}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
}
