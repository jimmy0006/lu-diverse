import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const register = (data: { username: string; email: string; password: string }) =>
  api.post('/auth/register', data);

export const login = (data: { email: string; password: string }) =>
  api.post('/auth/login', data);

// Games
export const getGames = (params?: { search?: string; sort?: string; page?: number; limit?: number }) =>
  api.get('/games', { params });

export const getMyGames = () => api.get('/games/my');

export const getGame = (id: number) => api.get(`/games/${id}`);

export const uploadGame = (formData: FormData) =>
  api.post('/games', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const updateGame = (id: number, formData: FormData) =>
  api.patch(`/games/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Wishlist
export const getWishlist = () => api.get('/wishlist');

export const addWishlist = (gameId: number) => api.post(`/wishlist/${gameId}`);

export const removeWishlist = (gameId: number) => api.delete(`/wishlist/${gameId}`);

// Playtime
export const recordPlaytime = (gameId: number, durationSeconds: number) =>
  api.post('/playtime', { gameId, durationSeconds });

export default api;
