import axios from 'axios';

// 支持環境變量配置 API 地址
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Members API
export const membersAPI = {
  getAll: () => api.get('/members'),
  getById: (id) => api.get(`/members/${id}`),
  search: (params) => api.get('/members/search', { params }),
};

// Events API
export const eventsAPI = {
  getUpcoming: () => api.get('/events/upcoming'),
  getPast: () => api.get('/events/past'),
  getById: (id) => api.get(`/events/${id}`),
};

// News API
export const newsAPI = {
  getAll: () => api.get('/news'),
  getById: (id) => api.get(`/news/${id}`),
};

// Business Cards API
export const businessAPI = {
  getRedCards: () => api.get('/business/red-cards'),
  getGreenCards: () => api.get('/business/green-cards'),
  getHotOpportunities: () => api.get('/business/hot-opportunities'),
};

// Life Gallery API
export const galleryAPI = {
  getPosts: () => api.get('/gallery/posts'),
  getByMonth: (month) => api.get(`/gallery/posts/${month}`),
};

export default api;
