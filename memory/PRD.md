# Swap - Cross-Chain Swap Web App PRD

## Original Problem Statement
Build a Rhino.fi-style cross-chain swap web app using LI.FI API. Users must be able to connect wallets (Phantom, MetaMask, WalletConnect, Trust Wallet), select tokens/chains, execute swaps, and view transaction history. Primary use case is swapping TRON (TRX, USDT) to Solana (USDC).

## User Choices
- **LI.FI API**: Public API (rate-limited) for EVM chains
- **Rhino.fi API**: For TRON/SOLANA routes (API key required)
- **Transaction History Storage**: MongoDB backend
- **Design**: Black background (#000000), #C1FF72 accent, #E74C3C errors
- **Wallet Connection**: MetaMask, Phantom, TronLink, Trust Wallet support
- **App Name**: "Swap"

## Architecture

### Tech Stack
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **External APIs**: LI.FI API, Rhino.fi API

### Key Files
```
/app/backend/
├── server.py               # FastAPI backend with LI.FI + Rhino.fi integration
├── rhino_bridge.py         # Rhino.fi API service (JWT auth, quote, commit)
├── tron_bridge.py          # Legacy custom TRON ingress (redundant)
└── .env                    # RHINO_API_KEY, MONGO_URL, DB_NAME

/app/frontend/src/
├── components/
│   ├── Header.jsx          # Navigation + Wallet + Network Toggle
│   ├── WalletModal.jsx     # Wallet connection (MetaMask/Phantom/TronLink/Trust)
│   ├── SwapCard.jsx        # Main swap interface
│   ├── TokenSelectModal.jsx # Token/chain selection modal
│   └── TronSwapModal.jsx   # Legacy TRON swap modal (redundant)
├── hooks/
│   └── useLifi.js          # Multi-provider hooks (LI.FI + Rhino.fi)
├── store/
│   └── walletStore.js      # Zustand state (EVM/Solana/Tron + environment)
└── services/
    └── api.js              # API service layer
```

## What's Been Implemented

### Feb 15, 2026 - Rhino.fi Integration Fixed + Testnet Toggle
- **Fixed Rhino.fi API Authentication**: Added proper JWT authentication flow
  - API key exchange for JWT via `POST /authentication/auth/apiKey`
  - JWT included in Authorization header for all authenticated requests
  - Correct endpoints: `/bridge/quote/user` (same token), `/bridge/quote/bridge-swap/user` (swap)
- **Testnet/Mainnet Toggle**: Added environment switch in header
  - State persisted in localStorage via Zustand
  - Chains filtered based on environment
  - Toggle visible in header with Mainnet (green globe) / Testnet (yellow test tube) icons
- **Token Modal TRON Selection**: Fixed and verified working
- **API Validation**: Better error handling for address validation (checksum errors)

### Previous Work
- Multi-provider routing: TRON/SOLANA → Rhino.fi, others → LI.FI
- Token selection modal with chain filters and search
- Wallet connections: MetaMask, Phantom, TronLink, Trust Wallet
- Transaction history with MongoDB persistence
- Responsive dark theme UI

## API Endpoints

### LI.FI Routes
- `GET /api/lifi/chains` - Get supported chains
- `GET /api/lifi/tokens` - Get supported tokens
- `GET /api/lifi/quote` - Get swap quote
- `POST /api/lifi/routes` - Get multiple routes
- `GET /api/lifi/status` - Get tx status

### Rhino.fi Routes
- `POST /api/bridge/quote` - Get quote (routes to Rhino.fi for TRON/SOLANA)
- `GET /api/bridge/configs` - Get supported chains/tokens
- `GET /api/bridge/provider` - Check which provider handles a route
- `POST /api/bridge/commit/{id}` - Commit Rhino.fi quote
- `GET /api/bridge/status/{id}` - Transaction status

### Transaction Routes
- `POST /api/transactions` - Create transaction record
- `GET /api/transactions` - List transactions by wallet
- `PATCH /api/transactions/{id}` - Update transaction
- `GET /api/transactions/{id}` - Get transaction

## Chain Support Status
| Chain | Status | Provider |
|-------|--------|----------|
| EVM chains (ETH, ARB, OP, etc.) | ✅ Supported | LI.FI |
| Solana | ✅ Supported | Rhino.fi |
| Tron | ✅ Supported | Rhino.fi |
| Bitcoin | ❌ Not supported | - |

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ Rhino.fi API integration with JWT authentication
- ✅ TRON → SOLANA bridge quotes working
- ✅ Testnet/Mainnet toggle
- ✅ Token selection modal with TRON chain
- ✅ Wallet connections (MetaMask, Phantom, TronLink, Trust Wallet)

### P1 (Important) - Remaining
- [ ] Complete Rhino.fi swap execution flow (commit + on-chain tx)
- [ ] WalletConnect integration (QR code modal)
- [ ] Token balance fetching from wallets
- [ ] Real-time transaction status polling
- [ ] Remove redundant tron_bridge.py and TronSwapModal.jsx

### P2 (Nice to Have)
- [ ] Bitcoin support via wBTC
- [ ] Slippage settings modal
- [ ] Multiple route options display
- [ ] Gas price estimation
- [ ] Favorite tokens
- [ ] Recent tokens list

## Credentials
- **RHINO_API_KEY**: `PUBLIC-cfcf87aa-4f58-474b-8356-5229b3589008` (stored in backend/.env)
- **MongoDB**: Local connection via MONGO_URL

## Test Reports
- `/app/test_reports/iteration_5.json` - Latest test results (100% backend, 90% frontend)
