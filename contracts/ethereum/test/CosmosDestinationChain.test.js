const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CosmosDestinationChain", function () {
  let cosmosDestinationChain;
  let owner;
  let addr1;

  // Test constants
  const NEUTRON_TESTNET_ID = 7001;
  const JUNO_TESTNET_ID = 7002;
  const COSMOS_HUB_MAINNET_ID = 30001;
  const INVALID_CHAIN_ID = 99999;

  // Valid test addresses
  const VALID_NEUTRON_ADDRESS = "neutron1x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x";
  const VALID_JUNO_ADDRESS = "juno1x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x";
  const VALID_COSMOS_ADDRESS = "cosmos1x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x";
  const INVALID_ADDRESS = "invalid_address";
  const VALID_CONTRACT_ADDRESS = "neutron1abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
  });

  describe("Contract Deployment", function () {
    it("Should deploy with valid Neutron testnet ID", async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();

      const chainInfo = await cosmosDestinationChain.getChainInfo();
      expect(chainInfo.chainId).to.equal(NEUTRON_TESTNET_ID);
      expect(chainInfo.name).to.equal("Neutron Testnet");
      expect(chainInfo.symbol).to.equal("NTRN");
      expect(chainInfo.isActive).to.be.true;
      expect(chainInfo.minSafetyDepositBps).to.equal(500); // 5%
    });

    it("Should deploy with valid Juno testnet ID", async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(JUNO_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();

      const chainInfo = await cosmosDestinationChain.getChainInfo();
      expect(chainInfo.chainId).to.equal(JUNO_TESTNET_ID);
      expect(chainInfo.name).to.equal("Juno Testnet");
      expect(chainInfo.symbol).to.equal("JUNO");
    });

    it("Should deploy with valid Cosmos Hub mainnet ID", async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(COSMOS_HUB_MAINNET_ID);
      await cosmosDestinationChain.waitForDeployment();

      const chainInfo = await cosmosDestinationChain.getChainInfo();
      expect(chainInfo.chainId).to.equal(COSMOS_HUB_MAINNET_ID);
      expect(chainInfo.name).to.equal("Cosmos Hub");
      expect(chainInfo.symbol).to.equal("ATOM");
    });

    it("Should revert with invalid chain ID", async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      await expect(
        CosmosDestinationChain.deploy(INVALID_CHAIN_ID)
      ).to.be.revertedWith("Invalid Cosmos chain ID");
    });
  });

  describe("Address Validation", function () {
    beforeEach(async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();
    });

    it("Should validate correct Neutron address format", async function () {
      const addressBytes = ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS);
      const isValid = await cosmosDestinationChain.validateDestinationAddress(addressBytes);
      expect(isValid).to.be.true;
    });

    it("Should validate correct Juno address format for Juno chain", async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      const junoChain = await CosmosDestinationChain.deploy(JUNO_TESTNET_ID);
      await junoChain.waitForDeployment();

      const addressBytes = ethers.toUtf8Bytes(VALID_JUNO_ADDRESS);
      const isValid = await junoChain.validateDestinationAddress(addressBytes);
      expect(isValid).to.be.true;
    });

    it("Should reject wrong prefix for chain", async function () {
      // Using Juno address on Neutron chain should fail
      const addressBytes = ethers.toUtf8Bytes(VALID_JUNO_ADDRESS);
      const isValid = await cosmosDestinationChain.validateDestinationAddress(addressBytes);
      expect(isValid).to.be.false;
    });

    it("Should reject invalid address format", async function () {
      const addressBytes = ethers.toUtf8Bytes(INVALID_ADDRESS);
      const isValid = await cosmosDestinationChain.validateDestinationAddress(addressBytes);
      expect(isValid).to.be.false;
    });

    it("Should reject address that's too short", async function () {
      const shortAddress = "neutron1abc";
      const addressBytes = ethers.toUtf8Bytes(shortAddress);
      const isValid = await cosmosDestinationChain.validateDestinationAddress(addressBytes);
      expect(isValid).to.be.false;
    });

    it("Should reject address that's too long", async function () {
      const longAddress = "neutron1" + "a".repeat(60);
      const addressBytes = ethers.toUtf8Bytes(longAddress);
      const isValid = await cosmosDestinationChain.validateDestinationAddress(addressBytes);
      expect(isValid).to.be.false;
    });

    it("Should reject address with invalid characters", async function () {
      const invalidAddress = "neutron1X2X2X2X2X2X2X2X2X2X2X2X2X2X2X2X2X2X2X2X2X"; // uppercase X
      const addressBytes = ethers.toUtf8Bytes(invalidAddress);
      const isValid = await cosmosDestinationChain.validateDestinationAddress(addressBytes);
      expect(isValid).to.be.false;
    });
  });

  describe("Execution Parameter Validation", function () {
    beforeEach(async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();
    });

    it("Should validate correct execution parameters", async function () {
      const executionParams = {
        contractAddress: VALID_CONTRACT_ADDRESS,
        msg: ethers.toUtf8Bytes('{"execute_fusion_order":{"amount":"1000000"}}'),
        funds: "1000000untrn",
        gasLimit: 300000
      };

      const encodedParams = await cosmosDestinationChain.encodeCosmosExecutionParams(executionParams);
      
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS),
        executionParams: encodedParams,
        estimatedGas: 300000,
        additionalData: "0x"
      };

      const result = await cosmosDestinationChain.validateOrderParams(chainParams, ethers.parseUnits("1", 6));
      expect(result.isValid).to.be.true;
      expect(result.estimatedCost).to.be.gt(0);
    });

    it("Should reject empty contract address", async function () {
      const executionParams = {
        contractAddress: "",
        msg: ethers.toUtf8Bytes('{"execute_fusion_order":{"amount":"1000000"}}'),
        funds: "1000000untrn",
        gasLimit: 300000
      };

      const encodedParams = await cosmosDestinationChain.encodeCosmosExecutionParams(executionParams);
      
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS),
        executionParams: encodedParams,
        estimatedGas: 300000,
        additionalData: "0x"
      };

      const result = await cosmosDestinationChain.validateOrderParams(chainParams, ethers.parseUnits("1", 6));
      expect(result.isValid).to.be.false;
      expect(result.errorMessage).to.equal("CosmWasm contract address cannot be empty");
    });

    it("Should reject invalid contract address format", async function () {
      const executionParams = {
        contractAddress: "invalid_contract",
        msg: ethers.toUtf8Bytes('{"execute_fusion_order":{"amount":"1000000"}}'),
        funds: "1000000untrn",
        gasLimit: 300000
      };

      const encodedParams = await cosmosDestinationChain.encodeCosmosExecutionParams(executionParams);
      
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS),
        executionParams: encodedParams,
        estimatedGas: 300000,
        additionalData: "0x"
      };

      const result = await cosmosDestinationChain.validateOrderParams(chainParams, ethers.parseUnits("1", 6));
      expect(result.isValid).to.be.false;
      expect(result.errorMessage).to.equal("Invalid CosmWasm contract address format");
    });

    it("Should reject empty message", async function () {
      const executionParams = {
        contractAddress: VALID_CONTRACT_ADDRESS,
        msg: "0x",
        funds: "1000000untrn",
        gasLimit: 300000
      };

      const encodedParams = await cosmosDestinationChain.encodeCosmosExecutionParams(executionParams);
      
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS),
        executionParams: encodedParams,
        estimatedGas: 300000,
        additionalData: "0x"
      };

      const result = await cosmosDestinationChain.validateOrderParams(chainParams, ethers.parseUnits("1", 6));
      expect(result.isValid).to.be.false;
      expect(result.errorMessage).to.equal("CosmWasm message cannot be empty");
    });

    it("Should reject gas limit too low", async function () {
      const executionParams = {
        contractAddress: VALID_CONTRACT_ADDRESS,
        msg: ethers.toUtf8Bytes('{"execute_fusion_order":{"amount":"1000000"}}'),
        funds: "1000000untrn",
        gasLimit: 30000 // Too low
      };

      const encodedParams = await cosmosDestinationChain.encodeCosmosExecutionParams(executionParams);
      
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS),
        executionParams: encodedParams,
        estimatedGas: 300000,
        additionalData: "0x"
      };

      const result = await cosmosDestinationChain.validateOrderParams(chainParams, ethers.parseUnits("1", 6));
      expect(result.isValid).to.be.false;
      expect(result.errorMessage).to.equal("CosmWasm gas limit too low (minimum 50,000)");
    });
  });

  describe("Safety Deposit Calculation", function () {
    beforeEach(async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();
    });

    it("Should calculate 5% safety deposit correctly", async function () {
      const amount = ethers.parseUnits("100", 6); // 100 tokens with 6 decimals
      const expectedDeposit = ethers.parseUnits("5", 6); // 5% = 5 tokens
      
      const actualDeposit = await cosmosDestinationChain.calculateMinSafetyDeposit(amount);
      expect(actualDeposit).to.equal(expectedDeposit);
    });

    it("Should handle small amounts correctly", async function () {
      const amount = ethers.parseUnits("1", 6); // 1 token
      const expectedDeposit = ethers.parseUnits("0.05", 6); // 5% = 0.05 tokens
      
      const actualDeposit = await cosmosDestinationChain.calculateMinSafetyDeposit(amount);
      expect(actualDeposit).to.equal(expectedDeposit);
    });
  });

  describe("Token Format Support", function () {
    beforeEach(async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();
    });

    it("Should return supported token formats", async function () {
      const formats = await cosmosDestinationChain.getSupportedTokenFormats();
      expect(formats).to.have.lengthOf(2);
      expect(formats[0]).to.equal("native");
      expect(formats[1]).to.equal("cw20");
    });

    it("Should format native token identifier correctly", async function () {
      const identifier = await cosmosDestinationChain.formatTokenIdentifier(
        ethers.ZeroAddress,
        "NTRN",
        true
      );
      const decodedIdentifier = ethers.toUtf8String(identifier);
      expect(decodedIdentifier).to.equal("untrn");
    });

    it("Should format CW20 token identifier correctly", async function () {
      const identifier = await cosmosDestinationChain.formatTokenIdentifier(
        ethers.ZeroAddress,
        "CUSTOM",
        false
      );
      const decodedIdentifier = ethers.toUtf8String(identifier);
      expect(decodedIdentifier).to.equal("cw20:CUSTOM");
    });
  });

  describe("Feature Support", function () {
    beforeEach(async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();
    });

    it("Should support required features", async function () {
      expect(await cosmosDestinationChain.supportsFeature("atomic_swaps")).to.be.true;
      expect(await cosmosDestinationChain.supportsFeature("htlc")).to.be.true;
      expect(await cosmosDestinationChain.supportsFeature("resolver_fees")).to.be.true;
      expect(await cosmosDestinationChain.supportsFeature("safety_deposits")).to.be.true;
      expect(await cosmosDestinationChain.supportsFeature("timelock_stages")).to.be.true;
      expect(await cosmosDestinationChain.supportsFeature("cosmwasm")).to.be.true;
      expect(await cosmosDestinationChain.supportsFeature("ibc")).to.be.true;
    });

    it("Should not support unsupported features", async function () {
      expect(await cosmosDestinationChain.supportsFeature("unsupported_feature")).to.be.false;
      expect(await cosmosDestinationChain.supportsFeature("ethereum_compatibility")).to.be.false;
    });
  });

  describe("Cost Estimation", function () {
    beforeEach(async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();
    });

    it("Should estimate base cost for simple transfer", async function () {
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS),
        executionParams: "0x",
        estimatedGas: 200000,
        additionalData: "0x"
      };

      const cost = await cosmosDestinationChain.estimateExecutionCost(chainParams, ethers.parseUnits("1", 6));
      expect(cost).to.equal(5000); // Base cost for Neutron: 0.005 NTRN in micro units
    });

    it("Should estimate higher cost for complex execution", async function () {
      const executionParams = {
        contractAddress: VALID_CONTRACT_ADDRESS,
        msg: ethers.toUtf8Bytes('{"execute_fusion_order":{"amount":"1000000"}}'),
        funds: "1000000untrn",
        gasLimit: 500000 // Higher gas
      };

      const encodedParams = await cosmosDestinationChain.encodeCosmosExecutionParams(executionParams);
      
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS),
        executionParams: encodedParams,
        estimatedGas: 500000,
        additionalData: "0x"
      };

      const cost = await cosmosDestinationChain.estimateExecutionCost(chainParams, ethers.parseUnits("1", 6));
      expect(cost).to.be.gt(5000); // Should be higher than base cost
    });

    it("Should add percentage cost for large amounts", async function () {
      const largeAmount = ethers.parseUnits("100", 6); // 100 tokens (above threshold)
      
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS),
        executionParams: "0x",
        estimatedGas: 200000,
        additionalData: "0x"
      };

      const cost = await cosmosDestinationChain.estimateExecutionCost(chainParams, largeAmount);
      const baseCost = 5000;
      const expectedAdditionalCost = largeAmount / 1000n; // 0.1% of amount
      expect(cost).to.be.gte(baseCost + Number(expectedAdditionalCost));
    });
  });

  describe("Order Metadata", function () {
    beforeEach(async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();
    });

    it("Should generate order metadata correctly", async function () {
      const chainParams = {
        destinationAddress: ethers.toUtf8Bytes(VALID_NEUTRON_ADDRESS),
        executionParams: "0x1234",
        estimatedGas: 300000,
        additionalData: "0xabcd"
      };

      const metadata = await cosmosDestinationChain.getOrderMetadata(chainParams);
      expect(metadata).to.not.equal("0x");
      
      // Metadata should be ABI encoded with 5 parameters
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["bytes", "bytes", "uint256", "uint256", "uint256"],
        metadata
      );
      
      expect(decoded[0]).to.equal(chainParams.destinationAddress);
      expect(decoded[1]).to.equal(chainParams.executionParams);
      expect(decoded[2]).to.equal(chainParams.estimatedGas);
      expect(decoded[4]).to.equal(NEUTRON_TESTNET_ID); // Chain ID
    });
  });

  describe("Default Execution Parameters", function () {
    beforeEach(async function () {
      const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
      cosmosDestinationChain = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
      await cosmosDestinationChain.waitForDeployment();
    });

    it("Should create default execution parameters", async function () {
      const amount = 1000000; // 1 NTRN in micro units
      const encodedParams = await cosmosDestinationChain.createDefaultExecutionParams(
        VALID_CONTRACT_ADDRESS,
        amount,
        "untrn"
      );

      const decodedParams = await cosmosDestinationChain.decodeCosmosExecutionParams(encodedParams);
      
      expect(decodedParams.contractAddress).to.equal(VALID_CONTRACT_ADDRESS);
      expect(decodedParams.gasLimit).to.equal(300000);
      expect(decodedParams.funds).to.equal("1000000untrn");
      
      // Check that message contains the amount
      const msgStr = ethers.toUtf8String(decodedParams.msg);
      expect(msgStr).to.include("1000000");
    });
  });

  describe("Multi-Chain Support", function () {
    it("Should handle different chains with correct native denominations", async function () {
      // Test different chains
      const chainConfigs = [
        { id: NEUTRON_TESTNET_ID, expectedDenom: "untrn", expectedSymbol: "NTRN" },
        { id: JUNO_TESTNET_ID, expectedDenom: "ujuno", expectedSymbol: "JUNO" },
        { id: COSMOS_HUB_MAINNET_ID, expectedDenom: "uatom", expectedSymbol: "ATOM" }
      ];

      for (const config of chainConfigs) {
        const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
        const chainAdapter = await CosmosDestinationChain.deploy(config.id);
        await chainAdapter.waitForDeployment();

        // Check chain info
        const chainInfo = await chainAdapter.getChainInfo();
        expect(chainInfo.symbol).to.equal(config.expectedSymbol);

        // Check native token formatting
        const identifier = await chainAdapter.formatTokenIdentifier(
          ethers.ZeroAddress,
          config.expectedSymbol,
          true
        );
        const decodedIdentifier = ethers.toUtf8String(identifier);
        expect(decodedIdentifier).to.equal(config.expectedDenom);
      }
    });
  });
});