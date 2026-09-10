# Astra interface

A first working frontend shell for Astra lives in `web/index.html`.

It is intentionally dependency-free so it can be opened locally or served by any static web server. The chat composer calls `/api/agent/run` when the API is running.

## Local preview

From the repository root:

```bash
python3 -m http.server 3000 --directory web
```

Then open `http://localhost:3000`.

The UI is already wired for the Astra API endpoint; for a full connected experience, serve the frontend behind the API origin or configure a proxy in the eventual web app.
