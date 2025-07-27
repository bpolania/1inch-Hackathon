const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking Token Balances After Demo");
    console.log("====================================");

    const tokenAddress = "0xeB17922014545aeF282d1d13bf153e5c12C7F682";
    const walletAddress = "0x04e7B48DD6D9f33ffD1A7Be63fF91e6F318492ed";
    const factoryAddress = "0x065357440984Eb0BCC1b610A76b388B367D4e1f0";

    // Get token contract
    const token = await ethers.getContractAt("MockERC20", tokenAddress);
    
    // Check balances
    const walletBalance = await token.balanceOf(walletAddress);
    const factoryBalance = await token.balanceOf(factoryAddress);
    
    console.log("📊 Current Balances:");
    console.log(`   Wallet (${walletAddress}): ${ethers.formatEther(walletBalance)} DT`);
    console.log(`   Factory (${factoryAddress}): ${ethers.formatEther(factoryBalance)} DT`);
    
    // Check escrow addresses from demo
    const escrowSrc = "0x7c7878c296aCE16875eEF688A4239100CA2EaeB1";
    const escrowDst = "0xAb267A411B36025ee34034AF77aDB6A879668662";
    
    const escrowSrcBalance = await token.balanceOf(escrowSrc);
    const escrowDstBalance = await token.balanceOf(escrowDst);
    
    console.log(`   Escrow Src (${escrowSrc}): ${ethers.formatEther(escrowSrcBalance)} DT`);
    console.log(`   Escrow Dst (${escrowDst}): ${ethers.formatEther(escrowDstBalance)} DT`);
    
    // Check allowances
    const factoryAllowance = await token.allowance(walletAddress, factoryAddress);
    console.log(`   Factory Allowance: ${ethers.formatEther(factoryAllowance)} DT`);
    
    console.log("");
    console.log("💡 Analysis:");
    if (walletBalance == ethers.parseEther("1000")) {
        console.log("   ⚠️  Wallet still has 1000 DT - tokens were NOT transferred");
        console.log("   🔧 This suggests the escrow transfer failed or wasn't implemented");
    } else {
        console.log("   ✅ Tokens were successfully transferred from wallet");
    }
    
    const totalEscrow = escrowSrcBalance + escrowDstBalance;
    if (totalEscrow > 0) {
        console.log(`   ✅ ${ethers.formatEther(totalEscrow)} DT found in escrow contracts`);
    } else {
        console.log("   ⚠️  No tokens found in escrow contracts");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });