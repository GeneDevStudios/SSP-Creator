const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs   = require('fs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ---------------------------------------------------------------
// Paths
// ---------------------------------------------------------------
const USER_DATA   = app.getPath('userData');
const DB_PATH     = path.join(USER_DATA, 'forge.db');
const CATALOG_DIR = isDev
  ? path.join(__dirname, '../../assets/catalogs')
  : path.join(process.resourcesPath, 'catalogs');

// Ensure catalog dir exists
if (!fs.existsSync(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });

// ---------------------------------------------------------------
// Database — lazy init on first access
// ---------------------------------------------------------------
let _db = null;
function getDb() {
  if (_db) return _db;
  const Database = require('better-sqlite3');
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalogs (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      short_name   TEXT NOT NULL,
      version      TEXT NOT NULL,
      oscal_version TEXT,
      source_format TEXT NOT NULL DEFAULT 'oscal',
      is_active    INTEGER NOT NULL DEFAULT 1,
      file_path    TEXT,
      raw_json     TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS control_groups (
      id         TEXT PRIMARY KEY,
      catalog_id TEXT NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
      group_id   TEXT NOT NULL,
      title      TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(catalog_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS controls (
      id         TEXT PRIMARY KEY,
      catalog_id TEXT NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
      group_id   TEXT NOT NULL REFERENCES control_groups(id) ON DELETE CASCADE,
      parent_id  TEXT REFERENCES controls(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      label      TEXT,
      title      TEXT NOT NULL,
      statement  TEXT,
      guidance   TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(catalog_id, control_id)
    );

    CREATE TABLE IF NOT EXISTS control_objectives (
      id           TEXT PRIMARY KEY,
      control_id   TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
      objective_id TEXT NOT NULL,
      label        TEXT,
      prose        TEXT NOT NULL,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      UNIQUE(control_id, objective_id)
    );

    CREATE TABLE IF NOT EXISTS ssp_drafts (
      id             TEXT PRIMARY KEY,
      catalog_id     TEXT NOT NULL REFERENCES catalogs(id),
      system_name    TEXT NOT NULL,
      system_version TEXT,
      org_name       TEXT,
      profile_href   TEXT,
      oscal_version  TEXT NOT NULL DEFAULT '1.1.2',
      status         TEXT NOT NULL DEFAULT 'draft',
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ssp_implementations (
      id             TEXT PRIMARY KEY,
      ssp_id         TEXT NOT NULL REFERENCES ssp_drafts(id) ON DELETE CASCADE,
      control_id     TEXT NOT NULL REFERENCES controls(id),
      impl_status    TEXT,
      control_origin TEXT,
      narrative      TEXT,
      remarks        TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(ssp_id, control_id)
    );

    CREATE TABLE IF NOT EXISTS ssp_characterization (
      ssp_id               TEXT PRIMARY KEY REFERENCES ssp_drafts(id) ON DELETE CASCADE,
      system_identifier    TEXT,
      security_category    TEXT,  -- Low | Moderate | High
      impact_confidentiality TEXT, -- Low | Moderate | High
      impact_integrity     TEXT,
      impact_availability  TEXT,
      operational_status   TEXT,  -- Operational | Under Development | Under Major Modification
      system_type          TEXT,  -- General Support System | Major Application
      additional_info      TEXT,
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ssp_description (
      ssp_id               TEXT PRIMARY KEY REFERENCES ssp_drafts(id) ON DELETE CASCADE,
      general_description  TEXT,
      function_purpose     TEXT,
      boundary_description TEXT,
      data_types           TEXT,
      user_types           TEXT,  -- JSON array: ["Internal Staff","Contractors","General Public","Other"]
      additional_info      TEXT,
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ssp_diagrams (
      id          TEXT PRIMARY KEY,
      ssp_id      TEXT NOT NULL REFERENCES ssp_drafts(id) ON DELETE CASCADE,
      diagram_type TEXT NOT NULL, -- architecture | boundary | dataflow
      filename    TEXT NOT NULL,
      mime_type   TEXT NOT NULL,
      data        BLOB NOT NULL,  -- base64 encoded image
      additional_info TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(ssp_id, diagram_type)
    );

    CREATE TABLE IF NOT EXISTS ssp_logo (
      ssp_id           TEXT PRIMARY KEY REFERENCES ssp_drafts(id) ON DELETE CASCADE,
      filename         TEXT NOT NULL,
      mime_type        TEXT NOT NULL,
      data             BLOB NOT NULL,
      include_branding INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_controls_catalog   ON controls(catalog_id);
    CREATE INDEX IF NOT EXISTS idx_controls_group     ON controls(group_id);
    CREATE INDEX IF NOT EXISTS idx_controls_parent    ON controls(parent_id);
    CREATE INDEX IF NOT EXISTS idx_objectives_control ON control_objectives(control_id);
    CREATE INDEX IF NOT EXISTS idx_impl_ssp           ON ssp_implementations(ssp_id);
    CREATE INDEX IF NOT EXISTS idx_impl_control       ON ssp_implementations(control_id);
    CREATE INDEX IF NOT EXISTS idx_diagrams_ssp       ON ssp_diagrams(ssp_id);
  `);
}

// ---------------------------------------------------------------
// Window
// ---------------------------------------------------------------
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1400,
    height: 900,
    minWidth:  900,
    minHeight: 600,
    title: 'Anvil FORGE',
    webPreferences: {
      preload:         path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    show: false,
    backgroundColor: '#020617',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../src/renderer/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------------------------------------------------------------
// Auto-updater
// ---------------------------------------------------------------
function setupUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload    = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:checking');
  });
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:available', info);
  });
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater:not-available');
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:progress', progress);
  });
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:downloaded', info);
  });
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater:error', err.message);
  });

  // Check on launch, then every 4 hours
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}

ipcMain.handle('updater:install-now', () => {
  autoUpdater.quitAndInstall();
});

// ---------------------------------------------------------------
// IPC — Catalog handlers
// ---------------------------------------------------------------
ipcMain.handle('catalog:list', () => {
  const db = getDb();
  return db.prepare(
    `SELECT id, name, short_name, version, oscal_version, source_format,
            is_active, created_at,
            (SELECT COUNT(*) FROM control_groups WHERE catalog_id = catalogs.id) AS group_count,
            (SELECT COUNT(*) FROM controls WHERE catalog_id = catalogs.id AND parent_id IS NULL) AS control_count
     FROM catalogs ORDER BY created_at DESC`
  ).all();
});

ipcMain.handle('catalog:import-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title:      'Import Catalog',
    filters:    [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { canceled: true };
  return { canceled: false, filePath: filePaths[0] };
});

ipcMain.handle('catalog:ingest', (event, { filePath, nameOverride, versionOverride, shortName }) => {
  const { normalizeCatalog, validateNormalized } = require('../../shared/oscal-normalizer');
  const { randomUUID } = require('crypto');

  let rawJson;
  try {
    rawJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { success: false, error: 'File is not valid JSON.' };
  }

  let normalized;
  try {
    normalized = normalizeCatalog(rawJson);
  } catch(e) {
    return { success: false, error: `Normalization failed: ${e.message}` };
  }

  const { valid, errors } = validateNormalized(normalized);
  if (!valid) return { success: false, error: errors.join(' | ') };

  const { meta, groups } = normalized;
  const name    = nameOverride  || meta.title;
  const version = versionOverride || meta.version;
  const sName   = shortName || slugify(name);
  const db      = getDb();

  const insertCatalog = db.prepare(
    `INSERT INTO catalogs (id, name, short_name, version, oscal_version, source_format, file_path, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertGroup = db.prepare(
    `INSERT OR IGNORE INTO control_groups (id, catalog_id, group_id, title, sort_order)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertControl = db.prepare(
    `INSERT OR IGNORE INTO controls
       (id, catalog_id, group_id, parent_id, control_id, label, title, statement, guidance, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertObjective = db.prepare(
    `INSERT OR IGNORE INTO control_objectives (id, control_id, objective_id, label, prose, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const catalogId = randomUUID();

  const ingestAll = db.transaction(() => {
    insertCatalog.run(catalogId, name, sName, version, meta.oscalVersion, meta.sourceFormat, filePath, JSON.stringify(rawJson));
    let groupOrder = 0;
    for (const group of groups) {
      const groupDbId = randomUUID();
      insertGroup.run(groupDbId, catalogId, group.groupId, group.title, groupOrder++);
      insertControlsRecursive(group.controls, catalogId, groupDbId, null, { n: 0 });
    }
  });

  function insertControlsRecursive(controls, catalogId, groupDbId, parentDbId, order) {
    for (const ctrl of controls) {
      const ctrlDbId = randomUUID();
      insertControl.run(ctrlDbId, catalogId, groupDbId, parentDbId, ctrl.controlId, ctrl.label, ctrl.title, ctrl.statement, ctrl.guidance, order.n++);
      let objOrder = 0;
      for (const obj of (ctrl.objectives || [])) {
        insertObjective.run(randomUUID(), ctrlDbId, obj.objectiveId, obj.label, obj.prose, objOrder++);
      }
      if (ctrl.enhancements?.length) {
        insertControlsRecursive(ctrl.enhancements, catalogId, groupDbId, ctrlDbId, order);
      }
    }
  }

  try {
    ingestAll();
    return { success: true, catalogId, name, version, groupCount: groups.length };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('catalog:set-active', (event, { id, isActive }) => {
  getDb().prepare('UPDATE catalogs SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
  return { success: true };
});

ipcMain.handle('catalog:delete', (event, { id }) => {
  getDb().prepare('DELETE FROM catalogs WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('catalog:get-tree', (event, { catalogId }) => {
  const db = getDb();
  const catalog = db.prepare('SELECT * FROM catalogs WHERE id = ?').get(catalogId);
  if (!catalog) return null;

  const groups   = db.prepare('SELECT * FROM control_groups WHERE catalog_id = ? ORDER BY sort_order').all(catalogId);
  const controls = db.prepare('SELECT * FROM controls WHERE catalog_id = ? ORDER BY sort_order').all(catalogId);
  const objectives = db.prepare(
    `SELECT co.* FROM control_objectives co
     JOIN controls c ON c.id = co.control_id
     WHERE c.catalog_id = ? ORDER BY co.sort_order`
  ).all(catalogId);

  // Build tree
  const objsByControl = groupBy(objectives, 'control_id');
  const ctrlMap = {};
  for (const c of controls) {
    ctrlMap[c.id] = { ...c, objectives: objsByControl[c.id] || [], enhancements: [] };
  }
  const topByGroup = {};
  for (const c of controls) {
    if (c.parent_id) { ctrlMap[c.parent_id]?.enhancements.push(ctrlMap[c.id]); }
    else { if (!topByGroup[c.group_id]) topByGroup[c.group_id] = []; topByGroup[c.group_id].push(ctrlMap[c.id]); }
  }

  return {
    ...catalog,
    groups: groups.map(g => ({ ...g, controls: topByGroup[g.id] || [] })),
  };
});

// ---------------------------------------------------------------
// IPC — SSP handlers
// ---------------------------------------------------------------
ipcMain.handle('ssp:list', () => {
  return getDb().prepare(
    `SELECT s.*, c.name AS catalog_name, c.short_name AS catalog_short_name,
            (SELECT COUNT(*) FROM ssp_implementations
             WHERE ssp_id = s.id AND narrative IS NOT NULL AND narrative != '') AS addressed_controls
     FROM ssp_drafts s JOIN catalogs c ON c.id = s.catalog_id
     ORDER BY s.updated_at DESC`
  ).all();
});

ipcMain.handle('ssp:create', (event, data) => {
  const { randomUUID } = require('crypto');
  const { catalogId, systemName, systemVersion, orgName, profileHref } = data;
  const id = randomUUID();
  getDb().prepare(
    `INSERT INTO ssp_drafts (id, catalog_id, system_name, system_version, org_name, profile_href)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, catalogId, systemName, systemVersion||null, orgName||null, profileHref||null);
  return { id, system_name: systemName, status: 'draft' };
});

ipcMain.handle('ssp:get', (event, { id }) => {
  const db = getDb();
  const ssp = db.prepare(
    `SELECT s.*, c.name AS catalog_name FROM ssp_drafts s
     JOIN catalogs c ON c.id = s.catalog_id WHERE s.id = ?`
  ).get(id);
  if (!ssp) return null;
  const implementations = db.prepare(
    `SELECT i.*, c.control_id AS control_id_str, c.label, c.title
     FROM ssp_implementations i JOIN controls c ON c.id = i.control_id
     WHERE i.ssp_id = ? ORDER BY c.sort_order`
  ).all(id);
  return { ssp, implementations };
});

ipcMain.handle('ssp:save-control', (event, { sspId, controlId, data }) => {
  const { randomUUID } = require('crypto');
  const { implStatus, controlOrigin, narrative, remarks } = data;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM ssp_implementations WHERE ssp_id = ? AND control_id = ?').get(sspId, controlId);
  if (existing) {
    db.prepare(
      `UPDATE ssp_implementations SET impl_status=?, control_origin=?, narrative=?, remarks=?, updated_at=datetime('now')
       WHERE ssp_id=? AND control_id=?`
    ).run(implStatus||null, controlOrigin||null, narrative||null, remarks||null, sspId, controlId);
  } else {
    db.prepare(
      `INSERT INTO ssp_implementations (id, ssp_id, control_id, impl_status, control_origin, narrative, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), sspId, controlId, implStatus||null, controlOrigin||null, narrative||null, remarks||null);
  }
  db.prepare(`UPDATE ssp_drafts SET updated_at=datetime('now') WHERE id=?`).run(sspId);
  return { success: true };
});

ipcMain.handle('ssp:delete', (event, { id }) => {
  getDb().prepare('DELETE FROM ssp_drafts WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('ssp:export', async (event, { sspId }) => {
  const { serializeSSP, getExportStats } = require('../../shared/oscal-serializer');
  const { randomUUID } = require('crypto');
  const db = getDb();

  const draft = db.prepare('SELECT * FROM ssp_drafts WHERE id = ?').get(sspId);
  if (!draft) return { success: false, error: 'SSP not found.' };
  draft.component_uuid = randomUUID();

  const implementations = db.prepare(
    `SELECT i.impl_status, i.control_origin, i.narrative, i.remarks,
            c.control_id AS control_id_str
     FROM ssp_implementations i JOIN controls c ON c.id = i.control_id
     WHERE i.ssp_id = ?`
  ).all(sspId);

  const stats = getExportStats(implementations);
  if (stats.addressed === 0) return { success: false, error: 'No controls have narrative text.' };

  const oscal = serializeSSP(draft, implementations);
  const defaultName = `ssp-${draft.system_name.replace(/\s+/g, '-').toLowerCase()}.json`;

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export OSCAL SSP',
    defaultPath: defaultName,
    filters:     [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled) return { success: false, canceled: true };

  fs.writeFileSync(filePath, JSON.stringify(oscal, null, 2), 'utf8');
  db.prepare(`UPDATE ssp_drafts SET status='exported', updated_at=datetime('now') WHERE id=?`).run(sspId);

  return { success: true, filePath, stats };
});

ipcMain.handle('ssp:preflight', (event, { sspId }) => {
  const { getExportStats } = require('../../shared/oscal-serializer');
  const db = getDb();
  const implementations = db.prepare(
    'SELECT impl_status, control_origin, narrative FROM ssp_implementations WHERE ssp_id = ?'
  ).all(sspId);
  const total = db.prepare(
    `SELECT COUNT(*) AS n FROM controls c
     JOIN ssp_drafts s ON s.catalog_id = c.catalog_id WHERE s.id = ?`
  ).get(sspId);
  const stats = getExportStats(implementations);
  stats.totalCatalogControls = total.n;
  return stats;
});

// Open exported file in OS file manager
ipcMain.handle('shell:show-file', (event, { filePath }) => {
  shell.showItemInFolder(filePath);
});

// App version
ipcMain.handle('app:version', () => app.getVersion());

// ---------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();
  setupUpdater();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function groupBy(arr, key) {
  return arr.reduce((acc, item) => { const k = item[key]; if (!acc[k]) acc[k] = []; acc[k].push(item); return acc; }, {});
}

// ---------------------------------------------------------------
// IPC — System Characterization
// ---------------------------------------------------------------
ipcMain.handle('ssp:get-characterization', (event, { sspId }) => {
  return getDb().prepare('SELECT * FROM ssp_characterization WHERE ssp_id = ?').get(sspId) || {};
});

ipcMain.handle('ssp:save-characterization', (event, { sspId, data }) => {
  const db = getDb();
  const { systemIdentifier, securityCategory, impactConfidentiality, impactIntegrity, impactAvailability, operationalStatus, systemType, additionalInfo } = data;
  const existing = db.prepare('SELECT ssp_id FROM ssp_characterization WHERE ssp_id = ?').get(sspId);
  if (existing) {
    db.prepare(`UPDATE ssp_characterization SET system_identifier=?,security_category=?,impact_confidentiality=?,impact_integrity=?,impact_availability=?,operational_status=?,system_type=?,additional_info=?,updated_at=datetime('now') WHERE ssp_id=?`
    ).run(systemIdentifier||null,securityCategory||null,impactConfidentiality||null,impactIntegrity||null,impactAvailability||null,operationalStatus||null,systemType||null,additionalInfo||null,sspId);
  } else {
    db.prepare(`INSERT INTO ssp_characterization (ssp_id,system_identifier,security_category,impact_confidentiality,impact_integrity,impact_availability,operational_status,system_type,additional_info) VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(sspId,systemIdentifier||null,securityCategory||null,impactConfidentiality||null,impactIntegrity||null,impactAvailability||null,operationalStatus||null,systemType||null,additionalInfo||null);
  }
  db.prepare(`UPDATE ssp_drafts SET updated_at=datetime('now') WHERE id=?`).run(sspId);
  return { success: true };
});

// ---------------------------------------------------------------
// IPC — System Description
// ---------------------------------------------------------------
ipcMain.handle('ssp:get-description', (event, { sspId }) => {
  const row = getDb().prepare('SELECT * FROM ssp_description WHERE ssp_id = ?').get(sspId) || {};
  if (row.user_types) { try { row.user_types = JSON.parse(row.user_types); } catch { row.user_types = []; } }
  return row;
});

ipcMain.handle('ssp:save-description', (event, { sspId, data }) => {
  const db = getDb();
  const { generalDescription, functionPurpose, boundaryDescription, dataTypes, userTypes, additionalInfo } = data;
  const userTypesJson = Array.isArray(userTypes) ? JSON.stringify(userTypes) : userTypes||null;
  const existing = db.prepare('SELECT ssp_id FROM ssp_description WHERE ssp_id = ?').get(sspId);
  if (existing) {
    db.prepare(`UPDATE ssp_description SET general_description=?,function_purpose=?,boundary_description=?,data_types=?,user_types=?,additional_info=?,updated_at=datetime('now') WHERE ssp_id=?`
    ).run(generalDescription||null,functionPurpose||null,boundaryDescription||null,dataTypes||null,userTypesJson,additionalInfo||null,sspId);
  } else {
    db.prepare(`INSERT INTO ssp_description (ssp_id,general_description,function_purpose,boundary_description,data_types,user_types,additional_info) VALUES (?,?,?,?,?,?,?)`
    ).run(sspId,generalDescription||null,functionPurpose||null,boundaryDescription||null,dataTypes||null,userTypesJson,additionalInfo||null);
  }
  db.prepare(`UPDATE ssp_drafts SET updated_at=datetime('now') WHERE id=?`).run(sspId);
  return { success: true };
});

// ---------------------------------------------------------------
// IPC — System Diagrams
// ---------------------------------------------------------------
ipcMain.handle('ssp:get-diagrams', (event, { sspId }) => {
  return getDb().prepare('SELECT id,ssp_id,diagram_type,filename,mime_type,additional_info,created_at FROM ssp_diagrams WHERE ssp_id = ?').all(sspId);
});

ipcMain.handle('ssp:get-diagram-data', (event, { id }) => {
  return getDb().prepare('SELECT diagram_type,filename,mime_type,data FROM ssp_diagrams WHERE id = ?').get(id) || null;
});

ipcMain.handle('ssp:save-diagram', async (event, { sspId, diagramType, additionalInfo }) => {
  const { randomUUID } = require('crypto');
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: `Select ${diagramType} Diagram`,
    filters: [{ name: 'Images', extensions: ['png','jpg','jpeg'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { success: false, canceled: true };
  const filePath = filePaths[0];
  const filename  = path.basename(filePath);
  const ext       = path.extname(filePath).toLowerCase();
  const mimeType  = ext === '.png' ? 'image/png' : 'image/jpeg';
  const data      = fs.readFileSync(filePath).toString('base64');
  const db = getDb();
  const existing = db.prepare('SELECT id FROM ssp_diagrams WHERE ssp_id=? AND diagram_type=?').get(sspId, diagramType);
  if (existing) {
    db.prepare(`UPDATE ssp_diagrams SET filename=?,mime_type=?,data=?,additional_info=? WHERE id=?`).run(filename,mimeType,data,additionalInfo||null,existing.id);
    return { success:true, id:existing.id, filename, mimeType };
  } else {
    const id = randomUUID();
    db.prepare(`INSERT INTO ssp_diagrams (id,ssp_id,diagram_type,filename,mime_type,data,additional_info) VALUES (?,?,?,?,?,?,?)`).run(id,sspId,diagramType,filename,mimeType,data,additionalInfo||null);
    return { success:true, id, filename, mimeType };
  }
});

ipcMain.handle('ssp:save-diagram-note', (event, { sspId, diagramType, additionalInfo }) => {
  getDb().prepare(`UPDATE ssp_diagrams SET additional_info=? WHERE ssp_id=? AND diagram_type=?`).run(additionalInfo||null,sspId,diagramType);
  return { success: true };
});

ipcMain.handle('ssp:delete-diagram', (event, { id }) => {
  getDb().prepare('DELETE FROM ssp_diagrams WHERE id = ?').run(id);
  return { success: true };
});

// ---------------------------------------------------------------
// IPC — Full SSP (for document export)
// ---------------------------------------------------------------
ipcMain.handle('ssp:get-full', (event, { sspId }) => {
  const db = getDb();
  const ssp = db.prepare(`SELECT s.*, c.name AS catalog_name FROM ssp_drafts s JOIN catalogs c ON c.id=s.catalog_id WHERE s.id=?`).get(sspId);
  if (!ssp) return null;
  const characterization = db.prepare('SELECT * FROM ssp_characterization WHERE ssp_id=?').get(sspId) || {};
  const description      = db.prepare('SELECT * FROM ssp_description WHERE ssp_id=?').get(sspId) || {};
  const diagrams         = db.prepare('SELECT * FROM ssp_diagrams WHERE ssp_id=?').all(sspId);
  const implementations  = db.prepare(
    `SELECT i.*,c.control_id AS control_id_str,c.label,c.title,c.statement,cg.title AS group_title,cg.group_id
     FROM ssp_implementations i
     JOIN controls c ON c.id=i.control_id
     JOIN control_groups cg ON cg.id=c.group_id
     WHERE i.ssp_id=? AND i.narrative IS NOT NULL AND i.narrative!=''
     ORDER BY cg.sort_order,c.sort_order`
  ).all(sspId);
  if (description.user_types) { try { description.user_types = JSON.parse(description.user_types); } catch { description.user_types = []; } }
  return { ssp, characterization, description, diagrams, implementations };
});

// ---------------------------------------------------------------
// IPC — Logo
// ---------------------------------------------------------------
ipcMain.handle('ssp:get-logo', (event, { sspId }) => {
  const row = getDb().prepare(
    'SELECT filename, mime_type, data, include_branding FROM ssp_logo WHERE ssp_id = ?'
  ).get(sspId);
  return row || null;
});

ipcMain.handle('ssp:save-logo', async (event, { sspId }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title:      'Select Organization Logo',
    filters:    [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { success: false, canceled: true };

  const filePath = filePaths[0];
  const filename  = path.basename(filePath);
  const ext       = path.extname(filePath).toLowerCase();
  const mimeType  = ext === '.png' ? 'image/png' : 'image/jpeg';
  const data      = fs.readFileSync(filePath).toString('base64');
  const db        = getDb();

  const existing = db.prepare('SELECT ssp_id FROM ssp_logo WHERE ssp_id = ?').get(sspId);
  if (existing) {
    db.prepare(
      `UPDATE ssp_logo SET filename=?, mime_type=?, data=?, updated_at=datetime('now') WHERE ssp_id=?`
    ).run(filename, mimeType, data, sspId);
  } else {
    db.prepare(
      `INSERT INTO ssp_logo (ssp_id, filename, mime_type, data) VALUES (?,?,?,?)`
    ).run(sspId, filename, mimeType, data);
  }
  return { success: true, filename, mimeType };
});

ipcMain.handle('ssp:delete-logo', (event, { sspId }) => {
  getDb().prepare('DELETE FROM ssp_logo WHERE ssp_id = ?').run(sspId);
  return { success: true };
});

ipcMain.handle('ssp:set-branding', (event, { sspId, includeBranding }) => {
  const db = getDb();
  const existing = db.prepare('SELECT ssp_id FROM ssp_logo WHERE ssp_id = ?').get(sspId);
  if (existing) {
    db.prepare(
      `UPDATE ssp_logo SET include_branding=?, updated_at=datetime('now') WHERE ssp_id=?`
    ).run(includeBranding ? 1 : 0, sspId);
  }
  // If no logo uploaded yet, store branding preference in characterization additional_info
  // is handled client-side — branding toggle only meaningful once logo exists
  return { success: true };
});

// ---------------------------------------------------------------
// IPC — DOCX Export
// ---------------------------------------------------------------
ipcMain.handle('ssp:export-docx', async (event, { sspId }) => {
  const { serializeDocx } = require('../../shared/docx-serializer');
  const db = getDb();

  // Gather full SSP data
  const ssp = db.prepare(`SELECT s.*, c.name AS catalog_name FROM ssp_drafts s JOIN catalogs c ON c.id=s.catalog_id WHERE s.id=?`).get(sspId);
  if (!ssp) return { success: false, error: 'SSP not found.' };

  const characterization = db.prepare('SELECT * FROM ssp_characterization WHERE ssp_id=?').get(sspId) || {};
  const description      = db.prepare('SELECT * FROM ssp_description WHERE ssp_id=?').get(sspId) || {};
  const diagrams         = db.prepare('SELECT * FROM ssp_diagrams WHERE ssp_id=?').all(sspId);
  const logo             = db.prepare('SELECT * FROM ssp_logo WHERE ssp_id=?').get(sspId) || null;
  const implementations  = db.prepare(
    `SELECT i.*,c.control_id AS control_id_str,c.label,c.title,c.statement,
            cg.title AS group_title,cg.group_id
     FROM ssp_implementations i
     JOIN controls c ON c.id=i.control_id
     JOIN control_groups cg ON cg.id=c.group_id
     WHERE i.ssp_id=? AND i.narrative IS NOT NULL AND i.narrative!=''
     ORDER BY cg.sort_order,c.sort_order`
  ).all(sspId);

  if (!implementations.length) {
    return { success: false, error: 'No controls have narrative text. Add at least one control implementation before exporting.' };
  }

  // Parse user_types JSON
  if (description.user_types) {
    try { description.user_types = JSON.parse(description.user_types); }
    catch { description.user_types = []; }
  }

  // Show save dialog
  const defaultName = `ssp-${ssp.system_name.replace(/\s+/g,'-').toLowerCase()}.docx`;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export Word Document',
    defaultPath: defaultName,
    filters:     [{ name: 'Word Document', extensions: ['docx'] }],
  });
  if (canceled) return { success: false, canceled: true };

  try {
    const buf = await serializeDocx({ ssp, characterization, description, diagrams, logo, implementations });
    fs.writeFileSync(filePath, buf);
    db.prepare(`UPDATE ssp_drafts SET status='exported', updated_at=datetime('now') WHERE id=?`).run(sspId);
    return { success: true, filePath };
  } catch(err) {
    console.error('[export-docx]', err.message);
    return { success: false, error: `Export failed: ${err.message}` };
  }
});

// ---------------------------------------------------------------
// IPC — Duplicate SSP
// ---------------------------------------------------------------
ipcMain.handle('ssp:duplicate', (event, { sspId }) => {
  const { randomUUID } = require('crypto');
  const db = getDb();

  const ssp = db.prepare('SELECT * FROM ssp_drafts WHERE id = ?').get(sspId);
  if (!ssp) return { success: false, error: 'SSP not found.' };

  const newId = randomUUID();

  const duplicate = db.transaction(() => {
    // ssp_drafts
    db.prepare(
      `INSERT INTO ssp_drafts (id, catalog_id, system_name, system_version, org_name, profile_href, oscal_version, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
    ).run(newId, ssp.catalog_id, `${ssp.system_name} (Copy)`, ssp.system_version||null, ssp.org_name||null, ssp.profile_href||null, ssp.oscal_version||'1.1.2');

    // ssp_characterization
    const char = db.prepare('SELECT * FROM ssp_characterization WHERE ssp_id = ?').get(sspId);
    if (char) {
      db.prepare(
        `INSERT INTO ssp_characterization (ssp_id, system_identifier, security_category, impact_confidentiality, impact_integrity, impact_availability, operational_status, system_type, additional_info)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(newId, char.system_identifier||null, char.security_category||null, char.impact_confidentiality||null, char.impact_integrity||null, char.impact_availability||null, char.operational_status||null, char.system_type||null, char.additional_info||null);
    }

    // ssp_description
    const desc = db.prepare('SELECT * FROM ssp_description WHERE ssp_id = ?').get(sspId);
    if (desc) {
      db.prepare(
        `INSERT INTO ssp_description (ssp_id, general_description, function_purpose, boundary_description, data_types, user_types, additional_info)
         VALUES (?,?,?,?,?,?,?)`
      ).run(newId, desc.general_description||null, desc.function_purpose||null, desc.boundary_description||null, desc.data_types||null, desc.user_types||null, desc.additional_info||null);
    }

    // ssp_implementations
    const impls = db.prepare('SELECT * FROM ssp_implementations WHERE ssp_id = ?').all(sspId);
    for (const impl of impls) {
      db.prepare(
        `INSERT INTO ssp_implementations (id, ssp_id, control_id, impl_status, control_origin, narrative, remarks, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,datetime('now'),datetime('now'))`
      ).run(randomUUID(), newId, impl.control_id, impl.impl_status||null, impl.control_origin||null, impl.narrative||null, impl.remarks||null);
    }

    // ssp_diagrams
    const diags = db.prepare('SELECT * FROM ssp_diagrams WHERE ssp_id = ?').all(sspId);
    for (const diag of diags) {
      db.prepare(
        `INSERT INTO ssp_diagrams (id, ssp_id, diagram_type, filename, mime_type, data, additional_info, created_at)
         VALUES (?,?,?,?,?,?,?,datetime('now'))`
      ).run(randomUUID(), newId, diag.diagram_type, diag.filename, diag.mime_type, diag.data, diag.additional_info||null);
    }

    // ssp_logo
    const logo = db.prepare('SELECT * FROM ssp_logo WHERE ssp_id = ?').get(sspId);
    if (logo) {
      db.prepare(
        `INSERT INTO ssp_logo (ssp_id, filename, mime_type, data, include_branding, created_at, updated_at)
         VALUES (?,?,?,?,?,datetime('now'),datetime('now'))`
      ).run(newId, logo.filename, logo.mime_type, logo.data, logo.include_branding ?? 1);
    }
  });

  try {
    duplicate();
    return { success: true, newId, systemName: `${ssp.system_name} (Copy)` };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

// ---------------------------------------------------------------
// IPC — Backup / Restore
// ---------------------------------------------------------------
ipcMain.handle('ssp:export-backup', async (event, { sspId }) => {
  const { randomUUID } = require('crypto');
  const db = getDb();

  const ssp = db.prepare('SELECT * FROM ssp_drafts WHERE id = ?').get(sspId);
  if (!ssp) return { success: false, error: 'SSP not found.' };

  const characterization = db.prepare('SELECT * FROM ssp_characterization WHERE ssp_id = ?').get(sspId) || null;
  const description      = db.prepare('SELECT * FROM ssp_description WHERE ssp_id = ?').get(sspId) || null;
  const implementations  = db.prepare('SELECT * FROM ssp_implementations WHERE ssp_id = ?').all(sspId);
  const diagrams         = db.prepare('SELECT * FROM ssp_diagrams WHERE ssp_id = ?').all(sspId);
  const logo             = db.prepare('SELECT * FROM ssp_logo WHERE ssp_id = ?').get(sspId) || null;

  // Grab catalog metadata for mismatch warning on restore
  const catalog = db.prepare('SELECT id, name, short_name, version, oscal_version, source_format FROM catalogs WHERE id = ?').get(ssp.catalog_id) || null;

  const envelope = {
    __forge_backup: true,
    backup_version: 1,
    exported_at: new Date().toISOString(),
    catalog_snapshot: catalog,
    ssp, characterization, description, implementations, diagrams, logo,
  };

  const defaultName = `${ssp.system_name.replace(/\s+/g,'-').toLowerCase()}-backup.forge-backup`;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export SSP Backup',
    defaultPath: defaultName,
    filters:     [{ name: 'Forge Backup', extensions: ['forge-backup'] }],
  });
  if (canceled) return { success: false, canceled: true };

  try {
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8');
    return { success: true, filePath };
  } catch(err) {
    return { success: false, error: `Backup failed: ${err.message}` };
  }
});

ipcMain.handle('ssp:import-backup', async () => {
  const { randomUUID } = require('crypto');

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title:      'Import SSP Backup',
    filters:    [{ name: 'Forge Backup', extensions: ['forge-backup'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { success: false, canceled: true };

  let envelope;
  try {
    envelope = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
  } catch {
    return { success: false, error: 'File is not valid JSON.' };
  }

  if (!envelope.__forge_backup || envelope.backup_version !== 1) {
    return { success: false, error: 'Not a valid Forge backup file.' };
  }

  const { ssp, characterization, description, implementations, diagrams, logo, catalog_snapshot } = envelope;

  const db = getDb();

  // Check catalog compatibility
  const catalogExists = catalog_snapshot
    ? db.prepare('SELECT id FROM catalogs WHERE id = ?').get(catalog_snapshot.id)
    : null;

  const warnings = [];
  if (!catalogExists) {
    warnings.push(catalog_snapshot
      ? `Catalog "${catalog_snapshot.name} (${catalog_snapshot.version})" is not installed. Control implementations will be restored but may not resolve without the matching catalog.`
      : 'Original catalog is unknown. Control implementations may not resolve.'
    );
  }

  // Remap to new UUIDs
  const newSspId = randomUUID();
  const controlIdMap = {}; // old impl id → skipped (control refs stay as-is, catalog must match)

  const restore = db.transaction(() => {
    // ssp_drafts
    db.prepare(
      `INSERT INTO ssp_drafts (id, catalog_id, system_name, system_version, org_name, profile_href, oscal_version, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
    ).run(newSspId, ssp.catalog_id, `${ssp.system_name} (Restored)`, ssp.system_version||null, ssp.org_name||null, ssp.profile_href||null, ssp.oscal_version||'1.1.2');

    // ssp_characterization
    if (characterization) {
      const c = characterization;
      db.prepare(
        `INSERT OR IGNORE INTO ssp_characterization (ssp_id, system_identifier, security_category, impact_confidentiality, impact_integrity, impact_availability, operational_status, system_type, additional_info)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(newSspId, c.system_identifier||null, c.security_category||null, c.impact_confidentiality||null, c.impact_integrity||null, c.impact_availability||null, c.operational_status||null, c.system_type||null, c.additional_info||null);
    }

    // ssp_description
    if (description) {
      const d = description;
      db.prepare(
        `INSERT OR IGNORE INTO ssp_description (ssp_id, general_description, function_purpose, boundary_description, data_types, user_types, additional_info)
         VALUES (?,?,?,?,?,?,?)`
      ).run(newSspId, d.general_description||null, d.function_purpose||null, d.boundary_description||null, d.data_types||null, d.user_types||null, d.additional_info||null);
    }

    // ssp_implementations — only restore if control_id still exists in DB
    for (const impl of (implementations || [])) {
      const controlExists = db.prepare('SELECT id FROM controls WHERE id = ?').get(impl.control_id);
      if (!controlExists) continue; // skip orphaned refs
      db.prepare(
        `INSERT OR IGNORE INTO ssp_implementations (id, ssp_id, control_id, impl_status, control_origin, narrative, remarks, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,datetime('now'),datetime('now'))`
      ).run(randomUUID(), newSspId, impl.control_id, impl.impl_status||null, impl.control_origin||null, impl.narrative||null, impl.remarks||null);
    }

    // ssp_diagrams
    for (const diag of (diagrams || [])) {
      db.prepare(
        `INSERT OR IGNORE INTO ssp_diagrams (id, ssp_id, diagram_type, filename, mime_type, data, additional_info, created_at)
         VALUES (?,?,?,?,?,?,?,datetime('now'))`
      ).run(randomUUID(), newSspId, diag.diagram_type, diag.filename, diag.mime_type, diag.data, diag.additional_info||null);
    }

    // ssp_logo
    if (logo) {
      db.prepare(
        `INSERT OR IGNORE INTO ssp_logo (ssp_id, filename, mime_type, data, include_branding, created_at, updated_at)
         VALUES (?,?,?,?,?,datetime('now'),datetime('now'))`
      ).run(newSspId, logo.filename, logo.mime_type, logo.data, logo.include_branding ?? 1);
    }
  });

  try {
    restore();
    return {
      success: true,
      newSspId,
      systemName: `${ssp.system_name} (Restored)`,
      warnings,
    };
  } catch(err) {
    return { success: false, error: `Restore failed: ${err.message}` };
  }
});

// ---------------------------------------------------------------
// IPC — CSV Export
// ---------------------------------------------------------------
ipcMain.handle('ssp:export-csv', async (event, { sspId }) => {
  const db = getDb();

  const ssp = db.prepare('SELECT * FROM ssp_drafts WHERE id = ?').get(sspId);
  if (!ssp) return { success: false, error: 'SSP not found.' };

  const implementations = db.prepare(
    `SELECT i.impl_status, i.control_origin, i.narrative, i.remarks,
            c.control_id AS control_id_str, c.label, c.title, c.statement,
            cg.title AS group_title, cg.group_id
     FROM ssp_implementations i
     JOIN controls c ON c.id = i.control_id
     JOIN control_groups cg ON cg.id = c.group_id
     WHERE i.ssp_id = ? AND i.narrative IS NOT NULL AND i.narrative != ''
     ORDER BY cg.sort_order, c.sort_order`
  ).all(sspId);

  if (!implementations.length) {
    return { success: false, error: 'No controls have narrative text. Add at least one control implementation before exporting.' };
  }

  // Build CSV — escape fields containing commas, quotes, or newlines
  const escape = (val) => {
    if (val == null) return '';
    const s = String(val).replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headers = ['Control ID', 'Label', 'Family', 'Title', 'Status', 'Origin', 'Narrative', 'Remarks'];
  const rows = implementations.map(i => [
    escape(i.control_id_str),
    escape(i.label),
    escape(i.group_title),
    escape(i.title),
    escape(i.impl_status),
    escape(i.control_origin),
    escape(i.narrative),
    escape(i.remarks),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\r\n');

  const defaultName = `ssp-${ssp.system_name.replace(/\s+/g, '-').toLowerCase()}-controls.csv`;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export CSV',
    defaultPath: defaultName,
    filters:     [{ name: 'CSV File', extensions: ['csv'] }],
  });
  if (canceled) return { success: false, canceled: true };

  try {
    fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8'); // BOM for Excel UTF-8 compatibility
    db.prepare(`UPDATE ssp_drafts SET updated_at=datetime('now') WHERE id=?`).run(sspId);
    return { success: true, filePath };
  } catch(err) {
    return { success: false, error: `CSV export failed: ${err.message}` };
  }
});

// ---------------------------------------------------------------
// IPC — PDF Export
// ---------------------------------------------------------------
ipcMain.handle('ssp:export-pdf', async (event, { sspId }) => {
  const { serializePdf } = require('../../shared/pdf-serializer');
  const db = getDb();

  const ssp = db.prepare(`SELECT s.*, c.name AS catalog_name FROM ssp_drafts s JOIN catalogs c ON c.id=s.catalog_id WHERE s.id=?`).get(sspId);
  if (!ssp) return { success: false, error: 'SSP not found.' };

  const characterization = db.prepare('SELECT * FROM ssp_characterization WHERE ssp_id=?').get(sspId) || {};
  const description      = db.prepare('SELECT * FROM ssp_description WHERE ssp_id=?').get(sspId) || {};
  const diagrams         = db.prepare('SELECT * FROM ssp_diagrams WHERE ssp_id=?').all(sspId);
  const logo             = db.prepare('SELECT * FROM ssp_logo WHERE ssp_id=?').get(sspId) || null;
  const implementations  = db.prepare(
    `SELECT i.*,c.control_id AS control_id_str,c.label,c.title,c.statement,
            cg.title AS group_title,cg.group_id
     FROM ssp_implementations i
     JOIN controls c ON c.id=i.control_id
     JOIN control_groups cg ON cg.id=c.group_id
     WHERE i.ssp_id=? AND i.narrative IS NOT NULL AND i.narrative!=''
     ORDER BY cg.sort_order,c.sort_order`
  ).all(sspId);

  if (!implementations.length) {
    return { success: false, error: 'No controls have narrative text. Add at least one control implementation before exporting.' };
  }

  if (description.user_types) {
    try { description.user_types = JSON.parse(description.user_types); }
    catch { description.user_types = []; }
  }

  const defaultName = `ssp-${ssp.system_name.replace(/\s+/g,'-').toLowerCase()}.pdf`;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export PDF',
    defaultPath: defaultName,
    filters:     [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (canceled) return { success: false, canceled: true };

  try {
    const buf = await serializePdf({ ssp, characterization, description, diagrams, logo, implementations });
    fs.writeFileSync(filePath, buf);
    db.prepare(`UPDATE ssp_drafts SET status='exported', updated_at=datetime('now') WHERE id=?`).run(sspId);
    return { success: true, filePath };
  } catch(err) {
    console.error('[export-pdf]', err.message);
    return { success: false, error: `Export failed: ${err.message}` };
  }
});