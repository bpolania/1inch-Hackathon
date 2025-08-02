/**
 * Tests for 1inch API Service
 */

import { OneInchService, OneInchQuoteService, toWei, fromWei, isNativeToken, formatProtocolRoute, SUPPORTED_CHAINS } from '../oneinch';

// Mock fetch globally
global.fetch = jest.fn();

describe('OneInchService', () => {
  let service: OneInchService;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    service = new OneInchService(mockApiKey);
    jest.clearAllMocks();
  });

  describe('getTokens', () => {
    it('should fetch tokens for a chain', async () => {
      const mockTokens = {
        '0x123': {
          address: '0x123',
          decimals: 18,
          name: 'Test Token',
          symbol: 'TEST'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      });

      const result = await service.getTokens(SUPPORTED_CHAINS.ETHEREUM);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/1inch/1/tokens',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result).toEqual(mockTokens);
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error'
      });

      await expect(service.getTokens(SUPPORTED_CHAINS.ETHEREUM))
        .rejects
        .toThrow('1inch API error: 500 Internal Server Error');
    });
  });

  describe('getQuote', () => {
    it('should fetch quote with correct parameters', async () => {
      const mockQuote = {
        dstAmount: '1000000000000000000',
        srcAmount: '1000000000000000000',
        protocols: [[{ name: 'Uniswap', part: 100, fromTokenAddress: '0x123', toTokenAddress: '0x456' }]],
        gas: '150000',
        gasPrice: '20000000000',
        toToken: { symbol: 'USDC', decimals: 6 },
        fromToken: { symbol: 'ETH', decimals: 18 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuote
      });

      const params = {
        src: '0x123',
        dst: '0x456',
        amount: '1000000000000000000',
        fee: '1'
      };

      const result = await service.getQuote(SUPPORTED_CHAINS.ETHEREUM, params);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/1inch/1/quote?src=0x123&dst=0x456&amount=1000000000000000000&fee=1',
        expect.any(Object)
      );
      expect(result).toEqual(mockQuote);
    });
  });

  describe('getSwap', () => {
    it('should fetch swap transaction data', async () => {
      const mockSwap = {
        dstAmount: '1000000000000000000',
        srcAmount: '1000000000000000000',
        tx: {
          from: '0xuser',
          to: '0xrouter',
          data: '0x...',
          value: '0',
          gasPrice: '20000000000',
          gas: '150000'
        },
        protocols: [[{ name: 'Uniswap', part: 100, fromTokenAddress: '0x123', toTokenAddress: '0x456' }]],
        toToken: { symbol: 'USDC', decimals: 6 },
        fromToken: { symbol: 'ETH', decimals: 18 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSwap
      });

      const params = {
        src: '0x123',
        dst: '0x456',
        amount: '1000000000000000000',
        from: '0xuser',
        slippage: 1
      };

      const result = await service.getSwap(SUPPORTED_CHAINS.ETHEREUM, params);

      expect(result).toEqual(mockSwap);
      expect(result.tx).toBeDefined();
      expect(result.tx.from).toBe('0xuser');
    });
  });
});

describe('OneInchQuoteService', () => {
  let quoteService: OneInchQuoteService;

  beforeEach(() => {
    quoteService = new OneInchQuoteService('test-api-key');
    jest.clearAllMocks();
  });

  describe('getQuoteWithCache', () => {
    it('should cache quotes and return cached value within TTL', async () => {
      const mockQuote = {
        dstAmount: '1000000000000000000',
        srcAmount: '1000000000000000000',
        protocols: [[{ name: 'Uniswap', part: 100, fromTokenAddress: '0x123', toTokenAddress: '0x456' }]],
        toToken: { symbol: 'USDC', decimals: 6 },
        fromToken: { symbol: 'ETH', decimals: 18 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuote
      });

      // First call - should fetch from API
      const result1 = await quoteService.getQuoteWithCache(
        SUPPORTED_CHAINS.ETHEREUM,
        '0x123',
        '0x456',
        '1000000000000000000'
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockQuote);

      // Second call - should return cached value
      const result2 = await quoteService.getQuoteWithCache(
        SUPPORTED_CHAINS.ETHEREUM,
        '0x123',
        '0x456',
        '1000000000000000000'
      );

      expect(global.fetch).toHaveBeenCalledTimes(1); // No additional fetch
      expect(result2).toEqual(mockQuote);
    });

    it('should fetch new quote after cache TTL expires', async () => {
      const mockQuote1 = {
        dstAmount: '1000000000000000000',
        srcAmount: '1000000000000000000',
        protocols: [[{ name: 'Uniswap', part: 100, fromTokenAddress: '0x123', toTokenAddress: '0x456' }]],
        toToken: { symbol: 'USDC', decimals: 6 },
        fromToken: { symbol: 'ETH', decimals: 18 }
      };

      const mockQuote2 = {
        ...mockQuote1,
        dstAmount: '2000000000000000000'
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockQuote1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockQuote2
        });

      // First call
      await quoteService.getQuoteWithCache(
        SUPPORTED_CHAINS.ETHEREUM,
        '0x123',
        '0x456',
        '1000000000000000000'
      );

      // Clear cache manually (simulating TTL expiration)
      quoteService.clearCache();

      // Second call after cache clear
      const result = await quoteService.getQuoteWithCache(
        SUPPORTED_CHAINS.ETHEREUM,
        '0x123',
        '0x456',
        '1000000000000000000'
      );

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockQuote2);
    });
  });

  describe('getUIQuote', () => {
    it('should return formatted quote for UI display', async () => {
      const mockQuote = {
        dstAmount: '1000000000000000000', // 1 token with 18 decimals
        srcAmount: '1000000000000000000',
        protocols: [[{ name: 'Uniswap', part: 100, fromTokenAddress: '0x123', toTokenAddress: '0x456' }]],
        gas: '150000',
        gasPrice: '20000000000',
        toToken: { symbol: 'USDC', decimals: 18 },
        fromToken: { symbol: 'ETH', decimals: 18 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuote
      });

      const result = await quoteService.getUIQuote(
        SUPPORTED_CHAINS.ETHEREUM,
        '0x123',
        '0x456',
        '1000000000000000000'
      );

      expect(result).toBeDefined();
      expect(result?.formattedOutput).toBe('1');
      expect(result?.outputAmount).toBe('1000000000000000000');
      expect(result?.route).toBe('Uniswap');
      expect(result?.gasEstimate).toBe('150000');
      expect(result?.protocols).toEqual(['Uniswap']);
      expect(result?.confidence).toBe(0.95);
    });

    it('should return mock quote on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await quoteService.getUIQuote(
        SUPPORTED_CHAINS.ETHEREUM,
        '0x123',
        '0x456',
        '1000000000000000000'
      );

      // Service provides fallback mock quote instead of null
      expect(result).toBeDefined();
      expect(result?.formattedOutput).toBeDefined();
      expect(result?.route).toBeDefined();
    });
  });

  describe('validateTokens', () => {
    it('should validate supported tokens', async () => {
      const mockTokens = {
        '0x123': { address: '0x123', decimals: 18, name: 'Token1', symbol: 'TK1' },
        '0x456': { address: '0x456', decimals: 18, name: 'Token2', symbol: 'TK2' }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      });

      const result = await quoteService.validateTokens(
        SUPPORTED_CHAINS.ETHEREUM,
        ['0x123', '0x456']
      );

      expect(result).toBe(true);
    });

    it('should validate native token address', async () => {
      const mockTokens = {
        '0x123': { address: '0x123', decimals: 18, name: 'Token1', symbol: 'TK1' }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      });

      const result = await quoteService.validateTokens(
        SUPPORTED_CHAINS.ETHEREUM,
        ['0x123', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee']
      );

      expect(result).toBe(true);
    });

    it('should return false for unsupported tokens', async () => {
      const mockTokens = {
        '0x123': { address: '0x123', decimals: 18, name: 'Token1', symbol: 'TK1' }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      });

      const result = await quoteService.validateTokens(
        SUPPORTED_CHAINS.ETHEREUM,
        ['0x123', '0x999'] // 0x999 is not in the list
      );

      expect(result).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('toWei', () => {
    it('should convert amount to wei with 18 decimals', () => {
      expect(toWei('1', 18)).toBe('1000000000000000000');
      expect(toWei(1, 18)).toBe('1000000000000000000');
    });

    it('should convert amount to wei with 6 decimals', () => {
      expect(toWei('1', 6)).toBe('1000000');
      expect(toWei(1, 6)).toBe('1000000');
    });

    it('should handle decimal amounts', () => {
      expect(toWei('0.1', 18)).toBe('100000000000000000');
      expect(toWei('0.000001', 6)).toBe('1');
    });
  });

  describe('fromWei', () => {
    it('should convert wei to human readable with 18 decimals', () => {
      expect(fromWei('1000000000000000000', 18)).toBe('1');
      expect(fromWei('100000000000000000', 18)).toBe('0.1');
    });

    it('should convert wei to human readable with 6 decimals', () => {
      expect(fromWei('1000000', 6)).toBe('1');
      expect(fromWei('100000', 6)).toBe('0.1');
    });
  });

  describe('isNativeToken', () => {
    it('should identify native token address', () => {
      expect(isNativeToken('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')).toBe(true);
      expect(isNativeToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')).toBe(true);
    });

    it('should identify non-native token address', () => {
      expect(isNativeToken('0x123')).toBe(false);
      expect(isNativeToken('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')).toBe(false);
    });
  });

  describe('formatProtocolRoute', () => {
    it('should format single protocol route', () => {
      const protocols = [[
        { name: 'Uniswap', part: 100, fromTokenAddress: '0x123', toTokenAddress: '0x456' }
      ]];
      expect(formatProtocolRoute(protocols)).toBe('Uniswap');
    });

    it('should format multi-protocol route', () => {
      const protocols = [[
        { name: 'Uniswap', part: 50, fromTokenAddress: '0x123', toTokenAddress: '0x456' },
        { name: 'SushiSwap', part: 50, fromTokenAddress: '0x123', toTokenAddress: '0x456' }
      ]];
      expect(formatProtocolRoute(protocols)).toBe('Uniswap → SushiSwap');
    });

    it('should handle empty protocols', () => {
      expect(formatProtocolRoute([])).toBe('Direct');
      expect(formatProtocolRoute([[]])).toBe('Direct');
    });
  });
});