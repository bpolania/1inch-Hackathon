#!/usr/bin/env node

/**
 * Create Live Bitcoin Atomic Swap Order
 * 
 * Creates a real 1inch Fusion+ order on Ethereum Sepolia with Bitcoin as destination
 */

const { ethers } = require('ethers');
const fs = require('fs');
const crypto = require('crypto');

// Contract ABIs
const FACTORY_ABI = [
    "function createFusionOrder((address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,(bytes,bytes,uint256,bytes),bytes32)) external returns (bytes32)",
    "function getOrder(bytes32) external view returns (bool,uint256,bytes32,address,address)",
    "event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, uint256 dstChainId, uint256 srcAmount)"
];

const ERC20_ABI = [
    "function approve(address,uint256) external returns (bool)",
    "function balanceOf(address) external view returns (uint256)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
];

const BITCOIN_ADAPTER_ABI = [
    "function encodeExecutionParams(string,uint256,uint256) external pure returns (bytes)",
    "function calculateMinSafetyDeposit(uint256) external pure returns (uint256)",
    "function validateDestinationAddress(bytes) external pure returns (bool)"
];

async function createLiveBitcoinOrder() {
    console.log('₿ Create Live Bitcoin Atomic Swap Order');
    console.log('=======================================\\n');
    
    try {
        // 1. Load Bitcoin wallet
        const walletFile = '../bitcoin/bitcoin-testnet-wallet.json';
        if (!fs.existsSync(walletFile)) {
            throw new Error('Bitcoin wallet not found. Run setup-live-testnet.js first.');
        }
        
        const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
        console.log('✅ Bitcoin wallet loaded');
        
        // 2. Connect to Ethereum
        const ETHEREUM_PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY || '3a7bb163d352f1c19c2fcd439e3dc70568efa4efb5163d8209084fcbfd531d47';
        const RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu';
        
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(ETHEREUM_PRIVATE_KEY, provider);
        
        console.log(`🔗 Connected to Ethereum Sepolia`);
        console.log(`💰 Ethereum wallet: ${signer.address}`);
        
        const ethBalance = await provider.getBalance(signer.address);
        console.log(`💎 ETH Balance: ${ethers.formatEther(ethBalance)} ETH\\n`);
        
        // 3. Initialize contracts (newer factory with Bitcoin support)
        const FACTORY_ADDRESS = '0xbeEab741D2869404FcB747057f5AbdEffc3A138d';
        const TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
        const BITCOIN_ADAPTER = '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8'; // Bitcoin testnet adapter
        
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        const bitcoinAdapter = new ethers.Contract(BITCOIN_ADAPTER, BITCOIN_ADAPTER_ABI, signer);
        
        console.log('📋 Contracts initialized');
        console.log(`🏭 Factory: ${FACTORY_ADDRESS}`);
        console.log(`🪙 Token: ${TOKEN_ADDRESS}`);
        console.log(`₿ Bitcoin Adapter: ${BITCOIN_ADAPTER}\\n`);
        
        // 4. Check token balance
        const tokenBalance = await token.balanceOf(signer.address);
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        
        console.log(`🪙 ${symbol} Balance: ${ethers.formatUnits(tokenBalance, decimals)} ${symbol}`);
        
        if (tokenBalance === 0n) {
            throw new Error(`No ${symbol} tokens available. Please mint some tokens first.`);
        }
        
        // 5. Generate atomic swap parameters
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        
        console.log('\\n🔐 Atomic Swap Parameters:');
        console.log(`   Secret: 0x${secret.toString('hex')}`);
        console.log(`   Hashlock: ${hashlock}`);
        
        // 6. Bitcoin destination parameters
        // Use one of our generated Bitcoin addresses
        const btcAddress = 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc'; // Our segwit address
        const htlcTimelock = 144; // ~24 hours in blocks
        const feeRate = 10; // sat/byte
        const dstChainId = 40004; // Bitcoin testnet
        
        console.log('\\n₿ Bitcoin Parameters:');
        console.log(`   Destination: ${btcAddress}`);
        console.log(`   HTLC Timelock: ${htlcTimelock} blocks`);
        console.log(`   Fee Rate: ${feeRate} sat/byte`);
        console.log(`   Chain ID: ${dstChainId} (Bitcoin Testnet)`);
        
        // 7. Validate Bitcoin address
        const isValidAddress = await bitcoinAdapter.validateDestinationAddress(
            ethers.toUtf8Bytes(btcAddress)
        );
        
        if (!isValidAddress) {
            throw new Error(`Invalid Bitcoin address: ${btcAddress}`);
        }
        console.log('   ✅ Address validation: PASSED');
        
        // 8. Encode Bitcoin execution parameters
        const executionParams = await bitcoinAdapter.encodeExecutionParams(
            btcAddress,
            htlcTimelock,
            feeRate
        );
        
        console.log(`   📦 Encoded params: ${executionParams}`);
        
        // 9. Calculate amounts and safety deposit (matching working NEAR order)
        const sourceAmount = ethers.parseEther('0.2'); // 0.2 DT (same as NEAR)
        const destinationAmount = 200000; // 200,000 satoshis (0.002 BTC)
        const resolverFee = ethers.parseEther('0.02'); // 0.02 DT (10%)
        
        const safetyDeposit = await bitcoinAdapter.calculateMinSafetyDeposit(sourceAmount);
        
        console.log('\\n💰 Swap Details:');
        console.log(`   Source: ${ethers.formatEther(sourceAmount)} ${symbol}`);
        console.log(`   Destination: ${destinationAmount} satoshis (${destinationAmount/100000000} BTC)`);
        console.log(`   Resolver Fee: ${ethers.formatEther(resolverFee)} ${symbol}`);
        console.log(`   Safety Deposit: ${ethers.formatEther(safetyDeposit)} ETH`);
        
        // 10. Check if we have enough ETH for safety deposit
        if (ethBalance < safetyDeposit) {
            throw new Error(`Insufficient ETH for safety deposit. Need ${ethers.formatEther(safetyDeposit)} ETH`);
        }
        
        // 11. Approve tokens
        console.log('\\n🔐 Approving tokens...');
        const approveTx = await token.approve(FACTORY_ADDRESS, sourceAmount);
        await approveTx.wait();
        console.log(`✅ Tokens approved: ${approveTx.hash}`);
        
        // 12. Create order parameters (matching the working NEAR format)
        const expiryTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        
        const orderParams = {
            sourceToken: TOKEN_ADDRESS,
            sourceAmount: sourceAmount,
            destinationChainId: dstChainId,
            destinationToken: ethers.toUtf8Bytes('BTC'),
            destinationAmount: destinationAmount,
            destinationAddress: ethers.toUtf8Bytes(btcAddress),
            resolverFeeAmount: resolverFee,
            expiryTime: expiryTime,
            hashlock: hashlock,
            chainParams: {
                destinationAddress: ethers.toUtf8Bytes(btcAddress),
                executionParams: ethers.toUtf8Bytes(""), // Empty like NEAR
                estimatedGas: 300_000_000_000_000n, // Large gas like NEAR
                additionalData: hashlock // Use hashlock as additional data like NEAR
            }
        };
        
        console.log('\\n🚀 Creating Bitcoin Fusion+ Order...');
        console.log(`   Expiry: ${new Date(expiryTime * 1000).toISOString()}`);
        
        // 13. Create the order
        const createOrderTx = await factory.createFusionOrder([
            orderParams.sourceToken,
            orderParams.sourceAmount,
            orderParams.destinationChainId,
            orderParams.destinationToken,
            orderParams.destinationAmount,
            orderParams.destinationAddress,
            orderParams.resolverFeeAmount,
            orderParams.expiryTime,
            [
                orderParams.chainParams.destinationAddress,
                orderParams.chainParams.executionParams,
                orderParams.chainParams.estimatedGas,
                orderParams.chainParams.additionalData
            ],
            orderParams.hashlock
        ], {
            value: safetyDeposit
        });
        
        console.log(`📝 Transaction submitted: ${createOrderTx.hash}`);
        console.log('⏳ Waiting for confirmation...');
        
        const receipt = await createOrderTx.wait();
        console.log(`✅ Order created in block: ${receipt.blockNumber}`);
        
        // 14. Extract order hash from events
        const orderCreatedEvent = receipt.logs.find(log => {
            try {
                const parsed = factory.interface.parseLog(log);
                return parsed.name === 'FusionOrderCreated';
            } catch {
                return false;
            }
        });
        
        let orderHash;
        if (orderCreatedEvent) {
            const parsed = factory.interface.parseLog(orderCreatedEvent);
            orderHash = parsed.args.orderHash;
            console.log(`📋 Order Hash: ${orderHash}`);
        } else {
            // Calculate order hash manually if event parsing fails
            orderHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256', 'bytes32'],
                [signer.address, sourceAmount, dstChainId, hashlock]
            ));
            console.log(`📋 Calculated Order Hash: ${orderHash}`);
        }
        
        // 15. Verify order creation
        const order = await factory.getOrder(orderHash);
        console.log('\\n📊 Order Verification:');
        console.log(`   Active: ${order[0]}`);
        console.log(`   Expiry: ${new Date(Number(order[1]) * 1000).toISOString()}`);
        console.log(`   Hashlock: ${order[2]}`);
        console.log(`   Maker: ${order[3]}`);
        console.log(`   Resolver: ${order[4]}`);
        
        // 16. Save order info for next steps
        const orderInfo = {
            orderHash,
            secret: secret.toString('hex'),
            hashlock,
            btcAddress,
            sourceAmount: sourceAmount.toString(),
            destinationAmount,
            expiryTime,
            transactionHash: createOrderTx.hash,
            blockNumber: receipt.blockNumber,
            created: new Date().toISOString()
        };
        
        fs.writeFileSync('../bitcoin/live-bitcoin-order.json', JSON.stringify(orderInfo, null, 2));
        console.log('\\n💾 Order information saved to live-bitcoin-order.json');
        
        // 17. Summary
        console.log('\\n🎉 Bitcoin Atomic Swap Order Created Successfully!');
        console.log('==================================================');
        console.log(`📋 Order Hash: ${orderHash}`);
        console.log(`💰 Amount: ${ethers.formatEther(sourceAmount)} ${symbol} → ${destinationAmount} satoshis`);
        console.log(`₿ Bitcoin Address: ${btcAddress}`);
        console.log(`🔐 Secret: 0x${secret.toString('hex')}`);
        console.log(`🔒 Hashlock: ${hashlock}`);
        console.log(`⏰ Expires: ${new Date(expiryTime * 1000).toISOString()}`);
        console.log(`🔗 Transaction: https://sepolia.etherscan.io/tx/${createOrderTx.hash}`);
        console.log('');
        console.log('🚀 Next Steps:');
        console.log('1. Wait for Bitcoin testnet funding');
        console.log('2. Run Bitcoin HTLC funding script');
        console.log('3. Complete atomic swap execution');
        
        return orderInfo;
        
    } catch (error) {
        console.error('❌ Failed to create Bitcoin order:', error.message);
        if (error.data) {
            console.error('Error data:', error.data);
        }
        return null;
    }
}

if (require.main === module) {
    createLiveBitcoinOrder().then(result => {
        process.exit(result ? 0 : 1);
    });
}

module.exports = { createLiveBitcoinOrder };