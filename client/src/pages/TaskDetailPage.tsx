import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTask, useTimeline, useTaskMutations, useProject, useProjectTasks } from '../api/hooks';
import { ApiError } from '../api/client';
import { PriorityBadge, StatusBadge, Spinner, ErrorNote, formatDate, formatDateTime, STATUS_LABEL } from '../components/ui';
import type { TaskStatus, TimelineItem } from '../api/types';

const NEXT: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IN_REVIEW', 'TODO', 'CANCELLED'],
  IN_REVIEW: ['DONE', 'IN_PROGRESS', 'CANCELLED'],
  DONE: ['IN_PROGRESS'],
  CANCELLED: ['TODO'],
};

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { data: task, isLoading, error } = useTask(taskId);
  const { data: timeline } = useTimeline(taskId);
  const { data: project } = useProject(task?.projectId);
  const projectTasks = useProjectTasks(task?.projectId, { pageSize: 100 });
  const m = useTaskMutations(taskId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!task) return null;

  const run = (p: Promise<unknown>) => {
    setActionError(null);
    p.catch((e) => setActionError(e instanceof ApiError ? e.message : 'Action failed'));
  };

  const memberOptions = project?.members ?? [];
  const assigneeIds = new Set(task.assignees.map((a) => a.id));
  const dependencyIds = new Set(task.dependencies.map((d) => d.id));
  const depCandidates = (projectTasks.data?.items ?? []).filter((t) => t.id !== task.id && !dependencyIds.has(t.id));

  return (
    <div>
      <div className="breadcrumbs">
        <Link to="/projects">Projects</Link> / <Link to={`/projects/${task.projectId}`}>{project?.name ?? 'Project'}</Link> / <span>Task</span>
      </div>

      <div className="task-detail">
        <div className="task-main">
          <div className="page-head">
            <h1>{task.title}</h1>
            <button className="btn btn-ghost" onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</button>
          </div>

          <div className="task-badges">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.isBlocked && <span className="tag tag-blocked">blocked</span>}
            {task.isOverdue && <span className="tag tag-overdue">overdue</span>}
          </div>

          {editing ? (
            <EditTaskForm task={task} onSave={(patch) => run(m.update.mutateAsync({ id: task.id, ...patch }).then(() => setEditing(false)))} />
          ) : (
            <p className="task-desc">{task.description || <span className="muted">No description.</span>}</p>
          )}

          <div className="section">
            <h3>Status</h3>
            <div className="row-gap">
              {NEXT[task.status].map((s) => (
                <button key={s} className="btn btn-outline" onClick={() => run(m.transition.mutateAsync({ id: task.id, status: s }))}>
                  → {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {task.isBlocked && <p className="muted small">Blocked by unfinished dependencies — start/advance is disabled server-side.</p>}
          </div>

          {actionError && <div className="error-note">{actionError}</div>}

          <div className="section">
            <h3>Comments & timeline</h3>
            <form
              className="comment-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (comment.trim()) run(m.comment.mutateAsync({ id: task.id, body: comment }).then(() => setComment('')));
              }}
            >
              <input placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className="btn btn-primary" disabled={!comment.trim()}>Comment</button>
            </form>
            <Timeline items={timeline ?? []} />
          </div>
        </div>

        <aside className="task-side">
          <div className="card">
            <h3>Details</h3>
            <dl className="detail-list">
              <dt>Due date</dt><dd className={task.isOverdue ? 'overdue-cell' : ''}>{formatDate(task.dueDate)}</dd>
              <dt>Created</dt><dd>{formatDate(task.createdAt)}</dd>
              {task.completedAt && (<><dt>Completed</dt><dd>{formatDate(task.completedAt)}</dd></>)}
            </dl>
          </div>

          <div className="card">
            <h3>Assignees</h3>
            <ul className="chip-list">
              {task.assignees.map((a) => (
                <li key={a.id} className="chip">
                  {a.name}
                  <button className="chip-x" onClick={() => run(m.unassign.mutateAsync({ id: task.id, userId: a.id }))}>✕</button>
                </li>
              ))}
              {task.assignees.length === 0 && <li className="muted small">No assignees</li>}
            </ul>
            <select
              value=""
              onChange={(e) => e.target.value && run(m.assign.mutateAsync({ id: task.id, userId: e.target.value }))}
            >
              <option value="">+ Assign member…</option>
              {memberOptions.filter((mem) => !assigneeIds.has(mem.id)).map((mem) => (
                <option key={mem.id} value={mem.id}>{mem.name}</option>
              ))}
            </select>
          </div>

          <div className="card">
            <h3>Blocked by</h3>
            <ul className="dep-list">
              {task.dependencies.map((d) => (
                <li key={d.id}>
                  <Link to={`/tasks/${d.id}`}>{d.title}</Link>
                  <StatusBadge status={d.status} />
                  <button className="chip-x" onClick={() => run(m.removeDependency.mutateAsync({ id: task.id, depId: d.id }))}>✕</button>
                </li>
              ))}
              {task.dependencies.length === 0 && <li className="muted small">No dependencies</li>}
            </ul>
            <select
              value=""
              onChange={(e) => e.target.value && run(m.addDependency.mutateAsync({ id: task.id, dependsOnTaskId: e.target.value }))}
            >
              <option value="">+ Add dependency…</option>
              {depCandidates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>

          {task.dependents.length > 0 && (
            <div className="card">
              <h3>Blocks</h3>
              <ul className="dep-list">
                {task.dependents.map((d) => (
                  <li key={d.id}><Link to={`/tasks/${d.id}`}>{d.title}</Link><StatusBadge status={d.status} /></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function EditTaskForm({ task, onSave }: { task: { title: string; description: string; priority: string; dueDate: string | null }; onSave: (p: { title?: string; description?: string; priority?: string; dueDate?: string | null }) => void }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '');

  return (
    <form className="edit-form" onSubmit={(e) => { e.preventDefault(); onSave({ title, description, priority, dueDate: dueDate || null }); }}>
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
      <label>Description<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="form-row">
        <label>Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
      </div>
      <button className="btn btn-primary">Save changes</button>
    </form>
  );
}

function describe(e: TimelineItem): string {
  switch (e.type) {
    case 'CREATED': return 'created this task';
    case 'STATUS_CHANGED': return `changed status ${STATUS_LABEL[e.oldValue as TaskStatus] ?? e.oldValue} → ${STATUS_LABEL[e.newValue as TaskStatus] ?? e.newValue}`;
    case 'FIELD_CHANGED': return `updated ${e.field} ${e.oldValue ? `from “${e.oldValue}” ` : ''}to “${e.newValue ?? '—'}”`;
    case 'ASSIGNED': return `assigned ${e.subjectUser?.name ?? 'someone'}`;
    case 'UNASSIGNED': return `unassigned ${e.subjectUser?.name ?? 'someone'}`;
    case 'DEPENDENCY_ADDED': return `added dependency ${e.subjectTask?.title ?? ''}`;
    case 'DEPENDENCY_REMOVED': return `removed dependency ${e.subjectTask?.title ?? ''}`;
    case 'COMMENTED': return '';
  }
}

function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <p className="muted">No activity yet.</p>;
  return (
    <ul className="timeline">
      {[...items].reverse().map((e) => (
        <li key={e.id} className={e.type === 'COMMENTED' ? 'tl-comment' : 'tl-event'}>
          <div className="tl-head">
            <strong>{e.actor?.name ?? 'System'}</strong>
            {e.type !== 'COMMENTED' && <span className="muted"> {describe(e)}</span>}
            <span className="muted small tl-time">{formatDateTime(e.createdAt)}</span>
          </div>
          {e.type === 'COMMENTED' && <div className="tl-body">{e.newValue}</div>}
        </li>
      ))}
    </ul>
  );
}
