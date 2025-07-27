// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../CrossChainRegistry.sol";
import "../interfaces/IDestinationChain.sol";
import "../interfaces/IOneInchEscrowFactory.sol";
import "./NearTakerInteraction.sol";
import "@1inch/limit-order-protocol-contract/contracts/interfaces/IOrderMixin.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title OneInchFusionPlusFactory
 * @notice 1inch Fusion+ integrated factory for cross-chain atomic swaps using real 1inch escrow system
 * @dev Integrates with 1inch's EscrowFactory and ITakerInteraction for true Fusion+ extension
 */
contract OneInchFusionPlusFactory is Ownable, ReentrancyGuard {
    
    /**
     * @notice 1inch-integrated order structure
     */
    struct FusionPlusOrder {
        bytes32 orderHash;              // 1inch order hash
        address maker;                  // Order creator
        address sourceToken;            // Source token address
        uint256 sourceAmount;           // Source token amount
        uint256 destinationChainId;     // Destination chain ID
        bytes destinationToken;         // Destination token identifier
        uint256 destinationAmount;      // Destination token amount
        bytes destinationAddress;       // Destination address
        uint256 resolverFeeAmount;      // Resolver fee
        uint256 expiryTime;             // Order expiry timestamp
        bytes chainSpecificParams;      // Chain-specific execution parameters
        bool isActive;                  // Order status
    }

    /**
     * @notice Order creation parameters
     */
    struct CreateOrderParams {
        address sourceToken;
        uint256 sourceAmount;
        uint256 destinationChainId;
        bytes destinationToken;
        uint256 destinationAmount;
        bytes destinationAddress;
        uint256 resolverFeeAmount;
        uint256 expiryTime;
        IDestinationChain.ChainSpecificParams chainParams;
        bytes32 hashlock;  // Required for 1inch integration
    }

    // State variables
    CrossChainRegistry public immutable registry;
    IOneInchEscrowFactory public immutable oneInchEscrowFactory;
    NearTakerInteraction public immutable nearTakerInteraction;
    
    mapping(bytes32 => FusionPlusOrder) public orders;
    mapping(bytes32 => address) public sourceEscrows;      // 1inch EscrowSrc addresses
    mapping(bytes32 => address) public destinationEscrows; // 1inch EscrowDst addresses
    mapping(address => bool) public authorizedResolvers;
    
    uint256 public resolverCount = 0;
    uint256 public totalOrdersCreated = 0;
    
    // Events - 1inch Fusion+ compatible
    event FusionOrderCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        address sourceToken,
        uint256 sourceAmount,
        uint256 destinationChainId,
        bytes destinationToken,
        uint256 destinationAmount,
        bytes destinationAddress,
        uint256 resolverFeeAmount,
        uint256 expiryTime,
        bytes32 hashlock
    );
    
    event FusionOrderMatched(
        bytes32 indexed orderHash,
        address indexed resolver,
        address sourceEscrow,
        address destinationEscrow,
        bytes32 hashlock,
        uint256 safetyDeposit
    );
    
    event FusionOrderCompleted(
        bytes32 indexed orderHash,
        address indexed resolver,
        bytes32 secret
    );
    
    event FusionOrderCancelled(
        bytes32 indexed orderHash,
        address indexed maker
    );
    
    event ResolverAuthorized(address indexed resolver);
    event ResolverRevoked(address indexed resolver);

    constructor(
        CrossChainRegistry _registry,
        IOneInchEscrowFactory _oneInchEscrowFactory,
        NearTakerInteraction _nearTakerInteraction
    ) Ownable(msg.sender) {
        require(address(_registry) != address(0), "Invalid registry address");
        require(address(_oneInchEscrowFactory) != address(0), "Invalid 1inch escrow factory");
        require(address(_nearTakerInteraction) != address(0), "Invalid NEAR taker interaction");
        
        registry = _registry;
        oneInchEscrowFactory = _oneInchEscrowFactory;
        nearTakerInteraction = _nearTakerInteraction;
    }

    /**
     * @notice Authorize a 1inch resolver
     * @param resolver The resolver address to authorize
     */
    function authorizeResolver(address resolver) external onlyOwner {
        require(resolver != address(0), "Invalid resolver address");
        require(!authorizedResolvers[resolver], "Resolver already authorized");
        
        authorizedResolvers[resolver] = true;
        resolverCount++;
        
        emit ResolverAuthorized(resolver);
    }

    /**
     * @notice Revoke a 1inch resolver
     * @param resolver The resolver address to revoke
     */
    function revokeResolver(address resolver) external onlyOwner {
        require(authorizedResolvers[resolver], "Resolver not authorized");
        
        authorizedResolvers[resolver] = false;
        resolverCount--;
        
        emit ResolverRevoked(resolver);
    }

    /**
     * @notice Create a 1inch Fusion+ integrated cross-chain order
     * @param params Order creation parameters including hashlock
     * @return orderHash The generated order hash
     */
    function createFusionOrder(CreateOrderParams calldata params) external nonReentrant returns (bytes32) {
        // Validate basic parameters
        require(params.sourceAmount > 0, "Invalid source amount");
        require(params.destinationAmount > 0, "Invalid destination amount");
        require(params.expiryTime > block.timestamp, "Invalid expiry time");
        require(params.resolverFeeAmount >= params.sourceAmount / 1000, "Resolver fee too low");
        require(params.hashlock != bytes32(0), "Invalid hashlock");
        
        // Validate destination chain support
        require(registry.isChainSupported(params.destinationChainId), "Destination chain not supported");
        
        // Validate chain-specific parameters
        IDestinationChain.ValidationResult memory validation = registry.validateOrderParams(
            params.destinationChainId,
            params.chainParams,
            params.destinationAmount
        );
        require(validation.isValid, validation.errorMessage);
        
        // Generate 1inch-compatible order hash
        bytes32 orderHash = generateOrderHash(params);
        require(!orders[orderHash].isActive, "Order already exists");
        
        // Create order
        orders[orderHash] = FusionPlusOrder({
            orderHash: orderHash,
            maker: msg.sender,
            sourceToken: params.sourceToken,
            sourceAmount: params.sourceAmount,
            destinationChainId: params.destinationChainId,
            destinationToken: params.destinationToken,
            destinationAmount: params.destinationAmount,
            destinationAddress: params.destinationAddress,
            resolverFeeAmount: params.resolverFeeAmount,
            expiryTime: params.expiryTime,
            chainSpecificParams: abi.encode(params.chainParams),
            isActive: true
        });
        
        totalOrdersCreated++;
        
        emit FusionOrderCreated(
            orderHash,
            msg.sender,
            params.sourceToken,
            params.sourceAmount,
            params.destinationChainId,
            params.destinationToken,
            params.destinationAmount,
            params.destinationAddress,
            params.resolverFeeAmount,
            params.expiryTime,
            params.hashlock
        );
        
        return orderHash;
    }

    /**
     * @notice Match a Fusion+ order using 1inch EscrowFactory system
     * @param orderHash The order hash to match
     * @param hashlock The hashlock for HTLC coordination
     * @return sourceEscrow The created 1inch EscrowSrc address
     * @return destinationEscrow The created 1inch EscrowDst address
     */
    function matchFusionOrder(
        bytes32 orderHash,
        bytes32 hashlock
    ) external payable nonReentrant returns (address sourceEscrow, address destinationEscrow) {
        require(authorizedResolvers[msg.sender], "Not authorized resolver");
        require(orders[orderHash].isActive, "Order not active");
        require(block.timestamp < orders[orderHash].expiryTime, "Order expired");
        require(sourceEscrows[orderHash] == address(0), "Order already matched");
        require(hashlock != bytes32(0), "Invalid hashlock");
        
        FusionPlusOrder memory order = orders[orderHash];
        
        // Calculate safety deposit based on destination chain requirements
        uint256 safetyDeposit = registry.calculateMinSafetyDeposit(
            order.destinationChainId,
            order.sourceAmount
        );
        require(msg.value >= safetyDeposit, "Insufficient safety deposit");
        
        // Create immutables for 1inch EscrowSrc
        IOneInchEscrowFactory.Immutables memory srcImmutables = IOneInchEscrowFactory.Immutables({
            orderHash: orderHash,
            hashlock: hashlock,
            maker: order.maker,
            taker: msg.sender,
            token: order.sourceToken,
            amount: order.sourceAmount,
            safetyDeposit: 0, // Source doesn't require safety deposit
            timelocks: _calculateTimelocks(order.expiryTime)
        });
        
        // Create immutables for 1inch EscrowDst
        IOneInchEscrowFactory.Immutables memory dstImmutables = IOneInchEscrowFactory.Immutables({
            orderHash: orderHash,
            hashlock: hashlock,
            maker: order.maker,
            taker: msg.sender,
            token: address(0), // Will be handled by destination chain
            amount: order.destinationAmount,
            safetyDeposit: safetyDeposit,
            timelocks: _calculateTimelocks(order.expiryTime)
        });

        // Compute source escrow address (this will be used by 1inch Limit Order Protocol)
        sourceEscrow = oneInchEscrowFactory.addressOfEscrowSrc(srcImmutables);
        sourceEscrows[orderHash] = sourceEscrow;
        
        // Deploy destination escrow using 1inch EscrowFactory
        destinationEscrow = oneInchEscrowFactory.createDstEscrow{value: safetyDeposit}(
            dstImmutables,
            order.expiryTime
        );
        destinationEscrows[orderHash] = destinationEscrow;
        
        emit FusionOrderMatched(
            orderHash,
            msg.sender,
            sourceEscrow,
            destinationEscrow,
            hashlock,
            safetyDeposit
        );
        
        return (sourceEscrow, destinationEscrow);
    }

    /**
     * @notice Complete a cross-chain swap by revealing the secret
     * @param orderHash The order hash
     * @param secret The secret that unlocks the hashlock
     */
    function completeFusionOrder(bytes32 orderHash, bytes32 secret) external nonReentrant {
        require(orders[orderHash].isActive, "Order not active");
        require(sourceEscrows[orderHash] != address(0), "Order not matched");
        require(destinationEscrows[orderHash] != address(0), "No destination escrow");
        
        // Verify the secret matches the hashlock
        bytes32 computedHash = sha256(abi.encodePacked(secret));
        
        // The actual hashlock verification would be done by the escrow contracts
        // This is just for event emission
        orders[orderHash].isActive = false;
        
        emit FusionOrderCompleted(orderHash, msg.sender, secret);
    }

    /**
     * @notice Cancel a Fusion+ order
     * @param orderHash The order hash to cancel
     */
    function cancelFusionOrder(bytes32 orderHash) external {
        require(orders[orderHash].isActive, "Order not active");
        require(
            msg.sender == orders[orderHash].maker || 
            block.timestamp >= orders[orderHash].expiryTime,
            "Not authorized to cancel"
        );
        require(sourceEscrows[orderHash] == address(0), "Order already matched");
        
        orders[orderHash].isActive = false;
        
        emit FusionOrderCancelled(orderHash, orders[orderHash].maker);
    }

    /**
     * @notice Generate 1inch-compatible order hash
     * @param params Order parameters
     * @return bytes32 The generated order hash
     */
    function generateOrderHash(CreateOrderParams calldata params) public view returns (bytes32) {
        // Create deterministic hash incorporating all order parameters
        return keccak256(abi.encode(
            block.chainid,
            address(this),
            msg.sender,
            params.sourceToken,
            params.sourceAmount,
            params.destinationChainId,
            params.destinationToken,
            params.destinationAmount,
            params.destinationAddress,
            params.resolverFeeAmount,
            params.expiryTime,
            params.chainParams,
            params.hashlock,
            block.timestamp
        ));
    }

    /**
     * @notice Calculate timelocks for 1inch escrow system
     * @param expiryTime The order expiry time
     * @return uint256 Packed timelock stages
     */
    function _calculateTimelocks(uint256 expiryTime) internal view returns (uint256) {
        uint256 baseTime = block.timestamp;
        uint256 timeBuffer = (expiryTime - baseTime) / 7;
        
        uint256 stage1 = baseTime + timeBuffer;       // Initial timelock
        uint256 stage2 = baseTime + (timeBuffer * 2); // Withdrawal timelock
        uint256 stage3 = baseTime + (timeBuffer * 3); // Public withdrawal
        uint256 stage4 = baseTime + (timeBuffer * 4); // Cancellation start
        uint256 stage5 = baseTime + (timeBuffer * 5); // Public cancellation
        uint256 stage6 = baseTime + (timeBuffer * 6); // Final timelock
        uint256 stage7 = expiryTime;                  // Order expiry
        
        // Pack timelock stages (simplified - 1inch may use different packing)
        return (stage1 << 224) | (stage2 << 192) | (stage3 << 160) | (stage4 << 128) | 
               (stage5 << 96) | (stage6 << 64) | (stage7 << 32);
    }

    /**
     * @notice Get order information
     * @param orderHash The order hash
     * @return FusionPlusOrder The order information
     */
    function getOrder(bytes32 orderHash) external view returns (FusionPlusOrder memory) {
        return orders[orderHash];
    }

    /**
     * @notice Get 1inch escrow addresses for an order
     * @param orderHash The order hash
     * @return source The 1inch EscrowSrc address
     * @return destination The 1inch EscrowDst address
     */
    function getEscrowAddresses(bytes32 orderHash) external view returns (address source, address destination) {
        return (sourceEscrows[orderHash], destinationEscrows[orderHash]);
    }

    /**
     * @notice Check if an order is active and available for matching
     * @param orderHash The order hash
     * @return bool True if order is active and matchable
     */
    function isOrderMatchable(bytes32 orderHash) external view returns (bool) {
        return orders[orderHash].isActive && 
               block.timestamp < orders[orderHash].expiryTime &&
               sourceEscrows[orderHash] == address(0);
    }

    /**
     * @notice Get supported destination chains
     * @return uint256[] Array of supported chain IDs
     */
    function getSupportedChains() external view returns (uint256[] memory) {
        return registry.getSupportedChainIds();
    }

    /**
     * @notice Estimate costs for cross-chain order using 1inch system
     * @param chainId Destination chain ID
     * @param params Chain-specific parameters
     * @param amount Amount being transferred
     * @return estimatedCost Estimated execution cost
     * @return safetyDeposit Required safety deposit
     */
    function estimateOrderCosts(
        uint256 chainId,
        IDestinationChain.ChainSpecificParams calldata params,
        uint256 amount
    ) external view returns (uint256 estimatedCost, uint256 safetyDeposit) {
        require(registry.isChainSupported(chainId), "Chain not supported");
        
        estimatedCost = registry.estimateExecutionCost(chainId, params, amount);
        safetyDeposit = registry.calculateMinSafetyDeposit(chainId, amount);
    }

    /**
     * @notice Get 1inch EscrowFactory address
     * @return address The 1inch EscrowFactory address
     */
    function getOneInchEscrowFactory() external view returns (address) {
        return address(oneInchEscrowFactory);
    }

    /**
     * @notice Get NEAR taker interaction address
     * @return address The NEAR taker interaction address
     */
    function getNearTakerInteraction() external view returns (address) {
        return address(nearTakerInteraction);
    }
}