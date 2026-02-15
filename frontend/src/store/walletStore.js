import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Chain IDs
export const SOLANA_CHAIN_ID = 1151111081099710;
export const TRON_CHAIN_ID = 728126428;
export const BITCOIN_CHAIN_ID = 20000000000001;

// EVM Chain configs
export const EVM_CHAINS = {
  1: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  42161: { name: 'Arbitrum', symbol: 'ETH', decimals: 18 },
  10: { name: 'Optimism', symbol: 'ETH', decimals: 18 },
  137: { name: 'Polygon', symbol: 'MATIC', decimals: 18 },
  56: { name: 'BNB Chain', symbol: 'BNB', decimals: 18 },
  43114: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  8453: { name: 'Base', symbol: 'ETH', decimals: 18 },
  324: { name: 'zkSync', symbol: 'ETH', decimals: 18 },
  100: { name: 'Gnosis', symbol: 'xDAI', decimals: 18 },
  250: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
  59144: { name: 'Linea', symbol: 'ETH', decimals: 18 },
  534352: { name: 'Scroll', symbol: 'ETH', decimals: 18 },
};

// Chain params for wallet_addEthereumChain
const CHAIN_PARAMS = {
  1: { chainId: '0x1', chainName: 'Ethereum Mainnet', rpcUrls: ['https://eth.llamarpc.com'], blockExplorerUrls: ['https://etherscan.io'] },
  42161: { chainId: '0xa4b1', chainName: 'Arbitrum One', rpcUrls: ['https://arb1.arbitrum.io/rpc'], blockExplorerUrls: ['https://arbiscan.io'] },
  10: { chainId: '0xa', chainName: 'Optimism', rpcUrls: ['https://mainnet.optimism.io'], blockExplorerUrls: ['https://optimistic.etherscan.io'] },
  137: { chainId: '0x89', chainName: 'Polygon', rpcUrls: ['https://polygon-rpc.com'], blockExplorerUrls: ['https://polygonscan.com'] },
  56: { chainId: '0x38', chainName: 'BNB Smart Chain', rpcUrls: ['https://bsc-dataseed.binance.org'], blockExplorerUrls: ['https://bscscan.com'] },
  43114: { chainId: '0xa86a', chainName: 'Avalanche', rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'], blockExplorerUrls: ['https://snowtrace.io'] },
  8453: { chainId: '0x2105', chainName: 'Base', rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] },
};

export const useWalletStore = create(
  persist(
    (set, get) => ({
      // EVM State
      evmAddress: null,
      evmChainId: null,
      evmConnected: false,
      evmConnecting: false,
      evmWalletType: null, // 'metamask' | 'trustwallet' | 'walletconnect'
      
      // Solana State
      solanaAddress: null,
      solanaConnected: false,
      solanaConnecting: false,
      
      // Tron State
      tronAddress: null,
      tronConnected: false,
      tronConnecting: false,
      
      // Balances (cached)
      balances: {}, // { [chainId]: { [tokenAddress]: balance } }
      
      // Active wallet type
      activeWalletType: null, // 'evm' | 'solana' | 'tron'
      
      // Last used chain (persisted)
      lastUsedChainId: 1,
      
      // Environment
      environment: 'mainnet', // 'mainnet' | 'testnet'
      
      // UI
      showWalletModal: false,
      
      setShowWalletModal: (show) => set({ showWalletModal: show }),
      setLastUsedChainId: (chainId) => set({ lastUsedChainId: chainId }),
      setEnvironment: (env) => set({ environment: env }),
      toggleEnvironment: () => set(state => ({ environment: state.environment === 'mainnet' ? 'testnet' : 'mainnet' })),
      
      // Connect EVM (MetaMask, Trust Wallet)
      connectEvm: async (walletType = 'metamask') => {
        let provider = null;
        
        if (walletType === 'trustwallet') {
          provider = window.trustwallet || window.ethereum;
          if (window.ethereum?.providers) {
            const trust = window.ethereum.providers.find(p => p.isTrust || p.isTrustWallet);
            if (trust) provider = trust;
          }
          if (!provider) throw new Error('Trust Wallet not installed');
        } else {
          provider = window.ethereum;
          if (!provider) throw new Error('No EVM wallet found');
        }
        
        set({ evmConnecting: true });
        
        try {
          const accounts = await provider.request({ method: 'eth_requestAccounts' });
          const chainIdHex = await provider.request({ method: 'eth_chainId' });
          const chainId = parseInt(chainIdHex, 16);
          
          // Detect environment
          const isTestnet = [5, 11155111, 80001, 97, 43113].includes(chainId);
          
          set({
            evmAddress: accounts[0],
            evmChainId: chainId,
            evmConnected: true,
            evmConnecting: false,
            evmWalletType: walletType,
            activeWalletType: 'evm',
            lastUsedChainId: chainId,
            environment: isTestnet ? 'testnet' : 'mainnet',
          });
          
          // Listeners
          provider.on('accountsChanged', (accs) => {
            if (accs.length === 0) get().disconnectEvm();
            else set({ evmAddress: accs[0] });
          });
          
          provider.on('chainChanged', (hex) => {
            const newChainId = parseInt(hex, 16);
            const isTest = [5, 11155111, 80001, 97, 43113].includes(newChainId);
            set({ evmChainId: newChainId, lastUsedChainId: newChainId, environment: isTest ? 'testnet' : 'mainnet' });
          });
          
          return accounts[0];
        } catch (err) {
          set({ evmConnecting: false });
          throw err;
        }
      },
      
      connectMetaMask: () => get().connectEvm('metamask'),
      connectTrustWallet: () => get().connectEvm('trustwallet'),
      
      disconnectEvm: () => {
        set({
          evmAddress: null,
          evmChainId: null,
          evmConnected: false,
          evmWalletType: null,
          activeWalletType: get().solanaConnected ? 'solana' : (get().tronConnected ? 'tron' : null),
        });
      },
      
      switchEvmChain: async (chainId) => {
        const provider = window.ethereum;
        if (!provider) throw new Error('No wallet');
        
        const hex = `0x${chainId.toString(16)}`;
        try {
          await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
        } catch (err) {
          if (err.code === 4902 && CHAIN_PARAMS[chainId]) {
            const params = CHAIN_PARAMS[chainId];
            const chain = EVM_CHAINS[chainId];
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                ...params,
                nativeCurrency: { name: chain.symbol, symbol: chain.symbol, decimals: chain.decimals }
              }]
            });
          } else throw err;
        }
      },
      
      // Connect Phantom (Solana)
      connectPhantom: async () => {
        if (!window.solana) throw new Error('Phantom not installed');
        
        set({ solanaConnecting: true });
        try {
          const resp = await window.solana.connect();
          const address = resp.publicKey.toString();
          
          set({
            solanaAddress: address,
            solanaConnected: true,
            solanaConnecting: false,
            activeWalletType: 'solana',
          });
          
          window.solana.on('disconnect', () => get().disconnectSolana());
          window.solana.on('accountChanged', (pk) => {
            if (pk) set({ solanaAddress: pk.toString() });
            else get().disconnectSolana();
          });
          
          return address;
        } catch (err) {
          set({ solanaConnecting: false });
          throw err;
        }
      },
      
      disconnectSolana: () => {
        window.solana?.disconnect?.();
        set({
          solanaAddress: null,
          solanaConnected: false,
          activeWalletType: get().evmConnected ? 'evm' : (get().tronConnected ? 'tron' : null),
        });
      },
      
      // Connect TronLink (Tron)
      connectTron: async () => {
        if (!window.tronWeb || !window.tronLink) throw new Error('TronLink not installed');
        
        set({ tronConnecting: true });
        try {
          const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
          if (res.code !== 200) throw new Error(res.message || 'Connection failed');
          
          const address = window.tronWeb.defaultAddress.base58;
          
          set({
            tronAddress: address,
            tronConnected: true,
            tronConnecting: false,
            activeWalletType: 'tron',
          });
          
          return address;
        } catch (err) {
          set({ tronConnecting: false });
          throw err;
        }
      },
      
      disconnectTron: () => {
        set({
          tronAddress: null,
          tronConnected: false,
          activeWalletType: get().evmConnected ? 'evm' : (get().solanaConnected ? 'solana' : null),
        });
      },
      
      // Update balance
      setBalance: (chainId, tokenAddress, balance) => {
        set(state => ({
          balances: {
            ...state.balances,
            [chainId]: {
              ...(state.balances[chainId] || {}),
              [tokenAddress]: balance,
            }
          }
        }));
      },
      
      getBalance: (chainId, tokenAddress) => {
        return get().balances[chainId]?.[tokenAddress] || null;
      },
      
      // Helpers
      getActiveWallet: () => {
        const s = get();
        if (s.activeWalletType === 'tron' && s.tronConnected) return { type: 'tron', address: s.tronAddress, chainId: TRON_CHAIN_ID };
        if (s.activeWalletType === 'solana' && s.solanaConnected) return { type: 'solana', address: s.solanaAddress, chainId: SOLANA_CHAIN_ID };
        if (s.evmConnected) return { type: 'evm', address: s.evmAddress, chainId: s.evmChainId };
        return null;
      },
      
      isConnected: () => {
        const s = get();
        return s.evmConnected || s.solanaConnected || s.tronConnected;
      },
      
      getAddress: () => {
        const s = get();
        if (s.activeWalletType === 'tron') return s.tronAddress;
        if (s.activeWalletType === 'solana') return s.solanaAddress;
        return s.evmAddress || s.solanaAddress || s.tronAddress;
      },
    }),
    {
      name: 'wallet-store',
      partialize: (state) => ({ lastUsedChainId: state.lastUsedChainId }),
    }
  )
);
