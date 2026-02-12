---
description: Deploy the application to production, including pre-deployment checks.
---

This workflow guides you through the process of deploying the Travel Packing Assistant.

# Pre-Deployment Checks

1. **Lint and Type Check**:
   Ensure the code follows project standards and has no type errors.
   // turbo
   ```bash
   npm run lint
   ```

2. **Run Tests**:
   Verify that all tests pass.
   // turbo
   ```bash
   # Use the run-tests workflow or run directly:
   npm run test:e2e
   ```

3. **Performance Check (Vercel Best Practices)**:
   - Review recent changes against `vercel-react-best-practices`.
   - Check for any `async-` waterfall issues in data fetching.
   - ensuring bundle size is optimized (avoid large imports).

# Build

1. **Build for Production**:
   Create the production build artifacts.
   // turbo
   ```bash
   npm run build
   ```

# Deploy

1. **Deploy Backend (Zeabur)**:
   - Push changes to the branch connected to Zeabur (usually `main`).
   - Monitor the deployment logs on Zeabur dashboard.
   - Verify health check: `GET <BACKEND_URL>/api/health`

2. **Deploy Frontend (Vercel)**:
   - Push changes to the branch connected to Vercel (usually `main`).
   - Monitor the deployment logs on Vercel dashboard.
   - Verify the live site.

# Post-Deployment Verification

1. **Smoke Test**:
   Run the smoke test script against the deployed environment.
   ```bash
   BACKEND_URL=<YOUR_BACKEND_URL> FRONTEND_URL=<YOUR_FRONTEND_URL> npm run smoke:deploy
   ```
