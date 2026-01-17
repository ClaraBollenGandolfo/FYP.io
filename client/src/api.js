const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5175';

export async function createNote(noteText) {
  const response = await fetch(`${API_URL}/api/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ noteText })
  });

  if (!response.ok) {
    throw new Error('Failed to create note');
  }

  return response.json();
}

export async function fetchPapers() {
  const response = await fetch(`${API_URL}/api/papers`);
  if (!response.ok) {
    throw new Error('Failed to load papers');
  }
  return response.json();
}

export async function fetchPaper(id) {
  const response = await fetch(`${API_URL}/api/papers/${id}`);
  if (!response.ok) {
    throw new Error('Failed to load paper');
  }
  return response.json();
}

export async function deletePapers(ids) {
  const response = await fetch(`${API_URL}/api/papers`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    throw new Error('Failed to delete papers');
  }

  return response.json();
}
