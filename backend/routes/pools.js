import express from 'express';
import { query, validationResult } from 'express-validator';
import Pool from '../models/Pool.js';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import airstackService from '../services/airstackService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// @desc    Get all pools with filtering and sorting
// @route   GET /api/pools
// @access  Public
router.get('/', [
  query('chain').optional().isIn(['ethereum', 'base', 'arbitrum', 'polygon', 'optimism']),
  query('protocol').optional().isString(),
  query('minAPY').optional().isFloat({ min: 0 }),
  query('maxRisk').optional().isInt({ min: 1, max: 10 }),
  query('minLiquidity').optional().isFloat({ min: 0 }),
  query('sortBy').optional().isIn(['apy', 'liquidity', 'protocol', 'risk']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    chain,
    protocol,
    minAPY = 0,
    maxRisk = 10,
    minLiquidity = 0,
    sortBy = 'apy',
    sortOrder = 'desc',
    limit = 20,
    page = 1
  } = req.query;

  try {
    // Build query
    let query = { isActive: true };
    
    if (chain) query.chain = chain;
    if (protocol) query.protocol = new RegExp(protocol, 'i');
    if (minAPY > 0) query.currentAPY = { $gte: parseFloat(minAPY) };
    if (maxRisk < 10) query.riskScore = { $lte: parseInt(maxRisk) };
    if (minLiquidity > 0) query.liquiditySize = { $gte: parseFloat(minLiquidity) };

    // Build sort
    const sortField = sortBy === 'apy' ? 'currentAPY' : 
                     sortBy === 'liquidity' ? 'liquiditySize' :
                     sortBy === 'risk' ? 'riskScore' : 'protocol';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortDirection };

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const pools = await Pool.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count for pagination
    const totalPools = await Pool.countDocuments(query);
    const totalPages = Math.ceil(totalPools / parseInt(limit));

    // Calculate aggregated stats
    const stats = await Pool.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          avgAPY: { $avg: '$currentAPY' },
          maxAPY: { $max: '$currentAPY' },
          totalLiquidity: { $sum: '$liquiditySize' },
          poolCount: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        pools,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalPools,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        stats: stats[0] || {
          avgAPY: 0,
          maxAPY: 0,
          totalLiquidity: 0,
          poolCount: 0
        }
      }
    });
  } catch (error) {
    logger.error('Get pools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pools'
    });
  }
}));

// @desc    Get pool by ID
// @route   GET /api/pools/:poolId
// @access  Public
router.get('/:poolId', asyncHandler(async (req, res) => {
  const { poolId } = req.params;

  try {
    const pool = await Pool.findOne({ poolId, isActive: true });

    if (!pool) {
      return res.status(404).json({
        success: false,
        message: 'Pool not found'
      });
    }

    // Add computed fields
    const poolData = {
      ...pool.toObject(),
      apyTrend: pool.apyTrend,
      averageAPY7d: pool.getAverageAPY(7),
      averageAPY30d: pool.getAverageAPY(30),
      riskAdjustedReturn: pool.getRiskAdjustedReturn()
    };

    res.status(200).json({
      success: true,
      data: { pool: poolData }
    });
  } catch (error) {
    logger.error('Get pool error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pool'
    });
  }
}));

// @desc    Get best pools based on criteria
// @route   GET /api/pools/best
// @access  Public
router.get('/best', [
  query('chain').optional().isIn(['ethereum', 'base', 'arbitrum', 'polygon', 'optimism']),
  query('minAPY').optional().isFloat({ min: 0 }),
  query('maxRisk').optional().isInt({ min: 1, max: 10 }),
  query('minLiquidity').optional().isFloat({ min: 0 }),
  query('protocols').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    chain,
    minAPY = 3.0,
    maxRisk = 7,
    minLiquidity = 1000000,
    protocols,
    limit = 10
  } = req.query;

  try {
    const criteria = {
      chain,
      minAPY: parseFloat(minAPY),
      maxRisk: parseInt(maxRisk),
      minLiquidity: parseFloat(minLiquidity),
      protocols: protocols ? protocols.split(',') : [],
      limit: parseInt(limit)
    };

    const bestPools = await Pool.findBestPools(criteria);

    // Add computed fields for each pool
    const enrichedPools = bestPools.map(pool => ({
      ...pool.toObject(),
      apyTrend: pool.apyTrend,
      averageAPY7d: pool.getAverageAPY(7),
      riskAdjustedReturn: pool.getRiskAdjustedReturn()
    }));

    res.status(200).json({
      success: true,
      data: {
        pools: enrichedPools,
        criteria,
        count: enrichedPools.length
      }
    });
  } catch (error) {
    logger.error('Get best pools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch best pools'
    });
  }
}));

// @desc    Get pool analytics
// @route   GET /api/pools/:poolId/analytics
// @access  Public
router.get('/:poolId/analytics', asyncHandler(async (req, res) => {
  const { poolId } = req.params;
  const { period = '30d' } = req.query;

  try {
    const pool = await Pool.findOne({ poolId, isActive: true });

    if (!pool) {
      return res.status(404).json({
        success: false,
        message: 'Pool not found'
      });
    }

    // Calculate period in days
    const periodDays = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    }[period] || 30;

    // Filter APY history for the period
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const periodHistory = pool.apyHistory.filter(entry => entry.date > cutoffDate);

    // Calculate analytics
    const analytics = {
      poolId: pool.poolId,
      period,
      currentAPY: pool.currentAPY,
      averageAPY: pool.getAverageAPY(periodDays),
      minAPY: periodHistory.length > 0 ? Math.min(...periodHistory.map(h => h.apy)) : pool.currentAPY,
      maxAPY: periodHistory.length > 0 ? Math.max(...periodHistory.map(h => h.apy)) : pool.currentAPY,
      volatility: this.calculateVolatility(periodHistory),
      trend: pool.apyTrend,
      riskScore: pool.riskScore,
      riskAdjustedReturn: pool.getRiskAdjustedReturn(),
      liquiditySize: pool.liquiditySize,
      fees: pool.fees,
      dataPoints: periodHistory.length,
      history: periodHistory.slice(-50) // Last 50 data points for charting
    };

    res.status(200).json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    logger.error('Get pool analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pool analytics'
    });
  }
}));

// @desc    Get pools by chain
// @route   GET /api/pools/chain/:chain
// @access  Public
router.get('/chain/:chain', [
  query('sortBy').optional().isIn(['apy', 'liquidity', 'protocol']),
  query('limit').optional().isInt({ min: 1, max: 100 })
], asyncHandler(async (req, res) => {
  const { chain } = req.params;
  const { sortBy = 'apy', limit = 20 } = req.query;

  if (!['ethereum', 'base', 'arbitrum', 'polygon', 'optimism'].includes(chain)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid chain parameter'
    });
  }

  try {
    const sortField = sortBy === 'apy' ? 'currentAPY' : 
                     sortBy === 'liquidity' ? 'liquiditySize' : 'protocol';
    
    const pools = await Pool.find({ chain, isActive: true })
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit));

    // Get chain statistics
    const chainStats = await Pool.aggregate([
      { $match: { chain, isActive: true } },
      {
        $group: {
          _id: null,
          totalPools: { $sum: 1 },
          avgAPY: { $avg: '$currentAPY' },
          maxAPY: { $max: '$currentAPY' },
          totalLiquidity: { $sum: '$liquiditySize' },
          protocols: { $addToSet: '$protocol' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        chain,
        pools,
        stats: chainStats[0] || {
          totalPools: 0,
          avgAPY: 0,
          maxAPY: 0,
          totalLiquidity: 0,
          protocols: []
        }
      }
    });
  } catch (error) {
    logger.error('Get pools by chain error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pools for chain'
    });
  }
}));

// @desc    Sync pool data from external sources
// @route   POST /api/pools/sync
// @access  Private (Admin only - would need admin middleware)
router.post('/sync', auth, asyncHandler(async (req, res) => {
  try {
    // This would typically be an admin-only operation
    // For now, we'll allow authenticated users to trigger sync
    
    logger.info('Starting pool data sync...');
    
    // Fetch pool data from Airstack
    const chains = ['ethereum', 'base', 'arbitrum'];
    const poolData = await airstackService.getStablecoinPools(chains);
    
    let syncedCount = 0;
    let errorCount = 0;

    for (const poolInfo of poolData) {
      try {
        // This is a simplified sync - in production you'd need more sophisticated logic
        const poolId = `${poolInfo.chain}-${poolInfo.tokenAddress}`;
        
        let pool = await Pool.findOne({ poolId });
        
        if (!pool) {
          // Create new pool
          pool = new Pool({
            poolId,
            protocol: 'Unknown', // Would need to determine from contract
            chain: poolInfo.chain,
            stablecoinPair: poolInfo.symbol || 'Unknown',
            currentAPY: Math.random() * 10, // Placeholder - would calculate from data
            liquiditySize: poolInfo.volume || 0,
            fees: 0.1, // Placeholder
            contractAddress: poolInfo.tokenAddress
          });
        } else {
          // Update existing pool
          pool.liquiditySize = poolInfo.volume || pool.liquiditySize;
          pool.volume24h = poolInfo.volume || 0;
        }

        await pool.save();
        syncedCount++;
      } catch (error) {
        logger.error(`Error syncing pool ${poolInfo.tokenAddress}:`, error);
        errorCount++;
      }
    }

    logger.info(`Pool sync completed: ${syncedCount} synced, ${errorCount} errors`);

    res.status(200).json({
      success: true,
      message: 'Pool data sync completed',
      data: {
        syncedCount,
        errorCount,
        totalProcessed: poolData.length
      }
    });
  } catch (error) {
    logger.error('Pool sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync pool data'
    });
  }
}));

// Helper function to calculate volatility
function calculateVolatility(history) {
  if (history.length < 2) return 0;
  
  const apyValues = history.map(h => h.apy);
  const mean = apyValues.reduce((sum, apy) => sum + apy, 0) / apyValues.length;
  const variance = apyValues.reduce((sum, apy) => sum + Math.pow(apy - mean, 2), 0) / apyValues.length;
  
  return Math.sqrt(variance);
}

export default router;
