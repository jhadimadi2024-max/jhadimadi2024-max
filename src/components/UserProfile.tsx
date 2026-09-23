import React from 'react';
import { BloodDonorProfile, BloodDonorProfileProps } from './BloodDonorProfile';
import { useAuth } from '../context/AuthContext';
import { Language } from '../types';

export interface UserProfileComponentProps extends BloodDonorProfileProps {
  user?: any;
}

/**
 * Dedicated Clean Blood Donor Profile Card
 * Red-bordered card featuring Heart/Droplet iconography, large bold red donor name,
 * masked phone privacy, member count and unique ID, welcome appreciation greeting,
 * and donor controls (Sign Out & Delete Account for owners, WhatsApp Chat & Direct Call for visitors).
 */
export const UserProfile: React.FC<UserProfileComponentProps> = ({
  user,
  currentUser: passedCurrentUser,
  donor,
  profileData,
  isOwner,
  lang = 'bn',
  onSignOut,
  onDeleteAccount,
  ...rest
}) => {
  const { currentUser: authUser } = useAuth();
  const effectiveUser = user || passedCurrentUser || authUser || donor || profileData;

  return (
    <BloodDonorProfile
      currentUser={effectiveUser}
      donor={donor || effectiveUser}
      profileData={profileData || effectiveUser}
      isOwner={isOwner ?? Boolean(authUser && effectiveUser && (authUser.id === effectiveUser.id || authUser.phone === effectiveUser.phone))}
      lang={lang}
      onSignOut={onSignOut}
      onDeleteAccount={onDeleteAccount}
      {...rest}
    />
  );
};

export default UserProfile;
