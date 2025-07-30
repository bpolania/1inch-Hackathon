const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

describe("Sepolia Live Deployment Integration Tests", function () {
  let registry, factory, nearTestnetAdapter, nearMainnetAdapter;
  let signer;
  let deploymentInfo;

  // Skip these tests if not running on Sepolia
  before(async function () {
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 11155111n) {
      console.log("Skipping Sepolia integration tests - not on Sepolia network");
      this.skip();
    }

    // Load deployment info
    const deploymentPath = path.join(__dirname, "..", "sepolia-deployment.json");
    if (!fs.existsSync(deploymentPath)) {
      console.log("Skipping Sepolia integration tests - deployment file not found");
      this.skip();
    }

    deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("Testing against Sepolia deployment from:", deploymentInfo.timestamp);
  });

  beforeEach(async function () {
    // Get signer
    [signer] = await ethers.getSigners();
    console.log("Testing with address:", signer.address);

    // Connect to deployed contracts
    const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
    registry = CrossChainRegistry.attach(deploymentInfo.contracts.CrossChainRegistry);

    // Use production contracts if available, otherwise fallback to original
    const factoryAddress = deploymentInfo.productionDeployment?.contracts?.OneInchFusionPlusFactory || deploymentInfo.contracts.FusionPlusFactory;
    const OneInchFusionPlusFactory = await ethers.getContractFactory("OneInchFusionPlusFactory");
    factory = OneInchFusionPlusFactory.attach(factoryAddress);

    const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
    nearTestnetAdapter = NearDestinationChain.attach(deploymentInfo.contracts.NearTestnetAdapter);
    nearMainnetAdapter = NearDestinationChain.attach(deploymentInfo.contracts.NearMainnetAdapter);
  });

  describe("Deployment Verification", function () {
    it("Should verify CrossChainRegistry deployment", async function () {
      // Check contract exists
      const code = await ethers.provider.getCode(deploymentInfo.contracts.CrossChainRegistry);
      expect(code).to.not.equal("0x");

      // Verify owner
      const owner = await registry.owner();
      expect(owner).to.equal(deploymentInfo.deployer);

      // Check supported chains (NEAR + Bitcoin family)
      const supportedChains = await registry.getSupportedChainIds();
      expect(supportedChains.length).to.equal(7);
      expect(supportedChains).to.include(40001n); // NEAR Mainnet
      expect(supportedChains).to.include(40002n); // NEAR Testnet
      expect(supportedChains).to.include(40003n); // Bitcoin Mainnet
      expect(supportedChains).to.include(40004n); // Bitcoin Testnet
      expect(supportedChains).to.include(40005n); // Dogecoin
      expect(supportedChains).to.include(40006n); // Litecoin
      expect(supportedChains).to.include(40007n); // Bitcoin Cash
    });

    it("Should verify OneInchFusionPlusFactory deployment", async function () {
      // Check contract exists
      const factoryAddress = deploymentInfo.productionDeployment?.contracts?.OneInchFusionPlusFactory || deploymentInfo.contracts.FusionPlusFactory;
      const code = await ethers.provider.getCode(factoryAddress);
      expect(code).to.not.equal("0x");

      // Verify registry connection
      const registryAddress = await factory.registry();
      expect(registryAddress).to.equal(deploymentInfo.contracts.CrossChainRegistry);

      // Check resolver authorization
      const isAuthorized = await factory.authorizedResolvers(deploymentInfo.deployer);
      expect(isAuthorized).to.be.true;

      // Verify production escrow factory connection
      if (deploymentInfo.productionDeployment) {
        const escrowFactoryAddress = await factory.getOneInchEscrowFactory();
        expect(escrowFactoryAddress).to.equal(deploymentInfo.productionDeployment.contracts.ProductionOneInchEscrowFactory);
      }
    });

    it("Should verify NEAR adapter deployments", async function () {
      // Verify NEAR Testnet adapter
      const testnetCode = await ethers.provider.getCode(deploymentInfo.contracts.NearTestnetAdapter);
      expect(testnetCode).to.not.equal("0x");

      const testnetInfo = await nearTestnetAdapter.getChainInfo();
      expect(testnetInfo.chainId).to.equal(40002);
      expect(testnetInfo.name).to.equal("NEAR Protocol Testnet");
      expect(testnetInfo.isActive).to.be.true;

      // Verify NEAR Mainnet adapter
      const mainnetCode = await ethers.provider.getCode(deploymentInfo.contracts.NearMainnetAdapter);
      expect(mainnetCode).to.not.equal("0x");

      const mainnetInfo = await nearMainnetAdapter.getChainInfo();
      expect(mainnetInfo.chainId).to.equal(40001);
      expect(mainnetInfo.name).to.equal("NEAR Protocol Mainnet");
      expect(mainnetInfo.isActive).to.be.true;
    });
  });

  describe("Registry Functionality", function () {
    it("Should query chain information correctly", async function () {
      // Test NEAR Testnet
      const testnetInfo = await registry.getChainInfo(40002);
      expect(testnetInfo.chainId).to.equal(40002);
      expect(testnetInfo.name).to.equal("NEAR Protocol Testnet");
      expect(testnetInfo.symbol).to.equal("NEAR");
      expect(testnetInfo.isActive).to.be.true;
      expect(testnetInfo.minSafetyDepositBps).to.equal(500); // 5%
      expect(testnetInfo.defaultTimelock).to.equal(3600); // 1 hour

      // Test NEAR Mainnet
      const mainnetInfo = await registry.getChainInfo(40001);
      expect(mainnetInfo.chainId).to.equal(40001);
      expect(mainnetInfo.name).to.equal("NEAR Protocol Mainnet");
      expect(mainnetInfo.isActive).to.be.true;
    });

    it("Should validate supported chains", async function () {
      expect(await registry.isChainSupported(40001)).to.be.true; // NEAR Mainnet
      expect(await registry.isChainSupported(40002)).to.be.true; // NEAR Testnet
      expect(await registry.isChainSupported(40003)).to.be.true; // Bitcoin Mainnet
      expect(await registry.isChainSupported(40004)).to.be.true; // Bitcoin Testnet
      expect(await registry.isChainSupported(40005)).to.be.true; // Dogecoin
      expect(await registry.isChainSupported(40006)).to.be.true; // Litecoin
      expect(await registry.isChainSupported(40007)).to.be.true; // Bitcoin Cash
      expect(await registry.isChainSupported(40008)).to.be.false; // Cosmos (not registered)
    });

    it("Should get adapter addresses", async function () {
      const testnetAdapter = await registry.getChainAdapter(40002);
      expect(testnetAdapter).to.equal(deploymentInfo.contracts.NearTestnetAdapter);

      const mainnetAdapter = await registry.getChainAdapter(40001);
      expect(mainnetAdapter).to.equal(deploymentInfo.contracts.NearMainnetAdapter);
    });
  });

  describe("Bitcoin Adapter Functionality", function () {
    let bitcoinMainnetAdapter, bitcoinTestnetAdapter, dogecoinAdapter, litecoinAdapter, bitcoinCashAdapter;

    beforeEach(async function () {
      const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
      
      // Connect to deployed Bitcoin adapters
      const bitcoinMainnetAddress = "0xb439CA5195EF798907EFc22D889852e8b56662de";
      const bitcoinTestnetAddress = "0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8";
      const dogecoinAddress = "0x84A932A6b1Cca23c0359439673b70E6eb26cc0Aa";
      const litecoinAddress = "0x79ff06d38f891dAd1EbB0074dea4464c3384d560";
      const bitcoinCashAddress = "0x6425e85a606468266fBCe46B234f31Adf3583D56";

      bitcoinMainnetAdapter = BitcoinDestinationChain.attach(bitcoinMainnetAddress);
      bitcoinTestnetAdapter = BitcoinDestinationChain.attach(bitcoinTestnetAddress);
      dogecoinAdapter = BitcoinDestinationChain.attach(dogecoinAddress);
      litecoinAdapter = BitcoinDestinationChain.attach(litecoinAddress);
      bitcoinCashAdapter = BitcoinDestinationChain.attach(bitcoinCashAddress);
    });

    it("Should validate Bitcoin addresses", async function () {
      const validBitcoinAddresses = [
        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", // P2PKH
        "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", // P2SH
        "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", // Bech32
        "bc1zw508d6qejxtdg4y5r3zarvaryvqyzf3du"  // Bech32m
      ];

      for (const address of validBitcoinAddresses) {
        const isValid = await bitcoinMainnetAdapter.validateDestinationAddress(
          ethers.toUtf8Bytes(address)
        );
        expect(isValid).to.be.true;
      }
    });

    it("Should support Bitcoin chain family", async function () {
      const bitcoinMainnetInfo = await bitcoinMainnetAdapter.getChainInfo();
      expect(bitcoinMainnetInfo.chainId).to.equal(40003);
      expect(bitcoinMainnetInfo.name).to.equal("Bitcoin");

      const dogecoinInfo = await dogecoinAdapter.getChainInfo();
      expect(dogecoinInfo.chainId).to.equal(40005);
      expect(dogecoinInfo.name).to.equal("Dogecoin");

      const litecoinInfo = await litecoinAdapter.getChainInfo();
      expect(litecoinInfo.chainId).to.equal(40006);
      expect(litecoinInfo.name).to.equal("Litecoin");
    });

    it("Should validate Bitcoin order parameters", async function () {
      const validParams = {
        destinationAddress: ethers.toUtf8Bytes("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 10000, // Bitcoin fee in satoshis
        additionalData: ethers.toUtf8Bytes("")
      };

      const validation = await bitcoinMainnetAdapter.validateOrderParams(
        validParams,
        ethers.parseEther("1")
      );
      expect(validation.isValid).to.be.true;
      expect(validation.estimatedCost).to.be.gt(0);
    });

    it("Should support Bitcoin features", async function () {
      expect(await bitcoinMainnetAdapter.supportsFeature("atomic_swaps")).to.be.true;
      expect(await bitcoinMainnetAdapter.supportsFeature("htlc")).to.be.true;
      expect(await bitcoinMainnetAdapter.supportsFeature("resolver_fees")).to.be.true;
      expect(await bitcoinMainnetAdapter.supportsFeature("safety_deposits")).to.be.true;
      expect(await bitcoinMainnetAdapter.supportsFeature("partial_fills")).to.be.false;
    });
  });

  describe("NEAR Adapter Functionality", function () {
    it("Should validate NEAR addresses", async function () {
      const validAddresses = [
        "alice.near",
        "bob.testnet",
        "fusion-plus.demo.cuteharbor3573.testnet",
        "my-account.near",
        "test_account.testnet"
      ];

      for (const address of validAddresses) {
        const isValid = await nearTestnetAdapter.validateDestinationAddress(
          ethers.toUtf8Bytes(address)
        );
        expect(isValid).to.be.true;
      }

      const invalidAddresses = [
        "alice..near",
        ".alice.near",
        "alice.near.",
        "a",
        "alice near",
        "alice@near",
        ""
      ];

      for (const address of invalidAddresses) {
        const isValid = await nearTestnetAdapter.validateDestinationAddress(
          ethers.toUtf8Bytes(address)
        );
        expect(isValid).to.be.false;
      }
    });

    it("Should validate order parameters", async function () {
      const validParams = {
        destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000000,
        additionalData: ethers.toUtf8Bytes("")
      };

      const validation = await nearTestnetAdapter.validateOrderParams(
        validParams,
        ethers.parseEther("100")
      );
      expect(validation.isValid).to.be.true;
      expect(validation.estimatedCost).to.be.gt(0);
    });

    it("Should support correct features", async function () {
      expect(await nearTestnetAdapter.supportsFeature("atomic_swaps")).to.be.true;
      expect(await nearTestnetAdapter.supportsFeature("htlc")).to.be.true;
      expect(await nearTestnetAdapter.supportsFeature("resolver_fees")).to.be.true;
      expect(await nearTestnetAdapter.supportsFeature("safety_deposits")).to.be.true;
      expect(await nearTestnetAdapter.supportsFeature("partial_fills")).to.be.false;
    });

    it("Should get supported token formats", async function () {
      const formats = await nearTestnetAdapter.getSupportedTokenFormats();
      expect(formats).to.include("native");
      expect(formats).to.include("nep141");
    });
  });

  describe("Factory Functionality", function () {
    it("Should get supported chains from factory", async function () {
      const supportedChains = await factory.getSupportedChains();
      expect(supportedChains.length).to.equal(7);
      expect(supportedChains).to.include(40001n); // NEAR Mainnet
      expect(supportedChains).to.include(40002n); // NEAR Testnet
      expect(supportedChains).to.include(40003n); // Bitcoin Mainnet
      expect(supportedChains).to.include(40004n); // Bitcoin Testnet
      expect(supportedChains).to.include(40005n); // Dogecoin
      expect(supportedChains).to.include(40006n); // Litecoin
      expect(supportedChains).to.include(40007n); // Bitcoin Cash
    });

    it("Should calculate order hash correctly", async function () {
      const orderParams = {
        sourceToken: "0x0000000000000000000000000000000000000001", // Mock address
        sourceAmount: ethers.parseEther("100"),
        destinationChainId: 40002,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"),
        destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
        resolverFeeAmount: ethers.parseEther("1"),
        expiryTime: Math.floor(Date.now() / 1000) + 3600,
        hashlock: ethers.keccak256(ethers.toUtf8Bytes("test-secret")),
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };

      const orderHash = await factory.generateOrderHash(orderParams);
      expect(orderHash).to.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it("Should estimate order costs", async function () {
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes("alice.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000000,
        additionalData: ethers.toUtf8Bytes("")
      };

      const [estimatedCost, safetyDeposit] = await factory.estimateOrderCosts(
        40002,
        chainParams,
        ethers.parseEther("100")
      );

      expect(estimatedCost).to.be.gt(0);
      expect(safetyDeposit).to.equal(ethers.parseEther("5")); // 5% of 100
    });
  });

  describe("Cross-Chain Order Creation Simulation", function () {
    it("Should simulate order creation parameters", async function () {
      // Note: We can't actually create orders without tokens and approval
      // But we can verify all the parameters would be valid

      const orderParams = {
        sourceToken: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
        sourceAmount: ethers.parseUnits("100", 6), // 100 USDC
        destinationChainId: 40002,
        destinationToken: ethers.toUtf8Bytes("native"),
        destinationAmount: ethers.parseEther("2"), // 2 NEAR
        destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
        resolverFeeAmount: ethers.parseUnits("1", 6), // 1 USDC
        expiryTime: Math.floor(Date.now() / 1000) + 7200, // 2 hours
        hashlock: ethers.keccak256(ethers.toUtf8Bytes("simulation-secret")),
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
          executionParams: ethers.toUtf8Bytes(""),
          estimatedGas: 300000000000000,
          additionalData: ethers.toUtf8Bytes("")
        }
      };

      // Validate all parameters
      const chainValidation = await registry.validateOrderParams(
        orderParams.destinationChainId,
        orderParams.chainParams,
        orderParams.sourceAmount
      );
      expect(chainValidation.isValid).to.be.true;

      // Generate order hash
      const orderHash = await factory.generateOrderHash(orderParams);
      expect(orderHash).to.not.equal(ethers.ZeroHash);

      // Check order doesn't exist yet
      const order = await factory.getOrder(orderHash);
      expect(order.isActive).to.be.false;

      console.log("Order simulation successful:");
      console.log("- Order hash:", orderHash);
      console.log("- Estimated cost:", ethers.formatEther(chainValidation.estimatedCost), "NEAR");
      console.log("- Ready for execution with proper token approval");
    });
  });

  describe("Security Verification", function () {
    it("Should verify access control", async function () {
      // Only owner can register new chains
      const isOwner = (await registry.owner()) === signer.address;
      if (!isOwner) {
        await expect(
          registry.registerChainAdapter(40003, ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      }

      // Only owner can authorize resolvers
      const isFactoryOwner = (await factory.owner()) === signer.address;
      if (!isFactoryOwner) {
        await expect(
          factory.authorizeResolver(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
      }
    });

    it("Should verify chain adapter isolation", async function () {
      // Each adapter should only handle its specific chain
      const testnetInfo = await nearTestnetAdapter.getChainInfo();
      expect(testnetInfo.chainId).to.equal(40002);

      const mainnetInfo = await nearMainnetAdapter.getChainInfo();
      expect(mainnetInfo.chainId).to.equal(40001);

      // Adapters should be independent
      expect(deploymentInfo.contracts.NearTestnetAdapter).to.not.equal(
        deploymentInfo.contracts.NearMainnetAdapter
      );
    });
  });
});