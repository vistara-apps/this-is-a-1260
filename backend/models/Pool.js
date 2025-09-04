import mongoose from 'mongoose';

const poolSchema = new mongoose.Schema({
  poolId: {
    type: String,
    required: true,
    unique: true
  },
  protocol: {
    type: String,
    required: true,
    enum: ['Aave', 'Compound', 'Curve', 'Uniswap', 'SushiSwap', 'Balancer', 'Velodrome', 'Moonwell', 'Stargate']
  },
  chain: {
    type: String,
    required: true,
    enum: ['ethereum', 'base', 'arbitrum', 'polygon', 'optimism']
  },
  stablecoinPair: {
    type: String,
    required: true
  },
  currentAPY: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  liquiditySize: {
    type: Number,
    required: true,
    min: 0
  },
  fees: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  contractAddress: {
    type: String,
    required: false,
    lowercase: true
  },
  tokenAddresses: [{
    symbol: String,
    address: String,
    decimals: Number
  }],
  riskScore: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  tvl: {
    type: Number,
    default: 0
  },
  volume24h: {
    type: Number,
    default: 0
  },
  apyHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    apy: Number
  }],
  metadata: {
    description: String,
    website: String,
    documentation: String,
    auditReports: [String]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
poolSchema.index({ protocol: 1, chain: 1 });
poolSchema.index({ currentAPY: -1 });
poolSchema.index({ liquiditySize: -1 });
poolSchema.index({ chain: 1, isActive: 1 });
poolSchema.index({ stablecoinPair: 1 });

// Virtual for APY trend (last 7 days)
poolSchema.virtual('apyTrend').get(function() {
  if (this.apyHistory.length < 2) return 'stable';
  
  const recent = this.apyHistory.slice(-7);
  const first = recent[0].apy;
  const last = recent[recent.length - 1].apy;
  
  const change = ((last - first) / first) * 100;
  
  if (change > 5) return 'increasing';
  if (change < -5) return 'decreasing';
  return 'stable';
});

// Method to add APY history point
poolSchema.methods.addAPYHistory = function(apy) {
  this.apyHistory.push({ date: new Date(), apy });
  
  // Keep only last 30 days of history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  this.apyHistory = this.apyHistory.filter(entry => entry.date > thirtyDaysAgo);
  
  this.currentAPY = apy;
  this.lastUpdated = new Date();
  
  return this.save();
};

// Method to calculate average APY over period
poolSchema.methods.getAverageAPY = function(days = 7) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const recentHistory = this.apyHistory.filter(entry => entry.date > cutoffDate);
  
  if (recentHistory.length === 0) return this.currentAPY;
  
  const sum = recentHistory.reduce((total, entry) => total + entry.apy, 0);
  return sum / recentHistory.length;
};

// Method to get risk-adjusted return
poolSchema.methods.getRiskAdjustedReturn = function() {
  return this.currentAPY / this.riskScore;
};

// Static method to find best pools by criteria
poolSchema.statics.findBestPools = function(criteria = {}) {
  const {
    chain,
    minAPY = 0,
    maxRisk = 10,
    minLiquidity = 0,
    protocols = [],
    limit = 10
  } = criteria;
  
  let query = { isActive: true };
  
  if (chain) query.chain = chain;
  if (minAPY > 0) query.currentAPY = { $gte: minAPY };
  if (maxRisk < 10) query.riskScore = { $lte: maxRisk };
  if (minLiquidity > 0) query.liquiditySize = { $gte: minLiquidity };
  if (protocols.length > 0) query.protocol = { $in: protocols };
  
  return this.find(query)
    .sort({ currentAPY: -1 })
    .limit(limit);
};

// Pre-save middleware
poolSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const Pool = mongoose.model('Pool', poolSchema);

export default Pool;
