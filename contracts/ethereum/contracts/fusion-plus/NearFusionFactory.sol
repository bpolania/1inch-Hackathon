// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@1inch/limit-order-protocol-contract/contracts/interfaces/IOrderMixin.sol";
import "@1inch/limit-order-protocol-contract/contracts/LimitOrderProtocol.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import "@1inch/limit-order-protocol-contract/contracts/libraries/MakerTraitsLib.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./NearFusionResolver.sol";
import "./NearEscrowSrc.sol";

/**
 * @title NearFusionFactory
 * @notice Factory for creating NEAR cross-chain orders using actual 1inch Fusion+
 * @dev Integrates with real 1inch LimitOrderProtocol instead of building parallel system
 * 
 * True Extension Architecture:
 * 1. Uses actual 1inch Order struct and protocol
 * 2. Embeds NEAR parameters in 160-bit extension hash
 * 3. Creates orders through 1inch LimitOrderProtocol
 * 4. Integrates with authorized 1inch resolvers
 */
contract NearFusionFactory is Ownable {
    using AddressLib for Address;
    
    // Reference to actual 1inch Limit Order Protocol
    LimitOrderProtocol public immutable limitOrderProtocol;
    
    // NEAR-specific components
    NearFusionResolver public immutable nearResolver;
    NearEscrowSrc public immutable nearEscrowSrc;
    
    // Minimum safety deposit (5% = 500 basis points, aligned with 1inch)
    uint256 public constant MIN_SAFETY_DEPOSIT_BPS = 500;
    
    struct NearOrderParams {
        address makerAsset;           // Source token on Ethereum
        uint256 makingAmount;         // Amount to swap from Ethereum
        address takerAsset;           // Destination token representation
        uint256 takingAmount;         // Amount to receive on NEAR
        string nearAccountId;         // Recipient on NEAR
        string nearChainId;           // "mainnet" or "testnet"
        string nearTokenContract;     // Token contract on NEAR
        uint256 lockupPeriod;         // Cross-chain timing
        uint256 expiry;               // Order expiry timestamp
    }
    
    // Events
    event NearFusionOrderCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        string nearAccountId,
        uint256 makingAmount,
        uint256 takingAmount
    );
    
    event NearFusionOrderMatched(
        bytes32 indexed orderHash,
        address indexed taker,
        address escrowAddress
    );

    constructor(
        address payable _limitOrderProtocol,
        address _nearResolver,
        address _nearEscrowSrc
    ) Ownable(msg.sender) {
        limitOrderProtocol = LimitOrderProtocol(_limitOrderProtocol);
        nearResolver = NearFusionResolver(_nearResolver);
        nearEscrowSrc = NearEscrowSrc(_nearEscrowSrc);
    }

    /**
     * @notice Create a NEAR cross-chain order using actual 1inch protocol
     * @param params NEAR order parameters
     * @return orderHash Hash of the created 1inch order
     */
    function createNearFusionOrder(NearOrderParams calldata params) 
        external 
        returns (bytes32 orderHash) 
    {
        require(params.makingAmount > 0, "NearFusionFactory: invalid making amount");
        require(params.takingAmount > 0, "NearFusionFactory: invalid taking amount");
        require(params.expiry > block.timestamp, "NearFusionFactory: order expired");
        require(bytes(params.nearAccountId).length > 0, "NearFusionFactory: invalid NEAR account");

        // Create NEAR extension data
        NearFusionResolver.NearExtension memory nearExt = NearFusionResolver.NearExtension({
            nearAccountId: params.nearAccountId,
            nearChainId: params.nearChainId,
            nearTokenContract: params.nearTokenContract,
            lockupPeriod: params.lockupPeriod,
            bridgeParams: bytes32(0), // Simplified for demo
            estimatedGas: 300_000_000_000_000, // 300 TGas default for NEAR
            attachedDeposit: 0 // No attached deposit by default
        });

        // Generate 160-bit extension hash for NEAR parameters
        bytes20 extensionHash = nearResolver.createNearExtensionHash(nearExt);
        
        // Create 1inch order with extension hash in salt (96-bit order salt + 160-bit extension)
        uint256 orderSalt = (uint256(uint96(block.timestamp)) << 160) | uint256(uint160(extensionHash));

        // Build actual 1inch Order struct
        IOrderMixin.Order memory order = IOrderMixin.Order({
            salt: orderSalt,
            maker: Address.wrap(uint256(uint160(msg.sender))),
            receiver: Address.wrap(uint256(uint160(msg.sender))), // Can be different if needed
            makerAsset: Address.wrap(uint256(uint160(params.makerAsset))),
            takerAsset: Address.wrap(uint256(uint160(params.takerAsset))),
            makingAmount: params.makingAmount,
            takingAmount: params.takingAmount,
            makerTraits: MakerTraits.wrap(0) // Simplified traits
        });

        // Calculate order hash using 1inch protocol
        orderHash = limitOrderProtocol.hashOrder(order);

        emit NearFusionOrderCreated(
            orderHash,
            msg.sender,
            params.nearAccountId,
            params.makingAmount,
            params.takingAmount
        );

        return orderHash;
    }

    /**
     * @notice Match a NEAR fusion order (called by authorized resolver)
     * @param order The 1inch order to match
     * @param nearExt NEAR extension parameters
     * @param safetyDepositAmount Safety deposit from resolver
     * @return escrowAddress Address of created escrow
     */
    function matchNearFusionOrder(
        IOrderMixin.Order calldata order,
        NearFusionResolver.NearExtension calldata nearExt,
        uint256 safetyDepositAmount
    ) external returns (address escrowAddress) {
        // Verify caller is authorized resolver
        require(nearResolver.authorizedResolvers(msg.sender), "NearFusionFactory: unauthorized resolver");
        
        // Verify minimum safety deposit (5% of making amount)
        uint256 minSafetyDeposit = (order.makingAmount * MIN_SAFETY_DEPOSIT_BPS) / 10000;
        require(safetyDepositAmount >= minSafetyDeposit, "NearFusionFactory: insufficient safety deposit");

        // Lock tokens in escrow
        nearEscrowSrc.lockTokens(order, nearExt, safetyDepositAmount);
        
        bytes32 orderHash = limitOrderProtocol.hashOrder(order);
        
        emit NearFusionOrderMatched(
            orderHash,
            msg.sender,
            address(nearEscrowSrc)
        );

        return address(nearEscrowSrc);
    }

    /**
     * @notice Calculate minimum safety deposit for an order
     * @param makingAmount The making amount of the order
     * @return minDeposit Minimum required safety deposit
     */
    function calculateMinSafetyDeposit(uint256 makingAmount) external pure returns (uint256 minDeposit) {
        return (makingAmount * MIN_SAFETY_DEPOSIT_BPS) / 10000;
    }

    /**
     * @notice Validate NEAR order parameters
     * @param params NEAR order parameters
     * @return isValid Whether parameters are valid
     * @return errorMessage Error message if invalid
     */
    function validateNearOrderParams(NearOrderParams calldata params) 
        external 
        view 
        returns (bool isValid, string memory errorMessage) 
    {
        if (params.makingAmount == 0) {
            return (false, "Invalid making amount");
        }
        if (params.takingAmount == 0) {
            return (false, "Invalid taking amount");
        }
        if (params.expiry <= block.timestamp) {
            return (false, "Order expired");
        }
        if (bytes(params.nearAccountId).length == 0) {
            return (false, "Invalid NEAR account");
        }
        
        // Validate NEAR chain ID
        bytes32 chainHash = keccak256(bytes(params.nearChainId));
        if (chainHash != keccak256("mainnet") && chainHash != keccak256("testnet")) {
            return (false, "Invalid NEAR chain");
        }
        
        return (true, "");
    }

    /**
     * @notice Get the 1inch Limit Order Protocol address
     * @return protocol Address of the 1inch protocol
     */
    function getLimitOrderProtocol() external view returns (address protocol) {
        return address(limitOrderProtocol);
    }

    /**
     * @notice Get NEAR resolver address
     * @return resolver Address of the NEAR resolver
     */
    function getNearResolver() external view returns (address resolver) {
        return address(nearResolver);
    }

    /**
     * @notice Get NEAR escrow source address
     * @return escrow Address of the NEAR escrow source
     */
    function getNearEscrowSrc() external view returns (address escrow) {
        return address(nearEscrowSrc);
    }
}