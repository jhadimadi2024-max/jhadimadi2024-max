import React, { useState, useMemo } from 'react';
import { 
  Heart, 
  Droplet, 
  MapPin, 
  MessageSquare, 
  LogOut, 
  Trash2,
  PhoneCall, 
  ArrowLeft,
  HeartHandshake,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Language } from '../types';
import { AccountDeletionModal } from './AccountDeletionModal';

export interface BloodDonorData {
  id?: string | number;
  uniqueId?: string;
  memberUID?: string;
  donorIdCode?: string;
  name?: string;
  fullName?: string;
  full_name?: string;
  bloodGroup?: string;
  blood_group?: string;
  district?: string;
  upazila?: string;
  thana?: string;
  phone?: string;
  whatsappNumber?: string;
  phone_number?: string;
  [key: string]: any;
}

export interface BloodDonorProfileProps {
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

/**
 * Convert Latin digits to Bengali digits
 */
export const toBengaliDigits = (val: string | number): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/[0-9]/g, (digit) => bnDigits[+digit]);
};

/**
 * Format or auto-generate Unique Donor ID Code (e.g. JHD-BD-0001)
 */
export const formatDonorIdCode = (rawId?: string | number, fallbackSeed?: string): string => {
  if (rawId) {
    const str = String(rawId).trim();
    if (str.startsWith('JHD-BD-')) return str;
    if (str.startsWith('JM-BLD-') || str.startsWith('bld_') || str.startsWith('BD-')) {
      const numPart = str.replace(/\D/g, '').slice(-4);
      return `JHD-BD-${numPart.padStart(4, '0') || '0001'}`;
    }
    const digitsOnly = str.replace(/\D/g, '');
    if (digitsOnly.length > 0) {
      return `JHD-BD-${digitsOnly.slice(-4).padStart(4, '0')}`;
    }
  }
  if (fallbackSeed) {
    const seedDigits = String(fallbackSeed).replace(/\D/g, '').slice(-4);
    if (seedDigits) return `JHD-BD-${seedDigits.padStart(4, '0')}`;
  }
  return 'JHD-BD-0001';
};

/**
 * Extract numerical member index from donor ID or seed and format as Bengali number
 */
export const extractMemberNumber = (donorId: string, fallbackSeed?: string): string => {
  const digits = String(donorId || '').replace(/\D/g, '');
  if (digits) {
    const parsed = parseInt(digits, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return toBengaliDigits(parsed);
    }
  }
  if (fallbackSeed) {
    const seedDigits = String(fallbackSeed).replace(/\D/g, '');
    if (seedDigits) {
      const parsed = parseInt(seedDigits.slice(-4), 10);
      if (!isNaN(parsed) && parsed > 0) {
        return toBengaliDigits(parsed);
      }
    }
  }
  return '১';
};

export const BloodDonorProfile: React.FC<BloodDonorProfileProps> = ({
  donor: passedDonor,
  profileData,
  currentUser,
  isOwner: passedIsOwner,
  lang = 'bn',
  onSignOut,
  onBack,
  onDeleteAccount,
}) => {
  const { logout, currentUser: authCurrentUser } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [isInternalDeleteOpen, setIsInternalDeleteOpen] = useState(false);

  // Merge raw profile sources
  const mergedData = useMemo(() => {
    return {
      ...(currentUser || {}),
      ...(profileData || {}),
      ...(passedDonor || {}),
    };
  }, [currentUser, profileData, passedDonor]);

  // Determine if viewer is the profile owner (logged-in donor session)
  const isOwner = useMemo(() => {
    if (typeof passedIsOwner === 'boolean') return passedIsOwner;
    const currentPhone = authCurrentUser?.phone || currentUser?.phone;
    const donorPhone = mergedData.phone || mergedData.phoneNumber || mergedData.phone_number;
    if (currentPhone && donorPhone && currentPhone === donorPhone) return true;
    const currentId = authCurrentUser?.id || currentUser?.id;
    const donorId = mergedData.id || mergedData.uniqueId || mergedData.memberUID;
    if (currentId && donorId && currentId === donorId) return true;
    return false;
  }, [passedIsOwner, authCurrentUser, currentUser, mergedData]);

  // Donor Full Name
  const donorName = (
    mergedData.name || 
    mergedData.fullName || 
    mergedData.full_name || 
    'রক্তদাতা সদস্য'
  ).trim();

  // Blood Group
  const bloodGroup = (
    mergedData.bloodGroup || 
    mergedData.blood_group || 
    'O+'
  ).toUpperCase().replace(/\s+/g, '');

  // Location: District & Upazila
  const district = (mergedData.district || 'খাগড়াছড়ি').trim();
  const upazila = (mergedData.upazila || mergedData.thana || 'সদর').trim();
  const locationText = `${district}, ${upazila}`;

  // Raw Phone (Stored privately in memory for action buttons ONLY; NEVER rendered as text)
  const rawPhone = (
    mergedData.phone || 
    mergedData.phoneNumber || 
    mergedData.phone_number || 
    mergedData.whatsappNumber || 
    mergedData.whatsapp_number || 
    ''
  ).trim();

  // Donor ID Code (e.g. JHD-BD-0001)
  const donorIdCode = useMemo(() => {
    const raw = mergedData.donorIdCode || 
      mergedData.districtUniqueId || 
      mergedData.uniqueId || 
      mergedData.unique_id || 
      mergedData.memberUID ||
      mergedData.id;
    return formatDonorIdCode(raw, rawPhone);
  }, [mergedData, rawPhone]);

  // Member Number in Bengali
  const memberNumber = useMemo(() => {
    return extractMemberNumber(donorIdCode, rawPhone);
  }, [donorIdCode, rawPhone]);

  // Copy ID
  const handleCopyId = () => {
    if (donorIdCode) {
      navigator.clipboard.writeText(donorIdCode);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // WhatsApp Action: Pre-filled emergency message, never exposes phone on screen
  const handleWhatsAppChat = () => {
    if (!rawPhone) {
      alert('রক্তদাতার যোগাযোগের নম্বর পাওয়া যায়নি।');
      return;
    }
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const intlNumber = cleanDigits.startsWith('0') 
      ? '88' + cleanDigits 
      : (cleanDigits.startsWith('88') ? cleanDigits : '88' + cleanDigits);

    const message = encodeURIComponent(
      `জরুরি রক্ত প্রয়োজন! আপনার ${bloodGroup} রক্তের গ্রুপের সহায়তার জন্য যোগাযোগ করছি।`
    );
    window.open(`https://wa.me/${intlNumber}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  // Direct Call Action: Initiates tel: without revealing raw number on screen
  const handleDirectCall = () => {
    if (!rawPhone) {
      alert('রক্তদাতার যোগাযোগের নম্বর পাওয়া যায়নি।');
      return;
    }
    const cleanDigits = rawPhone.replace(/[^0-9+]/g, '');
    window.location.href = `tel:${cleanDigits}`;
  };

  // Sign out handler
  const handleSignOutClick = () => {
    if (onSignOut) {
      onSignOut();
    } else if (logout) {
      logout();
    }
  };

  // Delete account handler
  const handleDeleteAccountClick = () => {
    if (onDeleteAccount) {
      onDeleteAccount();
    } else {
      setIsInternalDeleteOpen(true);
    }
  };

  return (
    <div 
      className="min-h-full py-4 sm:py-6 px-3 sm:px-4 flex flex-col items-center justify-center font-sans"
      id="blood-donor-profile-page"
    >
      {/* Optional Top Back Button */}
      {onBack && (
        <div className="w-full max-w-md mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold border border-stone-200 transition cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>ফিরে যান</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          STRIKING BLOOD DONOR PROFILE CARD WITH RED BORDER (লাল বর্ডারের বক্স)
          ========================================================================= */}
      <div 
        className="w-full max-w-md bg-white rounded-3xl border-2 border-red-500 shadow-xl overflow-hidden text-center relative transition-all"
        id="blood-donor-profile-card"
      >
        {/* Subtle Ambient Red Glow Accents */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-red-100 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-rose-100 rounded-full blur-2xl pointer-events-none" />

        <div className="p-6 sm:p-7 space-y-4 relative">
          {/* Prominent Heart / Blood Drop Logo Icon Above the Donor's Name */}
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 relative">
              <Heart className="w-9 h-9 sm:w-10 sm:h-10 fill-white text-white drop-shadow-xs" />
              <Droplet className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-red-100 text-red-600 absolute bottom-2.5 right-2.5 drop-shadow-sm" />
            </div>
          </div>

          {/* Donor's Name in LARGE, BOLD RED TEXT with Heart & Blood Drop Icons */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2 px-2">
              <Heart className="w-6 h-6 sm:w-7 sm:h-7 text-red-600 fill-red-600 shrink-0 animate-pulse" />
              <h1 
                className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight text-center break-words"
                id="donor-profile-fullname"
              >
                {donorName}
              </h1>
              <Droplet className="w-5 h-5 sm:w-6 sm:h-6 fill-red-600 text-red-600 shrink-0" />
            </div>
          </div>

          {/* Blood Group Badge Highlighted */}
          <div className="flex justify-center pt-0.5">
            <div 
              className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-lg sm:text-xl shadow-md shadow-red-500/25"
              id="donor-profile-blood-group"
            >
              <Droplet className="w-5 h-5 fill-white" />
              <span>{bloodGroup}</span>
            </div>
          </div>

          {/* Location: District & Upazila (জেলা ও উপজেলা) */}
          <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-700 pt-1">
            <MapPin className="w-4 h-4 text-red-600 shrink-0" />
            <span>জেলা ও উপজেলা: <strong className="text-stone-900 font-bold">{locationText}</strong></span>
          </div>

          {/* Member / Unique ID Code: "ঝাদিমাদি ডট কমের [Member Number] নম্বর সদস্য | আইডি: JHD-BD-000X" */}
          <div className="pt-1">
            <div 
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-xs sm:text-sm font-bold text-red-800"
              id="donor-profile-unique-id"
            >
              <span>
                ঝাদিমাদি ডট কমের <span className="font-extrabold text-red-900">{memberNumber}</span> নম্বর সদস্য | আইডি: <span className="font-mono font-extrabold text-red-900">{donorIdCode}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 text-red-500 hover:text-red-800 transition cursor-pointer"
                title="আইডি কপি করুন"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* =======================================================================
              WELCOME & APPRECIATION MESSAGE (Visible on the Donor's Own Profile)
              ======================================================================= */}
          {isOwner && (
            <div 
              className="mt-4 p-4 rounded-2xl bg-red-50/80 border border-red-200 text-left space-y-2 shadow-2xs animate-in fade-in duration-200"
              id="donor-welcome-appreciation-box"
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 fill-red-600 text-red-600 shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-red-950">
                  স্বাগত ও কৃতজ্ঞতা বার্তা
                </h3>
              </div>
              <p className="text-xs sm:text-[13px] text-stone-700 leading-relaxed font-medium">
                অভিনন্দন! আপনি রেজিস্ট্রেশন করার মাধ্যমে বুঝিয়ে দিয়েছেন যে আপনি একজন মহানুভব মানুষ। এজন্য আপনাকে ঝাদিমাদি ডট কম-এর পক্ষ থেকে আন্তরিক অভিনন্দন ও ধন্যবাদ জ্ঞাপন করা হচ্ছে। আপনি ঝাদিমাদি রক্তদান নেটওয়ার্কের <strong className="text-red-700 font-extrabold">{memberNumber}</strong> নম্বর সদস্য। আপনার আইডি নম্বর: <strong className="text-red-700 font-mono font-extrabold">{donorIdCode}</strong>।
              </p>
            </div>
          )}

          {/* =======================================================================
              DONOR ACTIONS & CONTROLS (WhatsApp & Direct Call ALWAYS rendered)
              ======================================================================= */}
          <div className="pt-2 space-y-3">
            {/* Contact Action Buttons (Phone number is strictly hidden, never rendered on screen) */}
            <div 
              className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center space-y-3"
              id="donor-contact-action-section"
            >
              <div className="flex items-center justify-center gap-2 text-stone-800 font-bold text-sm">
                <HeartHandshake className="w-5 h-5 text-red-600" />
                <span>যোগাযোগ করুন</span>
              </div>

              <div className="space-y-2">
                {/* WhatsApp Chat Button */}
                <button
                  type="button"
                  onClick={handleWhatsAppChat}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  id="btn-donor-whatsapp"
                >
                  <MessageSquare className="w-4 h-4 fill-white text-white" />
                  <span>হোয়াটসঅ্যাপে মেসেজ করুন</span>
                </button>

                {/* Direct Call Button (tel: protocol, phone number NOT displayed on screen) */}
                <button
                  type="button"
                  onClick={handleDirectCall}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-red-600/20 transition cursor-pointer"
                  id="btn-donor-direct-call"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>সরাসরি কল করুন</span>
                </button>
              </div>
            </div>

            {/* Logged-in Owner Controls (Sign Out & Delete Account) */}
            {isOwner && (
              <div className="space-y-2.5 pt-1" id="logged-in-donor-controls">
                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={handleSignOutClick}
                  className="w-full py-3 px-4 bg-stone-100 hover:bg-stone-200 active:scale-[0.99] text-stone-800 font-bold text-sm rounded-xl flex items-center justify-center gap-2 border border-stone-300 transition cursor-pointer"
                  id="btn-donor-signout"
                >
                  <LogOut className="w-4 h-4 text-stone-600" />
                  <span>সাইন আউট করুন</span>
                </button>

                {/* Delete Account Button */}
                <button
                  type="button"
                  onClick={handleDeleteAccountClick}
                  className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 active:scale-[0.99] text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-rose-200 transition cursor-pointer"
                  id="btn-donor-delete-account"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>অ্যাকাউন্ট ডিলিট করুন</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Internal Account Deletion Modal fallback if owner triggers account delete */}
      {isInternalDeleteOpen && (
        <AccountDeletionModal
          isOpen={isInternalDeleteOpen}
          onClose={() => setIsInternalDeleteOpen(false)}
          currentUser={currentUser || authCurrentUser}
          onDeleted={() => {
            setIsInternalDeleteOpen(false);
            if (onSignOut) onSignOut();
            else if (logout) logout();
          }}
        />
      )}
    </div>
  );
};

export default BloodDonorProfile;
