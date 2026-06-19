/// BondFlow v2 shared payment relationship and escrow state machine.
#[allow(lint(public_entry), deprecated_usage)]
module bondflow::payment_relationship;

use sui::balance::Balance;
use sui::coin::{Self, Coin};
use bondflow::errors;
use bondflow::events;
use bondflow::protocol_state::{Self, ProtocolState, AdminCap};
use bondflow::agent_policy::{Self, AgentCap, OperatorCap, RevokedCaps};
use bondflow::completion_attestation::{Self, AttestationRegistry};
use bondflow::reputation_ledger::{Self, ReputationLedger};

const CONTRACT_VERSION: u64 = 2;
const AUTO_RELEASE_CHALLENGE_MS: u64 = 86_400_000;

const CONDITION_MANUAL: u8 = 0;
const CONDITION_TIME_GATED: u8 = 1;
const CONDITION_DELIVERABLE: u8 = 2;

const RELEASE_PAYER_APPROVAL: u8 = 0;
const RELEASE_AUTO_AFTER_CHALLENGE: u8 = 1;

const STATUS_PENDING: u8 = 0;
const STATUS_SUBMITTED: u8 = 1;
const STATUS_CONDITION_MET: u8 = 2;
const STATUS_RELEASED: u8 = 3;
const STATUS_CANCELLED: u8 = 4;
const STATUS_DISPUTED: u8 = 5;

const REL_ACTIVE: u8 = 0;
const REL_COMPLETED: u8 = 1;
const REL_CANCELLED: u8 = 2;

const DISPUTE_NONE: u8 = 0;
const DISPUTE_OPEN: u8 = 1;
const DISPUTE_RESOLVED_RECIPIENT: u8 = 2;
const DISPUTE_RESOLVED_PAYER: u8 = 3;

public fun status_pending(): u8 { STATUS_PENDING }
public fun status_submitted(): u8 { STATUS_SUBMITTED }
public fun status_condition_met(): u8 { STATUS_CONDITION_MET }
public fun status_released(): u8 { STATUS_RELEASED }
public fun status_cancelled(): u8 { STATUS_CANCELLED }
public fun status_disputed(): u8 { STATUS_DISPUTED }
public fun condition_manual(): u8 { CONDITION_MANUAL }
public fun condition_time_gated(): u8 { CONDITION_TIME_GATED }
public fun condition_deliverable(): u8 { CONDITION_DELIVERABLE }
public fun release_payer_approval(): u8 { RELEASE_PAYER_APPROVAL }
public fun release_auto_after_challenge(): u8 { RELEASE_AUTO_AFTER_CHALLENGE }
public fun rel_active(): u8 { REL_ACTIVE }
public fun rel_completed(): u8 { REL_COMPLETED }
public fun rel_cancelled(): u8 { REL_CANCELLED }
public fun dispute_none(): u8 { DISPUTE_NONE }
public fun dispute_open_val(): u8 { DISPUTE_OPEN }
public fun dispute_resolved_recipient(): u8 { DISPUTE_RESOLVED_RECIPIENT }
public fun dispute_resolved_payer(): u8 { DISPUTE_RESOLVED_PAYER }

public struct Milestone has store {
    amount: u64,
    condition_type: u8,
    requirement: vector<u8>,
    release_policy: u8,
    status: u8,
    dispute_status: u8,
    submitted_blob_id: vector<u8>,
    verification_evidence_hash: vector<u8>,
    condition_met_timestamp: u64,
    challenge_deadline: u64,
    release_timestamp: u64,
    dispute_reason_hash: vector<u8>,
    dispute_raised_timestamp: u64,
}

public struct PaymentRelationship<phantom T> has key {
    id: UID,
    payer: address,
    recipient: address,
    memo: vector<u8>,
    milestones: vector<Milestone>,
    escrow_balances: vector<Balance<T>>,
    completed_cycles: u64,
    total_released_amount: u64,
    dispute_count: u64,
    walrus_memory_space_id: vector<u8>,
    created_at: u64,
    contract_version: u64,
    version: u64,
    status: u8,
}

/// Creates and shares a v2 relationship. When verifier_agent is non-zero, its
/// verifier/automation capability is created atomically in this transaction.
public entry fun create<T>(
    recipient: address,
    coins: vector<Coin<T>>,
    condition_types: vector<u8>,
    requirements: vector<vector<u8>>,
    release_policies: vector<u8>,
    memo: vector<u8>,
    walrus_memory_space_id: vector<u8>,
    verifier_agent: address,
    verifier_expiry_duration_s: u64,
    verifier_max_actions: u64,
    revoked_caps: &mut RevokedCaps,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    let payer = ctx.sender();
    assert!(recipient != @0x0 && recipient != payer, errors::invalid_recipient());
    let count = coins.length();
    assert!(count > 0, errors::no_milestones());
    assert!(count <= 10, errors::too_many_milestones());
    assert!(condition_types.length() == count, errors::vector_length_mismatch());
    assert!(requirements.length() == count, errors::vector_length_mismatch());
    assert!(release_policies.length() == count, errors::vector_length_mismatch());
    assert!(memo.length() <= 64, errors::memo_too_long());
    assert!(walrus_memory_space_id.length() == 32, errors::invalid_length());

    let mut milestones = vector::empty<Milestone>();
    let mut escrow_balances = vector::empty<Balance<T>>();
    let mut total_locked = 0;
    let mut i = 0;
    while (i < count) {
        let condition_type = *condition_types.borrow(i);
        let requirement = *requirements.borrow(i);
        let release_policy = *release_policies.borrow(i);
        assert!(condition_type <= CONDITION_DELIVERABLE, errors::invalid_condition_type());
        assert!(release_policy <= RELEASE_AUTO_AFTER_CHALLENGE, errors::invalid_condition_type());
        if (condition_type == CONDITION_MANUAL) {
            assert!(release_policy == RELEASE_PAYER_APPROVAL, errors::invalid_condition_type());
        };
        if (condition_type != CONDITION_MANUAL) {
            assert!(!requirement.is_empty(), errors::empty_condition_value());
        };
        if (condition_type == CONDITION_TIME_GATED) {
            assert!(requirement.length() <= 8, errors::invalid_length());
            assert!(decode_u64(&requirement) > ctx.epoch_timestamp_ms(), errors::condition_not_met());
        };
        let amount = coins.borrow(i).value();
        assert!(amount > 0, errors::zero_amount());
        total_locked = total_locked + amount;
        milestones.push_back(Milestone {
            amount,
            condition_type,
            requirement,
            release_policy,
            status: STATUS_PENDING,
            dispute_status: DISPUTE_NONE,
            submitted_blob_id: vector[],
            verification_evidence_hash: vector[],
            condition_met_timestamp: 0,
            challenge_deadline: 0,
            release_timestamp: 0,
            dispute_reason_hash: vector[],
            dispute_raised_timestamp: 0,
        });
        i = i + 1;
    };

    let mut remaining = coins;
    let mut j = 0;
    while (j < count) {
        escrow_balances.push_back(remaining.remove(0).into_balance());
        j = j + 1;
    };
    remaining.destroy_empty();

    let relationship = PaymentRelationship<T> {
        id: object::new(ctx),
        payer,
        recipient,
        memo,
        milestones,
        escrow_balances,
        completed_cycles: 0,
        total_released_amount: 0,
        dispute_count: 0,
        walrus_memory_space_id,
        created_at: ctx.epoch_timestamp_ms(),
        contract_version: CONTRACT_VERSION,
        version: 0,
        status: REL_ACTIVE,
    };
    let relationship_id = object::id(&relationship);

    events::emit_relationship_created(
        relationship_id,
        payer,
        recipient,
        count,
        total_locked,
        *condition_types.borrow(0),
        relationship.walrus_memory_space_id,
        relationship.memo,
        relationship.created_at,
        CONTRACT_VERSION,
    );
    let mut event_index = 0;
    while (event_index < count) {
        let milestone = relationship.milestones.borrow(event_index);
        events::emit_milestone_created(
            relationship_id,
            event_index,
            milestone.amount,
            milestone.condition_type,
            milestone.requirement,
            milestone.release_policy,
        );
        event_index = event_index + 1;
    };

    if (verifier_agent != @0x0) {
        let cap = agent_policy::create_agent_cap(
            relationship_id,
            payer,
            verifier_agent,
            verifier_expiry_duration_s,
            vector[
                agent_policy::action_verify_deliverable(),
                agent_policy::action_auto_release(),
            ],
            verifier_max_actions,
            revoked_caps,
            ctx,
        );
        transfer::public_transfer(cap, verifier_agent);
    };
    transfer::share_object(relationship);
}

public entry fun grant_agent_cap<T>(
    relationship: &PaymentRelationship<T>,
    agent: address,
    expiry_duration_s: u64,
    allowed_actions: vector<u8>,
    max_actions: u64,
    revoked_caps: &mut RevokedCaps,
    ctx: &mut TxContext,
) {
    assert_payer(relationship, ctx);
    let cap = agent_policy::create_agent_cap(
        object::id(relationship),
        relationship.payer,
        agent,
        expiry_duration_s,
        allowed_actions,
        max_actions,
        revoked_caps,
        ctx,
    );
    transfer::public_transfer(cap, agent);
}

public entry fun grant_operator_cap<T>(
    relationship: &PaymentRelationship<T>,
    operator: address,
    expiry_duration_s: u64,
    can_release: bool,
    can_cancel: bool,
    can_dispute: bool,
    revoked_caps: &mut RevokedCaps,
    ctx: &mut TxContext,
) {
    assert_payer(relationship, ctx);
    let cap = agent_policy::create_operator_cap(
        object::id(relationship),
        relationship.payer,
        operator,
        expiry_duration_s,
        can_release,
        can_cancel,
        can_dispute,
        revoked_caps,
        ctx,
    );
    transfer::public_transfer(cap, operator);
}

public entry fun revoke_cap<T>(
    relationship: &PaymentRelationship<T>,
    cap_id: ID,
    revoked_caps: &mut RevokedCaps,
    ctx: &TxContext,
) {
    assert_payer(relationship, ctx);
    agent_policy::revoke_cap(
        cap_id,
        object::id(relationship),
        relationship.payer,
        revoked_caps,
        ctx,
    );
}

public entry fun submit_deliverable<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    blob_id: vector<u8>,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    assert!(ctx.sender() == relationship.recipient, errors::recipient_mismatch());
    assert!(blob_id.length() == 32, errors::invalid_length());
    let event_blob_id = {
        let milestone = borrow_milestone_mut(relationship, milestone_index);
        assert!(milestone.condition_type == CONDITION_DELIVERABLE, errors::invalid_condition_type());
        assert!(milestone.status == STATUS_PENDING, errors::wrong_status());
        milestone.submitted_blob_id = blob_id;
        milestone.status = STATUS_SUBMITTED;
        milestone.submitted_blob_id
    };
    relationship.version = relationship.version + 1;
    events::emit_deliverable_submitted(
        object::id(relationship),
        milestone_index,
        ctx.sender(),
        event_blob_id,
        ctx.epoch_timestamp_ms(),
    );
}

public entry fun verify_deliverable<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    blob_id: vector<u8>,
    evidence_hash: vector<u8>,
    agent_cap: &mut AgentCap,
    revoked_caps: &RevokedCaps,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    agent_policy::validate_agent(
        agent_cap,
        revoked_caps,
        object::id(relationship),
        agent_policy::action_verify_deliverable(),
        ctx,
    );
    assert!(blob_id.length() == 32 && evidence_hash.length() == 32, errors::invalid_length());
    let (event_blob_id, event_evidence_hash, challenge_deadline, condition_timestamp) = {
        let milestone = borrow_milestone_mut(relationship, milestone_index);
        assert!(milestone.condition_type == CONDITION_DELIVERABLE, errors::invalid_condition_type());
        assert!(milestone.status == STATUS_SUBMITTED, errors::wrong_status());
        assert!(milestone.submitted_blob_id == blob_id, errors::blob_id_mismatch());
        milestone.verification_evidence_hash = evidence_hash;
        milestone.status = STATUS_CONDITION_MET;
        milestone.condition_met_timestamp = ctx.epoch_timestamp_ms();
        milestone.challenge_deadline = if (milestone.release_policy == RELEASE_AUTO_AFTER_CHALLENGE) {
            milestone.condition_met_timestamp + AUTO_RELEASE_CHALLENGE_MS
        } else {
            0
        };
        (
            milestone.submitted_blob_id,
            milestone.verification_evidence_hash,
            milestone.challenge_deadline,
            milestone.condition_met_timestamp,
        )
    };
    relationship.version = relationship.version + 1;
    events::emit_deliverable_verified(
        object::id(relationship),
        milestone_index,
        ctx.sender(),
        event_blob_id,
        event_evidence_hash,
        challenge_deadline,
        condition_timestamp,
    );
    events::emit_milestone_condition_met(
        object::id(relationship),
        milestone_index,
        CONDITION_DELIVERABLE,
        event_blob_id,
        condition_timestamp,
        relationship.payer,
        relationship.recipient,
    );
}

public entry fun reject_deliverable<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    evidence_hash: vector<u8>,
    agent_cap: &mut AgentCap,
    revoked_caps: &RevokedCaps,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    agent_policy::validate_agent(
        agent_cap,
        revoked_caps,
        object::id(relationship),
        agent_policy::action_verify_deliverable(),
        ctx,
    );
    assert!(evidence_hash.length() == 32, errors::invalid_length());
    let (blob_id, event_evidence_hash) = {
        let milestone = borrow_milestone_mut(relationship, milestone_index);
        assert!(milestone.status == STATUS_SUBMITTED, errors::wrong_status());
        let blob_id = milestone.submitted_blob_id;
        milestone.verification_evidence_hash = evidence_hash;
        let event_evidence_hash = milestone.verification_evidence_hash;
        milestone.submitted_blob_id = vector[];
        milestone.status = STATUS_PENDING;
        (blob_id, event_evidence_hash)
    };
    relationship.version = relationship.version + 1;
    events::emit_deliverable_rejected(
        object::id(relationship),
        milestone_index,
        ctx.sender(),
        blob_id,
        event_evidence_hash,
        ctx.epoch_timestamp_ms(),
    );
}

/// Payer approval for manual, verified deliverable, or matured time-gated milestones.
public entry fun approve_and_release<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    attestation_registry: &mut AttestationRegistry,
    reputation_ledger: &mut ReputationLedger,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    assert_payer(relationship, ctx);
    assert_releasable(relationship, milestone_index, false, ctx);
    release_and_attest(
        relationship,
        milestone_index,
        attestation_registry,
        reputation_ledger,
        ctx,
    );
}

public entry fun operator_approve_and_release<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    operator_cap: &OperatorCap,
    revoked_caps: &RevokedCaps,
    attestation_registry: &mut AttestationRegistry,
    reputation_ledger: &mut ReputationLedger,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    agent_policy::validate_operator(
        operator_cap,
        revoked_caps,
        object::id(relationship),
        0,
        ctx,
    );
    assert_releasable(relationship, milestone_index, false, ctx);
    release_and_attest(
        relationship,
        milestone_index,
        attestation_registry,
        reputation_ledger,
        ctx,
    );
}

public entry fun auto_release<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    agent_cap: &mut AgentCap,
    revoked_caps: &RevokedCaps,
    attestation_registry: &mut AttestationRegistry,
    reputation_ledger: &mut ReputationLedger,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    agent_policy::validate_agent(
        agent_cap,
        revoked_caps,
        object::id(relationship),
        agent_policy::action_auto_release(),
        ctx,
    );
    assert_releasable(relationship, milestone_index, true, ctx);
    release_and_attest(
        relationship,
        milestone_index,
        attestation_registry,
        reputation_ledger,
        ctx,
    );
}

public entry fun raise_dispute<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    reason_hash: vector<u8>,
    reputation_ledger: &mut ReputationLedger,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    assert_payer(relationship, ctx);
    raise_dispute_internal(relationship, milestone_index, reason_hash, reputation_ledger, ctx);
}

public entry fun operator_raise_dispute<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    reason_hash: vector<u8>,
    operator_cap: &OperatorCap,
    revoked_caps: &RevokedCaps,
    reputation_ledger: &mut ReputationLedger,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    agent_policy::validate_operator(
        operator_cap,
        revoked_caps,
        object::id(relationship),
        2,
        ctx,
    );
    raise_dispute_internal(relationship, milestone_index, reason_hash, reputation_ledger, ctx);
}

public entry fun resolve_dispute<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    resolution: u8,
    _admin_cap: &AdminCap,
    attestation_registry: &mut AttestationRegistry,
    reputation_ledger: &mut ReputationLedger,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    assert!(
        resolution == DISPUTE_RESOLVED_RECIPIENT || resolution == DISPUTE_RESOLVED_PAYER,
        errors::invalid_dispute_status(),
    );
    let milestone = borrow_milestone_mut(relationship, milestone_index);
    assert!(milestone.status == STATUS_DISPUTED, errors::wrong_status());
    assert!(milestone.dispute_status == DISPUTE_OPEN, errors::wrong_status());
    milestone.dispute_status = resolution;
    if (resolution == DISPUTE_RESOLVED_RECIPIENT) {
        release_and_attest(
            relationship,
            milestone_index,
            attestation_registry,
            reputation_ledger,
            ctx,
        );
    } else {
        cancel_and_refund(relationship, milestone_index, reputation_ledger, ctx);
    };
    events::emit_dispute_resolved(
        object::id(relationship),
        milestone_index,
        ctx.sender(),
        resolution,
        ctx.epoch_timestamp_ms(),
    );
}

public entry fun cancel_milestone<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    reputation_ledger: &mut ReputationLedger,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    assert_payer(relationship, ctx);
    assert!(get_milestone_status(relationship, milestone_index) == STATUS_PENDING, errors::wrong_status());
    cancel_and_refund(relationship, milestone_index, reputation_ledger, ctx);
}

public entry fun operator_cancel_milestone<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    operator_cap: &OperatorCap,
    revoked_caps: &RevokedCaps,
    reputation_ledger: &mut ReputationLedger,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    agent_policy::validate_operator(
        operator_cap,
        revoked_caps,
        object::id(relationship),
        1,
        ctx,
    );
    assert!(get_milestone_status(relationship, milestone_index) == STATUS_PENDING, errors::wrong_status());
    cancel_and_refund(relationship, milestone_index, reputation_ledger, ctx);
}

/// Cancels only remaining pending milestones. Submitted, verified, and disputed
/// milestones must be explicitly approved, rejected, or resolved.
public entry fun cancel_remaining<T>(
    relationship: &mut PaymentRelationship<T>,
    reputation_ledger: &mut ReputationLedger,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    assert_payer(relationship, ctx);
    let mut i = 0;
    while (i < relationship.milestones.length()) {
        if (relationship.milestones[i].status == STATUS_PENDING) {
            cancel_and_refund(relationship, i, reputation_ledger, ctx);
        };
        i = i + 1;
    };
    update_relationship_status(relationship);
}

fun raise_dispute_internal<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    reason_hash: vector<u8>,
    reputation_ledger: &mut ReputationLedger,
    ctx: &mut TxContext,
) {
    assert!(reason_hash.length() == 32, errors::invalid_length());
    let relationship_id = object::id(relationship);
    let recipient = relationship.recipient;
    let (event_reason_hash, dispute_timestamp) = {
        let milestone = borrow_milestone_mut(relationship, milestone_index);
        assert!(
            milestone.status == STATUS_SUBMITTED || milestone.status == STATUS_CONDITION_MET,
            errors::wrong_status(),
        );
        assert!(milestone.dispute_status == DISPUTE_NONE, errors::dispute_open());
        milestone.status = STATUS_DISPUTED;
        milestone.dispute_status = DISPUTE_OPEN;
        milestone.dispute_reason_hash = reason_hash;
        milestone.dispute_raised_timestamp = ctx.epoch_timestamp_ms();
        (milestone.dispute_reason_hash, milestone.dispute_raised_timestamp)
    };
    relationship.dispute_count = relationship.dispute_count + 1;
    relationship.version = relationship.version + 1;
    reputation_ledger::record_dispute(reputation_ledger, recipient);
    events::emit_dispute_raised(
        relationship_id,
        milestone_index,
        ctx.sender(),
        event_reason_hash,
        dispute_timestamp,
    );
}

fun assert_releasable<T>(
    relationship: &PaymentRelationship<T>,
    milestone_index: u64,
    automatic: bool,
    ctx: &TxContext,
) {
    assert!(milestone_index < relationship.milestones.length(), errors::invalid_milestone_index());
    let milestone = &relationship.milestones[milestone_index];
    assert!(
        milestone.dispute_status == DISPUTE_NONE
            || milestone.dispute_status == DISPUTE_RESOLVED_RECIPIENT,
        errors::dispute_open(),
    );
    if (automatic) {
        assert!(milestone.release_policy == RELEASE_AUTO_AFTER_CHALLENGE, errors::operator_action_not_allowed());
    };
    if (milestone.condition_type == CONDITION_MANUAL) {
        assert!(!automatic && milestone.status == STATUS_PENDING, errors::condition_not_met());
    } else if (milestone.condition_type == CONDITION_TIME_GATED) {
        assert!(milestone.status == STATUS_PENDING, errors::wrong_status());
        assert!(ctx.epoch_timestamp_ms() >= decode_u64(&milestone.requirement), errors::condition_not_met());
    } else {
        assert!(milestone.status == STATUS_CONDITION_MET, errors::condition_not_met());
        if (automatic) {
            assert!(
                milestone.challenge_deadline > 0
                    && ctx.epoch_timestamp_ms() >= milestone.challenge_deadline,
                errors::challenge_window_open(),
            );
        };
    };
}

fun release_and_attest<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    attestation_registry: &mut AttestationRegistry,
    reputation_ledger: &mut ReputationLedger,
    ctx: &mut TxContext,
) {
    let relationship_id = object::id(relationship);
    let payer = relationship.payer;
    let recipient = relationship.recipient;
    let created_at = relationship.created_at;
    let walrus_memory_space_id = relationship.walrus_memory_space_id;
    let milestone = borrow_milestone_mut(relationship, milestone_index);
    let had_dispute = milestone.dispute_status != DISPUTE_NONE;
    milestone.status = STATUS_RELEASED;
    milestone.release_timestamp = ctx.epoch_timestamp_ms();
    let condition_type = milestone.condition_type;
    let blob_id = milestone.submitted_blob_id;
    let evidence_hash = milestone.verification_evidence_hash;
    let release_timestamp = milestone.release_timestamp;
    let balance = relationship.escrow_balances[milestone_index].withdraw_all();
    let amount = balance.value();
    transfer::public_transfer(coin::from_balance(balance, ctx), recipient);
    relationship.completed_cycles = relationship.completed_cycles + 1;
    relationship.total_released_amount = relationship.total_released_amount + amount;
    relationship.version = relationship.version + 1;
    update_relationship_status(relationship);
    completion_attestation::mint(
        relationship_id,
        milestone_index,
        payer,
        recipient,
        amount,
        condition_type,
        blob_id,
        evidence_hash,
        walrus_memory_space_id,
        created_at,
        release_timestamp,
        had_dispute,
        attestation_registry,
        ctx,
    );
    reputation_ledger::record_release(
        reputation_ledger,
        recipient,
        amount,
        release_timestamp - created_at,
    );
    events::emit_milestone_released(
        relationship_id,
        milestone_index,
        payer,
        recipient,
        amount,
        blob_id,
        release_timestamp,
    );
}

fun cancel_and_refund<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
    reputation_ledger: &mut ReputationLedger,
    ctx: &mut TxContext,
) {
    let relationship_id = object::id(relationship);
    let payer = relationship.payer;
    let recipient = relationship.recipient;
    let milestone = borrow_milestone_mut(relationship, milestone_index);
    assert!(milestone.status != STATUS_RELEASED && milestone.status != STATUS_CANCELLED, errors::wrong_status());
    milestone.status = STATUS_CANCELLED;
    let balance = relationship.escrow_balances[milestone_index].withdraw_all();
    let amount = balance.value();
    if (amount > 0) {
        transfer::public_transfer(coin::from_balance(balance, ctx), payer);
    } else {
        balance.destroy_zero();
    };
    relationship.version = relationship.version + 1;
    reputation_ledger::record_cancellation(reputation_ledger, recipient);
    update_relationship_status(relationship);
    events::emit_milestone_cancelled(
        relationship_id,
        milestone_index,
        payer,
        amount,
        ctx.epoch_timestamp_ms(),
    );
    events::emit_relationship_cancelled(
        relationship_id,
        payer,
        amount,
        ctx.epoch_timestamp_ms(),
    );
}

fun assert_payer<T>(relationship: &PaymentRelationship<T>, ctx: &TxContext) {
    assert!(ctx.sender() == relationship.payer, errors::payer_mismatch());
}

fun borrow_milestone_mut<T>(
    relationship: &mut PaymentRelationship<T>,
    milestone_index: u64,
): &mut Milestone {
    assert!(milestone_index < relationship.milestones.length(), errors::invalid_milestone_index());
    &mut relationship.milestones[milestone_index]
}

fun update_relationship_status<T>(relationship: &mut PaymentRelationship<T>) {
    let mut all_released = true;
    let mut all_cancelled = true;
    let mut all_terminal = true;
    let mut i = 0;
    while (i < relationship.milestones.length()) {
        let status = relationship.milestones[i].status;
        if (status != STATUS_RELEASED) all_released = false;
        if (status != STATUS_CANCELLED) all_cancelled = false;
        if (status != STATUS_RELEASED && status != STATUS_CANCELLED) all_terminal = false;
        i = i + 1;
    };
    if (all_released) {
        relationship.status = REL_COMPLETED;
    } else if (all_cancelled) {
        relationship.status = REL_CANCELLED;
    } else if (all_terminal) {
        relationship.status = REL_COMPLETED;
    } else {
        relationship.status = REL_ACTIVE;
    };
}

fun decode_u64(bytes: &vector<u8>): u64 {
    assert!(bytes.length() > 0 && bytes.length() <= 8, errors::invalid_length());
    let mut value = 0;
    let mut i = 0;
    while (i < bytes.length()) {
        value = (value * 256) + (*bytes.borrow(i) as u64);
        i = i + 1;
    };
    value
}

public fun get_relationship_status<T>(r: &PaymentRelationship<T>): u8 { r.status }
public fun get_milestone_status<T>(r: &PaymentRelationship<T>, index: u64): u8 {
    assert!(index < r.milestones.length(), errors::invalid_milestone_index());
    r.milestones[index].status
}
public fun get_milestone_count<T>(r: &PaymentRelationship<T>): u64 { r.milestones.length() }
public fun get_completed_cycles<T>(r: &PaymentRelationship<T>): u64 { r.completed_cycles }
public fun get_total_released_amount<T>(r: &PaymentRelationship<T>): u64 { r.total_released_amount }
public fun get_dispute_count<T>(r: &PaymentRelationship<T>): u64 { r.dispute_count }
public fun get_walrus_memory_space_id<T>(r: &PaymentRelationship<T>): vector<u8> { r.walrus_memory_space_id }
public fun payer<T>(r: &PaymentRelationship<T>): address { r.payer }
public fun recipient<T>(r: &PaymentRelationship<T>): address { r.recipient }
public fun created_at<T>(r: &PaymentRelationship<T>): u64 { r.created_at }
public fun contract_version<T>(r: &PaymentRelationship<T>): u64 { r.contract_version }
public fun get_challenge_deadline<T>(r: &PaymentRelationship<T>, index: u64): u64 {
    assert!(index < r.milestones.length(), errors::invalid_milestone_index());
    r.milestones[index].challenge_deadline
}
