// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CrossChainEscrow.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CrossChainFactory is Ownable, ReentrancyGuard {
    
    struct IntentInfo {
        bytes32 orderHash;
        address maker;
        address sourceToken;
        uint256 sourceAmount;
        uint256 destinationChain;
        address destinationToken;
        uint256 destinationAmount;
        string destinationAddress;
        uint256 resolverFeeAmount;
        uint256 expiryTime;
        bool isActive;
    }

    mapping(bytes32 => IntentInfo) public intents;
    mapping(bytes32 => address) public sourceEscrows;
    mapping(bytes32 => address) public destinationEscrows;
    mapping(address => bool) public authorizedResolvers;
    
    uint256 public minimumSafetyDepositBps = 500; // 5%
    uint256 public resolverCount = 0;
    
    event IntentCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        address sourceToken,
        uint256 sourceAmount,
        uint256 destinationChain,
        address destinationToken,
        uint256 destinationAmount,
        string destinationAddress,
        uint256 resolverFeeAmount,
        uint256 expiryTime
    );
    
    event EscrowsCreated(
        bytes32 indexed orderHash,
        address indexed sourceEscrow,
        address indexed destinationEscrow,
        address resolver,
        bytes32 hashlock
    );
    
    event IntentMatched(
        bytes32 indexed orderHash,
        address indexed resolver,
        uint256 safetyDeposit
    );
    
    event ResolverAdded(address indexed resolver);
    event ResolverRemoved(address indexed resolver);

    constructor() Ownable(msg.sender) {
    }

    function addResolver(address resolver) external onlyOwner {
        require(resolver != address(0), "Invalid resolver address");
        require(!authorizedResolvers[resolver], "Resolver already added");
        
        authorizedResolvers[resolver] = true;
        resolverCount++;
        
        emit ResolverAdded(resolver);
    }

    function removeResolver(address resolver) external onlyOwner {
        require(authorizedResolvers[resolver], "Resolver not found");
        
        authorizedResolvers[resolver] = false;
        resolverCount--;
        
        emit ResolverRemoved(resolver);
    }

    function setMinimumSafetyDepositBps(uint256 bps) external onlyOwner {
        require(bps <= 2000, "Safety deposit too high"); // Max 20%
        minimumSafetyDepositBps = bps;
    }

    function createIntent(
        bytes32 orderHash,
        address sourceToken,
        uint256 sourceAmount,
        uint256 destinationChain,
        address destinationToken,
        uint256 destinationAmount,
        string calldata destinationAddress,
        uint256 resolverFeeAmount,
        uint256 expiryTime
    ) external nonReentrant {
        require(orderHash != bytes32(0), "Invalid order hash");
        require(sourceAmount > 0, "Invalid source amount");
        require(destinationAmount > 0, "Invalid destination amount");
        require(expiryTime > block.timestamp, "Invalid expiry time");
        require(!intents[orderHash].isActive, "Intent already exists");
        require(resolverFeeAmount >= sourceAmount / 1000, "Resolver fee too low"); // Min 0.1%
        
        intents[orderHash] = IntentInfo({
            orderHash: orderHash,
            maker: msg.sender,
            sourceToken: sourceToken,
            sourceAmount: sourceAmount,
            destinationChain: destinationChain,
            destinationToken: destinationToken,
            destinationAmount: destinationAmount,
            destinationAddress: destinationAddress,
            resolverFeeAmount: resolverFeeAmount,
            expiryTime: expiryTime,
            isActive: true
        });
        
        emit IntentCreated(
            orderHash,
            msg.sender,
            sourceToken,
            sourceAmount,
            destinationChain,
            destinationToken,
            destinationAmount,
            destinationAddress,
            resolverFeeAmount,
            expiryTime
        );
    }

    function matchIntent(
        bytes32 orderHash,
        bytes32 hashlock,
        uint256 timelocks
    ) external nonReentrant {
        require(authorizedResolvers[msg.sender], "Not authorized resolver");
        require(intents[orderHash].isActive, "Intent not active");
        require(block.timestamp < intents[orderHash].expiryTime, "Intent expired");
        require(sourceEscrows[orderHash] == address(0), "Already matched");
        
        IntentInfo memory intent = intents[orderHash];
        uint256 safetyDeposit = (intent.sourceAmount * minimumSafetyDepositBps) / 10000;
        
        CrossChainEscrow.Immutables memory srcImmutables = CrossChainEscrow.Immutables({
            orderHash: orderHash,
            hashlock: hashlock,
            maker: intent.maker,
            taker: msg.sender,
            token: intent.sourceToken,
            amount: intent.sourceAmount,
            safetyDeposit: 0, // Source doesn't require safety deposit
            timelocks: timelocks
        });
        
        CrossChainEscrow.Immutables memory dstImmutables = CrossChainEscrow.Immutables({
            orderHash: orderHash,
            hashlock: hashlock,
            maker: intent.maker,
            taker: msg.sender,
            token: intent.destinationToken,
            amount: intent.destinationAmount,
            safetyDeposit: safetyDeposit,
            timelocks: timelocks
        });

        CrossChainEscrow sourceEscrow = new CrossChainEscrow();
        sourceEscrow.initialize(srcImmutables, true);
        sourceEscrows[orderHash] = address(sourceEscrow);
        
        CrossChainEscrow destinationEscrow = new CrossChainEscrow();
        destinationEscrow.initialize(dstImmutables, false);
        destinationEscrows[orderHash] = address(destinationEscrow);
        
        emit EscrowsCreated(
            orderHash,
            address(sourceEscrow),
            address(destinationEscrow),
            msg.sender,
            hashlock
        );
        
        emit IntentMatched(orderHash, msg.sender, safetyDeposit);
    }

    function cancelIntent(bytes32 orderHash) external {
        require(intents[orderHash].isActive, "Intent not active");
        require(
            msg.sender == intents[orderHash].maker || 
            block.timestamp >= intents[orderHash].expiryTime,
            "Not authorized to cancel"
        );
        require(sourceEscrows[orderHash] == address(0), "Intent already matched");
        
        intents[orderHash].isActive = false;
    }

    function getIntentInfo(bytes32 orderHash) external view returns (IntentInfo memory) {
        return intents[orderHash];
    }

    function getEscrowAddresses(bytes32 orderHash) external view returns (address source, address destination) {
        return (sourceEscrows[orderHash], destinationEscrows[orderHash]);
    }

    function isIntentActive(bytes32 orderHash) external view returns (bool) {
        return intents[orderHash].isActive && 
               block.timestamp < intents[orderHash].expiryTime &&
               sourceEscrows[orderHash] == address(0);
    }

    function calculateSafetyDeposit(uint256 sourceAmount) external view returns (uint256) {
        return (sourceAmount * minimumSafetyDepositBps) / 10000;
    }

    function getActiveIntents(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        // Note: This is a simplified implementation. 
        // In production, you'd want a more efficient enumeration mechanism
        bytes32[] memory activeIntents = new bytes32[](limit);
        uint256 count = 0;
        
        // This would need to be implemented with proper iteration logic
        // For now, returning empty array as placeholder
        return activeIntents;
    }
}