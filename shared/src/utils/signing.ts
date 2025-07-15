import { TypedDataDomain, TypedDataField, Wallet, verifyTypedData } from 'ethers';
import { SwapIntent, SignedIntent, EIP712_DOMAIN, INTENT_TYPE } from '../types/intent';
import { formatIntentForSigning } from './intent';

export interface EIP712Domain extends TypedDataDomain {
  name: string;
  version: string;
  chainId?: number;
  verifyingContract?: string;
}

export class IntentSigner {
  private domain: EIP712Domain;

  constructor(chainId?: number, verifyingContract?: string) {
    this.domain = {
      ...EIP712_DOMAIN,
      ...(chainId && { chainId }),
      ...(verifyingContract && { verifyingContract }),
    };
  }

  async signIntent(intent: SwapIntent, signer: Wallet): Promise<SignedIntent> {
    const formattedIntent = formatIntentForSigning(intent);
    
    const signature = await signer.signTypedData(
      this.domain,
      INTENT_TYPE,
      formattedIntent
    );

    return {
      intent,
      signature,
    };
  }

  verifyIntentSignature(signedIntent: SignedIntent, expectedSigner: string): boolean {
    try {
      const formattedIntent = formatIntentForSigning(signedIntent.intent);
      
      const recoveredAddress = verifyTypedData(
        this.domain,
        INTENT_TYPE,
        formattedIntent,
        signedIntent.signature
      );

      return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
      // Invalid signature format or verification failed
      return false;
    }
  }

  getTypedDataHash(intent: SwapIntent): string {
    const formattedIntent = formatIntentForSigning(intent);
    
    // This would use ethers internal methods to get the typed data hash
    // For now, we'll return a placeholder
    // In a real implementation, you'd use the EIP-712 hash calculation
    return '0x' + '0'.repeat(64);
  }

  updateDomain(updates: Partial<EIP712Domain>): void {
    this.domain = { ...this.domain, ...updates };
  }

  getDomain(): EIP712Domain {
    return { ...this.domain };
  }
}

export function createIntentSigner(
  chainId?: number,
  verifyingContract?: string
): IntentSigner {
  return new IntentSigner(chainId, verifyingContract);
}

export async function signIntentWithPrivateKey(
  intent: SwapIntent,
  privateKey: string,
  chainId?: number,
  verifyingContract?: string
): Promise<SignedIntent> {
  const wallet = new Wallet(privateKey);
  const signer = createIntentSigner(chainId, verifyingContract);
  
  return await signer.signIntent(intent, wallet);
}

export function verifySignedIntent(
  signedIntent: SignedIntent,
  expectedSigner: string,
  chainId?: number,
  verifyingContract?: string
): boolean {
  const signer = createIntentSigner(chainId, verifyingContract);
  return signer.verifyIntentSignature(signedIntent, expectedSigner);
}

export function extractSignerFromIntent(
  signedIntent: SignedIntent,
  chainId?: number,
  verifyingContract?: string
): string {
  try {
    const domain: EIP712Domain = {
      ...EIP712_DOMAIN,
      ...(chainId && { chainId }),
      ...(verifyingContract && { verifyingContract }),
    };
    
    const formattedIntent = formatIntentForSigning(signedIntent.intent);
    
    return verifyTypedData(
      domain,
      INTENT_TYPE,
      formattedIntent,
      signedIntent.signature
    );
  } catch (error) {
    throw new Error(`Failed to extract signer: ${error}`);
  }
}