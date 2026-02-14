from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Swap API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# LI.FI API Base URL
LIFI_API_URL = "https://li.quest/v1"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============ Models ============

class TransactionCreate(BaseModel):
    wallet_address: str
    from_chain_id: int
    to_chain_id: int
    from_token_address: str
    to_token_address: str
    from_token_symbol: str
    to_token_symbol: str
    from_amount: str
    to_amount: str
    from_amount_usd: Optional[str] = None
    to_amount_usd: Optional[str] = None
    tx_hash: Optional[str] = None
    status: str = "pending"  # pending, success, failed
    tx_type: str = "swap"  # swap, bridge, approval
    route_provider: Optional[str] = None
    gas_fee: Optional[str] = None
    gas_fee_usd: Optional[str] = None

class Transaction(TransactionCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionUpdate(BaseModel):
    status: Optional[str] = None
    tx_hash: Optional[str] = None
    gas_fee: Optional[str] = None
    gas_fee_usd: Optional[str] = None

class QuoteRequest(BaseModel):
    fromChain: int
    toChain: int
    fromToken: str
    toToken: str
    fromAmount: str
    fromAddress: str
    slippage: Optional[float] = 0.03


# ============ LI.FI API Endpoints ============

@api_router.get("/lifi/chains")
async def get_chains():
    """Fetch all supported chains from LI.FI"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{LIFI_API_URL}/chains")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch chains: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch chains: {str(e)}")

@api_router.get("/lifi/tokens")
async def get_tokens(chains: Optional[str] = Query(None, description="Comma-separated chain IDs")):
    """Fetch all supported tokens, optionally filtered by chain IDs"""
    try:
        params = {}
        if chains:
            params['chains'] = chains
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{LIFI_API_URL}/tokens", params=params)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch tokens: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch tokens: {str(e)}")

@api_router.get("/lifi/quote")
async def get_quote(
    fromChain: int,
    toChain: int,
    fromToken: str,
    toToken: str,
    fromAmount: str,
    fromAddress: str,
    slippage: float = 0.03
):
    """Get a quote for a token swap"""
    try:
        params = {
            "fromChain": fromChain,
            "toChain": toChain,
            "fromToken": fromToken,
            "toToken": toToken,
            "fromAmount": fromAmount,
            "fromAddress": fromAddress,
            "slippage": slippage,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(f"{LIFI_API_URL}/quote", params=params)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to fetch quote: {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=e.response.json() if e.response.text else str(e))
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch quote: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch quote: {str(e)}")

@api_router.post("/lifi/routes")
async def get_routes(request: QuoteRequest):
    """Get multiple route options for a swap"""
    try:
        payload = {
            "fromChainId": request.fromChain,
            "toChainId": request.toChain,
            "fromTokenAddress": request.fromToken,
            "toTokenAddress": request.toToken,
            "fromAmount": request.fromAmount,
            "fromAddress": request.fromAddress,
            "options": {
                "slippage": request.slippage,
                "order": "RECOMMENDED"
            }
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{LIFI_API_URL}/advanced/routes", json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to fetch routes: {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=e.response.json() if e.response.text else str(e))
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch routes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch routes: {str(e)}")

@api_router.get("/lifi/status")
async def get_tx_status(
    txHash: str,
    fromChain: int,
    toChain: int,
    bridge: Optional[str] = None
):
    """Check the status of a cross-chain transfer"""
    try:
        params = {
            "txHash": txHash,
            "fromChain": fromChain,
            "toChain": toChain,
        }
        if bridge:
            params["bridge"] = bridge
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{LIFI_API_URL}/status", params=params)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch status: {str(e)}")


# ============ Transaction History Endpoints ============

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(tx: TransactionCreate):
    """Create a new transaction record"""
    tx_obj = Transaction(**tx.model_dump())
    doc = tx_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.transactions.insert_one(doc)
    return tx_obj

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(
    wallet_address: str,
    status: Optional[str] = None,
    tx_type: Optional[str] = None,
    chain_id: Optional[int] = None,
    limit: int = 50
):
    """Get transactions for a wallet address"""
    query: Dict[str, Any] = {"wallet_address": wallet_address.lower()}
    
    if status:
        query["status"] = status
    if tx_type:
        query["tx_type"] = tx_type
    if chain_id:
        query["$or"] = [
            {"from_chain_id": chain_id},
            {"to_chain_id": chain_id}
        ]
    
    transactions = await db.transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for tx in transactions:
        if isinstance(tx.get('created_at'), str):
            tx['created_at'] = datetime.fromisoformat(tx['created_at'])
        if isinstance(tx.get('updated_at'), str):
            tx['updated_at'] = datetime.fromisoformat(tx['updated_at'])
    
    return transactions

@api_router.patch("/transactions/{tx_id}", response_model=Transaction)
async def update_transaction(tx_id: str, update: TransactionUpdate):
    """Update a transaction status"""
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.transactions.find_one_and_update(
        {"id": tx_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    del result['_id']
    if isinstance(result.get('created_at'), str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    if isinstance(result.get('updated_at'), str):
        result['updated_at'] = datetime.fromisoformat(result['updated_at'])
    
    return result

@api_router.get("/transactions/{tx_id}", response_model=Transaction)
async def get_transaction(tx_id: str):
    """Get a specific transaction"""
    tx = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if isinstance(tx.get('created_at'), str):
        tx['created_at'] = datetime.fromisoformat(tx['created_at'])
    if isinstance(tx.get('updated_at'), str):
        tx['updated_at'] = datetime.fromisoformat(tx['updated_at'])
    
    return tx


# ============ Health Check ============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Swap API"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
