import React from 'react';
import Header from './components/Header';
import SqlEditor from './components/SqlEditor';
import ExampleQuerySelector from './components/ExampleQuerySelector';
import ExecutionSummary from './components/ExecutionSummary';
import PlanTree from './components/PlanTree';
import FindingsPanel from './components/FindingsPanel';
import RecommendationsPanel from './components/RecommendationsPanel';
import ComparisonPanel from './components/ComparisonPanel';
import HistoryPanel from './components/HistoryPanel';
import LoadingState from './components/LoadingState';
import ErrorAlert from './components/ErrorAlert';
import { useQueryAnalysis } from './hooks/useQueryAnalysis';

export default function App() {
  const {
    sql, setSql,
    loading,
    error, dismissError,
    result,
    comparison,
    testingId,
    resetting,
    analyse,
    testIndex,
    resetIndexes,
    clear
  } = useQueryAnalysis();

  const handleExampleSelect = (exampleSql) => {
    setSql(exampleSql);
  };

  const handleLoadFromHistory = (queryText) => {
    setSql(queryText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      <Header />

      <div className="main-grid">
        {/* SQL Editor Section */}
        <SqlEditor
          sql={sql}
          onSqlChange={setSql}
          onAnalyse={() => analyse()}
          onClear={clear}
          loading={loading}
        >
          <ExampleQuerySelector onSelect={handleExampleSelect} />
        </SqlEditor>

        {/* Error Display */}
        <ErrorAlert error={error} onDismiss={dismissError} />

        {/* Loading State */}
        {loading && <LoadingState />}

        {/* Results Section */}
        {result && !loading && (
          <div className="results-grid">
            {/* Execution Summary */}
            <div className="full-width">
              <ExecutionSummary summary={result.summary} />
            </div>

            {/* Plan Tree */}
            <PlanTree plan={result.plan} findings={result.findings} />

            {/* Findings */}
            <FindingsPanel findings={result.findings} />

            {/* Recommendations */}
            <RecommendationsPanel
              recommendations={result.recommendations}
              onTest={testIndex}
              testingId={testingId}
              onResetIndexes={resetIndexes}
              resetting={resetting}
            />

            {/* Before vs After Comparison */}
            {comparison && <ComparisonPanel comparison={comparison} />}
          </div>
        )}

        <hr className="section-divider" />

        {/* History */}
        <HistoryPanel onLoadQuery={handleLoadFromHistory} />
      </div>
    </div>
  );
}
