// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IDestinationChain.sol";

/**
 * @title BitcoinDestinationChain
 * @notice Bitcoin family blockchain adapter for 1inch Fusion+ cross-chain atomic swaps
 * @dev Supports Bitcoin, Dogecoin, Litecoin, Bitcoin Cash via HTLC script coordination
 */
contract BitcoinDestinationChain is IDestinationChain {
    // Chain IDs for Bitcoin family blockchains
    uint256 public constant BITCOIN_MAINNET = 40003;
    uint256 public constant BITCOIN_TESTNET = 40004;
    uint256 public constant DOGECOIN_MAINNET = 40005;
    uint256 public constant LITECOIN_MAINNET = 40006;
    uint256 public constant BITCOIN_CASH_MAINNET = 40007;

    // Minimum safety deposit: 5% (500 basis points)
    uint256 private constant MIN_SAFETY_DEPOSIT_BPS = 500;

    /**
     * @notice Validate Bitcoin family address format
     * @param destinationAddress Bitcoin address to validate
     * @return isValid True if address format is valid
     */
    function validateDestinationAddress(string memory destinationAddress) 
        external 
        pure 
        override 
        returns (bool isValid) 
    {
        bytes memory addr = bytes(destinationAddress);
        
        // Empty address is invalid
        if (addr.length == 0) {
            return false;
        }

        // Bitcoin address formats:
        // P2PKH: starts with '1' (mainnet) or 'm'/'n' (testnet)
        // P2SH: starts with '3' (mainnet) or '2' (testnet) 
        // Bech32: starts with 'bc1' (mainnet) or 'tb1' (testnet)
        // Dogecoin: starts with 'D' (mainnet) or 'n' (testnet)
        // Litecoin: starts with 'L' or 'M' (mainnet) or 'm'/'n' (testnet)
        // Bitcoin Cash: starts with 'bitcoincash:' or legacy format

        bytes1 first = addr[0];
        
        // P2PKH mainnet (Bitcoin: '1', Dogecoin: 'D', Litecoin: 'L')
        if (first == 0x31 || first == 0x44 || first == 0x4C) {
            return _isValidLength(addr.length, 26, 35);
        }
        
        // P2PKH testnet or Litecoin mainnet ('m', 'n', 'M')
        if (first == 0x6D || first == 0x6E || first == 0x4D) {
            return _isValidLength(addr.length, 26, 35);
        }
        
        // P2SH mainnet ('3') or testnet ('2')
        if (first == 0x33 || first == 0x32) {
            return _isValidLength(addr.length, 26, 35);
        }
        
        // Bech32 format check
        if (addr.length >= 3) {
            // Bitcoin mainnet: 'bc1'
            if (addr[0] == 0x62 && addr[1] == 0x63 && addr[2] == 0x31) {
                return addr.length >= 14 && addr.length <= 74;
            }
            // Bitcoin testnet: 'tb1'  
            if (addr[0] == 0x74 && addr[1] == 0x62 && addr[2] == 0x31) {
                return addr.length >= 14 && addr.length <= 74;
            }
        }
        
        // Bitcoin Cash with prefix
        if (addr.length > 12) {
            bytes memory prefix = new bytes(12);
            for (uint i = 0; i < 12; i++) {
                prefix[i] = addr[i];
            }
            // Check for 'bitcoincash:' prefix
            if (keccak256(prefix) == keccak256("bitcoincash:")) {
                return addr.length >= 42 && addr.length <= 62;
            }
        }
        
        return false;
    }

    /**
     * @notice Get supported features for Bitcoin chains
     * @return features Bitmap of supported features
     */
    function getSupportedFeatures() external pure override returns (uint256 features) {
        // Bitcoin supports:
        // - HTLC atomic swaps (bit 0)
        // - SHA-256 hashlock (bit 1) 
        // - Timelock refunds (bit 2)
        // - Multiple signature types (bit 3)
        return (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3);
    }

    /**
     * @notice Calculate minimum safety deposit for Bitcoin swaps
     * @param amount Source token amount being swapped
     * @return deposit Required safety deposit in source token
     */
    function calculateMinSafetyDeposit(uint256 amount) 
        external 
        pure 
        override 
        returns (uint256 deposit) 
    {
        // 5% of swap amount (same as NEAR implementation)
        return (amount * MIN_SAFETY_DEPOSIT_BPS) / 10000;
    }

    /**
     * @notice Encode Bitcoin-specific execution parameters
     * @param btcAddress Bitcoin destination address
     * @param htlcTimelock HTLC timelock in Bitcoin blocks  
     * @param feeRate Bitcoin transaction fee rate (sat/byte)
     * @return encodedParams ABI-encoded execution parameters
     */
    function encodeExecutionParams(
        string memory btcAddress,
        uint256 htlcTimelock,
        uint256 feeRate
    ) external pure returns (bytes memory encodedParams) {
        return abi.encode(btcAddress, htlcTimelock, feeRate);
    }

    /**
     * @notice Decode Bitcoin execution parameters
     * @param encodedParams ABI-encoded parameters
     * @return btcAddress Bitcoin destination address
     * @return htlcTimelock HTLC timelock in blocks
     * @return feeRate Transaction fee rate in sat/byte
     */
    function decodeExecutionParams(bytes memory encodedParams)
        external
        pure
        returns (
            string memory btcAddress,
            uint256 htlcTimelock,
            uint256 feeRate
        )
    {
        return abi.decode(encodedParams, (string, uint256, uint256));
    }

    /**
     * @notice Estimate execution cost for Bitcoin transaction
     * @param encodedParams Bitcoin execution parameters
     * @return cost Estimated cost in wei (for safety deposit calculation)
     */
    function estimateExecutionCost(bytes memory encodedParams)
        external
        pure
        override
        returns (uint256 cost)
    {
        (, , uint256 feeRate) = abi.decode(encodedParams, (string, uint256, uint256));
        
        // Estimate Bitcoin transaction size:
        // - Funding tx: ~250 bytes
        // - Claiming tx: ~200 bytes  
        // - Total: ~450 bytes
        uint256 estimatedSize = 450;
        uint256 satoshiCost = estimatedSize * feeRate;
        
        // Convert satoshis to wei for consistency
        // Rough approximation: 1 satoshi ≈ 1 gwei for cost estimation
        return satoshiCost * 1e9;
    }

    /**
     * @notice Check if chain ID is supported by this adapter
     * @param chainId Chain ID to check
     * @return isSupported True if chain is supported
     */
    function isChainSupported(uint256 chainId) external pure returns (bool isSupported) {
        return chainId == BITCOIN_MAINNET ||
               chainId == BITCOIN_TESTNET ||
               chainId == DOGECOIN_MAINNET ||
               chainId == LITECOIN_MAINNET ||
               chainId == BITCOIN_CASH_MAINNET;
    }

    /**
     * @notice Get chain name for display purposes
     * @param chainId Chain ID
     * @return name Human-readable chain name
     */
    function getChainName(uint256 chainId) external pure returns (string memory name) {
        if (chainId == BITCOIN_MAINNET) return "Bitcoin";
        if (chainId == BITCOIN_TESTNET) return "Bitcoin Testnet";
        if (chainId == DOGECOIN_MAINNET) return "Dogecoin";
        if (chainId == LITECOIN_MAINNET) return "Litecoin";
        if (chainId == BITCOIN_CASH_MAINNET) return "Bitcoin Cash";
        return "Unknown Bitcoin Chain";
    }

    // Internal helper functions

    /**
     * @dev Check if address length is within valid range
     */
    function _isValidLength(uint256 length, uint256 min, uint256 max) 
        private 
        pure 
        returns (bool) 
    {
        return length >= min && length <= max;
    }
}