/// Scoped capabilities for BondFlow v2 shared payment relationships.
module bondflow::agent_policy;

use sui::table::{Self, Table};
use bondflow::errors;
use bondflow::events;

const ACTION_VERIFY_DELIVERABLE: u8 = 0;
const ACTION_AUTO_RELEASE: u8 = 1;

public fun action_verify_deliverable(): u8 { ACTION_VERIFY_DELIVERABLE }
public fun action_auto_release(): u8 { ACTION_AUTO_RELEASE }

public struct AgentCap has key, store {
    id: UID,
    relationship_id: ID,
    expiry: u64,
    payer: address,
    agent: address,
    allowed_actions: vector<u8>,
    max_actions: u64,
    actions_used: u64,
}

public struct OperatorCap has key, store {
    id: UID,
    relationship_id: ID,
    payer: address,
    operator: address,
    expiry: u64,
    can_release: bool,
    can_cancel: bool,
    can_dispute: bool,
}

public struct RevokedCaps has key {
    id: UID,
    revoked: Table<ID, bool>,
    cap_relationships: Table<ID, ID>,
    cap_payers: Table<ID, address>,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(RevokedCaps {
        id: object::new(ctx),
        revoked: table::new(ctx),
        cap_relationships: table::new(ctx),
        cap_payers: table::new(ctx),
    });
}

public(package) fun create_agent_cap(
    relationship_id: ID,
    payer: address,
    agent: address,
    expiry_duration_s: u64,
    allowed_actions: vector<u8>,
    max_actions: u64,
    revoked_caps: &mut RevokedCaps,
    ctx: &mut TxContext,
): AgentCap {
    assert!(agent != @0x0, errors::zero_address());
    assert!(expiry_duration_s > 0, errors::invalid_expiry_duration());
    assert!(max_actions > 0, errors::cap_action_limit_exceeded());
    let cap = AgentCap {
        id: object::new(ctx),
        relationship_id,
        expiry: ctx.epoch_timestamp_ms() + (expiry_duration_s * 1000),
        payer,
        agent,
        allowed_actions,
        max_actions,
        actions_used: 0,
    };
    register_cap(object::id(&cap), relationship_id, payer, revoked_caps);
    events::emit_agent_cap_granted(
        object::id(&cap),
        relationship_id,
        agent,
        cap.expiry,
        cap.allowed_actions,
        max_actions,
        payer,
    );
    cap
}

public(package) fun create_operator_cap(
    relationship_id: ID,
    payer: address,
    operator: address,
    expiry_duration_s: u64,
    can_release: bool,
    can_cancel: bool,
    can_dispute: bool,
    revoked_caps: &mut RevokedCaps,
    ctx: &mut TxContext,
): OperatorCap {
    assert!(operator != @0x0 && operator != payer, errors::invalid_recipient());
    assert!(expiry_duration_s > 0, errors::invalid_expiry_duration());
    let cap = OperatorCap {
        id: object::new(ctx),
        relationship_id,
        payer,
        operator,
        expiry: ctx.epoch_timestamp_ms() + (expiry_duration_s * 1000),
        can_release,
        can_cancel,
        can_dispute,
    };
    register_cap(object::id(&cap), relationship_id, payer, revoked_caps);
    events::emit_operator_cap_granted(
        object::id(&cap),
        relationship_id,
        operator,
        cap.expiry,
        can_release,
        can_cancel,
        can_dispute,
        payer,
    );
    cap
}

fun register_cap(
    cap_id: ID,
    relationship_id: ID,
    payer: address,
    revoked_caps: &mut RevokedCaps,
) {
    table::add(&mut revoked_caps.cap_relationships, cap_id, relationship_id);
    table::add(&mut revoked_caps.cap_payers, cap_id, payer);
}

public(package) fun revoke_cap(
    cap_id: ID,
    relationship_id: ID,
    payer: address,
    revoked_caps: &mut RevokedCaps,
    ctx: &TxContext,
) {
    assert!(table::contains(&revoked_caps.cap_relationships, cap_id), errors::cap_revoked());
    assert!(
        *table::borrow(&revoked_caps.cap_relationships, cap_id) == relationship_id,
        errors::cap_relationship_mismatch(),
    );
    assert!(
        *table::borrow(&revoked_caps.cap_payers, cap_id) == payer,
        errors::grant_payer_mismatch(),
    );
    if (!table::contains(&revoked_caps.revoked, cap_id)) {
        table::add(&mut revoked_caps.revoked, cap_id, true);
    };
    events::emit_agent_cap_revoked(cap_id, relationship_id, payer, ctx.epoch_timestamp_ms());
}

public(package) fun validate_agent(
    cap: &mut AgentCap,
    revoked_caps: &RevokedCaps,
    relationship_id: ID,
    action: u8,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == cap.agent, errors::agent_mismatch());
    assert!(ctx.epoch_timestamp_ms() < cap.expiry, errors::cap_expired());
    assert!(!is_revoked(revoked_caps, object::id(cap)), errors::cap_revoked());
    assert!(cap.relationship_id == relationship_id, errors::cap_relationship_mismatch());
    assert!(contains_u8(&cap.allowed_actions, action), errors::condition_type_not_allowed());
    cap.actions_used = cap.actions_used + 1;
    assert!(cap.actions_used <= cap.max_actions, errors::cap_action_limit_exceeded());
}

public(package) fun validate_operator(
    cap: &OperatorCap,
    revoked_caps: &RevokedCaps,
    relationship_id: ID,
    action: u8,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == cap.operator, errors::operator_mismatch());
    assert!(ctx.epoch_timestamp_ms() < cap.expiry, errors::cap_expired());
    assert!(!is_revoked(revoked_caps, object::id(cap)), errors::cap_revoked());
    assert!(cap.relationship_id == relationship_id, errors::cap_relationship_mismatch());
    if (action == 0) {
        assert!(cap.can_release, errors::operator_action_not_allowed());
    } else if (action == 1) {
        assert!(cap.can_cancel, errors::operator_action_not_allowed());
    } else {
        assert!(cap.can_dispute, errors::operator_action_not_allowed());
    };
}

fun is_revoked(revoked_caps: &RevokedCaps, cap_id: ID): bool {
    table::contains(&revoked_caps.revoked, cap_id)
}

fun contains_u8(values: &vector<u8>, expected: u8): bool {
    let mut i = 0;
    while (i < values.length()) {
        if (*values.borrow(i) == expected) return true;
        i = i + 1;
    };
    false
}

public fun cap_relationship_id(cap: &AgentCap): ID { cap.relationship_id }
public fun cap_expiry(cap: &AgentCap): u64 { cap.expiry }
public fun cap_actions_used(cap: &AgentCap): u64 { cap.actions_used }
public fun cap_max_actions(cap: &AgentCap): u64 { cap.max_actions }
public fun cap_payer(cap: &AgentCap): address { cap.payer }
public fun operator_cap_operator(cap: &OperatorCap): address { cap.operator }

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
