/**
 * ChainGuard Webhook Test Script
 * Tests the N8N vulnerability validation webhook with sample security findings
 */

const WEBHOOK_URL = 'https://n8n.ironyaditya.xyz/webhook/939ffefe-c76c-4850-9d89-266588d24a9a';

// Test cases for different vulnerability types
const testCases = [
    {
        name: 'Reentrancy - Critical Vulnerability',
        payload: {
            finding: {
                type: 'reentrancy',
                function: 'withdraw',
                line: 15,
                code_snippet: `function withdraw() public {
    uint amount = balances[msg.sender];
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
    balances[msg.sender] = 0;
}`,
                rule_confidence: 90
            },
            contract_context: 'DeFi protocol withdrawal function managing user balances',
            similar_cases: {},
            session_id: 'test-reentrancy-1'
        },
        expectedSeverity: 'CRITICAL',
        expectedValid: true
    },
    {
        name: 'Access Control - False Positive (Protected)',
        payload: {
            finding: {
                type: 'access_control',
                function: 'mint',
                line: 28,
                code_snippet: `function mint(address to, uint256 amount) public onlyOwner {
    _mint(to, amount);
}`,
                rule_confidence: 75
            },
            contract_context: 'ERC20 token with owner-controlled minting using OpenZeppelin Ownable',
            similar_cases: {},
            session_id: 'test-access-control-1'
        },
        expectedSeverity: 'FALSE_POSITIVE',
        expectedValid: false
    },
    {
        name: 'Unchecked Call - High Severity',
        payload: {
            finding: {
                type: 'unchecked_call',
                function: 'sendPayment',
                line: 42,
                code_snippet: `function sendPayment(address recipient, uint amount) public {
    recipient.call{value: amount}("");
    emit PaymentSent(recipient, amount);
}`,
                rule_confidence: 88
            },
            contract_context: 'Payment distribution contract for batch transfers',
            similar_cases: {},
            session_id: 'test-unchecked-call-1'
        },
        expectedSeverity: 'HIGH',
        expectedValid: true
    },
    {
        name: 'Gas Anomaly - Medium Severity',
        payload: {
            finding: {
                type: 'gas_anomaly',
                function: 'processUsers',
                line: 67,
                code_snippet: `function processUsers(address[] memory users) public {
    for (uint i = 0; i < users.length; i++) {
        userBalances[users[i]] = calculateBalance(users[i]);
    }
}`,
                rule_confidence: 65
            },
            contract_context: 'Batch processing function with unbounded loop',
            similar_cases: {
                count: 1,
                examples: [
                    {
                        contract: '0x123abc...',
                        vulnerability: 'gas_anomaly',
                        severity: 'MEDIUM'
                    }
                ]
            },
            session_id: 'test-gas-anomaly-1'
        },
        expectedSeverity: 'MEDIUM',
        expectedValid: true
    },
    {
        name: 'Reentrancy - Protected with nonReentrant',
        payload: {
            finding: {
                type: 'reentrancy',
                function: 'withdraw',
                line: 22,
                code_snippet: `function withdraw() public nonReentrant {
    uint amount = balances[msg.sender];
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
    balances[msg.sender] = 0;
}`,
                rule_confidence: 70
            },
            contract_context: 'Withdrawal function with OpenZeppelin ReentrancyGuard',
            similar_cases: {},
            session_id: 'test-reentrancy-protected-1'
        },
        expectedSeverity: 'FALSE_POSITIVE',
        expectedValid: false
    }
];

/**
 * Send a test request to the webhook
 */
async function sendTestRequest(testCase) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TEST: ${testCase.name}`);
    console.log(`${'='.repeat(80)}\n`);

    console.log('📤 Sending request...');
    console.log('Payload:', JSON.stringify(testCase.payload, null, 2));

    const startTime = Date.now();

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testCase.payload)
        });

        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        console.log('\n✅ Response received');
        console.log(`⏱️  Response time: ${responseTime}ms`);
        console.log('\n📥 Validation Result:');
        console.log(JSON.stringify(result, null, 2));

        // Validate response structure
        const requiredFields = ['valid', 'confidence', 'severity', 'reason', 'recommendation'];
        const missingFields = requiredFields.filter(field => !(field in result));

        if (missingFields.length > 0) {
            console.log(`\n⚠️  Warning: Missing required fields: ${missingFields.join(', ')}`);
        }

        // Check expectations
        console.log('\n🔍 Validation:');

        if (result.valid === testCase.expectedValid) {
            console.log(`✅ Valid flag matches expected: ${result.valid}`);
        } else {
            console.log(`❌ Valid flag mismatch! Expected: ${testCase.expectedValid}, Got: ${result.valid}`);
        }

        if (result.severity === testCase.expectedSeverity) {
            console.log(`✅ Severity matches expected: ${result.severity}`);
        } else {
            console.log(`⚠️  Severity differs. Expected: ${testCase.expectedSeverity}, Got: ${result.severity}`);
        }

        if (result.confidence >= 70) {
            console.log(`✅ High confidence: ${result.confidence}%`);
        } else if (result.confidence >= 50) {
            console.log(`⚠️  Moderate confidence: ${result.confidence}%`);
        } else {
            console.log(`❌ Low confidence: ${result.confidence}%`);
        }

        return {
            success: true,
            testCase: testCase.name,
            result,
            responseTime,
            validationPassed: result.valid === testCase.expectedValid && result.severity === testCase.expectedSeverity
        };

    } catch (error) {
        console.log('\n❌ Error:', error.message);
        return {
            success: false,
            testCase: testCase.name,
            error: error.message
        };
    }
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('\n🚀 ChainGuard Webhook Test Suite');
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
    console.log(`📊 Total test cases: ${testCases.length}\n`);

    const results = [];

    for (const testCase of testCases) {
        const result = await sendTestRequest(testCase);
        results.push(result);

        // Wait between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80) + '\n');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const validationPassed = results.filter(r => r.validationPassed);

    console.log(`✅ Successful requests: ${successful.length}/${results.length}`);
    console.log(`❌ Failed requests: ${failed.length}/${results.length}`);
    console.log(`🎯 Validation accuracy: ${validationPassed.length}/${successful.length}`);

    if (successful.length > 0) {
        const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
        console.log(`⏱️  Average response time: ${avgResponseTime.toFixed(0)}ms`);
    }

    console.log('\nDetailed Results:');
    results.forEach((result, index) => {
        const icon = result.success ? (result.validationPassed ? '✅' : '⚠️ ') : '❌';
        console.log(`${icon} ${index + 1}. ${result.testCase}`);
        if (result.success && result.result) {
            console.log(`   └─ Severity: ${result.result.severity}, Confidence: ${result.result.confidence}%, Time: ${result.responseTime}ms`);
        } else if (!result.success) {
            console.log(`   └─ Error: ${result.error}`);
        }
    });

    console.log('\n' + '='.repeat(80) + '\n');

    // Exit with appropriate code
    process.exit(failed.length > 0 ? 1 : 0);
}

/**
 * Run a single test by index
 */
async function runSingleTest(index) {
    if (index < 0 || index >= testCases.length) {
        console.error(`Invalid test index. Available tests: 0-${testCases.length - 1}`);
        process.exit(1);
    }

    console.log('\n🚀 ChainGuard Webhook Single Test');
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}\n`);

    const result = await sendTestRequest(testCases[index]);

    console.log('\n' + '='.repeat(80));
    console.log(result.success ? '✅ TEST PASSED' : '❌ TEST FAILED');
    console.log('='.repeat(80) + '\n');

    process.exit(result.success ? 0 : 1);
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
    // Run all tests
    runAllTests();
} else if (args[0] === '--list') {
    // List available tests
    console.log('\nAvailable test cases:\n');
    testCases.forEach((test, index) => {
        console.log(`${index}. ${test.name}`);
        console.log(`   Type: ${test.payload.finding.type}`);
        console.log(`   Expected: ${test.expectedValid ? 'Valid' : 'False Positive'} - ${test.expectedSeverity}\n`);
    });
} else if (args[0] === '--test' && args[1] !== undefined) {
    // Run specific test
    const testIndex = parseInt(args[1]);
    runSingleTest(testIndex);
} else {
    console.log(`
Usage:
  node webhook-test.js              Run all tests
  node webhook-test.js --list       List available tests
  node webhook-test.js --test <n>   Run specific test by index
  `);
    process.exit(1);
}
