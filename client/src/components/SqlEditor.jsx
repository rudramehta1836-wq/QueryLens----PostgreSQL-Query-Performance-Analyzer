import React from 'react';

export default function SqlEditor({
  sql,
  onSqlChange,
  onAnalyse,
  onClear,
  loading,
  children // for ExampleQuerySelector
}) {
  const handleKeyDown = (e) => {
    // Ctrl/Cmd + Enter to analyse
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onAnalyse();
    }
    // Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const value = e.target.value;
      onSqlChange(value.substring(0, start) + '  ' + value.substring(end));
      // Set cursor position after indent
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="card sql-editor">
      <div className="card__header">
        <h2 className="card__title">
          <span>📝</span> SQL Editor
        </h2>
        <span className="card__badge">Read-only queries</span>
      </div>

      <div className="sql-editor__controls">
        {children}
      </div>

      <textarea
        id="sql-editor-input"
        className="sql-editor__textarea"
        value={sql}
        onChange={(e) => onSqlChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter your PostgreSQL SELECT query here...&#10;&#10;Tip: Press Ctrl+Enter to analyse"
        spellCheck={false}
        aria-label="SQL query input"
      />

      <div className="sql-editor__actions">
        <button
          id="analyse-btn"
          className="btn btn--primary"
          onClick={onAnalyse}
          disabled={loading || !sql.trim()}
          aria-label="Analyse query"
        >
          {loading ? '⏳ Analysing...' : '▶ Analyse Query'}
        </button>
        <button
          id="clear-btn"
          className="btn btn--secondary"
          onClick={onClear}
          disabled={loading}
          aria-label="Clear editor"
        >
          ✕ Clear
        </button>
      </div>
    </div>
  );
}
