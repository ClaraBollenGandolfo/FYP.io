import React from 'react';
import { Route, Routes, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import PaperDetail from './pages/PaperDetail.jsx';
import OllamaWidget from './components/OllamaWidget.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <a
            href="https://clarabollengandolfo.github.io/"
            className="profile-button"
            target="_blank"
            rel="noreferrer"
          >
            clara bollen gandolfo
          </a>
          <h1 className="app-title">Literature Desk</h1>
        </div>
        <div className="app-header-actions">
          <OllamaWidget />
          <nav>
            <Link to="/" className="ghost-link">
              Dashboard
            </Link>
          </nav>
          <a
            href="https://www.overleaf.com/project/6967b6d7653766a341e88fa5"
            className="report-button"
            target="_blank"
            rel="noreferrer"
          >
            Report
          </a>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/paper/:id" element={<PaperDetail />} />
        </Routes>
      </main>
    </div>
  );
}
