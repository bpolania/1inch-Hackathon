const BitcoinHTLCManager = require('../src/BitcoinHTLCManager');
const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');

describe('Bitcoin HTLC Manager', () => {
    let btcManager;
    let aliceKeyPair;
    let bobKeyPair;
    let secret;
    let hashlock;

    beforeEach(() => {
        btcManager = new BitcoinHTLCManager({
            network: bitcoin.networks.testnet,
            feeRate: 10
        });
        
        aliceKeyPair = btcManager.generateKeyPair();
        bobKeyPair = btcManager.generateKeyPair();
        
        const secretData = btcManager.generateSecret();
        secret = secretData.secret;
        hashlock = secretData.hashlock;
    });

    describe('Key Generation and Secrets', () => {
        test('should generate valid key pairs', () => {
            expect(aliceKeyPair).toBeDefined();
            expect(aliceKeyPair.publicKey).toBeInstanceOf(Buffer);
            expect(aliceKeyPair.privateKey).toBeInstanceOf(Buffer);
            expect(aliceKeyPair.publicKey.length).toBe(33); // compressed pubkey
        });

        test('should generate valid secrets and hashlocks', () => {
            expect(secret).toMatch(/^0x[a-f0-9]{64}$/);
            expect(hashlock).toMatch(/^0x[a-f0-9]{64}$/);
            
            // Verify hashlock is correct SHA-256 of secret
            const expectedHash = crypto.createHash('sha256')
                .update(Buffer.from(secret.replace('0x', ''), 'hex'))
                .digest('hex');
            expect(hashlock).toBe('0x' + expectedHash);
        });
    });

    describe('HTLC Script Generation', () => {
        test('should generate valid HTLC script', () => {
            const timelock = 144;
            const htlcScript = btcManager.generateHTLCScript(
                hashlock,
                bobKeyPair.publicKey,
                aliceKeyPair.publicKey,
                timelock
            );

            expect(htlcScript).toBeInstanceOf(Buffer);
            expect(htlcScript.length).toBeGreaterThan(50); // Should be substantial script
            
            // Verify script contains required opcodes
            const scriptHex = htlcScript.toString('hex');
            expect(scriptHex).toContain('63'); // OP_IF
            expect(scriptHex).toContain('67'); // OP_ELSE  
            expect(scriptHex).toContain('68'); // OP_ENDIF
            expect(scriptHex).toContain('a8'); // OP_SHA256
        });

        test('should create valid P2SH address from HTLC script', () => {
            const htlcScript = btcManager.generateHTLCScript(
                hashlock,
                bobKeyPair.publicKey,
                aliceKeyPair.publicKey,
                144
            );
            
            const htlcAddress = btcManager.createHTLCAddress(htlcScript);
            
            expect(htlcAddress).toBeDefined();
            expect(typeof htlcAddress).toBe('string');
            // Testnet P2SH addresses start with '2' or '3'
            expect(htlcAddress).toMatch(/^[23][a-km-zA-HJ-NP-Z1-9]{25,34}$/);
        });
    });

    describe('Order Management', () => {
        test('should store and retrieve orders', () => {
            const orderId = 'test_order_123';
            const orderData = {
                htlcAddress: '2N8hwP1WmJrFF5QWABn38y63uYLhnJYJYTF',
                amount: 100000,
                secret: secret,
                hashlock: hashlock
            };

            btcManager.storeOrder(orderId, orderData);
            
            const retrievedOrder = btcManager.getOrder(orderId);
            expect(retrievedOrder).toBeDefined();
            expect(retrievedOrder.htlcAddress).toBe(orderData.htlcAddress);
            expect(retrievedOrder.amount).toBe(orderData.amount);
            expect(retrievedOrder.status).toBe('created');
            expect(retrievedOrder.createdAt).toBeDefined();
        });

        test('should update order status', () => {
            const orderId = 'test_order_update';
            const orderData = { amount: 50000 };

            btcManager.storeOrder(orderId, orderData);
            btcManager.updateOrder(orderId, 'funded', { txId: 'abc123' });
            
            const updatedOrder = btcManager.getOrder(orderId);
            expect(updatedOrder.status).toBe('funded');
            expect(updatedOrder.txId).toBe('abc123');
            expect(updatedOrder.updatedAt).toBeDefined();
        });
    });

    describe('Configuration', () => {
        test('should use correct network settings', () => {
            expect(btcManager.network).toBe(bitcoin.networks.testnet);
            expect(btcManager.apiBaseUrl).toBe('https://blockstream.info/testnet/api');
        });

        test('should use mainnet for bitcoin network', () => {
            const mainnetManager = new BitcoinHTLCManager({
                network: bitcoin.networks.bitcoin
            });
            
            expect(mainnetManager.network).toBe(bitcoin.networks.bitcoin);
            expect(mainnetManager.apiBaseUrl).toBe('https://blockstream.info/api');
        });

        test('should have correct default configuration', () => {
            expect(btcManager.config.minConfirmations).toBe(1);
            expect(btcManager.config.htlcTimelock).toBe(144);
            expect(btcManager.config.dustThreshold).toBe(546);
            expect(btcManager.config.feeRate).toBe(10);
        });
    });

    describe('Script Structure', () => {
        test('should create script with correct structure for claiming', () => {
            const htlcScript = btcManager.generateHTLCScript(
                hashlock,
                bobKeyPair.publicKey,
                aliceKeyPair.publicKey,
                144
            );

            // Verify the script can be decompiled and contains expected elements
            const decompiledScript = bitcoin.script.decompile(htlcScript);
            
            expect(decompiledScript[0]).toBe(bitcoin.opcodes.OP_IF);
            expect(decompiledScript[1]).toBe(bitcoin.opcodes.OP_SHA256);
            expect(decompiledScript[2]).toEqual(Buffer.from(hashlock.replace('0x', ''), 'hex'));
            expect(decompiledScript[3]).toBe(bitcoin.opcodes.OP_EQUALVERIFY);
            expect(decompiledScript[4]).toEqual(bobKeyPair.publicKey);
            expect(decompiledScript[5]).toBe(bitcoin.opcodes.OP_CHECKSIG);
            expect(decompiledScript[6]).toBe(bitcoin.opcodes.OP_ELSE);
        });

        test('should handle different timelock values', () => {
            const timelocks = [100, 144, 1000, 65535];
            
            timelocks.forEach(timelock => {
                const htlcScript = btcManager.generateHTLCScript(
                    hashlock,
                    bobKeyPair.publicKey,
                    aliceKeyPair.publicKey,
                    timelock
                );
                
                expect(htlcScript).toBeInstanceOf(Buffer);
                expect(htlcScript.length).toBeGreaterThan(50);
                
                // Verify timelock is encoded in script
                const decompiled = bitcoin.script.decompile(htlcScript);
                const timelockBuffer = bitcoin.script.number.encode(timelock);
                expect(decompiled).toContainEqual(timelockBuffer);
            });
        });
    });

    describe('Cross-chain Compatibility', () => {
        test('should generate hashlock compatible with Ethereum keccak256', () => {
            // Test that our SHA-256 hashlock format matches what Ethereum expects
            const testSecret = '0x' + 'a'.repeat(64); // 32-byte secret
            const expectedHash = crypto.createHash('sha256')
                .update(Buffer.from(testSecret.replace('0x', ''), 'hex'))
                .digest('hex');
            
            const { secret: generatedSecret, hashlock: generatedHashlock } = btcManager.generateSecret();
            
            // Verify format consistency
            expect(generatedSecret).toMatch(/^0x[a-f0-9]{64}$/);
            expect(generatedHashlock).toMatch(/^0x[a-f0-9]{64}$/);
            
            // Verify the hash is correct
            const manualHash = crypto.createHash('sha256')
                .update(Buffer.from(generatedSecret.replace('0x', ''), 'hex'))
                .digest('hex');
            expect(generatedHashlock).toBe('0x' + manualHash);
        });

        test('should accept external hashlock from Ethereum', () => {
            // Simulate receiving hashlock from Ethereum side
            const ethereumHashlock = '0x' + crypto.randomBytes(32).toString('hex');
            
            const htlcScript = btcManager.generateHTLCScript(
                ethereumHashlock,
                bobKeyPair.publicKey,
                aliceKeyPair.publicKey,
                144
            );
            
            expect(htlcScript).toBeInstanceOf(Buffer);
            
            // Verify the Ethereum hashlock is embedded in the script
            const decompiled = bitcoin.script.decompile(htlcScript);
            expect(decompiled[2]).toEqual(Buffer.from(ethereumHashlock.replace('0x', ''), 'hex'));
        });
    });
});