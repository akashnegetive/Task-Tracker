import { useState } from 'react';
import { useMyTasks, type TaskFilters } from '../api/hooks';
import { TaskListView } from '../components/TaskListView';

export function MyTasksPage() {
  const [filters, setFilters] = useState<TaskFilters>({ page: 1, pageSize: 20, sort: 'dueDate', order: 'asc' });
  const query = useMyTasks(filters);

  return (
    <div>
      <div className="page-head">
        <h1>My Tasks</h1>
      </div>
      <p className="muted">Every task assigned to you, across all projects.</p>
      <TaskListView filters={filters} onFilters={setFilters} query={query} exportPath="/tasks/mine/export" enableBulk />
    </div>
  );
}
