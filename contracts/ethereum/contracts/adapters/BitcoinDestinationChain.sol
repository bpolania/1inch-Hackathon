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
    
    // Store the chain ID this instance represents
    uint256 public immutable chainId;
    
    constructor(uint256 _chainId) {
        require(
            _chainId == BITCOIN_MAINNET ||
            _chainId == BITCOIN_TESTNET ||
            _chainId == DOGECOIN_MAINNET ||
            _chainId == LITECOIN_MAINNET ||
            _chainId == BITCOIN_CASH_MAINNET,
            "Unsupported chain ID"
        );
        chainId = _chainId;
    }

    /**
     * @notice Get chain information
     * @return ChainInfo struct with chain details
     */
    function getChainInfo() external view override returns (ChainInfo memory) {
        return ChainInfo({
            chainId: chainId,
            name: getChainName(chainId),
            symbol: getChainSymbol(chainId),
            isActive: true,
            minSafetyDepositBps: MIN_SAFETY_DEPOSIT_BPS,
            defaultTimelock: getDefaultTimelock(chainId)
        });
    }

    /**
     * @notice Validate Bitcoin family address format
     * @param destinationAddress Bitcoin address to validate (as bytes)
     * @return isValid True if address format is valid
     */
    function validateDestinationAddress(bytes calldata destinationAddress) 
        external 
        pure 
        override 
        returns (bool isValid) 
    {
        if (destinationAddress.length == 0) {
            return false;
        }

        // Convert bytes to string for validation
        string memory addr = string(destinationAddress);
        bytes memory addrBytes = bytes(addr);

        // Bitcoin address formats:
        // P2PKH: starts with '1' (mainnet) or 'm'/'n' (testnet)
        // P2SH: starts with '3' (mainnet) or '2' (testnet) 
        // Bech32: starts with 'bc1' (mainnet) or 'tb1' (testnet)
        // Dogecoin: starts with 'D' (mainnet) or 'n' (testnet)
        // Litecoin: starts with 'L' or 'M' (mainnet) or 'm'/'n' (testnet)
        // Bitcoin Cash: starts with 'bitcoincash:' or legacy format

        bytes1 first = addrBytes[0];
        
        // P2PKH mainnet (Bitcoin: '1', Dogecoin: 'D', Litecoin: 'L')
        if (first == 0x31 || first == 0x44 || first == 0x4C) {
            return _isValidLength(addrBytes.length, 26, 35) && _isValidBase58(addrBytes);
        }
        
        // P2PKH testnet or Litecoin mainnet ('m', 'n', 'M')
        if (first == 0x6D || first == 0x6E || first == 0x4D) {
            return _isValidLength(addrBytes.length, 26, 35) && _isValidBase58(addrBytes);
        }
        
        // P2SH mainnet ('3') or testnet ('2')
        if (first == 0x33 || first == 0x32) {
            return _isValidLength(addrBytes.length, 26, 35) && _isValidBase58(addrBytes);
        }
        
        // Bech32 format check
        if (addrBytes.length >= 3) {
            // Bitcoin mainnet: 'bc1'
            if (addrBytes[0] == 0x62 && addrBytes[1] == 0x63 && addrBytes[2] == 0x31) {
                return addrBytes.length >= 14 && addrBytes.length <= 74 && _isValidBech32(addrBytes);
            }
            // Bitcoin testnet: 'tb1'  
            if (addrBytes[0] == 0x74 && addrBytes[1] == 0x62 && addrBytes[2] == 0x31) {
                return addrBytes.length >= 14 && addrBytes.length <= 74 && _isValidBech32(addrBytes);
            }
        }
        
        // Bitcoin Cash with prefix
        if (addrBytes.length > 12) {
            bytes memory prefix = new bytes(12);
            for (uint i = 0; i < 12; i++) {
                prefix[i] = addrBytes[i];
            }
            // Check for 'bitcoincash:' prefix
            if (keccak256(prefix) == keccak256("bitcoincash:")) {
                return addrBytes.length >= 42 && addrBytes.length <= 62;
            }
        }
        
        return false;
    }

    /**
     * @notice Validate chain-specific parameters for order creation
     * @param params Chain-specific parameters to validate
     * @param amount The amount being transferred
     * @return ValidationResult struct with validation details
     */
    function validateOrderParams(
        ChainSpecificParams calldata params,
        uint256 amount
    ) external view override returns (ValidationResult memory) {
        // Validate destination address
        bool isValidAddress = this.validateDestinationAddress(params.destinationAddress);
        if (!isValidAddress) {
            return ValidationResult({
                isValid: false,
                errorMessage: "Invalid Bitcoin address format",
                estimatedCost: 0
            });
        }

        // Validate amount (should be positive and above dust threshold)
        if (amount == 0) {
            return ValidationResult({
                isValid: false,
                errorMessage: "Amount must be greater than zero",
                estimatedCost: 0
            });
        }

        // Estimate execution cost
        uint256 cost = this.estimateExecutionCost(params, amount);

        return ValidationResult({
            isValid: true,
            errorMessage: "",
            estimatedCost: cost
        });
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
     * @notice Get supported token formats for this chain
     * @return formats Array of supported token format identifiers
     */
    function getSupportedTokenFormats() external pure override returns (string[] memory formats) {
        formats = new string[](5);
        formats[0] = "BTC";
        formats[1] = "DOGE";
        formats[2] = "LTC";
        formats[3] = "BCH";
        formats[4] = "native";
        return formats;
    }

    /**
     * @notice Estimate execution cost on destination chain
     * @param params Chain-specific parameters
     * @return cost Estimated cost in wei (for consistency)
     */
    function estimateExecutionCost(
        ChainSpecificParams calldata params,
        uint256 /* amount */
    ) external view override returns (uint256 cost) {
        // Decode execution parameters to get fee rate
        uint256 feeRate = 10; // Default 10 sat/byte
        
        if (params.executionParams.length >= 32) {
            // Try to decode fee rate from execution params
            // Format: abi.encode(btcAddress, htlcTimelock, feeRate)
            try this.decodeFeeRateFromParams(params.executionParams) returns (uint256 decodedFeeRate) {
                feeRate = decodedFeeRate;
            } catch {
                // Use default if decoding fails
                feeRate = 10;
            }
        }
        
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
     * @notice Format token identifier for this chain
     * @param tokenAddress Token address (not used for Bitcoin)
     * @param tokenSymbol Token symbol
     * @param isNative Whether this is the chain's native token
     * @return identifier Formatted token identifier
     */
    function formatTokenIdentifier(
        address tokenAddress,
        string calldata tokenSymbol,
        bool isNative
    ) external pure override returns (bytes memory identifier) {
        // For Bitcoin family chains, we use symbol-based identification
        if (isNative) {
            return abi.encode(tokenSymbol, "native");
        } else {
            // For wrapped tokens, include contract address if available
            return abi.encode(tokenSymbol, tokenAddress);
        }
    }

    /**
     * @notice Check if a specific feature is supported
     * @param feature Feature identifier
     * @return isSupported True if feature is supported
     */
    function supportsFeature(string calldata feature) external pure override returns (bool isSupported) {
        bytes32 featureHash = keccak256(bytes(feature));
        
        // Supported features
        if (featureHash == keccak256("htlc")) return true;
        if (featureHash == keccak256("sha256_hashlock")) return true;
        if (featureHash == keccak256("timelock_refund")) return true;
        if (featureHash == keccak256("multisig")) return true;
        if (featureHash == keccak256("atomic_swap")) return true;
        
        return false;
    }

    /**
     * @notice Get chain-specific metadata for order creation
     * @param params Chain-specific parameters
     * @return metadata Encoded metadata for 1inch order immutables
     */
    function getOrderMetadata(ChainSpecificParams calldata params) 
        external 
        view 
        override 
        returns (bytes memory metadata) 
    {
        // Encode Bitcoin-specific metadata
        return abi.encode(
            params.destinationAddress,
            params.executionParams,
            params.estimatedGas,
            block.timestamp
        );
    }

    // Helper functions for Bitcoin-specific operations

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
     * @notice Decode fee rate from execution parameters (helper for cost estimation)
     * @param encodedParams ABI-encoded parameters
     * @return feeRate Transaction fee rate in sat/byte
     */
    function decodeFeeRateFromParams(bytes calldata encodedParams)
        external
        pure
        returns (uint256 feeRate)
    {
        (, , feeRate) = abi.decode(encodedParams, (string, uint256, uint256));
        return feeRate;
    }

    /**
     * @notice Check if chain ID is supported by this adapter
     * @param _chainId Chain ID to check
     * @return isSupported True if chain is supported
     */
    function isChainSupported(uint256 _chainId) external pure returns (bool isSupported) {
        return _chainId == BITCOIN_MAINNET ||
               _chainId == BITCOIN_TESTNET ||
               _chainId == DOGECOIN_MAINNET ||
               _chainId == LITECOIN_MAINNET ||
               _chainId == BITCOIN_CASH_MAINNET;
    }

    /**
     * @notice Get chain name for display purposes
     * @param _chainId Chain ID
     * @return name Human-readable chain name
     */
    function getChainName(uint256 _chainId) public pure returns (string memory name) {
        if (_chainId == BITCOIN_MAINNET) return "Bitcoin";
        if (_chainId == BITCOIN_TESTNET) return "Bitcoin Testnet";
        if (_chainId == DOGECOIN_MAINNET) return "Dogecoin";
        if (_chainId == LITECOIN_MAINNET) return "Litecoin";
        if (_chainId == BITCOIN_CASH_MAINNET) return "Bitcoin Cash";
        return "Unknown Bitcoin Chain";
    }
    
    /**
     * @notice Get chain symbol
     * @param _chainId Chain ID
     * @return symbol Chain symbol
     */
    function getChainSymbol(uint256 _chainId) public pure returns (string memory symbol) {
        if (_chainId == BITCOIN_MAINNET || _chainId == BITCOIN_TESTNET) return "BTC";
        if (_chainId == DOGECOIN_MAINNET) return "DOGE";
        if (_chainId == LITECOIN_MAINNET) return "LTC";
        if (_chainId == BITCOIN_CASH_MAINNET) return "BCH";
        return "UNK";
    }
    
    /**
     * @notice Get default timelock for chain
     * @param _chainId Chain ID
     * @return timelock Default timelock in seconds
     */
    function getDefaultTimelock(uint256 _chainId) public pure returns (uint256 timelock) {
        if (_chainId == BITCOIN_MAINNET || _chainId == BITCOIN_TESTNET) {
            return 144 * 10 * 60; // 144 blocks * 10 minutes
        }
        if (_chainId == LITECOIN_MAINNET) {
            return 576 * 150; // 576 blocks * 2.5 minutes
        }
        if (_chainId == DOGECOIN_MAINNET) {
            return 1440 * 60; // 1440 blocks * 1 minute
        }
        if (_chainId == BITCOIN_CASH_MAINNET) {
            return 144 * 10 * 60; // Same as Bitcoin
        }
        return 24 * 60 * 60; // Default 24 hours
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

    /**
     * @dev Check if address contains only valid Base58 characters
     * Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
     */
    function _isValidBase58(bytes memory addrBytes) 
        private 
        pure 
        returns (bool) 
    {
        for (uint256 i = 0; i < addrBytes.length; i++) {
            bytes1 char = addrBytes[i];
            
            // Valid Base58 characters (excluding 0, O, I, l)
            if (!(
                (char >= 0x31 && char <= 0x39) || // 1-9
                (char >= 0x41 && char <= 0x48) || // A-H
                (char >= 0x4A && char <= 0x4E) || // J-N
                (char >= 0x50 && char <= 0x5A) || // P-Z
                (char >= 0x61 && char <= 0x6B) || // a-k
                (char >= 0x6D && char <= 0x7A)    // m-z
            )) {
                return false;
            }
        }
        return true;
    }

    /**
     * @dev Check if address contains only valid Bech32 characters
     * Bech32 alphabet: qpzry9x8gf2tvdw0s3jn54khce6mua7l
     */
    function _isValidBech32(bytes memory addrBytes) 
        private 
        pure 
        returns (bool) 
    {
        // Skip prefix (bc1 or tb1) and check the rest
        for (uint256 i = 3; i < addrBytes.length; i++) {
            bytes1 char = addrBytes[i];
            
            // Valid Bech32 characters
            if (!(
                (char >= 0x30 && char <= 0x39) || // 0-9
                char == 0x71 || char == 0x70 || char == 0x7A || char == 0x72 || // q, p, z, r
                char == 0x79 || char == 0x78 || char == 0x38 || char == 0x67 || // y, x, 8, g
                char == 0x66 || char == 0x32 || char == 0x74 || char == 0x76 || // f, 2, t, v
                char == 0x64 || char == 0x77 || char == 0x73 || char == 0x6A || // d, w, s, j
                char == 0x6E || char == 0x35 || char == 0x34 || char == 0x6B || // n, 5, 4, k
                char == 0x68 || char == 0x63 || char == 0x65 || char == 0x36 || // h, c, e, 6
                char == 0x6D || char == 0x75 || char == 0x61 || char == 0x37 || // m, u, a, 7
                char == 0x6C // l
            )) {
                return false;
            }
        }
        return true;
    }
}