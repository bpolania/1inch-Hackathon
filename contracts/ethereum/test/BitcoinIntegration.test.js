const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bitcoin Integration - Local Deployment Test", function () {
    let registry;
    let btcAdapter;
    let dogeAdapter;
    let ltcAdapter;
    let owner;
    let addr1;
    let addr2;
    
    // Bitcoin chain IDs
    const BITCOIN_TESTNET_ID = 50002;
    const DOGECOIN_MAINNET_ID = 50003;
    const LITECOIN_MAINNET_ID = 50005;

    before(async function () {
        console.log("\n🚀 Starting Bitcoin Integration Test Suite");
        console.log("===========================================");
        
        [owner, addr1, addr2] = await ethers.getSigners();
        console.log("📍 Test accounts:");
        console.log("   Owner:", owner.address);
        console.log("   User1:", addr1.address);
        console.log("   User2:", addr2.address);
    });

    describe("Full Bitcoin Integration Deployment", function () {
        it("Should deploy CrossChainRegistry", async function () {
            console.log("\n📋 Step 1: Deploy CrossChainRegistry");
            
            const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
            registry = await CrossChainRegistry.deploy();
            await registry.waitForDeployment();
            
            const registryAddress = await registry.getAddress();
            console.log("   ✅ CrossChainRegistry deployed to:", registryAddress);
            
            expect(await registry.owner()).to.equal(owner.address);
        });

        it("Should deploy Bitcoin family adapters", async function () {
            console.log("\n📋 Step 2: Deploy Bitcoin Adapters");
            
            const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
            
            // Deploy Bitcoin Testnet adapter
            console.log("   🔄 Deploying Bitcoin Testnet adapter...");
            btcAdapter = await BitcoinDestinationChain.deploy(BITCOIN_TESTNET_ID);
            await btcAdapter.waitForDeployment();
            const btcAddress = await btcAdapter.getAddress();
            console.log("   ✅ Bitcoin Testnet Adapter:", btcAddress);
            
            // Deploy Dogecoin adapter
            console.log("   🔄 Deploying Dogecoin adapter...");
            dogeAdapter = await BitcoinDestinationChain.deploy(DOGECOIN_MAINNET_ID);
            await dogeAdapter.waitForDeployment();
            const dogeAddress = await dogeAdapter.getAddress();
            console.log("   ✅ Dogecoin Adapter:", dogeAddress);
            
            // Deploy Litecoin adapter
            console.log("   🔄 Deploying Litecoin adapter...");
            ltcAdapter = await BitcoinDestinationChain.deploy(LITECOIN_MAINNET_ID);
            await ltcAdapter.waitForDeployment();
            const ltcAddress = await ltcAdapter.getAddress();
            console.log("   ✅ Litecoin Adapter:", ltcAddress);

            // Verify chain information
            const btcInfo = await btcAdapter.getChainInfo();
            const dogeInfo = await dogeAdapter.getChainInfo();
            const ltcInfo = await ltcAdapter.getChainInfo();
            
            expect(btcInfo.name).to.equal("Bitcoin Testnet");
            expect(btcInfo.symbol).to.equal("BTC");
            expect(btcInfo.chainId).to.equal(BITCOIN_TESTNET_ID);
            
            expect(dogeInfo.name).to.equal("Dogecoin Mainnet");
            expect(dogeInfo.symbol).to.equal("DOGE");
            expect(dogeInfo.chainId).to.equal(DOGECOIN_MAINNET_ID);
            
            expect(ltcInfo.name).to.equal("Litecoin Mainnet");
            expect(ltcInfo.symbol).to.equal("LTC");
            expect(ltcInfo.chainId).to.equal(LITECOIN_MAINNET_ID);
        });

        it("Should register Bitcoin adapters with registry", async function () {
            console.log("\n📋 Step 3: Register Bitcoin Adapters");
            
            const btcAddress = await btcAdapter.getAddress();
            const dogeAddress = await dogeAdapter.getAddress();
            const ltcAddress = await ltcAdapter.getAddress();
            
            // Register Bitcoin Testnet
            console.log("   🔄 Registering Bitcoin Testnet...");
            await registry.registerChainAdapter(BITCOIN_TESTNET_ID, btcAddress);
            console.log("   ✅ Bitcoin Testnet registered");
            
            // Register Dogecoin
            console.log("   🔄 Registering Dogecoin...");
            await registry.registerChainAdapter(DOGECOIN_MAINNET_ID, dogeAddress);
            console.log("   ✅ Dogecoin registered");
            
            // Register Litecoin
            console.log("   🔄 Registering Litecoin...");
            await registry.registerChainAdapter(LITECOIN_MAINNET_ID, ltcAddress);
            console.log("   ✅ Litecoin registered");

            // Verify registration
            const supportedChains = await registry.getSupportedChainIds();
            expect(supportedChains).to.have.lengthOf(3);
            expect(supportedChains).to.include(BigInt(BITCOIN_TESTNET_ID));
            expect(supportedChains).to.include(BigInt(DOGECOIN_MAINNET_ID));
            expect(supportedChains).to.include(BigInt(LITECOIN_MAINNET_ID));
        });
    });

    describe("Bitcoin Adapter Functionality Tests", function () {
        it("Should validate Bitcoin addresses correctly", async function () {
            console.log("\n📋 Step 4: Test Address Validation");
            
            const testAddresses = {
                "Bitcoin Testnet P2PKH": "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn",
                "Bitcoin P2SH": "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
                "Bitcoin Bech32": "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
                "Litecoin": "LhK2BTQ1efhxVBJGigJ5VwgWzWNWWgZJhw",
                "Dogecoin": "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L"
            };

            for (const [type, address] of Object.entries(testAddresses)) {
                const isValid = await btcAdapter.validateDestinationAddress(ethers.toUtf8Bytes(address));
                console.log(`   ${isValid ? '✅' : '❌'} ${type}: ${address}`);
                expect(isValid).to.be.true;
            }
        });

        it("Should create and validate Bitcoin execution parameters", async function () {
            console.log("\n📋 Step 5: Test Bitcoin Parameters");
            
            const btcParams = {
                feeSatPerByte: 25,
                timelock: 144,
                useRelativeTimelock: false,
                refundPubKeyHash: ethers.keccak256(ethers.toUtf8Bytes("refund_key")),
                dustThreshold: 546,
                confirmations: 3
            };

            // Test encoding/decoding
            const encoded = await btcAdapter.encodeBitcoinExecutionParams(btcParams);
            const decoded = await btcAdapter.decodeBitcoinExecutionParams(encoded);
            
            expect(decoded.feeSatPerByte).to.equal(btcParams.feeSatPerByte);
            expect(decoded.timelock).to.equal(btcParams.timelock);
            expect(decoded.useRelativeTimelock).to.equal(btcParams.useRelativeTimelock);
            expect(decoded.refundPubKeyHash).to.equal(btcParams.refundPubKeyHash);
            expect(decoded.dustThreshold).to.equal(btcParams.dustThreshold);
            expect(decoded.confirmations).to.equal(btcParams.confirmations);
            
            console.log("   ✅ Parameter encoding/decoding successful");
            console.log("   🔧 Fee Rate:", decoded.feeSatPerByte.toString(), "sat/byte");
            console.log("   ⏰ Timelock:", decoded.timelock.toString(), "blocks");
        });

        it("Should validate order parameters correctly", async function () {
            console.log("\n📋 Step 6: Test Order Validation");
            
            const btcParams = {
                feeSatPerByte: 10,
                timelock: 144,
                useRelativeTimelock: false,
                refundPubKeyHash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                dustThreshold: 546,
                confirmations: 1
            };
            
            const encodedParams = await btcAdapter.encodeBitcoinExecutionParams(btcParams);
            const orderParams = {
                destinationAddress: ethers.toUtf8Bytes("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn"),
                executionParams: encodedParams,
                estimatedGas: 250,
                additionalData: "0x"
            };

            const amount = ethers.parseEther("0.1");
            const validation = await btcAdapter.validateOrderParams(orderParams, amount);
            
            expect(validation.isValid).to.be.true;
            expect(validation.estimatedCost).to.be.greaterThan(0);
            
            console.log(`   ✅ Order Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
            console.log("   💰 Estimated Cost:", ethers.formatEther(validation.estimatedCost), "ETH equivalent");
        });

        it("Should calculate safety deposits correctly", async function () {
            console.log("\n📋 Step 7: Test Safety Deposits");
            
            const amounts = [
                ethers.parseEther("0.01"), // 0.01 BTC
                ethers.parseEther("0.1"),  // 0.1 BTC  
                ethers.parseEther("1.0")   // 1.0 BTC
            ];

            for (const amount of amounts) {
                const safetyDeposit = await btcAdapter.calculateMinSafetyDeposit(amount);
                const expectedDeposit = amount * BigInt(500) / BigInt(10000); // 5%
                
                expect(safetyDeposit).to.equal(expectedDeposit);
                
                console.log(`   💳 Amount: ${ethers.formatEther(amount)} BTC → Safety Deposit: ${ethers.formatEther(safetyDeposit)} BTC (5%)`);
            }
        });

        it("Should generate valid HTLC scripts", async function () {
            console.log("\n📋 Step 8: Test HTLC Script Generation");
            
            const secret = "my_secret_preimage_for_atomic_swap";
            const hashlock = ethers.sha256(ethers.toUtf8Bytes(secret));
            const recipientPubKeyHash = ethers.randomBytes(20);
            const refundPubKeyHash = ethers.randomBytes(20);

            console.log("   🔐 Secret:", secret);
            console.log("   #️⃣ Hashlock:", hashlock);

            // Test CLTV script
            const htlcScriptCLTV = await btcAdapter.generateHTLCScript(
                hashlock,
                144,
                recipientPubKeyHash,
                refundPubKeyHash,
                false // Use CLTV
            );

            // Test CSV script
            const htlcScriptCSV = await btcAdapter.generateHTLCScript(
                hashlock,
                144,
                recipientPubKeyHash,
                refundPubKeyHash,
                true // Use CSV
            );

            expect(htlcScriptCLTV).to.not.equal("0x");
            expect(htlcScriptCSV).to.not.equal("0x");
            expect(htlcScriptCLTV).to.not.equal(htlcScriptCSV);

            console.log("   📄 HTLC Script (CLTV):", htlcScriptCLTV.slice(0, 42) + "... (" + Math.floor(htlcScriptCLTV.length / 2 - 1) + " bytes)");
            console.log("   📄 HTLC Script (CSV):", htlcScriptCSV.slice(0, 42) + "... (" + Math.floor(htlcScriptCSV.length / 2 - 1) + " bytes)");

            // Verify script structure
            const scriptHex = htlcScriptCLTV.slice(2);
            const hasRequiredOpcodes = scriptHex.includes('63') && // OP_IF
                                       scriptHex.includes('67') && // OP_ELSE
                                       scriptHex.includes('68') && // OP_ENDIF
                                       scriptHex.includes('a8') && // OP_SHA256
                                       scriptHex.includes('b1');   // OP_CHECKLOCKTIMEVERIFY
            
            expect(hasRequiredOpcodes).to.be.true;
            console.log("   ✅ Script Structure: VALID");
        });

        it("Should support correct features", async function () {
            console.log("\n📋 Step 9: Test Feature Support");
            
            const features = [
                "atomic_swaps",
                "htlc",
                "script_based_locks",
                "utxo_model",
                "timelock_csv",
                "timelock_cltv",
                "partial_fills"
            ];

            for (const feature of features) {
                const isSupported = await btcAdapter.supportsFeature(feature);
                const expected = feature !== "partial_fills"; // All except partial_fills should be supported
                
                expect(isSupported).to.equal(expected);
                console.log(`   ${isSupported ? '✅' : '❌'} ${feature}: ${isSupported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
            }
        });
    });

    describe("Registry Integration Tests", function () {
        it("Should work with registry for all Bitcoin chains", async function () {
            console.log("\n📋 Step 10: Test Registry Integration");
            
            const chains = [
                { id: BITCOIN_TESTNET_ID, name: "Bitcoin Testnet", adapter: btcAdapter },
                { id: DOGECOIN_MAINNET_ID, name: "Dogecoin", adapter: dogeAdapter },
                { id: LITECOIN_MAINNET_ID, name: "Litecoin", adapter: ltcAdapter }
            ];

            for (const chain of chains) {
                // Test registry functions
                const isSupported = await registry.isChainSupported(chain.id);
                expect(isSupported).to.be.true;
                
                const chainInfo = await registry.getChainInfo(chain.id);
                expect(chainInfo.chainId).to.equal(chain.id);
                
                // Test cost estimation through registry
                const amount = ethers.parseEther("0.1");
                const btcParams = {
                    feeSatPerByte: 10,
                    timelock: 144,
                    useRelativeTimelock: false,
                    refundPubKeyHash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                    dustThreshold: 546,
                    confirmations: 1
                };
                
                const encodedParams = await chain.adapter.encodeBitcoinExecutionParams(btcParams);
                const orderParams = {
                    destinationAddress: ethers.toUtf8Bytes("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn"),
                    executionParams: encodedParams,
                    estimatedGas: 250,
                    additionalData: "0x"
                };

                const cost = await registry.estimateExecutionCost(chain.id, orderParams, amount);
                expect(cost).to.be.greaterThan(0);
                
                console.log(`   ✅ ${chain.name}: Chain ${chain.id} - Cost: ${ethers.formatEther(cost)} ETH`);
            }
        });

        it("Should handle safety deposit calculations through registry", async function () {
            console.log("\n📋 Step 11: Test Registry Safety Deposits");
            
            const amount = ethers.parseEther("1.0");
            
            for (const chainId of [BITCOIN_TESTNET_ID, DOGECOIN_MAINNET_ID, LITECOIN_MAINNET_ID]) {
                const safetyDeposit = await registry.calculateMinSafetyDeposit(chainId, amount);
                const expectedDeposit = amount * BigInt(500) / BigInt(10000); // 5%
                
                expect(safetyDeposit).to.equal(expectedDeposit);
                
                const chainInfo = await registry.getChainInfo(chainId);
                console.log(`   💰 ${chainInfo.symbol}: ${ethers.formatEther(safetyDeposit)} safety deposit for 1.0 token`);
            }
        });
    });

    describe("Multi-Chain Comparison Tests", function () {
        it("Should demonstrate multi-chain capabilities", async function () {
            console.log("\n📋 Step 12: Multi-Chain Comparison");
            
            const testData = {
                amount: ethers.parseEther("0.5"),
                address: "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn"
            };

            const chains = [
                { adapter: btcAdapter, name: "Bitcoin Testnet" },
                { adapter: dogeAdapter, name: "Dogecoin" },
                { adapter: ltcAdapter, name: "Litecoin" }
            ];

            console.log("   🌐 Multi-Chain Feature Comparison:");
            console.log("   =====================================");
            
            for (const chain of chains) {
                const info = await chain.adapter.getChainInfo();
                const safetyDeposit = await chain.adapter.calculateMinSafetyDeposit(testData.amount);
                const isValidAddress = await chain.adapter.validateDestinationAddress(ethers.toUtf8Bytes(testData.address));
                const supportsHTLC = await chain.adapter.supportsFeature("htlc");
                const supportsUTXO = await chain.adapter.supportsFeature("utxo_model");
                
                console.log(`   📊 ${chain.name}:`);
                console.log(`       Chain ID: ${info.chainId}`);
                console.log(`       Symbol: ${info.symbol}`);
                console.log(`       Safety Deposit: ${ethers.formatEther(safetyDeposit)} (5%)`);
                console.log(`       Address Valid: ${isValidAddress ? '✅' : '❌'}`);
                console.log(`       HTLC Support: ${supportsHTLC ? '✅' : '❌'}`);
                console.log(`       UTXO Model: ${supportsUTXO ? '✅' : '❌'}`);
                console.log("");
            }
        });
    });

    after(function () {
        console.log("🎉 Bitcoin Integration Test Suite Complete!");
        console.log("============================================");
        console.log("");
        console.log("📈 Summary:");
        console.log("   ✅ 3 Bitcoin family adapters deployed locally");
        console.log("   ✅ Full registry integration working");
        console.log("   ✅ Address validation across all formats");
        console.log("   ✅ HTLC script generation (CLTV & CSV)");
        console.log("   ✅ Parameter encoding/decoding functional");
        console.log("   ✅ Safety deposit calculations accurate");
        console.log("   ✅ Multi-chain comparison successful");
        console.log("");
        console.log("🚀 Ready for Sepolia testnet deployment!");
    });
});