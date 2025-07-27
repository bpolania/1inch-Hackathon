// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@1inch/limit-order-protocol-contract/contracts/interfaces/IOrderMixin.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./NearFusionResolver.sol";

/**
 * @title NearEscrowSrc
 * @notice Source chain escrow for NEAR cross-chain atomic swaps
 * @dev Integrates with 1inch Fusion+ for true protocol extension
 * 
 * Architecture:
 * 1. Locks Ethereum tokens when 1inch order is matched
 * 2. Releases tokens when NEAR-side execution is proven
 * 3. Enables refunds if NEAR execution fails within timelock
 * 4. Follows 1inch EscrowSrc pattern for compatibility
 */
contract NearEscrowSrc is Ownable {
    using AddressLib for Address;

    struct EscrowData {
        bytes32 orderHash;         // 1inch order hash
        address maker;             // Order creator
        address taker;             // Order resolver
        address token;             // Token being escrowed
        uint256 amount;            // Amount escrowed
        uint256 safetyDeposit;     // Taker's safety deposit
        uint256 unlockTime;        // When refund becomes available
        bytes32 nearTxProof;       // NEAR transaction proof
        bool isReleased;           // Whether tokens were released
        bool isRefunded;           // Whether tokens were refunded
    }

    // Reference to the NEAR resolver
    NearFusionResolver public immutable nearResolver;
    
    // Escrow storage
    mapping(bytes32 => EscrowData) public escrows;
    
    // Events
    event TokensLocked(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        address token,
        uint256 amount,
        uint256 safetyDeposit,
        uint256 unlockTime
    );
    
    event TokensReleased(
        bytes32 indexed orderHash,
        address indexed taker,
        bytes32 nearTxProof
    );
    
    event TokensRefunded(
        bytes32 indexed orderHash,
        address indexed maker
    );

    constructor(address _nearResolver) Ownable(msg.sender) {
        nearResolver = NearFusionResolver(_nearResolver);
    }

    /**
     * @notice Lock tokens for cross-chain execution
     * @param order The 1inch order
     * @param nearExt NEAR extension parameters
     * @param safetyDepositAmount Safety deposit from taker
     */
    function lockTokens(
        IOrderMixin.Order calldata order,
        NearFusionResolver.NearExtension calldata nearExt,
        uint256 safetyDepositAmount
    ) external {
        bytes32 orderHash = keccak256(abi.encode(order));
        
        require(escrows[orderHash].orderHash == bytes32(0), "NearEscrowSrc: escrow already exists");
        require(nearExt.lockupPeriod > 0, "NearEscrowSrc: invalid lockup period");

        // Calculate unlock time (when refund becomes available)
        uint256 unlockTime = block.timestamp + nearExt.lockupPeriod;

        // Create escrow entry
        escrows[orderHash] = EscrowData({
            orderHash: orderHash,
            maker: order.maker.get(),
            taker: msg.sender,
            token: order.makerAsset.get(),
            amount: order.makingAmount,
            safetyDeposit: safetyDepositAmount,
            unlockTime: unlockTime,
            nearTxProof: bytes32(0),
            isReleased: false,
            isRefunded: false
        });

        // Transfer tokens to escrow
        require(
            IERC20(order.makerAsset.get()).transferFrom(
                order.maker.get(),
                address(this),
                order.makingAmount
            ),
            "NearEscrowSrc: maker token transfer failed"
        );

        // Transfer safety deposit from taker
        if (safetyDepositAmount > 0) {
            require(
                IERC20(order.makerAsset.get()).transferFrom(
                    msg.sender,
                    address(this),
                    safetyDepositAmount
                ),
                "NearEscrowSrc: taker deposit transfer failed"
            );
        }

        emit TokensLocked(
            orderHash,
            order.maker.get(),
            msg.sender,
            order.makerAsset.get(),
            order.makingAmount,
            safetyDepositAmount,
            unlockTime
        );
    }

    /**
     * @notice Release tokens with NEAR transaction proof
     * @param orderHash Hash of the order
     * @param nearTxProof Proof of NEAR transaction execution
     */
    function releaseWithProof(bytes32 orderHash, bytes32 nearTxProof) external {
        EscrowData storage escrow = escrows[orderHash];
        
        require(escrow.orderHash != bytes32(0), "NearEscrowSrc: escrow not found");
        require(!escrow.isReleased, "NearEscrowSrc: already released");
        require(!escrow.isRefunded, "NearEscrowSrc: already refunded");
        require(msg.sender == escrow.taker, "NearEscrowSrc: only taker can release");

        // Verify NEAR execution (simplified - production would verify Rainbow Bridge proof)
        bytes32 expectedNearTx = nearResolver.getNearTxHash(orderHash);
        require(nearTxProof == expectedNearTx, "NearEscrowSrc: invalid NEAR proof");

        // Mark as released
        escrow.isReleased = true;
        escrow.nearTxProof = nearTxProof;

        // Release tokens to taker (they completed the cross-chain execution)
        uint256 totalAmount = escrow.amount + escrow.safetyDeposit;
        require(
            IERC20(escrow.token).transfer(escrow.taker, totalAmount),
            "NearEscrowSrc: taker release transfer failed"
        );

        emit TokensReleased(orderHash, escrow.taker, nearTxProof);
    }

    /**
     * @notice Refund tokens if NEAR execution failed within timelock
     * @param orderHash Hash of the order
     */
    function refund(bytes32 orderHash) external {
        EscrowData storage escrow = escrows[orderHash];
        
        require(escrow.orderHash != bytes32(0), "NearEscrowSrc: escrow not found");
        require(!escrow.isReleased, "NearEscrowSrc: already released");
        require(!escrow.isRefunded, "NearEscrowSrc: already refunded");
        require(block.timestamp >= escrow.unlockTime, "NearEscrowSrc: timelock not expired");

        // Mark as refunded
        escrow.isRefunded = true;

        // Refund original amount to maker
        require(
            IERC20(escrow.token).transfer(escrow.maker, escrow.amount),
            "NearEscrowSrc: maker refund transfer failed"
        );

        // Refund safety deposit to taker (they may have tried but failed)
        if (escrow.safetyDeposit > 0) {
            require(
                IERC20(escrow.token).transfer(escrow.taker, escrow.safetyDeposit),
                "NearEscrowSrc: taker refund transfer failed"
            );
        }

        emit TokensRefunded(orderHash, escrow.maker);
    }

    /**
     * @notice Check if tokens can be refunded
     * @param orderHash Hash of the order
     * @return canRefund Whether refund is available
     */
    function canRefund(bytes32 orderHash) external view returns (bool) {
        EscrowData storage escrow = escrows[orderHash];
        return escrow.orderHash != bytes32(0) && 
               !escrow.isReleased && 
               !escrow.isRefunded && 
               block.timestamp >= escrow.unlockTime;
    }

    /**
     * @notice Get escrow information
     * @param orderHash Hash of the order
     * @return escrow Escrow data
     */
    function getEscrow(bytes32 orderHash) external view returns (EscrowData memory escrow) {
        return escrows[orderHash];
    }
}