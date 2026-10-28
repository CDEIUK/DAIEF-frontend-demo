
# DAIEF-frontend-demo

Testing the content, logic and interactivity of the DAIEF self-assessment tool.

## Development

Install the JavaScript and Python dependencies, then start the preview:

```bash
npm install
python3 -m pip install -r requirements.txt
npm run dev
```

The survey definition is generated into `translated-survey.json` from `form-content.yaml`.
Run the watcher in a separate terminal to regenerate it when the YAML changes:

```bash
python3 watch-schema.py
```

The Vite preview reloads when the generated JSON changes. The watcher generates the survey once
when it starts, then waits for saved YAML edits.

### Links in survey text

Use a Markdown link in the field text or hint text, for example:

```json
"description": "Read the [guidance](https://example.gov/guidance)."
```

The app renders HTTP(S) Markdown links in question titles and descriptions. Other content is rendered as text.

Edit `form-content.yaml` to change the survey. Questions are grouped by section and appear in the listed order. Put anchor text in square brackets in `field_text` and its destination URL(s) in `field_text_hyperlinks`, one URL per line. Anchors and URLs are paired in order; if there are fewer URLs than anchors, the last URL is reused, and extra URLs are ignored.

Each question has a `reference`, `field_text`, and `component_type`. Optional keys include `trigger`, `daief_themes`, `options` (labels `a` through `e`), `field_text_hyperlinks`, and `hint_text`. For example:

```yaml
sections:
  - name: Discovery
    questions:
      - reference: "1"
        field_text: "Have you consulted your Data Protection Officer?"
        component_type: radios
        trigger: "FILTER=a"
        options:
          a: "Yes"
          b: "No"
```

Double-click `Preview Survey.command` (or run `bash "Preview Survey.command"` in the Codespaces terminal) to start the YAML watcher. Keep the terminal open while editing; press Ctrl+C to stop the watcher. Run `npm run dev` separately to view the site.

## Public demo

The `main` branch deploys automatically to GitHub Pages at:

https://cdeiuk.github.io/DAIEF-frontend-demo/
