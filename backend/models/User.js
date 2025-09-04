import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const walletSchema = new mongoose.Schema({
  walletId: {
    type: String,
    required: true,
    unique: true
  },
  chain: {
    type: String,
    required: true,
    enum: ['ethereum', 'base', 'arbitrum', 'polygon', 'optimism']
  },
  address: {
    type: String,
    required: true,
    lowercase: true
  },
  balanceUsdc: {
    type: Number,
    default: 0
  },
  balanceOtherStablecoins: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  subscriptionTier: {
    type: String,
    enum: ['free', 'basic', 'premium'],
    default: 'free'
  },
  subscriptionExpiry: {
    type: Date,
    default: null
  },
  wallets: [walletSchema],
  preferences: {
    riskTolerance: {
      type: String,
      enum: ['conservative', 'moderate', 'aggressive'],
      default: 'moderate'
    },
    autoRebalance: {
      type: Boolean,
      default: false
    },
    minAPYThreshold: {
      type: Number,
      default: 3.0
    },
    maxSlippage: {
      type: Number,
      default: 0.5
    },
    preferredChains: [{
      type: String,
      enum: ['ethereum', 'base', 'arbitrum', 'polygon', 'optimism']
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ walletAddress: 1 });
userSchema.index({ subscriptionTier: 1 });
userSchema.index({ 'wallets.address': 1 });

// Virtual for subscription status
userSchema.virtual('isSubscriptionActive').get(function() {
  if (this.subscriptionTier === 'free') return true;
  return this.subscriptionExpiry && this.subscriptionExpiry > new Date();
});

// Method to add or update wallet
userSchema.methods.addOrUpdateWallet = function(walletData) {
  const existingWallet = this.wallets.find(w => w.address === walletData.address);
  
  if (existingWallet) {
    Object.assign(existingWallet, walletData, { lastUpdated: new Date() });
  } else {
    this.wallets.push({
      ...walletData,
      walletId: `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastUpdated: new Date()
    });
  }
  
  return this.save();
};

// Method to get total portfolio value
userSchema.methods.getTotalPortfolioValue = function() {
  return this.wallets.reduce((total, wallet) => {
    return total + wallet.balanceUsdc + wallet.balanceOtherStablecoins;
  }, 0);
};

// Method to check if user has premium features
userSchema.methods.hasPremiumAccess = function() {
  return this.subscriptionTier === 'premium' && this.isSubscriptionActive;
};

// Pre-save middleware to update timestamps
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Transform output to remove sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.__v;
  return user;
};

const User = mongoose.model('User', userSchema);

export default User;
