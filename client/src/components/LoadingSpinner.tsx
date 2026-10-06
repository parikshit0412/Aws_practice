import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', message }) => {
  const sizeMap = { sm: '24px', md: '40px', lg: '64px' };
  const dimension = sizeMap[size];

  return (
    <div className="loading-container">
      <div
        className="spinner"
        style={{ width: dimension, height: dimension }}
        role="status"
        aria-label="Loading"
      />
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
