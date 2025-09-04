import { GraphQLClient } from 'graphql-request';
import { logger } from '../utils/logger.js';

class AirstackService {
  constructor() {
    this.client = new GraphQLClient('https://api.airstack.xyz/gql', {
      headers: {
        'Authorization': `Bearer ${process.env.AIRSTACK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Get DeFi positions for a wallet address
  async getDeFiPositions(walletAddress, chains = ['ethereum', 'base', 'arbitrum', 'polygon']) {
    const query = `
      query GetDeFiPositions($address: Address!, $chains: [Blockchain!]) {
        TokenBalances(
          input: {
            filter: {
              owner: {_eq: $address},
              tokenType: {_in: [ERC20]},
              blockchain: {_in: $chains}
            },
            blockchain: ethereum,
            limit: 50
          }
        ) {
          TokenBalance {
            amount
            formattedAmount
            blockchain
            tokenAddress
            token {
              name
              symbol
              decimals
              projectDetails {
                collectionName
                description
              }
            }
          }
        }
      }
    `;

    try {
      const variables = {
        address: walletAddress,
        chains: chains.map(chain => chain.toUpperCase())
      };

      const data = await this.client.request(query, variables);
      return this.processTokenBalances(data.TokenBalances?.TokenBalance || []);
    } catch (error) {
      logger.error('Airstack getDeFiPositions error:', error);
      throw new Error('Failed to fetch DeFi positions');
    }
  }

  // Get stablecoin pool data
  async getStablecoinPools(chains = ['ethereum', 'base', 'arbitrum']) {
    const query = `
      query GetStablecoinPools($chains: [Blockchain!]) {
        TokenTransfers(
          input: {
            filter: {
              blockchain: {_in: $chains},
              tokenType: {_eq: ERC20}
            },
            blockchain: ethereum,
            limit: 100
          }
        ) {
          TokenTransfer {
            amount
            formattedAmount
            blockchain
            tokenAddress
            token {
              name
              symbol
              decimals
            }
            from {
              addresses
            }
            to {
              addresses
            }
          }
        }
      }
    `;

    try {
      const variables = {
        chains: chains.map(chain => chain.toUpperCase())
      };

      const data = await this.client.request(query, variables);
      return this.processPoolData(data.TokenTransfers?.TokenTransfer || []);
    } catch (error) {
      logger.error('Airstack getStablecoinPools error:', error);
      throw new Error('Failed to fetch stablecoin pools');
    }
  }

  // Get wallet transaction history
  async getWalletHistory(walletAddress, limit = 50) {
    const query = `
      query GetWalletHistory($address: Address!, $limit: Int!) {
        TokenTransfers(
          input: {
            filter: {
              _or: [
                {from: {_eq: $address}},
                {to: {_eq: $address}}
              ]
            },
            blockchain: ethereum,
            limit: $limit,
            order: {blockTimestamp: DESC}
          }
        ) {
          TokenTransfer {
            amount
            formattedAmount
            blockchain
            tokenAddress
            blockTimestamp
            transactionHash
            token {
              name
              symbol
              decimals
            }
            from {
              addresses
            }
            to {
              addresses
            }
          }
        }
      }
    `;

    try {
      const variables = {
        address: walletAddress,
        limit
      };

      const data = await this.client.request(query, variables);
      return this.processTransactionHistory(data.TokenTransfers?.TokenTransfer || []);
    } catch (error) {
      logger.error('Airstack getWalletHistory error:', error);
      throw new Error('Failed to fetch wallet history');
    }
  }

  // Process token balances to extract stablecoin positions
  processTokenBalances(balances) {
    const stablecoins = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'sUSD', 'USDbC'];
    
    return balances
      .filter(balance => {
        const symbol = balance.token?.symbol?.toUpperCase();
        return stablecoins.includes(symbol) && parseFloat(balance.formattedAmount) > 0;
      })
      .map(balance => ({
        chain: balance.blockchain?.toLowerCase(),
        tokenAddress: balance.tokenAddress,
        symbol: balance.token?.symbol,
        name: balance.token?.name,
        amount: parseFloat(balance.formattedAmount),
        decimals: balance.token?.decimals,
        usdValue: parseFloat(balance.formattedAmount) // Assuming stablecoins are ~$1
      }));
  }

  // Process pool data to identify liquidity pools
  processPoolData(transfers) {
    // This is a simplified implementation
    // In production, you'd need more sophisticated logic to identify pools
    const poolMap = new Map();
    
    transfers.forEach(transfer => {
      const key = `${transfer.blockchain}-${transfer.tokenAddress}`;
      if (!poolMap.has(key)) {
        poolMap.set(key, {
          chain: transfer.blockchain?.toLowerCase(),
          tokenAddress: transfer.tokenAddress,
          symbol: transfer.token?.symbol,
          volume: 0,
          transactionCount: 0
        });
      }
      
      const pool = poolMap.get(key);
      pool.volume += parseFloat(transfer.formattedAmount) || 0;
      pool.transactionCount += 1;
    });
    
    return Array.from(poolMap.values());
  }

  // Process transaction history
  processTransactionHistory(transfers) {
    return transfers.map(transfer => ({
      txHash: transfer.transactionHash,
      timestamp: transfer.blockTimestamp,
      chain: transfer.blockchain?.toLowerCase(),
      tokenAddress: transfer.tokenAddress,
      symbol: transfer.token?.symbol,
      amount: parseFloat(transfer.formattedAmount),
      from: transfer.from?.addresses?.[0],
      to: transfer.to?.addresses?.[0],
      usdValue: parseFloat(transfer.formattedAmount) // Assuming stablecoins are ~$1
    }));
  }

  // Health check for Airstack API
  async healthCheck() {
    try {
      const query = `
        query HealthCheck {
          TokenBalances(
            input: {
              filter: {
                owner: {_eq: "0x0000000000000000000000000000000000000000"}
              },
              blockchain: ethereum,
              limit: 1
            }
          ) {
            TokenBalance {
              amount
            }
          }
        }
      `;
      
      await this.client.request(query);
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('Airstack health check failed:', error);
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

export default new AirstackService();
