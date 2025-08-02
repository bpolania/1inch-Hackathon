# Partial Fills Implementation Roadmap

**Status**: Architecture Ready, Implementation Deferred  
**Estimated Effort**: 8-12 weeks  
**Complexity**: High (Cross-chain atomic coordination)

## Executive Summary

The 1inch Fusion+ extension architecture is **ready for partial fills** at the infrastructure level. The underlying 1inch Limit Order Protocol (LOP) natively supports partial fills through `remainingMakingAmount` tracking and `RemainingInvalidatorLib`. However, implementing partial fills for cross-chain atomic swaps introduces significant complexity in atomic coordination and requires substantial architectural changes.

**Recommendation**: Implement as a **post-hackathon production feature** after core functionality is battle-tested.

## Current Status

### ✅ **Already Supported (1inch LOP Level)**
- **`ITakerInteraction`** interface receives `remainingMakingAmount` parameter
- **`RemainingInvalidatorLib`** tracks order fill states and prevents double-spending
- **Linear calculation logic** computes proportional amounts for partial fills
- **Order state management** maintains fill tracking across multiple transactions

### ❌ **Missing (Fusion+ Extension Level)**
- Cross-chain partial fill coordination
- Multiple HTLC management for partial amounts
- Dynamic safety deposit calculations
- Partial fill API endpoints
- Enhanced monitoring and state tracking

## Technical Requirements

### 1. Smart Contract Changes

#### A. OneInchFusionPlusFactory.sol Modifications

**New State Variables:**
```solidity
// Partial fill tracking
mapping(bytes32 => uint256) public orderFillAmounts;
mapping(bytes32 => uint256) public minFillAmounts;
mapping(bytes32 => bool) public allowPartialFills;

// Multi-fill coordination
struct PartialFillState {
    uint256 totalFilled;
    uint256 remainingAmount;
    uint256 activePartialFills;
    mapping(uint256 => bytes32) partialHashlocks;
}
mapping(bytes32 => PartialFillState) public partialFillStates;
```

**Enhanced Order Creation:**
```solidity
struct CreateOrderParams {
    // ... existing fields ...
    bool allowPartialFill;      // Enable partial fills
    uint256 minFillAmount;      // Minimum fill amount per execution
    uint256 maxPartialFills;    // Maximum concurrent partial fills
    uint256 partialFillFee;     // Additional fee for partial coordination
}
```

**Modified Order Matching:**
```solidity
function matchPartialFusionOrder(
    bytes32 orderHash,
    bytes32 hashlock,
    uint256 requestedAmount,    // Partial amount to fill
    uint256 partialIndex       // Index for this partial fill
) external payable returns (address sourceEscrow, address destinationEscrow) {
    // Validate partial fill parameters
    require(orders[orderHash].allowPartialFill, "Partial fills not allowed");
    require(requestedAmount >= minFillAmounts[orderHash], "Below minimum fill");
    require(requestedAmount <= getRemainingAmount(orderHash), "Exceeds remaining");
    
    // Update partial fill state
    partialFillStates[orderHash].totalFilled += requestedAmount;
    partialFillStates[orderHash].activePartialFills++;
    partialFillStates[orderHash].partialHashlocks[partialIndex] = hashlock;
    
    // Calculate proportional safety deposit
    uint256 partialSafetyDeposit = calculatePartialSafetyDeposit(orderHash, requestedAmount);
    require(msg.value >= partialSafetyDeposit, "Insufficient partial safety deposit");
    
    // Create partial escrows with unique identifiers
    bytes32 partialOrderHash = keccak256(abi.encode(orderHash, partialIndex));
    
    // ... rest of escrow creation logic for partial amounts
}
```

#### B. NearTakerInteraction.sol Enhancements

**Partial Order Processing:**
```solidity
struct PartialNearOrderData {
    uint256 originalDestinationAmount;
    uint256 partialDestinationAmount;
    uint256 partialIndex;
    bytes32 parentOrderHash;
    bool isPartialFill;
}

function takerInteraction(
    IOrderMixin.Order calldata order,
    bytes calldata extension,
    bytes32 orderHash,
    address taker,
    uint256 makingAmount,           // Partial amount being made
    uint256 takingAmount,           // Partial amount being taken
    uint256 remainingMakingAmount,  // Remaining after this fill
    bytes calldata extraData
) external override nonReentrant {
    // Decode original and partial order data
    (NearOrderData memory originalOrder, uint256 partialIndex) = 
        abi.decode(extension, (NearOrderData, uint256));
    
    // Calculate proportional destination amount
    uint256 partialDestinationAmount = (originalOrder.destinationAmount * makingAmount) / order.makingAmount;
    
    // Create partial order data
    PartialNearOrderData memory partialOrder = PartialNearOrderData({
        originalDestinationAmount: originalOrder.destinationAmount,
        partialDestinationAmount: partialDestinationAmount,
        partialIndex: partialIndex,
        parentOrderHash: orderHash,
        isPartialFill: true
    });
    
    // Generate unique hashlock for this partial fill
    bytes32 partialHashlock = generatePartialHashlock(originalOrder.hashlock, partialIndex);
    
    // Store partial order data
    partialNearOrders[orderHash][partialIndex] = partialOrder;
    
    emit PartialNearOrderCreated(orderHash, partialIndex, partialDestinationAmount, partialHashlock);
}
```

### 2. Cross-Chain Coordination Architecture

#### A. Multiple HTLC Management

**Challenge**: Each partial fill needs its own atomic swap coordination.

**Solution Architecture:**
```
Original Order: 100 ETH → 10,000 NEAR

Partial Fill 1: 30 ETH → 3,000 NEAR
├── ETH Escrow 1: 30 ETH locked with hashlock_1
├── NEAR HTLC 1: 3,000 NEAR locked with same hashlock_1
└── Secret reveal unlocks both

Partial Fill 2: 20 ETH → 2,000 NEAR  
├── ETH Escrow 2: 20 ETH locked with hashlock_2
├── NEAR HTLC 2: 2,000 NEAR locked with same hashlock_2
└── Independent secret reveal

Remaining: 50 ETH → 5,000 NEAR (available for future fills)
```

**Implementation Requirements:**
```typescript
class PartialFillCoordinator {
    // Generate unique hashlock for each partial fill
    generatePartialHashlock(originalHashlock: string, partialIndex: number): string {
        return keccak256(originalHashlock + partialIndex.toString());
    }
    
    // Coordinate multiple partial atomic swaps
    async coordinatePartialSwap(
        orderHash: string,
        partialAmount: string,
        partialIndex: number
    ): Promise<PartialSwapResult> {
        // 1. Create unique hashlock
        const partialHashlock = this.generatePartialHashlock(originalHashlock, partialIndex);
        
        // 2. Deploy partial ETH escrow
        const ethEscrow = await this.deployPartialEthEscrow(partialAmount, partialHashlock);
        
        // 3. Deploy partial NEAR HTLC
        const nearHTLC = await this.deployPartialNearHTLC(proportionalNearAmount, partialHashlock);
        
        // 4. Return coordination data
        return {
            ethEscrow,
            nearHTLC,
            partialHashlock,
            timelock: calculatePartialTimelock()
        };
    }
}
```

#### B. State Synchronization

**Cross-Chain State Tracking:**
```typescript
interface PartialFillState {
    orderHash: string;
    partialIndex: number;
    ethAmount: string;
    nearAmount: string;
    ethEscrowAddress: string;
    nearHTLCAddress: string;
    hashlock: string;
    status: 'pending' | 'locked' | 'executed' | 'refunded';
    createdAt: number;
    expiresAt: number;
}

class CrossChainPartialFillManager {
    private partialFills: Map<string, PartialFillState[]> = new Map();
    
    async trackPartialFill(partialFill: PartialFillState): Promise<void> {
        const orderFills = this.partialFills.get(partialFill.orderHash) || [];
        orderFills.push(partialFill);
        this.partialFills.set(partialFill.orderHash, orderFills);
        
        // Monitor both chains for this partial fill
        await this.monitorEthereumEscrow(partialFill);
        await this.monitorNearHTLC(partialFill);
    }
    
    async executePartialFill(orderHash: string, partialIndex: number, secret: string): Promise<void> {
        // Execute on both chains atomically
        await Promise.all([
            this.executeEthereumPartial(orderHash, partialIndex, secret),
            this.executeNearPartial(orderHash, partialIndex, secret)
        ]);
    }
}
```

### 3. API Gateway Enhancements

#### A. New Partial Fill Endpoints

```typescript
// GET /api/1inch/partial-fill-support
interface PartialFillSupport {
    supported: boolean;
    maxConcurrentFills: number;
    minFillAmount: string;
    additionalFees: {
        partialCoordinationFee: string;
        htlcDeploymentFee: string;
    };
}

// POST /api/1inch/create-partial-order
interface CreatePartialOrderRequest {
    // ... standard order fields ...
    allowPartialFill: boolean;
    minFillAmount: string;
    maxPartialFills: number;
    partialFillStrategy: 'any' | 'sequential' | 'batch';
}

// POST /api/1inch/partial-fill
interface PartialFillRequest {
    orderHash: string;
    fillAmount: string;
    fromAddress: string;
    maxSlippage?: number;
}

// GET /api/1inch/partial-status/:orderHash
interface PartialFillStatus {
    originalAmount: string;
    totalFilled: string;
    remainingAmount: string;
    activeFills: PartialFillState[];
    completedFills: CompletedPartialFill[];
    fillHistory: PartialFillHistory[];
}

// PUT /api/1inch/cancel-partial/:orderHash/:partialIndex
// DELETE /api/1inch/cancel-remaining/:orderHash
```

#### B. Enhanced Swap Endpoint

```typescript
// Modified POST /api/1inch/swap
interface SwapRequest {
    // ... existing fields ...
    
    // Partial fill support
    isPartialFill?: boolean;
    fillAmount?: string;        // Amount to fill (instead of full order)
    parentOrderHash?: string;   // For partial fills of existing orders
    partialIndex?: number;      // Index of this partial fill
    
    // Partial fill preferences
    allowSubsequentPartials?: boolean;
    minRemainingAmount?: string;
}

interface SwapResponse {
    // ... existing fields ...
    
    // Partial fill information
    isPartialFill: boolean;
    filledAmount: string;
    remainingAmount: string;
    partialIndex?: number;
    canFillRemaining: boolean;
    
    // Multiple transaction coordination
    relatedPartialFills?: string[]; // Other partial fill transaction hashes
    parentOrder?: string;           // Original order hash if this is a partial
}
```

### 4. Backend Service Updates

#### A. TEE Solver Enhancements

```typescript
interface PartialIntent {
    // ... existing Intent fields ...
    isPartialFill: boolean;
    originalAmount: string;
    requestedFillAmount: string;
    remainingAmount: string;
    partialIndex: number;
    parentIntentId?: string;
    
    // Partial fill coordination
    relatedPartialFills: string[];
    partialFillStrategy: 'immediate' | 'batch' | 'optimal';
}

class TEESolver {
    async analyzePartialIntent(intent: PartialIntent): Promise<PartialAnalysisResult> {
        // Analyze profitability of partial vs full execution
        const partialProfitability = await this.calculatePartialProfitability(intent);
        const fullOrderProfitability = await this.calculateFullOrderProfitability(intent);
        
        // Determine optimal fill strategy
        const strategy = this.determineOptimalPartialStrategy(
            partialProfitability,
            fullOrderProfitability,
            intent.partialFillStrategy
        );
        
        return {
            shouldExecutePartial: strategy.executePartial,
            recommendedFillAmount: strategy.optimalAmount,
            estimatedCoordination: strategy.coordinationCost,
            riskAssessment: this.assessPartialFillRisks(intent)
        };
    }
    
    async submitPartialToTEE(intent: PartialIntent): Promise<PartialExecutionResult> {
        // Generate unique coordination parameters
        const partialHashlock = this.generatePartialHashlock(intent);
        const coordinationPlan = await this.createPartialCoordinationPlan(intent);
        
        // Submit to TEE with partial execution context
        return await this.executeTEEPartialSwap(intent, partialHashlock, coordinationPlan);
    }
}
```

#### B. Relayer Service Updates

```typescript
class RelayerService {
    async submitPartialIntent(intent: PartialIntent): Promise<PartialExecutionResult> {
        // Validate partial fill requirements
        await this.validatePartialFillRequirements(intent);
        
        // Coordinate with existing partial fills for same order
        const existingPartials = await this.getExistingPartialFills(intent.parentIntentId);
        
        // Calculate optimal execution strategy
        const strategy = await this.calculatePartialExecutionStrategy(intent, existingPartials);
        
        // Execute partial fill with cross-chain coordination
        return await this.executePartialFill(intent, strategy);
    }
    
    async monitorPartialFillGroup(orderHash: string): Promise<PartialFillGroupStatus> {
        // Monitor all partial fills for an order
        const partialFills = await this.getPartialFillsByOrder(orderHash);
        
        // Check cross-chain states
        const states = await Promise.all(
            partialFills.map(partial => this.checkPartialFillState(partial))
        );
        
        // Detect any coordination issues
        const issues = this.detectCoordinationIssues(states);
        
        return {
            totalPartials: partialFills.length,
            completedPartials: states.filter(s => s.status === 'completed').length,
            activePartials: states.filter(s => s.status === 'active').length,
            issues
        };
    }
}
```

### 5. Enhanced Monitoring and State Management

#### A. Partial Fill Dashboard

```typescript
// GET /api/transactions/partial-fills/:orderHash
interface PartialFillDashboard {
    orderSummary: {
        originalAmount: string;
        totalFilled: string;
        remainingAmount: string;
        fillPercentage: number;
    };
    
    activeFills: {
        partialIndex: number;
        amount: string;
        status: 'pending' | 'locked' | 'executing';
        ethEscrow: string;
        nearHTLC: string;
        estimatedCompletion: number;
    }[];
    
    completedFills: {
        partialIndex: number;
        amount: string;
        completedAt: number;
        ethTxHash: string;
        nearTxHash: string;
        secret: string;
    }[];
    
    coordinationMetrics: {
        totalGasUsed: string;
        coordinationFees: string;
        averageExecutionTime: number;
        successRate: number;
    };
}
```

## Economic Security Model

### Dynamic Safety Deposits

**Current Model:**
```solidity
uint256 safetyDeposit = fullOrderAmount * 5%; // Fixed 5% of full order
```

**Partial Fill Model:**
```solidity
function calculatePartialSafetyDeposit(
    bytes32 orderHash,
    uint256 partialAmount
) public view returns (uint256) {
    FusionPlusOrder memory order = orders[orderHash];
    
    // Base deposit for this partial amount
    uint256 baseDeposit = (partialAmount * MIN_SAFETY_DEPOSIT_BPS) / 10000;
    
    // Coordination overhead (additional cost for managing multiple partials)
    uint256 coordinationOverhead = calculateCoordinationOverhead(orderHash);
    
    // Risk multiplier based on number of active partial fills
    uint256 activePartials = partialFillStates[orderHash].activePartialFills;
    uint256 riskMultiplier = 10000 + (activePartials * 100); // +1% per active partial
    
    return (baseDeposit + coordinationOverhead) * riskMultiplier / 10000;
}
```

### Fee Structure

```typescript
interface PartialFillFees {
    // Standard fees (same as full order)
    gasFees: string;
    solverFee: string;
    
    // Additional partial fill fees
    coordinationFee: string;      // Cost of managing multiple atomic swaps
    htlcDeploymentFee: string;    // Cost of deploying additional HTLCs
    monitoringFee: string;        // Enhanced monitoring costs
    
    // Efficiency discount (encourage larger fills)
    fillSizeDiscount: string;     // Discount for larger partial fills
    
    total: string;
}
```

## Risk Assessment

### High-Risk Areas

1. **Atomic Coordination Failure**
   - Risk: Partial fills on one chain succeed while others fail
   - Mitigation: Enhanced monitoring, automatic refund mechanisms

2. **HTLC Management Complexity**
   - Risk: Multiple HTLCs with different timelocks create coordination windows
   - Mitigation: Standardized timelock calculations, automated cleanup

3. **State Synchronization**
   - Risk: Cross-chain state gets out of sync between partial fills
   - Mitigation: Event-driven state updates, regular reconciliation

4. **Economic Security**
   - Risk: Safety deposits insufficient for multiple concurrent partial fills
   - Mitigation: Dynamic deposit calculations, risk-based multipliers

### Medium-Risk Areas

1. **Gas Cost Optimization**
   - Challenge: Multiple smaller transactions vs. single large transaction
   - Solution: Dynamic gas optimization, batch execution where possible

2. **User Experience Complexity**
   - Challenge: Managing multiple partial fills can confuse users
   - Solution: Simplified UI, automated partial fill management

## Implementation Phases

### Phase 1: Smart Contract Foundation (3-4 weeks)
1. Modify `OneInchFusionPlusFactory` for partial fill support
2. Update `NearTakerInteraction` for partial processing
3. Implement partial safety deposit calculations
4. Add comprehensive partial fill testing

### Phase 2: Cross-Chain Coordination (4-5 weeks)
1. Implement multiple HTLC management
2. Build partial fill coordination service
3. Add cross-chain state synchronization
4. Develop partial secret management

### Phase 3: API Gateway Integration (2-3 weeks)
1. Add partial fill endpoints
2. Modify existing swap endpoints
3. Implement partial fill status tracking
4. Add partial fill dashboard

### Phase 4: Backend Services (2-3 weeks)
1. Enhance TEE solver for partial analysis
2. Update relayer service for partial execution
3. Add enhanced monitoring and alerting
4. Implement partial fill optimization

### Phase 5: Testing & Optimization (2-3 weeks)
1. Comprehensive partial fill testing
2. Cross-chain coordination testing
3. Economic security validation
4. Performance optimization
5. User acceptance testing

## Success Criteria

### Functional Requirements
- [ ] Support 1-10 concurrent partial fills per order
- [ ] Maintain atomic guarantees for each partial fill
- [ ] Cross-chain state consistency across all partials
- [ ] Automatic cleanup of failed partial fills
- [ ] Economic security maintained with dynamic deposits

### Performance Requirements
- [ ] Partial fill coordination overhead < 20% of full order cost
- [ ] Cross-chain partial fill completion time < 150% of full order time
- [ ] Support for 100+ concurrent partial fills across all orders
- [ ] 99.5% success rate for partial fill coordination

### Security Requirements
- [ ] No double-spending across partial fills
- [ ] Atomic guarantees maintained per partial fill
- [ ] Economic security proportional to partial amounts
- [ ] Secure cleanup of abandoned partial fills

## Dependencies

### External Dependencies
- 1inch Limit Order Protocol (v5+) - ✅ Already integrated
- NEAR Protocol Chain Signatures - ✅ Already integrated  
- Bitcoin HTLC capabilities - ✅ Already implemented

### Internal Dependencies
- Enhanced monitoring infrastructure
- Cross-chain state management service
- Partial fill coordination service
- Advanced economic security calculations

## Testing Strategy

### Unit Testing
- Smart contract partial fill logic
- Safety deposit calculations
- HTLC coordination functions
- State management functions

### Integration Testing
- Cross-chain partial fill flows
- Multiple concurrent partial fills
- Economic security validation
- Error recovery scenarios

### End-to-End Testing
- Full partial fill user journeys
- Cross-chain coordination testing
- Performance under load
- Economic security stress testing

## Documentation Requirements

- [ ] Smart contract documentation for partial fill functions
- [ ] API documentation for partial fill endpoints
- [ ] User guide for partial fill functionality
- [ ] Developer guide for partial fill integration
- [ ] Economic security model documentation
- [ ] Risk assessment and mitigation strategies

## Conclusion

Partial fills represent a **major architectural enhancement** that leverages the existing 1inch LOP infrastructure while adding sophisticated cross-chain coordination capabilities. The implementation requires careful planning and extensive testing but would position the Fusion+ extension as a **production-ready advanced trading protocol**.

**Recommended Timeline**: 8-12 weeks for full implementation  
**Priority**: Post-hackathon production feature  
**Risk Level**: High (due to cross-chain coordination complexity)

The current architecture provides a **solid foundation** for partial fills, with the 1inch LOP already handling the core partial fill mechanics. The primary challenge lies in extending atomic swap coordination to handle multiple concurrent partial fills across different blockchains.