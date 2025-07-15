import { SignedIntent, SwapIntent } from '../types/intent';
import { validateIntent } from './validation';
import { verifySignedIntent, extractSignerFromIntent } from './signing';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface SignatureValidationOptions {
  chainId?: number;
  verifyingContract?: string;
  expectedSigner?: string;
}

export class IntentValidator {
  private chainId?: number;
  private verifyingContract?: string;

  constructor(chainId?: number, verifyingContract?: string) {
    this.chainId = chainId;
    this.verifyingContract = verifyingContract;
  }

  validateIntent(intent: SwapIntent): ValidationResult {
    return validateIntent(intent);
  }

  validateSignedIntent(
    signedIntent: SignedIntent,
    options?: SignatureValidationOptions
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // First validate the intent itself
    const intentValidation = this.validateIntent(signedIntent.intent);
    if (!intentValidation.valid) {
      errors.push(...intentValidation.errors);
    }

    // Validate signature
    try {
      const chainId = options?.chainId || this.chainId;
      const verifyingContract = options?.verifyingContract || this.verifyingContract;
      
      // Extract signer from signature
      const actualSigner = extractSignerFromIntent(
        signedIntent,
        chainId,
        verifyingContract
      );

      // Check if signer matches the intent maker
      if (actualSigner.toLowerCase() !== signedIntent.intent.maker.toLowerCase()) {
        errors.push('Signature signer does not match intent maker');
      }

      // If expected signer is provided, verify against it
      if (options?.expectedSigner) {
        const isValidSignature = verifySignedIntent(
          signedIntent,
          options.expectedSigner,
          chainId,
          verifyingContract
        );
        
        if (!isValidSignature) {
          errors.push('Invalid signature for expected signer');
        }
      }

    } catch (error) {
      errors.push(`Signature validation failed: ${error}`);
    }

    // Additional business logic validations
    const businessValidation = this.validateBusinessRules(signedIntent.intent);
    errors.push(...businessValidation.errors);
    warnings.push(...(businessValidation.warnings || []));

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private validateBusinessRules(intent: SwapIntent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check resolver fee reasonableness
    const feePercentage = this.calculateResolverFeePercentage(
      intent.resolverFeeAmount,
      intent.sourceAmount
    );
    
    if (feePercentage < 0.1) { // Less than 0.1%
      warnings.push('Resolver fee may be too low to attract executors');
    } else if (feePercentage > 5) { // More than 5%
      warnings.push('Resolver fee is unusually high');
    }

    // Check if cross-chain swap makes sense
    if (intent.sourceChain === intent.destinationChain) {
      warnings.push('Same-chain swap - consider using DEX instead');
    }

    // Check time until expiry
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = intent.expiryTime - now;
    
    if (timeUntilExpiry < 300) { // Less than 5 minutes
      errors.push('Intent expires too soon for safe execution');
    } else if (timeUntilExpiry < 900) { // Less than 15 minutes
      warnings.push('Short expiry time may limit executor participation');
    }

    // Check slippage tolerance
    if (intent.slippageBps > 500) { // More than 5%
      warnings.push('High slippage tolerance may result in poor execution');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private calculateResolverFeePercentage(
    resolverFeeAmount: string,
    sourceAmount: string
  ): number {
    try {
      const fee = BigInt(resolverFeeAmount);
      const amount = BigInt(sourceAmount);
      if (amount === 0n) return 0;
      
      // Return percentage (not basis points)
      return Number((fee * 10000n) / amount) / 100;
    } catch {
      return 0;
    }
  }

  updateOptions(chainId?: number, verifyingContract?: string): void {
    this.chainId = chainId;
    this.verifyingContract = verifyingContract;
  }
}

export function createValidator(
  chainId?: number,
  verifyingContract?: string
): IntentValidator {
  return new IntentValidator(chainId, verifyingContract);
}

export function validateSignedIntentQuick(
  signedIntent: SignedIntent,
  expectedSigner: string,
  chainId?: number
): boolean {
  const validator = createValidator(chainId);
  const result = validator.validateSignedIntent(signedIntent, { expectedSigner });
  return result.valid;
}

export function validateIntentQuick(intent: SwapIntent): boolean {
  const validator = createValidator();
  const result = validator.validateIntent(intent);
  return result.valid;
}