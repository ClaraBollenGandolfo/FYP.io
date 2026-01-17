import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createNote, deletePapers, fetchPapers } from '../api.js';

export default function Home() {
  const [noteText, setNoteText] = useState('');
  const [papers, setPapers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const selectAllRef = useRef(null);

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

  const allSelected = papers.length > 0 && selectedIds.length === papers.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

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
      setError('Extraction failed. Check the API server and try again.');
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

  return (
    <div className="grid-layout">
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
            <span className="count">{papers.length} papers</span>
          </div>
        </div>
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
                  <td colSpan="6" className="empty">
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
  );
}
