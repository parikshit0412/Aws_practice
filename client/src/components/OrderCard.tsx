import React from 'react';
import type { Order, OrderStatus } from '../types';

interface OrderCardProps {
  order: Order;
  onStatusChange?: (id: string, status: OrderStatus) => void;
}

const statusConfig: Record<OrderStatus, { color: string; icon: string }> = {
  PENDING: { color: '#f59e0b', icon: '⏳' },
  PROCESSING: { color: '#3b82f6', icon: '⚙️' },
  SHIPPED: { color: '#8b5cf6', icon: '📦' },
  DELIVERED: { color: '#10b981', icon: '✅' },
  CANCELLED: { color: '#ef4444', icon: '❌' },
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
};

const OrderCard: React.FC<OrderCardProps> = ({ order, onStatusChange }) => {
  const config = statusConfig[order.status];
  const next = nextStatus[order.status];

  return (
    <div className="card order-card">
      <div className="card-header">
        <div className="order-id">
          <span className="text-muted">Order</span>
          <strong>#{order.id.slice(0, 8)}</strong>
        </div>
        <span className="badge" style={{ background: config.color }}>
          {config.icon} {order.status}
        </span>
      </div>

      <div className="card-body">
        <div className="order-items">
          {order.items.map((item) => (
            <div key={item.product_id} className="order-item-row">
              <span>{item.product_name}</span>
              <span className="text-muted">
                {item.quantity} × ${item.price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="order-total">
          <span>Total</span>
          <strong>${order.total_amount.toFixed(2)}</strong>
        </div>
      </div>

      {onStatusChange && next && (
        <div className="card-footer">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onStatusChange(order.id, next)}
            type="button"
          >
            Move to {next}
          </button>
        </div>
      )}
    </div>
  );
};

export default OrderCard;
