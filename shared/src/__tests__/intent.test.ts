import { 
  createIntent, 
  generateIntentId, 
  generatePreimage, 
  generateHashlock,
  calculateMinDestinationAmount,
  isIntentExecutable,
  estimateExecutionTime 
} from '../utils/intent';
import { validateIntent } from '../utils/validation';
import { ChainId } from '../types/chains';
import { IntentStatus } from '../types/intent';
import { NATIVE_TOKEN_ADDRESS } from '../constants';
import { EXAMPLE_INTENTS } from '../examples/intent-examples';

describe('Intent Creation and Utilities', () => {
  test('generateIntentId creates valid hex string', () => {
    const intentId = generateIntentId();
    expect(intentId).toMatch(/^0x[a-f0-9]{64}$/);
    
    // Should generate unique IDs
    const intentId2 = generateIntentId();
    expect(intentId).not.toBe(intentId2);
  });

  test('generatePreimage creates valid hex string', () => {
    const preimage = generatePreimage();
    expect(preimage).toMatch(/^0x[a-f0-9]{64}$/);
  });

  test('generateHashlock creates valid keccak256 hash', () => {
    const preimage = 'test-preimage';
    const hashlock = generateHashlock(preimage);
    expect(hashlock).toMatch(/^0x[a-f0-9]{64}$/);
    
    // Same preimage should generate same hashlock
    const hashlock2 = generateHashlock(preimage);
    expect(hashlock).toBe(hashlock2);
  });

  test('createIntent generates valid intent', () => {
    const intent = createIntent({
      maker: '0x1234567890123456789012345678901234567890',
      sourceChain: ChainId.ETHEREUM_MAINNET,
      sourceToken: {
        chainId: ChainId.ETHEREUM_MAINNET,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
        decimals: 18,
      },
      sourceAmount: '1000000000000000000',
      destinationChain: ChainId.BITCOIN_MAINNET,
      destinationToken: {
        chainId: ChainId.BITCOIN_MAINNET,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'BTC',
        decimals: 8,
      },
      destinationAmount: '2500000',
      destinationAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      slippageBps: 50,
      resolverFeeAmount: '3000000000000000',
    });

    expect(intent.intentId).toMatch(/^0x[a-f0-9]{64}$/);
    expect(intent.status).toBe(IntentStatus.PENDING);
    expect(intent.createdAt).toBeGreaterThan(0);
    expect(intent.expiryTime).toBeGreaterThan(intent.createdAt);
  });

  test('calculateMinDestinationAmount handles slippage correctly', () => {
    const destinationAmount = '1000000000000000000'; // 1 ETH
    const slippageBps = 50; // 0.5%
    
    const minAmount = calculateMinDestinationAmount(destinationAmount, slippageBps);
    expect(minAmount).toBe('995000000000000000'); // 0.995 ETH
  });

  test('isIntentExecutable validates intent status and expiry', () => {
    const validIntent = EXAMPLE_INTENTS.ethToBtc();
    expect(isIntentExecutable(validIntent)).toBe(true);

    // Test expired intent
    const expiredIntent = {
      ...validIntent,
      expiryTime: Math.floor(Date.now() / 1000) - 1000, // 1000 seconds ago
    };
    expect(isIntentExecutable(expiredIntent)).toBe(false);

    // Test non-pending intent
    const matchedIntent = {
      ...validIntent,
      status: IntentStatus.MATCHED,
    };
    expect(isIntentExecutable(matchedIntent)).toBe(false);
  });

  test('estimateExecutionTime returns reasonable estimates', () => {
    const ethToBtc = estimateExecutionTime(ChainId.ETHEREUM_MAINNET, ChainId.BITCOIN_MAINNET);
    expect(ethToBtc).toBeGreaterThan(2000); // Should be > 30 minutes for BTC

    const ethToAptos = estimateExecutionTime(ChainId.ETHEREUM_MAINNET, ChainId.APTOS_MAINNET);
    expect(ethToAptos).toBeLessThanOrEqual(ethToBtc); // Aptos should be faster than or equal to Bitcoin
  });
});

describe('Example Intents Validation', () => {
  test('ETH to BTC intent is valid', () => {
    const intent = EXAMPLE_INTENTS.ethToBtc();
    const validation = validateIntent(intent);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('USDC to APT intent is valid', () => {
    const intent = EXAMPLE_INTENTS.usdcToApt();
    const validation = validateIntent(intent);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('BTC to ATOM intent is valid', () => {
    const intent = EXAMPLE_INTENTS.btcToAtom();
    const validation = validateIntent(intent);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('APT to ETH intent is valid', () => {
    const intent = EXAMPLE_INTENTS.aptToEth();
    const validation = validateIntent(intent);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('Testnet intent is valid', () => {
    const intent = EXAMPLE_INTENTS.testnet();
    const validation = validateIntent(intent);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

describe('Intent Edge Cases', () => {
  test('validates against invalid amounts', () => {
    const intent = createIntent({
      maker: '0x1234567890123456789012345678901234567890',
      sourceChain: ChainId.ETHEREUM_MAINNET,
      sourceToken: {
        chainId: ChainId.ETHEREUM_MAINNET,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
        decimals: 18,
      },
      sourceAmount: '0', // Invalid: zero amount
      destinationChain: ChainId.BITCOIN_MAINNET,
      destinationToken: {
        chainId: ChainId.BITCOIN_MAINNET,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'BTC',
        decimals: 8,
      },
      destinationAmount: '2500000',
      destinationAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      slippageBps: 50,
      resolverFeeAmount: '3000000000000000',
    });

    const validation = validateIntent(intent);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Source amount: Invalid amount');
  });

  test('validates against invalid chain IDs', () => {
    const intent = createIntent({
      maker: '0x1234567890123456789012345678901234567890',
      sourceChain: 999999 as ChainId, // Invalid chain ID
      sourceToken: {
        chainId: 999999 as ChainId,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'UNKNOWN',
        decimals: 18,
      },
      sourceAmount: '1000000000000000000',
      destinationChain: ChainId.BITCOIN_MAINNET,
      destinationToken: {
        chainId: ChainId.BITCOIN_MAINNET,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'BTC',
        decimals: 8,
      },
      destinationAmount: '2500000',
      destinationAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      slippageBps: 50,
      resolverFeeAmount: '3000000000000000',
    });

    const validation = validateIntent(intent);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('chain'))).toBe(true);
  });

  test('validates against extreme slippage', () => {
    const intent = createIntent({
      maker: '0x1234567890123456789012345678901234567890',
      sourceChain: ChainId.ETHEREUM_MAINNET,
      sourceToken: {
        chainId: ChainId.ETHEREUM_MAINNET,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
        decimals: 18,
      },
      sourceAmount: '1000000000000000000',
      destinationChain: ChainId.BITCOIN_MAINNET,
      destinationToken: {
        chainId: ChainId.BITCOIN_MAINNET,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'BTC',
        decimals: 8,
      },
      destinationAmount: '2500000',
      destinationAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      slippageBps: 1500, // 15% - too high
      resolverFeeAmount: '3000000000000000',
    });

    const validation = validateIntent(intent);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('slippage') || e.includes('Slippage'))).toBe(true);
  });
});