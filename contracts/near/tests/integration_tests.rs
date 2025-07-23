use anyhow::Result;
use near_workspaces::types::NearToken;
use serde_json::json;
use sha2::{Digest, Sha256};

// Helper function to get the compiled WASM
async fn get_wasm() -> Result<Vec<u8>> {
    let wasm_path = std::path::Path::new("target/near/cross_chain_htlc.wasm");
    if wasm_path.exists() {
        Ok(std::fs::read(wasm_path)?)
    } else {
        Ok(near_workspaces::compile_project("./").await?)
    }
}

#[tokio::test]
async fn test_contract_deployment_and_initialization() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    
    // Use the pre-compiled WASM from cargo near build
    let wasm_path = std::path::Path::new("target/near/cross_chain_htlc.wasm");
    let wasm = if wasm_path.exists() {
        std::fs::read(wasm_path)?
    } else {
        // Fallback to compile_project if pre-compiled WASM doesn't exist
        near_workspaces::compile_project("./").await?
    };

    let contract = worker.dev_deploy(&wasm).await?;

    // Initialize contract
    let outcome = contract.call("new").transact().await?;
    if !outcome.is_success() {
        println!("❌ Contract initialization failed: {:?}", outcome.into_result());
        panic!("Contract initialization failed");
    }

    // Test initial state
    let owner: String = contract.view("get_owner").await?.json()?;
    let resolver_count: u64 = contract.view("get_resolver_count").await?.json()?;

    assert_eq!(resolver_count, 0);
    assert!(!owner.is_empty());

    println!("✅ Contract deployed and initialized successfully");
    Ok(())
}

#[tokio::test]
async fn test_resolver_management() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let resolver_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract.call("new").transact().await?;
    assert!(outcome.is_success(), "Contract initialization failed: {:?}", outcome.into_result());

    // Add resolver
    let outcome = contract
        .call("add_resolver")
        .args_json(json!({
            "resolver": resolver_account.id()
        }))
        .transact()
        .await?;
    
    assert!(outcome.is_success());

    // Verify resolver was added
    let is_authorized: bool = contract
        .view("is_authorized_resolver")
        .args_json(json!({
            "resolver": resolver_account.id()
        }))
        .await?
        .json()?;
    
    let resolver_count: u64 = contract.view("get_resolver_count").await?.json()?;

    assert!(is_authorized);
    assert_eq!(resolver_count, 1);

    println!("✅ Resolver management working correctly");
    Ok(())
}

#[tokio::test]
async fn test_create_htlc_order() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let user_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract.call("new").transact().await?;
    assert!(outcome.is_success(), "Contract initialization failed: {:?}", outcome.into_result());

    // Create HTLC order
    let hashlock = "a".repeat(64); // 32-byte hex string
    let order_id = "test-order-001";
    let resolver_fee = NearToken::from_millinear(100); // 0.1 NEAR
    let deposit = NearToken::from_near(1); // 1 NEAR total

    let outcome = user_account
        .call(contract.id(), "create_order")
        .args_json(json!({
            "order_id": order_id,
            "hashlock": hashlock,
            "timelock": (worker.view_block().await?.height() + 1000).to_string(),
            "destination_chain": "ethereum",
            "destination_token": "USDC",
            "destination_amount": "100000000", // 100 USDC
            "destination_address": "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
            "resolver_fee": resolver_fee.as_yoctonear().to_string()
        }))
        .deposit(deposit)
        .transact()
        .await?;

    assert!(outcome.is_success());

    // Verify order was created
    let order: Option<serde_json::Value> = contract
        .view("get_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .await?
        .json()?;

    assert!(order.is_some());
    let order = order.unwrap();
    assert_eq!(order["id"], order_id);
    assert_eq!(order["hashlock"], hashlock);
    assert_eq!(order["maker"], user_account.id().as_str());
    assert_eq!(order["is_claimed"], false);
    assert_eq!(order["is_refunded"], false);

    println!("✅ HTLC order creation working correctly");
    Ok(())
}

#[tokio::test]
async fn test_match_order_workflow() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let user_account = worker.dev_create_account().await?;
    let resolver_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract.call("new").transact().await?;
    assert!(outcome.is_success(), "Contract initialization failed: {:?}", outcome.into_result());

    // Add resolver
    let outcome = contract
        .call("add_resolver")
        .args_json(json!({
            "resolver": resolver_account.id()
        }))
        .transact()
        .await?;
    assert!(outcome.is_success(), "Add resolver failed: {:?}", outcome.into_result());

    // Create order
    let order_id = "test-order-002";
    let hashlock = "b".repeat(64);
    let resolver_fee = NearToken::from_millinear(100);
    let deposit = NearToken::from_near(1);

    let outcome = user_account
        .call(contract.id(), "create_order")
        .args_json(json!({
            "order_id": order_id,
            "hashlock": hashlock,
            "timelock": (worker.view_block().await?.height() + 1000).to_string(),
            "destination_chain": "ethereum",
            "destination_token": "USDC",
            "destination_amount": "100000000",
            "destination_address": "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
            "resolver_fee": resolver_fee.as_yoctonear().to_string()
        }))
        .deposit(deposit)
        .transact()
        .await?;
    assert!(outcome.is_success(), "Create order failed: {:?}", outcome.into_result());

    // Match order with resolver
    let safety_deposit = NearToken::from_millinear(90); // 10% of 0.9 NEAR locked amount

    let outcome = resolver_account
        .call(contract.id(), "match_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .deposit(safety_deposit)
        .transact()
        .await?;

    assert!(outcome.is_success());

    // Verify order was matched
    let order: serde_json::Value = contract
        .view("get_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .await?
        .json::<Option<serde_json::Value>>()?
        .unwrap();

    assert_eq!(order["resolver"], resolver_account.id().as_str());
    assert_eq!(order["safety_deposit"], safety_deposit.as_yoctonear().to_string());

    println!("✅ Order matching workflow working correctly");
    Ok(())
}

#[tokio::test]
async fn test_claim_order_with_preimage() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let user_account = worker.dev_create_account().await?;
    let resolver_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract.call("new").transact().await?;
    assert!(outcome.is_success(), "Contract initialization failed: {:?}", outcome.into_result());

    // Add resolver
    let outcome = contract
        .call("add_resolver")
        .args_json(json!({
            "resolver": resolver_account.id()
        }))
        .transact()
        .await?;
    assert!(outcome.is_success(), "Add resolver failed: {:?}", outcome.into_result());

    // Generate real hashlock and preimage for testing
    let preimage = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    let preimage_bytes = hex::decode(preimage)?;
    let mut hasher = Sha256::new();
    hasher.update(&preimage_bytes);
    let hash_result = hasher.finalize();
    let hashlock = hex::encode(hash_result);

    let order_id = "test-order-003";
    let resolver_fee = NearToken::from_millinear(100);
    let deposit = NearToken::from_near(1);

    // Create order
    let outcome = user_account
        .call(contract.id(), "create_order")
        .args_json(json!({
            "order_id": order_id,
            "hashlock": hashlock,
            "timelock": (worker.view_block().await?.height() + 1000).to_string(),
            "destination_chain": "ethereum",
            "destination_token": "USDC",
            "destination_amount": "100000000",
            "destination_address": "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
            "resolver_fee": resolver_fee.as_yoctonear().to_string()
        }))
        .deposit(deposit)
        .transact()
        .await?;
    assert!(outcome.is_success(), "Create order failed: {:?}", outcome.into_result());

    // Match order
    let safety_deposit = NearToken::from_millinear(90);
    let outcome = resolver_account
        .call(contract.id(), "match_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .deposit(safety_deposit)
        .transact()
        .await?;
    assert!(outcome.is_success(), "Match order failed: {:?}", outcome.into_result());

    // Get resolver balance before claim
    let resolver_balance_before = resolver_account.view_account().await?.balance;

    // Claim order with preimage
    let outcome = resolver_account
        .call(contract.id(), "claim_order")
        .args_json(json!({
            "order_id": order_id,
            "preimage": preimage
        }))
        .transact()
        .await?;

    assert!(outcome.is_success());

    // Verify order was claimed
    let order: serde_json::Value = contract
        .view("get_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .await?
        .json::<Option<serde_json::Value>>()?
        .unwrap();

    assert_eq!(order["is_claimed"], true);
    assert_eq!(order["preimage"], preimage);

    // Verify resolver received payment
    let resolver_balance_after = resolver_account.view_account().await?.balance;
    assert!(resolver_balance_after > resolver_balance_before);

    println!("✅ Order claiming with preimage working correctly");
    Ok(())
}

#[tokio::test]
async fn test_cancel_expired_order() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let user_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract.call("new").transact().await?;
    assert!(outcome.is_success(), "Contract initialization failed: {:?}", outcome.into_result());

    let order_id = "test-order-004";
    let hashlock = "c".repeat(64);
    let resolver_fee = NearToken::from_millinear(100);
    let deposit = NearToken::from_near(1);
    
    // Create order with short timelock
    let current_block = worker.view_block().await?.height();
    let short_timelock = current_block + 5; // Very short timelock for testing

    let outcome = user_account
        .call(contract.id(), "create_order")
        .args_json(json!({
            "order_id": order_id,
            "hashlock": hashlock,
            "timelock": short_timelock.to_string(),
            "destination_chain": "ethereum",
            "destination_token": "USDC",
            "destination_amount": "100000000",
            "destination_address": "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
            "resolver_fee": resolver_fee.as_yoctonear().to_string()
        }))
        .deposit(deposit)
        .transact()
        .await?;
    assert!(outcome.is_success(), "Create order failed: {:?}", outcome.into_result());

    // Fast forward blockchain to expire the order
    worker.fast_forward(10).await?;

    // Get user balance before cancellation
    let user_balance_before = user_account.view_account().await?.balance;

    // Cancel expired order
    let outcome = user_account
        .call(contract.id(), "cancel_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .transact()
        .await?;

    assert!(outcome.is_success());

    // Verify order was cancelled
    let order: serde_json::Value = contract
        .view("get_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .await?
        .json::<Option<serde_json::Value>>()?
        .unwrap();

    assert_eq!(order["is_refunded"], true);

    // Verify user got refunded
    let user_balance_after = user_account.view_account().await?.balance;
    assert!(user_balance_after > user_balance_before);

    println!("✅ Order cancellation working correctly");
    Ok(())
}

#[tokio::test]
async fn test_unauthorized_resolver_fails() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let user_account = worker.dev_create_account().await?;
    let unauthorized_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract.call("new").transact().await?;
    assert!(outcome.is_success(), "Contract initialization failed: {:?}", outcome.into_result());

    // Create order
    let order_id = "test-order-005";
    let hashlock = "d".repeat(64);
    let resolver_fee = NearToken::from_millinear(100);
    let deposit = NearToken::from_near(1);

    let outcome = user_account
        .call(contract.id(), "create_order")
        .args_json(json!({
            "order_id": order_id,
            "hashlock": hashlock,
            "timelock": (worker.view_block().await?.height() + 1000).to_string(),
            "destination_chain": "ethereum",
            "destination_token": "USDC",
            "destination_amount": "100000000",
            "destination_address": "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
            "resolver_fee": resolver_fee.as_yoctonear().to_string()
        }))
        .deposit(deposit)
        .transact()
        .await?;
    assert!(outcome.is_success(), "Create order failed: {:?}", outcome.into_result());

    // Try to match order with unauthorized account
    let outcome = unauthorized_account
        .call(contract.id(), "match_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .deposit(NearToken::from_millinear(90))
        .transact()
        .await?;

    // Should fail
    assert!(outcome.is_failure());
    
    // Check error message contains expected text
    let error_message = format!("{:?}", outcome.receipt_failures()[0]);
    assert!(error_message.contains("Not an authorized resolver"));

    println!("✅ Unauthorized resolver protection working correctly");
    Ok(())
}

#[tokio::test]
async fn test_full_cross_chain_swap_simulation() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let user_account = worker.dev_create_account().await?;
    let resolver_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract.call("new").transact().await?;
    assert!(outcome.is_success(), "Contract initialization failed: {:?}", outcome.into_result());

    // Add resolver
    let outcome = contract
        .call("add_resolver")
        .args_json(json!({
            "resolver": resolver_account.id()
        }))
        .transact()
        .await?;
    assert!(outcome.is_success(), "Add resolver failed: {:?}", outcome.into_result());

    println!("🔄 Starting full cross-chain swap simulation...");

    // Step 1: Create cross-chain swap order (NEAR → Ethereum)
    let preimage = "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321";
    let preimage_bytes = hex::decode(preimage)?;
    let mut hasher = Sha256::new();
    hasher.update(&preimage_bytes);
    let hash_result = hasher.finalize();
    let hashlock = hex::encode(hash_result);

    let order_id = "cross-chain-swap-001";
    let swap_amount = NearToken::from_near(5); // 5 NEAR
    let resolver_fee = NearToken::from_millinear(250); // 0.25 NEAR resolver fee
    let total_deposit = swap_amount.saturating_add(resolver_fee);

    println!("📝 Creating cross-chain swap order...");
    let create_outcome = user_account
        .call(contract.id(), "create_order")
        .args_json(json!({
            "order_id": order_id,
            "hashlock": hashlock,
            "timelock": (worker.view_block().await?.height() + 1000).to_string(),
            "destination_chain": "ethereum-sepolia",
            "destination_token": "USDC", 
            "destination_amount": "1000000000", // 1000 USDC (6 decimals)
            "destination_address": "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
            "resolver_fee": resolver_fee.as_yoctonear().to_string()
        }))
        .deposit(total_deposit)
        .transact()
        .await?;

    assert!(create_outcome.is_success());
    println!("✅ Order created: {} NEAR → 1000 USDC", swap_amount.as_near());

    // Step 2: Resolver commits to fulfillment
    let safety_deposit = NearToken::from_millinear(500); // 10% safety deposit
    
    println!("🤝 Resolver matching order...");
    let match_outcome = resolver_account
        .call(contract.id(), "match_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .deposit(safety_deposit)
        .transact()
        .await?;

    assert!(match_outcome.is_success());
    println!("✅ Order matched with {} NEAR safety deposit", safety_deposit.as_near());

    // Step 3: Simulate cross-chain execution (resolver claims with preimage)
    let resolver_balance_before = resolver_account.view_account().await?.balance;
    
    println!("🔐 Resolver claiming with preimage...");
    let claim_outcome = resolver_account
        .call(contract.id(), "claim_order")
        .args_json(json!({
            "order_id": order_id,
            "preimage": preimage
        }))
        .transact()
        .await?;

    assert!(claim_outcome.is_success());
    
    // Verify final state
    let order: serde_json::Value = contract
        .view("get_order")
        .args_json(json!({
            "order_id": order_id
        }))
        .await?
        .json::<Option<serde_json::Value>>()?
        .unwrap();

    assert_eq!(order["is_claimed"], true);
    assert_eq!(order["preimage"], preimage);
    
    let resolver_balance_after = resolver_account.view_account().await?.balance;
    assert!(resolver_balance_after > resolver_balance_before);

    println!("💰 Resolver received: {} NEAR + {} NEAR fee", 
             swap_amount.as_near(), resolver_fee.as_near());
    println!("🎉 Cross-chain swap simulation completed successfully!");
    println!("📊 Final status: Order claimed, funds transferred atomically");

    Ok(())
}

#[tokio::test] 
async fn test_contract_event_logs() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let user_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract.call("new").transact().await?;
    assert!(outcome.is_success(), "Contract initialization failed: {:?}", outcome.into_result());

    // Create order and check logs
    let order_id = "test-order-logs";
    let hashlock = "e".repeat(64);
    let resolver_fee = NearToken::from_millinear(100);
    let deposit = NearToken::from_near(1);

    let outcome = user_account
        .call(contract.id(), "create_order")
        .args_json(json!({
            "order_id": order_id,
            "hashlock": hashlock,
            "timelock": (worker.view_block().await?.height() + 1000).to_string(),
            "destination_chain": "ethereum",
            "destination_token": "USDC",
            "destination_amount": "100000000",
            "destination_address": "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
            "resolver_fee": resolver_fee.as_yoctonear().to_string()
        }))
        .deposit(deposit)
        .transact()
        .await?;

    // Check that ORDER_CREATED event was emitted
    let logs = outcome.logs();
    let has_order_created_event = logs.iter().any(|log| log.contains("ORDER_CREATED"));
    assert!(has_order_created_event);

    println!("✅ Event logging working correctly");
    Ok(())
}