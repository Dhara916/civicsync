import { useEffect, useState } from 'react';
export function useDebounced<T>(value: T, delay = 300): T {
  const [result, setResult] = useState(value);
  useEffect(() => { const id = window.setTimeout(() => setResult(value), delay); return () => window.clearTimeout(id); }, [value, delay]);
  return result;
}
