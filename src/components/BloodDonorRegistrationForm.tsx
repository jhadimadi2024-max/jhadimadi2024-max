import React, { useState, useMemo } from 'react';
import {
  Heart,
  Droplet,
  User,
  Phone,
  MapPin,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Check,
  Copy,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  LogOut,
  ArrowRight
} from 'lucide-react';
import { LOCATION_MASTER, DistrictItem, UpazilaItem } from '../data/locationMaster';
import { databaseService } from '../services/databaseService';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { offlineStorage, OFFLINE_KEYS } from '../utils/offlineStorage';
import { supabase, isSupabaseConfigured } from '../supabase';
import { smartSupabaseInsert } from '../utils/supabaseDataService';
import { registerUnifiedEntity } from '../services/unifiedRegistrationService';
import { formatDonorIdCode, BloodDonorProfile } from './BloodDonorProfile';
import { UserProfile } from '../types';

export interface BloodDonorRegistrationFormProps {
  lang?: 'bn' | 'en';
  initialPhone?: string;
  onSuccess?: (donor: any) => void;
  onCancel?: () => void;
  onViewPublicProfile?: (donor: any) => void;
  onShowToast?: (msg: string) => void;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/* Flatten all 64 districts of Bangladesh from LOCATION_MASTER */
interface FlatDistrict {
  nameBn: string;
  nameEn: string;
  code: string;
  divisionBn: string;
  upazilas: UpazilaItem[];
}

const ALL_64_DISTRICTS: FlatDistrict[] = (() => {
  const list: FlatDistrict[] = [];
  LOCATION_MASTER.forEach((div) => {
    div.districts.forEach((dst) => {
      list.push({
        ...dst,
        divisionBn: div.nameBn
      });
    });
  });
  return list;
})();

const normalizeBangladeshPhone = (value: string): string => {
  let phone = value.trim().replace(/[\s\-()]/g, '');
  if (phone.startsWith('+880')) {
    phone = '0' + phone.substring(4);
  } else if (phone.startsWith('880')) {
    phone = '0' + phone.substring(3);
  }
  return phone;
};

const isValidBangladeshPhone = (phone: string): boolean => {
  return /^01[3-9]\d{8}$/.test(phone);
};

export const BloodDonorRegistrationForm: React.FC<BloodDonorRegistrationFormProps> = ({
  lang = 'bn',
  initialPhone = '',
  onSuccess,
  onCancel,
  onViewPublicProfile,
  onShowToast,
}) => {
  const { login } = useAuth();
  const { navigateToTab } = useNavigation();
  const { addBloodDonor } = useData();

  // Form States strictly matching user specifications
  const [fullName, setFullName] = useState('');
  const [bloodGroup, setBloodGroup] = useState<string>('O+');
  const [phone, setPhone] = useState(initialPhone || '');
  const [district, setDistrict] = useState('খাগড়াছড়ি');
  const [upazila, setUpazila] = useState('খাগড়াছড়ি সদর');
  const [lastDonationDate, setLastDonationDate] = useState('');
  
  // Geolocation Coordinates (explicitly null if missing or unavailable)
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Two Password Fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Single Consent Checkbox
  const [consentAgreed, setConsentAgreed] = useState(true);

  // Submission & UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastBanner, setToastBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [submittedDonor, setSubmittedDonor] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Auto-detect browser location if available, fallback null
  React.useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos.coords && typeof pos.coords.latitude === 'number' && typeof pos.coords.longitude === 'number') {
            setLatitude(pos.coords.latitude);
            setLongitude(pos.coords.longitude);
          }
        },
        () => {
          setLatitude(null);
          setLongitude(null);
        },
        { timeout: 4000, enableHighAccuracy: false }
      );
    }
  }, []);

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastBanner({ message: msg, type });
    if (onShowToast) {
      onShowToast(type === 'success' ? (msg.startsWith('✅') ? msg : `✅ ${msg}`) : (msg.startsWith('❌') ? msg : `❌ ${msg}`));
    }
    setTimeout(() => {
      setToastBanner(null);
    }, 5000);
  };

  // Sync initialPhone if provided
  React.useEffect(() => {
    if (initialPhone && !phone) {
      setPhone(initialPhone);
    }
  }, [initialPhone]);

  // Find currently selected district object to populate Upazilas dynamically
  const currentDistrictObj = useMemo(() => {
    return (
      ALL_64_DISTRICTS.find(
        (d) => d.nameBn === district || d.nameEn.toLowerCase() === district.toLowerCase()
      ) || ALL_64_DISTRICTS[0]
    );
  }, [district]);

  // Dynamically populated Upazila/Thana list for selected district
  const availableUpazilas = useMemo(() => {
    return currentDistrictObj?.upazilas || [];
  }, [currentDistrictObj]);

  // When District changes, update upazila to first upazila of selected district
  const handleDistrictChange = (newDistrictName: string) => {
    setDistrict(newDistrictName);
    const matchedDist = ALL_64_DISTRICTS.find((d) => d.nameBn === newDistrictName);
    if (matchedDist && matchedDist.upazilas.length > 0) {
      setUpazila(matchedDist.upazilas[0].nameBn);
    } else {
      setUpazila('সদর');
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // 1. Full Name check: "রক্তদাতার পূর্ণ নাম"
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg('দয়া করে রক্তদাতার সঠিক পূর্ণ নাম লিখুন।');
      return;
    }

    // 2. Blood Group check: "রক্তের গ্রুপ (Blood Group)"
    if (!bloodGroup) {
      setErrorMsg('দয়া করে রক্তের গ্রুপ নির্বাচন করুন।');
      return;
    }

    // 3. Phone / WhatsApp Number check: "ফোন / হোয়াটসঅ্যাপ নম্বর"
    const cleanPhone = normalizeBangladeshPhone(phone);
    if (!isValidBangladeshPhone(cleanPhone)) {
      setErrorMsg('সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল / হোয়াটসঅ্যাপ নম্বর দিন (যেমন: 017..., 018..., 019...)।');
      return;
    }

    // 4. District & Upazila check: "জেলা (District)" & "উপজেলা / থানা (Upazila/Thana)"
    if (!district || !upazila) {
      setErrorMsg('দয়া করে জেলা এবং উপজেলা / থানা নির্বাচন করুন।');
      return;
    }

    // 5. Two Password Fields Validation: "পাসওয়ার্ড"
    if (!password || password.trim().length < 4) {
      setErrorMsg('অ্যাকাউন্ট সুরক্ষার জন্য কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড দিন।');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না, দয়া করে পুনরায় যাচাই করুন।');
      return;
    }

    // 6. Single Consent Checkbox check
    if (!consentAgreed) {
      setErrorMsg('মানবিক রক্তদানের অঙ্গীকারে সম্মতি প্রদান করতে হবে।');
      return;
    }

    setIsSubmitting(true);

    try {
      // Handle Duplicate Phone Error gracefully (if phone_number exists, alert user: "এই ফোন নম্বর দিয়ে ইতিমধ্যে রেজিস্ট্রেশন করা হয়েছে।")
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: existingDonors, error: dupCheckError } = await supabase
            .from('blood_donors')
            .select('id, phone_number, whatsapp_number')
            .or(`phone_number.eq.${cleanPhone},whatsapp_number.eq.${cleanPhone}`)
            .limit(1);

          if (!dupCheckError && existingDonors && existingDonors.length > 0) {
            setIsSubmitting(false);
            const dupMsg = 'এই ফোন নম্বর দিয়ে ইতিমধ্যে রেজিস্ট্রেশন করা হয়েছে।';
            setErrorMsg(dupMsg);
            try {
              alert(dupMsg);
            } catch (_) {}
            return;
          }
        } catch (checkErr) {
          console.warn('[BloodDonorRegistration] Duplicate phone check warning:', checkErr);
        }
      }

      // Auto-generate Unique Donor ID Code (e.g., ID: JHD-BD-0001) for local state / card
      const randomSeed = Math.floor(1000 + Math.random() * 9000);
      const generatedDonorId = `JHD-BD-${randomSeed}`;
      const internalId = `bld_${Date.now()}`;

      // Format last_donation_date as YYYY-MM-DD or NULL if empty
      const formattedLastDonationDate = (lastDonationDate && lastDonationDate.trim() && lastDonationDate.trim() !== 'N/A')
        ? lastDonationDate.trim()
        : null;

      // 2. LATITUDE / LONGITUDE FALLBACK:
      // If latitude or longitude is missing or unavailable, pass explicitly as null (not string "N/A" or undefined).
      const validLatitude = (typeof latitude === 'number' && !isNaN(latitude)) ? latitude : null;
      const validLongitude = (typeof longitude === 'number' && !isNaN(longitude)) ? longitude : null;

      // 1. MAP ONLY VALID COLUMNS TO PAYLOAD:
      // When inserting to 'blood_donors' table, ONLY include existing table columns:
      // - full_name
      // - phone_number
      // - whatsapp_number
      // - blood_group
      // - district
      // - upazila
      // - last_donation_date
      // - password
      // - latitude (set to null if not available, do NOT send string "N/A")
      // - longitude (set to null if not available)
      //
      // Remove or strip out non-existent keys like 'district_unique_id', 'division', 'is_available', 'verified' before calling supabase.from('blood_donors').insert().
      const bloodDonorPayload: Record<string, any> = {
        full_name: trimmedName,
        phone_number: cleanPhone,
        whatsapp_number: cleanPhone,
        blood_group: bloodGroup,
        district: district,
        upazila: upazila,
        last_donation_date: formattedLastDonationDate,
        password: password.trim(),
        latitude: validLatitude,
        longitude: validLongitude,
      };

      // On Form Submission, run: supabase.from('blood_donors').insert([bloodDonorPayload])
      if (isSupabaseConfigured && supabase) {
        const { error: insertError } = await supabase
          .from('blood_donors')
          .insert([bloodDonorPayload]);

        if (insertError) {
          console.error('Supabase blood_donors insert error:', insertError.message || insertError);
          const errMsg = (insertError.message || '').toLowerCase();
          const isDuplicate =
            insertError.code === '23505' ||
            errMsg.includes('duplicate') ||
            errMsg.includes('unique') ||
            errMsg.includes('phone') ||
            errMsg.includes('already exists');

          if (isDuplicate) {
            setIsSubmitting(false);
            const dupMsg = 'এই ফোন নম্বর দিয়ে ইতিমধ্যে রেজিস্ট্রেশন করা হয়েছে।';
            setErrorMsg(dupMsg);
            triggerToast(dupMsg, 'error');
            return;
          }

          // Fallback via smartSupabaseInsert
          const smartRes = await smartSupabaseInsert('blood_donors', bloodDonorPayload);
          if (!smartRes.success) {
            console.warn('[BloodDonorRegistration] Fallback insert note:', smartRes.error);
          }
        }
      }

      // Save to database service (local caches & mirrors)
      try {
        await databaseService.saveBloodDonorToDatabase({
          ...bloodDonorPayload,
          id: internalId,
          districtUniqueId: generatedDonorId
        });
      } catch (dbSaveErr) {
        console.warn('[BloodDonorRegistration] DatabaseService note:', dbSaveErr);
      }

      // Unified registration flow (Auth + profiles table persistence)
      try {
        await registerUnifiedEntity({
          role: 'blood_donor',
          fullName: trimmedName,
          phone: cleanPhone,
          password: password.trim(),
          division: currentDistrictObj.divisionBn || 'চট্টগ্রাম',
          district: district,
          upazila: upazila,
          bloodGroup: bloodGroup,
          rolePayload: {
            bloodGroup,
            donorIdCode: generatedDonorId,
            lastDonationDate: formattedLastDonationDate || '',
            isAvailable: true
          }
        });
      } catch (uniErr) {
        console.warn('[BloodDonorRegistration] Unified service note:', uniErr);
      }

      // Post to local server endpoint if available
      try {
        await fetch('/api/blood-donors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...bloodDonorPayload,
            id: internalId,
            districtUniqueId: generatedDonorId
          })
        });
      } catch (_) {}

      // Build Complete User Profile for Session State
      const donorUser: UserProfile = {
        id: internalId,
        name: trimmedName,
        fullName: trimmedName,
        phone: cleanPhone,
        role: 'blood_donor',
        district: district,
        upazila: upazila,
        mahalla: upazila || 'সদর',
        division: currentDistrictObj.divisionBn || 'চট্টগ্রাম',
        bloodGroup: bloodGroup,
        isBloodDonor: true,
        isAvailable: true,
        memberUID: generatedDonorId,
        memberType: 'blood_donor',
        avatar: '',
        createdAt: new Date().toISOString()
      };

      // Seamless profile mapping
      Object.assign(donorUser, {
        uid: internalId,
        full_name: trimmedName,
        phone_number: cleanPhone,
        phoneNumber: cleanPhone,
        whatsapp_number: cleanPhone,
        whatsappNumber: cleanPhone,
        blood_group: bloodGroup,
        last_donation_date: formattedLastDonationDate,
        lastDonationDate: formattedLastDonationDate || '',
        donorIdCode: generatedDonorId,
        districtUniqueId: generatedDonorId,
        uniqueId: generatedDonorId,
        willingToDonateBlood: true,
        is_blood_donor: true,
        blood_donor: true,
        available: true,
        verified: true,
        password: password.trim()
      });

      // 1. Automatically save session/user state via AuthContext
      login(donorUser, true);

      // 2. Save session/user state to offline storage
      try {
        offlineStorage.saveItem(OFFLINE_KEYS.USER, donorUser);
        offlineStorage.saveItem('jhadimadi_user_role_v1', 'blood_donor');
      } catch (_) {}

      // 3. Save session/user state to localStorage for cross-session persistence
      if (typeof window !== 'undefined') {
        try {
          const userStr = JSON.stringify(donorUser);
          localStorage.setItem('jhadimadi_offline_user_v1', userStr);
          localStorage.setItem('jhadimadi_customer_auth', userStr);
          localStorage.setItem('jhadimadi_current_user', userStr);
          localStorage.setItem('jm_authenticated_user', userStr);
          localStorage.setItem('jhadimadi_user_role_v1', 'blood_donor');
          localStorage.setItem('jhadimadi_donor_session', userStr);
        } catch (_) {}
      }

      // 4. Update DataContext
      try {
        addBloodDonor({
          id: internalId,
          name: trimmedName,
          bloodGroup: bloodGroup as any,
          phone: cleanPhone,
          district: district,
          upazila: upazila,
          division: currentDistrictObj.divisionBn || 'চট্টগ্রাম',
          area: upazila || 'সদর',
          lastDonationDate: formattedLastDonationDate || '',
          totalDonations: 0,
          isAvailable: true,
          available: true,
          verified: true,
          districtUniqueId: generatedDonorId
        });
      } catch (ctxErr) {
        console.warn('[BloodDonorRegistration] DataContext add error:', ctxErr);
      }

      // 3. CLEAN SUBMIT HANDLER:
      // Ensure toast notifications show success upon clean registration and redirect or reset the form properly.
      const successMessage = 'রক্তদাতা হিসেবে নিবন্ধন সফল হয়েছে!';
      triggerToast(successMessage, 'success');

      // Reset the form fields
      setFullName('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setLastDonationDate('');
      setErrorMsg('');

      // Store submitted donor locally for immediate card rendering
      setSubmittedDonor(donorUser);

      // Invoke parent onSuccess callback if provided
      if (onSuccess) {
        onSuccess(donorUser);
      }

      // Redirect the donor directly to their created Blood Donor Profile View (/profile)
      try {
        navigateToTab('profile');
      } catch (navErr) {
        console.warn('[BloodDonorRegistration] Navigation note:', navErr);
      }

      if (typeof window !== 'undefined') {
        try {
          window.history.pushState({ tab: 'profile', pathname: '/profile' }, '', '/profile');
          window.dispatchEvent(new Event('popstate'));
        } catch (_) {}
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      console.error('[BloodDonorRegistration] Error:', err);
      const errMsg = err?.message || 'রেজিস্ট্রেশনে ত্রুটি হয়েছে, অনুগ্রহ করে পুনরায় চেষ্টা করুন।';
      setErrorMsg(errMsg);
      triggerToast(errMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp Contact Trigger without showing raw phone on screen
  const handleContactDonor = () => {
    if (!submittedDonor?.phone) return;
    const cleanDigits = submittedDonor.phone.replace(/\D/g, '');
    const intlNumber = cleanDigits.startsWith('0') 
      ? '88' + cleanDigits 
      : (cleanDigits.startsWith('88') ? cleanDigits : '88' + cleanDigits);

    const message = encodeURIComponent(
      `আসসালামু আলাইকুম ${submittedDonor.name}, ঝাদিমাদি ব্ল্যাড নেটওয়ার্কে আপনার রক্তের গ্রুপ (${submittedDonor.bloodGroup}) প্রোফাইল দেখে জরুরি প্রয়োজনে যোগাযোগ করছি।`
    );
    window.open(`https://wa.me/${intlNumber}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyId = () => {
    const idToCopy = submittedDonor?.donorIdCode || submittedDonor?.uniqueId || 'JHD-BD-0001';
    navigator.clipboard.writeText(idToCopy);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // =========================================================================
  // DEDICATED BLOOD DONOR PROFILE CARD (Rendered after successful registration)
  // =========================================================================
  if (submittedDonor) {
    return (
      <div className="w-full max-w-md mx-auto" id="blood-donor-success-card">
        <BloodDonorProfile
          donor={submittedDonor}
          currentUser={submittedDonor}
          isOwner={true}
          lang={lang}
          onBack={onCancel}
          onSignOut={onCancel}
        />
      </div>
    );
  }

  // =========================================================================
  // PART 1: BLOOD DONOR REGISTRATION FORM
  // =========================================================================
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#FAF9F6] rounded-3xl border-2 border-rose-300 p-4 sm:p-6 shadow-sm space-y-4.5 animate-in fade-in duration-150 text-left"
      id="form-blood-donor-registration"
    >
      {/* =====================================================================
          2. NEW FORM HEADER BOX
          - Header Title: "রক্তদাতা রেজিস্ট্রেশন"
          - Subtitles/Taglines immediately below title (without '৪.'):
            * "এক ব্যাগ রক্ত একটি জীবন বাঁচানোর উসিলা — মানবতাই পরম ধর্ম"
            * "পাহাড়ি ও দেশব্যাপী জরুরি রোগীদের তাৎক্ষণিক রক্তের প্রয়োজনে ঝাদিমাদি মানবিক রক্তদান নেটওয়ার্কে যুক্ত হন"
          ===================================================================== */}
      <div 
        className="p-4 sm:p-5 bg-gradient-to-r from-rose-50 via-red-50 to-amber-50 border-2 border-rose-200/90 rounded-2xl space-y-2 shadow-2xs"
        id="blood-donor-form-header"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 to-red-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Droplet className="w-6 h-6 fill-white stroke-none animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-rose-950 leading-tight tracking-tight">
              রক্তদাতা রেজিস্ট্রেশন
            </h2>
            <p className="text-xs sm:text-[13px] text-rose-800 font-bold mt-0.5 leading-snug">
              এক ব্যাগ রক্ত একটি জীবন বাঁচানোর উসিলা — মানবতাই পরম ধর্ম
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-600 leading-snug pt-2 border-t border-rose-200/70 font-medium">
          পাহাড়ি ও দেশব্যাপী জরুরি রোগীদের তাৎক্ষণিক রক্তের প্রয়োজনে ঝাদিমাদি মানবিক রক্তদান নেটওয়ার্কে যুক্ত হন
        </p>
      </div>

      {/* Floating or Inline Toast Notification */}
      {toastBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs sm:text-sm font-bold shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
            toastBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
          role="alert"
        >
          {toastBanner.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastBanner.message}</span>
        </div>
      )}

      {/* Validation Error Alert */}
      {errorMsg && !toastBanner && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs font-bold animate-shake">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* =====================================================================
          FORM FIELD 1: Full Name (রক্তদাতার পূর্ণ নাম) [Required]
          ===================================================================== */}
      <div>
        <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
          <User className="w-4 h-4 text-rose-600" />
          <span>রক্তদাতার পূর্ণ নাম <span className="text-rose-600">*</span></span>
        </label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="যেমন: সুমন চাকমা / মোঃ রফিকুল ইসলাম"
          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 transition"
          id="input-donor-full-name"
        />
      </div>

      {/* =====================================================================
          FORM FIELD 2: Blood Group (রক্তের গ্রুপ) [Required - Selector Buttons]
          ===================================================================== */}
      <div>
        <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
          <Droplet className="w-4 h-4 text-rose-600 fill-rose-600" />
          <span>রক্তের গ্রুপ (Blood Group) <span className="text-rose-600">*</span></span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {BLOOD_GROUPS.map((bg) => {
            const isSelected = bloodGroup === bg;
            return (
              <button
                type="button"
                key={bg}
                onClick={() => setBloodGroup(bg)}
                className={`py-2 px-2 text-center rounded-xl border text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs scale-[1.02]'
                    : 'bg-white hover:bg-rose-50 text-gray-800 border-gray-200'
                }`}
                id={`btn-select-bg-${bg.replace('+', 'pos').replace('-', 'neg')}`}
              >
                <Droplet className={`w-3 h-3 ${isSelected ? 'fill-white text-white' : 'text-rose-500'}`} />
                <span>{bg}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          FORM FIELD 3: Phone / WhatsApp Number (ফোন / হোয়াটসঅ্যাপ নম্বর)
          [Single combined input field. No separate email or additional WhatsApp fields.]
          ===================================================================== */}
      <div>
        <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
          <Phone className="w-4 h-4 text-rose-600" />
          <span>ফোন / হোয়াটসঅ্যাপ নম্বর <span className="text-rose-600">*</span></span>
        </label>
        <div className="relative">
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 transition font-mono"
            id="input-donor-phone-whatsapp"
          />
          <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <p className="text-[10.5px] text-stone-500 mt-1 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>এই নম্বরটি সরাসরি ডায়াল ও জরুরি হোয়াটসঅ্যাপ যোগাযোগের জন্য সুরক্ষিত থাকবে।</span>
        </p>
      </div>

      {/* =====================================================================
          FORM FIELD 4: District & Upazila/Thana Selection
          - District dropdown contains all 64 districts of Bangladesh.
          - Upazila/Thana dropdown dynamically populated based on selected district.
          - Division field is completely removed.
          ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
        {/* District (জেলা) - All 64 Districts */}
        <div>
          <label className="block text-xs font-bold text-gray-800 mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>জেলা (District) <span className="text-rose-600">*</span></span>
          </label>
          <select
            value={district}
            onChange={(e) => handleDistrictChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:border-rose-600 focus:outline-none cursor-pointer"
            id="select-donor-district"
          >
            {ALL_64_DISTRICTS.map((d) => (
              <option key={d.code || d.nameBn} value={d.nameBn}>
                {d.nameBn} ({d.nameEn})
              </option>
            ))}
          </select>
        </div>

        {/* Upazila/Thana (উপজেলা / থানা) - Dynamically populated */}
        <div>
          <label className="block text-xs font-bold text-gray-800 mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>উপজেলা / থানা (Upazila / Thana) <span className="text-rose-600">*</span></span>
          </label>
          <select
            value={upazila}
            onChange={(e) => setUpazila(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:border-rose-600 focus:outline-none cursor-pointer"
            id="select-donor-upazila"
          >
            {availableUpazilas.map((u) => (
              <option key={u.code || u.nameBn} value={u.nameBn}>
                {u.nameBn} ({u.nameEn})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* =====================================================================
          FORM FIELD 5: Last Donation Date (শেষ রক্তদানের তারিখ) [Optional/ঐচ্ছিক]
          ===================================================================== */}
      <div>
        <label className="block text-xs font-bold text-gray-800 mb-1 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-rose-600" />
          <span>শেষ রক্তদানের তারিখ (ঐচ্ছিক)</span>
        </label>
        <input
          type="date"
          value={lastDonationDate}
          onChange={(e) => setLastDonationDate(e.target.value)}
          className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:border-rose-600 focus:outline-none"
          id="input-donor-last-donation-date"
        />
        <p className="text-[10.5px] text-stone-500 mt-0.5">
          পূর্বে রক্ত দিয়ে থাকলে তারিখ নির্বাচন করুন; নতুন রক্তদাতা হলে খালি রাখুন।
        </p>
      </div>

      {/* =====================================================================
          PASSWORD FIELDS: Two Password Fields near bottom before submission
          - পাসওয়ার্ড
          - পাসওয়ার্ড নিশ্চিত করুন
          ===================================================================== */}
      <div className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-100 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-950">
          <Lock className="w-3.5 h-3.5 text-rose-600" />
          <span>লগইন ও প্রোফাইল পাসওয়ার্ড সেটিংস</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">
              পাসওয়ার্ড <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="কমপক্ষে ৪ অক্ষর"
                className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:border-rose-600 focus:outline-none font-mono"
                id="input-donor-password"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">
              পাসওয়ার্ড নিশ্চিত করুন <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={4}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="পুনরায় একই পাসওয়ার্ড দিন"
                className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:border-rose-600 focus:outline-none font-mono"
                id="input-donor-confirm-password"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          CONSENT CHECKBOX: ONLY ONE CHECKBOX
          "আমি স্বেচ্ছায় ও বিনামূল্যে মানবিক কারণে জরুরি রক্তের প্রয়োজনের জন্য ঝাদিমাদি মানবিক রক্তদান নেটওয়ার্কে যুক্ত হচ্ছি।"
          (All extra checkboxes and AI search info removed)
          ===================================================================== */}
      <div className="p-3 bg-white border border-gray-200 rounded-2xl">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            required
            checked={consentAgreed}
            onChange={(e) => setConsentAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300 cursor-pointer"
            id="check-donor-consent"
          />
          <span className="text-xs text-gray-800 leading-relaxed font-semibold">
            আমি স্বেচ্ছায় ও বিনামূল্যে মানবিক কারণে জরুরি রক্তের প্রয়োজনের জন্য ঝাদিমাদি মানবিক রক্তদান নেটওয়ার্কে যুক্ত হচ্ছি।
          </span>
        </label>
      </div>

      {/* =====================================================================
          FORM BUTTONS: "রেজিস্ট্রেশন করুন" (Submit) and "বাতিল" (Cancel)
          ===================================================================== */}
      <div className="pt-2 flex items-center gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-1/3 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm rounded-2xl transition cursor-pointer"
            id="btn-donor-cancel"
          >
            বাতিল
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm py-3 px-5 rounded-2xl shadow-md transition cursor-pointer disabled:opacity-50"
          id="btn-donor-submit"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>রেজিস্ট্রেশন হচ্ছে...</span>
            </>
          ) : (
            <>
              <Heart className="w-4 h-4 fill-white" />
              <span>রেজিস্ট্রেশন করুন</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default BloodDonorRegistrationForm;
