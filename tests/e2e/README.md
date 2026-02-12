# E2E Mobile Acceptance

## Scope
- Verify mobile fixed bottom CTA behavior.
- Verify risk card interaction flow (detail toggle, bulk resolve, undo).

## Run
1. Install dependencies: `npm install`
2. Install browser: `npx playwright install chromium`
3. Run only this acceptance script: `npm run test:e2e:mobile-risk`

## Notes
- Test uses mobile project `mobile-chromium` (`iPhone 13` viewport).
- Playwright auto-starts Vite dev server on `http://127.0.0.1:4173`.
