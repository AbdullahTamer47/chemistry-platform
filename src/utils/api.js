const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method: options.method || 'GET',
    headers: { ...headers, ...options.headers },
  };

  if (options.body) {
    config.body = isFormData ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, config);

  // 401 Session Handling (Recommended by gpt-6.1-sol)
  if (res.status === 401) {
    const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');
    if (!isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.hash.includes('/login') && !window.location.hash.includes('/register')) {
        window.location.hash = '#/login';
      }
      throw new Error('انتهت الجلسة - يرجى تسجيل الدخول مرة أخرى');
    }
  }

  // Handle empty responses (204 No Content, etc.)
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const errorMsg = (typeof data?.error === 'string' && data.error)
      || (typeof data?.message === 'string' && data.message)
      || (typeof data === 'string' && data)
      || (res.status === 404 ? 'الخدمة المطلوبة غير متوفرة حالياً (404)' : `حدث خطأ في الخادم (${res.status})`);
    throw new Error(errorMsg);
  }
  return data;
}

export const api = {
  // Auth
  login: (body) => request('/auth/login', { method: 'POST', body }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  getMe: () => request('/auth/me'),
  updateProfile: (body) => request('/auth/me', { method: 'PUT', body }),
  changePassword: (body) => request('/auth/change-password', { method: 'PUT', body }),
  getDashboard: () => request('/auth/dashboard'),

  // Courses
  getCourses: (grade) => request(`/courses${grade ? `?grade=${encodeURIComponent(grade)}` : ''}`),
  getCourse: (id) => request(`/courses/${id}`),
  getEnrollment: (id) => request(`/courses/${id}/enrollment`),
  getMyEnrolled: () => request('/courses/my/enrolled'),
  enrollCourse: (id) => request(`/courses/${id}/enroll`, { method: 'POST' }),

  // Payments (manual transfer verification)
  getPaymentConfig: () => request('/payments/config'),
  updatePaymentConfig: (body) => request('/payments/config', { method: 'PUT', body }),
  submitPayment: (body) => request('/payments', { method: 'POST', body }),
  getMyPayments: () => request('/payments/my'),
  getPayments: (status) => request(`/payments${status ? `?status=${status}` : ''}`),
  reviewPayment: (id, body) => request(`/payments/${id}`, { method: 'PUT', body }),
  createCourse: (body) => request('/courses', { method: 'POST', body }),
  updateCourse: (id, body) => request(`/courses/${id}`, { method: 'PUT', body }),
  deleteCourse: (id) => request(`/courses/${id}`, { method: 'DELETE' }),
  addChapter: (courseId, body) => request(`/courses/${courseId}/chapters`, { method: 'POST', body }),
  updateChapter: (chapterId, body) => request(`/courses/chapters/${chapterId}`, { method: 'PUT', body }),
  deleteChapter: (chapterId) => request(`/courses/chapters/${chapterId}`, { method: 'DELETE' }),

  // Lessons
  getCourseLessons: (courseId) => request(`/lessons/course/${courseId}`),
  getLesson: (id) => request(`/lessons/${id}`),
  getVideoToken: (id) => request(`/lessons/${id}/video-token`, { method: 'POST' }),
  updateProgress: (id, body) => request(`/lessons/${id}/progress`, { method: 'POST', body }),
  createLesson: (body) => request('/lessons', { method: 'POST', body }),
  updateLesson: (id, body) => request(`/lessons/${id}`, { method: 'PUT', body }),
  deleteLesson: (id) => request(`/lessons/${id}`, { method: 'DELETE' }),

  // Exams
  getExams: () => request('/exams'),
  getCourseExams: (courseId) => request(`/exams/course/${courseId}`),
  getExamForTaking: (id) => request(`/exams/${id}/take`),
  getExam: (id) => request(`/exams/${id}/details`),
  getExamSubmissions: (id) => request(`/exams/${id}/submissions`),
  gradeEssaySubmission: (attemptId, body) => request(`/exams/attempt/${attemptId}/grade-essay`, { method: 'POST', body }),
  submitExam: (id, body) => request(`/exams/${id}/submit`, { method: 'POST', body }),
  getAttempt: (id) => request(`/exams/attempt/${id}`),
  getExamReview: (id) => request(`/exams/${id}/my-attempt`),
  getMyExamAttempts: () => request('/exams/my-attempts'),
  createExam: (body) => request('/exams', { method: 'POST', body }),
  updateExam: (id, body) => request(`/exams/${id}`, { method: 'PUT', body }),
  deleteExam: (id) => request(`/exams/${id}`, { method: 'DELETE' }),
  addQuestion: (examId, body) => request(`/exams/${examId}/questions`, { method: 'POST', body }),
  updateQuestion: (questionId, body) => request(`/exams/questions/${questionId}`, { method: 'PUT', body }),
  deleteQuestion: (questionId) => request(`/exams/questions/${questionId}`, { method: 'DELETE' }),

  // Codes
  generateCodes: (body) => request('/codes/generate', { method: 'POST', body }),
  activateCode: (code) => request('/codes/activate', { method: 'POST', body: { code } }),
  getCodes: (courseId) => request(`/codes${courseId ? `?course_id=${courseId}` : ''}`),
  getCodeUsage: (id) => request(`/codes/${id}/usage`),
  updateCode: (id, body) => request(`/codes/${id}`, { method: 'PUT', body }),
  deleteCode: (id) => request(`/codes/${id}`, { method: 'DELETE' }),

  // Leaderboard
  getLeaderboard: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/leaderboard${q ? `?${q}` : ''}`);
  },
  getMyRank: () => request('/leaderboard/my-rank'),

  // Live
  getLiveSessions: () => request('/live'),
  getUpcomingSessions: () => request('/live/upcoming'),
  createLiveSession: (body) => request('/live', { method: 'POST', body }),
  updateLiveSession: (id, body) => request(`/live/${id}`, { method: 'PUT', body }),
  deleteLiveSession: (id) => request(`/live/${id}`, { method: 'DELETE' }),

  // Students (teacher)
  getStudents: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/students${q ? `?${q}` : ''}`);
  },
  getStudent: (id) => request(`/students/${id}`),
  updateStudent: (id, body) => request(`/students/${id}`, { method: 'PUT', body }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),
  getDashboardStats: () => request('/students/stats/dashboard'),

  // Notifications
  getNotifications: () => request('/students/notifications/my'),
  getUnreadCount: () => request('/students/notifications/unread-count'),
  markNotifRead: (id) => request(`/students/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotifsRead: () => request('/students/notifications/read-all', { method: 'PUT' }),
  sendNotification: (body) => request('/students/notifications/send', { method: 'POST', body }),

  // Discussions (Forum)
  getDiscussions: (courseId, lessonId) => {
    let url = `/discussions/${courseId}`;
    if (lessonId) url += `?lesson_id=${lessonId}`;
    return request(url);
  },
  postDiscussion: (body) => request('/discussions', { method: 'POST', body }),
  postReply: (discussionId, body) => request(`/discussions/${discussionId}/replies`, { method: 'POST', body }),
  deleteDiscussion: (id) => request(`/discussions/${id}`, { method: 'DELETE' }),
  deleteReply: (id) => request(`/discussions/replies/${id}`, { method: 'DELETE' }),

  // Teacher Overrides & Actions
  suspendStudent: (studentId, courseId, is_suspended) => request(`/students/${studentId}/enrollments/${courseId}/suspend`, { method: 'PUT', body: { is_suspended } }),

  // File Uploads
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/upload', { method: 'POST', body: fd });
  },

  // Pillar 1: Wallet & Instant Fawry & Vouchers
  getWalletBalance: () => request('/payments/wallet/balance'),
  generateFawry: (amount) => request('/payments/fawry/generate', { method: 'POST', body: { amount } }),
  simulateFawryPay: (reference_code) => request('/payments/fawry/simulate-pay', { method: 'POST', body: { reference_code } }),
  chargeVoucher: (voucher_code) => request('/payments/wallet/charge-voucher', { method: 'POST', body: { voucher_code } }),
  getVouchers: () => request('/payments/vouchers'),
  generateVouchers: (body) => request('/payments/vouchers/generate', { method: 'POST', body }),

  // Pillar 2: Visual Analytics
  getStudentAnalytics: () => request('/students/analytics'),

  // Pillar 3: Certificates & Saved Videos
  getMyCertificates: () => request('/exams/certificates/my'),
  verifyCertificate: (certCode) => request(`/exams/certificates/verify/${certCode}`),
  getSavedLessons: () => request('/lessons/saved'),
  toggleBookmark: (lessonId) => request(`/lessons/${lessonId}/bookmark`, { method: 'POST' }),

  // Pillar 4: Packages & Store Locator
  getPackages: () => request('/packages'),
  getPackage: (id) => request(`/packages/${id}`),
  subscribePackage: (id, body) => request(`/packages/${id}/subscribe`, { method: 'POST', body }),
  getBookstores: (governorate) => request(`/packages/stores/all${governorate ? `?governorate=${encodeURIComponent(governorate)}` : ''}`),
  rateBookstore: (id, rating) => request(`/packages/stores/${id}/rate`, { method: 'POST', body: { rating } }),
  createBookstore: (body) => request('/packages/stores', { method: 'POST', body }),
  updateBookstore: (id, body) => request(`/packages/stores/${id}`, { method: 'PUT', body }),
  deleteBookstore: (id) => request(`/packages/stores/${id}`, { method: 'DELETE' }),

  // Pillar 5: Adaptive Mistakes Quiz
  getAdaptiveMistakesQuiz: () => request('/exams/adaptive-mistakes-quiz', { method: 'POST' }),
};

