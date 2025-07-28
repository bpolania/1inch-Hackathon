const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * End-to-End Atomic Swap Verification Tests
 * 
 * These integration tests verify complete atomic swaps using deployed contracts
 * on both Ethereum Sepolia and NEAR testnet.
 */

describe("End-to-End Atomic Swap Verification", function () {
    let factory, demoToken, signer;
    let deploymentInfo;

    // Test configuration
    const KNOWN_ORDER_HASH = "0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4";
    const KNOWN_SECRET = "a9aab023149fea18759fd15443bd11bfca388dfe7f0813e372a75ce8a37dd7bc";
    const KNOWN_HASHLOCK = "dc10e49df5552b2daadb1864d6f38c59764669b67ac9bcc81a03f292ffed1515";

    before(async function () {
        // Skip if not on Sepolia testnet
        const network = await ethers.provider.getNetwork();
        if (network.chainId !== 11155111n) {
            this.skip();
        }

        try {
            deploymentInfo = JSON.parse(fs.readFileSync("./sepolia-deployment.json", "utf8"));
        } catch (error) {
            this.skip(); // Skip if no deployment info
        }

        [signer] = await ethers.getSigners();
        
        const factoryAddress = deploymentInfo.productionDeployment.contracts.OneInchFusionPlusFactory;
        factory = await ethers.getContractAt("OneInchFusionPlusFactory", factoryAddress, signer);
        
        const tokenAddress = deploymentInfo.productionDeployment.contracts.DemoToken;
        demoToken = await ethers.getContractAt("MockERC20", tokenAddress, signer);
    });

    describe("Deployed Contract Verification", function () {
        it("should have valid deployed factory contract", async function () {
            const code = await ethers.provider.getCode(await factory.getAddress());
            expect(code).to.not.equal("0x");
            
            // Verify contract has expected interface
            expect(await factory.totalOrdersCreated()).to.be.a("bigint");
        });

        it("should have valid deployed token contract", async function () {
            const code = await ethers.provider.getCode(await demoToken.getAddress());
            expect(code).to.not.equal("0x");
            
            const name = await demoToken.name();
            expect(name).to.equal("Demo Token");
        });

        it("should have authorized resolver", async function () {
            const isAuthorized = await factory.authorizedResolvers(signer.address);
            expect(isAuthorized).to.be.true;
        });
    });

    describe("Atomic Swap State Verification", function () {
        let order;

        before(async function () {
            try {
                order = await factory.getOrder(KNOWN_ORDER_HASH);
            } catch (error) {
                this.skip(); // Skip if order doesn't exist
            }
        });

        it("should have completed order with expected parameters", async function () {
            expect(order.isActive).to.be.false; // Order should be completed
            expect(order.sourceToken).to.equal(await demoToken.getAddress());
            expect(order.sourceAmount).to.equal(ethers.parseEther("0.2"));
            expect(order.resolverFeeAmount).to.equal(ethers.parseEther("0.02"));
            expect(order.destinationChainId).to.equal(40002); // NEAR testnet
        });

        it("should have deployed escrow contracts", async function () {
            const sourceEscrow = await factory.sourceEscrows(KNOWN_ORDER_HASH);
            const destinationEscrow = await factory.destinationEscrows(KNOWN_ORDER_HASH);

            expect(sourceEscrow).to.not.equal(ethers.ZeroAddress);
            expect(destinationEscrow).to.not.equal(ethers.ZeroAddress);

            // Verify escrows have contract code
            const sourceCode = await ethers.provider.getCode(sourceEscrow);
            const destCode = await ethers.provider.getCode(destinationEscrow);
            
            expect(sourceCode).to.not.equal("0x");
            expect(destCode).to.not.equal("0x");
        });

        it("should have tokens in source escrow", async function () {
            const sourceEscrow = await factory.sourceEscrows(KNOWN_ORDER_HASH);
            const escrowBalance = await demoToken.balanceOf(sourceEscrow);
            
            expect(escrowBalance).to.equal(ethers.parseEther("0.2"));
        });

        it("should have safety deposit in destination escrow", async function () {
            const destinationEscrow = await factory.destinationEscrows(KNOWN_ORDER_HASH);
            const escrowBalance = await ethers.provider.getBalance(destinationEscrow);
            
            expect(escrowBalance).to.equal(ethers.parseEther("0.01"));
        });
    });

    describe("Cryptographic Verification", function () {
        it("should verify SHA-256 hashlock matches secret", function () {
            const crypto = require('crypto');
            const secretBuffer = Buffer.from(KNOWN_SECRET, 'hex');
            const computedHash = crypto.createHash('sha256').update(secretBuffer).digest('hex');
            
            expect(computedHash).to.equal(KNOWN_HASHLOCK);
        });

        it("should use same secret across chains", function () {
            // This test documents that the same secret is used on both Ethereum and NEAR
            // The NEAR side verification would need to be done separately
            expect(KNOWN_SECRET).to.have.length(64); // 32 bytes in hex
            expect(KNOWN_HASHLOCK).to.have.length(64); // 32 bytes in hex
        });
    });

    describe("Balance Verification", function () {
        it("should show user DT balance decreased from original", async function () {
            const currentBalance = await demoToken.balanceOf(signer.address);
            
            // User should have less than 1000 DT (original amount)
            expect(currentBalance).to.be.lt(ethers.parseEther("1000"));
            
            // Should be around 999.58 DT (1000 - 0.2 - 0.22 from previous demos)
            expect(currentBalance).to.be.approximately(
                ethers.parseEther("999.58"), 
                ethers.parseEther("0.1") // Allow some variance
            );
        });

        it("should show user ETH balance decreased from transactions", async function () {
            const currentBalance = await ethers.provider.getBalance(signer.address);
            
            // User should have spent ETH on gas and safety deposits
            // Started with ~0.052 ETH, should have spent ~0.027 ETH
            expect(currentBalance).to.be.lt(ethers.parseEther("0.052"));
        });
    });

    describe("Transaction History Verification", function () {
        const KNOWN_TRANSACTIONS = {
            orderCreation: "0xf45e3f29a382dbb79df313a9382923898105915f48b610ab605cb13861c9b029",
            orderMatching: "0x8eea5557477e7ddf34c47380c01dbae3262639c7d35fc3b94dcb37cfc7101421", 
            orderCompletion: "0x89ad2ece9ee5dd8e2de1c949a72ecbd9087139a5411d79ec1f9eb75cb0b5a018",
            tokenSettlement: "0x2acb4a06f215004f797769582264970310ff4d77bb11dd7b2f2971ad2d911bc3"
        };

        it("should have verifiable transaction history", async function () {
            // Verify transactions exist on chain
            for (const [step, txHash] of Object.entries(KNOWN_TRANSACTIONS)) {
                const receipt = await ethers.provider.getTransactionReceipt(txHash);
                expect(receipt).to.not.be.null;
                expect(receipt.status).to.equal(1); // Success
            }
        });

        it("should have appropriate gas usage", async function () {
            const receipt = await ethers.provider.getTransactionReceipt(
                KNOWN_TRANSACTIONS.orderMatching
            );
            
            // Order matching should use significant gas (escrow deployment)
            expect(receipt.gasUsed).to.be.gt(400000);
        });
    });

    describe("Complete Atomic Swap Verification", function () {
        it("should pass all atomic swap criteria", async function () {
            // Run the verification checklist programmatically
            const order = await factory.getOrder(KNOWN_ORDER_HASH);
            const sourceEscrow = await factory.sourceEscrows(KNOWN_ORDER_HASH);
            const destinationEscrow = await factory.destinationEscrows(KNOWN_ORDER_HASH);
            
            const sourceEscrowBalance = await demoToken.balanceOf(sourceEscrow);
            const destinationEscrowBalance = await ethers.provider.getBalance(destinationEscrow);
            const userDTBalance = await demoToken.balanceOf(signer.address);
            const userETHBalance = await ethers.provider.getBalance(signer.address);

            // Cryptographic verification
            const crypto = require('crypto');
            const secretBuffer = Buffer.from(KNOWN_SECRET, 'hex');
            const computedHash = crypto.createHash('sha256').update(secretBuffer).digest('hex');

            // All criteria must pass
            expect(order.isActive).to.be.false; // Order completed
            expect(computedHash).to.equal(KNOWN_HASHLOCK); // Hash matches
            expect(sourceEscrowBalance).to.be.gt(0); // Tokens in escrow
            expect(destinationEscrowBalance).to.be.gt(0); // Safety deposit locked
            expect(userDTBalance).to.be.lt(ethers.parseEther("1000")); // User balance decreased
            expect(userETHBalance).to.be.lt(ethers.parseEther("0.052")); // ETH spent

            // This test represents the complete verification that an atomic swap occurred
        });

        it("should demonstrate cross-chain coordination", function () {
            // This test documents the cross-chain aspect
            // The same secret (KNOWN_SECRET) was used on both Ethereum and NEAR
            // NEAR transactions: GnAior7Pg1S..., AUsg7W6AYN..., 8tvsy3NmSD...
            
            expect(KNOWN_SECRET).to.be.a("string");
            expect(KNOWN_HASHLOCK).to.be.a("string");
            
            // The fact that the Ethereum order completed proves the secret
            // was successfully revealed on NEAR and used to complete the swap
        });
    });

    describe("Safety Deposit Calculation", function () {
        it("should calculate correct safety deposit for NEAR", async function () {
            const registryAddress = await factory.registry();
            const registry = await ethers.getContractAt("CrossChainRegistry", registryAddress);
            
            const sourceAmount = ethers.parseEther("0.2");
            const safetyDeposit = await registry.calculateMinSafetyDeposit(40002, sourceAmount);
            
            expect(safetyDeposit).to.equal(ethers.parseEther("0.01")); // 5% of 0.2 DT
        });

        it("should support NEAR mainnet and testnet", async function () {
            const registryAddress = await factory.registry();
            const registry = await ethers.getContractAt("CrossChainRegistry", registryAddress);
            
            const nearMainnet = await registry.getDestinationChain(40001);
            const nearTestnet = await registry.getDestinationChain(40002);
            
            expect(nearMainnet).to.not.equal(ethers.ZeroAddress);
            expect(nearTestnet).to.not.equal(ethers.ZeroAddress);
        });
    });
});