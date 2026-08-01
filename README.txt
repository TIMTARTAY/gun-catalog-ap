Firearm Catalog V5 Pro
=======================

This is the structured Version 5 release.

FILES
- index.html: application layout
- app.css: all appearance and mobile styling
- app.js: application features and local storage
- manifest.json: installable web-app information
- service-worker.js: offline support and update handling
- icon-192.png / icon-512.png: application icons

FEATURES
- Firearm inventory
- Accessories linked to each firearm
- Multiple photos and documents
- Ammunition tracking
- Maintenance history and alerts
- Search, filtering and sorting
- Collection value reports
- CSV export and printable PDF reports
- Standard JSON backup
- AES-GCM encrypted backup
- PIN lock and dark mode
- Version 3 / Version 4 migration support
- Network-first page updates to reduce stale-cache problems

SAFE UPGRADE STEPS
1. Open the current app.
2. Go to Backup & Security and export a backup.
3. Keep the backup private. Do not upload it to GitHub.
4. Upload every file in this package to the ROOT of the repository.
5. Replace files with the same names.
6. Commit with: Upgrade to Firearm Catalog V5 Pro
7. Wait for GitHub Pages to deploy.
8. Open:
   https://timtartay.github.io/gun-catalog-ap/
9. Refresh once.
10. If the Home Screen app still shows Version 4, delete its icon and add it again from Safari.

GITHUB PAGES SETTINGS
- Source: Deploy from a branch
- Branch: main
- Folder: / (root)

PRIVACY
Serial numbers, receipts, storage locations and backup files are sensitive.
Never place exported backup files in the public GitHub repository.
