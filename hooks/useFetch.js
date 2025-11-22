import { useEffect, useRef, useState } from 'react';

export const useFetch = (apiFunc, params = null) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const paramsRef = useRef(null);
  const paramsStringRef = useRef(null);

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
    // Comparer les params par valeur (deep comparison) plutôt que par référence
    const paramsString = params !== null && params !== undefined ? JSON.stringify(params) : 'null';
    
    // Si les params n'ont pas changé (même valeur), ne pas recharger
    if (paramsStringRef.current === paramsString && paramsRef.current === apiFunc) {
      return;
    }

    // Mettre à jour les références
    paramsRef.current = apiFunc;
    paramsStringRef.current = paramsString;

    let mounted = true;
    fetchData();
    return () => { mounted = false };
  }, [apiFunc, params]);

  const refetch = () => {
    fetchData();
  };

  return { data, loading, error, refetch };
};