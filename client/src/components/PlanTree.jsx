import React from 'react';
import PlanNode from './PlanNode';

export default function PlanTree({ plan, findings = [] }) {
  if (!plan) return null;

  // Collect node IDs that have findings for highlighting
  const highlightedNodeIds = findings.map(f => f.nodeId).filter(Boolean);

  return (
    <div className="card full-width">
      <div className="card__header">
        <h2 className="card__title">
          <span>🌳</span> Execution Plan Tree
        </h2>
        <span className="card__badge">Click nodes to expand</span>
      </div>
      <div className="plan-tree">
        <PlanNode node={plan} highlightedNodeIds={highlightedNodeIds} />
      </div>
    </div>
  );
}
