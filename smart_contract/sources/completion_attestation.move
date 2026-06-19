/// Completion credentials minted atomically by relationship release functions.
module bondflow::completion_attestation;

use sui::table::{Self, Table};
use sui::vec_set::{Self, VecSet};
use bondflow::errors;
use bondflow::events;

public struct CompletionAttestation has key, store {
    id: UID,
    relationship_id: ID,
    milestone_index: u64,
    payer: address,
    recipient: address,
    amount: u64,
    condition_type: u8,
    deliverable_blob_id: vector<u8>,
    verification_evidence_hash: vector<u8>,
    walrus_memory_space_id: vector<u8>,
    relationship_created_at: u64,
    completion_timestamp: u64,
    completion_duration_ms: u64,
    milestone_had_dispute: bool,
    version: u64,
}

public struct AttestationRegistry has key {
    id: UID,
    attested: Table<ID, VecSet<u64>>,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(AttestationRegistry {
        id: object::new(ctx),
        attested: table::new(ctx),
    });
}

public(package) fun mint(
    relationship_id: ID,
    milestone_index: u64,
    payer: address,
    recipient: address,
    amount: u64,
    condition_type: u8,
    deliverable_blob_id: vector<u8>,
    verification_evidence_hash: vector<u8>,
    walrus_memory_space_id: vector<u8>,
    relationship_created_at: u64,
    completion_timestamp: u64,
    milestone_had_dispute: bool,
    registry: &mut AttestationRegistry,
    ctx: &mut TxContext,
) {
    assert_not_already_attested(registry, relationship_id, milestone_index);
    register_attestation(registry, relationship_id, milestone_index);
    let attestation = CompletionAttestation {
        id: object::new(ctx),
        relationship_id,
        milestone_index,
        payer,
        recipient,
        amount,
        condition_type,
        deliverable_blob_id,
        verification_evidence_hash,
        walrus_memory_space_id,
        relationship_created_at,
        completion_timestamp,
        completion_duration_ms: completion_timestamp - relationship_created_at,
        milestone_had_dispute,
        version: 0,
    };
    let attestation_id = object::id(&attestation);
    events::emit_completion_attestation_minted(
        attestation_id,
        relationship_id,
        milestone_index,
        payer,
        recipient,
        amount,
        condition_type,
        attestation.deliverable_blob_id,
        attestation.verification_evidence_hash,
        completion_timestamp,
    );
    transfer::transfer(attestation, recipient);
}

fun assert_not_already_attested(
    registry: &AttestationRegistry,
    relationship_id: ID,
    milestone_index: u64,
) {
    if (table::contains(&registry.attested, relationship_id)) {
        assert!(
            !table::borrow(&registry.attested, relationship_id).contains(&milestone_index),
            errors::attestation_already_exists(),
        );
    };
}

fun register_attestation(
    registry: &mut AttestationRegistry,
    relationship_id: ID,
    milestone_index: u64,
) {
    if (!table::contains(&registry.attested, relationship_id)) {
        let mut indices = vec_set::empty<u64>();
        indices.insert(milestone_index);
        table::add(&mut registry.attested, relationship_id, indices);
    } else {
        table::borrow_mut(&mut registry.attested, relationship_id).insert(milestone_index);
    };
}

public fun attestation_relationship_id(a: &CompletionAttestation): ID { a.relationship_id }
public fun attestation_milestone_index(a: &CompletionAttestation): u64 { a.milestone_index }
public fun attestation_recipient(a: &CompletionAttestation): address { a.recipient }
public fun attestation_payer(a: &CompletionAttestation): address { a.payer }
public fun attestation_amount(a: &CompletionAttestation): u64 { a.amount }
public fun attestation_completion_timestamp(a: &CompletionAttestation): u64 { a.completion_timestamp }
public fun attestation_completion_duration_ms(a: &CompletionAttestation): u64 { a.completion_duration_ms }
public fun attestation_condition_type(a: &CompletionAttestation): u8 { a.condition_type }
public fun attestation_milestone_had_dispute(a: &CompletionAttestation): bool { a.milestone_had_dispute }

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
