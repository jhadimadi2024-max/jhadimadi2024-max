import React from 'react';
import { BloodDonorProfile, BloodDonorProfileProps } from './BloodDonorProfile';
import { Language } from '../types';

export interface BloodDonorProfileViewProps {
  donor?: any;
  profileData?: any;
  currentUser?: any;
  isOwner?: boolean;
  lang?: Language;
  onSignOut?: () => void;
  onUpdateLastDonation?: (newDate: string) => void;
  onBack?: () => void;
  onEditProfile?: (data?: any) => void;
  onDeleteAccount?: () => void;
}

export const BloodDonorProfileView: React.FC<BloodDonorProfileViewProps> = (props) => {
  return <BloodDonorProfile {...props} />;
};

export { BloodDonorProfile } from './BloodDonorProfile';
export default BloodDonorProfileView;
