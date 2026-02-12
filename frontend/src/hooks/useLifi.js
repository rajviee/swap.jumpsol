import { useState, useEffect, useCallback, useMemo } from 'react';
import { lifiApi } from '../services/api';

// Chain IDs
export const SOLANA_CHAIN_ID = 1151111081099710;
export const TRON_CHAIN_ID = 728126428;
export const BITCOIN_CHAIN_ID = 20000000000001; // Custom ID for Bitcoin display

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
  8453: { 
    name: 'Base', 
    symbol: 'ETH', 
    icon: 'base', 
    color: '#0052FF',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg'
  },
  324: { 
    name: 'zkSync', 
    symbol: 'ETH', 
    icon: 'zksync', 
    color: '#8C8DFC',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/zksync.svg'
  },
  100: { 
    name: 'Gnosis', 
    symbol: 'xDAI', 
    icon: 'gnosis', 
    color: '#04795B',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/gnosis.svg'
  },
  [SOLANA_CHAIN_ID]: { 
    name: 'Solana', 
    symbol: 'SOL', 
    icon: 'sol', 
    color: '#9945FF',
    logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/solana.svg'
  },
  [TRON_CHAIN_ID]: { 
    name: 'Tron', 
    symbol: 'TRX', 
    icon: 'tron', 
    color: '#FF0013',
    logoURI: 'https://cryptologos.cc/logos/tron-trx-logo.svg'
  },
  [BITCOIN_CHAIN_ID]: { 
    name: 'Bitcoin', 
    symbol: 'BTC', 
    icon: 'btc', 
    color: '#F7931A',
    logoURI: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg'
  },
};

// Popular chain IDs to show by default - includes Tron and Bitcoin for display
export const POPULAR_CHAIN_IDS = [1, 42161, 10, 137, 56, 43114, 8453, SOLANA_CHAIN_ID, TRON_CHAIN_ID, BITCOIN_CHAIN_ID];

// Fallback Solana tokens
export const FALLBACK_SOLANA_TOKENS = [
  {
    address: 'So11111111111111111111111111111111111111112',
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

// Fallback Tron tokens (not directly supported by LI.FI but shown for user awareness)
export const FALLBACK_TRON_TOKENS = [
  {
    address: 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR',
    symbol: 'TRX',
    name: 'Tron',
    decimals: 6,
    chainId: TRON_CHAIN_ID,
    logoURI: 'https://cryptologos.cc/logos/tron-trx-logo.svg',
    priceUSD: '0',
    isNative: true,
  },
  {
    address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    symbol: 'USDT',
    name: 'Tether USD (TRC20)',
    decimals: 6,
    chainId: TRON_CHAIN_ID,
    logoURI: 'https://cryptologos.cc/logos/tether-usdt-logo.svg',
    priceUSD: '1',
  },
  {
    address: 'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9',
    symbol: 'WTRX',
    name: 'Wrapped TRX',
    decimals: 6,
    chainId: TRON_CHAIN_ID,
    logoURI: 'https://cryptologos.cc/logos/tron-trx-logo.svg',
    priceUSD: '0',
  },
];

// Fallback Bitcoin tokens
export const FALLBACK_BITCOIN_TOKENS = [
  {
    address: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    chainId: BITCOIN_CHAIN_ID,
    logoURI: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg',
    priceUSD: '0',
    isNative: true,
  },
];

// Custom chains that LI.FI doesn't support but we show
export const CUSTOM_CHAINS = [
  {
    id: TRON_CHAIN_ID,
    name: 'Tron',
    key: 'tron',
    chainType: 'TVM',
    coin: 'TRX',
    mainnet: true,
    logoURI: CHAIN_INFO[TRON_CHAIN_ID].logoURI,
    isCustom: true,
    notSupported: true,
  },
  {
    id: BITCOIN_CHAIN_ID,
    name: 'Bitcoin',
    key: 'btc',
    chainType: 'UTXO',
    coin: 'BTC',
    mainnet: true,
    logoURI: CHAIN_INFO[BITCOIN_CHAIN_ID].logoURI,
    isCustom: true,
    notSupported: true,
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
      const data = await lifiApi.getChains();
      const allChains = data.chains || [];
      
      // Check for Solana
      const hasSolana = allChains.some(c => c.id === SOLANA_CHAIN_ID);
      
      // Sort: popular chains first
      const popularChains = allChains.filter(c => POPULAR_CHAIN_IDS.includes(c.id));
      const otherChains = allChains.filter(c => !POPULAR_CHAIN_IDS.includes(c.id));
      
      // Add Solana if not present
      if (!hasSolana) {
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
      
      // Add custom chains (Tron, Bitcoin) at the end of popular chains
      const finalChains = [...popularChains, ...CUSTOM_CHAINS.filter(c => !popularChains.some(p => p.id === c.id)), ...otherChains];
      
      setChains(finalChains);
    } catch (err) {
      console.error('[LI.FI] Failed to fetch chains:', err);
      setError(err.message || 'Failed to fetch chains');
      // Set fallback chains on error
      setChains([
        { id: 1, name: 'Ethereum', key: 'eth', chainType: 'EVM', coin: 'ETH', mainnet: true, logoURI: CHAIN_INFO[1].logoURI },
        { id: 56, name: 'BNB Chain', key: 'bsc', chainType: 'EVM', coin: 'BNB', mainnet: true, logoURI: CHAIN_INFO[56].logoURI },
        { id: 137, name: 'Polygon', key: 'pol', chainType: 'EVM', coin: 'MATIC', mainnet: true, logoURI: CHAIN_INFO[137].logoURI },
        ...CUSTOM_CHAINS,
      ]);
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

  // Filter out custom chain IDs that LI.FI doesn't support
  const supportedChainIds = useMemo(() => 
    chainIds.filter(id => id !== TRON_CHAIN_ID && id !== BITCOIN_CHAIN_ID),
    [chainIds]
  );
  
  const chainIdsKey = useMemo(() => supportedChainIds.sort((a,b) => a-b).join(','), [supportedChainIds]);

  const fetchTokens = useCallback(async () => {
    if (supportedChainIds.length === 0 && !chainIds.includes(TRON_CHAIN_ID) && !chainIds.includes(BITCOIN_CHAIN_ID)) {
      setTokens({});
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let normalizedTokens = {};
      
      // Fetch from LI.FI for supported chains
      if (supportedChainIds.length > 0) {
        const data = await lifiApi.getTokens(supportedChainIds);
        const fetchedTokens = data.tokens || {};
        
        // Normalize keys to numbers
        Object.keys(fetchedTokens).forEach(key => {
          normalizedTokens[Number(key)] = fetchedTokens[key];
        });
      }
      
      // Add Solana fallback if needed
      if (chainIds.includes(SOLANA_CHAIN_ID)) {
        const solanaTokens = normalizedTokens[SOLANA_CHAIN_ID] || [];
        if (solanaTokens.length === 0) {
          normalizedTokens[SOLANA_CHAIN_ID] = FALLBACK_SOLANA_TOKENS;
        } else {
          // Ensure SOL is at the top
          const solIndex = solanaTokens.findIndex(t => 
            t.symbol === 'SOL' || t.address === 'So11111111111111111111111111111111111111112'
          );
          if (solIndex > 0) {
            const sol = solanaTokens.splice(solIndex, 1)[0];
            solanaTokens.unshift(sol);
          } else if (solIndex === -1) {
            solanaTokens.unshift(FALLBACK_SOLANA_TOKENS[0]);
          }
          normalizedTokens[SOLANA_CHAIN_ID] = solanaTokens;
        }
      }
      
      // Add Tron tokens (custom, not from LI.FI)
      if (chainIds.includes(TRON_CHAIN_ID)) {
        normalizedTokens[TRON_CHAIN_ID] = FALLBACK_TRON_TOKENS;
      }
      
      // Add Bitcoin tokens (custom, not from LI.FI)
      if (chainIds.includes(BITCOIN_CHAIN_ID)) {
        normalizedTokens[BITCOIN_CHAIN_ID] = FALLBACK_BITCOIN_TOKENS;
      }
      
      setTokens(normalizedTokens);
    } catch (err) {
      console.error('[LI.FI] Failed to fetch tokens:', err);
      setError(err.message || 'Failed to fetch tokens');
      
      // Use fallback tokens on error
      const fallbackTokens = {};
      if (chainIds.includes(SOLANA_CHAIN_ID)) {
        fallbackTokens[SOLANA_CHAIN_ID] = FALLBACK_SOLANA_TOKENS;
      }
      if (chainIds.includes(TRON_CHAIN_ID)) {
        fallbackTokens[TRON_CHAIN_ID] = FALLBACK_TRON_TOKENS;
      }
      if (chainIds.includes(BITCOIN_CHAIN_ID)) {
        fallbackTokens[BITCOIN_CHAIN_ID] = FALLBACK_BITCOIN_TOKENS;
      }
      setTokens(fallbackTokens);
    } finally {
      setLoading(false);
    }
  }, [chainIdsKey, chainIds]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

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
    
    // Check if chains are supported by LI.FI
    if (params.fromChain === TRON_CHAIN_ID || params.toChain === TRON_CHAIN_ID ||
        params.fromChain === BITCOIN_CHAIN_ID || params.toChain === BITCOIN_CHAIN_ID) {
      setError('This chain is not yet supported for swaps. Coming soon!');
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

// Utility functions
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

export function parseTokenAmount(amount, decimals) {
  if (!amount || !decimals) return '0';
  const value = parseFloat(amount);
  if (isNaN(value)) return '0';
  return Math.floor(value * Math.pow(10, decimals)).toString();
}

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

export function formatTimeEstimate(seconds) {
  if (!seconds) return 'Unknown';
  if (seconds < 60) return `~${seconds}s`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)}m`;
  return `~${Math.round(seconds / 3600)}h`;
}

export function getChainLogoUrl(chainId) {
  const info = CHAIN_INFO[chainId];
  if (info?.logoURI) return info.logoURI;
  return null;
}

export function getTokenLogoUrl(token) {
  if (token?.logoURI) return token.logoURI;
  return null;
}

export function isChainSupported(chainId) {
  // Tron and Bitcoin are displayed but not yet supported for swaps
  return chainId !== TRON_CHAIN_ID && chainId !== BITCOIN_CHAIN_ID;
}
