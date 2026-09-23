import React, { useState } from 'react';
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  MoveUp, 
  MoveDown,
  Layout,
  Tag,
  Link2,
  X,
  UploadCloud,
  Check,
  FolderOpen,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useData, AdminBanner } from '../../context/DataContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { databaseService } from '../../services/databaseService';
import { ImageUploadField } from './ImageUploadField';
import { AdminUploadForm } from './AdminUploadForm';
import { resilientSupabaseUpsert, resilientSupabaseDelete, saveBannerToPlatformBanners } from '../../services/supabaseDbHelper';
import { SupabaseMediaPickerModal } from './SupabaseMediaPickerModal';

interface AdminBannersTabProps {
  initialImageUrl?: string;
  onClearInitialImage?: () => void;
}

export const AdminBannersTab: React.FC<AdminBannersTabProps> = ({
  initialImageUrl,
  onClearInitialImage
}) => {
  const { 
    banners: contextBanners, 
    setBanners: setContextBanners, 
    addBanner, 
    updateBanner, 
    deleteBanner, 
    toggleBannerStatus 
  } = useData();

  // Local component state for banners to guarantee instantaneous UI responsiveness and retention
  const [banners, setBanners] = useState<AdminBanner[]>(() => (Array.isArray(contextBanners) ? [...contextBanners] : []));
  const [isFetchingBanners, setIsFetchingBanners] = useState(false);

  // Dedicated fetch handler for banners that preserves locally added banners
  const fetchBanners = React.useCallback(async () => {
    setIsFetchingBanners(true);
    try {
      const fetched = await databaseService.fetchBanners();
      if (Array.isArray(fetched) && fetched.length > 0) {
        setBanners(prev => {
          const merged = [...fetched];
          for (const local of prev) {
            if (!merged.some(b => b.id === local.id || (b.title === local.title && (b.image_url === local.image_url || b.imageUrl === local.imageUrl)))) {
              merged.push(local);
            }
          }
          merged.sort((a, b) => (Number(a.sort_order ?? a.order ?? 0)) - (Number(b.sort_order ?? b.order ?? 0)));
          return merged;
        });
        setContextBanners(prev => {
          const merged = [...fetched];
          for (const local of prev) {
            if (!merged.some(b => b.id === local.id)) {
              merged.push(local);
            }
          }
          merged.sort((a, b) => (Number(a.sort_order ?? a.order ?? 0)) - (Number(b.sort_order ?? b.order ?? 0)));
          return merged;
        });
      }
    } catch (err) {
      console.warn('[AdminBannersTab] fetchBanners error:', err);
    } finally {
      setIsFetchingBanners(false);
    }
  }, [setContextBanners]);

  // Synchronize local state with context updates without wiping out newly added banners
  React.useEffect(() => {
    if (Array.isArray(contextBanners) && contextBanners.length > 0) {
      setBanners(prev => {
        const merged = [...contextBanners];
        for (const local of prev) {
          if (!merged.some(b => b.id === local.id)) {
            merged.push(local);
          }
        }
        merged.sort((a, b) => (Number(a.sort_order ?? a.order ?? 0)) - (Number(b.sort_order ?? b.order ?? 0)));
        return merged;
      });
    }
  }, [contextBanners]);

  // Initial fetch on component mount
  React.useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDirectBannerModal, setShowDirectBannerModal] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [placementFilter, setPlacementFilter] = useState<string>('all');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    badge: 'স্পেশাল অফার',
    placement: 'হোমপেজ হিরো স্লাইডার',
    target_link: '',
    sort_order: 1,
    is_active: true,
    image_url: ''
  });

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Handle incoming image from Media Gallery
  React.useEffect(() => {
    if (initialImageUrl && initialImageUrl.trim()) {
      setEditingBanner(null);
      setFormData({
        title: '',
        subtitle: '',
        badge: 'স্পেশাল অফার',
        placement: 'হোমপেজ হিরো স্লাইডার',
        target_link: '',
        sort_order: (banners || []).length + 1,
        is_active: true,
        image_url: initialImageUrl.trim()
      });
      setIsModalOpen(true);
      if (onClearInitialImage) {
        onClearInitialImage();
      }
    }
  }, [initialImageUrl]);

  const presetImages = [
    { label: 'অর্গানিক ফ্রুটস', url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1200&q=80' },
    { label: 'মার্কেটপ্লেস সমাহার', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80' },
    { label: 'তাঁত ও হস্তশিল্প', url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80' },
    { label: 'রক্তদান ও জরুরি', url: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=1200&q=80' },
    { label: 'পাহাড়ি মধু ও মশলা', url: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=1200&q=80' },
    { label: 'চান্দের গাড়ি সাজেক', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80' }
  ];

  // SUPABASE STORAGE BUCKET UPLOAD:
  // When a user selects an image file in the Admin Banner Form, upload it directly to Supabase Storage Bucket banners.
  // Retrieve the public URL from supabase.storage.from('banners').getPublicUrl(filename) and set it as image_url.
  // Fallback to base64 or direct URL if bucket upload encounters an error.
  const handleBannerImageUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingImage(true);
    setImageUploadError(null);

    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
      const filename = `banner_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${safeExt}`;

      // 1. Upload directly to Supabase Storage Bucket 'banners'
      const { data: uploadData, error: bucketError } = await supabase.storage
        .from('banners')
        .upload(filename, file, {
          cacheControl: '31536000',
          upsert: true,
          contentType: file.type || 'image/jpeg'
        });

      if (!bucketError && uploadData) {
        // 2. Retrieve public URL
        const { data: urlData } = supabase.storage
          .from('banners')
          .getPublicUrl(filename);

        const publicUrl = urlData?.publicUrl;
        if (publicUrl) {
          setFormData(prev => ({ ...prev, image_url: publicUrl }));
          setIsUploadingImage(false);
          return;
        }
      }

      // 3. Fallback to base64 or direct URL if bucket upload encounters an error
      console.warn('[AdminBannersTab] Storage bucket upload error or publicUrl empty, falling back to base64:', bucketError);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (base64) {
          setFormData(prev => ({ ...prev, image_url: base64 }));
        }
        setIsUploadingImage(false);
      };
      reader.onerror = () => {
        setImageUploadError('ছবি প্রসেসিং করতে ত্রুটি হয়েছে');
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('[AdminBannersTab] Image file upload error, falling back to base64:', err);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (base64) {
          setFormData(prev => ({ ...prev, image_url: base64 }));
        }
        setIsUploadingImage(false);
      };
      reader.onerror = () => {
        setImageUploadError('ছবি প্রসেসিং করতে ত্রুটি হয়েছে');
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenAdd = () => {
    setEditingBanner(null);
    setFormData({
      title: '',
      subtitle: '',
      badge: 'স্পেশাল অফার',
      placement: 'হোমপেজ হিরো স্লাইডার',
      target_link: '',
      sort_order: (banners || []).length + 1,
      is_active: true,
      image_url: ''
    });
    setImageUploadError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (banner: AdminBanner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      badge: banner.badge || banner.tag || 'স্পেশাল অফার',
      placement: banner.placement || 'হোমপেজ হিরো স্লাইডার',
      target_link: banner.target_link || banner.targetLink || banner.link_url || banner.linkUrl || '',
      sort_order: Number(banner.sort_order ?? banner.order ?? 1),
      is_active: banner.is_active !== false && banner.isActive !== false,
      image_url: banner.image_url || banner.imageUrl || (banner as any).image || ''
    });
    setImageUploadError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.image_url) {
      alert('অনুগ্রহ করে ব্যানারের শিরোনাম ও ছবির লিঙ্ক প্রদান করুন');
      return;
    }

    const imageUrl = formData.image_url;

    // EXACT MAPPING FOR banners TABLE:
    // Map the payload precisely to match the banners schema:
    const bannerPayload = {
      title: String(formData.title || ''),
      subtitle: String(formData.subtitle || ''),
      image_url: String(imageUrl || formData.image_url || ''),
      badge: String(formData.badge || 'স্পেশাল অফার'),
      placement: String(formData.placement || 'হোমপেজ হিরো স্লাইডার'),
      target_link: String(formData.target_link || ''),
      sort_order: Number(formData.sort_order) || 1,
      is_active: Boolean(formData.is_active ?? true)
    };

    try {
      setIsSubmitting(true);
      let insertedId: string | undefined = undefined;

      if (editingBanner && editingBanner.id) {
        // Update existing banner
        const isNum = !isNaN(Number(editingBanner.id)) && Number(editingBanner.id) > 0;
        const query = isNum
          ? supabase.from('banners').update(bannerPayload).eq('id', Number(editingBanner.id))
          : supabase.from('banners').update(bannerPayload).eq('id', editingBanner.id);
        const { error: updErr } = await query;
        if (updErr) {
          // If column mismatch in legacy schema, retry with legacy column names
          if (updErr.message?.includes('column') || updErr.code === '42703') {
            const fallbackPayload = {
              title: bannerPayload.title,
              subtitle: bannerPayload.subtitle,
              image_url: bannerPayload.image_url,
              tag: bannerPayload.badge,
              placement: bannerPayload.placement,
              target_link: bannerPayload.target_link,
              display_order: bannerPayload.sort_order,
              is_active: bannerPayload.is_active
            };
            const fbQuery = isNum
              ? supabase.from('banners').update(fallbackPayload).eq('id', Number(editingBanner.id))
              : supabase.from('banners').update(fallbackPayload).eq('id', editingBanner.id);
            const { error: fbErr } = await fbQuery;
            if (fbErr) throw fbErr;
          } else {
            throw updErr;
          }
        }
        insertedId = editingBanner.id;
      } else {
        // Insert directly using: await supabase.from('banners').insert([bannerPayload]);
        const { data: insData, error: insErr } = await supabase.from('banners').insert([bannerPayload]).select();
        if (insErr) {
          // Fallback if legacy table without 'badge' or 'sort_order' columns
          if (insErr.message?.includes('column') || insErr.code === '42703') {
            const fallbackPayload = {
              title: bannerPayload.title,
              subtitle: bannerPayload.subtitle,
              image_url: bannerPayload.image_url,
              tag: bannerPayload.badge,
              placement: bannerPayload.placement,
              target_link: bannerPayload.target_link,
              display_order: bannerPayload.sort_order,
              is_active: bannerPayload.is_active
            };
            const { data: fbData, error: fbErr } = await supabase.from('banners').insert([fallbackPayload]).select();
            if (fbErr) throw fbErr;
            if (fbData && fbData[0]?.id) {
              insertedId = String(fbData[0].id);
            }
          } else {
            throw insErr;
          }
        } else if (insData && insData[0]?.id) {
          insertedId = String(insData[0].id);
        }
      }

      // ALERT: Wrap in try-catch and alert ✅ ব্যানার সফলভাবে সেভ হয়েছে! on success
      alert('✅ ব্যানার সফলভাবে সেভ হয়েছে!');

      // Synchronize local, context & database state
      const generatedId = insertedId || (editingBanner ? editingBanner.id : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'banner_' + Date.now()));

      const finalBanner: AdminBanner = {
        id: generatedId,
        title: bannerPayload.title,
        subtitle: bannerPayload.subtitle,
        badge: bannerPayload.badge,
        tag: bannerPayload.badge,
        placement: bannerPayload.placement,
        target_link: bannerPayload.target_link,
        targetLink: bannerPayload.target_link,
        link_url: bannerPayload.target_link,
        linkUrl: bannerPayload.target_link,
        sort_order: bannerPayload.sort_order,
        order: bannerPayload.sort_order,
        displayOrder: bannerPayload.sort_order,
        is_active: bannerPayload.is_active,
        isActive: bannerPayload.is_active,
        image_url: bannerPayload.image_url,
        imageUrl: bannerPayload.image_url,
        image: bannerPayload.image_url,
        createdAt: new Date().toISOString().split('T')[0]
      };

      if (editingBanner) {
        setBanners(prev => prev.map(b => b.id === editingBanner.id ? finalBanner : b));
        setContextBanners(prev => prev.map(b => b.id === editingBanner.id ? finalBanner : b));
        await updateBanner(editingBanner.id, finalBanner);
        setBrokenImages(prev => {
          const next = { ...prev };
          delete next[editingBanner.id];
          return next;
        });
      } else {
        setBanners(prev => [finalBanner, ...prev.filter(b => b.id !== generatedId)]);
        setContextBanners(prev => [finalBanner, ...prev.filter(b => b.id !== generatedId)]);
        addBanner(finalBanner);
      }

      // REFRESH: Reload banners from database
      try {
        await fetchBanners();
      } catch (_) {}

      databaseService.notifyEntityChange('banners');
      setIsModalOpen(false);
      setEditingBanner(null);
      setFormData({
        title: '',
        subtitle: '',
        badge: 'স্পেশাল অফার',
        placement: 'হোমপেজ হিরো স্লাইডার',
        target_link: '',
        sort_order: 1,
        is_active: true,
        image_url: ''
      });
    } catch (err: any) {
      console.error('[AdminBannersTab] Save banner error:', err);
      alert(`ব্যানার সংরক্ষণ করতে সমস্যা হয়েছে: ${err?.message || err || 'অজানা ত্রুটি'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Synchronous status toggle helper updating both local and context state
  const handleToggleStatus = (id: string) => {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, isActive: !(b.isActive !== false && b.is_active !== false), is_active: !(b.isActive !== false && b.is_active !== false) } : b));
    setContextBanners(prev => prev.map(b => b.id === id ? { ...b, isActive: !(b.isActive !== false && b.is_active !== false), is_active: !(b.isActive !== false && b.is_active !== false) } : b));
    toggleBannerStatus(id);
  };

  // Synchronous order update helper updating both local and context state
  const handleUpdateOrder = (id: string, newOrder: number) => {
    const validOrder = Math.max(1, newOrder);
    setBanners(prev => prev.map(b => b.id === id ? { ...b, order: validOrder, sort_order: validOrder, displayOrder: validOrder } : b));
    setContextBanners(prev => prev.map(b => b.id === id ? { ...b, order: validOrder, sort_order: validOrder, displayOrder: validOrder } : b));
    updateBanner(id, { order: validOrder, sort_order: validOrder, displayOrder: validOrder });
  };

  // Dedicated Delete Banner Handler targeting Supabase 'platform_banners' table exclusively
  const handleDeleteBanner = async (idToDelete: string, title?: string) => {
    if (!idToDelete) {
      console.warn("Delete aborted: missing banner ID");
      return;
    }

    if (!window.confirm(`আপনি কি '${title || 'এই'}' ব্যানারটি স্থায়ীভাবে মুছে ফেলতে চান?`)) {
      return;
    }

    // 1. Delete directly from Supabase ('banners' primary, 'platform_banners' fallback)
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('banners')
          .delete()
          .eq('id', idToDelete);

        if (!isNaN(Number(idToDelete)) && Number(idToDelete) > 0) {
          await supabase.from('banners').delete().eq('id', Number(idToDelete));
        }

        // Also clean up from platform_banners if exists
        await supabase
          .from('platform_banners')
          .delete()
          .eq('id', idToDelete);

        if (!isNaN(Number(idToDelete)) && Number(idToDelete) > 0) {
          await supabase.from('platform_banners').delete().eq('id', Number(idToDelete));
        }
      } catch (err) {
        console.warn('Failed to delete from banners table:', err);
      }
    }

    // 2. Remove matching item from local React state immediately
    setBanners((prevBanners) => prevBanners.filter((banner) => banner.id && banner.id !== idToDelete));
    setContextBanners((prevBanners) => prevBanners.filter((banner) => banner.id && banner.id !== idToDelete));

    // 3. Complete backend service sync
    try {
      await deleteBanner(idToDelete);
    } catch (err) {
      console.warn("Failed to delete banner from local service:", err);
    }
  };

  // Filter out corrupted rows and empty dummy entries, mapping both image_url and image
  const filteredBanners = (banners || [])
    .filter(b => {
      if (!b || !b.id) return false;
      const hasTitle = Boolean(b.title && b.title.trim());
      const img = b.imageUrl || b.image_url || (b as any).image || '';
      const hasImage = Boolean(img && img.trim());
      // Corrupt row if both title and image are missing
      if (!hasTitle && !hasImage) return false;
      if (placementFilter === 'all') return true;
      return b.placement === placementFilter;
    })
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  const activeHeroBanners = (banners || []).filter(b => {
    if (!b || !b.id || b.isActive === false) return false;
    const img = b.imageUrl || b.image_url || (b as any).image || '';
    if (!img || !img.trim() || brokenImages[b.id]) return false;
    return !b.placement || b.placement === 'homepage_hero';
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto" id="admin-banners-tab">
      
      {/* Top Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                ব্যানার ও বিজ্ঞাপন স্লাইডার কন্ট্রোল
              </h1>
              <p className="text-xs text-slate-500">
                হোমপেজ প্রোমোশনাল ব্যানার, স্পেশাল ক্যাম্পেইন ও বিজ্ঞাপন স্লাইডার ম্যানেজ করুন
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fetchBanners()}
            disabled={isFetchingBanners}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="ব্যানার তালিকা রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBanners ? 'animate-spin text-emerald-600' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDirectBannerModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer"
            title="কম্পিউটার থেকে সরাসরি Supabase Storage-এ ব্যানার আপলোড করুন"
          >
            <UploadCloud className="w-4 h-4" />
            <span>সরাসরি ব্যানার আপলোড</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন ব্যানার যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* DIRECT SUPABASE STORAGE BANNER UPLOAD MODAL */}
      {showDirectBannerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-600" />
                সরাসরি Supabase Storage ব্যানার আপলোডার
              </h2>
              <button
                type="button"
                onClick={() => setShowDirectBannerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <AdminUploadForm
              mode="banner"
              onUploadSuccess={(url) => {
                setShowDirectBannerModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Live Interactive Hero Slider Preview on Top */}
      {activeHeroBanners.length > 0 && (
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 text-white space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> হোমপেজ লাইভ স্লাইডার প্রিভিউ (Live Mobile/Web Preview)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              সক্রিয় ব্যানার: {activeHeroBanners.length}টি
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden aspect-[21/9] sm:aspect-[24/8] max-h-56 bg-slate-900 border border-slate-700">
            {activeHeroBanners[activePreviewIndex] && (
              <div className="relative w-full h-full bg-slate-900">
                <img 
                  src={activeHeroBanners[activePreviewIndex].imageUrl} 
                  alt={activeHeroBanners[activePreviewIndex].title}
                  className="w-full h-full object-cover brightness-75 bg-slate-900"
                  style={{ objectFit: 'cover' }}
                  data-banner-image="true"
                  onError={() => {
                    setBrokenImages(prev => ({ ...prev, [activeHeroBanners[activePreviewIndex].id]: true }));
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-4 sm:p-6">
                  <span className="inline-block self-start bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full mb-1.5">
                    {activeHeroBanners[activePreviewIndex].tag}
                  </span>
                  <h2 className="text-base sm:text-xl font-black text-white drop-shadow">
                    {activeHeroBanners[activePreviewIndex].title}
                  </h2>
                  <p className="text-xs text-slate-200 line-clamp-1 max-w-xl">
                    {activeHeroBanners[activePreviewIndex].subtitle}
                  </p>
                </div>
              </div>
            )}

            {/* Slider Dots */}
            <div className="absolute bottom-2.5 right-4 flex items-center gap-1.5 z-10">
              {activeHeroBanners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePreviewIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    activePreviewIndex === idx ? 'w-6 bg-emerald-400' : 'w-2 bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
        {[
          { id: 'all', label: 'সব ব্যানার' },
          { id: 'homepage_hero', label: 'হোমপেজ হিরো স্লাইডার' },
          { id: 'directory_top', label: 'ডিরেক্টরি হেডার' },
          { id: 'vendor_spotlight', label: 'উদ্যোক্তা স্পটলাইট' },
          { id: 'popup_ad', label: 'পপ-আপ বিজ্ঞাপন' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setPlacementFilter(tab.id)}
            className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
              placementFilter === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Banners Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBanners.map(banner => (
          <div 
            key={banner.id} 
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              {/* Thumbnail with overlay tags or Re-upload image option */}
              <div className="relative aspect-[16/7] w-full bg-slate-900 overflow-hidden">
                {(() => {
                  const bannerImg = (banner.imageUrl || banner.image_url || (banner as any).image || '').trim();
                  if (!bannerImg || brokenImages[banner.id]) {
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-900 border-b border-slate-800">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="text-amber-400 text-[11px] font-bold flex items-center gap-1.5 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-800/60">
                            <ImageIcon className="w-3.5 h-3.5" />
                            ছবি পাওয়া যায়নি বা নষ্ট (Missing Image)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(banner)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>ছবি পুনরায় আপলোড / পরিবর্তন</span>
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <>
                      <img 
                        src={bannerImg} 
                        alt={banner.title}
                        className={`w-full h-full object-cover bg-slate-900 ${!banner.isActive ? 'grayscale opacity-60' : ''}`}
                        style={{ objectFit: 'cover' }}
                        data-banner-image="true"
                        onError={() => {
                          setBrokenImages(prev => ({ ...prev, [banner.id]: true }));
                        }}
                      />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-700">
                          অর্ডার: #{banner.sort_order ?? banner.order}
                        </span>
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">
                          {banner.badge || banner.tag || 'অফার'}
                        </span>
                      </div>
                    </>
                  );
                })()}

                <div className="absolute top-2.5 right-2.5">
                  <button
                    onClick={() => toggleBannerStatus(banner.id)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
                      (banner.is_active !== false && banner.isActive !== false)
                        ? 'bg-emerald-500 text-white shadow-sm' 
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {(banner.is_active !== false && banner.isActive !== false) ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{(banner.is_active !== false && banner.isActive !== false) ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-slate-500 flex items-center gap-1">
                    <Layout className="w-3.5 h-3.5" />
                    {banner.placement || 'হোমপেজ হিরো স্লাইডার'}
                  </span>
                  <span className="font-mono text-[10px]">{banner.createdAt}</span>
                </div>

                <h3 className="text-sm font-black text-slate-900 leading-snug">
                  {banner.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {banner.subtitle}
                </p>

                <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1 font-mono">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>লিঙ্ক: {banner.target_link || banner.targetLink || 'ডিফল্ট'}</span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateBanner(banner.id, { order: Math.max(1, banner.order - 1) })}
                  className="p-1.5 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-lg cursor-pointer transition"
                  title="উপরে নিন"
                >
                  <MoveUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => updateBanner(banner.id, { order: banner.order + 1 })}
                  className="p-1.5 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-lg cursor-pointer transition"
                  title="নিচে নিন"
                >
                  <MoveDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(banner)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>এডিট</span>
                </button>
                <button
                  onClick={() => handleDeleteBanner(banner.id, banner.title)}
                  className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl cursor-pointer transition"
                  title="মুছে ফেলুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Add / Edit Banner Enlarged Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-xs">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {editingBanner ? 'ব্যানার সম্পাদনা ও লাইভ প্রিভিউ' : 'নতুন ব্যানার তৈরি করুন'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    পিসি থেকে ছবি আপলোড করুন এবং হোমপেজ বা অ্যাপ স্লাইডারের জন্য ব্যানার কনফিগার করুন
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 text-xs font-bold">
              
              {/* 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Form Controls (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label className="text-slate-700 block mb-1.5 font-bold">ব্যানার শিরোনাম (Title): *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="যেমন: পাহাড়ি অর্গানিক ফ্রুটস ও জুম ফসল"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1.5 font-bold">সাবটাইটেল / বিবরণ:</label>
                    <textarea 
                      rows={2}
                      placeholder="যেমন: রাসায়নিক ও কীটনাশক মুক্ত ১০০% সতেজ পাহাড়ি ফলমূল সরাসরি বাগান থেকে"
                      value={formData.subtitle}
                      onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-700 block mb-1.5 font-bold">ট্যাগ / ব্যাজ (Badge):</label>
                      <input 
                        type="text" 
                        placeholder="যেমন: স্পেশাল অফার, AI Powered"
                        value={formData.badge}
                        onChange={e => setFormData({ ...formData, badge: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 block mb-1.5 font-bold">ডিসপ্লে পজিশন (Placement):</label>
                      <select
                        value={formData.placement}
                        onChange={e => setFormData({ ...formData, placement: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-emerald-500 font-semibold bg-white cursor-pointer"
                      >
                        <option value="হোমপেজ হিরো স্লাইডার">হোমপেজ হিরো স্লাইডার</option>
                        <option value="ডিরেক্টরি হেডার">ডিরেক্টরি হেডার</option>
                        <option value="উদ্যোক্তা স্পটলাইট">উদ্যোক্তা স্পটলাইট</option>
                        <option value="পপ-আপ বিজ্ঞাপন">পপ-আপ বিজ্ঞাপন</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-700 block mb-1.5 font-bold">ক্লিক টার্গেট লিংক (Target Link):</label>
                      <input 
                        type="text" 
                        placeholder="যেমন: home, auto_directory, /products"
                        value={formData.target_link}
                        onChange={e => setFormData({ ...formData, target_link: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-emerald-500 font-semibold"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {['home', 'services', 'auto_directory', 'track_a_vendor', 'track_b_freelancer'].map(quickLink => (
                          <button
                            key={quickLink}
                            type="button"
                            onClick={() => setFormData({ ...formData, target_link: quickLink })}
                            className={`px-2 py-0.5 text-[10px] rounded-md border cursor-pointer transition ${formData.target_link === quickLink ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                          >
                            {quickLink}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-700 block mb-1.5 font-bold">ক্রম নম্বর (Sort Order):</label>
                      <input 
                        type="number" 
                        min={1}
                        value={formData.sort_order}
                        onChange={e => setFormData({ ...formData, sort_order: Number(e.target.value) || 1 })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-emerald-500 font-semibold"
                      />
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-2.5 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <input 
                      type="checkbox" 
                      id="banner-is-active"
                      checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                    />
                    <label htmlFor="banner-is-active" className="text-slate-700 cursor-pointer font-bold text-xs select-none">
                      তাত্ক্ষণিকভাবে হোমপেজ ও অ্যাপে প্রদর্শন (Active) চালু রাখুন
                    </label>
                  </div>
                </div>

                {/* Right Column: Direct Supabase Storage Image Upload & Live Preview (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-slate-700 font-bold text-xs flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-emerald-600" />
                      <span>ব্যানার ছবি (Supabase Storage 'banners' বাকেট):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMediaPickerOpen(true)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold border border-emerald-200 transition flex items-center gap-1 cursor-pointer"
                      title="স্টোরেজ বাকেট গ্যালারি থেকে সরাসরি ছবি বাছুন"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>গ্যালারি / বাকেট</span>
                    </button>
                  </div>

                  {/* Direct File Picker with Auto-Upload to Supabase Storage 'banners' */}
                  <div className="p-3.5 bg-slate-50 border-2 border-dashed border-emerald-200 hover:border-emerald-400 rounded-2xl transition space-y-2.5 text-center">
                    <input 
                      type="file" 
                      id="banner-file-input"
                      accept="image/*"
                      disabled={isUploadingImage}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleBannerImageUpload(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <label 
                      htmlFor="banner-file-input"
                      className="cursor-pointer flex flex-col items-center justify-center gap-1.5 text-slate-600 hover:text-emerald-700"
                    >
                      {isUploadingImage ? (
                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs py-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>সুপাবেস 'banners' বাকেটে ছবি আপলোড হচ্ছে...</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            ছবি ফাইল সিলেক্ট করুন (PC / মোবাইল থেকে)
                          </span>
                          <span className="text-[10px] text-slate-500">
                            স্বয়ংক্রিয়ভাবে Supabase Storage 'banners' বাকেটে সেভ হবে (JPG, PNG, WebP)
                          </span>
                        </>
                      )}
                    </label>

                    {imageUploadError && (
                      <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                        {imageUploadError}
                      </p>
                    )}
                  </div>

                  {/* Manual URL Input or Auto-Filled Public URL */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                      <span>ছবির পাবলিক URL (সুপাবেস বাকেট বা ডিরেক্ট লিঙ্ক):</span>
                      {formData.image_url && (
                        <span className="text-[10px] text-emerald-600 font-medium">✓ লিঙ্ক সেট রয়েছে</span>
                      )}
                    </label>
                    <input 
                      type="text" 
                      placeholder="https://... অথবা উপরের ফাইল সিলেক্ট করুন"
                      value={formData.image_url}
                      onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:border-emerald-500 font-mono text-slate-700"
                    />
                  </div>

                  {/* Preset Banner Images */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      প্রস্তুতকৃত ব্যানার স্যাম্পল:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {presetImages.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData({ ...formData, image_url: preset.url })}
                          className={`px-2 py-1 text-[10px] rounded-lg border cursor-pointer transition ${formData.image_url === preset.url ? 'bg-emerald-600 text-white border-emerald-600 font-bold' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Mini Preview Box */}
                  {formData.image_url && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-500 block">লাইভ স্লাইডার লুক:</span>
                      <div className="relative h-28 sm:h-32 rounded-2xl overflow-hidden shadow-md border border-slate-200 group">
                        <img 
                          src={formData.image_url} 
                          alt="Banner Preview" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-3 flex flex-col justify-end text-white text-left">
                          <span className="inline-block self-start text-[9px] font-bold px-2 py-0.5 bg-emerald-500 text-white rounded-md mb-1 shadow-xs">
                            {formData.badge || 'অফার'}
                          </span>
                          <h4 className="text-xs font-black line-clamp-1 text-white">
                            {formData.title || 'ব্যানার শিরোনাম'}
                          </h4>
                          {formData.subtitle && (
                            <p className="text-[10px] text-slate-200 line-clamp-1 opacity-90 font-normal">
                              {formData.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer font-bold text-xs"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-md transition cursor-pointer font-black text-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingBanner ? 'ব্যানার আপডেট করুন' : 'নতুন ব্যানার পাবলিশ করুন'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Supabase Media Picker Modal for Banners */}
      <SupabaseMediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={(urls) => {
          if (urls && urls[0]) {
            setFormData(prev => ({ ...prev, imageUrl: urls[0], image_url: urls[0] }));
          }
          setIsMediaPickerOpen(false);
        }}
        allowMultiple={false}
        title="ব্যানারের ছবি নির্বাচন করুন (Supabase Storage বাকেট)"
      />

    </div>
  );
};
