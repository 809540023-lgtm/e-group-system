import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import api from '../utils/api';

const MembersPage = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    industry: '',
    title: '',
    location: '',
    phone: '',
    line_id: '',
    avatar: '',
    description: '',
    tags: ''
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/members');
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim())
      };
      await api.post('/members', payload);
      await fetchMembers();
      setShowForm(false);
      setFormData({
        name: '',
        company: '',
        industry: '',
        title: '',
        location: '',
        phone: '',
        line_id: '',
        avatar: '',
        description: '',
        tags: ''
      });
    } catch (error) {
      console.error('Failed to create member:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>會員管理</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} style={{ marginRight: '5px' }} />
          新增會員
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '15px', fontWeight: 'bold' }}>新增會員</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>名字 *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>公司</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>行業</label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>職位</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>地點</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>電話</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Line ID</label>
              <input
                type="text"
                name="line_id"
                value={formData.line_id}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>頭像URL</label>
              <input
                type="text"
                name="avatar"
                value={formData.avatar}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>標籤 (逗號分隔)</label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="例如: 設計, 行銷, 諮詢"
              />
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
                <th>名字</th>
                <th>公司</th>
                <th>行業</th>
                <th>地點</th>
                <th>電話</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.company}</td>
                  <td>{member.industry}</td>
                  <td>{member.location}</td>
                  <td>{member.phone}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ marginRight: '5px' }}>
                      <Edit2 size={16} />
                    </button>
                    <button className="btn btn-danger">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MembersPage;
