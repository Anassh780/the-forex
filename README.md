# EdgeLedger

A custom dark-mode trading education and strategy proof platform built with Next.js 14, TypeScript, Tailwind, Framer Motion, Zustand, Prisma, NextAuth, Stripe, Firebase Storage, and Recharts.

## Run locally

1. Copy `.env.example` to `.env` and fill in the NextAuth and integration values you need.
2. Install packages with `pnpm install`.
3. Create or synchronize the local SQLite database with `pnpm exec prisma db push`.
4. Seed representative local data with `pnpm exec prisma db seed` (optional).
5. Start with `pnpm dev`.

Local development stores SQLite data in `prisma/dev.db`. Account registration, login, Stripe checkout, and authenticated API routes require their corresponding environment variables.

## Deploy to Vercel

The repository includes `vercel.json`, a Vercel-specific build script, Prisma Client generation after install, and a deployment preflight that reports incomplete integrations without blocking the public site build.

Vercel functions cannot persist a local SQLite file. Production therefore uses Turso, which is SQLite-compatible and preserves the existing Prisma data model:

1. Create a Turso database and token.
2. Apply every SQL file in `prisma/migrations` to the Turso database in filename order.
3. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to Vercel Production and Preview environments.
4. Add all remaining values from `.env.example`. Set `NEXTAUTH_URL` and `GOOGLE_DRIVE_REDIRECT_URI` to the final HTTPS production domain.
5. In Google Cloud Console, register the same production callback URL under authorized redirect URIs.
6. Use Firebase inline credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`) on Vercel; a local service-account file path is not available there.

User profile, feedback, and support attachments use Firebase Storage in production. Course videos continue to upload directly to Google Drive or Firebase through signed upload URLs, avoiding Vercel's function payload limit. Google Drive refresh tokens are encrypted and stored in the database rather than on the function filesystem.

For Google Drive OAuth, register `https://YOUR-DOMAIN/api/google-drive/callback` in the OAuth client's authorized redirect URIs. The app also supports the legacy fallback callback `https://YOUR-DOMAIN/api/gooo` for older Google clients that were created with that path. On Vercel, the app automatically replaces a leftover localhost callback with the current deployment origin, but Google Cloud must still list the exact HTTPS callback used by the deployed site.

An existing Drive authorization can be restored on a new deployment by setting the server-only `GOOGLE_DRIVE_REFRESH_TOKEN`, `GOOGLE_DRIVE_ACCOUNT_EMAIL`, and `GOOGLE_DRIVE_ACCOUNT_NAME` variables. Never commit the refresh token. Local development automatically migrates the legacy `.data/google-drive-token.json` connection into the database when it is available.

## Access control

The landing page, login, signup, and authentication endpoints are public. Courses, strategies, member dashboards, VIP content, admin tools, checkout, and upload APIs require a valid NextAuth session. The admin console and upload endpoint additionally require the user role to be `admin`.

## Firebase content storage

Create a Firebase project, open **Build > Storage**, and create the default Storage bucket. Firebase's current docs require the project to be on the Blaze plan for Cloud Storage. Buckets in `US-CENTRAL1`, `US-EAST1`, and `US-WEST1` can use Google Cloud Storage's Always Free tier.

Open **Project settings > Service accounts**, generate a new private key JSON file, and keep it outside the repository. Add these values to `.env.local`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH="C:\\path\\to\\firebase-service-account.json"
FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
FIREBASE_STORAGE_FOLDER="EdgeLedger Content"
MAX_UPLOAD_MB="20480"
```

After restarting the website, sign into an administrator account and open `/admin`. Uploads use short-lived Firebase signed URLs, so files travel directly from the browser to Firebase Storage while the service-account key stays on the server.

## Product routes

- `/` landing and evidence overview
- `/courses` and `/courses/market-structure`
- `/strategies` and `/strategies/london-liquidity-reversal`
- `/login`, `/signup`, `/vip`
- `/dashboard`, `/admin`

Production integrations should connect playback IDs, Stripe webhooks for entitlements, and production Firebase Storage rules.
