import { useCallback, useState } from 'react';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const execute = useCallback(async (apiFunc, ...args) => {
    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      const response = await apiFunc(...args);
      
      if (response.success) {
        setData(response.data);
        return true;
      } else {
        setError(response.message || 'Une erreur est survenue');
        return false;
      }
    } catch (err) {
      setError(err.message || 'Erreur réseau');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error, data };
};