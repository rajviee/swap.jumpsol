import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { Search, X, Check } from 'lucide-react';
import { CHAIN_INFO, POPULAR_CHAIN_IDS, formatTokenAmount } from '../hooks/useLifi';

export const TokenSelectModal = ({
  open,
  onClose,
  onSelect,
  tokens = {},
  chains = [],
  selectedChainId,
  selectedToken,
  title = 'Select Token',
  loading = false,
  walletBalances = {},
}) => {
  const [search, setSearch] = useState('');
  const [activeChainId, setActiveChainId] = useState(selectedChainId);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveChainId(selectedChainId || (chains[0]?.id));
    }
  }, [open, selectedChainId, chains]);

  // Get popular chains first
  const sortedChains = useMemo(() => {
    const popular = chains.filter(c => POPULAR_CHAIN_IDS.includes(c.id));
    const others = chains.filter(c => !POPULAR_CHAIN_IDS.includes(c.id));
    return [...popular, ...others];
  }, [chains]);

  // Get tokens for active chain
  const chainTokens = useMemo(() => {
    const tokenList = tokens[activeChainId] || [];
    
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      return tokenList.filter(t => 
        t.symbol?.toLowerCase().includes(searchLower) ||
        t.name?.toLowerCase().includes(searchLower) ||
        t.address?.toLowerCase() === searchLower
      );
    }
    
    return tokenList;
  }, [tokens, activeChainId, search]);

  // Sort tokens by balance then alphabetically
  const sortedTokens = useMemo(() => {
    return [...chainTokens].sort((a, b) => {
      const balanceA = walletBalances[a.address] || 0;
      const balanceB = walletBalances[b.address] || 0;
      if (balanceB !== balanceA) return balanceB - balanceA;
      return (a.symbol || '').localeCompare(b.symbol || '');
    });
  }, [chainTokens, walletBalances]);

  const handleSelectToken = (token) => {
    onSelect({
      ...token,
      chainId: activeChainId,
    });
    onClose();
  };

  const getChainInfo = (chainId) => {
    return CHAIN_INFO[chainId] || { name: `Chain ${chainId}`, symbol: '?', color: '#666' };
  };

  const isTokenSelected = (token) => {
    return selectedToken?.address?.toLowerCase() === token.address?.toLowerCase() &&
           selectedToken?.chainId === activeChainId;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] bg-[#0a0a0a] border-white/20 rounded-[10px] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0 border-b border-white/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-white">
              {title}
            </DialogTitle>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-[10px] flex items-center justify-center hover:bg-white/5 transition-colors"
              data-testid="close-token-modal"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mt-4 mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or paste address"
              className="h-11 pl-10 bg-[#111] border-none rounded-[10px] text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-[#C1FF72]"
              data-testid="token-search-input"
            />
          </div>

          {/* Chain Filter */}
          <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-hide">
            {sortedChains.slice(0, 7).map((chain) => {
              const info = getChainInfo(chain.id);
              const isActive = activeChainId === chain.id;
              return (
                <button
                  key={chain.id}
                  onClick={() => setActiveChainId(chain.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive 
                      ? 'bg-[#C1FF72] text-black' 
                      : 'bg-[#111] text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                  }`}
                  data-testid={`chain-filter-${chain.id}`}
                >
                  <div 
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                    style={{ backgroundColor: info.color }}
                  >
                    {info.symbol.charAt(0)}
                  </div>
                  {chain.name}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Token List */}
        <ScrollArea className="h-[400px]">
          <div className="p-2">
            {loading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-10 h-10 rounded-full bg-[#222]" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-20 mb-1 bg-[#222]" />
                    <Skeleton className="h-3 w-32 bg-[#222]" />
                  </div>
                  <Skeleton className="h-4 w-16 bg-[#222]" />
                </div>
              ))
            ) : sortedTokens.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Search className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No tokens found</p>
                <p className="text-xs mt-1">Try a different search or chain</p>
              </div>
            ) : (
              // Token list
              sortedTokens.map((token) => {
                const balance = walletBalances[token.address];
                const isSelected = isTokenSelected(token);
                
                return (
                  <button
                    key={`${activeChainId}-${token.address}`}
                    onClick={() => handleSelectToken(token)}
                    className={`w-full flex items-center gap-3 p-3 rounded-[10px] token-row ${
                      isSelected ? 'bg-[#C1FF72]/10 border border-[#C1FF72]/30' : ''
                    }`}
                    data-testid={`token-option-${token.symbol}`}
                  >
                    {/* Token Icon */}
                    <div className="relative">
                      {token.logoURI ? (
                        <img 
                          src={token.logoURI} 
                          alt={token.symbol}
                          className="w-10 h-10 rounded-full bg-[#222]"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '';
                            e.target.className = 'w-10 h-10 rounded-full bg-[#222] flex items-center justify-center text-white font-bold text-sm';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#222] flex items-center justify-center text-white font-bold text-sm">
                          {token.symbol?.charAt(0) || '?'}
                        </div>
                      )}
                      {/* Chain indicator */}
                      <div 
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0a0a0a] text-[6px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: getChainInfo(activeChainId).color }}
                      >
                        {getChainInfo(activeChainId).symbol.charAt(0)}
                      </div>
                    </div>

                    {/* Token Info */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{token.symbol}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#C1FF72]" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{token.name}</span>
                    </div>

                    {/* Balance */}
                    <div className="text-right">
                      {balance !== undefined && (
                        <>
                          <div className="text-sm font-mono text-white">
                            {formatTokenAmount(balance, token.decimals, 4)}
                          </div>
                          <div className="text-xs text-gray-500">Balance</div>
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
