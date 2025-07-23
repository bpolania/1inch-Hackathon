use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, AccountId, NearToken, Promise,
    PanicOnDefault,
};
use schemars::JsonSchema;

/// 1inch Fusion+ Order Structure for NEAR
/// Compatible with 1inch Fusion+ protocol extension
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct FusionPlusOrder {
    /// 1inch Fusion+ order hash from Ethereum
    pub order_hash: String,
    /// Hash for HTLC atomic coordination
    pub hashlock: String,
    /// Packed timelock stages (1inch format)
    #[schemars(with = "String")]
    pub timelocks: U128, // Using U128 to store packed uint256
    /// User receiving tokens on NEAR
    #[schemars(with = "String")]
    pub maker: AccountId,
    /// 1inch resolver executing the order
    #[schemars(with = "String")]
    pub resolver: AccountId,
    /// Amount of NEAR tokens to transfer
    #[schemars(with = "String")]
    pub amount: U128,
    /// Resolver fee from the 1inch order
    #[schemars(with = "String")]
    pub resolver_fee: U128,
    /// Safety deposit from 1inch system
    #[schemars(with = "String")]
    pub safety_deposit: U128,
    /// Order execution status
    pub status: OrderStatus,
    /// Preimage when revealed
    pub preimage: Option<String>,
    /// Source chain ID (e.g., Ethereum = 11155111)
    pub source_chain_id: u32,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum OrderStatus {
    Pending,
    Matched,
    Claimed,
    Refunded,
}

/// Events for 1inch integration monitoring
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct FusionOrderCreatedEvent {
    pub order_hash: String,
    pub maker: AccountId,
    pub amount: U128,
    pub source_chain_id: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct FusionOrderClaimedEvent {
    pub order_hash: String,
    pub resolver: AccountId,
    pub preimage: String,
}

/// 1inch Fusion+ NEAR Extension Contract
/// Enables NEAR as a destination chain for 1inch Fusion+ atomic swaps
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct FusionPlusNear {
    /// Fusion+ orders indexed by 1inch order hash
    pub orders: UnorderedMap<String, FusionPlusOrder>,
    /// 1inch authorized resolvers (compatibility with 1inch network)
    pub authorized_resolvers: UnorderedMap<AccountId, bool>,
    /// Contract owner for management
    pub owner: AccountId,
    /// Minimum safety deposit ratio (basis points)
    pub min_safety_deposit_bps: u16,
}

#[near_bindgen]
impl FusionPlusNear {
    #[init]
    pub fn new(min_safety_deposit_bps: u16) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        assert!(min_safety_deposit_bps > 0 && min_safety_deposit_bps <= 10000, "Invalid deposit ratio");
        
        Self {
            orders: UnorderedMap::new(b"o"),
            authorized_resolvers: UnorderedMap::new(b"r"),
            owner: env::predecessor_account_id(),
            min_safety_deposit_bps,
        }
    }

    /// Add a 1inch resolver to the authorized list
    /// Only resolvers from 1inch network can execute orders
    pub fn add_resolver(&mut self, resolver: AccountId) {
        self.assert_owner();
        self.authorized_resolvers.insert(&resolver, &true);
        env::log_str(&format!("RESOLVER_ADDED:{}", resolver));
    }

    /// Remove a resolver from 1inch network
    pub fn remove_resolver(&mut self, resolver: AccountId) {
        self.assert_owner();
        self.authorized_resolvers.remove(&resolver);
        env::log_str(&format!("RESOLVER_REMOVED:{}", resolver));
    }

    /// Execute a Fusion+ order on NEAR side
    /// Called by 1inch resolvers to complete atomic swaps
    #[payable]
    pub fn execute_fusion_order(
        &mut self,
        order_hash: String,
        hashlock: String,
        maker: AccountId,
        resolver: AccountId,
        amount: U128,
        resolver_fee: U128,
        timelocks: U128,
        source_chain_id: u32,
    ) -> FusionPlusOrder {
        // Verify resolver is authorized by 1inch
        assert!(
            self.authorized_resolvers.get(&resolver).unwrap_or(false),
            "Not a 1inch authorized resolver"
        );

        // Verify order doesn't exist
        assert!(!self.orders.get(&order_hash).is_some(), "Order already exists");

        // Verify attached deposit covers amount + resolver fee + safety deposit
        let total_required = amount.0 + resolver_fee.0;
        let attached = env::attached_deposit().as_yoctonear();
        assert!(attached >= total_required, "Insufficient deposit");

        // Calculate safety deposit (resolver's stake)
        let safety_deposit = (amount.0 * self.min_safety_deposit_bps as u128) / 10000;
        assert!(attached >= total_required + safety_deposit, "Insufficient safety deposit");

        // Validate hashlock format (64 hex chars = 32 bytes)
        assert!(hashlock.len() == 64, "Invalid hashlock format");

        // Create Fusion+ order
        let order = FusionPlusOrder {
            order_hash: order_hash.clone(),
            hashlock,
            timelocks,
            maker: maker.clone(),
            resolver: resolver.clone(),
            amount,
            resolver_fee,
            safety_deposit: U128(safety_deposit),
            status: OrderStatus::Matched,
            preimage: None,
            source_chain_id,
        };

        self.orders.insert(&order_hash, &order);

        // Emit event for 1inch monitoring
        env::log_str(&format!(
            "FUSION_ORDER_CREATED:{}",
            serde_json::to_string(&FusionOrderCreatedEvent {
                order_hash: order_hash.clone(),
                maker: maker.clone(),
                amount,
                source_chain_id,
            }).unwrap()
        ));

        order
    }

    /// Claim Fusion+ order with preimage revelation
    /// Completes the atomic swap by revealing the secret
    pub fn claim_fusion_order(&mut self, order_hash: String, preimage: String) {
        let mut order = self.orders.get(&order_hash).expect("Order not found");
        
        // Only resolver can claim
        assert_eq!(
            env::predecessor_account_id(), 
            order.resolver, 
            "Only resolver can claim"
        );
        
        // Check order status
        assert_eq!(order.status, OrderStatus::Matched, "Order not claimable");
        
        // Validate preimage format
        assert!(preimage.len() == 64, "Invalid preimage format");
        
        // Verify preimage matches hashlock
        let preimage_bytes = hex::decode(&preimage).expect("Invalid preimage hex");
        let hash = env::sha256(&preimage_bytes);
        let computed_hash = hex::encode(hash);
        assert_eq!(computed_hash, order.hashlock, "Preimage doesn't match hashlock");

        // Update order status
        order.status = OrderStatus::Claimed;
        order.preimage = Some(preimage.clone());
        self.orders.insert(&order_hash, &order);

        // Emit event for 1inch monitoring
        env::log_str(&format!(
            "FUSION_ORDER_CLAIMED:{}",
            serde_json::to_string(&FusionOrderClaimedEvent {
                order_hash: order_hash.clone(),
                resolver: order.resolver.clone(),
                preimage: preimage.clone(),
            }).unwrap()
        ));
    }

    /// Transfer tokens to maker after successful claim
    /// Separate function to avoid promise issues
    pub fn transfer_to_maker(&self, order_hash: String) -> Promise {
        let order = self.orders.get(&order_hash).expect("Order not found");
        
        // Only resolver can trigger transfer
        assert_eq!(
            env::predecessor_account_id(), 
            order.resolver, 
            "Only resolver can transfer"
        );
        
        // Order must be claimed first
        assert_eq!(order.status, OrderStatus::Claimed, "Order not claimed yet");
        
        // Transfer to maker (user receives their tokens)
        Promise::new(order.maker.clone())
            .transfer(NearToken::from_yoctonear(order.amount.0))
    }

    /// Claim resolver fee and safety deposit return
    /// Called by resolver after successful claim
    pub fn claim_resolver_payment(&mut self, order_hash: String) -> Promise {
        let order = self.orders.get(&order_hash).expect("Order not found");
        
        // Only resolver can claim their payment
        assert_eq!(
            env::predecessor_account_id(), 
            order.resolver, 
            "Only resolver can claim payment"
        );
        
        // Order must be claimed first
        assert_eq!(order.status, OrderStatus::Claimed, "Order not claimed yet");
        
        // Transfer resolver fee + return safety deposit to resolver  
        let resolver_amount = order.resolver_fee.0 + order.safety_deposit.0;
        Promise::new(order.resolver.clone())
            .transfer(NearToken::from_yoctonear(resolver_amount))
    }

    /// Cancel expired Fusion+ order
    /// Returns funds if timelock has expired
    pub fn cancel_fusion_order(&mut self, order_hash: String) -> Promise {
        let mut order = self.orders.get(&order_hash).expect("Order not found");
        
        // Only resolver can cancel (they locked the funds)
        assert_eq!(
            env::predecessor_account_id(),
            order.resolver,
            "Only resolver can cancel"
        );
        
        assert_eq!(order.status, OrderStatus::Matched, "Order not cancellable");
        
        // Check if cancellation timelock has passed
        // TODO: Unpack timelocks and verify cancellation stage
        // For now, using simple block height check
        let current_block = env::block_height();
        // This is simplified - should unpack timelocks properly
        assert!(current_block > 1000000, "Cancellation timelock not reached");

        order.status = OrderStatus::Refunded;
        self.orders.insert(&order_hash, &order);

        // Return all funds to resolver
        let refund_amount = order.amount.0 + order.resolver_fee.0 + order.safety_deposit.0;
        Promise::new(order.resolver).transfer(NearToken::from_yoctonear(refund_amount))
    }

    /// View functions for 1inch integration

    pub fn get_order(&self, order_hash: String) -> Option<FusionPlusOrder> {
        self.orders.get(&order_hash)
    }

    pub fn is_authorized_resolver(&self, resolver: AccountId) -> bool {
        self.authorized_resolvers.get(&resolver).unwrap_or(false)
    }

    pub fn get_min_safety_deposit_bps(&self) -> u16 {
        self.min_safety_deposit_bps
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    // Internal functions
    
    fn assert_owner(&self) {
        assert_eq!(env::predecessor_account_id(), self.owner, "Only owner");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn get_context(predecessor_account_id: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
    }

    #[test]
    fn test_contract_initialization() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let contract = FusionPlusNear::new(500); // 5% min safety deposit
        
        assert_eq!(contract.get_owner(), accounts(1));
        assert_eq!(contract.get_min_safety_deposit_bps(), 500);
        assert!(!contract.is_authorized_resolver(accounts(2)));
    }

    #[test]
    fn test_add_resolver() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500);
        
        // Add 1inch resolver
        contract.add_resolver(accounts(2));
        
        assert!(contract.is_authorized_resolver(accounts(2)));
    }

    #[test]
    fn test_execute_fusion_order() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500);
        
        // Add resolver
        contract.add_resolver(accounts(2));
        
        // Switch to resolver account
        let mut context = get_context(accounts(2));
        let deposit = NearToken::from_near(1).as_yoctonear() + // amount
                     NearToken::from_millinear(100).as_yoctonear() + // resolver fee
                     NearToken::from_millinear(50).as_yoctonear(); // safety deposit
        testing_env!(context
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .build());
        
        let order = contract.execute_fusion_order(
            "0x1234567890abcdef".to_string(),
            "a".repeat(64),
            accounts(3), // maker
            accounts(2), // resolver
            U128(NearToken::from_near(1).as_yoctonear()),
            U128(NearToken::from_millinear(100).as_yoctonear()),
            U128(0), // packed timelocks
            11155111, // Ethereum Sepolia
        );
        
        assert_eq!(order.order_hash, "0x1234567890abcdef");
        assert_eq!(order.maker, accounts(3));
        assert_eq!(order.resolver, accounts(2));
        assert_eq!(order.status, OrderStatus::Matched);
    }

    #[test]
    #[should_panic(expected = "Not a 1inch authorized resolver")]
    fn test_execute_fusion_order_unauthorized() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500);
        
        // Don't add resolver - should fail
        let mut context = get_context(accounts(2));
        testing_env!(context
            .attached_deposit(NearToken::from_near(2))
            .build());
        
        contract.execute_fusion_order(
            "0xunauthorized".to_string(),
            "a".repeat(64),
            accounts(3),
            accounts(2),
            U128(NearToken::from_near(1).as_yoctonear()),
            U128(NearToken::from_millinear(100).as_yoctonear()),
            U128(0),
            11155111,
        );
    }

    #[test]
    #[should_panic(expected = "Order already exists")]
    fn test_duplicate_order_fails() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500);
        contract.add_resolver(accounts(2));
        
        let mut context = get_context(accounts(2));
        let deposit = NearToken::from_near(2);
        testing_env!(context
            .attached_deposit(deposit)
            .build());
        
        // First order succeeds
        contract.execute_fusion_order(
            "0xduplicate".to_string(),
            "a".repeat(64),
            accounts(3),
            accounts(2),
            U128(NearToken::from_near(1).as_yoctonear()),
            U128(NearToken::from_millinear(100).as_yoctonear()),
            U128(0),
            11155111,
        );
        
        // Second order with same hash should fail
        contract.execute_fusion_order(
            "0xduplicate".to_string(),
            "b".repeat(64),
            accounts(3),
            accounts(2),
            U128(NearToken::from_near(1).as_yoctonear()),
            U128(NearToken::from_millinear(100).as_yoctonear()),
            U128(0),
            11155111,
        );
    }

    #[test]
    #[should_panic(expected = "Invalid hashlock format")]
    fn test_invalid_hashlock_format() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500);
        contract.add_resolver(accounts(2));
        
        let mut context = get_context(accounts(2));
        testing_env!(context
            .attached_deposit(NearToken::from_near(2))
            .build());
        
        contract.execute_fusion_order(
            "0xinvalidhash".to_string(),
            "tooshort".to_string(), // Invalid hashlock
            accounts(3),
            accounts(2),
            U128(NearToken::from_near(1).as_yoctonear()),
            U128(NearToken::from_millinear(100).as_yoctonear()),
            U128(0),
            11155111,
        );
    }

    #[test]
    #[should_panic(expected = "Insufficient deposit")]
    fn test_insufficient_deposit() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500);
        contract.add_resolver(accounts(2));
        
        let mut context = get_context(accounts(2));
        testing_env!(context
            .attached_deposit(NearToken::from_millinear(500)) // Too small
            .build());
        
        contract.execute_fusion_order(
            "0xinsufficient".to_string(),
            "a".repeat(64),
            accounts(3),
            accounts(2),
            U128(NearToken::from_near(1).as_yoctonear()),
            U128(NearToken::from_millinear(100).as_yoctonear()),
            U128(0),
            11155111,
        );
    }

    #[test]
    #[should_panic(expected = "Insufficient safety deposit")]
    fn test_insufficient_safety_deposit() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500); // 5% safety deposit
        contract.add_resolver(accounts(2));
        
        let mut context = get_context(accounts(2));
        // Enough for amount + fee but not safety deposit
        let deposit = NearToken::from_near(1).as_yoctonear() + 
                     NearToken::from_millinear(100).as_yoctonear();
        testing_env!(context
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .build());
        
        contract.execute_fusion_order(
            "0xnosafety".to_string(),
            "a".repeat(64),
            accounts(3),
            accounts(2),
            U128(NearToken::from_near(1).as_yoctonear()),
            U128(NearToken::from_millinear(100).as_yoctonear()),
            U128(0),
            11155111,
        );
    }

    #[test]
    fn test_remove_resolver() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500);
        
        // Add then remove resolver
        contract.add_resolver(accounts(2));
        assert!(contract.is_authorized_resolver(accounts(2)));
        
        contract.remove_resolver(accounts(2));
        assert!(!contract.is_authorized_resolver(accounts(2)));
    }

    #[test]
    #[should_panic(expected = "Only owner")]
    fn test_add_resolver_not_owner() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500);
        
        // Switch to non-owner
        let context = get_context(accounts(2));
        testing_env!(context.build());
        
        contract.add_resolver(accounts(3));
    }

    #[test]
    fn test_get_order() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = FusionPlusNear::new(500);
        contract.add_resolver(accounts(2));
        
        // Check non-existent order
        assert!(contract.get_order("nonexistent".to_string()).is_none());
        
        // Create order
        let mut context = get_context(accounts(2));
        testing_env!(context
            .attached_deposit(NearToken::from_near(2))
            .build());
        
        contract.execute_fusion_order(
            "0xgetorder".to_string(),
            "a".repeat(64),
            accounts(3),
            accounts(2),
            U128(NearToken::from_near(1).as_yoctonear()),
            U128(NearToken::from_millinear(100).as_yoctonear()),
            U128(0),
            11155111,
        );
        
        // Verify order exists
        let order = contract.get_order("0xgetorder".to_string()).unwrap();
        assert_eq!(order.order_hash, "0xgetorder");
        assert_eq!(order.source_chain_id, 11155111);
    }
}