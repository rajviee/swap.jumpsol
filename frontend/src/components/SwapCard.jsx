import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useWalletStore, SOLANA_CHAIN_ID, TRON_CHAIN_ID, BITCOIN_CHAIN_ID } from '../store/walletStore';
import { useChains, useTokens, useQuote, formatTokenAmount, formatUSD, formatTimeEstimate, parseTokenAmount, CHAIN_INFO, isChainSupported } from '../hooks/useLifi';
import { transactionApi } from '../services/api';
import { TokenSelectModal } from './TokenSelectModal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { ArrowDownUp, ChevronDown, Loader2, AlertCircle, Clock, Route, Zap, AlertTriangle } from 'lucide-react';
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

// Memoized token button
const TokenButton = memo(({ token, onClick, testId }) => {
  const [imgError, setImgError] = useState(false);
  
  return (
    <button
      onClick={onClick}
      className="token-selector flex items-center gap-2 px-2 sm:px-3 py-2 bg-[#111] border border-white/20 rounded-[10px] hover:border-white/40 transition-colors flex-shrink-0"
      data-testid={testId}
    >
      {token ? (
        <>
          {token.logoURI && !imgError ? (
            <img 
              src={token.logoURI} 
              alt={token.symbol} 
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#333] flex items-center justify-center text-xs font-bold text-white">
              {token.symbol?.charAt(0) || '?'}
            </div>
          )}
          <span className="font-semibold text-white text-sm sm:text-base">{token.symbol}</span>
        </>
      ) : (
        <span className="text-gray-400 text-sm">Select</span>
      )}
      <ChevronDown className="w-4 h-4 text-gray-400" />
    </button>
  );
});

TokenButton.displayName = 'TokenButton';

export const SwapCard = memo(({ onTransactionComplete }) => {
  const { 
    evmConnected, 
    evmAddress, 
    solanaConnected, 
    solanaAddress,
    tronConnected,
    tronAddress,
    setShowWalletModal,
    activeWalletType,
  } = useWalletStore();
  
  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [fromAmount, setFromAmount] = useState('');
  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const { chains, loading: chainsLoading } = useChains();
  const chainIds = useMemo(() => chains.map(c => c.id), [chains]);
  const { tokens, loading: tokensLoading } = useTokens(chainIds);
  const { quote, loading: quoteLoading, error: quoteError, fetchQuote, clearQuote } = useQuote();
  
  const debouncedAmount = useDebounce(fromAmount, 500);

  const walletAddress = useMemo(() => {
    if (activeWalletType === 'tron') return tronAddress;
    if (activeWalletType === 'solana') return solanaAddress;
    if (activeWalletType === 'evm') return evmAddress;
    return evmAddress || solanaAddress || tronAddress;
  }, [activeWalletType, evmAddress, solanaAddress, tronAddress]);
  
  const isConnected = evmConnected || solanaConnected || tronConnected;
  
  const shouldDefaultToSolana = useMemo(() => {
    return activeWalletType === 'solana' || (solanaConnected && !evmConnected && !tronConnected);
  }, [activeWalletType, solanaConnected, evmConnected, tronConnected]);

  const fromAmountWei = useMemo(() => {
    if (!fromAmount || !fromToken?.decimals) return '0';
    return parseTokenAmount(fromAmount, fromToken.decimals);
  }, [fromAmount, fromToken]);

  // Check if selected tokens are on supported chains
  const isFromChainSupported = fromToken ? isChainSupported(fromToken.chainId) : true;
  const isToChainSupported = toToken ? isChainSupported(toToken.chainId) : true;
  const areChainsSupported = isFromChainSupported && isToChainSupported;

  useEffect(() => {
    if (!fromToken || !toToken || !debouncedAmount || !walletAddress || fromAmountWei === '0') {
      clearQuote();
      return;
    }
    
    if (!areChainsSupported) {
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
  }, [fromToken, toToken, debouncedAmount, walletAddress, fromAmountWei, fetchQuote, clearQuote, areChainsSupported]);

  const handleSwapDirection = useCallback(() => {
    const tempFrom = fromToken;
    const tempAmount = quote ? formatTokenAmount(quote.estimate.toAmount, toToken?.decimals, 6) : '';
    setFromToken(toToken);
    setToToken(tempFrom);
    setFromAmount(tempAmount);
  }, [fromToken, toToken, quote]);

  const handleSelectFromToken = useCallback((token) => {
    setFromToken(token);
    clearQuote();
  }, [clearQuote]);

  const handleSelectToToken = useCallback((token) => {
    setToToken(token);
    clearQuote();
  }, [clearQuote]);

  const handleAmountChange = useCallback((e) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFromAmount(value);
    }
  }, []);

  const handleSwap = useCallback(async () => {
    if (!quote || !walletAddress) return;

    setIsSwapping(true);
    
    try {
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

      const transactionRequest = quote.transactionRequest;

      if (!transactionRequest) {
        throw new Error('No transaction data available');
      }

      if (fromToken.chainId === SOLANA_CHAIN_ID) {
        toast.info('Solana swaps require Phantom wallet signing');
        await transactionApi.update(txRecord.id, { status: 'failed' });
        toast.error('Solana swap execution coming soon');
        return;
      }

      if (evmConnected && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        if (quote.estimate.approvalAddress && fromToken.address !== '0x0000000000000000000000000000000000000000') {
          const tokenContract = new ethers.Contract(
            fromToken.address,
            ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
            signer
          );

          const allowance = await tokenContract.allowance(walletAddress, quote.estimate.approvalAddress);
          
          if (allowance < BigInt(fromAmountWei)) {
            toast.info('Approval required. Please confirm in your wallet.');
            const approveTx = await tokenContract.approve(quote.estimate.approvalAddress, ethers.MaxUint256);
            await approveTx.wait();
            toast.success('Token approved!');
          }
        }

        toast.info('Please confirm the swap in your wallet');
        const tx = await signer.sendTransaction({
          to: transactionRequest.to,
          data: transactionRequest.data,
          value: transactionRequest.value ? BigInt(transactionRequest.value) : 0n,
          gasLimit: transactionRequest.gasLimit ? BigInt(transactionRequest.gasLimit) : undefined,
        });

        await transactionApi.update(txRecord.id, { tx_hash: tx.hash, status: 'pending' });
        toast.success('Transaction submitted!', { description: `Hash: ${tx.hash.slice(0, 10)}...` });

        const receipt = await tx.wait();
        
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
  }, [quote, walletAddress, fromToken, toToken, fromAmountWei, evmConnected, clearQuote, onTransactionComplete]);

  const getChainName = useCallback((chainId) => {
    const chain = chains.find(c => c.id === chainId);
    return chain?.name || CHAIN_INFO[chainId]?.name || 'Unknown';
  }, [chains]);

  const buttonState = useMemo(() => {
    if (!isConnected) return { text: 'Connect Wallet', disabled: false, action: () => setShowWalletModal(true) };
    if (!fromToken) return { text: 'Select From Token', disabled: true };
    if (!toToken) return { text: 'Select To Token', disabled: true };
    if (!fromAmount || parseFloat(fromAmount) <= 0) return { text: 'Enter Amount', disabled: true };
    if (!areChainsSupported) return { text: 'Chain Not Supported', disabled: true };
    if (quoteLoading) return { text: 'Getting Quote...', disabled: true };
    if (quoteError) return { text: 'Route Unavailable', disabled: true };
    if (!quote) return { text: 'Getting Quote...', disabled: true };
    if (isSwapping) return { text: 'Swapping...', disabled: true };
    return { text: 'Swap', disabled: false, action: handleSwap };
  }, [isConnected, fromToken, toToken, fromAmount, areChainsSupported, quoteLoading, quoteError, quote, isSwapping, handleSwap, setShowWalletModal]);

  return (
    <>
      <div className="swap-card bg-black border border-white/50 rounded-[10px] p-4 sm:p-6 w-full max-w-[480px] mx-auto animate-fade-in" data-testid="swap-card">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-white">Swap</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="w-3 h-3" />
            <span className="hidden sm:inline">Powered by LI.FI</span>
          </div>
        </div>

        {/* From Section */}
        <div className="bg-[#111] rounded-[10px] p-3 sm:p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-500">From</span>
            {fromToken && quote && (
              <span className="text-xs text-gray-500">~{formatUSD(quote.estimate.fromAmountUSD)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={fromAmount}
              onChange={handleAmountChange}
              className="flex-1 h-12 sm:h-14 bg-transparent border-none text-xl sm:text-2xl font-mono text-white placeholder:text-gray-600 focus-visible:ring-0 p-0"
              data-testid="from-amount-input"
            />
            <TokenButton token={fromToken} onClick={() => setShowFromModal(true)} testId="from-token-select" />
          </div>
          {fromToken && (
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              {CHAIN_INFO[fromToken.chainId]?.logoURI && (
                <img src={CHAIN_INFO[fromToken.chainId].logoURI} alt="" className="w-3 h-3 sm:w-4 sm:h-4 rounded-full" />
              )}
              <span>on {getChainName(fromToken.chainId)}</span>
              {!isFromChainSupported && (
                <span className="text-yellow-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Coming soon
                </span>
              )}
            </div>
          )}
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={handleSwapDirection}
            className="w-10 h-10 rounded-[10px] bg-[#111] border border-white/20 flex items-center justify-center hover:bg-[#1a1a1a] hover:border-[#C1FF72] transition-colors"
            disabled={!fromToken && !toToken}
            data-testid="swap-direction-btn"
          >
            <ArrowDownUp className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* To Section */}
        <div className="bg-[#111] rounded-[10px] p-3 sm:p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-500">To</span>
            {toToken && quote && (
              <span className="text-xs text-gray-500">~{formatUSD(quote.estimate.toAmountUSD)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {quoteLoading ? (
              <Skeleton className="flex-1 h-12 sm:h-14 bg-[#222] rounded-[10px]" />
            ) : (
              <div className="flex-1 h-12 sm:h-14 flex items-center">
                <span className="text-xl sm:text-2xl font-mono text-white">
                  {quote ? formatTokenAmount(quote.estimate.toAmount, toToken?.decimals, 6) : '0.0'}
                </span>
              </div>
            )}
            <TokenButton token={toToken} onClick={() => setShowToModal(true)} testId="to-token-select" />
          </div>
          {toToken && (
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              {CHAIN_INFO[toToken.chainId]?.logoURI && (
                <img src={CHAIN_INFO[toToken.chainId].logoURI} alt="" className="w-3 h-3 sm:w-4 sm:h-4 rounded-full" />
              )}
              <span>on {getChainName(toToken.chainId)}</span>
              {!isToChainSupported && (
                <span className="text-yellow-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Coming soon
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quote Details */}
        {quote && !quoteError && areChainsSupported && (
          <div className="mt-4 p-3 sm:p-4 bg-[#0a0a0a] border border-white/10 rounded-[10px] animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <Route className="w-4 h-4 text-[#C1FF72]" />
              <span className="text-sm font-medium text-white">Route</span>
            </div>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Provider</span>
                <span className="text-white">{quote.toolDetails?.name || 'LI.FI'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Time</span>
                <span className="text-white flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeEstimate(quote.estimate.executionDuration)}
                </span>
              </div>
              {quote.estimate.gasCosts?.[0] && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Gas</span>
                  <span className="text-white">~{formatUSD(quote.estimate.gasCosts[0].amountUSD)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {quoteError && areChainsSupported && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-[#E74C3C]/10 border border-[#E74C3C]/20 rounded-[10px]">
            <AlertCircle className="w-4 h-4 text-[#E74C3C] flex-shrink-0" />
            <span className="text-xs sm:text-sm text-[#E74C3C]">{quoteError}</span>
          </div>
        )}

        {/* Unsupported Chain Warning */}
        {!areChainsSupported && fromToken && toToken && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-[10px]">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <span className="text-xs sm:text-sm text-yellow-500">
              {!isFromChainSupported ? getChainName(fromToken.chainId) : getChainName(toToken.chainId)} swaps coming soon
            </span>
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={buttonState.action}
          disabled={buttonState.disabled}
          className="w-full h-12 sm:h-14 mt-4 rounded-[10px] bg-[#C1FF72] text-black font-bold text-base sm:text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          data-testid="swap-button"
        >
          {(quoteLoading || isSwapping) && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
          {buttonState.text}
        </Button>
      </div>

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
        defaultToSolana={shouldDefaultToSolana}
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
        defaultToSolana={shouldDefaultToSolana}
      />
    </>
  );
});

SwapCard.displayName = 'SwapCard';
