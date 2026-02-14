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
    <div className="min-h-screen bg-black overflow-x-hidden">
      <Header />
      <WalletModal />

      <main className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero */}
          <section className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-3 sm:mb-4">
              <span className="text-[#C1FF72]">Swap</span>
            </h1>
            <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-xl mx-auto px-4">
              Swap tokens across multiple chains with LI.FI
            </p>
          </section>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 max-w-5xl mx-auto" id="swap">
            <div className="lg:col-span-1">
              <SwapCard onTransactionComplete={handleTransactionComplete} />
            </div>
            <div className="lg:col-span-1">
              <TransactionHistory refreshTrigger={txRefreshTrigger} />
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-12 sm:mt-16 text-center">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-500">
              <a href="https://docs.li.fi" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Docs
              </a>
            </div>
            <p className="text-gray-600 text-[10px] sm:text-xs mt-4">© 2024 Swap</p>
          </footer>
        </div>
      </main>

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
