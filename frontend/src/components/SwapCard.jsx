import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useWalletStore, SOLANA_CHAIN_ID, TRON_CHAIN_ID } from '../store/walletStore';
import { useChains, useTokens, useQuote, formatTokenAmount, formatUSD, formatTime, parseTokenAmount, CHAIN_INFO, isSwapSupported, getChainName } from '../hooks/useLifi';
import { transactionApi } from '../services/api';
import { TokenSelectModal } from './TokenSelectModal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { ArrowDownUp, ChevronDown, Loader2, AlertCircle, Clock, Route, AlertTriangle } from 'lucide-react';
import { ethers } from 'ethers';

// Debounce hook
function useDebounce(val, ms) {
  const [debounced, setDebounced] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return debounced;
}

// Token button
const TokenBtn = memo(({ token, onClick, testId }) => {
  const [err, setErr] = useState(false);
  const logo = token?.logoURI || token?.logo;
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 bg-[#111] border border-white/20 rounded-lg hover:border-white/40 transition-colors flex-shrink-0"
      data-testid={testId}
    >
      {token ? (
        <>
          {logo && !err ? (
            <img src={logo} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" onError={() => setErr(true)} />
          ) : (
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#333] flex items-center justify-center text-xs font-bold">{token.symbol?.[0]}</div>
          )}
          <span className="font-semibold text-sm">{token.symbol}</span>
        </>
      ) : (
        <span className="text-gray-400 text-sm">Select</span>
      )}
      <ChevronDown className="w-4 h-4 text-gray-400" />
    </button>
  );
});
TokenBtn.displayName = 'TokenBtn';

export const SwapCard = memo(({ onTxComplete }) => {
  const { evmConnected, evmAddress, solanaConnected, solanaAddress, tronConnected, tronAddress, setShowWalletModal, activeWalletType, lastUsedChainId } = useWalletStore();
  
  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [amount, setAmount] = useState('');
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const { chains, loading: chainsLoading } = useChains();
  const chainIds = useMemo(() => chains.map(c => c.id), [chains]);
  const { tokens, loading: tokensLoading } = useTokens(chainIds);
  const { quote, loading: quoteLoading, error: quoteError, fetchQuote, clearQuote } = useQuote();
  
  const debouncedAmount = useDebounce(amount, 500);

  const address = useMemo(() => {
    if (activeWalletType === 'tron') return tronAddress;
    if (activeWalletType === 'solana') return solanaAddress;
    return evmAddress || solanaAddress || tronAddress;
  }, [activeWalletType, evmAddress, solanaAddress, tronAddress]);
  
  const connected = evmConnected || solanaConnected || tronConnected;

  const amountWei = useMemo(() => {
    if (!amount || !fromToken?.decimals) return '0';
    return parseTokenAmount(amount, fromToken.decimals);
  }, [amount, fromToken]);

  const fromSupported = fromToken ? isSwapSupported(fromToken.chainId) : true;
  const toSupported = toToken ? isSwapSupported(toToken.chainId) : true;
  const bothSupported = fromSupported && toSupported;

  // Fetch quote
  useEffect(() => {
    if (!fromToken || !toToken || !debouncedAmount || !address || amountWei === '0' || !bothSupported) {
      clearQuote();
      return;
    }
    fetchQuote({
      fromChain: fromToken.chainId,
      toChain: toToken.chainId,
      fromToken: fromToken.address,
      toToken: toToken.address,
      fromAmount: amountWei,
      fromAddress: address,
    });
  }, [fromToken, toToken, debouncedAmount, address, amountWei, bothSupported, fetchQuote, clearQuote]);

  const swapDirection = useCallback(() => {
    const temp = fromToken;
    const tempAmount = quote ? formatTokenAmount(quote.estimate.toAmount, toToken?.decimals, 6) : '';
    setFromToken(toToken);
    setToToken(temp);
    setAmount(tempAmount);
  }, [fromToken, toToken, quote]);

  const selectFrom = useCallback((t) => { setFromToken(t); clearQuote(); }, [clearQuote]);
  const selectTo = useCallback((t) => { setToToken(t); clearQuote(); }, [clearQuote]);

  const onAmountChange = useCallback((e) => {
    const v = e.target.value.replace(/[^0-9.]/g, '');
    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
  }, []);

  const handleSwap = useCallback(async () => {
    if (!quote || !address) return;
    setSwapping(true);
    
    try {
      const txRec = await transactionApi.create({
        wallet_address: address,
        from_chain_id: fromToken.chainId,
        to_chain_id: toToken.chainId,
        from_token_address: fromToken.address,
        to_token_address: toToken.address,
        from_token_symbol: fromToken.symbol,
        to_token_symbol: toToken.symbol,
        from_amount: amountWei,
        to_amount: quote.estimate.toAmount,
        from_amount_usd: quote.estimate.fromAmountUSD,
        to_amount_usd: quote.estimate.toAmountUSD,
        status: 'pending',
        tx_type: fromToken.chainId === toToken.chainId ? 'swap' : 'bridge',
        route_provider: quote.toolDetails?.name || 'LI.FI',
        gas_fee: quote.estimate.gasCosts?.[0]?.amount,
        gas_fee_usd: quote.estimate.gasCosts?.[0]?.amountUSD,
      });

      const txReq = quote.transactionRequest;
      if (!txReq) throw new Error('No transaction data');

      if (fromToken.chainId === SOLANA_CHAIN_ID) {
        toast.error('Solana swaps coming soon');
        await transactionApi.update(txRec.id, { status: 'failed' });
        return;
      }

      if (evmConnected && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Approval if needed
        if (quote.estimate.approvalAddress && fromToken.address !== '0x0000000000000000000000000000000000000000') {
          const contract = new ethers.Contract(fromToken.address, ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'], signer);
          const allowance = await contract.allowance(address, quote.estimate.approvalAddress);
          if (allowance < BigInt(amountWei)) {
            toast.info('Approval needed');
            const appTx = await contract.approve(quote.estimate.approvalAddress, ethers.MaxUint256);
            await appTx.wait();
            toast.success('Approved');
          }
        }

        toast.info('Confirm in wallet');
        const tx = await signer.sendTransaction({
          to: txReq.to,
          data: txReq.data,
          value: txReq.value ? BigInt(txReq.value) : 0n,
          gasLimit: txReq.gasLimit ? BigInt(txReq.gasLimit) : undefined,
        });

        await transactionApi.update(txRec.id, { tx_hash: tx.hash, status: 'pending' });
        toast.success('Submitted');

        const receipt = await tx.wait();
        await transactionApi.update(txRec.id, { status: receipt.status === 1 ? 'success' : 'failed', gas_fee: receipt.gasUsed.toString() });

        if (receipt.status === 1) {
          toast.success('Swap complete!');
          setAmount('');
          clearQuote();
          onTxComplete?.();
        } else {
          toast.error('Transaction failed');
        }
      }
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') toast.error('Rejected');
      else toast.error(err.message || 'Swap failed');
    } finally {
      setSwapping(false);
    }
  }, [quote, address, fromToken, toToken, amountWei, evmConnected, clearQuote, onTxComplete]);

  const btnState = useMemo(() => {
    if (!connected) return { text: 'Connect Wallet', disabled: false, action: () => setShowWalletModal(true) };
    if (!fromToken) return { text: 'Select token', disabled: true };
    if (!toToken) return { text: 'Select token', disabled: true };
    if (!amount || parseFloat(amount) <= 0) return { text: 'Enter amount', disabled: true };
    if (!bothSupported) return { text: 'Chain not supported', disabled: true };
    if (quoteLoading) return { text: 'Getting quote...', disabled: true };
    if (quoteError) return { text: 'Route unavailable', disabled: true };
    if (!quote) return { text: 'Getting quote...', disabled: true };
    if (swapping) return { text: 'Swapping...', disabled: true };
    return { text: 'Swap', disabled: false, action: handleSwap };
  }, [connected, fromToken, toToken, amount, bothSupported, quoteLoading, quoteError, quote, swapping, handleSwap, setShowWalletModal]);

  return (
    <>
      <div className="swap-card bg-black border border-white/50 rounded-xl p-4 sm:p-5 mx-auto animate-fade-in" data-testid="swap-card">
        <h2 className="text-lg font-bold text-white mb-4">Swap</h2>

        {/* From */}
        <div className="bg-[#111] rounded-lg p-3 sm:p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">From</span>
            {fromToken && quote && <span className="text-xs text-gray-500">~{formatUSD(quote.estimate.fromAmountUSD)}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={onAmountChange}
              className="flex-1 h-12 bg-transparent border-none text-xl font-mono text-white placeholder:text-gray-600 focus-visible:ring-0 p-0"
              data-testid="from-amount"
            />
            <TokenBtn token={fromToken} onClick={() => setShowFrom(true)} testId="from-token" />
          </div>
          {fromToken && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
              {CHAIN_INFO[fromToken.chainId]?.logo && <img src={CHAIN_INFO[fromToken.chainId].logo} alt="" className="w-3.5 h-3.5 rounded-full" />}
              <span>on {getChainName(fromToken.chainId)}</span>
              {!fromSupported && <span className="text-yellow-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Not supported</span>}
              {fromSupported && fromRequiresBridge && <span className="text-yellow-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Bridge</span>}
            </div>
          )}
        </div>

        {/* Swap direction */}
        <div className="flex justify-center -my-3 relative z-10">
          <button onClick={swapDirection} className="w-9 h-9 rounded-lg bg-[#111] border border-white/20 flex items-center justify-center hover:border-[#C1FF72] transition-colors" disabled={!fromToken && !toToken} data-testid="swap-dir">
            <ArrowDownUp className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* To */}
        <div className="bg-[#111] rounded-lg p-3 sm:p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">To</span>
            {toToken && quote && <span className="text-xs text-gray-500">~{formatUSD(quote.estimate.toAmountUSD)}</span>}
          </div>
          <div className="flex items-center gap-2">
            {quoteLoading ? (
              <Skeleton className="flex-1 h-12 bg-[#222] rounded-lg" />
            ) : (
              <div className="flex-1 h-12 flex items-center">
                <span className="text-xl font-mono text-white">{quote ? formatTokenAmount(quote.estimate.toAmount, toToken?.decimals, 6) : '0.0'}</span>
              </div>
            )}
            <TokenBtn token={toToken} onClick={() => setShowTo(true)} testId="to-token" />
          </div>
          {toToken && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
              {CHAIN_INFO[toToken.chainId]?.logo && <img src={CHAIN_INFO[toToken.chainId].logo} alt="" className="w-3.5 h-3.5 rounded-full" />}
              <span>on {getChainName(toToken.chainId)}</span>
              {!toSupported && <span className="text-yellow-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Not supported</span>}
              {toSupported && toRequiresBridge && <span className="text-yellow-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Bridge</span>}
            </div>
          )}
        </div>

        {/* Route info */}
        {quote && !quoteError && bothSupported && (
          <div className="mt-4 p-3 bg-[#0a0a0a] border border-white/10 rounded-lg animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Route className="w-4 h-4 text-[#C1FF72]" />
              <span className="text-sm font-medium text-white">Route</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Provider</span><span className="text-white">{quote.toolDetails?.name || 'LI.FI'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="text-white flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(quote.estimate.executionDuration)}</span></div>
              {quote.estimate.gasCosts?.[0] && <div className="flex justify-between"><span className="text-gray-500">Gas</span><span className="text-white">~{formatUSD(quote.estimate.gasCosts[0].amountUSD)}</span></div>}
            </div>
          </div>
        )}

        {/* Errors/Warnings */}
        {quoteError && bothSupported && (
          <div className="mt-4 p-2.5 bg-[#E74C3C]/10 border border-[#E74C3C]/20 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#E74C3C]" />
            <span className="text-xs text-[#E74C3C]">{quoteError}</span>
          </div>
        )}
        {!bothSupported && fromToken && toToken && (
          <div className="mt-4 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-yellow-500">{!fromSupported ? getChainName(fromToken.chainId) : getChainName(toToken.chainId)} swaps not supported</span>
          </div>
        )}

        {/* Button */}
        <Button
          onClick={btnState.action}
          disabled={btnState.disabled}
          className="w-full h-12 mt-4 rounded-lg bg-[#C1FF72] text-black font-bold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="swap-btn"
        >
          {(quoteLoading || swapping) && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
          {btnState.text}
        </Button>
      </div>

      {/* Modals */}
      <TokenSelectModal
        open={showFrom}
        onClose={() => setShowFrom(false)}
        onSelect={selectFrom}
        tokens={tokens}
        chains={chains}
        selectedChainId={fromToken?.chainId}
        selectedToken={fromToken}
        title="Select From Token"
        loading={tokensLoading || chainsLoading}
        defaultChainId={lastUsedChainId}
        isFrom={true}
      />
      <TokenSelectModal
        open={showTo}
        onClose={() => setShowTo(false)}
        onSelect={selectTo}
        tokens={tokens}
        chains={chains}
        selectedChainId={toToken?.chainId}
        selectedToken={toToken}
        title="Select To Token"
        loading={tokensLoading || chainsLoading}
        defaultChainId={lastUsedChainId}
        isFrom={false}
      />
    </>
  );
});
SwapCard.displayName = 'SwapCard';
