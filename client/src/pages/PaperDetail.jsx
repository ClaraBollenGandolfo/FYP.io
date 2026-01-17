import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPaper } from '../api.js';

export default function PaperDetail() {
  const { id } = useParams();
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPaper() {
      try {
        const data = await fetchPaper(id);
        setPaper(data);
      } catch (err) {
        setError('Could not load paper.');
      }
    }

    loadPaper();
  }, [id]);

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

  if (!paper) {
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
          <dd>{paper.author || 'Unknown'}</dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>{paper.published_date || '—'}</dd>
        </div>
        <div>
          <dt>Citations</dt>
          <dd>
            {paper.citation_count === null || paper.citation_count === undefined
              ? '—'
              : paper.citation_count}
          </dd>
        </div>
        <div>
          <dt>Link</dt>
          <dd>
            {paper.url ? (
              <a href={paper.url} target="_blank" rel="noreferrer">
                {paper.url}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>
      <div className="notes-block">
        <h3>Original Note</h3>
        <p>{paper.note}</p>
      </div>
    </div>
  );
}
