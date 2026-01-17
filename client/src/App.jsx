import React from 'react';
import { Route, Routes, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import PaperDetail from './pages/PaperDetail.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-kicker">FYP.io</p>
          <h1 className="app-title">Literature Desk</h1>
        </div>
        <nav>
          <Link to="/" className="ghost-link">
            Dashboard
          </Link>
        </nav>
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
