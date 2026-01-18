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

function parseArrayFromText(text) {
  const parsed = parseJsonFromText(text);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    const fallback = parseJsonFromText(match[0]);
    return Array.isArray(fallback) ? fallback : [];
  }
  return [];
}

function getAuthorInitials(author) {
  if (!author || typeof author !== 'string') {
    return 'X';
  }
  const parts = author
    .trim()
    .split(/[^a-zA-Z]+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return 'X';
  }
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function nextCode(author, existingCodes) {
  const prefix = getAuthorInitials(author);
  let counter = 1;
  while (existingCodes.has(`${prefix}${counter}`)) {
    counter += 1;
  }
  return `${prefix}${counter}`;
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

export async function queryLiterature(papers, question) {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error('Question required');
  }

  const context = papers.slice(0, 20).map((paper) => ({
    id: paper.id,
    code: paper.code,
    author: paper.author,
    title: paper.title,
    url: paper.url,
    published_date: paper.published_date,
    citation_count: paper.citation_count,
    note: paper.note
  }));

  const prompt = `You answer questions using only the provided literature notes.\nDo not mention author names, titles, or URLs in your answer.\nAlways include citations for any claim, using this format: [code: <code>].\nIf the answer is not in the notes, say you don't have enough information and do not invent citations.\n\nNOTES:\n${JSON.stringify(context, null, 2)}\n\nQUESTION:\n${trimmedQuestion}`;

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
  return data?.message?.content || '';
}

export async function generateKeywords(noteText) {
  const trimmed = noteText.trim();
  if (!trimmed) {
    return [];
  }

  const prompt = `Extract 5-8 short keywords or phrases from the note.\nReturn ONLY a JSON array of strings.\nAvoid full sentences.\n\nNOTE:\n${trimmed}`;

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
  const content = data?.message?.content || '[]';
  const list = parseArrayFromText(content);
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))].slice(0, 8);
}

export async function createNote(noteText) {
  const existing = await withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  const existingCodes = new Set(existing.map((paper) => paper.code).filter(Boolean));
  const extracted = await extractMetadata(noteText);
  const entry = {
    code: nextCode(extracted.author, existingCodes),
    ...extracted,
    note: noteText,
    created_at: new Date().toISOString()
  };

  await withStore('readwrite', (store) => {
    store.add(entry);
  });
}

export async function createPaperManual(data) {
  const existing = await withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  const existingCodes = new Set(existing.map((paper) => paper.code).filter(Boolean));
  const rawCount = data.citation_count;
  const parsedCount =
    rawCount === '' || rawCount === null || rawCount === undefined
      ? null
      : Number.isFinite(Number(rawCount))
      ? Number(rawCount)
      : null;
  const entry = {
    code: nextCode(data.author, existingCodes),
    author: data.author || '',
    title: data.title || '',
    url: data.url || '',
    published_date: data.published_date || '',
    citation_count: parsedCount,
    note: data.note || '',
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
      store.add({
        ...SEED_PAPER,
        code: nextCode(SEED_PAPER.author, new Set()),
        created_at: new Date().toISOString()
      });
    });
    papers = await withStore('readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  const existingCodes = new Set(papers.map((paper) => paper.code).filter(Boolean));
  const updated = [];
  papers.forEach((paper) => {
    if (!paper.code) {
      const code = nextCode(paper.author, existingCodes);
      existingCodes.add(code);
      updated.push({ ...paper, code });
    }
  });
  if (updated.length > 0) {
    await withStore('readwrite', (store) => {
      updated.forEach((paper) => store.put(paper));
    });
    papers = papers.map((paper) => updated.find((item) => item.id === paper.id) || paper);
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
