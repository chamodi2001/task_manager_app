import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export const taskApi = {
  list: () => api.get('/tasks/'),
  get: (id) => api.get(`/tasks/${id}/`),
  create: (data) => api.post('/tasks/', data),
  update: (id, data) => api.patch(`/tasks/${id}/`, data),
  delete: (id) => api.delete(`/tasks/${id}/`),
  uploadFile: (formData) =>
    api.post('/tasks/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  createWithFile: (formData) =>
    api.post('/tasks/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateWithFile: (id, formData) =>
    api.patch(`/tasks/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
