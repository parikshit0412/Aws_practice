import React from 'react';
import type { User } from '../types';

interface UserCardProps {
  user: User;
  onDelete?: (id: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onDelete }) => {
  const roleColors: Record<User['role'], string> = {
    admin: 'var(--color-danger)',
    manager: 'var(--color-warning)',
    user: 'var(--color-primary)',
  };

  return (
    <div className="card user-card">
      <div className="card-header">
        <div className="user-avatar" style={{ background: roleColors[user.role] }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="user-info">
          <h3 className="user-name">{user.name}</h3>
          <p className="user-email">{user.email}</p>
        </div>
      </div>

      <div className="card-body">
        <span className="badge" style={{ background: roleColors[user.role] }}>
          {user.role.toUpperCase()}
        </span>
        <span className="text-muted">
          Joined {new Date(user.created_at).toLocaleDateString()}
        </span>
      </div>

      {onDelete && (
        <div className="card-footer">
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(user.id)}
            type="button"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default UserCard;
