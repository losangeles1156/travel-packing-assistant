# Zeabur + Vercel Deployment Checklist

## 0. Preconditions
- Branch has passed:
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - `npm run test:e2e:mobile-risk`

## 1. Deploy Backend to Zeabur
- Service type: Node.js
- Root directory: repository root
- Install command: `npm ci`
- Build command: (none required)
- Start command: `npm run start`

Set Zeabur environment variables:
- `NODE_ENV=production`
- `PORT` (Zeabur injects automatically; keep default behavior)
- `ALLOWED_ORIGIN=https://<your-vercel-domain>`
- `ADMIN_TOKEN=<strong-random-token>`
- `TRUST_PROXY=1`
- `SHARE_TTL_DAYS=30`
- `EVENT_RETENTION_DAYS=180`
- `AUTO_CLEANUP_INTERVAL_HOURS=24`
- `ENABLE_ADMIN_BACKUP=0`

After deploy, verify:
- `GET https://<zeabur-backend>/api/health` returns `{ "ok": true }`

## 2. Deploy Frontend to Vercel
- Framework preset: Vite (auto-detected from `vercel.json`)
- Build command: `npm run build`
- Output directory: `dist`

Set Vercel environment variable:
- `VITE_API_BASE_URL=https://<zeabur-backend>`
- Optional: `VITE_ENABLE_PWA=1` only if you intentionally want PWA enabled

Recommended:
- Configure env var for `Production`, `Preview`, and `Development` in Vercel.

## 3. CORS Alignment
- Ensure Zeabur `ALLOWED_ORIGIN` includes:
  - Production domain: `https://<your-vercel-domain>`
  - Preview domain pattern in use (if needed): `https://<your-project>-git-main-<team>.vercel.app`

If you use multiple domains, join by commas in `ALLOWED_ORIGIN`.

## 4. Smoke Test (Post Deploy)
Use:

```bash
BACKEND_URL="https://<zeabur-backend>" \
FRONTEND_URL="https://<your-vercel-domain>" \
npm run smoke:deploy
```

Checks performed:
- Backend health endpoint
- Share API create/get roundtrip
- Frontend reachability
- CORS preflight allows the configured frontend origin

## 5. Rollback Plan
- Vercel: restore previous deployment from Deployments tab.
- Zeabur: redeploy previous successful backend release.
- If severe issue: set Vercel env `VITE_API_BASE_URL` to last known stable backend and redeploy frontend.
