import React from 'react';
import { UserProfile, UserProfileComponentProps } from '../components/UserProfile';

export const ProfilePage: React.FC<UserProfileComponentProps> = (props) => {
  return (
    <div className="w-full min-h-screen py-4 px-3 flex flex-col items-center justify-center">
      <UserProfile {...props} />
    </div>
  );
};

export default ProfilePage;
