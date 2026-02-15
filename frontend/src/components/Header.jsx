import { useWalletStore, SOLANA_CHAIN_ID, TRON_CHAIN_ID } from '../store/walletStore';
import { Button } from './ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Switch } from './ui/switch';
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Globe, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { memo, useCallback, useState } from 'react';
import { CHAIN_INFO } from '../hooks/useLifi';

export const Header = memo(() => {
  const { 
    evmConnected, 
    evmAddress, 
    evmChainId,
    evmWalletType,
    solanaConnected,
    solanaAddress,
    tronConnected,
    tronAddress,
    setShowWalletModal,
    disconnectEvm,
    disconnectSolana,
    disconnectTron,
    activeWalletType,
    environment,
    toggleEnvironment,
  } = useWalletStore();

  const isConnected = evmConnected || solanaConnected || tronConnected;
  
  const address = (() => {
    if (activeWalletType === 'tron') return tronAddress;
    if (activeWalletType === 'solana') return solanaAddress;
    return evmAddress || solanaAddress || tronAddress;
  })();
  
  const truncateAddress = useCallback((addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, []);

  const copyAddress = useCallback(() => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied');
    }
  }, [address]);

  const getExplorerUrl = useCallback(() => {
    if (activeWalletType === 'tron' || (!evmConnected && !solanaConnected && tronConnected)) {
      return `https://tronscan.org/#/address/${tronAddress}`;
    }
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
      8453: 'https://basescan.org/address/',
    };
    return `${explorers[evmChainId] || explorers[1]}${evmAddress}`;
  }, [activeWalletType, evmConnected, solanaConnected, tronConnected, solanaAddress, tronAddress, evmChainId, evmAddress]);

  const handleDisconnect = useCallback(() => {
    if (evmConnected) disconnectEvm();
    if (solanaConnected) disconnectSolana();
    if (tronConnected) disconnectTron();
    toast.success('Wallet disconnected');
  }, [evmConnected, solanaConnected, tronConnected, disconnectEvm, disconnectSolana, disconnectTron]);

  const getWalletType = useCallback(() => {
    if (activeWalletType === 'tron') return 'TronLink';
    if (activeWalletType === 'solana') return 'Phantom';
    if (evmWalletType === 'trustwallet') return 'Trust Wallet';
    if (evmConnected) return 'MetaMask';
    return '';
  }, [activeWalletType, evmWalletType, evmConnected]);

  const getChainName = useCallback(() => {
    if (activeWalletType === 'tron') return 'Tron';
    if (activeWalletType === 'solana') return 'Solana';
    return CHAIN_INFO[evmChainId]?.name || 'Unknown';
  }, [activeWalletType, evmChainId]);

  const getChainLogo = useCallback(() => {
    if (activeWalletType === 'tron') return CHAIN_INFO[TRON_CHAIN_ID]?.logoURI;
    if (activeWalletType === 'solana') return CHAIN_INFO[SOLANA_CHAIN_ID]?.logoURI;
    return CHAIN_INFO[evmChainId]?.logoURI;
  }, [activeWalletType, evmChainId]);

  const [logoError, setLogoError] = useState(false);

  return (
    <header className="glass-header fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-[10px] bg-[#C1FF72] flex items-center justify-center">
              <span className="text-black font-black text-sm sm:text-lg">X</span>
            </div>
            <span className="font-bold text-lg sm:text-xl text-white hidden sm:block">
              Swap
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#swap" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              Swap
            </a>
            <a href="#history" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              History
            </a>
          </nav>

          {/* Wallet Connection */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isConnected ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="h-9 sm:h-10 px-2 sm:px-4 rounded-[10px] border-white/20 bg-transparent hover:bg-white/5 text-white gap-1 sm:gap-2"
                    data-testid="wallet-menu-trigger"
                  >
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#C1FF72] flex items-center justify-center overflow-hidden">
                      {getChainLogo() && !logoError ? (
                        <img src={getChainLogo()} alt="" className="w-full h-full" onError={() => setLogoError(true)} />
                      ) : (
                        <Wallet className="w-3 h-3 text-black" />
                      )}
                    </div>
                    <span className="hidden sm:block font-mono text-xs sm:text-sm">
                      {truncateAddress(address)}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-52 sm:w-56 bg-[#0a0a0a] border-white/20 rounded-[10px]"
                >
                  <DropdownMenuLabel className="text-gray-400 font-normal">
                    <div className="flex flex-col gap-1">
                      <span className="text-white font-medium text-sm">{getWalletType()}</span>
                      <div className="flex items-center gap-1.5">
                        {getChainLogo() && !logoError && (
                          <img src={getChainLogo()} alt="" className="w-3 h-3 rounded-full" onError={() => setLogoError(true)} />
                        )}
                        <span className="text-xs text-[#C1FF72]">{getChainName()}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem 
                    onClick={copyAddress}
                    className="cursor-pointer hover:bg-white/5 text-gray-300 focus:bg-white/5 focus:text-white text-sm"
                    data-testid="copy-address-btn"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => window.open(getExplorerUrl(), '_blank')}
                    className="cursor-pointer hover:bg-white/5 text-gray-300 focus:bg-white/5 focus:text-white text-sm"
                    data-testid="view-explorer-btn"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Explorer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem 
                    onClick={handleDisconnect}
                    className="cursor-pointer hover:bg-white/5 text-[#E74C3C] focus:bg-white/5 focus:text-[#E74C3C] text-sm"
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
                className="h-9 sm:h-10 px-3 sm:px-6 rounded-[10px] bg-[#C1FF72] text-black font-bold text-sm hover:opacity-90 transition-opacity"
                data-testid="connect-wallet-btn"
              >
                <Wallet className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Connect</span>
                <span className="sm:hidden">Connect</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
