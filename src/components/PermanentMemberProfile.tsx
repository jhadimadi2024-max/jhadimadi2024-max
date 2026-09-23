import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  MoreVertical,
  Bell,
  MessageSquare,
  LogOut,
  Trash2,
  Check,
  Copy,
  Droplet,
  MapPin,
  Phone,
  Mail,
  User,
  Wallet,
  X,
  Award,
  BadgeCheck,
  Calendar,
  Share2,
  FileText,
  LayoutDashboard,
  CreditCard,
  Lock,
  Camera,
  QrCode,
  ExternalLink,
  PhoneCall,
  Download,
  Printer,
  ChevronRight
} from 'lucide-react';
import { Language } from '../types';
import { useAuth } from '../context/AuthContext';
import { databaseService } from '../services/databaseService';

/* =========================================================================
   TYPESCRIPT INTERFACES
   ========================================================================= */
export interface PermanentMemberData {
  id?: string;
  uniqueId?: string;
  memberUID?: string;
  name?: string;
  fullName?: string;
  designation?: string;
  memberType?: string;
  bloodGroup?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  photoUrl?: string;
  permanentMemberPhotoUrl?: string;
  permanentMemberCertUrl?: string;
  district?: string;
  upazila?: string;
  presentAddress?: string;
  permanentAddress?: string;
  nidNumber?: string;
  education?: string;
  affidavitStatus?: string;
  joiningDate?: string;
  createdAt?: string;
  bio?: string;
  walletBalance?: number;
  dividendBalance?: number;
  totalVotingShares?: number;
  status?: 'active' | 'pending' | 'suspended';
}

export interface PermanentMemberProfileProps {
  profileData?: any;
  currentUser?: any;
  lang?: Language;
  isOwner?: boolean;
  onEditProfile?: (data?: any) => void;
  onNavigateDashboard?: () => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => void;
  onBack?: () => void;
}

/* =========================================================================
   MAIN COMPONENT: PERMANENT MEMBER PROFILE
   Theme: Classic Black & White / Monochrome official membership card style
   Background: Soft off-white (#FBFBFA or #F4F4F0)
   ========================================================================= */
export const PermanentMemberProfile: React.FC<PermanentMemberProfileProps> = ({
  profileData,
  currentUser,
  lang = 'bn',
  isOwner: passedIsOwner,
  onEditProfile,
  onNavigateDashboard,
  onSignOut,
  onDeleteAccount,
  onBack
}) => {
  const { logout } = useAuth();

  // Determine if viewer is truly the profile owner
  const computedIsOwner = useMemo(() => {
    if (typeof passedIsOwner === 'boolean') return passedIsOwner;
    if (!currentUser || !profileData) return false;
    const profileId = profileData.memberUID || profileData.uniqueId || profileData.id;
    const currentUserId = currentUser.memberUID || currentUser.uniqueId || currentUser.id;
    if (profileId && currentUserId && profileId === currentUserId) return true;
    if (currentUser.phone && profileData.phone && currentUser.phone === profileData.phone) return true;
    return false;
  }, [passedIsOwner, currentUser, profileData]);

  // Dual-View toggle state (Owner View vs Customer View)
  const [activeViewMode, setActiveViewMode] = useState<'owner' | 'customer'>(
    computedIsOwner ? 'owner' : 'customer'
  );

  useEffect(() => {
    setActiveViewMode(computedIsOwner ? 'owner' : 'customer');
  }, [computedIsOwner]);

  const isOwnerView = activeViewMode === 'owner';

  // Resolved Member Profile Data
  const member: PermanentMemberData = useMemo(() => {
    const raw = {
      ...(currentUser || {}),
      ...(profileData || {})
    };

    return {
      id: raw.id || 'JH-M-001',
      uniqueId: raw.uniqueId || raw.memberUID || raw.id || 'ID - Kha - PM - 001',
      memberUID: raw.memberUID || raw.uniqueId || 'ID - JH-M-001',
      name: raw.fullName || raw.name || raw.nidName || 'আনন্দ বিকাশ চাকমা (Ananda Bikash Chakma)',
      fullName: raw.fullName || raw.name || 'আনন্দ বিকাশ চাকমা',
      designation: raw.designation || raw.memberType || raw.profession || 'স্থায়ী সদস্য (Permanent Member)',
      memberType: raw.memberType || 'আজীবন স্থায়ী সদস্য ও আঞ্চলিক প্রতিনিধি',
      bloodGroup: raw.bloodGroup || raw.blood_group || 'A+',
      phone: raw.phone || raw.contactNumber || '01870592699',
      email: raw.email || 'member.khagrachhari@jhadimadi.com',
      avatar:
        raw.permanentMemberPhotoUrl ||
        raw.avatar ||
        raw.photoUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      permanentMemberPhotoUrl:
        raw.permanentMemberPhotoUrl ||
        raw.avatar ||
        raw.photoUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      permanentMemberCertUrl:
        raw.permanentMemberCertUrl ||
        raw.certificateUrl ||
        'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
      district: raw.district || raw.repDistrict || 'খাগড়াছড়ি (Khagrachhari)',
      upazila: raw.upazila || raw.repUpazila || 'খাগড়াছড়ি সদর (Sadar)',
      presentAddress: raw.presentAddress || raw.detailedAddress || 'পানখাইয়াপাড়া, খাগড়াছড়ি পার্বত্য জেলা',
      permanentAddress: raw.permanentAddress || 'পানখাইয়াপাড়া, খাগড়াছড়ি পার্বত্য জেলা',
      nidNumber: raw.nidNumber || '19924618000000000',
      education: raw.education || raw.qualification || 'স্নাতকোত্তর (এম.এ / M.A)',
      affidavitStatus: raw.affidavitStatus || 'শপথনামা ও অঙ্গীকারপত্র সম্পাদিত (Affidavit Executed)',
      joiningDate: raw.joiningDate || raw.createdAt?.split('T')[0] || '০১ জানুয়ারি, ২০২৪',
      createdAt: raw.createdAt || '2024-01-01',
      bio:
        raw.bio ||
        'ঝাদিমাদি ডট কম প্ল্যাটফর্মের একজন সম্মানিত আজীবন নিবন্ধিত স্থায়ী সদস্য এবং স্থানীয় সামাজিক উন্নয়ন প্রতিনিধি। পার্বত্যাঞ্চলের ডিজিটাল সেবা ও পারস্পরিক সহযোগিতায় নিবেদিত।',
      walletBalance: raw.walletBalance || 12450,
      dividendBalance: raw.dividendBalance || 4800,
      totalVotingShares: raw.totalVotingShares || 150,
      status: raw.status || 'active'
    };
  }, [profileData, currentUser]);

  // Modal view management
  const [activeModal, setActiveModal] = useState<
    'none' | 'menu' | 'dashboard' | 'wallet' | 'membership' | 'notifications' | 'messages' | 'delete_confirm' | 'certificate'
  >('none');

  // Copy status feedback
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const handleCopyId = () => {
    navigator.clipboard?.writeText(member.uniqueId || member.memberUID || '');
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Resignation / Account Deletion Form State
  const [deleteIdInput, setDeleteIdInput] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE' && deleteConfirmText.trim() !== 'মুছে ফেলুন') {
      setDeleteError('নিশ্চিতকরণ বক্সে "DELETE" অথবা "মুছে ফেলুন" টাইপ করুন।');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      if (onDeleteAccount) {
        onDeleteAccount();
      } else {
        await logout();
        if (onBack) onBack();
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'সদস্যপদ প্রত্যাহার সম্পন্ন করা যায়নি। পুনরায় চেষ্টা করুন।');
      setIsDeleting(false);
    }
  };

  // Direct Phone Call Dialer
  const handleDirectPhoneCall = () => {
    const rawNumber = String(member.phone || '01870592699');
    const cleanNumber = rawNumber.replace(/[^\d+]/g, '');
    window.location.href = `tel:${cleanNumber}`;
  };

  // WhatsApp Messaging Redirect
  const handleWhatsAppMessage = () => {
    const rawNumber = String(member.phone || '01870592699');
    let digits = rawNumber.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '88' + digits;
    } else if (!digits.startsWith('88') && digits.length === 10) {
      digits = '880' + digits;
    }
    const message = `নমস্কার / আসসালামু আলাইকুম। ঝাদিমাদি প্ল্যাটফর্মে আপনার স্থায়ী সদস্য প্রোফাইল (${member.uniqueId}) দেখে যোগাযোগ করছি।`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="min-h-screen bg-[#FBFBFA] text-black font-sans pb-16 selection:bg-black selection:text-white"
      id="permanent-member-profile-container"
    >
      {/* =========================================================================
          TOAST FEEDBACK
          ========================================================================= */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-5 py-3 rounded-md shadow-2xl border border-neutral-700 text-xs font-mono font-bold animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          VIEW SWITCHER TOGGLE PILL (For interactive testing between Owner and Customer views)
          ========================================================================= */}
      <div className="bg-black text-white px-4 py-2 border-b border-neutral-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="font-mono text-[11px] text-neutral-300">
            মোড: <strong className="text-white">{isOwnerView ? 'মালিক ভিউ (VIEW A: Owner View)' : 'গ্রাহক ভিউ (VIEW B: Customer View)'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1 border border-neutral-700 rounded-md p-0.5 bg-neutral-900">
          <button
            type="button"
            onClick={() => setActiveViewMode('owner')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
              isOwnerView ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
            }`}
            id="toggle-owner-view-btn"
          >
            মালিক ভিউ (Owner)
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode('customer')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
              !isOwnerView ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
            }`}
            id="toggle-customer-view-btn"
          >
            গ্রাহক ভিউ (Customer)
          </button>
        </div>
      </div>

      {/* =========================================================================
          1. HEADER SECTION
          - Top Header: "Jhadimadi.com"
          - Sub-Header: "Permanent Member Profile"
          - VIEW A: Notification icon, Messaging icon, 3-Line Menu box
          - VIEW B: Top-right icons and 3-line menu completely hidden
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#FBFBFA] border-b border-neutral-300 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Left: Back Button & Header Labels */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-8 h-8 rounded border border-neutral-300 hover:bg-neutral-200 flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="ফিরে যান"
                id="permanent-member-back-btn"
              >
                <ArrowLeft className="w-4 h-4 text-black" />
              </button>
            )}

            <div>
              <h1 className="text-sm font-black tracking-wider uppercase text-black font-mono leading-tight">
                Jhadimadi.com
              </h1>
              <h2 className="text-xs font-semibold text-neutral-600 font-mono">
                Permanent Member Profile
              </h2>
            </div>
          </div>

          {/* Right Controls: CONDITIONAL RENDERING (VIEW A vs VIEW B) */}
          {isOwnerView ? (
            /* VIEW A (Owner View): Notification, Messaging & 3-Line Menu */
            <div className="flex items-center gap-2" id="permanent-member-owner-controls">
              
              {/* Notification Icon */}
              <button
                type="button"
                onClick={() => setActiveModal('notifications')}
                className="relative w-8 h-8 rounded border border-neutral-300 bg-white hover:bg-neutral-100 flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="বিজ্ঞপ্তি (Notifications)"
                id="btn-owner-notifications"
              >
                <Bell className="w-4 h-4 text-black" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
                  3
                </span>
              </button>

              {/* Messaging Icon */}
              <button
                type="button"
                onClick={() => setActiveModal('messages')}
                className="relative w-8 h-8 rounded border border-neutral-300 bg-white hover:bg-neutral-100 flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="মেসেজ (Messages)"
                id="btn-owner-messages"
              >
                <MessageSquare className="w-4 h-4 text-black" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
                  1
                </span>
              </button>

              {/* 3-Line (Hamburger) Menu Box */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveModal(prev => prev === 'menu' ? 'none' : 'menu')}
                  className="w-8 h-8 rounded border-2 border-black bg-black text-white hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 cursor-pointer"
                  title="মেনু (Menu)"
                  id="btn-owner-hamburger-menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Dropdown Menu Options: Dashboard, Wallet, Membership Management, etc. */}
                {activeModal === 'menu' && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border-2 border-black rounded-md shadow-2xl py-2 z-50 animate-fade-in font-mono text-xs">
                    
                    {/* Dashboard */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('dashboard');
                      }}
                      className="w-full px-4 py-2.5 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 font-bold cursor-pointer border-b border-neutral-100"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>ড্যাশবোর্ড (Dashboard)</span>
                    </button>

                    {/* Wallet */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('wallet');
                      }}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>ওয়ালেট ও লভ্যাংশ (Wallet)</span>
                    </button>

                    {/* Membership Management */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('membership');
                      }}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>সদস্যপদ ব্যবস্থাপনা (Management)</span>
                    </button>

                    {/* Edit Profile */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('none');
                        if (onEditProfile) onEditProfile(member);
                      }}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <User className="w-4 h-4" />
                      <span>প্রোফাইল সম্পাদন (Edit Profile)</span>
                    </button>

                    {/* Notifications */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('notifications');
                      }}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Bell className="w-4 h-4" />
                      <span>বিজ্ঞপ্তি (Notifications)</span>
                    </button>

                    {/* Messages */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('messages');
                      }}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>মেসেজ (Messages)</span>
                    </button>

                    <div className="border-t border-neutral-200 my-1" />

                    {/* Sign Out */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('none');
                        if (onSignOut) onSignOut();
                      }}
                      className="w-full px-4 py-2 text-left text-neutral-800 hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>লগ আউট (Sign Out)</span>
                    </button>

                    {/* Delete / Resign Profile */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('delete_confirm');
                      }}
                      className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>সদস্যপদ প্রত্যাহার (Resign)</span>
                    </button>

                  </div>
                )}
              </div>

            </div>
          ) : (
            /* VIEW B (Customer View): Top-right notification, messaging, and 3-line menu box are completely hidden */
            <div className="flex items-center gap-2" id="permanent-member-customer-status">
              <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded border border-black bg-black text-white font-bold flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Member</span>
              </span>
            </div>
          )}

        </div>
      </header>

      {/* =========================================================================
          2. OFFICIAL MEMBERSHIP CARD SECTION (MONOCHROME CARD STYLE)
          - Left Side: Passport-size Member Photo
          - Right/Below Photo: Full Name, Designation/Member Type, Blood Group, Permanent Member ID Number
          ========================================================================= */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        
        {/* The Official Membership Card Frame */}
        <section
          className="bg-white border-2 border-black rounded-lg p-5 sm:p-6 shadow-md relative overflow-hidden space-y-5"
          id="official-membership-card"
        >
          {/* Subtle Security Guilloche Background Watermark Pattern */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full border-[12px] border-neutral-100 pointer-events-none opacity-50" />
          <div className="absolute top-1/2 -left-12 -translate-y-1/2 w-40 h-40 rounded-full border-[10px] border-neutral-100 pointer-events-none opacity-40" />

          {/* Card Top Official Heading */}
          <div className="flex items-center justify-between border-b-2 border-black pb-3 relative z-10">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase font-black tracking-widest text-neutral-500 block">
                JHADIMADI COMMUNITY NETWORK • OFFICIAL IDENTITY
              </span>
              <h3 className="text-base sm:text-lg font-black font-mono tracking-tight text-black uppercase">
                স্থায়ী সদস্য পরিচয়পত্র (Permanent Member Card)
              </h3>
            </div>

            <div className="text-right font-mono text-[10px] text-neutral-600 shrink-0">
              <span className="px-2 py-0.5 rounded border border-black bg-black text-white font-bold uppercase tracking-wider block">
                আজীবন সদস্যপদ
              </span>
              <span className="text-[9px] text-neutral-500 block mt-0.5">
                STATUS: ACTIVE
              </span>
            </div>
          </div>

          {/* Profile Card Main Body: Left Photo + Right Details */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
            
            {/* LEFT SIDE: Passport-size Member Photo */}
            <div className="shrink-0 flex flex-col items-center space-y-2">
              <div className="w-32 h-40 sm:w-36 sm:h-44 border-2 border-black rounded bg-neutral-100 p-1 relative shadow-sm">
                <img
                  src={member.permanentMemberPhotoUrl || member.avatar}
                  alt={member.name}
                  className="w-full h-full object-cover rounded-xs grayscale hover:grayscale-0 transition duration-300"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
                  }}
                />
                
                {/* Official Certified Stamp on Photo */}
                <div className="absolute bottom-2 right-2 bg-black text-white p-1 rounded-full shadow border border-white">
                  <BadgeCheck className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Photo Label */}
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                PASSPORT PHOTO
              </span>
            </div>

            {/* RIGHT SIDE: Member Full Name, Designation/Member Type, Blood Group, Permanent Member ID Number */}
            <div className="flex-1 w-full space-y-3.5 text-center sm:text-left">
              
              {/* Member Full Name */}
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block font-bold">
                  সদস্যের পূর্ণ নাম (Full Name)
                </span>
                <h4 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                  {member.name}
                </h4>
              </div>

              {/* Designation / Member Type */}
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block font-bold">
                  পদবি ও সদস্যপদ ধরন (Designation / Member Type)
                </span>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-black bg-[#F4F4F0] font-mono font-bold text-xs text-black">
                  <Award className="w-3.5 h-3.5 text-black" />
                  <span>{member.designation}</span>
                </div>
              </div>

              {/* Blood Group and Permanent Member ID Number Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                
                {/* Permanent Member ID Number */}
                <div className="p-2.5 border border-black rounded bg-[#FBFBFA] flex items-center justify-between">
                  <div className="space-y-0.5 text-left">
                    <span className="text-[9px] font-mono uppercase font-bold tracking-wider text-neutral-500 block">
                      সদস্য আইডি (Member ID)
                    </span>
                    <span className="font-mono font-black text-sm text-black block tracking-wide">
                      {member.uniqueId || member.memberUID}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="p-1.5 rounded border border-neutral-300 hover:border-black hover:bg-neutral-100 transition cursor-pointer text-black"
                    title="আইডি কপি করুন"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Blood Group */}
                <div className="p-2.5 border border-neutral-300 rounded bg-[#FBFBFA] flex items-center gap-2.5 text-left">
                  <div className="w-8 h-8 rounded border border-red-600 bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <Droplet className="w-4 h-4 fill-red-600" />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase font-bold tracking-wider text-neutral-500 block">
                      রক্তের গ্রুপ (Blood Group)
                    </span>
                    <span className="font-mono font-black text-sm text-black">
                      Blood - {member.bloodGroup}
                    </span>
                  </div>
                </div>

              </div>

              {/* Area & Joining Date Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 font-mono text-[11px] text-neutral-700">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-black" />
                  <span>{member.upazila}, {member.district}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-black" />
                  <span>যোগদান: {member.joiningDate}</span>
                </div>
              </div>

            </div>

          </div>

          {/* Card Bottom Signature & Barcode Security Strip */}
          <div className="border-t border-neutral-200 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono text-neutral-600 relative z-10">
            <div className="flex items-center gap-3">
              {/* Digital Barcode representation */}
              <div className="h-6 flex items-center gap-0.5">
                {[4, 2, 6, 1, 8, 3, 7, 2, 5, 3, 9, 2, 4, 8, 1, 6, 3, 5, 2, 4].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-black inline-block"
                    style={{ height: `${h * 2.2}px` }}
                  />
                ))}
              </div>
              <span className="text-[9px] text-neutral-500">DIGITAL CERTIFIED HASH</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">অনুমোদিত স্বাক্ষর:</span>
              <span className="font-serif italic font-bold text-black border-b border-black px-2">
                Jhadimadi Authority
              </span>
            </div>
          </div>

        </section>

        {/* =========================================================================
            3. OFFICIAL MEMBERSHIP PARTICULARS & DECLARATIONS
            ========================================================================= */}
        <section className="bg-white border border-neutral-300 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-2">
              <FileText className="w-4 h-4 text-black" />
              <span>সদস্যপদ বিবরণ ও তথ্যাবলি (Member Particulars)</span>
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-neutral-300 bg-[#F4F4F0]">
              CONFIDENTIAL & VERIFIED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            
            <div className="p-3 border border-neutral-200 rounded bg-[#FBFBFA] space-y-1">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">জাতীয় পরিচয়পত্র / NID</span>
              <span className="font-mono font-bold text-black block">
                {isOwnerView ? member.nidNumber : '1992••••••••••••0'}
              </span>
            </div>

            <div className="p-3 border border-neutral-200 rounded bg-[#FBFBFA] space-y-1">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">শিক্ষাগত যোগ্যতা</span>
              <span className="font-sans font-bold text-black block">
                {member.education}
              </span>
            </div>

            <div className="p-3 border border-neutral-200 rounded bg-[#FBFBFA] space-y-1">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">শপথনামা ও অঙ্গীকারপত্র</span>
              <span className="font-sans font-bold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{member.affidavitStatus}</span>
              </span>
            </div>

            <div className="p-3 border border-neutral-200 rounded bg-[#FBFBFA] space-y-1">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">আঞ্চলিক দায়িত্ব ও এক্তিয়ার</span>
              <span className="font-sans font-bold text-black block">
                {member.upazila}, {member.district}
              </span>
            </div>

          </div>

          {/* Member Bio */}
          {member.bio && (
            <div className="p-3 border border-neutral-200 rounded bg-[#FBFBFA] space-y-1 text-xs">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">সদস্যের সংক্ষিপ্ত পরিচিতি</span>
              <p className="text-neutral-800 leading-relaxed font-sans">
                {member.bio}
              </p>
            </div>
          )}

          {/* Quick Certificate View Trigger */}
          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveModal('certificate')}
              className="px-3.5 py-2 border border-black rounded text-xs font-mono font-bold text-black hover:bg-black hover:text-white transition flex items-center gap-2 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span>ডিজিটাল মেম্বারশিপ সার্টিফিকেট দেখুন</span>
            </button>

            <span className="text-[10px] font-mono text-neutral-500">
              সার্টিফিকেট নং: JM-CERT-{member.memberUID?.replace(/\D/g, '') || '001'}
            </span>
          </div>

        </section>

        {/* =========================================================================
            4. CUSTOMER VIEW / PUBLIC CONTACT SECTION (VIEW B ONLY)
            - Clean public verification view
            - Direct contact with regional representative
            ========================================================================= */}
        {!isOwnerView && (
          <section className="bg-white border border-neutral-300 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-black" />
                <span>প্রতিনিধির সাথে যোগাযোগ (Contact Representative)</span>
              </h4>
              <span className="text-[10px] font-mono text-neutral-500">জরুরি সহায়তা</span>
            </div>

            <p className="text-xs text-neutral-600">
              পার্বত্যাঞ্চলের তৃণমূল যেকোনো সমস্যা, প্রাতিষ্ঠানিক সহায়তা বা ঝাদিমাদি প্ল্যাটফর্ম সংক্রান্ত সমন্বয়ের জন্য অনুমোদিত প্রতিনিধির সাথে সরাসরি যোগাযোগ করুন।
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleWhatsAppMessage}
                className="py-3 px-4 rounded border border-black bg-white hover:bg-neutral-100 font-mono font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer text-black"
              >
                <MessageSquare className="w-4 h-4" />
                <span>হোয়াটসঅ্যাপ মেসেজ করুন</span>
              </button>

              <button
                type="button"
                onClick={handleDirectPhoneCall}
                className="py-3 px-4 rounded border-2 border-black bg-black text-white hover:bg-neutral-800 font-mono font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>সরাসরি কল করুন (Dial Call)</span>
              </button>
            </div>
          </section>
        )}

      </main>

      {/* =========================================================================
          MODALS & OVERLAYS (Owner View: Dashboard, Wallet, Management, Notices, Messages)
          ========================================================================= */}

      {/* A. DASHBOARD MODAL (VIEW A: Owner View) */}
      {activeModal === 'dashboard' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">
                  Permanent Member Dashboard
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-0.5">
                <span className="text-[10px] text-neutral-500 uppercase block">সদস্যপদ স্থিতি</span>
                <span className="font-bold text-black text-sm">সক্রিয় (Active)</span>
              </div>
              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-0.5">
                <span className="text-[10px] text-neutral-500 uppercase block">ভোটাধিকার শেয়ার</span>
                <span className="font-bold text-black text-sm">{member.totalVotingShares} ইউনিট</span>
              </div>
              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-0.5">
                <span className="text-[10px] text-neutral-500 uppercase block">কার্যকাল</span>
                <span className="font-bold text-black text-sm">আজীবন</span>
              </div>
            </div>

            {/* Performance & Duties */}
            <div className="p-3.5 border border-black rounded bg-[#FBFBFA] space-y-2 text-xs">
              <h5 className="font-bold font-mono text-black uppercase">আঞ্চলিক প্রতিনিধি কার্যক্রম</h5>
              <div className="space-y-1.5 text-neutral-700">
                <div className="flex justify-between">
                  <span>সম্পন্ন সেবা সমন্বয়:</span>
                  <strong className="font-mono text-black">৪৮ টি</strong>
                </div>
                <div className="flex justify-between">
                  <span>কমিউনিটি সন্তুষ্টি রেটিং:</span>
                  <strong className="font-mono text-black">৫.০ / ৫.০ ★</strong>
                </div>
                <div className="flex justify-between">
                  <span>সর্বশেষ এজিএম উপস্থিতি:</span>
                  <strong className="font-mono text-black">উপস্থিত (Verified)</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="w-full py-2.5 bg-black text-white text-xs font-mono font-bold rounded hover:bg-neutral-800 transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* B. WALLET & DIVIDENDS MODAL (VIEW A: Owner View) */}
      {activeModal === 'wallet' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">
                  সদস্য ওয়ালেট ও লভ্যাংশ (Wallet)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Wallet Balance Card */}
            <div className="p-4 border-2 border-black rounded-md bg-[#FBFBFA] text-center space-y-1">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">
                মোট উত্তোলণযোগ্য ব্যালেন্স
              </span>
              <span className="text-2xl font-black font-mono text-black">
                ৳ {member.walletBalance?.toLocaleString()}
              </span>
              <span className="text-[10px] text-neutral-600 font-mono block">
                (যার মধ্যে বাৎসরিক লভ্যাংশ: ৳ {member.dividendBalance?.toLocaleString()})
              </span>
            </div>

            {/* Member Privileges */}
            <div className="space-y-1.5 text-xs font-mono">
              <span className="font-bold text-black uppercase text-[10px] block">সদস্যপদ সুবিধাসমূহ:</span>
              <div className="p-2.5 border border-neutral-300 rounded space-y-1 text-neutral-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black" />
                  <span>প্ল্যাটফর্মের সকল পণ্য ও সেবায় ১৫% স্থায়ী ছাড়</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black" />
                  <span>বার্ষিক সার্বিক মুনাফার লভ্যাংশ শেয়ার</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black" />
                  <span>জরুরি স্বাস্থ্য ও জরুরি সেবায় অগ্রাধিকার নেটওয়ার্ক</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                showToast('টাকা উত্তোলনের অনুরোধ গৃহীত হয়েছে। ২৪ ঘণ্টার মধ্যে প্রক্রিয়া সম্পন্ন হবে।');
                setActiveModal('none');
              }}
              className="w-full py-2.5 bg-black text-white text-xs font-mono font-bold rounded hover:bg-neutral-800 transition cursor-pointer"
            >
              লভ্যাংশ উত্তোলন (Withdraw) করুন
            </button>
          </div>
        </div>
      )}

      {/* C. MEMBERSHIP MANAGEMENT MODAL (VIEW A: Owner View) */}
      {activeModal === 'membership' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">
                  সদস্যপদ ব্যবস্থাপনা (Management)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="w-full p-3 border border-black rounded flex items-center justify-between hover:bg-neutral-100 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 font-mono font-bold text-black">
                  <Printer className="w-4 h-4" />
                  <span>সদস্য পরিচয়পত্র প্রিন্ট / ডাউনলোড করুন</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveModal('certificate');
                }}
                className="w-full p-3 border border-black rounded flex items-center justify-between hover:bg-neutral-100 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 font-mono font-bold text-black">
                  <Award className="w-4 h-4" />
                  <span>ডিজিটাল মেম্বারশিপ সার্টিফিকেট দেখুন</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveModal('none');
                  if (onEditProfile) onEditProfile(member);
                }}
                className="w-full p-3 border border-neutral-300 rounded flex items-center justify-between hover:bg-neutral-100 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 font-mono font-bold text-black">
                  <User className="w-4 h-4" />
                  <span>ব্যক্তিগত ও ঠিকানা তথ্য হালনাগাদ</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="w-full py-2 bg-neutral-200 text-black text-xs font-mono font-bold rounded hover:bg-neutral-300 transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* D. NOTIFICATIONS MODAL (VIEW A: Owner View) */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">
                  সদস্য বিজ্ঞপ্তি (Notifications)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center font-mono text-[10px] text-neutral-500">
                  <span>সাধারণ সভা নোটিশ</span>
                  <span>আজ</span>
                </div>
                <p className="font-bold text-black">আগামী শুক্রবার বিকেল ৪টায় ত্রৈমাসিক প্রতিনিধি সমন্বয় সভা অনুষ্ঠিত হবে।</p>
              </div>

              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center font-mono text-[10px] text-neutral-500">
                  <span>লভ্যাংশ জমা</span>
                  <span>গত পরশু</span>
                </div>
                <p className="font-bold text-black">বাৎসরিক পার্টনারশিপ লভ্যাংশ ৳ ৪,৮০০ ওয়ালেটে সফলভাবে যুক্ত হয়েছে।</p>
              </div>

              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center font-mono text-[10px] text-neutral-500">
                  <span>সার্টিফিকেট ভেরিফিকেশন</span>
                  <span>৭ দিন আগে</span>
                </div>
                <p className="font-bold text-black">আপনার স্থায়ী সদস্যপদ ও শপথনামা সফলভাবে কেন্দ্রীয় ডাটাবেজে নথিবদ্ধ হয়েছে।</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="w-full py-2 bg-black text-white text-xs font-mono font-bold rounded hover:bg-neutral-800 transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* E. MESSAGES MODAL (VIEW A: Owner View) */}
      {activeModal === 'messages' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">
                  ইনবক্স মেসেজ (Inbox)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center font-mono text-[10px] text-neutral-500">
                  <span className="font-bold text-black">ঝাদিমadi সেন্ট্রাল এডমিন</span>
                  <span>১ ঘণ্টা আগে</span>
                </div>
                <p className="text-neutral-700">খাগড়াছড়ি সদর এলাকার নতুন মার্চেন্ট অনবোর্ডিং সমন্বয় সংক্রান্ত আপডেট দিন।</p>
              </div>

              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center font-mono text-[10px] text-neutral-500">
                  <span className="font-bold text-black">সুনীল ত্রিপুরা</span>
                  <span>গতকাল</span>
                </div>
                <p className="text-neutral-700">দাদা, নতুন সার্ভিস পার্টনার হিসেবে যুক্ত হতে চাই। পরামর্শ প্রয়োজন।</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="w-full py-2 bg-black text-white text-xs font-mono font-bold rounded hover:bg-neutral-800 transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* F. RESIGNATION / DELETE PROFILE MODAL (VIEW A: Owner View) */}
      {activeModal === 'delete_confirm' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-600 rounded-lg w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full border-2 border-red-600 bg-red-50 text-red-600 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-black text-base text-black">সদস্যপদ প্রত্যাহার করবেন?</h4>
              <p className="text-xs text-neutral-600">
                এই প্রক্রিয়াটি অপরিবর্তনীয়। স্থায়ী সদস্যপদ প্রত্যাহার করলে আপনার সদস্য আইডি, ভোটাধিকার এবং সমস্ত বিশেষ সুবিধা বাতিল হয়ে যাবে।
              </p>
            </div>

            {deleteError && (
              <div className="p-2 border border-red-600 bg-red-50 text-red-700 text-xs font-mono rounded text-center">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleConfirmDelete} className="space-y-3 text-xs">
              <div>
                <label className="block font-mono text-[10px] uppercase text-neutral-600 mb-1">
                  নিশ্চিত করতে <strong>DELETE</strong> লিখুন:
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full p-2 border border-neutral-300 rounded font-mono text-center font-bold text-black uppercase focus:outline-hidden focus:border-red-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal('none');
                    setDeleteConfirmText('');
                    setDeleteError(null);
                  }}
                  className="py-2 border border-neutral-300 rounded text-xs font-bold text-black hover:bg-neutral-100 transition cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="py-2 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? 'প্রক্রিয়াধীন...' : 'হ্যাঁ, প্রত্যাহার করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* G. DIGITAL CERTIFICATE MODAL */}
      {activeModal === 'certificate' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-lg p-5 space-y-4 shadow-2xl my-6">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">
                  Official Permanent Membership Certificate
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Certificate Canvas / Frame */}
            <div className="p-6 border-4 border-double border-black rounded bg-[#FBFBFA] space-y-4 text-center">
              <div className="space-y-1">
                <h5 className="font-black font-mono text-sm tracking-widest uppercase text-black">
                  JHADIMADI COMMUNITY NETWORK
                </h5>
                <h3 className="font-serif italic font-bold text-lg text-black">
                  সনদপত্র (Certificate of Permanent Membership)
                </h3>
              </div>

              <div className="w-16 h-16 rounded-full border-2 border-black mx-auto overflow-hidden">
                <img
                  src={member.permanentMemberPhotoUrl || member.avatar}
                  alt={member.name}
                  className="w-full h-full object-cover grayscale"
                />
              </div>

              <div className="space-y-1 text-xs">
                <p className="text-neutral-600">প্রত্যয়ন করা যাচ্ছে যে,</p>
                <p className="font-black text-base text-black font-sans">{member.name}</p>
                <p className="text-neutral-700">
                  আইডি: <strong className="font-mono">{member.uniqueId}</strong>
                </p>
                <p className="text-neutral-600 max-w-sm mx-auto text-[11px] leading-relaxed pt-1">
                  ঝাদিমাদি প্ল্যাটফর্মের বিধি অনুযায়ী আজীবন মেয়াদে একজন সম্মানিত <strong>{member.designation}</strong> হিসেবে আনুষ্ঠানিকভাবে অন্তর্ভুক্ত হয়েছেন।
                </p>
              </div>

              <div className="border-t border-neutral-300 pt-3 flex items-center justify-between text-[10px] font-mono text-neutral-600">
                <span>ইস্যু তারিখ: {member.joiningDate}</span>
                <span className="font-serif italic font-bold text-black border-b border-black">
                  Authority Seal & Signature
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 border border-black rounded text-xs font-mono font-bold hover:bg-neutral-100 transition flex items-center gap-1.5 cursor-pointer text-black"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>প্রিন্ট করুন</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 bg-black text-white rounded text-xs font-mono font-bold hover:bg-neutral-800 transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PermanentMemberProfile;
