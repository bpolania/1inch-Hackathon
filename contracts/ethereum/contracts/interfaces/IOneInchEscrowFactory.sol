// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOneInchEscrowFactory
 * @notice Interface for 1inch EscrowFactory contract used in cross-chain swaps
 * @dev Based on 1inch cross-chain swap protocol documentation and resolver examples
 */
interface IOneInchEscrowFactory {
    
    /**
     * @notice Immutable parameters for escrow contracts
     * @dev Structure used by both EscrowSrc and EscrowDst contracts
     */
    struct Immutables {
        bytes32 orderHash;          // 1inch order hash
        bytes32 hashlock;           // SHA-256 hashlock for atomic coordination
        address maker;              // Order maker
        address taker;              // Order taker (resolver)
        address token;              // Token address (source chain)
        uint256 amount;             // Token amount
        uint256 safetyDeposit;      // Safety deposit in native tokens
        uint256 timelocks;          // Packed timelock stages
    }

    /**
     * @notice Compute the address of the EscrowSrc clone that will be deployed
     * @dev Used to send safety deposit in native tokens before order is filled
     * @param immutables The immutable parameters for the escrow
     * @return address The computed EscrowSrc address
     */
    function addressOfEscrowSrc(Immutables calldata immutables) external view returns (address);

    /**
     * @notice Deploy an EscrowDst clone on the destination chain
     * @dev Called by resolvers to create destination escrow contracts
     * @param dstImmutables The immutable parameters for destination escrow
     * @param srcCancellationTimestamp The source cancellation timestamp
     * @return address The deployed EscrowDst address
     */
    function createDstEscrow(
        Immutables calldata dstImmutables,
        uint256 srcCancellationTimestamp
    ) external payable returns (address);

    /**
     * @notice Deploy an EscrowSrc clone on the source chain
     * @dev Called during order filling via Limit Order Protocol
     * @param srcImmutables The immutable parameters for source escrow
     * @return address The deployed EscrowSrc address
     */
    function createSrcEscrow(Immutables calldata srcImmutables) external payable returns (address);

    /**
     * @notice Get the implementation address for EscrowSrc contracts
     * @return address The EscrowSrc implementation address
     */
    function escrowSrcImplementation() external view returns (address);

    /**
     * @notice Get the implementation address for EscrowDst contracts
     * @return address The EscrowDst implementation address
     */
    function escrowDstImplementation() external view returns (address);

    // Events
    event EscrowSrcCreated(
        bytes32 indexed orderHash,
        address indexed escrow,
        address indexed maker,
        address taker,
        bytes32 hashlock
    );

    event EscrowDstCreated(
        bytes32 indexed orderHash,
        address indexed escrow,
        address indexed maker,
        address taker,
        bytes32 hashlock
    );
}