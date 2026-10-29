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
  window.history.pushState(null, '', '/');
  window.location.href = '/';
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
    if (typeof window.navigateTo === 'function') {
      window.navigateTo('/login');
    } else {
      window.history.pushState(null, '', '/login');
    }
    return false;
  }
  return true;
}

export function requireTeacher() {
  if (!isLoggedIn()) {
    showToast('يرجى تسجيل الدخول بحساب المعلم أولاً', 'info');
    if (typeof window.navigateTo === 'function') {
      window.navigateTo('/login');
    } else {
      window.history.pushState(null, '', '/login');
    }
    return false;
  }
  if (!isTeacher()) {
    showToast('غير مصرح لك بالدخول - هذه الصفحة خاصة بالمعلم وإدارة المنصة فقط', 'warning');
    if (typeof window.navigateTo === 'function') {
      window.navigateTo('/dashboard');
    } else {
      window.history.pushState(null, '', '/dashboard');
    }
    return false;
  }
  return true;
}
