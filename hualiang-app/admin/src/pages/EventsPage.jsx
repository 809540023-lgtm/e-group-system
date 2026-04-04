import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import api from '../utils/api';

const EventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    speaker: '',
    capacity: '',
    image: '',
    type: '例會',
    is_upcoming: true
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/events/upcoming');
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        capacity: parseInt(formData.capacity)
      };
      await api.post('/events', payload);
      await fetchEvents();
      setShowForm(false);
      setFormData({
        title: '',
        date: '',
        time: '',
        location: '',
        description: '',
        speaker: '',
        capacity: '',
        image: '',
        type: '例會',
        is_upcoming: true
      });
    } catch (error) {
      console.error('Failed to create event:', error);
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
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>活動管理</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> 新增活動
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '15px', fontWeight: 'bold' }}>新增活動</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>活動標題 *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
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
                  placeholder="例如: 2025年3月25日"
                />
              </div>
              <div className="form-group">
                <label>時間</label>
                <input
                  type="text"
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  placeholder="例如: 14:00 - 17:00"
                />
              </div>
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
              <label>描述</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>主講人</label>
                <input
                  type="text"
                  name="speaker"
                  value={formData.speaker}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>容納人數</label>
                <input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>活動類型</label>
              <select name="type" value={formData.type} onChange={handleInputChange}>
                <option value="例會">例會</option>
                <option value="活動">活動</option>
                <option value="慶生會">慶生會</option>
                <option value="派對">派對</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="is_upcoming"
                  checked={formData.is_upcoming}
                  onChange={handleInputChange}
                />
                {' '}即將舉行
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
                <th>日期</th>
                <th>地點</th>
                <th>類型</th>
                <th>容納人數</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{event.date}</td>
                  <td>{event.location}</td>
                  <td>{event.type}</td>
                  <td>{event.capacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
