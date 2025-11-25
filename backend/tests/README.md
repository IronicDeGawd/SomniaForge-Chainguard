# ChainGuard Webhook Tests

This directory contains test scripts for validating the ChainGuard N8N webhook integration.

## Test Script: `webhook-test.js`

A comprehensive Node.js test suite for the vulnerability validation webhook.

### Prerequisites

- Node.js 18+ (uses native `fetch` API)
- No additional dependencies required

### Usage

#### Run All Tests
```bash
node webhook-test.js
```

Runs all 5 test cases sequentially and provides a detailed summary.

#### List Available Tests
```bash
node webhook-test.js --list
```

Shows all available test cases with their expected outcomes.

#### Run Single Test
```bash
node webhook-test.js --test 0
```

Runs a specific test by index (0-4).

## Test Cases

### 1. Reentrancy - Critical Vulnerability
- **Type**: `reentrancy`
- **Expected**: Valid vulnerability, CRITICAL severity
- **Pattern**: External call before state update, no guards

### 2. Access Control - False Positive (Protected)
- **Type**: `access_control`
- **Expected**: False positive, has `onlyOwner` modifier
- **Pattern**: Properly protected mint function

### 3. Unchecked Call - High Severity
- **Type**: `unchecked_call`
- **Expected**: Valid vulnerability, HIGH severity
- **Pattern**: Low-level call without success check

### 4. Gas Anomaly - Medium Severity
- **Type**: `gas_anomaly`
- **Expected**: Valid vulnerability, MEDIUM severity
- **Pattern**: Unbounded loop in batch processing

### 5. Reentrancy - Protected with nonReentrant
- **Type**: `reentrancy`
- **Expected**: False positive, has `nonReentrant` modifier
- **Pattern**: Protected withdrawal function

## Output

The test script provides:
- ✅ Request/response details for each test
- ⏱️ Response time measurements
- 🔍 Validation against expected results
- 📊 Summary statistics
- 🎯 Accuracy metrics

### Example Output

```
================================================================================
TEST: Reentrancy - Critical Vulnerability
================================================================================

📤 Sending request...
Payload: {
  "finding": {
    "type": "reentrancy",
    "function": "withdraw",
    ...
  }
}

✅ Response received
⏱️  Response time: 3245ms

📥 Validation Result:
{
  "valid": true,
  "confidence": 95,
  "severity": "CRITICAL",
  "reason": "External call before state update with no reentrancy guard...",
  "recommendation": "Move state update before external call or add nonReentrant modifier"
}

🔍 Validation:
✅ Valid flag matches expected: true
✅ Severity matches expected: CRITICAL
✅ High confidence: 95%
```

## Webhook Configuration

- **URL**: `https://n8n.ironyaditya.xyz/webhook-test/939ffefe-c76c-4850-9d89-266588d24a9a`
- **Method**: POST
- **Content-Type**: application/json

## Response Schema

All responses should include:
- `valid` (boolean): True if real vulnerability
- `confidence` (number): 0-100
- `severity` (string): CRITICAL, HIGH, MEDIUM, LOW, or FALSE_POSITIVE
- `reason` (string): Explanation
- `recommendation` (string): Fix or "No action needed"
- `additionalContext` (string, optional): Extra details

## Performance Targets

- ✅ Response time: <5 seconds
- ✅ Confidence: >70% for clear cases
- ✅ Accuracy: >90% validation rate

## Troubleshooting

### Connection Errors
- Verify webhook URL is accessible
- Check network connectivity
- Ensure N8N instance is running

### Validation Failures
- Review knowledge base content
- Check system prompt configuration
- Verify vector store is populated

### Slow Response Times
- Reduce `topK` in vector store
- Disable reranker temporarily
- Check database performance

## Adding New Tests

To add a new test case, append to the `testCases` array in `webhook-test.js`:

```javascript
{
  name: 'Your Test Name',
  payload: {
    finding: {
      type: 'vulnerability_type',
      function: 'functionName',
      line: 42,
      code_snippet: 'function code...',
      rule_confidence: 85
    },
    contract_context: 'Context description',
    session_id: 'test-session-id'
  },
  expectedSeverity: 'CRITICAL',
  expectedValid: true
}
```

## CI/CD Integration

Run tests in CI pipeline:

```bash
# Exit code 0 if all tests pass, 1 if any fail
node webhook-test.js
```

## Next Steps

1. ✅ Run initial tests to verify webhook connectivity
2. ⏳ Populate knowledge base with vulnerability patterns
3. ⏳ Monitor validation accuracy
4. ⏳ Tune confidence thresholds based on results
5. ⏳ Add more edge case tests
