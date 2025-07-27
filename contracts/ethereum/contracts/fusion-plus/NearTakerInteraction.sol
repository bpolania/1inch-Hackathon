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
    mapping(bytes32 => address) public orderEscrows;
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
    
    event NearEscrowDeployed(
        bytes32 indexed orderHash,
        address indexed escrowAddress,
        uint256 destinationChainId
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
        
        // Deploy destination escrow on Ethereum (will coordinate with NEAR)
        // Note: In real 1inch integration, safety deposit would be handled by the main protocol
        address escrowAddress = _deployDestinationEscrow(
            orderHash,
            nearOrder,
            taker,
            takingAmount
        );
        
        orderEscrows[orderHash] = escrowAddress;
        
        emit NearOrderCreated(
            orderHash,
            order.maker.get(),
            nearOrder.destinationChainId,
            nearOrder.destinationToken,
            nearOrder.destinationAmount,
            nearOrder.destinationAddress,
            nearOrder.hashlock
        );
        
        emit NearEscrowDeployed(
            orderHash,
            escrowAddress,
            nearOrder.destinationChainId
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
     * @notice Deploy destination escrow using 1inch EscrowFactory
     * @param orderHash The order hash
     * @param nearOrder The NEAR order data
     * @param resolver The resolver address
     * @param takingAmount The taking amount
     * @return escrowAddress The deployed escrow address
     */
    function _deployDestinationEscrow(
        bytes32 orderHash,
        NearOrderData memory nearOrder,
        address resolver,
        uint256 takingAmount
    ) internal returns (address escrowAddress) {
        // Calculate safety deposit for escrow structure (but don't require payment in this context)
        uint256 safetyDeposit = registry.calculateMinSafetyDeposit(
            nearOrder.destinationChainId,
            takingAmount
        );
        
        // Create immutables structure for 1inch EscrowFactory
        IOneInchEscrowFactory.Immutables memory immutables = IOneInchEscrowFactory.Immutables({
            orderHash: orderHash,
            hashlock: nearOrder.hashlock,
            maker: address(this), // This contract acts as maker for destination escrow
            taker: resolver,      // Resolver is the taker
            token: address(0),    // Token will be handled by NEAR contract
            amount: takingAmount,
            safetyDeposit: safetyDeposit,
            timelocks: _calculateNearTimelocks(nearOrder.expiryTime)
        });
        
        // Deploy destination escrow using 1inch EscrowFactory
        // Note: In real 1inch integration, safety deposit is handled separately
        escrowAddress = escrowFactory.createDstEscrow(
            immutables,
            nearOrder.expiryTime
        );
        
        return escrowAddress;
    }

    /**
     * @notice Calculate NEAR-specific timelocks
     * @param expiryTime The order expiry time
     * @return uint256 Packed timelock stages
     */
    function _calculateNearTimelocks(uint256 expiryTime) internal view returns (uint256) {
        uint256 baseTime = block.timestamp;
        uint256 timeBuffer = (expiryTime - baseTime) / 7; // Divide remaining time into 7 stages
        
        uint256 stage1 = baseTime + timeBuffer;       // NEAR preparation
        uint256 stage2 = baseTime + (timeBuffer * 2); // NEAR deployment
        uint256 stage3 = baseTime + (timeBuffer * 3); // NEAR execution
        uint256 stage4 = baseTime + (timeBuffer * 4); // NEAR confirmation
        uint256 stage5 = baseTime + (timeBuffer * 5); // Ethereum withdrawal
        uint256 stage6 = baseTime + (timeBuffer * 6); // Ethereum finalization
        uint256 stage7 = expiryTime;                  // Final expiry
        
        // Pack timelock stages (simplified - real 1inch packing may differ)
        return (stage1 << 224) | (stage2 << 192) | (stage3 << 160) | (stage4 << 128) | 
               (stage5 << 96) | (stage6 << 64) | (stage7 << 32);
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
     * @notice Get escrow address for an order
     * @param orderHash The order hash
     * @return address The escrow address
     */
    function getOrderEscrow(bytes32 orderHash) external view returns (address) {
        return orderEscrows[orderHash];
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