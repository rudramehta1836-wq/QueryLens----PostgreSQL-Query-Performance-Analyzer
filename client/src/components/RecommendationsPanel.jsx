import React from 'react';
import RecommendationCard from './RecommendationCard';
import EmptyState from './EmptyState';

export default function RecommendationsPanel({
  recommendations = [],
  onTest,
  testingId,
  onResetIndexes,
  resetting
}) {
  if (recommendations.length === 0) {
    return (
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">
            <span>💡</span> Index Recommendations
          </h2>
          <span className="card__badge">0</span>
        </div>
        <EmptyState
          icon="📊"
          title="No recommendations"
          description="No index improvements were identified for this query."
        />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">
          <span>💡</span> Index Recommendations
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <span className="card__badge">{recommendations.length}</span>
          <button
            className="btn btn--danger btn--small"
            onClick={onResetIndexes}
            disabled={resetting}
            aria-label="Reset demo indexes"
          >
            {resetting ? 'Resetting...' : '🗑 Reset Demo Indexes'}
          </button>
        </div>
      </div>
      {recommendations.map((rec, idx) => (
        <RecommendationCard
          key={rec.serverId || idx}
          recommendation={rec}
          onTest={onTest}
          testing={testingId === rec.serverId}
        />
      ))}
    </div>
  );
}
