import React from 'react';
import { formatTime, formatNumber, formatPercent } from '../utils/formatters';

export default function ComparisonPanel({ comparison }) {
  if (!comparison) return null;

  const { before, after, comparison: metrics, recommendation } = comparison;

  return (
    <div className="card full-width">
      <div className="card__header">
        <h2 className="card__title">
          <span>⚡</span> Before vs After Comparison
        </h2>
        <span className="card__badge">{recommendation.indexName}</span>
      </div>

      {/* Improvement summary */}
      <div className="comparison-improvement">
        <div className="comparison-improvement__value">
          {metrics.improvementPercent > 0 ? (
            <>↓ {formatPercent(metrics.improvementPercent)} faster</>
          ) : metrics.improvementPercent < 0 ? (
            <>↑ {formatPercent(Math.abs(metrics.improvementPercent))} slower</>
          ) : (
            <>— No change</>
          )}
        </div>
        <div className="comparison-improvement__label">
          Saved {formatTime(metrics.timeSavedMs)} execution time
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="comparison-panel" style={{ marginTop: 'var(--space-4)' }}>
        <div className="comparison-column comparison-column--before">
          <div className="comparison-column__title">Before (no index)</div>
          <div className="comparison-metric">
            <span className="comparison-metric__label">Execution Time</span>
            <span className="comparison-metric__value">{formatTime(metrics.beforeTimeMs)}</span>
          </div>
          <div className="comparison-metric">
            <span className="comparison-metric__label">Scan Type</span>
            <span className="comparison-metric__value">{metrics.beforeScanType}</span>
          </div>
          <div className="comparison-metric">
            <span className="comparison-metric__label">Rows Processed</span>
            <span className="comparison-metric__value">{formatNumber(metrics.beforeRowsProcessed)}</span>
          </div>
          <div className="comparison-metric">
            <span className="comparison-metric__label">Shared Blocks</span>
            <span className="comparison-metric__value">{formatNumber(metrics.beforeSharedBlocks)}</span>
          </div>
        </div>

        <div className="comparison-arrow">→</div>

        <div className="comparison-column comparison-column--after">
          <div className="comparison-column__title">After (with index)</div>
          <div className="comparison-metric">
            <span className="comparison-metric__label">Execution Time</span>
            <span className="comparison-metric__value">{formatTime(metrics.afterTimeMs)}</span>
          </div>
          <div className="comparison-metric">
            <span className="comparison-metric__label">Scan Type</span>
            <span className="comparison-metric__value">{metrics.afterScanType}</span>
          </div>
          <div className="comparison-metric">
            <span className="comparison-metric__label">Rows Processed</span>
            <span className="comparison-metric__value">{formatNumber(metrics.afterRowsProcessed)}</span>
          </div>
          <div className="comparison-metric">
            <span className="comparison-metric__label">Shared Blocks</span>
            <span className="comparison-metric__value">{formatNumber(metrics.afterSharedBlocks)}</span>
          </div>
        </div>
      </div>

      {/* Index usage notice */}
      {!metrics.indexUsed && metrics.reason && (
        <div className="comparison-notice">
          ℹ️ <strong>Note:</strong> {metrics.reason}
        </div>
      )}

      {metrics.indexUsed && (
        <div className="comparison-notice" style={{
          background: 'var(--color-success-bg)',
          borderColor: 'var(--color-success-border)'
        }}>
          ✅ PostgreSQL chose to use the new index <strong>{recommendation.indexName}</strong>.
        </div>
      )}
    </div>
  );
}
