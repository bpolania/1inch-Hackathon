import { ChainId } from './chains';

export enum HTLCStatus {
  ACTIVE = 'ACTIVE',
  CLAIMED = 'CLAIMED',
  REFUNDED = 'REFUNDED',
  EXPIRED = 'EXPIRED',
}

export interface HTLCParams {
  // Participants
  sender: string;
  recipient: string;
  
  // Token details
  chainId: ChainId;
  tokenAddress: string; // 'native' for native tokens
  amount: string;
  
  // HTLC conditions
  hashlock: string; // keccak256 hash
  timelock: number; // Unix timestamp
  
  // Optional resolver fee (paid to executor)
  resolverFee?: string;
  
  // Intent reference
  intentId: string;
}

export interface HTLCState {
  id: string; // Contract-specific ID
  params: HTLCParams;
  status: HTLCStatus;
  createdAt: number;
  createdTxHash: string;
  claimedAt?: number;
  claimedTxHash?: string;
  refundedAt?: number;
  refundedTxHash?: string;
  preimage?: string; // Revealed when claimed
}

export interface HTLCEvent {
  type: 'Created' | 'Claimed' | 'Refunded';
  htlcId: string;
  intentId: string;
  chainId: ChainId;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  data: {
    sender?: string;
    recipient?: string;
    amount?: string;
    hashlock?: string;
    timelock?: number;
    preimage?: string;
    resolverFee?: string;
  };
}