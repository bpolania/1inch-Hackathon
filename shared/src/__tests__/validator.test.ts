import { Wallet } from 'ethers';
import { 
  createValidator, 
  validateSignedIntentQuick, 
  validateIntentQuick 
} from '../utils/validator';
import { signIntentWithPrivateKey } from '../utils/signing';
import { EXAMPLE_INTENTS } from '../examples/intent-examples';
import { ChainId } from '../types/chains';

describe('Intent Validator', () => {
  const testPrivateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
  const testWallet = new Wallet(testPrivateKey);
  const testAddress = testWallet.address;

  test('validates correct signed intent', async () => {
    const validator = createValidator(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    const result = validator.validateSignedIntent(signedIntent);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    // Warnings are optional and may not be present for valid intents
  });

  test('detects signature mismatch with maker', async () => {
    const validator = createValidator(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = '0x9999999999999999999999999999999999999999'; // Different from signer
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    const result = validator.validateSignedIntent(signedIntent);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('signer does not match'))).toBe(true);
  });

  test('provides business rule warnings', async () => {
    const validator = createValidator(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    // Set very low resolver fee
    intent.resolverFeeAmount = '100'; // Very small fee (0.0001% of 1 ETH)
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    const result = validator.validateSignedIntent(signedIntent);
    
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some(w => w.includes('too low'))).toBe(true);
  });

  test('warns about high slippage', async () => {
    const validator = createValidator(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    intent.slippageBps = 600; // 6% slippage
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    const result = validator.validateSignedIntent(signedIntent);
    
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some(w => w.includes('slippage'))).toBe(true);
  });

  test('warns about same-chain swaps', async () => {
    const validator = createValidator(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    intent.destinationChain = intent.sourceChain; // Same chain (Ethereum)
    intent.destinationToken = intent.sourceToken; // Same token (ETH)
    intent.destinationAddress = testAddress; // Valid Ethereum address
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    const result = validator.validateSignedIntent(signedIntent);
    
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some(w => w.includes('Same-chain'))).toBe(true);
  });

  test('detects intents expiring too soon', async () => {
    const validator = createValidator(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    intent.expiryTime = Math.floor(Date.now() / 1000) + 120; // 2 minutes from now
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    const result = validator.validateSignedIntent(signedIntent);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('expires too soon'))).toBe(true);
  });

  test('quick validation functions work', async () => {
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    // Test quick intent validation
    expect(validateIntentQuick(intent)).toBe(true);
    
    // Test quick signed intent validation
    expect(validateSignedIntentQuick(
      signedIntent,
      testAddress,
      ChainId.ETHEREUM_MAINNET
    )).toBe(true);
    
    // Should fail with wrong signer
    expect(validateSignedIntentQuick(
      signedIntent,
      '0x1234567890123456789012345678901234567890',
      ChainId.ETHEREUM_MAINNET
    )).toBe(false);
  });

  test('validator can update options', async () => {
    const validator = createValidator();
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    // First test intent-only validation (no signature check)
    let result = validator.validateIntent(intent);
    expect(result.valid).toBe(true);
    
    // Create signed intent with chainId
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    // Update validator options to match signing
    validator.updateOptions(ChainId.ETHEREUM_MAINNET);
    
    // Now signature validation should work
    result = validator.validateSignedIntent(signedIntent);
    expect(result.valid).toBe(true);
  });

  test('handles invalid signature gracefully', async () => {
    const validator = createValidator(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    const invalidSignedIntent = {
      intent,
      signature: '0xinvalid',
    };
    
    const result = validator.validateSignedIntent(invalidSignedIntent);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Signature validation failed'))).toBe(true);
  });

  test('validates with expected signer option', async () => {
    const validator = createValidator(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    // Should pass with correct expected signer
    let result = validator.validateSignedIntent(signedIntent, {
      expectedSigner: testAddress,
    });
    expect(result.valid).toBe(true);
    
    // Should fail with wrong expected signer
    result = validator.validateSignedIntent(signedIntent, {
      expectedSigner: '0x1234567890123456789012345678901234567890',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid signature for expected signer'))).toBe(true);
  });

  test('validates multiple error conditions at once', async () => {
    const validator = createValidator(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    // Create multiple validation issues
    intent.sourceAmount = '0'; // Invalid amount
    intent.slippageBps = 2000; // Too high slippage
    intent.expiryTime = Math.floor(Date.now() / 1000) + 60; // Expires too soon
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    const result = validator.validateSignedIntent(signedIntent);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1); // Multiple errors
    expect(result.errors.some(e => e.includes('amount'))).toBe(true);
    expect(result.errors.some(e => e.includes('slippage') || e.includes('Slippage'))).toBe(true);
    expect(result.errors.some(e => e.includes('expires too soon'))).toBe(true);
  });
});