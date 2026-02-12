import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { Search, X, Check, AlertTriangle } from 'lucide-react';
import { CHAIN_INFO, POPULAR_CHAIN_IDS, formatTokenAmount, SOLANA_CHAIN_ID, TRON_CHAIN_ID, BITCOIN_CHAIN_ID, FALLBACK_SOLANA_TOKENS, FALLBACK_TRON_TOKENS, FALLBACK_BITCOIN_TOKENS, isChainSupported } from '../hooks/useLifi';

// Memoized token row component
const TokenRow = memo(({ token, chainId, isSelected, onSelect, balance, chainInfo, isUnsupported }) => {
  const [imgError, setImgError] = useState(false);
  
  return (
    <button
      onClick={() => onSelect(token)}
      className={`w-full flex items-center gap-3 p-3 rounded-[10px] token-row token-list-item ${
        isSelected ? 'bg-[#C1FF72]/10 border border-[#C1FF72]/30' : ''
      } ${isUnsupported ? 'opacity-60' : ''}`}
      data-testid={`token-option-${token.symbol}`}
    >
      <div className="relative flex-shrink-0">
        {token.logoURI && !imgError ? (
          <img 
            src={token.logoURI} 
            alt={token.symbol}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#222]"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#222] flex items-center justify-center text-white font-bold text-sm">
            {token.symbol?.charAt(0) || '?'}
          </div>
        )}
        {chainInfo?.logoURI ? (
          <img 
            src={chainInfo.logoURI}
            alt={chainInfo.name}
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0a0a0a]"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div 
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0a0a0a] text-[6px] font-bold flex items-center justify-center"
            style={{ backgroundColor: chainInfo?.color || '#666' }}
          >
            {chainInfo?.symbol?.charAt(0) || '?'}
          </div>
        )}
      </div>

      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white truncate text-sm sm:text-base">{token.symbol}</span>
          {isSelected && <Check className="w-4 h-4 text-[#C1FF72] flex-shrink-0" />}
          {isUnsupported && <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
        </div>
        <span className="text-xs text-gray-500 truncate block">{token.name}</span>
      </div>

      {balance !== undefined && (
        <div className="text-right flex-shrink-0">
          <div className="text-xs sm:text-sm font-mono text-white">
            {formatTokenAmount(balance, token.decimals, 4)}
          </div>
          <div className="text-xs text-gray-500">Balance</div>
        </div>
      )}
    </button>
  );
});

TokenRow.displayName = 'TokenRow';

// Memoized chain filter button
const ChainFilterButton = memo(({ chain, isActive, onClick, chainInfo, isUnsupported }) => {
  const [imgError, setImgError] = useState(false);
  
  return (
    <button
      onClick={onClick}
      className={`chain-filter-btn flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-[10px] text-xs font-medium transition-colors ${
        isActive 
          ? 'bg-[#C1FF72] text-black' 
          : 'bg-[#111] text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
      } ${isUnsupported && !isActive ? 'border border-dashed border-gray-600' : ''}`}
      data-testid={`chain-filter-${chain.id}`}
      title={isUnsupported ? 'Coming soon' : chain.name}
    >
      {chainInfo?.logoURI && !imgError ? (
        <img 
          src={chainInfo.logoURI} 
          alt={chain.name} 
          className="w-4 h-4 rounded-full"
          onError={() => setImgError(true)}
        />
      ) : (
        <div 
          className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
          style={{ backgroundColor: chainInfo?.color || '#666' }}
        >
          {chainInfo?.symbol?.charAt(0) || '?'}
        </div>
      )}
      <span className="hidden sm:inline">{chain.name}</span>
      <span className="sm:hidden">{chain.name?.slice(0, 3)}</span>
    </button>
  );
});

ChainFilterButton.displayName = 'ChainFilterButton';

export const TokenSelectModal = memo(({
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
  defaultToSolana = false,
}) => {
  const [search, setSearch] = useState('');
  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  // Compute initial chain ID
  const getInitialChainId = useCallback(() => {
    if (defaultToSolana && chains.some(c => c.id === SOLANA_CHAIN_ID)) {
      return SOLANA_CHAIN_ID;
    }
    return selectedChainId || chains[0]?.id || 1;
  }, [defaultToSolana, chains, selectedChainId]);
  
  const [activeChainId, setActiveChainId] = useState(() => getInitialChainId());

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveChainId(getInitialChainId());
    }
  }, [open, getInitialChainId]);

  // Get popular chains first
  const sortedChains = useMemo(() => {
    const popular = chains.filter(c => POPULAR_CHAIN_IDS.includes(c.id));
    const others = chains.filter(c => !POPULAR_CHAIN_IDS.includes(c.id));
    
    // Sort popular chains by POPULAR_CHAIN_IDS order
    popular.sort((a, b) => POPULAR_CHAIN_IDS.indexOf(a.id) - POPULAR_CHAIN_IDS.indexOf(b.id));
    
    return [...popular, ...others];
  }, [chains]);

  // Get tokens for active chain with fallbacks
  const chainTokens = useMemo(() => {
    let tokenList = tokens[activeChainId] || [];
    
    // Use fallback tokens if empty
    if (tokenList.length === 0) {
      if (activeChainId === SOLANA_CHAIN_ID) {
        tokenList = FALLBACK_SOLANA_TOKENS;
      } else if (activeChainId === TRON_CHAIN_ID) {
        tokenList = FALLBACK_TRON_TOKENS;
      } else if (activeChainId === BITCOIN_CHAIN_ID) {
        tokenList = FALLBACK_BITCOIN_TOKENS;
      }
    }
    
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

  // Sort tokens
  const sortedTokens = useMemo(() => {
    return [...chainTokens].sort((a, b) => {
      const balanceA = walletBalances[a.address] || 0;
      const balanceB = walletBalances[b.address] || 0;
      if (balanceB !== balanceA) return balanceB - balanceA;
      if (a.isNative) return -1;
      if (b.isNative) return 1;
      if (a.symbol === 'SOL' || a.symbol === 'ETH' || a.symbol === 'TRX' || a.symbol === 'BTC') return -1;
      if (b.symbol === 'SOL' || b.symbol === 'ETH' || b.symbol === 'TRX' || b.symbol === 'BTC') return 1;
      return (a.symbol || '').localeCompare(b.symbol || '');
    });
  }, [chainTokens, walletBalances]);

  // Limit displayed tokens for performance
  const displayedTokens = useMemo(() => sortedTokens.slice(0, 50), [sortedTokens]);

  const handleSelectToken = useCallback((token) => {
    onSelect({ ...token, chainId: activeChainId });
    onClose();
  }, [activeChainId, onSelect, onClose]);

  const getChainInfo = useCallback((chainId) => {
    return CHAIN_INFO[chainId] || { name: `Chain ${chainId}`, symbol: '?', color: '#666' };
  }, []);

  const isTokenSelected = useCallback((token) => {
    return selectedToken?.address?.toLowerCase() === token.address?.toLowerCase() &&
           selectedToken?.chainId === activeChainId;
  }, [selectedToken, activeChainId]);

  // Drag scroll handlers for chain selector
  const handleMouseDown = useCallback((e) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  }, [isDragging, startX, scrollLeft]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (!scrollContainerRef.current) return;
    setStartX(e.touches[0].pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!scrollContainerRef.current) return;
    const x = e.touches[0].pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  }, [startX, scrollLeft]);

  const isActiveChainSupported = isChainSupported(activeChainId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[480px] max-h-[90vh] sm:max-h-[85vh] bg-[#0a0a0a] border-white/20 rounded-[10px] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-3 sm:p-4 pb-0 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base sm:text-lg font-bold text-white">
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
          <div className="relative mt-3 sm:mt-4 mb-2 sm:mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or address"
              className="h-10 sm:h-11 pl-10 bg-[#111] border-none rounded-[10px] text-white text-sm placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-[#C1FF72]"
              data-testid="token-search-input"
            />
          </div>

          {/* Chain Filter with drag scroll */}
          <div className="chain-scroll-container pb-2 sm:pb-3">
            <div 
              ref={scrollContainerRef}
              className="chain-scroll"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
            >
              {sortedChains.slice(0, 12).map((chain) => {
                const info = getChainInfo(chain.id);
                const isActive = activeChainId === chain.id;
                const isUnsupported = !isChainSupported(chain.id);
                return (
                  <ChainFilterButton
                    key={chain.id}
                    chain={chain}
                    isActive={isActive}
                    onClick={() => setActiveChainId(chain.id)}
                    chainInfo={info}
                    isUnsupported={isUnsupported}
                  />
                );
              })}
            </div>
          </div>
        </DialogHeader>

        {/* Unsupported chain warning */}
        {!isActiveChainSupported && (
          <div className="mx-3 sm:mx-4 mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-[10px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <span className="text-xs text-yellow-500">
              {activeChainId === TRON_CHAIN_ID ? 'Tron' : 'Bitcoin'} swaps coming soon
            </span>
          </div>
        )}

        {/* Token List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 token-list-container">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-10 h-10 rounded-full bg-[#222]" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-20 mb-1 bg-[#222]" />
                    <Skeleton className="h-3 w-32 bg-[#222]" />
                  </div>
                </div>
              ))
            ) : displayedTokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Search className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">No tokens found</p>
                <p className="text-xs mt-1">Try a different search</p>
              </div>
            ) : (
              displayedTokens.map((token) => (
                <TokenRow
                  key={`${activeChainId}-${token.address}`}
                  token={token}
                  chainId={activeChainId}
                  isSelected={isTokenSelected(token)}
                  onSelect={handleSelectToken}
                  balance={walletBalances[token.address]}
                  chainInfo={getChainInfo(activeChainId)}
                  isUnsupported={!isActiveChainSupported}
                />
              ))
            )}
            {sortedTokens.length > 50 && (
              <div className="text-center text-xs text-gray-500 py-3">
                Showing 50 of {sortedTokens.length} tokens. Use search to find more.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});

TokenSelectModal.displayName = 'TokenSelectModal';
