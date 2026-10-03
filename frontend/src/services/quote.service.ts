import { apiClient } from '@/lib/api-client';
import { Quote, FollowUp } from '@/shared/types';

export const quoteService = {
  async list(filters?: { doc_status?: string; commercial_status?: string }, limit = 20, offset = 0) {
    let url = `/quotes?limit=${limit}&offset=${offset}`;
    if (filters?.doc_status) url += `&doc_status=${filters.doc_status}`;
    if (filters?.commercial_status) url += `&commercial_status=${filters.commercial_status}`;
    return apiClient.get<{ data: Quote[]; total: number }>(url);
  },

  async get(id: string) {
    return apiClient.get<Quote>(`/quotes/${id}`);
  },

  async create(data: Partial<Quote>) {
    return apiClient.post<Quote>('/quotes', data);
  },

  async update(id: string, data: Partial<Quote>) {
    return apiClient.put<Quote>(`/quotes/${id}`, data);
  },

  async finalize(id: string) {
    return apiClient.post<Quote>(`/quotes/${id}/finalize`, {});
  },

  async send(id: string) {
    return apiClient.post<Quote>(`/quotes/${id}/send`, {});
  },

  async getFollowUps(quoteId: string) {
    return apiClient.get<FollowUp[]>(`/quotes/${quoteId}/follow-ups`);
  },

  async createFollowUp(quoteId: string, data: Partial<FollowUp>) {
    return apiClient.post<FollowUp>(`/quotes/${quoteId}/follow-ups`, data);
  },

  async updateFollowUp(quoteId: string, followUpId: string, data: Partial<FollowUp>) {
    return apiClient.put<FollowUp>(`/quotes/${quoteId}/follow-ups/${followUpId}`, data);
  },
};
