import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useDashboard, useProjects } from '../api/hooks';
import { Spinner, ErrorNote, STATUS_LABEL } from '../components/ui';
import type { TaskStatus } from '../api/types';

const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: '#94a3b8',
  IN_PROGRESS: '#3b82f6',
  IN_REVIEW: '#a855f7',
  DONE: '#22c55e',
  CANCELLED: '#cbd5e1',
};
const PRIORITY_COLORS: Record<string, string> = { LOW: '#94a3b8', MEDIUM: '#3b82f6', HIGH: '#f59e0b', URGENT: '#ef4444' };

export function DashboardPage() {
  const [projectId, setProjectId] = useState<string>('');
  const { data: projects } = useProjects('ACTIVE');
  const { data, isLoading, error } = useDashboard(projectId || undefined);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return null;

  const weekData = data.completionByWeek.map((w) => ({
    week: new Date(w.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    completed: w.completed,
  }));
  const statusData = (Object.keys(data.byStatus) as TaskStatus[]).map((s) => ({ name: STATUS_LABEL[s], key: s, value: data.byStatus[s] }));
  const priorityData = Object.entries(data.byPriority).map(([k, v]) => ({ name: k, value: v }));

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All my projects</option>
          {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="metrics">
        <Metric label="Total tasks" value={data.metrics.total} />
        <Metric label="Open" value={data.metrics.open} />
        <Metric label="Completed" value={data.metrics.completed} accent="green" />
        <Metric label="Overdue" value={data.metrics.overdue} accent={data.metrics.overdue > 0 ? 'red' : undefined} />
        <Metric label="Due this week" value={data.metrics.dueSoon} accent="amber" />
        <Metric label="Completion" value={`${Math.round(data.metrics.completionRate * 100)}%`} />
      </div>

      <div className="card">
        <h3>Completed in the last 8 weeks</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={weekData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-row">
        <div className="card">
          <h3>By status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData} layout="vertical" margin={{ left: 24 }}>
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {statusData.map((d) => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>By priority</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityData} layout="vertical" margin={{ left: 24 }}>
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {priorityData.map((d) => <Cell key={d.name} fill={PRIORITY_COLORS[d.name]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number | string; accent?: 'green' | 'red' | 'amber' }) {
  return (
    <div className={`metric ${accent ? `metric-${accent}` : ''}`}>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
