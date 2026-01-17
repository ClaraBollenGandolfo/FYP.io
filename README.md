# FYP.io

React + Express prototype for AI-assisted literature tracking.

## Setup (client-only, GitHub Pages friendly)

1. Install dependencies:

```bash
cd client
npm install
```

2. Run the client:

```bash
npm run dev
```

The app is at `http://localhost:5173`. Data is stored per-browser using IndexedDB, so it
persists across tab close/reopen but is tied to that browser/device.

## Ollama (free, local)

1. Install Ollama: https://ollama.com/
2. Pull a model:

```bash
ollama pull llama3.1
```

3. Run Ollama (local API on `http://localhost:11434`).

### GitHub Pages + Ollama (browser-only)

If you deploy the client to GitHub Pages, the browser will call Ollama directly at
`http://localhost:11434`. You must enable CORS in Ollama for your GitHub Pages origin.

Example (adjust origin for your site):

```bash
# macOS example
OLLAMA_ORIGINS="https://<user>.github.io" ollama serve
```

Then test the connection in the app using the “Test Ollama Connection” button.

## Legacy API (optional)

If you want to run the old Express API instead of client-only IndexedDB, the server code
still exists in `server/`, but the client no longer calls it by default.
