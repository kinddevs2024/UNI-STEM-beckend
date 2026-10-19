# Olympiad logo delivery fix — 2026-10-19

The production release omitted the tracked `pages/api/uploads/[...path].js` route. Uploads succeeded and files existed in shared storage, but their public URLs returned Next.js HTML 404 responses. The replacement backend release includes that route; preserve it when copying source or assembling deployment archives (exclude only the root uploads data directory, never all directories named uploads).

The admin logo handler now awaits the database update before reporting success. Existing logo files are retained during replacement so cached pages continue to work and a failed replacement cannot remove the previous logo.

Validation: production-source staged build passed; the new build served the affected real PNG with HTTP 200 and bytes matching the stored file's SHA-256. After switching production, public PNG and API health passed. Chrome decoded the image at 1600 by 900. No olympiad visibility or student records were changed. A fresh authenticated upload through the admin form has not been tested in this run.
