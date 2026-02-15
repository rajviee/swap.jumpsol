import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class LiFiAPITester:
    def __init__(self, base_url="https://rhinolifi-bridge.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, params: Optional[Dict] = None) -> tuple[bool, Any]:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            response_json = {}
            
            try:
                response_json = response.json()
            except:
                response_json = {"raw_response": response.text}

            if success:
                self.log_test(name, True, f"Status: {response.status_code}", response_json)
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}. Response: {response.text[:200]}", response_json)

            return success, response_json

        except requests.exceptions.Timeout:
            self.log_test(name, False, "Request timeout (30s)")
            return False, {}
        except requests.exceptions.ConnectionError:
            self.log_test(name, False, "Connection error - server may be down")
            return False, {}
        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        return success

    def test_lifi_chains(self):
        """Test LI.FI chains endpoint"""
        success, response = self.run_test(
            "LI.FI Chains",
            "GET", 
            "api/lifi/chains",
            200
        )
        
        if success and response:
            chains = response.get('chains', [])
            if chains:
                print(f"   Found {len(chains)} chains")
                # Check if popular chains are present
                chain_ids = [chain.get('id') for chain in chains]
                popular_chains = [1, 137, 42161, 10, 56]  # ETH, Polygon, Arbitrum, Optimism, BSC
                found_popular = [cid for cid in popular_chains if cid in chain_ids]
                print(f"   Popular chains found: {found_popular}")
            else:
                self.log_test("LI.FI Chains - Data Validation", False, "No chains data in response")
                
        return success

    def test_lifi_tokens(self):
        """Test LI.FI tokens endpoint"""
        # Test without chain filter
        success1, response1 = self.run_test(
            "LI.FI Tokens (All)",
            "GET",
            "api/lifi/tokens",
            200
        )
        
        # Test with chain filter
        success2, response2 = self.run_test(
            "LI.FI Tokens (Ethereum)",
            "GET",
            "api/lifi/tokens",
            200,
            params={"chains": "1"}
        )
        
        if success1 and response1:
            tokens = response1.get('tokens', {})
            if tokens:
                total_tokens = sum(len(chain_tokens) for chain_tokens in tokens.values())
                print(f"   Found tokens across {len(tokens)} chains, total: {total_tokens}")
            else:
                self.log_test("LI.FI Tokens - Data Validation", False, "No tokens data in response")
                
        return success1 and success2

    def test_lifi_quote(self):
        """Test LI.FI quote endpoint"""
        # Test quote for ETH to USDC on Ethereum
        quote_params = {
            "fromChain": 1,
            "toChain": 1, 
            "fromToken": "0x0000000000000000000000000000000000000000",  # ETH
            "toToken": "0xA0b86a33E6441c8C06DD2b7c94b7E0e8c0c8c8c8",  # USDC (example)
            "fromAmount": "1000000000000000000",  # 1 ETH in wei
            "fromAddress": "0x742d35Cc6634C0532925a3b8D4C9db96c4b4c8c8",  # Example address
            "slippage": 0.03
        }
        
        success, response = self.run_test(
            "LI.FI Quote",
            "GET",
            "api/lifi/quote",
            200,
            params=quote_params
        )
        
        if success and response:
            if 'estimate' in response:
                print(f"   Quote received with estimate data")
            else:
                self.log_test("LI.FI Quote - Data Validation", False, "No estimate in quote response")
                
        return success

    def test_transaction_crud(self):
        """Test transaction CRUD operations"""
        # Create transaction
        tx_data = {
            "wallet_address": "0x742d35Cc6634C0532925a3b8D4C9db96c4b4c8c8",
            "from_chain_id": 1,
            "to_chain_id": 137,
            "from_token_address": "0x0000000000000000000000000000000000000000",
            "to_token_address": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
            "from_token_symbol": "ETH",
            "to_token_symbol": "USDC",
            "from_amount": "1000000000000000000",
            "to_amount": "1800000000",
            "from_amount_usd": "1800.00",
            "to_amount_usd": "1800.00",
            "status": "pending",
            "tx_type": "bridge",
            "route_provider": "LI.FI"
        }
        
        # Create
        success1, create_response = self.run_test(
            "Create Transaction",
            "POST",
            "api/transactions",
            200,
            data=tx_data
        )
        
        if not success1:
            return False
            
        tx_id = create_response.get('id')
        if not tx_id:
            self.log_test("Create Transaction - ID Check", False, "No transaction ID in response")
            return False
            
        print(f"   Created transaction with ID: {tx_id}")
        
        # Get single transaction
        success2, get_response = self.run_test(
            "Get Single Transaction",
            "GET",
            f"api/transactions/{tx_id}",
            200
        )
        
        # Get transactions list
        success3, list_response = self.run_test(
            "Get Transactions List",
            "GET",
            "api/transactions",
            200,
            params={"wallet_address": tx_data["wallet_address"]}
        )
        
        # Update transaction
        update_data = {
            "status": "success",
            "tx_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        }
        
        success4, update_response = self.run_test(
            "Update Transaction",
            "PATCH",
            f"api/transactions/{tx_id}",
            200,
            data=update_data
        )
        
        if success3 and list_response:
            transactions = list_response if isinstance(list_response, list) else []
            print(f"   Found {len(transactions)} transactions for wallet")
            
        return success1 and success2 and success3 and success4

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting LI.FI Cross-Chain Swap API Tests")
        print("=" * 60)
        
        # Test health check first
        if not self.test_health_check():
            print("\n❌ Health check failed - server may be down")
            return False
            
        # Test LI.FI API endpoints
        self.test_lifi_chains()
        self.test_lifi_tokens()
        
        # Note: Quote test may fail if LI.FI API requires valid tokens
        # This is expected in testing environment
        self.test_lifi_quote()
        
        # Test transaction CRUD
        self.test_transaction_crud()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = LiFiAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_results.json', 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0,
            "results": tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())