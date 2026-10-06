import React from 'react';
import OrderCard from '../components/OrderCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useOrders } from '../hooks/useOrders';

const Orders: React.FC = () => {
  const { orders, loading, error, totalPages, currentPage, fetchOrders, updateOrderStatus } = useOrders();

  if (loading) return <LoadingSpinner size="lg" message="Loading orders..." />;

  return (
    <div className="page orders-page">
      <div className="page-header">
        <h1>Orders</h1>
        <p className="text-muted">Order management — processed via AWS Lambda for cost efficiency</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️ {error}</span>
          <button className="btn btn-sm" onClick={() => fetchOrders()} type="button">Retry</button>
        </div>
      )}

      <div className="orders-grid">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onStatusChange={updateOrderStatus} />
        ))}
      </div>

      {orders.length === 0 && !error && (
        <div className="empty-state">
          <p>No orders found. Start the server to load demo data.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-ghost"
            disabled={currentPage <= 1}
            onClick={() => fetchOrders(currentPage - 1)}
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
            onClick={() => fetchOrders(currentPage + 1)}
            type="button"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default Orders;
