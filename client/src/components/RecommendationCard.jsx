import React from 'react';

export default function RecommendationCard({
  recommendation,
  onTest,
  testing = false
}) {
  if (!recommendation) return null;

  return (
    <div className="recommendation-card">
      <div className="recommendation-card__header">
        <div className="recommendation-card__title">
          <span>💡</span>
          <span>Index on {recommendation.table}({recommendation.columns.join(', ')})</span>
        </div>
        <span className={`recommendation-card__confidence recommendation-card__confidence--${recommendation.confidence}`}>
          {recommendation.confidence} confidence
        </span>
      </div>

      <div className="recommendation-card__sql">
        {recommendation.sql}
      </div>

      <p className="recommendation-card__reason">{recommendation.reason}</p>
      <p className="recommendation-card__tradeoff">⚠ {recommendation.tradeOff}</p>

      <div className="recommendation-card__actions">
        <button
          className="btn btn--success btn--small"
          onClick={() => onTest(recommendation.serverId)}
          disabled={testing}
          aria-label={`Test index ${recommendation.indexName}`}
        >
          {testing ? '⏳ Testing...' : '🧪 Test Before vs After'}
        </button>
      </div>
    </div>
  );
}
