import React from 'react';
import FindingCard from './FindingCard';
import EmptyState from './EmptyState';

export default function FindingsPanel({ findings = [] }) {
  if (findings.length === 0) {
    return (
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">
            <span>🔎</span> Findings
          </h2>
          <span className="card__badge">0</span>
        </div>
        <EmptyState
          icon="✅"
          title="No bottlenecks detected"
          description="The query appears to be performing well."
        />
      </div>
    );
  }

  // Sort by severity: high → medium → low
  const order = { high: 0, medium: 1, low: 2 };
  const sorted = [...findings].sort((a, b) =>
    (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
  );

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">
          <span>🔎</span> Findings
        </h2>
        <span className="card__badge">{findings.length} issue{findings.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="findings-panel">
        {sorted.map((finding, idx) => (
          <FindingCard key={idx} finding={finding} />
        ))}
      </div>
    </div>
  );
}
