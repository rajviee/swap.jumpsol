# Swap - Cross-Chain Swap Web App PRD

## Original Problem Statement
Build a Rhino.fi-style cross-chain swap web app using LI.FI APIs. Users must be able to connect Phantom (Solana) and MetaMask (EVM), select tokens/chains, execute swaps, and view transaction history.

## User Choices
- **LI.FI API**: Public API (rate-limited)
- **Transaction History Storage**: MongoDB backend
- **Design**: Black background (#000000), #C1FF72 accent, #E74C3C errors
- **Wallet Connection**: MetaMask, Phantom, TronLink, Trust Wallet support
- **App Name**: "Swap" (renamed from CrossSwap)

## Architecture

### Tech Stack
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **External APIs**: LI.FI API for cross-chain routing

### Key Files
```
/app/backend/server.py          # FastAPI backend with LI.FI integration
/app/frontend/src/App.js        # Main app component
/app/frontend/src/components/
  ├── Header.jsx                # Navigation with wallet connection
  ├── WalletModal.jsx           # Wallet connection modal (MetaMask/Phantom/TronLink/Trust)
  ├── SwapCard.jsx              # Main swap interface
  ├── TokenSelectModal.jsx      # Token selection with chain filter
  └── TransactionHistory.jsx    # Transaction history list
/app/frontend/src/store/walletStore.js  # Zustand wallet state (EVM/Solana/Tron)
/app/frontend/src/services/api.js       # API service layer
/app/frontend/src/hooks/useLifi.js      # LI.FI data hooks + chain support utilities
```

## Core Requirements (Static)

### MVP Features
1. ✅ Wallet Connection (MetaMask + Phantom + TronLink + Trust Wallet)
2. ✅ Token Selection Modal with chain filtering
3. ✅ Cross-chain swap interface with LI.FI routing
4. ✅ Real-time quote fetching
5. ✅ Transaction history with MongoDB persistence
6. ✅ Responsive design
7. ✅ Solana chain support (3,407 tokens)
8. ✅ Tron chain support (TRX, USDT) - with bridge routing message

### API Endpoints
- `GET /api/health` - Health check
- `GET /api/lifi/chains` - Get supported chains (59 chains)
- `GET /api/lifi/tokens` - Get supported tokens (13,000+ tokens)
- `GET /api/lifi/quote` - Get swap quote
- `POST /api/lifi/routes` - Get multiple routes
- `GET /api/lifi/status` - Get tx status
- `POST /api/transactions` - Create transaction record
- `GET /api/transactions` - List transactions
- `PATCH /api/transactions/{id}` - Update transaction
- `GET /api/transactions/{id}` - Get transaction

## What's Been Implemented

### Feb 14, 2026 - Rhino.fi Bridge Integration
- **Multi-provider routing**: Routes Tron transactions to Rhino.fi, all other routes to LI.FI
- **Backend Services** (`/app/backend/rhino_bridge.py`):
  - `RhinoService` - JWT authentication, configs caching, quote fetching
  - `BridgeRouter` - Automatic provider selection based on chain
  - Chain ID to name normalization (728126428 → TRON, etc.)
- **API Endpoints**:
  - `POST /api/bridge/quote` - Multi-provider quote endpoint
  - `GET /api/bridge/configs` - Rhino.fi supported chains/tokens
  - `GET /api/bridge/provider` - Check which provider handles a route
  - `POST /api/bridge/commit/{id}` - Commit Rhino.fi quote
  - `GET /api/bridge/status/{id}` - Transaction status
- **Frontend Updates**:
  - `useQuote` hook now handles both LI.FI and Rhino.fi responses
  - Provider badge shows "via Rhino.fi" or "via LI.FI"
  - Purple-themed UI for Rhino.fi routes
- **Note**: Rhino.fi public API may return 404 for some routes - requires API key for full access

### Feb 14, 2026 - UI Fixes
- **Scrollbar fix**: Custom scrollbar CSS for token list (white/20 thumb)
- **Modal centering**: Fixed dialog positioning with inline styles
- **Chain icons**: Added 30+ chain logo mappings + dynamic API fetch

### Previous Updates
- Backend: FastAPI with LI.FI API integration, MongoDB transaction storage
- Frontend: React with Shadcn UI, black theme with #C1FF72 accent
- Wallet: MetaMask (EVM) + Phantom (Solana) + TronLink (Tron) + Trust Wallet support
- Features: Swap card, token selection modal, transaction history
- Fixed horizontal scroll for chain filters
- Performance optimization with memo() components
- Real token/chain logos from LI.FI CDN
- Solana chain support (chain ID: 1151111081099710)
- Tron chain support (chain ID: 728126428) - bridge routing required
- Bitcoin chain support (chain ID: 20000000000001) - not supported for swaps

## Chain Support Status
| Chain | Status | Notes |
|-------|--------|-------|
| EVM chains (ETH, ARB, OP, etc.) | ✅ Fully supported | Direct LI.FI support |
| Solana | ✅ Fully supported | Direct LI.FI support |
| Tron | ✅ **Fully supported** | Rhino-style ingress via SunSwap + Allbridge |
| Bitcoin | ❌ Not supported | Shows "not supported" message |

## TRON Bridge Architecture
```
User deposits TRX/USDT to generated address
        ↓
TRX → USDT via SunSwap (if TRX)
        ↓
TRC20 USDT → ERC20 USDT via Allbridge
        ↓
Route via LI.FI to destination chain
        ↓
Final swap to destination token
```

### State Machine
- `deposit_pending` - Waiting for deposit
- `received` - Deposit confirmed
- `swapping` - TRX → USDT on SunSwap
- `swapped` - Swap complete
- `bridging` - Bridging via Allbridge
- `bridged` - Bridge complete
- `routing` - LI.FI routing
- `routed` - Route complete
- `settling` - Final settlement
- `settled` - Complete!
- `failed` - Error state

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ Wallet connection (MetaMask, Phantom, TronLink, Trust Wallet)
- ✅ Token selection with Solana support
- ✅ Quote fetching
- ✅ Transaction history
- ✅ Real token/chain logos
- ✅ Horizontal scroll fixes
- ✅ Rename app to "Swap"
- ✅ Remove LI.FI branding
- ✅ Fix Tron to SOL swap (show proper message)

### P1 (Important) - Remaining
- [ ] Implement Tron bridge routing (requires wrapped token support)
- [ ] Bitcoin wrapped token support (wBTC)
- [ ] WalletConnect integration (QR code modal)
- [ ] Token balance fetching from wallets
- [ ] Real-time transaction status polling
- [ ] Price impact warnings

### P2 (Nice to Have)
- [ ] New chain selector with horizontal "quick chips" + "View All" modal
- [ ] Environment detection badge (Mainnet/Testnet)
- [ ] Recent tokens list
- [ ] Favorite tokens
- [ ] Slippage settings modal
- [ ] Multiple route options display
- [ ] Gas price estimation

## Next Tasks
1. Implement Tron bridge routing via wrapped tokens
2. Add Bitcoin support via wBTC
3. Complete WalletConnect QR code integration
4. Add wallet balance fetching for connected tokens
5. Add real-time LI.FI status polling for pending transactions
