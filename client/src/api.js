const DB_NAME = 'fyp-io';
const DB_VERSION = 1;
const STORE_NAME = 'papers';
const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1';
const SEED_PAPER = {
  author: 'Doe et al.',
  title: 'Dummy Paper for Debugging',
  url: 'https://example.com/paper',
  published_date: '2023',
  citation_count: 42,
  note: 'This is a placeholder note so you can test the UI without extraction.'
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = callback(store);

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return {};
    }
    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return {};
    }
  }
}

async function extractMetadata(noteText) {
  const prompt = `You are a strict JSON generator.\nExtract the paper metadata from the note below.\nReturn ONLY a JSON object with keys: author, title, url, published_date, citation_count.\nIf a field is unknown, use an empty string or null for citation_count.\n\nNOTE:\n${noteText}`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.message?.content || '{}';
  const parsed = parseJsonFromText(content);

  return {
    author: typeof parsed.author === 'string' ? parsed.author.trim() : '',
    title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
    url: typeof parsed.url === 'string' ? parsed.url.trim() : '',
    published_date: typeof parsed.published_date === 'string' ? parsed.published_date.trim() : '',
    citation_count:
      typeof parsed.citation_count === 'number'
        ? parsed.citation_count
        : parsed.citation_count === null
        ? null
        : Number.isFinite(Number(parsed.citation_count))
        ? Number(parsed.citation_count)
        : null
  };
}

export async function createNote(noteText) {
  const extracted = await extractMetadata(noteText);
  const entry = {
    ...extracted,
    note: noteText,
    created_at: new Date().toISOString()
  };

  await withStore('readwrite', (store) => {
    store.add(entry);
  });
}

export async function fetchPapers() {
  let papers = await withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });

  if (papers.length === 0) {
    await withStore('readwrite', (store) => {
      store.add({ ...SEED_PAPER, created_at: new Date().toISOString() });
    });
    papers = await withStore('readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  return [...papers].sort((a, b) => b.id - a.id);
}

export async function fetchPaper(id) {
  const record = await withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(Number(id));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });

  if (!record) {
    throw new Error('Not found');
  }

  return record;
}

export async function updatePaper(id, updates) {
  const record = await withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(Number(id));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });

  if (!record) {
    throw new Error('Not found');
  }

  const nextRecord = { ...record, ...updates };

  await withStore('readwrite', (store) => {
    store.put(nextRecord);
  });

  return nextRecord;
}

export async function deletePapers(ids) {
  const uniqueIds = [...new Set(ids.map((value) => Number(value)).filter((value) => Number.isInteger(value)))];

  if (uniqueIds.length === 0) {
    return;
  }

  await withStore('readwrite', (store) => {
    uniqueIds.forEach((id) => store.delete(id));
  });
}
