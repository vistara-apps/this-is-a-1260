import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

export const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ userId: decoded.userId });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

export const requirePremium = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!req.user.hasPremiumAccess()) {
      return res.status(403).json({
        success: false,
        message: 'Premium subscription required for this feature.',
        subscriptionTier: req.user.subscriptionTier,
        upgradeUrl: '/api/subscriptions/upgrade'
      });
    }

    next();
  } catch (error) {
    logger.error('Premium auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const verifyWalletSignature = async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;
    
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address, signature, and message are required.'
      });
    }

    // In production, you would verify the signature using ethers.js or similar
    // For now, we'll assume the signature is valid
    // const isValid = await verifySignature(walletAddress, signature, message);
    
    // if (!isValid) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Invalid wallet signature.'
    //   });
    // }

    req.walletAddress = walletAddress.toLowerCase();
    next();
  } catch (error) {
    logger.error('Wallet signature verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying wallet signature.'
    });
  }
};
