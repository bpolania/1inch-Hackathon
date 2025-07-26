#[cfg(test)]
mod tests {
    use crate::{
        execute, instantiate, query, ContractError, ExecuteMsg, FusionPlusOrder, InstantiateMsg,
        OrderStatus, QueryMsg, ConfigResponse, OrderResponse, ListOrdersResponse, ResolverResponse,
    };
    use cosmwasm_std::{
        testing::{mock_dependencies, mock_env, mock_info},
        coins, from_binary, Addr, Uint128, Timestamp,
    };
    use sha2::{Sha256, Digest};

    const ADMIN: &str = "admin";
    const RESOLVER: &str = "resolver";
    const MAKER: &str = "maker";
    const NATIVE_DENOM: &str = "untrn";

    fn proper_instantiate() -> (cosmwasm_std::testing::MockDeps, Addr) {
        let mut deps = mock_dependencies();
        let admin_addr = Addr::unchecked(ADMIN);

        let msg = InstantiateMsg {
            admin: Some(ADMIN.to_string()),
            min_safety_deposit_bps: Some(500), // 5%
            native_denom: NATIVE_DENOM.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        let res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(0, res.messages.len());

        (deps, admin_addr)
    }

    fn generate_test_hashlock(preimage: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(preimage.as_bytes());
        let result = hasher.finalize();
        hex::encode(result)
    }

    #[test]
    fn test_instantiate() {
        let (deps, _) = proper_instantiate();

        // Check config
        let res = query(deps.as_ref(), mock_env(), QueryMsg::Config {}).unwrap();
        let config: ConfigResponse = from_binary(&res).unwrap();
        assert_eq!(ADMIN, config.admin.as_str());
        assert_eq!(500, config.min_safety_deposit_bps);
        assert_eq!(NATIVE_DENOM, config.native_denom);

        // Check admin is authorized resolver
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::IsAuthorizedResolver {
                address: ADMIN.to_string(),
            },
        )
        .unwrap();
        let resolver_resp: ResolverResponse = from_binary(&res).unwrap();
        assert!(resolver_resp.is_authorized);
    }

    #[test]
    fn test_add_remove_resolver() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(res.attributes[0].value, "add_resolver");

        // Check resolver is authorized
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::IsAuthorizedResolver {
                address: RESOLVER.to_string(),
            },
        )
        .unwrap();
        let resolver_resp: ResolverResponse = from_binary(&res).unwrap();
        assert!(resolver_resp.is_authorized);

        // Remove resolver
        let msg = ExecuteMsg::RemoveResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(res.attributes[0].value, "remove_resolver");

        // Check resolver is not authorized
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::IsAuthorizedResolver {
                address: RESOLVER.to_string(),
            },
        )
        .unwrap();
        let resolver_resp: ResolverResponse = from_binary(&res).unwrap();
        assert!(!resolver_resp.is_authorized);
    }

    #[test]
    fn test_unauthorized_resolver_operations() {
        let (mut deps, _) = proper_instantiate();

        // Try to add resolver as non-admin
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info("not_admin", &[]);
        let err = execute(deps.as_mut(), mock_env(), info, msg).unwrap_err();
        assert!(matches!(err, ContractError::Unauthorized {}));

        // Try to execute order as unauthorized resolver
        let preimage = "test_secret";
        let hashlock = generate_test_hashlock(preimage);
        
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "test_order".to_string(),
            hashlock,
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount: Uint128::from(1000000u128),
            resolver_fee: Uint128::from(50000u128),
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        let info = mock_info("unauthorized", &coins(1100000, NATIVE_DENOM));
        let err = execute(deps.as_mut(), mock_env(), info, msg).unwrap_err();
        assert!(matches!(err, ContractError::UnauthorizedResolver {}));
    }

    #[test]
    fn test_execute_fusion_order() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Execute fusion order
        let preimage = "test_secret_123";
        let hashlock = generate_test_hashlock(preimage);
        let amount = Uint128::from(1000000u128); // 1 NTRN
        let resolver_fee = Uint128::from(50000u128); // 0.05 NTRN
        let safety_deposit = amount.checked_mul(Uint128::from(500u128)).unwrap()
            .checked_div(Uint128::from(10000u128)).unwrap(); // 5%
        let total_required = amount + resolver_fee + safety_deposit;

        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "test_order_123".to_string(),
            hashlock: hashlock.clone(),
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount,
            resolver_fee,
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        let info = mock_info(RESOLVER, &coins(total_required.u128(), NATIVE_DENOM));
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        
        // Check response attributes
        assert_eq!(res.attributes[0].value, "execute_fusion_order");
        assert_eq!(res.attributes[1].value, "test_order_123");

        // Query order
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::GetOrder {
                order_hash: "test_order_123".to_string(),
            },
        )
        .unwrap();
        let order_resp: OrderResponse = from_binary(&res).unwrap();
        
        assert_eq!(order_resp.order.order_hash, "test_order_123");
        assert_eq!(order_resp.order.hashlock, hashlock);
        assert_eq!(order_resp.order.maker, Addr::unchecked(MAKER));
        assert_eq!(order_resp.order.resolver, Addr::unchecked(RESOLVER));
        assert_eq!(order_resp.order.amount, amount);
        assert_eq!(order_resp.order.resolver_fee, resolver_fee);
        assert_eq!(order_resp.order.safety_deposit, safety_deposit);
        assert_eq!(order_resp.order.status, OrderStatus::Matched);
        assert_eq!(order_resp.order.source_chain_id, 11155111);
    }

    #[test]
    fn test_insufficient_funds() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Try to execute order with insufficient funds
        let preimage = "test_secret";
        let hashlock = generate_test_hashlock(preimage);
        
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "test_order".to_string(),
            hashlock,
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount: Uint128::from(1000000u128),
            resolver_fee: Uint128::from(50000u128),
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        
        // Send less than required
        let info = mock_info(RESOLVER, &coins(500000, NATIVE_DENOM));
        let err = execute(deps.as_mut(), mock_env(), info, msg).unwrap_err();
        assert!(matches!(err, ContractError::InsufficientSafetyDeposit { .. }));
    }

    #[test]
    fn test_invalid_hashlock() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Try with invalid hashlock
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "test_order".to_string(),
            hashlock: "invalid_hash".to_string(), // Invalid format
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount: Uint128::from(1000000u128),
            resolver_fee: Uint128::from(50000u128),
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
        let err = execute(deps.as_mut(), mock_env(), info, msg).unwrap_err();
        assert!(matches!(err, ContractError::InvalidHashlock {}));
    }

    #[test]
    fn test_claim_fusion_order() {
        let (mut deps, _) = proper_instantiate();

        // Setup: Add resolver and create order
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        let preimage = "secret_preimage_123";
        let hashlock = generate_test_hashlock(preimage);
        let amount = Uint128::from(1000000u128);
        let resolver_fee = Uint128::from(50000u128);
        let safety_deposit = Uint128::from(50000u128); // 5%
        let total_required = amount + resolver_fee + safety_deposit;

        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "claim_test_order".to_string(),
            hashlock: hashlock.clone(),
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount,
            resolver_fee,
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        let info = mock_info(RESOLVER, &coins(total_required.u128(), NATIVE_DENOM));
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Claim order
        let msg = ExecuteMsg::ClaimFusionOrder {
            order_hash: "claim_test_order".to_string(),
            preimage: preimage.to_string(),
        };
        let info = mock_info(RESOLVER, &[]);
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Check messages (transfers)
        assert_eq!(res.messages.len(), 3); // Amount to maker, fee to resolver, safety deposit to resolver

        // Check order status updated
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::GetOrder {
                order_hash: "claim_test_order".to_string(),
            },
        )
        .unwrap();
        let order_resp: OrderResponse = from_binary(&res).unwrap();
        assert_eq!(order_resp.order.status, OrderStatus::Claimed);
        assert_eq!(order_resp.order.preimage, Some(preimage.to_string()));
    }

    #[test]
    fn test_claim_with_wrong_preimage() {
        let (mut deps, _) = proper_instantiate();

        // Setup order
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        let preimage = "correct_secret";
        let hashlock = generate_test_hashlock(preimage);
        
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "wrong_preimage_test".to_string(),
            hashlock,
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount: Uint128::from(1000000u128),
            resolver_fee: Uint128::from(50000u128),
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Try to claim with wrong preimage
        let msg = ExecuteMsg::ClaimFusionOrder {
            order_hash: "wrong_preimage_test".to_string(),
            preimage: "wrong_secret".to_string(),
        };
        let info = mock_info(RESOLVER, &[]);
        let err = execute(deps.as_mut(), mock_env(), info, msg).unwrap_err();
        assert!(matches!(err, ContractError::InvalidPreimage {}));
    }

    #[test]
    fn test_refund_after_timeout() {
        let (mut deps, _) = proper_instantiate();

        // Setup order
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        let preimage = "timeout_test_secret";
        let hashlock = generate_test_hashlock(preimage);
        
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "timeout_test_order".to_string(),
            hashlock,
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount: Uint128::from(1000000u128),
            resolver_fee: Uint128::from(50000u128),
            source_chain_id: 11155111,
            timeout_seconds: 10, // Short timeout for testing
        };
        let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Fast forward time past timeout
        let mut env = mock_env();
        env.block.time = env.block.time.plus_seconds(20);

        // Refund order
        let msg = ExecuteMsg::RefundOrder {
            order_hash: "timeout_test_order".to_string(),
        };
        let info = mock_info(RESOLVER, &[]);
        let res = execute(deps.as_mut(), env, info, msg).unwrap();

        // Check refund message
        assert_eq!(res.messages.len(), 1);

        // Check order status
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::GetOrder {
                order_hash: "timeout_test_order".to_string(),
            },
        )
        .unwrap();
        let order_resp: OrderResponse = from_binary(&res).unwrap();
        assert_eq!(order_resp.order.status, OrderStatus::Refunded);
    }

    #[test]
    fn test_refund_before_timeout_fails() {
        let (mut deps, _) = proper_instantiate();

        // Setup order
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        let preimage = "early_refund_secret";
        let hashlock = generate_test_hashlock(preimage);
        
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "early_refund_order".to_string(),
            hashlock,
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount: Uint128::from(1000000u128),
            resolver_fee: Uint128::from(50000u128),
            source_chain_id: 11155111,
            timeout_seconds: 3600, // Long timeout
        };
        let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Try to refund before timeout
        let msg = ExecuteMsg::RefundOrder {
            order_hash: "early_refund_order".to_string(),
        };
        let info = mock_info(RESOLVER, &[]);
        let err = execute(deps.as_mut(), mock_env(), info, msg).unwrap_err();
        assert!(matches!(err, ContractError::TimelockNotExpired {}));
    }

    #[test]
    fn test_list_orders() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Create multiple orders
        for i in 0..3 {
            let preimage = format!("secret_{}", i);
            let hashlock = generate_test_hashlock(&preimage);
            
            let msg = ExecuteMsg::ExecuteFusionOrder {
                order_hash: format!("order_{}", i),
                hashlock,
                timelocks: "123456789".to_string(),
                maker: MAKER.to_string(),
                amount: Uint128::from(1000000u128),
                resolver_fee: Uint128::from(50000u128),
                source_chain_id: 11155111,
                timeout_seconds: 3600,
            };
            let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
            execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        }

        // List all orders
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::ListOrders {
                status: None,
                start_after: None,
                limit: None,
            },
        )
        .unwrap();
        let orders_resp: ListOrdersResponse = from_binary(&res).unwrap();
        assert_eq!(orders_resp.orders.len(), 3);

        // List orders by status
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::ListOrders {
                status: Some(OrderStatus::Matched),
                start_after: None,
                limit: None,
            },
        )
        .unwrap();
        let orders_resp: ListOrdersResponse = from_binary(&res).unwrap();
        assert_eq!(orders_resp.orders.len(), 3);
    }

    #[test]
    fn test_duplicate_order_fails() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        let preimage = "duplicate_test";
        let hashlock = generate_test_hashlock(preimage);
        
        // Create first order
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "duplicate_order".to_string(),
            hashlock: hashlock.clone(),
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount: Uint128::from(1000000u128),
            resolver_fee: Uint128::from(50000u128),
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
        execute(deps.as_mut(), mock_env(), info, msg.clone()).unwrap();

        // Try to create duplicate order
        let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
        let err = execute(deps.as_mut(), mock_env(), info, msg).unwrap_err();
        assert!(matches!(err, ContractError::OrderAlreadyExists { .. }));
    }

    #[test]
    fn test_update_config() {
        let (mut deps, _) = proper_instantiate();

        // Update config
        let msg = ExecuteMsg::UpdateConfig {
            admin: Some("new_admin".to_string()),
            min_safety_deposit_bps: Some(1000), // 10%
        };
        let info = mock_info(ADMIN, &[]);
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert!(res.attributes.iter().any(|attr| attr.key == "new_admin"));
        assert!(res.attributes.iter().any(|attr| attr.key == "new_min_safety_deposit_bps"));

        // Check updated config
        let res = query(deps.as_ref(), mock_env(), QueryMsg::Config {}).unwrap();
        let config: ConfigResponse = from_binary(&res).unwrap();
        assert_eq!("new_admin", config.admin.as_str());
        assert_eq!(1000, config.min_safety_deposit_bps);
    }

    #[test]
    fn test_unauthorized_config_update() {
        let (mut deps, _) = proper_instantiate();

        // Try to update config as non-admin
        let msg = ExecuteMsg::UpdateConfig {
            admin: Some("hacker".to_string()),
            min_safety_deposit_bps: None,
        };
        let info = mock_info("not_admin", &[]);
        let err = execute(deps.as_mut(), mock_env(), info, msg).unwrap_err();
        assert!(matches!(err, ContractError::Unauthorized {}));
    }

    #[test]
    fn test_edge_case_zero_amounts() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Try to execute order with zero amount
        let preimage = "zero_test";
        let hashlock = generate_test_hashlock(preimage);
        
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "zero_amount_order".to_string(),
            hashlock,
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount: Uint128::zero(),
            resolver_fee: Uint128::from(10000u128),
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        
        // Calculate required funds for zero amount order
        let safety_deposit = Uint128::from(0u128); // 5% of 0 = 0
        let total_required = Uint128::zero() + Uint128::from(10000u128) + safety_deposit;
        
        let info = mock_info(RESOLVER, &coins(total_required.u128(), NATIVE_DENOM));
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(res.attributes[0].value, "execute_fusion_order");

        // Verify order was created with zero amount
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::GetOrder {
                order_hash: "zero_amount_order".to_string(),
            },
        )
        .unwrap();
        let order_resp: OrderResponse = from_binary(&res).unwrap();
        assert_eq!(order_resp.order.amount, Uint128::zero());
        assert_eq!(order_resp.order.safety_deposit, Uint128::zero());
    }

    #[test]
    fn test_maximum_timelock() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Execute order with very long timeout (1 week)
        let preimage = "long_timeout_test";
        let hashlock = generate_test_hashlock(preimage);
        
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "long_timeout_order".to_string(),
            hashlock,
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount: Uint128::from(1000000u128),
            resolver_fee: Uint128::from(50000u128),
            source_chain_id: 11155111,
            timeout_seconds: 604800, // 1 week
        };
        let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert!(res.attributes.iter().any(|attr| attr.key == "method" && attr.value == "execute_fusion_order"));
    }

    #[test]
    fn test_claim_after_multiple_orders() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Create multiple orders
        let orders = vec!["order_1", "order_2", "order_3"];
        let preimages = vec!["secret_1", "secret_2", "secret_3"];
        
        for (i, (&order_hash, &preimage)) in orders.iter().zip(preimages.iter()).enumerate() {
            let hashlock = generate_test_hashlock(preimage);
            
            let msg = ExecuteMsg::ExecuteFusionOrder {
                order_hash: order_hash.to_string(),
                hashlock,
                timelocks: "123456789".to_string(),
                maker: format!("maker_{}", i),
                amount: Uint128::from(1000000u128),
                resolver_fee: Uint128::from(50000u128),
                source_chain_id: 11155111,
                timeout_seconds: 3600,
            };
            let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
            execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        }

        // Claim middle order
        let msg = ExecuteMsg::ClaimFusionOrder {
            order_hash: "order_2".to_string(),
            preimage: "secret_2".to_string(),
        };
        let info = mock_info(RESOLVER, &[]);
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(res.messages.len(), 3); // Amount + fee + safety deposit

        // Verify only order_2 is claimed
        for (order_hash, expected_status) in ["order_1", "order_2", "order_3"].iter().zip([OrderStatus::Matched, OrderStatus::Claimed, OrderStatus::Matched].iter()) {
            let res = query(
                deps.as_ref(),
                mock_env(),
                QueryMsg::GetOrder {
                    order_hash: order_hash.to_string(),
                },
            )
            .unwrap();
            let order_resp: OrderResponse = from_binary(&res).unwrap();
            assert_eq!(order_resp.order.status, *expected_status);
        }
    }

    #[test]
    fn test_list_resolvers() {
        let (mut deps, _) = proper_instantiate();

        // Add multiple resolvers
        let resolvers = ["resolver1", "resolver2", "resolver3"];
        for resolver in resolvers.iter() {
            let msg = ExecuteMsg::AddResolver {
                resolver: resolver.to_string(),
            };
            let info = mock_info(ADMIN, &[]);
            execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        }

        // List all resolvers
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::ListResolvers {
                start_after: None,
                limit: None,
            },
        )
        .unwrap();
        let resolvers_resp: ListResolversResponse = from_binary(&res).unwrap();
        
        // Should have 4 resolvers (admin + 3 added)
        assert_eq!(resolvers_resp.resolvers.len(), 4);
        assert!(resolvers_resp.resolvers.contains(&Addr::unchecked(ADMIN)));
        assert!(resolvers_resp.resolvers.contains(&Addr::unchecked("resolver1")));
        assert!(resolvers_resp.resolvers.contains(&Addr::unchecked("resolver2")));
        assert!(resolvers_resp.resolvers.contains(&Addr::unchecked("resolver3")));
    }

    #[test]
    fn test_pagination_limits() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Create 5 orders for pagination testing
        for i in 0..5 {
            let preimage = format!("secret_paginate_{}", i);
            let hashlock = generate_test_hashlock(&preimage);
            
            let msg = ExecuteMsg::ExecuteFusionOrder {
                order_hash: format!("paginate_order_{}", i),
                hashlock,
                timelocks: "123456789".to_string(),
                maker: MAKER.to_string(),
                amount: Uint128::from(1000000u128),
                resolver_fee: Uint128::from(50000u128),
                source_chain_id: 11155111,
                timeout_seconds: 3600,
            };
            let info = mock_info(RESOLVER, &coins(1100000, NATIVE_DENOM));
            execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        }

        // Test limit functionality
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::ListOrders {
                status: None,
                start_after: None,
                limit: Some(3),
            },
        )
        .unwrap();
        let orders_resp: ListOrdersResponse = from_binary(&res).unwrap();
        assert_eq!(orders_resp.orders.len(), 3);

        // Test start_after functionality
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::ListOrders {
                status: None,
                start_after: Some("paginate_order_1".to_string()),
                limit: Some(2),
            },
        )
        .unwrap();
        let orders_resp: ListOrdersResponse = from_binary(&res).unwrap();
        assert_eq!(orders_resp.orders.len(), 2);
    }

    #[test]
    fn test_contract_version_info() {
        let (deps, _) = proper_instantiate();

        // Test that contract version is set during instantiation
        // This would typically be tested with migration queries
        // For now, just verify the contract instantiated successfully
        let res = query(deps.as_ref(), mock_env(), QueryMsg::Config {}).unwrap();
        let _config: ConfigResponse = from_binary(&res).unwrap();
        // Contract version info would be available via cw2 queries in a real environment
    }

    #[test] 
    fn test_safety_deposit_edge_cases() {
        let (mut deps, _) = proper_instantiate();

        // Test with custom high safety deposit ratio
        let msg = ExecuteMsg::UpdateConfig {
            admin: None,
            min_safety_deposit_bps: Some(2000), // 20%
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Execute order with high safety deposit requirement
        let preimage = "high_deposit_test";
        let hashlock = generate_test_hashlock(preimage);
        let amount = Uint128::from(1000000u128);
        let resolver_fee = Uint128::from(50000u128);
        let expected_safety_deposit = amount * Uint128::from(2000u128) / Uint128::from(10000u128); // 20%
        let total_required = amount + resolver_fee + expected_safety_deposit;
        
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "high_deposit_order".to_string(),
            hashlock,
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount,
            resolver_fee,
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        let info = mock_info(RESOLVER, &coins(total_required.u128(), NATIVE_DENOM));
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(res.attributes[0].value, "execute_fusion_order");

        // Verify safety deposit was calculated correctly
        let res = query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::GetOrder {
                order_hash: "high_deposit_order".to_string(),
            },
        )
        .unwrap();
        let order_resp: OrderResponse = from_binary(&res).unwrap();
        assert_eq!(order_resp.order.safety_deposit, expected_safety_deposit);
    }

    #[test]
    fn test_large_numbers() {
        let (mut deps, _) = proper_instantiate();

        // Add resolver
        let msg = ExecuteMsg::AddResolver {
            resolver: RESOLVER.to_string(),
        };
        let info = mock_info(ADMIN, &[]);
        execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // Test with large amounts (simulate whale transactions)
        let preimage = "whale_test";
        let hashlock = generate_test_hashlock(preimage);
        let amount = Uint128::from(1000000000000u128); // 1M tokens in micro units
        let resolver_fee = Uint128::from(50000000000u128); // 50K tokens in micro units
        let safety_deposit = amount * Uint128::from(500u128) / Uint128::from(10000u128); // 5%
        let total_required = amount + resolver_fee + safety_deposit;
        
        let msg = ExecuteMsg::ExecuteFusionOrder {
            order_hash: "whale_order".to_string(),
            hashlock,
            timelocks: "123456789".to_string(),
            maker: MAKER.to_string(),
            amount,
            resolver_fee,
            source_chain_id: 11155111,
            timeout_seconds: 3600,
        };
        let info = mock_info(RESOLVER, &coins(total_required.u128(), NATIVE_DENOM));
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(res.attributes[0].value, "execute_fusion_order");

        // Claim the large order
        let msg = ExecuteMsg::ClaimFusionOrder {
            order_hash: "whale_order".to_string(),
            preimage: preimage.to_string(),
        };
        let info = mock_info(RESOLVER, &[]);
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(res.messages.len(), 3); // Amount + fee + safety deposit transfers
    }
}