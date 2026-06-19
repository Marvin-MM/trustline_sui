/**
 * Tenant isolation guard.
 * Every database query touching tenant-scoped data MUST go through this guard.
 * Makes it a compile-time error to query without tenant context.
 */

import { prisma } from '../db/client';
import type { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger';

logger.child({ module: 'tenant-guard' });

export interface TenantScope {
  tenantId: string;
}

export interface PersonalScope {
  walletAddress: string;
}

export interface EitherScope {
  tenantId: string | null;
  walletAddress: string;
}

type WhereClause = { tenantId: string } | { tenantId: null; payerWallet?: string; recipientWallet?: string };

export class TenantGuard {
  private readonly db: PrismaClient;

  constructor(db: PrismaClient = prisma) {
    this.db = db;
  }

  /**
   * Returns a scoped query context for a specific tenant.
   * All queries will automatically filter by tenantId.
   */
  forTenant(tenantId: string): TenantScopedQueries {
    return new TenantScopedQueries(this.db, tenantId);
  }

  /**
   * Returns a scoped query context for personal data (null tenantId + matching wallet).
   */
  forPersonal(walletAddress: string): PersonalScopedQueries {
    return new PersonalScopedQueries(this.db, walletAddress);
  }

  /**
   * Handles mixed tenant/personal mode based on whether tenantId is provided.
   */
  forEither(tenantId: string | null, walletAddress: string): TenantScopedQueries | PersonalScopedQueries {
    if (tenantId) {
      return this.forTenant(tenantId);
    }
    return this.forPersonal(walletAddress);
  }

  /** Direct DB access for non-tenant-scoped operations (e.g., user lookups). */
  get unscoped(): PrismaClient {
    return this.db;
  }
}

export class TenantScopedQueries {
  constructor(private readonly db: PrismaClient, private readonly tenantId: string) {}

  get relationships() {
    return {
      findMany: (args?: Omit<Prisma.PaymentRelationshipFindManyArgs, 'where'> & { where?: Prisma.PaymentRelationshipWhereInput }) =>
        this.db.paymentRelationship.findMany({ ...args, where: { ...args?.where, tenantId: this.tenantId } }),
      findFirst: (args?: Omit<Prisma.PaymentRelationshipFindFirstArgs, 'where'> & { where?: Prisma.PaymentRelationshipWhereInput }) =>
        this.db.paymentRelationship.findFirst({ ...args, where: { ...args?.where, tenantId: this.tenantId } }),
      findUnique: (args: Prisma.PaymentRelationshipFindUniqueArgs) =>
        this.db.paymentRelationship.findFirst({ where: { ...args.where, tenantId: this.tenantId } as Prisma.PaymentRelationshipWhereInput }),
      create: (data: Omit<Prisma.PaymentRelationshipCreateInput, 'tenant'> & { tenant?: never }) =>
        this.db.paymentRelationship.create({ data: { ...data, tenant: { connect: { id: this.tenantId } } } }),
      update: (args: { where: { id: string }; data: Prisma.PaymentRelationshipUpdateInput }) =>
        this.db.paymentRelationship.updateMany({ where: { id: args.where.id, tenantId: this.tenantId }, data: args.data }),
      count: (args?: { where?: Prisma.PaymentRelationshipWhereInput }) =>
        this.db.paymentRelationship.count({ where: { ...args?.where, tenantId: this.tenantId } }),
    };
  }

  get milestones() {
    return {
      findMany: (args?: Omit<Prisma.MilestoneFindManyArgs, 'where'> & { where?: Prisma.MilestoneWhereInput }) =>
        this.db.milestone.findMany({ ...args, where: { ...args?.where, relationship: { tenantId: this.tenantId } } }),
      update: (args: { where: { id: string }; data: Prisma.MilestoneUpdateInput }) =>
        this.db.milestone.updateMany({
          where: { id: args.where.id, relationship: { tenantId: this.tenantId } },
          data: args.data,
        }),
    };
  }

  get agentActions() {
    return {
      findMany: (args?: Omit<Prisma.AgentActionFindManyArgs, 'where'> & { where?: Prisma.AgentActionWhereInput }) =>
        this.db.agentAction.findMany({ ...args, where: { ...args?.where, tenantId: this.tenantId } }),
      count: (args?: { where?: Prisma.AgentActionWhereInput }) =>
        this.db.agentAction.count({ where: { ...args?.where, tenantId: this.tenantId } }),
    };
  }

  get notifications() {
    return {
      findMany: (args?: Omit<Prisma.NotificationFindManyArgs, 'where'> & { where?: Prisma.NotificationWhereInput }) =>
        this.db.notification.findMany({ ...args, where: { ...args?.where, tenantId: this.tenantId } }),
    };
  }

  get transactions() {
    return {
      findMany: (args?: Omit<Prisma.SubmittedTransactionFindManyArgs, 'where'> & { where?: Prisma.SubmittedTransactionWhereInput }) =>
        this.db.submittedTransaction.findMany({ ...args, where: { ...args?.where, tenantId: this.tenantId } }),
    };
  }

  get usageRecords() {
    return {
      findMany: (args?: Omit<Prisma.UsageRecordFindManyArgs, 'where'> & { where?: Prisma.UsageRecordWhereInput }) =>
        this.db.usageRecord.findMany({ ...args, where: { ...args?.where, tenantId: this.tenantId } }),
    };
  }
}

export class PersonalScopedQueries {
  constructor(private readonly db: PrismaClient, private readonly walletAddress: string) {}

  get relationships() {
    return {
      findMany: (args?: Omit<Prisma.PaymentRelationshipFindManyArgs, 'where'> & { where?: Prisma.PaymentRelationshipWhereInput }) =>
        this.db.paymentRelationship.findMany({
          ...args,
          where: {
            ...args?.where,
            tenantId: null,
            OR: [{ payerWallet: this.walletAddress }, { recipientWallet: this.walletAddress }],
          },
        }),
      findFirst: (args?: Omit<Prisma.PaymentRelationshipFindFirstArgs, 'where'> & { where?: Prisma.PaymentRelationshipWhereInput }) =>
        this.db.paymentRelationship.findFirst({
          ...args,
          where: {
            ...args?.where,
            tenantId: null,
            OR: [{ payerWallet: this.walletAddress }, { recipientWallet: this.walletAddress }],
          },
        }),
      findUnique: (args: Prisma.PaymentRelationshipFindUniqueArgs) =>
        this.db.paymentRelationship.findFirst({
          ...args,
          where: {
            ...args.where,
            tenantId: null,
            OR: [{ payerWallet: this.walletAddress }, { recipientWallet: this.walletAddress }],
          } as Prisma.PaymentRelationshipWhereInput,
        }),
      create: (data: Omit<Prisma.PaymentRelationshipCreateInput, 'tenant'>) =>
        this.db.paymentRelationship.create({ data }),
      count: (args?: { where?: Prisma.PaymentRelationshipWhereInput }) =>
        this.db.paymentRelationship.count({
          where: {
            ...args?.where,
            tenantId: null,
            OR: [{ payerWallet: this.walletAddress }, { recipientWallet: this.walletAddress }],
          },
        }),
    };
  }

  get agentActions() {
    return {
      findMany: (args?: Omit<Prisma.AgentActionFindManyArgs, 'where'> & { where?: Prisma.AgentActionWhereInput }) =>
        this.db.agentAction.findMany({
          ...args,
          where: { ...args?.where, tenantId: null, relationship: { OR: [{ payerWallet: this.walletAddress }, { recipientWallet: this.walletAddress }] } },
        }),
    };
  }
}

export const tenantGuard = new TenantGuard();
