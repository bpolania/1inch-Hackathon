use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, AccountId, Balance, BlockHeight, Gas, Promise, PromiseResult,
    PanicOnDefault,
};
use std::collections::HashMap;

// Gas constants for cross-contract calls
const GAS_FOR_RESOLVE_TRANSFER: Gas = Gas(10_000_000_000_000);
const GAS_FOR_FT_TRANSFER_CALL: Gas = Gas(25_000_000_000_000 + GAS_FOR_RESOLVE_TRANSFER.0);

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct HTLCOrder {
    pub id: String,
    pub maker: AccountId,
    pub resolver: Option<AccountId>,
    pub token_contract: Option<AccountId>, // None for NEAR native token
    pub amount: U128,
    pub hashlock: String, // 32-byte hex string
    pub timelock: U64,    // Block height
    pub destination_chain: String,
    pub destination_token: String,
    pub destination_amount: U128,
    pub destination_address: String,
    pub resolver_fee: U128,
    pub safety_deposit: U128,
    pub is_claimed: bool,
    pub is_refunded: bool,
    pub preimage: Option<String>, // 32-byte hex string when revealed
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OrderCreatedEvent {
    pub order_id: String,
    pub maker: AccountId,
    pub amount: U128,
    pub hashlock: String,
    pub timelock: U64,
    pub destination_chain: String,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OrderClaimedEvent {
    pub order_id: String,
    pub resolver: AccountId,
    pub preimage: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct CrossChainHTLC {
    pub orders: UnorderedMap<String, HTLCOrder>,
    pub authorized_resolvers: UnorderedMap<AccountId, bool>,
    pub owner: AccountId,
    pub resolver_count: u64,
}

#[near_bindgen]
impl CrossChainHTLC {
    #[init]
    pub fn new() -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self {
            orders: UnorderedMap::new(b"o"),
            authorized_resolvers: UnorderedMap::new(b"r"),
            owner: env::predecessor_account_id(),
            resolver_count: 0,
        }
    }

    // Owner functions
    pub fn add_resolver(&mut self, resolver: AccountId) {
        self.assert_owner();
        if self.authorized_resolvers.get(&resolver).is_none() {
            self.authorized_resolvers.insert(&resolver, &true);
            self.resolver_count += 1;
        }
    }

    pub fn remove_resolver(&mut self, resolver: AccountId) {
        self.assert_owner();
        if self.authorized_resolvers.remove(&resolver).is_some() {
            self.resolver_count = self.resolver_count.saturating_sub(1);
        }
    }

    // Create HTLC order (for NEAR native token)
    #[payable]
    pub fn create_order(
        &mut self,
        order_id: String,
        hashlock: String,
        timelock: U64,
        destination_chain: String,
        destination_token: String,
        destination_amount: U128,
        destination_address: String,
        resolver_fee: U128,
    ) -> HTLCOrder {
        let deposit = env::attached_deposit();
        let resolver_fee_amount: u128 = resolver_fee.into();
        let amount = U128(deposit - resolver_fee_amount);

        assert!(deposit > resolver_fee_amount, "Insufficient deposit for resolver fee");
        assert!(timelock.0 > env::block_height(), "Timelock must be in the future");
        assert!(hashlock.len() == 64, "Hashlock must be 32 bytes (64 hex chars)");
        assert!(!self.orders.get(&order_id).is_some(), "Order ID already exists");

        let order = HTLCOrder {
            id: order_id.clone(),
            maker: env::predecessor_account_id(),
            resolver: None,
            token_contract: None, // Native NEAR
            amount,
            hashlock,
            timelock,
            destination_chain,
            destination_token,
            destination_amount,
            destination_address,
            resolver_fee,
            safety_deposit: U128(0),
            is_claimed: false,
            is_refunded: false,
            preimage: None,
        };

        self.orders.insert(&order_id, &order);

        // Emit event
        env::log_str(&format!("ORDER_CREATED:{}", serde_json::to_string(&OrderCreatedEvent {
            order_id: order_id.clone(),
            maker: order.maker.clone(),
            amount: order.amount,
            hashlock: order.hashlock.clone(),
            timelock: order.timelock,
            destination_chain: order.destination_chain.clone(),
        }).unwrap()));

        order
    }

    // Match order (resolver locks funds and commits to fulfillment)
    #[payable]
    pub fn match_order(&mut self, order_id: String) -> HTLCOrder {
        let resolver = env::predecessor_account_id();
        assert!(
            self.authorized_resolvers.get(&resolver).unwrap_or(false),
            "Not an authorized resolver"
        );

        let mut order = self.orders.get(&order_id).expect("Order not found");
        assert!(order.resolver.is_none(), "Order already matched");
        assert!(!order.is_claimed && !order.is_refunded, "Order already settled");
        assert!(env::block_height() < order.timelock.0, "Order expired");

        let safety_deposit = env::attached_deposit();
        let required_deposit: u128 = (order.amount.0 * 10) / 100; // 10% safety deposit
        assert!(safety_deposit >= required_deposit, "Insufficient safety deposit");

        order.resolver = Some(resolver);
        order.safety_deposit = U128(safety_deposit);
        self.orders.insert(&order_id, &order);

        order
    }

    // Claim order with preimage (resolver provides secret to claim funds)
    pub fn claim_order(&mut self, order_id: String, preimage: String) -> Promise {
        let resolver = env::predecessor_account_id();
        let mut order = self.orders.get(&order_id).expect("Order not found");
        
        assert_eq!(order.resolver.as_ref().unwrap(), &resolver, "Not the resolver");
        assert!(!order.is_claimed && !order.is_refunded, "Order already settled");
        assert!(env::block_height() < order.timelock.0, "Order expired");
        assert!(preimage.len() == 64, "Preimage must be 32 bytes (64 hex chars)");

        // Verify preimage matches hashlock
        let preimage_bytes = hex::decode(&preimage).expect("Invalid preimage hex");
        let hash = env::sha256(&preimage_bytes);
        let computed_hash = hex::encode(hash);
        assert_eq!(computed_hash, order.hashlock, "Preimage doesn't match hashlock");

        // Mark as claimed
        order.is_claimed = true;
        order.preimage = Some(preimage.clone());
        self.orders.insert(&order_id, &order);

        // Emit event
        env::log_str(&format!("ORDER_CLAIMED:{}", serde_json::to_string(&OrderClaimedEvent {
            order_id: order_id.clone(),
            resolver: resolver.clone(),
            preimage: preimage.clone(),
        }).unwrap()));

        // Transfer locked amount + resolver fee to resolver
        let total_payout = order.amount.0 + order.resolver_fee.0;
        Promise::new(resolver).transfer(total_payout)
    }

    // Cancel order (maker can cancel after timelock expires)
    pub fn cancel_order(&mut self, order_id: String) -> Promise {
        let maker = env::predecessor_account_id();
        let mut order = self.orders.get(&order_id).expect("Order not found");
        
        assert_eq!(order.maker, maker, "Not the order maker");
        assert!(!order.is_claimed && !order.is_refunded, "Order already settled");
        assert!(env::block_height() >= order.timelock.0, "Timelock not yet expired");

        order.is_refunded = true;
        self.orders.insert(&order_id, &order);

        // Refund maker's deposit
        let refund_amount = order.amount.0 + order.resolver_fee.0;
        let mut refund_promise = Promise::new(maker).transfer(refund_amount);

        // Return safety deposit to resolver if matched
        if let Some(resolver) = order.resolver {
            refund_promise = refund_promise.and(Promise::new(resolver).transfer(order.safety_deposit.0));
        }

        refund_promise
    }

    // View functions
    pub fn get_order(&self, order_id: String) -> Option<HTLCOrder> {
        self.orders.get(&order_id)
    }

    pub fn is_authorized_resolver(&self, resolver: AccountId) -> bool {
        self.authorized_resolvers.get(&resolver).unwrap_or(false)
    }

    pub fn get_resolver_count(&self) -> u64 {
        self.resolver_count
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    // Internal functions
    fn assert_owner(&self) {
        assert_eq!(env::predecessor_account_id(), self.owner, "Only owner");
    }
}