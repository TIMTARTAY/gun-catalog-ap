Firearm Catalog V7.2.0

FIXED
- Firearm edits are merged, written to Supabase, and verified before showing success.
- Firearm deletions use deletion tombstones and are re-applied after cloud merge so deleted records cannot be restored.
- Cloud errors are shown in Backup & Security instead of reporting a false success.
- The service worker uses a new V7.2 cache and always checks the network for the app page.
- The heading and storage information clearly show V7.2.0.

INSTALL
1. Upload all files in this ZIP to the root of the GitHub repository.
2. Replace the existing files.
3. Commit message: Release V7.2.0 - Fix cloud edit delete and multi-device sync
4. Wait about two minutes for GitHub Pages to deploy.
5. Open the website on each device and refresh twice.
6. Confirm the heading says Firearm Catalog V7.2 Professional.
7. Sign in with the same account and tap Sync Now.

IMPORTANT
Export a backup from the device holding the correct inventory before installing.
