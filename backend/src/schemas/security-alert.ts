/**
 * SDS Schema for Security Alerts
 *
 * Defines the structure for publishing heuristic findings to Somnia Data Streams.
 * Enables real-time alert distribution and on-chain audit trails for the hackathon project.
 */
export const securityAlertSchema = `uint64 timestamp, address contractAddress, bytes32 txHash, string alertType, string severity, string description, uint256 value, uint256 gasUsed, uint8 confidence`;

/**
 * Event ID for SecurityAlert events
 * Used for frontend subscriptions via sdk.streams.subscribe()
 */
export const securityAlertEventId = 'ChainGuardAlert';

/**
 * Parent schema ID constant (zeroBytes32 for root-level schemas)
 * Will be imported from @somnia-chain/streams
 */
export { zeroBytes32 as securityAlertParentSchemaId } from '@somnia-chain/streams'; 
