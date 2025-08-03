/**
 * Wallet Troubleshooting - Help users with common wallet connection issues
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  AlertCircle, 
  ExternalLink, 
  CheckCircle, 
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

export function WalletTroubleshooting() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader style={{ paddingBottom: '0.75rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <CardTitle style={{
            fontSize: '1.3rem',
            fontWeight: '500',
            color: '#f4f4f7ff'
          }}>
            Wallet Connection Help:
          </CardTitle>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              borderRadius: '0.75rem',
              color: '#2563eb',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)';
              e.currentTarget.style.color = '#1e40af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.2)';
              e.currentTarget.style.color = '#2563eb';
            }}
          >
            more information
            {isExpanded ? <ChevronUp style={{ height: '1rem', width: '1rem' }} /> : <ChevronDown style={{ height: '1rem', width: '1rem' }} />}
          </button>
        </div>
        <div>
          <h5>
            If you already have a successful connection you can continue
          </h5>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'rgba(248, 250, 252, 0.8)',
          borderTop: '1px solid rgba(148, 163, 184, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {/* Connection Issues Alert */}
          <div style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(254, 242, 242, 0.9)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            borderRadius: '0.75rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start'
          }}>
            <AlertCircle style={{ 
              height: '1.25rem', 
              width: '1.25rem', 
              color: '#dc2626',
              marginTop: '0.125rem',
              flexShrink: 0 
            }} />
            <div>
              <h4 style={{
                fontWeight: '600',
                color: '#991b1b',
                marginBottom: '0.5rem',
                fontSize: '0.95rem'
              }}>
                Connection Issues?
              </h4>
              <p style={{
                color: '#7f1d1d',
                fontSize: '0.875rem',
                lineHeight: '1.5'
              }}>
                Common errors: "account doesn't exist" or "intents.testnet doesn't exist" - both indicate setup issues.
              </p>
            </div>
          </div>

          {/* Quick Fixes Section */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            border: '1px solid rgba(148, 163, 184, 0.2)'
          }}>
            <h4 style={{
              fontWeight: '600',
              color: '#1e40af',
              marginBottom: '1rem',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🔧 Quick Fixes:
            </h4>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {/* Create NEAR Account */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(240, 253, 244, 0.8)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(34, 197, 94, 0.2)'
              }}>
                <CheckCircle style={{ 
                  height: '1.25rem', 
                  width: '1.25rem', 
                  color: '#16a34a',
                  marginTop: '0.125rem',
                  flexShrink: 0 
                }} />
                <div>
                  <strong style={{ color: '#15803d', fontSize: '0.9rem' }}>Create NEAR Testnet Account:</strong>
                  <br />
                  <button
                    style={{
                      marginTop: '0.5rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.75rem 1rem',
                      background: 'linear-gradient(45deg, #3B82F6, #06B6D4)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    onClick={() => window.open('https://wallet.testnet.near.org', '_blank')}
                  >
                    Go to wallet.testnet.near.org
                    <ExternalLink style={{ height: '0.875rem', width: '0.875rem' }} />
                  </button>
                </div>
              </div>

              {/* Get Testnet NEAR */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(240, 253, 244, 0.8)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(34, 197, 94, 0.2)'
              }}>
                <CheckCircle style={{ 
                  height: '1.25rem', 
                  width: '1.25rem', 
                  color: '#16a34a',
                  marginTop: '0.125rem',
                  flexShrink: 0 
                }} />
                <div>
                  <strong style={{ color: '#15803d', fontSize: '0.9rem' }}>Get Testnet NEAR:</strong>
                  <br />
                  <button
                    style={{
                      marginTop: '0.5rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.75rem 1rem',
                      background: 'linear-gradient(45deg, #16a34a, #10b981)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    onClick={() => window.open('https://near-faucet.io', '_blank')}
                  >
                    Get free testnet NEAR from faucet
                    <ExternalLink style={{ height: '0.875rem', width: '0.875rem' }} />
                  </button>
                </div>
              </div>

              {/* Fixed Issue */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(240, 253, 244, 0.8)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(34, 197, 94, 0.2)'
              }}>
                <CheckCircle style={{ 
                  height: '1.25rem', 
                  width: '1.25rem', 
                  color: '#16a34a',
                  marginTop: '0.125rem',
                  flexShrink: 0 
                }} />
                <div>
                  <strong style={{ color: '#15803d', fontSize: '0.9rem' }}>Fixed "intents.testnet doesn't exist":</strong>
                  <br />
                  <span style={{ color: '#166534', fontSize: '0.875rem', lineHeight: '1.5' }}>
                    This was a configuration issue - now resolved! The wallet no longer requires a specific contract to connect.
                  </span>
                </div>
              </div>

              {/* Network Issues */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(240, 253, 244, 0.8)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(34, 197, 94, 0.2)'
              }}>
                <CheckCircle style={{ 
                  height: '1.25rem', 
                  width: '1.25rem', 
                  color: '#16a34a',
                  marginTop: '0.125rem',
                  flexShrink: 0 
                }} />
                <div>
                  <strong style={{ color: '#15803d', fontSize: '0.9rem' }}>Network Issues?</strong>
                  <br />
                  <span style={{ color: '#166534', fontSize: '0.875rem', lineHeight: '1.5' }}>
                    Try refreshing the page or switching networks if the RPC is overloaded
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(239, 246, 255, 0.9)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '0.75rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start'
          }}>
            <Info style={{ 
              height: '1.25rem', 
              width: '1.25rem', 
              color: '#2563eb',
              marginTop: '0.125rem',
              flexShrink: 0 
            }} />
            <p style={{
              color: '#1e40af',
              fontSize: '0.875rem',
              lineHeight: '1.5'
            }}>
              <strong>Note:</strong> This app uses NEAR testnet for development. 
              Testnet tokens have no real value and are used for testing only.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}