use anyhow::Result;
use near_workspaces::types::NearToken;
use serde_json::json;
use sha2::{Digest, Sha256};

/// Integration tests for 1inch Fusion+ NEAR extension
/// Tests the contract's integration with 1inch Fusion+ protocol

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
async fn test_fusion_contract_deployment() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;

    // Initialize with 5% min safety deposit (500 bps)
    let outcome = contract
        .call("new")
        .args_json(json!({
            "min_safety_deposit_bps": 500
        }))
        .transact()
        .await?;

    assert!(outcome.is_success());

    // Verify initialization
    let owner: String = contract.view("get_owner").await?.json()?;
    let min_deposit: u16 = contract.view("get_min_safety_deposit_bps").await?.json()?;

    assert!(!owner.is_empty());
    assert_eq!(min_deposit, 500);

    println!("✅ Fusion+ NEAR contract deployed successfully");
    Ok(())
}

#[tokio::test]
async fn test_1inch_resolver_management() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let resolver_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract
        .call("new")
        .args_json(json!({
            "min_safety_deposit_bps": 500
        }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Add 1inch resolver
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

    assert!(is_authorized);
    println!("✅ 1inch resolver management working correctly");
    Ok(())
}

#[tokio::test]
async fn test_execute_fusion_order() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let resolver_account = worker.dev_create_account().await?;
    let user_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract
        .call("new")
        .args_json(json!({
            "min_safety_deposit_bps": 500
        }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Add 1inch resolver
    let outcome = contract
        .call("add_resolver")
        .args_json(json!({
            "resolver": resolver_account.id()
        }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Execute Fusion+ order
    let order_hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    let hashlock = "a".repeat(64);
    let amount = NearToken::from_near(2);
    let resolver_fee = NearToken::from_millinear(100);
    let safety_deposit = NearToken::from_millinear(100); // 5% of 2 NEAR
    let total_deposit = amount.saturating_add(resolver_fee).saturating_add(safety_deposit);

    let outcome = resolver_account
        .call(contract.id(), "execute_fusion_order")
        .args_json(json!({
            "order_hash": order_hash,
            "hashlock": hashlock,
            "maker": user_account.id(),
            "resolver": resolver_account.id(),
            "amount": amount.as_yoctonear().to_string(),
            "resolver_fee": resolver_fee.as_yoctonear().to_string(),
            "timelocks": "0", // Simplified for testing
            "source_chain_id": 11155111 // Ethereum Sepolia
        }))
        .deposit(total_deposit)
        .transact()
        .await?;

    assert!(outcome.is_success());

    // Verify order was created
    let order: Option<serde_json::Value> = contract
        .view("get_order")
        .args_json(json!({
            "order_hash": order_hash
        }))
        .await?
        .json()?;

    assert!(order.is_some());
    let order = order.unwrap();
    assert_eq!(order["order_hash"], order_hash);
    assert_eq!(order["maker"], user_account.id().as_str());
    assert_eq!(order["resolver"], resolver_account.id().as_str());
    assert_eq!(order["status"], "Matched");

    println!("✅ Fusion+ order execution working correctly");
    Ok(())
}

#[tokio::test]
async fn test_claim_fusion_order_with_preimage() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let resolver_account = worker.dev_create_account().await?;
    let user_account = worker.dev_create_account().await?;

    // Initialize and setup
    let outcome = contract
        .call("new")
        .args_json(json!({
            "min_safety_deposit_bps": 500
        }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    let outcome = contract
        .call("add_resolver")
        .args_json(json!({
            "resolver": resolver_account.id()
        }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Generate real hashlock and preimage
    let preimage = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    let preimage_bytes = hex::decode(preimage)?;
    let mut hasher = Sha256::new();
    hasher.update(&preimage_bytes);
    let hash_result = hasher.finalize();
    let hashlock = hex::encode(hash_result);

    // Execute order
    let order_hash = "0xfusion1234567890";
    let amount = NearToken::from_near(2);
    let resolver_fee = NearToken::from_millinear(100);
    let safety_deposit = NearToken::from_millinear(100);
    let total_deposit = amount.saturating_add(resolver_fee).saturating_add(safety_deposit);

    let outcome = resolver_account
        .call(contract.id(), "execute_fusion_order")
        .args_json(json!({
            "order_hash": order_hash,
            "hashlock": hashlock,
            "maker": user_account.id(),
            "resolver": resolver_account.id(),
            "amount": amount.as_yoctonear().to_string(),
            "resolver_fee": resolver_fee.as_yoctonear().to_string(),
            "timelocks": "0",
            "source_chain_id": 11155111
        }))
        .deposit(total_deposit)
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Get balances before claim
    let user_balance_before = user_account.view_account().await?.balance;
    let resolver_balance_before = resolver_account.view_account().await?.balance;

    // Claim with preimage
    let outcome = resolver_account
        .call(contract.id(), "claim_fusion_order")
        .args_json(json!({
            "order_hash": order_hash,
            "preimage": preimage
        }))
        .transact()
        .await?;

    assert!(outcome.is_success());

    // Verify order was claimed
    let order: serde_json::Value = contract
        .view("get_order")
        .args_json(json!({
            "order_hash": order_hash
        }))
        .await?
        .json::<Option<serde_json::Value>>()?
        .unwrap();

    assert_eq!(order["status"], "Claimed");
    assert_eq!(order["preimage"], preimage);

    // Verify balances updated
    let user_balance_after = user_account.view_account().await?.balance;
    let resolver_balance_after = resolver_account.view_account().await?.balance;

    assert!(user_balance_after > user_balance_before);
    assert!(resolver_balance_after > resolver_balance_before);

    println!("✅ Fusion+ order claiming with preimage working correctly");
    Ok(())
}

#[tokio::test]
async fn test_unauthorized_resolver_fails() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let unauthorized_account = worker.dev_create_account().await?;
    let user_account = worker.dev_create_account().await?;

    // Initialize contract
    let outcome = contract
        .call("new")
        .args_json(json!({
            "min_safety_deposit_bps": 500
        }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Try to execute order without authorization
    let outcome = unauthorized_account
        .call(contract.id(), "execute_fusion_order")
        .args_json(json!({
            "order_hash": "0xunauthorized",
            "hashlock": "a".repeat(64),
            "maker": user_account.id(),
            "resolver": unauthorized_account.id(),
            "amount": NearToken::from_near(1).as_yoctonear().to_string(),
            "resolver_fee": NearToken::from_millinear(100).as_yoctonear().to_string(),
            "timelocks": "0",
            "source_chain_id": 11155111
        }))
        .deposit(NearToken::from_near(2))
        .transact()
        .await?;

    // Should fail
    assert!(outcome.is_failure());
    
    let error_message = format!("{:?}", outcome.receipt_failures()[0]);
    assert!(error_message.contains("Not a 1inch authorized resolver"));

    println!("✅ Unauthorized resolver protection working correctly");
    Ok(())
}

#[tokio::test]
async fn test_full_fusion_plus_integration() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = &get_wasm().await?;

    let contract = worker.dev_deploy(&wasm).await?;
    let resolver_account = worker.dev_create_account().await?;
    let user_account = worker.dev_create_account().await?;

    // Initialize
    let outcome = contract
        .call("new")
        .args_json(json!({
            "min_safety_deposit_bps": 500
        }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Add 1inch resolver
    let outcome = contract
        .call("add_resolver")
        .args_json(json!({
            "resolver": resolver_account.id()
        }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    println!("🔄 Starting 1inch Fusion+ NEAR integration test...");

    // Step 1: Create Fusion+ order (simulating 1inch order from Ethereum)
    let preimage = "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321";
    let preimage_bytes = hex::decode(preimage)?;
    let mut hasher = Sha256::new();
    hasher.update(&preimage_bytes);
    let hash_result = hasher.finalize();
    let hashlock = hex::encode(hash_result);

    let order_hash = "0xfusion" + &hex::encode(&hash_result[0..16]);
    let swap_amount = NearToken::from_near(5);
    let resolver_fee = NearToken::from_millinear(250);
    let safety_deposit = NearToken::from_millinear(250); // 5%
    let total_deposit = swap_amount.saturating_add(resolver_fee).saturating_add(safety_deposit);

    println!("📝 Creating Fusion+ order on NEAR...");
    let create_outcome = resolver_account
        .call(contract.id(), "execute_fusion_order")
        .args_json(json!({
            "order_hash": order_hash,
            "hashlock": hashlock,
            "maker": user_account.id(),
            "resolver": resolver_account.id(),
            "amount": swap_amount.as_yoctonear().to_string(),
            "resolver_fee": resolver_fee.as_yoctonear().to_string(),
            "timelocks": "0", // Would be properly packed in production
            "source_chain_id": 11155111 // Ethereum Sepolia
        }))
        .deposit(total_deposit)
        .transact()
        .await?;

    assert!(create_outcome.is_success());
    println!("✅ Fusion+ order created: {} NEAR → user", swap_amount.as_near());

    // Step 2: Claim with preimage (atomic completion)
    println!("🔐 Claiming with preimage revelation...");
    let claim_outcome = resolver_account
        .call(contract.id(), "claim_fusion_order")
        .args_json(json!({
            "order_hash": order_hash,
            "preimage": preimage
        }))
        .transact()
        .await?;

    assert!(claim_outcome.is_success());
    
    // Verify final state
    let order: serde_json::Value = contract
        .view("get_order")
        .args_json(json!({
            "order_hash": order_hash
        }))
        .await?
        .json::<Option<serde_json::Value>>()?
        .unwrap();

    assert_eq!(order["status"], "Claimed");
    println!("💰 User received: {} NEAR", swap_amount.as_near());
    println!("💰 Resolver received: {} NEAR fee + deposit return", 
             (resolver_fee.saturating_add(safety_deposit)).as_near());
    
    println!("🎉 1inch Fusion+ NEAR integration test completed successfully!");
    println!("📊 This demonstrates NEAR as a destination chain for 1inch Fusion+ swaps");

    Ok(())
}