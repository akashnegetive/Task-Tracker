import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { OverdueBanner } from './OverdueBanner';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">✓ TaskTracker</div>
        <nav className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/my-tasks">My Tasks</NavLink>
        </nav>
        <div className="user-box">
          <span className="user-name">
            {user?.name} <span className={`role-tag role-${user?.role.toLowerCase()}`}>{user?.role}</span>
          </span>
          <button className="btn btn-ghost" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>
      <OverdueBanner />
      <main className="content">{children}</main>
    </div>
  );
}
