import React, { useState, useEffect } from 'react';
import { fetchHistory, deleteHistoryItem } from '../api/queryApi';
import { formatTime, formatDate, truncate } from '../utils/formatters';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';

export default function HistoryPanel({ onLoadQuery }) {
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const loadHistory = async (p = page) => {
    setLoading(true);
    try {
      const res = await fetchHistory(p, 10);
      if (res.success) setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(page);
  }, [page]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteHistoryItem(deleteId);
      setDeleteId(null);
      loadHistory(page);
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  return (
    <div className="card full-width">
      <div className="card__header">
        <h2 className="card__title">
          <span>📜</span> Query History
        </h2>
        <button className="btn btn--ghost btn--small" onClick={() => loadHistory(page)}>
          ↻ Refresh
        </button>
      </div>

      {loading && !history && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <span className="loading-state__text">Loading history...</span>
        </div>
      )}

      {history && history.items.length === 0 && (
        <EmptyState
          icon="📜"
          title="No history yet"
          description="Run your first query analysis to start building history."
        />
      )}

      {history && history.items.length > 0 && (
        <>
          {history.items.map(item => (
            <div className="history-item" key={item.id}>
              <div
                className="history-item__query"
                onClick={() => onLoadQuery(item.queryText)}
                title={item.queryText}
              >
                {truncate(item.queryText, 70)}
              </div>
              <div className="history-item__meta">
                <span className="history-item__stat">
                  ⏱ <span>{formatTime(item.executionTimeMs)}</span>
                </span>
                <span className="history-item__stat">
                  🔎 <span>{item.findingsCount}</span>
                </span>
                <span className="history-item__stat">
                  💡 <span>{item.recommendationsCount}</span>
                </span>
                <span className="history-item__stat">
                  {formatDate(item.createdAt)}
                </span>
              </div>
              <div className="history-item__actions">
                <button
                  className="btn btn--ghost btn--small"
                  onClick={() => onLoadQuery(item.queryText)}
                  title="Load query"
                  aria-label="Load query"
                >
                  ↗
                </button>
                <button
                  className="btn btn--ghost btn--small"
                  onClick={() => setDeleteId(item.id)}
                  title="Delete"
                  aria-label="Delete history item"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}

          {history.totalPages > 1 && (
            <div className="history-pagination">
              <button
                className="btn btn--secondary btn--small"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center' }}>
                {page} / {history.totalPages}
              </span>
              <button
                className="btn btn--secondary btn--small"
                disabled={page >= history.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete History Item"
          message="Are you sure you want to delete this history entry? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
