import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { Search, X, Check, AlertTriangle } from 'lucide-react';
import { CHAIN_INFO, PRIORITY_CHAINS, FALLBACK_TOKENS, isSwapSupported, requiresBridge, formatTokenAmount, SOLANA_CHAIN_ID, TRON_CHAIN_ID, BITCOIN_CHAIN_ID } from '../hooks/useLifi';

// Token Row - memoized for performance
const TokenRow = memo(({ token, chainId, isSelected, onSelect, chainInfo, unsupported }) => {
  const [imgErr, setImgErr] = useState(false);
  const logo = token.logoURI || token.logo;
  
  return (
    <button
      onClick={() => onSelect(token)}
      className={`w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-lg token-row ${isSelected ? 'bg-[#C1FF72]/10 ring-1 ring-[#C1FF72]/40' : ''} ${unsupported ? 'opacity-60' : ''}`}
      data-testid={`token-${token.symbol}`}
    >
      <div className="relative flex-shrink-0">
        {logo && !imgErr ? (
          <img src={logo} alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#222]" onError={() => setImgErr(true)} loading="lazy" />
        ) : (
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#333] flex items-center justify-center text-white font-bold text-sm">
            {token.symbol?.[0] || '?'}
          </div>
        )}
        {chainInfo?.logo && (
          <img src={chainInfo.logo} alt="" className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-[#0a0a0a]" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-white text-sm truncate">{token.symbol}</span>
          {isSelected && <Check className="w-3.5 h-3.5 text-[#C1FF72]" />}
          {unsupported && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
        </div>
        <div className="text-xs text-gray-500 truncate">{token.name}</div>
      </div>
    </button>
  );
});
TokenRow.displayName = 'TokenRow';

// Chain Button - memoized
const ChainBtn = memo(({ chain, active, onClick, info, unsupported, needsBridge }) => {
  const [imgErr, setImgErr] = useState(false);
  
  return (
    <button
      onClick={onClick}
      className={`chain-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active ? 'bg-[#C1FF72] text-black' : 'bg-[#111] text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
      } ${unsupported && !active ? 'border border-dashed border-red-600/50' : ''} ${needsBridge && !unsupported && !active ? 'border border-dashed border-yellow-600/50' : ''}`}
      data-testid={`chain-${chain.id}`}
    >
      {info?.logo && !imgErr ? (
        <img src={info.logo} alt="" className="w-4 h-4 rounded-full" onError={() => setImgErr(true)} />
      ) : (
        <div className="w-4 h-4 rounded-full" style={{ background: info?.color || '#666' }} />
      )}
      <span className="hidden xs:inline">{chain.name}</span>
      <span className="xs:hidden">{(chain.name || '').slice(0, 4)}</span>
    </button>
  );
});
ChainBtn.displayName = 'ChainBtn';

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
  defaultChainId,
}) => {
  const [search, setSearch] = useState('');
  const [activeChain, setActiveChain] = useState(defaultChainId || selectedChainId || 1);
  const scrollRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, scroll: 0 });

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveChain(defaultChainId || selectedChainId || chains[0]?.id || 1);
    }
  }, [open, defaultChainId, selectedChainId, chains]);

  // Sorted chains
  const sortedChains = useMemo(() => {
    const priority = chains.filter(c => PRIORITY_CHAINS.includes(c.id));
    const others = chains.filter(c => !PRIORITY_CHAINS.includes(c.id));
    priority.sort((a, b) => PRIORITY_CHAINS.indexOf(a.id) - PRIORITY_CHAINS.indexOf(b.id));
    return [...priority, ...others];
  }, [chains]);

  // Tokens for active chain
  const chainTokens = useMemo(() => {
    let list = tokens[activeChain] || [];
    if (list.length === 0 && FALLBACK_TOKENS[activeChain]) {
      list = FALLBACK_TOKENS[activeChain];
    }
    
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t => 
        t.symbol?.toLowerCase().includes(s) ||
        t.name?.toLowerCase().includes(s) ||
        t.address?.toLowerCase() === s
      );
    }
    
    return list;
  }, [tokens, activeChain, search]);

  // Sort: native first, then alphabetical (limited for perf)
  const displayTokens = useMemo(() => {
    const sorted = [...chainTokens].sort((a, b) => {
      if (a.isNative) return -1;
      if (b.isNative) return 1;
      const nativeSymbols = ['ETH', 'SOL', 'TRX', 'BTC', 'BNB', 'MATIC', 'AVAX'];
      if (nativeSymbols.includes(a.symbol) && !nativeSymbols.includes(b.symbol)) return -1;
      if (nativeSymbols.includes(b.symbol) && !nativeSymbols.includes(a.symbol)) return 1;
      return (a.symbol || '').localeCompare(b.symbol || '');
    });
    return sorted.slice(0, 100); // Limit for performance
  }, [chainTokens]);

  const handleSelect = useCallback((token) => {
    onSelect({ ...token, chainId: activeChain });
    onClose();
  }, [activeChain, onSelect, onClose]);

  const isSelected = useCallback((token) => {
    return selectedToken?.address?.toLowerCase() === token.address?.toLowerCase() && selectedToken?.chainId === activeChain;
  }, [selectedToken, activeChain]);

  const chainInfo = useCallback((id) => CHAIN_INFO[id] || {}, []);
  const unsupported = !isSwapSupported(activeChain);
  const needsBridge = requiresBridge(activeChain);

  // Drag scroll handlers
  const onMouseDown = (e) => {
    if (!scrollRef.current) return;
    setDragging(true);
    setDragStart({ x: e.pageX, scroll: scrollRef.current.scrollLeft });
  };
  const onMouseMove = (e) => {
    if (!dragging || !scrollRef.current) return;
    const dx = e.pageX - dragStart.x;
    scrollRef.current.scrollLeft = dragStart.scroll - dx;
  };
  const onMouseUp = () => setDragging(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[420px] h-auto max-h-[85vh] bg-[#0a0a0a] border-white/20 rounded-xl p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-3 sm:p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <DialogTitle className="text-base font-bold text-white">{title}</DialogTitle>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5" data-testid="close-modal">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens..."
              className="h-9 pl-9 bg-[#111] border-none rounded-lg text-sm placeholder:text-gray-600"
              data-testid="token-search"
            />
          </div>
          
          {/* Chain scroll */}
          <div className="chain-scroll-wrapper">
            <div
              ref={scrollRef}
              className="chain-scroll"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {sortedChains.slice(0, 12).map(c => (
                <ChainBtn
                  key={c.id}
                  chain={c}
                  active={activeChain === c.id}
                  onClick={() => setActiveChain(c.id)}
                  info={chainInfo(c.id)}
                  unsupported={!isSwapSupported(c.id)}
                  needsBridge={requiresBridge(c.id)}
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Unsupported/Bridge warning */}
        {unsupported && (
          <div className="mx-3 sm:mx-4 mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-500">{chainInfo(activeChain).name} is not supported</span>
          </div>
        )}
        {!unsupported && needsBridge && (
          <div className="mx-3 sm:mx-4 mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-yellow-500">{chainInfo(activeChain).name} requires bridge routing - coming soon</span>
          </div>
        )}

        {/* Token list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-9 h-9 rounded-full bg-[#222]" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-16 mb-1 bg-[#222]" />
                    <Skeleton className="h-3 w-24 bg-[#222]" />
                  </div>
                </div>
              ))
            ) : displayTokens.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tokens found</p>
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
                  unsupported={unsupported}
                />
              ))
            )}
            {chainTokens.length > 100 && (
              <p className="text-center text-xs text-gray-500 py-2">
                Showing 100 of {chainTokens.length}. Use search.
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});
TokenSelectModal.displayName = 'TokenSelectModal';
