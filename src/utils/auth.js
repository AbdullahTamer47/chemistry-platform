import { showToast } from '../components/toast.js';

export function getUser() {
  try {
    const u = localStorage.getItem('user');
    if (!u || u === 'undefined' || u === 'null') return null;
    return JSON.parse(u);
  } catch (e) {
    localStorage.removeItem('user');
    return null;
  }
}

export function getToken() {
  const t = localStorage.getItem('token');
  if (!t || t === 'undefined' || t === 'null') return null;
  return t;
}

export function setAuth(user, token) {
  if (user) localStorage.setItem('user', JSON.stringify(user));
  if (token) localStorage.setItem('token', token);
}

export function logout() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  window.location.hash = '#/';
  window.location.reload();
}

export function isLoggedIn() {
  return !!getToken();
}

export function isTeacher() {
  const u = getUser();
  return !!(u && (u.role === 'teacher' || u.role === 'admin'));
}

export function requireAuth() {
  if (!isLoggedIn()) {
    showToast('يرجى تسجيل الدخول أولاً للوصول إلى هذه الصفحة', 'info');
    window.location.hash = '#/login';
    return false;
  }
  return true;
}

export function requireTeacher() {
  if (!isLoggedIn()) {
    showToast('يرجى تسجيل الدخول بحساب المعلم أولاً', 'info');
    window.location.hash = '#/login';
    return false;
  }
  if (!isTeacher()) {
    showToast('غير مصرح لك بالدخول - هذه الصفحة خاصة بالمعلم وإدارة المنصة فقط', 'warning');
    window.location.hash = '#/dashboard';
    return false;
  }
  return true;
}
