#!/usr/bin/env node

/**
 * Create Bitcoin Order - Production Script
 * 
 * Creates a Bitcoin order on Ethereum using 1inch Fusion+ factory
 * Consolidated from multiple order creation scripts
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

async function createBitcoinOrder(options = {}) {
    const {
        sourceAmount = '0.01',        // DT tokens to swap
        destinationAmount = 10000,    // Satoshis to receive
        chainId = 40004,             // Bitcoin testnet
        timeoutHours = 24            // Order expiry
    } = options;

    console.log(' Create Bitcoin Order');
    console.log('====================\n');
    
    try {
        // Setup using environment variables
        const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
        const privateKey = process.env.FACTORY_OWNER_PRIVATE_KEY || process.env.ETHEREUM_PRIVATE_KEY;
        
        if (!privateKey) {
            throw new Error('No private key found in environment variables. Set ETHEREUM_PRIVATE_KEY or FACTORY_OWNER_PRIVATE_KEY in .env file');
        }
        
        const signer = new ethers.Wallet(privateKey, provider);
        
        const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
        const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
        
        if (!FACTORY_ADDRESS || !TOKEN_ADDRESS) {
            throw new Error('FACTORY_ADDRESS and TOKEN_ADDRESS must be set in .env file');
        }
        
        const FACTORY_ABI = [
            "function createFusionOrder((address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,(bytes,bytes,uint256,bytes),bytes32)) external returns (bytes32)",
            "event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, uint256 dstChainId, uint256 srcAmount)"
        ];
        
        const ERC20_ABI = [
            "function approve(address,uint256) external returns (bool)",
            "function balanceOf(address) external view returns (uint256)",
            "function symbol() external view returns (string)"
        ];
        
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        
        console.log(' Connected to Ethereum Sepolia');
        console.log(`   Factory: ${FACTORY_ADDRESS}`);
        console.log(`   Token: ${TOKEN_ADDRESS}`);
        console.log(`   Wallet: ${signer.address}\n`);
        
        // Check balance
        const tokenBalance = await token.balanceOf(signer.address);
        const symbol = await token.symbol();
        console.log(` ${symbol} balance: ${ethers.formatEther(tokenBalance)} ${symbol}`);
        
        const sourceAmountWei = ethers.parseEther(sourceAmount);
        if (tokenBalance < sourceAmountWei) {
            throw new Error(`Insufficient ${symbol} balance. Need ${sourceAmount}, have ${ethers.formatEther(tokenBalance)}`);
        }
        
        // Generate order parameters
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const nonce = crypto.randomBytes(8);
        const expiryTime = Math.floor(Date.now() / 1000) + (timeoutHours * 3600);
        
        console.log('\n Order Parameters:');
        console.log(`   Source: ${sourceAmount} ${symbol}`);
        console.log(`   Destination: ${destinationAmount} satoshis`);
        console.log(`   Chain ID: ${chainId} (Bitcoin ${chainId === 40003 ? 'Mainnet' : 'Testnet'})`);
        console.log(`   Expiry: ${new Date(expiryTime * 1000).toISOString()}`);
        console.log(`   Secret: 0x${secret.toString('hex')}`);
        console.log(`   Hashlock: ${hashlock}\n`);
        
        // Token approval
        console.log(' Approving tokens...');
        const approveTx = await token.approve(FACTORY_ADDRESS, sourceAmountWei);
        await approveTx.wait();
        console.log(` Token approval: ${approveTx.hash}\n`);
        
        // Create order structure
        const orderParams = [
            signer.address,                    // maker
            TOKEN_ADDRESS,                     // srcToken
            sourceAmountWei,                   // srcAmount
            '0x',                             // srcPermit
            chainId,                          // dstChainId
            ethers.solidityPacked(['uint256'], [destinationAmount]), // dstExecutionParams
            0,                                // dstMinSafetyDeposit
            expiryTime,                       // expiryTime
            [                                 // extension
                nonce,                        // nonce
                '0x',                         // auctionDetails
                0,                            // externalAccount
                '0x'                          // externalCalldata
            ],
            hashlock                          // hashlock
        ];
        
        // Estimate gas
        console.log(' Estimating gas...');
        const gasEstimate = await factory.createFusionOrder.estimateGas(orderParams);
        console.log(`   Gas estimate: ${gasEstimate.toString()}`);
        
        // Create order
        console.log(' Creating Bitcoin order...');
        const createTx = await factory.createFusionOrder(orderParams, {
            gasLimit: gasEstimate * 12n / 10n // 20% buffer
        });
        
        console.log(` Transaction hash: ${createTx.hash}`);
        console.log(' Waiting for confirmation...');
        
        const receipt = await createTx.wait();
        console.log(` Order created! Block: ${receipt.blockNumber}`);
        
        // Extract order hash from events
        let orderHash = null;
        for (const log of receipt.logs) {
            try {
                const parsed = factory.interface.parseLog(log);
                if (parsed.name === 'FusionOrderCreated') {
                    orderHash = parsed.args.orderHash;
                    break;
                }
            } catch (e) {
                // Skip unparseable logs
            }
        }
        
        // Save order details
        const orderInfo = {
            timestamp: new Date().toISOString(),
            transactionHash: createTx.hash,
            blockNumber: receipt.blockNumber,
            orderHash: orderHash,
            sourceAmount: sourceAmount,
            destinationAmount: destinationAmount,
            chainId: chainId,
            expiryTime: expiryTime,
            secret: secret.toString('hex'),
            hashlock: hashlock,
            maker: signer.address,
            factory: FACTORY_ADDRESS,
            token: TOKEN_ADDRESS,
            gasUsed: receipt.gasUsed.toString(),
            status: 'order-created'
        };
        
        const filename = `bitcoin-order-${Date.now()}.json`;
        fs.writeFileSync(`./${filename}`, JSON.stringify(orderInfo, null, 2));
        
        console.log('\n BITCOIN ORDER CREATED SUCCESSFULLY!');
        console.log('=====================================');
        console.log(` Order Hash: ${orderHash}`);
        console.log(` Transaction: https://sepolia.etherscan.io/tx/${createTx.hash}`);
        console.log(` Details saved: ${filename}`);
        console.log(` Secret: 0x${secret.toString('hex')}`);
        console.log(` Hashlock: ${hashlock}`);
        console.log('');
        console.log('Next steps:');
        console.log('1. Generate Bitcoin HTLC using the secret/hashlock');
        console.log('2. Fund the Bitcoin HTLC');
        console.log('3. Execute the atomic swap');
        
        return orderInfo;
        
    } catch (error) {
        console.error(` Failed to create Bitcoin order: ${error.message}`);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse CLI arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        
        if (key === 'amount') options.sourceAmount = value;
        if (key === 'satoshis') options.destinationAmount = parseInt(value);
        if (key === 'chain') options.chainId = parseInt(value);
        if (key === 'hours') options.timeoutHours = parseInt(value);
    }
    
    createBitcoinOrder(options).then(orderInfo => {
        console.log('\n Script completed successfully');
        process.exit(0);
    }).catch(error => {
        console.error('\n Script failed:', error.message);
        process.exit(1);
    });
}

module.exports = { createBitcoinOrder };