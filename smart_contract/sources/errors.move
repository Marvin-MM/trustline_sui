/// BondFlow error codes module.
/// All abort codes are named constants grouped by module with non-overlapping numeric ranges.
/// A raw abort code uniquely identifies the originating module.
///
/// Constants are module-internal in Move. Public accessor functions expose each code
/// for cross-module use.
module bondflow::errors;

// ============================================================
// General validation errors (100–199)
// ============================================================

/// Fired when a vector argument is empty but must contain at least one element.
const E_EMPTY_VECTOR: u64 = 100;
/// Fired when a string/vector exceeds its maximum allowed byte length.
const E_STRING_TOO_LONG: u64 = 101;
/// Fired when an address argument is the zero address (@0x0).
const E_ZERO_ADDRESS: u64 = 102;
/// Fired when a token amount is zero but a positive amount is required.
const E_ZERO_AMOUNT: u64 = 103;
/// Fired when a byte vector does not match the expected length (e.g. blob ID must be 32 bytes).
const E_INVALID_LENGTH: u64 = 104;

// ============================================================
// Protocol state errors (200–299)
// ============================================================

/// Fired when a state-changing function is called while the protocol is paused.
const E_PROTOCOL_PAUSED: u64 = 200;
/// Fired when a non-admin attempts an admin-only operation.
const E_NOT_ADMIN: u64 = 201;

// ============================================================
// Payment relationship errors (1000–1099)
// ============================================================

/// Fired when a condition_type value is not one of the recognised types (0, 1, 2).
const E_INVALID_CONDITION_TYPE: u64 = 1000;
/// Fired when the recipient is the sender or zero address.
const E_INVALID_RECIPIENT: u64 = 1001;
/// Fired when a memo exceeds 64 bytes.
const E_MEMO_TOO_LONG: u64 = 1002;
/// Fired when a condition_value is empty for condition types requiring one.
const E_EMPTY_CONDITION_VALUE: u64 = 1003;
/// Fired when milestone status doesn't match the expected status.
const E_WRONG_STATUS: u64 = 1004;
/// Fired when attempting to release a milestone whose condition has not been met.
const E_CONDITION_NOT_MET: u64 = 1005;
/// Fired when a registered blob ID doesn't match the expected condition_value.
const E_BLOB_ID_MISMATCH: u64 = 1006;
/// Fired when attempting to release an already-released milestone.
const E_ALREADY_RELEASED: u64 = 1007;
/// Fired when attempting to cancel an already-cancelled milestone/relationship.
const E_ALREADY_CANCELLED: u64 = 1008;
/// Fired when the sender is not the payer recorded in the relationship.
const E_PAYER_MISMATCH: u64 = 1009;
/// Fired when attempting to release a milestone while a dispute is open.
const E_DISPUTE_OPEN: u64 = 1010;
/// Fired when a milestone index is out of bounds.
const E_INVALID_MILESTONE_INDEX: u64 = 1011;
/// Fired when attempting to release a milestone that was already released.
const E_MILESTONE_ALREADY_RELEASED: u64 = 1012;
/// Fired when attempting to create a relationship with zero milestones.
const E_NO_MILESTONES: u64 = 1013;
/// Fired when a dispute_status value is invalid.
const E_INVALID_DISPUTE_STATUS: u64 = 1014;
/// Fired when parallel vectors have mismatched lengths.
const E_VECTOR_LENGTH_MISMATCH: u64 = 1015;
/// Fired when cancelling a relationship that has released milestones.
const E_HAS_RELEASED_MILESTONES: u64 = 1016;
/// Fired when milestone count exceeds the maximum (10).
const E_TOO_MANY_MILESTONES: u64 = 1017;

// ============================================================
// Completion attestation errors (1500–1599)
// ============================================================

/// Fired when attestation data doesn't match the relationship.
const E_ATTESTATION_RELATIONSHIP_MISMATCH: u64 = 1500;
/// Fired when an attestation already exists for the same relationship+milestone.
const E_ATTESTATION_ALREADY_EXISTS: u64 = 1501;

// ============================================================
// Reputation proof errors (2000–2099)
// ============================================================

/// Fired when attempting to mint a proof with zero attestations.
const E_NO_COMPLETED_ATTESTATIONS: u64 = 2000;
/// Fired when attestation recipient doesn't match the proof owner.
const E_ATTESTATION_OWNER_MISMATCH: u64 = 2001;
/// Fired when a proof already exists for the caller.
const E_PROOF_ALREADY_EXISTS: u64 = 2002;
/// Fired when no proof exists for the given owner.
const E_PROOF_NOT_FOUND: u64 = 2003;
/// Fired when an attestation ID is already in the proof (double-counting).
const E_DUPLICATE_ATTESTATION_ID: u64 = 2004;

// ============================================================
// Agent policy errors (3000–3099)
// ============================================================

/// Fired when an AgentCap has expired.
const E_CAP_EXPIRED: u64 = 3000;
/// Fired when an AgentCap has been revoked.
const E_CAP_REVOKED: u64 = 3001;
/// Fired when an AgentCap is used on the wrong relationship.
const E_CAP_RELATIONSHIP_MISMATCH: u64 = 3002;
/// Fired when expiry duration is zero.
const E_INVALID_EXPIRY_DURATION: u64 = 3003;
/// Fired when the caller granting/revoking a cap isn't the payer.
const E_GRANT_PAYER_MISMATCH: u64 = 3004;
/// Fired when an AgentCap has exhausted its action budget.
const E_CAP_ACTION_LIMIT_EXCEEDED: u64 = 3005;
/// Fired when the condition type is not in the AgentCap's allowlist.
const E_CONDITION_TYPE_NOT_ALLOWED: u64 = 3006;
/// Fired when an AgentCap is submitted by a wallet other than its configured agent.
const E_AGENT_MISMATCH: u64 = 3007;
/// Fired when an OperatorCap is submitted by a wallet other than its operator.
const E_OPERATOR_MISMATCH: u64 = 3008;
/// Fired when an operator capability does not allow the requested action.
const E_OPERATOR_ACTION_NOT_ALLOWED: u64 = 3009;
/// Fired when an automatic release is attempted before its challenge window ends.
const E_CHALLENGE_WINDOW_OPEN: u64 = 3010;
/// Fired when a deliverable action is attempted by a non-recipient.
const E_RECIPIENT_MISMATCH: u64 = 3011;

// ============================================================
// Public accessor functions — expose constants cross-module
// ============================================================

// General
public fun empty_vector(): u64 { E_EMPTY_VECTOR }
public fun string_too_long(): u64 { E_STRING_TOO_LONG }
public fun zero_address(): u64 { E_ZERO_ADDRESS }
public fun zero_amount(): u64 { E_ZERO_AMOUNT }
public fun invalid_length(): u64 { E_INVALID_LENGTH }

// Protocol
public fun protocol_paused(): u64 { E_PROTOCOL_PAUSED }
public fun not_admin(): u64 { E_NOT_ADMIN }

// Payment relationship
public fun invalid_condition_type(): u64 { E_INVALID_CONDITION_TYPE }
public fun invalid_recipient(): u64 { E_INVALID_RECIPIENT }
public fun memo_too_long(): u64 { E_MEMO_TOO_LONG }
public fun empty_condition_value(): u64 { E_EMPTY_CONDITION_VALUE }
public fun wrong_status(): u64 { E_WRONG_STATUS }
public fun condition_not_met(): u64 { E_CONDITION_NOT_MET }
public fun blob_id_mismatch(): u64 { E_BLOB_ID_MISMATCH }
public fun already_released(): u64 { E_ALREADY_RELEASED }
public fun already_cancelled(): u64 { E_ALREADY_CANCELLED }
public fun payer_mismatch(): u64 { E_PAYER_MISMATCH }
public fun dispute_open(): u64 { E_DISPUTE_OPEN }
public fun invalid_milestone_index(): u64 { E_INVALID_MILESTONE_INDEX }
public fun milestone_already_released(): u64 { E_MILESTONE_ALREADY_RELEASED }
public fun no_milestones(): u64 { E_NO_MILESTONES }
public fun invalid_dispute_status(): u64 { E_INVALID_DISPUTE_STATUS }
public fun vector_length_mismatch(): u64 { E_VECTOR_LENGTH_MISMATCH }
public fun has_released_milestones(): u64 { E_HAS_RELEASED_MILESTONES }
public fun too_many_milestones(): u64 { E_TOO_MANY_MILESTONES }

// Completion attestation
public fun attestation_relationship_mismatch(): u64 { E_ATTESTATION_RELATIONSHIP_MISMATCH }
public fun attestation_already_exists(): u64 { E_ATTESTATION_ALREADY_EXISTS }

// Reputation proof
public fun no_completed_attestations(): u64 { E_NO_COMPLETED_ATTESTATIONS }
public fun attestation_owner_mismatch(): u64 { E_ATTESTATION_OWNER_MISMATCH }
public fun proof_already_exists(): u64 { E_PROOF_ALREADY_EXISTS }
public fun proof_not_found(): u64 { E_PROOF_NOT_FOUND }
public fun duplicate_attestation_id(): u64 { E_DUPLICATE_ATTESTATION_ID }

// Agent policy
public fun cap_expired(): u64 { E_CAP_EXPIRED }
public fun cap_revoked(): u64 { E_CAP_REVOKED }
public fun cap_relationship_mismatch(): u64 { E_CAP_RELATIONSHIP_MISMATCH }
public fun invalid_expiry_duration(): u64 { E_INVALID_EXPIRY_DURATION }
public fun grant_payer_mismatch(): u64 { E_GRANT_PAYER_MISMATCH }
public fun cap_action_limit_exceeded(): u64 { E_CAP_ACTION_LIMIT_EXCEEDED }
public fun condition_type_not_allowed(): u64 { E_CONDITION_TYPE_NOT_ALLOWED }
public fun agent_mismatch(): u64 { E_AGENT_MISMATCH }
public fun operator_mismatch(): u64 { E_OPERATOR_MISMATCH }
public fun operator_action_not_allowed(): u64 { E_OPERATOR_ACTION_NOT_ALLOWED }
public fun challenge_window_open(): u64 { E_CHALLENGE_WINDOW_OPEN }
public fun recipient_mismatch(): u64 { E_RECIPIENT_MISMATCH }
