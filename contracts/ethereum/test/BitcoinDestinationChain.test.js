const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BitcoinDestinationChain", function () {
    let bitcoinDestinationChain;
    let owner;
    let addr1;

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();

        const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
        // Deploy for Bitcoin testnet (40004)
        bitcoinDestinationChain = await BitcoinDestinationChain.deploy(40004);
        await bitcoinDestinationChain.waitForDeployment();
    });

    describe("Chain ID Constants", function () {
        it("should have correct Bitcoin family chain IDs", async function () {
            expect(await bitcoinDestinationChain.BITCOIN_MAINNET()).to.equal(40003);
            expect(await bitcoinDestinationChain.BITCOIN_TESTNET()).to.equal(40004);
            expect(await bitcoinDestinationChain.DOGECOIN_MAINNET()).to.equal(40005);
            expect(await bitcoinDestinationChain.LITECOIN_MAINNET()).to.equal(40006);
            expect(await bitcoinDestinationChain.BITCOIN_CASH_MAINNET()).to.equal(40007);
        });
    });

    describe("Address Validation", function () {
        describe("Bitcoin P2PKH Addresses", function () {
            it("should validate Bitcoin mainnet P2PKH addresses (starts with '1')", async function () {
                const validAddresses = [
                    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", // Genesis block address
                    "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
                    "1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp"
                ];

                for (const address of validAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.true;
                }
            });

            it("should validate Bitcoin testnet P2PKH addresses (starts with 'm' or 'n')", async function () {
                const validAddresses = [
                    "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn",
                    "n2eMqTT929pb1RDNuqEnxdaLau1rxy3efi",
                    "mkHS9ne12qx9pS9VojpwU5xtRd4T7X7ZUt"
                ];

                for (const address of validAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.true;
                }
            });

            it("should validate Dogecoin addresses (starts with 'D')", async function () {
                const validAddresses = [
                    "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L",
                    "D7Y55LkYUHGTv4A7V2MCGBBqZYTQY5d6jv"
                ];

                for (const address of validAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.true;
                }
            });

            it("should validate Litecoin addresses (starts with 'L' or 'M')", async function () {
                const validAddresses = [
                    "LYWKqJhtPeGyBAw7WC8R3F7ovxtzAiubdM",
                    "MBuTCzgBhisMCFdLLhQ9SUnPk4j3Jhh8R5"
                ];

                for (const address of validAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.true;
                }
            });
        });

        describe("Bitcoin P2SH Addresses", function () {
            it("should validate Bitcoin mainnet P2SH addresses (starts with '3')", async function () {
                const validAddresses = [
                    "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
                    "3FTMEfzLFw9KhNvU6F6t7W84d8uq4Hf7rn"
                ];

                for (const address of validAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.true;
                }
            });

            it("should validate Bitcoin testnet P2SH addresses (starts with '2')", async function () {
                const validAddresses = [
                    "2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc",
                    "2N2JD6wb56AfK4tfmM6PwdVmoYk2dCKf4Br"
                ];

                for (const address of validAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.true;
                }
            });
        });

        describe("Bitcoin Bech32 Addresses", function () {
            it("should validate Bitcoin mainnet Bech32 addresses (starts with 'bc1')", async function () {
                const validAddresses = [
                    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
                    "bc1qrp33g5q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3"
                ];

                for (const address of validAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.true;
                }
            });

            it("should validate Bitcoin testnet Bech32 addresses (starts with 'tb1')", async function () {
                const validAddresses = [
                    "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
                    "tb1qrp33g5q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7"
                ];

                for (const address of validAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.true;
                }
            });
        });

        describe("Bitcoin Cash Addresses", function () {
            it("should validate Bitcoin Cash addresses with prefix", async function () {
                const validAddresses = [
                    "bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a",
                    "bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy"
                ];

                for (const address of validAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.true;
                }
            });
        });

        describe("Invalid Addresses", function () {
            it("should reject empty addresses", async function () {
                expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes("")))
                    .to.be.false;
            });

            it("should reject invalid format addresses", async function () {
                const invalidAddresses = [
                    "0x742d35Cc6B44e9F7c4963A0e0f9d6d8A8B0f8B8E", // Ethereum address
                    "invalid-address",
                    "123456789",
                    "bitcoin123",
                    "ltc1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", // Wrong prefix
                    "4A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" // Invalid starting character
                ];

                for (const address of invalidAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.false;
                }
            });

            it("should reject addresses with invalid lengths", async function () {
                const invalidAddresses = [
                    "1A1", // Too short
                    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa123456789012345678901234567890", // Too long
                    "bc1q", // Too short bech32
                ];

                for (const address of invalidAddresses) {
                    expect(await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address)))
                        .to.be.false;
                }
            });
        });
    });

    describe("Safety Deposit Calculation", function () {
        it("should calculate 5% safety deposit correctly", async function () {
            const testAmounts = [
                { amount: 1000, expected: 50 },      // 5% of 1000
                { amount: 100000, expected: 5000 },  // 5% of 100000
                { amount: 1, expected: 0 },          // 5% of 1 (rounds down)
                { amount: 20, expected: 1 },         // 5% of 20
            ];

            for (const test of testAmounts) {
                const result = await bitcoinDestinationChain.calculateMinSafetyDeposit(test.amount);
                expect(result).to.equal(test.expected);
            }
        });

        it("should handle large amounts without overflow", async function () {
            const largeAmount = ethers.parseEther("1000000"); // 1M ETH worth
            const expectedDeposit = largeAmount * BigInt(500) / BigInt(10000); // 5%

            const result = await bitcoinDestinationChain.calculateMinSafetyDeposit(largeAmount);
            expect(result).to.equal(expectedDeposit);
        });
    });

    describe("Supported Features", function () {
        it("should support required features", async function () {
            expect(await bitcoinDestinationChain.supportsFeature("htlc")).to.be.true;
            expect(await bitcoinDestinationChain.supportsFeature("sha256_hashlock")).to.be.true;
            expect(await bitcoinDestinationChain.supportsFeature("timelock_refund")).to.be.true;
            expect(await bitcoinDestinationChain.supportsFeature("atomic_swap")).to.be.true;
            expect(await bitcoinDestinationChain.supportsFeature("unsupported_feature")).to.be.false;
        });
    });

    describe("Execution Parameters", function () {
        it("should encode and decode execution parameters correctly", async function () {
            const testParams = {
                btcAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
                htlcTimelock: 144,
                feeRate: 10
            };

            // Encode parameters
            const encoded = await bitcoinDestinationChain.encodeExecutionParams(
                testParams.btcAddress,
                testParams.htlcTimelock,
                testParams.feeRate
            );

            // Decode parameters
            const [decodedAddress, decodedTimelock, decodedFeeRate] = 
                await bitcoinDestinationChain.decodeExecutionParams(encoded);

            expect(decodedAddress).to.equal(testParams.btcAddress);
            expect(decodedTimelock).to.equal(testParams.htlcTimelock);
            expect(decodedFeeRate).to.equal(testParams.feeRate);
        });

        it("should handle various parameter combinations", async function () {
            const testCases = [
                {
                    btcAddress: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                    htlcTimelock: 24,
                    feeRate: 1
                },
                {
                    btcAddress: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
                    htlcTimelock: 1000,
                    feeRate: 100
                },
                {
                    btcAddress: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
                    htlcTimelock: 65535,
                    feeRate: 1000
                }
            ];

            for (const testCase of testCases) {
                const encoded = await bitcoinDestinationChain.encodeExecutionParams(
                    testCase.btcAddress,
                    testCase.htlcTimelock,
                    testCase.feeRate
                );

                const [decodedAddress, decodedTimelock, decodedFeeRate] = 
                    await bitcoinDestinationChain.decodeExecutionParams(encoded);

                expect(decodedAddress).to.equal(testCase.btcAddress);
                expect(decodedTimelock).to.equal(testCase.htlcTimelock);
                expect(decodedFeeRate).to.equal(testCase.feeRate);
            }
        });
    });

    describe("Execution Cost Estimation", function () {
        it("should estimate Bitcoin transaction costs correctly", async function () {
            const testCases = [
                { feeRate: 1, expectedCost: 450n * 1n * 1000000000n },      // 1 sat/byte
                { feeRate: 10, expectedCost: 450n * 10n * 1000000000n },    // 10 sat/byte
                { feeRate: 100, expectedCost: 450n * 100n * 1000000000n },  // 100 sat/byte
            ];

            for (const testCase of testCases) {
                const encodedParams = await bitcoinDestinationChain.encodeExecutionParams(
                    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
                    144,
                    testCase.feeRate
                );

                const chainSpecificParams = {
                    destinationAddress: ethers.toUtf8Bytes("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"),
                    executionParams: encodedParams,
                    estimatedGas: 21000,
                    additionalData: "0x"
                };

                const cost = await bitcoinDestinationChain.estimateExecutionCost(chainSpecificParams, 1000);
                expect(cost).to.equal(testCase.expectedCost);
            }
        });
    });

    describe("Chain Support", function () {
        it("should correctly identify supported chains", async function () {
            const supportedChains = [40003, 40004, 40005, 40006, 40007];
            const unsupportedChains = [1, 11155111, 40001, 40002, 99999];

            for (const chainId of supportedChains) {
                expect(await bitcoinDestinationChain.isChainSupported(chainId))
                    .to.be.true;
            }

            for (const chainId of unsupportedChains) {
                expect(await bitcoinDestinationChain.isChainSupported(chainId))
                    .to.be.false;
            }
        });

        it("should return correct chain names", async function () {
            const chainNames = [
                { chainId: 40003, expectedName: "Bitcoin" },
                { chainId: 40004, expectedName: "Bitcoin Testnet" },
                { chainId: 40005, expectedName: "Dogecoin" },
                { chainId: 40006, expectedName: "Litecoin" },
                { chainId: 40007, expectedName: "Bitcoin Cash" },
                { chainId: 99999, expectedName: "Unknown Bitcoin Chain" }
            ];

            for (const test of chainNames) {
                const name = await bitcoinDestinationChain.getChainName(test.chainId);
                expect(name).to.equal(test.expectedName);
            }
        });
    });

    describe("IDestinationChain Interface Compliance", function () {
        it("should implement all required interface methods", async function () {
            // Test that all IDestinationChain methods exist and are callable
            
            // validateDestinationAddress
            await expect(bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")))
                .to.not.be.reverted;

            // getSupportedTokenFormats
            await expect(bitcoinDestinationChain.getSupportedTokenFormats())
                .to.not.be.reverted;

            // calculateMinSafetyDeposit
            await expect(bitcoinDestinationChain.calculateMinSafetyDeposit(1000))
                .to.not.be.reverted;

            // estimateExecutionCost with ChainSpecificParams
            const encodedParams = await bitcoinDestinationChain.encodeExecutionParams("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", 144, 10);
            const chainSpecificParams = {
                destinationAddress: ethers.toUtf8Bytes("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"),
                executionParams: encodedParams,
                estimatedGas: 21000,
                additionalData: "0x"
            };
            await expect(bitcoinDestinationChain.estimateExecutionCost(chainSpecificParams, 1000))
                .to.not.be.reverted;
        });
    });

    describe("Edge Cases and Error Handling", function () {
        it("should handle zero amounts in safety deposit calculation", async function () {
            const result = await bitcoinDestinationChain.calculateMinSafetyDeposit(0);
            expect(result).to.equal(0);
        });

        it("should handle large values without overflow", async function () {
            const largeValue = ethers.parseEther("1000000"); // 1M ETH worth
            
            // Should not revert with large values
            await expect(bitcoinDestinationChain.calculateMinSafetyDeposit(largeValue))
                .to.not.be.reverted;
        });

        it("should handle very long addresses gracefully", async function () {
            const veryLongAddress = "1".repeat(100);
            const result = await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(veryLongAddress));
            expect(result).to.be.false;
        });

        it("should handle special characters in addresses", async function () {
            const specialCharAddresses = [
                "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa@",
                "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4#",
                "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy$"
            ];

            for (const address of specialCharAddresses) {
                const result = await bitcoinDestinationChain.validateDestinationAddress(ethers.toUtf8Bytes(address));
                expect(result).to.be.false;
            }
        });
    });

    describe("Gas Usage", function () {
        it("should have reasonable gas costs for all operations", async function () {
            // Test gas usage for various operations
            const testAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
            
            // Check if we're running under coverage (which adds instrumentation overhead)
            const isCoverage = process.env.SOLIDITY_COVERAGE === 'true';
            const gasMultiplier = isCoverage ? 2 : 1; // Allow 2x gas usage under coverage
            
            // Address validation
            const validateTx = await bitcoinDestinationChain.validateDestinationAddress.populateTransaction(ethers.toUtf8Bytes(testAddress));
            const validateGasEstimate = await ethers.provider.estimateGas(validateTx);
            expect(validateGasEstimate).to.be.lt(80000 * gasMultiplier); // Should be less than 80k gas (160k under coverage)

            // Safety deposit calculation
            const depositTx = await bitcoinDestinationChain.calculateMinSafetyDeposit.populateTransaction(1000);
            const depositGasEstimate = await ethers.provider.estimateGas(depositTx);
            expect(depositGasEstimate).to.be.lt(30000 * gasMultiplier); // Should be less than 30k gas (60k under coverage)

            // Parameter encoding
            const encodeTx = await bitcoinDestinationChain.encodeExecutionParams.populateTransaction(testAddress, 144, 10);
            const encodeGasEstimate = await ethers.provider.estimateGas(encodeTx);
            expect(encodeGasEstimate).to.be.lt(50000 * gasMultiplier); // Should be less than 50k gas (100k under coverage)
        });
    });
});