import React, { useState, useEffect } from 'react';
import { Users, Calendar, Newspaper, Briefcase } from 'lucide-react';
import api from '../utils/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    members: 0,
    events: 0,
    news: 0,
    businessCards: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [members, events, news, cards] = await Promise.all([
        api.get('/members'),
        api.get('/events/upcoming'),
        api.get('/news'),
        api.get('/business/red-cards')
      ]);

      setStats({
        members: members.data.length,
        events: events.data.length,
        news: news.data.length,
        businessCards: cards.data.length
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', marginBottom: '20px', fontWeight: 'bold' }}>
        儀表板
      </h1>

      <div className="stats">
        <StatCard icon={Users} title="會員總數" value={stats.members} color="#3b82f6" />
        <StatCard icon={Calendar} title="活動總數" value={stats.events} color="#10b981" />
        <StatCard icon={Newspaper} title="消息總數" value={stats.news} color="#f59e0b" />
        <StatCard icon={Briefcase} title="商機卡數" value={stats.businessCards} color="#ef4444" />
      </div>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
        <h2 style={{ marginBottom: '15px', fontWeight: 'bold' }}>最近概況</h2>
        <p style={{ color: '#6b7280', marginBottom: '10px' }}>
          系統已成功部署。您可以通過左側導航菜單管理應用的各項內容。
        </p>
        <ul style={{ marginTop: '15px', paddingLeft: '20px', color: '#6b7280' }}>
          <li>📊 在儀表板查看統計信息</li>
          <li>👥 管理會員信息和聯繫方式</li>
          <li>📅 發布和管理活動信息</li>
          <li>📰 發佈最新消息和公告</li>
          <li>💼 發佈商機需求和優惠信息</li>
        </ul>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, color }) => (
  <div className="stat-card">
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
      <Icon size={24} style={{ color, marginRight: '10px' }} />
      <h3>{title}</h3>
    </div>
    <div className="value">{value}</div>
  </div>
);

export default Dashboard;
