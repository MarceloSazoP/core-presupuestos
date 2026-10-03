import { apiClient } from '@/lib/api-client';
import { User } from '@/shared/types';

export interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  async requestCode(phoneOrEmail: string, method: 'SMS' | 'EMAIL') {
    return apiClient.post('/auth/request-code', {
      phone_or_email: phoneOrEmail,
      method,
    });
  },

  async verifyCode(phoneOrEmail: string, code: string, name?: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/verify-code', {
      phone_or_email: phoneOrEmail,
      code,
      name,
    });

    if (response.token) {
      apiClient.setToken(response.token);
    }

    return response;
  },

  logout() {
    apiClient.clearToken();
  },

  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  },

  isAuthenticated() {
    return !!this.getToken();
  },
};
