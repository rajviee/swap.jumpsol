import { useState, useEffect, useCallback, useMemo } from 'react';
import { lifiApi } from '../services/api';
import { useWalletStore } from '../store/walletStore';

// Chain IDs
export const SOLANA_CHAIN_ID = 1151111081099710;
export const TRON_CHAIN_ID = 728126428;
export const BITCOIN_CHAIN_ID = 20000000000001;

// Chain logos and info
export const CHAIN_INFO = {
  1: { name: 'Ethereum', symbol: 'ETH', color: '#627EEA', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg' },
  10: { name: 'Optimism', symbol: 'ETH', color: '#FF0420', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg' },
  56: { name: 'BNB Chain', symbol: 'BNB', color: '#F3BA2F', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/bsc.svg' },
  137: { name: 'Polygon', symbol: 'MATIC', color: '#8247E5', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg' },
  42161: { name: 'Arbitrum', symbol: 'ETH', color: '#12AAFF', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg' },
  43114: { name: 'Avalanche', symbol: 'AVAX', color: '#E84142', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/avalanche.svg' },
  8453: { name: 'Base', symbol: 'ETH', color: '#0052FF', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg' },
  324: { name: 'zkSync', symbol: 'ETH', color: '#8C8DFC', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/zksync.svg' },
  100: { name: 'Gnosis', symbol: 'xDAI', color: '#04795B', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/gnosis.svg' },
  250: { name: 'Fantom', symbol: 'FTM', color: '#1969FF', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/fantom.svg' },
  [SOLANA_CHAIN_ID]: { name: 'Solana', symbol: 'SOL', color: '#9945FF', logo: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/solana.svg' },
  [TRON_CHAIN_ID]: { name: 'Tron', symbol: 'TRX', color: '#FF0013', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png' },
  [BITCOIN_CHAIN_ID]: { name: 'Bitcoin', symbol: 'BTC', color: '#F7931A', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png' },
};

// Priority chains for display
export const PRIORITY_CHAINS = [1, 42161, 10, 8453, 56, 137, 43114, SOLANA_CHAIN_ID, TRON_CHAIN_ID, BITCOIN_CHAIN_ID];

// Fallback tokens
export const FALLBACK_TOKENS = {
  [SOLANA_CHAIN_ID]: [
    { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', decimals: 9, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
    { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
    { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether', decimals: 6, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png' },
  ],
  [TRON_CHAIN_ID]: [
    { address: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', symbol: 'TRX', name: 'Tron', decimals: 6, logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png', isNative: true },
    { address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', symbol: 'USDT', name: 'Tether TRC20', decimals: 6, logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png' },
  ],
  [BITCOIN_CHAIN_ID]: [
    { address: 'btc', symbol: 'BTC', name: 'Bitcoin', decimals: 8, logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png', isNative: true },
  ],
};

// Custom chains not in LI.FI
export const CUSTOM_CHAINS = [
  { id: TRON_CHAIN_ID, name: 'Tron', key: 'tron', coin: 'TRX', chainType: 'TVM', isCustom: true },
  { id: BITCOIN_CHAIN_ID, name: 'Bitcoin', key: 'btc', coin: 'BTC', chainType: 'UTXO', isCustom: true },
];

// Check if chain is supported for swaps
// TRON and BITCOIN require special handling but can swap via wrapped tokens on other chains
export const isSwapSupported = (chainId) => {
  // Bitcoin is fully unsupported for now
  if (chainId === BITCOIN_CHAIN_ID) return false;
  // All other chains including Tron and Solana are supported
  return true;
};

// Check if chain requires bridge (non-native LI.FI support)
export const requiresBridge = (chainId) => {
  return chainId === TRON_CHAIN_ID;
};

// Hooks
export function useChains() {
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const fetch = async () => {
      try {
        const data = await lifiApi.getChains();
        if (!mounted) return;
        
        const all = data.chains || [];
        
        // Sort by priority
        const priority = all.filter(c => PRIORITY_CHAINS.includes(c.id));
        const others = all.filter(c => !PRIORITY_CHAINS.includes(c.id));
        priority.sort((a, b) => PRIORITY_CHAINS.indexOf(a.id) - PRIORITY_CHAINS.indexOf(b.id));
        
        // Add custom chains
        const combined = [...priority, ...CUSTOM_CHAINS.filter(c => !priority.some(p => p.id === c.id)), ...others];
        setChains(combined);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetch();
    return () => { mounted = false; };
  }, []);

  return { chains, loading, error };
}

export function useTokens(chainIds = []) {
  const [tokens, setTokens] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filter non-LI.FI chains
  const lifiChainIds = useMemo(() => 
    chainIds.filter(id => id !== TRON_CHAIN_ID && id !== BITCOIN_CHAIN_ID),
    [chainIds]
  );

  useEffect(() => {
    let mounted = true;
    
    const fetch = async () => {
      if (lifiChainIds.length === 0 && !chainIds.includes(TRON_CHAIN_ID) && !chainIds.includes(BITCOIN_CHAIN_ID)) {
        setTokens({});
        return;
      }
      
      setLoading(true);
      try {
        let result = {};
        
        if (lifiChainIds.length > 0) {
          const data = await lifiApi.getTokens(lifiChainIds);
          // Normalize keys to numbers
          Object.entries(data.tokens || {}).forEach(([k, v]) => {
            result[Number(k)] = v;
          });
        }
        
        // Add fallback tokens for custom chains
        [SOLANA_CHAIN_ID, TRON_CHAIN_ID, BITCOIN_CHAIN_ID].forEach(cid => {
          if (chainIds.includes(cid) && (!result[cid] || result[cid].length === 0)) {
            result[cid] = FALLBACK_TOKENS[cid] || [];
          }
        });
        
        if (mounted) setTokens(result);
      } catch (err) {
        if (mounted) {
          setError(err.message);
          // Use fallbacks on error
          const fallback = {};
          chainIds.forEach(cid => {
            if (FALLBACK_TOKENS[cid]) fallback[cid] = FALLBACK_TOKENS[cid];
          });
          setTokens(fallback);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetch();
    return () => { mounted = false; };
  }, [lifiChainIds.join(','), chainIds.join(',')]);

  return { tokens, loading, error };
}

export function useQuote() {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchQuote = useCallback(async (params) => {
    const { fromChain, toChain, fromToken, toToken, fromAmount, fromAddress } = params;
    
    if (!fromChain || !toChain || !fromToken || !toToken || !fromAmount || !fromAddress) {
      setQuote(null);
      return null;
    }
    
    // Check if swap is supported
    if (!isSwapSupported(fromChain)) {
      setError(`${CHAIN_INFO[fromChain]?.name || 'This chain'} is not yet supported for swaps`);
      return null;
    }
    
    if (!isSwapSupported(toChain)) {
      setError(`${CHAIN_INFO[toChain]?.name || 'This chain'} is not yet supported for swaps`);
      return null;
    }
    
    // Special handling for Tron - it requires bridge routes
    if (requiresBridge(fromChain) || requiresBridge(toChain)) {
      setError('Tron swaps require using wrapped tokens. This feature is coming soon.');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await lifiApi.getQuote(params);
      setQuote(data);
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Quote failed';
      setError(msg);
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

// Balance fetching
export async function fetchEvmBalance(provider, address, tokenAddress) {
  try {
    if (tokenAddress === '0x0000000000000000000000000000000000000000' || tokenAddress === 'native') {
      const balance = await provider.getBalance(address);
      return balance.toString();
    }
    // ERC-20
    const contract = new (await import('ethers')).Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    const balance = await contract.balanceOf(address);
    return balance.toString();
  } catch {
    return '0';
  }
}

// Utility functions
export function formatTokenAmount(amount, decimals, precision = 6) {
  if (!amount || !decimals) return '0';
  const val = Number(amount) / Math.pow(10, decimals);
  if (val === 0) return '0';
  if (val < 0.000001) return '<0.000001';
  return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: precision });
}

export function parseTokenAmount(amount, decimals) {
  if (!amount || !decimals) return '0';
  const val = parseFloat(amount);
  if (isNaN(val)) return '0';
  return Math.floor(val * Math.pow(10, decimals)).toString();
}

export function formatUSD(value) {
  if (!value) return '$0.00';
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

export function formatTime(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `~${seconds}s`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)}m`;
  return `~${Math.round(seconds / 3600)}h`;
}

export function getChainLogo(chainId) {
  return CHAIN_INFO[chainId]?.logo || null;
}

export function getChainName(chainId) {
  return CHAIN_INFO[chainId]?.name || `Chain ${chainId}`;
}
