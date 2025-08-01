import {
  formatTokenAmount,
  formatUSDAmount,
  formatDuration,
  formatPercentage,
  truncateAddress,
  generateId,
  calculateSlippage,
  isValidNearAccountId,
  isValidEthereumAddress,
  isValidBitcoinAddress,
} from '../utils'

describe('Formatting Functions', () => {
  describe('formatTokenAmount', () => {
    it('should format small amounts correctly', () => {
      expect(formatTokenAmount('0')).toBe('0')
      expect(formatTokenAmount('0.000001')).toBe('0.000001')
      expect(formatTokenAmount('0.0000001')).toBe('< 0.000001')
    })

    it('should format regular amounts correctly', () => {
      expect(formatTokenAmount('1.23456')).toBe('1.23456')
      expect(formatTokenAmount('10.5')).toBe('10.5')
      expect(formatTokenAmount('100')).toBe('100')
    })

    it('should format large amounts with suffixes', () => {
      expect(formatTokenAmount('1500')).toBe('1.50K')
      expect(formatTokenAmount('1500000')).toBe('1.50M')
      expect(formatTokenAmount('2340000')).toBe('2.34M')
    })

    it('should handle numeric input', () => {
      expect(formatTokenAmount(1.23456)).toBe('1.23456')
      expect(formatTokenAmount(1500)).toBe('1.50K')
    })

    it('should respect custom decimal places', () => {
      expect(formatTokenAmount('1.23456', 2)).toBe('1.23')
      expect(formatTokenAmount('1.23456', 8)).toBe('1.23456')
    })
  })

  describe('formatUSDAmount', () => {
    it('should format small USD amounts', () => {
      expect(formatUSDAmount('0')).toBe('$0')
      expect(formatUSDAmount('0.005')).toBe('< $0.01')
      expect(formatUSDAmount('0.01')).toBe('$0.01')
    })

    it('should format regular USD amounts', () => {
      expect(formatUSDAmount('1.50')).toBe('$1.50')
      expect(formatUSDAmount('100.99')).toBe('$100.99')
      expect(formatUSDAmount('1234.56')).toBe('$1.23K')
    })

    it('should format large amounts with suffixes', () => {
      expect(formatUSDAmount('1500000')).toBe('$1.50M')
      expect(formatUSDAmount('2340000000')).toBe('$2.34B')
    })

    it('should handle numeric input', () => {
      expect(formatUSDAmount(1234.56)).toBe('$1.23K')
      expect(formatUSDAmount(0.005)).toBe('< $0.01')
    })
  })

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(30)).toBe('30s')
      expect(formatDuration(59)).toBe('59s')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(60)).toBe('1m 0s')
      expect(formatDuration(90)).toBe('1m 30s')
      expect(formatDuration(3599)).toBe('59m 59s')
    })

    it('should format hours and minutes', () => {
      expect(formatDuration(3600)).toBe('1h 0m')
      expect(formatDuration(3665)).toBe('1h 1m')
      expect(formatDuration(7200)).toBe('2h 0m')
    })
  })

  describe('formatPercentage', () => {
    it('should format percentages with default decimals', () => {
      expect(formatPercentage(5.5)).toBe('5.50%')
      expect(formatPercentage(0.123)).toBe('0.12%')
      expect(formatPercentage(100)).toBe('100.00%')
    })

    it('should respect custom decimal places', () => {
      expect(formatPercentage(5.555, 1)).toBe('5.6%')
      expect(formatPercentage(5.555, 3)).toBe('5.555%')
      expect(formatPercentage(5.555, 0)).toBe('6%')
    })
  })

  describe('truncateAddress', () => {
    const longAddress = '0x1234567890abcdef1234567890abcdef12345678'

    it('should truncate long addresses', () => {
      expect(truncateAddress(longAddress)).toBe('0x1234...5678')
    })

    it('should not truncate short addresses', () => {
      const shortAddress = '0x1234'
      expect(truncateAddress(shortAddress)).toBe('0x1234')
    })

    it('should respect custom start and end character counts', () => {
      expect(truncateAddress(longAddress, 8, 6)).toBe('0x123456...345678')
      expect(truncateAddress(longAddress, 4, 2)).toBe('0x12...78')
    })
  })
})

describe('Utility Functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      
      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id1).not.toBe(id2)
      expect(typeof id1).toBe('string')
      expect(id1.length).toBeGreaterThan(5)
    })
  })

  describe('calculateSlippage', () => {
    it('should calculate positive slippage correctly', () => {
      expect(calculateSlippage(100, 95)).toBe(5) // 5% slippage
      expect(calculateSlippage(1000, 990)).toBe(1) // 1% slippage
    })

    it('should calculate negative slippage (better than expected)', () => {
      expect(calculateSlippage(100, 105)).toBe(-5) // -5% (bonus)
      expect(calculateSlippage(1000, 1010)).toBe(-1) // -1% (bonus)
    })

    it('should handle zero expected amount', () => {
      expect(calculateSlippage(0, 100)).toBe(0)
    })

    it('should handle equal amounts (no slippage)', () => {
      expect(calculateSlippage(100, 100)).toBe(0)
    })
  })
})

describe('Validation Functions', () => {
  describe('isValidNearAccountId', () => {
    it('should validate correct NEAR account IDs', () => {
      expect(isValidNearAccountId('alice.near')).toBe(true)
      expect(isValidNearAccountId('bob.testnet')).toBe(true)
      expect(isValidNearAccountId('user123')).toBe(true)
      expect(isValidNearAccountId('valid-account.near')).toBe(true)
      expect(isValidNearAccountId('valid_account.near')).toBe(true)
    })

    it('should reject invalid NEAR account IDs', () => {
      expect(isValidNearAccountId('')).toBe(false)
      expect(isValidNearAccountId('a')).toBe(false) // too short
      expect(isValidNearAccountId('A')).toBe(false) // uppercase
      expect(isValidNearAccountId('user@near')).toBe(false) // invalid character
      expect(isValidNearAccountId('user space.near')).toBe(false) // space
      expect(isValidNearAccountId('a'.repeat(65))).toBe(false) // too long
    })
  })

  describe('isValidEthereumAddress', () => {
    it('should validate correct Ethereum addresses', () => {
      expect(isValidEthereumAddress('0x0000000000000000000000000000000000000000')).toBe(true)
      expect(isValidEthereumAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true)
      expect(isValidEthereumAddress('0xabcdefABCDEF1234567890abcdef1234567890ab')).toBe(true)
    })

    it('should reject invalid Ethereum addresses', () => {
      expect(isValidEthereumAddress('')).toBe(false)
      expect(isValidEthereumAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false) // no 0x
      expect(isValidEthereumAddress('0x123')).toBe(false) // too short
      expect(isValidEthereumAddress('0x1234567890abcdef1234567890abcdef123456789')).toBe(false) // too long
      expect(isValidEthereumAddress('0x1234567890abcdef1234567890abcdef1234567g')).toBe(false) // invalid char
    })
  })

  describe('isValidBitcoinAddress', () => {
    it('should validate correct Bitcoin P2PKH addresses', () => {
      expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true)
      expect(isValidBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true)
    })

    it('should validate correct Bitcoin Bech32 addresses', () => {
      expect(isValidBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true)
      expect(isValidBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe(true)
    })

    it('should reject invalid Bitcoin addresses', () => {
      expect(isValidBitcoinAddress('')).toBe(false)
      expect(isValidBitcoinAddress('invalid')).toBe(false)
      expect(isValidBitcoinAddress('2A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false) // starts with 2
      expect(isValidBitcoinAddress('bc2qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false) // bc2 instead of bc1
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  describe('formatTokenAmount edge cases', () => {
    it('should handle undefined and null gracefully', () => {
      expect(formatTokenAmount('')).toBe('0')
      expect(formatTokenAmount('invalid')).toBe('NaN')
    })

    it('should handle very large numbers', () => {
      expect(formatTokenAmount('1e20')).toBe('100000000000000.00M')
    })

    it('should handle negative numbers', () => {
      expect(formatTokenAmount('-100')).toBe('-100')
      expect(formatTokenAmount('-1500')).toBe('-1.50K')
    })
  })

  describe('calculateSlippage edge cases', () => {
    it('should handle very small numbers', () => {
      expect(calculateSlippage(0.000001, 0.0000009)).toBe(10)
    })

    it('should handle infinity and NaN', () => {
      expect(calculateSlippage(Infinity, 100)).toBe(Infinity)
      expect(calculateSlippage(100, Infinity)).toBe(-Infinity)
    })
  })
})