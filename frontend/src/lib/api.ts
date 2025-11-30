
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Handle API response and trigger logout on 401
 */
async function handleResponse(res: Response) {
  // Check for 401 Unauthorized
  if (res.status === 401) {
    // Trigger logout event that AuthContext listens to
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new Error('Unauthorized - please login again');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  get: async (endpoint: string) => {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_URL}${endpoint}`, { headers });
    return handleResponse(res);
  },

  post: async (endpoint: string, data: any) => {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    };
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  delete: async (endpoint: string) => {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(res);
  }
};

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');

  if (token) {
    return {
      'Authorization': `Bearer ${token}`
    };
  }
  return {};
}
