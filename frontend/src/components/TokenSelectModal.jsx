import { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
import { CHAIN_INFO, POPULAR_CHAIN_IDS, formatTokenAmount, SOLANA_CHAIN_ID, FALLBACK_SOLANA_TOKENS } from '../hooks/useLifi';

// Memoized token row component to prevent unnecessary re-renders
const TokenRow = memo(({ token, chainId, isSelected, onSelect, balance, getChainInfo }) => {
  const chainInfo = getChainInfo(chainId);
  const [imgError, setImgError] = useState(false);
  
  return (
    <button
      onClick={() => onSelect(token)}
      className={`w-full flex items-center gap-3 p-3 rounded-[10px] token-row ${
        isSelected ? 'bg-[#C1FF72]/10 border border-[#C1FF72]/30' : ''
      }`}
      data-testid={`token-option-${token.symbol}`}
    >
      {/* Token Icon */}
      <div className="relative flex-shrink-0">
        {token.logoURI && !imgError ? (
          <img 
            src={token.logoURI} 
            alt={token.symbol}
            className="w-10 h-10 rounded-full bg-[#222]"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#222] flex items-center justify-center text-white font-bold text-sm">
            {token.symbol?.charAt(0) || '?'}
          </div>
        )}
        {/* Chain indicator */}
        {chainInfo.logoURI ? (
          <img 
            src={chainInfo.logoURI}
            alt={chainInfo.name}
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0a0a0a]"
          />
        ) : (
          <div 
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0a0a0a] text-[6px] font-bold flex items-center justify-center"
            style={{ backgroundColor: chainInfo.color }}
          >
            {chainInfo.symbol?.charAt(0) || '?'}
          </div>
        )}
      </div>

      {/* Token Info */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white truncate">{token.symbol}</span>
          {isSelected && (
            <Check className="w-4 h-4 text-[#C1FF72] flex-shrink-0" />
          )}
        </div>
        <span className="text-xs text-gray-500 truncate block">{token.name}</span>
      </div>

      {/* Balance */}
      {balance !== undefined && (
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-mono text-white">
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
const ChainFilterButton = memo(({ chain, isActive, onClick, chainInfo }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
      isActive 
        ? 'bg-[#C1FF72] text-black' 
        : 'bg-[#111] text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
    }`}
    data-testid={`chain-filter-${chain.id}`}
  >
    {chainInfo.logoURI ? (
      <img 
        src={chainInfo.logoURI} 
        alt={chain.name} 
        className="w-4 h-4 rounded-full"
      />
    ) : (
      <div 
        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
        style={{ backgroundColor: chainInfo.color }}
      >
        {chainInfo.symbol?.charAt(0) || '?'}
      </div>
    )}
    {chain.name}
  </button>
));

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
  const [activeChainId, setActiveChainId] = useState(selectedChainId);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSearch('');
      // Default to Solana if specified, otherwise use selected or first chain
      if (defaultToSolana && chains.some(c => c.id === SOLANA_CHAIN_ID)) {
        setActiveChainId(SOLANA_CHAIN_ID);
      } else {
        setActiveChainId(selectedChainId || (chains[0]?.id));
      }
    }
  }, [open, selectedChainId, chains, defaultToSolana]);

  // Get popular chains first - memoized
  const sortedChains = useMemo(() => {
    const popular = chains.filter(c => POPULAR_CHAIN_IDS.includes(c.id));
    const others = chains.filter(c => !POPULAR_CHAIN_IDS.includes(c.id));
    
    // Ensure Solana is in popular chains
    const hasSolana = popular.some(c => c.id === SOLANA_CHAIN_ID);
    if (!hasSolana) {
      const solanaChain = chains.find(c => c.id === SOLANA_CHAIN_ID);
      if (solanaChain) {
        popular.push(solanaChain);
      }
    }
    
    return [...popular, ...others];
  }, [chains]);

  // Get tokens for active chain with fallback for Solana
  const chainTokens = useMemo(() => {
    let tokenList = tokens[activeChainId] || [];
    
    // Use fallback tokens for Solana if empty
    if (activeChainId === SOLANA_CHAIN_ID && tokenList.length === 0) {
      tokenList = FALLBACK_SOLANA_TOKENS;
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

  // Sort tokens by balance then alphabetically - memoized
  const sortedTokens = useMemo(() => {
    return [...chainTokens].sort((a, b) => {
      const balanceA = walletBalances[a.address] || 0;
      const balanceB = walletBalances[b.address] || 0;
      if (balanceB !== balanceA) return balanceB - balanceA;
      // Put native tokens first (SOL, ETH)
      if (a.symbol === 'SOL' || a.symbol === 'ETH') return -1;
      if (b.symbol === 'SOL' || b.symbol === 'ETH') return 1;
      return (a.symbol || '').localeCompare(b.symbol || '');
    });
  }, [chainTokens, walletBalances]);

  const handleSelectToken = useCallback((token) => {
    onSelect({
      ...token,
      chainId: activeChainId,
    });
    onClose();
  }, [activeChainId, onSelect, onClose]);

  const getChainInfo = useCallback((chainId) => {
    return CHAIN_INFO[chainId] || { name: `Chain ${chainId}`, symbol: '?', color: '#666' };
  }, []);

  const isTokenSelected = useCallback((token) => {
    return selectedToken?.address?.toLowerCase() === token.address?.toLowerCase() &&
           selectedToken?.chainId === activeChainId;
  }, [selectedToken, activeChainId]);

  const handleChainClick = useCallback((chainId) => {
    setActiveChainId(chainId);
  }, []);

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

          {/* Chain Filter - Fixed horizontal scroll */}
          <div className="chain-scroll flex gap-2 pb-3">
            {sortedChains.slice(0, 8).map((chain) => {
              const info = getChainInfo(chain.id);
              const isActive = activeChainId === chain.id;
              return (
                <ChainFilterButton
                  key={chain.id}
                  chain={chain}
                  isActive={isActive}
                  onClick={() => handleChainClick(chain.id)}
                  chainInfo={info}
                />
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
              // Token list - virtualized rendering for performance
              sortedTokens.slice(0, 100).map((token) => (
                <TokenRow
                  key={`${activeChainId}-${token.address}`}
                  token={token}
                  chainId={activeChainId}
                  isSelected={isTokenSelected(token)}
                  onSelect={handleSelectToken}
                  balance={walletBalances[token.address]}
                  getChainInfo={getChainInfo}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});

TokenSelectModal.displayName = 'TokenSelectModal';
