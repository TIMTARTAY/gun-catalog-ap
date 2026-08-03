Firearm Catalog V8.0.0 — Complete Rebuild

WHAT CHANGED
- The real application code is now in app.js.
- The real styling is now in app.css.
- index.html loads those files directly.
- Edit, delete, and other saves replace the user's complete Supabase catalog row.
- Each cloud write is read back and verified before success is shown.
- A new service-worker cache forces devices to load V8 files.

INSTALL
1. Export a backup from the app first.
2. Upload every file in this ZIP to the repository root.
3. Replace the existing files, including app.js and app.css.
4. Commit message: V8 complete rebuild
5. Wait about two minutes.
6. Open the website and refresh twice.
7. Confirm the heading says Firearm Catalog V8 Professional.
8. Sign in and tap Sync Now.
9. Test editing and deleting the test firearm.
