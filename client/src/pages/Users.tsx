import React from 'react';
import UserCard from '../components/UserCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUsers } from '../hooks/useUsers';

const Users: React.FC = () => {
  const { users, loading, error, totalPages, currentPage, fetchUsers, deleteUser } = useUsers();

  if (loading) return <LoadingSpinner size="lg" message="Loading users..." />;

  return (
    <div className="page users-page">
      <div className="page-header">
        <h1>Users</h1>
        <p className="text-muted">Manage application users stored in AWS RDS (PostgreSQL)</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️ {error}</span>
          <button className="btn btn-sm" onClick={() => fetchUsers()} type="button">Retry</button>
        </div>
      )}

      <div className="users-grid">
        {users.map((user) => (
          <UserCard key={user.id} user={user} onDelete={deleteUser} />
        ))}
      </div>

      {users.length === 0 && !error && (
        <div className="empty-state">
          <p>No users found. Start the server to load demo data.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-ghost"
            disabled={currentPage <= 1}
            onClick={() => fetchUsers(currentPage - 1)}
            type="button"
          >
            ← Previous
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-ghost"
            disabled={currentPage >= totalPages}
            onClick={() => fetchUsers(currentPage + 1)}
            type="button"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default Users;
