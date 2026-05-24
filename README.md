# Anvil FORGE

**OSCAL System Security Plan Builder** by GeneDevStudios

Sister app to [AnvilCRAFT](https://github.com/GeneDevStudios). Build SSPs in OSCAL format, export directly into AnvilCRAFT's SSP import flow.

---

## Stack

| Layer | Technology |
|---|---|
| Shell | Electron 29 |
| Frontend | React 18 + Vite |
| Database | SQLite (better-sqlite3) — local, zero setup |
| Catalogs | OSCAL JSON — import any NIST/CIS/AnvilCRAFT-formatted catalog |
| Updates | electron-updater → GitHub Releases |
| Builds | electron-builder (Mac, Windows, Linux) |

---

## Development

```bash
npm install
npm run dev        # Starts Vite dev server + Electron simultaneously
```

Requires Node 20+.

---

## Importing the NIST 800-53 Rev 5 Catalog

Download the official OSCAL catalog from NIST:

```bash
curl -O https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json
```

Then use **Catalogs → Import Catalog JSON** in the app to load it.

---

## Building

```bash
npm run build:mac    # .dmg + .zip (x64 + arm64)
npm run build:win    # .exe installer + portable
npm run build:linux  # .AppImage + .deb
npm run build:all    # All three platforms
```

Output goes to `dist/`.

---

## Releases & Auto-Update

Auto-updates are powered by `electron-updater` reading from GitHub Releases on this repo.

**To publish a release:**

1. Tag the commit: `git tag v1.0.0 && git push origin v1.0.0`
2. GitHub Actions builds all three platforms automatically
3. The workflow creates a GitHub Release with all artifacts
4. Running instances check for updates on launch and every 4 hours

Mac and Windows users get auto-download + restart-to-install.
Linux users get a notification banner with a link to download manually.

---

## Code Signing

Currently unsigned. Users will see OS warnings on first launch.

**Mac bypass:** Right-click the app → Open → Open anyway
**Windows bypass:** "More info" → "Run anyway" on SmartScreen

To add signing, set these GitHub secrets:
- `CSC_LINK` — base64-encoded certificate (.p12)
- `CSC_KEY_PASSWORD` — certificate password

---

## Project Structure

```
anvil-forge/
├── src/
│   ├── main/
│   │   ├── index.js      # Electron main process — IPC, SQLite, updater
│   │   └── preload.js    # Secure IPC bridge to renderer
│   └── renderer/
│       ├── index.html
│       ├── vite.config.js
│       └── src/
│           ├── main.jsx  # React entry point
│           └── App.jsx   # Full React application
├── shared/
│   ├── oscal-normalizer.js   # NIST OSCAL → internal model
│   └── oscal-serializer.js   # Internal model → AnvilCRAFT OSCAL SSP
├── assets/
│   ├── icons/            # icon.icns / icon.ico / icon.png
│   └── catalogs/         # Bundled catalog JSONs (optional)
├── build/
│   └── entitlements.mac.plist
├── .github/workflows/
│   └── build.yml         # CI/CD — builds + publishes releases
└── package.json
```

---

## Icons

Drop replacement icons into `assets/icons/`:
- `icon.icns` — Mac (1024×1024 recommended)
- `icon.ico`  — Windows (256×256 minimum)
- `icon.png`  — Linux (512×512 recommended)

Free tool to generate all three from a single PNG: **electron-icon-builder** or **icongenie**.
