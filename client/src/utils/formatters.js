/**
 * Format milliseconds to a readable string.
 */
export function formatTime(ms) {
  if (ms == null) return '—';
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Format a large number with commas.
 */
export function formatNumber(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

/**
 * Format a percentage.
 */
export function formatPercent(value) {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

/**
 * Truncate a string to maxLen characters.
 */
export function truncate(str, maxLen = 80) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '…';
}

/**
 * Format a date to a readable string.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get a CSS class suffix for a node type.
 */
export function getNodeTypeClass(nodeType) {
  if (!nodeType) return '';
  const lower = nodeType.toLowerCase();
  if (lower.includes('seq scan')) return 'seq-scan';
  if (lower.includes('index only scan')) return 'index-scan';
  if (lower.includes('index scan')) return 'index-scan';
  if (lower.includes('bitmap')) return 'bitmap';
  if (lower.includes('hash join') || lower.includes('hash')) return 'hash-join';
  if (lower.includes('nested loop')) return 'nested-loop';
  if (lower.includes('merge join')) return 'hash-join';
  if (lower.includes('sort')) return 'sort';
  if (lower.includes('aggregate') || lower.includes('group')) return 'aggregate';
  return '';
}
