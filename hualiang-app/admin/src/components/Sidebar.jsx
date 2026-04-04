import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Calendar, Newspaper, Briefcase, BarChart3 } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: BarChart3, label: '儀表板' },
    { path: '/members', icon: Users, label: '會員管理' },
    { path: '/events', icon: Calendar, label: '活動管理' },
    { path: '/news', icon: Newspaper, label: '消息管理' },
    { path: '/business', icon: Briefcase, label: '商機管理' },
  ];

  return (
    <div className="sidebar">
      <h1 style={{ fontSize: '20px', marginBottom: '30px', fontWeight: 'bold' }}>
        華亮管理後台
      </h1>

      <nav>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '6px',
                color: isActive ? '#f97316' : '#d1d5db',
                textDecoration: 'none',
                backgroundColor: isActive ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
