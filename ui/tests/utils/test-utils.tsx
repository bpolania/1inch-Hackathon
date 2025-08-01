import React, { ReactElement } from 'react'
import { render, RenderOptions, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IntentRequest, TokenInfo, SolverInfo, SolverBid, ChainId } from '@/types/intent'

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Mock data factories
export const createMockToken = (overrides: Partial<TokenInfo> = {}): TokenInfo => ({
  address: 'mock-address',
  symbol: 'MOCK',
  decimals: 18,
  chainId: 'ethereum' as ChainId,
  logoURI: '/mock-logo.svg',
  priceUSD: 100,
  ...overrides,
})

export const createMockIntent = (overrides: Partial<IntentRequest> = {}): IntentRequest => ({
  id: 'intent-123',
  user: 'user.near',
  fromToken: createMockToken({ symbol: 'ETH', chainId: 'ethereum' }),
  toToken: createMockToken({ symbol: 'NEAR', chainId: 'near' }),
  fromAmount: '1.0',
  minToAmount: '10.0',
  maxSlippage: 50, // 0.5%
  deadline: Math.floor(Date.now() / 1000) + 300,
  prioritize: 'speed',
  status: 'pending',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
})

export const createMockSolver = (overrides: Partial<SolverInfo> = {}): SolverInfo => ({
  id: 'solver-123',
  name: 'Mock Solver',
  reputation: 0.95,
  totalVolume: 1000000,
  successRate: 0.98,
  avgExecutionTime: 15,
  teeVerified: true,
  specialties: ['ethereum', 'near'],
  ...overrides,
})

export const createMockBid = (overrides: Partial<SolverBid> = {}): SolverBid => ({
  id: 'bid-123',
  solverId: 'solver-123',
  intentId: 'intent-123',
  outputAmount: '10.5',
  executionTime: 12,
  gasCost: '25.50',
  confidence: 0.92,
  route: 'ETH → DEX → NEAR',
  timestamp: Date.now(),
  status: 'pending',
  ...overrides,
})

// Common test tokens
export const NEAR_TOKEN: TokenInfo = createMockToken({
  address: 'near',
  symbol: 'NEAR',
  chainId: 'near',
  priceUSD: 3.45,
})

export const ETH_TOKEN: TokenInfo = createMockToken({
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'ETH',
  chainId: 'ethereum',
  priceUSD: 2340.50,
})

export const BTC_TOKEN: TokenInfo = createMockToken({
  address: 'btc',
  symbol: 'BTC',
  chainId: 'bitcoin',
  priceUSD: 43250.00,
})

export const USDT_TOKEN: TokenInfo = createMockToken({
  address: 'usdt.tether-token.near',
  symbol: 'USDT',
  chainId: 'near',
  priceUSD: 1.00,
})

// Test scenario generators
export const createCrossChainIntent = (): IntentRequest =>
  createMockIntent({
    fromToken: ETH_TOKEN,
    toToken: NEAR_TOKEN,
    fromAmount: '1.0',
    minToAmount: '680.0',
  })

export const createSameChainIntent = (): IntentRequest =>
  createMockIntent({
    fromToken: NEAR_TOKEN,
    toToken: USDT_TOKEN,
    fromAmount: '100.0',
    minToAmount: '340.0',
  })

export const createExpiredIntent = (): IntentRequest =>
  createMockIntent({
    deadline: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
    status: 'expired',
  })

export const createCompletedIntent = (): IntentRequest =>
  createMockIntent({
    status: 'completed',
    updatedAt: Date.now() - 60000, // 1 minute ago
  })

// Solver competition scenarios
export const createCompetitiveBids = (intentId: string): SolverBid[] => [
  createMockBid({
    id: 'bid-1',
    solverId: 'solver-1',
    intentId,
    outputAmount: '10.8',
    executionTime: 8,
    confidence: 0.95,
  }),
  createMockBid({
    id: 'bid-2',
    solverId: 'solver-2',
    intentId,
    outputAmount: '10.6',
    executionTime: 12,
    confidence: 0.92,
  }),
  createMockBid({
    id: 'bid-3',
    solverId: 'solver-3',
    intentId,
    outputAmount: '10.4',
    executionTime: 15,
    confidence: 0.88,
  }),
]

// User interaction helpers
export const user = userEvent.setup()

export const fillTokenAmount = async (input: HTMLElement, amount: string) => {
  await user.clear(input)
  await user.type(input, amount)
}

export const selectToken = async (selector: HTMLElement, tokenSymbol: string) => {
  await user.click(selector)
  const tokenOption = screen.getByText(tokenSymbol)
  await user.click(tokenOption)
}

export const submitForm = async (submitButton?: HTMLElement) => {
  const button = submitButton || screen.getByRole('button', { name: /submit/i })
  await user.click(button)
}

// Assertion helpers (commented out due to TypeScript issues in build)
// export const expectElementToBeVisible = (element: HTMLElement | null) => {
//   if (element) {
//     expect(element).toBeInTheDocument()
//     expect(element).toBeVisible()
//   }
// }

// export const expectFormValidation = (errorMessage: string) => {
//   expect(screen.getByText(errorMessage)).toBeInTheDocument()
// }

// export const expectLoadingState = () => {
//   expect(screen.getByText(/loading/i)).toBeInTheDocument()
// }

// export const expectSuccessState = (successMessage?: string) => {
//   if (successMessage) {
//     expect(screen.getByText(successMessage)).toBeInTheDocument()
//   } else {
//     expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
//   }
// }

// Animation and timing helpers
export const waitForAnimation = (duration: number = 300) =>
  new Promise((resolve) => setTimeout(resolve, duration))

export const advanceTimersByTime = (time: number) => {
  jest.advanceTimersByTime(time)
}

// Mock implementations
export const mockLocalStorage = () => {
  const store: Record<string, string> = {}
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
  }
}

export const mockWebSocket = () => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN,
})

// Re-export everything from testing library
export * from '@testing-library/react'
export { customRender as render }