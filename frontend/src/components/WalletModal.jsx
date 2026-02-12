import { useState, useCallback, memo } from 'react';
import { useWalletStore } from '../store/walletStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Loader2, AlertCircle, Wallet } from 'lucide-react';
import { toast } from 'sonner';

const WalletOption = memo(({ 
  name, 
  description, 
  logoUrl, 
  onClick, 
  isConnecting, 
  disabled,
  testId 
}) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    className="w-full h-14 rounded-[10px] bg-[#111] border border-white/10 hover:border-white/30 hover:bg-[#1a1a1a] text-white justify-start gap-4 transition-colors"
    variant="ghost"
    data-testid={testId}
  >
    {isConnecting ? (
      <Loader2 className="w-8 h-8 animate-spin" />
    ) : logoUrl ? (
      <img src={logoUrl} alt={name} className="w-8 h-8 rounded-lg" onError={(e) => { e.target.style.display = 'none'; }} />
    ) : (
      <div className="w-8 h-8 rounded-lg bg-[#333] flex items-center justify-center">
        <Wallet className="w-5 h-5 text-white" />
      </div>
    )}
    <div className="flex flex-col items-start">
      <span className="font-semibold text-sm sm:text-base">{name}</span>
      <span className="text-xs text-gray-500">{description}</span>
    </div>
  </Button>
));

WalletOption.displayName = 'WalletOption';

export const WalletModal = memo(() => {
  const { 
    showWalletModal, 
    setShowWalletModal,
    connectMetaMask,
    connectTrustWallet,
    connectPhantom,
    connectTron,
    evmConnecting,
    solanaConnecting,
    tronConnecting,
  } = useWalletStore();

  const [error, setError] = useState(null);

  const handleConnect = useCallback(async (connectFn, walletName) => {
    setError(null);
    try {
      await connectFn();
      toast.success(`${walletName} connected successfully`);
      setShowWalletModal(false);
    } catch (err) {
      console.error(`${walletName} connection error:`, err);
      if (err.code === 4001) {
        setError('Connection rejected. Please try again.');
      } else if (err.message?.includes('not installed')) {
        setError(err.message);
      } else {
        setError(err.message || `Failed to connect ${walletName}`);
      }
    }
  }, [setShowWalletModal]);

  const isConnecting = evmConnecting || solanaConnecting || tronConnecting;

  return (
    <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
      <DialogContent className="w-[95vw] max-w-[400px] bg-[#0a0a0a] border-white/20 rounded-[10px] p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-0">
          <DialogTitle className="text-lg sm:text-xl font-bold text-white">
            Connect Wallet
          </DialogTitle>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            Choose your preferred wallet
          </p>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-[#E74C3C]/10 border border-[#E74C3C]/20 rounded-[10px] text-[#E74C3C] text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* MetaMask */}
          <WalletOption
            name="MetaMask"
            description="Popular browser wallet"
            logoUrl="https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/SVG_MetaMask_Icon_Color.svg"
            onClick={() => handleConnect(connectMetaMask, 'MetaMask')}
            isConnecting={evmConnecting}
            disabled={isConnecting}
            testId="metamask-connect-btn"
          />

          {/* Trust Wallet */}
          <WalletOption
            name="Trust Wallet"
            description="Multi-chain mobile wallet"
            logoUrl="https://trustwallet.com/assets/images/media/assets/TWT.svg"
            onClick={() => handleConnect(connectTrustWallet, 'Trust Wallet')}
            isConnecting={evmConnecting}
            disabled={isConnecting}
            testId="trustwallet-connect-btn"
          />

          {/* Phantom */}
          <WalletOption
            name="Phantom"
            description="Solana wallet"
            logoUrl="https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/solana.svg"
            onClick={() => handleConnect(connectPhantom, 'Phantom')}
            isConnecting={solanaConnecting}
            disabled={isConnecting}
            testId="phantom-connect-btn"
          />

          {/* TronLink */}
          <WalletOption
            name="TronLink"
            description="Tron wallet"
            logoUrl="https://cryptologos.cc/logos/tron-trx-logo.svg"
            onClick={() => handleConnect(connectTron, 'TronLink')}
            isConnecting={tronConnecting}
            disabled={isConnecting}
            testId="tronlink-connect-btn"
          />

          <p className="text-[10px] sm:text-xs text-gray-500 text-center pt-2">
            By connecting, you agree to our Terms of Service
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
});

WalletModal.displayName = 'WalletModal';
