import axios from 'axios';
import { logger } from '../utils/logger.js';

class AlchemyService {
  constructor() {
    this.baseURLs = {
      ethereum: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      base: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      polygon: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      optimism: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    };
  }

  // Get token balances for a wallet
  async getTokenBalances(walletAddress, chain = 'ethereum') {
    try {
      const url = this.baseURLs[chain];
      if (!url) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const response = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [walletAddress],
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return this.processTokenBalances(response.data.result, chain);
    } catch (error) {
      logger.error(`Alchemy getTokenBalances error for ${chain}:`, error);
      throw new Error(`Failed to fetch token balances for ${chain}`);
    }
  }

  // Get token metadata
  async getTokenMetadata(tokenAddress, chain = 'ethereum') {
    try {
      const url = this.baseURLs[chain];
      if (!url) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const response = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'alchemy_getTokenMetadata',
        params: [tokenAddress],
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      logger.error(`Alchemy getTokenMetadata error for ${tokenAddress}:`, error);
      throw new Error(`Failed to fetch token metadata for ${tokenAddress}`);
    }
  }

  // Get transaction receipt
  async getTransactionReceipt(txHash, chain = 'ethereum') {
    try {
      const url = this.baseURLs[chain];
      if (!url) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const response = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      logger.error(`Alchemy getTransactionReceipt error for ${txHash}:`, error);
      throw new Error(`Failed to fetch transaction receipt for ${txHash}`);
    }
  }

  // Get current gas prices
  async getGasPrice(chain = 'ethereum') {
    try {
      const url = this.baseURLs[chain];
      if (!url) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const response = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return {
        chain,
        gasPrice: parseInt(response.data.result, 16),
        gasPriceGwei: parseInt(response.data.result, 16) / 1e9,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Alchemy getGasPrice error for ${chain}:`, error);
      throw new Error(`Failed to fetch gas price for ${chain}`);
    }
  }

  // Get block number
  async getBlockNumber(chain = 'ethereum') {
    try {
      const url = this.baseURLs[chain];
      if (!url) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const response = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return {
        chain,
        blockNumber: parseInt(response.data.result, 16),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Alchemy getBlockNumber error for ${chain}:`, error);
      throw new Error(`Failed to fetch block number for ${chain}`);
    }
  }

  // Get asset transfers (transaction history)
  async getAssetTransfers(walletAddress, chain = 'ethereum', options = {}) {
    try {
      const url = this.baseURLs[chain];
      if (!url) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const {
        fromBlock = 'latest',
        toBlock = 'latest',
        category = ['external', 'erc20'],
        maxCount = 100
      } = options;

      const response = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock,
          toBlock,
          fromAddress: walletAddress,
          category,
          maxCount: `0x${maxCount.toString(16)}`
        }],
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return this.processAssetTransfers(response.data.result.transfers, chain);
    } catch (error) {
      logger.error(`Alchemy getAssetTransfers error for ${walletAddress}:`, error);
      throw new Error(`Failed to fetch asset transfers for ${walletAddress}`);
    }
  }

  // Estimate gas for a transaction
  async estimateGas(transaction, chain = 'ethereum') {
    try {
      const url = this.baseURLs[chain];
      if (!url) {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      const response = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'eth_estimateGas',
        params: [transaction],
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return {
        chain,
        gasEstimate: parseInt(response.data.result, 16),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Alchemy estimateGas error:`, error);
      throw new Error(`Failed to estimate gas for transaction`);
    }
  }

  // Process token balances to filter stablecoins
  processTokenBalances(balances, chain) {
    const stablecoins = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'sUSD', 'USDbC'];
    
    return balances.tokenBalances
      .filter(balance => {
        const amount = parseInt(balance.tokenBalance, 16);
        return amount > 0;
      })
      .map(balance => ({
        chain,
        tokenAddress: balance.contractAddress,
        balance: parseInt(balance.tokenBalance, 16),
        balanceFormatted: null, // Would need token metadata to format properly
        lastUpdated: new Date().toISOString()
      }));
  }

  // Process asset transfers
  processAssetTransfers(transfers, chain) {
    return transfers.map(transfer => ({
      chain,
      txHash: transfer.hash,
      blockNumber: parseInt(transfer.blockNum, 16),
      from: transfer.from,
      to: transfer.to,
      value: parseFloat(transfer.value) || 0,
      asset: transfer.asset,
      category: transfer.category,
      rawContract: transfer.rawContract,
      timestamp: new Date().toISOString()
    }));
  }

  // Get multiple chain data in parallel
  async getMultiChainData(walletAddress, chains = ['ethereum', 'base', 'arbitrum']) {
    try {
      const promises = chains.map(async (chain) => {
        try {
          const [balances, gasPrice, blockNumber] = await Promise.all([
            this.getTokenBalances(walletAddress, chain),
            this.getGasPrice(chain),
            this.getBlockNumber(chain)
          ]);

          return {
            chain,
            balances,
            gasPrice,
            blockNumber,
            status: 'success'
          };
        } catch (error) {
          logger.error(`Multi-chain data error for ${chain}:`, error);
          return {
            chain,
            error: error.message,
            status: 'error'
          };
        }
      });

      const results = await Promise.all(promises);
      return results;
    } catch (error) {
      logger.error('Multi-chain data error:', error);
      throw new Error('Failed to fetch multi-chain data');
    }
  }

  // Health check for Alchemy API
  async healthCheck() {
    try {
      const healthChecks = await Promise.all(
        Object.keys(this.baseURLs).map(async (chain) => {
          try {
            await this.getBlockNumber(chain);
            return { chain, status: 'healthy' };
          } catch (error) {
            return { chain, status: 'unhealthy', error: error.message };
          }
        })
      );

      const allHealthy = healthChecks.every(check => check.status === 'healthy');
      
      return {
        status: allHealthy ? 'healthy' : 'partial',
        chains: healthChecks,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Alchemy health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default new AlchemyService();
