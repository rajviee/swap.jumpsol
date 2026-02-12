import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with defaults
const apiClient = axios.create({
  baseURL: API,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============ LI.FI API Calls ============

export const lifiApi = {
  // Get all supported chains
  getChains: async () => {
    const response = await apiClient.get('/lifi/chains');
    return response.data;
  },
  
  // Get tokens for specified chains
  getTokens: async (chainIds = []) => {
    const params = chainIds.length > 0 ? { chains: chainIds.join(',') } : {};
    const response = await apiClient.get('/lifi/tokens', { params });
    return response.data;
  },
  
  // Get quote for a swap
  getQuote: async ({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, slippage = 0.03 }) => {
    const response = await apiClient.get('/lifi/quote', {
      params: {
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount,
        fromAddress,
        slippage,
      },
    });
    return response.data;
  },
  
  // Get multiple routes for a swap
  getRoutes: async ({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, slippage = 0.03 }) => {
    const response = await apiClient.post('/lifi/routes', {
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      slippage,
    });
    return response.data;
  },
  
  // Get transaction status
  getStatus: async ({ txHash, fromChain, toChain, bridge }) => {
    const params = { txHash, fromChain, toChain };
    if (bridge) params.bridge = bridge;
    const response = await apiClient.get('/lifi/status', { params });
    return response.data;
  },
};

// ============ Transaction History API Calls ============

export const transactionApi = {
  // Create a new transaction record
  create: async (transaction) => {
    const response = await apiClient.post('/transactions', {
      ...transaction,
      wallet_address: transaction.wallet_address.toLowerCase(),
    });
    return response.data;
  },
  
  // Get transactions for a wallet
  getAll: async ({ walletAddress, status, txType, chainId, limit = 50 }) => {
    const params = { wallet_address: walletAddress.toLowerCase(), limit };
    if (status) params.status = status;
    if (txType) params.tx_type = txType;
    if (chainId) params.chain_id = chainId;
    
    const response = await apiClient.get('/transactions', { params });
    return response.data;
  },
  
  // Update transaction status
  update: async (txId, updates) => {
    const response = await apiClient.patch(`/transactions/${txId}`, updates);
    return response.data;
  },
  
  // Get single transaction
  get: async (txId) => {
    const response = await apiClient.get(`/transactions/${txId}`);
    return response.data;
  },
};

// ============ Health Check ============

export const healthCheck = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

export default {
  lifiApi,
  transactionApi,
  healthCheck,
};
