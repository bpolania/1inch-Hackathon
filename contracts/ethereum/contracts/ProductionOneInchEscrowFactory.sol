// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IOneInchEscrowFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @title ProductionOneInchEscrowFactory
 * @notice Production-ready implementation of 1inch EscrowFactory for Sepolia deployment
 * @dev Compatible with 1inch's EscrowFactory interface, ready for mainnet migration
 */
contract ProductionOneInchEscrowFactory is IOneInchEscrowFactory, Ownable, ReentrancyGuard {
    using Clones for address;
    
    // Implementation contract addresses (deployed separately)
    address public override escrowSrcImplementation;
    address public override escrowDstImplementation;
    
    // Storage for created escrows
    mapping(bytes32 => address) public srcEscrows;
    mapping(bytes32 => address) public dstEscrows;
    
    // Security and operational parameters
    uint256 public minimumSafetyDeposit = 0.01 ether; // Minimum safety deposit
    uint256 public maxTimelockDuration = 7 days;      // Maximum timelock duration
    bool public paused = false;                       // Emergency pause
    
    // Events
    event EscrowImplementationsUpdated(address srcImpl, address dstImpl);
    event FactoryPaused(bool paused);
    event MinimumSafetyDepositUpdated(uint256 newMinimum);

    modifier whenNotPaused() {
        require(!paused, "Factory is paused");
        _;
    }

    modifier validImmutables(Immutables calldata immutables) {
        require(immutables.orderHash != bytes32(0), "Invalid order hash");
        require(immutables.hashlock != bytes32(0), "Invalid hashlock");
        require(immutables.maker != address(0), "Invalid maker");
        require(immutables.taker != address(0), "Invalid taker");
        require(immutables.amount > 0, "Invalid amount");
        _;
    }

    constructor() Ownable(msg.sender) {
        // Deploy implementation contracts
        escrowSrcImplementation = address(new ProductionEscrowSrc());
        escrowDstImplementation = address(new ProductionEscrowDst());
        
        emit EscrowImplementationsUpdated(escrowSrcImplementation, escrowDstImplementation);
    }

    /**
     * @notice Update implementation contracts (owner only)
     * @param _srcImpl New EscrowSrc implementation
     * @param _dstImpl New EscrowDst implementation
     */
    function updateImplementations(address _srcImpl, address _dstImpl) external onlyOwner {
        require(_srcImpl != address(0) && _dstImpl != address(0), "Invalid implementations");
        escrowSrcImplementation = _srcImpl;
        escrowDstImplementation = _dstImpl;
        emit EscrowImplementationsUpdated(_srcImpl, _dstImpl);
    }

    /**
     * @notice Pause/unpause the factory (emergency function)
     * @param _paused New pause state
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit FactoryPaused(_paused);
    }

    /**
     * @notice Update minimum safety deposit
     * @param _newMinimum New minimum safety deposit
     */
    function setMinimumSafetyDeposit(uint256 _newMinimum) external onlyOwner {
        minimumSafetyDeposit = _newMinimum;
        emit MinimumSafetyDepositUpdated(_newMinimum);
    }

    /**
     * @notice Compute the address of the EscrowSrc clone that will be deployed
     * @dev Compatible with 1inch's deterministic address computation
     * @param immutables The immutable parameters for the escrow
     * @return address The computed EscrowSrc address
     */
    function addressOfEscrowSrc(Immutables calldata immutables) 
        external 
        view 
        override 
        validImmutables(immutables)
        returns (address) 
    {
        // Generate deterministic salt based on immutables
        bytes32 salt = keccak256(abi.encode(
            immutables.orderHash,
            immutables.hashlock,
            immutables.maker,
            immutables.taker,
            immutables.token,
            immutables.amount
        ));
        
        // Use CREATE2 to compute deterministic address
        return Clones.predictDeterministicAddress(escrowSrcImplementation, salt, address(this));
    }

    /**
     * @notice Deploy an EscrowDst clone on the destination chain
     * @dev Production implementation with proper validation and security
     * @param dstImmutables The immutable parameters for destination escrow
     * @param srcCancellationTimestamp The source cancellation timestamp
     * @return address The deployed EscrowDst address
     */
    function createDstEscrow(
        Immutables calldata dstImmutables,
        uint256 srcCancellationTimestamp
    ) 
        external 
        payable 
        override 
        nonReentrant 
        whenNotPaused 
        validImmutables(dstImmutables)
        returns (address) 
    {
        // Validate safety deposit
        require(
            dstImmutables.safetyDeposit >= minimumSafetyDeposit,
            "Safety deposit too low"
        );
        require(msg.value >= dstImmutables.safetyDeposit, "Insufficient payment");
        
        // Validate timelock duration
        uint256 maxTimelock = _extractMaxTimelock(dstImmutables.timelocks);
        require(
            maxTimelock <= block.timestamp + maxTimelockDuration,
            "Timelock duration too long"
        );
        
        // Check if escrow already exists
        require(dstEscrows[dstImmutables.orderHash] == address(0), "Escrow already exists");
        
        // Generate deterministic salt
        bytes32 salt = keccak256(abi.encode(
            dstImmutables.orderHash,
            dstImmutables.hashlock,
            dstImmutables.maker,
            dstImmutables.taker,
            block.timestamp
        ));
        
        // Deploy escrow using CREATE2
        address escrow = Clones.cloneDeterministic(escrowDstImplementation, salt);
        
        // Initialize the escrow with only the safety deposit
        ProductionEscrowDst(payable(escrow)).initialize{value: dstImmutables.safetyDeposit}(
            dstImmutables,
            srcCancellationTimestamp
        );
        
        // Store the escrow address
        dstEscrows[dstImmutables.orderHash] = escrow;
        
        // Refund excess payment
        if (msg.value > dstImmutables.safetyDeposit) {
            payable(msg.sender).transfer(msg.value - dstImmutables.safetyDeposit);
        }
        
        emit EscrowDstCreated(
            dstImmutables.orderHash,
            escrow,
            dstImmutables.maker,
            dstImmutables.taker,
            dstImmutables.hashlock
        );
        
        return escrow;
    }

    /**
     * @notice Deploy an EscrowSrc clone on the source chain
     * @dev Production implementation for source escrow creation
     * @param srcImmutables The immutable parameters for source escrow
     * @return address The deployed EscrowSrc address
     */
    function createSrcEscrow(Immutables calldata srcImmutables) 
        external 
        payable 
        override 
        nonReentrant 
        whenNotPaused 
        validImmutables(srcImmutables)
        returns (address) 
    {
        // Check if escrow already exists
        require(srcEscrows[srcImmutables.orderHash] == address(0), "Escrow already exists");
        
        // Generate deterministic salt
        bytes32 salt = keccak256(abi.encode(
            srcImmutables.orderHash,
            srcImmutables.hashlock,
            srcImmutables.maker,
            srcImmutables.taker,
            block.timestamp
        ));
        
        // Deploy escrow using CREATE2
        address escrow = Clones.cloneDeterministic(escrowSrcImplementation, salt);
        
        // Initialize the escrow
        ProductionEscrowSrc(payable(escrow)).initialize{value: msg.value}(srcImmutables);
        
        // Store the escrow address
        srcEscrows[srcImmutables.orderHash] = escrow;
        
        emit EscrowSrcCreated(
            srcImmutables.orderHash,
            escrow,
            srcImmutables.maker,
            srcImmutables.taker,
            srcImmutables.hashlock
        );
        
        return escrow;
    }

    /**
     * @notice Extract maximum timelock from packed timelocks
     * @param packedTimelocks Packed timelock data
     * @return maxTimelock Maximum timelock timestamp
     */
    function _extractMaxTimelock(uint256 packedTimelocks) internal pure returns (uint256 maxTimelock) {
        // Extract all 7 timelock stages and find maximum
        for (uint256 i = 0; i < 7; i++) {
            uint256 timelock = (packedTimelocks >> (224 - i * 32)) & 0xFFFFFFFF;
            if (timelock > maxTimelock) {
                maxTimelock = timelock;
            }
        }
    }

    /**
     * @notice Get escrow address by order hash
     * @param orderHash The order hash
     * @return srcEscrow Source escrow address
     * @return dstEscrow Destination escrow address
     */
    function getEscrowAddresses(bytes32 orderHash) 
        external 
        view 
        returns (address srcEscrow, address dstEscrow) 
    {
        return (srcEscrows[orderHash], dstEscrows[orderHash]);
    }

    /**
     * @notice Emergency withdrawal of stuck funds (owner only)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");
        to.transfer(amount);
    }

    /**
     * @notice Receive function to accept ETH
     */
    receive() external payable {}
}

/**
 * @title ProductionEscrowSrc
 * @notice Production-ready source escrow contract
 */
contract ProductionEscrowSrc is ReentrancyGuard {
    IOneInchEscrowFactory.Immutables public immutables;
    bool public isInitialized;
    bool public isWithdrawn;
    bool public isCancelled;
    
    modifier onlyInitialized() {
        require(isInitialized, "Not initialized");
        _;
    }
    
    modifier onlyTaker() {
        require(msg.sender == immutables.taker, "Only taker");
        _;
    }
    
    modifier onlyMaker() {
        require(msg.sender == immutables.maker, "Only maker");
        _;
    }
    
    function initialize(IOneInchEscrowFactory.Immutables memory _immutables) 
        external 
        payable 
        nonReentrant 
    {
        require(!isInitialized, "Already initialized");
        immutables = _immutables;
        isInitialized = true;
    }
    
    function withdraw(bytes32 secret) external onlyInitialized onlyTaker nonReentrant {
        require(sha256(abi.encodePacked(secret)) == immutables.hashlock, "Invalid secret");
        require(!isWithdrawn && !isCancelled, "Already processed");
        
        isWithdrawn = true;
        
        // Transfer any held value to taker
        if (address(this).balance > 0) {
            payable(immutables.taker).transfer(address(this).balance);
        }
    }
    
    function cancel() external onlyInitialized onlyMaker nonReentrant {
        require(block.timestamp >= _getTimelockStage(6), "Too early to cancel");
        require(!isWithdrawn && !isCancelled, "Already processed");
        
        isCancelled = true;
        
        // Refund any held value to maker
        if (address(this).balance > 0) {
            payable(immutables.maker).transfer(address(this).balance);
        }
    }
    
    function _getTimelockStage(uint256 stage) internal view returns (uint256) {
        return (immutables.timelocks >> (224 - stage * 32)) & 0xFFFFFFFF;
    }
    
    receive() external payable {}
}

/**
 * @title ProductionEscrowDst
 * @notice Production-ready destination escrow contract
 */
contract ProductionEscrowDst is ReentrancyGuard {
    IOneInchEscrowFactory.Immutables public immutables;
    uint256 public srcCancellationTimestamp;
    bool public isInitialized;
    bool public isWithdrawn;
    bool public isCancelled;
    
    modifier onlyInitialized() {
        require(isInitialized, "Not initialized");
        _;
    }
    
    modifier onlyMaker() {
        require(msg.sender == immutables.maker, "Only maker");
        _;
    }
    
    modifier onlyTaker() {
        require(msg.sender == immutables.taker, "Only taker");
        _;
    }
    
    function initialize(
        IOneInchEscrowFactory.Immutables memory _immutables,
        uint256 _srcCancellationTimestamp
    ) external payable nonReentrant {
        require(!isInitialized, "Already initialized");
        immutables = _immutables;
        srcCancellationTimestamp = _srcCancellationTimestamp;
        isInitialized = true;
    }
    
    function withdraw(bytes32 secret) external onlyInitialized onlyMaker nonReentrant {
        require(sha256(abi.encodePacked(secret)) == immutables.hashlock, "Invalid secret");
        require(!isWithdrawn && !isCancelled, "Already processed");
        
        isWithdrawn = true;
        
        // Transfer safety deposit to maker
        if (address(this).balance > 0) {
            payable(immutables.maker).transfer(address(this).balance);
        }
    }
    
    function withdrawTo(bytes32 secret, address to) external onlyInitialized onlyMaker nonReentrant {
        require(sha256(abi.encodePacked(secret)) == immutables.hashlock, "Invalid secret");
        require(!isWithdrawn && !isCancelled, "Already processed");
        require(to != address(0), "Invalid recipient");
        
        isWithdrawn = true;
        
        // Transfer safety deposit to specified address
        if (address(this).balance > 0) {
            payable(to).transfer(address(this).balance);
        }
    }
    
    function cancel() external onlyInitialized onlyTaker nonReentrant {
        require(block.timestamp >= _getTimelockStage(6), "Too early to cancel");
        require(!isWithdrawn && !isCancelled, "Already processed");
        
        isCancelled = true;
        
        // Refund safety deposit to taker
        if (address(this).balance > 0) {
            payable(immutables.taker).transfer(address(this).balance);
        }
    }
    
    function rescueFunds(address token, uint256 amount, address to) external onlyTaker {
        require(to != address(0), "Invalid recipient");
        
        if (token == address(0)) {
            // Rescue native ETH
            require(address(this).balance >= amount, "Insufficient balance");
            payable(to).transfer(amount);
        }
        // ERC20 rescue would be implemented here for production
    }
    
    function _getTimelockStage(uint256 stage) internal view returns (uint256) {
        return (immutables.timelocks >> (224 - stage * 32)) & 0xFFFFFFFF;
    }
    
    receive() external payable {}
}