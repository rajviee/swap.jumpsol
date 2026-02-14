import { useState, useEffect, useCallback, memo } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { 
  ArrowRight, 
  Copy, 
  Check, 
  Clock, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { transactionApi } from '../services/api';

// TRON API service
const tronApi = {
  async createSwap(data) {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tron/swap/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create swap');
    return response.json();
  },
  
  async getEstimate(data) {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tron/swap/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to get estimate');
    return response.json();
  },
  
  async getStatus(orderId) {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tron/swap/${orderId}`);
    if (!response.ok) throw new Error('Failed to get status');
    return response.json();
  },
  
  async checkDeposit(orderId) {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tron/swap/${orderId}/check-deposit`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to check deposit');
    return response.json();
  }
};

// State labels and colors
const STATE_INFO = {
  deposit_pending: { label: 'Waiting for Deposit', color: 'text-yellow-400', icon: Clock },
  received: { label: 'Deposit Received', color: 'text-green-400', icon: CheckCircle2 },
  swapping: { label: 'Swapping TRX → USDT', color: 'text-blue-400', icon: Loader2 },
  swapped: { label: 'Swap Complete', color: 'text-green-400', icon: CheckCircle2 },
  bridging: { label: 'Bridging to Ethereum', color: 'text-blue-400', icon: Loader2 },
  bridged: { label: 'Bridge Complete', color: 'text-green-400', icon: CheckCircle2 },
  routing: { label: 'Routing via LI.FI', color: 'text-blue-400', icon: Loader2 },
  routed: { label: 'Routing Complete', color: 'text-green-400', icon: CheckCircle2 },
  settling: { label: 'Final Settlement', color: 'text-blue-400', icon: Loader2 },
  settled: { label: 'Complete!', color: 'text-[#C1FF72]', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'text-red-400', icon: AlertCircle }
};

// Step indicator component
const StepIndicator = memo(({ steps, currentState }) => {
  const stateOrder = [
    'deposit_pending', 'received', 'swapping', 'swapped', 
    'bridging', 'bridged', 'routing', 'routed', 'settling', 'settled'
  ];
  
  const currentIndex = stateOrder.indexOf(currentState);
  
  return (
    <div className="space-y-2">
      {steps.map((step, idx) => {
        const isComplete = currentIndex > idx * 2 + 1;
        const isActive = currentIndex === idx * 2 || currentIndex === idx * 2 + 1;
        
        return (
          <div 
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
              isComplete ? 'bg-[#C1FF72]/10' : 
              isActive ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 
              'bg-white/5'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isComplete ? 'bg-[#C1FF72] text-black' :
              isActive ? 'bg-blue-500 text-white' :
              'bg-gray-700 text-gray-400'
            }`}>
              {isComplete ? <Check className="w-4 h-4" /> : step.step}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`font-medium ${isComplete || isActive ? 'text-white' : 'text-gray-400'}`}>
                  {step.action}
                </span>
                <span className="text-xs text-gray-500">{step.time}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-0.5">
                <span>{step.provider}</span>
                <span>{step.fee}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
StepIndicator.displayName = 'StepIndicator';

// Deposit address display
const DepositAddressCard = memo(({ address, fromToken, onCopy, copied }) => (
  <div className="bg-[#111] rounded-xl p-4 border border-white/10">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm text-gray-400">Send {fromToken} to this address:</span>
      <span className="text-xs text-yellow-400 flex items-center gap-1">
        <Clock className="w-3 h-3" /> Waiting for deposit
      </span>
    </div>
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-black/50 rounded-lg p-3 font-mono text-sm text-[#C1FF72] break-all">
        {address}
      </code>
      <Button
        variant="outline"
        size="icon"
        onClick={onCopy}
        className="flex-shrink-0 h-10 w-10"
      >
        {copied ? <Check className="w-4 h-4 text-[#C1FF72]" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
    <p className="text-xs text-gray-500 mt-2">
      Only send {fromToken} (TRON network). Other tokens will be lost.
    </p>
  </div>
));
DepositAddressCard.displayName = 'DepositAddressCard';

// Main TRON Swap Modal
export const TronSwapModal = memo(({ 
  open, 
  onClose, 
  fromToken = 'TRX',
  fromAmount = 0,
  toChain = 'SOL',
  toToken = 'USDC',
  toAddress = '',
  userAddress = ''
}) => {
  const [stage, setStage] = useState('estimate'); // estimate, deposit, processing, complete
  const [estimate, setEstimate] = useState(null);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  
  // Reset on open
  useEffect(() => {
    if (open) {
      setStage('estimate');
      setEstimate(null);
      setOrder(null);
      setStatus(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);
  
  // Fetch estimate on open
  useEffect(() => {
    if (open && fromAmount > 0 && stage === 'estimate') {
      fetchEstimate();
    }
  }, [open, fromAmount, fromToken, toChain, toToken]);
  
  // Poll for status updates
  useEffect(() => {
    if (!order || stage !== 'processing') return;
    
    const interval = setInterval(async () => {
      try {
        // Check for deposit first
        if (status?.state === 'deposit_pending') {
          const depositResult = await tronApi.checkDeposit(order.order_id);
          if (depositResult.received) {
            const newStatus = await tronApi.getStatus(order.order_id);
            setStatus(newStatus);
          }
        } else {
          const newStatus = await tronApi.getStatus(order.order_id);
          setStatus(newStatus);
          
          if (newStatus.state === 'settled') {
            setStage('complete');
          } else if (newStatus.state === 'failed') {
            setError(newStatus.error_message || 'Swap failed');
          }
        }
      } catch (e) {
        console.error('Status poll error:', e);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [order, stage, status?.state]);
  
  const fetchEstimate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tronApi.getEstimate({
        from_token: fromToken,
        from_amount: fromAmount,
        to_chain: toChain,
        to_token: toToken
      });
      setEstimate(data);
    } catch (e) {
      setError('Failed to get estimate');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const orderData = await tronApi.createSwap({
        from_token: fromToken,
        to_chain: toChain,
        to_token: toToken,
        to_address: toAddress,
        user_address: userAddress
      });
      setOrder(orderData);
      setStatus({ state: 'deposit_pending', progress: 0 });
      setStage('processing');
    } catch (e) {
      setError('Failed to create swap order');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopyAddress = () => {
    if (order?.deposit_address) {
      navigator.clipboard.writeText(order.deposit_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const stateInfo = status ? STATE_INFO[status.state] : null;
  const StateIcon = stateInfo?.icon || Clock;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[500px] bg-[#0a0a0a] border-white/20 rounded-2xl p-0">
        {/* Header */}
        <div className="p-5 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">
            {stage === 'estimate' && 'TRON Swap Preview'}
            {stage === 'processing' && 'Swap in Progress'}
            {stage === 'complete' && 'Swap Complete!'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {fromToken} (TRON) → {toToken} ({toChain})
          </p>
        </div>
        
        <ScrollArea className="max-h-[70vh]">
          <div className="p-5 space-y-5">
            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}
            
            {/* Stage: Estimate */}
            {stage === 'estimate' && (
              <>
                {loading ? (
                  <div className="py-10 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#C1FF72]" />
                    <span className="text-gray-400">Calculating best route...</span>
                  </div>
                ) : estimate ? (
                  <>
                    {/* Summary */}
                    <div className="bg-[#111] rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400">You send</p>
                          <p className="text-2xl font-bold text-white">
                            {estimate.input_amount.toLocaleString()} {fromToken}
                          </p>
                        </div>
                        <ArrowRight className="w-6 h-6 text-gray-500" />
                        <div className="text-right">
                          <p className="text-sm text-gray-400">You receive</p>
                          <p className="text-2xl font-bold text-[#C1FF72]">
                            ~{estimate.estimated_output.toFixed(2)} {toToken}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10 text-sm">
                        <span className="text-gray-400">Total fees</span>
                        <span className="text-white">${estimate.total_fees_usd.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-gray-400">Estimated time</span>
                        <span className="text-white flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          ~{estimate.estimated_time_minutes} min
                        </span>
                      </div>
                    </div>
                    
                    {/* Steps */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-3">Route Details</h3>
                      <StepIndicator steps={estimate.steps} currentState="deposit_pending" />
                    </div>
                    
                    {/* Start button */}
                    <Button
                      onClick={handleCreateOrder}
                      disabled={loading || !toAddress}
                      className="w-full h-12 bg-[#C1FF72] hover:bg-[#d4ff9e] text-black font-bold"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Start Swap'
                      )}
                    </Button>
                    
                    {!toAddress && (
                      <p className="text-xs text-yellow-400 text-center">
                        Please connect wallet or enter destination address
                      </p>
                    )}
                  </>
                ) : null}
              </>
            )}
            
            {/* Stage: Processing */}
            {stage === 'processing' && order && (
              <>
                {/* Progress indicator */}
                <div className="text-center">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                    status?.state === 'failed' ? 'bg-red-500/20' : 'bg-[#C1FF72]/20'
                  }`}>
                    <StateIcon className={`w-5 h-5 ${stateInfo?.color} ${
                      ['swapping', 'bridging', 'routing', 'settling'].includes(status?.state) 
                        ? 'animate-spin' : ''
                    }`} />
                    <span className={`font-medium ${stateInfo?.color}`}>
                      {stateInfo?.label}
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#C1FF72] transition-all duration-500"
                      style={{ width: `${status?.progress || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{status?.progress || 0}% complete</p>
                </div>
                
                {/* Deposit address (if waiting) */}
                {status?.state === 'deposit_pending' && (
                  <DepositAddressCard
                    address={order.deposit_address}
                    fromToken={fromToken}
                    onCopy={handleCopyAddress}
                    copied={copied}
                  />
                )}
                
                {/* Steps progress */}
                {estimate && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Progress</h3>
                    <StepIndicator steps={estimate.steps} currentState={status?.state} />
                  </div>
                )}
                
                {/* Transaction links */}
                {status?.deposit_txid && (
                  <div className="text-xs text-gray-500">
                    <span>Deposit TX: </span>
                    <a 
                      href={`https://tronscan.org/#/transaction/${status.deposit_txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C1FF72] hover:underline inline-flex items-center gap-1"
                    >
                      {status.deposit_txid.slice(0, 10)}...
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </>
            )}
            
            {/* Stage: Complete */}
            {stage === 'complete' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-[#C1FF72]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#C1FF72]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Swap Complete!</h3>
                <p className="text-gray-400 mb-6">
                  {status?.final_amount?.toFixed(4) || estimate?.estimated_output.toFixed(2)} {toToken} sent to your wallet
                </p>
                
                <Button onClick={onClose} className="bg-[#C1FF72] hover:bg-[#d4ff9e] text-black font-bold">
                  Done
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});
TronSwapModal.displayName = 'TronSwapModal';

export default TronSwapModal;
