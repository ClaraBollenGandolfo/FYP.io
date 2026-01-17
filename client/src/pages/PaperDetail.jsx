import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPaper, updatePaper } from '../api.js';

export default function PaperDetail() {
  const { id } = useParams();
  const [paper, setPaper] = useState(null);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const isDirty = useMemo(() => {
    if (!form || !paper) {
      return false;
    }
    return (
      form.author !== (paper.author || '') ||
      form.title !== (paper.title || '') ||
      form.url !== (paper.url || '') ||
      form.published_date !== (paper.published_date || '') ||
      form.citation_count !==
        (paper.citation_count === null || paper.citation_count === undefined ? '' : String(paper.citation_count)) ||
      form.note !== (paper.note || '')
    );
  }, [form, paper]);

  useEffect(() => {
    async function loadPaper() {
      try {
        const data = await fetchPaper(id);
        setPaper(data);
        setForm({
          author: data.author || '',
          title: data.title || '',
          url: data.url || '',
          published_date: data.published_date || '',
          citation_count:
            data.citation_count === null || data.citation_count === undefined ? '' : String(data.citation_count),
          note: data.note || ''
        });
      } catch (err) {
        setError('Could not load paper.');
      }
    }

    loadPaper();
  }, [id]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaveMessage('');
  }

  async function handleSave() {
    if (!form || !paper || !isDirty) {
      return;
    }

    setStatus('saving');
    setError('');
    setSaveMessage('');
    try {
      const next = await updatePaper(paper.id, {
        author: form.author.trim(),
        title: form.title.trim(),
        url: form.url.trim(),
        published_date: form.published_date.trim(),
        citation_count: form.citation_count === '' ? null : Number(form.citation_count),
        note: form.note.trim()
      });
      setPaper(next);
      setForm({
        author: next.author || '',
        title: next.title || '',
        url: next.url || '',
        published_date: next.published_date || '',
        citation_count:
          next.citation_count === null || next.citation_count === undefined ? '' : String(next.citation_count),
        note: next.note || ''
      });
      setSaveMessage('Saved.');
    } catch (err) {
      setError('Could not save changes.');
    } finally {
      setStatus('idle');
    }
  }

  if (error) {
    return (
      <div className="card detail-card">
        <p className="error">{error}</p>
        <Link to="/" className="ghost-link">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!paper || !form) {
    return (
      <div className="card detail-card">
        <p className="muted">Loading paper…</p>
      </div>
    );
  }

  return (
    <div className="card detail-card">
      <div className="detail-header">
        <div>
          <p className="app-kicker">Paper Detail</p>
          <h2>{paper.title || 'Untitled'}</h2>
        </div>
        <Link to="/" className="ghost-link">
          Back to dashboard
        </Link>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Author</dt>
          <dd>
            <input
              className="detail-input"
              value={form.author}
              onChange={(event) => updateField('author', event.target.value)}
              placeholder="Unknown"
            />
          </dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>
            <input
              className="detail-input"
              value={form.published_date}
              onChange={(event) => updateField('published_date', event.target.value)}
              placeholder="—"
            />
          </dd>
        </div>
        <div>
          <dt>Citations</dt>
          <dd>
            <input
              className="detail-input"
              type="number"
              min="0"
              value={form.citation_count}
              onChange={(event) => updateField('citation_count', event.target.value)}
              placeholder="—"
            />
          </dd>
        </div>
        <div>
          <dt>Link</dt>
          <dd>
            <input
              className="detail-input"
              value={form.url}
              onChange={(event) => updateField('url', event.target.value)}
              placeholder="—"
            />
          </dd>
        </div>
        <div>
          <dt>Title</dt>
          <dd>
            <input
              className="detail-input"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Untitled"
            />
          </dd>
        </div>
      </dl>
      <div className="detail-actions">
        <button type="button" onClick={handleSave} disabled={!isDirty || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {saveMessage ? <span className="muted">{saveMessage}</span> : null}
        {error ? <span className="error">{error}</span> : null}
      </div>
      <div className="notes-block">
        <h3>Original Note</h3>
        <textarea
          className="detail-input detail-textarea"
          value={form.note}
          onChange={(event) => updateField('note', event.target.value)}
          rows={6}
        />
      </div>
    </div>
  );
}
