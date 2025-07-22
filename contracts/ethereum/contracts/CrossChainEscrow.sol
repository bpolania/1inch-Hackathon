// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CrossChainEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Immutables {
        bytes32 orderHash;
        bytes32 hashlock;
        address maker;
        address taker;
        address token;
        uint256 amount;
        uint256 safetyDeposit;
        uint256 timelocks;
    }

    enum TimelockStage {
        SrcWithdrawal,
        SrcPublicWithdrawal,
        SrcCancellation,
        SrcPublicCancellation,
        DstWithdrawal,
        DstPublicWithdrawal,
        DstCancellation
    }

    enum EscrowState {
        Created,
        Locked,
        Claimed,
        Cancelled,
        Refunded
    }

    Immutables public immutables;
    EscrowState public state;
    bool public isSourceEscrow;
    
    bytes32 private secret;
    uint256 public createdAt;
    
    address public factory;
    
    event EscrowCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        address token,
        uint256 amount,
        uint256 safetyDeposit
    );
    
    event EscrowLocked(
        bytes32 indexed orderHash,
        bytes32 hashlock,
        uint256 amount
    );
    
    event EscrowClaimed(
        bytes32 indexed orderHash,
        address indexed claimer,
        bytes32 secret
    );
    
    event EscrowCancelled(
        bytes32 indexed orderHash,
        address indexed canceller
    );
    
    event EscrowRefunded(
        bytes32 indexed orderHash,
        address indexed refundee,
        uint256 amount
    );

    modifier onlyFactory() {
        require(msg.sender == factory || factory == address(0), "Only factory can call");
        _;
    }

    modifier inState(EscrowState expectedState) {
        require(state == expectedState, "Invalid escrow state");
        _;
    }

    modifier onlyMaker() {
        require(msg.sender == immutables.maker, "Only maker can call");
        _;
    }

    modifier onlyTaker() {
        require(msg.sender == immutables.taker, "Only taker can call");
        _;
    }

    modifier afterTimelock(TimelockStage stage) {
        require(
            block.timestamp >= getTimelock(stage),
            "Timelock not reached"
        );
        _;
    }

    modifier beforeTimelock(TimelockStage stage) {
        require(
            block.timestamp < getTimelock(stage),
            "Timelock expired"
        );
        _;
    }

    constructor() {
        // Set factory to msg.sender, but allow direct initialization for testing
        factory = msg.sender;
    }

    function initialize(
        Immutables memory _immutables,
        bool _isSourceEscrow
    ) external onlyFactory {
        require(immutables.orderHash == bytes32(0), "Already initialized");
        
        immutables = _immutables;
        isSourceEscrow = _isSourceEscrow;
        createdAt = block.timestamp;
        
        // Mark as initialized by keeping state as Created but setting immutables
        // The state will change to Locked when lock() is called
        
        emit EscrowCreated(
            _immutables.orderHash,
            _immutables.maker,
            _immutables.taker,
            _immutables.token,
            _immutables.amount,
            _immutables.safetyDeposit
        );
    }

    function lock() external payable nonReentrant inState(EscrowState.Created) {
        if (isSourceEscrow) {
            require(msg.sender == immutables.maker, "Only maker can lock source");
            
            if (immutables.token == address(0)) {
                require(msg.value == immutables.amount, "Incorrect ETH amount");
            } else {
                IERC20(immutables.token).safeTransferFrom(
                    msg.sender,
                    address(this),
                    immutables.amount
                );
            }
        } else {
            require(msg.sender == immutables.taker, "Only taker can lock destination");
            
            uint256 totalRequired = immutables.amount + immutables.safetyDeposit;
            
            if (immutables.token == address(0)) {
                require(msg.value == totalRequired, "Incorrect ETH amount");
            } else {
                IERC20(immutables.token).safeTransferFrom(
                    msg.sender,
                    address(this),
                    totalRequired
                );
            }
        }

        state = EscrowState.Locked;
        
        emit EscrowLocked(
            immutables.orderHash,
            immutables.hashlock,
            immutables.amount
        );
    }

    function claim(bytes32 _secret) 
        external 
        nonReentrant 
        inState(EscrowState.Locked)
        beforeTimelock(isSourceEscrow ? TimelockStage.SrcWithdrawal : TimelockStage.DstWithdrawal)
    {
        require(keccak256(abi.encodePacked(_secret)) == immutables.hashlock, "Invalid secret");
        
        if (isSourceEscrow) {
            require(msg.sender == immutables.taker, "Only taker can claim source");
        } else {
            require(msg.sender == immutables.maker, "Only maker can claim destination");
        }

        secret = _secret;
        state = EscrowState.Claimed;

        address recipient = isSourceEscrow ? immutables.taker : immutables.maker;
        
        if (immutables.token == address(0)) {
            payable(recipient).transfer(immutables.amount);
        } else {
            IERC20(immutables.token).safeTransfer(recipient, immutables.amount);
        }

        if (!isSourceEscrow && immutables.safetyDeposit > 0) {
            if (immutables.token == address(0)) {
                payable(immutables.taker).transfer(immutables.safetyDeposit);
            } else {
                IERC20(immutables.token).safeTransfer(immutables.taker, immutables.safetyDeposit);
            }
        }

        emit EscrowClaimed(immutables.orderHash, recipient, _secret);
    }

    function publicClaim(bytes32 _secret)
        external
        nonReentrant
        inState(EscrowState.Locked)
        afterTimelock(isSourceEscrow ? TimelockStage.SrcWithdrawal : TimelockStage.DstWithdrawal)
        beforeTimelock(isSourceEscrow ? TimelockStage.SrcPublicWithdrawal : TimelockStage.DstPublicWithdrawal)
    {
        require(keccak256(abi.encodePacked(_secret)) == immutables.hashlock, "Invalid secret");

        secret = _secret;
        state = EscrowState.Claimed;

        address recipient = isSourceEscrow ? immutables.taker : immutables.maker;
        
        if (immutables.token == address(0)) {
            payable(recipient).transfer(immutables.amount);
        } else {
            IERC20(immutables.token).safeTransfer(recipient, immutables.amount);
        }

        if (!isSourceEscrow && immutables.safetyDeposit > 0) {
            if (immutables.token == address(0)) {
                payable(immutables.taker).transfer(immutables.safetyDeposit);
            } else {
                IERC20(immutables.token).safeTransfer(immutables.taker, immutables.safetyDeposit);
            }
        }

        emit EscrowClaimed(immutables.orderHash, recipient, _secret);
    }

    function cancel() 
        external 
        nonReentrant 
        inState(EscrowState.Locked)
        afterTimelock(isSourceEscrow ? TimelockStage.SrcCancellation : TimelockStage.DstCancellation)
        beforeTimelock(TimelockStage.SrcPublicCancellation)
    {
        if (isSourceEscrow) {
            require(msg.sender == immutables.maker, "Only maker can cancel source");
        } else {
            require(msg.sender == immutables.taker, "Only taker can cancel destination");
        }

        state = EscrowState.Cancelled;

        address refundee = isSourceEscrow ? immutables.maker : immutables.taker;
        uint256 refundAmount = isSourceEscrow ? immutables.amount : immutables.amount + immutables.safetyDeposit;

        if (immutables.token == address(0)) {
            payable(refundee).transfer(refundAmount);
        } else {
            IERC20(immutables.token).safeTransfer(refundee, refundAmount);
        }

        emit EscrowCancelled(immutables.orderHash, refundee);
    }

    function publicCancel()
        external
        nonReentrant
        inState(EscrowState.Locked)
        afterTimelock(TimelockStage.SrcPublicCancellation)
    {
        state = EscrowState.Cancelled;

        address refundee = isSourceEscrow ? immutables.maker : immutables.taker;
        uint256 refundAmount = isSourceEscrow ? immutables.amount : immutables.amount + immutables.safetyDeposit;

        if (immutables.token == address(0)) {
            payable(refundee).transfer(refundAmount);
        } else {
            IERC20(immutables.token).safeTransfer(refundee, refundAmount);
        }

        emit EscrowCancelled(immutables.orderHash, refundee);
    }

    function getTimelock(TimelockStage stage) public view returns (uint256) {
        uint256 packed = immutables.timelocks;
        uint256 stageIndex = uint256(stage);
        return (packed >> (stageIndex * 32)) & 0xFFFFFFFF;
    }

    function getSecret() external view returns (bytes32) {
        require(state == EscrowState.Claimed, "Secret not revealed");
        return secret;
    }

    function getEscrowInfo() external view returns (
        Immutables memory,
        EscrowState,
        bool,
        uint256,
        bytes32
    ) {
        return (immutables, state, isSourceEscrow, createdAt, secret);
    }
}