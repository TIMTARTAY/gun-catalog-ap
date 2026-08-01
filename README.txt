Firearm Catalog V3
===================

WHAT IS INCLUDED
- Installable phone/tablet/desktop PWA
- Firearm inventory with multiple photos
- Accessory tracking
- Search and filters
- Storage-location tracking
- Purchase price and estimated value totals
- PIN lock
- Dark mode
- JSON backup/import for moving data between devices
- Printable inventory report and item labels
- Offline support after the first successful load

IMPORTANT PRIVACY NOTE
Your records and photos are stored in the browser on each device. Use Export Backup regularly.
The PIN prevents casual access but is not full encryption. Keep the device protected with its own
passcode/biometrics and do not publish real inventory data in the GitHub repository.

HOW TO INSTALL ON GITHUB PAGES
1. Upload all files from this folder to the repository's main branch.
2. In GitHub, open Settings > Pages.
3. Under Build and deployment, choose "Deploy from a branch."
4. Select branch "main" and folder "/ (root)", then Save.
5. Wait for GitHub Pages to publish the link.
6. Open that link in Safari or Chrome.
7. iPhone/iPad: Share > Add to Home Screen.
8. Android: Chrome menu > Add to Home screen or Install app.

MOVING THE CATALOG TO ANOTHER DEVICE
1. On the first device, open Backup & Sync > Export Backup.
2. Send the JSON file to the second device using Files, Drive, email, or another secure method.
3. On the second device, open Backup & Sync > Import Backup.

AUTOMATIC CLOUD SYNC
Automatic sync is intentionally not enabled in this package because it requires a private database
and secure authentication. Manual export/import is ready now and avoids exposing sensitive inventory.
