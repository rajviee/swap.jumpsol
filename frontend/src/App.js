import { useState, useCallback } from 'react';
import '@/App.css';
import { Header } from './components/Header';
import { WalletModal } from './components/WalletModal';
import { SwapCard } from './components/SwapCard';
import { TransactionHistory } from './components/TransactionHistory';
import { Toaster } from './components/ui/sonner';

function App() {
  const [txRefreshTrigger, setTxRefreshTrigger] = useState(0);

  const handleTransactionComplete = useCallback(() => {
    setTxRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <Header />
      
      {/* Wallet Connection Modal */}
      <WalletModal />

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <section className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Cross-Chain <span className="text-[#C1FF72]">Swap</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Swap tokens across multiple chains with the best rates powered by LI.FI
            </p>
          </section>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto" id="swap">
            {/* Swap Card */}
            <div className="lg:col-span-1">
              <SwapCard onTransactionComplete={handleTransactionComplete} />
            </div>

            {/* Transaction History */}
            <div className="lg:col-span-1">
              <TransactionHistory refreshTrigger={txRefreshTrigger} />
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-16 text-center">
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
              <a 
                href="https://li.fi" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Powered by LI.FI
              </a>
              <span>•</span>
              <a 
                href="https://docs.li.fi" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Documentation
              </a>
            </div>
            <p className="text-gray-600 text-xs mt-4">
              © 2024 CrossSwap. All rights reserved.
            </p>
          </footer>
        </div>
      </main>

      {/* Toast Notifications */}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
          },
          className: 'rounded-[10px]',
        }}
      />
    </div>
  );
}

export default App;
