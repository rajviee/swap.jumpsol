import { create } from 'zustand';

// Chain IDs
export const SOLANA_CHAIN_ID = 1151111081099710;
export const TRON_CHAIN_ID = 728126428; // Tron chain ID
export const BITCOIN_CHAIN_ID = 0; // Bitcoin (not directly supported by LI.FI)

const SUPPORTED_EVM_CHAINS = {
  1: { name: 'Ethereum', symbol: 'ETH', icon: 'ethereum' },
  42161: { name: 'Arbitrum', symbol: 'ETH', icon: 'arbitrum' },
  10: { name: 'Optimism', symbol: 'ETH', icon: 'optimism' },
  137: { name: 'Polygon', symbol: 'MATIC', icon: 'polygon' },
  56: { name: 'BNB Chain', symbol: 'BNB', icon: 'bsc' },
  43114: { name: 'Avalanche', symbol: 'AVAX', icon: 'avalanche' },
  8453: { name: 'Base', symbol: 'ETH', icon: 'base' },
  100: { name: 'Gnosis', symbol: 'xDAI', icon: 'gnosis' },
  250: { name: 'Fantom', symbol: 'FTM', icon: 'fantom' },
  324: { name: 'zkSync Era', symbol: 'ETH', icon: 'zksync' },
};

const SOLANA_CHAIN = {
  id: SOLANA_CHAIN_ID,
  name: 'Solana',
  symbol: 'SOL',
  icon: 'solana',
};

const TRON_CHAIN = {
  id: TRON_CHAIN_ID,
  name: 'Tron',
  symbol: 'TRX',
  icon: 'tron',
};

const BITCOIN_CHAIN = {
  id: BITCOIN_CHAIN_ID,
  name: 'Bitcoin',
  symbol: 'BTC',
  icon: 'bitcoin',
};

export const useWalletStore = create((set, get) => ({
  // EVM Wallet State
  evmAddress: null,
  evmChainId: null,
  evmBalance: null,
  evmConnected: false,
  evmConnecting: false,
  evmWalletType: null, // 'metamask' | 'trustwallet' | 'walletconnect'
  
  // Solana Wallet State
  solanaAddress: null,
  solanaBalance: null,
  solanaConnected: false,
  solanaConnecting: false,
  
  // Tron Wallet State
  tronAddress: null,
  tronBalance: null,
  tronConnected: false,
  tronConnecting: false,
  
  // Active wallet type - 'evm' | 'solana' | 'tron' | null
  activeWalletType: null,
  
  // UI State
  showWalletModal: false,
  
  // Supported chains
  supportedEvmChains: SUPPORTED_EVM_CHAINS,
  solanaChain: SOLANA_CHAIN,
  tronChain: TRON_CHAIN,
  bitcoinChain: BITCOIN_CHAIN,
  solanaChainId: SOLANA_CHAIN_ID,
  tronChainId: TRON_CHAIN_ID,
  bitcoinChainId: BITCOIN_CHAIN_ID,
  
  // Actions
  setShowWalletModal: (show) => set({ showWalletModal: show }),
  
  // Generic EVM Connection (MetaMask, Trust Wallet, etc.)
  connectEvm: async (walletType = 'metamask') => {
    let provider = null;
    
    if (walletType === 'trustwallet') {
      // Trust Wallet injects as window.ethereum or window.trustwallet
      provider = window.trustwallet || window.ethereum;
      if (!provider?.isTrust && !provider?.isTrustWallet) {
        // Check if Trust Wallet is available in window.ethereum
        if (window.ethereum?.providers) {
          provider = window.ethereum.providers.find(p => p.isTrust || p.isTrustWallet);
        }
      }
      if (!provider) {
        throw new Error('Trust Wallet is not installed');
      }
    } else {
      // MetaMask or generic
      provider = window.ethereum;
      if (!provider) {
        throw new Error('No EVM wallet found. Please install MetaMask or Trust Wallet.');
      }
    }
    
    set({ evmConnecting: true });
    
    try {
      console.log(`[Wallet] Connecting ${walletType}...`);
      const accounts = await provider.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const chainId = await provider.request({ 
        method: 'eth_chainId' 
      });
      
      const parsedChainId = parseInt(chainId, 16);
      console.log(`[Wallet] ${walletType} connected:`, { address: accounts[0], chainId: parsedChainId });
      
      set({
        evmAddress: accounts[0],
        evmChainId: parsedChainId,
        evmConnected: true,
        evmConnecting: false,
        evmWalletType: walletType,
        activeWalletType: 'evm',
      });
      
      // Setup listeners
      provider.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          get().disconnectEvm();
        } else {
          set({ evmAddress: accounts[0] });
        }
      });
      
      provider.on('chainChanged', (chainId) => {
        set({ evmChainId: parseInt(chainId, 16) });
      });
      
      return accounts[0];
    } catch (error) {
      console.error(`[Wallet] ${walletType} connection error:`, error);
      set({ evmConnecting: false });
      throw error;
    }
  },
  
  // Legacy MetaMask connect (calls connectEvm)
  connectMetaMask: async () => {
    return get().connectEvm('metamask');
  },
  
  // Trust Wallet connect
  connectTrustWallet: async () => {
    return get().connectEvm('trustwallet');
  },
  
  disconnectEvm: () => {
    console.log('[Wallet] Disconnecting EVM wallet');
    set({
      evmAddress: null,
      evmChainId: null,
      evmBalance: null,
      evmConnected: false,
      evmWalletType: null,
      activeWalletType: get().solanaConnected ? 'solana' : (get().tronConnected ? 'tron' : null),
    });
  },
  
  switchEvmChain: async (chainId) => {
    const provider = window.ethereum;
    if (!provider) {
      throw new Error('No EVM wallet found');
    }
    
    const hexChainId = `0x${chainId.toString(16)}`;
    
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (error) {
      if (error.code === 4902) {
        const chainParams = getChainParams(chainId);
        if (chainParams) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [chainParams],
          });
        } else {
          throw new Error(`Chain ${chainId} is not supported`);
        }
      } else {
        throw error;
      }
    }
  },
  
  // Solana Connection
  connectPhantom: async () => {
    if (typeof window.solana === 'undefined') {
      throw new Error('Phantom wallet is not installed');
    }
    
    set({ solanaConnecting: true });
    
    try {
      console.log('[Wallet] Connecting Phantom...');
      const response = await window.solana.connect();
      const publicKey = response.publicKey.toString();
      
      console.log('[Wallet] Phantom connected:', { address: publicKey, chainId: SOLANA_CHAIN_ID });
      
      set({
        solanaAddress: publicKey,
        solanaConnected: true,
        solanaConnecting: false,
        activeWalletType: 'solana',
      });
      
      window.solana.on('disconnect', () => {
        get().disconnectSolana();
      });
      
      window.solana.on('accountChanged', (publicKey) => {
        if (publicKey) {
          set({ solanaAddress: publicKey.toString() });
        } else {
          get().disconnectSolana();
        }
      });
      
      return publicKey;
    } catch (error) {
      console.error('[Wallet] Phantom connection error:', error);
      set({ solanaConnecting: false });
      throw error;
    }
  },
  
  disconnectSolana: () => {
    console.log('[Wallet] Disconnecting Solana wallet');
    if (window.solana?.disconnect) {
      window.solana.disconnect();
    }
    set({
      solanaAddress: null,
      solanaBalance: null,
      solanaConnected: false,
      activeWalletType: get().evmConnected ? 'evm' : (get().tronConnected ? 'tron' : null),
    });
  },
  
  // Tron Connection (TronLink)
  connectTron: async () => {
    if (typeof window.tronWeb === 'undefined' || !window.tronLink) {
      throw new Error('TronLink wallet is not installed');
    }
    
    set({ tronConnecting: true });
    
    try {
      console.log('[Wallet] Connecting TronLink...');
      
      // Request account access
      const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
      
      if (res.code !== 200) {
        throw new Error(res.message || 'Failed to connect TronLink');
      }
      
      const address = window.tronWeb.defaultAddress.base58;
      console.log('[Wallet] TronLink connected:', { address });
      
      set({
        tronAddress: address,
        tronConnected: true,
        tronConnecting: false,
        activeWalletType: 'tron',
      });
      
      return address;
    } catch (error) {
      console.error('[Wallet] TronLink connection error:', error);
      set({ tronConnecting: false });
      throw error;
    }
  },
  
  disconnectTron: () => {
    console.log('[Wallet] Disconnecting Tron wallet');
    set({
      tronAddress: null,
      tronBalance: null,
      tronConnected: false,
      activeWalletType: get().evmConnected ? 'evm' : (get().solanaConnected ? 'solana' : null),
    });
  },
  
  // Switch active wallet type
  setActiveWalletType: (type) => {
    console.log('[Wallet] Switching active wallet type to:', type);
    set({ activeWalletType: type });
  },
  
  // Utility
  getActiveWallet: () => {
    const state = get();
    if (state.activeWalletType === 'tron' && state.tronConnected) {
      return {
        type: 'tron',
        address: state.tronAddress,
        chainId: TRON_CHAIN_ID,
      };
    }
    if (state.activeWalletType === 'solana' && state.solanaConnected) {
      return {
        type: 'solana',
        address: state.solanaAddress,
        chainId: SOLANA_CHAIN_ID,
      };
    }
    if (state.activeWalletType === 'evm' && state.evmConnected) {
      return {
        type: 'evm',
        address: state.evmAddress,
        chainId: state.evmChainId,
      };
    }
    // Fallback
    if (state.tronConnected) {
      return { type: 'tron', address: state.tronAddress, chainId: TRON_CHAIN_ID };
    }
    if (state.solanaConnected) {
      return { type: 'solana', address: state.solanaAddress, chainId: SOLANA_CHAIN_ID };
    }
    if (state.evmConnected) {
      return { type: 'evm', address: state.evmAddress, chainId: state.evmChainId };
    }
    return null;
  },
  
  isAnyWalletConnected: () => {
    const state = get();
    return state.evmConnected || state.solanaConnected || state.tronConnected;
  },
  
  getDefaultChainId: () => {
    const state = get();
    if (state.activeWalletType === 'tron') return TRON_CHAIN_ID;
    if (state.activeWalletType === 'solana') return SOLANA_CHAIN_ID;
    return state.evmChainId || 1;
  },
  
  // Get all connected wallet addresses for fetching balances
  getAllConnectedAddresses: () => {
    const state = get();
    const addresses = [];
    if (state.evmConnected && state.evmAddress) {
      addresses.push({ type: 'evm', address: state.evmAddress, chainId: state.evmChainId });
    }
    if (state.solanaConnected && state.solanaAddress) {
      addresses.push({ type: 'solana', address: state.solanaAddress, chainId: SOLANA_CHAIN_ID });
    }
    if (state.tronConnected && state.tronAddress) {
      addresses.push({ type: 'tron', address: state.tronAddress, chainId: TRON_CHAIN_ID });
    }
    return addresses;
  },
}));

// Helper function to get chain params for adding chains
function getChainParams(chainId) {
  const chainConfigs = {
    1: {
      chainId: '0x1',
      chainName: 'Ethereum Mainnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://eth.llamarpc.com'],
      blockExplorerUrls: ['https://etherscan.io'],
    },
    42161: {
      chainId: '0xa4b1',
      chainName: 'Arbitrum One',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://arb1.arbitrum.io/rpc'],
      blockExplorerUrls: ['https://arbiscan.io'],
    },
    10: {
      chainId: '0xa',
      chainName: 'Optimism',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://mainnet.optimism.io'],
      blockExplorerUrls: ['https://optimistic.etherscan.io'],
    },
    137: {
      chainId: '0x89',
      chainName: 'Polygon Mainnet',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://polygon-rpc.com'],
      blockExplorerUrls: ['https://polygonscan.com'],
    },
    56: {
      chainId: '0x38',
      chainName: 'BNB Smart Chain',
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      rpcUrls: ['https://bsc-dataseed.binance.org'],
      blockExplorerUrls: ['https://bscscan.com'],
    },
    43114: {
      chainId: '0xa86a',
      chainName: 'Avalanche C-Chain',
      nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
      rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
      blockExplorerUrls: ['https://snowtrace.io'],
    },
    8453: {
      chainId: '0x2105',
      chainName: 'Base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://mainnet.base.org'],
      blockExplorerUrls: ['https://basescan.org'],
    },
    324: {
      chainId: '0x144',
      chainName: 'zkSync Era',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://mainnet.era.zksync.io'],
      blockExplorerUrls: ['https://explorer.zksync.io'],
    },
  };
  
  return chainConfigs[chainId];
}
