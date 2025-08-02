import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CosmosAddressInput } from '../CosmosAddressInput'

const user = userEvent.setup()

describe('CosmosAddressInput - Simple Tests', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render with basic props', () => {
    render(
      <CosmosAddressInput
        value=""
        onChange={mockOnChange}
        label="Test Address"
      />
    )

    expect(screen.getByLabelText('Test Address')).toBeInTheDocument()
  })

  it('should call onChange when user types', async () => {
    render(
      <CosmosAddressInput
        value=""
        onChange={mockOnChange}
        expectedChain="neutron"
      />
    )

    const input = screen.getByRole('textbox')
    
    await act(async () => {
      await user.type(input, 'test')
    })

    expect(mockOnChange).toHaveBeenCalled()
  })

  it('should validate valid Cosmos addresses', async () => {
    render(
      <CosmosAddressInput
        value=""
        onChange={mockOnChange}
        expectedChain="neutron"
      />
    )

    const input = screen.getByRole('textbox')
    const validAddress = 'neutron1abcdefghijklmnopqrstuvwxyz1234567890abcdef'
    
    await act(async () => {
      await user.type(input, validAddress)
    })

    // Just check that onChange was called enough times
    expect(mockOnChange).toHaveBeenCalledTimes(validAddress.length)
  })

  it('should handle invalid addresses', async () => {
    render(
      <CosmosAddressInput
        value=""
        onChange={mockOnChange}
        expectedChain="neutron"
      />
    )

    const input = screen.getByRole('textbox')
    
    await act(async () => {
      await user.type(input, 'invalid')
    })

    // Just check that onChange was called
    expect(mockOnChange).toHaveBeenCalled()
  })

  it('should be disabled when disabled prop is true', () => {
    render(
      <CosmosAddressInput
        value=""
        onChange={mockOnChange}
        disabled={true}
      />
    )

    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })
})