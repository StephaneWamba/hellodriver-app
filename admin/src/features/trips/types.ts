export interface AdminTripListItem {
  id: string;
  status: string;
  originAddress: string | null;
  destinationAddress: string | null;
  fareEstimateXaf: number | null;
  finalFareXaf: number | null;
  paymentStatus: string;
  createdAt: string;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  driverId: string | null;
  driverFirstName: string | null;
  driverLastName: string | null;
}

export interface AdminTripDetail extends AdminTripListItem {
  clientPhone: string;
  driverPhone: string | null;
  adminCancellationReason: string | null;
  originLatitude: string;
  originLongitude: string;
  destinationLatitude: string;
  destinationLongitude: string;
  clientRating: number | null;
  clientComment: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  bids: Array<{
    id: string;
    driverId: string;
    driverFirstName: string;
    driverLastName: string;
    amountXaf: number;
    etaMinutes: number;
    status: string;
    createdAt: string;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
