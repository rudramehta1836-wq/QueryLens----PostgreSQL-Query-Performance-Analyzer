import React from 'react';

export default function LoadingState({ text = 'Analysing query...' }) {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <span className="loading-state__text">{text}</span>
    </div>
  );
}
