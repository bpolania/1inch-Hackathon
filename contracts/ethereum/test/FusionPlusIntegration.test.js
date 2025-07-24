const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FusionPlus Integration Tests", function () {
  let registry, factory, nearAdapter, token;
  let owner, maker, resolver, other;
  
  const NEAR_TESTNET_ID = 40002;

  beforeEach(async function () {
    [owner, maker, resolver, other] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    token = await MockToken.deploy("Test Token", "TEST", 18);
    await token.waitForDeployment();

    // Deploy CrossChainRegistry
    const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
    registry = await CrossChainRegistry.deploy();
    await registry.waitForDeployment();

    // Deploy NEAR adapter
    const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
    nearAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_ID);
    await nearAdapter.waitForDeployment();

    // Deploy FusionPlusFactory
    const FusionPlusFactory = await ethers.getContractFactory("FusionPlusFactory");
    factory = await FusionPlusFactory.deploy(await registry.getAddress());
    await factory.waitForDeployment();

    // Register NEAR adapter
    await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress());

    // Add resolver
    await factory.authorizeResolver(resolver.address);

    // Mint tokens to maker
    await token.mint(maker.address, ethers.parseEther("1000"));
  });

  describe("Full Deployment Integration", function () {
    it("Should deploy all contracts successfully", async function () {
      // Verify registry deployment
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.getSupportedChainCount()).to.equal(1);
      
      // Verify NEAR adapter deployment
      const chainInfo = await nearAdapter.getChainInfo();
      expect(chainInfo.chainId).to.equal(NEAR_TESTNET_ID);
      expect(chainInfo.name).to.equal("NEAR Protocol Testnet");
      
      // Verify factory deployment
      expect(await factory.registry()).to.equal(await registry.getAddress());
      expect(await factory.resolverCount()).to.equal(1);
      
      // Verify chain registration
      expect(await registry.isChainSupported(NEAR_TESTNET_ID)).to.be.true;
      const registryChainInfo = await registry.getChainInfo(NEAR_TESTNET_ID);
      expect(registryChainInfo.name).to.equal("NEAR Protocol Testnet");
    });

    it("Should support complete order lifecycle", async function () {
      // Step 1: Create order
      const orderParams = {
        sourceToken: await token.getAddress(),
        sourceAmount: ethers.parseEther("100"),
        destinationChainId: NEAR_TESTNET_ID,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"),
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        resolverFeeAmount: ethers.parseEther("1"),
        expiryTime: (await time.latest()) + 7200, // 2 hours from now
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("user.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };

      const tx = await factory.connect(maker).createFusionOrder(orderParams);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderCreated"
      );
      expect(event).to.not.be.undefined;
      const orderHash = event.args[0];

      // Step 2: Verify order creation
      const order = await factory.getOrder(orderHash);
      expect(order.maker).to.equal(maker.address);
      expect(order.isActive).to.be.true;
      expect(await factory.isOrderMatchable(orderHash)).to.be.true;

      // Step 3: Match order
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
      await expect(factory.connect(resolver).matchFusionOrder(orderHash, hashlock))
        .to.emit(factory, "FusionOrderMatched");

      // Step 4: Verify escrow creation
      const [sourceEscrow, destinationEscrow] = await factory.getEscrowAddresses(orderHash);
      expect(sourceEscrow).to.not.equal(ethers.ZeroAddress);
      expect(destinationEscrow).to.not.equal(ethers.ZeroAddress);
      expect(await factory.isOrderMatchable(orderHash)).to.be.false;

      // Step 5: Cancel order should fail (already matched)
      await expect(factory.connect(maker).cancelFusionOrder(orderHash))
        .to.be.revertedWith("Order already matched");
    });

    it("Should validate cross-chain parameters correctly", async function () {
      // Test valid NEAR address
      const validAddress = ethers.toUtf8Bytes("user.testnet");
      expect(await nearAdapter.validateDestinationAddress(validAddress)).to.be.true;
      
      // Test invalid NEAR address
      const invalidAddress = ethers.toUtf8Bytes("INVALID.NEAR");
      expect(await nearAdapter.validateDestinationAddress(invalidAddress)).to.be.false;

      // Test parameter validation through registry
      const validParams = {
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000,
        additionalData: ethers.toUtf8Bytes("")
      };

      const validation = await registry.validateOrderParams(
        NEAR_TESTNET_ID,
        validParams,
        ethers.parseEther("100")
      );
      expect(validation.isValid).to.be.true;

      // Test cost estimation
      const cost = await registry.estimateExecutionCost(
        NEAR_TESTNET_ID,
        validParams,
        ethers.parseEther("100")
      );
      expect(cost).to.be.gt(0);

      const safetyDeposit = await registry.calculateMinSafetyDeposit(
        NEAR_TESTNET_ID,
        ethers.parseEther("100")
      );
      expect(safetyDeposit).to.equal(ethers.parseEther("5")); // 5%
    });

    it("Should handle multiple destination chains", async function () {
      // Deploy NEAR mainnet adapter
      const NEAR_MAINNET_ID = 40001;
      const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
      const nearMainnetAdapter = await NearDestinationChain.deploy(NEAR_MAINNET_ID);
      await nearMainnetAdapter.waitForDeployment();

      // Register mainnet adapter
      await registry.registerChainAdapter(NEAR_MAINNET_ID, await nearMainnetAdapter.getAddress());

      // Verify both chains are supported
      const supportedChains = await registry.getSupportedChainIds();
      expect(supportedChains).to.include(BigInt(NEAR_TESTNET_ID));
      expect(supportedChains).to.include(BigInt(NEAR_MAINNET_ID));
      expect(supportedChains.length).to.equal(2);

      // Test factory supports both chains
      const factorySupportedChains = await factory.getSupportedChains();
      expect(factorySupportedChains).to.include(BigInt(NEAR_TESTNET_ID));
      expect(factorySupportedChains).to.include(BigInt(NEAR_MAINNET_ID));
    });

    it("Should enforce security constraints", async function () {
      // Test unauthorized resolver cannot match orders
      await expect(factory.connect(other).authorizeResolver(other.address))
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

      // Create an order for testing
      const orderParams = {
        sourceToken: await token.getAddress(),
        sourceAmount: ethers.parseEther("100"),
        destinationChainId: NEAR_TESTNET_ID,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"),
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        resolverFeeAmount: ethers.parseEther("1"),
        expiryTime: (await time.latest()) + 7200,
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("user.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };

      const tx = await factory.connect(maker).createFusionOrder(orderParams);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderCreated"
      );
      const orderHash = event.args[0];

      // Unauthorized user cannot match
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
      await expect(factory.connect(other).matchFusionOrder(orderHash, hashlock))
        .to.be.revertedWith("Not authorized resolver");

      // Only owner can manage registry
      await expect(registry.connect(other).registerChainAdapter(99999, await nearAdapter.getAddress()))
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("Should handle order expiration correctly", async function () {
      // Create order with future expiry first
      const futureExpiry = (await time.latest()) + 3600; // 1 hour
      const orderParams = {
        sourceToken: await token.getAddress(),
        sourceAmount: ethers.parseEther("100"),
        destinationChainId: NEAR_TESTNET_ID,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"),
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        resolverFeeAmount: ethers.parseEther("1"),
        expiryTime: futureExpiry,
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("user.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };

      const tx = await factory.connect(maker).createFusionOrder(orderParams);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderCreated"
      );
      const orderHash = event.args[0];

      // Order should be matchable initially
      expect(await factory.isOrderMatchable(orderHash)).to.be.true;

      // Fast forward past expiry
      await time.increaseTo(futureExpiry + 10);

      // Order should no longer be matchable
      expect(await factory.isOrderMatchable(orderHash)).to.be.false;

      // Matching should fail
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
      await expect(factory.connect(resolver).matchFusionOrder(orderHash, hashlock))
        .to.be.revertedWith("Order expired");

      // But cancellation by anyone should work
      await expect(factory.connect(other).cancelFusionOrder(orderHash))
        .to.emit(factory, "FusionOrderCancelled");
    });
  });

  describe("NEAR-Specific Integration", function () {
    it("Should handle NEAR execution parameters correctly", async function () {
      // Test creating default NEAR execution parameters
      const contractId = "fusion-plus.demo.cuteharbor3573.testnet";
      const amount = ethers.parseEther("2");
      
      const executionParams = await nearAdapter.createDefaultExecutionParams(contractId, amount);
      expect(executionParams).to.not.equal("0x");

      // Test encoding/decoding
      const nearParams = {
        contractId: contractId,
        methodName: "execute_fusion_order",
        args: ethers.toUtf8Bytes('{"amount":"2000000000000000000000000"}'),
        attachedDeposit: amount,
        gas: 300000000000000
      };

      const encoded = await nearAdapter.encodeNearExecutionParams(nearParams);
      const decoded = await nearAdapter.decodeNearExecutionParams(encoded);
      
      expect(decoded.contractId).to.equal(nearParams.contractId);
      expect(decoded.methodName).to.equal(nearParams.methodName);
      expect(decoded.attachedDeposit).to.equal(nearParams.attachedDeposit);
    });

    it("Should validate NEAR addresses comprehensively", async function () {
      const validAddresses = [
        "alice.near",
        "bob.testnet", 
        "my-account.near",
        "test_account.testnet",
        "fusion-plus.demo.cuteharbor3573.testnet"
      ];

      const invalidAddresses = [
        "alice..near",     // Double dots
        ".alice.near",     // Leading dot
        "alice.near.",     // Trailing dot
        "a",              // Too short
        "a".repeat(65),   // Too long
        "alice near",     // Space
        "alice@near",     // Invalid character
        "ALICE.NEAR",     // Uppercase (if validation is case-sensitive)
        ""                // Empty
      ];

      for (const address of validAddresses) {
        expect(await nearAdapter.validateDestinationAddress(ethers.toUtf8Bytes(address)))
          .to.be.true;
      }

      for (const address of invalidAddresses) {
        expect(await nearAdapter.validateDestinationAddress(ethers.toUtf8Bytes(address)))
          .to.be.false;
      }
    });

    it("Should support NEAR features correctly", async function () {
      const supportedFeatures = [
        "atomic_swaps",
        "htlc", 
        "resolver_fees",
        "safety_deposits",
        "timelock_stages"
      ];

      const unsupportedFeatures = [
        "partial_fills",
        "batch_execution",
        "unsupported_feature"
      ];

      for (const feature of supportedFeatures) {
        expect(await nearAdapter.supportsFeature(feature)).to.be.true;
      }

      for (const feature of unsupportedFeatures) {
        expect(await nearAdapter.supportsFeature(feature)).to.be.false;
      }

      // Test supported token formats
      const formats = await nearAdapter.getSupportedTokenFormats();
      expect(formats).to.include("native");
      expect(formats).to.include("nep141");
    });
  });

  describe("Error Handling", function () {
    it("Should handle invalid chain registrations", async function () {
      // Try to register with wrong chain ID
      const wrongAdapter = await ethers.getContractFactory("NearDestinationChain");
      const wrongChainAdapter = await wrongAdapter.deploy(NEAR_TESTNET_ID);
      await wrongChainAdapter.waitForDeployment();

      await expect(registry.registerChainAdapter(99999, await wrongChainAdapter.getAddress()))
        .to.be.revertedWith("Chain ID mismatch");

      // Try to register duplicate chain
      await expect(registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress()))
        .to.be.revertedWith("Chain already registered");

      // Try to register zero address
      await expect(registry.registerChainAdapter(40003, ethers.ZeroAddress))
        .to.be.revertedWith("Invalid adapter address");
    });

    it("Should handle invalid order parameters", async function () {
      // Get current block timestamp for reliable testing
      const currentTime = await time.latest();
      
      const invalidParams = [
        {
          name: "zero source amount",
          params: { sourceAmount: 0 },
          error: "Invalid source amount"
        },
        {
          name: "zero destination amount", 
          params: { destinationAmount: 0 },
          error: "Invalid destination amount"
        },
        {
          name: "past expiry time",
          params: { expiryTime: currentTime - 3600 },
          error: "Invalid expiry time"
        },
        {
          name: "low resolver fee",
          params: { 
            resolverFeeAmount: ethers.parseEther("0.01"),
            expiryTime: currentTime + 3600 // Ensure valid expiry
          },
          error: "Resolver fee too low"
        }
      ];

      const baseParams = {
        sourceToken: await token.getAddress(),
        sourceAmount: ethers.parseEther("100"),
        destinationChainId: NEAR_TESTNET_ID,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"),
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        resolverFeeAmount: ethers.parseEther("1"),
        expiryTime: currentTime + 3600,
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("user.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };

      for (const testCase of invalidParams) {
        const params = { ...baseParams, ...testCase.params };
        await expect(factory.connect(maker).createFusionOrder(params))
          .to.be.revertedWith(testCase.error);
      }
    });
  });
});