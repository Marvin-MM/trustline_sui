/// Portable factual reputation snapshots derived from the shared outcome ledger.
module bondflow::reputation_proof;

use sui::table::{Self, Table};
use bondflow::errors;
use bondflow::events;
use bondflow::protocol_state::{Self, ProtocolState};
use bondflow::reputation_ledger::{Self, ReputationLedger};

const BPS_MULTIPLIER: u64 = 10_000;

public struct ReputationProof has key, store {
    id: UID,
    owner: address,
    successful_milestone_count: u64,
    cancelled_count: u64,
    disputed_count: u64,
    total_volume_usdc: u64,
    completion_rate_bps: u64,
    avg_completion_time_ms: u64,
    walrus_attestation_space_id: vector<u8>,
    version: u64,
}

public struct ProofRegistry has key {
    id: UID,
    proofs: Table<address, ID>,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(ProofRegistry {
        id: object::new(ctx),
        proofs: table::new(ctx),
    });
}

public entry fun mint(
    ledger: &ReputationLedger,
    walrus_attestation_space_id: vector<u8>,
    registry: &mut ProofRegistry,
    protocol_state: &ProtocolState,
    ctx: &mut TxContext,
) {
    protocol_state::assert_not_paused(protocol_state);
    let owner = ctx.sender();
    assert!(walrus_attestation_space_id.length() == 32, errors::invalid_length());
    assert!(!table::contains(&registry.proofs, owner), errors::proof_already_exists());
    let (successful, cancelled, disputed, volume, total_time) =
        reputation_ledger::snapshot(ledger, owner);
    assert!(successful > 0, errors::no_completed_attestations());
    let proof = ReputationProof {
        id: object::new(ctx),
        owner,
        successful_milestone_count: successful,
        cancelled_count: cancelled,
        disputed_count: disputed,
        total_volume_usdc: volume,
        completion_rate_bps: completion_rate(successful, cancelled),
        avg_completion_time_ms: total_time / successful,
        walrus_attestation_space_id,
        version: 1,
    };
    let proof_id = object::id(&proof);
    table::add(&mut registry.proofs, owner, proof_id);
    emit_minted(&proof, ctx);
    transfer::transfer(proof, owner);
}

public entry fun update(
    proof: &mut ReputationProof,
    ledger: &ReputationLedger,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == proof.owner, errors::attestation_owner_mismatch());
    let (successful, cancelled, disputed, volume, total_time) =
        reputation_ledger::snapshot(ledger, proof.owner);
    assert!(successful > 0, errors::no_completed_attestations());
    proof.successful_milestone_count = successful;
    proof.cancelled_count = cancelled;
    proof.disputed_count = disputed;
    proof.total_volume_usdc = volume;
    proof.completion_rate_bps = completion_rate(successful, cancelled);
    proof.avg_completion_time_ms = total_time / successful;
    proof.version = proof.version + 1;
    events::emit_reputation_proof_updated(
        object::id(proof),
        proof.owner,
        successful,
        cancelled,
        disputed,
        volume,
        ctx.epoch_timestamp_ms(),
    );
}

public entry fun revoke(
    proof: ReputationProof,
    registry: &mut ProofRegistry,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == proof.owner, errors::attestation_owner_mismatch());
    let proof_id = object::id(&proof);
    if (table::contains(&registry.proofs, proof.owner)) {
        table::remove(&mut registry.proofs, proof.owner);
    };
    events::emit_reputation_proof_revoked(proof_id, proof.owner, ctx.epoch_timestamp_ms());
    let ReputationProof {
        id,
        owner: _,
        successful_milestone_count: _,
        cancelled_count: _,
        disputed_count: _,
        total_volume_usdc: _,
        completion_rate_bps: _,
        avg_completion_time_ms: _,
        walrus_attestation_space_id: _,
        version: _,
    } = proof;
    object::delete(id);
}

fun completion_rate(successful: u64, cancelled: u64): u64 {
    let total = successful + cancelled;
    if (total == 0) 0 else (successful * BPS_MULTIPLIER) / total
}

fun emit_minted(proof: &ReputationProof, ctx: &TxContext) {
    events::emit_reputation_proof_minted(
        object::id(proof),
        proof.owner,
        proof.successful_milestone_count,
        proof.cancelled_count,
        proof.disputed_count,
        proof.total_volume_usdc,
        proof.completion_rate_bps,
        proof.avg_completion_time_ms,
        proof.walrus_attestation_space_id,
        ctx.epoch_timestamp_ms(),
    );
}

public fun get_completion_rate_bps(p: &ReputationProof): u64 { p.completion_rate_bps }
public fun get_successful_count(p: &ReputationProof): u64 { p.successful_milestone_count }
public fun get_cancelled_count(p: &ReputationProof): u64 { p.cancelled_count }
public fun get_total_volume(p: &ReputationProof): u64 { p.total_volume_usdc }
public fun get_avg_completion_time_ms(p: &ReputationProof): u64 { p.avg_completion_time_ms }
public fun get_disputed_count(p: &ReputationProof): u64 { p.disputed_count }
public fun get_owner(p: &ReputationProof): address { p.owner }

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
