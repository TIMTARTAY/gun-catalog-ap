Firearm Catalog V4
===================

NEW IN VERSION 4
- Automatic migration of existing Version 3 records on the same browser
- Multiple compressed photos per firearm
- Attached receipts, manuals, warranties and other documents
- Accessory values and serial numbers
- Ammunition inventory with caliber, brand, quantity, lot and location
- Maintenance, cleaning, inspection and repair logs
- Upcoming and overdue maintenance reminders inside the app
- Collection statistics and printable insurance reports
- Standard JSON backups
- AES-GCM encrypted backups protected by a passphrase
- PIN lock, dark mode, offline support and installable PWA behavior
- Printable item identification labels

INSTALL / UPDATE ON GITHUB PAGES
1. Upload all six files to the root of the existing repository:
   README.txt, index.html, manifest.json, service-worker.js, icon-192.png, icon-512.png
2. Commit directly to the main branch.
3. GitHub Pages will redeploy automatically.
4. Open the published site and refresh it.
5. If the home-screen app still shows Version 3, close it fully and reopen it. If needed,
   remove the old home-screen icon and add the site to the home screen again.

DATA MIGRATION
When Version 4 first opens in the same Safari/Chrome browser used for Version 3, it checks for
the Version 3 local database and copies those firearm records into Version 4. It does not delete
the Version 3 copy.

SECURITY AND PRIVACY
- Data stays in the local browser unless a backup is exported.
- The PIN is a casual-access lock and is not full database encryption.
- Use the encrypted backup option for sensitive exported backup files.
- Protect each device with a passcode or biometrics.
- Do not commit personal inventory records or backups to the public GitHub repository.

CROSS-DEVICE USE
Export a standard or encrypted backup on one device and import it on another.
Automatic real-time cloud synchronization requires a secure backend, authentication and a
private database. It is not enabled in this static GitHub Pages package.

STORAGE
Photos and documents use browser storage. Storage limits vary. Export backups regularly and
avoid unnecessarily large attachments.
