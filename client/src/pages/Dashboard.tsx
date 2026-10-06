import React, { useState, useEffect } from 'react';
import { healthApi } from '../services/api';
import type { HealthStatus } from '../types';

const Dashboard: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const fetchHealth = async (): Promise<void> => {
      try {
        const data = await healthApi.check();
        setHealth(data);
      } catch {
        setHealth(null);
      }
    };
    fetchHealth();
  }, []);

  const stats = [
    { label: 'Total Users', value: '1,247', icon: '👥', trend: '+12%', color: '#6366f1' },
    { label: 'Active Orders', value: '356', icon: '📦', trend: '+8%', color: '#f59e0b' },
    { label: 'Revenue (MTD)', value: '$48,320', icon: '💰', trend: '+23%', color: '#10b981' },
    { label: 'Lambda Invocations', value: '12.4K', icon: '⚡', trend: '+5%', color: '#8b5cf6' },
  ];

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="text-muted">AWS Full Stack Application Overview</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card card">
            <div className="stat-icon" style={{ background: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-content">
              <p className="stat-label">{stat.label}</p>
              <h2 className="stat-value">{stat.value}</h2>
              <span className="stat-trend positive">{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Architecture Cards */}
      <div className="section">
        <h2 className="section-title">Architecture Components</h2>
        <div className="arch-grid">
          <div className="card arch-card">
            <h3>⚛️ React Frontend</h3>
            <p>TypeScript SPA hosted on S3 + CloudFront. Uses React Router for navigation and Axios for API calls to the BFF layer.</p>
            <div className="tech-tags">
              <span className="tag">React 18</span>
              <span className="tag">TypeScript</span>
              <span className="tag">Vite</span>
            </div>
          </div>
          <div className="card arch-card">
            <h3>🖥️ Node.js BFF</h3>
            <p>Express server running on EKS. Handles authentication, data aggregation, and serves as the API gateway for the frontend.</p>
            <div className="tech-tags">
              <span className="tag">Express</span>
              <span className="tag">TypeScript</span>
              <span className="tag">JWT</span>
            </div>
          </div>
          <div className="card arch-card">
            <h3>🗄️ AWS RDS</h3>
            <p>PostgreSQL with Multi-AZ deployment. Connected via RDS Proxy for connection pooling. Automated backups enabled.</p>
            <div className="tech-tags">
              <span className="tag">PostgreSQL 15</span>
              <span className="tag">RDS Proxy</span>
              <span className="tag">Multi-AZ</span>
            </div>
          </div>
          <div className="card arch-card">
            <h3>☸️ Amazon EKS</h3>
            <p>Kubernetes cluster with HPA for auto-scaling. Uses Karpenter for node provisioning and ALB Ingress Controller.</p>
            <div className="tech-tags">
              <span className="tag">Kubernetes</span>
              <span className="tag">Karpenter</span>
              <span className="tag">Helm</span>
            </div>
          </div>
          <div className="card arch-card">
            <h3>⚡ AWS Lambda</h3>
            <p>Serverless functions for event-driven tasks — order processing, notifications, scheduled jobs. Cost-efficient at scale.</p>
            <div className="tech-tags">
              <span className="tag">Node.js 20</span>
              <span className="tag">SQS Trigger</span>
              <span className="tag">EventBridge</span>
            </div>
          </div>
          <div className="card arch-card">
            <h3>📊 Monitoring</h3>
            <p>CloudWatch for metrics/logs, X-Ray for distributed tracing, Container Insights for EKS, Prometheus + Grafana for custom dashboards.</p>
            <div className="tech-tags">
              <span className="tag">CloudWatch</span>
              <span className="tag">X-Ray</span>
              <span className="tag">Grafana</span>
            </div>
          </div>
        </div>
      </div>

      {/* Health Status */}
      <div className="section">
        <h2 className="section-title">System Health</h2>
        <div className="card health-card">
          {health ? (
            <div className="health-grid">
              <div className="health-item">
                <span className={`health-dot ${health.status === 'healthy' ? 'green' : 'red'}`} />
                <span>System: {health.status.toUpperCase()}</span>
              </div>
              <div className="health-item">
                <span className={`health-dot ${health.services.database === 'connected' ? 'green' : 'red'}`} />
                <span>Database: {health.services.database}</span>
              </div>
              <div className="health-item">
                <span className={`health-dot ${health.services.cache === 'connected' ? 'green' : 'red'}`} />
                <span>Cache: {health.services.cache}</span>
              </div>
              <div className="health-item">
                <span className="text-muted">Uptime: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m</span>
              </div>
            </div>
          ) : (
            <div className="health-grid">
              <div className="health-item">
                <span className="health-dot yellow" />
                <span>Server not running — start with <code>npm run dev:server</code></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
