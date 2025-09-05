const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Production Integration Tests - Full Local Deployment", function () {
    let registry;
    let nearAdapter;
    let productionEscrowFactory;
    let nearTakerInteraction;
    let oneInchFactory;
    let mockERC20;
    let owner;
    let resolver;
    let user;

    const NEAR_TESTNET_CHAIN_ID = 40002;

    // Helper function to create chain params
    function createChainParams(address, contractId = "fusion-plus.testnet", methodName = "execute_fusion_order", gas = 300000000000000n, deposit = "1000000000000000000000000") {
        const nearParams = ethers.AbiCoder.defaultAbiCoder().encode(
            ["tuple(string,string,bytes,uint128,uint64)"],
            [[
                contractId,
                methodName,
                ethers.toUtf8Bytes('{"amount":"100"}'),
                deposit,
                gas
            ]]
        );
        
        return {
            destinationAddress: ethers.toUtf8Bytes(address),
            executionParams: nearParams,
            estimatedGas: gas,
            additionalData: ethers.toUtf8Bytes("")
        };
    }

    beforeEach(async function () {
        [owner, resolver, user] = await ethers.getSigners();

        console.log(" Starting Full Production Integration Test Suite");
        console.log("==================================================");

        // Deploy CrossChainRegistry
        console.log(" Step 1: Deploy CrossChainRegistry");
        const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
        registry = await CrossChainRegistry.deploy();
        await registry.waitForDeployment();
        console.log("    CrossChainRegistry deployed to:", await registry.getAddress());

        // Deploy NEAR destination chain adapters
        console.log(" Step 2: Deploy NEAR Adapters");
        const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
        nearAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_CHAIN_ID);
        await nearAdapter.waitForDeployment();
        console.log("    NearDestinationChain deployed to:", await nearAdapter.getAddress());

        // Register NEAR chain
        await registry.registerChainAdapter(NEAR_TESTNET_CHAIN_ID, nearAdapter.target);
        console.log("    NEAR chain registered in registry");

        // Deploy production escrow factory
        console.log(" Step 3: Deploy Production EscrowFactory");
        const ProductionEscrowFactory = await ethers.getContractFactory("ProductionOneInchEscrowFactory");
        productionEscrowFactory = await ProductionEscrowFactory.deploy();
        await productionEscrowFactory.waitForDeployment();
        console.log("    ProductionOneInchEscrowFactory deployed to:", await productionEscrowFactory.getAddress());

        // Deploy NearTakerInteraction with production factory
        console.log(" Step 4: Deploy NearTakerInteraction");
        const NearTakerInteraction = await ethers.getContractFactory("NearTakerInteraction");
        nearTakerInteraction = await NearTakerInteraction.deploy(
            await registry.getAddress(),
            productionEscrowFactory.target
        );
        await nearTakerInteraction.waitForDeployment();
        console.log("    NearTakerInteraction deployed to:", await nearTakerInteraction.getAddress());

        // Deploy OneInchFusionPlusFactory with production components
        console.log(" Step 5: Deploy OneInchFusionPlusFactory");
        const OneInchFusionPlusFactory = await ethers.getContractFactory("OneInchFusionPlusFactory");
        oneInchFactory = await OneInchFusionPlusFactory.deploy(
            await registry.getAddress(),
            productionEscrowFactory.target,
            nearTakerInteraction.target
        );
        await oneInchFactory.waitForDeployment();
        console.log("    OneInchFusionPlusFactory deployed to:", await oneInchFactory.getAddress());

        // Deploy mock ERC20 token
        console.log(" Step 6: Deploy Mock ERC20");
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy("Test Token", "TT", 18);
        await mockERC20.waitForDeployment();
        console.log("    MockERC20 deployed to:", await mockERC20.getAddress());

        // Setup authorization
        console.log(" Step 7: Setup Authorization");
        await oneInchFactory.authorizeResolver(resolver.address);
        await nearTakerInteraction.authorizeResolver(resolver.address);
        console.log("    Resolver authorized in both contracts");

        // Mint tokens to user
        await mockERC20.mint(user.address, ethers.parseEther("1000"));
        console.log("    Minted 1000 TT to user");

        console.log("");
        console.log(" Production Infrastructure Deployed Successfully!");
        console.log("===================================================");
    });

    describe("Full Integration Flow", function () {
        it("Should complete full cross-chain swap flow with production components", async function () {
            console.log("");
            console.log(" Testing Complete Cross-Chain Swap Flow");
            console.log("==========================================");

            // Step 1: Create order
            console.log(" Step 1: Create Cross-Chain Order");
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

            // Approve tokens for the factory
            await mockERC20.connect(user).approve(await oneInchFactory.getAddress(), orderParams.sourceAmount + orderParams.resolverFeeAmount);
            console.log("    Tokens approved");

            const createTx = await oneInchFactory.connect(user).createFusionOrder(orderParams);
            const createReceipt = await createTx.wait();
            
            const createEvent = createReceipt.logs.find(log => {
                try {
                    const parsed = oneInchFactory.interface.parseLog(log);
                    return parsed.name === "FusionOrderCreated";
                } catch (e) {
                    return false;
                }
            });
            const orderHash = createEvent.args.orderHash;
            console.log("    Order created with hash:", orderHash);

            // Step 2: Match order using production escrow
            console.log(" Step 2: Match Order (Deploy Production Escrows)");
            const safetyDeposit = ethers.parseEther("5");
            
            const matchTx = await oneInchFactory.connect(resolver).matchFusionOrder(
                orderHash,
                hashlock,
                { value: safetyDeposit }
            );
            const matchReceipt = await matchTx.wait();
            
            const matchEvent = matchReceipt.logs.find(log => {
                try {
                    const parsed = oneInchFactory.interface.parseLog(log);
                    return parsed.name === "FusionOrderMatched";
                } catch (e) {
                    return false;
                }
            });
            
            expect(matchEvent).to.not.be.undefined;
            console.log("    Order matched successfully");
            console.log("    Source Escrow:", matchEvent.args.sourceEscrow);
            console.log("    Destination Escrow:", matchEvent.args.destinationEscrow);

            // Verify escrow addresses were created
            const [sourceEscrow, destinationEscrow] = await oneInchFactory.getEscrowAddresses(orderHash);
            expect(sourceEscrow).to.not.equal(ethers.ZeroAddress);
            expect(destinationEscrow).to.not.equal(ethers.ZeroAddress);
            console.log("    Escrow addresses verified");

            // Step 3: Verify escrow contracts are functional
            console.log(" Step 3: Verify Escrow Functionality");
            
            // Check destination escrow has received safety deposit
            const dstEscrowBalance = await ethers.provider.getBalance(destinationEscrow);
            expect(dstEscrowBalance).to.be.gte(safetyDeposit);
            console.log("    Destination escrow has safety deposit:", ethers.formatEther(dstEscrowBalance), "ETH");

            // Get escrow contracts
            const ProductionEscrowDst = await ethers.getContractFactory("ProductionEscrowDst");
            const dstEscrowContract = ProductionEscrowDst.attach(destinationEscrow);
            
            const escrowImmutables = await dstEscrowContract.immutables();
            expect(escrowImmutables.orderHash).to.equal(orderHash);
            expect(escrowImmutables.hashlock).to.equal(hashlock);
            console.log("    Escrow immutables verified");

            // Step 4: Test taker interaction
            console.log(" Step 4: Test NearTakerInteraction");
            
            const nearOrderData = {
                destinationChainId: NEAR_TESTNET_CHAIN_ID,
                destinationToken: ethers.toUtf8Bytes("wrap.testnet"),
                destinationAmount: ethers.parseEther("2"),
                destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
                hashlock: hashlock,
                expiryTime: currentTime + 3600,
                chainSpecificParams: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["tuple(bytes,bytes,uint256,bytes)"],
                    [[
                        orderParams.chainParams.destinationAddress,
                        orderParams.chainParams.executionParams,
                        orderParams.chainParams.estimatedGas,
                        orderParams.chainParams.additionalData
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

            const takerTx = await nearTakerInteraction.connect(resolver).takerInteraction(
                mockOrder,
                extension,
                orderHash,
                resolver.address,
                ethers.parseEther("100"),
                ethers.parseEther("2"),
                0,
                "0x"
            );
            const takerReceipt = await takerTx.wait();
            
            const nearEvent = takerReceipt.logs.find(log => {
                try {
                    const parsed = nearTakerInteraction.interface.parseLog(log);
                    return parsed.name === "NearOrderCreated";
                } catch (e) {
                    return false;
                }
            });
            
            expect(nearEvent).to.not.be.undefined;
            console.log("    NEAR order processed through taker interaction");

            // Step 5: Complete order
            console.log(" Step 5: Complete Order");
            const secret = ethers.toUtf8Bytes("secret123");
            const completeTx = await oneInchFactory.connect(resolver).completeFusionOrder(
                orderHash,
                ethers.keccak256(secret)
            );
            const completeReceipt = await completeTx.wait();

            const completeEvent = completeReceipt.logs.find(log => {
                try {
                    const parsed = oneInchFactory.interface.parseLog(log);
                    return parsed.name === "FusionOrderCompleted";
                } catch (e) {
                    return false;
                }
            });
            
            expect(completeEvent).to.not.be.undefined;
            console.log("    Order completed successfully");

            // Verify final state
            const finalOrder = await oneInchFactory.getOrder(orderHash);
            expect(finalOrder.isActive).to.be.false;
            console.log("    Order marked as inactive");

            console.log("");
            console.log(" Full Integration Test PASSED!");
            console.log("================================");
        });

        it("Should handle production escrow creation with proper validation", async function () {
            console.log("");
            console.log(" Testing Production Escrow Validation");
            console.log("=======================================");

            const currentTime = await time.latest();
            const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret456"));
            
            // Test with valid parameters
            const validImmutables = {
                orderHash: ethers.keccak256(ethers.toUtf8Bytes("test-order-2")),
                hashlock: hashlock,
                maker: user.address,
                taker: resolver.address,
                token: mockERC20.target,
                amount: ethers.parseEther("50"),
                safetyDeposit: ethers.parseEther("2.5"),
                timelocks: createPackedTimelocks(currentTime + 3600)
            };

            console.log(" Testing Valid Escrow Creation");
            const createTx = await productionEscrowFactory.connect(resolver).createDstEscrow(
                validImmutables,
                currentTime + 7200,
                { value: validImmutables.safetyDeposit }
            );
            const receipt = await createTx.wait();
            
            const event = receipt.logs.find(log => {
                try {
                    const parsed = productionEscrowFactory.interface.parseLog(log);
                    return parsed.name === "EscrowDstCreated";
                } catch (e) {
                    return false;
                }
            });
            
            expect(event).to.not.be.undefined;
            console.log("    Valid escrow created successfully");
            console.log("    Escrow address:", event.args.escrow);

            // Test validation failures
            console.log(" Testing Validation Failures");
            
            // Test insufficient safety deposit
            const lowDepositImmutables = {
                ...validImmutables,
                orderHash: ethers.keccak256(ethers.toUtf8Bytes("test-order-3")),
                safetyDeposit: ethers.parseEther("0.005") // Too low
            };

            await expect(
                productionEscrowFactory.connect(resolver).createDstEscrow(
                    lowDepositImmutables,
                    currentTime + 7200,
                    { value: ethers.parseEther("1") }
                )
            ).to.be.revertedWith("Safety deposit too low");
            console.log("    Low safety deposit rejected");

            // Test duplicate order hash
            await expect(
                productionEscrowFactory.connect(resolver).createDstEscrow(
                    validImmutables,
                    currentTime + 7200,
                    { value: validImmutables.safetyDeposit }
                )
            ).to.be.revertedWith("Escrow already exists");
            console.log("    Duplicate order hash rejected");

            console.log("    All validation tests passed");
        });

        it("Should demonstrate gas efficiency", async function () {
            console.log("");
            console.log(" Testing Gas Efficiency");
            console.log("========================");

            const currentTime = await time.latest();
            const hashlock = ethers.keccak256(ethers.toUtf8Bytes("gas-test"));
            
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

            // Approve tokens
            await mockERC20.connect(user).approve(await oneInchFactory.getAddress(), orderParams.sourceAmount + orderParams.resolverFeeAmount);

            // Measure order creation gas
            const createTx = await oneInchFactory.connect(user).createFusionOrder(orderParams);
            const createReceipt = await createTx.wait();
            console.log("    Order creation gas:", createReceipt.gasUsed.toString());
            expect(createReceipt.gasUsed).to.be.lessThan(1000000); // Should be reasonable for production

            const createEvent = createReceipt.logs.find(log => {
                try {
                    const parsed = oneInchFactory.interface.parseLog(log);
                    return parsed.name === "FusionOrderCreated";
                } catch (e) {
                    return false;
                }
            });
            const orderHash = createEvent.args.orderHash;

            // Measure order matching gas (includes escrow deployment)
            const matchTx = await oneInchFactory.connect(resolver).matchFusionOrder(
                orderHash,
                hashlock,
                { value: ethers.parseEther("5") }
            );
            const matchReceipt = await matchTx.wait();
            console.log("    Order matching gas:", matchReceipt.gasUsed.toString());
            expect(matchReceipt.gasUsed).to.be.lessThan(800000); // Should be reasonable

            console.log("    Gas usage within acceptable limits");
        });
    });

    describe("Production Readiness Verification", function () {
        it("Should verify all contracts are properly connected", async function () {
            console.log("");
            console.log(" Verifying Contract Connections");
            console.log("=================================");

            // Check registry connections
            expect(await oneInchFactory.registry()).to.equal(registry.target);
            expect(await nearTakerInteraction.registry()).to.equal(registry.target);
            console.log("    Registry connections verified");

            // Check escrow factory connections
            expect(await oneInchFactory.getOneInchEscrowFactory()).to.equal(productionEscrowFactory.target);
            expect(await nearTakerInteraction.escrowFactory()).to.equal(productionEscrowFactory.target);
            console.log("    EscrowFactory connections verified");

            // Check Near taker interaction connection
            expect(await oneInchFactory.getNearTakerInteraction()).to.equal(nearTakerInteraction.target);
            console.log("    NearTakerInteraction connection verified");

            // Check NEAR chain support
            const supportedChains = await oneInchFactory.getSupportedChains();
            expect(supportedChains).to.include(BigInt(NEAR_TESTNET_CHAIN_ID));
            console.log("    NEAR chain support verified");

            // Check resolver authorization
            expect(await oneInchFactory.authorizedResolvers(resolver.address)).to.be.true;
            expect(await nearTakerInteraction.isAuthorizedResolver(resolver.address)).to.be.true;
            console.log("    Resolver authorization verified");

            console.log("    All connections verified - Production Ready!");
        });

        it("Should verify implementation contracts are deployed", async function () {
            console.log("");
            console.log(" Verifying Implementation Contracts");
            console.log("====================================");

            const srcImpl = await productionEscrowFactory.escrowSrcImplementation();
            const dstImpl = await productionEscrowFactory.escrowDstImplementation();

            // Check implementations are not zero addresses
            expect(srcImpl).to.not.equal(ethers.ZeroAddress);
            expect(dstImpl).to.not.equal(ethers.ZeroAddress);
            expect(srcImpl).to.not.equal(dstImpl);
            console.log("    Implementation addresses are valid");

            // Check implementations have code
            const srcCode = await ethers.provider.getCode(srcImpl);
            const dstCode = await ethers.provider.getCode(dstImpl);
            expect(srcCode).to.not.equal("0x");
            expect(dstCode).to.not.equal("0x");
            console.log("    Implementation contracts have code");

            console.log("    EscrowSrc Implementation:", srcImpl);
            console.log("    EscrowDst Implementation:", dstImpl);
            console.log("    Implementation contracts verified!");
        });
    });

    // Helper function to create packed timelocks
    function createPackedTimelocks(expiryTime) {
        const baseTime = Math.floor(Date.now() / 1000);
        const timeBuffer = Math.floor((expiryTime - baseTime) / 7);
        
        const stage1 = baseTime + timeBuffer;
        const stage2 = baseTime + (timeBuffer * 2);
        const stage3 = baseTime + (timeBuffer * 3);
        const stage4 = baseTime + (timeBuffer * 4);
        const stage5 = baseTime + (timeBuffer * 5);
        const stage6 = baseTime + (timeBuffer * 6);
        const stage7 = expiryTime;
        
        return (BigInt(stage1) << 224n) | (BigInt(stage2) << 192n) | (BigInt(stage3) << 160n) | 
               (BigInt(stage4) << 128n) | (BigInt(stage5) << 96n) | (BigInt(stage6) << 64n) | 
               (BigInt(stage7) << 32n);
    }
});