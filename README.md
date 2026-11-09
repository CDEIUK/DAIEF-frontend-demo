
# DAIEF-frontend-demo

Testing the content, logic and interactivity of the DAIEF self-assessment tool.

## Development

Install dependencies and start the preview locally:

```bash
npm install
npm run dev
```

The survey definition is bundled from `daief-survey.json`, so no API server is required.

### Saved progress files

Saved progress JSON files contain the current `formVersion`, survey responses in `stageData` and completed question set IDs in `completedQuestionSets`, grouped by stage. Only files saved with the current form version can be restored. Older files without `completedQuestionSets` can still be restored if their form version matches; their question sets will start as incomplete.

### Links in survey text

Use a Markdown link in the field text or hint text, for example:

```json
"description": "Read the [guidance](https://example.gov/guidance)."
```

The app renders HTTP(S) Markdown links in question titles and descriptions. Other content is rendered as text.

When generating the survey JSON, the script reads `schema-input.csv`. It accepts a header row first, or a form-version row followed by the schema headers. Put anchor text in square brackets in the `Field text` cell and its destination URL(s) in the `Field text hyperlinks` cell (also accepted as `Field text link`). Separate multiple URLs with line breaks. Anchors and URLs are paired in order; if there are fewer URLs than anchors, the last URL is reused, and extra URLs are ignored.

## Public demo

The `main` branch deploys automatically to GitHub Pages at:

https://cdeiuk.github.io/DAIEF-frontend-demo/
