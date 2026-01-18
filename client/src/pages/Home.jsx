import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createNote,
  createPaperManual,
  deletePapers,
  fetchPapers,
  generateKeywords,
  queryLiterature,
  updatePaper
} from '../api.js';

export default function Home() {
  const [noteText, setNoteText] = useState('');
  const [papers, setPapers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [todoText, setTodoText] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualStatus, setManualStatus] = useState('idle');
  const [manualError, setManualError] = useState('');
  const [queryText, setQueryText] = useState('');
  const [queryAnswer, setQueryAnswer] = useState('');
  const [queryStatus, setQueryStatus] = useState('idle');
  const [queryError, setQueryError] = useState('');
  const [manualForm, setManualForm] = useState({
    author: '',
    title: '',
    url: '',
    published_date: '',
    citation_count: '',
    note: ''
  });
  const [keywordBusyIds, setKeywordBusyIds] = useState([]);
  const selectAllRef = useRef(null);
  const keywordInFlight = useRef(new Set());

  async function loadPapers() {
    try {
      const data = await fetchPapers();
      setPapers(data);
      setSelectedIds((prev) => prev.filter((id) => data.some((paper) => paper.id === id)));
    } catch (err) {
      setError('Could not load papers.');
    }
  }

  useEffect(() => {
    loadPapers();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('fyp-io-todo');
    if (saved !== null) {
      setTodoText(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('fyp-io-todo', todoText);
  }, [todoText]);

  const allSelected = papers.length > 0 && selectedIds.length === papers.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    let cancelled = false;

    async function runKeywordExtraction() {
      for (const paper of papers) {
        if (cancelled) {
          return;
        }
        if (!paper.note || (Array.isArray(paper.keywords) && paper.keywords.length > 0)) {
          continue;
        }
        if (keywordInFlight.current.has(paper.id)) {
          continue;
        }

        keywordInFlight.current.add(paper.id);
        setKeywordBusyIds((prev) => [...new Set([...prev, paper.id])]);
        try {
          const keywords = await generateKeywords(paper.note);
          await updatePaper(paper.id, { keywords });
          setPapers((prev) => prev.map((item) => (item.id === paper.id ? { ...item, keywords } : item)));
        } catch (err) {
          // Keep silent; user can retry by editing the note and saving.
        } finally {
          keywordInFlight.current.delete(paper.id);
          if (!cancelled) {
            setKeywordBusyIds((prev) => prev.filter((id) => id !== paper.id));
          }
        }
        break;
      }
    }

    runKeywordExtraction();
    return () => {
      cancelled = true;
    };
  }, [papers]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!noteText.trim()) {
      setError('Write a note first so I can extract metadata.');
      return;
    }

    try {
      setStatus('loading');
      await createNote(noteText.trim());
      setNoteText('');
      await loadPapers();
    } catch (err) {
      setError('Extraction failed. Check Ollama and CORS, then try again.');
    } finally {
      setStatus('idle');
    }
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(papers.map((paper) => paper.id));
  }

  function toggleSelection(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    try {
      setStatus('loading');
      await deletePapers(selectedIds);
      setSelectedIds([]);
      await loadPapers();
    } catch (err) {
      setError('Failed to delete selected papers.');
    } finally {
      setStatus('idle');
    }
  }

  function updateManualField(field, value) {
    setManualForm((prev) => ({ ...prev, [field]: value }));
    setManualError('');
  }

  async function handleManualSave() {
    if (!manualForm.title.trim() && !manualForm.note.trim()) {
      setManualError('Add at least a title or a note.');
      return;
    }

    try {
      setManualStatus('loading');
      await createPaperManual({
        ...manualForm,
        author: manualForm.author.trim(),
        title: manualForm.title.trim(),
        url: manualForm.url.trim(),
        published_date: manualForm.published_date.trim(),
        note: manualForm.note.trim()
      });
      setManualForm({
        author: '',
        title: '',
        url: '',
        published_date: '',
        citation_count: '',
        note: ''
      });
      setShowManual(false);
      await loadPapers();
    } catch (err) {
      setManualError('Failed to add paper.');
    } finally {
      setManualStatus('idle');
    }
  }

  async function handleQuerySubmit(event) {
    event.preventDefault();
    setQueryError('');
    setQueryAnswer('');

    if (!queryText.trim()) {
      setQueryError('Ask a question first.');
      return;
    }

    try {
      setQueryStatus('loading');
      const answer = await queryLiterature(papers, queryText);
      setQueryAnswer(answer || 'No answer returned.');
    } catch (err) {
      setQueryError('Query failed. Check Ollama and try again.');
    } finally {
      setQueryStatus('idle');
    }
  }

  return (
    <div className="grid-layout">
      <div className="column left-column">
        <section className="card intro-card">
          <h2>Literature Desk</h2>
          <p className="muted">
            This page is for capturing research notes, extracting metadata, and keeping a living index of your sources.
          </p>
        </section>

        <section className="card note-card">
          <h2>New Research Note</h2>
          <p className="muted">
            Paste your raw note, abstract, or citation. The AI will extract the
            core details and log it for you.
          </p>
          <form onSubmit={handleSubmit} className="note-form">
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Example: Smith et al. (2022) found that... DOI: ..."
              rows={10}
            />
            <div className="note-actions">
              <button type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Extracting…' : 'Extract & Save'}
              </button>
              {error ? <span className="error">{error}</span> : null}
            </div>
          </form>
        </section>

        <section className="card note-card">
          <h2>Literature Query</h2>
          <p className="muted">
            Ask questions about your saved notes. Ollama will answer using only your local database.
          </p>
          <form onSubmit={handleQuerySubmit} className="note-form">
            <textarea
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Example: What are common themes across my notes?"
              rows={6}
            />
            <div className="note-actions">
              <button type="submit" disabled={queryStatus === 'loading'}>
                {queryStatus === 'loading' ? 'Thinking…' : 'Ask'}
              </button>
              <button
                type="button"
                className="clear-button"
                onClick={() => setQueryAnswer('')}
                disabled={!queryAnswer}
              >
                Clear answer
              </button>
              {queryError ? <span className="error">{queryError}</span> : null}
            </div>
          </form>
          {queryAnswer ? <div className="answer-box">{queryAnswer}</div> : null}
        </section>
      </div>

      <div className="column right-column">
        <section className="card notepad-card">
          <div className="table-header">
            <h2>Notepad</h2>
          </div>
          <textarea
            className="notepad-textarea"
            value={todoText}
            onChange={(event) => setTodoText(event.target.value)}
            placeholder="Write your to-do list here..."
            rows={6}
          />
        </section>

        <section className="card table-card">
          <div className="table-header">
            <h2>Literature Index</h2>
            <div className="table-actions">
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  className="danger-button"
                  disabled={status === 'loading'}
                  onClick={handleDeleteSelected}
                >
                  Delete selected ({selectedIds.length})
                </button>
              ) : null}
              <div className="count-group">
                <span className="count">{papers.length} papers</span>
                <button
                  type="button"
                  className="add-button"
                  onClick={() => setShowManual((prev) => !prev)}
                  aria-label="Add paper manually"
                  title="Add paper"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          {showManual ? (
            <div className="manual-form">
              <div className="manual-grid">
                <input
                  className="detail-input"
                  placeholder="Author"
                  value={manualForm.author}
                  onChange={(event) => updateManualField('author', event.target.value)}
                />
                <input
                  className="detail-input"
                  placeholder="Title"
                  value={manualForm.title}
                  onChange={(event) => updateManualField('title', event.target.value)}
                />
                <input
                  className="detail-input"
                  placeholder="URL"
                  value={manualForm.url}
                  onChange={(event) => updateManualField('url', event.target.value)}
                />
                <input
                  className="detail-input"
                  placeholder="Published"
                  value={manualForm.published_date}
                  onChange={(event) => updateManualField('published_date', event.target.value)}
                />
                <input
                  className="detail-input"
                  type="number"
                  min="0"
                  placeholder="Citations"
                  value={manualForm.citation_count}
                  onChange={(event) => updateManualField('citation_count', event.target.value)}
                />
              </div>
              <textarea
                className="detail-input detail-textarea"
                placeholder="Note"
                value={manualForm.note}
                onChange={(event) => updateManualField('note', event.target.value)}
                rows={4}
              />
              <div className="manual-actions">
                <button type="button" onClick={handleManualSave} disabled={manualStatus === 'loading'}>
                  {manualStatus === 'loading' ? 'Saving…' : 'Add paper'}
                </button>
                <button type="button" className="ghost-link" onClick={() => setShowManual(false)}>
                  Cancel
                </button>
                {manualError ? <span className="error">{manualError}</span> : null}
              </div>
            </div>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all papers"
                    />
                  </th>
                  <th>Code</th>
                  <th>Author</th>
                  <th>Title</th>
                  <th>Link</th>
                  <th>Published</th>
                  <th>Citations</th>
                </tr>
              </thead>
              <tbody>
                {papers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty">
                      No notes yet. Add one to populate your table.
                    </td>
                  </tr>
                ) : (
                  papers.map((paper) => (
                    <tr key={paper.id}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(paper.id)}
                          onChange={() => toggleSelection(paper.id)}
                          aria-label={`Select ${paper.title || 'paper'}`}
                        />
                      </td>
                      <td className="code-cell">{paper.code || '—'}</td>
                      <td>
                        <Link to={`/paper/${paper.id}`} className="row-link">
                          {paper.author || 'Unknown'}
                        </Link>
                      </td>
                      <td>{paper.title || 'Untitled'}</td>
                      <td>
                        {paper.url ? (
                          <a href={paper.url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{paper.published_date || '—'}</td>
                      <td>
                        {paper.citation_count === null || paper.citation_count === undefined
                          ? '—'
                          : paper.citation_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card timeline-card full-width">
        <h2>Literature Timeline</h2>
        <p className="muted">A quick, visual sweep of your notes by date.</p>
        <div className="timeline-track">
          {papers.length === 0 ? (
            <p className="muted">Add papers to see them plotted here.</p>
          ) : (
            [...papers]
              .slice()
              .sort((a, b) => {
                const parseYear = (value) => {
                  const match = String(value || '').match(/\d{4}/);
                  return match ? Number(match[0]) : null;
                };
                const yearA = parseYear(a.published_date) ?? parseYear(a.created_at) ?? 0;
                const yearB = parseYear(b.published_date) ?? parseYear(b.created_at) ?? 0;
                return yearA - yearB;
              })
              .map((paper) => {
                const rawDate = paper.published_date || paper.created_at || '';
                const yearMatch = String(rawDate).match(/\d{4}/);
                const yearLabel = yearMatch ? yearMatch[0] : '—';
                const noteText = paper.note || '';
                const lines = noteText
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean);
                const bulletLines = lines.filter((line) => /^[-*•]/.test(line));
                const points = bulletLines.length
                  ? bulletLines.map((line) => line.replace(/^[-*•]\s*/, '')).slice(0, 2)
                  : noteText
                      .split(/(?<=[.!?])\s+/)
                      .map((sentence) => sentence.trim())
                      .filter(Boolean)
                      .slice(0, 2);

                return (
                  <div key={paper.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-meta">
                      <span className="timeline-year">{yearLabel}</span>
                      <span className="timeline-code">{paper.code || '—'}</span>
                    </div>
                    <div className="timeline-title">{paper.title || 'Untitled'}</div>
                    {Array.isArray(paper.keywords) && paper.keywords.length > 0 ? (
                      <div className="timeline-keywords">
                        {paper.keywords.map((keyword) => (
                          <span key={keyword} className="keyword-chip">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        {keywordBusyIds.includes(paper.id) ? 'Extracting keywords…' : 'No keywords yet.'}
                      </p>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </section>

      <section className="card info-card full-width" id="ollama-info">
        <h2>What is Ollama?</h2>
        <p className="muted">
          Ollama runs language models on your machine. This app connects to it locally so you can extract metadata
          without a paid API.
        </p>
        <div className="info-list">
          <span className="info-label">Download</span>
          <span>
            Install from <a href="https://ollama.com" target="_blank" rel="noreferrer">ollama.com</a>.
          </span>
        </div>
        <div className="info-list">
          <span className="info-label">Start</span>
          <span>Run `ollama serve` to start the local API.</span>
        </div>
        <div className="info-list">
          <span className="info-label">Model</span>
          <span>Pull a model: `ollama pull llama3.1`.</span>
        </div>
        <div className="info-list">
          <span className="info-label">CORS</span>
          <span>For GitHub Pages: `OLLAMA_ORIGINS="https://clarabollengandolfo.github.io" ollama serve`.</span>
        </div>
      </section>
    </div>
  );
}
