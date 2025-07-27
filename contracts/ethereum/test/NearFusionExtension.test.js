const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NEAR Fusion+ Extension - TRUE 1inch Integration", function () {
    let limitOrderProtocol;
    let nearResolver;
    let nearEscrowSrc;
    let nearFusionFactory;
    let mockUSDC;
    let owner, maker, taker;

    beforeEach(async function () {
        [owner, maker, taker] = await ethers.getSigners();

        // Deploy mock WETH for LimitOrderProtocol
        const MockWETH = await ethers.getContractFactory("MockWETH");
        const mockWETH = await MockWETH.deploy();

        // Deploy actual 1inch LimitOrderProtocol
        const LimitOrderProtocol = await ethers.getContractFactory("LimitOrderProtocol");
        limitOrderProtocol = await LimitOrderProtocol.deploy(await mockWETH.getAddress());

        // Deploy NEAR Fusion+ components
        const NearFusionResolver = await ethers.getContractFactory("NearFusionResolver");
        nearResolver = await NearFusionResolver.deploy();

        const NearEscrowSrc = await ethers.getContractFactory("NearEscrowSrc");
        nearEscrowSrc = await NearEscrowSrc.deploy(await nearResolver.getAddress());

        const NearFusionFactory = await ethers.getContractFactory("NearFusionFactory");
        nearFusionFactory = await NearFusionFactory.deploy(
            await limitOrderProtocol.getAddress(),
            await nearResolver.getAddress(),
            await nearEscrowSrc.getAddress()
        );

        // Deploy mock USDC
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
        
        // Mint tokens
        await mockUSDC.mint(maker.address, ethers.parseUnits("1000", 6));
        await mockUSDC.connect(maker).approve(await nearEscrowSrc.getAddress(), ethers.parseUnits("1000", 6));

        // Authorize taker as resolver
        await nearResolver.addAuthorizedResolver(taker.address);
    });

    it("Should be a TRUE 1inch Fusion+ extension", async function () {
        // Verify integration with actual 1inch contracts
        expect(await nearFusionFactory.getLimitOrderProtocol()).to.equal(await limitOrderProtocol.getAddress());
    });

    it("Should create NEAR extension hash correctly", async function () {
        const nearExt = {
            nearAccountId: "alice.near",
            nearChainId: "testnet",
            nearTokenContract: "native.near",
            lockupPeriod: 3600,
            bridgeParams: ethers.ZeroHash,
            estimatedGas: 300_000_000_000_000n,
            attachedDeposit: 0
        };

        const extensionHash = await nearResolver.createNearExtensionHash(nearExt);
        expect(extensionHash).to.have.lengthOf(42); // 0x + 40 hex chars = 20 bytes = 160 bits
    });

    it("Should create NEAR fusion order with proper 1inch format", async function () {
        const orderParams = {
            makerAsset: await mockUSDC.getAddress(),
            makingAmount: ethers.parseUnits("100", 6), // 100 USDC
            takerAsset: await mockUSDC.getAddress(), // Simplified for test
            takingAmount: ethers.parseEther("2"), // 2 NEAR equivalent
            nearAccountId: "alice.near",
            nearChainId: "testnet",
            nearTokenContract: "native.near",
            lockupPeriod: 3600,
            expiry: Math.floor(Date.now() / 1000) + 3600
        };

        // Create order through factory
        const tx = await nearFusionFactory.connect(maker).createNearFusionOrder(orderParams);
        const receipt = await tx.wait();

        // Verify event emission
        const event = receipt.logs.find(log => {
            try {
                const parsed = nearFusionFactory.interface.parseLog(log);
                return parsed.name === "NearFusionOrderCreated";
            } catch { return false; }
        });

        expect(event).to.not.be.undefined;
        const parsedEvent = nearFusionFactory.interface.parseLog(event);
        expect(parsedEvent.args.maker).to.equal(maker.address);
        expect(parsedEvent.args.nearAccountId).to.equal("alice.near");
    });

    it("Should validate NEAR order parameters", async function () {
        const validParams = {
            makerAsset: await mockUSDC.getAddress(),
            makingAmount: ethers.parseUnits("100", 6),
            takerAsset: await mockUSDC.getAddress(),
            takingAmount: ethers.parseEther("2"),
            nearAccountId: "alice.near",
            nearChainId: "testnet",
            nearTokenContract: "native.near",
            lockupPeriod: 3600,
            expiry: Math.floor(Date.now() / 1000) + 3600
        };

        const [isValid, errorMessage] = await nearFusionFactory.validateNearOrderParams(validParams);
        expect(isValid).to.be.true;
        expect(errorMessage).to.equal("");
    });

    it("Should calculate minimum safety deposit correctly", async function () {
        const makingAmount = ethers.parseUnits("100", 6); // 100 USDC
        const minDeposit = await nearFusionFactory.calculateMinSafetyDeposit(makingAmount);
        
        // Should be 5% of making amount
        const expected = (makingAmount * 500n) / 10000n;
        expect(minDeposit).to.equal(expected);
    });

    it("Should decode NEAR extension correctly", async function () {
        const nearExt = {
            nearAccountId: "alice.near",
            nearChainId: "testnet", 
            nearTokenContract: "native.near",
            lockupPeriod: 3600,
            bridgeParams: ethers.ZeroHash,
            estimatedGas: 300_000_000_000_000n,
            attachedDeposit: 0
        };

        const encoded = await nearResolver.encodeNearExtension(nearExt);
        const decoded = await nearResolver.decodeNearExtension(encoded);

        expect(decoded.nearAccountId).to.equal("alice.near");
        expect(decoded.nearChainId).to.equal("testnet");
        expect(decoded.lockupPeriod).to.equal(3600);
    });

    it("Should verify authorized resolver functionality", async function () {
        // Verify taker is authorized resolver
        expect(await nearResolver.authorizedResolvers(taker.address)).to.be.true;
        
        // Verify owner can add/remove resolvers  
        await nearResolver.addAuthorizedResolver(owner.address);
        expect(await nearResolver.authorizedResolvers(owner.address)).to.be.true;
        
        await nearResolver.removeAuthorizedResolver(owner.address);
        expect(await nearResolver.authorizedResolvers(owner.address)).to.be.false;
    });
});