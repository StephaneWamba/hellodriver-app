export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: 'client' | 'driver' | 'admin';
  avatar_url: string | null;
}

export interface SessionResponse {
  user: AdminUser;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
