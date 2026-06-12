import { useEffect, useState, type ReactNode } from 'react';

import { getTenant, updateTenantSettings } from '../api/resources';
import type { TenantResponse } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { StatusBadge } from '../components/status-badge';

type ReadinessItem = {
  readonly label: string;
  readonly keys: readonly string[];
  readonly detail: string;
};

const READINESS: readonly ReadinessItem[] = [
  {
    label: 'Number routing',
    keys: ['phone_number', 'phone', 'telephony_number'],
    detail: 'Production calls need a tenant-owned number or forwarding route.',
  },
  {
    label: 'AI greeting',
    keys: ['phone_greeting', 'greeting'],
    detail: 'The greeting should disclose that the caller is speaking with an AI assistant.',
  },
  {
    label: 'Business hours',
    keys: ['business_hours'],
    detail: 'Hours let the operator tune fallback and escalation expectations.',
  },
  {
    label: 'Connector workflow',
    keys: ['connectors', 'connector_mode', 'n8n_workflows'],
    detail: 'Real calendar, email, WhatsApp, ticket, or lead workflows must be configured.',
  },
  {
    label: 'Knowledge source',
    keys: ['knowledge_base', 'published_knowledge'],
    detail: 'Published knowledge gives the agent company-specific answers.',
  },
];

function hasAnySetting(settings: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => {
    const value = settings[key];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
  });
}

function LaunchReadiness({ settings }: { settings: Record<string, unknown> }): ReactNode {
  return (
    <div className="card readiness-card">
      <div className="readiness-heading">
        <div>
          <h2>Launch readiness</h2>
          <p className="muted">
            These checks keep demos honest: configured means the tenant settings carry the
            required launch signal, missing means the operator still has work to do.
          </p>
        </div>
      </div>
      <div className="readiness-list">
        {READINESS.map((item) => {
          const configured = hasAnySetting(settings, item.keys);
          return (
            <div key={item.label} className="readiness-item">
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.detail}</p>
                <code>{item.keys.join(' | ')}</code>
              </div>
              <StatusBadge status={configured ? 'configured' : 'missing'} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TenantPage(): ReactNode {
  const { client, session } = useAuth();
  const tenantId = session!.claims.tenantId;
  const [tenant, setTenant] = useState<TenantResponse | null>(null);
  const [settingsText, setSettingsText] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setError('This token carries no tenant claim.');
      return;
    }
    getTenant(client, tenantId)
      .then((loaded) => {
        setTenant(loaded);
        setSettingsText(JSON.stringify(loaded.settings, null, 2));
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Failed to load tenant.'),
      );
  }, [client, tenantId]);

  async function handleSave(): Promise<void> {
    if (!tenantId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(settingsText) as Record<string, unknown>;
      const updated = await updateTenantSettings(client, tenantId, parsed);
      setTenant(updated);
      setSettingsText(JSON.stringify(updated.settings, null, 2));
    } catch (cause) {
      setError(
        cause instanceof SyntaxError
          ? 'Settings must be valid JSON.'
          : cause instanceof Error
            ? cause.message
            : 'Save failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Tenant</h1>
      {error ? <div className="error">{error}</div> : null}

      {tenant ? (
        <>
          <div className="card">
            <table>
              <tbody>
                <tr>
                  <th>Name</th>
                  <td>{tenant.name}</td>
                </tr>
                <tr>
                  <th>Slug</th>
                  <td className="muted">{tenant.slug}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>
                    <StatusBadge status={tenant.status} />
                  </td>
                </tr>
                <tr>
                  <th>Created</th>
                  <td className="muted">{new Date(tenant.created_at).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <label htmlFor="settings">Settings (JSON document, replaced atomically)</label>
            <textarea
              id="settings"
              style={{ minHeight: '220px', fontFamily: 'ui-monospace, monospace' }}
              value={settingsText}
              onChange={(event) => setSettingsText(event.target.value)}
            />
            <div style={{ marginTop: '0.75rem' }}>
              <button className="primary" onClick={() => void handleSave()} disabled={busy}>
                {busy ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </div>

          <LaunchReadiness settings={tenant.settings} />
        </>
      ) : null}
    </>
  );
}
