import { Link } from 'react-router-dom';
import { useOverdueAlerts, useDismissAlert } from '../api/hooks';

export function OverdueBanner() {
  const { data: alerts } = useOverdueAlerts();
  const dismiss = useDismissAlert();

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="overdue-banner">
      <strong>⚠ {alerts.length} overdue {alerts.length === 1 ? 'task' : 'tasks'}</strong>
      <div className="overdue-list">
        {alerts.slice(0, 4).map((a) => (
          <span key={a.taskId} className="overdue-chip">
            <Link to={`/tasks/${a.taskId}`}>{a.title}</Link>
            {a.reappeared && <em title="Rescheduled but still overdue"> (rescheduled)</em>}
            <button className="chip-x" title="Dismiss" onClick={() => dismiss.mutate(a.taskId)}>
              ✕
            </button>
          </span>
        ))}
        {alerts.length > 4 && <span className="muted">+{alerts.length - 4} more</span>}
      </div>
    </div>
  );
}
