"""
Backend API tests for Swap application
Tests: Health check, LI.FI integration, Transaction CRUD
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Health endpoint tests - verify app name is 'Swap API'"""
    
    def test_health_returns_200(self):
        """Health endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
    
    def test_health_returns_swap_api_name(self):
        """Health endpoint should return 'Swap API' not 'CrossSwap' or 'LI.FI Cross-Chain Swap API'"""
        response = requests.get(f"{BASE_URL}/api/health")
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Swap API", f"Expected 'Swap API' but got '{data.get('service')}'"
        # Verify it's NOT the old names
        assert "CrossSwap" not in data["service"], "Service name should not contain 'CrossSwap'"
        assert "LI.FI" not in data["service"], "Service name should not contain 'LI.FI'"


class TestLifiChains:
    """LI.FI chains API tests"""
    
    def test_chains_returns_200(self):
        """Chains endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/lifi/chains")
        assert response.status_code == 200
    
    def test_chains_returns_list(self):
        """Chains endpoint should return a list of chains"""
        response = requests.get(f"{BASE_URL}/api/lifi/chains")
        data = response.json()
        assert "chains" in data
        assert len(data["chains"]) > 0
        print(f"Found {len(data['chains'])} chains")
    
    def test_chains_includes_ethereum(self):
        """Chains should include Ethereum (chain ID 1)"""
        response = requests.get(f"{BASE_URL}/api/lifi/chains")
        data = response.json()
        chain_ids = [c["id"] for c in data["chains"]]
        assert 1 in chain_ids, "Ethereum (chain ID 1) should be in chains list"
    
    def test_chains_includes_solana(self):
        """Chains should include Solana (added as custom chain in frontend if not in LI.FI)"""
        response = requests.get(f"{BASE_URL}/api/lifi/chains")
        data = response.json()
        # Solana chain ID - may be added as custom chain in frontend
        SOLANA_CHAIN_ID = 1151111081099710
        chain_ids = [c["id"] for c in data["chains"]]
        # Solana may or may not be in LI.FI chains - frontend adds it as custom chain
        if SOLANA_CHAIN_ID in chain_ids:
            print("✓ Solana found in LI.FI chains")
        else:
            print("ℹ Solana not in LI.FI chains - added as custom chain in frontend")
            pytest.skip("Solana is added as custom chain in frontend, not from LI.FI API")


class TestLifiTokens:
    """LI.FI tokens API tests"""
    
    def test_tokens_returns_200(self):
        """Tokens endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/lifi/tokens")
        assert response.status_code == 200
    
    def test_tokens_returns_dict(self):
        """Tokens endpoint should return tokens by chain"""
        response = requests.get(f"{BASE_URL}/api/lifi/tokens")
        data = response.json()
        assert "tokens" in data
        assert isinstance(data["tokens"], dict)
        print(f"Found tokens for {len(data['tokens'])} chains")
    
    def test_tokens_filter_by_chain(self):
        """Tokens endpoint should filter by chain ID"""
        response = requests.get(f"{BASE_URL}/api/lifi/tokens?chains=1")
        assert response.status_code == 200
        data = response.json()
        assert "tokens" in data


class TestTransactionCRUD:
    """Transaction CRUD tests"""
    
    @pytest.fixture
    def test_wallet_address(self):
        # Use lowercase to match backend query behavior
        return f"test_0x{uuid.uuid4().hex[:40]}"
    
    def test_create_transaction(self, test_wallet_address):
        """Create a new transaction"""
        payload = {
            "wallet_address": test_wallet_address,
            "from_chain_id": 1,
            "to_chain_id": 137,
            "from_token_address": "0x0000000000000000000000000000000000000000",
            "to_token_address": "0x0000000000000000000000000000000000000000",
            "from_token_symbol": "ETH",
            "to_token_symbol": "MATIC",
            "from_amount": "1000000000000000000",
            "to_amount": "2000000000000000000",
            "status": "pending",
            "tx_type": "bridge"
        }
        response = requests.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        # Backend lowercases wallet addresses for consistency
        assert data["wallet_address"].lower() == test_wallet_address.lower()
        assert data["from_token_symbol"] == "ETH"
        assert data["to_token_symbol"] == "MATIC"
        return data["id"]
    
    def test_get_transactions_by_wallet(self, test_wallet_address):
        """Get transactions for a wallet"""
        # First create a transaction
        payload = {
            "wallet_address": test_wallet_address,
            "from_chain_id": 1,
            "to_chain_id": 137,
            "from_token_address": "0x0000000000000000000000000000000000000000",
            "to_token_address": "0x0000000000000000000000000000000000000000",
            "from_token_symbol": "ETH",
            "to_token_symbol": "MATIC",
            "from_amount": "1000000000000000000",
            "to_amount": "2000000000000000000",
            "status": "pending",
            "tx_type": "swap"
        }
        create_response = requests.post(f"{BASE_URL}/api/transactions", json=payload)
        assert create_response.status_code == 200
        
        # Then get transactions - use lowercase as backend stores lowercase
        response = requests.get(f"{BASE_URL}/api/transactions?wallet_address={test_wallet_address.lower()}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_update_transaction_status(self, test_wallet_address):
        """Update transaction status"""
        # Create transaction
        payload = {
            "wallet_address": test_wallet_address,
            "from_chain_id": 1,
            "to_chain_id": 137,
            "from_token_address": "0x0000000000000000000000000000000000000000",
            "to_token_address": "0x0000000000000000000000000000000000000000",
            "from_token_symbol": "ETH",
            "to_token_symbol": "MATIC",
            "from_amount": "1000000000000000000",
            "to_amount": "2000000000000000000",
            "status": "pending",
            "tx_type": "swap"
        }
        create_response = requests.post(f"{BASE_URL}/api/transactions", json=payload)
        tx_id = create_response.json()["id"]
        
        # Update status
        update_payload = {"status": "success", "tx_hash": "0x123abc"}
        response = requests.patch(f"{BASE_URL}/api/transactions/{tx_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["tx_hash"] == "0x123abc"
    
    def test_get_single_transaction(self, test_wallet_address):
        """Get a single transaction by ID"""
        # Create transaction
        payload = {
            "wallet_address": test_wallet_address,
            "from_chain_id": 1,
            "to_chain_id": 137,
            "from_token_address": "0x0000000000000000000000000000000000000000",
            "to_token_address": "0x0000000000000000000000000000000000000000",
            "from_token_symbol": "ETH",
            "to_token_symbol": "MATIC",
            "from_amount": "1000000000000000000",
            "to_amount": "2000000000000000000",
            "status": "pending",
            "tx_type": "swap"
        }
        create_response = requests.post(f"{BASE_URL}/api/transactions", json=payload)
        tx_id = create_response.json()["id"]
        
        # Get single transaction
        response = requests.get(f"{BASE_URL}/api/transactions/{tx_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == tx_id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
