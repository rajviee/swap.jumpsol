import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useChains, useTokens, useQuote, formatTokenAmount, formatUSD, formatTimeEstimate, parseTokenAmount } from '../hooks/useLifi';
import { transactionApi } from '../services/api';
import { TokenSelectModal } from './TokenSelectModal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { ArrowDownUp, ChevronDown, Loader2, AlertCircle, Clock, Route, Info, Zap } from 'lucide-react';
import { ethers } from 'ethers';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export const SwapCard = ({ onTransactionComplete }) => {
  const { evmConnected, evmAddress, evmChainId, solanaConnected, solanaAddress, setShowWalletModal } = useWalletStore();
  
  // Form state
  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [fromAmount, setFromAmount] = useState('');
  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  // Get chains and tokens
  const { chains, loading: chainsLoading } = useChains();
  const chainIds = useMemo(() => chains.map(c => c.id), [chains]);
  const { tokens, loading: tokensLoading } = useTokens(chainIds);

  // Quote state
  const { quote, loading: quoteLoading, error: quoteError, fetchQuote, clearQuote } = useQuote();
  
  // Debounce amount for quote fetching
  const debouncedAmount = useDebounce(fromAmount, 500);

  // Get active wallet address
  const walletAddress = evmAddress || solanaAddress;
  const isConnected = evmConnected || solanaConnected;

  // Calculate from amount in wei
  const fromAmountWei = useMemo(() => {
    if (!fromAmount || !fromToken?.decimals) return '0';
    return parseTokenAmount(fromAmount, fromToken.decimals);
  }, [fromAmount, fromToken]);

  // Fetch quote when inputs change
  useEffect(() => {
    if (!fromToken || !toToken || !debouncedAmount || !walletAddress || fromAmountWei === '0') {
      clearQuote();
      return;
    }

    fetchQuote({
      fromChain: fromToken.chainId,
      toChain: toToken.chainId,
      fromToken: fromToken.address,
      toToken: toToken.address,
      fromAmount: fromAmountWei,
      fromAddress: walletAddress,
    });
  }, [fromToken, toToken, debouncedAmount, walletAddress, fromAmountWei, fetchQuote, clearQuote]);

  // Swap from/to tokens
  const handleSwapDirection = () => {
    const tempFrom = fromToken;
    const tempAmount = quote ? formatTokenAmount(quote.estimate.toAmount, toToken?.decimals, 6) : '';
    setFromToken(toToken);
    setToToken(tempFrom);
    setFromAmount(tempAmount);
  };

  // Handle token selection
  const handleSelectFromToken = (token) => {
    setFromToken(token);
    clearQuote();
  };

  const handleSelectToToken = (token) => {
    setToToken(token);
    clearQuote();
  };

  // Execute swap
  const handleSwap = async () => {
    if (!quote || !walletAddress) return;

    setIsSwapping(true);
    
    try {
      // Create transaction record first
      const txRecord = await transactionApi.create({
        wallet_address: walletAddress,
        from_chain_id: fromToken.chainId,
        to_chain_id: toToken.chainId,
        from_token_address: fromToken.address,
        to_token_address: toToken.address,
        from_token_symbol: fromToken.symbol,
        to_token_symbol: toToken.symbol,
        from_amount: fromAmountWei,
        to_amount: quote.estimate.toAmount,
        from_amount_usd: quote.estimate.fromAmountUSD,
        to_amount_usd: quote.estimate.toAmountUSD,
        status: 'pending',
        tx_type: fromToken.chainId === toToken.chainId ? 'swap' : 'bridge',
        route_provider: quote.toolDetails?.name || 'LI.FI',
        gas_fee: quote.estimate.gasCosts?.[0]?.amount,
        gas_fee_usd: quote.estimate.gasCosts?.[0]?.amountUSD,
      });

      // Get the transaction data from quote
      const transactionRequest = quote.transactionRequest;

      if (!transactionRequest) {
        throw new Error('No transaction data available');
      }

      // Execute transaction with MetaMask
      if (evmConnected && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Check if we need to approve token first
        if (quote.estimate.approvalAddress && fromToken.address !== '0x0000000000000000000000000000000000000000') {
          const tokenContract = new ethers.Contract(
            fromToken.address,
            ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
            signer
          );

          const allowance = await tokenContract.allowance(walletAddress, quote.estimate.approvalAddress);
          
          if (allowance < BigInt(fromAmountWei)) {
            toast.info('Approval required. Please confirm in your wallet.');
            const approveTx = await tokenContract.approve(
              quote.estimate.approvalAddress,
              ethers.MaxUint256
            );
            await approveTx.wait();
            toast.success('Token approved!');
          }
        }

        // Send the swap transaction
        toast.info('Please confirm the swap in your wallet');
        const tx = await signer.sendTransaction({
          to: transactionRequest.to,
          data: transactionRequest.data,
          value: transactionRequest.value ? BigInt(transactionRequest.value) : 0n,
          gasLimit: transactionRequest.gasLimit ? BigInt(transactionRequest.gasLimit) : undefined,
        });

        // Update transaction with hash
        await transactionApi.update(txRecord.id, {
          tx_hash: tx.hash,
          status: 'pending',
        });

        toast.success('Transaction submitted!', {
          description: `Hash: ${tx.hash.slice(0, 10)}...`,
        });

        // Wait for confirmation
        const receipt = await tx.wait();
        
        // Update status
        await transactionApi.update(txRecord.id, {
          status: receipt.status === 1 ? 'success' : 'failed',
          gas_fee: receipt.gasUsed.toString(),
        });

        if (receipt.status === 1) {
          toast.success('Swap completed successfully!');
          setFromAmount('');
          clearQuote();
          onTransactionComplete?.();
        } else {
          toast.error('Transaction failed');
        }
      } else if (solanaConnected) {
        // TODO: Implement Solana swap execution
        toast.error('Solana swaps coming soon!');
        await transactionApi.update(txRecord.id, { status: 'failed' });
      }
    } catch (error) {
      console.error('Swap error:', error);
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        toast.error('Transaction rejected');
      } else {
        toast.error(error.message || 'Swap failed');
      }
    } finally {
      setIsSwapping(false);
    }
  };

  // Get button state
  const getButtonState = () => {
    if (!isConnected) return { text: 'Connect Wallet', disabled: false, action: () => setShowWalletModal(true) };
    if (!fromToken) return { text: 'Select From Token', disabled: true };
    if (!toToken) return { text: 'Select To Token', disabled: true };
    if (!fromAmount || parseFloat(fromAmount) <= 0) return { text: 'Enter Amount', disabled: true };
    if (quoteLoading) return { text: 'Getting Quote...', disabled: true };
    if (quoteError) return { text: 'Route Unavailable', disabled: true };
    if (!quote) return { text: 'Getting Quote...', disabled: true };
    if (isSwapping) return { text: 'Swapping...', disabled: true };
    return { text: 'Swap', disabled: false, action: handleSwap };
  };

  const buttonState = getButtonState();

  return (
    <>
      <div className="swap-card animate-fade-in" data-testid="swap-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Swap</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="w-3 h-3" />
            <span>Powered by LI.FI</span>
          </div>
        </div>

        {/* From Section */}
        <div className="bg-[#111] rounded-[10px] p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">From</span>
            {fromToken && quote && (
              <span className="text-xs text-gray-500">
                ~{formatUSD(quote.estimate.fromAmountUSD)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setFromAmount(value);
                }
              }}
              className="flex-1 h-14 bg-transparent border-none text-2xl font-mono text-white placeholder:text-gray-600 focus-visible:ring-0 p-0"
              data-testid="from-amount-input"
            />
            <button
              onClick={() => setShowFromModal(true)}
              className="token-selector"
              data-testid="from-token-select"
            >
              {fromToken ? (
                <>
                  {fromToken.logoURI && (
                    <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                  )}
                  <span className="font-semibold text-white">{fromToken.symbol}</span>
                </>
              ) : (
                <span className="text-gray-400">Select</span>
              )}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          {fromToken && (
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>on {chains.find(c => c.id === fromToken.chainId)?.name || 'Unknown'}</span>
            </div>
          )}
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={handleSwapDirection}
            className="swap-arrow-btn"
            disabled={!fromToken && !toToken}
            data-testid="swap-direction-btn"
          >
            <ArrowDownUp className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* To Section */}
        <div className="bg-[#111] rounded-[10px] p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">To</span>
            {toToken && quote && (
              <span className="text-xs text-gray-500">
                ~{formatUSD(quote.estimate.toAmountUSD)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {quoteLoading ? (
              <Skeleton className="flex-1 h-14 bg-[#222] rounded-[10px]" />
            ) : (
              <div className="flex-1 h-14 flex items-center">
                <span className="text-2xl font-mono text-white">
                  {quote ? formatTokenAmount(quote.estimate.toAmount, toToken?.decimals, 6) : '0.0'}
                </span>
              </div>
            )}
            <button
              onClick={() => setShowToModal(true)}
              className="token-selector"
              data-testid="to-token-select"
            >
              {toToken ? (
                <>
                  {toToken.logoURI && (
                    <img src={toToken.logoURI} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                  )}
                  <span className="font-semibold text-white">{toToken.symbol}</span>
                </>
              ) : (
                <span className="text-gray-400">Select</span>
              )}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          {toToken && (
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>on {chains.find(c => c.id === toToken.chainId)?.name || 'Unknown'}</span>
            </div>
          )}
        </div>

        {/* Quote Details */}
        {quote && !quoteError && (
          <div className="route-info mt-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <Route className="w-4 h-4 text-[#C1FF72]" />
              <span className="text-sm font-medium text-white">Route Details</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Provider</span>
                <span className="text-white">{quote.toolDetails?.name || 'LI.FI'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Estimated Time</span>
                <span className="text-white flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeEstimate(quote.estimate.executionDuration)}
                </span>
              </div>
              {quote.estimate.gasCosts?.[0] && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Gas Fee</span>
                  <span className="text-white">~{formatUSD(quote.estimate.gasCosts[0].amountUSD)}</span>
                </div>
              )}
              {quote.estimate.feeCosts?.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Protocol Fee</span>
                  <span className="text-white">~{formatUSD(quote.estimate.feeCosts[0]?.amountUSD || '0')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {quoteError && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-[#E74C3C]/10 border border-[#E74C3C]/20 rounded-[10px]">
            <AlertCircle className="w-4 h-4 text-[#E74C3C] flex-shrink-0" />
            <span className="text-sm text-[#E74C3C]">{quoteError}</span>
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={buttonState.action}
          disabled={buttonState.disabled}
          className="w-full h-14 mt-4 rounded-[10px] bg-[#C1FF72] text-black font-bold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          data-testid="swap-button"
        >
          {(quoteLoading || isSwapping) && (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          )}
          {buttonState.text}
        </Button>
      </div>

      {/* Token Selection Modals */}
      <TokenSelectModal
        open={showFromModal}
        onClose={() => setShowFromModal(false)}
        onSelect={handleSelectFromToken}
        tokens={tokens}
        chains={chains}
        selectedChainId={fromToken?.chainId}
        selectedToken={fromToken}
        title="Select From Token"
        loading={tokensLoading || chainsLoading}
      />

      <TokenSelectModal
        open={showToModal}
        onClose={() => setShowToModal(false)}
        onSelect={handleSelectToToken}
        tokens={tokens}
        chains={chains}
        selectedChainId={toToken?.chainId}
        selectedToken={toToken}
        title="Select To Token"
        loading={tokensLoading || chainsLoading}
      />
    </>
  );
};
