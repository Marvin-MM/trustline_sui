declare module 'redlock' {
  import { EventEmitter } from 'events';
  import type { Redis, Cluster } from 'ioredis';

  type Client = Redis | Cluster;

  export interface Settings {
    readonly driftFactor: number;
    readonly retryCount: number;
    readonly retryDelay: number;
    readonly retryJitter: number;
    readonly automaticExtensionThreshold: number;
  }

  export class Lock {
    readonly resources: string[];
    readonly value: string;
    expiration: number;
    release(): Promise<unknown>;
    extend(duration: number): Promise<Lock>;
  }

  export class ExecutionError extends Error {}
  export class ResourceLockedError extends Error {}

  export default class Redlock extends EventEmitter {
    constructor(clients: Iterable<Client>, settings?: Partial<Settings>);
    acquire(resources: string[], duration: number, settings?: Partial<Settings>): Promise<Lock>;
  }
}
