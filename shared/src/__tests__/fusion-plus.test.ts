import {
  toFusionPlusIntent,
  generateOrderHash,
  calculateSafetyDeposit,
  getDefaultTimelockStages,
  packTimelocks,
  unpackTimelocks,
  createSrcImmutables,
  createDstImmutables,
  validateTimelockStages,
  TimelockStage
} from '../utils/fusion-plus';
import { EXAMPLE_INTENTS } from '../examples/intent-examples';
import { ChainId } from '../types/chains';
import { generatePreimage, generateHashlock } from '../utils/intent';

describe('1inch Fusion+ Integration', () => {
  test('generateOrderHash creates deterministic hash', () => {
    const intent = EXAMPLE_INTENTS.ethToBtc();
    
    const hash1 = generateOrderHash(intent);
    const hash2 = generateOrderHash(intent);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
  });

  test('calculateSafetyDeposit calculates correct percentage', () => {
    const sourceAmount = '1000000000000000000'; // 1 ETH
    
    // Default 5% (500 bps)
    const defaultDeposit = calculateSafetyDeposit(sourceAmount);
    expect(defaultDeposit).toBe('50000000000000000'); // 0.05 ETH
    
    // Custom 10% (1000 bps)
    const customDeposit = calculateSafetyDeposit(sourceAmount, 1000);
    expect(customDeposit).toBe('100000000000000000'); // 0.1 ETH
  });

  test('packTimelocks and unpackTimelocks work correctly', () => {
    const stages = [1000, 2000, 3000, 4000, 5000, 6000, 7000];
    
    const packed = packTimelocks(stages);
    const unpacked = unpackTimelocks(packed);
    
    expect(unpacked).toEqual(stages);
  });

  test('packTimelocks validates input length', () => {
    expect(() => packTimelocks([1, 2, 3])).toThrow('Must provide exactly 7 timelock stages');
  });

  test('getDefaultTimelockStages creates valid stages', () => {
    const stages = getDefaultTimelockStages();
    
    expect(stages).toHaveLength(7);
    expect(validateTimelockStages(stages)).toBe(true);
    
    // All stages should be in the future
    const now = Math.floor(Date.now() / 1000);
    stages.forEach(stage => {
      expect(stage).toBeGreaterThan(now);
    });
  });

  test('validateTimelockStages validates ordering', () => {
    const validStages = getDefaultTimelockStages();
    expect(validateTimelockStages(validStages)).toBe(true);
    
    // Test invalid ordering
    const invalidStages = [...validStages];
    invalidStages[TimelockStage.SrcWithdrawal] = invalidStages[TimelockStage.SrcPublicWithdrawal] + 1;
    expect(validateTimelockStages(invalidStages)).toBe(false);
    
    // Test past timestamps
    const pastStages = [100, 200, 300, 400, 500, 600, 700];
    expect(validateTimelockStages(pastStages)).toBe(false);
  });

  test('toFusionPlusIntent extends SwapIntent correctly', () => {
    const baseIntent = EXAMPLE_INTENTS.ethToBtc();
    const orderHash = generateOrderHash(baseIntent);
    const safetyDeposit = calculateSafetyDeposit(baseIntent.sourceAmount);
    const timelockStages = getDefaultTimelockStages();
    
    const fusionIntent = toFusionPlusIntent(baseIntent, orderHash, safetyDeposit, timelockStages);
    
    // Should include all base intent fields
    expect(fusionIntent.intentId).toBe(baseIntent.intentId);
    expect(fusionIntent.maker).toBe(baseIntent.maker);
    expect(fusionIntent.sourceAmount).toBe(baseIntent.sourceAmount);
    
    // Should include Fusion+ specific fields
    expect(fusionIntent.oneInchOrderHash).toBe(orderHash);
    expect(fusionIntent.safetyDeposit).toBe(safetyDeposit);
    expect(fusionIntent.timelocks).toBe(packTimelocks(timelockStages));
  });

  test('createSrcImmutables creates correct structure', () => {
    const fusionIntent = EXAMPLE_INTENTS.fusionPlusEthToApt();
    const hashlock = generateHashlock(generatePreimage());
    const taker = '0x1111111111111111111111111111111111111111';
    
    const srcImmutables = createSrcImmutables(fusionIntent, hashlock, taker);
    
    expect(srcImmutables.orderHash).toBe(fusionIntent.oneInchOrderHash);
    expect(srcImmutables.hashlock).toBe(hashlock);
    expect(srcImmutables.maker).toBe(fusionIntent.maker);
    expect(srcImmutables.taker).toBe(taker);
    expect(srcImmutables.amount).toBe(fusionIntent.sourceAmount);
    expect(srcImmutables.safetyDeposit).toBe(fusionIntent.safetyDeposit);
    expect(srcImmutables.timelocks).toBe(fusionIntent.timelocks);
  });

  test('createDstImmutables creates correct structure', () => {
    const fusionIntent = EXAMPLE_INTENTS.fusionPlusEthToApt();
    const hashlock = generateHashlock(generatePreimage());
    const taker = '0x1111111111111111111111111111111111111111';
    const destinationAmount = fusionIntent.destinationAmount;
    
    const dstImmutables = createDstImmutables(fusionIntent, hashlock, taker, destinationAmount);
    
    expect(dstImmutables.orderHash).toBe(fusionIntent.oneInchOrderHash);
    expect(dstImmutables.hashlock).toBe(hashlock);
    expect(dstImmutables.maker).toBe(fusionIntent.destinationAddress); // Receives tokens
    expect(dstImmutables.taker).toBe(taker);
    expect(dstImmutables.amount).toBe(destinationAmount);
    expect(dstImmutables.safetyDeposit).toBe(fusionIntent.safetyDeposit);
  });

  test('handles native token formatting for different chains', () => {
    const fusionIntent = EXAMPLE_INTENTS.fusionPlusEthToApt();
    const hashlock = generateHashlock(generatePreimage());
    const taker = '0x1111111111111111111111111111111111111111';
    
    // Test Aptos native token
    const dstImmutables = createDstImmutables(fusionIntent, hashlock, taker, fusionIntent.destinationAmount);
    expect(dstImmutables.token).toBe('0x1::aptos_coin::AptosCoin');
    
    // Test Ethereum native token (should convert to zero address)
    const srcImmutables = createSrcImmutables(fusionIntent, hashlock, taker);
    expect(srcImmutables.token).toBe('0x0000000000000000000000000000000000000000');
  });

  test('FusionPlusIntent example works correctly', () => {
    const fusionIntent = EXAMPLE_INTENTS.fusionPlusEthToApt();
    
    expect(fusionIntent.sourceChain).toBe(ChainId.ETHEREUM_MAINNET);
    expect(fusionIntent.destinationChain).toBe(ChainId.APTOS_MAINNET);
    expect(fusionIntent.oneInchOrderHash).toBeTruthy();
    expect(fusionIntent.safetyDeposit).toBeTruthy();
    expect(fusionIntent.timelocks).toBeTruthy();
    
    // Should be valid timelock stages
    const unpackedStages = unpackTimelocks(fusionIntent.timelocks);
    expect(validateTimelockStages(unpackedStages)).toBe(true);
  });

  test('timelock stage constants are correct', () => {
    expect(TimelockStage.SrcWithdrawal).toBe(0);
    expect(TimelockStage.SrcPublicWithdrawal).toBe(1);
    expect(TimelockStage.SrcCancellation).toBe(2);
    expect(TimelockStage.SrcPublicCancellation).toBe(3);
    expect(TimelockStage.DstWithdrawal).toBe(4);
    expect(TimelockStage.DstPublicWithdrawal).toBe(5);
    expect(TimelockStage.DstCancellation).toBe(6);
  });

  test('large timelock values pack/unpack correctly', () => {
    const maxU32 = 0xFFFFFFFF;
    const stages = [maxU32, maxU32 - 1, maxU32 - 2, maxU32 - 3, maxU32 - 4, maxU32 - 5, maxU32 - 6];
    
    const packed = packTimelocks(stages);
    const unpacked = unpackTimelocks(packed);
    
    expect(unpacked).toEqual(stages);
  });
});