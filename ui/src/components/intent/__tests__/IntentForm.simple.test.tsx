import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntentForm } from '../IntentForm'

// Mock the store
const mockStore = {
  currentIntent: null,
  intents: [],
  createIntent: jest.fn(),
  updateIntent: jest.fn(),
  submitIntent: jest.fn(),
  clearCurrentIntent: jest.fn(),
  addIntent: jest.fn(),
  updateIntentStatus: jest.fn(),
  clearAllIntents: jest.fn(),
  getIntentById: jest.fn(),
  getIntentsByStatus: jest.fn(),
}

jest.mock('@/stores/intentStore', () => ({
  useIntentStore: () => mockStore,
}))

describe('IntentForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render the intent form', () => {
    render(<IntentForm />)
    
    expect(screen.getByText('Express Your Intent')).toBeInTheDocument()
    expect(screen.getByText('Tell us what you want, we\'ll figure out how to make it happen')).toBeInTheDocument()
  })

  it('should show from and to token sections', () => {
    render(<IntentForm />)
    
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
  })

  it('should show priority buttons', () => {
    render(<IntentForm />)
    
    expect(screen.getByText('Best Price')).toBeInTheDocument()
    expect(screen.getByText('Fastest')).toBeInTheDocument()
    expect(screen.getByText('Most Secure')).toBeInTheDocument()
  })

  it('should have submit button disabled by default', () => {
    render(<IntentForm />)
    
    const submitButton = screen.getByText('Submit Intent')
    expect(submitButton).toBeDisabled()
  })
})