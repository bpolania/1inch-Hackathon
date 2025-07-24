const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FusionPlusFactory", function () {
  let registry, factory, nearAdapter, token;
  let owner, maker, resolver1, resolver2, other;
  let orderHash;
  
  const NEAR_TESTNET_ID = 40002;
  const NEAR_MAINNET_ID = 40001;

  beforeEach(async function () {
    [owner, maker, resolver1, resolver2, other] = await ethers.getSigners();

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

    // Register NEAR adapter
    await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress());

    // Deploy FusionPlusFactory
    const FusionPlusFactory = await ethers.getContractFactory("FusionPlusFactory");
    factory = await FusionPlusFactory.deploy(await registry.getAddress());
    await factory.waitForDeployment();

    // Add resolvers
    await factory.authorizeResolver(resolver1.address);
  });

  describe("Deployment", function () {
    it("Should deploy with correct registry", async function () {
      expect(await factory.registry()).to.equal(await registry.getAddress());
    });

    it("Should initialize with zero counts", async function () {
      expect(await factory.resolverCount()).to.equal(1); // We added one in beforeEach
      expect(await factory.totalOrdersCreated()).to.equal(0);
    });
  });

  describe("Resolver Management", function () {
    it("Should authorize resolver correctly", async function () {
      await expect(factory.authorizeResolver(resolver2.address))
        .to.emit(factory, "ResolverAuthorized")
        .withArgs(resolver2.address);
      
      expect(await factory.authorizedResolvers(resolver2.address)).to.be.true;
      expect(await factory.resolverCount()).to.equal(2);
    });

    it("Should prevent authorizing duplicate resolver", async function () {
      await expect(factory.authorizeResolver(resolver1.address))
        .to.be.revertedWith("Resolver already authorized");
    });

    it("Should revoke resolver correctly", async function () {
      await expect(factory.revokeResolver(resolver1.address))
        .to.emit(factory, "ResolverRevoked")
        .withArgs(resolver1.address);
      
      expect(await factory.authorizedResolvers(resolver1.address)).to.be.false;
      expect(await factory.resolverCount()).to.equal(0);
    });

    it("Should only allow owner to manage resolvers", async function () {
      await expect(factory.connect(other).authorizeResolver(resolver2.address))
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });

  describe("Order Creation", function () {
    let orderParams;

    beforeEach(async function () {
      // Mint tokens to maker
      await token.mint(maker.address, ethers.parseEther("1000"));
      
      orderParams = {
        sourceToken: await token.getAddress(),
        sourceAmount: ethers.parseEther("100"),
        destinationChainId: NEAR_TESTNET_ID,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"),
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        resolverFeeAmount: ethers.parseEther("1"), // 1% fee
        expiryTime: (await time.latest()) + 3600, // 1 hour from now
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("user.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };
    });

    it("Should create Fusion+ order correctly", async function () {
      const tx = await factory.connect(maker).createFusionOrder(orderParams);
      const receipt = await tx.wait();
      
      // Check event emission
      const event = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderCreated"
      );
      expect(event).to.not.be.undefined;
      
      const orderHash = event.args[0];
      
      // Check order storage
      const order = await factory.getOrder(orderHash);
      expect(order.maker).to.equal(maker.address);
      expect(order.sourceToken).to.equal(await token.getAddress());
      expect(order.sourceAmount).to.equal(orderParams.sourceAmount);
      expect(order.destinationChainId).to.equal(NEAR_TESTNET_ID);
      expect(order.isActive).to.be.true;
      
      // Check counters
      expect(await factory.totalOrdersCreated()).to.equal(1);
    });

    it("Should reject invalid parameters", async function () {
      // Zero source amount
      const invalidParams1 = { ...orderParams, sourceAmount: 0 };
      await expect(factory.connect(maker).createFusionOrder(invalidParams1))
        .to.be.revertedWith("Invalid source amount");

      // Zero destination amount
      const invalidParams2 = { ...orderParams, destinationAmount: 0 };
      await expect(factory.connect(maker).createFusionOrder(invalidParams2))
        .to.be.revertedWith("Invalid destination amount");

      // Past expiry time
      const invalidParams3 = { ...orderParams, expiryTime: (await time.latest()) - 3600 };
      await expect(factory.connect(maker).createFusionOrder(invalidParams3))
        .to.be.revertedWith("Invalid expiry time");

      // Low resolver fee (< 0.1%)
      const invalidParams4 = { ...orderParams, resolverFeeAmount: ethers.parseEther("0.01") };
      await expect(factory.connect(maker).createFusionOrder(invalidParams4))
        .to.be.revertedWith("Resolver fee too low");
    });

    it("Should reject unsupported destination chain", async function () {
      const invalidParams = { ...orderParams, destinationChainId: 99999 };
      await expect(factory.connect(maker).createFusionOrder(invalidParams))
        .to.be.revertedWith("Destination chain not supported");
    });

    it("Should generate unique order hashes", async function () {
      const tx1 = await factory.connect(maker).createFusionOrder(orderParams);
      const receipt1 = await tx1.wait();
      const orderHash1 = receipt1.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderCreated"
      ).args[0];

      // Wait a bit and create another order
      await time.increase(1);
      const tx2 = await factory.connect(maker).createFusionOrder(orderParams);
      const receipt2 = await tx2.wait();
      const orderHash2 = receipt2.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderCreated"
      ).args[0];

      expect(orderHash1).to.not.equal(orderHash2);
    });
  });

  describe("Order Matching", function () {
    let orderHash, hashlock;

    beforeEach(async function () {
      // Create an order first
      await token.mint(maker.address, ethers.parseEther("1000"));
      
      const orderParams = {
        sourceToken: await token.getAddress(),
        sourceAmount: ethers.parseEther("100"),
        destinationChainId: NEAR_TESTNET_ID,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"),
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        resolverFeeAmount: ethers.parseEther("1"),
        expiryTime: (await time.latest()) + 3600,
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("user.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };

      const tx = await factory.connect(maker).createFusionOrder(orderParams);
      const receipt = await tx.wait();
      orderHash = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderCreated"
      ).args[0];

      hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
    });

    it("Should match order correctly", async function () {
      const tx = await factory.connect(resolver1).matchFusionOrder(orderHash, hashlock);
      const receipt = await tx.wait();
      
      // Find the FusionOrderMatched event
      const event = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderMatched"
      );
      expect(event).to.not.be.undefined;
      
      // Verify event parameters
      expect(event.args[0]).to.equal(orderHash); // orderHash
      expect(event.args[1]).to.equal(resolver1.address); // resolver
      expect(event.args[2]).to.not.equal(ethers.ZeroAddress); // sourceEscrow
      expect(event.args[3]).to.not.equal(ethers.ZeroAddress); // destinationEscrow
      expect(event.args[4]).to.equal(hashlock); // hashlock
      expect(event.args[5]).to.be.gt(0); // safetyDeposit

      const [sourceEscrow, destinationEscrow] = await factory.getEscrowAddresses(orderHash);
      expect(sourceEscrow).to.equal(event.args[2]);
      expect(destinationEscrow).to.equal(event.args[3]);
    });

    it("Should only allow authorized resolvers to match", async function () {
      await expect(factory.connect(other).matchFusionOrder(orderHash, hashlock))
        .to.be.revertedWith("Not authorized resolver");
    });

    it("Should prevent matching expired orders", async function () {
      // Fast forward past expiry
      await time.increaseTo((await time.latest()) + 7200);
      
      await expect(factory.connect(resolver1).matchFusionOrder(orderHash, hashlock))
        .to.be.revertedWith("Order expired");
    });

    it("Should prevent double matching", async function () {
      await factory.connect(resolver1).matchFusionOrder(orderHash, hashlock);
      
      await expect(factory.connect(resolver1).matchFusionOrder(orderHash, hashlock))
        .to.be.revertedWith("Order already matched");
    });

    it("Should reject invalid hashlock", async function () {
      await expect(factory.connect(resolver1).matchFusionOrder(orderHash, ethers.ZeroHash))
        .to.be.revertedWith("Invalid hashlock");
    });
  });

  describe("Order Cancellation", function () {
    let orderHash;

    beforeEach(async function () {
      await token.mint(maker.address, ethers.parseEther("1000"));
      
      const orderParams = {
        sourceToken: await token.getAddress(),
        sourceAmount: ethers.parseEther("100"),
        destinationChainId: NEAR_TESTNET_ID,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"),
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        resolverFeeAmount: ethers.parseEther("1"),
        expiryTime: (await time.latest()) + 3600,
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("user.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };

      const tx = await factory.connect(maker).createFusionOrder(orderParams);
      const receipt = await tx.wait();
      orderHash = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderCreated"
      ).args[0];
    });

    it("Should allow maker to cancel", async function () {
      await expect(factory.connect(maker).cancelFusionOrder(orderHash))
        .to.emit(factory, "FusionOrderCancelled")
        .withArgs(orderHash, maker.address);

      const order = await factory.getOrder(orderHash);
      expect(order.isActive).to.be.false;
    });

    it("Should allow cancellation after expiry", async function () {
      // Fast forward past expiry
      await time.increaseTo((await time.latest()) + 7200);
      
      await expect(factory.connect(other).cancelFusionOrder(orderHash))
        .to.emit(factory, "FusionOrderCancelled");
    });

    it("Should prevent unauthorized cancellation", async function () {
      await expect(factory.connect(other).cancelFusionOrder(orderHash))
        .to.be.revertedWith("Not authorized to cancel");
    });

    it("Should prevent cancellation of matched orders", async function () {
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
      await factory.connect(resolver1).matchFusionOrder(orderHash, hashlock);
      
      await expect(factory.connect(maker).cancelFusionOrder(orderHash))
        .to.be.revertedWith("Order already matched");
    });
  });

  describe("Utility Functions", function () {
    let orderHash;

    beforeEach(async function () {
      await token.mint(maker.address, ethers.parseEther("1000"));
      
      const orderParams = {
        sourceToken: await token.getAddress(),
        sourceAmount: ethers.parseEther("100"),
        destinationChainId: NEAR_TESTNET_ID,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"),
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        resolverFeeAmount: ethers.parseEther("1"),
        expiryTime: (await time.latest()) + 3600,
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("user.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };

      const tx = await factory.connect(maker).createFusionOrder(orderParams);
      const receipt = await tx.wait();
      orderHash = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "FusionOrderCreated"
      ).args[0];
    });

    it("Should check if order is matchable", async function () {
      expect(await factory.isOrderMatchable(orderHash)).to.be.true;
      
      // After matching, should be false
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret123"));
      await factory.connect(resolver1).matchFusionOrder(orderHash, hashlock);
      expect(await factory.isOrderMatchable(orderHash)).to.be.false;
    });

    it("Should get supported chains", async function () {
      const supportedChains = await factory.getSupportedChains();
      expect(supportedChains).to.include(BigInt(NEAR_TESTNET_ID));
    });

    it("Should estimate order costs", async function () {
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000,
        additionalData: ethers.toUtf8Bytes("")
      };

      const [estimatedCost, safetyDeposit] = await factory.estimateOrderCosts(
        NEAR_TESTNET_ID,
        chainParams,
        ethers.parseEther("100")
      );

      expect(estimatedCost).to.be.gt(0);
      expect(safetyDeposit).to.be.gt(0);
    });
  });

  describe("Timelock Functions", function () {
    it("Should calculate default timelocks", async function () {
      const timelocks = await factory.calculateDefaultTimelocks();
      expect(timelocks).to.be.gt(0);
    });
  });
});