import React, { useState } from 'react';

export default function OllamaWidget() {
  const [ollamaStatus, setOllamaStatus] = useState('idle');
  const [ollamaMessage, setOllamaMessage] = useState('');

  async function checkOllama() {
    setOllamaStatus('loading');
    setOllamaMessage('');
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }
      const data = await response.json();
      const modelCount = Array.isArray(data?.models) ? data.models.length : 0;
      setOllamaStatus('success');
      setOllamaMessage(modelCount > 0 ? `${modelCount} model(s)` : 'No models');
    } catch (err) {
      setOllamaStatus('error');
      setOllamaMessage('Not reachable');
    }
  }

  function scrollToOllamaInfo() {
    const target = document.getElementById('ollama-info');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className="ollama-widget">
      <div className="ollama-widget-header">
        <span>Ollama</span>
        <button type="button" className="info-icon" onClick={scrollToOllamaInfo} aria-label="Learn about Ollama">
          i
        </button>
      </div>
      <button type="button" onClick={checkOllama} disabled={ollamaStatus === 'loading'}>
        {ollamaStatus === 'loading' ? 'Checking…' : 'Test'}
      </button>
      {ollamaMessage ? (
        <span className={ollamaStatus === 'error' ? 'error' : 'muted'}>{ollamaMessage}</span>
      ) : null}
    </div>
  );
}
