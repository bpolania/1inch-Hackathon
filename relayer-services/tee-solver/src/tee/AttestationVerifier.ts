/**
 * TEE Attestation Verifier
 * 
 * Handles Intel TDX remote attestation verification for NEAR Shade Agent
 * Validates TEE quotes and ensures secure execution environment
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface AttestationQuote {
  version: number;
  attestationKeyType: number;
  teeType: number;
  qeSvn: number;
  pceSvn: number;
  qeVendorId: string;
  userData: string;
  // Intel TDX specific fields
  mrSeam: string;          // Measurement of TDX SEAM module
  mrSignerSeam: string;    // Signer of TDX SEAM module
  seamAttributes: string;  // TDX SEAM attributes
  tdAttributes: string;    // Trust Domain attributes
  xfam: string;           // Extended Features Available Mask
  mrtd: string;           // Measurement of initial TD contents
  mrConfigId: string;     // Software-defined ID for TD
  mrOwner: string;        // Software-defined ID for TD owner
  mrOwnerConfig: string;  // Software-defined configuration
  rtmr0: string;          // Runtime Measurement Register 0
  rtmr1: string;          // Runtime Measurement Register 1
  rtmr2: string;          // Runtime Measurement Register 2
  rtmr3: string;          // Runtime Measurement Register 3
}

export interface VerificationResult {
  isValid: boolean;
  trustLevel: 'high' | 'medium' | 'low' | 'untrusted';
  issues: string[];
  measurements: {
    platformValid: boolean;
    seam: boolean;
    trustDomain: boolean;
    runtime: boolean;
  };
  timestamp: number;
}

export interface TrustedMeasurements {
  expectedMrSeam: string;
  expectedMrSignerSeam: string;
  expectedMrtd: string;
  expectedCodeHash: string;
  minimumTcbLevel: number;
}

export class AttestationVerifier extends EventEmitter {
  private trustedMeasurements: TrustedMeasurements;
  private verificationCache: Map<string, VerificationResult> = new Map();
  private stats = {
    verificationsPerformed: 0,
    successfulVerifications: 0,
    failedVerifications: 0,
    cacheHits: 0,
    averageVerificationTime: 0
  };

  constructor(trustedMeasurements: TrustedMeasurements) {
    super();
    this.trustedMeasurements = trustedMeasurements;
    this.setupEventHandlers();
  }

  /**
   * Verify Intel TDX attestation quote
   */
  async verifyAttestation(
    quote: string, 
    codehash: string, 
    collateral?: any
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(quote, codehash);

    logger.info(' Verifying TEE attestation quote...', {
      quoteLength: quote.length,
      codeHashPrefix: codehash.substring(0, 16) + '...'
    });

    // Check cache first
    if (this.verificationCache.has(cacheKey)) {
      this.stats.cacheHits++;
      logger.info(' Using cached verification result');
      return this.verificationCache.get(cacheKey)!;
    }

    try {
      this.stats.verificationsPerformed++;

      // Parse the attestation quote
      const parsedQuote = await this.parseAttestationQuote(quote);
      
      // Perform comprehensive verification
      const result = await this.performVerification(parsedQuote, codehash, collateral);
      
      // Update statistics
      const verificationTime = Date.now() - startTime;
      this.updateVerificationStats(result.isValid, verificationTime);

      // Cache the result
      this.verificationCache.set(cacheKey, result);

      logger.info(' Attestation verification completed', {
        isValid: result.isValid,
        trustLevel: result.trustLevel,
        verificationTime,
        issues: result.issues.length
      });

      this.emit('verification_completed', result);
      return result;

    } catch (error) {
      this.stats.failedVerifications++;
      
      const errorResult: VerificationResult = {
        isValid: false,
        trustLevel: 'untrusted',
        issues: [`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        measurements: {
          platformValid: false,
          seam: false,
          trustDomain: false,
          runtime: false
        },
        timestamp: Date.now()
      };

      logger.error(' Attestation verification failed:', error);
      this.emit('verification_failed', { error, quote: cacheKey });
      
      return errorResult;
    }
  }

  /**
   * Parse Intel TDX attestation quote
   */
  private async parseAttestationQuote(quote: string): Promise<AttestationQuote> {
    logger.info(' Parsing Intel TDX attestation quote...');

    try {
      // Remove 0x prefix if present
      const cleanQuote = quote.startsWith('0x') ? quote.slice(2) : quote;
      
      // Convert hex to buffer for parsing
      const quoteBuffer = Buffer.from(cleanQuote, 'hex');
      
      if (quoteBuffer.length < 1024) {
        throw new Error('Quote too short for valid TDX attestation');
      }

      // Parse TDX quote structure (simplified - would use actual TDX parsing library)
      const parsedQuote: AttestationQuote = {
        version: quoteBuffer.readUInt16LE(0),
        attestationKeyType: quoteBuffer.readUInt16LE(2),
        teeType: quoteBuffer.readUInt32LE(4),
        qeSvn: quoteBuffer.readUInt16LE(8),
        pceSvn: quoteBuffer.readUInt16LE(10),
        qeVendorId: quoteBuffer.slice(12, 28).toString('hex'),
        userData: quoteBuffer.slice(28, 92).toString('hex'),
        
        // TDX specific measurements (offsets would be from actual TDX spec)
        mrSeam: quoteBuffer.slice(112, 144).toString('hex'),
        mrSignerSeam: quoteBuffer.slice(144, 176).toString('hex'),
        seamAttributes: quoteBuffer.slice(176, 184).toString('hex'),
        tdAttributes: quoteBuffer.slice(184, 192).toString('hex'),
        xfam: quoteBuffer.slice(192, 200).toString('hex'),
        mrtd: quoteBuffer.slice(200, 232).toString('hex'),
        mrConfigId: quoteBuffer.slice(232, 280).toString('hex'),
        mrOwner: quoteBuffer.slice(280, 328).toString('hex'),
        mrOwnerConfig: quoteBuffer.slice(328, 376).toString('hex'),
        rtmr0: quoteBuffer.slice(376, 408).toString('hex'),
        rtmr1: quoteBuffer.slice(408, 440).toString('hex'),
        rtmr2: quoteBuffer.slice(440, 472).toString('hex'),
        rtmr3: quoteBuffer.slice(472, 504).toString('hex')
      };

      logger.info(' TDX quote parsed successfully', {
        version: parsedQuote.version,
        teeType: parsedQuote.teeType,
        mrSeamPrefix: parsedQuote.mrSeam.substring(0, 16) + '...',
        mrtdPrefix: parsedQuote.mrtd.substring(0, 16) + '...'
      });

      return parsedQuote;

    } catch (error) {
      logger.error(' Failed to parse TDX attestation quote:', error);
      throw new Error(`Quote parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform comprehensive attestation verification
   */
  private async performVerification(
    quote: AttestationQuote,
    codehash: string,
    collateral?: any
  ): Promise<VerificationResult> {
    const issues: string[] = [];
    const measurements = {
      platformValid: false,
      seam: false,
      trustDomain: false,
      runtime: false
    };

    // 1. Verify platform measurements (SEAM)
    measurements.seam = await this.verifySeamMeasurements(quote, issues);
    
    // 2. Verify Trust Domain measurements
    measurements.trustDomain = await this.verifyTrustDomainMeasurements(quote, issues);
    
    // 3. Verify runtime measurements
    measurements.runtime = await this.verifyRuntimeMeasurements(quote, codehash, issues);
    
    // 4. Verify platform security level
    measurements.platformValid = await this.verifyPlatformSecurity(quote, collateral, issues);

    // Determine overall validity and trust level
    const validMeasurements = Object.values(measurements).filter(Boolean).length;
    const isValid = validMeasurements >= 3; // Require at least 3/4 measurements to pass
    
    let trustLevel: 'high' | 'medium' | 'low' | 'untrusted';
    if (!isValid) {
      trustLevel = 'untrusted';
    } else if (validMeasurements === 4 && issues.length === 0) {
      trustLevel = 'high';
    } else if (validMeasurements >= 3 && issues.length <= 2) {
      trustLevel = 'medium';
    } else {
      trustLevel = 'low';
    }

    return {
      isValid,
      trustLevel,
      issues,
      measurements,
      timestamp: Date.now()
    };
  }

  /**
   * Verify SEAM (TDX module) measurements
   */
  private async verifySeamMeasurements(quote: AttestationQuote, issues: string[]): Promise<boolean> {
    logger.info(' Verifying SEAM measurements...');

    try {
      // Verify MR_SEAM against expected value
      if (quote.mrSeam !== this.trustedMeasurements.expectedMrSeam) {
        issues.push('MR_SEAM measurement mismatch');
        return false;
      }

      // Verify MR_SIGNER_SEAM against expected value
      if (quote.mrSignerSeam !== this.trustedMeasurements.expectedMrSignerSeam) {
        issues.push('MR_SIGNER_SEAM measurement mismatch');
        return false;
      }

      // Verify SEAM attributes are valid
      const seamAttrs = parseInt(quote.seamAttributes, 16);
      if (seamAttrs === 0) {
        issues.push('Invalid SEAM attributes');
        return false;
      }

      logger.info(' SEAM measurements verified successfully');
      return true;

    } catch (error) {
      issues.push(`SEAM verification error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return false;
    }
  }

  /**
   * Verify Trust Domain measurements
   */
  private async verifyTrustDomainMeasurements(quote: AttestationQuote, issues: string[]): Promise<boolean> {
    logger.info(' Verifying Trust Domain measurements...');

    try {
      // Verify MR_TD against expected value
      if (quote.mrtd !== this.trustedMeasurements.expectedMrtd) {
        issues.push('MR_TD measurement mismatch - unexpected initial TD contents');
        return false;
      }

      // Verify TD attributes are secure
      const tdAttrs = parseInt(quote.tdAttributes, 16);
      const requiredAttrs = 0x0000000000000001; // Debug disabled
      
      if ((tdAttrs & requiredAttrs) !== requiredAttrs) {
        issues.push('TD attributes indicate debug mode enabled');
        return false;
      }

      // Verify XFAM (Extended Features Available Mask)
      const xfam = parseInt(quote.xfam, 16);
      if (xfam === 0) {
        issues.push('Invalid XFAM - no extended features available');
      }

      logger.info(' Trust Domain measurements verified successfully');
      return true;

    } catch (error) {
      issues.push(`Trust Domain verification error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return false;
    }
  }

  /**
   * Verify runtime measurements against expected code hash
   */
  private async verifyRuntimeMeasurements(quote: AttestationQuote, codehash: string, issues: string[]): Promise<boolean> {
    logger.info(' Verifying runtime measurements...');

    try {
      // RTMR0 typically contains boot measurements
      if (quote.rtmr0 === '0'.repeat(64)) {
        issues.push('RTMR0 is empty - no boot measurements');
      }

      // RTMR1 typically contains application measurements
      // We expect this to match our Docker image hash
      const expectedHash = codehash.replace('sha256:', '').toLowerCase();
      
      // Check if our code hash is reflected in runtime measurements
      // (This is simplified - actual implementation would depend on how the measurements are extended)
      const rtmrMatches = [quote.rtmr1, quote.rtmr2, quote.rtmr3].some(rtmr => 
        rtmr.includes(expectedHash.substring(0, 32))
      );

      if (!rtmrMatches) {
        issues.push('Runtime measurements do not match expected code hash');
        return false;
      }

      logger.info(' Runtime measurements verified successfully');
      return true;

    } catch (error) {
      issues.push(`Runtime verification error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return false;
    }
  }

  /**
   * Verify platform security level using collateral
   */
  private async verifyPlatformSecurity(quote: AttestationQuote, collateral: any, issues: string[]): Promise<boolean> {
    logger.info(' Verifying platform security level...');

    try {
      // Check minimum TCB (Trusted Computing Base) level
      const currentTcbLevel = quote.qeSvn + quote.pceSvn; // Simplified TCB calculation
      
      if (currentTcbLevel < this.trustedMeasurements.minimumTcbLevel) {
        issues.push(`TCB level too low: ${currentTcbLevel} < ${this.trustedMeasurements.minimumTcbLevel}`);
        return false;
      }

      // Verify QE vendor ID (Intel)
      const intelVendorId = '939a7233f79c4ca9940a0db3957f0607'; // Intel's QE vendor ID
      if (quote.qeVendorId !== intelVendorId) {
        issues.push('Non-Intel QE detected');
        return false;
      }

      // Check for security advisories (if collateral provided)
      if (collateral?.tcbInfo) {
        const tcbStatus = this.evaluateTcbStatus(collateral.tcbInfo);
        if (tcbStatus !== 'upToDate') {
          issues.push(`TCB status: ${tcbStatus}`);
          if (tcbStatus === 'revoked') {
            return false;
          }
        }
      }

      logger.info(' Platform security verified successfully');
      return true;

    } catch (error) {
      issues.push(`Platform security verification error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return false;
    }
  }

  /**
   * Evaluate TCB status from collateral
   */
  private evaluateTcbStatus(tcbInfo: any): string {
    // Mock implementation - would parse actual Intel TCB info
    const mockStatuses = ['upToDate', 'swHardeningNeeded', 'configurationNeeded', 'revoked'];
    return mockStatuses[0]; // Always return upToDate for development
  }

  /**
   * Generate cache key for verification results
   */
  private generateCacheKey(quote: string, codehash: string): string {
    // Create deterministic cache key
    const crypto = require('crypto');
    return crypto.createHash('sha256')
      .update(quote + codehash)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Update verification statistics
   */
  private updateVerificationStats(success: boolean, verificationTime: number): void {
    if (success) {
      this.stats.successfulVerifications++;
    } else {
      this.stats.failedVerifications++;
    }

    // Update average verification time
    const alpha = 0.1;
    if (this.stats.averageVerificationTime === 0) {
      this.stats.averageVerificationTime = verificationTime;
    } else {
      this.stats.averageVerificationTime = 
        this.stats.averageVerificationTime * (1 - alpha) + verificationTime * alpha;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('verification_completed', (result) => {
      logger.info(' Attestation verification completed', {
        trustLevel: result.trustLevel,
        issues: result.issues.length
      });
    });

    this.on('verification_failed', (data) => {
      logger.error(' Attestation verification failed', data);
    });
  }

  /**
   * Get verification statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.verificationCache.size,
      successRate: this.stats.verificationsPerformed > 0 
        ? (this.stats.successfulVerifications / this.stats.verificationsPerformed) * 100 
        : 0
    };
  }

  /**
   * Clear verification cache
   */
  clearCache(): void {
    this.verificationCache.clear();
    logger.info(' Verification cache cleared');
  }

  /**
   * Validate trusted measurements configuration
   */
  validateTrustedMeasurements(): boolean {
    const required = ['expectedMrSeam', 'expectedMrSignerSeam', 'expectedMrtd', 'expectedCodeHash'];
    
    for (const field of required) {
      if (!this.trustedMeasurements[field as keyof TrustedMeasurements]) {
        logger.error(`Missing trusted measurement: ${field}`);
        return false;
      }
    }

    return true;
  }
}