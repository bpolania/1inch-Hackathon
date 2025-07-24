const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainRegistry", function () {
  let registry, nearAdapter, cosmosAdapter;
  let owner, other;
  
  const NEAR_TESTNET_ID = 40002;
  const NEAR_MAINNET_ID = 40001;
  const COSMOS_MAINNET_ID = 40003;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    // Deploy CrossChainRegistry
    const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
    registry = await CrossChainRegistry.deploy();
    await registry.waitForDeployment();

    // Deploy NEAR adapter
    const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
    nearAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_ID);
    await nearAdapter.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with owner set correctly", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("Should initialize with no chains", async function () {
      const supportedChains = await registry.getSupportedChainIds();
      expect(supportedChains.length).to.equal(0);
    });
  });

  describe("Chain Adapter Registration", function () {
    it("Should register chain adapter correctly", async function () {
      await expect(registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress()))
        .to.emit(registry, "ChainAdapterRegistered")
        .withArgs(NEAR_TESTNET_ID, await nearAdapter.getAddress(), "NEAR Protocol Testnet");

      expect(await registry.isChainSupported(NEAR_TESTNET_ID)).to.be.true;
      
      const chainInfo = await registry.getChainInfo(NEAR_TESTNET_ID);
      expect(chainInfo.name).to.equal("NEAR Protocol Testnet");
      expect(chainInfo.isActive).to.be.true;
    });

    it("Should prevent registering duplicate chain", async function () {
      await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress());
      
      await expect(registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress()))
        .to.be.revertedWith("Chain already registered");
    });

    it("Should prevent registering with zero address", async function () {
      await expect(registry.registerChainAdapter(NEAR_TESTNET_ID, ethers.ZeroAddress))
        .to.be.revertedWith("Invalid adapter address");
    });

    it("Should only allow owner to register", async function () {
      await expect(registry.connect(other).registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress()))
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Chain Management", function () {
    beforeEach(async function () {
      await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress());
    });

    it("Should update chain adapter", async function () {
      // Get the old adapter address before updating
      const oldAdapterAddress = await registry.getChainAdapter(NEAR_TESTNET_ID);
      
      // Deploy new adapter
      const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
      const newAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_ID);
      await newAdapter.waitForDeployment();

      await expect(registry.updateChainAdapter(NEAR_TESTNET_ID, await newAdapter.getAddress()))
        .to.emit(registry, "ChainAdapterUpdated")
        .withArgs(NEAR_TESTNET_ID, oldAdapterAddress, await newAdapter.getAddress());

      // Verify the adapter was updated
      const updatedAdapter = await registry.getChainAdapter(NEAR_TESTNET_ID);
      expect(updatedAdapter).to.equal(await newAdapter.getAddress());
    });

    it("Should remove chain adapter", async function () {
      await expect(registry.removeChainAdapter(NEAR_TESTNET_ID))
        .to.emit(registry, "ChainAdapterRemoved")
        .withArgs(NEAR_TESTNET_ID, "NEAR Protocol Testnet");

      expect(await registry.isChainSupported(NEAR_TESTNET_ID)).to.be.false;
      const supportedChains = await registry.getSupportedChainIds();
      expect(supportedChains.length).to.equal(0);
    });

    it("Should only allow owner to manage chains", async function () {
      await expect(registry.connect(other).removeChainAdapter(NEAR_TESTNET_ID))
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Parameter Validation", function () {
    let chainParams;

    beforeEach(async function () {
      await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress());
      
      chainParams = {
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000,
        additionalData: ethers.toUtf8Bytes("")
      };
    });

    it("Should validate order parameters correctly", async function () {
      const validation = await registry.validateOrderParams(
        NEAR_TESTNET_ID,
        chainParams,
        ethers.parseEther("100")
      );

      expect(validation.isValid).to.be.true;
      expect(validation.errorMessage).to.equal("");
    });

    it("Should reject validation for unsupported chain", async function () {
      await expect(registry.validateOrderParams(
        99999,
        chainParams,
        ethers.parseEther("100")
      )).to.be.revertedWith("Chain not supported");
    });

  });

  describe("Cost Estimation", function () {
    let chainParams;

    beforeEach(async function () {
      await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress());
      
      chainParams = {
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000,
        additionalData: ethers.toUtf8Bytes("")
      };
    });

    it("Should estimate execution cost correctly", async function () {
      const cost = await registry.estimateExecutionCost(
        NEAR_TESTNET_ID,
        chainParams,
        ethers.parseEther("100")
      );

      expect(cost).to.be.gt(0);
    });

    it("Should calculate minimum safety deposit", async function () {
      const safetyDeposit = await registry.calculateMinSafetyDeposit(
        NEAR_TESTNET_ID,
        ethers.parseEther("100")
      );

      expect(safetyDeposit).to.be.gt(0);
      // Should be 5% of amount
      expect(safetyDeposit).to.equal(ethers.parseEther("5"));
    });

    it("Should reject cost estimation for unsupported chain", async function () {
      await expect(registry.estimateExecutionCost(
        99999,
        chainParams,
        ethers.parseEther("100")
      )).to.be.revertedWith("Chain not supported");
    });
  });

  describe("Chain Information", function () {
    beforeEach(async function () {
      await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress());
    });

    it("Should return supported chain IDs", async function () {
      const supportedChains = await registry.getSupportedChainIds();
      expect(supportedChains).to.include(BigInt(NEAR_TESTNET_ID));
      expect(supportedChains.length).to.equal(1);
    });

    it("Should return chain information", async function () {
      const chainInfo = await registry.getChainInfo(NEAR_TESTNET_ID);
      expect(chainInfo.chainId).to.equal(NEAR_TESTNET_ID);
      expect(chainInfo.name).to.equal("NEAR Protocol Testnet");
      expect(chainInfo.isActive).to.be.true;
    });

    it("Should revert for non-existent chain", async function () {
      await expect(registry.getChainInfo(99999))
        .to.be.revertedWith("Chain not supported");
    });

    it("Should check chain support correctly", async function () {
      expect(await registry.isChainSupported(NEAR_TESTNET_ID)).to.be.true;
      expect(await registry.isChainSupported(99999)).to.be.false;
    });
  });

  describe("Multiple Chain Registration", function () {
    it("Should handle multiple chains correctly", async function () {
      // Register NEAR testnet
      await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress());
      
      // Deploy and register NEAR mainnet adapter
      const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
      const nearMainnetAdapter = await NearDestinationChain.deploy(NEAR_MAINNET_ID);
      await nearMainnetAdapter.waitForDeployment();
      await registry.registerChainAdapter(NEAR_MAINNET_ID, await nearMainnetAdapter.getAddress());

      const supportedChains = await registry.getSupportedChainIds();
      expect(supportedChains).to.include(BigInt(NEAR_TESTNET_ID));
      expect(supportedChains).to.include(BigInt(NEAR_MAINNET_ID));
      expect(supportedChains.length).to.equal(2);

      // Both should be supported
      expect(await registry.isChainSupported(NEAR_TESTNET_ID)).to.be.true;
      expect(await registry.isChainSupported(NEAR_MAINNET_ID)).to.be.true;
    });

    it("Should handle chain removal without affecting others", async function () {
      // Register multiple chains
      await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearAdapter.getAddress());
      
      const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
      const nearMainnetAdapter = await NearDestinationChain.deploy(NEAR_MAINNET_ID);
      await nearMainnetAdapter.waitForDeployment();
      await registry.registerChainAdapter(NEAR_MAINNET_ID, await nearMainnetAdapter.getAddress());

      // Remove one chain
      await registry.removeChainAdapter(NEAR_TESTNET_ID);

      // Check states
      expect(await registry.isChainSupported(NEAR_TESTNET_ID)).to.be.false;
      expect(await registry.isChainSupported(NEAR_MAINNET_ID)).to.be.true;

      const supportedChains = await registry.getSupportedChainIds();
      expect(supportedChains).to.not.include(BigInt(NEAR_TESTNET_ID));
      expect(supportedChains).to.include(BigInt(NEAR_MAINNET_ID));
    });
  });
});