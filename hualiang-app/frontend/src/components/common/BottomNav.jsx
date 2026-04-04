import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Home, Users, Sparkles, Briefcase, Newspaper } from 'lucide-react';

const BottomNav = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: '首頁' },
    { path: '/find-sisters', icon: Users, label: '找姐妹' },
    { path: '/business-match', icon: Briefcase, label: '商機' },
    { path: '/life-gallery', icon: Sparkles, label: '生活' },
    { path: '/news-events', icon: Newspaper, label: '消息' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 max-w-lg mx-auto">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-orange-500' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
