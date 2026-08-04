import React from 'react';

export default function Header() {
  return (
    <header className="app-header">
      <div className="app-header__logo">
        <span className="app-header__icon">🔍</span>
        <h1>QueryLens</h1>
      </div>
      <p className="app-header__subtitle">
        Analyze PostgreSQL query performance, visualize execution plans,
        detect bottlenecks, and get index recommendations.
      </p>
    </header>
  );
}
