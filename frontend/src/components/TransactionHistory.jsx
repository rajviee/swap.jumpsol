import { useState, useEffect, useCallback } from 'react';
import { useWalletStore } from '../store/walletStore';
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
  Loader2,
  History,
  Filter,
  RefreshCw,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';

const StatusBadge = ({ status }) => {
  const config = {
    pending: { icon: Clock, className: 'status-pending', text: 'Pending' },
    success: { icon: CheckCircle2, className: 'status-success', text: 'Success' },
    failed: { icon: XCircle, className: 'status-failed', text: 'Failed' },
  };

  const { icon: Icon, className, text } = config[status] || config.pending;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${className}`}>
      <Icon className="w-3 h-3" />
      {text}
    </div>
  );
};

const TxTypeLabel = ({ type }) => {
  const labels = {
    swap: 'Swap',
    bridge: 'Bridge',
    approval: 'Approval',
  };
  return (
    <span className="text-xs text-gray-500 uppercase tracking-wide">
      {labels[type] || type}
    </span>
  );
};

export const TransactionHistory = ({ refreshTrigger }) => {
  const { evmAddress, solanaAddress, evmConnected, solanaConnected } = useWalletStore();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const walletAddress = evmAddress || solanaAddress;
  const isConnected = evmConnected || solanaConnected;

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!walletAddress) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    try {
      const params = {
        walletAddress,
        limit: 50,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.txType = typeFilter;

      const data = await transactionApi.getAll(params);
      setTransactions(data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  }, [walletAddress, statusFilter, typeFilter]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshTrigger]);

  // Get explorer URL for transaction
  const getExplorerUrl = (tx) => {
    const explorers = {
      1: 'https://etherscan.io/tx/',
      42161: 'https://arbiscan.io/tx/',
      10: 'https://optimistic.etherscan.io/tx/',
      137: 'https://polygonscan.com/tx/',
      56: 'https://bscscan.com/tx/',
      43114: 'https://snowtrace.io/tx/',
      1151111081099710: 'https://solscan.io/tx/',
    };
    return `${explorers[tx.from_chain_id] || explorers[1]}${tx.tx_hash}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyTxHash = (hash) => {
    navigator.clipboard.writeText(hash);
    toast.success('Transaction hash copied');
  };

  const getChainName = (chainId) => {
    return CHAIN_INFO[chainId]?.name || `Chain ${chainId}`;
  };

  if (!isConnected) {
    return (
      <div className="swap-card animate-fade-in" data-testid="tx-history-connect">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Transaction History</h3>
          <p className="text-gray-500 text-sm">Connect your wallet to view history</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="swap-card animate-fade-in" id="history" data-testid="tx-history">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#C1FF72]" />
            <h2 className="text-lg font-bold text-white">Transaction History</h2>
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

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 bg-[#111] border-white/10 rounded-[10px] text-sm" data-testid="status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-white/20 rounded-[10px]">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[120px] h-9 bg-[#111] border-white/10 rounded-[10px] text-sm" data-testid="type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-white/20 rounded-[10px]">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="swap">Swap</SelectItem>
              <SelectItem value="bridge">Bridge</SelectItem>
              <SelectItem value="approval">Approval</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Transaction List */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 bg-[#111] rounded-[10px]">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full bg-[#222]" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2 bg-[#222]" />
                      <Skeleton className="h-3 w-24 bg-[#222]" />
                    </div>
                    <Skeleton className="h-6 w-16 bg-[#222]" />
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-gray-500 text-sm">No transactions found</p>
              <p className="text-gray-600 text-xs mt-1">Your swaps will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="w-full tx-row rounded-[10px] bg-[#111] text-left"
                  data-testid={`tx-row-${tx.id}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Token Icons */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-[#222] flex items-center justify-center text-white font-bold text-sm">
                        {tx.from_token_symbol?.charAt(0) || '?'}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#333] flex items-center justify-center text-white text-[8px] font-bold border-2 border-[#111]">
                        {tx.to_token_symbol?.charAt(0) || '?'}
                      </div>
                    </div>

                    {/* Tx Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium truncate">
                          {tx.from_token_symbol}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                        <span className="text-white font-medium truncate">
                          {tx.to_token_symbol}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <TxTypeLabel type={tx.tx_type} />
                        <span>•</span>
                        <span>{formatDate(tx.created_at)}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <StatusBadge status={tx.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Transaction Detail Modal */}
      <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <DialogContent className="sm:max-w-[440px] bg-[#0a0a0a] border-white/20 rounded-[10px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">
              Transaction Details
            </DialogTitle>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-[#111] rounded-[10px]">
                <span className="text-gray-400">Status</span>
                <StatusBadge status={selectedTx.status} />
              </div>

              {/* Swap Info */}
              <div className="p-4 bg-[#111] rounded-[10px]">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">
                      {formatTokenAmount(selectedTx.from_amount, 18, 4)}
                    </div>
                    <div className="text-sm text-gray-400">{selectedTx.from_token_symbol}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getChainName(selectedTx.from_chain_id)}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#C1FF72]" />
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">
                      {formatTokenAmount(selectedTx.to_amount, 18, 4)}
                    </div>
                    <div className="text-sm text-gray-400">{selectedTx.to_token_symbol}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getChainName(selectedTx.to_chain_id)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2">
                {selectedTx.tx_hash && (
                  <div className="flex items-center justify-between p-3 bg-[#111] rounded-[10px]">
                    <span className="text-gray-400 text-sm">Tx Hash</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm">
                        {selectedTx.tx_hash.slice(0, 8)}...{selectedTx.tx_hash.slice(-6)}
                      </span>
                      <button
                        onClick={() => copyTxHash(selectedTx.tx_hash)}
                        className="text-gray-400 hover:text-white"
                        data-testid="copy-tx-hash"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {selectedTx.route_provider && (
                  <div className="flex items-center justify-between p-3 bg-[#111] rounded-[10px]">
                    <span className="text-gray-400 text-sm">Provider</span>
                    <span className="text-white text-sm">{selectedTx.route_provider}</span>
                  </div>
                )}

                {selectedTx.gas_fee_usd && (
                  <div className="flex items-center justify-between p-3 bg-[#111] rounded-[10px]">
                    <span className="text-gray-400 text-sm">Gas Fee</span>
                    <span className="text-white text-sm">{formatUSD(selectedTx.gas_fee_usd)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-[#111] rounded-[10px]">
                  <span className="text-gray-400 text-sm">Date</span>
                  <span className="text-white text-sm">{formatDate(selectedTx.created_at)}</span>
                </div>
              </div>

              {/* Explorer Link */}
              {selectedTx.tx_hash && (
                <Button
                  onClick={() => window.open(getExplorerUrl(selectedTx), '_blank')}
                  variant="outline"
                  className="w-full h-11 rounded-[10px] border-white/20 text-white hover:bg-white/5"
                  data-testid="view-explorer-link"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View in Explorer
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
