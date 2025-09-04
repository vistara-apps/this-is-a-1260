import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  type: {
    type: String,
    required: true,
    enum: ['swap', 'deposit', 'withdraw', 'rebalance', 'cross_chain_swap', 'yield_claim']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'failed', 'cancelled'],
    default: 'pending'
  },
  fromChain: {
    type: String,
    required: true,
    enum: ['ethereum', 'base', 'arbitrum', 'polygon', 'optimism']
  },
  toChain: {
    type: String,
    required: false,
    enum: ['ethereum', 'base', 'arbitrum', 'polygon', 'optimism']
  },
  fromToken: {
    symbol: String,
    address: String,
    amount: Number,
    decimals: Number
  },
  toToken: {
    symbol: String,
    address: String,
    amount: Number,
    decimals: Number
  },
  poolId: {
    type: String,
    ref: 'Pool'
  },
  txHash: {
    type: String,
    sparse: true
  },
  blockNumber: {
    type: Number
  },
  gasUsed: {
    type: Number
  },
  gasPrice: {
    type: String // Wei as string to handle large numbers
  },
  fees: {
    network: Number,
    protocol: Number,
    bridge: Number,
    total: Number
  },
  slippage: {
    expected: Number,
    actual: Number
  },
  priceImpact: {
    type: Number,
    default: 0
  },
  estimatedTime: {
    type: Number // in seconds
  },
  actualTime: {
    type: Number // in seconds
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    referrer: String,
    bridgeProtocol: String,
    route: [String] // For multi-hop swaps
  },
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: {
    type: Date
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ fromChain: 1, toChain: 1 });

// Virtual for transaction duration
transactionSchema.virtual('duration').get(function() {
  if (!this.confirmedAt) return null;
  return Math.floor((this.confirmedAt - this.createdAt) / 1000); // in seconds
});

// Virtual for USD value (simplified - would need price feeds in production)
transactionSchema.virtual('usdValue').get(function() {
  // Assuming stablecoins are ~$1
  return this.fromToken?.amount || 0;
});

// Method to update transaction status
transactionSchema.methods.updateStatus = function(status, additionalData = {}) {
  this.status = status;
  this.updatedAt = new Date();
  
  if (status === 'confirmed') {
    this.confirmedAt = new Date();
  }
  
  // Merge additional data
  Object.assign(this, additionalData);
  
  return this.save();
};

// Method to calculate total fees in USD
transactionSchema.methods.getTotalFeesUSD = function() {
  return this.fees?.total || 0;
};

// Static method to get user transaction history
transactionSchema.statics.getUserHistory = function(userId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    type,
    status,
    fromDate,
    toDate
  } = options;
  
  let query = { userId };
  
  if (type) query.type = type;
  if (status) query.status = status;
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) query.createdAt.$lte = new Date(toDate);
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('poolId', 'protocol chain stablecoinPair currentAPY');
};

// Static method to get transaction statistics
transactionSchema.statics.getStats = function(userId, period = '30d') {
  const periodMap = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365
  };
  
  const days = periodMap[period] || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: startDate },
        status: 'confirmed'
      }
    },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalVolume: { $sum: '$fromToken.amount' },
        totalFees: { $sum: '$fees.total' },
        avgTransactionSize: { $avg: '$fromToken.amount' },
        successRate: {
          $avg: {
            $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0]
          }
        }
      }
    }
  ]);
};

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
