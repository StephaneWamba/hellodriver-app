export interface AdminLiveDriver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  hasActiveTrip: boolean;
}
