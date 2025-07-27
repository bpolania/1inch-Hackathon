// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@1inch/limit-order-protocol-contract/contracts/interfaces/ITakerInteraction.sol";
import "@1inch/limit-order-protocol-contract/contracts/interfaces/IOrderMixin.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import "../CrossChainRegistry.sol";
import "../interfaces/IDestinationChain.sol";
import "../interfaces/IOneInchEscrowFactory.sol";
import "../interfaces/IOneInchEscrow.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NearTakerInteraction
 * @notice ITakerInteraction implementation for 1inch Fusion+ NEAR cross-chain swaps
 * @dev Integrates with 1inch's existing EscrowFactory system for atomic cross-chain swaps to NEAR
 */
contract NearTakerInteraction is ITakerInteraction, Ownable, ReentrancyGuard {
    using AddressLib for Address;
    
    struct NearOrderData {
        uint256 destinationChainId;    // NEAR mainnet (40001) or testnet (40002) 
        bytes destinationToken;        // NEAR token identifier
        uint256 destinationAmount;     // Amount on NEAR
        bytes destinationAddress;      // NEAR address (.near or .testnet)
        bytes32 hashlock;             // SHA-256 hashlock for atomic coordination
        uint256 expiryTime;           // Order expiry timestamp
        bytes chainSpecificParams;    // NEAR-specific execution parameters
    }
    
    // State variables
    CrossChainRegistry public immutable registry;
    IOneInchEscrowFactory public immutable escrowFactory;  // 1inch EscrowFactory
    
    mapping(bytes32 => NearOrderData) public nearOrders;
    mapping(address => bool) public authorizedResolvers;
    
    // Events
    event NearOrderCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        uint256 destinationChainId,
        bytes destinationToken,
        uint256 destinationAmount,
        bytes destinationAddress,
        bytes32 hashlock
    );
    
    
    event ResolverAuthorized(address indexed resolver);
    event ResolverRevoked(address indexed resolver);

    constructor(
        CrossChainRegistry _registry,
        IOneInchEscrowFactory _escrowFactory
    ) Ownable(msg.sender) {
        require(address(_registry) != address(0), "Invalid registry address");
        require(address(_escrowFactory) != address(0), "Invalid escrow factory address");
        
        registry = _registry;
        escrowFactory = _escrowFactory;
    }

    /**
     * @notice Authorize a 1inch resolver for NEAR operations
     * @param resolver The resolver address to authorize
     */
    function authorizeResolver(address resolver) external onlyOwner {
        require(resolver != address(0), "Invalid resolver address");
        require(!authorizedResolvers[resolver], "Resolver already authorized");
        
        authorizedResolvers[resolver] = true;
        emit ResolverAuthorized(resolver);
    }

    /**
     * @notice Revoke a 1inch resolver
     * @param resolver The resolver address to revoke
     */
    function revokeResolver(address resolver) external onlyOwner {
        require(authorizedResolvers[resolver], "Resolver not authorized");
        
        authorizedResolvers[resolver] = false;
        emit ResolverRevoked(resolver);
    }

    /**
     * @notice ITakerInteraction implementation for NEAR cross-chain swaps
     * @dev Called by 1inch Limit Order Protocol after maker fund transfer but before taker fund transfer
     * @param order The 1inch order being filled
     * @param extension The order extension data containing NEAR parameters
     * @param orderHash The hash of the order
     * @param taker The resolver filling the order
     * @param makingAmount The amount being made by the maker
     * @param takingAmount The amount being taken by the taker
     * @param remainingMakingAmount The remaining making amount
     * @param extraData Additional data for the interaction
     */
    function takerInteraction(
        IOrderMixin.Order calldata order,
        bytes calldata extension,
        bytes32 orderHash,
        address taker,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 remainingMakingAmount,
        bytes calldata extraData
    ) external override nonReentrant {
        require(authorizedResolvers[taker], "Unauthorized resolver");
        
        // Decode NEAR-specific order data from extension
        NearOrderData memory nearOrder = abi.decode(extension, (NearOrderData));
        
        // Validate NEAR order parameters
        _validateNearOrder(nearOrder, makingAmount);
        
        // Store NEAR order data
        nearOrders[orderHash] = nearOrder;
        
        // In a real 1inch integration, destination escrow would already be deployed
        // by the main protocol before this is called. For our implementation, 
        // we'll assume the escrow is managed by the factory that called us.
        // We just store the NEAR order data for later use.
        
        emit NearOrderCreated(
            orderHash,
            order.maker.get(),
            nearOrder.destinationChainId,
            nearOrder.destinationToken,
            nearOrder.destinationAmount,
            nearOrder.destinationAddress,
            nearOrder.hashlock
        );
    }

    /**
     * @notice Validate NEAR order parameters
     * @param nearOrder The NEAR order data to validate
     * @param makingAmount The making amount from the 1inch order
     */
    function _validateNearOrder(
        NearOrderData memory nearOrder,
        uint256 makingAmount
    ) internal view {
        // Validate destination chain is NEAR
        require(
            nearOrder.destinationChainId == 40001 || nearOrder.destinationChainId == 40002,
            "Invalid NEAR chain ID"
        );
        
        // Validate chain support in registry
        require(
            registry.isChainSupported(nearOrder.destinationChainId),
            "NEAR chain not supported"
        );
        
        // Validate amounts
        require(nearOrder.destinationAmount > 0, "Invalid destination amount");
        require(nearOrder.expiryTime > block.timestamp, "Order expired");
        require(nearOrder.hashlock != bytes32(0), "Invalid hashlock");
        
        // Validate NEAR-specific parameters
        IDestinationChain.ChainSpecificParams memory chainParams = 
            abi.decode(nearOrder.chainSpecificParams, (IDestinationChain.ChainSpecificParams));
            
        IDestinationChain.ValidationResult memory validation = registry.validateOrderParams(
            nearOrder.destinationChainId,
            chainParams,
            nearOrder.destinationAmount
        );
        require(validation.isValid, validation.errorMessage);
    }



    /**
     * @notice Get NEAR order data
     * @param orderHash The order hash
     * @return NearOrderData The NEAR order information
     */
    function getNearOrder(bytes32 orderHash) external view returns (NearOrderData memory) {
        return nearOrders[orderHash];
    }


    /**
     * @notice Check if a resolver is authorized
     * @param resolver The resolver address to check
     * @return bool True if authorized
     */
    function isAuthorizedResolver(address resolver) external view returns (bool) {
        return authorizedResolvers[resolver];
    }

    /**
     * @notice Get supported NEAR chain IDs
     * @return uint256[] Array of NEAR chain IDs
     */
    function getSupportedNearChains() external pure returns (uint256[] memory) {
        uint256[] memory chains = new uint256[](2);
        chains[0] = 40001; // NEAR mainnet
        chains[1] = 40002; // NEAR testnet
        return chains;
    }

    /**
     * @notice Estimate costs for NEAR cross-chain order
     * @param chainId NEAR chain ID
     * @param params Chain-specific parameters
     * @param amount Amount being transferred
     * @return estimatedCost Estimated execution cost
     * @return safetyDeposit Required safety deposit
     */
    function estimateNearOrderCosts(
        uint256 chainId,
        IDestinationChain.ChainSpecificParams calldata params,
        uint256 amount
    ) external view returns (uint256 estimatedCost, uint256 safetyDeposit) {
        require(chainId == 40001 || chainId == 40002, "Invalid NEAR chain ID");
        require(registry.isChainSupported(chainId), "NEAR chain not supported");
        
        estimatedCost = registry.estimateExecutionCost(chainId, params, amount);
        safetyDeposit = registry.calculateMinSafetyDeposit(chainId, amount);
    }
}