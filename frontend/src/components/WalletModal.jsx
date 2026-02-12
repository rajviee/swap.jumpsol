import { useState } from 'react';
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
import { SiEthereum } from 'react-icons/si';

export const WalletModal = () => {
  const { 
    showWalletModal, 
    setShowWalletModal,
    connectMetaMask,
    connectPhantom,
    evmConnecting,
    solanaConnecting,
  } = useWalletStore();

  const [error, setError] = useState(null);

  const handleMetaMaskConnect = async () => {
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
  };

  const handlePhantomConnect = async () => {
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
  };

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
              <div className="w-8 h-8 rounded-full bg-[#F6851B] flex items-center justify-center">
                <SiEthereum className="w-5 h-5 text-white" />
              </div>
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#AB9FF2] to-[#534BB1] flex items-center justify-center">
                <svg viewBox="0 0 128 128" className="w-5 h-5">
                  <path
                    fill="white"
                    d="M110.584 77.897c-2.762-1.584-6.356-0.633-8.025 2.123l-0.002 0.003c-0.033 0.054-0.065 0.108-0.097 0.163-5.044 8.58-11.549 12.085-19.926 12.085-12.202 0-17.954-8.326-17.954-17.951 0-16.165 12.876-29.361 28.671-29.361 7.379 0 14.163 2.861 19.134 7.598 2.309 2.201 5.971 2.097 8.172-0.212 2.201-2.309 2.097-5.971-0.212-8.172-7.195-6.856-16.957-11.014-27.094-11.014-22.859 0-40.471 18.612-40.471 42.161 0 19.177 12.927 29.751 29.754 29.751 13.569 0 22.879-6.167 30.089-18.539 1.67-2.869 0.701-6.548-2.039-8.635z"
                  />
                </svg>
              </div>
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
};
