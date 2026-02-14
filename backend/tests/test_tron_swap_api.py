"""
TRON Swap API Tests
Tests for TRON bridge endpoints: create, estimate, status
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns Swap API"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Swap API"


class TestTronSwapCreate:
    """Tests for POST /api/tron/swap/create"""
    
    def test_create_trx_to_sol_swap(self):
        """Create TRX to SOL swap order"""
        payload = {
            "from_token": "TRX",
            "to_chain": "SOL",
            "to_token": "USDC",
            "to_address": "test_sol_address_create_1",
            "user_address": "test_user_create_1"
        }
        response = requests.post(f"{BASE_URL}/api/tron/swap/create", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # Verify order_id is returned
        assert "order_id" in data
        assert len(data["order_id"]) > 0
        
        # Verify deposit_address is returned (TRON address format)
        assert "deposit_address" in data
        assert data["deposit_address"].startswith("T")
        
        # Verify other fields
        assert data["from_token"] == "TRX"
        assert data["to_chain"] == "SOL"
        assert data["to_token"] == "USDC"
        assert data["state"] == "deposit_pending"
        assert data["estimated_time_minutes"] == 15
        assert "created_at" in data
    
    def test_create_usdt_to_eth_swap(self):
        """Create USDT to ETH swap order"""
        payload = {
            "from_token": "USDT",
            "to_chain": "ETH",
            "to_token": "USDC",
            "to_address": "0x1234567890abcdef1234567890abcdef12345678",
            "user_address": "test_user_create_2"
        }
        response = requests.post(f"{BASE_URL}/api/tron/swap/create", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "order_id" in data
        assert "deposit_address" in data
        assert data["from_token"] == "USDT"
        assert data["to_chain"] == "ETH"
    
    def test_create_swap_missing_fields(self):
        """Test create swap with missing required fields"""
        payload = {
            "from_token": "TRX"
            # Missing other required fields
        }
        response = requests.post(f"{BASE_URL}/api/tron/swap/create", json=payload)
        assert response.status_code == 422  # Validation error


class TestTronSwapEstimate:
    """Tests for POST /api/tron/swap/estimate"""
    
    def test_estimate_trx_to_sol_usdc(self):
        """Estimate TRX to SOL USDC swap with SunSwap, Allbridge, LI.FI steps"""
        payload = {
            "from_token": "TRX",
            "from_amount": 100,
            "to_chain": "SOL",
            "to_token": "USDC"
        }
        response = requests.post(f"{BASE_URL}/api/tron/swap/estimate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        assert data["input_token"] == "TRX"
        assert data["input_amount"] == 100
        assert data["output_token"] == "USDC"
        assert data["output_chain"] == "SOL"
        assert "estimated_output" in data
        assert data["estimated_output"] > 0
        assert "total_fees_usd" in data
        assert "estimated_time_minutes" in data
        
        # Verify steps array contains SunSwap, Allbridge, LI.FI
        assert "steps" in data
        steps = data["steps"]
        assert len(steps) >= 2  # At least SunSwap and Allbridge
        
        # Check for SunSwap step (TRX -> USDT)
        sunswap_step = next((s for s in steps if s["provider"] == "SunSwap"), None)
        assert sunswap_step is not None, "SunSwap step should be present for TRX swap"
        assert "TRX" in sunswap_step["action"]
        assert "USDT" in sunswap_step["action"]
        
        # Check for Allbridge step
        allbridge_step = next((s for s in steps if s["provider"] == "Allbridge"), None)
        assert allbridge_step is not None, "Allbridge step should be present"
        assert "Bridge" in allbridge_step["action"]
        
        # Check for LI.FI step (routing to SOL)
        lifi_step = next((s for s in steps if s["provider"] == "LI.FI"), None)
        assert lifi_step is not None, "LI.FI step should be present for cross-chain routing"
    
    def test_estimate_usdt_to_eth(self):
        """Estimate USDT to ETH swap (no SunSwap needed)"""
        payload = {
            "from_token": "USDT",
            "from_amount": 50,
            "to_chain": "ETH",
            "to_token": "USDC"
        }
        response = requests.post(f"{BASE_URL}/api/tron/swap/estimate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        steps = data["steps"]
        
        # USDT swap should NOT have SunSwap step
        sunswap_step = next((s for s in steps if s["provider"] == "SunSwap"), None)
        assert sunswap_step is None, "SunSwap should NOT be present for USDT swap"
        
        # Should have Allbridge step
        allbridge_step = next((s for s in steps if s["provider"] == "Allbridge"), None)
        assert allbridge_step is not None
    
    def test_estimate_invalid_amount(self):
        """Test estimate with invalid amount"""
        payload = {
            "from_token": "TRX",
            "from_amount": -100,  # Invalid negative amount
            "to_chain": "SOL",
            "to_token": "USDC"
        }
        response = requests.post(f"{BASE_URL}/api/tron/swap/estimate", json=payload)
        assert response.status_code == 422  # Validation error


class TestTronSwapStatus:
    """Tests for GET /api/tron/swap/{id}"""
    
    @pytest.fixture
    def created_order(self):
        """Create an order for status testing"""
        payload = {
            "from_token": "TRX",
            "to_chain": "SOL",
            "to_token": "USDC",
            "to_address": "test_sol_status_test",
            "user_address": "test_user_status"
        }
        response = requests.post(f"{BASE_URL}/api/tron/swap/create", json=payload)
        return response.json()
    
    def test_get_order_status(self, created_order):
        """Get order status with progress percentage"""
        order_id = created_order["order_id"]
        
        response = requests.get(f"{BASE_URL}/api/tron/swap/{order_id}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify status fields
        assert data["id"] == order_id
        assert data["state"] == "deposit_pending"
        assert "progress" in data
        assert data["progress"] == 0  # deposit_pending = 0%
        
        # Verify deposit address is present
        assert "deposit_address" in data
        assert data["deposit_address"].startswith("T")
        
        # Verify sensitive data is NOT returned
        assert "deposit_private_key_encrypted" not in data
        assert "deposit_nonce" not in data
    
    def test_get_nonexistent_order(self):
        """Test getting status of non-existent order"""
        response = requests.get(f"{BASE_URL}/api/tron/swap/nonexistent_order_id_12345")
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()


class TestTronOrders:
    """Tests for GET /api/tron/orders"""
    
    def test_get_user_orders(self):
        """Get all orders for a user"""
        # First create an order
        user_address = f"test_user_orders_{int(time.time())}"
        payload = {
            "from_token": "TRX",
            "to_chain": "SOL",
            "to_token": "USDC",
            "to_address": "test_sol_orders",
            "user_address": user_address
        }
        requests.post(f"{BASE_URL}/api/tron/swap/create", json=payload)
        
        # Get orders for user
        response = requests.get(f"{BASE_URL}/api/tron/orders", params={"user_address": user_address})
        assert response.status_code == 200
        
        data = response.json()
        assert "orders" in data
        assert "total" in data
        assert data["total"] >= 1
        
        # Verify order structure
        order = data["orders"][0]
        assert order["user_address"] == user_address
        assert "deposit_private_key_encrypted" not in order  # Sensitive data excluded


class TestLifiIntegration:
    """Tests for LI.FI API integration"""
    
    def test_lifi_chains(self):
        """Test LI.FI chains endpoint"""
        response = requests.get(f"{BASE_URL}/api/lifi/chains")
        assert response.status_code == 200
        
        data = response.json()
        assert "chains" in data
        assert len(data["chains"]) > 0
    
    def test_lifi_tokens(self):
        """Test LI.FI tokens endpoint"""
        response = requests.get(f"{BASE_URL}/api/lifi/tokens", params={"chains": "1,42161"})
        assert response.status_code == 200
        
        data = response.json()
        assert "tokens" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
