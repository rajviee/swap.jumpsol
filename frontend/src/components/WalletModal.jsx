import { useState, useCallback, memo } from 'react';
import { useWalletStore } from '../store/walletStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Loader2, AlertCircle, Wallet } from 'lucide-react';
import { toast } from 'sonner';

const WalletBtn = memo(({ name, desc, logo, onClick, loading, disabled, testId }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    variant="ghost"
    className="w-full h-14 rounded-lg bg-[#111] border border-white/10 hover:border-white/30 hover:bg-[#1a1a1a] text-white justify-start gap-3"
    data-testid={testId}
  >
    {loading ? (
      <Loader2 className="w-7 h-7 animate-spin" />
    ) : logo ? (
      <img src={logo} alt={name} className="w-7 h-7 rounded-lg" onError={(e) => e.target.style.display = 'none'} />
    ) : (
      <div className="w-7 h-7 rounded-lg bg-[#333] flex items-center justify-center">
        <Wallet className="w-4 h-4" />
      </div>
    )}
    <div className="text-left">
      <div className="font-semibold text-sm">{name}</div>
      <div className="text-xs text-gray-500">{desc}</div>
    </div>
  </Button>
));
WalletBtn.displayName = 'WalletBtn';

export const WalletModal = memo(() => {
  const { showWalletModal, setShowWalletModal, connectMetaMask, connectTrustWallet, connectPhantom, connectTron, evmConnecting, solanaConnecting, tronConnecting } = useWalletStore();
  const [error, setError] = useState(null);

  const connect = useCallback(async (fn, name) => {
    setError(null);
    try {
      await fn();
      toast.success(`${name} connected`);
      setShowWalletModal(false);
    } catch (err) {
      if (err.code === 4001) setError('Connection rejected');
      else setError(err.message || `Failed to connect ${name}`);
    }
  }, [setShowWalletModal]);

  const busy = evmConnecting || solanaConnecting || tronConnecting;

  return (
    <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
      <DialogContent className="w-[95vw] max-w-[380px] bg-[#0a0a0a] border-white/20 rounded-xl p-0">
        <DialogHeader className="p-4 sm:p-5 pb-0">
          <DialogTitle className="text-lg font-bold text-white">Connect Wallet</DialogTitle>
          <p className="text-xs text-gray-400 mt-1">Choose your wallet</p>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-2">
          {error && (
            <div className="flex items-start gap-2 p-2.5 bg-[#E74C3C]/10 border border-[#E74C3C]/20 rounded-lg text-xs text-[#E74C3C]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <WalletBtn
            name="MetaMask"
            desc="EVM chains"
            logo="https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/SVG_MetaMask_Icon_Color.svg"
            onClick={() => connect(connectMetaMask, 'MetaMask')}
            loading={evmConnecting}
            disabled={busy}
            testId="metamask-btn"
          />
          
          <WalletBtn
            name="Trust Wallet"
            desc="Multi-chain"
            logo="https://trustwallet.com/assets/images/media/assets/TWT.svg"
            onClick={() => connect(connectTrustWallet, 'Trust Wallet')}
            loading={evmConnecting}
            disabled={busy}
            testId="trust-btn"
          />
          
          <WalletBtn
            name="Phantom"
            desc="Solana"
            logo="https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/solana.svg"
            onClick={() => connect(connectPhantom, 'Phantom')}
            loading={solanaConnecting}
            disabled={busy}
            testId="phantom-btn"
          />
          
          <WalletBtn
            name="TronLink"
            desc="Tron"
            logo="https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png"
            onClick={() => connect(connectTron, 'TronLink')}
            loading={tronConnecting}
            disabled={busy}
            testId="tron-btn"
          />
          
          <p className="text-[10px] text-gray-600 text-center pt-2">
            By connecting, you agree to our Terms
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
});
WalletModal.displayName = 'WalletModal';
