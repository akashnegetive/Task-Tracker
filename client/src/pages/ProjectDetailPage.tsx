import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProject, useProjectTasks, useProjectMutations, useTaskMutations, useUsers, type TaskFilters } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { TaskListView } from '../components/TaskListView';
import { Modal } from '../components/Modal';
import { Spinner, ErrorNote } from '../components/ui';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { data: project, isLoading, error } = useProject(projectId);
  const [filters, setFilters] = useState<TaskFilters>({ page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' });
  const tasksQuery = useProjectTasks(projectId, filters);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const isManager = user?.role === 'MANAGER';

  if (isLoading) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!project) return null;

  return (
    <div>
      <div className="breadcrumbs">
        <Link to="/projects">Projects</Link> / <span>{project.name}</span>
      </div>
      <div className="page-head">
        <div>
          <h1>
            {project.name} {project.status === 'ARCHIVED' && <span className="tag tag-archived">archived</span>}
          </h1>
          <p className="muted">{project.description || 'No description.'}</p>
        </div>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={() => setShowMembers(true)}>Members ({project.members.length})</button>
          {project.status === 'ACTIVE' && (
            <button className="btn btn-primary" onClick={() => setShowNewTask(true)}>+ New task</button>
          )}
        </div>
      </div>

      <TaskListView
        filters={filters}
        onFilters={setFilters}
        query={tasksQuery}
        exportPath={`/projects/${projectId}/tasks/export`}
        enableBulk
      />

      {showNewTask && projectId && (
        <NewTaskModal projectId={projectId} memberIds={project.members.map((m) => ({ id: m.id, name: m.name }))} onClose={() => setShowNewTask(false)} />
      )}
      {showMembers && projectId && (
        <MembersModal projectId={projectId} canManage={isManager} onClose={() => setShowMembers(false)} />
      )}
    </div>
  );
}

function NewTaskModal({ projectId, memberIds, onClose }: { projectId: string; memberIds: { id: string; name: string }[]; onClose: () => void }) {
  const { create } = useTaskMutations();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await create.mutateAsync({ projectId, title, description, priority, dueDate: dueDate || null, assigneeIds: assignees });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  };

  return (
    <Modal title="New task" onClose={onClose}>
      <form onSubmit={submit}>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></label>
        <div className="form-row">
          <label>Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        </div>
        <label>Assignees
          <select multiple value={assignees} onChange={(e) => setAssignees([...e.target.selectedOptions].map((o) => o.value))} size={4}>
            {memberIds.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        {err && <div className="error-note">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create task'}</button>
      </form>
    </Modal>
  );
}

function MembersModal({ projectId, canManage, onClose }: { projectId: string; canManage: boolean; onClose: () => void }) {
  const { data: project } = useProject(projectId);
  const { data: users } = useUsers();
  const { addMember, removeMember } = useProjectMutations();
  const [toAdd, setToAdd] = useState('');

  const memberIds = new Set(project?.members.map((m) => m.id));
  const candidates = users?.filter((u) => !memberIds.has(u.id)) ?? [];

  return (
    <Modal title="Project members" onClose={onClose}>
      <ul className="member-list">
        {project?.members.map((m) => (
          <li key={m.id}>
            <span>{m.name} <span className="muted small">{m.email}</span></span>
            {canManage && m.id !== project.createdById && (
              <button className="btn btn-ghost small" onClick={() => removeMember.mutate({ id: projectId, userId: m.id })}>Remove</button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <div className="form-row">
          <select value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
            <option value="">Add member…</option>
            {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
          <button className="btn btn-primary" disabled={!toAdd} onClick={() => { if (toAdd) { addMember.mutate({ id: projectId, userId: toAdd }); setToAdd(''); } }}>Add</button>
        </div>
      )}
    </Modal>
  );
}
