import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { Search, X, ChevronRight } from 'lucide-react';
import { CHAIN_INFO, PRIORITY_CHAINS, FALLBACK_TOKENS, isSwapSupported, formatTokenAmount, SOLANA_CHAIN_ID, TRON_CHAIN_ID, BITCOIN_CHAIN_ID } from '../hooks/useLifi';

// Token Row - displays token with balance
const TokenRow = memo(({ token, chainId, isSelected, onSelect, chainInfo }) => {
  const [imgErr, setImgErr] = useState(false);
  const logo = token.logoURI || token.logo;
  
  return (
    <button
      onClick={() => onSelect(token)}
      className={`w-full flex items-center gap-3 p-3 sm:p-4 rounded-xl transition-colors ${
        isSelected ? 'bg-[#C1FF72]/15 ring-1 ring-[#C1FF72]/40' : 'hover:bg-white/5'
      }`}
      data-testid={`token-${token.symbol}`}
    >
      <div className="relative flex-shrink-0">
        {logo && !imgErr ? (
          <img src={logo} alt="" className="w-10 h-10 rounded-full bg-[#222]" onError={() => setImgErr(true)} loading="lazy" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center text-white font-bold text-sm">
            {token.symbol?.[0] || '?'}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="font-bold text-white text-base">{token.symbol}</div>
        <div className="text-sm text-gray-400">{token.name || chainInfo?.name || ''}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <span className="text-base text-gray-400">0 {token.symbol}</span>
      </div>
    </button>
  );
});
TokenRow.displayName = 'TokenRow';

// Chain Icon Button
const ChainIcon = memo(({ chain, active, onClick, info }) => {
  const [imgErr, setImgErr] = useState(false);
  
  return (
    <button
      onClick={onClick}
      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
        active 
          ? 'bg-[#C1FF72] ring-2 ring-[#C1FF72]' 
          : 'bg-[#1a1a1a] border border-white/10 hover:border-white/30'
      }`}
      data-testid={`chain-icon-${chain.id}`}
      title={chain.name}
    >
      {info?.logo && !imgErr ? (
        <img 
          src={info.logo} 
          alt={chain.name} 
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${active ? '' : ''}`}
          onError={() => setImgErr(true)} 
        />
      ) : (
        <div 
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" 
          style={{ background: info?.color || '#666' }} 
        />
      )}
    </button>
  );
});
ChainIcon.displayName = 'ChainIcon';

// View All Chains - inline overlay (not a nested Dialog)
const ViewAllChainsOverlay = memo(({ open, onClose, chains, activeChain, onSelect, chainInfo }) => {
  if (!open) return null;
  
  const handleSelect = (chainId) => {
    onSelect(chainId);
    onClose();
  };
  
  return (
    <div className="absolute inset-0 z-50 bg-[#0a0a0a] rounded-2xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-bold text-white">Select Chain</h3>
        <button 
          onClick={onClose} 
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
          data-testid="close-chain-modal"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 grid grid-cols-4 sm:grid-cols-5 gap-3">
          {chains.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              data-testid={`chain-select-${c.id}`}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                activeChain === c.id 
                  ? 'bg-[#C1FF72]/20 ring-1 ring-[#C1FF72]' 
                  : 'bg-[#111] hover:bg-[#1a1a1a]'
              }`}
            >
              {chainInfo(c.id)?.logo ? (
                <img src={chainInfo(c.id).logo} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full" style={{ background: chainInfo(c.id)?.color || '#666' }} />
              )}
              <span className="text-xs text-white truncate max-w-full">{c.name?.slice(0, 8)}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});
ViewAllChainsOverlay.displayName = 'ViewAllChainsOverlay';

export const TokenSelectModal = memo(({
  open,
  onClose,
  onSelect,
  tokens = {},
  chains = [],
  selectedChainId,
  selectedToken,
  title = 'Select token',
  loading = false,
  defaultChainId,
  isFrom = true,
}) => {
  const [search, setSearch] = useState('');
  const [activeChain, setActiveChain] = useState(defaultChainId || selectedChainId || 1);
  const [showAllChains, setShowAllChains] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveChain(defaultChainId || selectedChainId || chains[0]?.id || 1);
    }
  }, [open, defaultChainId, selectedChainId, chains]);

  // Sorted chains - priority first
  const sortedChains = useMemo(() => {
    const priority = chains.filter(c => PRIORITY_CHAINS.includes(c.id));
    const others = chains.filter(c => !PRIORITY_CHAINS.includes(c.id));
    priority.sort((a, b) => PRIORITY_CHAINS.indexOf(a.id) - PRIORITY_CHAINS.indexOf(b.id));
    return [...priority, ...others];
  }, [chains]);

  // Display chains (first 6 for quick access)
  const displayChains = useMemo(() => sortedChains.slice(0, 6), [sortedChains]);
  const remainingCount = Math.max(0, sortedChains.length - 6);

  // Tokens for active chain - dedupe wrapped versions
  const chainTokens = useMemo(() => {
    let list = tokens[activeChain] || [];
    if (list.length === 0 && FALLBACK_TOKENS[activeChain]) {
      list = FALLBACK_TOKENS[activeChain];
    }
    
    // Dedupe: prefer native tokens over wrapped versions
    // e.g., "SOL" over "Wrapped SOL" on non-Solana chains
    const seen = new Map();
    const deduped = [];
    
    for (const token of list) {
      const symbol = token.symbol?.toUpperCase() || '';
      // Skip tokens with "Wrapped" in name if we already have the base symbol
      const isWrapped = token.name?.toLowerCase().includes('wrapped') || 
                        token.name?.toLowerCase().includes('wormhole') ||
                        token.symbol?.toLowerCase().startsWith('w') && token.symbol?.length > 2;
      
      const baseSymbol = isWrapped && symbol.startsWith('W') ? symbol.slice(1) : symbol;
      
      if (seen.has(baseSymbol)) {
        // If current is native/non-wrapped and existing is wrapped, replace
        const existing = seen.get(baseSymbol);
        const existingIsWrapped = existing.name?.toLowerCase().includes('wrapped');
        if (existingIsWrapped && !isWrapped) {
          const idx = deduped.findIndex(t => t.address === existing.address);
          if (idx !== -1) deduped[idx] = token;
          seen.set(baseSymbol, token);
        }
      } else {
        seen.set(baseSymbol, token);
        deduped.push(token);
      }
    }
    
    // Apply search filter
    if (search) {
      const s = search.toLowerCase();
      return deduped.filter(t => 
        t.symbol?.toLowerCase().includes(s) ||
        t.name?.toLowerCase().includes(s) ||
        t.address?.toLowerCase() === s
      );
    }
    
    return deduped;
  }, [tokens, activeChain, search]);

  // Sort: native first, then popular stables, then by liquidity/popularity, then alphabetical
  const displayTokens = useMemo(() => {
    const prioritySymbols = ['ETH', 'SOL', 'TRX', 'BTC', 'BNB', 'MATIC', 'AVAX', 'FTM', 'USDC', 'USDT', 'DAI', 'WETH', 'WBTC'];
    
    const sorted = [...chainTokens].sort((a, b) => {
      // Native tokens first
      if (a.isNative && !b.isNative) return -1;
      if (b.isNative && !a.isNative) return 1;
      
      // Priority symbols
      const aIdx = prioritySymbols.indexOf(a.symbol?.toUpperCase());
      const bIdx = prioritySymbols.indexOf(b.symbol?.toUpperCase());
      if (aIdx !== -1 && bIdx === -1) return -1;
      if (bIdx !== -1 && aIdx === -1) return 1;
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      
      // Then by priceUSD (if available) as proxy for popularity
      const aPrice = parseFloat(a.priceUSD) || 0;
      const bPrice = parseFloat(b.priceUSD) || 0;
      if (aPrice > 0 && bPrice > 0) {
        // Higher price tokens tend to be more popular
        if (aPrice > 0.01 && bPrice < 0.01) return -1;
        if (bPrice > 0.01 && aPrice < 0.01) return 1;
      }
      
      // Finally alphabetical
      return (a.symbol || '').localeCompare(b.symbol || '');
    });
    
    // Show more tokens - up to 500
    return sorted.slice(0, 500);
  }, [chainTokens]);

  const handleSelect = useCallback((token) => {
    onSelect({ ...token, chainId: activeChain });
    onClose();
  }, [activeChain, onSelect, onClose]);

  const isSelected = useCallback((token) => {
    return selectedToken?.address?.toLowerCase() === token.address?.toLowerCase() && selectedToken?.chainId === activeChain;
  }, [selectedToken, activeChain]);

  // Get chain info - merge API data with our static info
  const chainInfo = useCallback((id) => {
    // First check our static CHAIN_INFO
    const staticInfo = CHAIN_INFO[id];
    
    // Then find from API chains for logo URL
    const apiChain = sortedChains.find(c => c.id === id);
    
    if (staticInfo && apiChain?.logoURI) {
      return { ...staticInfo, logo: apiChain.logoURI };
    }
    if (apiChain?.logoURI) {
      return { 
        name: apiChain.name || apiChain.key, 
        logo: apiChain.logoURI,
        color: '#666'
      };
    }
    return staticInfo || { name: `Chain ${id}`, color: '#666' };
  }, [sortedChains]);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-[460px] h-auto max-h-[85vh] bg-[#0a0a0a] border-white/20 rounded-2xl p-0 flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="p-4 sm:p-5 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Select token ({isFrom ? 'From' : 'To'})
            </h2>
            <button 
              onClick={onClose} 
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" 
              data-testid="close-modal"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Chain Filter Section */}
          <div className="px-4 sm:px-5 pb-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Filter by chain</span>
              <button 
                onClick={() => setShowAllChains(true)}
                className="flex items-center gap-1 text-sm text-[#C1FF72] hover:text-[#d4ff9e] transition-colors"
                data-testid="view-all-chains"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Chain Icons Row */}
            <div className="flex items-center gap-2 sm:gap-3">
              {displayChains.map(c => (
                <ChainIcon
                  key={c.id}
                  chain={c}
                  active={activeChain === c.id}
                  onClick={() => setActiveChain(c.id)}
                  info={chainInfo(c.id)}
                />
              ))}
              {remainingCount > 0 && (
                <button
                  onClick={() => setShowAllChains(true)}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#1a1a1a] border border-white/10 hover:border-white/30 flex items-center justify-center transition-all flex-shrink-0"
                  data-testid="more-chains-btn"
                >
                  <span className="text-sm font-medium text-gray-400">+{remainingCount}</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Input */}
          <div className="px-4 sm:px-5 pb-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for token..."
                className="h-12 pl-12 bg-[#111] border-white/10 rounded-xl text-base placeholder:text-gray-500 focus:border-[#C1FF72]/50 focus:ring-[#C1FF72]/20"
                data-testid="token-search"
              />
            </div>
          </div>

          {/* Available Tokens Label */}
          <div className="px-4 sm:px-5 pb-2 flex-shrink-0 flex items-center justify-between">
            <span className="text-sm text-gray-400">Available tokens</span>
            <span className="text-xs text-gray-500">{chainTokens.length} tokens</span>
          </div>

          {/* Token List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-2 sm:px-3 pb-4">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <Skeleton className="w-10 h-10 rounded-full bg-[#222]" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-20 mb-2 bg-[#222]" />
                      <Skeleton className="h-3 w-32 bg-[#222]" />
                    </div>
                    <Skeleton className="h-4 w-16 bg-[#222]" />
                  </div>
                ))
              ) : displayTokens.length === 0 ? (
                <div className="py-16 text-center">
                  <Search className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 text-base">No tokens found</p>
                  <p className="text-gray-500 text-sm mt-1">Try a different search term</p>
                </div>
              ) : (
                displayTokens.map(t => (
                  <TokenRow
                    key={`${activeChain}-${t.address}`}
                    token={t}
                    chainId={activeChain}
                    isSelected={isSelected(t)}
                    onSelect={handleSelect}
                    chainInfo={chainInfo(activeChain)}
                  />
                ))
              )}
              {chainTokens.length > 500 && (
                <p className="text-center text-sm text-gray-500 py-3">
                  Showing 500 of {chainTokens.length} tokens. Use search to find more.
                </p>
              )}
            </div>
          </ScrollArea>
          
          {/* View All Chains Overlay - positioned inside the dialog */}
          <ViewAllChainsOverlay
            open={showAllChains}
            onClose={() => setShowAllChains(false)}
            chains={sortedChains}
            activeChain={activeChain}
            onSelect={setActiveChain}
            chainInfo={chainInfo}
          />
        </DialogContent>
      </Dialog>
    </>
  );
});
TokenSelectModal.displayName = 'TokenSelectModal';
