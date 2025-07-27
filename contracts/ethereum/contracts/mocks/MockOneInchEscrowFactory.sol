// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IOneInchEscrowFactory.sol";

/**
 * @title MockOneInchEscrowFactory
 * @notice Mock implementation of 1inch EscrowFactory for testing
 * @dev Simulates the behavior of 1inch's real EscrowFactory contract
 */
contract MockOneInchEscrowFactory is IOneInchEscrowFactory {
    
    // Mock escrow implementation addresses
    address public constant override escrowSrcImplementation = address(0x1111111111111111111111111111111111111111);
    address public constant override escrowDstImplementation = address(0x2222222222222222222222222222222222222222);
    
    // Storage for created escrows
    mapping(bytes32 => address) public srcEscrows;
    mapping(bytes32 => address) public dstEscrows;
    
    uint256 private nonce = 0;

    /**
     * @notice Compute the address of the EscrowSrc clone that will be deployed
     * @dev Mock implementation that returns a deterministic address
     * @param immutables The immutable parameters for the escrow
     * @return address The computed EscrowSrc address
     */
    function addressOfEscrowSrc(Immutables calldata immutables) external view override returns (address) {
        // Generate deterministic address based on order hash and immutables
        bytes32 salt = keccak256(abi.encode(immutables.orderHash, immutables.hashlock, immutables.maker));
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(abi.encodePacked(type(MockEscrowSrc).creationCode, abi.encode(immutables)))
        )))));
    }

    /**
     * @notice Deploy an EscrowDst clone on the destination chain
     * @dev Mock implementation that creates a simple escrow contract
     * @param dstImmutables The immutable parameters for destination escrow
     * @param srcCancellationTimestamp The source cancellation timestamp
     * @return address The deployed EscrowDst address
     */
    function createDstEscrow(
        Immutables calldata dstImmutables,
        uint256 srcCancellationTimestamp
    ) external payable override returns (address) {
        // In mock, we don't require safety deposit payment for testing
        
        // Create mock escrow contract
        MockEscrowDst escrow = new MockEscrowDst{salt: bytes32(nonce++)}(
            dstImmutables,
            srcCancellationTimestamp
        );
        
        // Store the escrow address
        dstEscrows[dstImmutables.orderHash] = address(escrow);
        
        // Send safety deposit to escrow
        if (msg.value > 0) {
            payable(address(escrow)).transfer(msg.value);
        }
        
        emit EscrowDstCreated(
            dstImmutables.orderHash,
            address(escrow),
            dstImmutables.maker,
            dstImmutables.taker,
            dstImmutables.hashlock
        );
        
        return address(escrow);
    }

    /**
     * @notice Deploy an EscrowSrc clone on the source chain
     * @dev Mock implementation for source escrow creation
     * @param srcImmutables The immutable parameters for source escrow
     * @return address The deployed EscrowSrc address
     */
    function createSrcEscrow(Immutables calldata srcImmutables) external payable override returns (address) {
        // Create mock escrow contract
        MockEscrowSrc escrow = new MockEscrowSrc{salt: bytes32(nonce++)}(srcImmutables);
        
        // Store the escrow address
        srcEscrows[srcImmutables.orderHash] = address(escrow);
        
        emit EscrowSrcCreated(
            srcImmutables.orderHash,
            address(escrow),
            srcImmutables.maker,
            srcImmutables.taker,
            srcImmutables.hashlock
        );
        
        return address(escrow);
    }
}

/**
 * @title MockEscrowSrc
 * @notice Mock source escrow contract for testing
 */
contract MockEscrowSrc {
    IOneInchEscrowFactory.Immutables public immutables;
    bool public isWithdrawn;
    bool public isCancelled;
    
    constructor(IOneInchEscrowFactory.Immutables memory _immutables) {
        immutables = _immutables;
    }
    
    function withdraw(bytes32 secret) external {
        require(sha256(abi.encodePacked(secret)) == immutables.hashlock, "Invalid secret");
        require(!isWithdrawn && !isCancelled, "Already withdrawn or cancelled");
        isWithdrawn = true;
    }
    
    function cancel() external {
        require(block.timestamp >= _getTimelockStage(3), "Too early to cancel");
        require(!isWithdrawn && !isCancelled, "Already withdrawn or cancelled");
        isCancelled = true;
    }
    
    function _getTimelockStage(uint256 stage) internal view returns (uint256) {
        return (immutables.timelocks >> (224 - stage * 32)) & 0xFFFFFFFF;
    }
}

/**
 * @title MockEscrowDst
 * @notice Mock destination escrow contract for testing
 */
contract MockEscrowDst {
    IOneInchEscrowFactory.Immutables public immutables;
    uint256 public srcCancellationTimestamp;
    bool public isWithdrawn;
    bool public isCancelled;
    
    constructor(
        IOneInchEscrowFactory.Immutables memory _immutables,
        uint256 _srcCancellationTimestamp
    ) payable {
        immutables = _immutables;
        srcCancellationTimestamp = _srcCancellationTimestamp;
    }
    
    function withdraw(bytes32 secret) external {
        require(sha256(abi.encodePacked(secret)) == immutables.hashlock, "Invalid secret");
        require(!isWithdrawn && !isCancelled, "Already withdrawn or cancelled");
        isWithdrawn = true;
    }
    
    function withdrawTo(bytes32 secret, address to) external {
        require(sha256(abi.encodePacked(secret)) == immutables.hashlock, "Invalid secret");
        require(!isWithdrawn && !isCancelled, "Already withdrawn or cancelled");
        require(to != address(0), "Invalid recipient");
        isWithdrawn = true;
    }
    
    function cancel() external {
        require(block.timestamp >= _getTimelockStage(3), "Too early to cancel");
        require(!isWithdrawn && !isCancelled, "Already withdrawn or cancelled");
        isCancelled = true;
    }
    
    function rescueFunds(address token, uint256 amount, address to) external {
        require(msg.sender == immutables.taker, "Not authorized");
        require(to != address(0), "Invalid recipient");
        
        if (token == address(0)) {
            // Rescue native ETH
            require(address(this).balance >= amount, "Insufficient balance");
            payable(to).transfer(amount);
        }
        // ERC20 rescue would be implemented here
    }
    
    function _getTimelockStage(uint256 stage) internal view returns (uint256) {
        return (immutables.timelocks >> (224 - stage * 32)) & 0xFFFFFFFF;
    }
    
    receive() external payable {}
}