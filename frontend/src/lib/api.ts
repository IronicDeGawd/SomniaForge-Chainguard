
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = {
  get: async (endpoint: string) => {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_URL}${endpoint}`, { headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${res.statusText}`);
    }
    return res.json();
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
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${res.statusText}`);
    }
    return res.json();
  },

  delete: async (endpoint: string) => {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${res.statusText}`);
    }
    return res.json();
  }
};

function getAuthHeaders() {
  const address = localStorage.getItem('auth_address');
  const signature = localStorage.getItem('auth_signature');
  const timestamp = localStorage.getItem('auth_timestamp');

  if (address && signature && timestamp) {
    return {
      'x-wallet-address': address,
      'x-auth-signature': signature,
      'x-auth-timestamp': timestamp,
    };
  }
  return {};
}
