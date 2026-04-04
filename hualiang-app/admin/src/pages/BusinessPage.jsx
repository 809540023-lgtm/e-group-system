import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import api from '../utils/api';

const BusinessPage = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cardType, setCardType] = useState('red');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'red',
    author: '',
    title: '',
    description: '',
    industry: '',
    urgency: '普通',
    originalPrice: '',
    discountPrice: '',
    discount: '',
    date: ''
  });

  useEffect(() => {
    fetchCards();
  }, [cardType]);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const endpoint = cardType === 'red' ? '/business/red-cards' : '/business/green-cards';
      const response = await api.get(endpoint);
      setCards(response.data);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        originalPrice: formData.originalPrice ? parseInt(formData.originalPrice) : null,
        discountPrice: formData.discountPrice ? parseInt(formData.discountPrice) : null,
        discount: formData.discount ? parseInt(formData.discount) : null
      };
      await api.post('/business/cards', payload);
      await fetchCards();
      setShowForm(false);
      setFormData({
        type: cardType,
        author: '',
        title: '',
        description: '',
        industry: '',
        urgency: '普通',
        originalPrice: '',
        discountPrice: '',
        discount: '',
        date: ''
      });
    } catch (error) {
      console.error('Failed to create card:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCardTypeChange = (type) => {
    setCardType(type);
    setFormData(prev => ({ ...prev, type }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>商機管理</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> 新增卡片
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          className={cardType === 'red' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => handleCardTypeChange('red')}
        >
          🔴 需求紅卡
        </button>
        <button
          className={cardType === 'green' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => handleCardTypeChange('green')}
        >
          🟢 優惠綠卡
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '15px', fontWeight: 'bold' }}>
            新增 {cardType === 'red' ? '需求卡' : '優惠卡'}
          </h2>
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
              <label>描述</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>作者</label>
                <input
                  type="text"
                  name="author"
                  value={formData.author}
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
            </div>

            {cardType === 'red' && (
              <div className="form-group">
                <label>緊急程度</label>
                <select name="urgency" value={formData.urgency} onChange={handleInputChange}>
                  <option value="普通">普通</option>
                  <option value="急">急</option>
                </select>
              </div>
            )}

            {cardType === 'green' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>原價</label>
                  <input
                    type="number"
                    name="originalPrice"
                    value={formData.originalPrice}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>優惠價</label>
                  <input
                    type="number"
                    name="discountPrice"
                    value={formData.discountPrice}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>折扣 (%)</label>
                  <input
                    type="number"
                    name="discount"
                    value={formData.discount}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>日期</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                placeholder="例如: 2025-03-18"
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
                <th>標題</th>
                <th>作者</th>
                <th>行業</th>
                <th>日期</th>
                {cardType === 'red' && <th>緊急程度</th>}
                {cardType === 'green' && (
                  <>
                    <th>原價</th>
                    <th>優惠價</th>
                    <th>折扣</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {cards.map(card => (
                <tr key={card.id}>
                  <td>{card.title}</td>
                  <td>{card.author}</td>
                  <td>{card.industry}</td>
                  <td>{card.date}</td>
                  {cardType === 'red' && <td>{card.urgency}</td>}
                  {cardType === 'green' && (
                    <>
                      <td>${card.originalPrice}</td>
                      <td>${card.discountPrice}</td>
                      <td>{card.discount}%</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BusinessPage;
