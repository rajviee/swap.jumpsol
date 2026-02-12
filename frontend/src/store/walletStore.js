import { create } from 'zustand';

// Solana chain ID used by LI.FI
const SOLANA_CHAIN_ID = 1151111081099710;

const SUPPORTED_EVM_CHAINS = {
  1: { name: 'Ethereum', symbol: 'ETH', icon: 'ethereum' },
  42161: { name: 'Arbitrum', symbol: 'ETH', icon: 'arbitrum' },
  10: { name: 'Optimism', symbol: 'ETH', icon: 'optimism' },
  137: { name: 'Polygon', symbol: 'MATIC', icon: 'polygon' },
  56: { name: 'BNB Chain', symbol: 'BNB', icon: 'bsc' },
  43114: { name: 'Avalanche', symbol: 'AVAX', icon: 'avalanche' },
};

const SOLANA_CHAIN = {
  id: SOLANA_CHAIN_ID,
  name: 'Solana',
  symbol: 'SOL',
  icon: 'solana',
};

export const useWalletStore = create((set, get) => ({
  // EVM Wallet State
  evmAddress: null,
  evmChainId: null,
  evmBalance: null,
  evmConnected: false,
  evmConnecting: false,
  
  // Solana Wallet State
  solanaAddress: null,
  solanaBalance: null,
  solanaConnected: false,
  solanaConnecting: false,
  
  // Active wallet type - 'evm' | 'solana' | null
  activeWalletType: null,
  
  // UI State
  showWalletModal: false,
  
  // Supported chains
  supportedEvmChains: SUPPORTED_EVM_CHAINS,
  solanaChain: SOLANA_CHAIN,
  solanaChainId: SOLANA_CHAIN_ID,
  
  // Actions
  setShowWalletModal: (show) => set({ showWalletModal: show }),
  
  // EVM Connection
  connectMetaMask: async () => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask is not installed');
    }
    
    set({ evmConnecting: true });
    
    try {
      console.log('[Wallet] Connecting MetaMask...');
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const chainId = await window.ethereum.request({ 
        method: 'eth_chainId' 
      });
      
      const parsedChainId = parseInt(chainId, 16);
      console.log('[Wallet] MetaMask connected:', { address: accounts[0], chainId: parsedChainId });
      
      set({
        evmAddress: accounts[0],
        evmChainId: parsedChainId,
        evmConnected: true,
        evmConnecting: false,
        activeWalletType: 'evm',
      });
      
      // Setup listeners
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          get().disconnectEvm();
        } else {
          set({ evmAddress: accounts[0] });
        }
      });
      
      window.ethereum.on('chainChanged', (chainId) => {
        set({ evmChainId: parseInt(chainId, 16) });
      });
      
      return accounts[0];
    } catch (error) {
      console.error('[Wallet] MetaMask connection error:', error);
      set({ evmConnecting: false });
      throw error;
    }
  },
  
  disconnectEvm: () => {
    console.log('[Wallet] Disconnecting EVM wallet');
    set({
      evmAddress: null,
      evmChainId: null,
      evmBalance: null,
      evmConnected: false,
      activeWalletType: get().solanaConnected ? 'solana' : null,
    });
  },
  
  switchEvmChain: async (chainId) => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask is not installed');
    }
    
    const hexChainId = `0x${chainId.toString(16)}`;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (error) {
      // Chain not added, try to add it
      if (error.code === 4902) {
        const chainInfo = SUPPORTED_EVM_CHAINS[chainId];
        if (!chainInfo) {
          throw new Error(`Chain ${chainId} is not supported`);
        }
        
        const chainParams = getChainParams(chainId);
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainParams],
        });
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
      
      // Setup listeners
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
      activeWalletType: get().evmConnected ? 'evm' : null,
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
    // Fallback to whichever is connected
    if (state.solanaConnected) {
      return {
        type: 'solana',
        address: state.solanaAddress,
        chainId: SOLANA_CHAIN_ID,
      };
    }
    if (state.evmConnected) {
      return {
        type: 'evm',
        address: state.evmAddress,
        chainId: state.evmChainId,
      };
    }
    return null;
  },
  
  isAnyWalletConnected: () => {
    const state = get();
    return state.evmConnected || state.solanaConnected;
  },
  
  // Get the default chain based on connected wallet
  getDefaultChainId: () => {
    const state = get();
    if (state.activeWalletType === 'solana' || (!state.evmConnected && state.solanaConnected)) {
      return SOLANA_CHAIN_ID;
    }
    return state.evmChainId || 1; // Default to Ethereum
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
  };
  
  return chainConfigs[chainId];
}

export { SOLANA_CHAIN_ID };
