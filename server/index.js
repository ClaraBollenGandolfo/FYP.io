import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import OpenAI from 'openai';

const PORT = process.env.PORT || 5175;
const DB_PATH = process.env.SQLITE_PATH || './data.db';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true' || !process.env.OPENAI_API_KEY;

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT,
    title TEXT,
    url TEXT,
    published_date TEXT,
    citation_count INTEGER,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function extractMetadata(noteText) {
  const prompt = `You are a strict JSON generator.\nExtract the paper metadata from the note below.\nReturn ONLY a JSON object with keys: author, title, url, published_date, citation_count.\nIf a field is unknown, use an empty string or null for citation_count.\n\nNOTE:\n${noteText}`;

  let content = '{}';

  if (USE_OLLAMA) {
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
    content = data?.message?.content || '{}';
  } else {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2
    });

    content = response.choices?.[0]?.message?.content || '{}';
  }
  let parsed = {};
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (innerError) {
        parsed = {};
      }
    } else {
      parsed = {};
    }
  }

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

app.get('/api/papers', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, author, title, url, published_date, citation_count, created_at
       FROM papers
       ORDER BY id DESC`
    )
    .all();
  res.json(rows);
});

app.get('/api/papers/:id', (req, res) => {
  const row = db
    .prepare(
      `SELECT id, author, title, url, published_date, citation_count, note, created_at
       FROM papers
       WHERE id = ?`
    )
    .get(req.params.id);

  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json(row);
});

app.delete('/api/papers', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

  if (uniqueIds.length === 0) {
    res.status(400).json({ error: 'ids is required.' });
    return;
  }

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const result = db.prepare(`DELETE FROM papers WHERE id IN (${placeholders})`).run(...uniqueIds);

  res.json({ deleted: result.changes });
});

app.post('/api/notes', async (req, res) => {
  const noteText = typeof req.body?.noteText === 'string' ? req.body.noteText.trim() : '';

  if (!noteText) {
    res.status(400).json({ error: 'noteText is required' });
    return;
  }

  if (!USE_OLLAMA && !process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY on the server.' });
    return;
  }

  try {
    const extracted = await extractMetadata(noteText);

    const result = db
      .prepare(
        `INSERT INTO papers (author, title, url, published_date, citation_count, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        extracted.author,
        extracted.title,
        extracted.url,
        extracted.published_date,
        extracted.citation_count,
        noteText
      );

    const created = db
      .prepare(
        `SELECT id, author, title, url, published_date, citation_count, note, created_at
         FROM papers
         WHERE id = ?`
      )
      .get(result.lastInsertRowid);

    res.status(201).json(created);
  } catch (error) {
    console.error('Metadata extraction failed:', {
      message: error?.message,
      status: error?.status,
      code: error?.code
    });
    res.status(500).json({ error: 'Failed to extract metadata.' });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
