/**
 * API Integration Tests
 * Tests the REST API endpoints for contracts, alerts, and stats
 */

const API_URL = 'http://localhost:3000';

// Test utilities
async function testEndpoint(name, method, url, body = null, expectedStatus = 200) {
    console.log(`\n🧪 Testing: ${name}`);

    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_URL}${url}`, options);
        const data = await response.json();

        if (response.status === expectedStatus) {
            console.log(`✅ PASS - Status: ${response.status}`);
            console.log(`   Response:`, JSON.stringify(data, null, 2).substring(0, 200));
            return { success: true, data };
        } else {
            console.log(`❌ FAIL - Expected ${expectedStatus}, got ${response.status}`);
            console.log(`   Response:`, data);
            return { success: false, data };
        }
    } catch (error) {
        console.log(`❌ ERROR - ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Test suite
async function runTests() {
    console.log('🚀 ChainGuard API Test Suite\n');
    console.log(`📍 API URL: ${API_URL}\n`);

    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };

    // Test 1: Health Check
    let result = await testEndpoint(
        'Health Check',
        'GET',
        '/health'
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 2: Get Stats (empty database)
    result = await testEndpoint(
        'Get Dashboard Stats',
        'GET',
        '/api/stats'
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 3: List Contracts (empty)
    result = await testEndpoint(
        'List Contracts (empty)',
        'GET',
        '/api/contracts'
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 4: Add Contract
    const testContract = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        name: 'Test DeFi Vault'
    };

    result = await testEndpoint(
        'Add Contract',
        'POST',
        '/api/contracts',
        testContract,
        201
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 5: List Contracts (with data)
    result = await testEndpoint(
        'List Contracts (with data)',
        'GET',
        '/api/contracts'
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 6: Get Contract Details
    result = await testEndpoint(
        'Get Contract Details',
        'GET',
        `/api/contracts/${testContract.address}`
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 7: Add Duplicate Contract (should fail)
    result = await testEndpoint(
        'Add Duplicate Contract (should fail)',
        'POST',
        '/api/contracts',
        testContract,
        409
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 8: Add Invalid Address (should fail)
    result = await testEndpoint(
        'Add Invalid Address (should fail)',
        'POST',
        '/api/contracts',
        { address: 'invalid', name: 'Test' },
        400
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 9: List Alerts (empty)
    result = await testEndpoint(
        'List Alerts (empty)',
        'GET',
        '/api/alerts'
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 10: List Alerts with Filter
    result = await testEndpoint(
        'List Alerts (filtered by severity)',
        'GET',
        '/api/alerts?severity=CRITICAL'
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 11: Delete Contract
    result = await testEndpoint(
        'Delete Contract',
        'DELETE',
        `/api/contracts/${testContract.address}`
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Test 12: Get Deleted Contract (should fail)
    result = await testEndpoint(
        'Get Deleted Contract (should fail)',
        'GET',
        `/api/contracts/${testContract.address}`,
        null,
        404
    );
    results.total++;
    if (result.success) results.passed++; else results.failed++;

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Passed: ${results.passed}/${results.total}`);
    console.log(`❌ Failed: ${results.failed}/${results.total}`);
    console.log(`🎯 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%\n`);
    console.log('='.repeat(80));

    process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
