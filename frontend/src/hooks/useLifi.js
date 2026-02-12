import { useState, useEffect, useCallback, useMemo } from 'react';
import { lifiApi } from '../services/api';

// Chain ID mapping for icons and names
export const CHAIN_INFO = {
  1: { name: 'Ethereum', symbol: 'ETH', icon: 'eth', color: '#627EEA' },
  10: { name: 'Optimism', symbol: 'ETH', icon: 'op', color: '#FF0420' },
  56: { name: 'BNB Chain', symbol: 'BNB', icon: 'bnb', color: '#F3BA2F' },
  137: { name: 'Polygon', symbol: 'MATIC', icon: 'matic', color: '#8247E5' },
  42161: { name: 'Arbitrum', symbol: 'ETH', icon: 'arb', color: '#12AAFF' },
  43114: { name: 'Avalanche', symbol: 'AVAX', icon: 'avax', color: '#E84142' },
  1151111081099710: { name: 'Solana', symbol: 'SOL', icon: 'sol', color: '#9945FF' },
};

// Popular chain IDs to show by default
export const POPULAR_CHAIN_IDS = [1, 42161, 10, 137, 56, 43114, 1151111081099710];

export function useChains() {
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchChains = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await lifiApi.getChains();
      // Filter to popular chains and sort
      const allChains = data.chains || [];
      const popularChains = allChains.filter(c => POPULAR_CHAIN_IDS.includes(c.id));
      const otherChains = allChains.filter(c => !POPULAR_CHAIN_IDS.includes(c.id));
      setChains([...popularChains, ...otherChains]);
    } catch (err) {
      console.error('Failed to fetch chains:', err);
      setError(err.message || 'Failed to fetch chains');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChains();
  }, [fetchChains]);

  return { chains, loading, error, refetch: fetchChains };
}

export function useTokens(chainIds = []) {
  const [tokens, setTokens] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTokens = useCallback(async () => {
    if (chainIds.length === 0) {
      setTokens({});
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await lifiApi.getTokens(chainIds);
      setTokens(data.tokens || {});
    } catch (err) {
      console.error('Failed to fetch tokens:', err);
      setError(err.message || 'Failed to fetch tokens');
    } finally {
      setLoading(false);
    }
  }, [chainIds.join(',')]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Get tokens for a specific chain
  const getTokensForChain = useCallback((chainId) => {
    return tokens[chainId] || [];
  }, [tokens]);

  return { tokens, loading, error, refetch: fetchTokens, getTokensForChain };
}

export function useQuote() {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchQuote = useCallback(async (params) => {
    if (!params.fromChain || !params.toChain || !params.fromToken || 
        !params.toToken || !params.fromAmount || !params.fromAddress) {
      setQuote(null);
      return null;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await lifiApi.getQuote(params);
      setQuote(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch quote:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to fetch quote';
      setError(errorMessage);
      setQuote(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearQuote = useCallback(() => {
    setQuote(null);
    setError(null);
  }, []);

  return { quote, loading, error, fetchQuote, clearQuote };
}

export function useRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRoutes = useCallback(async (params) => {
    if (!params.fromChain || !params.toChain || !params.fromToken || 
        !params.toToken || !params.fromAmount || !params.fromAddress) {
      setRoutes([]);
      return [];
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await lifiApi.getRoutes(params);
      setRoutes(data.routes || []);
      return data.routes || [];
    } catch (err) {
      console.error('Failed to fetch routes:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to fetch routes';
      setError(errorMessage);
      setRoutes([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const clearRoutes = useCallback(() => {
    setRoutes([]);
    setError(null);
  }, []);

  return { routes, loading, error, fetchRoutes, clearRoutes };
}

export function useTxStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async ({ txHash, fromChain, toChain, bridge }) => {
    if (!txHash || !fromChain || !toChain) {
      return null;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await lifiApi.getStatus({ txHash, fromChain, toChain, bridge });
      setStatus(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch status:', err);
      setError(err.message || 'Failed to fetch status');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, loading, error, fetchStatus };
}

// Utility function to format token amount
export function formatTokenAmount(amount, decimals, precision = 6) {
  if (!amount || !decimals) return '0';
  const value = Number(amount) / Math.pow(10, decimals);
  if (value === 0) return '0';
  if (value < 0.000001) return '<0.000001';
  return value.toLocaleString(undefined, { 
    minimumFractionDigits: 0,
    maximumFractionDigits: precision 
  });
}

// Utility function to parse token amount to wei
export function parseTokenAmount(amount, decimals) {
  if (!amount || !decimals) return '0';
  const value = parseFloat(amount);
  if (isNaN(value)) return '0';
  return Math.floor(value * Math.pow(10, decimals)).toString();
}

// Format USD value
export function formatUSD(value) {
  if (!value) return '$0.00';
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Format time estimate
export function formatTimeEstimate(seconds) {
  if (!seconds) return 'Unknown';
  if (seconds < 60) return `~${seconds}s`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)}m`;
  return `~${Math.round(seconds / 3600)}h`;
}
