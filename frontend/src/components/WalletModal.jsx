import { useState, useCallback, memo } from 'react';
import { useWalletStore } from '../store/walletStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const WalletModal = memo(() => {
  const { 
    showWalletModal, 
    setShowWalletModal,
    connectMetaMask,
    connectPhantom,
    evmConnecting,
    solanaConnecting,
  } = useWalletStore();

  const [error, setError] = useState(null);

  const handleMetaMaskConnect = useCallback(async () => {
    setError(null);
    try {
      await connectMetaMask();
      toast.success('MetaMask connected successfully');
      setShowWalletModal(false);
    } catch (err) {
      console.error('MetaMask connection error:', err);
      if (err.code === 4001) {
        setError('Connection rejected. Please try again.');
      } else if (err.message?.includes('not installed')) {
        setError('MetaMask is not installed. Please install it first.');
      } else {
        setError(err.message || 'Failed to connect MetaMask');
      }
    }
  }, [connectMetaMask, setShowWalletModal]);

  const handlePhantomConnect = useCallback(async () => {
    setError(null);
    try {
      await connectPhantom();
      toast.success('Phantom connected successfully');
      setShowWalletModal(false);
    } catch (err) {
      console.error('Phantom connection error:', err);
      if (err.code === 4001) {
        setError('Connection rejected. Please try again.');
      } else if (err.message?.includes('not installed')) {
        setError('Phantom wallet is not installed. Please install it first.');
      } else {
        setError(err.message || 'Failed to connect Phantom');
      }
    }
  }, [connectPhantom, setShowWalletModal]);

  const isConnecting = evmConnecting || solanaConnecting;

  return (
    <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
      <DialogContent className="sm:max-w-[400px] bg-[#0a0a0a] border-white/20 rounded-[10px] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold text-white">
            Connect Wallet
          </DialogTitle>
          <p className="text-sm text-gray-400 mt-2">
            Choose your preferred wallet to connect
          </p>
        </DialogHeader>

        <div className="p-6 space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-[#E74C3C]/10 border border-[#E74C3C]/20 rounded-[10px] text-[#E74C3C] text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* MetaMask */}
          <Button
            onClick={handleMetaMaskConnect}
            disabled={isConnecting}
            className="w-full h-14 rounded-[10px] bg-[#111] border border-white/10 hover:border-white/30 hover:bg-[#1a1a1a] text-white justify-start gap-4 transition-colors"
            variant="ghost"
            data-testid="metamask-connect-btn"
          >
            {evmConnecting ? (
              <Loader2 className="w-8 h-8 animate-spin text-[#F6851B]" />
            ) : (
              <img 
                src="https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/SVG_MetaMask_Icon_Color.svg"
                alt="MetaMask"
                className="w-8 h-8"
              />
            )}
            <div className="flex flex-col items-start">
              <span className="font-semibold">MetaMask</span>
              <span className="text-xs text-gray-500">EVM Chains</span>
            </div>
          </Button>

          {/* Phantom */}
          <Button
            onClick={handlePhantomConnect}
            disabled={isConnecting}
            className="w-full h-14 rounded-[10px] bg-[#111] border border-white/10 hover:border-white/30 hover:bg-[#1a1a1a] text-white justify-start gap-4 transition-colors"
            variant="ghost"
            data-testid="phantom-connect-btn"
          >
            {solanaConnecting ? (
              <Loader2 className="w-8 h-8 animate-spin text-[#AB9FF2]" />
            ) : (
              <img 
                src="https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/solana.svg"
                alt="Phantom"
                className="w-8 h-8"
              />
            )}
            <div className="flex flex-col items-start">
              <span className="font-semibold">Phantom</span>
              <span className="text-xs text-gray-500">Solana</span>
            </div>
          </Button>

          <p className="text-xs text-gray-500 text-center pt-2">
            By connecting a wallet, you agree to our Terms of Service
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
});

WalletModal.displayName = 'WalletModal';
