---
description: Review the UI/UX design of the application using the Pencil tool.
---

This workflow helps in reviewing and improving the application's design using the Pencil MCP.

# Steps

1. **Analyze Current State**:
   - Navigate to the page you want to review in the browser.
   - Take a screenshot using `pencil.get_screenshot`.

   ```bash
   # Example: Get screenshot of a specific component or page
   # internal tool call, no CLI command
   ```

2. **Compare with Design System**:
   - Check if the current implementation matches the design guidelines.
   - Use `pencil.get_style_guide` to retrieve relevant style guides.

3. **Identify Improvements**:
   - Look for alignment issues, spacing inconsistencies, or color mismatches.
   - Check mobile responsiveness.

4. **Propose Changes**:
   - Describe the necessary CSS/Design changes.
   - Use `pencil` tools (like `batch_design` if editing a .pen file, or standard file editing for code) to implement updates.
