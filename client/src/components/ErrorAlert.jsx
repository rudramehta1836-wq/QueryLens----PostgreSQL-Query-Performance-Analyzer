import React from 'react';

export default function ErrorAlert({ error, onDismiss }) {
  if (!error) return null;

  return (
    <div className="error-alert" role="alert">
      <span className="error-alert__icon">⚠</span>
      <div className="error-alert__content">
        <div className="error-alert__title">Error</div>
        <div className="error-alert__message">{error}</div>
      </div>
      {onDismiss && (
        <button
          className="error-alert__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  );
}
