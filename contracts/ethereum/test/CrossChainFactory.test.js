const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CrossChainFactory", function () {
  let factory, token;
  let owner, maker, resolver1, resolver2, other;
  let orderHash;

  beforeEach(async function () {
    [owner, maker, resolver1, resolver2, other] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    token = await MockToken.deploy("Test Token", "TEST", 18);

    // Deploy factory
    const CrossChainFactory = await ethers.getContractFactory("CrossChainFactory");
    factory = await CrossChainFactory.deploy();

    orderHash = ethers.keccak256(ethers.toUtf8Bytes("test-order-1"));
  });

  describe("Resolver Management", function () {
    it("Should add resolver correctly", async function () {
      await expect(factory.addResolver(resolver1.address))
        .to.emit(factory, "ResolverAdded")
        .withArgs(resolver1.address);
      
      expect(await factory.authorizedResolvers(resolver1.address)).to.be.true;
      expect(await factory.resolverCount()).to.equal(1);
    });

    it("Should prevent adding duplicate resolver", async function () {
      await factory.addResolver(resolver1.address);
      
      await expect(factory.addResolver(resolver1.address))
        .to.be.revertedWith("Resolver already added");
    });

    it("Should remove resolver correctly", async function () {
      await factory.addResolver(resolver1.address);
      
      await expect(factory.removeResolver(resolver1.address))
        .to.emit(factory, "ResolverRemoved")
        .withArgs(resolver1.address);
      
      expect(await factory.authorizedResolvers(resolver1.address)).to.be.false;
      expect(await factory.resolverCount()).to.equal(0);
    });

    it("Should only allow owner to manage resolvers", async function () {
      await expect(factory.connect(other).addResolver(resolver1.address))
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });

  describe("Intent Management", function () {
    const intentParams = {
      sourceToken: "0x0000000000000000000000000000000000000000", // ETH
      sourceAmount: ethers.parseEther("1.0"),
      destinationChain: 10001, // Aptos
      destinationToken: "0x0000000000000000000000000000000000000000",
      destinationAmount: ethers.parseEther("0.025"),
      destinationAddress: "0x742d35Cc6634C0532925a3b8D8432e0c53a36435",
      resolverFeeAmount: ethers.parseEther("0.003"),
    };

    it("Should create intent correctly", async function () {
      const expiryTime = (await time.latest()) + 3600; // 1 hour
      
      await expect(factory.connect(maker).createIntent(
        orderHash,
        intentParams.sourceToken,
        intentParams.sourceAmount,
        intentParams.destinationChain,
        intentParams.destinationToken,
        intentParams.destinationAmount,
        intentParams.destinationAddress,
        intentParams.resolverFeeAmount,
        expiryTime
      )).to.emit(factory, "IntentCreated")
        .withArgs(
          orderHash,
          maker.address,
          intentParams.sourceToken,
          intentParams.sourceAmount,
          intentParams.destinationChain,
          intentParams.destinationToken,
          intentParams.destinationAmount,
          intentParams.destinationAddress,
          intentParams.resolverFeeAmount,
          expiryTime
        );
      
      const intentInfo = await factory.getIntentInfo(orderHash);
      expect(intentInfo.maker).to.equal(maker.address);
      expect(intentInfo.isActive).to.be.true;
    });

    it("Should prevent duplicate intents", async function () {
      const expiryTime = (await time.latest()) + 3600;
      
      await factory.connect(maker).createIntent(
        orderHash,
        intentParams.sourceToken,
        intentParams.sourceAmount,
        intentParams.destinationChain,
        intentParams.destinationToken,
        intentParams.destinationAmount,
        intentParams.destinationAddress,
        intentParams.resolverFeeAmount,
        expiryTime
      );
      
      await expect(factory.connect(maker).createIntent(
        orderHash,
        intentParams.sourceToken,
        intentParams.sourceAmount,
        intentParams.destinationChain,
        intentParams.destinationToken,
        intentParams.destinationAmount,
        intentParams.destinationAddress,
        intentParams.resolverFeeAmount,
        expiryTime
      )).to.be.revertedWith("Intent already exists");
    });

    it("Should reject invalid parameters", async function () {
      const expiryTime = (await time.latest()) + 3600;
      
      // Zero source amount
      await expect(factory.connect(maker).createIntent(
        orderHash,
        intentParams.sourceToken,
        0,
        intentParams.destinationChain,
        intentParams.destinationToken,
        intentParams.destinationAmount,
        intentParams.destinationAddress,
        intentParams.resolverFeeAmount,
        expiryTime
      )).to.be.revertedWith("Invalid source amount");
      
      // Past expiry time
      await expect(factory.connect(maker).createIntent(
        orderHash,
        intentParams.sourceToken,
        intentParams.sourceAmount,
        intentParams.destinationChain,
        intentParams.destinationToken,
        intentParams.destinationAmount,
        intentParams.destinationAddress,
        intentParams.resolverFeeAmount,
        (await time.latest()) - 1
      )).to.be.revertedWith("Invalid expiry time");
      
      // Low resolver fee
      await expect(factory.connect(maker).createIntent(
        orderHash,
        intentParams.sourceToken,
        intentParams.sourceAmount,
        intentParams.destinationChain,
        intentParams.destinationToken,
        intentParams.destinationAmount,
        intentParams.destinationAddress,
        ethers.parseEther("0.0005"), // Less than 0.1%
        expiryTime
      )).to.be.revertedWith("Resolver fee too low");
    });
  });

  describe("Intent Matching", function () {
    const intentParams = {
      sourceToken: "0x0000000000000000000000000000000000000000",
      sourceAmount: ethers.parseEther("1.0"),
      destinationChain: 10001,
      destinationToken: "0x0000000000000000000000000000000000000000",
      destinationAmount: ethers.parseEther("0.025"),
      destinationAddress: "0x742d35Cc6634C0532925a3b8D8432e0c53a36435",
      resolverFeeAmount: ethers.parseEther("0.003"),
    };

    let hashlock, timelocks, expiryTime;

    beforeEach(async function () {
      await factory.addResolver(resolver1.address);
      
      expiryTime = (await time.latest()) + 3600;
      await factory.connect(maker).createIntent(
        orderHash,
        intentParams.sourceToken,
        intentParams.sourceAmount,
        intentParams.destinationChain,
        intentParams.destinationToken,
        intentParams.destinationAmount,
        intentParams.destinationAddress,
        intentParams.resolverFeeAmount,
        expiryTime
      );
      
      // Setup matching parameters
      const secret = ethers.encodeBytes32String("test-secret");
      hashlock = ethers.keccak256(secret);
      
      // Pack timelocks
      const now = await time.latest();
      const stages = [
        now + 1800,   // 30 minutes
        now + 3600,   // 1 hour
        now + 7200,   // 2 hours
        now + 10800,  // 3 hours
        now + 1800,   // 30 minutes
        now + 3600,   // 1 hour
        now + 7200,   // 2 hours
      ];
      
      let packed = 0n;
      for (let i = 0; i < stages.length; i++) {
        packed = packed | (BigInt(stages[i]) << BigInt(i * 32));
      }
      timelocks = packed;
    });

    it("Should match intent and create escrows", async function () {
      await expect(factory.connect(resolver1).matchIntent(orderHash, hashlock, timelocks))
        .to.emit(factory, "EscrowsCreated")
        .to.emit(factory, "IntentMatched");
      
      const [sourceEscrow, destinationEscrow] = await factory.getEscrowAddresses(orderHash);
      expect(sourceEscrow).to.not.equal("0x0000000000000000000000000000000000000000");
      expect(destinationEscrow).to.not.equal("0x0000000000000000000000000000000000000000");
      expect(sourceEscrow).to.not.equal(destinationEscrow);
    });

    it("Should only allow authorized resolvers to match", async function () {
      await expect(factory.connect(other).matchIntent(orderHash, hashlock, timelocks))
        .to.be.revertedWith("Not authorized resolver");
    });

    it("Should prevent matching expired intents", async function () {
      await time.increaseTo(expiryTime + 1);
      
      await expect(factory.connect(resolver1).matchIntent(orderHash, hashlock, timelocks))
        .to.be.revertedWith("Intent expired");
    });

    it("Should prevent double matching", async function () {
      await factory.connect(resolver1).matchIntent(orderHash, hashlock, timelocks);
      
      await expect(factory.connect(resolver1).matchIntent(orderHash, hashlock, timelocks))
        .to.be.revertedWith("Already matched");
    });

    it("Should calculate safety deposit correctly", async function () {
      const expectedDeposit = await factory.calculateSafetyDeposit(intentParams.sourceAmount);
      const expectedBps = await factory.minimumSafetyDepositBps();
      const calculatedDeposit = intentParams.sourceAmount * expectedBps / 10000n;
      
      expect(expectedDeposit).to.equal(calculatedDeposit);
    });
  });

  describe("Intent Cancellation", function () {
    const intentParams = {
      sourceToken: "0x0000000000000000000000000000000000000000",
      sourceAmount: ethers.parseEther("1.0"),
      destinationChain: 10001,
      destinationToken: "0x0000000000000000000000000000000000000000",
      destinationAmount: ethers.parseEther("0.025"),
      destinationAddress: "0x742d35Cc6634C0532925a3b8D8432e0c53a36435",
      resolverFeeAmount: ethers.parseEther("0.003"),
    };

    let expiryTime;

    beforeEach(async function () {
      expiryTime = (await time.latest()) + 3600;
      await factory.connect(maker).createIntent(
        orderHash,
        intentParams.sourceToken,
        intentParams.sourceAmount,
        intentParams.destinationChain,
        intentParams.destinationToken,
        intentParams.destinationAmount,
        intentParams.destinationAddress,
        intentParams.resolverFeeAmount,
        expiryTime
      );
    });

    it("Should allow maker to cancel", async function () {
      await factory.connect(maker).cancelIntent(orderHash);
      
      const intentInfo = await factory.getIntentInfo(orderHash);
      expect(intentInfo.isActive).to.be.false;
    });

    it("Should allow cancellation after expiry", async function () {
      await time.increaseTo(expiryTime + 1);
      
      await factory.connect(other).cancelIntent(orderHash);
      
      const intentInfo = await factory.getIntentInfo(orderHash);
      expect(intentInfo.isActive).to.be.false;
    });

    it("Should prevent unauthorized cancellation", async function () {
      await expect(factory.connect(other).cancelIntent(orderHash))
        .to.be.revertedWith("Not authorized to cancel");
    });

    it("Should prevent cancellation of matched intents", async function () {
      await factory.addResolver(resolver1.address);
      
      const secret = ethers.encodeBytes32String("test-secret");
      const hashlock = ethers.keccak256(secret);
      const timelocks = 123456789n; // Mock packed timelocks
      
      await factory.connect(resolver1).matchIntent(orderHash, hashlock, timelocks);
      
      await expect(factory.connect(maker).cancelIntent(orderHash))
        .to.be.revertedWith("Intent already matched");
    });
  });

  describe("Utility Functions", function () {
    it("Should check intent activity correctly", async function () {
      expect(await factory.isIntentActive(orderHash)).to.be.false;
      
      const expiryTime = (await time.latest()) + 3600;
      await factory.connect(maker).createIntent(
        orderHash,
        "0x0000000000000000000000000000000000000000",
        ethers.parseEther("1.0"),
        10001,
        "0x0000000000000000000000000000000000000000",
        ethers.parseEther("0.025"),
        "0x742d35Cc6634C0532925a3b8D8432e0c53a36435",
        ethers.parseEther("0.003"),
        expiryTime
      );
      
      expect(await factory.isIntentActive(orderHash)).to.be.true;
      
      // Should become inactive after expiry
      await time.increaseTo(expiryTime + 1);
      expect(await factory.isIntentActive(orderHash)).to.be.false;
    });

    it("Should update minimum safety deposit", async function () {
      await factory.setMinimumSafetyDepositBps(1000); // 10%
      expect(await factory.minimumSafetyDepositBps()).to.equal(1000);
      
      await expect(factory.setMinimumSafetyDepositBps(2001)) // > 20%
        .to.be.revertedWith("Safety deposit too high");
    });
  });
});