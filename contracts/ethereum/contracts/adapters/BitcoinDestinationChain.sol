// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDestinationChain.sol";

/**
 * @title BitcoinDestinationChain
 * @notice Bitcoin destination chain adapter for 1inch Fusion+ cross-chain extension
 * @dev Implements IDestinationChain interface for Bitcoin, Dogecoin, Litecoin, and Bitcoin Cash
 */
contract BitcoinDestinationChain is IDestinationChain {
    
    // Bitcoin-family chain constants
    uint256 public constant BITCOIN_MAINNET_ID = 50001;
    uint256 public constant BITCOIN_TESTNET_ID = 50002;
    uint256 public constant DOGECOIN_MAINNET_ID = 50003;
    uint256 public constant DOGECOIN_TESTNET_ID = 50004;
    uint256 public constant LITECOIN_MAINNET_ID = 50005;
    uint256 public constant LITECOIN_TESTNET_ID = 50006;
    uint256 public constant BITCOINCASH_MAINNET_ID = 50007;
    uint256 public constant BITCOINCASH_TESTNET_ID = 50008;
    
    uint256 public constant MIN_SAFETY_DEPOSIT_BPS = 500; // 5%
    uint256 public constant DEFAULT_TIMELOCK = 7200; // 2 hours for Bitcoin confirmation times
    
    // Bitcoin-specific execution parameters
    struct BitcoinExecutionParams {
        uint256 feeSatPerByte;     // Transaction fee in satoshis per byte
        uint32 timelock;           // Relative timelock in blocks (CSV) or absolute (CLTV)
        bool useRelativeTimelock;  // Whether to use CSV (relative) or CLTV (absolute)
        bytes32 refundPubKeyHash;  // Hash of refund public key for timeout
        uint256 dustThreshold;     // Minimum output value to avoid dust
        uint8 confirmations;       // Required confirmations for settlement
    }

    // Address types for different Bitcoin-family chains
    enum AddressType {
        P2PKH,      // Pay-to-Public-Key-Hash (Legacy)
        P2SH,       // Pay-to-Script-Hash (SegWit compatible)
        P2WPKH,     // Pay-to-Witness-Public-Key-Hash (Native SegWit)
        P2WSH,      // Pay-to-Witness-Script-Hash (Native SegWit)
        P2TR        // Pay-to-Taproot (Taproot)
    }

    // Chain configuration
    ChainInfo private chainInfo;
    uint256 private chainId;
    
    // Chain-specific address prefixes
    mapping(uint256 => bytes1) public p2pkhPrefixes;
    mapping(uint256 => bytes1) public p2shPrefixes;
    mapping(uint256 => string) public bech32Prefixes;
    
    constructor(uint256 _chainId) {
        require(_isValidBitcoinChainId(_chainId), "Invalid Bitcoin-family chain ID");
        
        chainId = _chainId;
        _initializeChainInfo(_chainId);
        _initializeAddressPrefixes(_chainId);
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function getChainInfo() external view override returns (ChainInfo memory) {
        return chainInfo;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function validateDestinationAddress(bytes calldata destinationAddress) external pure override returns (bool) {
        if (destinationAddress.length == 0) return false;
        
        // Convert bytes to string for address validation
        string memory addressStr = string(destinationAddress);
        bytes memory addressBytes = bytes(addressStr);
        
        // Check different address formats - using simplified validation for pure function
        return _isBase58AddressPure(addressBytes) || _isBech32AddressPure(addressBytes);
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function validateOrderParams(
        ChainSpecificParams calldata params,
        uint256 amount
    ) external view override returns (ValidationResult memory) {
        
        // Validate destination address
        if (!this.validateDestinationAddress(params.destinationAddress)) {
            return ValidationResult({
                isValid: false,
                errorMessage: "Invalid Bitcoin address format",
                estimatedCost: 0
            });
        }
        
        // Validate amount against dust threshold
        if (params.executionParams.length > 0) {
            try this.decodeBitcoinExecutionParams(params.executionParams) returns (BitcoinExecutionParams memory btcParams) {
                if (amount < btcParams.dustThreshold) {
                    return ValidationResult({
                        isValid: false,
                        errorMessage: "Amount below dust threshold",
                        estimatedCost: 0
                    });
                }
                
                // Validate fee parameters
                if (btcParams.feeSatPerByte == 0 || btcParams.feeSatPerByte > 1000) {
                    return ValidationResult({
                        isValid: false,
                        errorMessage: "Invalid fee rate (must be 1-1000 sat/byte)",
                        estimatedCost: 0
                    });
                }
                
                // Validate timelock
                if (btcParams.timelock == 0) {
                    return ValidationResult({
                        isValid: false,
                        errorMessage: "Timelock cannot be zero",
                        estimatedCost: 0
                    });
                }
                
            } catch {
                return ValidationResult({
                    isValid: false,
                    errorMessage: "Invalid Bitcoin execution parameters encoding",
                    estimatedCost: 0
                });
            }
        }
        
        // Calculate estimated cost
        uint256 estimatedCost = this.estimateExecutionCost(params, amount);
        
        return ValidationResult({
            isValid: true,
            errorMessage: "",
            estimatedCost: estimatedCost
        });
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function calculateMinSafetyDeposit(uint256 amount) external pure override returns (uint256) {
        return (amount * MIN_SAFETY_DEPOSIT_BPS) / 10000;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function getSupportedTokenFormats() external pure override returns (string[] memory) {
        string[] memory formats = new string[](1);
        formats[0] = "native"; // Only native Bitcoin-family tokens supported
        return formats;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function estimateExecutionCost(
        ChainSpecificParams calldata params,
        uint256 /* amount */
    ) external view override returns (uint256) {
        // Bitcoin transaction cost estimation based on network fees
        uint256 baseTxSize = 250; // Typical HTLC transaction size in bytes
        uint256 feeSatPerByte = 10; // Default fee rate
        
        // Use custom fee rate if provided
        if (params.executionParams.length > 0) {
            try this.decodeBitcoinExecutionParams(params.executionParams) returns (BitcoinExecutionParams memory btcParams) {
                feeSatPerByte = btcParams.feeSatPerByte;
            } catch {
                // Use default on decode error
            }
        }
        
        // Calculate total fee in satoshis
        uint256 totalFeeSat = baseTxSize * feeSatPerByte;
        
        // Convert to Wei equivalent (assuming 1 BTC = 1 ETH for calculation purposes)
        // This is a simplified conversion - in production, use price oracles
        return totalFeeSat * 1e10; // Convert satoshi to wei (18 decimals vs 8)
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function formatTokenIdentifier(
        address, /* tokenAddress */
        string calldata tokenSymbol,
        bool isNative
    ) external pure override returns (bytes memory) {
        require(isNative, "Only native tokens supported for Bitcoin-family chains");
        return abi.encodePacked("native.", tokenSymbol);
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function supportsFeature(string calldata feature) external pure override returns (bool) {
        bytes32 featureHash = keccak256(abi.encodePacked(feature));
        
        if (featureHash == keccak256(abi.encodePacked("atomic_swaps"))) return true;
        if (featureHash == keccak256(abi.encodePacked("htlc"))) return true;
        if (featureHash == keccak256(abi.encodePacked("script_based_locks"))) return true;
        if (featureHash == keccak256(abi.encodePacked("utxo_model"))) return true;
        if (featureHash == keccak256(abi.encodePacked("timelock_csv"))) return true;
        if (featureHash == keccak256(abi.encodePacked("timelock_cltv"))) return true;
        
        return false;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function getOrderMetadata(ChainSpecificParams calldata params) external view override returns (bytes memory) {
        // Encode Bitcoin-specific metadata for 1inch order immutables
        return abi.encode(
            params.destinationAddress,
            params.executionParams,
            params.estimatedGas,
            chainId,
            block.timestamp
        );
    }

    /**
     * @notice Generate Bitcoin HTLC script
     * @param hashlock The SHA-256 hash of the secret
     * @param timelock Block height or timestamp for timeout
     * @param recipientPubKeyHash Hash of recipient's public key
     * @param refundPubKeyHash Hash of refund public key
     * @param useRelativeTimelock Whether to use CSV (relative) or CLTV (absolute)
     * @return bytes The Bitcoin script
     */
    function generateHTLCScript(
        bytes32 hashlock,
        uint32 timelock,
        bytes20 recipientPubKeyHash,
        bytes20 refundPubKeyHash,
        bool useRelativeTimelock
    ) external pure returns (bytes memory) {
        bytes memory successPath = _generateSuccessPath(hashlock, recipientPubKeyHash);
        bytes memory timeoutPath = _generateTimeoutPath(timelock, refundPubKeyHash, useRelativeTimelock);
        
        return abi.encodePacked(
            hex"63",        // OP_IF
            successPath,
            hex"67",        // OP_ELSE
            timeoutPath,
            hex"68"         // OP_ENDIF
        );
    }

    /**
     * @notice Generate the success path of HTLC script
     */
    function _generateSuccessPath(bytes32 hashlock, bytes20 recipientPubKeyHash) internal pure returns (bytes memory) {
        return abi.encodePacked(
            hex"a8",           // OP_SHA256
            hashlock,         // 32-byte hashlock
            hex"88",          // OP_EQUALVERIFY
            hex"76",          // OP_DUP
            hex"a9",          // OP_HASH160
            hex"14",          // Push 20 bytes
            recipientPubKeyHash, // 20-byte recipient pubkey hash
            hex"88",          // OP_EQUALVERIFY
            hex"ac"           // OP_CHECKSIG
        );
    }

    /**
     * @notice Generate the timeout path of HTLC script
     */
    function _generateTimeoutPath(uint32 timelock, bytes20 refundPubKeyHash, bool useRelativeTimelock) internal pure returns (bytes memory) {
        bytes memory timelockBytes = _encodeCompactSize(timelock);
        
        if (useRelativeTimelock) {
            return abi.encodePacked(
                timelockBytes,    // Timelock value
                hex"b2",          // OP_CHECKSEQUENCEVERIFY
                hex"75",          // OP_DROP
                hex"76",          // OP_DUP
                hex"a9",          // OP_HASH160
                hex"14",          // Push 20 bytes
                refundPubKeyHash, // 20-byte refund pubkey hash
                hex"88",          // OP_EQUALVERIFY
                hex"ac"           // OP_CHECKSIG
            );
        } else {
            return abi.encodePacked(
                timelockBytes,    // Timelock value
                hex"b1",          // OP_CHECKLOCKTIMEVERIFY
                hex"75",          // OP_DROP
                hex"76",          // OP_DUP
                hex"a9",          // OP_HASH160
                hex"14",          // Push 20 bytes
                refundPubKeyHash, // 20-byte refund pubkey hash
                hex"88",          // OP_EQUALVERIFY
                hex"ac"           // OP_CHECKSIG
            );
        }
    }

    /**
     * @notice Decode Bitcoin execution parameters from bytes
     * @param data Encoded execution parameters
     * @return BitcoinExecutionParams Decoded parameters
     */
    function decodeBitcoinExecutionParams(bytes calldata data) external pure returns (BitcoinExecutionParams memory) {
        return abi.decode(data, (BitcoinExecutionParams));
    }

    /**
     * @notice Encode Bitcoin execution parameters to bytes
     * @param params Bitcoin execution parameters
     * @return bytes Encoded parameters
     */
    function encodeBitcoinExecutionParams(BitcoinExecutionParams calldata params) external pure returns (bytes memory) {
        return abi.encode(params);
    }

    /**
     * @notice Create default Bitcoin execution parameters for Fusion+ orders
     * @param feeSatPerByte Fee rate in satoshis per byte
     * @param timelock Timelock value in blocks
     * @param refundPubKeyHash Public key hash for refund
     * @return bytes Encoded execution parameters
     */
    function createDefaultExecutionParams(
        uint256 feeSatPerByte,
        uint32 timelock,
        bytes32 refundPubKeyHash
    ) external pure returns (bytes memory) {
        BitcoinExecutionParams memory params = BitcoinExecutionParams({
            feeSatPerByte: feeSatPerByte,
            timelock: timelock,
            useRelativeTimelock: false, // Use absolute timelock by default
            refundPubKeyHash: refundPubKeyHash,
            dustThreshold: 546, // Standard Bitcoin dust threshold in satoshis
            confirmations: 1 // Minimum confirmations required
        });
        
        return abi.encode(params);
    }

    // Internal helper functions

    function _isValidBitcoinChainId(uint256 _chainId) internal pure returns (bool) {
        return _chainId == BITCOIN_MAINNET_ID ||
               _chainId == BITCOIN_TESTNET_ID ||
               _chainId == DOGECOIN_MAINNET_ID ||
               _chainId == DOGECOIN_TESTNET_ID ||
               _chainId == LITECOIN_MAINNET_ID ||
               _chainId == LITECOIN_TESTNET_ID ||
               _chainId == BITCOINCASH_MAINNET_ID ||
               _chainId == BITCOINCASH_TESTNET_ID;
    }

    function _initializeChainInfo(uint256 _chainId) internal {
        string memory name;
        string memory symbol;
        
        if (_chainId == BITCOIN_MAINNET_ID) {
            name = "Bitcoin Mainnet";
            symbol = "BTC";
        } else if (_chainId == BITCOIN_TESTNET_ID) {
            name = "Bitcoin Testnet";
            symbol = "BTC";
        } else if (_chainId == DOGECOIN_MAINNET_ID) {
            name = "Dogecoin Mainnet";
            symbol = "DOGE";
        } else if (_chainId == DOGECOIN_TESTNET_ID) {
            name = "Dogecoin Testnet";
            symbol = "DOGE";
        } else if (_chainId == LITECOIN_MAINNET_ID) {
            name = "Litecoin Mainnet";
            symbol = "LTC";
        } else if (_chainId == LITECOIN_TESTNET_ID) {
            name = "Litecoin Testnet";
            symbol = "LTC";
        } else if (_chainId == BITCOINCASH_MAINNET_ID) {
            name = "Bitcoin Cash Mainnet";
            symbol = "BCH";
        } else if (_chainId == BITCOINCASH_TESTNET_ID) {
            name = "Bitcoin Cash Testnet";
            symbol = "BCH";
        }
        
        chainInfo = ChainInfo({
            chainId: _chainId,
            name: name,
            symbol: symbol,
            isActive: true,
            minSafetyDepositBps: MIN_SAFETY_DEPOSIT_BPS,
            defaultTimelock: DEFAULT_TIMELOCK
        });
    }

    function _initializeAddressPrefixes(uint256 _chainId) internal {
        if (_chainId == BITCOIN_MAINNET_ID) {
            p2pkhPrefixes[_chainId] = 0x00; // 1...
            p2shPrefixes[_chainId] = 0x05;  // 3...
            bech32Prefixes[_chainId] = "bc";
        } else if (_chainId == BITCOIN_TESTNET_ID) {
            p2pkhPrefixes[_chainId] = 0x6f; // m... or n...
            p2shPrefixes[_chainId] = 0xc4;  // 2...
            bech32Prefixes[_chainId] = "tb";
        } else if (_chainId == DOGECOIN_MAINNET_ID || _chainId == DOGECOIN_TESTNET_ID) {
            p2pkhPrefixes[_chainId] = 0x1e; // D...
            p2shPrefixes[_chainId] = 0x16;  // 9... or A...
            bech32Prefixes[_chainId] = "dc"; // Dogecoin doesn't have native segwit yet
        } else if (_chainId == LITECOIN_MAINNET_ID) {
            p2pkhPrefixes[_chainId] = 0x30; // L...
            p2shPrefixes[_chainId] = 0x32;  // M...
            bech32Prefixes[_chainId] = "ltc";
        } else if (_chainId == LITECOIN_TESTNET_ID) {
            p2pkhPrefixes[_chainId] = 0x6f; // m... or n...
            p2shPrefixes[_chainId] = 0x3a;  // 2...
            bech32Prefixes[_chainId] = "tltc";
        } else if (_chainId == BITCOINCASH_MAINNET_ID || _chainId == BITCOINCASH_TESTNET_ID) {
            p2pkhPrefixes[_chainId] = 0x00; // Uses Bitcoin format but with different encoding
            p2shPrefixes[_chainId] = 0x05;
            bech32Prefixes[_chainId] = ""; // Bitcoin Cash uses CashAddr format
        }
    }

    function _isBase58Address(bytes memory addressBytes) internal pure returns (bool) {
        // Base58 addresses are typically 25-34 characters
        if (addressBytes.length < 25 || addressBytes.length > 34) {
            return false;
        }
        
        // Check for valid Base58 characters (no 0, O, I, l)
        for (uint256 i = 0; i < addressBytes.length; i++) {
            bytes1 char = addressBytes[i];
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

    function _isBech32Address(bytes memory addressBytes) internal view returns (bool) {
        string memory addressStr = string(addressBytes);
        bytes memory prefix = bytes(bech32Prefixes[chainId]);
        
        if (prefix.length == 0) return false; // Chain doesn't support bech32
        
        // Check if address starts with the correct prefix
        if (addressBytes.length < prefix.length + 6) return false; // Minimum bech32 length
        
        for (uint256 i = 0; i < prefix.length; i++) {
            if (addressBytes[i] != prefix[i]) return false;
        }
        
        // Check for separator '1'
        if (addressBytes[prefix.length] != 0x31) return false;
        
        return true;
    }

    function _isBech32AddressPure(bytes memory addressBytes) internal pure returns (bool) {
        // Simplified bech32 validation for pure function
        if (addressBytes.length < 8 || addressBytes.length > 90) return false;
        
        // Check for common bech32 prefixes (bc1, tb1, ltc1, etc.)
        if (addressBytes.length > 3) {
            // Check for bc1 (Bitcoin mainnet)
            if (addressBytes[0] == 0x62 && addressBytes[1] == 0x63 && addressBytes[2] == 0x31) return true;
            // Check for tb1 (Bitcoin testnet)  
            if (addressBytes[0] == 0x74 && addressBytes[1] == 0x62 && addressBytes[2] == 0x31) return true;
        }
        
        if (addressBytes.length > 4) {
            // Check for ltc1 (Litecoin)
            if (addressBytes[0] == 0x6c && addressBytes[1] == 0x74 && addressBytes[2] == 0x63 && addressBytes[3] == 0x31) return true;
        }
        
        return false;
    }

    function _isBase58AddressPure(bytes memory addressBytes) internal pure returns (bool) {
        return _isBase58Address(addressBytes);
    }

    function _validateBase58Address(bytes memory addressBytes) internal view returns (bool) {
        // Simplified validation - in production, implement full Base58Check validation
        return _isBase58Address(addressBytes);
    }

    function _validateBech32Address(bytes memory addressBytes) internal view returns (bool) {
        // Simplified validation - in production, implement full Bech32 validation
        return _isBech32Address(addressBytes);
    }

    function _encodeCompactSize(uint32 value) internal pure returns (bytes memory) {
        if (value < 0xfd) {
            return abi.encodePacked(uint8(value));
        } else if (value <= 0xffff) {
            return abi.encodePacked(hex"fd", uint16(value));
        } else {
            return abi.encodePacked(hex"fe", value);
        }
    }
}