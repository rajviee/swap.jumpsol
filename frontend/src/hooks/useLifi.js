import { useState, useEffect, useCallback, useMemo } from 'react';
import { lifiApi } from '../services/api';

// Solana chain ID used by LI.FI
export const SOLANA_CHAIN_ID = 1151111081099710;

// Chain ID mapping for icons and names with real logo URLs
export const CHAIN_INFO = {
  1: { 
    name: 'Ethereum', 
    symbol: 'ETH', 
    icon: 'eth', 
    color: '#627EEA',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg'
  },
  10: { 
    name: 'Optimism', 
    symbol: 'ETH', 
    icon: 'op', 
    color: '#FF0420',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg'
  },
  56: { 
    name: 'BNB Chain', 
    symbol: 'BNB', 
    icon: 'bnb', 
    color: '#F3BA2F',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/bsc.svg'
  },
  137: { 
    name: 'Polygon', 
    symbol: 'MATIC', 
    icon: 'matic', 
    color: '#8247E5',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg'
  },
  42161: { 
    name: 'Arbitrum', 
    symbol: 'ETH', 
    icon: 'arb', 
    color: '#12AAFF',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg'
  },
  43114: { 
    name: 'Avalanche', 
    symbol: 'AVAX', 
    icon: 'avax', 
    color: '#E84142',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/avalanche.svg'
  },
  [SOLANA_CHAIN_ID]: { 
    name: 'Solana', 
    symbol: 'SOL', 
    icon: 'sol', 
    color: '#9945FF',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/solana.svg'
  },
};

// Popular chain IDs to show by default - INCLUDES SOLANA
export const POPULAR_CHAIN_IDS = [1, 42161, 10, 137, 56, 43114, SOLANA_CHAIN_ID];

// Fallback Solana tokens if API fails
export const FALLBACK_SOLANA_TOKENS = [
  {
    address: '11111111111111111111111111111111',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    chainId: SOLANA_CHAIN_ID,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    priceUSD: '0',
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: SOLANA_CHAIN_ID,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    priceUSD: '1',
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    chainId: SOLANA_CHAIN_ID,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    priceUSD: '1',
  },
];

export function useChains() {
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchChains = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[LI.FI] Fetching chains...');
      const data = await lifiApi.getChains();
      const allChains = data.chains || [];
      
      console.log('[LI.FI] Chains received:', allChains.length);
      
      // Check if Solana is included
      const hasSolana = allChains.some(c => c.id === SOLANA_CHAIN_ID);
      console.log('[LI.FI] Solana in chain list:', hasSolana);
      
      // Sort: popular chains first, then others
      const popularChains = allChains.filter(c => POPULAR_CHAIN_IDS.includes(c.id));
      const otherChains = allChains.filter(c => !POPULAR_CHAIN_IDS.includes(c.id));
      
      // Ensure Solana is in the list if not present
      if (!hasSolana) {
        console.log('[LI.FI] Adding Solana chain manually');
        popularChains.push({
          id: SOLANA_CHAIN_ID,
          name: 'Solana',
          key: 'sol',
          chainType: 'SVM',
          coin: 'SOL',
          mainnet: true,
          logoURI: CHAIN_INFO[SOLANA_CHAIN_ID].logoURI,
        });
      }
      
      setChains([...popularChains, ...otherChains]);
    } catch (err) {
      console.error('[LI.FI] Failed to fetch chains:', err);
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

  const chainIdsKey = useMemo(() => chainIds.sort().join(','), [chainIds]);

  const fetchTokens = useCallback(async () => {
    if (chainIds.length === 0) {
      setTokens({});
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      console.log('[LI.FI] Fetching tokens for chains:', chainIds);
      const data = await lifiApi.getTokens(chainIds);
      const fetchedTokens = data.tokens || {};
      
      console.log('[LI.FI] Tokens received for chains:', Object.keys(fetchedTokens));
      
      // Add fallback Solana tokens if Solana chain is requested but no tokens returned
      if (chainIds.includes(SOLANA_CHAIN_ID)) {
        const solanaTokens = fetchedTokens[SOLANA_CHAIN_ID] || [];
        console.log('[LI.FI] Solana tokens count:', solanaTokens.length);
        
        if (solanaTokens.length === 0) {
          console.log('[LI.FI] Using fallback Solana tokens');
          fetchedTokens[SOLANA_CHAIN_ID] = FALLBACK_SOLANA_TOKENS;
        } else {
          // Ensure SOL is at the top
          const solIndex = solanaTokens.findIndex(t => 
            t.symbol === 'SOL' || t.address === '11111111111111111111111111111111'
          );
          if (solIndex > 0) {
            const sol = solanaTokens.splice(solIndex, 1)[0];
            solanaTokens.unshift(sol);
          } else if (solIndex === -1) {
            // Add SOL if not present
            solanaTokens.unshift(FALLBACK_SOLANA_TOKENS[0]);
          }
          fetchedTokens[SOLANA_CHAIN_ID] = solanaTokens;
        }
      }
      
      setTokens(fetchedTokens);
    } catch (err) {
      console.error('[LI.FI] Failed to fetch tokens:', err);
      setError(err.message || 'Failed to fetch tokens');
      
      // Use fallback tokens for Solana on error
      if (chainIds.includes(SOLANA_CHAIN_ID)) {
        console.log('[LI.FI] Using fallback Solana tokens due to error');
        setTokens(prev => ({
          ...prev,
          [SOLANA_CHAIN_ID]: FALLBACK_SOLANA_TOKENS,
        }));
      }
    } finally {
      setLoading(false);
    }
  }, [chainIdsKey]);

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
      console.error('[LI.FI] Failed to fetch quote:', err);
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
      console.error('[LI.FI] Failed to fetch routes:', err);
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
      console.error('[LI.FI] Failed to fetch status:', err);
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

// Get chain logo URL
export function getChainLogoUrl(chainId) {
  const info = CHAIN_INFO[chainId];
  if (info?.logoURI) return info.logoURI;
  return null;
}

// Get token logo URL with fallback
export function getTokenLogoUrl(token) {
  if (token?.logoURI) return token.logoURI;
  return null;
}
