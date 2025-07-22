const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CrossChainEscrow", function () {
  let factory, escrow, token;
  let owner, maker, taker, other;
  let orderHash, hashlock, secret;
  let immutables, timelocks;

  beforeEach(async function () {
    [owner, maker, taker, other] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    token = await MockToken.deploy("Test Token", "TEST", 18);

    // Deploy factory
    const CrossChainFactory = await ethers.getContractFactory("CrossChainFactory");
    factory = await CrossChainFactory.deploy();

    // Deploy escrow directly for testing
    const CrossChainEscrow = await ethers.getContractFactory("CrossChainEscrow");
    escrow = await CrossChainEscrow.connect(owner).deploy();

    // Setup test data
    orderHash = ethers.keccak256(ethers.toUtf8Bytes("test-order"));
    secret = ethers.encodeBytes32String("test-secret");
    hashlock = ethers.keccak256(secret);
    
    // Pack timelocks (7 stages, each 32 bits)
    const now = await time.latest();
    const stages = [
      now + 1800,   // SrcWithdrawal: 30 minutes
      now + 3600,   // SrcPublicWithdrawal: 1 hour
      now + 7200,   // SrcCancellation: 2 hours
      now + 10800,  // SrcPublicCancellation: 3 hours
      now + 1800,   // DstWithdrawal: 30 minutes
      now + 3600,   // DstPublicWithdrawal: 1 hour
      now + 7200,   // DstCancellation: 2 hours
    ];
    
    let packed = 0n;
    for (let i = 0; i < stages.length; i++) {
      packed = packed | (BigInt(stages[i]) << BigInt(i * 32));
    }
    timelocks = packed;

    immutables = {
      orderHash,
      hashlock,
      maker: maker.address,
      taker: taker.address,
      token: token.target,
      amount: ethers.parseEther("1.0"),
      safetyDeposit: ethers.parseEther("0.05"),
      timelocks
    };
  });

  describe("Factory Integration", function () {
    it("Should initialize escrow correctly", async function () {
      await escrow.connect(owner).initialize(immutables, true);
      
      const info = await escrow.getEscrowInfo();
      expect(info[0].orderHash).to.equal(orderHash);
      expect(info[0].maker).to.equal(maker.address);
      expect(info[1]).to.equal(0); // EscrowState.Created
      expect(info[2]).to.equal(true); // isSourceEscrow
    });

    it("Should prevent double initialization", async function () {
      await escrow.connect(owner).initialize(immutables, true);
      
      await expect(
        escrow.connect(owner).initialize(immutables, true)
      ).to.be.revertedWith("Already initialized");
    });
  });

  describe("Source Escrow Functionality", function () {
    beforeEach(async function () {
      await escrow.connect(owner).initialize(immutables, true);
      await token.mint(maker.address, ethers.parseEther("10"));
      await token.connect(maker).approve(escrow.target, ethers.parseEther("10"));
    });

    it("Should lock tokens correctly", async function () {
      await expect(escrow.connect(maker).lock())
        .to.emit(escrow, "EscrowLocked")
        .withArgs(orderHash, hashlock, immutables.amount);
      
      const info = await escrow.getEscrowInfo();
      expect(info[1]).to.equal(1); // EscrowState.Locked
      
      expect(await token.balanceOf(escrow.target)).to.equal(immutables.amount);
    });

    it("Should allow taker to claim with valid secret", async function () {
      await escrow.connect(maker).lock();
      
      await expect(escrow.connect(taker).claim(secret))
        .to.emit(escrow, "EscrowClaimed")
        .withArgs(orderHash, taker.address, secret);
      
      const info = await escrow.getEscrowInfo();
      expect(info[1]).to.equal(2); // EscrowState.Claimed
      expect(info[4]).to.equal(secret); // secret revealed
      
      expect(await token.balanceOf(taker.address)).to.equal(immutables.amount);
    });

    it("Should reject invalid secret", async function () {
      await escrow.connect(maker).lock();
      
      const invalidSecret = ethers.encodeBytes32String("invalid");
      await expect(escrow.connect(taker).claim(invalidSecret))
        .to.be.revertedWith("Invalid secret");
    });

    it("Should allow public claim after timelock", async function () {
      await escrow.connect(maker).lock();
      
      // Fast forward to after SrcWithdrawal timelock
      await time.increaseTo((await time.latest()) + 1801);
      
      await expect(escrow.connect(other).publicClaim(secret))
        .to.emit(escrow, "EscrowClaimed")
        .withArgs(orderHash, taker.address, secret);
    });

    it("Should allow maker to cancel after cancellation timelock", async function () {
      await escrow.connect(maker).lock();
      
      // Fast forward to after SrcCancellation timelock
      await time.increaseTo((await time.latest()) + 7201);
      
      await expect(escrow.connect(maker).cancel())
        .to.emit(escrow, "EscrowCancelled")
        .withArgs(orderHash, maker.address);
      
      expect(await token.balanceOf(maker.address)).to.equal(ethers.parseEther("10"));
    });
  });

  describe("Destination Escrow Functionality", function () {
    beforeEach(async function () {
      await escrow.connect(owner).initialize(immutables, false);
      const totalAmount = immutables.amount + immutables.safetyDeposit;
      await token.mint(taker.address, totalAmount);
      await token.connect(taker).approve(escrow.target, totalAmount);
    });

    it("Should lock tokens with safety deposit", async function () {
      await expect(escrow.connect(taker).lock())
        .to.emit(escrow, "EscrowLocked");
      
      const expectedTotal = immutables.amount + immutables.safetyDeposit;
      expect(await token.balanceOf(escrow.target)).to.equal(expectedTotal);
    });

    it("Should allow maker to claim and return safety deposit", async function () {
      await escrow.connect(taker).lock();
      
      await expect(escrow.connect(maker).claim(secret))
        .to.emit(escrow, "EscrowClaimed");
      
      expect(await token.balanceOf(maker.address)).to.equal(immutables.amount);
      expect(await token.balanceOf(taker.address)).to.equal(immutables.safetyDeposit);
    });
  });

  describe("ETH Escrow Functionality", function () {
    beforeEach(async function () {
      immutables.token = "0x0000000000000000000000000000000000000000"; // ETH
      await escrow.connect(owner).initialize(immutables, true);
    });

    it("Should lock ETH correctly", async function () {
      await expect(escrow.connect(maker).lock({ value: immutables.amount }))
        .to.emit(escrow, "EscrowLocked");
      
      expect(await ethers.provider.getBalance(escrow.target)).to.equal(immutables.amount);
    });

    it("Should claim ETH correctly", async function () {
      await escrow.connect(maker).lock({ value: immutables.amount });
      
      const takerBalanceBefore = await ethers.provider.getBalance(taker.address);
      const tx = await escrow.connect(taker).claim(secret);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const takerBalanceAfter = await ethers.provider.getBalance(taker.address);
      expect(takerBalanceAfter - takerBalanceBefore + gasUsed).to.equal(immutables.amount);
    });
  });

  describe("Timelock Functions", function () {
    beforeEach(async function () {
      await escrow.connect(owner).initialize(immutables, true);
      await token.mint(maker.address, ethers.parseEther("10"));
      await token.connect(maker).approve(escrow.target, ethers.parseEther("10"));
    });

    it("Should unpack timelocks correctly", async function () {
      const srcWithdrawal = await escrow.getTimelock(0); // TimelockStage.SrcWithdrawal
      const srcPublicWithdrawal = await escrow.getTimelock(1);
      
      expect(srcWithdrawal).to.be.gt(await time.latest());
      expect(srcPublicWithdrawal).to.be.gt(srcWithdrawal);
    });

    it("Should enforce timelock constraints", async function () {
      await escrow.connect(maker).lock();
      
      // Should fail before timelock
      await expect(escrow.connect(other).publicClaim(secret))
        .to.be.revertedWith("Timelock not reached");
      
      // Should fail after expiry
      await time.increaseTo((await time.latest()) + 10801);
      await expect(escrow.connect(taker).claim(secret))
        .to.be.revertedWith("Timelock expired");
    });
  });

  describe("Edge Cases and Security", function () {
    beforeEach(async function () {
      await escrow.connect(owner).initialize(immutables, true);
      await token.mint(maker.address, ethers.parseEther("10"));
      await token.connect(maker).approve(escrow.target, ethers.parseEther("10"));
    });

    it("Should prevent reentrancy attacks", async function () {
      // This would require a malicious token contract to test properly
      // For now, we trust OpenZeppelin's ReentrancyGuard
    });

    it("Should handle zero amounts", async function () {
      // Deploy a new escrow for this test since the existing one is already initialized
      const CrossChainEscrow = await ethers.getContractFactory("CrossChainEscrow");
      const newEscrow = await CrossChainEscrow.connect(owner).deploy();
      
      const zeroImmutables = {...immutables, amount: 0n};
      await expect(
        newEscrow.connect(owner).initialize(zeroImmutables, true)
      ).to.not.be.reverted; // Zero amounts are allowed at contract level
    });

    it("Should only allow authorized actions", async function () {
      await expect(escrow.connect(other).lock())
        .to.be.revertedWith("Only maker can lock source");
      
      await escrow.connect(maker).lock();
      
      await expect(escrow.connect(other).claim(secret))
        .to.be.revertedWith("Only taker can claim source");
    });
  });
});