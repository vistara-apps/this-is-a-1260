import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { auth, generateToken, verifyWalletSignature } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import airstackService from '../services/airstackService.js';
import alchemyService from '../services/alchemyService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// @desc    Register/Login user with wallet
// @route   POST /api/users/auth
// @access  Public
router.post('/auth', [
  body('walletAddress').isEthereumAddress().withMessage('Valid wallet address required'),
  body('signature').notEmpty().withMessage('Signature required'),
  body('message').notEmpty().withMessage('Message required'),
  body('email').optional().isEmail().withMessage('Valid email required')
], verifyWalletSignature, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { walletAddress, email } = req.body;

  try {
    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user) {
      // Create new user
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      user = new User({
        userId,
        email: email || `${walletAddress.toLowerCase()}@wallet.local`,
        walletAddress: walletAddress.toLowerCase(),
        subscriptionTier: 'free'
      });

      await user.save();
      logger.info(`New user created: ${userId}`);
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user.userId);

    res.status(200).json({
      success: true,
      message: user.isNew ? 'User registered successfully' : 'Login successful',
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          walletAddress: user.walletAddress,
          subscriptionTier: user.subscriptionTier,
          isSubscriptionActive: user.isSubscriptionActive,
          createdAt: user.createdAt
        },
        token
      }
    });
  } catch (error) {
    logger.error('User auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}));

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', auth, asyncHandler(async (req, res) => {
  const user = await User.findOne({ userId: req.user.userId })
    .select('-__v');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: { user }
  });
}));

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', [
  auth,
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('preferences.riskTolerance').optional().isIn(['conservative', 'moderate', 'aggressive']),
  body('preferences.autoRebalance').optional().isBoolean(),
  body('preferences.minAPYThreshold').optional().isFloat({ min: 0, max: 100 }),
  body('preferences.maxSlippage').optional().isFloat({ min: 0, max: 10 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, preferences } = req.body;
  const user = await User.findOne({ userId: req.user.userId });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update fields
  if (email) user.email = email;
  if (preferences) {
    user.preferences = { ...user.preferences, ...preferences };
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user }
  });
}));

// @desc    Get user wallets and balances
// @route   GET /api/users/wallets
// @access  Private
router.get('/wallets', auth, asyncHandler(async (req, res) => {
  const user = await User.findOne({ userId: req.user.userId });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  try {
    // Fetch real-time balances from Alchemy
    const chains = ['ethereum', 'base', 'arbitrum', 'polygon'];
    const multiChainData = await alchemyService.getMultiChainData(user.walletAddress, chains);

    // Update user wallet balances
    for (const chainData of multiChainData) {
      if (chainData.status === 'success') {
        await user.addOrUpdateWallet({
          chain: chainData.chain,
          address: user.walletAddress,
          balanceUsdc: chainData.balances.reduce((sum, balance) => {
            // Simplified: assume USDC balances
            return sum + (balance.balanceFormatted || 0);
          }, 0),
          balanceOtherStablecoins: 0 // Would need more sophisticated logic
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        wallets: user.wallets,
        totalPortfolioValue: user.getTotalPortfolioValue(),
        multiChainData
      }
    });
  } catch (error) {
    logger.error('Get wallets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet data'
    });
  }
}));

// @desc    Sync wallet balances
// @route   POST /api/users/wallets/sync
// @access  Private
router.post('/wallets/sync', auth, asyncHandler(async (req, res) => {
  const user = await User.findOne({ userId: req.user.userId });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  try {
    // Fetch DeFi positions from Airstack
    const defiPositions = await airstackService.getDeFiPositions(user.walletAddress);
    
    // Update wallet balances based on DeFi positions
    const chainBalances = {};
    
    defiPositions.forEach(position => {
      if (!chainBalances[position.chain]) {
        chainBalances[position.chain] = {
          usdc: 0,
          other: 0
        };
      }
      
      if (position.symbol === 'USDC') {
        chainBalances[position.chain].usdc += position.amount;
      } else {
        chainBalances[position.chain].other += position.usdValue;
      }
    });

    // Update user wallets
    for (const [chain, balances] of Object.entries(chainBalances)) {
      await user.addOrUpdateWallet({
        chain,
        address: user.walletAddress,
        balanceUsdc: balances.usdc,
        balanceOtherStablecoins: balances.other
      });
    }

    res.status(200).json({
      success: true,
      message: 'Wallet balances synced successfully',
      data: {
        wallets: user.wallets,
        totalPortfolioValue: user.getTotalPortfolioValue(),
        defiPositions
      }
    });
  } catch (error) {
    logger.error('Wallet sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync wallet balances'
    });
  }
}));

// @desc    Get user dashboard stats
// @route   GET /api/users/dashboard
// @access  Private
router.get('/dashboard', auth, asyncHandler(async (req, res) => {
  const user = await User.findOne({ userId: req.user.userId });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  try {
    const totalPortfolioValue = user.getTotalPortfolioValue();
    const walletCount = user.wallets.length;
    const activeChains = [...new Set(user.wallets.map(w => w.chain))];

    // Get recent activity from Airstack
    const recentActivity = await airstackService.getWalletHistory(user.walletAddress, 10);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalPortfolioValue,
          walletCount,
          activeChains: activeChains.length,
          subscriptionTier: user.subscriptionTier,
          isSubscriptionActive: user.isSubscriptionActive
        },
        wallets: user.wallets,
        recentActivity,
        preferences: user.preferences
      }
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
}));

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
router.delete('/account', auth, asyncHandler(async (req, res) => {
  const user = await User.findOne({ userId: req.user.userId });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Soft delete - mark as inactive
  user.isActive = false;
  await user.save();

  logger.info(`User account deactivated: ${user.userId}`);

  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully'
  });
}));

export default router;
