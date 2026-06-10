import { useEffect, useState, type ReactNode } from 'react';

import { getTenant, updateTenantSettings } from '../api/resources';
import type { TenantResponse } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { StatusBadge } from '../components/status-badge';

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
        </>
      ) : null}
    </>
  );
}
