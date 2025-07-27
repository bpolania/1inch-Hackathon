const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProductionOneInchEscrowFactory Unit Tests", function () {
    let escrowFactory;
    let owner;
    let maker;
    let taker;
    let unauthorized;

    const SAMPLE_ORDER_HASH = ethers.keccak256(ethers.toUtf8Bytes("test-order"));
    const SAMPLE_HASHLOCK = ethers.keccak256(ethers.toUtf8Bytes("secret123"));

    beforeEach(async function () {
        [owner, maker, taker, unauthorized] = await ethers.getSigners();

        // Deploy ProductionOneInchEscrowFactory
        const ProductionEscrowFactory = await ethers.getContractFactory("ProductionOneInchEscrowFactory");
        escrowFactory = await ProductionEscrowFactory.deploy();
        await escrowFactory.waitForDeployment();
    });

    describe("Deployment and Initialization", function () {
        it("Should deploy with correct owner", async function () {
            expect(await escrowFactory.owner()).to.equal(owner.address);
        });

        it("Should deploy implementation contracts", async function () {
            const srcImpl = await escrowFactory.escrowSrcImplementation();
            const dstImpl = await escrowFactory.escrowDstImplementation();

            expect(srcImpl).to.not.equal(ethers.ZeroAddress);
            expect(dstImpl).to.not.equal(ethers.ZeroAddress);
            expect(srcImpl).to.not.equal(dstImpl);
        });

        it("Should initialize with correct default values", async function () {
            expect(await escrowFactory.minimumSafetyDeposit()).to.equal(ethers.parseEther("0.01"));
            expect(await escrowFactory.maxTimelockDuration()).to.equal(7 * 24 * 60 * 60); // 7 days
            expect(await escrowFactory.paused()).to.be.false;
        });

        it("Should emit EscrowImplementationsUpdated event on deployment", async function () {
            const deployTx = await ethers.getContractFactory("ProductionOneInchEscrowFactory");
            const factory = await deployTx.deploy();
            const receipt = await factory.deploymentTransaction().wait();
            
            const event = receipt.logs.find(log => {
                try {
                    const parsed = factory.interface.parseLog(log);
                    return parsed.name === "EscrowImplementationsUpdated";
                } catch (e) {
                    return false;
                }
            });
            expect(event).to.not.be.undefined;
        });
    });

    describe("Owner Functions", function () {
        it("Should allow owner to update implementations", async function () {
            const newSrcImpl = ethers.Wallet.createRandom().address;
            const newDstImpl = ethers.Wallet.createRandom().address;

            await expect(escrowFactory.connect(owner).updateImplementations(newSrcImpl, newDstImpl))
                .to.emit(escrowFactory, "EscrowImplementationsUpdated")
                .withArgs(newSrcImpl, newDstImpl);

            expect(await escrowFactory.escrowSrcImplementation()).to.equal(newSrcImpl);
            expect(await escrowFactory.escrowDstImplementation()).to.equal(newDstImpl);
        });

        it("Should reject implementation update from non-owner", async function () {
            const newSrcImpl = ethers.Wallet.createRandom().address;
            const newDstImpl = ethers.Wallet.createRandom().address;

            await expect(
                escrowFactory.connect(unauthorized).updateImplementations(newSrcImpl, newDstImpl)
            ).to.be.revertedWithCustomError(escrowFactory, "OwnableUnauthorizedAccount");
        });

        it("Should reject zero address implementations", async function () {
            await expect(
                escrowFactory.connect(owner).updateImplementations(ethers.ZeroAddress, maker.address)
            ).to.be.revertedWith("Invalid implementations");

            await expect(
                escrowFactory.connect(owner).updateImplementations(maker.address, ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid implementations");
        });

        it("Should allow owner to pause/unpause", async function () {
            await expect(escrowFactory.connect(owner).setPaused(true))
                .to.emit(escrowFactory, "FactoryPaused")
                .withArgs(true);

            expect(await escrowFactory.paused()).to.be.true;

            await expect(escrowFactory.connect(owner).setPaused(false))
                .to.emit(escrowFactory, "FactoryPaused")
                .withArgs(false);

            expect(await escrowFactory.paused()).to.be.false;
        });

        it("Should reject pause from non-owner", async function () {
            await expect(
                escrowFactory.connect(unauthorized).setPaused(true)
            ).to.be.revertedWithCustomError(escrowFactory, "OwnableUnauthorizedAccount");
        });

        it("Should allow owner to update minimum safety deposit", async function () {
            const newMinimum = ethers.parseEther("0.05");

            await expect(escrowFactory.connect(owner).setMinimumSafetyDeposit(newMinimum))
                .to.emit(escrowFactory, "MinimumSafetyDepositUpdated")
                .withArgs(newMinimum);

            expect(await escrowFactory.minimumSafetyDeposit()).to.equal(newMinimum);
        });

        it("Should allow emergency withdrawal", async function () {
            // Send some ETH to the factory
            await owner.sendTransaction({
                to: await escrowFactory.getAddress(),
                value: ethers.parseEther("1")
            });

            const initialBalance = await ethers.provider.getBalance(taker.address);
            const withdrawAmount = ethers.parseEther("0.5");

            await escrowFactory.connect(owner).emergencyWithdraw(taker.address, withdrawAmount);

            const finalBalance = await ethers.provider.getBalance(taker.address);
            expect(finalBalance - initialBalance).to.equal(withdrawAmount);
        });
    });

    describe("Address Computation", function () {
        let sampleImmutables;

        beforeEach(async function () {
            sampleImmutables = {
                orderHash: SAMPLE_ORDER_HASH,
                hashlock: SAMPLE_HASHLOCK,
                maker: maker.address,
                taker: taker.address,
                token: ethers.ZeroAddress,
                amount: ethers.parseEther("100"),
                safetyDeposit: ethers.parseEther("5"),
                timelocks: await createSampleTimelocks()
            };
        });

        it("Should compute deterministic source escrow address", async function () {
            const address1 = await escrowFactory.addressOfEscrowSrc(sampleImmutables);
            const address2 = await escrowFactory.addressOfEscrowSrc(sampleImmutables);

            expect(address1).to.equal(address2);
            expect(address1).to.not.equal(ethers.ZeroAddress);
        });

        it("Should compute different addresses for different immutables", async function () {
            const address1 = await escrowFactory.addressOfEscrowSrc(sampleImmutables);

            const modifiedImmutables = { ...sampleImmutables, amount: ethers.parseEther("200") };
            const address2 = await escrowFactory.addressOfEscrowSrc(modifiedImmutables);

            expect(address1).to.not.equal(address2);
        });

        it("Should reject invalid immutables for address computation", async function () {
            const invalidImmutables = { ...sampleImmutables, orderHash: ethers.ZeroHash };

            await expect(
                escrowFactory.addressOfEscrowSrc(invalidImmutables)
            ).to.be.revertedWith("Invalid order hash");
        });
    });

    describe("Destination Escrow Creation", function () {
        let validImmutables;

        beforeEach(async function () {
            validImmutables = {
                orderHash: SAMPLE_ORDER_HASH,
                hashlock: SAMPLE_HASHLOCK,
                maker: maker.address,
                taker: taker.address,
                token: ethers.ZeroAddress,
                amount: ethers.parseEther("100"),
                safetyDeposit: ethers.parseEther("5"),
                timelocks: await createSampleTimelocks()
            };
        });

        it("Should create destination escrow successfully", async function () {
            const srcCancellationTimestamp = (await time.latest()) + 3600;

            const tx = await escrowFactory.connect(taker).createDstEscrow(
                validImmutables,
                srcCancellationTimestamp,
                { value: validImmutables.safetyDeposit }
            );
            const receipt = await tx.wait();

            // Check event emission
            const event = receipt.logs.find(log => {
                try {
                    const parsed = escrowFactory.interface.parseLog(log);
                    return parsed.name === "EscrowDstCreated";
                } catch (e) {
                    return false;
                }
            });

            expect(event).to.not.be.undefined;
            expect(event.args.orderHash).to.equal(SAMPLE_ORDER_HASH);
            expect(event.args.maker).to.equal(maker.address);
            expect(event.args.taker).to.equal(taker.address);
            expect(event.args.hashlock).to.equal(SAMPLE_HASHLOCK);

            // Check escrow was stored
            const [, dstEscrow] = await escrowFactory.getEscrowAddresses(SAMPLE_ORDER_HASH);
            expect(dstEscrow).to.not.equal(ethers.ZeroAddress);
            expect(dstEscrow).to.equal(event.args.escrow);
        });

        it("Should reject insufficient safety deposit", async function () {
            const srcCancellationTimestamp = (await time.latest()) + 3600;
            const insufficientValue = ethers.parseEther("0.005"); // Less than minimum

            await expect(
                escrowFactory.connect(taker).createDstEscrow(
                    validImmutables,
                    srcCancellationTimestamp,
                    { value: insufficientValue }
                )
            ).to.be.revertedWith("Insufficient payment");
        });

        it("Should reject low safety deposit in immutables", async function () {
            const lowDepositImmutables = {
                ...validImmutables,
                safetyDeposit: ethers.parseEther("0.005") // Less than minimum
            };

            const srcCancellationTimestamp = (await time.latest()) + 3600;

            await expect(
                escrowFactory.connect(taker).createDstEscrow(
                    lowDepositImmutables,
                    srcCancellationTimestamp,
                    { value: ethers.parseEther("1") }
                )
            ).to.be.revertedWith("Safety deposit too low");
        });

        it("Should reject creation when paused", async function () {
            await escrowFactory.connect(owner).setPaused(true);

            const srcCancellationTimestamp = (await time.latest()) + 3600;

            await expect(
                escrowFactory.connect(taker).createDstEscrow(
                    validImmutables,
                    srcCancellationTimestamp,
                    { value: validImmutables.safetyDeposit }
                )
            ).to.be.revertedWith("Factory is paused");
        });

        it("Should prevent duplicate escrow creation", async function () {
            const srcCancellationTimestamp = (await time.latest()) + 3600;

            // Create first escrow
            await escrowFactory.connect(taker).createDstEscrow(
                validImmutables,
                srcCancellationTimestamp,
                { value: validImmutables.safetyDeposit }
            );

            // Try to create duplicate
            await expect(
                escrowFactory.connect(taker).createDstEscrow(
                    validImmutables,
                    srcCancellationTimestamp,
                    { value: validImmutables.safetyDeposit }
                )
            ).to.be.revertedWith("Escrow already exists");
        });

        it("Should refund excess payment", async function () {
            const srcCancellationTimestamp = (await time.latest()) + 3600;
            const excessValue = validImmutables.safetyDeposit + ethers.parseEther("1");

            const initialBalance = await ethers.provider.getBalance(taker.address);

            const tx = await escrowFactory.connect(taker).createDstEscrow(
                validImmutables,
                srcCancellationTimestamp,
                { value: excessValue }
            );
            const receipt = await tx.wait();

            const finalBalance = await ethers.provider.getBalance(taker.address);
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            // Should refund the excess (1 ETH)
            const expectedBalance = initialBalance - validImmutables.safetyDeposit - gasUsed;
            expect(finalBalance).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
        });

        it("Should reject invalid immutables", async function () {
            const invalidImmutables = {
                ...validImmutables,
                orderHash: ethers.ZeroHash
            };

            const srcCancellationTimestamp = (await time.latest()) + 3600;

            await expect(
                escrowFactory.connect(taker).createDstEscrow(
                    invalidImmutables,
                    srcCancellationTimestamp,
                    { value: validImmutables.safetyDeposit }
                )
            ).to.be.revertedWith("Invalid order hash");
        });
    });

    describe("Source Escrow Creation", function () {
        let validImmutables;

        beforeEach(async function () {
            validImmutables = {
                orderHash: SAMPLE_ORDER_HASH,
                hashlock: SAMPLE_HASHLOCK,
                maker: maker.address,
                taker: taker.address,
                token: ethers.ZeroAddress,
                amount: ethers.parseEther("100"),
                safetyDeposit: ethers.parseEther("0"), // Source escrows don't require safety deposit
                timelocks: await createSampleTimelocks()
            };
        });

        it("Should create source escrow successfully", async function () {
            const tx = await escrowFactory.connect(maker).createSrcEscrow(validImmutables);
            const receipt = await tx.wait();

            // Check event emission
            const event = receipt.logs.find(log => {
                try {
                    const parsed = escrowFactory.interface.parseLog(log);
                    return parsed.name === "EscrowSrcCreated";
                } catch (e) {
                    return false;
                }
            });

            expect(event).to.not.be.undefined;
            expect(event.args.orderHash).to.equal(SAMPLE_ORDER_HASH);

            // Check escrow was stored
            const [srcEscrow] = await escrowFactory.getEscrowAddresses(SAMPLE_ORDER_HASH);
            expect(srcEscrow).to.not.equal(ethers.ZeroAddress);
        });

        it("Should prevent duplicate source escrow creation", async function () {
            // Create first escrow
            await escrowFactory.connect(maker).createSrcEscrow(validImmutables);

            // Try to create duplicate
            await expect(
                escrowFactory.connect(maker).createSrcEscrow(validImmutables)
            ).to.be.revertedWith("Escrow already exists");
        });
    });

    describe("Validation and Security", function () {
        it("Should validate timelock duration limits", async function () {
            const longTimelocks = await createTimelocks((await time.latest()) + (8 * 24 * 60 * 60)); // 8 days
            const invalidImmutables = {
                orderHash: SAMPLE_ORDER_HASH,
                hashlock: SAMPLE_HASHLOCK,
                maker: maker.address,
                taker: taker.address,
                token: ethers.ZeroAddress,
                amount: ethers.parseEther("100"),
                safetyDeposit: ethers.parseEther("5"),
                timelocks: longTimelocks
            };

            const srcCancellationTimestamp = (await time.latest()) + 3600;

            await expect(
                escrowFactory.connect(taker).createDstEscrow(
                    invalidImmutables,
                    srcCancellationTimestamp,
                    { value: ethers.parseEther("5") }
                )
            ).to.be.revertedWith("Timelock duration too long");
        });

        it("Should handle zero amounts gracefully", async function () {
            const zeroAmountImmutables = {
                orderHash: SAMPLE_ORDER_HASH,
                hashlock: SAMPLE_HASHLOCK,
                maker: maker.address,
                taker: taker.address,
                token: ethers.ZeroAddress,
                amount: 0, // Invalid
                safetyDeposit: ethers.parseEther("5"),
                timelocks: await createSampleTimelocks()
            };

            await expect(
                escrowFactory.addressOfEscrowSrc(zeroAmountImmutables)
            ).to.be.revertedWith("Invalid amount");
        });
    });

    describe("Gas Optimization", function () {
        it("Should deploy escrows with reasonable gas costs", async function () {
            const validImmutables = {
                orderHash: SAMPLE_ORDER_HASH,
                hashlock: SAMPLE_HASHLOCK,
                maker: maker.address,
                taker: taker.address,
                token: ethers.ZeroAddress,
                amount: ethers.parseEther("100"),
                safetyDeposit: ethers.parseEther("5"),
                timelocks: await createSampleTimelocks()
            };

            const srcCancellationTimestamp = (await time.latest()) + 3600;

            const tx = await escrowFactory.connect(taker).createDstEscrow(
                validImmutables,
                srcCancellationTimestamp,
                { value: validImmutables.safetyDeposit }
            );
            const receipt = await tx.wait();

            // Gas should be reasonable (less than 500k for escrow creation)
            expect(receipt.gasUsed).to.be.lessThan(500000);
        });
    });

    // Helper function to create sample timelocks
    async function createSampleTimelocks() {
        const baseTime = await time.latest();
        return createTimelocks(baseTime + 3600); // 1 hour expiry
    }

    function createTimelocks(expiryTime) {
        const baseTime = Math.floor(Date.now() / 1000);
        const timeBuffer = Math.floor((expiryTime - baseTime) / 7);
        
        const stage1 = baseTime + timeBuffer;
        const stage2 = baseTime + (timeBuffer * 2);
        const stage3 = baseTime + (timeBuffer * 3);
        const stage4 = baseTime + (timeBuffer * 4);
        const stage5 = baseTime + (timeBuffer * 5);
        const stage6 = baseTime + (timeBuffer * 6);
        const stage7 = expiryTime;
        
        // Pack timelock stages
        return (BigInt(stage1) << 224n) | (BigInt(stage2) << 192n) | (BigInt(stage3) << 160n) | 
               (BigInt(stage4) << 128n) | (BigInt(stage5) << 96n) | (BigInt(stage6) << 64n) | 
               (BigInt(stage7) << 32n);
    }
});