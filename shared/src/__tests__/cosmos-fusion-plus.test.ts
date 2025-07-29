import {
  // Chain constants
  NEUTRON_TESTNET,
  JUNO_TESTNET,
  COSMOS_HUB_MAINNET,
  COSMOS_HUB_TESTNET,
  OSMOSIS_MAINNET,
  OSMOSIS_TESTNET,
  STARGAZE_MAINNET,
  STARGAZE_TESTNET,
  AKASH_MAINNET,
  AKASH_TESTNET,
  ChainId,
  CHAIN_INFO,
  
  // Cosmos utility functions
  isCosmosChain,
  isCosmosDestination,
  getCosmosNativeDenom,
  getCosmosAddressPrefix,
  getCosmosChainInfo,
  validateCosmosAddress,
  toMicroCosmos,
  fromMicroCosmos,
  createCosmosExecutionParams,
  createFusionPlusCosmosIntent,
  encodeCosmosExecutionParams
} from '../utils/fusion-plus';

describe('Cosmos Chain Support', () => {
  
  describe('Chain Constants', () => {
    test('exports correct Cosmos chain IDs', () => {
      expect(NEUTRON_TESTNET).toBe(7001);
      expect(JUNO_TESTNET).toBe(7002);
      expect(COSMOS_HUB_MAINNET).toBe(30001);
      expect(COSMOS_HUB_TESTNET).toBe(30002);
      expect(OSMOSIS_MAINNET).toBe(30003);
      expect(OSMOSIS_TESTNET).toBe(30004);
      expect(STARGAZE_MAINNET).toBe(30005);
      expect(STARGAZE_TESTNET).toBe(30006);
      expect(AKASH_MAINNET).toBe(30007);
      expect(AKASH_TESTNET).toBe(30008);
    });

    test('Cosmos chains exist in CHAIN_INFO', () => {
      expect(CHAIN_INFO[NEUTRON_TESTNET]).toBeDefined();
      expect(CHAIN_INFO[JUNO_TESTNET]).toBeDefined();
      expect(CHAIN_INFO[COSMOS_HUB_MAINNET]).toBeDefined();
      
      // Check chain info structure
      const neutronInfo = CHAIN_INFO[NEUTRON_TESTNET];
      expect(neutronInfo.name).toContain('Neutron');
      expect(neutronInfo.nativeCurrency.symbol).toBe('NTRN');
      expect(neutronInfo.nativeCurrency.decimals).toBe(6);
    });
  });

  describe('Chain Detection Functions', () => {
    test('isCosmosChain correctly identifies Cosmos chains', () => {
      // Primary Cosmos chains
      expect(isCosmosChain(NEUTRON_TESTNET)).toBe(true);
      expect(isCosmosChain(JUNO_TESTNET)).toBe(true);
      
      // Future Cosmos chains
      expect(isCosmosChain(COSMOS_HUB_MAINNET)).toBe(true);
      expect(isCosmosChain(OSMOSIS_MAINNET)).toBe(true);
      expect(isCosmosChain(STARGAZE_MAINNET)).toBe(true);
      expect(isCosmosChain(AKASH_MAINNET)).toBe(true);
      
      // Non-Cosmos chains
      expect(isCosmosChain(1)).toBe(false); // Ethereum
      expect(isCosmosChain(137)).toBe(false); // Polygon
      expect(isCosmosChain(40001)).toBe(false); // NEAR
    });

    test('isCosmosDestination works correctly', () => {
      expect(isCosmosDestination(NEUTRON_TESTNET)).toBe(true);
      expect(isCosmosDestination(JUNO_TESTNET)).toBe(true);
      expect(isCosmosDestination(1)).toBe(false);
    });
  });

  describe('Native Denomination Functions', () => {
    test('getCosmosNativeDenom returns correct denominations', () => {
      expect(getCosmosNativeDenom(NEUTRON_TESTNET)).toBe('untrn');
      expect(getCosmosNativeDenom(JUNO_TESTNET)).toBe('ujuno');
      expect(getCosmosNativeDenom(COSMOS_HUB_MAINNET)).toBe('uatom');
      expect(getCosmosNativeDenom(COSMOS_HUB_TESTNET)).toBe('uatom');
      expect(getCosmosNativeDenom(OSMOSIS_MAINNET)).toBe('uosmo');
      expect(getCosmosNativeDenom(OSMOSIS_TESTNET)).toBe('uosmo');
      expect(getCosmosNativeDenom(STARGAZE_MAINNET)).toBe('ustars');
      expect(getCosmosNativeDenom(STARGAZE_TESTNET)).toBe('ustars');
      expect(getCosmosNativeDenom(AKASH_MAINNET)).toBe('uakt');
      expect(getCosmosNativeDenom(AKASH_TESTNET)).toBe('uakt');
      
      // Default case
      expect(getCosmosNativeDenom(99999 as any)).toBe('uatom');
    });

    test('getCosmosAddressPrefix returns correct prefixes', () => {
      expect(getCosmosAddressPrefix(NEUTRON_TESTNET)).toBe('neutron');
      expect(getCosmosAddressPrefix(JUNO_TESTNET)).toBe('juno');
      expect(getCosmosAddressPrefix(COSMOS_HUB_MAINNET)).toBe('cosmos');
      expect(getCosmosAddressPrefix(OSMOSIS_MAINNET)).toBe('osmo');
      expect(getCosmosAddressPrefix(STARGAZE_MAINNET)).toBe('stars');
      expect(getCosmosAddressPrefix(AKASH_MAINNET)).toBe('akash');
      
      // Default case
      expect(getCosmosAddressPrefix(99999 as any)).toBe('cosmos');
    });
  });

  describe('Address Validation', () => {
    test('validateCosmosAddress validates correct bech32 addresses', () => {
      // Valid Neutron addresses
      expect(validateCosmosAddress('neutron1abc123def456ghi789jkl012mno345pqr678stu901vwx234yz')).toBe(true);
      expect(validateCosmosAddress('neutron1test123456789abcdefghijklmnopqrstuvwxyz123456789')).toBe(true);
      
      // Valid Juno addresses
      expect(validateCosmosAddress('juno1abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567')).toBe(true);
      
      // Valid Cosmos Hub addresses
      expect(validateCosmosAddress('cosmos1abc123def456ghi789jkl012mno345pqr678stu901vwx234yz')).toBe(true);
    });

    test('validateCosmosAddress rejects invalid addresses', () => {
      // Too short
      expect(validateCosmosAddress('neutron1abc')).toBe(false);
      
      // Too long
      expect(validateCosmosAddress('neutron1' + 'a'.repeat(60))).toBe(false);
      
      // Invalid characters
      expect(validateCosmosAddress('neutron1ABC123def456')).toBe(false); // uppercase
      expect(validateCosmosAddress('neutron1abc!@#def456')).toBe(false); // special chars
      
      // Wrong format
      expect(validateCosmosAddress('0x1234567890123456789012345678901234567890')).toBe(false); // Ethereum
      expect(validateCosmosAddress('invalid-address')).toBe(false);
      expect(validateCosmosAddress('')).toBe(false);
      
      // No separator '1'
      expect(validateCosmosAddress('neutronabcdefghijklmnopqrstuvwxyz123456789012')).toBe(false);
    });

    test('validateCosmosAddress with expected prefix', () => {
      const neutronAddr = 'neutron1abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
      
      expect(validateCosmosAddress(neutronAddr, 'neutron')).toBe(true);
      expect(validateCosmosAddress(neutronAddr, 'juno')).toBe(false);
      expect(validateCosmosAddress(neutronAddr, 'cosmos')).toBe(false);
    });
  });

  describe('Amount Conversion Functions', () => {
    test('toMicroCosmos converts amounts correctly', () => {
      expect(toMicroCosmos('1')).toBe('1000000');
      expect(toMicroCosmos('1.5')).toBe('1500000');
      expect(toMicroCosmos('0.000001')).toBe('1');
      expect(toMicroCosmos('10.123456')).toBe('10123456');
      
      // Test different decimal places
      expect(toMicroCosmos('1', 8)).toBe('100000000'); // 8 decimals like Bitcoin
      expect(toMicroCosmos('1', 18)).toBe('1000000000000000000'); // 18 decimals like Ethereum
    });

    test('fromMicroCosmos converts back correctly', () => {
      expect(fromMicroCosmos('1000000')).toBe('1');
      expect(fromMicroCosmos('1500000')).toBe('1');
      expect(fromMicroCosmos('1')).toBe('0');
      expect(fromMicroCosmos('10123456')).toBe('10');
      
      // Test different decimal places
      expect(fromMicroCosmos('100000000', 8)).toBe('1');
      expect(fromMicroCosmos('1000000000000000000', 18)).toBe('1');
    });

    test('round trip conversion maintains precision', () => {
      const amounts = ['1', '10.5', '0.000001', '999.999999'];
      
      amounts.forEach(amount => {
        const micro = toMicroCosmos(amount);
        const back = fromMicroCosmos(micro);
        expect(back).toBe(Math.floor(parseFloat(amount)).toString());
      });
    });
  });

  describe('Cosmos Execution Parameters', () => {
    test('createCosmosExecutionParams creates correct structure', () => {
      const mockIntent = {
        destinationChain: NEUTRON_TESTNET,
        oneInchOrderHash: '0x123456789abcdef',
        destinationAddress: 'neutron1test123456789abcdefghijklmnopqrstuvwxyz123456789',
        destinationAmount: '1000000',
        resolverFeeAmount: '50000',
        timelocks: '123456789'
      };

      const params = createCosmosExecutionParams(
        'neutron1contract123456789abcdefghijklmnopqrstuvwxyz12345',
        mockIntent as any,
        'hashlock123456789abcdef'
      );

      expect(params.contractAddress).toBe('neutron1contract123456789abcdefghijklmnopqrstuvwxyz12345');
      expect(params.msg.execute_fusion_order).toBeDefined();
      expect(params.msg.execute_fusion_order.order_hash).toBe('0x123456789abcdef');
      expect(params.msg.execute_fusion_order.hashlock).toBe('hashlock123456789abcdef');
      expect(params.funds).toHaveLength(1);
      expect(params.funds[0].denom).toBe('untrn');
      expect(params.funds[0].amount).toBe('1000000');
      expect(params.gasLimit).toBe(300000);
    });
  });

  describe('Fusion+ Cosmos Intent Creation', () => {
    test('createFusionPlusCosmosIntent creates correct intent structure', () => {
      const params = {
        sourceChainId: 11155111, // Ethereum Sepolia
        destinationChainId: NEUTRON_TESTNET,
        maker: '0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f',
        amount: '25000000', // 25 NTRN in micro units
        cosmosParams: {
          contractAddress: 'neutron1contract123456789abcdefghijklmnopqrstuvwxyz12345',
          amount: '25000000',
          nativeDenom: 'untrn',
          gasLimit: 300000,
          destinationAddress: 'neutron1test123456789abcdefghijklmnopqrstuvwxyz123456789'
        }
      };

      const intent = createFusionPlusCosmosIntent(params);

      expect(intent.sourceChainId).toBe(11155111);
      expect(intent.destinationChainId).toBe(NEUTRON_TESTNET);
      expect(intent.maker).toBe('0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f');
      expect(intent.amount).toBe('25000000');
      expect(intent.cosmosParams).toEqual(params.cosmosParams);
      expect(intent.hashlock).toMatch(/^0x[a-f0-9]{64}$/); // 66-char hex with 0x prefix
      expect(intent.orderHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(intent.timeout).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(intent.timelocks).toBeDefined();
    });

    test('createFusionPlusCosmosIntent rejects non-Cosmos destination', () => {
      const params = {
        sourceChainId: 11155111,
        destinationChainId: 1, // Ethereum mainnet - not Cosmos
        maker: '0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f',
        amount: '1000000',
        cosmosParams: {
          contractAddress: 'invalid',
          amount: '1000000',
          nativeDenom: 'invalid',
          gasLimit: 300000
        }
      };

      expect(() => createFusionPlusCosmosIntent(params)).toThrow('Destination chain must be Cosmos');
    });
  });

  describe('Parameter Encoding', () => {
    test('encodeCosmosExecutionParams encodes parameters correctly', () => {
      const params = {
        contractAddress: 'neutron1contract123456789abcdefghijklmnopqrstuvwxyz12345',
        amount: '1000000',
        nativeDenom: 'untrn',
        gasLimit: 300000
      };

      const encoded = encodeCosmosExecutionParams(params);
      
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
      
      // Should be valid hex string
      expect(encoded).toMatch(/^[a-f0-9]+$/);
      
      // Should be decodable
      const decoded = JSON.parse(Buffer.from(encoded, 'hex').toString());
      expect(decoded.contractAddress).toBe(params.contractAddress);
      expect(decoded.gasLimit).toBe(params.gasLimit);
    });
  });

  describe('Chain Info Integration', () => {
    test('getCosmosChainInfo returns correct chain info', () => {
      const neutronInfo = getCosmosChainInfo(NEUTRON_TESTNET);
      
      expect(neutronInfo.id).toBe(NEUTRON_TESTNET);
      expect(neutronInfo.name).toContain('Neutron');
      expect(neutronInfo.nativeCurrency.symbol).toBe('NTRN');
      expect(neutronInfo.nativeCurrency.decimals).toBe(6);
      expect(neutronInfo.rpcUrl).toBeDefined();
    });

    test('getCosmosChainInfo throws for non-Cosmos chains', () => {
      expect(() => getCosmosChainInfo(1)).toThrow('Chain is not Cosmos');
      expect(() => getCosmosChainInfo(40001)).toThrow('Chain is not Cosmos');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles empty and invalid inputs gracefully', () => {
      expect(validateCosmosAddress('')).toBe(false);
      expect(() => toMicroCosmos('')).not.toThrow();
      expect(() => fromMicroCosmos('')).not.toThrow();
    });

    test('handles very large numbers', () => {
      const largeAmount = '999999999999999999';
      const microAmount = toMicroCosmos(largeAmount);
      expect(microAmount).toBeDefined();
      expect(typeof microAmount).toBe('string');
    });

    test('validates all chain ranges correctly', () => {
      // Test boundary values
      expect(isCosmosChain(30000)).toBe(false); // Just below range
      expect(isCosmosChain(30001)).toBe(true);  // Start of range
      expect(isCosmosChain(30008)).toBe(true);  // End of range
      expect(isCosmosChain(30009)).toBe(false); // Just above range
    });
  });
});