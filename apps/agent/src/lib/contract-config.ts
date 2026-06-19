import { env } from '../config/env';

interface SuiObjectData {
  data?: {
    dataType?: string;
    type?: string | null;
  } | null;
  error?: unknown;
}

const configuredObjects = [
  ['SUI_PROTOCOL_STATE_ID', env.SUI_PROTOCOL_STATE_ID, 'protocol_state::ProtocolState'],
  ['SUI_ATTESTATION_REGISTRY_ID', env.SUI_ATTESTATION_REGISTRY_ID, 'completion_attestation::AttestationRegistry'],
  ['SUI_PROOF_REGISTRY_ID', env.SUI_PROOF_REGISTRY_ID, 'reputation_proof::ProofRegistry'],
  ['SUI_REVOKED_CAPS_ID', env.SUI_REVOKED_CAPS_ID, 'agent_policy::RevokedCaps'],
  ['SUI_REPUTATION_LEDGER_ID', env.SUI_REPUTATION_LEDGER_ID, 'reputation_ledger::ReputationLedger'],
  ['SUI_ADMIN_CAP_ID', env.SUI_ADMIN_CAP_ID, 'protocol_state::AdminCap'],
] as const;

export async function assertContractConfiguration(
  getObject: (id: string) => Promise<SuiObjectData>,
  getPackageModules: (packageId: string) => Promise<Record<string, unknown>>,
): Promise<void> {
  if (env.EXTERNAL_SERVICES_MODE !== 'live') return;

  const ids = [env.SUI_PACKAGE_ID, ...configuredObjects.map(([, id]) => id)];
  if (new Set(ids).size !== ids.length) {
    throw new Error('[ENV] Contract package and object IDs must all be distinct.');
  }

  const modules = await getPackageModules(env.SUI_PACKAGE_ID);
  const requiredModules = [
    'agent_policy',
    'completion_attestation',
    'payment_relationship',
    'protocol_state',
    'reputation_ledger',
    'reputation_proof',
  ];
  if (!requiredModules.every((moduleName) => moduleName in modules)) {
    throw new Error(`[ENV] SUI_PACKAGE_ID does not reference a published package: ${env.SUI_PACKAGE_ID}`);
  }

  for (const [key, id, moduleType] of configuredObjects) {
    const object = await getObject(id);
    const expectedType = `${env.SUI_PACKAGE_ID}::${moduleType}`;
    if (object.error || object.data?.type !== expectedType) {
      throw new Error(
        `[ENV] ${key} type mismatch. Expected ${expectedType}, received ${object.data?.type ?? 'missing object'}.`,
      );
    }
  }
}
