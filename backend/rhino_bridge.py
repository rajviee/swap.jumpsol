# Rhino.fi Bridge Integration
# Routes Tron transactions through Rhino.fi API
# All other routes continue to use LI.FI

import os
import time
import aiohttp
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel
from enum import Enum
import logging

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

class RhinoConfig:
    """Rhino.fi API configuration"""
    
    BASE_URL = "https://api.rhino.fi"
    AUTH_URL = f"{BASE_URL}/authentication/auth/apiKey"
    CONFIGS_URL = f"{BASE_URL}/bridge/configs"
    SWAP_CONFIGS_URL = f"{BASE_URL}/bridge/bridge-swap-token-configs"
    # Correct endpoints per Rhino.fi docs
    BRIDGE_QUOTE_URL = f"{BASE_URL}/bridge/quote/user"
    BRIDGE_SWAP_QUOTE_URL = f"{BASE_URL}/bridge/quote/bridge-swap/user"
    PUBLIC_QUOTE_URL = f"{BASE_URL}/bridge/quote/public"
    COMMIT_URL = f"{BASE_URL}/bridge/quote/commit"
    STATUS_URL = f"{BASE_URL}/history/bridge"
    
    # Chain name mappings (Rhino.fi uses uppercase chain names)
    # Map both chain names and chain IDs
    CHAIN_NAMES = {
        # Chain IDs
        "728126428": "TRON",
        "1151111081099710": "SOLANA",
        "1": "ETHEREUM",
        "42161": "ARBITRUM",
        "10": "OPTIMISM",
        "8453": "BASE",
        "137": "MATIC_POS",
        "56": "BINANCE",
        "43114": "AVALANCHE",
        "324": "ZKSYNC",
        "59144": "LINEA",
        "534352": "SCROLL",
        # Chain name aliases
        "TRON": "TRON",
        "TRX": "TRON",
        "SOLANA": "SOLANA",
        "SOL": "SOLANA",
        "ETHEREUM": "ETHEREUM",
        "ETH": "ETHEREUM",
        "ARBITRUM": "ARBITRUM",
        "ARB": "ARBITRUM",
        "OPTIMISM": "OPTIMISM",
        "OP": "OPTIMISM",
        "BASE": "BASE",
        "POLYGON": "MATIC_POS",
        "MATIC": "MATIC_POS",
        "MATIC_POS": "MATIC_POS",
        "BSC": "BINANCE",
        "BINANCE": "BINANCE",
        "BNB": "BINANCE",
        "AVALANCHE": "AVALANCHE",
        "AVAX": "AVALANCHE",
        "ZKSYNC": "ZKSYNC",
        "LINEA": "LINEA",
        "SCROLL": "SCROLL",
    }
    
    # Token symbol mappings
    TOKEN_NAMES = {
        "USDT": "USDT",
        "USDC": "USDC",
        "TRX": "TRX",
        "SOL": "SOL",
        "ETH": "ETH",
        "WETH": "ETH",
    }


class RhinoBridgeStatus(str, Enum):
    """Rhino.fi bridge transaction states"""
    PENDING = "PENDING"
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    DEPOSIT_ACCEPTED = "DEPOSIT_ACCEPTED"
    ACCEPTED = "ACCEPTED"
    EXECUTED = "EXECUTED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"
    SWAP_FAILED = "SWAP_FAILED"
    SWAP_FAILED_REFUNDED = "SWAP_FAILED_REFUNDED"


# =============================================================================
# MODELS
# =============================================================================

class RhinoQuote(BaseModel):
    """Rhino.fi quote response"""
    quote_id: str
    chain_in: str
    chain_out: str
    token_in: str
    token_out: str
    pay_amount: str
    pay_amount_usd: float
    receive_amount: str
    receive_amount_usd: float
    fee_usd: float
    gas_fee_usd: float
    platform_fee_usd: float
    estimated_duration: int  # seconds
    expires_at: str
    depositor: str
    recipient: str


class RhinoTransaction(BaseModel):
    """Rhino.fi committed transaction"""
    quote_id: str
    status: str
    deposit_tx_hash: Optional[str] = None
    withdraw_tx_hash: Optional[str] = None
    created_at: datetime = datetime.now(timezone.utc)
    updated_at: datetime = datetime.now(timezone.utc)


# =============================================================================
# RHINO.FI SERVICE
# =============================================================================

class RhinoService:
    """
    Rhino.fi bridge service for Tron routes.
    
    Flow:
    1. Authenticate with API key to get JWT
    2. Fetch configs (chains/tokens supported)
    3. Get quote for bridge+swap
    4. Commit quote
    5. Execute on-chain transaction
    6. Track status
    """
    
    def __init__(self):
        self.config = RhinoConfig()
        self.api_key = os.getenv("RHINO_API_KEY", "")
        self.jwt: Optional[str] = None
        self.jwt_expires: float = 0
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Cached configs
        self._bridge_configs: Optional[Dict] = None
        self._swap_configs: Optional[Dict] = None
        self._configs_fetched_at: float = 0
        self._configs_ttl = 3600  # 1 hour cache
    
    async def _ensure_session(self):
        if not self.session:
            self.session = aiohttp.ClientSession()
    
    async def close(self):
        if self.session:
            await self.session.close()
            self.session = None
    
    async def _authenticate(self) -> bool:
        """Get JWT from API key"""
        if not self.api_key:
            logger.warning("RHINO_API_KEY not set - using public endpoints only")
            return False
        
        # Check if JWT is still valid (with 5 min buffer)
        if self.jwt and time.time() < self.jwt_expires - 300:
            return True
        
        await self._ensure_session()
        
        try:
            async with self.session.post(
                self.config.AUTH_URL,
                json={"apiKey": self.api_key},
                headers={"Content-Type": "application/json"}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.jwt = data.get("jwt") or data.get("token")
                    # JWT valid for 1 hour
                    self.jwt_expires = time.time() + 3600
                    logger.info("Rhino.fi authentication successful")
                    return True
                else:
                    error = await resp.text()
                    logger.error(f"Rhino.fi auth failed: {resp.status} - {error}")
                    return False
        except Exception as e:
            logger.error(f"Rhino.fi auth error: {e}")
            return False
    
    def _get_headers(self, authenticated: bool = True) -> Dict[str, str]:
        """Get request headers"""
        headers = {"Content-Type": "application/json"}
        if authenticated and self.jwt:
            headers["Authorization"] = self.jwt
        return headers
    
    async def get_bridge_configs(self, force_refresh: bool = False) -> Dict:
        """Fetch supported chains and their configurations"""
        # Use cache if available
        if not force_refresh and self._bridge_configs and (time.time() - self._configs_fetched_at < self._configs_ttl):
            return self._bridge_configs
        
        await self._ensure_session()
        
        try:
            async with self.session.get(self.config.CONFIGS_URL) as resp:
                if resp.status == 200:
                    self._bridge_configs = await resp.json()
                    self._configs_fetched_at = time.time()
                    return self._bridge_configs
                else:
                    logger.error(f"Failed to fetch bridge configs: {resp.status}")
                    return {}
        except Exception as e:
            logger.error(f"Error fetching bridge configs: {e}")
            return {}
    
    async def get_swap_configs(self, force_refresh: bool = False) -> Dict:
        """Fetch supported swap tokens"""
        if not force_refresh and self._swap_configs and (time.time() - self._configs_fetched_at < self._configs_ttl):
            return self._swap_configs
        
        await self._ensure_session()
        
        try:
            async with self.session.get(self.config.SWAP_CONFIGS_URL) as resp:
                if resp.status == 200:
                    self._swap_configs = await resp.json()
                    return self._swap_configs
                else:
                    logger.error(f"Failed to fetch swap configs: {resp.status}")
                    return {}
        except Exception as e:
            logger.error(f"Error fetching swap configs: {e}")
            return {}
    
    def normalize_chain(self, chain: str) -> str:
        """Normalize chain name to Rhino.fi format"""
        upper = chain.upper()
        return self.config.CHAIN_NAMES.get(upper, upper)
    
    def normalize_token(self, token: str) -> str:
        """Normalize token symbol to Rhino.fi format"""
        upper = token.upper()
        return self.config.TOKEN_NAMES.get(upper, upper)
    
    def is_tron_route(self, chain_in: str, chain_out: str) -> bool:
        """Check if this route involves Tron"""
        chain_in_norm = self.normalize_chain(chain_in)
        chain_out_norm = self.normalize_chain(chain_out)
        return chain_in_norm == "TRON" or chain_out_norm == "TRON"
    
    async def is_route_supported(self, chain_in: str, chain_out: str, token_in: str, token_out: str) -> bool:
        """Check if Rhino.fi supports this route"""
        configs = await self.get_bridge_configs()
        swap_configs = await self.get_swap_configs()
        
        chain_in_norm = self.normalize_chain(chain_in)
        chain_out_norm = self.normalize_chain(chain_out)
        token_in_norm = self.normalize_token(token_in)
        token_out_norm = self.normalize_token(token_out)
        
        logger.info(f"Checking route support: {chain_in_norm}/{token_in_norm} -> {chain_out_norm}/{token_out_norm}")
        
        # Check if chains are supported
        if chain_in_norm not in configs:
            logger.info(f"Source chain {chain_in_norm} not in bridge configs: {list(configs.keys())[:10]}...")
            return False
        if chain_out_norm not in configs:
            logger.info(f"Dest chain {chain_out_norm} not in bridge configs")
            return False
        
        # Both chains supported
        logger.info(f"Both chains supported: {chain_in_norm} and {chain_out_norm}")
        return True
    
    async def get_quote(
        self,
        chain_in: str,
        chain_out: str,
        token_in: str,
        token_out: str,
        amount: str,
        depositor: str,
        recipient: str,
        use_authenticated: bool = True
    ) -> Optional[Dict]:
        """
        Get a bridge+swap quote from Rhino.fi
        
        Args:
            chain_in: Source chain (e.g., "TRON")
            chain_out: Destination chain (e.g., "SOLANA")
            token_in: Source token (e.g., "USDT")
            token_out: Destination token (e.g., "USDC")
            amount: Amount to bridge (human readable)
            depositor: Source wallet address
            recipient: Destination wallet address
            use_authenticated: Use authenticated endpoint (required for committing)
        """
        await self._ensure_session()
        
        chain_in_norm = self.normalize_chain(chain_in)
        chain_out_norm = self.normalize_chain(chain_out)
        token_in_norm = self.normalize_token(token_in)
        token_out_norm = self.normalize_token(token_out)
        
        payload = {
            "chainIn": chain_in_norm,
            "chainOut": chain_out_norm,
            "tokenIn": token_in_norm,
            "tokenOut": token_out_norm,
            "amount": str(amount),
            "mode": "pay",  # User specifies pay amount
            "depositor": depositor,
            "recipient": recipient,
            "amountNative": "0"
        }
        
        url = self.config.QUOTE_URL if use_authenticated else self.config.PUBLIC_QUOTE_URL
        
        # Authenticate if using authenticated endpoint
        if use_authenticated:
            if not await self._authenticate():
                # Fall back to public endpoint
                url = self.config.PUBLIC_QUOTE_URL
                use_authenticated = False
        
        try:
            async with self.session.post(
                url,
                json=payload,
                headers=self._get_headers(use_authenticated)
            ) as resp:
                response_text = await resp.text()
                
                if resp.status == 200 and response_text:
                    data = await resp.json() if response_text else {}
                    
                    # Parse response
                    fees = data.get("fees", {})
                    return {
                        "provider": "rhino",
                        "quote_id": data.get("quoteId"),
                        "chain_in": data.get("chainIn"),
                        "chain_out": data.get("chainOut"),
                        "token_in": token_in_norm,
                        "token_out": token_out_norm,
                        "pay_amount": data.get("payAmount"),
                        "pay_amount_usd": data.get("payAmountUsd"),
                        "receive_amount": data.get("receiveAmount"),
                        "receive_amount_usd": data.get("receiveAmountUsd"),
                        "fee_usd": fees.get("feeUsd", 0),
                        "gas_fee_usd": fees.get("gasFeeUsd", 0),
                        "platform_fee_usd": fees.get("platformFeeUsd", 0),
                        "total_fee_usd": fees.get("feeUsd", 0),
                        "estimated_duration": data.get("estimatedDuration", 60),
                        "expires_at": data.get("expiresAt"),
                        "depositor": data.get("depositor"),
                        "recipient": data.get("recipient"),
                        "raw": data
                    }
                elif resp.status == 404:
                    logger.warning(f"Rhino.fi route not available (404): {chain_in_norm}/{token_in_norm} -> {chain_out_norm}/{token_out_norm}")
                    return {
                        "provider": "rhino",
                        "error": "This route is not currently available on Rhino.fi. Try USDT/USDC pairs between supported chains.",
                        "supported": False
                    }
                else:
                    logger.error(f"Rhino.fi quote failed: {resp.status} - {response_text[:200]}")
                    return {
                        "provider": "rhino",
                        "error": f"Rhino.fi API error: {resp.status}",
                        "supported": False
                    }
        except Exception as e:
            logger.error(f"Rhino.fi quote error: {e}")
            return {
                "provider": "rhino",
                "error": f"Connection error: {str(e)}",
                "supported": False
            }
    
    async def commit_quote(self, quote_id: str) -> Optional[Dict]:
        """Commit a quote to prepare for execution"""
        if not await self._authenticate():
            logger.error("Cannot commit quote without authentication")
            return None
        
        await self._ensure_session()
        
        try:
            async with self.session.post(
                f"{self.config.COMMIT_URL}/{quote_id}",
                headers=self._get_headers(True)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return {
                        "quote_id": data.get("quoteId"),
                        "committed": True,
                        "raw": data
                    }
                else:
                    error = await resp.text()
                    logger.error(f"Rhino.fi commit failed: {resp.status} - {error}")
                    return None
        except Exception as e:
            logger.error(f"Rhino.fi commit error: {e}")
            return None
    
    async def get_transaction_status(self, quote_id: str) -> Optional[Dict]:
        """Get the status of a committed transaction"""
        if not await self._authenticate():
            logger.warning("Cannot get status without authentication")
            return None
        
        await self._ensure_session()
        
        try:
            async with self.session.get(
                f"{self.config.STATUS_URL}/{quote_id}",
                headers=self._get_headers(True)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return {
                        "quote_id": quote_id,
                        "status": data.get("state"),
                        "deposit_tx_hash": data.get("depositTxHash"),
                        "withdraw_tx_hash": data.get("withdrawTxHash"),
                        "raw": data
                    }
                else:
                    error = await resp.text()
                    logger.error(f"Rhino.fi status failed: {resp.status} - {error}")
                    return None
        except Exception as e:
            logger.error(f"Rhino.fi status error: {e}")
            return None
    
    async def get_supported_chains(self) -> List[str]:
        """Get list of supported chains"""
        configs = await self.get_bridge_configs()
        return list(configs.keys())
    
    async def get_supported_tokens(self, chain: str) -> List[str]:
        """Get list of supported tokens for a chain"""
        configs = await self.get_bridge_configs()
        swap_configs = await self.get_swap_configs()
        
        chain_norm = self.normalize_chain(chain)
        
        tokens = set()
        
        # From bridge configs
        if chain_norm in configs:
            chain_config = configs[chain_norm]
            if "tokens" in chain_config:
                tokens.update(chain_config["tokens"].keys())
        
        # From swap configs
        if chain_norm in swap_configs:
            tokens.update(swap_configs[chain_norm].keys())
        
        return list(tokens)


# =============================================================================
# MULTI-PROVIDER ROUTER
# =============================================================================

class BridgeRouter:
    """
    Routes transactions to the appropriate provider:
    - Rhino.fi for Tron and Solana routes (they specialize in these)
    - LI.FI for everything else
    """
    
    # Chain IDs that should use Rhino.fi
    RHINO_CHAIN_IDS = {
        728126428,        # Tron
        1151111081099710, # Solana
    }
    
    RHINO_CHAIN_NAMES = {"TRON", "TRX", "SOLANA", "SOL"}
    
    def __init__(self, lifi_base_url: str = "https://li.quest/v1"):
        self.rhino = RhinoService()
        self.lifi_base_url = lifi_base_url
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _ensure_session(self):
        if not self.session:
            self.session = aiohttp.ClientSession()
    
    async def close(self):
        await self.rhino.close()
        if self.session:
            await self.session.close()
    
    def _is_rhino_chain(self, chain_id: Any) -> bool:
        """Check if chain ID should use Rhino.fi (Tron or Solana)"""
        chain_str = str(chain_id)
        
        # Check numeric chain IDs
        try:
            if int(chain_str) in self.RHINO_CHAIN_IDS:
                return True
        except ValueError:
            pass
        
        # Check chain name aliases
        if chain_str.upper() in self.RHINO_CHAIN_NAMES:
            return True
        
        return False
    
    def get_provider_for_route(self, chain_in: Any, chain_out: Any) -> str:
        """Determine which provider to use for a route"""
        if self._is_rhino_chain(chain_in) or self._is_rhino_chain(chain_out):
            return "rhino"
        return "lifi"
    
    async def get_quote(
        self,
        chain_in: str,
        chain_out: str,
        token_in: str,
        token_out: str,
        amount: str,
        from_address: str,
        to_address: str
    ) -> Dict[str, Any]:
        """
        Get a quote from the appropriate provider.
        
        Returns a unified quote format regardless of provider.
        """
        provider = self.get_provider_for_route(chain_in, chain_out)
        
        logger.info(f"Routing quote request to {provider}: {chain_in}/{token_in} -> {chain_out}/{token_out}")
        
        if provider == "rhino":
            return await self._get_rhino_quote(
                chain_in, chain_out, token_in, token_out,
                amount, from_address, to_address
            )
        else:
            return await self._get_lifi_quote(
                chain_in, chain_out, token_in, token_out,
                amount, from_address
            )
    
    async def _get_rhino_quote(
        self,
        chain_in: str, chain_out: str,
        token_in: str, token_out: str,
        amount: str, depositor: str, recipient: str
    ) -> Dict[str, Any]:
        """Get quote from Rhino.fi"""
        
        # Check if route is supported
        is_supported = await self.rhino.is_route_supported(chain_in, chain_out, token_in, token_out)
        
        if not is_supported:
            return {
                "provider": "rhino",
                "supported": False,
                "error": f"Route not supported by Rhino.fi: {chain_in}/{token_in} -> {chain_out}/{token_out}",
                "fallback_available": False
            }
        
        quote = await self.rhino.get_quote(
            chain_in, chain_out, token_in, token_out,
            amount, depositor, recipient
        )
        
        if not quote or quote.get("error"):
            return {
                "provider": "rhino",
                "supported": False,
                "error": quote.get("error") if quote else "Failed to get quote from Rhino.fi",
                "fallback_available": False
            }
        
        if not quote.get("quote_id"):
            return {
                "provider": "rhino",
                "supported": False,
                "error": quote.get("error", "Route not available - try USDT pairs"),
                "fallback_available": False
            }
        
        return {
            "provider": "rhino",
            "supported": True,
            "quote_id": quote["quote_id"],
            "from_chain": quote["chain_in"],
            "to_chain": quote["chain_out"],
            "from_token": quote["token_in"],
            "to_token": quote["token_out"],
            "from_amount": quote["pay_amount"],
            "from_amount_usd": quote["pay_amount_usd"],
            "to_amount": quote["receive_amount"],
            "to_amount_usd": quote["receive_amount_usd"],
            "fee_usd": quote["total_fee_usd"],
            "gas_fee_usd": quote["gas_fee_usd"],
            "estimated_time_seconds": quote["estimated_duration"],
            "expires_at": quote["expires_at"],
            "raw": quote.get("raw")
        }
    
    async def _get_lifi_quote(
        self,
        chain_in: str, chain_out: str,
        token_in: str, token_out: str,
        amount: str, from_address: str
    ) -> Dict[str, Any]:
        """Get quote from LI.FI (proxy through our backend)"""
        await self._ensure_session()
        
        # This should call our existing LI.FI proxy endpoint
        # For now, return a placeholder that indicates LI.FI should be used
        return {
            "provider": "lifi",
            "supported": True,
            "use_existing_lifi": True,
            "params": {
                "fromChain": chain_in,
                "toChain": chain_out,
                "fromToken": token_in,
                "toToken": token_out,
                "fromAmount": amount,
                "fromAddress": from_address
            }
        }
    
    async def commit_and_get_tx_data(self, provider: str, quote_id: str) -> Optional[Dict]:
        """Commit a quote and get transaction data for execution"""
        if provider == "rhino":
            result = await self.rhino.commit_quote(quote_id)
            if result:
                # Get bridge configs for contract info
                configs = await self.rhino.get_bridge_configs()
                return {
                    "provider": "rhino",
                    "quote_id": result["quote_id"],
                    "committed": True,
                    "configs": configs
                }
            return None
        else:
            # LI.FI handles this differently - transaction data is in the quote
            return {
                "provider": "lifi",
                "use_existing_flow": True
            }
    
    async def get_status(self, provider: str, quote_id: str) -> Optional[Dict]:
        """Get transaction status"""
        if provider == "rhino":
            status = await self.rhino.get_transaction_status(quote_id)
            if status:
                # Map Rhino status to unified status
                rhino_status = status["status"]
                unified_status = "pending"
                
                if rhino_status in ["EXECUTED"]:
                    unified_status = "complete"
                elif rhino_status in ["FAILED", "SWAP_FAILED"]:
                    unified_status = "failed"
                elif rhino_status in ["ACCEPTED", "DEPOSIT_ACCEPTED"]:
                    unified_status = "processing"
                elif rhino_status in ["PENDING", "PENDING_CONFIRMATION"]:
                    unified_status = "pending"
                
                return {
                    "provider": "rhino",
                    "status": unified_status,
                    "provider_status": rhino_status,
                    "deposit_tx": status.get("deposit_tx_hash"),
                    "withdraw_tx": status.get("withdraw_tx_hash")
                }
            return None
        else:
            # LI.FI status is handled by existing endpoint
            return {"provider": "lifi", "use_existing_flow": True}


# Singleton instance
bridge_router = BridgeRouter()
