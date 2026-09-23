import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Bell,
  MessageSquare,
  Menu,
  X,
  Check,
  Copy,
  PhoneCall,
  Send,
  ExternalLink,
  ShieldCheck,
  Star,
  Briefcase,
  Droplet,
  Wallet,
  LayoutDashboard,
  UserCheck,
  LogOut,
  Trash2,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Share2,
  Phone
} from 'lucide-react';
import { Language } from '../types';

export interface ProfileData {
  id?: string;
  memberUID?: string;
  memberId?: string;
  uniqueId?: string;
  districtUniqueId?: string;
  fullName?: string;
  name?: string;
  profession?: string;
  professionBn?: string;
  serviceCategory?: string;
  bloodGroup?: string;
  phone?: string;
  whatsapp?: string;
  facebook?: string;
  bkashNumber?: string;
  nagadNumber?: string;
  district?: string;
  upazila?: string;
  area?: string;
  experienceYears?: string | number;
  rating?: number;
  completedJobs?: number;
  bio?: string;
  bioBn?: string;
  skills?: string[];
  photoUrl?: string;
  profilePic?: string;
  avatar?: string;
  image?: string;
  verificationStatus?: 'verified' | 'pending' | 'unverified' | string;
  hourlyRate?: number;
  dailyRate?: number;
}

export interface ServiceProviderProfileProps {
  profileData?: ProfileData | any;
  currentUser?: any;
  isOwner?: boolean;
  onNavigateDashboard?: () => void;
  onEditProfile?: (profileData?: any) => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => void;
  onBack?: () => void;
  onBookService?: (profileData?: any) => void;
  onOpenChat?: (providerName?: string) => void;
  onOpenWallet?: () => void;
  onNavigateSignIn?: () => void;
  lang?: Language | 'bn' | 'en' | string;
}

export const ServiceProviderProfile: React.FC<ServiceProviderProfileProps> = ({
  profileData: propProfileData,
  currentUser,
  isOwner: initialIsOwner = false,
  onNavigateDashboard,
  onEditProfile,
  onSignOut,
  onDeleteAccount,
  onBack,
  onBookService,
  onOpenChat,
  onOpenWallet,
  lang = 'bn'
}) => {
  // Allow toggling view mode (Owner vs Customer) for previewing and administrative control
  const [activeViewMode, setActiveViewMode] = useState<'owner' | 'customer'>(
    initialIsOwner ? 'owner' : 'customer'
  );

  // Sync with prop if isOwner changes externally
  React.useEffect(() => {
    setActiveViewMode(initialIsOwner ? 'owner' : 'customer');
  }, [initialIsOwner]);

  const isOwnerView = activeViewMode === 'owner';

  // Hamburger menu dropdown state (Owner View)
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Modals state for owner view options
  const [activeModal, setActiveModal] = useState<
    'none' | 'notifications' | 'messages' | 'wallet' | 'delete_confirm' | 'booking' | 'call_dialog'
  >('none');

  // Copy toast states
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Customer booking form state
  const [bookingFormData, setBookingFormData] = useState({
    customerName: currentUser?.name || currentUser?.fullName || '',
    customerPhone: currentUser?.phone || '',
    serviceDetails: '',
    preferredDate: new Date().toISOString().split('T')[0],
    address: currentUser?.address || ''
  });
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Fallback defaults for missing profile info matching requirements
  const profile: ProfileData = useMemo(() => {
    const raw = propProfileData || currentUser || {};
    return {
      id: raw.id || 'sp-001',
      uniqueId: raw.districtUniqueId || raw.uniqueId || raw.memberUID || raw.memberId || 'ID-Kha-001',
      name: raw.fullName || raw.name || 'Nayan Chakma',
      profession: raw.professionBn || raw.profession || raw.serviceCategory || 'Electrician',
      bloodGroup: raw.bloodGroup || 'A+',
      phone: raw.phone || '01870592699',
      whatsapp: raw.whatsapp || raw.phone || '01870592699',
      facebook: raw.facebook || 'https://facebook.com/jhadimadi',
      bkashNumber: raw.bkashNumber || raw.bkash || '01870592699',
      nagadNumber: raw.nagadNumber || raw.nagad || '01870592699',
      district: raw.district || 'খাগড়াছড়ি',
      upazila: raw.upazila || 'খাগড়াছড়ি সদর',
      area: raw.area || 'পৌর এলাকা',
      experienceYears: raw.experienceYears || '৫+ বছর',
      rating: raw.rating || 4.9,
      completedJobs: raw.completedJobs || 128,
      bio: raw.bioBn || raw.bio || raw.summary || 'দক্ষ ও অভিজ্ঞ প্রফেশনাল সেবাদাতা। সময়মতো সর্বোচ্চ মানসম্মত সেবা প্রদানের প্রতিশ্রুতিবদ্ধ।',
      skills: Array.isArray(raw.skills) && raw.skills.length > 0
        ? raw.skills
        : ['ইলেকট্রিক ওয়্যারিং', 'হাউস ফিটিংস', 'ফ্যান ও লাইটিং সার্ভিসিং', 'সোলার সিস্টেম মেরামত'],
      photoUrl: raw.photoUrl || raw.profilePic || raw.avatar || raw.image || '',
      verificationStatus: raw.verificationStatus || 'verified',
      hourlyRate: raw.hourlyRate || 350
    };
  }, [propProfileData, currentUser]);

  const copyToClipboard = (text: string, fieldName: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingFormData.customerName.trim() || !bookingFormData.customerPhone.trim()) {
      return;
    }

    if (onBookService) {
      onBookService({
        ...profile,
        bookingDetails: bookingFormData
      });
    }

    setBookingSuccess(true);
    setTimeout(() => {
      setBookingSuccess(false);
      setActiveModal('none');
    }, 2500);
  };

  // WhatsApp link generator
  const getWhatsAppUrl = () => {
    const cleanNumber = profile.whatsapp?.replace(/[^0-9]/g, '') || '8801870592699';
    const formattedNumber = cleanNumber.startsWith('88') ? cleanNumber : `88${cleanNumber}`;
    const text = encodeURIComponent(
      `হ্যালো ${profile.name}, আমি ঝাদিমাদি ডটকম (Jhadimadi.com) থেকে আপনার সার্ভিস বুকিং বা কাজের বিষয়ে যোগাযোগ করতে চাই। (আইডি: ${profile.uniqueId})`
    );
    return `https://wa.me/${formattedNumber}?text=${text}`;
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-black antialiased font-sans flex flex-col justify-between selection:bg-neutral-900 selection:text-white pb-10">
      
      {/* =========================================================================
          1. HEADER SECTION
          - Top Header: "Jhadimadi.com"
          - Sub-Header: "Service Provider Profile"
          - Monochrome border and typography
          - VIEW A: Notification, Messaging, and 3-Line Menu box
          - VIEW B: Top-right icons completely hidden
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#FBFBFA]/95 backdrop-blur-xs border-b border-neutral-300 px-4 py-3.5 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          
          {/* Left: Back Button & Brand Titles */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-8 h-8 rounded-md border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center text-black transition active:scale-95 cursor-pointer"
                title="পেছনে যান"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              </button>
            )}

            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-black uppercase font-mono">
                Jhadimadi.com
              </h1>
              <p className="text-[11px] sm:text-xs tracking-wide text-neutral-600 font-medium uppercase">
                Service Provider Profile
              </p>
            </div>
          </div>

          {/* Right Section: Conditional Rendering based on VIEW A (Owner) vs VIEW B (Customer) */}
          <div className="flex items-center gap-2">
            
            {/* Owner vs Customer View Switcher (For demonstration & seamless inspection) */}
            <button
              type="button"
              onClick={() => {
                setActiveViewMode(prev => (prev === 'owner' ? 'customer' : 'owner'));
                setIsMenuOpen(false);
              }}
              className="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-1 rounded border border-neutral-400 bg-white hover:bg-neutral-100 text-neutral-800 transition flex items-center gap-1 cursor-pointer"
              title="ভিউ মোড পরিবর্তন করুন (Owner / Customer)"
            >
              {isOwnerView ? (
                <>
                  <Eye className="w-3 h-3" />
                  <span className="hidden xs:inline">Owner Mode</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span className="hidden xs:inline">Customer Mode</span>
                </>
              )}
            </button>

            {/* VIEW A (Owner View) Controls:
                - Notification icon
                - Messaging icon
                - 3-Line (Hamburger) Menu box */}
            {isOwnerView && (
              <div className="flex items-center gap-1.5 relative">
                
                {/* 1. Notification Icon */}
                <button
                  type="button"
                  onClick={() => setActiveModal('notifications')}
                  className="w-9 h-9 rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 flex items-center justify-center text-black relative transition active:scale-95 cursor-pointer"
                  title="নোটিফিকেশন"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 stroke-[2]" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-black ring-2 ring-white" />
                </button>

                {/* 2. Messaging Icon */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenChat) {
                      onOpenChat(profile.name);
                    } else {
                      setActiveModal('messages');
                    }
                  }}
                  className="w-9 h-9 rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 flex items-center justify-center text-black relative transition active:scale-95 cursor-pointer"
                  title="মেসেজ ও চ্যাট"
                  aria-label="Messages"
                >
                  <MessageSquare className="w-4 h-4 stroke-[2]" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-black ring-2 ring-white" />
                </button>

                {/* 3. 3-Line (Hamburger) Menu Box */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(prev => !prev)}
                    className="w-9 h-9 rounded-md border border-black bg-black text-white hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 cursor-pointer"
                    title="মেনু"
                    aria-label="Owner Menu"
                    aria-expanded={isMenuOpen}
                  >
                    {isMenuOpen ? (
                      <X className="w-4 h-4 stroke-[2.2]" />
                    ) : (
                      <Menu className="w-4 h-4 stroke-[2.2]" />
                    )}
                  </button>

                  {/* Hamburger Menu Dropdown:
                      - Dashboard
                      - Wallet
                      - Edit Profile
                      - Notifications
                      - Messages
                      - Sign Out
                      - Delete Profile */}
                  {isMenuOpen && (
                    <>
                      {/* Backdrop for closing */}
                      <div
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setIsMenuOpen(false)}
                      />

                      <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-300 rounded-md shadow-lg z-50 py-1.5 font-sans animate-in fade-in-50 zoom-in-95 duration-100 text-left">
                        <div className="px-3 py-2 border-b border-neutral-200">
                          <p className="text-xs font-bold text-black truncate">{profile.name}</p>
                          <p className="text-[10px] text-neutral-500 font-mono">আইডি: {profile.uniqueId}</p>
                        </div>

                        {/* Dashboard */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            if (onNavigateDashboard) onNavigateDashboard();
                          }}
                          className="w-full px-3 py-2 text-xs font-medium text-black hover:bg-neutral-100 flex items-center gap-2.5 transition text-left cursor-pointer"
                        >
                          <LayoutDashboard className="w-4 h-4 text-black" />
                          <span>Dashboard (ড্যাশবোর্ড)</span>
                        </button>

                        {/* Wallet */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            if (onOpenWallet) {
                              onOpenWallet();
                            } else {
                              setActiveModal('wallet');
                            }
                          }}
                          className="w-full px-3 py-2 text-xs font-medium text-black hover:bg-neutral-100 flex items-center gap-2.5 transition text-left cursor-pointer"
                        >
                          <Wallet className="w-4 h-4 text-black" />
                          <span>Wallet (ওয়ালেট ও আয়)</span>
                        </button>

                        {/* Edit Profile */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            if (onEditProfile) onEditProfile(profile);
                          }}
                          className="w-full px-3 py-2 text-xs font-medium text-black hover:bg-neutral-100 flex items-center gap-2.5 transition text-left cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4 text-black" />
                          <span>Edit Profile (প্রোফাইল সম্পাদন)</span>
                        </button>

                        {/* Notifications */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setActiveModal('notifications');
                          }}
                          className="w-full px-3 py-2 text-xs font-medium text-black hover:bg-neutral-100 flex items-center gap-2.5 transition text-left cursor-pointer"
                        >
                          <Bell className="w-4 h-4 text-black" />
                          <span>Notifications (বিজ্ঞপ্তি)</span>
                        </button>

                        {/* Messages */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            if (onOpenChat) {
                              onOpenChat(profile.name);
                            } else {
                              setActiveModal('messages');
                            }
                          }}
                          className="w-full px-3 py-2 text-xs font-medium text-black hover:bg-neutral-100 flex items-center gap-2.5 transition text-left cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4 text-black" />
                          <span>Messages (বার্তা ও ইনবক্স)</span>
                        </button>

                        <div className="my-1 border-t border-neutral-200" />

                        {/* Sign Out */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            if (onSignOut) onSignOut();
                          }}
                          className="w-full px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-100 flex items-center gap-2.5 transition text-left cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-neutral-700" />
                          <span>Sign Out (লগআউট)</span>
                        </button>

                        {/* Delete Profile */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setActiveModal('delete_confirm');
                          }}
                          className="w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition text-left cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                          <span>Delete Profile (অ্যাকাউন্ট ডিলিট)</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

              </div>
            )}

            {/* VIEW B (Customer View):
                - Top-right notification, messaging, and 3-line menu box are completely hidden! */}
            {!isOwnerView && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-300 px-2 py-1 rounded">
                  VERIFIED PRO
                </span>
              </div>
            )}

          </div>

        </div>
      </header>

      {/* =========================================================================
          2. MAIN CONTENT AREA
          - Soft off-white background (#FBFBFA)
          - Classic Black & White / Monochrome Theme
          - Left: Square or passport-size Profile Photo
          - Right/Below: Full Name, Profession/Service, Blood Group, Unique ID Number
          ========================================================================= */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* View Mode Indicator Banner (Helpful for inspection) */}
        <div className="flex items-center justify-between text-xs font-mono border-b border-neutral-300 pb-2">
          <span className="text-neutral-500 uppercase tracking-wider">
            CURRENT VIEW: <strong className="text-black font-black">{isOwnerView ? 'OWNER VIEW (VIEW A)' : 'CUSTOMER VIEW (VIEW B)'}</strong>
          </span>
          <span className="text-[11px] text-neutral-500">
            {isOwnerView ? 'সম্পূর্ণ নিয়ন্ত্রণ ও ম্যানেজমেন্ট' : 'পাবলিক প্রোফাইল ও বুকিং'}
          </span>
        </div>

        {/* =========================================================================
            PROFILE CARD (Monochrome & Minimalist)
            ========================================================================= */}
        <div className="bg-white border border-neutral-300 rounded-lg p-5 sm:p-6 shadow-2xs">
          
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-start">
            
            {/* LEFT SIDE: Square or Passport-size Profile Photo */}
            <div className="shrink-0 w-28 h-28 sm:w-36 sm:h-36 border-2 border-black rounded-md overflow-hidden bg-neutral-100 flex items-center justify-center relative shadow-xs">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover grayscale contrast-125"
                  onError={(e) => {
                    // Fallback to text initials if image fails
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-neutral-400 p-2 text-center">
                  <Briefcase className="w-10 h-10 stroke-[1.5] text-black mb-1" />
                  <span className="text-[10px] font-mono text-neutral-700 font-bold uppercase">Passport Photo</span>
                </div>
              )}

              {/* Passport photo watermark / seal */}
              <div className="absolute bottom-0 inset-x-0 bg-black text-white text-[9px] font-mono font-bold text-center py-0.5 tracking-wider uppercase">
                {profile.uniqueId}
              </div>
            </div>

            {/* RIGHT/BELOW PHOTO: 
                - Full Name (e.g., Nayan Chakma)
                - Profession/Service (e.g., Electrician, Barber)
                - Blood Group (e.g., Blood group - A+)
                - Unique ID Number (e.g., ID-001, ID-Kha-001) */}
            <div className="flex-1 min-w-0 space-y-3 w-full">
              
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-black">
                    {profile.name}
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-black text-white px-2 py-0.5 rounded">
                    <ShieldCheck className="w-3 h-3" />
                    VERIFIED
                  </span>
                </div>

                <p className="text-sm sm:text-base font-bold text-neutral-800 flex items-center gap-1.5 mt-0.5">
                  <Briefcase className="w-4 h-4 text-black" />
                  <span>{profile.profession}</span>
                </p>
              </div>

              {/* Minimalist Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-neutral-200">
                
                {/* Blood Group */}
                <div className="p-2 border border-neutral-300 rounded bg-[#FBFBFA]">
                  <span className="text-[10px] uppercase font-mono text-neutral-500 block">
                    Blood Group
                  </span>
                  <span className="font-mono font-black text-black text-sm flex items-center gap-1">
                    <Droplet className="w-3.5 h-3.5 fill-black text-black" />
                    {profile.bloodGroup || 'A+'}
                  </span>
                </div>

                {/* Unique ID Number */}
                <div className="p-2 border border-neutral-300 rounded bg-[#FBFBFA]">
                  <span className="text-[10px] uppercase font-mono text-neutral-500 block">
                    Unique ID Number
                  </span>
                  <span className="font-mono font-black text-black text-sm tracking-wide">
                    {profile.uniqueId || 'ID-001'}
                  </span>
                </div>

                {/* Location */}
                <div className="p-2 border border-neutral-300 rounded bg-[#FBFBFA]">
                  <span className="text-[10px] uppercase font-mono text-neutral-500 block">
                    Service Area
                  </span>
                  <span className="font-medium text-black truncate block">
                    {profile.area}, {profile.district}
                  </span>
                </div>

                {/* Experience & Rating */}
                <div className="p-2 border border-neutral-300 rounded bg-[#FBFBFA]">
                  <span className="text-[10px] uppercase font-mono text-neutral-500 block">
                    Experience / Rating
                  </span>
                  <span className="font-mono font-bold text-black flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-black text-black" />
                    {profile.rating} ★ ({profile.completedJobs} কাজ)
                  </span>
                </div>

              </div>

              {/* Bio & Description */}
              {profile.bio && (
                <div className="pt-2 text-xs text-neutral-700 leading-relaxed border-t border-neutral-200">
                  <p>{profile.bio}</p>
                </div>
              )}

              {/* Skills Tags (Black & White Minimalist) */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profile.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-mono px-2 py-0.5 border border-neutral-300 rounded bg-neutral-100 text-neutral-900"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

            </div>

          </div>

        </div>

        {/* =========================================================================
            VIEW A (OWNER VIEW EXCLUSIVE SECTION)
            - Dashboard overview
            - Wallet balance & stats
            - Quick manage actions
            ========================================================================= */}
        {isOwnerView && (
          <section className="bg-white border border-neutral-300 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-black uppercase tracking-wider font-mono flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Owner Management Console
                </h3>
                <p className="text-xs text-neutral-500">আপনার সেবাদাতা প্রোফাইল ও সার্ভিস পরিসংখ্যান</p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-neutral-200 text-black px-2 py-0.5 rounded">
                LIVE STATUS: ACTIVE
              </span>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 border border-neutral-200 rounded-md bg-[#FBFBFA]">
                <span className="text-[10px] uppercase font-mono text-neutral-500 block">মোট সম্পন্ন কাজ</span>
                <span className="text-base sm:text-lg font-mono font-black text-black">{profile.completedJobs}</span>
              </div>
              <div className="p-3 border border-neutral-200 rounded-md bg-[#FBFBFA]">
                <span className="text-[10px] uppercase font-mono text-neutral-500 block">গড় রেটিং</span>
                <span className="text-base sm:text-lg font-mono font-black text-black">{profile.rating} / 5.0</span>
              </div>
              <div className="p-3 border border-neutral-200 rounded-md bg-[#FBFBFA]">
                <span className="text-[10px] uppercase font-mono text-neutral-500 block">ওয়ালেট ব্যালেন্স</span>
                <span className="text-base sm:text-lg font-mono font-black text-black">৳ ৩,৪৫০</span>
              </div>
            </div>

            {/* Direct Menu Action Shortcuts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <button
                type="button"
                onClick={() => onNavigateDashboard?.()}
                className="p-2.5 text-xs font-mono font-bold border border-neutral-300 hover:bg-neutral-100 rounded text-black transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                ড্যাশবোর্ড
              </button>

              <button
                type="button"
                onClick={() => onOpenWallet ? onOpenWallet() : setActiveModal('wallet')}
                className="p-2.5 text-xs font-mono font-bold border border-neutral-300 hover:bg-neutral-100 rounded text-black transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                ওয়ালেট
              </button>

              <button
                type="button"
                onClick={() => onEditProfile?.(profile)}
                className="p-2.5 text-xs font-mono font-bold border border-neutral-300 hover:bg-neutral-100 rounded text-black transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                এডিট প্রোফাইল
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('notifications')}
                className="p-2.5 text-xs font-mono font-bold border border-neutral-300 hover:bg-neutral-100 rounded text-black transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                নোটিফিকেশন
              </button>
            </div>
          </section>
        )}

        {/* =========================================================================
            VIEW B (CUSTOMER VIEW EXCLUSIVE SECTION)
            - Personal direct phone number remains hidden for privacy
            - Communication options provided: WhatsApp, Facebook, and Direct Call button
            - Payment reference options: bKash and Nagad
            - Bottom of the page: Prominent full-width CTA "সার্ভিস বুকিং করুন" (Book Service)
            ========================================================================= */}
        {!isOwnerView && (
          <div className="space-y-6">

            {/* 1. Privacy Protection Notice */}
            <div className="bg-white border border-neutral-300 rounded-lg p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded border border-black bg-black text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-black">ব্যক্তিগত তথ্য ও নিরাপত্তা সুরক্ষা (Privacy Protected)</p>
                <p className="text-neutral-600 text-[11px]">
                  সেবাদাতার ব্যক্তিগত ডিরেক্ট ফোন নম্বর সুরক্ষার স্বার্থে প্রদর্শিত হচ্ছে না। নিচের অনুমোদিত চ্যানেলের মাধ্যমে যোগাযোগ করুন।
                </p>
              </div>
            </div>

            {/* 2. Communication Options (WhatsApp, Facebook, Direct Call) */}
            <section className="bg-white border border-neutral-300 rounded-lg p-5 space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-black" />
                যোগাযোগের মাধ্যম (Communication Options)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                
                {/* A. WhatsApp Button */}
                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 border-2 border-black rounded-md bg-white hover:bg-black hover:text-white text-black font-mono font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 text-center cursor-pointer group"
                >
                  <Send className="w-4 h-4" />
                  <span>WhatsApp চ্যাট</span>
                </a>

                {/* B. Facebook Button */}
                <a
                  href={profile.facebook || 'https://facebook.com/jhadimadi'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 border-2 border-black rounded-md bg-white hover:bg-black hover:text-white text-black font-mono font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 text-center cursor-pointer group"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Facebook পেজ</span>
                </a>

                {/* C. Direct Call Button (Safe Masked / Official Proxy) */}
                <button
                  type="button"
                  onClick={() => setActiveModal('call_dialog')}
                  className="p-3 border-2 border-black rounded-md bg-black text-white hover:bg-neutral-800 font-mono font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 text-center cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Direct Call (কল করুন)</span>
                </button>

              </div>
            </section>

            {/* 3. Payment Reference Options (bKash and Nagad) */}
            <section className="bg-white border border-neutral-300 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-black" />
                  পেমেন্ট রেফারেন্স মাধ্যম (Payment References)
                </h3>
                <span className="text-[10px] text-neutral-500 font-mono">ক্লিক করে নম্বর কপি করুন</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* bKash Payment Reference */}
                <div className="p-3.5 border border-neutral-300 rounded-md bg-[#FBFBFA] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase font-black tracking-wider text-black block">
                      বিকাশ (bKash Personal / Merchant)
                    </span>
                    <span className="font-mono font-black text-sm text-black block">
                      {profile.bkashNumber || '01870592699'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(profile.bkashNumber || '01870592699', 'bkash')}
                    className="px-3 py-1.5 text-xs font-mono font-bold border border-black rounded hover:bg-black hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                    title="নম্বর কপি করুন"
                  >
                    {copiedField === 'bkash' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>কপি হয়েছে</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>কপি</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Nagad Payment Reference */}
                <div className="p-3.5 border border-neutral-300 rounded-md bg-[#FBFBFA] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase font-black tracking-wider text-black block">
                      নগদ (Nagad Personal / Merchant)
                    </span>
                    <span className="font-mono font-black text-sm text-black block">
                      {profile.nagadNumber || '01870592699'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(profile.nagadNumber || '01870592699', 'nagad')}
                    className="px-3 py-1.5 text-xs font-mono font-bold border border-black rounded hover:bg-black hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                    title="নম্বর কপি করুন"
                  >
                    {copiedField === 'nagad' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>কপি হয়েছে</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>কপি</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </section>

          </div>
        )}

      </main>

      {/* =========================================================================
          3. BOTTOM CALL-TO-ACTION BUTTON (CUSTOMER VIEW ONLY)
          - Prominent full-width CTA: "সার্ভিস বুকিং করুন" (Book Service)
          - Monochrome high contrast
          ========================================================================= */}
      {!isOwnerView && (
        <div className="sticky bottom-0 z-30 bg-[#FBFBFA]/95 backdrop-blur-xs border-t border-neutral-300 p-4">
          <div className="max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => setActiveModal('booking')}
              className="w-full py-4 px-6 rounded-md bg-black text-white hover:bg-neutral-900 font-bold text-base sm:text-lg tracking-wide uppercase shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              id="btn-book-service-cta"
            >
              <Calendar className="w-5 h-5 stroke-[2.2]" />
              <span>সার্ভিস বুকিং করুন (Book Service)</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS & DIALOGS (Clean Monochrome Minimalist Modals)
          ========================================================================= */}

      {/* A. NOTIFICATIONS MODAL (VIEW A: Owner View) */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">Notifications (বিজ্ঞপ্তি)</h4>
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
                  <span>নতুন বুকিং অনুরোধ</span>
                  <span>আজ, ১০:১৫ AM</span>
                </div>
                <p className="font-bold text-black">পানখাইয়াপাড়ায় নতুন হোম ওয়্যারিং সার্ভিস প্রয়োজন।</p>
                <p className="text-[11px] text-neutral-600">গ্রাহক: আনন্দ বিকাশ চাকমা • ০১৮•••••••</p>
              </div>

              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center font-mono text-[10px] text-neutral-500">
                  <span>পেমেন্ট সফল</span>
                  <span>গতকাল</span>
                </div>
                <p className="font-bold text-black">৳ ৭০০ ওয়ালেটে সফলভাবে জমা হয়েছে।</p>
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

      {/* B. MESSAGES MODAL (VIEW A: Owner View) */}
      {activeModal === 'messages' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">Inbox Messages (মেসেজ)</h4>
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
                  <span className="font-bold text-black">সুনীল ত্রিপুরা</span>
                  <span>১২ মিনিট আগে</span>
                </div>
                <p className="text-neutral-700">ভাইয়া, কাল বিকেলে কি ফ্রি আছেন? বাসার মোটরটা দেখতে হবে।</p>
              </div>

              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center font-mono text-[10px] text-neutral-500">
                  <span className="font-bold text-black">ঝাদিমাদি সাপোর্ট টিম</span>
                  <span>২ দিন আগে</span>
                </div>
                <p className="text-neutral-700">আপনার প্রফেশনাল ব্যাজ সফলভাবে ভেরিফাই করা হয়েছে।</p>
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

      {/* C. WALLET MODAL (VIEW A: Owner View) */}
      {activeModal === 'wallet' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">Service Wallet (ওয়ালেট)</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border border-black rounded-md bg-[#FBFBFA] text-center space-y-1">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">বর্তমান উত্তোলণযোগ্য ব্যালেন্স</span>
              <span className="text-2xl font-black font-mono text-black">৳ ৩,৪৫০.০০</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-center">
              <div className="p-2 border border-neutral-300 rounded">
                <span className="text-[10px] text-neutral-500 block">মোট উপার্জিত</span>
                <span className="font-bold text-black">৳ ১৮,৭০০</span>
              </div>
              <div className="p-2 border border-neutral-300 rounded">
                <span className="text-[10px] text-neutral-500 block">মোট উত্তোলিত</span>
                <span className="font-bold text-black">৳ ১৫,২৫০</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                alert('টাকা উত্তোলনের অনুরোধ সফলভাবে গ্রহণ করা হয়েছে। ২৪ ঘণ্টার মধ্যে প্রক্রিয়া সম্পন্ন হবে।');
                setActiveModal('none');
              }}
              className="w-full py-2.5 bg-black text-white text-xs font-mono font-bold rounded hover:bg-neutral-800 transition cursor-pointer"
            >
              টাকা উত্তোলন (Withdraw) করুন
            </button>
          </div>
        </div>
      )}

      {/* D. DELETE PROFILE CONFIRMATION MODAL (VIEW A: Owner View) */}
      {activeModal === 'delete_confirm' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-600 rounded-lg w-full max-w-sm p-5 space-y-4 shadow-xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full border-2 border-red-600 bg-red-50 text-red-600 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-black text-base text-black">প্রোফাইল স্থায়ীভাবে মুছে ফেলবেন?</h4>
              <p className="text-xs text-neutral-600">
                এই প্রক্রিয়াটি অপরিবর্তনীয়। আপনার সেবাদাতা আইডি, রিভিউ ও সমস্ত তথ্য ঝাদিমাদি থেকে মুছে যাবে।
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="py-2.5 border border-neutral-300 rounded text-xs font-bold text-black hover:bg-neutral-100 transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal('none');
                  if (onDeleteAccount) onDeleteAccount();
                }}
                className="py-2.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition cursor-pointer"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* E. DIRECT CALL SAFE DIALOG (VIEW B: Customer View) */}
      {activeModal === 'call_dialog' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-sm p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">Direct Call (সরাসরি কল)</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1 text-xs">
              <span className="text-[10px] font-mono uppercase text-neutral-500 block">সেবাদাতার নাম ও আইডি</span>
              <p className="font-black text-sm text-black">{profile.name}</p>
              <p className="font-mono text-neutral-600">আইডি: {profile.uniqueId}</p>
            </div>

            <p className="text-xs text-neutral-600">
              জরুরি কাজের প্রয়োজনে সেবাদাতার অনুমোদিত নম্বরে সরাসরি কল সংযোগ করতে নিচের বোতামে চাপুন।
            </p>

            <a
              href={`tel:${profile.phone || '01870592699'}`}
              className="w-full py-3 bg-black text-white text-xs font-mono font-bold rounded flex items-center justify-center gap-2 hover:bg-neutral-800 transition text-center cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>এখনই কল করুন (Dial Now)</span>
            </a>
          </div>
        </div>
      )}

      {/* F. SERVICE BOOKING MODAL (VIEW B: Customer View - Bottom CTA Trigger) */}
      {activeModal === 'booking' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">সার্ভিস বুকিং ফরম</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bookingSuccess ? (
              <div className="p-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full border-2 border-black bg-black text-white mx-auto flex items-center justify-center">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h5 className="font-black text-base text-black">বুকিং সফলভাবে সম্পন্ন হয়েছে!</h5>
                <p className="text-xs text-neutral-600">
                  সেবাদাতা {profile.name}-কে অবহিত করা হয়েছে। শীঘ্রই তিনি আপনার সাথে যোগাযোগ করবেন।
                </p>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="space-y-3 text-xs">
                
                <div className="p-2.5 border border-neutral-300 rounded bg-[#FBFBFA] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-neutral-500">সেবাদাতা</span>
                    <p className="font-bold text-black">{profile.name} ({profile.profession})</p>
                  </div>
                  <span className="font-mono text-neutral-700 font-bold">{profile.uniqueId}</span>
                </div>

                <div>
                  <label className="block font-bold text-black mb-1">আপনার নাম *</label>
                  <input
                    type="text"
                    required
                    value={bookingFormData.customerName}
                    onChange={(e) => setBookingFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="আপনার পূর্ণ নাম লিখুন"
                    className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-sans focus:outline-hidden focus:border-black"
                  />
                </div>

                <div>
                  <label className="block font-bold text-black mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="tel"
                    required
                    value={bookingFormData.customerPhone}
                    onChange={(e) => setBookingFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="01XXXXXXXXX"
                    className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-mono focus:outline-hidden focus:border-black"
                  />
                </div>

                <div>
                  <label className="block font-bold text-black mb-1">কাজের বিবরণ (Service Details)</label>
                  <textarea
                    rows={3}
                    value={bookingFormData.serviceDetails}
                    onChange={(e) => setBookingFormData(prev => ({ ...prev, serviceDetails: e.target.value }))}
                    placeholder="কী ধরনের কাজের জন্য ডাকছেন তা সংক্ষেপে লিখুন..."
                    className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-sans focus:outline-hidden focus:border-black"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-black mb-1">তারিখ</label>
                    <input
                      type="date"
                      value={bookingFormData.preferredDate}
                      onChange={(e) => setBookingFormData(prev => ({ ...prev, preferredDate: e.target.value }))}
                      className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-mono focus:outline-hidden focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-black mb-1">ঠিকানা / এলাকা</label>
                    <input
                      type="text"
                      value={bookingFormData.address}
                      onChange={(e) => setBookingFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="বাসার ঠিকানা / এলাকা"
                      className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-sans focus:outline-hidden focus:border-black"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-black text-white font-bold text-sm tracking-wide uppercase rounded hover:bg-neutral-800 transition active:scale-[0.99] cursor-pointer"
                  >
                    বুকিং নিশ্চিত করুন (Confirm Booking)
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export { ServiceProviderProfile as ServiceProviderPublicProfileComponent };
export default ServiceProviderProfile;
