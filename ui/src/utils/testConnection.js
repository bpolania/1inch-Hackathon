/**
 * Simple connection test utility
 * Tests if the UI can connect to the API Gateway
 */

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3001';

async function testAPIGatewayConnection() {
  console.log(' Testing API Gateway connection...');
  
  try {
    // Test root endpoint
    const response = await fetch(`${API_GATEWAY_URL}/`);
    const data = await response.json();
    
    console.log(' API Gateway root endpoint:', {
      status: response.status,
      name: data.name,
      version: data.version,
      services: data.services
    });

    // Test health endpoint
    const healthResponse = await fetch(`${API_GATEWAY_URL}/api/health`);
    const healthData = await healthResponse.json();
    
    console.log(' Health endpoint:', {
      status: healthResponse.status,
      health: healthData.status,
      uptime: healthData.uptime
    });

    // Test TEE status
    const teeResponse = await fetch(`${API_GATEWAY_URL}/api/tee/status`);
    const teeData = await teeResponse.json();
    
    console.log(' TEE status:', {
      status: teeResponse.status,
      isHealthy: teeData.isHealthy,
      attestation: teeData.attestation
    });

    // Test Relayer status
    const relayerResponse = await fetch(`${API_GATEWAY_URL}/api/relayer/status`);
    const relayerData = await relayerResponse.json();
    
    console.log(' Relayer status:', {
      status: relayerResponse.status,
      isHealthy: relayerData.isHealthy,
      services: relayerData.status
    });

    return true;
  } catch (error) {
    console.error(' API Gateway connection failed:', error);
    return false;
  }
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testAPIGatewayConnection();
}

export { testAPIGatewayConnection };