/**
 * Responsive HTML email templates with BondFlow branding.
 * One function per notification type.
 */

const BRAND_COLOR = '#6366f1';
const BG_COLOR = '#f8fafc';

function wrap(title: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px">
<tr><td style="padding:24px 0;text-align:center"><strong style="color:${BRAND_COLOR};font-size:24px">TrustLine</strong></td></tr>
<tr><td style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">${content}</td></tr>
<tr><td style="padding:24px;text-align:center;color:#94a3b8;font-size:12px">TrustLine — Payments are relationships, not just transactions.</td></tr>
</table></body></html>`;
}

export function relationshipCreated(p: { payerWallet: string; recipientWallet: string; milestoneCount: number; totalAmount: string; memo: string }): string {
  return wrap('New Payment Relationship', `<h2 style="color:#1e293b;margin:0 0 16px">New Payment Relationship Created</h2>
<p style="color:#475569">A new milestone-based payment relationship has been created.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px 0;color:#64748b">Payer</td><td style="padding:8px 0;font-family:monospace;font-size:13px">${p.payerWallet.slice(0, 10)}...${p.payerWallet.slice(-8)}</td></tr>
<tr><td style="padding:8px 0;color:#64748b">Recipient</td><td style="padding:8px 0;font-family:monospace;font-size:13px">${p.recipientWallet.slice(0, 10)}...${p.recipientWallet.slice(-8)}</td></tr>
<tr><td style="padding:8px 0;color:#64748b">Milestones</td><td style="padding:8px 0">${p.milestoneCount}</td></tr>
<tr><td style="padding:8px 0;color:#64748b">Total</td><td style="padding:8px 0;font-weight:bold">${p.totalAmount} USDC</td></tr>
<tr><td style="padding:8px 0;color:#64748b">Memo</td><td style="padding:8px 0">${p.memo}</td></tr></table>`);
}

export function milestoneConditionMet(p: { milestoneIndex: number; conditionType: string; relationshipId: string }): string {
  return wrap('Milestone Condition Met', `<h2 style="color:#1e293b;margin:0 0 16px">Milestone Condition Met</h2>
<p style="color:#475569">Milestone #${p.milestoneIndex + 1} condition has been fulfilled.</p>
<p style="color:#64748b">Type: <strong>${p.conditionType}</strong></p>
<p style="color:#64748b;font-size:13px">Relationship: ${p.relationshipId}</p>`);
}

export function milestoneReleased(p: { milestoneIndex: number; amount: string; recipientWallet: string }): string {
  return wrap('Milestone Released', `<h2 style="color:#1e293b;margin:0 0 16px">💸 Milestone Released</h2>
<p style="color:#475569">Milestone #${p.milestoneIndex + 1} has been released.</p>
<p style="color:#1e293b;font-size:20px;font-weight:bold">${p.amount} USDC</p>
<p style="color:#64748b">Sent to: <span style="font-family:monospace;font-size:13px">${p.recipientWallet.slice(0, 10)}...${p.recipientWallet.slice(-8)}</span></p>`);
}

export function disputeRaised(p: { milestoneIndex: number; raisedBy: string; relationshipId: string }): string {
  return wrap('Dispute Raised', `<h2 style="color:#ef4444;margin:0 0 16px">⚠️ Dispute Raised</h2>
<p style="color:#475569">A dispute has been raised on Milestone #${p.milestoneIndex + 1}.</p>
<p style="color:#64748b">Raised by: <span style="font-family:monospace;font-size:13px">${p.raisedBy.slice(0, 10)}...</span></p>`);
}

export function disputeResolved(p: { milestoneIndex: number; resolution: string; resolvedBy: string }): string {
  return wrap('Dispute Resolved', `<h2 style="color:#1e293b;margin:0 0 16px">Dispute Resolved</h2>
<p style="color:#475569">Milestone #${p.milestoneIndex + 1} dispute has been resolved.</p>
<p style="color:#64748b">Resolution: <strong>${p.resolution}</strong></p>`);
}

export function anomalyFlagged(p: { reason: string; severity: string; relationshipId: string }): string {
  return wrap('Anomaly Detected', `<h2 style="color:#f59e0b;margin:0 0 16px">🔍 Anomaly Flagged</h2>
<p style="color:#475569">The AI agent has flagged a potential anomaly.</p>
<p style="color:#64748b">Severity: <strong style="color:${p.severity === 'high' ? '#ef4444' : p.severity === 'medium' ? '#f59e0b' : '#22c55e'}">${p.severity.toUpperCase()}</strong></p>
<p style="color:#475569">${p.reason}</p>`);
}

export function reputationProofMinted(p: { walletAddress: string; successfulCount: number; completionRate: number }): string {
  return wrap('Reputation Proof Minted', `<h2 style="color:${BRAND_COLOR};margin:0 0 16px">🏆 Reputation Proof Minted</h2>
<p style="color:#475569">An on-chain reputation proof has been minted.</p>
<p style="color:#64748b">Completed milestones: <strong>${p.successfulCount}</strong></p>
<p style="color:#64748b">Completion rate: <strong>${(p.completionRate / 100).toFixed(1)}%</strong></p>`);
}

export function teamMemberInvited(p: { tenantName: string; role: string; invitedBy: string }): string {
  return wrap('Team Invitation', `<h2 style="color:${BRAND_COLOR};margin:0 0 16px">You're Invited!</h2>
<p style="color:#475569">You've been invited to join <strong>${p.tenantName}</strong> as <strong>${p.role}</strong>.</p>
<p style="color:#64748b">Invited by: <span style="font-family:monospace;font-size:13px">${p.invitedBy.slice(0, 10)}...</span></p>
<p style="color:#475569">Log in to TrustLine to accept the invitation.</p>`);
}

export function teamMemberJoined(p: { memberWallet: string; tenantName: string; role: string }): string {
  return wrap('New Team Member', `<h2 style="color:#1e293b;margin:0 0 16px">New Team Member</h2>
<p style="color:#475569"><span style="font-family:monospace;font-size:13px">${p.memberWallet.slice(0, 10)}...</span> has joined <strong>${p.tenantName}</strong> as <strong>${p.role}</strong>.</p>`);
}
