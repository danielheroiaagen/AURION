import { useCallback, useState, type FormEvent, type ReactNode } from 'react';

import {
  changeKnowledgeDocumentStatus,
  createKnowledgeDocument,
  listKnowledgeDocuments,
} from '../api/resources';
import { useAuth } from '../auth/auth-context';
import { StatusBadge } from '../components/status-badge';
import { usePaged } from '../components/use-paged';

/** Mirror of the API lifecycle (draft → review → published → archived). */
const NEXT_STATUSES: Record<string, string[]> = {
  draft: ['review'],
  review: ['draft', 'published'],
  published: ['archived'],
  archived: [],
};

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function KnowledgePage(): ReactNode {
  const { client } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', source_uri: '', content: '' });
  const [busy, setBusy] = useState(false);

  const fetchPage = useCallback(
    (cursor?: string) => listKnowledgeDocuments(client, { cursor, limit: 25 }),
    [client],
  );
  const page = usePaged(fetchPage, []);

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createKnowledgeDocument(client, {
        title: form.title,
        source_uri: form.source_uri || undefined,
        // Content itself lives at the source URI; the API stores the
        // integrity hash so the agent can detect drifted sources.
        content_sha256: await sha256Hex(form.content),
      });
      setForm({ title: '', source_uri: '', content: '' });
      page.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Create failed.');
    } finally {
      setBusy(false);
    }
  }

  async function transition(id: string, status: string): Promise<void> {
    setError(null);
    try {
      await changeKnowledgeDocumentStatus(client, id, status);
      page.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Transition failed.');
    }
  }

  return (
    <>
      <h1>Knowledge base</h1>
      {error ? <div className="error">{error}</div> : null}
      {page.error ? <div className="error">{page.error}</div> : null}

      <div className="card">
        <form onSubmit={(event) => void handleCreate(event)}>
          <div className="form-row">
            <div>
              <label htmlFor="title">Title</label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="source">Source URI (optional)</label>
              <input
                id="source"
                value={form.source_uri}
                onChange={(event) => setForm({ ...form, source_uri: event.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div>
              <label htmlFor="content">Document content (hashed client-side, not uploaded)</label>
              <textarea
                id="content"
                required
                value={form.content}
                onChange={(event) => setForm({ ...form, content: event.target.value })}
              />
            </div>
          </div>
          <button className="primary" type="submit" disabled={busy}>
            Create draft
          </button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Source</th>
              <th>Published</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((document) => (
              <tr key={document.id}>
                <td>
                  {document.title}
                  <div className="muted">{document.content_sha256.slice(0, 16)}…</div>
                </td>
                <td>
                  <StatusBadge status={document.status} />
                </td>
                <td className="muted">{document.source_uri ?? '—'}</td>
                <td className="muted">
                  {document.published_at ? new Date(document.published_at).toLocaleString() : '—'}
                </td>
                <td>
                  <div className="actions-cell">
                    {(NEXT_STATUSES[document.status] ?? []).map((next) => (
                      <button key={next} onClick={() => void transition(document.id, next)}>
                        → {next}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {page.hasMore ? (
          <div className="load-more">
            <button onClick={page.loadMore} disabled={page.loading}>
              Load more
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
