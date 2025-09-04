import React, { createContext, useContext, useState, useEffect } from 'react';
import { DynamicContextProvider, DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { authAPI } from '../services/apiService';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

const WalletProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('stableswap_user');
    const savedToken = localStorage.getItem('stableswap_token');
    
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setIsConnected(true);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('stableswap_user');
        localStorage.removeItem('stableswap_token');
      }
    }
    setIsLoading(false);
  }, []);

  const handleWalletConnect = async (walletAddress, signer) => {
    try {
      setIsLoading(true);
      setError(null);

      // Create a message to sign
      const message = `Welcome to StableSwap AI!\n\nPlease sign this message to authenticate your wallet.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      
      // Sign the message
      const signature = await signer.signMessage(message);

      // Authenticate with backend
      const response = await authAPI.login(walletAddress, signature, message);
      
      if (response.success) {
        const { user: userData, token } = response.data;
        
        // Save to localStorage
        localStorage.setItem('stableswap_user', JSON.stringify(userData));
        localStorage.setItem('stableswap_token', token);
        
        setUser(userData);
        setIsConnected(true);
      } else {
        throw new Error(response.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalletDisconnect = () => {
    localStorage.removeItem('stableswap_user');
    localStorage.removeItem('stableswap_token');
    setUser(null);
    setIsConnected(false);
    setError(null);
  };

  const refreshUserData = async () => {
    try {
      const response = await authAPI.getProfile();
      if (response.success) {
        const updatedUser = response.data.user;
        localStorage.setItem('stableswap_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const value = {
    user,
    isConnected,
    isLoading,
    error,
    connect: handleWalletConnect,
    disconnect: handleWalletDisconnect,
    refreshUserData
  };

  return (
    <WalletContext.Provider value={value}>
      <DynamicContextProvider
        settings={{
          environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID || 'test',
          walletConnectors: [EthereumWalletConnectors],
          events: {
            onAuthSuccess: async (args) => {
              const { user, isAuthenticated } = args;
              if (isAuthenticated && user?.walletPublicKey) {
                // Handle Dynamic Labs authentication
                await handleWalletConnect(user.walletPublicKey, user.signer);
              }
            },
            onLogout: () => {
              handleWalletDisconnect();
            }
          }
        }}
      >
        {children}
      </DynamicContextProvider>
    </WalletContext.Provider>
  );
};

export default WalletProvider;
