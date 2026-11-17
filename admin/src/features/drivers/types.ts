export interface DriverProfile {
  id: string;
  userId: string;
  dateOfBirth?: string | null;
  vehicleBrand?: string | null;
  vehicleYear?: number | null;
  vehicleModel?: string | null;
  vehicleRegistration?: string | null;
  residentialArea?: string | null;
  hasAc?: boolean | null;
  mobileMoneyAccount?: string | null;
  isVerified: boolean;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verifiedAt?: string | null;
  ratingAvg: number | string;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string | null;
}

export type DocumentType = 'drivers_license' | 'id_card' | 'vehicle_insurance';
export type UploadStatus = 'pending' | 'verified' | 'rejected';

export interface DriverDocument {
  id: string;
  userId: string;
  documentType: DocumentType;
  storageUrl: string;
  uploadStatus: UploadStatus;
  rejectionReason: string | null;
  uploadedAt: string;
  verifiedAt: string | null;
  verifiedByAdminId: string | null;
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  drivers_license: 'Permis de conduire',
  id_card: "Carte d'identité",
  vehicle_insurance: 'Assurance véhicule',
};
