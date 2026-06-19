/// Shared factual outcome ledger used to build portable reputation proofs.
module bondflow::reputation_ledger;

use sui::table::{Self, Table};

public struct ReputationStats has store, drop {
    released_count: u64,
    cancelled_count: u64,
    disputed_count: u64,
    total_volume: u64,
    total_completion_time_ms: u64,
}

public struct ReputationLedger has key {
    id: UID,
    stats: Table<address, ReputationStats>,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(ReputationLedger {
        id: object::new(ctx),
        stats: table::new(ctx),
    });
}

public(package) fun record_release(
    ledger: &mut ReputationLedger,
    recipient: address,
    amount: u64,
    completion_time_ms: u64,
) {
    ensure(ledger, recipient);
    let stats = table::borrow_mut(&mut ledger.stats, recipient);
    stats.released_count = stats.released_count + 1;
    stats.total_volume = stats.total_volume + amount;
    stats.total_completion_time_ms = stats.total_completion_time_ms + completion_time_ms;
}

public(package) fun record_cancellation(ledger: &mut ReputationLedger, recipient: address) {
    ensure(ledger, recipient);
    let stats = table::borrow_mut(&mut ledger.stats, recipient);
    stats.cancelled_count = stats.cancelled_count + 1;
}

public(package) fun record_dispute(ledger: &mut ReputationLedger, recipient: address) {
    ensure(ledger, recipient);
    let stats = table::borrow_mut(&mut ledger.stats, recipient);
    stats.disputed_count = stats.disputed_count + 1;
}

fun ensure(ledger: &mut ReputationLedger, owner: address) {
    if (!table::contains(&ledger.stats, owner)) {
        table::add(&mut ledger.stats, owner, ReputationStats {
            released_count: 0,
            cancelled_count: 0,
            disputed_count: 0,
            total_volume: 0,
            total_completion_time_ms: 0,
        });
    };
}

public fun snapshot(
    ledger: &ReputationLedger,
    owner: address,
): (u64, u64, u64, u64, u64) {
    if (!table::contains(&ledger.stats, owner)) {
        return (0, 0, 0, 0, 0)
    };
    let stats = table::borrow(&ledger.stats, owner);
    (
        stats.released_count,
        stats.cancelled_count,
        stats.disputed_count,
        stats.total_volume,
        stats.total_completion_time_ms,
    )
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
