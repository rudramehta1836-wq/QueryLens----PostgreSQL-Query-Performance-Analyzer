import React, { useState } from 'react';
import { formatTime, formatNumber, getNodeTypeClass } from '../utils/formatters';

export default function PlanNode({ node, highlightedNodeIds = [] }) {
  const [expanded, setExpanded] = useState(false);

  if (!node) return null;

  const isHighlighted = highlightedNodeIds.includes(node.id);
  const typeClass = getNodeTypeClass(node.nodeType);

  return (
    <div className="plan-node">
      <div className="plan-node__connector" />
      <div
        className={`plan-node__card${isHighlighted ? ' plan-node__card--highlighted' : ''}`}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${node.nodeType} on ${node.relationName || 'subquery'}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
      >
        <div className="plan-node__header">
          <span className={`plan-node__badge plan-node__badge--${typeClass}`}>
            {node.nodeType}
          </span>
          {node.relationName && (
            <span className="plan-node__relation">
              on {node.relationName}
              {node.alias && node.alias !== node.relationName ? ` (${node.alias})` : ''}
            </span>
          )}
          {node.indexName && (
            <span className="plan-node__relation"> using {node.indexName}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {expanded ? '▾' : '▸'}
          </span>
        </div>

        <div className="plan-node__metrics">
          <div className="plan-node__metric">
            Time: <span>{formatTime(node.actualTotalTime * (node.actualLoops || 1))}</span>
          </div>
          <div className="plan-node__metric">
            Rows: <span>{formatNumber(node.actualRows)}</span>
          </div>
          {node.actualLoops > 1 && (
            <div className="plan-node__metric">
              Loops: <span>{formatNumber(node.actualLoops)}</span>
            </div>
          )}
          {node.rowsRemovedByFilter > 0 && (
            <div className="plan-node__metric">
              Removed: <span>{formatNumber(node.rowsRemovedByFilter)}</span>
            </div>
          )}
        </div>

        {expanded && (
          <div className="plan-node__details">
            <div className="plan-node__detail-row">
              <span>Estimated Rows</span>
              <span>{formatNumber(node.planRows)}</span>
            </div>
            <div className="plan-node__detail-row">
              <span>Total Cost</span>
              <span>{formatNumber(node.totalCost)}</span>
            </div>
            <div className="plan-node__detail-row">
              <span>Startup Cost</span>
              <span>{formatNumber(node.startupCost)}</span>
            </div>
            {node.filter && (
              <div className="plan-node__detail-row">
                <span>Filter</span>
                <span>{node.filter}</span>
              </div>
            )}
            {node.indexCondition && (
              <div className="plan-node__detail-row">
                <span>Index Cond</span>
                <span>{node.indexCondition}</span>
              </div>
            )}
            {node.hashCondition && (
              <div className="plan-node__detail-row">
                <span>Hash Cond</span>
                <span>{node.hashCondition}</span>
              </div>
            )}
            {node.joinFilter && (
              <div className="plan-node__detail-row">
                <span>Join Filter</span>
                <span>{node.joinFilter}</span>
              </div>
            )}
            {node.sortKey && (
              <div className="plan-node__detail-row">
                <span>Sort Key</span>
                <span>{Array.isArray(node.sortKey) ? node.sortKey.join(', ') : node.sortKey}</span>
              </div>
            )}
            {node.sortMethod && (
              <div className="plan-node__detail-row">
                <span>Sort Method</span>
                <span>{node.sortMethod} ({node.sortSpaceType}: {node.sortSpaceUsed}kB)</span>
              </div>
            )}
            <div className="plan-node__detail-row">
              <span>Shared Hit/Read</span>
              <span>{formatNumber(node.buffers?.sharedHit)} / {formatNumber(node.buffers?.sharedRead)}</span>
            </div>
            {(node.buffers?.tempRead > 0 || node.buffers?.tempWritten > 0) && (
              <div className="plan-node__detail-row">
                <span>Temp Read/Write</span>
                <span>{formatNumber(node.buffers.tempRead)} / {formatNumber(node.buffers.tempWritten)}</span>
              </div>
            )}
            {node.joinType && (
              <div className="plan-node__detail-row">
                <span>Join Type</span>
                <span>{node.joinType}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {node.children && node.children.length > 0 && (
        <div className="plan-node__children">
          {node.children.map(child => (
            <PlanNode
              key={child.id}
              node={child}
              highlightedNodeIds={highlightedNodeIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
