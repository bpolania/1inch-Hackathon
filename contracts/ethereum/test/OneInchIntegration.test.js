const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("1inch Fusion+ Integration Tests", function () {
    let oneInchFactory;
    let registry;
    let nearAdapter;
    let bitcoinAdapter;
    let nearTakerInteraction;
    let mockEscrowFactory;
    let mockERC20;
    let owner;
    let resolver;
    let user;

    const NEAR_MAINNET_CHAIN_ID = 40001;
    const NEAR_TESTNET_CHAIN_ID = 40002;
    const BITCOIN_MAINNET_CHAIN_ID = 40003;
    const BITCOIN_TESTNET_CHAIN_ID = 40004;

    // Helper function to create chain params
    function createChainParams(address, contractId = "fusion-plus.testnet", methodName = "execute_fusion_order", gas = 300000000000000n, deposit = "1000000000000000000000000") {
        // Create NearExecutionParams structure
        const nearParams = ethers.AbiCoder.defaultAbiCoder().encode(
            ["tuple(string,string,bytes,uint128,uint64)"],
            [[
                contractId,                           // contractId
                methodName,                          // methodName
                ethers.toUtf8Bytes('{"amount":"100"}'), // args (JSON)
                deposit,                             // attachedDeposit
                gas                                  // gas
            ]]
        );
        
        return {
            destinationAddress: ethers.toUtf8Bytes(address),
            executionParams: nearParams,
            estimatedGas: gas,
            additionalData: ethers.toUtf8Bytes("") // Empty additional data
        };
    }

    beforeEach(async function () {
        [owner, resolver, user] = await ethers.getSigners();

        // Deploy CrossChainRegistry
        const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
        registry = await CrossChainRegistry.deploy();
        await registry.waitForDeployment();

        // Deploy NEAR destination chain adapters
        const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
        const nearMainnetAdapter = await NearDestinationChain.deploy(NEAR_MAINNET_CHAIN_ID);
        await nearMainnetAdapter.waitForDeployment();
        
        const nearTestnetAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_CHAIN_ID);
        await nearTestnetAdapter.waitForDeployment();
        
        nearAdapter = nearTestnetAdapter; // Use testnet adapter for tests

        // Deploy Bitcoin destination chain adapters
        const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
        const bitcoinMainnetAdapter = await BitcoinDestinationChain.deploy(BITCOIN_MAINNET_CHAIN_ID);
        await bitcoinMainnetAdapter.waitForDeployment();
        
        const bitcoinTestnetAdapter = await BitcoinDestinationChain.deploy(BITCOIN_TESTNET_CHAIN_ID);
        await bitcoinTestnetAdapter.waitForDeployment();
        
        bitcoinAdapter = bitcoinTestnetAdapter; // Use testnet adapter for tests

        // Register NEAR chains
        await registry.registerChainAdapter(NEAR_MAINNET_CHAIN_ID, nearMainnetAdapter.target);
        await registry.registerChainAdapter(NEAR_TESTNET_CHAIN_ID, nearTestnetAdapter.target);
        
        // Register Bitcoin chains
        await registry.registerChainAdapter(BITCOIN_MAINNET_CHAIN_ID, bitcoinMainnetAdapter.target);
        await registry.registerChainAdapter(BITCOIN_TESTNET_CHAIN_ID, bitcoinTestnetAdapter.target);

        // Deploy mock 1inch EscrowFactory
        const MockOneInchEscrowFactory = await ethers.getContractFactory("MockOneInchEscrowFactory");
        mockEscrowFactory = await MockOneInchEscrowFactory.deploy();
        await mockEscrowFactory.waitForDeployment();

        // Deploy NearTakerInteraction
        const NearTakerInteraction = await ethers.getContractFactory("NearTakerInteraction");
        nearTakerInteraction = await NearTakerInteraction.deploy(
            await registry.getAddress(),
            mockEscrowFactory.target
        );
        await nearTakerInteraction.waitForDeployment();

        // Deploy OneInchFusionPlusFactory
        const OneInchFusionPlusFactory = await ethers.getContractFactory("OneInchFusionPlusFactory");
        oneInchFactory = await OneInchFusionPlusFactory.deploy(
            await registry.getAddress(),
            mockEscrowFactory.target,
            nearTakerInteraction.target
        );
        await oneInchFactory.waitForDeployment();

        // Deploy mock ERC20 token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy("Test Token", "TT", 18);
        await mockERC20.waitForDeployment();

        // Authorize resolver in both contracts
        await oneInchFactory.authorizeResolver(resolver.address);
        await nearTakerInteraction.authorizeResolver(resolver.address);
    });

    describe("Deployment and Setup", function () {
        it("Should deploy with correct dependencies", async function () {
            expect(await oneInchFactory.registry()).to.equal(registry.target);
            expect(await oneInchFactory.getOneInchEscrowFactory()).to.equal(mockEscrowFactory.target);
            expect(await oneInchFactory.getNearTakerInteraction()).to.equal(nearTakerInteraction.target);
        });

        it("Should have authorized resolver", async function () {
            expect(await oneInchFactory.authorizedResolvers(resolver.address)).to.be.true;
            expect(await nearTakerInteraction.isAuthorizedResolver(resolver.address)).to.be.true;
        });

        it("Should support NEAR chains", async function () {
            const supportedChains = await oneInchFactory.getSupportedChains();
            expect(supportedChains).to.include(BigInt(NEAR_MAINNET_CHAIN_ID));
            expect(supportedChains).to.include(BigInt(NEAR_TESTNET_CHAIN_ID));
        });
    });

    describe("Order Creation with 1inch Integration", function () {
        it("Should create Fusion+ order with hashlock", async function () {
            const currentTime = await time.latest();
            const expiryTime = currentTime + 3600; // 1 hour
            const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
            
            const orderParams = {
                sourceToken: mockERC20.target,
                sourceAmount: ethers.parseEther("100"),
                destinationChainId: NEAR_TESTNET_CHAIN_ID,
                destinationToken: ethers.toUtf8Bytes("wrap.testnet"),
                destinationAmount: ethers.parseEther("2"),
                destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
                resolverFeeAmount: ethers.parseEther("1"),
                expiryTime: expiryTime,
                chainParams: createChainParams("alice.testnet"),
                hashlock: hashlock
            };

            const tx = await oneInchFactory.connect(user).createFusionOrder(orderParams);
            const receipt = await tx.wait();
            
            // Check event emission
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "FusionOrderCreated"
            );
            expect(event).to.not.be.undefined;
            expect(event.args.maker).to.equal(user.address);
            expect(event.args.sourceAmount).to.equal(orderParams.sourceAmount);
            expect(event.args.hashlock).to.equal(hashlock);

            // Verify order was created
            const orderHash = event.args.orderHash;
            const order = await oneInchFactory.getOrder(orderHash);
            expect(order.isActive).to.be.true;
            expect(order.maker).to.equal(user.address);
            expect(order.sourceAmount).to.equal(orderParams.sourceAmount);
        });

        it("Should reject order without hashlock", async function () {
            const currentTime = await time.latest();
            const orderParams = {
                sourceToken: mockERC20.target,
                sourceAmount: ethers.parseEther("100"),
                destinationChainId: NEAR_TESTNET_CHAIN_ID,
                destinationToken: ethers.toUtf8Bytes("wrap.testnet"),
                destinationAmount: ethers.parseEther("2"),
                destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
                resolverFeeAmount: ethers.parseEther("1"),
                expiryTime: currentTime + 3600,
                chainParams: createChainParams("alice.testnet"),
                hashlock: ethers.ZeroHash // Invalid hashlock
            };

            await expect(
                oneInchFactory.connect(user).createFusionOrder(orderParams)
            ).to.be.revertedWith("Invalid hashlock");
        });
    });

    describe("Order Matching with 1inch Escrow System", function () {
        let orderHash;
        let hashlock;

        beforeEach(async function () {
            // Create an order first
            const currentTime = await time.latest();
            hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
            
            const orderParams = {
                sourceToken: mockERC20.target,
                sourceAmount: ethers.parseEther("100"),
                destinationChainId: NEAR_TESTNET_CHAIN_ID,
                destinationToken: ethers.toUtf8Bytes("wrap.testnet"),
                destinationAmount: ethers.parseEther("2"),
                destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
                resolverFeeAmount: ethers.parseEther("1"),
                expiryTime: currentTime + 3600,
                chainParams: createChainParams("alice.testnet"),
                hashlock: hashlock
            };

            const tx = await oneInchFactory.connect(user).createFusionOrder(orderParams);
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "FusionOrderCreated"
            );
            orderHash = event.args.orderHash;
        });

        it("Should match order using 1inch escrow system", async function () {
            const safetyDeposit = ethers.parseEther("5"); // 5 ETH safety deposit
            
            const tx = await oneInchFactory.connect(resolver).matchFusionOrder(
                orderHash,
                hashlock,
                { value: safetyDeposit }
            );
            const receipt = await tx.wait();

            // Check event emission
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "FusionOrderMatched"
            );
            expect(event).to.not.be.undefined;
            expect(event.args.orderHash).to.equal(orderHash);
            expect(event.args.resolver).to.equal(resolver.address);
            expect(event.args.safetyDeposit).to.equal(safetyDeposit);

            // Verify escrow addresses were set
            const [sourceEscrow, destinationEscrow] = await oneInchFactory.getEscrowAddresses(orderHash);
            expect(sourceEscrow).to.not.equal(ethers.ZeroAddress);
            expect(destinationEscrow).to.not.equal(ethers.ZeroAddress);

            // Verify order is no longer matchable
            expect(await oneInchFactory.isOrderMatchable(orderHash)).to.be.false;
        });

        it("Should reject matching by unauthorized resolver", async function () {
            const safetyDeposit = ethers.parseEther("5");
            
            await expect(
                oneInchFactory.connect(user).matchFusionOrder(
                    orderHash,
                    hashlock,
                    { value: safetyDeposit }
                )
            ).to.be.revertedWith("Not authorized resolver");
        });

        it("Should reject matching with insufficient safety deposit", async function () {
            const insufficientDeposit = ethers.parseEther("0.1");
            
            await expect(
                oneInchFactory.connect(resolver).matchFusionOrder(
                    orderHash,
                    hashlock,
                    { value: insufficientDeposit }
                )
            ).to.be.revertedWith("Insufficient safety deposit");
        });
    });

    describe("NEAR Taker Interaction", function () {
        it("Should process NEAR order data correctly", async function () {
            const chainParams = createChainParams("alice.testnet");
            
            const nearOrderData = {
                destinationChainId: NEAR_TESTNET_CHAIN_ID,
                destinationToken: ethers.toUtf8Bytes("wrap.testnet"),
                destinationAmount: ethers.parseEther("2"),
                destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
                hashlock: ethers.keccak256(ethers.toUtf8Bytes("secret123")),
                expiryTime: (await time.latest()) + 3600,
                chainSpecificParams: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["tuple(bytes,bytes,uint256,bytes)"],
                    [[
                        chainParams.destinationAddress,
                        chainParams.executionParams,
                        chainParams.estimatedGas,
                        chainParams.additionalData
                    ]]
                )
            };

            const extension = ethers.AbiCoder.defaultAbiCoder().encode(
                ["tuple(uint256,bytes,uint256,bytes,bytes32,uint256,bytes)"],
                [[
                    nearOrderData.destinationChainId,
                    nearOrderData.destinationToken,
                    nearOrderData.destinationAmount,
                    nearOrderData.destinationAddress,
                    nearOrderData.hashlock,
                    nearOrderData.expiryTime,
                    nearOrderData.chainSpecificParams
                ]]
            );

            // Mock order structure
            const mockOrder = {
                salt: 0,
                maker: user.address,
                receiver: ethers.ZeroAddress,
                makerAsset: mockERC20.target,
                takerAsset: ethers.ZeroAddress,
                makingAmount: ethers.parseEther("100"),
                takingAmount: ethers.parseEther("2"),
                makerTraits: 0
            };

            const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test-order"));

            // This would normally be called by 1inch Limit Order Protocol
            const tx = await nearTakerInteraction.connect(resolver).takerInteraction(
                mockOrder,
                extension,
                orderHash,
                resolver.address,
                ethers.parseEther("100"),
                ethers.parseEther("2"),
                0,
                "0x"
            );

            const receipt = await tx.wait();
            
            // Check NEAR order creation event
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "NearOrderCreated"
            );
            expect(event).to.not.be.undefined;
            expect(event.args.orderHash).to.equal(orderHash);
            expect(event.args.maker).to.equal(user.address);
            expect(event.args.destinationChainId).to.equal(BigInt(NEAR_TESTNET_CHAIN_ID));
        });
    });

    describe("Cost Estimation", function () {
        it("Should estimate costs correctly for NEAR orders", async function () {
            const chainParams = createChainParams("alice.testnet");

            const [estimatedCost, safetyDeposit] = await oneInchFactory.estimateOrderCosts(
                NEAR_TESTNET_CHAIN_ID,
                chainParams,
                ethers.parseEther("100")
            );

            expect(estimatedCost).to.be.gt(0);
            expect(safetyDeposit).to.be.gt(0);
            
            // Safety deposit should be approximately 5% of source amount (500 bps)
            const expectedSafetyDeposit = ethers.parseEther("100") * 500n / 10000n;
            expect(safetyDeposit).to.equal(expectedSafetyDeposit);
        });
    });

    describe("Integration Flow", function () {
        it("Should complete full cross-chain swap flow with 1inch integration", async function () {
            // 1. Create order
            const currentTime = await time.latest();
            const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
            
            const orderParams = {
                sourceToken: mockERC20.target,
                sourceAmount: ethers.parseEther("100"),
                destinationChainId: NEAR_TESTNET_CHAIN_ID,
                destinationToken: ethers.toUtf8Bytes("wrap.testnet"),
                destinationAmount: ethers.parseEther("2"),
                destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
                resolverFeeAmount: ethers.parseEther("1"),
                expiryTime: currentTime + 3600,
                chainParams: createChainParams("alice.testnet"),
                hashlock: hashlock
            };

            const createTx = await oneInchFactory.connect(user).createFusionOrder(orderParams);
            const createReceipt = await createTx.wait();
            const createEvent = createReceipt.logs.find(log => 
                log.fragment && log.fragment.name === "FusionOrderCreated"
            );
            const orderHash = createEvent.args.orderHash;

            // 2. Match order
            const safetyDeposit = ethers.parseEther("5");
            const matchTx = await oneInchFactory.connect(resolver).matchFusionOrder(
                orderHash,
                hashlock,
                { value: safetyDeposit }
            );
            await matchTx.wait();

            // 3. Complete order
            const secret = ethers.toUtf8Bytes("secret123");
            const completeTx = await oneInchFactory.connect(resolver).completeFusionOrder(
                orderHash,
                ethers.keccak256(secret)
            );
            const completeReceipt = await completeTx.wait();

            // Check completion event
            const completeEvent = completeReceipt.logs.find(log => 
                log.fragment && log.fragment.name === "FusionOrderCompleted"
            );
            expect(completeEvent).to.not.be.undefined;
            expect(completeEvent.args.orderHash).to.equal(orderHash);
            expect(completeEvent.args.resolver).to.equal(resolver.address);

            // Order should now be inactive
            const finalOrder = await oneInchFactory.getOrder(orderHash);
            expect(finalOrder.isActive).to.be.false;
        });
    });

    describe("Bitcoin Integration", function () {
        it("Should support Bitcoin chain registration", async function () {
            // Check that Bitcoin chains are registered
            const supportedChains = await registry.getSupportedChainIds();
            expect(supportedChains).to.include(BigInt(BITCOIN_MAINNET_CHAIN_ID));
            expect(supportedChains).to.include(BigInt(BITCOIN_TESTNET_CHAIN_ID));
            
            // Verify adapter addresses
            const registeredBitcoinTestnetAdapter = await registry.chainAdapters(BITCOIN_TESTNET_CHAIN_ID);
            expect(registeredBitcoinTestnetAdapter).to.equal(bitcoinAdapter.target);
        });

        it("Should validate Bitcoin addresses correctly", async function () {
            const validAddresses = [
                "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", // P2PKH
                "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", // Bech32
                "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", // P2SH
                "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx" // Testnet
            ];

            for (const address of validAddresses) {
                const isValid = await registry.validateDestinationAddress(
                    BITCOIN_TESTNET_CHAIN_ID,
                    ethers.toUtf8Bytes(address)
                );
                expect(isValid).to.be.true;
            }

            // Test invalid addresses
            const invalidAddresses = [
                "0x742d35Cc6B44e9F7c4963A0e0f9d6d8A8B0f8B8E", // Ethereum address
                "invalid-address",
                ""
            ];

            for (const address of invalidAddresses) {
                const isValid = await registry.validateDestinationAddress(
                    BITCOIN_TESTNET_CHAIN_ID,
                    ethers.toUtf8Bytes(address)
                );
                expect(isValid).to.be.false;
            }
        });

        it("Should create orders with Bitcoin destination", async function () {
            // Mint tokens to user
            await mockERC20.mint(user.address, ethers.parseEther("1000"));
            await mockERC20.connect(user).approve(oneInchFactory.target, ethers.parseEther("100"));

            const orderParams = {
                srcToken: mockERC20.target,
                srcAmount: ethers.parseEther("100"),
                dstChainId: BITCOIN_TESTNET_CHAIN_ID,
                dstToken: ethers.ZeroAddress, // BTC native
                dstAmount: ethers.parseUnits("0.01", 8), // 0.01 BTC
                dstAddress: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
                resolverFeeAmount: ethers.parseEther("1"),
                expiryTime: Math.floor(Date.now() / 1000) + 3600,
                immutables: {
                    hashlock: "0x" + "a".repeat(64),
                    chainParams: {
                        destinationAddress: ethers.toUtf8Bytes("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"),
                        executionParams: await bitcoinAdapter.encodeExecutionParams(
                            "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
                            144, // timelock blocks
                            10   // fee rate
                        ),
                        estimatedGas: 21000,
                        additionalData: "0x"
                    }
                }
            };

            const tx = await oneInchFactory.connect(user).createFusionOrder({
                sourceToken: orderParams.srcToken,
                sourceAmount: orderParams.srcAmount,
                destinationChainId: orderParams.dstChainId,
                destinationToken: orderParams.dstToken,
                destinationAmount: orderParams.dstAmount,
                destinationAddress: ethers.toUtf8Bytes(orderParams.dstAddress),
                resolverFeeAmount: orderParams.resolverFeeAmount,
                expiryTime: orderParams.expiryTime,
                chainParams: orderParams.immutables.chainParams,
                hashlock: orderParams.immutables.hashlock
            });

            const receipt = await tx.wait();
            const orderCreatedEvent = receipt.logs.find(log => {
                try {
                    const parsed = oneInchFactory.interface.parseLog(log);
                    return parsed.name === "FusionOrderCreated";
                } catch {
                    return false;
                }
            });

            expect(orderCreatedEvent).to.not.be.undefined;
            const orderHash = orderCreatedEvent.args.orderHash;
            
            // Verify order details
            const order = await oneInchFactory.getOrder(orderHash);
            expect(order.destinationChainId).to.equal(BITCOIN_TESTNET_CHAIN_ID);
            expect(order.isActive).to.be.true;
        });

        it("Should calculate correct safety deposits for Bitcoin orders", async function () {
            const sourceAmount = ethers.parseEther("10");
            const safetyDeposit = await registry.calculateMinSafetyDeposit(
                BITCOIN_TESTNET_CHAIN_ID,
                sourceAmount
            );
            
            // Bitcoin uses 5% safety deposit
            const expectedDeposit = sourceAmount * 500n / 10000n;
            expect(safetyDeposit).to.equal(expectedDeposit);
        });

        it("Should encode and decode Bitcoin execution parameters", async function () {
            const btcAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
            const htlcTimelock = 144;
            const feeRate = 25;

            const encoded = await bitcoinAdapter.encodeExecutionParams(
                btcAddress,
                htlcTimelock,
                feeRate
            );

            const [decodedAddress, decodedTimelock, decodedFeeRate] = 
                await bitcoinAdapter.decodeExecutionParams(encoded);

            expect(decodedAddress).to.equal(btcAddress);
            expect(decodedTimelock).to.equal(htlcTimelock);
            expect(decodedFeeRate).to.equal(feeRate);
        });

        it("Should estimate Bitcoin execution costs", async function () {
            const chainParams = {
                destinationAddress: ethers.toUtf8Bytes("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"),
                executionParams: await bitcoinAdapter.encodeExecutionParams(
                    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
                    144,
                    10 // 10 sat/byte
                ),
                estimatedGas: 21000,
                additionalData: "0x"
            };

            const cost = await bitcoinAdapter.estimateExecutionCost(
                chainParams,
                ethers.parseEther("1")
            );

            // Expected: 450 bytes * 10 sat/byte * 1e9 wei/satoshi
            const expectedCost = 450n * 10n * 1000000000n;
            expect(cost).to.equal(expectedCost);
        });
    });
});