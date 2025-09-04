# StableSwap AI

**Effortlessly aggregate stablecoin liquidity and optimize yield across DeFi.**

StableSwap AI is a comprehensive DeFi platform that helps users find, interact with, and rebalance stablecoin liquidity pools across multiple blockchain networks. The platform features automated yield optimization, cross-chain swapping capabilities, and real-time portfolio tracking.

## 🚀 Features

### Core Features
- **Unified Liquidity Dashboard**: Aggregated view of stablecoin opportunities across multiple DeFi protocols
- **Automated Yield Optimization**: AI-powered recommendations and automated rebalancing for maximum returns
- **Cross-Chain Stablecoin Swapping**: Seamless transfers between Ethereum, Base, Arbitrum, Polygon, and Optimism
- **Real-time Portfolio Tracking**: Comprehensive analytics and transaction history
- **Multi-Chain Wallet Support**: Connect and manage wallets across multiple networks

### Premium Features
- Advanced yield optimization algorithms
- Automated rebalancing execution
- Priority customer support
- Advanced analytics and reporting

## 🏗️ Architecture

### Frontend (React + Vite)
- **Framework**: React 18 with Vite for fast development
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Context + Custom hooks
- **Wallet Integration**: Dynamic Labs for wallet connections
- **Charts**: Recharts for data visualization

### Backend (Node.js + Express)
- **Runtime**: Node.js with Express.js framework
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based auth with wallet signature verification
- **API Integration**: Airstack (DeFi data) + Alchemy (blockchain data)
- **Logging**: Winston for structured logging
- **Security**: Helmet, CORS, rate limiting

### External Integrations
- **Airstack**: DeFi protocol data aggregation
- **Alchemy**: Multi-chain blockchain data
- **Dynamic Labs**: Wallet connection and authentication
- **Turnkey/Privy**: Secure transaction signing (optional)

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm/yarn
- MongoDB 5.0+
- Git

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/vistara-apps/this-is-a-1260.git
   cd this-is-a-1260
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:5.0
   
   # Or use local MongoDB installation
   mongod --dbpath /path/to/your/db
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Start the backend server**
   ```bash
   npm run dev  # Development mode
   npm start    # Production mode
   ```

### Frontend Setup

1. **Install frontend dependencies**
   ```bash
   cd ../  # Back to root directory
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env.local
   # Configure frontend environment variables
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## 🔧 Configuration

### Required Environment Variables

#### Backend (.env)
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/stableswap-ai

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# API Keys
AIRSTACK_API_KEY=your-airstack-api-key
ALCHEMY_API_KEY=your-alchemy-api-key

# Optional: Wallet Infrastructure
TURNKEY_API_KEY=your-turnkey-api-key
PRIVY_APP_ID=your-privy-app-id
```

#### Frontend (.env.local)
```bash
VITE_API_BASE_URL=http://localhost:5000/api
VITE_DYNAMIC_ENVIRONMENT_ID=your-dynamic-environment-id
```

### API Keys Setup

1. **Airstack API Key**
   - Visit [Airstack](https://airstack.xyz)
   - Sign up and get your API key
   - Add to `AIRSTACK_API_KEY` in backend .env

2. **Alchemy API Key**
   - Visit [Alchemy](https://alchemy.com)
   - Create an app and get your API key
   - Add to `ALCHEMY_API_KEY` in backend .env

3. **Dynamic Labs Environment ID**
   - Visit [Dynamic Labs](https://dynamic.xyz)
   - Create a project and get your environment ID
   - Add to `VITE_DYNAMIC_ENVIRONMENT_ID` in frontend .env.local

## 🔗 API Documentation

### Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Core Endpoints

#### Users
- `POST /api/users/auth` - Authenticate with wallet signature
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/dashboard` - Get dashboard data
- `GET /api/users/wallets` - Get wallet balances
- `POST /api/users/wallets/sync` - Sync wallet balances

#### Pools
- `GET /api/pools` - Get all pools with filtering
- `GET /api/pools/:poolId` - Get specific pool details
- `GET /api/pools/best` - Get best pools by criteria
- `GET /api/pools/:poolId/analytics` - Get pool analytics
- `GET /api/pools/chain/:chain` - Get pools by blockchain

#### Transactions
- `GET /api/transactions` - Get transaction history
- `POST /api/transactions` - Create new transaction
- `GET /api/transactions/stats` - Get transaction statistics

### Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

## 🚀 Deployment

### Using Docker

1. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

### Manual Deployment

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Deploy backend**
   ```bash
   cd backend
   npm run start
   ```

3. **Serve frontend**
   ```bash
   # Using nginx, Apache, or any static file server
   # Serve the dist/ directory
   ```

### Environment-Specific Configurations

#### Production
- Set `NODE_ENV=production`
- Use production MongoDB instance
- Configure proper CORS origins
- Set up SSL certificates
- Enable monitoring and logging

#### Staging
- Use staging API keys
- Enable debug logging
- Configure test data

## 📊 Monitoring

### Health Checks
- Backend: `GET /health`
- Database connectivity
- External API status

### Logging
- Structured logging with Winston
- Error tracking and alerting
- Performance monitoring

### Metrics
- API response times
- Database query performance
- User engagement analytics

## 🔒 Security

### Authentication
- Wallet signature-based authentication
- JWT tokens with expiration
- Secure session management

### API Security
- Rate limiting
- CORS configuration
- Input validation and sanitization
- SQL injection prevention

### Data Protection
- Encrypted sensitive data
- Secure API key management
- Regular security audits

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](docs/api-documentation.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Integration Guide](docs/integration-guide.md)

### Community
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Discord community (coming soon)

### Commercial Support
For enterprise support and custom integrations, contact us at support@stableswap.ai

## 🗺️ Roadmap

### Q1 2024
- [ ] Advanced yield farming strategies
- [ ] Mobile app development
- [ ] Additional chain support (Avalanche, Fantom)

### Q2 2024
- [ ] Institutional features
- [ ] API for third-party integrations
- [ ] Advanced analytics dashboard

### Q3 2024
- [ ] Governance token launch
- [ ] DAO implementation
- [ ] Community-driven features

---

**Built with ❤️ by the StableSwap AI Team**

For more information, visit [stableswap.ai](https://stableswap.ai)
