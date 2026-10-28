
# DAIEF-frontend-demo

Testing the content, logic and interactivity of the DAIEF self-assessment tool.

## Development

Install dependencies and start the preview locally:

```bash
npm install
npm run dev
```

The survey definition is bundled from `daief-survey.json`, so no API server is required.

### Links in survey text

Use a Markdown link in the field text or hint text, for example:

```json
"description": "Read the [guidance](https://example.gov/guidance)."
```

The app renders HTTP(S) Markdown links in question titles and descriptions. Other content is rendered as text.

When generating the survey JSON, the script reads the `schema-input` table from `Interactive DAIEF schema (APP).xlsx`. Put anchor text in square brackets in the `Field text` cell and its destination URL(s) in the `Field text hyperlinks` cell (also accepted as `Field text link`). Separate multiple URLs with line breaks. Anchors and URLs are paired in order; if there are fewer URLs than anchors, the last URL is reused, and extra URLs are ignored.

To regenerate the survey JSON whenever the workbook changes, run `python3 watch-schema.py` from the project folder. The watcher uses Python's standard library, waits for the workbook to finish saving, and can be stopped with Ctrl+C.

On macOS, double-click `Preview Survey.command` to generate the survey, start the local preview and workbook watcher, and open the site in your browser. The first launch installs the JavaScript dependencies if needed. Node.js, npm, and Python 3 must be installed. Keep the Terminal window open while working; press Ctrl+C in it to stop the preview and watcher.

In GitHub Codespaces, run `bash "Preview Survey.command"` in the integrated terminal. The launcher binds the preview to the forwarded port and prints its URL; if it cannot find the Codespaces URL, open port 5173 from the **Ports** tab. Keep the terminal process running while editing the workbook. The `.xlsx` file must be present in the Codespace workspace (for example, committed to the repository); files that exist only on someone's computer are not available in the Codespace.

## Public demo

The `main` branch deploys automatically to GitHub Pages at:

https://cdeiuk.github.io/DAIEF-frontend-demo/
