// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDestinationChain.sol";

/**
 * @title NearDestinationChain
 * @notice NEAR Protocol destination chain adapter for 1inch Fusion+ cross-chain extension
 * @dev Implements IDestinationChain interface for NEAR mainnet and testnet support
 */
contract NearDestinationChain is IDestinationChain {
    
    // NEAR chain constants
    uint256 public constant NEAR_MAINNET_ID = 40001;
    uint256 public constant NEAR_TESTNET_ID = 40002;
    uint256 public constant MIN_SAFETY_DEPOSIT_BPS = 500; // 5%
    uint256 public constant DEFAULT_TIMELOCK = 3600; // 1 hour
    
    // NEAR-specific parameters structure
    struct NearExecutionParams {
        string contractId;      // NEAR contract account ID
        string methodName;      // Contract method to call
        bytes args;            // Method arguments (JSON encoded)
        uint128 attachedDeposit; // Attached NEAR deposit
        uint64 gas;            // Gas limit for execution
    }

    // Chain configuration
    ChainInfo private chainInfo;
    
    constructor(uint256 _chainId) {
        require(_chainId == NEAR_MAINNET_ID || _chainId == NEAR_TESTNET_ID, "Invalid NEAR chain ID");
        
        chainInfo = ChainInfo({
            chainId: _chainId,
            name: _chainId == NEAR_MAINNET_ID ? "NEAR Protocol Mainnet" : "NEAR Protocol Testnet",
            symbol: "NEAR",
            isActive: true,
            minSafetyDepositBps: MIN_SAFETY_DEPOSIT_BPS,
            defaultTimelock: DEFAULT_TIMELOCK
        });
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
        // Convert bytes to string for NEAR address validation
        string memory addressStr = string(destinationAddress);
        bytes memory addressBytes = bytes(addressStr);
        
        // NEAR addresses are 2-64 characters, containing only lowercase letters, digits, and underscore/hyphen
        if (addressBytes.length < 2 || addressBytes.length > 64) {
            return false;
        }
        
        // Check for invalid patterns: leading/trailing dots, consecutive dots
        if (addressBytes[0] == 0x2E || addressBytes[addressBytes.length - 1] == 0x2E) {
            return false; // No leading or trailing dots
        }
        
        // Basic character validation and consecutive dot check
        for (uint256 i = 0; i < addressBytes.length; i++) {
            bytes1 char = addressBytes[i];
            if (!(
                (char >= 0x30 && char <= 0x39) || // 0-9
                (char >= 0x61 && char <= 0x7A) || // a-z
                char == 0x5F || // _
                char == 0x2D || // -
                char == 0x2E    // . (for subaccounts)
            )) {
                return false;
            }
            
            // Check for consecutive dots
            if (char == 0x2E && i > 0 && addressBytes[i - 1] == 0x2E) {
                return false;
            }
        }
        
        return true;
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
                errorMessage: "Invalid NEAR destination address format",
                estimatedCost: 0
            });
        }
        
        // Decode and validate NEAR execution parameters
        if (params.executionParams.length > 0) {
            try this.decodeNearExecutionParams(params.executionParams) returns (NearExecutionParams memory nearParams) {
                // Validate contract ID format
                if (bytes(nearParams.contractId).length == 0) {
                    return ValidationResult({
                        isValid: false,
                        errorMessage: "NEAR contract ID cannot be empty",
                        estimatedCost: 0
                    });
                }
                
                // Validate method name
                if (bytes(nearParams.methodName).length == 0) {
                    return ValidationResult({
                        isValid: false,
                        errorMessage: "NEAR method name cannot be empty",
                        estimatedCost: 0
                    });
                }
                
            } catch {
                return ValidationResult({
                    isValid: false,
                    errorMessage: "Invalid NEAR execution parameters encoding",
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
        string[] memory formats = new string[](2);
        formats[0] = "native"; // Native NEAR tokens
        formats[1] = "nep141"; // NEP-141 fungible tokens
        return formats;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function estimateExecutionCost(
        ChainSpecificParams calldata params,
        uint256 amount
    ) external pure override returns (uint256) {
        // Estimate based on NEAR gas costs
        // Base cost: ~0.001 NEAR for simple transfers
        // Additional cost for complex contract calls
        uint256 baseCost = 1e21; // 0.001 NEAR in yoctoNEAR
        
        // Add complexity cost based on execution parameters
        if (params.executionParams.length > 0) {
            baseCost += (params.executionParams.length * 1e18) / 1000; // Additional cost per byte
        }
        
        // Add percentage-based cost for larger amounts
        if (amount > 1e24) { // > 1 NEAR
            baseCost += (amount / 1000); // 0.1% of amount
        }
        
        return baseCost;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function formatTokenIdentifier(
        address, /* tokenAddress */
        string calldata tokenSymbol,
        bool isNative
    ) external pure override returns (bytes memory) {
        if (isNative) {
            return abi.encodePacked("native.near");
        } else {
            // For NEAR, we use the contract account ID as token identifier
            return abi.encodePacked(tokenSymbol, ".near");
        }
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function supportsFeature(string calldata feature) external pure override returns (bool) {
        // Convert string to bytes32 for efficient comparison
        bytes32 featureHash = keccak256(abi.encodePacked(feature));
        
        if (featureHash == keccak256(abi.encodePacked("atomic_swaps"))) return true;
        if (featureHash == keccak256(abi.encodePacked("htlc"))) return true;
        if (featureHash == keccak256(abi.encodePacked("resolver_fees"))) return true;
        if (featureHash == keccak256(abi.encodePacked("safety_deposits"))) return true;
        if (featureHash == keccak256(abi.encodePacked("timelock_stages"))) return true;
        
        return false;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function getOrderMetadata(ChainSpecificParams calldata params) external view override returns (bytes memory) {
        // Encode NEAR-specific metadata for 1inch order immutables
        return abi.encode(
            params.destinationAddress,
            params.executionParams,
            params.estimatedGas,
            block.timestamp // Add timestamp for order tracking
        );
    }

    /**
     * @notice Decode NEAR execution parameters from bytes
     * @param data Encoded execution parameters
     * @return NearExecutionParams Decoded parameters
     */
    function decodeNearExecutionParams(bytes calldata data) external pure returns (NearExecutionParams memory) {
        return abi.decode(data, (NearExecutionParams));
    }

    /**
     * @notice Encode NEAR execution parameters to bytes
     * @param params NEAR execution parameters
     * @return bytes Encoded parameters
     */
    function encodeNearExecutionParams(NearExecutionParams calldata params) external pure returns (bytes memory) {
        return abi.encode(params);
    }

    /**
     * @notice Create default NEAR execution parameters for Fusion+ orders
     * @param contractId NEAR contract account ID
     * @param amount Amount to transfer
     * @return bytes Encoded execution parameters
     */
    function createDefaultExecutionParams(
        string calldata contractId,
        uint256 amount
    ) external pure returns (bytes memory) {
        NearExecutionParams memory params = NearExecutionParams({
            contractId: contractId,
            methodName: "execute_fusion_order",
            args: abi.encodePacked('{"amount":"', _uint2str(amount), '"}'),
            attachedDeposit: uint128(amount),
            gas: 300_000_000_000_000 // 300 TGas
        });
        
        return abi.encode(params);
    }

    /**
     * @notice Convert uint256 to string
     * @param value The uint256 value to convert
     * @return string The string representation
     */
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}