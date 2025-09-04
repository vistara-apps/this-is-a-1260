import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('stableswap_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('stableswap_token');
      localStorage.removeItem('stableswap_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (walletAddress, signature, message, email) => {
    const response = await apiClient.post('/users/auth', {
      walletAddress,
      signature,
      message,
      email
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get('/users/profile');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await apiClient.put('/users/profile', profileData);
    return response.data;
  },

  getDashboard: async () => {
    const response = await apiClient.get('/users/dashboard');
    return response.data;
  }
};

// Pools API
export const poolsAPI = {
  getAllPools: async (params = {}) => {
    const response = await apiClient.get('/pools', { params });
    return response.data;
  },

  getPool: async (poolId) => {
    const response = await apiClient.get(`/pools/${poolId}`);
    return response.data;
  },

  getBestPools: async (criteria = {}) => {
    const response = await apiClient.get('/pools/best', { params: criteria });
    return response.data;
  },

  getPoolAnalytics: async (poolId, period = '30d') => {
    const response = await apiClient.get(`/pools/${poolId}/analytics`, {
      params: { period }
    });
    return response.data;
  },

  getPoolsByChain: async (chain, params = {}) => {
    const response = await apiClient.get(`/pools/chain/${chain}`, { params });
    return response.data;
  },

  syncPools: async () => {
    const response = await apiClient.post('/pools/sync');
    return response.data;
  }
};

// Wallets API
export const walletsAPI = {
  getWallets: async () => {
    const response = await apiClient.get('/users/wallets');
    return response.data;
  },

  syncWallets: async () => {
    const response = await apiClient.post('/users/wallets/sync');
    return response.data;
  }
};

// Transactions API
export const transactionsAPI = {
  getHistory: async (params = {}) => {
    const response = await apiClient.get('/transactions', { params });
    return response.data;
  },

  getTransaction: async (transactionId) => {
    const response = await apiClient.get(`/transactions/${transactionId}`);
    return response.data;
  },

  createTransaction: async (transactionData) => {
    const response = await apiClient.post('/transactions', transactionData);
    return response.data;
  },

  updateTransaction: async (transactionId, updateData) => {
    const response = await apiClient.put(`/transactions/${transactionId}`, updateData);
    return response.data;
  },

  getStats: async (period = '30d') => {
    const response = await apiClient.get('/transactions/stats', {
      params: { period }
    });
    return response.data;
  }
};

// Yield Optimization API
export const yieldAPI = {
  getOptimization: async (criteria = {}) => {
    const response = await apiClient.post('/yield/optimize', criteria);
    return response.data;
  },

  executeRebalance: async (rebalanceData) => {
    const response = await apiClient.post('/yield/rebalance', rebalanceData);
    return response.data;
  },

  getRecommendations: async () => {
    const response = await apiClient.get('/yield/recommendations');
    return response.data;
  }
};

// Cross-chain Swap API
export const swapAPI = {
  getQuote: async (swapParams) => {
    const response = await apiClient.post('/swap/quote', swapParams);
    return response.data;
  },

  executeSwap: async (swapData) => {
    const response = await apiClient.post('/swap/execute', swapData);
    return response.data;
  },

  getSupportedChains: async () => {
    const response = await apiClient.get('/swap/chains');
    return response.data;
  },

  getSupportedTokens: async (chain) => {
    const response = await apiClient.get(`/swap/tokens/${chain}`);
    return response.data;
  }
};

// Subscriptions API
export const subscriptionsAPI = {
  getSubscription: async () => {
    const response = await apiClient.get('/subscriptions');
    return response.data;
  },

  upgrade: async (tier) => {
    const response = await apiClient.post('/subscriptions/upgrade', { tier });
    return response.data;
  },

  cancel: async () => {
    const response = await apiClient.post('/subscriptions/cancel');
    return response.data;
  },

  getBillingHistory: async () => {
    const response = await apiClient.get('/subscriptions/billing');
    return response.data;
  }
};

// Health check
export const healthAPI = {
  check: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  }
};

export default apiClient;
