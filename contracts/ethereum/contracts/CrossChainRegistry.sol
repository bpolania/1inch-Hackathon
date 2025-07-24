// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IDestinationChain.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CrossChainRegistry
 * @notice Registry for managing destination chain adapters in 1inch Fusion+ cross-chain extension
 * @dev Allows dynamic addition/removal of supported destination chains (NEAR, Cosmos, Bitcoin, etc.)
 */
contract CrossChainRegistry is Ownable {
    
    // Mapping from chain ID to destination chain adapter
    mapping(uint256 => IDestinationChain) public chainAdapters;
    
    // Array of supported chain IDs for enumeration
    uint256[] public supportedChainIds;
    
    // Mapping to track if a chain ID is supported (for O(1) lookup)
    mapping(uint256 => bool) public isChainSupported;
    
    // Events
    event ChainAdapterRegistered(uint256 indexed chainId, address indexed adapter, string chainName);
    event ChainAdapterRemoved(uint256 indexed chainId, string chainName);
    event ChainAdapterUpdated(uint256 indexed chainId, address indexed oldAdapter, address indexed newAdapter);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Register a new destination chain adapter
     * @param chainId The unique chain identifier
     * @param adapter The destination chain adapter contract
     */
    function registerChainAdapter(uint256 chainId, IDestinationChain adapter) external onlyOwner {
        require(address(adapter) != address(0), "Invalid adapter address");
        require(!isChainSupported[chainId], "Chain already registered");
        
        // Verify the adapter returns the correct chain ID
        IDestinationChain.ChainInfo memory chainInfo = adapter.getChainInfo();
        require(chainInfo.chainId == chainId, "Chain ID mismatch");
        require(chainInfo.isActive, "Chain adapter is not active");
        
        // Register the adapter
        chainAdapters[chainId] = adapter;
        supportedChainIds.push(chainId);
        isChainSupported[chainId] = true;
        
        emit ChainAdapterRegistered(chainId, address(adapter), chainInfo.name);
    }

    /**
     * @notice Update an existing destination chain adapter
     * @param chainId The chain identifier to update
     * @param newAdapter The new destination chain adapter contract
     */
    function updateChainAdapter(uint256 chainId, IDestinationChain newAdapter) external onlyOwner {
        require(isChainSupported[chainId], "Chain not registered");
        require(address(newAdapter) != address(0), "Invalid adapter address");
        
        // Verify the new adapter returns the correct chain ID
        IDestinationChain.ChainInfo memory chainInfo = newAdapter.getChainInfo();
        require(chainInfo.chainId == chainId, "Chain ID mismatch");
        
        address oldAdapter = address(chainAdapters[chainId]);
        chainAdapters[chainId] = newAdapter;
        
        emit ChainAdapterUpdated(chainId, oldAdapter, address(newAdapter));
    }

    /**
     * @notice Remove a destination chain adapter
     * @param chainId The chain identifier to remove
     */
    function removeChainAdapter(uint256 chainId) external onlyOwner {
        require(isChainSupported[chainId], "Chain not registered");
        
        // Get chain name for event
        IDestinationChain.ChainInfo memory chainInfo = chainAdapters[chainId].getChainInfo();
        string memory chainName = chainInfo.name;
        
        // Remove from mapping
        delete chainAdapters[chainId];
        isChainSupported[chainId] = false;
        
        // Remove from array (expensive operation, but admin-only)
        for (uint256 i = 0; i < supportedChainIds.length; i++) {
            if (supportedChainIds[i] == chainId) {
                supportedChainIds[i] = supportedChainIds[supportedChainIds.length - 1];
                supportedChainIds.pop();
                break;
            }
        }
        
        emit ChainAdapterRemoved(chainId, chainName);
    }

    /**
     * @notice Get destination chain adapter for a specific chain ID
     * @param chainId The chain identifier
     * @return IDestinationChain The destination chain adapter
     */
    function getChainAdapter(uint256 chainId) external view returns (IDestinationChain) {
        require(isChainSupported[chainId], "Chain not supported");
        return chainAdapters[chainId];
    }

    /**
     * @notice Get information for a specific chain
     * @param chainId The chain identifier
     * @return ChainInfo The chain information
     */
    function getChainInfo(uint256 chainId) external view returns (IDestinationChain.ChainInfo memory) {
        require(isChainSupported[chainId], "Chain not supported");
        return chainAdapters[chainId].getChainInfo();
    }

    /**
     * @notice Get all supported chain IDs
     * @return uint256[] Array of supported chain IDs
     */
    function getSupportedChainIds() external view returns (uint256[] memory) {
        return supportedChainIds;
    }

    /**
     * @notice Get information for all supported chains
     * @return ChainInfo[] Array of chain information for all supported chains
     */
    function getAllChainInfo() external view returns (IDestinationChain.ChainInfo[] memory) {
        IDestinationChain.ChainInfo[] memory chainInfos = new IDestinationChain.ChainInfo[](supportedChainIds.length);
        
        for (uint256 i = 0; i < supportedChainIds.length; i++) {
            chainInfos[i] = chainAdapters[supportedChainIds[i]].getChainInfo();
        }
        
        return chainInfos;
    }

    /**
     * @notice Validate destination address for a specific chain
     * @param chainId The chain identifier
     * @param destinationAddress The address to validate
     * @return bool True if address format is valid
     */
    function validateDestinationAddress(uint256 chainId, bytes calldata destinationAddress) external view returns (bool) {
        require(isChainSupported[chainId], "Chain not supported");
        return chainAdapters[chainId].validateDestinationAddress(destinationAddress);
    }

    /**
     * @notice Validate order parameters for a specific chain
     * @param chainId The chain identifier
     * @param params Chain-specific parameters
     * @param amount The amount being transferred
     * @return ValidationResult Validation result with details
     */
    function validateOrderParams(
        uint256 chainId,
        IDestinationChain.ChainSpecificParams calldata params,
        uint256 amount
    ) external view returns (IDestinationChain.ValidationResult memory) {
        require(isChainSupported[chainId], "Chain not supported");
        return chainAdapters[chainId].validateOrderParams(params, amount);
    }

    /**
     * @notice Calculate minimum safety deposit for a specific chain
     * @param chainId The chain identifier
     * @param amount The amount being transferred
     * @return uint256 Minimum safety deposit required
     */
    function calculateMinSafetyDeposit(uint256 chainId, uint256 amount) external view returns (uint256) {
        require(isChainSupported[chainId], "Chain not supported");
        return chainAdapters[chainId].calculateMinSafetyDeposit(amount);
    }

    /**
     * @notice Estimate execution cost for a specific chain
     * @param chainId The chain identifier
     * @param params Chain-specific parameters
     * @param amount Amount being transferred
     * @return uint256 Estimated cost in destination chain's native currency
     */
    function estimateExecutionCost(
        uint256 chainId,
        IDestinationChain.ChainSpecificParams calldata params,
        uint256 amount
    ) external view returns (uint256) {
        require(isChainSupported[chainId], "Chain not supported");
        return chainAdapters[chainId].estimateExecutionCost(params, amount);
    }

    /**
     * @notice Check if a specific feature is supported by a chain
     * @param chainId The chain identifier
     * @param feature Feature identifier
     * @return bool True if feature is supported
     */
    function supportsFeature(uint256 chainId, string calldata feature) external view returns (bool) {
        require(isChainSupported[chainId], "Chain not supported");
        return chainAdapters[chainId].supportsFeature(feature);
    }

    /**
     * @notice Get the number of supported chains
     * @return uint256 Number of supported chains
     */
    function getSupportedChainCount() external view returns (uint256) {
        return supportedChainIds.length;
    }

    /**
     * @notice Check if multiple chains are supported
     * @param chainIds Array of chain identifiers to check
     * @return bool[] Array indicating which chains are supported
     */
    function areChainsSupportedBatch(uint256[] calldata chainIds) external view returns (bool[] memory) {
        bool[] memory results = new bool[](chainIds.length);
        
        for (uint256 i = 0; i < chainIds.length; i++) {
            results[i] = isChainSupported[chainIds[i]];
        }
        
        return results;
    }
}