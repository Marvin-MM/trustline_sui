import apiClient from '@/lib/api-client';

export interface NonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    walletAddress: string;
    isPlatformAdmin: boolean;
  };
}

export const authApi = {
  getNonce: async (walletAddress: string): Promise<NonceResponse> => {
    const { data } = await apiClient.get<NonceResponse>(`/auth/nonce/${walletAddress}`);
    return data;
  },

  verifySignature: async (params: {
    walletAddress: string;
    signature: string;
    message: string;
  }): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/verify', params);
    return data;
  },

  refresh: async (): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/refresh');
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
