Firearm Catalog V6 Cloud
========================

WHAT THIS VERSION ADDS
- Secure email/password accounts through your own Supabase project
- Automatic synchronization across phones, tablets and computers
- Live updates when another signed-in device changes the catalog
- Offline local saving; reconnecting uploads the newest local catalog
- Sync status in the app header
- Existing V5 local records remain available and can be uploaded on first sign-in
- Manual and encrypted backups remain available

FIRST: CREATE THE PRIVATE CLOUD DATABASE
1. Create a free Supabase project at supabase.com.
2. Open SQL Editor, create a new query, paste the complete contents of
   supabase-setup.sql, and press Run.
3. Open Project Settings > API.
4. Copy the Project URL.
5. Copy the anon/public or publishable key. NEVER use the service-role key.
6. In Supabase Authentication settings, keep email/password enabled.

UPLOAD TO GITHUB PAGES
Upload these seven files to the ROOT of the existing repository and replace files
with the same names:
- index.html
- manifest.json
- service-worker.js
- icon-192.png
- icon-512.png
- README.txt
- supabase-setup.sql

Commit with: Upgrade to Firearm Catalog V6 Cloud
Wait for GitHub Pages to deploy, then open the site and refresh once.

CONNECT THE APP
1. Open Backup in the app, then Cloud Sync > Set Up / Sign In.
2. Paste the Supabase Project URL and anon/publishable key.
3. Save the connection. The app reloads.
4. Open Cloud Sync again and create an account or sign in.
5. On the first device, choose OK to upload its local catalog.
6. On every additional device, use the same email/password and choose Cancel when
   asked whether to replace the existing cloud catalog. This downloads the cloud copy.

SECURITY
- Row Level Security in supabase-setup.sql restricts each account to its own row.
- Do not place firearm records, serial numbers, receipts, backup files, passwords,
  or the service-role key in GitHub.
- The public anon/publishable key is designed for browser apps only when RLS is enabled.
- Continue keeping encrypted offline backups.

CURRENT STORAGE DESIGN
For compatibility with the single-file V5 app, the complete catalog—including attached
photos/documents—is stored as one private JSON record. Very large photo/document libraries
may exceed practical database limits. A future upgrade can move attachments into a private
Supabase Storage bucket.
