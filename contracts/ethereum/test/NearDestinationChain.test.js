const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NearDestinationChain", function () {
  let nearAdapter;
  let owner, other;
  
  const NEAR_TESTNET_ID = 40002;
  const NEAR_MAINNET_ID = 40001;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    // Deploy NEAR adapter
    const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
    nearAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_ID);
    await nearAdapter.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct chain ID", async function () {
      const chainInfo = await nearAdapter.getChainInfo();
      expect(chainInfo.chainId).to.equal(NEAR_TESTNET_ID);
    });

    it("Should return correct chain information", async function () {
      const chainInfo = await nearAdapter.getChainInfo();
      expect(chainInfo.chainId).to.equal(NEAR_TESTNET_ID);
      expect(chainInfo.name).to.equal("NEAR Protocol Testnet");
      expect(chainInfo.symbol).to.equal("NEAR");
      expect(chainInfo.isActive).to.be.true;
    });

    it("Should handle mainnet configuration", async function () {
      const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
      const nearMainnetAdapter = await NearDestinationChain.deploy(NEAR_MAINNET_ID);
      await nearMainnetAdapter.waitForDeployment();

      const chainInfo = await nearMainnetAdapter.getChainInfo();
      expect(chainInfo.chainId).to.equal(NEAR_MAINNET_ID);
      expect(chainInfo.name).to.equal("NEAR Protocol Mainnet");
    });
  });

  describe("Address Validation", function () {
    it("Should validate NEAR account IDs correctly", async function () {
      // Valid NEAR account IDs
      const validAddresses = [
        "alice.near",
        "bob.testnet",
        "my-account.near",
        "test_account.testnet",
        "fusion-plus.demo.cuteharbor3573.testnet"
      ];

      for (const address of validAddresses) {
        const result = await nearAdapter.validateDestinationAddress(ethers.toUtf8Bytes(address));
        expect(result).to.be.true;
      }
    });

    it("Should reject invalid NEAR account IDs", async function () {
      // Invalid NEAR account IDs
      const invalidAddresses = [
        "Alice.near",           // Uppercase
        "alice..near",          // Double dots
        ".alice.near",          // Leading dot
        "alice.near.",          // Trailing dot
        "a",                    // Too short
        "a".repeat(65),         // Too long
        "alice near",           // Space
        ""                      // Empty
      ];

      for (const address of invalidAddresses) {
        const result = await nearAdapter.validateDestinationAddress(ethers.toUtf8Bytes(address));
        expect(result).to.be.false;
      }
    });
  });

  describe("Parameter Validation", function () {
    let validParams;

    beforeEach(async function () {
      validParams = {
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000,
        additionalData: ethers.toUtf8Bytes("")
      };
    });

    it("Should validate correct parameters", async function () {
      const result = await nearAdapter.validateOrderParams(
        validParams,
        ethers.parseEther("100")
      );
      
      expect(result.isValid).to.be.true;
      expect(result.errorMessage).to.equal("");
    });

    it("Should reject invalid destination address", async function () {
      const invalidParams = {
        ...validParams,
        destinationAddress: ethers.toUtf8Bytes("INVALID.NEAR")
      };

      const result = await nearAdapter.validateOrderParams(
        invalidParams,
        ethers.parseEther("100")
      );
      
      expect(result.isValid).to.be.false;
      expect(result.errorMessage).to.include("address");
    });
  });

  describe("Cost Estimation", function () {
    let validParams;

    beforeEach(async function () {
      validParams = {
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000,
        additionalData: ethers.toUtf8Bytes("")
      };
    });

    it("Should estimate execution cost correctly", async function () {
      const cost = await nearAdapter.estimateExecutionCost(
        validParams,
        ethers.parseEther("100")
      );

      expect(cost).to.be.gt(0);
    });

    it("Should calculate safety deposit correctly", async function () {
      const safetyDeposit = await nearAdapter.calculateMinSafetyDeposit(
        ethers.parseEther("100")
      );

      // Should be 5% of amount
      expect(safetyDeposit).to.equal(ethers.parseEther("5"));
    });
  });

  describe("Supported Features", function () {
    it("Should support atomic swaps", async function () {
      const result = await nearAdapter.supportsFeature("atomic_swaps");
      expect(result).to.be.true;
    });

    it("Should support HTLC", async function () {
      const result = await nearAdapter.supportsFeature("htlc");
      expect(result).to.be.true;
    });

    it("Should support resolver fees", async function () {
      const result = await nearAdapter.supportsFeature("resolver_fees");
      expect(result).to.be.true;
    });

    it("Should not support unsupported features", async function () {
      const result = await nearAdapter.supportsFeature("unsupported_feature");
      expect(result).to.be.false;
    });
  });

  describe("Token Formats", function () {
    it("Should return supported token formats", async function () {
      const formats = await nearAdapter.getSupportedTokenFormats();
      expect(formats).to.include("native");
      expect(formats).to.include("nep141");
    });

    it("Should format token identifiers correctly", async function () {
      // Native token
      const nativeToken = await nearAdapter.formatTokenIdentifier(
        ethers.ZeroAddress,
        "NEAR",
        true
      );
      expect(ethers.toUtf8String(nativeToken)).to.equal("native.near");

      // Contract token
      const contractToken = await nearAdapter.formatTokenIdentifier(
        ethers.ZeroAddress,
        "usdc",
        false
      );
      expect(ethers.toUtf8String(contractToken)).to.equal("usdc.near");
    });
  });

  describe("NEAR Execution Parameters", function () {
    it("Should create default execution parameters", async function () {
      const params = await nearAdapter.createDefaultExecutionParams(
        "fusion-plus.demo.cuteharbor3573.testnet",
        ethers.parseEther("2")
      );

      expect(params).to.not.equal("0x");
      expect(params.length).to.be.gt(2);
    });

    it("Should encode and decode execution parameters", async function () {
      const nearParams = {
        contractId: "fusion-plus.demo.cuteharbor3573.testnet",
        methodName: "execute_fusion_order",
        args: ethers.toUtf8Bytes('{"amount":"2000000000000000000000000"}'),
        attachedDeposit: ethers.parseEther("2"),
        gas: 300000000000000
      };

      const encoded = await nearAdapter.encodeNearExecutionParams(nearParams);
      expect(encoded).to.not.equal("0x");

      const decoded = await nearAdapter.decodeNearExecutionParams(encoded);
      expect(decoded.contractId).to.equal(nearParams.contractId);
      expect(decoded.methodName).to.equal(nearParams.methodName);
    });
  });

  describe("Order Metadata", function () {
    it("Should generate order metadata", async function () {
      const params = {
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000,
        additionalData: ethers.toUtf8Bytes("")
      };

      const metadata = await nearAdapter.getOrderMetadata(params);
      expect(metadata).to.not.equal("0x");
      expect(metadata.length).to.be.gt(2);
    });
  });
});