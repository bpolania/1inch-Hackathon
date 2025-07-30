/**
 * Bitcoin Parameter Utilities
 * 
 * Handles encoding/decoding of Bitcoin execution parameters compatible with
 * BitcoinDestinationChain.sol contract
 */

import { ethers } from 'ethers';

export interface BitcoinExecutionParams {
    btcAddress: string;
    htlcTimelock: number;
    feeRate: number;
}

/**
 * Decode Bitcoin execution parameters from ABI-encoded bytes
 * Compatible with BitcoinDestinationChain.sol:decodeExecutionParams()
 */
export function decodeBitcoinParams(encodedParams: string): BitcoinExecutionParams {
    try {
        // Remove '0x' prefix if present
        const cleanHex = encodedParams.startsWith('0x') ? encodedParams.slice(2) : encodedParams;
        
        // Convert to bytes for ABI decoding
        const paramBytes = '0x' + cleanHex;
        
        // ABI decode: (string btcAddress, uint256 htlcTimelock, uint256 feeRate)
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ['string', 'uint256', 'uint256'],
            paramBytes
        );
        
        return {
            btcAddress: decoded[0],
            htlcTimelock: Number(decoded[1]),
            feeRate: Number(decoded[2])
        };
    } catch (error) {
        console.warn('Failed to decode Bitcoin parameters, using defaults:', error);
        
        // Fallback to reasonable defaults
        return {
            btcAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Testnet address
            htlcTimelock: 144, // 24 hours in blocks
            feeRate: 10 // 10 sat/byte
        };
    }
}

/**
 * Encode Bitcoin execution parameters to ABI-encoded bytes
 * Compatible with BitcoinDestinationChain.sol:encodeExecutionParams()
 */
export function encodeBitcoinParams(params: BitcoinExecutionParams): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        ['string', 'uint256', 'uint256'],
        [params.btcAddress, params.htlcTimelock, params.feeRate]
    );
}

/**
 * Validate Bitcoin execution parameters
 */
export function validateBitcoinParams(params: BitcoinExecutionParams): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    
    // Validate Bitcoin address format
    if (!params.btcAddress || params.btcAddress.length < 26) {
        errors.push('Invalid Bitcoin address format');
    }
    
    // Validate timelock (reasonable range: 1-1000 blocks)
    if (params.htlcTimelock < 1 || params.htlcTimelock > 1000) {
        errors.push('HTLC timelock must be between 1-1000 blocks');
    }
    
    // Validate fee rate (reasonable range: 1-1000 sat/byte)
    if (params.feeRate < 1 || params.feeRate > 1000) {
        errors.push('Fee rate must be between 1-1000 sat/byte');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}