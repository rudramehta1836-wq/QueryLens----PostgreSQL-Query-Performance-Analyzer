import { useState, useCallback } from 'react';
import { analyseQuery, testRecommendation, resetDemoIndexes } from '../api/queryApi';

/**
 * Main state management hook for the query analysis workflow.
 */
export function useQueryAnalysis() {
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [resetting, setResetting] = useState(false);

  const analyse = useCallback(async (query) => {
    const queryToRun = query || sql;
    if (!queryToRun.trim()) {
      setError('Please enter a SQL query.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setComparison(null);

    try {
      const response = await analyseQuery(queryToRun);
      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error?.message || 'Analysis failed.');
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.message
        || 'An unexpected error occurred.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sql]);

  const testIndex = useCallback(async (serverId) => {
    if (!result?.query) return;

    setTestingId(serverId);
    setComparison(null);

    try {
      const response = await testRecommendation(serverId, result.query);
      if (response.success) {
        setComparison(response.data);
      } else {
        setError(response.error?.message || 'Test failed.');
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.message
        || 'Test failed.';
      setError(msg);
    } finally {
      setTestingId(null);
    }
  }, [result]);

  const resetIndexes = useCallback(async () => {
    setResetting(true);
    try {
      await resetDemoIndexes();
      setComparison(null);
    } catch (err) {
      console.error('Failed to reset indexes:', err);
    } finally {
      setResetting(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSql('');
    setResult(null);
    setError(null);
    setComparison(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
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
  };
}
