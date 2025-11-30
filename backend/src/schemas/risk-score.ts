/**
 * Risk Score Schema for Somnia Data Streams
 *
 * Publishes real-time risk scores for all monitored transactions
 * to create a composable security data layer on Somnia.
 *
 * Publishing Strategy: Threshold-based (risk >= 30)
 * - Reduces volume by ~80-90%
 * - Cost-effective while maintaining value
 * - Other dApps can subscribe and build security UIs
 */

export const riskScoreSchema = `uint64 timestamp, address contractAddress, address sender, bytes32 txHash, uint8 riskScore, string riskLevel, string primaryFactor, uint256 value, uint256 gasUsed`;

export const riskScoreEventId = 'RiskScore';

/**
 * Risk Level Mapping
 *
 * @param score - Risk score (0-100)
 * @returns Risk level string
 */
export function calculateRiskLevel(score: number): string {
  if (score >= 80) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  if (score >= 10) return 'LOW';
  return 'SAFE';
}
