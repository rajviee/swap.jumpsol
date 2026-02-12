import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useWalletStore, SOLANA_CHAIN_ID, TRON_CHAIN_ID, BITCOIN_CHAIN_ID } from '../store/walletStore';
import { transactionApi } from '../services/api';
import { formatTokenAmount, formatUSD, CHAIN_INFO } from '../hooks/useLifi';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { 
  ArrowRight, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  History,
  RefreshCw,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';

const StatusBadge = memo(({ status }) => {
  const config = {
    pending: { icon: Clock, className: 'status-pending', text: 'Pending' },
    success: { icon: CheckCircle2, className: 'status-success', text: 'Success' },
    failed: { icon: XCircle, className: 'status-failed', text: 'Failed' },
  };
  const { icon: Icon, className, text } = config[status] || config.pending;
  return (
    <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-xs font-medium ${className}`}>
      <Icon className="w-3 h-3" />
      <span className="hidden sm:inline">{text}</span>
    </div>
  );
});

StatusBadge.displayName = 'StatusBadge';

const TxRow = memo(({ tx, onSelect, formatDate }) => (
  <button
    onClick={() => onSelect(tx)}
    className="w-full p-3 sm:p-4 rounded-[10px] bg-[#111] text-left hover:bg-[#1a1a1a] transition-colors"
    data-testid={`tx-row-${tx.id}`}
  >
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#222] flex items-center justify-center text-white font-bold text-xs sm:text-sm">
          {tx.from_token_symbol?.charAt(0) || '?'}
        </div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#333] flex items-center justify-center text-white text-[6px] sm:text-[8px] font-bold border-2 border-[#111]">
          {tx.to_token_symbol?.charAt(0) || '?'}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 sm:gap-2 mb-1">
          <span className="text-white font-medium truncate text-sm">{tx.from_token_symbol}</span>
          <ArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
          <span className="text-white font-medium truncate text-sm">{tx.to_token_symbol}</span>
        </div>
        <div className="text-[10px] sm:text-xs text-gray-500">{formatDate(tx.created_at)}</div>
      </div>
      <StatusBadge status={tx.status} />
    </div>
  </button>
));

TxRow.displayName = 'TxRow';

export const TransactionHistory = memo(({ refreshTrigger }) => {
  const { evmAddress, solanaAddress, tronAddress, evmConnected, solanaConnected, tronConnected } = useWalletStore();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const walletAddress = evmAddress || solanaAddress || tronAddress;
  const isConnected = evmConnected || solanaConnected || tronConnected;

  const fetchTransactions = useCallback(async () => {
    if (!walletAddress) {
      setTransactions([]);
      return;
    }
    setLoading(true);
    try {
      const params = { walletAddress, limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.txType = typeFilter;
      const data = await transactionApi.getAll(params);
      setTransactions(data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, statusFilter, typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshTrigger]);

  const getExplorerUrl = useCallback((tx) => {
    const explorers = {
      1: 'https://etherscan.io/tx/',
      42161: 'https://arbiscan.io/tx/',
      10: 'https://optimistic.etherscan.io/tx/',
      137: 'https://polygonscan.com/tx/',
      56: 'https://bscscan.com/tx/',
      43114: 'https://snowtrace.io/tx/',
      8453: 'https://basescan.org/tx/',
      [SOLANA_CHAIN_ID]: 'https://solscan.io/tx/',
      [TRON_CHAIN_ID]: 'https://tronscan.org/#/transaction/',
    };
    return `${explorers[tx.from_chain_id] || explorers[1]}${tx.tx_hash}`;
  }, []);

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }, []);

  const copyTxHash = useCallback((hash) => {
    navigator.clipboard.writeText(hash);
    toast.success('Hash copied');
  }, []);

  const getChainName = useCallback((chainId) => CHAIN_INFO[chainId]?.name || `Chain ${chainId}`, []);

  if (!isConnected) {
    return (
      <div className="swap-card bg-black border border-white/50 rounded-[10px] p-4 sm:p-6 w-full max-w-[480px] mx-auto animate-fade-in" data-testid="tx-history-connect">
        <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
          <History className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Transaction History</h3>
          <p className="text-gray-500 text-xs sm:text-sm">Connect wallet to view</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="swap-card bg-black border border-white/50 rounded-[10px] p-4 sm:p-6 w-full max-w-[480px] mx-auto animate-fade-in" id="history" data-testid="tx-history">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-[#C1FF72]" />
            <h2 className="text-base sm:text-lg font-bold text-white">History</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTransactions}
            disabled={loading}
            className="h-8 px-2 text-gray-400 hover:text-white"
            data-testid="refresh-history-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex gap-2 mb-3 sm:mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1 h-8 sm:h-9 bg-[#111] border-white/10 rounded-[10px] text-xs sm:text-sm" data-testid="status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-white/20 rounded-[10px]">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="flex-1 h-8 sm:h-9 bg-[#111] border-white/10 rounded-[10px] text-xs sm:text-sm" data-testid="type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-white/20 rounded-[10px]">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="swap">Swap</SelectItem>
              <SelectItem value="bridge">Bridge</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[300px] sm:h-[400px]">
          {loading ? (
            <div className="space-y-2 sm:space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 sm:p-4 bg-[#111] rounded-[10px]">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#222]" />
                    <div className="flex-1">
                      <Skeleton className="h-3 sm:h-4 w-24 sm:w-32 mb-1 sm:mb-2 bg-[#222]" />
                      <Skeleton className="h-2 sm:h-3 w-16 sm:w-24 bg-[#222]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
              <History className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600 mb-2 sm:mb-3" />
              <p className="text-gray-500 text-xs sm:text-sm">No transactions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <TxRow key={tx.id} tx={tx} onSelect={setSelectedTx} formatDate={formatDate} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <DialogContent className="w-[95vw] max-w-[400px] bg-[#0a0a0a] border-white/20 rounded-[10px]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-white">Transaction</DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between p-2 sm:p-3 bg-[#111] rounded-[10px]">
                <span className="text-gray-400 text-xs sm:text-sm">Status</span>
                <StatusBadge status={selectedTx.status} />
              </div>
              <div className="p-3 sm:p-4 bg-[#111] rounded-[10px]">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-sm sm:text-lg font-bold text-white">{formatTokenAmount(selectedTx.from_amount, 18, 4)}</div>
                    <div className="text-xs sm:text-sm text-gray-400">{selectedTx.from_token_symbol}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500 mt-1">{getChainName(selectedTx.from_chain_id)}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#C1FF72]" />
                  <div className="text-center">
                    <div className="text-sm sm:text-lg font-bold text-white">{formatTokenAmount(selectedTx.to_amount, 18, 4)}</div>
                    <div className="text-xs sm:text-sm text-gray-400">{selectedTx.to_token_symbol}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500 mt-1">{getChainName(selectedTx.to_chain_id)}</div>
                  </div>
                </div>
              </div>
              {selectedTx.tx_hash && (
                <div className="flex items-center justify-between p-2 sm:p-3 bg-[#111] rounded-[10px]">
                  <span className="text-gray-400 text-xs sm:text-sm">Hash</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-[10px] sm:text-sm">{selectedTx.tx_hash.slice(0, 6)}...{selectedTx.tx_hash.slice(-4)}</span>
                    <button onClick={() => copyTxHash(selectedTx.tx_hash)} className="text-gray-400 hover:text-white">
                      <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}
              {selectedTx.tx_hash && (
                <Button
                  onClick={() => window.open(getExplorerUrl(selectedTx), '_blank')}
                  variant="outline"
                  className="w-full h-9 sm:h-11 rounded-[10px] border-white/20 text-white hover:bg-white/5 text-xs sm:text-sm"
                >
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  View Explorer
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});

TransactionHistory.displayName = 'TransactionHistory';
