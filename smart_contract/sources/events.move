/// BondFlow events module.
/// Every event struct has `copy` and `drop` abilities.
/// Events are self-contained — a listener can fully understand what happened from the event alone.
module bondflow::events;

use sui::event;

// ============================================================
// Payment Relationship Events
// ============================================================

/// Emitted when a new PaymentRelationship is created.
public struct RelationshipCreatedEvent has copy, drop {
    /// The object ID of the newly created PaymentRelationship
    relationship_id: ID,
    /// Address of the payer who funded the relationship
    payer: address,
    /// Address of the recipient who will receive milestone payments
    recipient: address,
    /// Number of milestones in this relationship
    milestone_count: u64,
    /// Total token amount locked across all milestones (base units; USDC in production PTBs)
    total_locked_amount: u64,
    /// Condition type applied to milestones (0=manual, 1=time-gated, 2=deliverable)
    condition_type: u8,
    /// Walrus MemWal space ID for off-chain memory entries
    walrus_memory_space_id: vector<u8>,
    /// Human-readable memo attached to the relationship
    memo: vector<u8>,
    /// Epoch timestamp in milliseconds at creation
    timestamp: u64,
    /// Contract data-model version.
    contract_version: u64,
}

public struct MilestoneCreatedEvent has copy, drop {
    relationship_id: ID,
    milestone_index: u64,
    amount: u64,
    condition_type: u8,
    requirement: vector<u8>,
    release_policy: u8,
}

public struct DeliverableSubmittedEvent has copy, drop {
    relationship_id: ID,
    milestone_index: u64,
    recipient: address,
    blob_id: vector<u8>,
    timestamp: u64,
}

public struct DeliverableVerifiedEvent has copy, drop {
    relationship_id: ID,
    milestone_index: u64,
    verifier: address,
    blob_id: vector<u8>,
    evidence_hash: vector<u8>,
    challenge_deadline: u64,
    timestamp: u64,
}

public struct DeliverableRejectedEvent has copy, drop {
    relationship_id: ID,
    milestone_index: u64,
    verifier: address,
    blob_id: vector<u8>,
    evidence_hash: vector<u8>,
    timestamp: u64,
}

/// Emitted when a milestone's condition is marked as met (e.g., deliverable registered).
public struct MilestoneConditionMetEvent has copy, drop {
    /// The PaymentRelationship this milestone belongs to
    relationship_id: ID,
    /// Zero-based index of the milestone within the relationship
    milestone_index: u64,
    /// Condition type of this milestone (0=manual, 1=time-gated, 2=deliverable)
    condition_type: u8,
    /// Walrus blob ID of the registered deliverable (32 bytes)
    deliverable_blob_id: vector<u8>,
    /// Epoch timestamp in milliseconds when condition was met
    timestamp: u64,
    /// Payer address for context
    payer: address,
    /// Recipient address for context
    recipient: address,
}

/// Emitted when a milestone's escrowed funds are released to the recipient.
public struct MilestoneReleasedEvent has copy, drop {
    /// The PaymentRelationship this milestone belongs to
    relationship_id: ID,
    /// Zero-based index of the released milestone
    milestone_index: u64,
    /// Payer address
    payer: address,
    /// Recipient address who received the funds
    recipient: address,
    /// Token amount released in base units (USDC in production PTBs)
    amount: u64,
    /// Walrus blob ID of the deliverable (empty for non-deliverable milestones)
    deliverable_blob_id: vector<u8>,
    /// Epoch timestamp in milliseconds at release
    release_timestamp: u64,
}

/// Emitted when a dispute is raised on a milestone.
public struct DisputeRaisedEvent has copy, drop {
    /// The PaymentRelationship containing the disputed milestone
    relationship_id: ID,
    /// Zero-based index of the disputed milestone
    milestone_index: u64,
    /// Address that raised the dispute (must be payer)
    raised_by: address,
    /// 32-byte hash of the dispute reason stored off-chain in Walrus
    reason_hash: vector<u8>,
    /// Epoch timestamp in milliseconds when dispute was raised
    timestamp: u64,
}

/// Emitted when a dispute is resolved by the admin.
public struct DisputeResolvedEvent has copy, drop {
    /// The PaymentRelationship containing the resolved dispute
    relationship_id: ID,
    /// Zero-based index of the milestone whose dispute was resolved
    milestone_index: u64,
    /// Address of the admin who resolved the dispute
    resolved_by: address,
    /// Resolution outcome: 2=release to recipient, 3=return to payer
    resolution: u8,
    /// Epoch timestamp in milliseconds at resolution
    timestamp: u64,
}

/// Emitted when a relationship is cancelled and remaining funds returned to payer.
public struct RelationshipCancelledEvent has copy, drop {
    /// The cancelled PaymentRelationship object ID
    relationship_id: ID,
    /// Payer address who received the returned funds
    payer: address,
    /// Total token amount returned to payer in base units (USDC in production PTBs)
    total_returned: u64,
    /// Epoch timestamp in milliseconds at cancellation
    timestamp: u64,
}

public struct MilestoneCancelledEvent has copy, drop {
    relationship_id: ID,
    milestone_index: u64,
    payer: address,
    amount_returned: u64,
    timestamp: u64,
}

// ============================================================
// Completion Attestation Events
// ============================================================

/// Emitted when a CompletionAttestation is minted for a released milestone.
public struct CompletionAttestationMintedEvent has copy, drop {
    /// The newly minted CompletionAttestation object ID
    attestation_id: ID,
    /// The PaymentRelationship this attestation is linked to
    relationship_id: ID,
    /// Zero-based index of the released milestone
    milestone_index: u64,
    /// Payer address from the relationship
    payer: address,
    /// Recipient address who received the attestation
    recipient: address,
    /// Token amount released for this milestone in base units (USDC in production PTBs)
    amount: u64,
    condition_type: u8,
    deliverable_blob_id: vector<u8>,
    verification_evidence_hash: vector<u8>,
    /// Epoch timestamp in milliseconds of milestone completion
    completion_timestamp: u64,
}

// ============================================================
// Agent Policy Events
// ============================================================

/// Emitted when an AgentCap is granted to a backend agent.
public struct AgentCapGrantedEvent has copy, drop {
    /// The newly created AgentCap object ID
    cap_id: ID,
    /// The PaymentRelationship this cap is scoped to
    relationship_id: ID,
    /// Address of the agent receiving the capability
    agent: address,
    /// Expiry timestamp in milliseconds (absolute, not duration)
    expiry: u64,
    /// Explicit verifier/automation actions allowed to the agent.
    allowed_actions: vector<u8>,
    /// Maximum number of actions this cap can perform
    max_actions: u64,
    /// Payer address who granted the cap
    payer: address,
}

public struct OperatorCapGrantedEvent has copy, drop {
    cap_id: ID,
    relationship_id: ID,
    operator: address,
    expiry: u64,
    can_release: bool,
    can_cancel: bool,
    can_dispute: bool,
    payer: address,
}

/// Emitted when an AgentCap is revoked by the payer.
public struct AgentCapRevokedEvent has copy, drop {
    /// The revoked AgentCap object ID
    cap_id: ID,
    /// The PaymentRelationship this cap was scoped to
    relationship_id: ID,
    /// Payer address who revoked the cap
    payer: address,
    /// Epoch timestamp in milliseconds at revocation
    timestamp: u64,
}

// ============================================================
// Reputation Proof Events
// ============================================================

/// Emitted when a ReputationProof is minted from CompletionAttestations.
public struct ReputationProofMintedEvent has copy, drop {
    /// The newly minted ReputationProof object ID
    proof_id: ID,
    /// Address of the proof owner (the worker who completed the work)
    owner: address,
    /// Number of successfully completed milestones included
    successful_count: u64,
    cancelled_count: u64,
    /// Number of milestones that had disputes raised
    disputed_count: u64,
    /// Total token volume across all included attestations (USDC in production PTBs)
    total_volume: u64,
    /// Completion rate in basis points (successful / total * 10000)
    completion_rate_bps: u64,
    /// Average completion time in milliseconds across included attestations
    avg_completion_time_ms: u64,
    /// Walrus MemWal space ID for detailed encrypted attestation data
    walrus_attestation_space_id: vector<u8>,
    /// Epoch timestamp in milliseconds at minting
    timestamp: u64,
}

/// Emitted when a ReputationProof is updated with new attestations.
public struct ReputationProofUpdatedEvent has copy, drop {
    /// The updated ReputationProof object ID
    proof_id: ID,
    /// Address of the proof owner
    owner: address,
    /// Updated count of successfully completed milestones
    new_successful_count: u64,
    new_cancelled_count: u64,
    /// Updated count of disputed milestones
    new_disputed_count: u64,
    /// Updated token volume in base units (USDC in production PTBs)
    new_total_volume: u64,
    /// Epoch timestamp in milliseconds at update
    timestamp: u64,
}

/// Emitted when a ReputationProof is revoked and deleted by its owner.
public struct ReputationProofRevokedEvent has copy, drop {
    /// The deleted ReputationProof object ID
    proof_id: ID,
    /// Address of the former proof owner
    owner: address,
    /// Epoch timestamp in milliseconds at revocation
    timestamp: u64,
}

// ============================================================
// Protocol State Events
// ============================================================

/// Emitted when the protocol is paused by an admin.
public struct ProtocolPausedEvent has copy, drop {
    /// Address of the admin who paused the protocol
    paused_by: address,
    /// Epoch timestamp in milliseconds when paused
    timestamp: u64,
}

/// Emitted when the protocol is resumed by an admin.
public struct ProtocolResumedEvent has copy, drop {
    /// Address of the admin who resumed the protocol
    resumed_by: address,
    /// Epoch timestamp in milliseconds when resumed
    timestamp: u64,
}

// ============================================================
// Emit helper functions — public(package) so only bondflow modules can emit events
// ============================================================

public(package) fun emit_relationship_created(
    relationship_id: ID,
    payer: address,
    recipient: address,
    milestone_count: u64,
    total_locked_amount: u64,
    condition_type: u8,
    walrus_memory_space_id: vector<u8>,
    memo: vector<u8>,
    timestamp: u64,
    contract_version: u64,
) {
    event::emit(RelationshipCreatedEvent {
        relationship_id,
        payer,
        recipient,
        milestone_count,
        total_locked_amount,
        condition_type,
        walrus_memory_space_id,
        memo,
        timestamp,
        contract_version,
    });
}

public(package) fun emit_milestone_created(
    relationship_id: ID,
    milestone_index: u64,
    amount: u64,
    condition_type: u8,
    requirement: vector<u8>,
    release_policy: u8,
) {
    event::emit(MilestoneCreatedEvent {
        relationship_id,
        milestone_index,
        amount,
        condition_type,
        requirement,
        release_policy,
    });
}

public(package) fun emit_deliverable_submitted(
    relationship_id: ID,
    milestone_index: u64,
    recipient: address,
    blob_id: vector<u8>,
    timestamp: u64,
) {
    event::emit(DeliverableSubmittedEvent {
        relationship_id,
        milestone_index,
        recipient,
        blob_id,
        timestamp,
    });
}

public(package) fun emit_deliverable_verified(
    relationship_id: ID,
    milestone_index: u64,
    verifier: address,
    blob_id: vector<u8>,
    evidence_hash: vector<u8>,
    challenge_deadline: u64,
    timestamp: u64,
) {
    event::emit(DeliverableVerifiedEvent {
        relationship_id,
        milestone_index,
        verifier,
        blob_id,
        evidence_hash,
        challenge_deadline,
        timestamp,
    });
}

public(package) fun emit_deliverable_rejected(
    relationship_id: ID,
    milestone_index: u64,
    verifier: address,
    blob_id: vector<u8>,
    evidence_hash: vector<u8>,
    timestamp: u64,
) {
    event::emit(DeliverableRejectedEvent {
        relationship_id,
        milestone_index,
        verifier,
        blob_id,
        evidence_hash,
        timestamp,
    });
}

public(package) fun emit_milestone_condition_met(
    relationship_id: ID,
    milestone_index: u64,
    condition_type: u8,
    deliverable_blob_id: vector<u8>,
    timestamp: u64,
    payer: address,
    recipient: address,
) {
    event::emit(MilestoneConditionMetEvent {
        relationship_id,
        milestone_index,
        condition_type,
        deliverable_blob_id,
        timestamp,
        payer,
        recipient,
    });
}

public(package) fun emit_milestone_released(
    relationship_id: ID,
    milestone_index: u64,
    payer: address,
    recipient: address,
    amount: u64,
    deliverable_blob_id: vector<u8>,
    release_timestamp: u64,
) {
    event::emit(MilestoneReleasedEvent {
        relationship_id,
        milestone_index,
        payer,
        recipient,
        amount,
        deliverable_blob_id,
        release_timestamp,
    });
}

public(package) fun emit_dispute_raised(
    relationship_id: ID,
    milestone_index: u64,
    raised_by: address,
    reason_hash: vector<u8>,
    timestamp: u64,
) {
    event::emit(DisputeRaisedEvent {
        relationship_id,
        milestone_index,
        raised_by,
        reason_hash,
        timestamp,
    });
}

public(package) fun emit_dispute_resolved(
    relationship_id: ID,
    milestone_index: u64,
    resolved_by: address,
    resolution: u8,
    timestamp: u64,
) {
    event::emit(DisputeResolvedEvent {
        relationship_id,
        milestone_index,
        resolved_by,
        resolution,
        timestamp,
    });
}

public(package) fun emit_relationship_cancelled(
    relationship_id: ID,
    payer: address,
    total_returned: u64,
    timestamp: u64,
) {
    event::emit(RelationshipCancelledEvent {
        relationship_id,
        payer,
        total_returned,
        timestamp,
    });
}

public(package) fun emit_milestone_cancelled(
    relationship_id: ID,
    milestone_index: u64,
    payer: address,
    amount_returned: u64,
    timestamp: u64,
) {
    event::emit(MilestoneCancelledEvent {
        relationship_id,
        milestone_index,
        payer,
        amount_returned,
        timestamp,
    });
}

public(package) fun emit_completion_attestation_minted(
    attestation_id: ID,
    relationship_id: ID,
    milestone_index: u64,
    payer: address,
    recipient: address,
    amount: u64,
    condition_type: u8,
    deliverable_blob_id: vector<u8>,
    verification_evidence_hash: vector<u8>,
    completion_timestamp: u64,
) {
    event::emit(CompletionAttestationMintedEvent {
        attestation_id,
        relationship_id,
        milestone_index,
        payer,
        recipient,
        amount,
        condition_type,
        deliverable_blob_id,
        verification_evidence_hash,
        completion_timestamp,
    });
}

public(package) fun emit_agent_cap_granted(
    cap_id: ID,
    relationship_id: ID,
    agent: address,
    expiry: u64,
    allowed_actions: vector<u8>,
    max_actions: u64,
    payer: address,
) {
    event::emit(AgentCapGrantedEvent {
        cap_id,
        relationship_id,
        agent,
        expiry,
        allowed_actions,
        max_actions,
        payer,
    });
}

public(package) fun emit_operator_cap_granted(
    cap_id: ID,
    relationship_id: ID,
    operator: address,
    expiry: u64,
    can_release: bool,
    can_cancel: bool,
    can_dispute: bool,
    payer: address,
) {
    event::emit(OperatorCapGrantedEvent {
        cap_id,
        relationship_id,
        operator,
        expiry,
        can_release,
        can_cancel,
        can_dispute,
        payer,
    });
}

public(package) fun emit_agent_cap_revoked(
    cap_id: ID,
    relationship_id: ID,
    payer: address,
    timestamp: u64,
) {
    event::emit(AgentCapRevokedEvent {
        cap_id,
        relationship_id,
        payer,
        timestamp,
    });
}

public(package) fun emit_reputation_proof_minted(
    proof_id: ID,
    owner: address,
    successful_count: u64,
    cancelled_count: u64,
    disputed_count: u64,
    total_volume: u64,
    completion_rate_bps: u64,
    avg_completion_time_ms: u64,
    walrus_attestation_space_id: vector<u8>,
    timestamp: u64,
) {
    event::emit(ReputationProofMintedEvent {
        proof_id,
        owner,
        successful_count,
        cancelled_count,
        disputed_count,
        total_volume,
        completion_rate_bps,
        avg_completion_time_ms,
        walrus_attestation_space_id,
        timestamp,
    });
}

public(package) fun emit_reputation_proof_updated(
    proof_id: ID,
    owner: address,
    new_successful_count: u64,
    new_cancelled_count: u64,
    new_disputed_count: u64,
    new_total_volume: u64,
    timestamp: u64,
) {
    event::emit(ReputationProofUpdatedEvent {
        proof_id,
        owner,
        new_successful_count,
        new_cancelled_count,
        new_disputed_count,
        new_total_volume,
        timestamp,
    });
}

public(package) fun emit_reputation_proof_revoked(
    proof_id: ID,
    owner: address,
    timestamp: u64,
) {
    event::emit(ReputationProofRevokedEvent {
        proof_id,
        owner,
        timestamp,
    });
}

public(package) fun emit_protocol_paused(
    paused_by: address,
    timestamp: u64,
) {
    event::emit(ProtocolPausedEvent {
        paused_by,
        timestamp,
    });
}

public(package) fun emit_protocol_resumed(
    resumed_by: address,
    timestamp: u64,
) {
    event::emit(ProtocolResumedEvent {
        resumed_by,
        timestamp,
    });
}
