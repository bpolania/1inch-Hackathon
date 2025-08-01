use cosmwasm_std::{
    entry_point, to_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult, 
    Uint128, Addr, StdError, BankMsg, Coin, Event, Timestamp, CosmosMsg
};
use cw2::set_contract_version;
use cw_storage_plus::{Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use thiserror::Error;

// Contract name and version for migration info
const CONTRACT_NAME: &str = "fusion-plus-cosmos";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Overflow error")]
    Overflow {},

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Order not found: {order_hash}")]
    OrderNotFound { order_hash: String },

    #[error("Order already exists: {order_hash}")]
    OrderAlreadyExists { order_hash: String },

    #[error("Invalid hashlock format")]
    InvalidHashlock {},

    #[error("Invalid preimage")]
    InvalidPreimage {},

    #[error("Order already claimed")]
    OrderAlreadyClaimed {},

    #[error("Order already refunded")]
    OrderAlreadyRefunded {},

    #[error("Timelock not expired")]
    TimelockNotExpired {},

    #[error("Timelock expired")]
    TimelockExpired {},

    #[error("Insufficient safety deposit: expected {expected}, got {actual}")]
    InsufficientSafetyDeposit { expected: Uint128, actual: Uint128 },

    #[error("Only authorized resolvers can execute orders")]
    UnauthorizedResolver {},

    #[error("Invalid order status: {status}")]
    InvalidOrderStatus { status: String },
}

/// 1inch Fusion+ Order Structure for Cosmos
/// Compatible with 1inch Fusion+ protocol extension
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct FusionPlusOrder {
    /// 1inch Fusion+ order hash from Ethereum
    pub order_hash: String,
    /// SHA-256 hash for HTLC atomic coordination
    pub hashlock: String,
    /// Packed timelock stages (1inch format) - stored as string for compatibility
    pub timelocks: String,
    /// User receiving tokens on Cosmos
    pub maker: Addr,
    /// 1inch resolver executing the order
    pub resolver: Addr,
    /// Amount of native tokens to transfer (in micro units)
    pub amount: Uint128,
    /// Resolver fee from the 1inch order
    pub resolver_fee: Uint128,
    /// Safety deposit from 1inch system
    pub safety_deposit: Uint128,
    /// Order execution status
    pub status: OrderStatus,
    /// Preimage when revealed
    pub preimage: Option<String>,
    /// Source chain ID (e.g., Ethereum = 11155111)
    pub source_chain_id: u64,
    /// Block timestamp when order was created
    pub created_at: Timestamp,
    /// Timelock expiry timestamp
    pub timeout: Timestamp,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub enum OrderStatus {
    Pending,   // Order created, waiting for resolution
    Matched,   // Resolver has accepted order
    Claimed,   // Successfully claimed with preimage
    Refunded,  // Refunded after timeout
}

/// Contract configuration
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    /// Contract admin
    pub admin: Addr,
    /// Minimum safety deposit ratio in basis points (e.g., 500 = 5%)
    pub min_safety_deposit_bps: u16,
    /// Native token denomination for this chain
    pub native_denom: String,
}

/// Instantiation message
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    /// Contract admin address
    pub admin: Option<String>,
    /// Minimum safety deposit in basis points (default: 500 = 5%)
    pub min_safety_deposit_bps: Option<u16>,
    /// Native token denomination (e.g., "untrn", "ujuno", "uatom")
    pub native_denom: String,
}

/// Execute messages
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    /// Execute a 1inch Fusion+ order (resolver only)
    ExecuteFusionOrder {
        order_hash: String,
        hashlock: String,
        timelocks: String,
        maker: String,
        amount: Uint128,
        resolver_fee: Uint128,
        source_chain_id: u64,
        timeout_seconds: u64,
    },
    /// Claim order with preimage revelation
    ClaimFusionOrder {
        order_hash: String,
        preimage: String,
    },
    /// Refund order after timelock expiry
    RefundOrder {
        order_hash: String,
    },
    /// Add authorized resolver (admin only)
    AddResolver {
        resolver: String,
    },
    /// Remove authorized resolver (admin only)
    RemoveResolver {
        resolver: String,
    },
    /// Update contract configuration (admin only)
    UpdateConfig {
        admin: Option<String>,
        min_safety_deposit_bps: Option<u16>,
    },
}

/// Query messages
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    /// Get contract configuration
    Config {},
    /// Get order information
    GetOrder {
        order_hash: String,
    },
    /// List orders by status
    ListOrders {
        status: Option<OrderStatus>,
        start_after: Option<String>,
        limit: Option<u32>,
    },
    /// Check if address is authorized resolver
    IsAuthorizedResolver {
        address: String,
    },
    /// Get all authorized resolvers
    ListResolvers {
        start_after: Option<String>,
        limit: Option<u32>,
    },
}

/// Response for config query
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ConfigResponse {
    pub admin: Addr,
    pub min_safety_deposit_bps: u16,
    pub native_denom: String,
}

/// Response for order query
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct OrderResponse {
    pub order: FusionPlusOrder,
}

/// Response for list orders query
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ListOrdersResponse {
    pub orders: Vec<FusionPlusOrder>,
}

/// Response for resolver queries
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ResolverResponse {
    pub is_authorized: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ListResolversResponse {
    pub resolvers: Vec<Addr>,
}

// State storage
const CONFIG: Item<Config> = Item::new("config");
const ORDERS: Map<String, FusionPlusOrder> = Map::new("orders");
const AUTHORIZED_RESOLVERS: Map<Addr, bool> = Map::new("authorized_resolvers");

// Contract entry points

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    let admin = msg
        .admin
        .map(|s| deps.api.addr_validate(&s))
        .transpose()?
        .unwrap_or_else(|| info.sender.clone());

    let min_safety_deposit_bps = msg.min_safety_deposit_bps.unwrap_or(500); // Default 5%

    // Validate safety deposit ratio
    if min_safety_deposit_bps == 0 || min_safety_deposit_bps > 10000 {
        return Err(ContractError::Std(StdError::generic_err(
            "Safety deposit must be between 1 and 10000 basis points"
        )));
    }

    let config = Config {
        admin: admin.clone(),
        min_safety_deposit_bps,
        native_denom: msg.native_denom,
    };

    CONFIG.save(deps.storage, &config)?;

    // Add instantiator as initial authorized resolver
    AUTHORIZED_RESOLVERS.save(deps.storage, info.sender.clone(), &true)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("admin", admin)
        .add_attribute("min_safety_deposit_bps", min_safety_deposit_bps.to_string())
        .add_attribute("initial_resolver", info.sender))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::ExecuteFusionOrder {
            order_hash,
            hashlock,
            timelocks,
            maker,
            amount,
            resolver_fee,
            source_chain_id,
            timeout_seconds,
        } => execute_fusion_order(
            deps,
            env,
            info,
            order_hash,
            hashlock,
            timelocks,
            maker,
            amount,
            resolver_fee,
            source_chain_id,
            timeout_seconds,
        ),
        ExecuteMsg::ClaimFusionOrder { order_hash, preimage } => {
            claim_fusion_order(deps, env, info, order_hash, preimage)
        }
        ExecuteMsg::RefundOrder { order_hash } => refund_order(deps, env, info, order_hash),
        ExecuteMsg::AddResolver { resolver } => add_resolver(deps, info, resolver),
        ExecuteMsg::RemoveResolver { resolver } => remove_resolver(deps, info, resolver),
        ExecuteMsg::UpdateConfig {
            admin,
            min_safety_deposit_bps,
        } => update_config(deps, info, admin, min_safety_deposit_bps),
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_binary(&query_config(deps)?),
        QueryMsg::GetOrder { order_hash } => to_binary(&query_order(deps, order_hash)?),
        QueryMsg::ListOrders {
            status,
            start_after,
            limit,
        } => to_binary(&query_list_orders(deps, status, start_after, limit)?),
        QueryMsg::IsAuthorizedResolver { address } => {
            to_binary(&query_is_authorized_resolver(deps, address)?)
        }
        QueryMsg::ListResolvers { start_after, limit } => {
            to_binary(&query_list_resolvers(deps, start_after, limit)?)
        }
    }
}

// Execute functions

pub fn execute_fusion_order(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    order_hash: String,
    hashlock: String,
    timelocks: String,
    maker: String,
    amount: Uint128,
    resolver_fee: Uint128,
    source_chain_id: u64,
    timeout_seconds: u64,
) -> Result<Response, ContractError> {
    // Check if resolver is authorized
    let is_authorized = AUTHORIZED_RESOLVERS
        .may_load(deps.storage, info.sender.clone())?
        .unwrap_or(false);
    
    if !is_authorized {
        return Err(ContractError::UnauthorizedResolver {});
    }

    // Check if order already exists
    if ORDERS.has(deps.storage, order_hash.clone()) {
        return Err(ContractError::OrderAlreadyExists { order_hash });
    }

    // Validate hashlock format (should be 64 character hex string for SHA-256)
    if hashlock.len() != 64 || !hashlock.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ContractError::InvalidHashlock {});
    }

    let maker_addr = deps.api.addr_validate(&maker)?;
    let config = CONFIG.load(deps.storage)?;

    // Calculate required safety deposit
    let required_safety_deposit = amount
        .checked_mul(Uint128::from(config.min_safety_deposit_bps)).map_err(|_| ContractError::Overflow {})?
        .checked_div(Uint128::from(10000u128)).map_err(|_| ContractError::Overflow {})?;

    // Validate funds sent (amount + resolver fee + safety deposit)
    let expected_total = amount
        .checked_add(resolver_fee).map_err(|_| ContractError::Overflow {})?
        .checked_add(required_safety_deposit).map_err(|_| ContractError::Overflow {})?;

    let sent_funds = info
        .funds
        .iter()
        .find(|coin| coin.denom == config.native_denom)
        .map(|coin| coin.amount)
        .unwrap_or_default();

    if sent_funds < expected_total {
        return Err(ContractError::InsufficientSafetyDeposit {
            expected: expected_total,
            actual: sent_funds,
        });
    }

    // Create timeout timestamp
    let timeout = env.block.time.plus_seconds(timeout_seconds);

    // Create order
    let order = FusionPlusOrder {
        order_hash: order_hash.clone(),
        hashlock,
        timelocks,
        maker: maker_addr,
        resolver: info.sender.clone(),
        amount,
        resolver_fee,
        safety_deposit: required_safety_deposit,
        status: OrderStatus::Matched,
        preimage: None,
        source_chain_id,
        created_at: env.block.time,
        timeout,
    };

    ORDERS.save(deps.storage, order_hash.clone(), &order)?;

    // Create event
    let event = Event::new("fusion_order_created")
        .add_attribute("order_hash", &order_hash)
        .add_attribute("maker", &maker)
        .add_attribute("resolver", &info.sender)
        .add_attribute("amount", amount.to_string())
        .add_attribute("source_chain_id", source_chain_id.to_string());

    Ok(Response::new()
        .add_event(event)
        .add_attribute("method", "execute_fusion_order")
        .add_attribute("order_hash", order_hash))
}

pub fn claim_fusion_order(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    order_hash: String,
    preimage: String,
) -> Result<Response, ContractError> {
    let mut order = ORDERS.load(deps.storage, order_hash.clone())?;

    // Only resolver can claim
    if info.sender != order.resolver {
        return Err(ContractError::Unauthorized {});
    }

    // Check order status
    if order.status != OrderStatus::Matched {
        return Err(ContractError::InvalidOrderStatus {
            status: format!("{:?}", order.status),
        });
    }

    // Check timelock hasn't expired
    if env.block.time >= order.timeout {
        return Err(ContractError::TimelockExpired {});
    }

    // Validate preimage
    if !validate_preimage(&preimage, &order.hashlock) {
        return Err(ContractError::InvalidPreimage {});
    }

    // Update order status
    order.status = OrderStatus::Claimed;
    order.preimage = Some(preimage.clone());
    ORDERS.save(deps.storage, order_hash.clone(), &order)?;

    let config = CONFIG.load(deps.storage)?;

    // Create messages for transfers
    let mut messages: Vec<CosmosMsg> = vec![];

    // Transfer amount to maker
    if !order.amount.is_zero() {
        messages.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: order.maker.to_string(),
            amount: vec![Coin {
                denom: config.native_denom.clone(),
                amount: order.amount,
            }],
        }));
    }

    // Transfer resolver fee to resolver
    if !order.resolver_fee.is_zero() {
        messages.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: order.resolver.to_string(),
            amount: vec![Coin {
                denom: config.native_denom.clone(),
                amount: order.resolver_fee,
            }],
        }));
    }

    // Return safety deposit to resolver
    if !order.safety_deposit.is_zero() {
        messages.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: order.resolver.to_string(),
            amount: vec![Coin {
                denom: config.native_denom,
                amount: order.safety_deposit,
            }],
        }));
    }

    // Create event
    let event = Event::new("fusion_order_claimed")
        .add_attribute("order_hash", &order_hash)
        .add_attribute("resolver", &order.resolver)
        .add_attribute("preimage", &preimage)
        .add_attribute("amount", order.amount.to_string());

    Ok(Response::new()
        .add_messages(messages)
        .add_event(event)
        .add_attribute("method", "claim_fusion_order")
        .add_attribute("order_hash", order_hash))
}

pub fn refund_order(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    order_hash: String,
) -> Result<Response, ContractError> {
    let mut order = ORDERS.load(deps.storage, order_hash.clone())?;

    // Check timelock has expired
    if env.block.time < order.timeout {
        return Err(ContractError::TimelockNotExpired {});
    }

    // Check order status
    if order.status == OrderStatus::Claimed {
        return Err(ContractError::OrderAlreadyClaimed {});
    }

    if order.status == OrderStatus::Refunded {
        return Err(ContractError::OrderAlreadyRefunded {});
    }

    // Only maker or resolver can refund
    if info.sender != order.maker && info.sender != order.resolver {
        return Err(ContractError::Unauthorized {});
    }

    // Update order status
    order.status = OrderStatus::Refunded;
    ORDERS.save(deps.storage, order_hash.clone(), &order)?;

    let config = CONFIG.load(deps.storage)?;

    // Refund the locked amount and safety deposit to resolver
    let refund_amount = order.amount
        .checked_add(order.resolver_fee).map_err(|_| ContractError::Overflow {})?
        .checked_add(order.safety_deposit).map_err(|_| ContractError::Overflow {})?;

    let refund_msg = CosmosMsg::Bank(BankMsg::Send {
        to_address: order.resolver.to_string(),
        amount: vec![Coin {
            denom: config.native_denom,
            amount: refund_amount,
        }],
    });

    // Create event
    let event = Event::new("fusion_order_refunded")
        .add_attribute("order_hash", &order_hash)
        .add_attribute("refunded_to", &order.resolver)
        .add_attribute("amount", refund_amount.to_string())
        .add_attribute("reason", "timeout");

    Ok(Response::new()
        .add_message(refund_msg)
        .add_event(event)
        .add_attribute("method", "refund_order")
        .add_attribute("order_hash", order_hash))
}

pub fn add_resolver(
    deps: DepsMut,
    info: MessageInfo,
    resolver: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    
    // Only admin can add resolvers
    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    let resolver_addr = deps.api.addr_validate(&resolver)?;
    AUTHORIZED_RESOLVERS.save(deps.storage, resolver_addr, &true)?;

    Ok(Response::new()
        .add_attribute("method", "add_resolver")
        .add_attribute("resolver", resolver))
}

pub fn remove_resolver(
    deps: DepsMut,
    info: MessageInfo,
    resolver: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    
    // Only admin can remove resolvers
    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    let resolver_addr = deps.api.addr_validate(&resolver)?;
    AUTHORIZED_RESOLVERS.remove(deps.storage, resolver_addr);

    Ok(Response::new()
        .add_attribute("method", "remove_resolver")
        .add_attribute("resolver", resolver))
}

pub fn update_config(
    deps: DepsMut,
    info: MessageInfo,
    admin: Option<String>,
    min_safety_deposit_bps: Option<u16>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    
    // Only admin can update config
    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    let mut response = Response::new().add_attribute("method", "update_config");

    if let Some(new_admin) = admin {
        config.admin = deps.api.addr_validate(&new_admin)?;
        response = response.add_attribute("new_admin", &new_admin);
    }

    if let Some(new_bps) = min_safety_deposit_bps {
        if new_bps == 0 || new_bps > 10000 {
            return Err(ContractError::Std(StdError::generic_err(
                "Safety deposit must be between 1 and 10000 basis points"
            )));
        }
        config.min_safety_deposit_bps = new_bps;
        response = response.add_attribute("new_min_safety_deposit_bps", new_bps.to_string());
    }

    CONFIG.save(deps.storage, &config)?;

    Ok(response)
}

// Query functions

fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let config = CONFIG.load(deps.storage)?;
    Ok(ConfigResponse {
        admin: config.admin,
        min_safety_deposit_bps: config.min_safety_deposit_bps,
        native_denom: config.native_denom,
    })
}

fn query_order(deps: Deps, order_hash: String) -> StdResult<OrderResponse> {
    let order = ORDERS.load(deps.storage, order_hash)?;
    Ok(OrderResponse { order })
}

fn query_list_orders(
    deps: Deps,
    status: Option<OrderStatus>,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<ListOrdersResponse> {
    let limit = limit.unwrap_or(30).min(100) as usize;
    let start = start_after.as_deref();

    let orders: Vec<FusionPlusOrder> = ORDERS
        .range(deps.storage, start.map(Bound::exclusive), None, cosmwasm_std::Order::Ascending)
        .take(limit)
        .filter_map(|item| {
            item.ok().and_then(|(_, order)| {
                if let Some(ref filter_status) = status {
                    if order.status == *filter_status {
                        Some(order)
                    } else {
                        None
                    }
                } else {
                    Some(order)
                }
            })
        })
        .collect();

    Ok(ListOrdersResponse { orders })
}

fn query_is_authorized_resolver(deps: Deps, address: String) -> StdResult<ResolverResponse> {
    let addr = deps.api.addr_validate(&address)?;
    let is_authorized = AUTHORIZED_RESOLVERS
        .may_load(deps.storage, addr)?
        .unwrap_or(false);
    
    Ok(ResolverResponse { is_authorized })
}

fn query_list_resolvers(
    deps: Deps,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<ListResolversResponse> {
    let limit = limit.unwrap_or(30).min(100) as usize;
    let start = start_after.as_deref().map(|s| deps.api.addr_validate(s)).transpose()?;

    let resolvers: Vec<Addr> = AUTHORIZED_RESOLVERS
        .range(
            deps.storage,
            start.as_ref().map(|s| Bound::exclusive(s.clone())),
            None,
            cosmwasm_std::Order::Ascending,
        )
        .take(limit)
        .filter_map(|item| item.ok().map(|(addr, _)| addr))
        .collect();

    Ok(ListResolversResponse { resolvers })
}

// Helper functions

fn validate_preimage(preimage: &str, hashlock: &str) -> bool {
    let mut hasher = Sha256::new();
    hasher.update(preimage.as_bytes());
    let result = hasher.finalize();
    let computed_hash = hex::encode(result);
    computed_hash.to_lowercase() == hashlock.to_lowercase()
}

// Import needed for query range
use cw_storage_plus::Bound;

#[cfg(test)]
mod integration_tests;

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
    use cosmwasm_std::{coins, from_json};

    #[test]
    fn proper_initialization() {
        let mut deps = mock_dependencies();

        let msg = InstantiateMsg {
            admin: None,
            min_safety_deposit_bps: Some(500),
            native_denom: "untrn".to_string(),
        };
        let info = mock_info("creator", &coins(0, "untrn"));

        let res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(0, res.messages.len());

        // Check config
        let res = query(deps.as_ref(), mock_env(), QueryMsg::Config {}).unwrap();
        let config: ConfigResponse = from_json(&res).unwrap();
        assert_eq!("creator", config.admin.as_str());
        assert_eq!(500, config.min_safety_deposit_bps);
        assert_eq!("untrn", config.native_denom);
    }

    #[test]
    fn test_hashlock_validation() {
        let valid_hashlock = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
        let invalid_hashlock = "invalid";
        
        assert_eq!(valid_hashlock.len(), 64);
        assert!(valid_hashlock.chars().all(|c| c.is_ascii_hexdigit()));
        
        assert_ne!(invalid_hashlock.len(), 64);
    }

    #[test]
    fn test_preimage_validation() {
        let preimage = "hello";
        let expected_hash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
        
        assert!(validate_preimage(preimage, expected_hash));
        assert!(!validate_preimage("wrong", expected_hash));
    }
}