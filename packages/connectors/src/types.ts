// The common connector interface every provider adapter implements.
// Application code depends on THIS interface, never on a provider SDK
// directly — see CLAUDE.md §4 and docs/architecture/architecture.md §4.

export interface ConnectorHealth {
  ok: boolean;
  checkedAt: string;
  detail?: string;
}

export interface Connector<TCredentials = unknown> {
  readonly provider: string;

  connect(organizationId: string, credentials: TCredentials): Promise<void>;
  disconnect(organizationId: string): Promise<void>;
  health(organizationId: string): Promise<ConnectorHealth>;

  // Not every connector implements every one of these — a read-only
  // analytics connector has no publish(); a publishing connector may have
  // no analytics(). Implement only what the provider and the skill using it
  // actually need, and say so in that provider folder's README.
  fetch?(organizationId: string, query: unknown): Promise<unknown>;
  publish?(organizationId: string, payload: unknown): Promise<unknown>;
  schedule?(organizationId: string, payload: unknown, at: string): Promise<unknown>;
  analytics?(organizationId: string, query: unknown): Promise<unknown>;
}

export class NotImplementedError extends Error {
  constructor(provider: string, method: string) {
    super(
      `${provider} connector: ${method}() is not implemented yet. ` +
        `Check docs/integrations/integrations.md for this provider's gate status ` +
        `before implementing — several are blocked on partner approval, not on engineering time.`,
    );
    this.name = "NotImplementedError";
  }
}
