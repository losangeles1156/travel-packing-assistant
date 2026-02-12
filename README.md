# Travel Packing Assistant

## Local Development

Prerequisite: Node.js 20+

1. Install dependencies: `npm install`
2. Start frontend: `npm run dev`
3. Start backend API (another terminal): `npm run server`

By default, frontend runs at `http://localhost:3000` and proxies `/api` to backend `http://localhost:4000`.

## Deployment Target

- Frontend: Vercel
- Backend API: Zeabur

## Environment Variables

Copy `.env.example` and fill values per platform.

### Vercel (Frontend)

- `VITE_API_BASE_URL`: Zeabur backend base URL, e.g. `https://your-backend.zeabur.app`
- `VITE_ENABLE_PWA`: optional, set `1` to enable PWA build output. Default is disabled.

### Zeabur (Backend)

- `ALLOWED_ORIGIN`: comma-separated frontend origins allowed by CORS  
  Example: `https://your-app.vercel.app,https://your-app-git-main-yourteam.vercel.app`
- `ADMIN_TOKEN`: required in production for `/api/admin/*`
- `TRUST_PROXY`: proxy trust setting (default `1` for Zeabur)
- `SHARE_TTL_DAYS`: share link validity window (default `30`)
- `EVENT_RETENTION_DAYS`: events/sessions/users retention days for auto-cleanup (default `180`)
- `AUTO_CLEANUP_INTERVAL_HOURS`: cleanup interval in hours (default `24`)
- `ENABLE_ADMIN_BACKUP`: set `1` only when you intentionally need `/api/admin/backup` in production
- `PORT`: optional on local; Zeabur provides it automatically

## Build & Checks

- Type check: `npm run lint`
- Production build: `npm run build`
- Deploy smoke test:
  - `BACKEND_URL=https://<zeabur-backend> FRONTEND_URL=https://<vercel-domain> npm run smoke:deploy`

## Zeabur + Vercel Deployment Notes

1. Deploy backend service from this repo on Zeabur using start command `npm run start`.
2. Confirm backend health: `GET /api/health` should return `{ "ok": true }`.
3. Deploy frontend to Vercel.
4. Set `VITE_API_BASE_URL` in Vercel project settings to your Zeabur API URL.
5. Add the Vercel domain(s) into Zeabur `ALLOWED_ORIGIN`.
6. Follow full checklist: `docs/deployment/zeabur-vercel-checklist.md`
