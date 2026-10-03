import { apiClient } from '@/lib/api-client';
import { Customer } from '@/shared/types';

export const customerService = {
  async list(limit = 20, offset = 0) {
    return apiClient.get<{
      data: Customer[];
      total: number;
    }>(`/customers?limit=${limit}&offset=${offset}`);
  },

  async get(id: string) {
    return apiClient.get<Customer>(`/customers/${id}`);
  },

  async create(data: Partial<Customer>) {
    return apiClient.post<Customer>('/customers', data);
  },

  async update(id: string, data: Partial<Customer>) {
    return apiClient.put<Customer>(`/customers/${id}`, data);
  },

  async delete(id: string) {
    return apiClient.delete(`/customers/${id}`);
  },
};
