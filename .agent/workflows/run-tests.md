---
description: Run Playwright end-to-end tests against a local development server.
---

This workflow runs the end-to-end test suite using Playwright. It automatically starts both the backend and frontend servers before running the tests.

# Prerequisites

- Ensure dependencies are installed: `npm install`
- Ensure Playwright browsers are installed: `npx playwright install`

# Steps

1. Run the tests using the `with_server.py` helper script:

   ```bash
   python scripts/with_server.py \
     --server "npm run server" --port 4000 \
     --server "npm run dev" --port 3000 \
     -- npx playwright test
   ```

   **Note:** The `with_server.py` script handles waiting for the servers to be ready.

2. Creating a new test file?

   When writing new Playwright tests, ensure you wait for the `networkidle` state to guarantee the page is fully loaded before interacting with elements:

   ```javascript
   await page.goto('/');
   await page.waitForLoadState('networkidle');
   ```
