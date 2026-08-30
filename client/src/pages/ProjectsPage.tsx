import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects, useProjectMutations, useUsers } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal';
import { Spinner, ErrorNote, EmptyState } from '../components/ui';

export function ProjectsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('ACTIVE');
  const { data: projects, isLoading, error } = useProjects(status);
  const { create, archive, restore } = useProjectMutations();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="page-head">
        <h1>Projects</h1>
        <div className="row-gap">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="ALL">All</option>
          </select>
          {user?.role === 'MANAGER' && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New project</button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorNote error={error} />
      ) : !projects || projects.length === 0 ? (
        <EmptyState>No projects here.</EmptyState>
      ) : (
        <div className="grid">
          {projects.map((p) => (
            <div key={p.id} className="card project-card">
              <div className="project-card-head">
                <Link to={`/projects/${p.id}`} className="card-title">{p.name}</Link>
                {p.status === 'ARCHIVED' && <span className="tag tag-archived">archived</span>}
              </div>
              <p className="muted clamp">{p.description || 'No description.'}</p>
              <div className="project-stats">
                <span>{p.openTaskCount} open</span>
                <span>{p.taskCount} total</span>
                <span>{p.memberCount} members</span>
              </div>
              {user?.role === 'MANAGER' && (
                <div className="card-actions">
                  {p.status === 'ACTIVE' ? (
                    <button className="btn btn-ghost small" onClick={() => archive.mutate(p.id)}>Archive</button>
                  ) : (
                    <button className="btn btn-ghost small" onClick={() => restore.mutate(p.id)}>Restore</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreate={(b) => create.mutateAsync(b).then(() => setShowCreate(false))} />}
    </div>
  );
}

function CreateProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (b: { name: string; description?: string; memberIds?: string[] }) => Promise<unknown> }) {
  const { data: users } = useUsers();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await onCreate({ name, description, memberIds });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  };

  return (
    <Modal title="New project" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label>
          Members
          <select multiple value={memberIds} onChange={(e) => setMemberIds([...e.target.selectedOptions].map((o) => o.value))} size={4}>
            {users?.filter((u) => u.role === 'MEMBER' || u.role === 'MANAGER').map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </label>
        {err && <div className="error-note">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button>
      </form>
    </Modal>
  );
}
