const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('forge', {

  catalog: {
    list:       ()     => ipcRenderer.invoke('catalog:list'),
    importFile: ()     => ipcRenderer.invoke('catalog:import-file'),
    ingest:     (args) => ipcRenderer.invoke('catalog:ingest', args),
    setActive:  (args) => ipcRenderer.invoke('catalog:set-active', args),
    delete:     (args) => ipcRenderer.invoke('catalog:delete', args),
    getTree:    (args) => ipcRenderer.invoke('catalog:get-tree', args),
  },

  ssp: {
    list:        ()     => ipcRenderer.invoke('ssp:list'),
    create:      (args) => ipcRenderer.invoke('ssp:create', args),
    get:         (args) => ipcRenderer.invoke('ssp:get', args),
    getFull:     (args) => ipcRenderer.invoke('ssp:get-full', args),
    saveControl: (args) => ipcRenderer.invoke('ssp:save-control', args),
    delete:      (args) => ipcRenderer.invoke('ssp:delete', args),
    export:      (args) => ipcRenderer.invoke('ssp:export', args),
    exportDocx:  (args) => ipcRenderer.invoke('ssp:export-docx', args),
    exportPdf:   (args) => ipcRenderer.invoke('ssp:export-pdf', args),
    preflight:   (args) => ipcRenderer.invoke('ssp:preflight', args),

    getCharacterization:  (args) => ipcRenderer.invoke('ssp:get-characterization', args),
    saveCharacterization: (args) => ipcRenderer.invoke('ssp:save-characterization', args),

    getDescription:  (args) => ipcRenderer.invoke('ssp:get-description', args),
    saveDescription: (args) => ipcRenderer.invoke('ssp:save-description', args),

    getDiagrams:     (args) => ipcRenderer.invoke('ssp:get-diagrams', args),
    getDiagramData:  (args) => ipcRenderer.invoke('ssp:get-diagram-data', args),
    saveDiagram:     (args) => ipcRenderer.invoke('ssp:save-diagram', args),
    saveDiagramNote: (args) => ipcRenderer.invoke('ssp:save-diagram-note', args),
    deleteDiagram:   (args) => ipcRenderer.invoke('ssp:delete-diagram', args),

    getLogo:      (args) => ipcRenderer.invoke('ssp:get-logo', args),
    saveLogo:     (args) => ipcRenderer.invoke('ssp:save-logo', args),
    deleteLogo:   (args) => ipcRenderer.invoke('ssp:delete-logo', args),
    setBranding:  (args) => ipcRenderer.invoke('ssp:set-branding', args),
  },

  shell: {
    showFile: (args) => ipcRenderer.invoke('shell:show-file', args),
  },

  app: {
    version: () => ipcRenderer.invoke('app:version'),
  },

  updater: {
    installNow: () => ipcRenderer.invoke('updater:install-now'),
    on: (channel, cb) => {
      const valid = ['updater:checking','updater:available','updater:not-available','updater:progress','updater:downloaded','updater:error'];
      if (!valid.includes(channel)) return;
      const handler = (_, ...args) => cb(...args);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
});
