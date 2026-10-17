/**
 * Test double for the Supabase query builder. Every `from()` call returns a
 * chainable query that records the calls made on it and resolves to the
 * response configured for that table. Test-only (excluded from the app build).
 */
export interface FakeResponse {
  data: unknown;
  error: { message: string } | null;
}

export type QueryCall = [method: string, args: unknown[]];

export class FakeQuery implements PromiseLike<FakeResponse> {
  readonly calls: QueryCall[] = [];

  constructor(
    readonly table: string,
    private readonly response: FakeResponse,
  ) {}

  select(...args: unknown[]): this {
    return this.record('select', args);
  }
  insert(...args: unknown[]): this {
    return this.record('insert', args);
  }
  update(...args: unknown[]): this {
    return this.record('update', args);
  }
  delete(...args: unknown[]): this {
    return this.record('delete', args);
  }
  eq(...args: unknown[]): this {
    return this.record('eq', args);
  }
  in(...args: unknown[]): this {
    return this.record('in', args);
  }
  lte(...args: unknown[]): this {
    return this.record('lte', args);
  }
  gte(...args: unknown[]): this {
    return this.record('gte', args);
  }
  order(...args: unknown[]): this {
    return this.record('order', args);
  }
  limit(...args: unknown[]): this {
    return this.record('limit', args);
  }
  maybeSingle(): this {
    return this.record('maybeSingle', []);
  }

  /** First recorded call of a method, or undefined. */
  call(method: string): unknown[] | undefined {
    return this.calls.find(([m]) => m === method)?.[1];
  }

  then<R1 = FakeResponse, R2 = never>(
    onFulfilled?: ((value: FakeResponse) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.response).then(onFulfilled, onRejected);
  }

  private record(method: string, args: unknown[]): this {
    this.calls.push([method, args]);
    return this;
  }
}

/**
 * Builds a fake client; tables without a configured response return `[]`.
 * RPC responses are configured as `rpc:<function name>`.
 */
export function createFakeSupabase(responses: Record<string, FakeResponse> = {}) {
  const queries: FakeQuery[] = [];
  const rpcCalls: [name: string, args: unknown][] = [];
  const client = {
    from(table: string): FakeQuery {
      const query = new FakeQuery(table, responses[table] ?? { data: [], error: null });
      queries.push(query);
      return query;
    },
    rpc(name: string, args: unknown): Promise<FakeResponse> {
      rpcCalls.push([name, args]);
      return Promise.resolve(responses[`rpc:${name}`] ?? { data: null, error: null });
    },
  };
  return { client, queries, rpcCalls };
}

export const ok = (data: unknown): FakeResponse => ({ data, error: null });
export const failure = (message = 'boom'): FakeResponse => ({ data: null, error: { message } });
