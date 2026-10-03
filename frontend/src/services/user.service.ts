import { apiClient } from '@/lib/api-client';
import { User } from '@/shared/types';

export const userService = {
  async getProfile() {
    return apiClient.get<User>('/users/profile');
  },

  async updateProfile(data: Partial<User>) {
    return apiClient.put<User>('/users/profile', data);
  },
};
