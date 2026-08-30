import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Paginated, TaskListItem } from '../api/types';
import { apiBase, qs } from '../api/client';
import { useTaskMutations, type TaskFilters } from '../api/hooks';
import { PriorityBadge, StatusBadge, formatDate, Spinner, ErrorNote, EmptyState } from './ui';

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

interface Props {
  filters: TaskFilters;
  onFilters: (f: TaskFilters) => void;
  query: { data?: Paginated<TaskListItem>; isLoading: boolean; error: unknown };
  exportPath: string; // e.g. /projects/:id/tasks/export or /tasks/mine/export
  enableBulk?: boolean;
}

export function TaskListView({ filters, onFilters, query, exportPath, enableBulk }: Props) {
  const { data, isLoading, error } = query;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = useState('transition:IN_PROGRESS');
  const { bulk } = useTaskMutations();

  const set = (patch: Partial<TaskFilters>) => onFilters({ ...filters, page: 1, ...patch });

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const applyBulk = async () => {
    const [type, value] = bulkOp.split(':');
    const operation =
      type === 'transition' ? { type: 'transition', status: value } : { type: 'setPriority', priority: value };
    const res = await bulk.mutateAsync({ taskIds: [...selected], operation });
    setSelected(new Set());
    if (res.summary.failed > 0) {
      const fails = res.results.filter((r) => !r.success);
      alert(`${res.summary.succeeded} updated, ${res.summary.failed} failed:\n` + fails.map((f) => `• ${f.error?.message}`).join('\n'));
    }
  };

  const exportHref = `${apiBase}/api${exportPath}${qs({ ...filters, page: undefined, pageSize: undefined })}`;

  return (
    <div>
      <div className="filters">
        <input
          className="search"
          placeholder="Search tasks…"
          defaultValue={filters.search ?? ''}
          onChange={(e) => set({ search: e.target.value || undefined })}
        />
        <select value={filters.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filters.priority ?? ''} onChange={(e) => set({ priority: e.target.value || undefined })}>
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={!!filters.overdue} onChange={(e) => set({ overdue: e.target.checked || undefined })} />
          Overdue
        </label>
        <label className="check">
          <input type="checkbox" checked={!!filters.blocked} onChange={(e) => set({ blocked: e.target.checked || undefined })} />
          Blocked
        </label>
        <select
          value={`${filters.sort ?? 'createdAt'}:${filters.order ?? 'desc'}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(':');
            set({ sort, order });
          }}
        >
          <option value="createdAt:desc">Newest</option>
          <option value="dueDate:asc">Due soonest</option>
          <option value="priority:desc">Priority</option>
          <option value="title:asc">Title A–Z</option>
          <option value="status:asc">Status</option>
        </select>
        <a className="btn btn-ghost" href={exportHref}>⬇ CSV</a>
      </div>

      {enableBulk && selected.size > 0 && (
        <div className="bulk-bar">
          <span>{selected.size} selected</span>
          <select value={bulkOp} onChange={(e) => setBulkOp(e.target.value)}>
            <optgroup label="Transition to">
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={`transition:${s}`}>Move to {s}</option>
              ))}
            </optgroup>
            <optgroup label="Set priority">
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={`priority:${p}`}>Priority {p}</option>
              ))}
            </optgroup>
          </select>
          <button className="btn btn-primary" onClick={applyBulk} disabled={bulk.isPending}>Apply</button>
          <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorNote error={error} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>No tasks match these filters.</EmptyState>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                {enableBulk && <th style={{ width: 28 }}></th>}
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignees</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id}>
                  {enableBulk && (
                    <td>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    </td>
                  )}
                  <td>
                    <Link to={`/tasks/${t.id}`} className="task-link">{t.title}</Link>
                    {t.isBlocked && <span className="tag tag-blocked" title="Blocked by a dependency">blocked</span>}
                  </td>
                  <td><StatusBadge status={t.status} /></td>
                  <td><PriorityBadge priority={t.priority} /></td>
                  <td>{t.assignees.map((a) => a.name).join(', ') || <span className="muted">—</span>}</td>
                  <td className={t.isOverdue ? 'overdue-cell' : ''}>{formatDate(t.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button className="btn btn-ghost" disabled={data.page <= 1} onClick={() => onFilters({ ...filters, page: data.page - 1 })}>
              ← Prev
            </button>
            <span className="muted">
              Page {data.page} of {data.totalPages} · {data.total} tasks
            </span>
            <button className="btn btn-ghost" disabled={data.page >= data.totalPages} onClick={() => onFilters({ ...filters, page: data.page + 1 })}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
