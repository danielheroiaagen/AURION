import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { getVoiceSession } from '../api/resources';
import type { VoiceSessionResponse } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { StatusBadge } from '../components/status-badge';

/**
 * Session detail page (Phase-30, ADR-039): per-session view with AI summary,
 * insights, and caller metadata. Route: /sessions/:id.
 */

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—';
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

export function SessionDetailPage(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const { client } = useAuth();
  const [session, setSession] = useState<VoiceSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getVoiceSession(client, id)
      .then(setSession)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load session.'),
      )
      .finally(() => setLoading(false));
  }, [client, id]);

  if (loading) {
    return <p className="muted">Loading session…</p>;
  }

  if (error || !session) {
    return <div className="error">{error ?? 'Session not found.'}</div>;
  }

  const insights = session.ai_insights;

  return (
    <div className="session-detail">
      {/* Header */}
      <div className="session-detail-header">
        <h1>
          Session&nbsp;
          <span className="muted">{session.external_session_id ?? session.id.slice(0, 8)}</span>
        </h1>
        <StatusBadge status={session.status} />
      </div>

      {/* Metadata row */}
      <div className="card session-detail-meta">
        <div className="session-detail-meta-item">
          <span className="session-detail-label">Caller</span>
          <span>{session.caller_number ?? <span className="muted">Unknown</span>}</span>
        </div>
        <div className="session-detail-meta-item">
          <span className="session-detail-label">Started</span>
          <span className="muted">{new Date(session.started_at).toLocaleString()}</span>
        </div>
        <div className="session-detail-meta-item">
          <span className="session-detail-label">Ended</span>
          <span className="muted">
            {session.ended_at ? new Date(session.ended_at).toLocaleString() : '—'}
          </span>
        </div>
        <div className="session-detail-meta-item">
          <span className="session-detail-label">Duration</span>
          <span className="muted">
            {formatDuration(session.started_at, session.ended_at)}
          </span>
        </div>
        {session.outcome ? (
          <div className="session-detail-meta-item">
            <span className="session-detail-label">Outcome</span>
            <span className="muted">{session.outcome}</span>
          </div>
        ) : null}
      </div>

      {/* AI summary */}
      <div className="card">
        <h2>AI Summary</h2>
        {session.ai_summary ? (
          <p className="session-detail-summary">{session.ai_summary}</p>
        ) : (
          <p className="muted">AI summary not available for this call.</p>
        )}
      </div>

      {/* AI insights */}
      {insights ? (
        <div className="card">
          <h2>Insights</h2>
          <div className="session-detail-insights">
            {insights.intent ? (
              <div className="session-detail-insight-row">
                <span className="session-detail-label">Intent</span>
                <span>{insights.intent}</span>
              </div>
            ) : null}

            {insights.lead_quality ? (
              <div className="session-detail-insight-row">
                <span className="session-detail-label">Lead quality</span>
                <StatusBadge status={insights.lead_quality} />
              </div>
            ) : null}

            {insights.caller_name ? (
              <div className="session-detail-insight-row">
                <span className="session-detail-label">Caller name</span>
                <span>{insights.caller_name}</span>
              </div>
            ) : null}

            {insights.callback_number ? (
              <div className="session-detail-insight-row">
                <span className="session-detail-label">Callback number</span>
                <span>{insights.callback_number}</span>
              </div>
            ) : null}

            {insights.language ? (
              <div className="session-detail-insight-row">
                <span className="session-detail-label">Language</span>
                <span className="muted">{insights.language}</span>
              </div>
            ) : null}

            {insights.action_items && insights.action_items.length > 0 ? (
              <div className="session-detail-insight-row">
                <span className="session-detail-label">Action items</span>
                <ul className="session-detail-action-items">
                  {insights.action_items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Legacy transcript notes (collapsed) */}
      {session.summary ? (
        <div className="card">
          <details>
            <summary className="session-detail-label">Raw transcript notes</summary>
            <pre className="session-detail-transcript">{session.summary}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
