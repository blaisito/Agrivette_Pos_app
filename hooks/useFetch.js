import { useEffect, useState } from 'react';

export const useFetch = (apiFunc, params = null) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = params ? await apiFunc(params) : await apiFunc();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Erreur API');
      }
    } catch (err) {
      setError(err.message || 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchData();
    return () => { mounted = false };
  }, [apiFunc, params]);

  const refetch = () => {
    fetchData();
  };

  return { data, loading, error, refetch };
};