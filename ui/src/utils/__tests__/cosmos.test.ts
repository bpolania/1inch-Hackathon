import {
  validateCosmosAddress,
  getChainFromCosmosAddress,
  isCosmosChain,
  getCosmosNativeDenom,
  formatCosmosAmount,
  toCosmosBaseUnits,
  getCosmosChainInfo,
  COSMOS_ADDRESS_PREFIXES,
  COSMOS_NATIVE_DENOMS,
  COSMOS_CHAIN_INFO,
} from '../cosmos'
import { ChainId } from '@/types/intent'

// Test data constants
const VALID_ADDRESSES = {
  neutron: 'neutron1abcdefghijklmnopqrstuvwxyz1234567890abcdef',
  juno: 'juno1abcdefghijklmnopqrstuvwxyz1234567890abcdef123',
  cosmos: 'cosmos1abcdefghijklmnopqrstuvwxyz1234567890abcdef',
  osmosis: 'osmo1abcdefghijklmnopqrstuvwxyz1234567890abcdef',
  stargaze: 'stars1abcdefghijklmnopqrstuvwxyz1234567890abcdef',
  akash: 'akash1abcdefghijklmnopqrstuvwxyz1234567890abcdef',
}

const INVALID_ADDRESSES = {
  tooShort: 'neutron1short',
  tooLong: 'neutron1' + 'a'.repeat(100),
  invalidCharacters: 'neutron1ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
  noSeparator: 'neutronabcdefghijklmnopqrstuvwxyz1234567890abcdef',
  wrongSeparator: 'neutron2abcdefghijklmnopqrstuvwxyz1234567890abcdef',
  invalidSpecialChars: 'neutron1!@#$%^&*()abcdefghijklmnopqrstuvwx',
  empty: '',
  onlyPrefix: 'neutron1',
}

describe('Cosmos Address Validation', () => {
  describe('validateCosmosAddress', () => {
    describe('Valid Addresses', () => {
      it('should validate correct addresses for all Cosmos chains', () => {
        Object.entries(VALID_ADDRESSES).forEach(([chain, address]) => {
          expect(validateCosmosAddress(address)).toBe(true)
        })
      })

      it('should validate addresses with expected chain constraint', () => {
        expect(validateCosmosAddress(VALID_ADDRESSES.neutron, 'neutron')).toBe(true)
        expect(validateCosmosAddress(VALID_ADDRESSES.juno, 'juno')).toBe(true)
        expect(validateCosmosAddress(VALID_ADDRESSES.cosmos, 'cosmos')).toBe(true)
      })

      it('should validate addresses of different lengths within range', () => {
        const shortValid = 'neutron1abcdefghijklmnopqrstuvwxyz123456789abc'
        const longValid = 'neutron1abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmn'
        
        expect(validateCosmosAddress(shortValid)).toBe(true)
        expect(validateCosmosAddress(longValid)).toBe(true)
      })

      it('should validate addresses with all valid bech32 characters', () => {
        const validChars = 'neutron1abcdefghijklmnopqrstuvwxyz0123456789abc'
        expect(validateCosmosAddress(validChars)).toBe(true)
      })
    })

    describe('Invalid Addresses', () => {
      it('should reject addresses that are too short', () => {
        expect(validateCosmosAddress(INVALID_ADDRESSES.tooShort)).toBe(false)
        expect(validateCosmosAddress('neutron1abc')).toBe(false)
        expect(validateCosmosAddress('juno1')).toBe(false)
      })

      it('should reject addresses that are too long', () => {
        expect(validateCosmosAddress(INVALID_ADDRESSES.tooLong)).toBe(false)
      })

      it('should reject addresses with invalid characters', () => {
        expect(validateCosmosAddress(INVALID_ADDRESSES.invalidCharacters)).toBe(false)
        expect(validateCosmosAddress(INVALID_ADDRESSES.invalidSpecialChars)).toBe(false)
      })

      it('should reject addresses without proper separator', () => {
        expect(validateCosmosAddress(INVALID_ADDRESSES.noSeparator)).toBe(false)
        expect(validateCosmosAddress(INVALID_ADDRESSES.wrongSeparator)).toBe(false)
      })

      it('should reject empty or null addresses', () => {
        expect(validateCosmosAddress('')).toBe(false)
        expect(validateCosmosAddress(null as any)).toBe(false)
        expect(validateCosmosAddress(undefined as any)).toBe(false)
      })

      it('should reject non-string inputs', () => {
        expect(validateCosmosAddress(123 as any)).toBe(false)
        expect(validateCosmosAddress({} as any)).toBe(false)
        expect(validateCosmosAddress([] as any)).toBe(false)
      })
    })

    describe('Chain-Specific Validation', () => {
      it('should accept address when prefix matches expected chain', () => {
        expect(validateCosmosAddress(VALID_ADDRESSES.neutron, 'neutron')).toBe(true)
        expect(validateCosmosAddress(VALID_ADDRESSES.juno, 'juno')).toBe(true)
        expect(validateCosmosAddress(VALID_ADDRESSES.cosmos, 'cosmos')).toBe(true)
      })

      it('should reject address when prefix does not match expected chain', () => {
        expect(validateCosmosAddress(VALID_ADDRESSES.neutron, 'juno')).toBe(false)
        expect(validateCosmosAddress(VALID_ADDRESSES.juno, 'cosmos')).toBe(false)
        expect(validateCosmosAddress(VALID_ADDRESSES.cosmos, 'neutron')).toBe(false)
      })

      it('should handle invalid expected chain gracefully', () => {
        expect(validateCosmosAddress(VALID_ADDRESSES.neutron, 'invalid' as ChainId)).toBe(true)
        expect(validateCosmosAddress(VALID_ADDRESSES.neutron, undefined)).toBe(true)
      })
    })
  })

  describe('getChainFromCosmosAddress', () => {
    it('should correctly identify chain from valid addresses', () => {
      expect(getChainFromCosmosAddress(VALID_ADDRESSES.neutron)).toBe('neutron')
      expect(getChainFromCosmosAddress(VALID_ADDRESSES.juno)).toBe('juno')
      expect(getChainFromCosmosAddress(VALID_ADDRESSES.cosmos)).toBe('cosmos')
      expect(getChainFromCosmosAddress(VALID_ADDRESSES.osmosis)).toBe('osmosis')
      expect(getChainFromCosmosAddress(VALID_ADDRESSES.stargaze)).toBe('stargaze')
      expect(getChainFromCosmosAddress(VALID_ADDRESSES.akash)).toBe('akash')
    })

    it('should return null for invalid addresses', () => {
      expect(getChainFromCosmosAddress('')).toBe(null)
      expect(getChainFromCosmosAddress('invalid')).toBe(null)
      expect(getChainFromCosmosAddress('noprefix123456789')).toBe(null)
      expect(getChainFromCosmosAddress(null as any)).toBe(null)
    })

    it('should return null for unknown prefixes', () => {
      expect(getChainFromCosmosAddress('unknown1abcdefghijklmnopqrstuvwxyz123456789')).toBe(null)
      expect(getChainFromCosmosAddress('terra1abcdefghijklmnopqrstuvwxyz123456789')).toBe(null)
    })

    it('should handle edge cases gracefully', () => {
      expect(getChainFromCosmosAddress('1')).toBe(null)
      expect(getChainFromCosmosAddress('neutron')).toBe(null) // no separator
      expect(getChainFromCosmosAddress('neutron1')).toBe('neutron') // minimal valid
    })
  })
})

describe('Cosmos Chain Utilities', () => {
  describe('isCosmosChain', () => {
    it('should identify all supported Cosmos chains correctly', () => {
      const cosmosChains: ChainId[] = ['neutron', 'juno', 'cosmos', 'osmosis', 'stargaze', 'akash']
      cosmosChains.forEach(chain => {
        expect(isCosmosChain(chain)).toBe(true)
      })
    })

    it('should reject non-Cosmos chains', () => {
      const nonCosmosChains: ChainId[] = ['ethereum', 'near', 'bitcoin']
      nonCosmosChains.forEach(chain => {
        expect(isCosmosChain(chain)).toBe(false)
      })
    })

    it('should handle invalid chains gracefully', () => {
      expect(isCosmosChain('invalid' as ChainId)).toBe(false)
      expect(isCosmosChain('' as ChainId)).toBe(false)
      expect(isCosmosChain(null as any)).toBe(false)
    })
  })

  describe('getCosmosNativeDenom', () => {
    it('should return correct native denominations', () => {
      expect(getCosmosNativeDenom('neutron')).toBe('untrn')
      expect(getCosmosNativeDenom('juno')).toBe('ujunox')
      expect(getCosmosNativeDenom('cosmos')).toBe('uatom')
      expect(getCosmosNativeDenom('osmosis')).toBe('uosmo')
      expect(getCosmosNativeDenom('stargaze')).toBe('ustars')
      expect(getCosmosNativeDenom('akash')).toBe('uakt')
    })

    it('should return null for non-Cosmos chains', () => {
      expect(getCosmosNativeDenom('ethereum')).toBe(null)
      expect(getCosmosNativeDenom('near')).toBe(null)
      expect(getCosmosNativeDenom('bitcoin')).toBe(null)
    })

    it('should return null for invalid chains', () => {
      expect(getCosmosNativeDenom('invalid' as ChainId)).toBe(null)
      expect(getCosmosNativeDenom('' as ChainId)).toBe(null)
    })
  })

  describe('getCosmosChainInfo', () => {
    it('should return complete chain information for valid chains', () => {
      const neutronInfo = getCosmosChainInfo('neutron')
      expect(neutronInfo).toEqual({
        chainId: 'neutron',
        name: 'Neutron Testnet',
        prefix: 'neutron',
        nativeDenom: 'untrn',
        nativeSymbol: 'NTRN',
        explorerUrl: 'https://neutron.celat.one/neutron-testnet',
        color: 'bg-purple-500',
      })

      const cosmosInfo = getCosmosChainInfo('cosmos')
      expect(cosmosInfo).toEqual({
        chainId: 'cosmos',
        name: 'Cosmos Hub',
        prefix: 'cosmos',
        nativeDenom: 'uatom',
        nativeSymbol: 'ATOM',
        explorerUrl: 'https://www.mintscan.io/cosmos',
        color: 'bg-indigo-500',
      })
    })

    it('should return null for non-Cosmos chains', () => {
      expect(getCosmosChainInfo('ethereum')).toBe(null)
      expect(getCosmosChainInfo('near')).toBe(null)
      expect(getCosmosChainInfo('bitcoin')).toBe(null)
    })

    it('should return null for invalid chains', () => {
      expect(getCosmosChainInfo('invalid' as ChainId)).toBe(null)
      expect(getCosmosChainInfo('' as ChainId)).toBe(null)
    })

    it('should have consistent data with other constants', () => {
      Object.keys(COSMOS_CHAIN_INFO).forEach(chainId => {
        const info = getCosmosChainInfo(chainId as ChainId)
        expect(info?.prefix).toBe(COSMOS_ADDRESS_PREFIXES[chainId])
        expect(info?.nativeDenom).toBe(COSMOS_NATIVE_DENOMS[chainId])
      })
    })
  })
})

describe('Cosmos Amount Formatting', () => {
  describe('formatCosmosAmount', () => {
    it('should format amounts with default 6 decimals', () => {
      expect(formatCosmosAmount('1000000')).toBe('1.000000')
      expect(formatCosmosAmount('500000')).toBe('0.500000')
      expect(formatCosmosAmount('1')).toBe('0.000001')
    })

    it('should format amounts with custom decimals', () => {
      expect(formatCosmosAmount('1000000', 4)).toBe('100.0000')
      expect(formatCosmosAmount('1000000', 8)).toBe('0.01000000')
      expect(formatCosmosAmount('1000000', 2)).toBe('10000.00')
    })

    it('should handle zero and very small amounts', () => {
      expect(formatCosmosAmount('0')).toBe('0.000000')
      expect(formatCosmosAmount('1', 6)).toBe('0.000001')
      expect(formatCosmosAmount('10', 6)).toBe('0.000010')
    })

    it('should handle large amounts', () => {
      expect(formatCosmosAmount('1000000000')).toBe('1000.000000')
      expect(formatCosmosAmount('123456789000')).toBe('123456.789000')
    })

    it('should handle invalid inputs gracefully', () => {
      expect(formatCosmosAmount('')).toBe('0')
      expect(formatCosmosAmount('invalid')).toBe('0')
      expect(formatCosmosAmount('NaN')).toBe('0')
    })

    it('should handle negative amounts', () => {
      expect(formatCosmosAmount('-1000000')).toBe('-1.000000')
      expect(formatCosmosAmount('-500000')).toBe('-0.500000')
    })

    it('should handle decimal string inputs', () => {
      expect(formatCosmosAmount('1.5')).toBe('0.000002') // 1.5 micro units
      expect(formatCosmosAmount('1000000.5')).toBe('1.000001')
    })
  })

  describe('toCosmosBaseUnits', () => {
    it('should convert human amounts to base units with default 6 decimals', () => {
      expect(toCosmosBaseUnits('1')).toBe('1000000')
      expect(toCosmosBaseUnits('0.5')).toBe('500000')
      expect(toCosmosBaseUnits('0.000001')).toBe('1')
    })

    it('should convert amounts with custom decimals', () => {
      expect(toCosmosBaseUnits('1', 4)).toBe('10000')
      expect(toCosmosBaseUnits('1', 8)).toBe('100000000')
      expect(toCosmosBaseUnits('1', 2)).toBe('100')
    })

    it('should handle zero amounts', () => {
      expect(toCosmosBaseUnits('0')).toBe('0')
      expect(toCosmosBaseUnits('0.0')).toBe('0')
    })

    it('should handle large amounts', () => {
      expect(toCosmosBaseUnits('1000')).toBe('1000000000')
      expect(toCosmosBaseUnits('123.456789')).toBe('123456789')
    })

    it('should handle invalid inputs gracefully', () => {
      expect(toCosmosBaseUnits('')).toBe('0')
      expect(toCosmosBaseUnits('invalid')).toBe('0')
      expect(toCosmosBaseUnits('NaN')).toBe('0')
    })

    it('should handle negative amounts', () => {
      expect(toCosmosBaseUnits('-1')).toBe('-1000000')
      expect(toCosmosBaseUnits('-0.5')).toBe('-500000')
    })

    it('should floor decimal results to integers', () => {
      expect(toCosmosBaseUnits('0.9999999')).toBe('999999') // floored
      expect(toCosmosBaseUnits('1.0000001')).toBe('1000000') // floored
    })

    it('should be inverse of formatCosmosAmount for round numbers', () => {
      const testAmounts = ['1', '10', '100', '0.1', '0.01']
      testAmounts.forEach(amount => {
        const baseUnits = toCosmosBaseUnits(amount)
        const formatted = formatCosmosAmount(baseUnits)
        expect(parseFloat(formatted)).toBeCloseTo(parseFloat(amount), 6)
      })
    })
  })
})

describe('Constants and Data Integrity', () => {
  describe('COSMOS_ADDRESS_PREFIXES', () => {
    it('should contain all expected Cosmos chains', () => {
      const expectedChains = ['neutron', 'juno', 'cosmos', 'osmosis', 'stargaze', 'akash']
      expectedChains.forEach(chain => {
        expect(COSMOS_ADDRESS_PREFIXES).toHaveProperty(chain)
        expect(typeof COSMOS_ADDRESS_PREFIXES[chain]).toBe('string')
        expect(COSMOS_ADDRESS_PREFIXES[chain].length).toBeGreaterThan(0)
      })
    })

    it('should have unique prefixes for each chain', () => {
      const prefixes = Object.values(COSMOS_ADDRESS_PREFIXES)
      const uniquePrefixes = new Set(prefixes)
      expect(uniquePrefixes.size).toBe(prefixes.length)
    })

    it('should have valid bech32 prefixes (lowercase, no special chars)', () => {
      Object.values(COSMOS_ADDRESS_PREFIXES).forEach(prefix => {
        expect(prefix).toMatch(/^[a-z]+$/)
        expect(prefix.length).toBeGreaterThan(2)
        expect(prefix.length).toBeLessThan(10)
      })
    })
  })

  describe('COSMOS_NATIVE_DENOMS', () => {
    it('should contain denominations for all chains', () => {
      Object.keys(COSMOS_ADDRESS_PREFIXES).forEach(chain => {
        expect(COSMOS_NATIVE_DENOMS).toHaveProperty(chain)
        expect(typeof COSMOS_NATIVE_DENOMS[chain]).toBe('string')
      })
    })

    it('should have valid denomination format (starts with u)', () => {
      Object.values(COSMOS_NATIVE_DENOMS).forEach(denom => {
        expect(denom).toMatch(/^u[a-z]+$/)
        expect(denom.length).toBeGreaterThan(3)
        expect(denom.length).toBeLessThan(10)
      })
    })

    it('should have unique denominations', () => {
      const denoms = Object.values(COSMOS_NATIVE_DENOMS)
      const uniqueDenoms = new Set(denoms)
      expect(uniqueDenoms.size).toBe(denoms.length)
    })
  })

  describe('COSMOS_CHAIN_INFO', () => {
    it('should have complete information for all chains', () => {
      Object.entries(COSMOS_CHAIN_INFO).forEach(([chainId, info]) => {
        expect(info).toHaveProperty('chainId', chainId)
        expect(info).toHaveProperty('name')
        expect(info).toHaveProperty('prefix')
        expect(info).toHaveProperty('nativeDenom')
        expect(info).toHaveProperty('nativeSymbol')
        expect(info).toHaveProperty('color')
        
        expect(typeof info.name).toBe('string')
        expect(info.name.length).toBeGreaterThan(0)
        expect(typeof info.prefix).toBe('string')
        expect(typeof info.nativeDenom).toBe('string')
        expect(typeof info.nativeSymbol).toBe('string')
        expect(typeof info.color).toBe('string')
      })
    })

    it('should have consistent data across constants', () => {
      Object.entries(COSMOS_CHAIN_INFO).forEach(([chainId, info]) => {
        expect(info.prefix).toBe(COSMOS_ADDRESS_PREFIXES[chainId])
        expect(info.nativeDenom).toBe(COSMOS_NATIVE_DENOMS[chainId])
      })
    })

    it('should have valid explorer URLs when present', () => {
      Object.values(COSMOS_CHAIN_INFO).forEach(info => {
        if (info.explorerUrl) {
          expect(info.explorerUrl).toMatch(/^https?:\/\//)
        }
      })
    })

    it('should have valid CSS color classes', () => {
      Object.values(COSMOS_CHAIN_INFO).forEach(info => {
        expect(info.color).toMatch(/^bg-[a-z]+-\d+$/)
      })
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  describe('Extreme Inputs', () => {
    it('should handle very long strings gracefully', () => {
      const veryLongString = 'a'.repeat(10000)
      expect(() => validateCosmosAddress(veryLongString)).not.toThrow()
      expect(validateCosmosAddress(veryLongString)).toBe(false)
    })

    it('should handle special Unicode characters', () => {
      const unicodeAddress = 'neutron1ñáéíóú🚀💫⭐'
      expect(() => validateCosmosAddress(unicodeAddress)).not.toThrow()
      expect(validateCosmosAddress(unicodeAddress)).toBe(false)
    })

    it('should handle extremely large numbers in formatting', () => {
      expect(() => formatCosmosAmount('999999999999999999999999')).not.toThrow()
      expect(() => toCosmosBaseUnits('999999999999999999999999')).not.toThrow()
    })

    it('should handle floating point precision issues', () => {
      const precisionTest = '0.123456789123456789'
      expect(() => toCosmosBaseUnits(precisionTest)).not.toThrow()
      expect(() => formatCosmosAmount(toCosmosBaseUnits(precisionTest))).not.toThrow()
    })
  })

  describe('Type Safety', () => {
    it('should handle null and undefined inputs safely', () => {
      expect(() => validateCosmosAddress(null as any)).not.toThrow()
      expect(() => getChainFromCosmosAddress(undefined as any)).not.toThrow()
      expect(() => formatCosmosAmount(null as any)).not.toThrow()
      expect(() => toCosmosBaseUnits(undefined as any)).not.toThrow()
    })

    it('should handle object inputs safely', () => {
      const objectInput = { address: 'test' } as any
      expect(() => validateCosmosAddress(objectInput)).not.toThrow()
      expect(validateCosmosAddress(objectInput)).toBe(false)
    })

    it('should handle array inputs safely', () => {
      const arrayInput = ['neutron1test'] as any
      expect(() => validateCosmosAddress(arrayInput)).not.toThrow()
      expect(validateCosmosAddress(arrayInput)).toBe(false)
    })
  })

  describe('Performance', () => {
    it('should validate addresses efficiently', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        validateCosmosAddress(VALID_ADDRESSES.neutron)
      }
      const end = Date.now()
      expect(end - start).toBeLessThan(100) // Should complete in under 100ms
    })

    it('should handle large batches of address detection', () => {
      const addresses = Object.values(VALID_ADDRESSES)
      const start = Date.now()
      addresses.forEach(addr => getChainFromCosmosAddress(addr))
      const end = Date.now()
      expect(end - start).toBeLessThan(50) // Should be very fast
    })
  })
})