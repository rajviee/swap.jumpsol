"""
Test Rhino.fi Bridge API Integration
Tests the bridge quote endpoint for TRON -> SOLANA routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Swap API"


class TestBridgeConfigs:
    """Test bridge configuration endpoints"""
    
    def test_get_bridge_configs(self):
        """Test fetching Rhino.fi bridge configurations"""
        response = requests.get(f"{BASE_URL}/api/bridge/configs")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "bridge_configs" in data
        assert "swap_configs" in data
        assert "supported_chains" in data
        
        # Verify TRON and SOLANA are supported
        supported_chains = data["supported_chains"]
        assert "TRON" in supported_chains, "TRON should be in supported chains"
        assert "SOLANA" in supported_chains, "SOLANA should be in supported chains"
        
        # Verify bridge configs have expected chains
        bridge_configs = data["bridge_configs"]
        assert "TRON" in bridge_configs
        assert "SOLANA" in bridge_configs
        
        # Verify TRON config has USDT token
        tron_config = bridge_configs.get("TRON", {})
        assert "tokens" in tron_config
        assert "USDT" in tron_config["tokens"]
        
        # Verify SOLANA config has USDC token
        solana_config = bridge_configs.get("SOLANA", {})
        assert "tokens" in solana_config
        assert "USDC" in solana_config["tokens"]


class TestBridgeQuote:
    """Test bridge quote endpoint - Rhino.fi integration"""
    
    def test_tron_to_solana_usdt_to_usdc_quote(self):
        """Test TRON USDT -> SOLANA USDC bridge quote (primary use case)"""
        payload = {
            "from_chain": "TRON",
            "to_chain": "SOLANA",
            "from_token": "USDT",
            "to_token": "USDC",
            "amount": "100",
            "from_address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "to_address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        }
        
        response = requests.post(f"{BASE_URL}/api/bridge/quote", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify provider is Rhino.fi
        assert data["provider"] == "rhino"
        assert data["supported"] == True
        
        # Verify quote has required fields
        assert "quote_id" in data
        assert data["quote_id"] is not None
        assert len(data["quote_id"]) > 0
        
        # Verify chain info
        assert data["from_chain"] == "TRON"
        assert data["to_chain"] == "SOLANA"
        assert data["from_token"] == "USDT"
        assert data["to_token"] == "USDC"
        
        # Verify amounts
        assert "from_amount" in data
        assert "to_amount" in data
        assert float(data["to_amount"]) > 0
        
        # Verify USD values
        assert "from_amount_usd" in data
        assert "to_amount_usd" in data
        
        # Verify fees
        assert "fee_usd" in data
        assert "gas_fee_usd" in data
        
        # Verify estimated time
        assert "estimated_time_seconds" in data
        assert data["estimated_time_seconds"] > 0
        
        # Verify expiration
        assert "expires_at" in data
    
    def test_tron_to_solana_usdt_to_usdt_quote(self):
        """Test TRON USDT -> SOLANA USDT bridge quote (same token)"""
        payload = {
            "from_chain": "TRON",
            "to_chain": "SOLANA",
            "from_token": "USDT",
            "to_token": "USDT",
            "amount": "50",
            "from_address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "to_address": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
        }
        
        response = requests.post(f"{BASE_URL}/api/bridge/quote", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Should use Rhino.fi
        assert data["provider"] == "rhino"
        
        # May or may not be supported depending on route availability
        if data.get("supported"):
            assert "quote_id" in data
            assert data["from_token"] == "USDT"
            assert data["to_token"] == "USDT"
    
    def test_solana_to_tron_quote(self):
        """Test SOLANA -> TRON route (reverse direction)"""
        payload = {
            "from_chain": "SOLANA",
            "to_chain": "TRON",
            "from_token": "USDC",
            "to_token": "USDT",
            "amount": "100",
            "from_address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "to_address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
        }
        
        response = requests.post(f"{BASE_URL}/api/bridge/quote", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Should use Rhino.fi for Solana routes
        assert data["provider"] == "rhino"
    
    def test_invalid_address_returns_error(self):
        """Test that invalid addresses return appropriate error"""
        payload = {
            "from_chain": "TRON",
            "to_chain": "SOLANA",
            "from_token": "USDT",
            "to_token": "USDC",
            "amount": "100",
            "from_address": "invalid_address",
            "to_address": "also_invalid"
        }
        
        response = requests.post(f"{BASE_URL}/api/bridge/quote", json=payload)
        assert response.status_code == 200  # API returns 200 with error in body
        data = response.json()
        
        # Should indicate not supported or have error
        assert data.get("supported") == False or "error" in data
    
    def test_non_tron_route_uses_lifi(self):
        """Test that non-Tron/Solana routes suggest LI.FI"""
        payload = {
            "from_chain": "1",  # Ethereum
            "to_chain": "42161",  # Arbitrum
            "from_token": "USDC",
            "to_token": "USDC",
            "amount": "100",
            "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE1a",
            "to_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE1a"
        }
        
        response = requests.post(f"{BASE_URL}/api/bridge/quote", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Should suggest using LI.FI
        assert data["provider"] == "lifi"
        assert data.get("use_existing_endpoint") == True


class TestBridgeProvider:
    """Test provider routing endpoint"""
    
    def test_tron_route_uses_rhino(self):
        """Test that TRON routes are routed to Rhino.fi"""
        response = requests.get(f"{BASE_URL}/api/bridge/provider", params={
            "from_chain": "TRON",
            "to_chain": "SOLANA"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["provider"] == "rhino"
        assert data["from_chain"] == "TRON"
        assert data["to_chain"] == "SOLANA"
    
    def test_solana_route_uses_rhino(self):
        """Test that SOLANA routes are routed to Rhino.fi"""
        response = requests.get(f"{BASE_URL}/api/bridge/provider", params={
            "from_chain": "1",  # Ethereum
            "to_chain": "SOLANA"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["provider"] == "rhino"
    
    def test_evm_route_uses_lifi(self):
        """Test that EVM-only routes use LI.FI"""
        response = requests.get(f"{BASE_URL}/api/bridge/provider", params={
            "from_chain": "1",  # Ethereum
            "to_chain": "42161"  # Arbitrum
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["provider"] == "lifi"


class TestLifiEndpoints:
    """Test LI.FI proxy endpoints"""
    
    def test_get_chains(self):
        """Test LI.FI chains endpoint"""
        response = requests.get(f"{BASE_URL}/api/lifi/chains")
        assert response.status_code == 200
        data = response.json()
        
        assert "chains" in data
        assert len(data["chains"]) > 0
        
        # Verify some expected chains exist
        chain_ids = [c["id"] for c in data["chains"]]
        assert 1 in chain_ids  # Ethereum
        assert 42161 in chain_ids  # Arbitrum
    
    def test_get_tokens(self):
        """Test LI.FI tokens endpoint"""
        response = requests.get(f"{BASE_URL}/api/lifi/tokens", params={"chains": "1,42161"})
        assert response.status_code == 200
        data = response.json()
        
        assert "tokens" in data
        # Should have tokens for requested chains
        assert "1" in data["tokens"] or 1 in data["tokens"]


class TestTransactionHistory:
    """Test transaction history endpoints"""
    
    @pytest.fixture
    def test_wallet(self):
        return "TEST_0x742d35Cc6634C0532925a3b844Bc9e7595f5bE1a"
    
    def test_create_transaction(self, test_wallet):
        """Test creating a transaction record"""
        payload = {
            "wallet_address": test_wallet,
            "from_chain_id": 728126428,  # TRON
            "to_chain_id": 1151111081099710,  # SOLANA
            "from_token_address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "to_token_address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "from_token_symbol": "USDT",
            "to_token_symbol": "USDC",
            "from_amount": "100000000",
            "to_amount": "99380000",
            "status": "pending",
            "tx_type": "bridge",
            "route_provider": "Rhino.fi"
        }
        
        response = requests.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["wallet_address"] == test_wallet.lower()
        assert data["from_token_symbol"] == "USDT"
        assert data["to_token_symbol"] == "USDC"
        assert data["route_provider"] == "Rhino.fi"
        
        return data["id"]
    
    def test_get_transactions(self, test_wallet):
        """Test fetching transactions for a wallet"""
        response = requests.get(f"{BASE_URL}/api/transactions", params={
            "wallet_address": test_wallet
        })
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
