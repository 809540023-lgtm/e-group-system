import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import api from '../utils/api';

const NewsPage = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    content: '',
    date: '',
    type: '公告',
    important: false
  });

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await api.get('/news');
      setNews(response.data);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/news', formData);
      await fetchNews();
      setShowForm(false);
      setFormData({
        title: '',
        summary: '',
        content: '',
        date: '',
        type: '公告',
        important: false
      });
    } catch (error) {
      console.error('Failed to create news:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>消息管理</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> 新增消息
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '15px', fontWeight: 'bold' }}>新增消息</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>標題 *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>簡要</label>
              <input
                type="text"
                name="summary"
                value={formData.summary}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>內容</label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleInputChange}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>日期</label>
                <input
                  type="text"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  placeholder="例如: 2025年3月15日"
                />
              </div>
              <div className="form-group">
                <label>類型</label>
                <select name="type" value={formData.type} onChange={handleInputChange}>
                  <option value="公告">公告</option>
                  <option value="活動">活動</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="important"
                  checked={formData.important}
                  onChange={handleInputChange}
                />
                {' '}重要公告
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">保存</button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p>正在載入...</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>標題</th>
                <th>類型</th>
                <th>日期</th>
                <th>重要</th>
              </tr>
            </thead>
            <tbody>
              {news.map(item => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.type}</td>
                  <td>{item.date}</td>
                  <td>{item.important ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NewsPage;
