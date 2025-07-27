// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOneInchEscrow
 * @notice Interface for 1inch Escrow contracts (EscrowSrc and EscrowDst)
 * @dev Based on 1inch cross-chain swap protocol
 */
interface IOneInchEscrow {
    
    /**
     * @notice Withdraw tokens from escrow
     * @dev Withdraw tokens to the intended recipient
     * @param secret The secret that unlocks the hashlock
     */
    function withdraw(bytes32 secret) external;

    /**
     * @notice Withdraw tokens to a specific address
     * @dev Withdraw tokens to the specified address
     * @param secret The secret that unlocks the hashlock
     * @param to The address to send tokens to
     */
    function withdrawTo(bytes32 secret, address to) external;

    /**
     * @notice Cancel the escrow and return tokens to maker
     * @dev Can only be called after cancellation timelock expires
     */
    function cancel() external;

    /**
     * @notice Rescue funds stuck in the contract
     * @dev Emergency function for resolver to recover accidentally sent tokens
     * @param token The token address to rescue (address(0) for native)
     * @param amount The amount to rescue
     * @param to The address to send rescued funds to
     */
    function rescueFunds(address token, uint256 amount, address to) external;

    /**
     * @notice Get the order hash for this escrow
     * @return bytes32 The order hash
     */
    function getOrderHash() external view returns (bytes32);

    /**
     * @notice Get the hashlock for this escrow
     * @return bytes32 The hashlock
     */
    function getHashlock() external view returns (bytes32);

    /**
     * @notice Check if the escrow has been withdrawn
     * @return bool True if withdrawn
     */
    function isWithdrawn() external view returns (bool);

    /**
     * @notice Check if the escrow has been cancelled
     * @return bool True if cancelled
     */
    function isCancelled() external view returns (bool);

    /**
     * @notice Get the current timelock stage
     * @return uint256 The current stage
     */
    function getCurrentTimelockStage() external view returns (uint256);

    // Events
    event Withdrawn(bytes32 indexed orderHash, address indexed to, bytes32 secret);
    event Cancelled(bytes32 indexed orderHash, address indexed maker);
    event FundsRescued(address indexed token, uint256 amount, address indexed to);
}