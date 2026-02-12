import { useWalletStore, SOLANA_CHAIN_ID } from '../store/walletStore';
import { Button } from './ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { memo, useCallback } from 'react';
import { CHAIN_INFO } from '../hooks/useLifi';

export const Header = memo(() => {
  const { 
    evmConnected, 
    evmAddress, 
    evmChainId,
    solanaConnected,
    solanaAddress,
    setShowWalletModal,
    disconnectEvm,
    disconnectSolana,
    activeWalletType,
  } = useWalletStore();

  const isConnected = evmConnected || solanaConnected;
  const address = activeWalletType === 'solana' ? solanaAddress : (evmAddress || solanaAddress);
  
  const truncateAddress = useCallback((addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, []);

  const copyAddress = useCallback(() => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard');
    }
  }, [address]);

  const getExplorerUrl = useCallback(() => {
    if (activeWalletType === 'solana' || (!evmConnected && solanaConnected)) {
      return `https://solscan.io/account/${solanaAddress}`;
    }
    const explorers = {
      1: 'https://etherscan.io/address/',
      42161: 'https://arbiscan.io/address/',
      10: 'https://optimistic.etherscan.io/address/',
      137: 'https://polygonscan.com/address/',
      56: 'https://bscscan.com/address/',
      43114: 'https://snowtrace.io/address/',
    };
    return `${explorers[evmChainId] || explorers[1]}${evmAddress}`;
  }, [activeWalletType, evmConnected, solanaConnected, solanaAddress, evmChainId, evmAddress]);

  const handleDisconnect = useCallback(() => {
    if (evmConnected) disconnectEvm();
    if (solanaConnected) disconnectSolana();
    toast.success('Wallet disconnected');
  }, [evmConnected, solanaConnected, disconnectEvm, disconnectSolana]);

  const getWalletType = useCallback(() => {
    if (activeWalletType === 'solana' || (!evmConnected && solanaConnected)) return 'Phantom';
    if (evmConnected) return 'MetaMask';
    return '';
  }, [activeWalletType, evmConnected, solanaConnected]);

  const getChainName = useCallback(() => {
    if (activeWalletType === 'solana' || (!evmConnected && solanaConnected)) {
      return 'Solana';
    }
    return CHAIN_INFO[evmChainId]?.name || 'Unknown';
  }, [activeWalletType, evmConnected, solanaConnected, evmChainId]);

  const getChainLogo = useCallback(() => {
    if (activeWalletType === 'solana' || (!evmConnected && solanaConnected)) {
      return CHAIN_INFO[SOLANA_CHAIN_ID]?.logoURI;
    }
    return CHAIN_INFO[evmChainId]?.logoURI;
  }, [activeWalletType, evmConnected, solanaConnected, evmChainId]);

  return (
    <header className="glass-header fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#C1FF72] flex items-center justify-center">
              <span className="text-black font-black text-lg">X</span>
            </div>
            <span className="font-bold text-xl text-white hidden sm:block">
              CrossSwap
            </span>
          </div>

          {/* Navigation - Hidden on mobile */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#swap" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              Swap
            </a>
            <a href="#history" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              History
            </a>
          </nav>

          {/* Wallet Connection */}
          <div className="flex items-center gap-3">
            {isConnected ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="h-10 px-4 rounded-[10px] border-white/20 bg-transparent hover:bg-white/5 text-white gap-2"
                    data-testid="wallet-menu-trigger"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#C1FF72] flex items-center justify-center overflow-hidden">
                      {getChainLogo() ? (
                        <img src={getChainLogo()} alt="" className="w-full h-full" />
                      ) : (
                        <Wallet className="w-3 h-3 text-black" />
                      )}
                    </div>
                    <span className="hidden sm:block font-mono text-sm">
                      {truncateAddress(address)}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56 bg-[#0a0a0a] border-white/20 rounded-[10px]"
                >
                  <DropdownMenuLabel className="text-gray-400 font-normal">
                    <div className="flex flex-col gap-1">
                      <span className="text-white font-medium">{getWalletType()}</span>
                      <div className="flex items-center gap-1.5">
                        {getChainLogo() && (
                          <img src={getChainLogo()} alt="" className="w-3 h-3 rounded-full" />
                        )}
                        <span className="text-xs text-[#C1FF72]">{getChainName()}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem 
                    onClick={copyAddress}
                    className="cursor-pointer hover:bg-white/5 text-gray-300 focus:bg-white/5 focus:text-white"
                    data-testid="copy-address-btn"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => window.open(getExplorerUrl(), '_blank')}
                    className="cursor-pointer hover:bg-white/5 text-gray-300 focus:bg-white/5 focus:text-white"
                    data-testid="view-explorer-btn"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View in Explorer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem 
                    onClick={handleDisconnect}
                    className="cursor-pointer hover:bg-white/5 text-[#E74C3C] focus:bg-white/5 focus:text-[#E74C3C]"
                    data-testid="disconnect-wallet-btn"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                onClick={() => setShowWalletModal(true)}
                className="h-10 px-6 rounded-[10px] bg-[#C1FF72] text-black font-bold hover:opacity-90 transition-opacity"
                data-testid="connect-wallet-btn"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
