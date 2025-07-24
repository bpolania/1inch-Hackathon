// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDestinationChain
 * @notice Interface for modular destination chain support in 1inch Fusion+ cross-chain extension
 * @dev Each destination chain (NEAR, Cosmos, Bitcoin) implements this interface
 */
interface IDestinationChain {
    
    /**
     * @notice Chain information structure
     */
    struct ChainInfo {
        uint256 chainId;           // Unique chain identifier (e.g., 40001 for NEAR_MAINNET)
        string name;               // Human-readable name (e.g., "NEAR Protocol")
        string symbol;             // Chain symbol (e.g., "NEAR")
        bool isActive;             // Whether this chain is currently supported
        uint256 minSafetyDepositBps;  // Minimum safety deposit in basis points
        uint256 defaultTimelock;   // Default timelock duration in seconds
    }

    /**
     * @notice Chain-specific order parameters
     */
    struct ChainSpecificParams {
        bytes destinationAddress;  // Address format varies by chain
        bytes executionParams;     // Chain-specific execution parameters
        uint256 estimatedGas;      // Estimated gas/fee for destination execution
        bytes additionalData;      // Any additional chain-specific data
    }

    /**
     * @notice Validation result for chain-specific parameters
     */
    struct ValidationResult {
        bool isValid;
        string errorMessage;
        uint256 estimatedCost;
    }

    /**
     * @notice Get chain information
     * @return ChainInfo struct with chain details
     */
    function getChainInfo() external view returns (ChainInfo memory);

    /**
     * @notice Validate destination address format
     * @param destinationAddress The address to validate
     * @return bool True if address format is valid for this chain
     */
    function validateDestinationAddress(bytes calldata destinationAddress) external pure returns (bool);

    /**
     * @notice Validate chain-specific parameters for order creation
     * @param params Chain-specific parameters to validate
     * @param amount The amount being transferred
     * @return ValidationResult struct with validation details
     */
    function validateOrderParams(
        ChainSpecificParams calldata params,
        uint256 amount
    ) external view returns (ValidationResult memory);

    /**
     * @notice Calculate minimum safety deposit for this chain
     * @param amount The amount being transferred
     * @return uint256 Minimum safety deposit required
     */
    function calculateMinSafetyDeposit(uint256 amount) external view returns (uint256);

    /**
     * @notice Get supported token formats for this chain
     * @return string[] Array of supported token format identifiers
     */
    function getSupportedTokenFormats() external pure returns (string[] memory);

    /**
     * @notice Estimate execution cost on destination chain
     * @param params Chain-specific parameters
     * @param amount Amount being transferred
     * @return uint256 Estimated cost in destination chain's native currency
     */
    function estimateExecutionCost(
        ChainSpecificParams calldata params,
        uint256 amount
    ) external view returns (uint256);

    /**
     * @notice Format token identifier for this chain
     * @param tokenAddress Token address (if applicable)
     * @param tokenSymbol Token symbol
     * @param isNative Whether this is the chain's native token
     * @return bytes Formatted token identifier
     */
    function formatTokenIdentifier(
        address tokenAddress,
        string calldata tokenSymbol,
        bool isNative
    ) external pure returns (bytes memory);

    /**
     * @notice Check if a specific feature is supported
     * @param feature Feature identifier (e.g., "partial_fills", "batch_execution")
     * @return bool True if feature is supported
     */
    function supportsFeature(string calldata feature) external pure returns (bool);

    /**
     * @notice Get chain-specific metadata for order creation
     * @param params Chain-specific parameters
     * @return bytes Encoded metadata for 1inch order immutables
     */
    function getOrderMetadata(ChainSpecificParams calldata params) external view returns (bytes memory);
}