import axios from 'axios';

// In Docker, we use the Vite proxy (requests to /api are proxied to the backend).
// Locally without Docker, the backend runs on http://localhost:5000.
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

export async function fetchExamples() {
  const res = await api.get('/examples');
  return res.data;
}

export async function analyseQuery(sql) {
  const res = await api.post('/analyse', { sql });
  return res.data;
}

export async function testRecommendation(serverId, sql) {
  const res = await api.post(`/recommendations/${serverId}/test`, { sql });
  return res.data;
}

export async function resetDemoIndexes() {
  const res = await api.delete('/demo-indexes');
  return res.data;
}

export async function fetchHistory(page = 1, limit = 20) {
  const res = await api.get('/history', { params: { page, limit } });
  return res.data;
}

export async function fetchHistoryItem(id) {
  const res = await api.get(`/history/${id}`);
  return res.data;
}

export async function deleteHistoryItem(id) {
  const res = await api.delete(`/history/${id}`);
  return res.data;
}

export async function checkHealth() {
  const res = await api.get('/health');
  return res.data;
}
