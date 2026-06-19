/// BondFlow protocol state module.
/// Manages the global operational state via a shared `ProtocolState` object
/// and a one-time `AdminCap` capability for privileged operations.
///
/// AdminCap scope is strictly limited to:
/// - Pausing/resuming the protocol
/// - Emergency fund recovery (dispute resolution)
/// AdminCap CANNOT access individual payment balances under normal operation.
module bondflow::protocol_state;

use bondflow::errors;
use bondflow::events;

// ============================================================
// Structs
// ============================================================

/// Global protocol state. The only shared object for protocol-level config.
public struct ProtocolState has key {
    id: UID,
    /// Whether the protocol is currently paused
    paused: bool,
    /// Protocol version for upgrade tracking (starts at 1)
    version: u64,
    /// Object ID of the AdminCap for reference/auditing
    admin_cap_id: ID,
}

/// Admin capability transferred to deployer at init.
public struct AdminCap has key, store {
    id: UID,
}

// ============================================================
// Init
// ============================================================

fun init(ctx: &mut TxContext) {
    let admin_cap = AdminCap { id: object::new(ctx) };
    let admin_cap_id = object::id(&admin_cap);

    let protocol_state = ProtocolState {
        id: object::new(ctx),
        paused: false,
        version: 1,
        admin_cap_id,
    };

    transfer::transfer(admin_cap, ctx.sender());
    transfer::share_object(protocol_state);
}

// ============================================================
// Admin Functions
// ============================================================

/// Pauses the protocol. Emits ProtocolPausedEvent.
public fun pause_protocol(
    _admin_cap: &AdminCap,
    state: &mut ProtocolState,
    ctx: &TxContext,
) {
    assert!(!state.paused, errors::protocol_paused());
    state.paused = true;
    events::emit_protocol_paused(ctx.sender(), ctx.epoch_timestamp_ms());
}

/// Resumes a paused protocol. Emits ProtocolResumedEvent.
public fun resume_protocol(
    _admin_cap: &AdminCap,
    state: &mut ProtocolState,
    ctx: &TxContext,
) {
    assert!(state.paused, errors::not_admin());
    state.paused = false;
    events::emit_protocol_resumed(ctx.sender(), ctx.epoch_timestamp_ms());
}

// ============================================================
// Internal Helpers
// ============================================================

/// Asserts the protocol is not paused. Called at the start of every state-changing function.
public(package) fun assert_not_paused(state: &ProtocolState) {
    assert!(!state.paused, errors::protocol_paused());
}

// ============================================================
// View Functions
// ============================================================

/// Returns whether the protocol is currently paused.
public fun is_paused(state: &ProtocolState): bool {
    state.paused
}

/// Returns the protocol version.
public fun version(state: &ProtocolState): u64 {
    state.version
}

// ============================================================
// Test-only helpers
// ============================================================

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
