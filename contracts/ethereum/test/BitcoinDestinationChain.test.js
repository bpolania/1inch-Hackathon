const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BitcoinDestinationChain", function () {
    let bitcoinAdapter;
    let owner;
    let addr1;
    
    // Bitcoin chain IDs
    const BITCOIN_MAINNET_ID = 50001;
    const BITCOIN_TESTNET_ID = 50002;
    const DOGECOIN_MAINNET_ID = 50003;
    const LITECOIN_MAINNET_ID = 50005;
    
    // Sample Bitcoin addresses for testing
    const VALID_BTC_MAINNET_P2PKH = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    const VALID_BTC_TESTNET_P2PKH = "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn";
    const VALID_BTC_P2SH = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy";
    const VALID_BTC_BECH32 = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
    const VALID_LTC_ADDRESS = "LhK2BTQ1efhxVBJGigJ5VwgWzWNWWgZJhw";
    const VALID_DOGE_ADDRESS = "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L";
    
    const INVALID_ADDRESS_EMPTY = "";
    const INVALID_ADDRESS_SHORT = "1A";
    const INVALID_ADDRESS_INVALID_CHARS = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfN0"; // Contains 0
    
    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();
        
        const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
        bitcoinAdapter = await BitcoinDestinationChain.deploy(BITCOIN_TESTNET_ID);
        await bitcoinAdapter.waitForDeployment();
    });

    describe("Deployment and Configuration", function () {
        it("Should deploy with correct Bitcoin testnet configuration", async function () {
            const chainInfo = await bitcoinAdapter.getChainInfo();
            
            expect(chainInfo.chainId).to.equal(BITCOIN_TESTNET_ID);
            expect(chainInfo.name).to.equal("Bitcoin Testnet");
            expect(chainInfo.symbol).to.equal("BTC");
            expect(chainInfo.isActive).to.be.true;
            expect(chainInfo.minSafetyDepositBps).to.equal(500); // 5%
            expect(chainInfo.defaultTimelock).to.equal(7200); // 2 hours
        });

        it("Should deploy with correct Bitcoin mainnet configuration", async function () {
            const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
            const mainnetAdapter = await BitcoinDestinationChain.deploy(BITCOIN_MAINNET_ID);
            await mainnetAdapter.waitForDeployment();
            
            const chainInfo = await mainnetAdapter.getChainInfo();
            expect(chainInfo.name).to.equal("Bitcoin Mainnet");
            expect(chainInfo.symbol).to.equal("BTC");
        });

        it("Should deploy with correct Dogecoin configuration", async function () {
            const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
            const dogeAdapter = await BitcoinDestinationChain.deploy(DOGECOIN_MAINNET_ID);
            await dogeAdapter.waitForDeployment();
            
            const chainInfo = await dogeAdapter.getChainInfo();
            expect(chainInfo.name).to.equal("Dogecoin Mainnet");
            expect(chainInfo.symbol).to.equal("DOGE");
        });

        it("Should deploy with correct Litecoin configuration", async function () {
            const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
            const ltcAdapter = await BitcoinDestinationChain.deploy(LITECOIN_MAINNET_ID);
            await ltcAdapter.waitForDeployment();
            
            const chainInfo = await ltcAdapter.getChainInfo();
            expect(chainInfo.name).to.equal("Litecoin Mainnet");
            expect(chainInfo.symbol).to.equal("LTC");
        });

        it("Should reject invalid chain IDs", async function () {
            const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
            
            await expect(
                BitcoinDestinationChain.deploy(99999) // Invalid chain ID
            ).to.be.revertedWith("Invalid Bitcoin-family chain ID");
        });
    });

    describe("Address Validation", function () {
        it("Should validate Bitcoin mainnet P2PKH addresses", async function () {
            const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
            const mainnetAdapter = await BitcoinDestinationChain.deploy(BITCOIN_MAINNET_ID);
            await mainnetAdapter.waitForDeployment();
            
            const isValid = await mainnetAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(VALID_BTC_MAINNET_P2PKH)
            );
            expect(isValid).to.be.true;
        });

        it("Should validate Bitcoin testnet P2PKH addresses", async function () {
            const isValid = await bitcoinAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(VALID_BTC_TESTNET_P2PKH)
            );
            expect(isValid).to.be.true;
        });

        it("Should validate Bitcoin P2SH addresses", async function () {
            const isValid = await bitcoinAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(VALID_BTC_P2SH)
            );
            expect(isValid).to.be.true;
        });

        it("Should validate Bitcoin Bech32 addresses", async function () {
            const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
            const mainnetAdapter = await BitcoinDestinationChain.deploy(BITCOIN_MAINNET_ID);
            await mainnetAdapter.waitForDeployment();
            
            const isValid = await mainnetAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(VALID_BTC_BECH32)
            );
            expect(isValid).to.be.true;
        });

        it("Should validate Litecoin addresses", async function () {
            const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
            const ltcAdapter = await BitcoinDestinationChain.deploy(LITECOIN_MAINNET_ID);
            await ltcAdapter.waitForDeployment();
            
            const isValid = await ltcAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(VALID_LTC_ADDRESS)
            );
            expect(isValid).to.be.true;
        });

        it("Should validate Dogecoin addresses", async function () {
            const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
            const dogeAdapter = await BitcoinDestinationChain.deploy(DOGECOIN_MAINNET_ID);
            await dogeAdapter.waitForDeployment();
            
            const isValid = await dogeAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(VALID_DOGE_ADDRESS)
            );
            expect(isValid).to.be.true;
        });

        it("Should reject empty addresses", async function () {
            const isValid = await bitcoinAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(INVALID_ADDRESS_EMPTY)
            );
            expect(isValid).to.be.false;
        });

        it("Should reject addresses that are too short", async function () {
            const isValid = await bitcoinAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(INVALID_ADDRESS_SHORT)
            );
            expect(isValid).to.be.false;
        });

        it("Should reject addresses with invalid Base58 characters", async function () {
            const isValid = await bitcoinAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(INVALID_ADDRESS_INVALID_CHARS)
            );
            expect(isValid).to.be.false;
        });
    });

    describe("Bitcoin Execution Parameters", function () {
        let validParams;
        
        beforeEach(function () {
            validParams = {
                feeSatPerByte: 10,
                timelock: 144, // ~24 hours in blocks
                useRelativeTimelock: false,
                refundPubKeyHash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                dustThreshold: 546,
                confirmations: 1
            };
        });

        it("Should encode and decode Bitcoin execution parameters", async function () {
            const encoded = await bitcoinAdapter.encodeBitcoinExecutionParams(validParams);
            const decoded = await bitcoinAdapter.decodeBitcoinExecutionParams(encoded);
            
            expect(decoded.feeSatPerByte).to.equal(validParams.feeSatPerByte);
            expect(decoded.timelock).to.equal(validParams.timelock);
            expect(decoded.useRelativeTimelock).to.equal(validParams.useRelativeTimelock);
            expect(decoded.refundPubKeyHash).to.equal(validParams.refundPubKeyHash);
            expect(decoded.dustThreshold).to.equal(validParams.dustThreshold);
            expect(decoded.confirmations).to.equal(validParams.confirmations);
        });

        it("Should create default execution parameters", async function () {
            const feeSatPerByte = 20;
            const timelock = 288; // ~48 hours
            const refundPubKeyHash = ethers.keccak256(ethers.toUtf8Bytes("refund"));
            
            const encoded = await bitcoinAdapter.createDefaultExecutionParams(
                feeSatPerByte,
                timelock,
                refundPubKeyHash
            );
            
            const decoded = await bitcoinAdapter.decodeBitcoinExecutionParams(encoded);
            expect(decoded.feeSatPerByte).to.equal(feeSatPerByte);
            expect(decoded.timelock).to.equal(timelock);
            expect(decoded.useRelativeTimelock).to.be.false;
            expect(decoded.refundPubKeyHash).to.equal(refundPubKeyHash);
            expect(decoded.dustThreshold).to.equal(546);
            expect(decoded.confirmations).to.equal(1);
        });
    });

    describe("Order Parameter Validation", function () {
        let validOrderParams;
        
        beforeEach(async function () {
            const btcParams = {
                feeSatPerByte: 10,
                timelock: 144,
                useRelativeTimelock: false,
                refundPubKeyHash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                dustThreshold: 546,
                confirmations: 1
            };
            
            const encodedParams = await bitcoinAdapter.encodeBitcoinExecutionParams(btcParams);
            
            validOrderParams = {
                destinationAddress: ethers.toUtf8Bytes(VALID_BTC_TESTNET_P2PKH),
                executionParams: encodedParams,
                estimatedGas: 250,
                additionalData: "0x"
            };
        });

        it("Should validate valid order parameters", async function () {
            const amount = ethers.parseEther("0.1"); // 0.1 BTC worth
            
            const result = await bitcoinAdapter.validateOrderParams(validOrderParams, amount);
            expect(result.isValid).to.be.true;
            expect(result.errorMessage).to.equal("");
            expect(result.estimatedCost).to.be.greaterThan(0);
        });

        it("Should reject invalid destination address", async function () {
            const invalidParams = {
                ...validOrderParams,
                destinationAddress: ethers.toUtf8Bytes(INVALID_ADDRESS_INVALID_CHARS)
            };
            
            const result = await bitcoinAdapter.validateOrderParams(invalidParams, ethers.parseEther("0.1"));
            expect(result.isValid).to.be.false;
            expect(result.errorMessage).to.equal("Invalid Bitcoin address format");
        });

        it("Should reject amounts below dust threshold", async function () {
            const dustAmount = 500; // Below 546 satoshi threshold
            
            const result = await bitcoinAdapter.validateOrderParams(validOrderParams, dustAmount);
            expect(result.isValid).to.be.false;
            expect(result.errorMessage).to.equal("Amount below dust threshold");
        });

        it("Should reject invalid fee rates", async function () {
            const btcParams = {
                feeSatPerByte: 1001, // Above 1000 sat/byte limit
                timelock: 144,
                useRelativeTimelock: false,
                refundPubKeyHash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                dustThreshold: 546,
                confirmations: 1
            };
            
            const encodedParams = await bitcoinAdapter.encodeBitcoinExecutionParams(btcParams);
            const invalidParams = {
                ...validOrderParams,
                executionParams: encodedParams
            };
            
            const result = await bitcoinAdapter.validateOrderParams(invalidParams, ethers.parseEther("0.1"));
            expect(result.isValid).to.be.false;
            expect(result.errorMessage).to.equal("Invalid fee rate (must be 1-1000 sat/byte)");
        });

        it("Should reject zero timelock", async function () {
            const btcParams = {
                feeSatPerByte: 10,
                timelock: 0, // Invalid zero timelock
                useRelativeTimelock: false,
                refundPubKeyHash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                dustThreshold: 546,
                confirmations: 1
            };
            
            const encodedParams = await bitcoinAdapter.encodeBitcoinExecutionParams(btcParams);
            const invalidParams = {
                ...validOrderParams,
                executionParams: encodedParams
            };
            
            const result = await bitcoinAdapter.validateOrderParams(invalidParams, ethers.parseEther("0.1"));
            expect(result.isValid).to.be.false;
            expect(result.errorMessage).to.equal("Timelock cannot be zero");
        });

        it("Should handle malformed execution parameters", async function () {
            const invalidParams = {
                ...validOrderParams,
                executionParams: "0xdeadbeef" // Invalid encoding
            };
            
            const result = await bitcoinAdapter.validateOrderParams(invalidParams, ethers.parseEther("0.1"));
            expect(result.isValid).to.be.false;
            expect(result.errorMessage).to.equal("Invalid Bitcoin execution parameters encoding");
        });
    });

    describe("Safety Deposit Calculation", function () {
        it("Should calculate 5% safety deposit correctly", async function () {
            const amount = ethers.parseEther("1.0"); // 1 BTC
            const expectedDeposit = amount * BigInt(500) / BigInt(10000); // 5%
            
            const deposit = await bitcoinAdapter.calculateMinSafetyDeposit(amount);
            expect(deposit).to.equal(expectedDeposit);
        });

        it("Should handle small amounts correctly", async function () {
            const amount = 1000; // 1000 satoshis
            const expectedDeposit = 50; // 5% = 50 satoshis
            
            const deposit = await bitcoinAdapter.calculateMinSafetyDeposit(amount);
            expect(deposit).to.equal(expectedDeposit);
        });
    });

    describe("Token Format Support", function () {
        it("Should support only native token format", async function () {
            const formats = await bitcoinAdapter.getSupportedTokenFormats();
            expect(formats).to.have.lengthOf(1);
            expect(formats[0]).to.equal("native");
        });

        it("Should format native token identifiers correctly", async function () {
            const tokenId = await bitcoinAdapter.formatTokenIdentifier(
                ethers.ZeroAddress,
                "BTC",
                true
            );
            expect(ethers.toUtf8String(tokenId)).to.equal("native.BTC");
        });

        it("Should reject non-native tokens", async function () {
            await expect(
                bitcoinAdapter.formatTokenIdentifier(
                    ethers.ZeroAddress,
                    "USDT",
                    false
                )
            ).to.be.revertedWith("Only native tokens supported for Bitcoin-family chains");
        });
    });

    describe("Feature Support", function () {
        it("Should support atomic swaps feature", async function () {
            const isSupported = await bitcoinAdapter.supportsFeature("atomic_swaps");
            expect(isSupported).to.be.true;
        });

        it("Should support HTLC feature", async function () {
            const isSupported = await bitcoinAdapter.supportsFeature("htlc");
            expect(isSupported).to.be.true;
        });

        it("Should support script-based locks", async function () {
            const isSupported = await bitcoinAdapter.supportsFeature("script_based_locks");
            expect(isSupported).to.be.true;
        });

        it("Should support UTXO model", async function () {
            const isSupported = await bitcoinAdapter.supportsFeature("utxo_model");
            expect(isSupported).to.be.true;
        });

        it("Should support CSV timelocks", async function () {
            const isSupported = await bitcoinAdapter.supportsFeature("timelock_csv");
            expect(isSupported).to.be.true;
        });

        it("Should support CLTV timelocks", async function () {
            const isSupported = await bitcoinAdapter.supportsFeature("timelock_cltv");
            expect(isSupported).to.be.true;
        });

        it("Should not support unsupported features", async function () {
            const isSupported = await bitcoinAdapter.supportsFeature("unsupported_feature");
            expect(isSupported).to.be.false;
        });
    });

    describe("Execution Cost Estimation", function () {
        it("Should estimate execution cost with default parameters", async function () {
            const params = {
                destinationAddress: ethers.toUtf8Bytes(VALID_BTC_TESTNET_P2PKH),
                executionParams: "0x",
                estimatedGas: 250,
                additionalData: "0x"
            };
            
            const cost = await bitcoinAdapter.estimateExecutionCost(params, ethers.parseEther("0.1"));
            // Default: 250 bytes * 10 sat/byte * 1e10 (sat to wei conversion)
            const expectedCost = BigInt(250 * 10 * 1e10);
            expect(cost).to.equal(expectedCost);
        });

        it("Should estimate execution cost with custom fee rate", async function () {
            const btcParams = {
                feeSatPerByte: 50, // Higher fee rate
                timelock: 144,
                useRelativeTimelock: false,
                refundPubKeyHash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                dustThreshold: 546,
                confirmations: 1
            };
            
            const encodedParams = await bitcoinAdapter.encodeBitcoinExecutionParams(btcParams);
            const params = {
                destinationAddress: ethers.toUtf8Bytes(VALID_BTC_TESTNET_P2PKH),
                executionParams: encodedParams,
                estimatedGas: 250,
                additionalData: "0x"
            };
            
            const cost = await bitcoinAdapter.estimateExecutionCost(params, ethers.parseEther("0.1"));
            // 250 bytes * 50 sat/byte * 1e10
            const expectedCost = BigInt(250 * 50 * 1e10);
            expect(cost).to.equal(expectedCost);
        });
    });

    describe("HTLC Script Generation", function () {
        it("Should generate valid HTLC script with CLTV", async function () {
            const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret"));
            const timelock = 144;
            const recipientPubKeyHash = ethers.randomBytes(20);
            const refundPubKeyHash = ethers.randomBytes(20);
            
            const script = await bitcoinAdapter.generateHTLCScript(
                hashlock,
                timelock,
                recipientPubKeyHash,
                refundPubKeyHash,
                false // Use CLTV
            );
            
            expect(script).to.not.equal("0x");
            expect(script.length).to.be.greaterThan(0);
            
            // Check for key opcodes
            const scriptHex = script.slice(2); // Remove 0x prefix
            expect(scriptHex).to.include("63"); // OP_IF
            expect(scriptHex).to.include("67"); // OP_ELSE  
            expect(scriptHex).to.include("68"); // OP_ENDIF
            expect(scriptHex).to.include("a8"); // OP_SHA256
            expect(scriptHex).to.include("b1"); // OP_CHECKLOCKTIMEVERIFY
        });

        it("Should generate valid HTLC script with CSV", async function () {
            const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret"));
            const timelock = 144;
            const recipientPubKeyHash = ethers.randomBytes(20);
            const refundPubKeyHash = ethers.randomBytes(20);
            
            const script = await bitcoinAdapter.generateHTLCScript(
                hashlock,
                timelock,
                recipientPubKeyHash,
                refundPubKeyHash,
                true // Use CSV
            );
            
            expect(script).to.not.equal("0x");
            expect(script.length).to.be.greaterThan(0);
            
            // Check for CSV opcode instead of CLTV
            const scriptHex = script.slice(2);
            expect(scriptHex).to.include("b2"); // OP_CHECKSEQUENCEVERIFY
        });
    });

    describe("Order Metadata", function () {
        it("Should generate proper order metadata", async function () {
            const params = {
                destinationAddress: ethers.toUtf8Bytes(VALID_BTC_TESTNET_P2PKH),
                executionParams: "0x1234",
                estimatedGas: 250,
                additionalData: "0x"
            };
            
            const metadata = await bitcoinAdapter.getOrderMetadata(params);
            expect(metadata).to.not.equal("0x");
            expect(metadata.length).to.be.greaterThan(0);
            
            // Verify it can be decoded
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ["bytes", "bytes", "uint256", "uint256", "uint256"],
                metadata
            );
            
            expect(decoded[0]).to.equal(ethers.hexlify(params.destinationAddress));
            expect(decoded[1]).to.equal(params.executionParams);
            expect(decoded[2]).to.equal(params.estimatedGas);
            expect(decoded[3]).to.equal(BITCOIN_TESTNET_ID); // chainId
        });
    });
});