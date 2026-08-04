import React from 'react';
import { formatTime, formatNumber } from '../utils/formatters';

export default function ExecutionSummary({ summary }) {
  if (!summary) return null;

  const metrics = [
    { label: 'Execution Time', value: formatTime(summary.executionTimeMs), key: 'exec' },
    { label: 'Planning Time', value: formatTime(summary.planningTimeMs), key: 'plan' },
    { label: 'Total Cost', value: formatNumber(summary.totalCost), key: 'cost' },
    { label: 'Rows Returned', value: formatNumber(summary.actualRows), key: 'rows' },
    { label: 'Root Node', value: summary.nodeType || '—', key: 'node' }
  ];

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">
          <span>📊</span> Execution Summary
        </h2>
      </div>
      <div className="execution-summary">
        {metrics.map(m => (
          <div className="summary-metric" key={m.key}>
            <div className="summary-metric__label">{m.label}</div>
            <div className="summary-metric__value">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
