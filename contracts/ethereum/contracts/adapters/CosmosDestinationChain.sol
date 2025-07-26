// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDestinationChain.sol";

/**
 * @title CosmosDestinationChain
 * @notice Cosmos ecosystem destination chain adapter for 1inch Fusion+ cross-chain extension
 * @dev Implements IDestinationChain interface for Neutron, Juno, and other Cosmos chains
 */
contract CosmosDestinationChain is IDestinationChain {
    
    // Cosmos chain constants (following bounty specification)
    uint256 public constant NEUTRON_TESTNET_ID = 7001;
    uint256 public constant JUNO_TESTNET_ID = 7002;
    
    // Future Cosmos chains
    uint256 public constant COSMOS_HUB_MAINNET_ID = 30001;
    uint256 public constant COSMOS_HUB_TESTNET_ID = 30002;
    uint256 public constant OSMOSIS_MAINNET_ID = 30003;
    uint256 public constant OSMOSIS_TESTNET_ID = 30004;
    uint256 public constant STARGAZE_MAINNET_ID = 30005;
    uint256 public constant STARGAZE_TESTNET_ID = 30006;
    uint256 public constant AKASH_MAINNET_ID = 30007;
    uint256 public constant AKASH_TESTNET_ID = 30008;
    
    uint256 public constant MIN_SAFETY_DEPOSIT_BPS = 500; // 5%
    uint256 public constant DEFAULT_TIMELOCK = 3600; // 1 hour
    
    // CosmWasm-specific parameters structure
    struct CosmosExecutionParams {
        string contractAddress;  // CosmWasm contract address (bech32)
        bytes msg;              // Execute message (JSON encoded)
        string funds;           // Native tokens to send (e.g., "1000000untrn")
        uint64 gasLimit;        // Gas limit for execution
    }

    // Chain configuration
    ChainInfo private chainInfo;
    
    constructor(uint256 _chainId) {
        require(_isValidCosmosChainId(_chainId), "Invalid Cosmos chain ID");
        
        chainInfo = ChainInfo({
            chainId: _chainId,
            name: _getChainName(_chainId),
            symbol: _getNativeSymbol(_chainId),
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
        // Convert bytes to string for Cosmos bech32 address validation
        string memory addressStr = string(destinationAddress);
        bytes memory addressBytes = bytes(addressStr);
        
        // Cosmos bech32 addresses are 39-59 characters
        if (addressBytes.length < 39 || addressBytes.length > 59) {
            return false;
        }
        
        // Find separator '1' which is required for bech32
        uint256 separatorIndex = 0;
        for (uint256 i = 0; i < addressBytes.length; i++) {
            if (addressBytes[i] == 0x31) { // '1' in ASCII
                separatorIndex = i;
                break;
            }
        }
        
        // Must have separator and not be at start or end
        if (separatorIndex == 0 || separatorIndex == addressBytes.length - 1) {
            return false;
        }
        
        // Validate prefix characters (before separator) - must be lowercase letters
        for (uint256 i = 0; i < separatorIndex; i++) {
            bytes1 char = addressBytes[i];
            if (!(char >= 0x61 && char <= 0x7A)) { // a-z
                return false;
            }
        }
        
        // Validate data part (after separator) - lowercase letters and digits
        for (uint256 i = separatorIndex + 1; i < addressBytes.length; i++) {
            bytes1 char = addressBytes[i];
            if (!(
                (char >= 0x30 && char <= 0x39) || // 0-9
                (char >= 0x61 && char <= 0x7A)    // a-z
            )) {
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
                errorMessage: "Invalid Cosmos destination address format",
                estimatedCost: 0
            });
        }
        
        // Decode and validate Cosmos execution parameters
        if (params.executionParams.length > 0) {
            try this.decodeCosmosExecutionParams(params.executionParams) returns (CosmosExecutionParams memory cosmosParams) {
                // Validate contract address format
                if (bytes(cosmosParams.contractAddress).length == 0) {
                    return ValidationResult({
                        isValid: false,
                        errorMessage: "CosmWasm contract address cannot be empty",
                        estimatedCost: 0
                    });
                }
                
                // Validate contract address is bech32 format
                if (!_validateBech32Address(cosmosParams.contractAddress)) {
                    return ValidationResult({
                        isValid: false,
                        errorMessage: "Invalid CosmWasm contract address format",
                        estimatedCost: 0
                    });
                }
                
                // Validate message is not empty
                if (cosmosParams.msg.length == 0) {
                    return ValidationResult({
                        isValid: false,
                        errorMessage: "CosmWasm message cannot be empty",
                        estimatedCost: 0
                    });
                }
                
                // Validate gas limit is reasonable
                if (cosmosParams.gasLimit > 0 && cosmosParams.gasLimit < 50000) {
                    return ValidationResult({
                        isValid: false,
                        errorMessage: "CosmWasm gas limit too low (minimum 50,000)",
                        estimatedCost: 0
                    });
                }
                
            } catch {
                return ValidationResult({
                    isValid: false,
                    errorMessage: "Invalid Cosmos execution parameters encoding",
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
        formats[0] = "native"; // Native Cosmos tokens (untrn, ujuno, uatom, etc.)
        formats[1] = "cw20";   // CW20 fungible tokens (future support)
        return formats;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function estimateExecutionCost(
        ChainSpecificParams calldata params,
        uint256 amount
    ) external view override returns (uint256) {
        // Base cost estimation for Cosmos transactions
        // Using micro units (6 decimals) for most Cosmos tokens
        uint256 baseCost = _getBaseCost(chainInfo.chainId);
        
        // Add complexity cost based on execution parameters
        if (params.executionParams.length > 0) {
            // Additional cost for CosmWasm contract execution
            baseCost += (params.executionParams.length * baseCost) / 1000; // 0.1% per byte
            
            // Extract gas limit if provided
            try this.decodeCosmosExecutionParams(params.executionParams) returns (CosmosExecutionParams memory cosmosParams) {
                if (cosmosParams.gasLimit > 300000) {
                    // Higher gas = higher cost
                    baseCost += (baseCost * (cosmosParams.gasLimit - 300000)) / 1000000;
                }
            } catch {
                // Default additional cost for complex execution
                baseCost += baseCost / 10; // 10% additional
            }
        }
        
        // Add percentage-based cost for larger amounts
        if (amount > _getLargeAmountThreshold(chainInfo.chainId)) {
            baseCost += (amount / 1000); // 0.1% of amount
        }
        
        return baseCost;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function formatTokenIdentifier(
        address, /* tokenAddress - not used for Cosmos */
        string calldata tokenSymbol,
        bool isNative
    ) external pure override returns (bytes memory) {
        if (isNative) {
            // Return generic Cosmos native denomination (chain-specific mapping handled elsewhere)
            return abi.encodePacked("native");
        } else {
            // For CW20 tokens, use contract address (future implementation)
            return abi.encodePacked("cw20:", tokenSymbol);
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
        if (featureHash == keccak256(abi.encodePacked("cosmwasm"))) return true;
        if (featureHash == keccak256(abi.encodePacked("ibc"))) return true;
        
        return false;
    }

    /**
     * @inheritdoc IDestinationChain
     */
    function getOrderMetadata(ChainSpecificParams calldata params) external view override returns (bytes memory) {
        // Encode Cosmos-specific metadata for 1inch order immutables
        return abi.encode(
            params.destinationAddress,
            params.executionParams,
            params.estimatedGas,
            block.timestamp, // Add timestamp for order tracking
            chainInfo.chainId // Include chain ID for multi-chain support
        );
    }

    /**
     * @notice Decode Cosmos execution parameters from bytes
     * @param data Encoded execution parameters
     * @return CosmosExecutionParams Decoded parameters
     */
    function decodeCosmosExecutionParams(bytes calldata data) external pure returns (CosmosExecutionParams memory) {
        return abi.decode(data, (CosmosExecutionParams));
    }

    /**
     * @notice Encode Cosmos execution parameters to bytes
     * @param params Cosmos execution parameters
     * @return bytes Encoded parameters
     */
    function encodeCosmosExecutionParams(CosmosExecutionParams calldata params) external pure returns (bytes memory) {
        return abi.encode(params);
    }

    /**
     * @notice Create default Cosmos execution parameters for Fusion+ orders
     * @param contractAddress CosmWasm contract address
     * @param amount Amount to transfer (in micro units)
     * @param nativeDenom Native token denomination
     * @return bytes Encoded execution parameters
     */
    function createDefaultExecutionParams(
        string calldata contractAddress,
        uint256 amount,
        string calldata nativeDenom
    ) external pure returns (bytes memory) {
        CosmosExecutionParams memory params = CosmosExecutionParams({
            contractAddress: contractAddress,
            msg: abi.encodePacked('{"execute_fusion_order":{"amount":"', _uint2str(amount), '"}}'),
            funds: string(abi.encodePacked(_uint2str(amount), nativeDenom)),
            gasLimit: 300000 // Default 300k gas
        });
        
        return abi.encode(params);
    }

    // Internal helper functions

    function _isValidCosmosChainId(uint256 chainId) internal pure returns (bool) {
        return chainId == NEUTRON_TESTNET_ID ||
               chainId == JUNO_TESTNET_ID ||
               (chainId >= COSMOS_HUB_MAINNET_ID && chainId <= AKASH_TESTNET_ID);
    }

    function _getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == NEUTRON_TESTNET_ID) return "Neutron Testnet";
        if (chainId == JUNO_TESTNET_ID) return "Juno Testnet";
        if (chainId == COSMOS_HUB_MAINNET_ID) return "Cosmos Hub";
        if (chainId == COSMOS_HUB_TESTNET_ID) return "Cosmos Hub Testnet";
        if (chainId == OSMOSIS_MAINNET_ID) return "Osmosis";
        if (chainId == OSMOSIS_TESTNET_ID) return "Osmosis Testnet";
        if (chainId == STARGAZE_MAINNET_ID) return "Stargaze";
        if (chainId == STARGAZE_TESTNET_ID) return "Stargaze Testnet";
        if (chainId == AKASH_MAINNET_ID) return "Akash Network";
        if (chainId == AKASH_TESTNET_ID) return "Akash Network Testnet";
        return "Unknown Cosmos Chain";
    }

    function _getNativeSymbol(uint256 chainId) internal pure returns (string memory) {
        if (chainId == NEUTRON_TESTNET_ID) return "NTRN";
        if (chainId == JUNO_TESTNET_ID) return "JUNO";
        if (chainId == COSMOS_HUB_MAINNET_ID || chainId == COSMOS_HUB_TESTNET_ID) return "ATOM";
        if (chainId == OSMOSIS_MAINNET_ID || chainId == OSMOSIS_TESTNET_ID) return "OSMO";
        if (chainId == STARGAZE_MAINNET_ID || chainId == STARGAZE_TESTNET_ID) return "STARS";
        if (chainId == AKASH_MAINNET_ID || chainId == AKASH_TESTNET_ID) return "AKT";
        return "ATOM"; // Default to ATOM
    }

    function _getAddressPrefix(uint256 chainId) internal pure returns (string memory) {
        if (chainId == NEUTRON_TESTNET_ID) return "neutron";
        if (chainId == JUNO_TESTNET_ID) return "juno";
        if (chainId == COSMOS_HUB_MAINNET_ID || chainId == COSMOS_HUB_TESTNET_ID) return "cosmos";
        if (chainId == OSMOSIS_MAINNET_ID || chainId == OSMOSIS_TESTNET_ID) return "osmo";
        if (chainId == STARGAZE_MAINNET_ID || chainId == STARGAZE_TESTNET_ID) return "stars";
        if (chainId == AKASH_MAINNET_ID || chainId == AKASH_TESTNET_ID) return "akash";
        return "cosmos"; // Default to cosmos
    }

    function _getNativeDenom(uint256 chainId) internal pure returns (string memory) {
        if (chainId == NEUTRON_TESTNET_ID) return "untrn";
        if (chainId == JUNO_TESTNET_ID) return "ujuno";
        if (chainId == COSMOS_HUB_MAINNET_ID || chainId == COSMOS_HUB_TESTNET_ID) return "uatom";
        if (chainId == OSMOSIS_MAINNET_ID || chainId == OSMOSIS_TESTNET_ID) return "uosmo";
        if (chainId == STARGAZE_MAINNET_ID || chainId == STARGAZE_TESTNET_ID) return "ustars";
        if (chainId == AKASH_MAINNET_ID || chainId == AKASH_TESTNET_ID) return "uakt";
        return "uatom"; // Default to uatom
    }

    function _getBaseCost(uint256 chainId) internal pure returns (uint256) {
        // Base costs in micro units (6 decimals)
        if (chainId == NEUTRON_TESTNET_ID) return 5000; // 0.005 NTRN
        if (chainId == JUNO_TESTNET_ID) return 3000;    // 0.003 JUNO
        if (chainId == COSMOS_HUB_MAINNET_ID || chainId == COSMOS_HUB_TESTNET_ID) return 2000; // 0.002 ATOM
        if (chainId == OSMOSIS_MAINNET_ID || chainId == OSMOSIS_TESTNET_ID) return 1000;       // 0.001 OSMO
        if (chainId == STARGAZE_MAINNET_ID || chainId == STARGAZE_TESTNET_ID) return 10000;    // 0.01 STARS
        if (chainId == AKASH_MAINNET_ID || chainId == AKASH_TESTNET_ID) return 5000;           // 0.005 AKT
        return 2000; // Default 0.002 in micro units
    }

    function _getLargeAmountThreshold(uint256 chainId) internal pure returns (uint256) {
        // Thresholds in micro units (equivalent to 10 tokens)
        if (chainId == NEUTRON_TESTNET_ID) return 10000000;  // 10 NTRN
        if (chainId == JUNO_TESTNET_ID) return 10000000;     // 10 JUNO
        if (chainId == COSMOS_HUB_MAINNET_ID || chainId == COSMOS_HUB_TESTNET_ID) return 10000000; // 10 ATOM
        if (chainId == OSMOSIS_MAINNET_ID || chainId == OSMOSIS_TESTNET_ID) return 10000000;       // 10 OSMO
        if (chainId == STARGAZE_MAINNET_ID || chainId == STARGAZE_TESTNET_ID) return 10000000;     // 10 STARS
        if (chainId == AKASH_MAINNET_ID || chainId == AKASH_TESTNET_ID) return 10000000;           // 10 AKT
        return 10000000; // Default 10 tokens in micro units
    }

    function _validateBech32Address(string memory addr) internal pure returns (bool) {
        bytes memory addrBytes = bytes(addr);
        
        // Must be 39-59 characters for bech32
        if (addrBytes.length < 39 || addrBytes.length > 59) {
            return false;
        }
        
        // Find separator '1'
        uint256 separatorIndex = 0;
        for (uint256 i = 0; i < addrBytes.length; i++) {
            if (addrBytes[i] == 0x31) { // '1'
                separatorIndex = i;
                break;
            }
        }
        
        // Must have separator and not be at start or end
        if (separatorIndex == 0 || separatorIndex == addrBytes.length - 1) {
            return false;
        }
        
        // Validate characters after separator are valid bech32
        for (uint256 i = separatorIndex + 1; i < addrBytes.length; i++) {
            bytes1 char = addrBytes[i];
            if (!(
                (char >= 0x30 && char <= 0x39) || // 0-9
                (char >= 0x61 && char <= 0x7A)    // a-z
            )) {
                return false;
            }
        }
        
        return true;
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