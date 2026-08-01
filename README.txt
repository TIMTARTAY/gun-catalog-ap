Firearm Catalog V5 Ultimate
============================

WHAT IS NEW
- Automatic migration of Version 3 and Version 4 browser records
- Firearm inventory with photos, documents, accessories, values and locations
- Ammunition inventory
- Maintenance history and upcoming/overdue alerts
- Search, filters, sorting, printable reports and CSV export
- Standard JSON backups and AES-GCM encrypted backups
- PIN lock, dark mode, offline PWA support
- Network-first app updates to prevent old versions remaining cached

INSTALL / UPDATE ON GITHUB PAGES
1. Keep a backup from your current app before updating.
2. Upload all six files in this package to the ROOT of your existing repository:
   README.txt, index.html, manifest.json, service-worker.js, icon-192.png, icon-512.png
3. Replace files with the same names.
4. Commit changes with the message: Upgrade to Firearm Catalog V5 Ultimate
5. Wait for GitHub Pages to deploy.
6. Open the exact project address:
   https://timtartay.github.io/gun-catalog-ap/
7. Refresh once. Version 5 will migrate compatible Version 3/4 records saved in that browser.
8. Delete and re-add the Home Screen icon if the installed app still displays an old title.

IMPORTANT PRIVACY NOTES
- Records are stored locally in the browser/device.
- Browser clearing or device loss can erase local records.
- Export backups regularly and store them privately.
- Do not upload backup files, serial numbers, receipts or inventory data to a public GitHub repository.
- PIN lock helps with casual access but does not replace device security.
