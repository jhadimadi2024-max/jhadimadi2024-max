import React from 'react';
import { ProfileTab, ProfileTabProps } from './ProfileTab';

export interface AccountScreenProps extends ProfileTabProps {}

export const AccountScreen: React.FC<AccountScreenProps> = (props) => {
  return <ProfileTab {...props} />;
};

export default AccountScreen;
