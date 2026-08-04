import React from 'react';
import { formatNumber } from '../utils/formatters';

export default function FindingCard({ finding }) {
  if (!finding) return null;

  return (
    <div className={`finding-card finding-card--${finding.severity}`}>
      <div className="finding-card__header">
        <span className={`finding-card__severity finding-card__severity--${finding.severity}`}>
          {finding.severity}
        </span>
        <span className="finding-card__title">{finding.title}</span>
      </div>
      <p className="finding-card__description">{finding.description}</p>
      {finding.evidence && (
        <div className="finding-card__evidence">
          {Object.entries(finding.evidence).map(([key, value]) => (
            <span className="finding-card__evidence-item" key={key}>
              {formatKey(key)}: <strong>{typeof value === 'number' ? formatNumber(value) : String(value)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}
