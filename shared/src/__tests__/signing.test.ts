import { Wallet } from 'ethers';
import { 
  IntentSigner, 
  signIntentWithPrivateKey, 
  verifySignedIntent,
  extractSignerFromIntent 
} from '../utils/signing';
import { EXAMPLE_INTENTS } from '../examples/intent-examples';
import { ChainId } from '../types/chains';

describe('Intent Signing', () => {
  const testPrivateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
  const testWallet = new Wallet(testPrivateKey);
  const testAddress = testWallet.address;

  test('IntentSigner can sign and verify intents', async () => {
    const signer = new IntentSigner(ChainId.ETHEREUM_MAINNET);
    const intent = EXAMPLE_INTENTS.ethToBtc();
    
    // Update intent maker to match test wallet
    intent.maker = testAddress;
    
    const signedIntent = await signer.signIntent(intent, testWallet);
    
    expect(signedIntent.signature).toMatch(/^0x[a-f0-9]+$/);
    expect(signedIntent.intent).toEqual(intent);
    
    // Verify signature
    const isValid = signer.verifyIntentSignature(signedIntent, testAddress);
    expect(isValid).toBe(true);
    
    // Should fail with wrong address
    const isInvalid = signer.verifyIntentSignature(signedIntent, '0x1234567890123456789012345678901234567890');
    expect(isInvalid).toBe(false);
  });

  test('signIntentWithPrivateKey convenience function works', async () => {
    const intent = EXAMPLE_INTENTS.usdcToApt();
    intent.maker = testAddress;
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    expect(signedIntent.signature).toBeTruthy();
    
    const isValid = verifySignedIntent(
      signedIntent,
      testAddress,
      ChainId.ETHEREUM_MAINNET
    );
    expect(isValid).toBe(true);
  });

  test('extractSignerFromIntent recovers correct address', async () => {
    const intent = EXAMPLE_INTENTS.aptToEth();
    intent.maker = testAddress;
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    const recoveredAddress = extractSignerFromIntent(
      signedIntent,
      ChainId.ETHEREUM_MAINNET
    );
    
    expect(recoveredAddress.toLowerCase()).toBe(testAddress.toLowerCase());
  });

  test('signature verification fails for tampered intent', async () => {
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    const signedIntent = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    // Tamper with the intent
    signedIntent.intent.sourceAmount = '2000000000000000000'; // Change from 1 ETH to 2 ETH
    
    const isValid = verifySignedIntent(
      signedIntent,
      testAddress,
      ChainId.ETHEREUM_MAINNET
    );
    expect(isValid).toBe(false);
  });

  test('domain updates work correctly', async () => {
    const signer = new IntentSigner();
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    // Sign with default domain
    const signedIntent1 = await signer.signIntent(intent, testWallet);
    
    // Update domain
    signer.updateDomain({ chainId: ChainId.ETHEREUM_MAINNET });
    
    // Sign with updated domain - should produce different signature
    const signedIntent2 = await signer.signIntent(intent, testWallet);
    
    expect(signedIntent1.signature).not.toBe(signedIntent2.signature);
    
    // Original signature should not verify with new domain
    const isValid = signer.verifyIntentSignature(signedIntent1, testAddress);
    expect(isValid).toBe(false);
    
    // New signature should verify with new domain
    const isValid2 = signer.verifyIntentSignature(signedIntent2, testAddress);
    expect(isValid2).toBe(true);
  });

  test('handles multiple chain IDs correctly', async () => {
    const intent = EXAMPLE_INTENTS.testnet();
    intent.maker = testAddress;
    
    // Sign for Ethereum mainnet
    const signedMainnet = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_MAINNET
    );
    
    // Sign for Ethereum sepolia
    const signedSepolia = await signIntentWithPrivateKey(
      intent,
      testPrivateKey,
      ChainId.ETHEREUM_SEPOLIA
    );
    
    expect(signedMainnet.signature).not.toBe(signedSepolia.signature);
    
    // Each should only verify on their respective chains
    expect(verifySignedIntent(signedMainnet, testAddress, ChainId.ETHEREUM_MAINNET)).toBe(true);
    expect(verifySignedIntent(signedMainnet, testAddress, ChainId.ETHEREUM_SEPOLIA)).toBe(false);
    
    expect(verifySignedIntent(signedSepolia, testAddress, ChainId.ETHEREUM_SEPOLIA)).toBe(true);
    expect(verifySignedIntent(signedSepolia, testAddress, ChainId.ETHEREUM_MAINNET)).toBe(false);
  });

  test('handles invalid signatures gracefully', () => {
    const intent = EXAMPLE_INTENTS.ethToBtc();
    intent.maker = testAddress;
    
    const invalidSignedIntent = {
      intent,
      signature: '0xinvalid',
    };
    
    expect(() => {
      extractSignerFromIntent(invalidSignedIntent, ChainId.ETHEREUM_MAINNET);
    }).toThrow();
    
    const isValid = verifySignedIntent(
      invalidSignedIntent,
      testAddress,
      ChainId.ETHEREUM_MAINNET
    );
    expect(isValid).toBe(false);
  });
});