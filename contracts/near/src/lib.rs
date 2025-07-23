use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, AccountId, NearToken, Promise,
    PanicOnDefault,
};
use schemars::JsonSchema;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct HTLCOrder {
    pub id: String,
    #[schemars(with = "String")]
    pub maker: AccountId,
    #[schemars(with = "Option<String>")]
    pub resolver: Option<AccountId>,
    #[schemars(with = "Option<String>")]
    pub token_contract: Option<AccountId>, // None for NEAR native token
    #[schemars(with = "String")]
    pub amount: U128,
    pub hashlock: String, // 32-byte hex string
    #[schemars(with = "String")]
    pub timelock: U64,    // Block height
    pub destination_chain: String,
    pub destination_token: String,
    #[schemars(with = "String")]
    pub destination_amount: U128,
    pub destination_address: String,
    #[schemars(with = "String")]
    pub resolver_fee: U128,
    #[schemars(with = "String")]
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
        let deposit_amount = deposit.as_yoctonear();
        
        assert!(deposit_amount > resolver_fee_amount, "Insufficient deposit for resolver fee");
        
        let amount = U128(deposit_amount - resolver_fee_amount);
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
        let safety_deposit_amount = safety_deposit.as_yoctonear();
        let required_deposit: u128 = (order.amount.0 * 10) / 100; // 10% safety deposit
        assert!(safety_deposit_amount >= required_deposit, "Insufficient safety deposit");

        order.resolver = Some(resolver);
        order.safety_deposit = U128(safety_deposit_amount);
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
        Promise::new(resolver).transfer(NearToken::from_yoctonear(total_payout))
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
        let mut refund_promise = Promise::new(maker).transfer(NearToken::from_yoctonear(refund_amount));

        // Return safety deposit to resolver if matched
        if let Some(resolver) = order.resolver {
            refund_promise = refund_promise.and(Promise::new(resolver).transfer(NearToken::from_yoctonear(order.safety_deposit.0)));
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
        
        let contract = CrossChainHTLC::new();
        
        assert_eq!(contract.get_owner(), accounts(1));
        assert_eq!(contract.get_resolver_count(), 0);
        assert!(!contract.is_authorized_resolver(accounts(2)));
    }

    #[test]
    fn test_add_resolver() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = CrossChainHTLC::new();
        
        // Add resolver
        contract.add_resolver(accounts(2));
        
        assert_eq!(contract.get_resolver_count(), 1);
        assert!(contract.is_authorized_resolver(accounts(2)));
    }

    #[test]
    #[should_panic(expected = "Only owner")]
    fn test_add_resolver_not_owner() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        
        let mut contract = CrossChainHTLC::new();
        
        // Try to add resolver from non-owner account
        let context = get_context(accounts(2));
        testing_env!(context.build());
        
        contract.add_resolver(accounts(3));
    }

    #[test]
    fn test_create_order() {
        let mut context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(NearToken::from_near(1))
            .block_height(100)
            .build());
        
        let mut contract = CrossChainHTLC::new();
        
        let order = contract.create_order(
            "test-order".to_string(),
            "a".repeat(64), // Valid 64-char hex string
            U64(200), // Future block height
            "ethereum".to_string(),
            "USDC".to_string(),
            U128(100_000_000), // 100 USDC (6 decimals)
            "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f".to_string(),
            U128(100_000_000_000_000_000_000_000), // 0.1 NEAR resolver fee
        );
        
        assert_eq!(order.id, "test-order");
        assert_eq!(order.maker, accounts(1));
        assert_eq!(order.amount.0, 900_000_000_000_000_000_000_000); // 1 NEAR - 0.1 NEAR fee
        assert_eq!(order.resolver_fee.0, 100_000_000_000_000_000_000_000);
        assert!(!order.is_claimed);
        assert!(!order.is_refunded);
        assert!(order.resolver.is_none());
    }

    #[test]
    #[should_panic(expected = "Insufficient deposit for resolver fee")]
    fn test_create_order_insufficient_deposit() {
        let mut context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(NearToken::from_millinear(50))
            .block_height(100)
            .build());
        
        let mut contract = CrossChainHTLC::new();
        
        contract.create_order(
            "test-order".to_string(),
            "a".repeat(64),
            U64(200),
            "ethereum".to_string(),
            "USDC".to_string(),
            U128(100_000_000),
            "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f".to_string(),
            U128(100_000_000_000_000_000_000_000), // 0.1 NEAR fee > 0.05 NEAR deposit
        );
    }

    #[test]
    #[should_panic(expected = "Hashlock must be 32 bytes (64 hex chars)")]
    fn test_create_order_invalid_hashlock() {
        let mut context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(NearToken::from_near(1))
            .block_height(100)
            .build());
        
        let mut contract = CrossChainHTLC::new();
        
        contract.create_order(
            "test-order".to_string(),
            "invalid".to_string(), // Invalid hashlock
            U64(200),
            "ethereum".to_string(),
            "USDC".to_string(),
            U128(100_000_000),
            "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f".to_string(),
            U128(NearToken::from_millinear(100).as_yoctonear()),
        );
    }

    #[test]
    fn test_match_order() {
        let mut context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(NearToken::from_near(1))
            .block_height(100)
            .build());
        
        let mut contract = CrossChainHTLC::new();
        
        // Add resolver
        contract.add_resolver(accounts(2));
        
        // Create order
        contract.create_order(
            "test-order".to_string(),
            "a".repeat(64),
            U64(200),
            "ethereum".to_string(),
            "USDC".to_string(),
            U128(100_000_000),
            "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f".to_string(),
            U128(NearToken::from_millinear(100).as_yoctonear()),
        );
        
        // Switch to resolver account
        let mut context = get_context(accounts(2));
        testing_env!(context
            .attached_deposit(NearToken::from_millinear(90))
            .block_height(150)
            .build());
        
        let matched_order = contract.match_order("test-order".to_string());
        
        assert_eq!(matched_order.resolver, Some(accounts(2)));
        assert_eq!(matched_order.safety_deposit.0, NearToken::from_millinear(90).as_yoctonear());
    }

    #[test]
    fn test_get_order() {
        let mut context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(NearToken::from_near(1))
            .block_height(100)
            .build());
        
        let mut contract = CrossChainHTLC::new();
        
        // Test non-existent order
        assert!(contract.get_order("nonexistent".to_string()).is_none());
        
        // Create and retrieve order
        contract.create_order(
            "test-order".to_string(),
            "a".repeat(64),
            U64(200),
            "ethereum".to_string(),
            "USDC".to_string(),
            U128(100_000_000),
            "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f".to_string(),
            U128(NearToken::from_millinear(100).as_yoctonear()),
        );
        
        let order = contract.get_order("test-order".to_string()).unwrap();
        assert_eq!(order.id, "test-order");
        assert_eq!(order.destination_chain, "ethereum");
    }
}