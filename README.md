# FYP.io

React + Express prototype for AI-assisted literature tracking.

## Setup

1. Install dependencies:

```bash
cd server
npm install

cd ../client
npm install
```

2. Create `server/.env`:

```bash
OPENAI_API_KEY=your_key_here
# Optional
# OPENAI_MODEL=gpt-4o-mini
# Ollama option (local, free)
# USE_OLLAMA=true
# OLLAMA_MODEL=llama3.1
# OLLAMA_BASE_URL=http://localhost:11434
```

3. Run the API:

```bash
cd server
npm run dev
```

4. Run the client:

```bash
cd client
npm run dev
```

The app is at `http://localhost:5173` and the API at `http://localhost:5175`.

## Ollama (free, local)

1. Install Ollama: https://ollama.com/
2. Pull a model:

```bash
ollama pull llama3.1
```

3. Enable it in `server/.env`:

```bash
USE_OLLAMA=true
OLLAMA_MODEL=llama3.1
```
