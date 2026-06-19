#[test_only]
module bondflow::bondflow_tests;

use sui::test_scenario::{Self as ts, Scenario};
use sui::coin;
use sui::sui::SUI;
use bondflow::protocol_state::{Self, ProtocolState, AdminCap};
use bondflow::agent_policy::{Self, AgentCap, OperatorCap, RevokedCaps};
use bondflow::payment_relationship::{Self, PaymentRelationship};
use bondflow::completion_attestation::{Self, CompletionAttestation, AttestationRegistry};
use bondflow::reputation_ledger::{Self, ReputationLedger};
use bondflow::reputation_proof::{Self, ReputationProof, ProofRegistry};

fun admin(): address { @0xAD }
fun payer(): address { @0x11 }
fun recipient(): address { @0x22 }
fun agent(): address { @0x33 }
fun operator(): address { @0x44 }
fun space_id(): vector<u8> { x"0000000000000000000000000000000000000000000000000000000000000000" }
fun blob_id(): vector<u8> { x"1111111111111111111111111111111111111111111111111111111111111111" }
fun second_blob_id(): vector<u8> { x"4444444444444444444444444444444444444444444444444444444444444444" }
fun evidence_hash(): vector<u8> { x"2222222222222222222222222222222222222222222222222222222222222222" }
fun reason_hash(): vector<u8> { x"3333333333333333333333333333333333333333333333333333333333333333" }

fun setup(): Scenario {
    let mut scenario = ts::begin(admin());
    protocol_state::init_for_testing(ts::ctx(&mut scenario));
    agent_policy::init_for_testing(ts::ctx(&mut scenario));
    completion_attestation::init_for_testing(ts::ctx(&mut scenario));
    reputation_ledger::init_for_testing(ts::ctx(&mut scenario));
    reputation_proof::init_for_testing(ts::ctx(&mut scenario));
    scenario
}

fun create_manual(scenario: &mut Scenario, amount: u64) {
    let state = ts::take_shared<ProtocolState>(scenario);
    let mut revoked = ts::take_shared<RevokedCaps>(scenario);
    payment_relationship::create(
        recipient(),
        vector[coin::mint_for_testing<SUI>(amount, ts::ctx(scenario))],
        vector[payment_relationship::condition_manual()],
        vector[b"Payer approval"],
        vector[payment_relationship::release_payer_approval()],
        b"manual",
        space_id(),
        @0x0,
        0,
        0,
        &mut revoked,
        &state,
        ts::ctx(scenario),
    );
    ts::return_shared(revoked);
    ts::return_shared(state);
}

fun create_deliverable(scenario: &mut Scenario, release_policy: u8) {
    let state = ts::take_shared<ProtocolState>(scenario);
    let mut revoked = ts::take_shared<RevokedCaps>(scenario);
    payment_relationship::create(
        recipient(),
        vector[coin::mint_for_testing<SUI>(500_000_000, ts::ctx(scenario))],
        vector[payment_relationship::condition_deliverable()],
        vector[b"Upload the completed logo"],
        vector[release_policy],
        b"logo",
        space_id(),
        agent(),
        200_000,
        10,
        &mut revoked,
        &state,
        ts::ctx(scenario),
    );
    ts::return_shared(revoked);
    ts::return_shared(state);
}

#[test]
fun test_manual_payer_approval_mints_attestation_and_reputation() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_manual(&mut scenario, 500_000_000);

    ts::next_tx(&mut scenario, payer());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::approve_and_release(
            &mut relationship, 0, &mut attestations, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        assert!(payment_relationship::get_relationship_status(&relationship) == payment_relationship::rel_completed(), 0);
        ts::return_shared(relationship);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, recipient());
    {
        let attestation = ts::take_from_sender<CompletionAttestation>(&scenario);
        assert!(completion_attestation::attestation_amount(&attestation) == 500_000_000, 0);
        assert!(
            completion_attestation::attestation_condition_type(&attestation)
                == payment_relationship::condition_manual(),
            0,
        );
        ts::return_to_sender(&scenario, attestation);
    };

    ts::next_tx(&mut scenario, recipient());
    {
        let ledger = ts::take_shared<ReputationLedger>(&scenario);
        let mut registry = ts::take_shared<ProofRegistry>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        reputation_proof::mint(&ledger, space_id(), &mut registry, &state, ts::ctx(&mut scenario));
        ts::return_shared(ledger);
        ts::return_shared(registry);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, recipient());
    {
        let proof = ts::take_from_sender<ReputationProof>(&scenario);
        assert!(reputation_proof::get_owner(&proof) == recipient(), 0);
        assert!(reputation_proof::get_successful_count(&proof) == 1, 0);
        assert!(reputation_proof::get_total_volume(&proof) == 500_000_000, 0);
        ts::return_to_sender(&scenario, proof);
    };
    ts::end(scenario);
}

#[test]
fun test_recipient_submit_agent_verify_payer_release() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_deliverable(&mut scenario, payment_relationship::release_payer_approval());

    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(
            &mut relationship, 0, blob_id(), &state, ts::ctx(&mut scenario),
        );
        assert!(payment_relationship::get_milestone_status(&relationship, 0) == payment_relationship::status_submitted(), 0);
        ts::return_shared(relationship);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, agent());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::verify_deliverable(
            &mut relationship, 0, blob_id(), evidence_hash(), &mut cap, &revoked, &state, ts::ctx(&mut scenario),
        );
        assert!(payment_relationship::get_milestone_status(&relationship, 0) == payment_relationship::status_condition_met(), 0);
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, payer());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::approve_and_release(
            &mut relationship, 0, &mut attestations, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, recipient());
    {
        let attestation = ts::take_from_sender<CompletionAttestation>(&scenario);
        assert!(completion_attestation::attestation_amount(&attestation) == 500_000_000, 0);
        assert!(
            completion_attestation::attestation_condition_type(&attestation)
                == payment_relationship::condition_deliverable(),
            0,
        );
        ts::return_to_sender(&scenario, attestation);
    };

    ts::next_tx(&mut scenario, recipient());
    {
        let ledger = ts::take_shared<ReputationLedger>(&scenario);
        let mut registry = ts::take_shared<ProofRegistry>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        reputation_proof::mint(&ledger, space_id(), &mut registry, &state, ts::ctx(&mut scenario));
        ts::return_shared(ledger);
        ts::return_shared(registry);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, recipient());
    {
        let proof = ts::take_from_sender<ReputationProof>(&scenario);
        assert!(reputation_proof::get_owner(&proof) == recipient(), 0);
        assert!(reputation_proof::get_successful_count(&proof) == 1, 0);
        assert!(reputation_proof::get_total_volume(&proof) == 500_000_000, 0);
        ts::return_to_sender(&scenario, proof);
    };
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 2000)]
fun test_payer_cannot_mint_recipient_reputation_proof() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_manual(&mut scenario, 500_000_000);

    ts::next_tx(&mut scenario, payer());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::approve_and_release(
            &mut relationship, 0, &mut attestations, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, payer());
    {
        let ledger = ts::take_shared<ReputationLedger>(&scenario);
        let mut registry = ts::take_shared<ProofRegistry>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        reputation_proof::mint(&ledger, space_id(), &mut registry, &state, ts::ctx(&mut scenario));
        ts::return_shared(ledger);
        ts::return_shared(registry);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 3011)]
fun test_non_recipient_cannot_submit() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_deliverable(&mut scenario, payment_relationship::release_payer_approval());
    ts::next_tx(&mut scenario, operator());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(
            &mut relationship, 0, blob_id(), &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test]
fun test_workspace_operator_can_release() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_manual(&mut scenario, 100);
    ts::next_tx(&mut scenario, payer());
    {
        let relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut revoked = ts::take_shared<RevokedCaps>(&scenario);
        payment_relationship::grant_operator_cap(
            &relationship, operator(), 3600, true, true, true, &mut revoked, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(revoked);
    };
    ts::next_tx(&mut scenario, operator());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let cap = ts::take_from_sender<OperatorCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::operator_approve_and_release(
            &mut relationship, 0, &cap, &revoked, &mut attestations, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 3010)]
fun test_auto_release_blocked_during_challenge_window() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_deliverable(&mut scenario, payment_relationship::release_auto_after_challenge());
    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(&mut relationship, 0, blob_id(), &state, ts::ctx(&mut scenario));
        ts::return_shared(relationship);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, agent());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::verify_deliverable(
            &mut relationship, 0, blob_id(), evidence_hash(), &mut cap, &revoked, &state, ts::ctx(&mut scenario),
        );
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        payment_relationship::auto_release(
            &mut relationship, 0, &mut cap, &revoked, &mut attestations, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test]
fun test_partial_completion_allows_remaining_cancellation() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    {
        let state = ts::take_shared<ProtocolState>(&scenario);
        let mut revoked = ts::take_shared<RevokedCaps>(&scenario);
        payment_relationship::create(
            recipient(),
            vector[
                coin::mint_for_testing<SUI>(100, ts::ctx(&mut scenario)),
                coin::mint_for_testing<SUI>(200, ts::ctx(&mut scenario)),
            ],
            vector[payment_relationship::condition_manual(), payment_relationship::condition_manual()],
            vector[b"one", b"two"],
            vector[payment_relationship::release_payer_approval(), payment_relationship::release_payer_approval()],
            b"partial",
            space_id(),
            @0x0,
            0,
            0,
            &mut revoked,
            &state,
            ts::ctx(&mut scenario),
        );
        ts::return_shared(revoked);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, payer());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::approve_and_release(
            &mut relationship, 0, &mut attestations, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        payment_relationship::cancel_remaining(
            &mut relationship, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        assert!(payment_relationship::get_milestone_status(&relationship, 1) == payment_relationship::status_cancelled(), 0);
        ts::return_shared(relationship);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test]
fun test_dispute_resolution_and_reputation_snapshot() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_deliverable(&mut scenario, payment_relationship::release_payer_approval());
    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(&mut relationship, 0, blob_id(), &state, ts::ctx(&mut scenario));
        ts::return_shared(relationship);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, payer());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::raise_dispute(
            &mut relationship, 0, reason_hash(), &mut ledger, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, admin());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::resolve_dispute(
            &mut relationship,
            0,
            payment_relationship::dispute_resolved_recipient(),
            &admin_cap,
            &mut attestations,
            &mut ledger,
            &state,
            ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, admin_cap);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, recipient());
    {
        let ledger = ts::take_shared<ReputationLedger>(&scenario);
        let mut registry = ts::take_shared<ProofRegistry>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        reputation_proof::mint(&ledger, space_id(), &mut registry, &state, ts::ctx(&mut scenario));
        ts::return_shared(ledger);
        ts::return_shared(registry);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, recipient());
    {
        let proof = ts::take_from_sender<ReputationProof>(&scenario);
        assert!(reputation_proof::get_successful_count(&proof) == 1, 0);
        assert!(reputation_proof::get_disputed_count(&proof) == 1, 0);
        assert!(reputation_proof::get_total_volume(&proof) == 500_000_000, 0);
        ts::return_to_sender(&scenario, proof);
    };
    ts::end(scenario);
}

#[test]
fun test_rejected_deliverable_can_be_resubmitted_and_verified() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_deliverable(&mut scenario, payment_relationship::release_payer_approval());

    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(&mut relationship, 0, blob_id(), &state, ts::ctx(&mut scenario));
        ts::return_shared(relationship);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, agent());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::reject_deliverable(
            &mut relationship, 0, evidence_hash(), &mut cap, &revoked, &state, ts::ctx(&mut scenario),
        );
        assert!(payment_relationship::get_milestone_status(&relationship, 0) == payment_relationship::status_pending(), 0);
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(
            &mut relationship, 0, second_blob_id(), &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, agent());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::verify_deliverable(
            &mut relationship, 0, second_blob_id(), evidence_hash(), &mut cap, &revoked, &state, ts::ctx(&mut scenario),
        );
        assert!(payment_relationship::get_milestone_status(&relationship, 0) == payment_relationship::status_condition_met(), 0);
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test]
fun test_auto_release_succeeds_after_challenge_window() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_deliverable(&mut scenario, payment_relationship::release_auto_after_challenge());

    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(&mut relationship, 0, blob_id(), &state, ts::ctx(&mut scenario));
        ts::return_shared(relationship);
        ts::return_shared(state);
    };

    ts::next_tx(&mut scenario, agent());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::verify_deliverable(
            &mut relationship, 0, blob_id(), evidence_hash(), &mut cap, &revoked, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(state);
    };

    let next = ts::ctx_builder_from_sender(agent()).set_epoch(1).set_epoch_timestamp(86_400_001);
    ts::next_with_context(&mut scenario, next);
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::auto_release(
            &mut relationship, 0, &mut cap, &revoked, &mut attestations, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        assert!(payment_relationship::get_milestone_status(&relationship, 0) == payment_relationship::status_released(), 0);
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test]
fun test_time_gated_release_after_configured_timestamp() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    {
        let state = ts::take_shared<ProtocolState>(&scenario);
        let mut revoked = ts::take_shared<RevokedCaps>(&scenario);
        payment_relationship::create(
            recipient(),
            vector[coin::mint_for_testing<SUI>(100, ts::ctx(&mut scenario))],
            vector[payment_relationship::condition_time_gated()],
            vector[x"00000000000003E8"],
            vector[payment_relationship::release_payer_approval()],
            b"time",
            space_id(),
            @0x0,
            0,
            0,
            &mut revoked,
            &state,
            ts::ctx(&mut scenario),
        );
        ts::return_shared(revoked);
        ts::return_shared(state);
    };

    let next = ts::ctx_builder_from_sender(payer()).set_epoch(1).set_epoch_timestamp(1_000);
    ts::next_with_context(&mut scenario, next);
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::approve_and_release(
            &mut relationship, 0, &mut attestations, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 1009)]
fun test_recipient_cannot_approve_release() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_manual(&mut scenario, 100);
    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut attestations = ts::take_shared<AttestationRegistry>(&scenario);
        let mut ledger = ts::take_shared<ReputationLedger>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::approve_and_release(
            &mut relationship, 0, &mut attestations, &mut ledger, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(attestations);
        ts::return_shared(ledger);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 3000)]
fun test_expired_agent_cap_cannot_verify() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    {
        let state = ts::take_shared<ProtocolState>(&scenario);
        let mut revoked = ts::take_shared<RevokedCaps>(&scenario);
        payment_relationship::create(
            recipient(),
            vector[coin::mint_for_testing<SUI>(100, ts::ctx(&mut scenario))],
            vector[payment_relationship::condition_deliverable()],
            vector[b"work"],
            vector[payment_relationship::release_payer_approval()],
            b"expiry",
            space_id(),
            agent(),
            1,
            2,
            &mut revoked,
            &state,
            ts::ctx(&mut scenario),
        );
        ts::return_shared(revoked);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(&mut relationship, 0, blob_id(), &state, ts::ctx(&mut scenario));
        ts::return_shared(relationship);
        ts::return_shared(state);
    };
    let next = ts::ctx_builder_from_sender(agent()).set_epoch(1).set_epoch_timestamp(1_001);
    ts::next_with_context(&mut scenario, next);
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::verify_deliverable(
            &mut relationship, 0, blob_id(), evidence_hash(), &mut cap, &revoked, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 3001)]
fun test_revoked_agent_cap_cannot_verify() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    create_deliverable(&mut scenario, payment_relationship::release_payer_approval());
    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(&mut relationship, 0, blob_id(), &state, ts::ctx(&mut scenario));
        ts::return_shared(relationship);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, agent());
    let cap_id = {
        let cap = ts::take_from_sender<AgentCap>(&scenario);
        let id = object::id(&cap);
        ts::return_to_sender(&scenario, cap);
        id
    };
    ts::next_tx(&mut scenario, payer());
    {
        let relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut revoked = ts::take_shared<RevokedCaps>(&scenario);
        payment_relationship::revoke_cap(
            &relationship, cap_id, &mut revoked, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(revoked);
    };
    ts::next_tx(&mut scenario, agent());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::verify_deliverable(
            &mut relationship, 0, blob_id(), evidence_hash(), &mut cap, &revoked, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 1000)]
fun test_manual_milestone_rejects_auto_release_policy() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    {
        let state = ts::take_shared<ProtocolState>(&scenario);
        let mut revoked = ts::take_shared<RevokedCaps>(&scenario);
        payment_relationship::create(
            recipient(),
            vector[coin::mint_for_testing<SUI>(100, ts::ctx(&mut scenario))],
            vector[payment_relationship::condition_manual()],
            vector[b"manual"],
            vector[payment_relationship::release_auto_after_challenge()],
            b"invalid",
            space_id(),
            @0x0,
            0,
            0,
            &mut revoked,
            &state,
            ts::ctx(&mut scenario),
        );
        ts::return_shared(revoked);
        ts::return_shared(state);
    };
    ts::end(scenario);
}

#[test, expected_failure(abort_code = 3005)]
fun test_agent_cap_enforces_action_limit() {
    let mut scenario = setup();
    ts::next_tx(&mut scenario, payer());
    {
        let state = ts::take_shared<ProtocolState>(&scenario);
        let mut revoked = ts::take_shared<RevokedCaps>(&scenario);
        payment_relationship::create(
            recipient(),
            vector[coin::mint_for_testing<SUI>(100, ts::ctx(&mut scenario))],
            vector[payment_relationship::condition_deliverable()],
            vector[b"work"],
            vector[payment_relationship::release_payer_approval()],
            b"limit",
            space_id(),
            agent(),
            3600,
            1,
            &mut revoked,
            &state,
            ts::ctx(&mut scenario),
        );
        ts::return_shared(revoked);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(&mut relationship, 0, blob_id(), &state, ts::ctx(&mut scenario));
        ts::return_shared(relationship);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, agent());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::reject_deliverable(
            &mut relationship, 0, evidence_hash(), &mut cap, &revoked, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, recipient());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::submit_deliverable(
            &mut relationship, 0, second_blob_id(), &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_shared(state);
    };
    ts::next_tx(&mut scenario, agent());
    {
        let mut relationship = ts::take_shared<PaymentRelationship<SUI>>(&scenario);
        let mut cap = ts::take_from_sender<AgentCap>(&scenario);
        let revoked = ts::take_shared<RevokedCaps>(&scenario);
        let state = ts::take_shared<ProtocolState>(&scenario);
        payment_relationship::verify_deliverable(
            &mut relationship, 0, second_blob_id(), evidence_hash(), &mut cap, &revoked, &state, ts::ctx(&mut scenario),
        );
        ts::return_shared(relationship);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(revoked);
        ts::return_shared(state);
    };
    ts::end(scenario);
}
