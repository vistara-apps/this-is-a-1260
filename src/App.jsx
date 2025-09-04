import React, { useState, useEffect } from 'react';
import WalletProvider, { useWallet } from './providers/WalletProvider';
import Header from './components/Header';
import DashboardLayout from './components/DashboardLayout';
import { poolsAPI } from './services/apiService';
import { mockPools } from './data/mockData';

function AppContent() {
  const { user, isConnected, isLoading: walletLoading } = useWallet();
  const [pools, setPools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadPools = async () => {
      try {
        setIsLoading(true);
        // Try to load real pools from API
        const response = await poolsAPI.getAllPools({ limit: 50 });
        if (response.success && response.data.pools.length > 0) {
          setPools(response.data.pools);
        } else {
          // Fallback to mock data if no real pools available
          setPools(mockPools);
        }
      } catch (error) {
        console.warn('Failed to load pools from API, using mock data:', error);
        setPools(mockPools);
      } finally {
        setIsLoading(false);
      }
    };

    loadPools();
  }, []);

  if (walletLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dark-accent mx-auto mb-4"></div>
          <h2 className="text-heading gradient-text">Loading StableSwap AI...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-heading text-red-400 mb-4">Error Loading Application</h2>
          <p className="text-gray-400">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-6 py-2 bg-dark-accent text-white rounded-lg hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      <Header user={user} />
      <DashboardLayout user={user} pools={pools} setPools={setPools} />
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;
