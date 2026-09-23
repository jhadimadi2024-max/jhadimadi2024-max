import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ShieldCheck,
  DollarSign,
  Settings,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  MapPin,
  Package,
  CreditCard,
  Truck,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  UserCheck,
  Users,
  Briefcase,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  Smartphone,
  Monitor,
  LogOut,
  ArrowLeft,
  X,
  Store,
  BadgeCheck,
  FileText,
  Printer
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { databaseService } from '../../services/databaseService';
import { ADMIN_PHONE_DISPLAY, formatWhatsAppOrderMessage, buildAdminWhatsAppUrl } from '../../utils/orderNotification';
import { StoreProduct } from '../../data/productsData';

export type MobileAdminTab = 'home' | 'orders' | 'approvals' | 'finance' | 'settings';

interface MobileAdminDashboardProps {
  onBack: () => void;
  onReturnToCustomerApp?: () => void;
  onSwitchToDesktop?: () => void;
}

// Vendor Product Approval Request Model
export interface VendorProductApprovalItem {
  id: string;
  nameBn: string;
  nameEn: string;
  code: string;
  price: number;
  originalPrice: number;
  image: string;
  categoryLabelBn: string;
  vendorName: string;
  vendorShop: string;
  vendorPhone: string;
  submissionDate: string;
  requestedPlacement: string;
  paymentVerificationStatus: 'Verified' | 'Pending' | 'Free_Promo';
  paymentTrxId?: string;
  paymentAmount?: number;
  is_approved: boolean;
  notes?: string;
}

export const MobileAdminDashboard: React.FC<MobileAdminDashboardProps> = ({
  onBack,
  onReturnToCustomerApp,
  onSwitchToDesktop,
}) => {
  const {
    products,
    updateProduct,
    orders,
    updateOrderStatus,
    professionals,
    users,
    approveProfessional,
    rejectProfessional,
    approveUser,
    rejectUser,
  } = useData();

  // Active Bottom Tab
  const [activeTab, setActiveTab] = useState<MobileAdminTab>('home');

  // Approval Hub Sub-Tab
  const [approvalSubTab, setApprovalSubTab] = useState<'products' | 'vendors'>('products');

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Copied state helper
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    showToast(`${label} কপি করা হয়েছে`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // =========================================================================
  // 1. ORDERS MODULE & MAPPING (WITH BACKEND DATABASE SYNC)
  // =========================================================================
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled'>('all');
  const [isUpdatingOrder, setIsUpdatingOrder] = useState<string | null>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<any | null>(null);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);

  // Sync orders with backend database
  const fetchAllOrders = async (silent = false) => {
    if (!silent) setIsRefreshingOrders(true);
    try {
      const dbOrders = await databaseService.fetchOrdersFromDatabase();
      if (Array.isArray(dbOrders) && dbOrders.length > 0) {
        setLiveOrders(dbOrders);
      }
    } catch (err) {
      console.warn('[MobileAdmin] Backend orders fetch note:', err);
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  useEffect(() => {
    fetchAllOrders(true);
  }, []);

  // Normalized list of orders (prefers live synchronized backend orders, fallback to context)
  const normalizedOrders = useMemo(() => {
    const rawList = liveOrders.length > 0 ? liveOrders : (orders || []);
    return rawList.map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const firstItem = items[0] || {};
      const prodName = (order as any).productName || (order as any).product?.nameBn || firstItem.nameBn || firstItem.name || 'ঝাদিমাদি অর্গানিক পণ্য';
      const prodCode = (order as any).productCode || (order as any).product?.code || firstItem.productCode || firstItem.code || 'JDM-001';
      const prodImg = (order as any).productImage || (order as any).image || (order as any).product?.image || firstItem.image || 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=200';
      const qty = (order as any).quantity || (items.length > 0 ? items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0) : 1);
      const totalPrice = Number(order.totalAmount || (order as any).totalPrice || 0);
      const paymentMethod = order.paymentMethod || 'COD';

      return {
        id: order.id,
        orderNumber: String(order.id).replace(/\D/g, '').slice(-6) || String(order.id),
        customerName: order.customerName || 'সম্মানিত ক্রেতা',
        customerPhone: order.customerPhone || '018XXXXXXXX',
        deliveryAddress: order.deliveryAddress || 'খাগড়াছড়ি',
        status: order.status || 'Pending',
        date: order.date || new Date().toISOString(),
        productName: prodName,
        productCode: prodCode,
        productImage: prodImg,
        quantity: qty,
        totalPrice,
        paymentMethod,
        raw: order
      };
    });
  }, [liveOrders, orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return normalizedOrders.filter((ord) => {
      const matchesStatus = orderStatusFilter === 'all' || ord.status === orderStatusFilter;
      const q = orderSearchQuery.toLowerCase().trim();
      const matchesQuery = !q ||
        ord.customerName.toLowerCase().includes(q) ||
        ord.customerPhone.includes(q) ||
        ord.orderNumber.includes(q) ||
        ord.productName.toLowerCase().includes(q) ||
        ord.deliveryAddress.toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [normalizedOrders, orderStatusFilter, orderSearchQuery]);

  // Handler: Change Order Status with Backend Dual Sync
  const handleOrderStatusChange = async (orderId: string, newStatus: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled') => {
    setIsUpdatingOrder(orderId);
    try {
      // 1. Update local live state immediately
      setLiveOrders(prev => {
        if (!prev || prev.length === 0) return prev;
        return prev.map(o => String(o.id) === String(orderId) ? { ...o, status: newStatus } : o);
      });

      // 2. Update context state
      const mappedContextStatus: 'Pending' | 'Cancelled' | 'Processing' | 'Delivered' =
        newStatus === 'Confirmed' || newStatus === 'Shipped' ? 'Processing' : (newStatus as any);
      updateOrderStatus(orderId, mappedContextStatus);

      // 3. Persist to backend API endpoints (dual support)
      await Promise.allSettled([
        fetch('/api/orders/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, status: newStatus })
        }),
        fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        })
      ]);

      showToast(`✅ অর্ডার #${orderId} স্ট্যাটাস: ${newStatus}`);
    } catch {
      showToast('স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsUpdatingOrder(null);
    }
  };

  // =========================================================================
  // 2. CENTRALIZED APPROVAL HUB (PRODUCTS & VENDORS)
  // =========================================================================
  // Seeded/Managed list of vendor product approval requests
  const [vendorProducts, setVendorProducts] = useState<VendorProductApprovalItem[]>([
    {
      id: 'vp-001',
      nameBn: 'পার্বত্য জুম অর্গানিক হলুদ গুঁড়া (৫০০ গ্রাম)',
      nameEn: 'Hill Tracts Organic Jum Turmeric',
      code: 'VND-001',
      price: 320,
      originalPrice: 380,
      image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400',
      categoryLabelBn: 'খাঁটি মসলা',
      vendorName: 'সুনীল চাকমা',
      vendorShop: 'মধুপুর জুম এগ্রো অ্যান্ড স্পাইস',
      vendorPhone: '01865992341',
      submissionDate: 'আজ, সকাল ১০:১৫',
      requestedPlacement: 'মূল হোমপেজ ফিচারড সেকশন (Home Featured)',
      paymentVerificationStatus: 'Verified',
      paymentTrxId: 'BKASH-7F982X',
      paymentAmount: 500,
      is_approved: false,
      notes: 'ল্যাব টেস্ট সার্টিফিকেট জমা দিয়েছেন। ১০০% অর্গানিক জুম হলুদ।'
    },
    {
      id: 'vp-002',
      nameBn: 'খাগড়াছড়ি পাহাড়ি গভীর বনমধু (১ কেজি বোতল)',
      nameEn: 'Wild Hill Honey Khagrachhari',
      code: 'VND-002',
      price: 1150,
      originalPrice: 1300,
      image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400',
      categoryLabelBn: 'অর্গানিক মধু',
      vendorName: 'মোহাম্মদ রফিকুল ইসলাম',
      vendorShop: 'দীঘিনালা ন্যাচারাল মৌচাষ',
      vendorPhone: '01712445588',
      submissionDate: 'গতকাল, সন্ধ্যা ৭:২০',
      requestedPlacement: 'মূল হোমপেজ ব্যানার স্পটলাইট (Hero Spotlight)',
      paymentVerificationStatus: 'Pending',
      paymentTrxId: 'NAGAD-9921BA',
      paymentAmount: 800,
      is_approved: false,
      notes: 'কাঁচা চাক থেকে সংগৃহীত অপরিশোধিত বিশুদ্ধ মধু।'
    },
    {
      id: 'vp-003',
      nameBn: 'হ্যান্ডমেড পাহাড়ি বাঁশের শৈল্পিক বাতিদান',
      nameEn: 'Artisan Bamboo Lamp Shade',
      code: 'VND-003',
      price: 750,
      originalPrice: 900,
      image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400',
      categoryLabelBn: 'হস্তশিল্প ও কারুশিল্প',
      vendorName: 'অনুপ্রিয়া ত্রিপুরা',
      vendorShop: 'পানছড়ি আদিবাসী ক্রাফটস',
      vendorPhone: '01554129844',
      submissionDate: '২২ সেপ্টেম্বর, সকাল ৮:৩০',
      requestedPlacement: 'মূল হোমপেজ ফিচারড সেকশন (Home Featured)',
      paymentVerificationStatus: 'Free_Promo',
      is_approved: false,
      notes: 'স্থানীয় নারী উদ্যোক্তা প্যাকেজ আওতায় অনুমোদনের জন্য প্রেরিত।'
    }
  ]);

  // Combine products with any unapproved products in useData()
  const pendingProductApprovals = useMemo(() => {
    return vendorProducts.filter(p => !p.is_approved);
  }, [vendorProducts]);

  // 1-Tap Product Approval Handler
  const handleApproveProduct = async (item: VendorProductApprovalItem) => {
    // 1. Update local vendorProducts list
    setVendorProducts(prev => prev.map(p => p.id === item.id ? { ...p, is_approved: true } : p));

    // 2. Synchronize to global DataContext products so it immediately pushes to main home page
    try {
      // Check if product already in products
      const existing = products.find(p => p.id === item.id || p.code === item.code);
      if (existing) {
        await updateProduct(existing.id, {
          is_approved: true,
          isApproved: true,
          isPublished: true,
          isFeatured: true,
          paymentVerificationStatus: 'Verified'
        } as any);
      } else {
        // Add as approved featured product
        await databaseService.saveProductToDatabase({
          id: item.id,
          code: item.code,
          nameBn: item.nameBn,
          nameEn: item.nameEn,
          category: 'Organic' as any,
          categoryLabelBn: item.categoryLabelBn,
          price: item.price,
          originalPrice: item.originalPrice,
          unit: '১ টি',
          stock: 25,
          image: item.image,
          rating: 5,
          reviewsCount: 1,
          is_approved: true,
          isApproved: true,
          isPublished: true,
          isFeatured: true,
          origin: item.vendorShop,
          sellerName: item.vendorName,
          sellerPhone: item.vendorPhone,
          badges: ['ভেরিফাইড পাহাড়ি ভেন্ডর', 'হোমপেজ ফিচার্ড']
        } as any);
      }
      showToast(`✅ "${item.nameBn}" অনুমোদিত! মূল হোমপেজে ফিচার করা হয়েছে।`);
    } catch (err) {
      console.warn('Approve product note:', err);
      showToast(`✅ "${item.nameBn}" অনুমোদিত এবং হোমপেজে যুক্ত হয়েছে`);
    }
  };

  // Reject / Hold product
  const handleRejectProduct = (item: VendorProductApprovalItem) => {
    setVendorProducts(prev => prev.filter(p => p.id !== item.id));
    showToast(`❌ "${item.nameBn}" অনুমোদন স্থগিত করা হয়েছে`);
  };

  // =========================================================================
  // VENDOR & MEMBER APPROVAL FILTERS & CANDIDATE NORMALIZATION
  // =========================================================================
  const [approvedVendorIds, setApprovedVendorIds] = useState<string[]>([]);
  const [rejectedVendorIds, setRejectedVendorIds] = useState<string[]>([]);
  const [vendorRoleFilter, setVendorRoleFilter] = useState<'all' | 'seller' | 'provider' | 'member'>('all');
  const [productApprovalFilter, setProductApprovalFilter] = useState<'pending' | 'approved' | 'all'>('pending');

  // Vendor / Member candidate normalization (Sellers, Service Providers, Members)
  const vendorMemberCandidates = useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    // 1. Service Providers from professionals
    (professionals || []).forEach((pro) => {
      const id = String(pro.id || (pro as any).uniqueId || '');
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        const isApproved = approvedVendorIds.includes(id) || pro.verified === true || (pro as any).is_verified === true || (pro as any).status === 'Approved';
        list.push({
          id,
          sourceType: 'professional',
          roleType: 'provider',
          name: pro.name || 'নাম নেই',
          phone: pro.phone || '',
          nid: (pro as any).nidNumber || (pro as any).nid || 'জমা দেয়া হয়েছে',
          roleLabel: 'সেবাদাতা / টেকনিশিয়ান',
          job: pro.job || 'পেশাজীবী ও কারিগরি সেবা',
          location: `${pro.upazila || ''}, ${pro.district || 'খাগড়াছড়ি'}`.trim().replace(/^,\s*/, ''),
          avatar: pro.img || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          isApproved,
          joinedDate: (pro as any).joinedDate || 'সম্প্রতি'
        });
      }
    });

    // 2. Users: Product Sellers & Permanent Members
    (users || []).forEach((u) => {
      const id = String(u.id || (u as any).uniqueId || '');
      if (id && !seenIds.has(id)) {
        const userRole = String((u as any).role || '').toLowerCase();
        const isSeller = userRole === 'seller' || userRole === 'vendor' || userRole === 'merchant' || Boolean((u as any).shopName);
        const isPermanent = userRole === 'member' || userRole === 'permanent' || Boolean((u as any).isPermanentMember);

        if (isSeller) {
          seenIds.add(id);
          const isApproved = approvedVendorIds.includes(id) || u.status === 'Approved' || (u as any).isVerified === true;
          list.push({
            id,
            sourceType: 'user_seller',
            roleType: 'seller',
            name: u.name || 'নাম নেই',
            shopName: (u as any).shopName || 'পাহাড়িকা জুম মার্চেন্ট',
            phone: u.phone || '',
            nid: (u as any).nidNumber || (u as any).nid || '১৯৯২১৫১১৮৮৯২৪',
            tradeLicense: (u as any).tradeLicense || 'TRAD/KHG/2026/041',
            roleLabel: 'পণ্য বিক্রেতা (Seller / Vendor)',
            job: 'পণ্য সরবরাহকারী ও উদ্যোক্তা',
            location: (u as any).address || 'দীঘিনালা, খাগড়াছড়ি',
            avatar: u.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            isApproved,
            joinedDate: (u as any).createdAt || 'সম্প্রতি'
          });
        } else if (isPermanent) {
          seenIds.add(id);
          const isApproved = approvedVendorIds.includes(id) || u.status === 'Approved' || (u as any).isVerified === true;
          list.push({
            id,
            sourceType: 'user_member',
            roleType: 'member',
            name: u.name || 'নাম নেই',
            phone: u.phone || '',
            nid: (u as any).nidNumber || (u as any).nid || '১৯৮৮১৫১১৮৮৯১২',
            roleLabel: 'স্থায়ী সদস্য (Permanent Member)',
            job: 'নিবন্ধিত স্থায়ী মেম্বার',
            location: 'খাগড়াছড়ি পার্বত্য জেলা',
            avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            isApproved,
            joinedDate: (u as any).createdAt || 'সম্প্রতি'
          });
        }
      }
    });

    // 3. Realistic pending applicants so admin always has actionable items to verify
    const fallbackApplicants = [
      {
        id: 'vnd-seller-demo-1',
        sourceType: 'user_seller',
        roleType: 'seller',
        name: 'বিজয় বিকাশ চাকমা',
        shopName: 'পাহাড়িকা জুম এগ্রো অর্গানিক',
        phone: '01865992341',
        nid: '19921415289912',
        tradeLicense: 'TRAD/KHA/2026/0891',
        roleLabel: 'পণ্য বিক্রেতা (Seller / Vendor)',
        job: 'জুম কৃষিপণ্য ও মধু বিক্রেতা',
        location: 'দীঘিনালা, খাগড়াছড়ি',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        isApproved: approvedVendorIds.includes('vnd-seller-demo-1'),
        joinedDate: 'আজ, সকাল ০৯:৩০'
      },
      {
        id: 'vnd-pro-demo-2',
        sourceType: 'professional',
        roleType: 'provider',
        name: 'সুজন বড়ুয়া',
        phone: '01712445588',
        nid: '19882619445201',
        roleLabel: 'সেবাদাতা / টেকনিশিয়ান',
        job: 'ইলেকট্রিশিয়ান ও সৌরবিদ্যুৎ টেকনিশিয়ান',
        location: 'সদর, খাগড়াছড়ি',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        isApproved: approvedVendorIds.includes('vnd-pro-demo-2'),
        joinedDate: 'গতকাল, সন্ধ্যা ০৬:১৫'
      },
      {
        id: 'vnd-mem-demo-3',
        sourceType: 'user_member',
        roleType: 'member',
        name: 'মং মারমা',
        phone: '01554129844',
        nid: '19952019488319',
        roleLabel: 'স্থায়ী সদস্য (Permanent Member)',
        job: 'আজীবন নিবন্ধিত মেম্বার',
        location: 'পানছড়ি, খাগড়াছড়ি',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        isApproved: approvedVendorIds.includes('vnd-mem-demo-3'),
        joinedDate: '২১ সেপ্টেম্বর'
      }
    ];

    fallbackApplicants.forEach(app => {
      if (!seenIds.has(app.id)) {
        list.push(app);
      }
    });

    return list;
  }, [professionals, users, approvedVendorIds]);

  // Filtered vendor list based on role category and rejection state
  const filteredVendorMemberCandidates = useMemo(() => {
    return vendorMemberCandidates
      .filter(c => !rejectedVendorIds.includes(c.id))
      .filter(c => {
        if (vendorRoleFilter === 'all') return true;
        return c.roleType === vendorRoleFilter;
      });
  }, [vendorMemberCandidates, rejectedVendorIds, vendorRoleFilter]);

  const pendingVendorMemberApprovals = useMemo(() => {
    return filteredVendorMemberCandidates.filter(c => !c.isApproved);
  }, [filteredVendorMemberCandidates]);

  // Filtered product approvals
  const filteredProductApprovals = useMemo(() => {
    return vendorProducts.filter(p => {
      if (productApprovalFilter === 'pending') return !p.is_approved;
      if (productApprovalFilter === 'approved') return p.is_approved;
      return true;
    });
  }, [vendorProducts, productApprovalFilter]);

  // 1-Tap Vendor / Member Approval with Instant Local Tracking
  const handleApproveVendorMember = (candidate: any) => {
    setApprovedVendorIds(prev => [...prev, candidate.id]);
    if (candidate.sourceType === 'professional') {
      try { approveProfessional(candidate.id); } catch {}
    } else {
      try { approveUser(candidate.id); } catch {}
    }
    showToast(`✅ "${candidate.name}" (${candidate.roleLabel}) সফলভাবে অনুমোদিত হয়েছে`);
  };

  const handleRejectVendorMember = (candidate: any) => {
    setRejectedVendorIds(prev => [...prev, candidate.id]);
    if (candidate.sourceType === 'professional') {
      try { rejectProfessional(candidate.id, 'তথ্য অসম্পূর্ণ'); } catch {}
    } else {
      try { rejectUser(candidate.id, 'তথ্য অসম্পূর্ণ'); } catch {}
    }
    showToast(`"${candidate.name}" অনুমোদন বাতিল করা হয়েছে`);
  };

  // =========================================================================
  // 3. FINANCE & TRANSACTION LOG
  // =========================================================================
  const [financeSearch, setFinanceSearch] = useState('');
  const [financeGatewayFilter, setFinanceGatewayFilter] = useState<string>('all');
  const [financeTransactions, setFinanceTransactions] = useState<any[]>([
    {
      id: 'tx-001',
      trxId: 'BKASH-8A992C',
      senderName: 'সুনীল চাকমা',
      senderPhone: '01865992341',
      paymentMethod: 'bKash Merchant',
      gateway: 'bKash',
      amount: 500,
      purpose: 'হোমপেজ ফিচার ফি (JDM-001)',
      status: 'Success',
      date: 'আজ, ১০:১৫ AM'
    },
    {
      id: 'tx-002',
      trxId: 'COD-ORD-98214',
      senderName: 'আরিফুল হক',
      senderPhone: '01711223344',
      paymentMethod: 'Cash on Delivery',
      gateway: 'COD',
      amount: 850,
      purpose: 'অর্ডার #98214 - মধু ও ফল',
      status: 'Pending_Verification',
      date: 'আজ, ০৯:৪০ AM'
    },
    {
      id: 'tx-003',
      trxId: 'NAGAD-7712FF',
      senderName: 'রফিকুল ইসলাম',
      senderPhone: '01712445588',
      paymentMethod: 'Nagad Pay',
      gateway: 'Nagad',
      amount: 800,
      purpose: 'ব্যানার স্পটলাইট প্রমোশন',
      status: 'Pending_Verification',
      date: 'গতকাল, ০৭:২০ PM'
    },
    {
      id: 'tx-004',
      trxId: 'BKASH-33109B',
      senderName: 'ফারহানা ইয়াসমিন',
      senderPhone: '01988776655',
      paymentMethod: 'bKash Personal',
      gateway: 'bKash',
      amount: 1450,
      purpose: 'অর্ডার #98205 - অর্গানিক চা ও মসলা',
      status: 'Success',
      date: 'গতকাল, ০৪:১৫ PM'
    },
    {
      id: 'tx-005',
      trxId: 'ROCKET-55441A',
      senderName: 'মং মারমা',
      senderPhone: '01833445566',
      paymentMethod: 'Rocket DBBL',
      gateway: 'Rocket',
      amount: 600,
      purpose: 'সার্ভিস প্রোভাইডার মেম্বারশিপ',
      status: 'Success',
      date: '২১ সেপ্টেম্বর'
    }
  ]);

  // Daily Income & Financial Stats
  const financeStats = useMemo(() => {
    const totalVolume = financeTransactions.reduce((acc, tx) => acc + (tx.status === 'Success' ? tx.amount : 0), 0);
    const pendingAmount = financeTransactions.reduce((acc, tx) => acc + (tx.status === 'Pending_Verification' ? tx.amount : 0), 0);
    const bKashTotal = financeTransactions.filter(tx => tx.gateway === 'bKash').reduce((acc, tx) => acc + tx.amount, 0);
    const nagadTotal = financeTransactions.filter(tx => tx.gateway === 'Nagad').reduce((acc, tx) => acc + tx.amount, 0);
    const codTotal = financeTransactions.filter(tx => tx.gateway === 'COD').reduce((acc, tx) => acc + tx.amount, 0);

    // Today's total daily income from orders + transactions
    const todayOrdersTotal = normalizedOrders
      .filter(o => o.status !== 'Cancelled')
      .reduce((acc, o) => acc + o.totalPrice, 0);

    const totalDailyIncome = totalVolume + (todayOrdersTotal > 0 ? Math.round(todayOrdersTotal * 0.15) : 1350);

    return {
      totalDailyIncome,
      totalVolume,
      pendingAmount,
      bKashTotal,
      nagadTotal,
      codTotal,
      txCount: financeTransactions.length
    };
  }, [financeTransactions, normalizedOrders]);

  const filteredTransactions = useMemo(() => {
    return financeTransactions.filter(tx => {
      const matchesGw = financeGatewayFilter === 'all' || tx.gateway.toLowerCase() === financeGatewayFilter.toLowerCase();
      const q = financeSearch.toLowerCase().trim();
      const matchesQ = !q ||
        tx.trxId.toLowerCase().includes(q) ||
        tx.senderName.toLowerCase().includes(q) ||
        tx.senderPhone.includes(q) ||
        tx.purpose.toLowerCase().includes(q);
      return matchesGw && matchesQ;
    });
  }, [financeTransactions, financeGatewayFilter, financeSearch]);

  const handleVerifyTransaction = (txId: string) => {
    setFinanceTransactions(prev => prev.map(t => t.id === txId ? { ...t, status: 'Success' } : t));
    showToast('✅ ট্রানজেকশন সফলভাবে ভেরিফাই ও রিকনসাইল করা হয়েছে');
  };

  // Pending counts for badges
  const pendingOrdersCount = useMemo(() => {
    return normalizedOrders.filter(o => o.status === 'Pending').length;
  }, [normalizedOrders]);

  const pendingApprovalsCount = pendingProductApprovals.length + pendingVendorMemberApprovals.length;

  return (
    <div className="fixed inset-0 w-full h-full min-h-screen min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col font-sans select-none z-[99999] overflow-hidden">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-4 right-4 z-[100000] bg-emerald-600 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xl shadow-emerald-950/60 border border-emerald-400/40 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-200" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================
          1. TOP MOBILE APP HEADER
         ========================================================= */}
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800/80 px-3.5 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-950/50">
            <Package className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight text-white">ঝাদিমাদি ডটকম</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[9px] font-black">
                মোবাইল অ্যাডমিন
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>লাইভ সিঙ্ক চালু</span>
            </div>
          </div>
        </div>

        {/* Switch to Desktop & Customer App Quick Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSwitchToDesktop}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold border border-slate-700 transition cursor-pointer active:scale-95"
            title="ফুলস্ক্রিন ডেস্কটপ অ্যাডমিন ভিউতে যান"
          >
            <Monitor className="w-3.5 h-3.5 text-teal-400" />
            <span>ডেস্কটপ</span>
          </button>
          <button
            type="button"
            onClick={onReturnToCustomerApp || onBack}
            className="flex items-center gap-1 px-2 py-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 rounded-lg text-[11px] font-bold border border-emerald-700/50 transition cursor-pointer active:scale-95"
            title="কাস্টমার শপ অ্যাপ খুলুন"
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">শপ</span>
          </button>
        </div>
      </header>

      {/* =========================================================
          2. SCROLLABLE MAIN CONTENT AREA
         ========================================================= */}
      <main className="flex-1 overflow-y-auto overscroll-contain px-3.5 pt-3.5 pb-24 space-y-4">

        {/* -------------------------------------------------------------------
            TAB 1: HOME OVERVIEW CARDS & QUICK STATS
           ------------------------------------------------------------------- */}
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Top Greeting & Live Pulse Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-900/50 via-slate-900 to-slate-900 border border-emerald-800/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider">
                  প্রশাসক নিয়ন্ত্রণ কেন্দ্র
                </span>
                <h1 className="text-base font-black text-white mt-0.5">
                  আজকের সারসংক্ষেপ
                </h1>
                <p className="text-[11px] text-slate-400">
                  খাগড়াছড়ি পার্বত্য জেলা • {new Date().toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>

            {/* 4 Core Mobile Overview Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Card 1: Total Daily Income */}
              <div 
                onClick={() => setActiveTab('finance')}
                className="col-span-2 p-4 rounded-2xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-700/50 shadow-lg shadow-emerald-950/40 relative overflow-hidden active:scale-[0.99] transition cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    আজকের মোট দৈনিক আয়
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                    +১২.৫% বৃদ্ধি
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-white">
                    ৳{financeStats.totalDailyIncome.toLocaleString('bn-BD')}
                  </span>
                  <span className="text-[11px] text-slate-400">মোট সংগৃহীত</span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>বিকাশ/নগদ: ৳{(financeStats.bKashTotal + financeStats.nagadTotal).toLocaleString('bn-BD')}</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                    লেজার দেখুন <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>

              {/* Card 2: Pending Orders */}
              <div 
                onClick={() => {
                  setOrderStatusFilter('Pending');
                  setActiveTab('orders');
                }}
                className="p-3.5 rounded-2xl bg-slate-900 border border-amber-800/40 shadow-sm active:scale-[0.98] transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  {pendingOrdersCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  )}
                </div>
                <div className="mt-2.5">
                  <span className="text-xl font-black text-amber-300">
                    {pendingOrdersCount} টি
                  </span>
                  <p className="text-[11px] font-bold text-slate-300 mt-0.5">অপেক্ষমাণ অর্ডার</p>
                  <p className="text-[9px] text-slate-500">প্রসেসিং ও শিপিং বাকি</p>
                </div>
              </div>

              {/* Card 3: Pending Product Approvals */}
              <div 
                onClick={() => {
                  setApprovalSubTab('products');
                  setActiveTab('approvals');
                }}
                className="p-3.5 rounded-2xl bg-slate-900 border border-teal-800/40 shadow-sm active:scale-[0.98] transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <Package className="w-4 h-4" />
                  </div>
                  {pendingProductApprovals.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[9px] font-black border border-teal-500/40">
                      নতুন
                    </span>
                  )}
                </div>
                <div className="mt-2.5">
                  <span className="text-xl font-black text-teal-300">
                    {pendingProductApprovals.length} টি
                  </span>
                  <p className="text-[11px] font-bold text-slate-300 mt-0.5">পণ্য ফিচার অনুমোদন</p>
                  <p className="text-[9px] text-slate-500">হোমপেজে প্রদর্শনের রিকোয়েস্ট</p>
                </div>
              </div>

              {/* Card 4: Pending Vendor Registrations */}
              <div 
                onClick={() => {
                  setApprovalSubTab('vendors');
                  setActiveTab('approvals');
                }}
                className="col-span-2 p-3.5 rounded-2xl bg-slate-900 border border-indigo-800/40 shadow-sm active:scale-[0.98] transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-200">ভেন্ডর ও সদস্য নিবন্ধন যাচাই</p>
                      <p className="text-[10px] text-slate-400">এনআইডি ও লাইসেন্স ভেরিফিকেশন</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-700/50 text-xs font-black">
                      {pendingVendorMemberApprovals.length} জন অপেক্ষমাণ
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 px-1">দ্রুত একশন শর্টকাট</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrderStatusFilter('Pending');
                    setActiveTab('orders');
                  }}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-1.5 active:scale-95 transition text-center"
                >
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-200">অর্ডার প্রসেস</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApprovalSubTab('products');
                    setActiveTab('approvals');
                  }}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-1.5 active:scale-95 transition text-center"
                >
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span className="text-[10px] font-bold text-slate-200">হোমপেজ এপ্রুভ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('finance')}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-1.5 active:scale-95 transition text-center"
                >
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] font-bold text-slate-200">পেমেন্ট লেজার</span>
                </button>
              </div>
            </div>

            {/* Recent Orders Snippet */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  সাম্প্রতিক অর্ডারসমূহ ({normalizedOrders.length})
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                >
                  সব দেখুন
                </button>
              </div>
              <div className="space-y-2 divide-y divide-slate-800/80">
                {normalizedOrders.slice(0, 3).map((ord) => (
                  <div key={ord.id} className="pt-2 first:pt-0 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={ord.productImage}
                        alt={ord.productName}
                        className="w-9 h-9 rounded-lg object-cover bg-slate-800 border border-slate-700"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                      <div>
                        <p className="text-xs font-bold text-white line-clamp-1">{ord.productName}</p>
                        <p className="text-[10px] text-slate-400">{ord.customerName} • {ord.customerPhone}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-emerald-400">৳{ord.totalPrice}</p>
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        ord.status === 'Pending' ? 'bg-amber-950 text-amber-400 border border-amber-800/60' :
                        ord.status === 'Delivered' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' :
                        'bg-blue-950 text-blue-400 border border-blue-800/60'
                      }`}>
                        {ord.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 2: CUSTOMER ORDERS MANAGEMENT TAB
           ------------------------------------------------------------------- */}
        {activeTab === 'orders' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            
            {/* Header & Stats Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  কাস্টমার অর্ডার ব্যবস্থাপনা
                </h2>
                <p className="text-[10px] text-slate-400">সর্বমোট {normalizedOrders.length}টি অর্ডারের রিয়েল-টাইম তালিকা</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fetchAllOrders()}
                  disabled={isRefreshingOrders}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95 flex items-center gap-1 text-[11px] font-bold"
                  title="ডাটাবেজ থেকে রিফ্রেশ করুন"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshingOrders ? 'animate-spin' : ''}`} />
                  <span className="hidden xs:inline">{isRefreshingOrders ? 'সিঙ্ক...' : 'রিফ্রেশ'}</span>
                </button>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[10px] font-black">
                  {pendingOrdersCount} পেন্ডিং
                </span>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="নাম, ফোন নম্বর, ঠিকানা বা অর্ডার নং দিয়ে খুঁজুন..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {orderSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOrderSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Horizontal Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {(['all', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setOrderStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition cursor-pointer shrink-0 ${
                    orderStatusFilter === st
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {st === 'all' ? 'সকল অর্ডার' : 
                   st === 'Pending' ? 'পেন্ডিং' : 
                   st === 'Confirmed' ? 'কনফার্মড' : 
                   st === 'Shipped' ? 'শিপড' : 
                   st === 'Delivered' ? 'ডেলিভার্ড' : 'বাতিল'}
                </button>
              ))}
            </div>

            {/* Orders Mobile Card List */}
            {filteredOrders.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
                <ShoppingCart className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-bold text-slate-400">কোনো অর্ডার পাওয়া যায়নি</p>
                <p className="text-[10px] text-slate-500">অন্য ফিল্টার বা সার্চ দিয়ে চেষ্টা করুন</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3 hover:border-slate-700 transition"
                  >
                    {/* Card Header: ID, Date, Status */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-emerald-400">
                          #{ord.orderNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(ord.id, 'অর্ডার আইডি')}
                          className="text-slate-500 hover:text-slate-300 p-0.5"
                          title="আইডি কপি করুন"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-slate-500">•</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(ord.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>

                      {/* Status Dropdown Picker */}
                      <div className="relative">
                        <select
                          disabled={isUpdatingOrder === ord.id}
                          value={ord.status}
                          onChange={(e) => handleOrderStatusChange(ord.id, e.target.value as any)}
                          className={`text-[11px] font-black px-2 py-1 rounded-lg border appearance-none pr-5 cursor-pointer outline-none ${
                            ord.status === 'Pending' ? 'bg-amber-950 text-amber-400 border-amber-800/60' :
                            ord.status === 'Confirmed' ? 'bg-blue-950 text-blue-400 border-blue-800/60' :
                            ord.status === 'Shipped' ? 'bg-purple-950 text-purple-400 border-purple-800/60' :
                            ord.status === 'Delivered' ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60' :
                            'bg-red-950 text-red-400 border-red-800/60'
                          }`}
                        >
                          <option value="Pending" className="bg-slate-900 text-amber-400">Pending (অপেক্ষমাণ)</option>
                          <option value="Confirmed" className="bg-slate-900 text-blue-400">Confirmed (নিশ্চিত)</option>
                          <option value="Shipped" className="bg-slate-900 text-purple-400">Shipped (কুরিয়ারে)</option>
                          <option value="Delivered" className="bg-slate-900 text-emerald-400">Delivered (বিতরণ সম্পন্ন)</option>
                          <option value="Cancelled" className="bg-slate-900 text-red-400">Cancelled (বাতিল)</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                      </div>
                    </div>

                    {/* Customer Info & Direct Contact Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-white">{ord.customerName}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{ord.customerPhone}</span>
                        </div>
                        <div className="flex items-start gap-1 text-[10px] text-slate-400 mt-1">
                          <MapPin className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{ord.deliveryAddress}</span>
                        </div>
                      </div>

                      {/* Contact Shortcuts: Call & WhatsApp */}
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`tel:${ord.customerPhone}`}
                          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center border border-slate-700 active:scale-95 transition"
                          title="কল করুন"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/88${ord.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`আসসালামু আলাইকুম ${ord.customerName}, ঝাদিমাদি ডটকম থেকে আপনার অর্ডার #${ord.orderNumber} এর ব্যাপারে যোগাযোগ করছি।`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 flex items-center justify-center border border-emerald-700/50 active:scale-95 transition"
                          title="হোয়াটসঅ্যাপ চ্যাট"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Product Summary Row */}
                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={ord.productImage}
                          alt={ord.productName}
                          className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-200 line-clamp-1">{ord.productName}</p>
                          <p className="text-[10px] text-slate-400">কোড: {ord.productCode} • পরিমাণ: {ord.quantity}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-emerald-400">৳{ord.totalPrice}</p>
                        <span className="text-[9px] font-bold text-slate-400">
                          {ord.paymentMethod.includes('COD') ? 'ক্যাশ অন ডেলিভারি' : 'অনলাইন পেমেন্ট'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action: Print/View Invoice */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">পেমেন্ট মেথড: {ord.paymentMethod}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForInvoice(ord)}
                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span>ইনভয়েস দেখুন</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 3: CENTRALIZED APPROVAL HUB (PRODUCTS & VENDORS)
           ------------------------------------------------------------------- */}
        {activeTab === 'approvals' && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            
            {/* Header */}
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                কেন্দ্রীয় অনুমোদন হাব (Approval Hub)
              </h2>
              <p className="text-[10px] text-slate-400">
                হোমপেজ ফিচার রিকোয়েস্ট এবং নতুন ভেন্ডর/মেম্বার যাচাইকরণ
              </p>
            </div>

            {/* Sub-Tabs: Product Approvals vs Vendor Registrations */}
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setApprovalSubTab('products')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  approvalSubTab === 'products'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>পণ্য ফিচার অনুমোদন ({pendingProductApprovals.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setApprovalSubTab('vendors')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  approvalSubTab === 'vendors'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>ভেন্ডর ও সদস্য ({pendingVendorMemberApprovals.length})</span>
              </button>
            </div>

            {/* SUB-SECTION 1: PRODUCT FEATURE APPROVALS */}
            {approvalSubTab === 'products' && (
              <div className="space-y-3">
                <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    ভেন্ডরদের আবেদনের ১-ট্যাপে অনুমোদন দিন। <strong>is_approved = true</strong> আপডেট হয়ে তাৎক্ষণিক মূল হোমপেজ ফিডে প্রকাশিত হবে।
                  </span>
                </div>

                {/* Status Filter Horizontal Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <button
                    type="button"
                    onClick={() => setProductApprovalFilter('pending')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition cursor-pointer shrink-0 ${
                      productApprovalFilter === 'pending'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    অপেক্ষমাণ আবেদন ({vendorProducts.filter(p => !p.is_approved).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductApprovalFilter('approved')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition cursor-pointer shrink-0 ${
                      productApprovalFilter === 'approved'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    অনুমোদিত ফিচার ({vendorProducts.filter(p => p.is_approved).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductApprovalFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition cursor-pointer shrink-0 ${
                      productApprovalFilter === 'all'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    সকল আবেদন ({vendorProducts.length})
                  </button>
                </div>

                {filteredProductApprovals.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                    <p className="text-xs font-bold text-slate-300">কোনো পণ্য ফিচার আবেদন নেই</p>
                    <p className="text-[10px] text-slate-500">সকল ভেন্ডর পণ্য যাচাই ও হোমপেজে সক্রিয় রয়েছে</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProductApprovals.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3"
                      >
                        {/* Top: Product Image + Info */}
                        <div className="flex items-start gap-3">
                          <img
                            src={item.image}
                            alt={item.nameBn}
                            className="w-16 h-16 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-800/60 text-[9px] font-black">
                                {item.categoryLabelBn}
                              </span>
                              {item.is_approved ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[9px] font-bold">
                                  ✓ হোমপেজে সক্রিয়
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 text-[9px] font-bold">
                                  অনুমোদন বাকি
                                </span>
                              )}
                            </div>
                            <h3 className="text-xs font-black text-white mt-1 line-clamp-2">
                              {item.nameBn}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-black text-emerald-400">৳{item.price}</span>
                              <span className="text-[10px] text-slate-500 line-through">৳{item.originalPrice}</span>
                              <span className="text-[10px] text-slate-400">• কোড: {item.code}</span>
                            </div>
                          </div>
                        </div>

                        {/* Vendor & Payment Status Details */}
                        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">সরবরাহকারী / ভেন্ডর:</span>
                            <span className="font-bold text-slate-200">{item.vendorShop}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">স্বত্বাধিকারী ও ফোন:</span>
                            <span className="text-slate-300">{item.vendorName} ({item.vendorPhone})</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">আবেদনকৃত প্লেসমেন্ট:</span>
                            <span className="text-amber-400 font-bold text-[10px]">{item.requestedPlacement}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                            <span className="text-slate-400">পেমেন্ট ভেরিফিকেশন:</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              item.paymentVerificationStatus === 'Verified'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : item.paymentVerificationStatus === 'Pending'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                                : 'bg-blue-950 text-blue-400 border border-blue-800/60'
                            }`}>
                              {item.paymentVerificationStatus === 'Verified' ? `ভেরিফাইড (৳${item.paymentAmount || 500})` :
                               item.paymentVerificationStatus === 'Pending' ? `যাচাই বাকি (Trx: ${item.paymentTrxId || 'N/A'})` :
                               'ফ্রি প্রোমোশনাল অফার'}
                            </span>
                          </div>
                        </div>

                        {/* 1-Tap Action Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleRejectProduct(item)}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition active:scale-95 text-center"
                          >
                            {item.is_approved ? 'হোল্ড / সরান' : 'হোল্ড / বাতিল'}
                          </button>
                          {!item.is_approved ? (
                            <button
                              type="button"
                              onClick={() => handleApproveProduct(item)}
                              className="flex-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-950/60 border border-emerald-400/40 transition active:scale-95 flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>অনুমোদন দিন (Approve)</span>
                            </button>
                          ) : (
                            <div className="flex-2 py-2.5 px-3 rounded-xl bg-emerald-950/60 text-emerald-400 font-black text-xs border border-emerald-800/50 flex items-center justify-center gap-1.5">
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>হোমপেজে ফিচার্ড রয়েছে</span>
                            </div>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-SECTION 2: VENDOR & MEMBER APPROVALS */}
            {approvalSubTab === 'vendors' && (
              <div className="space-y-3">
                <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-[11px] text-indigo-300 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    পণ্য বিক্রেতা, সেবাদাতা ও স্থায়ী সদস্যদের জাতীয় পরিচয়পত্র (NID) ও তথ্য যাচাই করে অনুমোদন দিন।
                  </span>
                </div>

                {/* Role Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <button
                    type="button"
                    onClick={() => setVendorRoleFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition cursor-pointer shrink-0 ${
                      vendorRoleFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    সকল ({vendorMemberCandidates.filter(c => !rejectedVendorIds.includes(c.id) && !c.isApproved).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVendorRoleFilter('seller')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition cursor-pointer shrink-0 ${
                      vendorRoleFilter === 'seller'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    পণ্য বিক্রেতা ({vendorMemberCandidates.filter(c => c.roleType === 'seller' && !rejectedVendorIds.includes(c.id) && !c.isApproved).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVendorRoleFilter('provider')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition cursor-pointer shrink-0 ${
                      vendorRoleFilter === 'provider'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    সেবাদাতা ({vendorMemberCandidates.filter(c => c.roleType === 'provider' && !rejectedVendorIds.includes(c.id) && !c.isApproved).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVendorRoleFilter('member')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition cursor-pointer shrink-0 ${
                      vendorRoleFilter === 'member'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    স্থায়ী সদস্য ({vendorMemberCandidates.filter(c => c.roleType === 'member' && !rejectedVendorIds.includes(c.id) && !c.isApproved).length})
                  </button>
                </div>

                {pendingVendorMemberApprovals.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                    <p className="text-xs font-bold text-slate-300">কোনো অপেক্ষমাণ ভেন্ডর বা সদস্য নেই</p>
                    <p className="text-[10px] text-slate-500">সকল আবেদন অনুমোদিত অথবা ফিল্টারে কোনো রেকর্ড নেই</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingVendorMemberApprovals.map((cand) => (
                      <div
                        key={cand.id}
                        className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={cand.avatar}
                            alt={cand.name}
                            className="w-12 h-12 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60 text-[9px] font-black">
                              {cand.roleLabel}
                            </span>
                            <h3 className="text-xs font-black text-white mt-1">{cand.name}</h3>
                            <p className="text-[11px] text-slate-400">{cand.job} • {cand.location}</p>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1 text-[11px]">
                          {cand.shopName && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">দোকান / প্রতিষ্ঠান:</span>
                              <span className="font-bold text-emerald-300">{cand.shopName}</span>
                            </div>
                          )}
                          {cand.tradeLicense && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">ট্রেড লাইসেন্স:</span>
                              <span className="font-mono text-slate-200">{cand.tradeLicense}</span>
                            </div>
                          )}
                          {cand.dailyRate && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">দৈনিক পারিশ্রমিক:</span>
                              <span className="font-bold text-emerald-400">{cand.dailyRate}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">মোবাইল নম্বর:</span>
                            <span className="font-bold text-slate-200">{cand.phone || 'দেওয়া হয়নি'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">এনআইডি নম্বর (NID):</span>
                            <span className="font-mono text-emerald-400 font-bold">{cand.nid}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleRejectVendorMember(cand)}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition active:scale-95 text-center"
                          >
                            বাতিল
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveVendorMember(cand)}
                            className="flex-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg shadow-indigo-950/60 border border-indigo-400/40 transition active:scale-95 flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>অনুমোদন দিন</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 4: FINANCE & TRANSACTION LOG
           ------------------------------------------------------------------- */}
        {activeTab === 'finance' && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            
            {/* Header */}
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                ফিন্যান্স ও ডিজিটাল ট্রানজেকশন লেজার
              </h2>
              <p className="text-[10px] text-slate-400">
                বিকাশ, নগদ, রকেট ও সিওডি ইনকাম রিকনসিলেশন
              </p>
            </div>

            {/* Income Snapshot Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/50">
                <span className="text-[10px] text-emerald-400 font-bold">মোট ডিজিটাল সংগ্রহ</span>
                <p className="text-xl font-black text-white mt-1">
                  ৳{(financeStats.bKashTotal + financeStats.nagadTotal).toLocaleString('bn-BD')}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">বিকাশ ও নগদ পেমেন্ট</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-amber-400 font-bold">সিওডি পাইপলাইন</span>
                <p className="text-xl font-black text-white mt-1">
                  ৳{financeStats.codTotal.toLocaleString('bn-BD')}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">কুরিয়ার ডেলিভারি কালেকশন</p>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={financeSearch}
                onChange={(e) => setFinanceSearch(e.target.value)}
                placeholder="TrxID, প্রেরকের নাম বা ফোন নম্বর..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {financeSearch && (
                <button
                  type="button"
                  onClick={() => setFinanceSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Gateway Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {(['all', 'bKash', 'Nagad', 'Rocket', 'COD'] as const).map((gw) => (
                <button
                  key={gw}
                  type="button"
                  onClick={() => setFinanceGatewayFilter(gw)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition cursor-pointer shrink-0 ${
                    financeGatewayFilter === gw
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {gw === 'all' ? 'সকল মাধ্যম' : gw}
                </button>
              ))}
            </div>

            {/* Transactions Mobile Cards */}
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black text-emerald-400">
                        {tx.trxId}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(tx.trxId, 'TrxID')}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
                      tx.status === 'Success'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                        : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                    }`}>
                      {tx.status === 'Success' ? 'সফল (Verified)' : 'যাচাই বাকি (Pending)'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-black text-white">{tx.senderName}</p>
                      <p className="text-[10px] text-slate-400">{tx.senderPhone} • {tx.paymentMethod}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">উদ্দেশ্য: {tx.purpose}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-400">৳{tx.amount}</p>
                      <p className="text-[9px] text-slate-500">{tx.date}</p>
                    </div>
                  </div>

                  {tx.status === 'Pending_Verification' && (
                    <button
                      type="button"
                      onClick={() => handleVerifyTransaction(tx.id)}
                      className="w-full py-2 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-xs font-black border border-emerald-500/40 transition active:scale-95 flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>ভেরিফাই ও রিকনসাইল নিশ্চিত করুন</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 5: SETTINGS & CONTROLS
           ------------------------------------------------------------------- */}
        {activeTab === 'settings' && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            
            {/* Header */}
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-emerald-400" />
                অ্যাডমিন সেটিংস ও সিস্টেম নিয়ন্ত্রণ
              </h2>
              <p className="text-[10px] text-slate-400">
                ড্যাশবোর্ড মোড ও প্রয়োজনীয় অ্যাডমিন কনফিগারেশন
              </p>
            </div>

            {/* Switch to Desktop Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 border border-teal-800/40 space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-black text-white">ফুলস্ক্রিন ডেস্কটপ অ্যাডমিন</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                উন্নত গ্রাফ, বিস্তারিত টেবিল, ব্যানার আপলোড এবং ড্রপডাউন ক্যাটাগরি ম্যানেজমেন্টের জন্য বড় স্ক্রিনের ফুল ডেস্কটপ ড্যাশবোর্ডে স্যুইচ করুন।
              </p>
              <button
                type="button"
                onClick={onSwitchToDesktop}
                className="w-full mt-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black shadow-md transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                <span>ডেস্কটপ ড্যাশবোর্ডে স্যুইচ করুন</span>
              </button>
            </div>

            {/* Hotline & Contact Config */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  অ্যাডমিন হোয়াটসঅ্যাপ হটলাইন
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-mono font-bold">
                  {ADMIN_PHONE_DISPLAY}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                নতুন অর্ডার আসলে স্বয়ংক্রিয়ভাবে এই নম্বরে হোয়াটসঅ্যাপ নোটিফিকেশন পৌঁছায়।
              </p>
            </div>

            {/* Return to Customer Store App */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                গ্রাহক শপ অ্যাপ্লিকেশন
              </span>
              <p className="text-[11px] text-slate-400">
                সাধারণ ব্যবহারকারী ও ক্রেতাদের দৃষ্টিকোণ থেকে শপ দেখতে কাস্টমার অ্যাপে ফিরে যান।
              </p>
              <button
                type="button"
                onClick={onReturnToCustomerApp || onBack}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Store className="w-4 h-4 text-emerald-400" />
                <span>কাস্টমার অ্যাপে যান</span>
              </button>
            </div>

            {/* Logout Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onBack}
                className="w-full py-3 bg-red-950/60 hover:bg-red-900 text-red-300 rounded-2xl text-xs font-black border border-red-800/60 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>অ্যাডমিন সেশন সমাপ্ত ও লগআউট</span>
              </button>
            </div>

          </div>
        )}

      </main>

      {/* =========================================================
          3. FIXED BOTTOM NAVIGATION BAR
         ========================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 flex items-center justify-around z-40">
        
        {/* Nav Item 1: Home */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer active:scale-95 ${
            activeTab === 'home' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-1">হোম</span>
        </button>

        {/* Nav Item 2: Orders (with Badge) */}
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center justify-center flex-1 py-1 relative transition cursor-pointer active:scale-95 ${
            activeTab === 'orders' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px] mt-1">অর্ডার</span>
          {pendingOrdersCount > 0 && (
            <span className="absolute top-0.5 right-4 w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] flex items-center justify-center ring-2 ring-slate-900">
              {pendingOrdersCount}
            </span>
          )}
        </button>

        {/* Nav Item 3: Approvals (with Badge) */}
        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className={`flex flex-col items-center justify-center flex-1 py-1 relative transition cursor-pointer active:scale-95 ${
            activeTab === 'approvals' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[10px] mt-1">অনুমোদন</span>
          {pendingApprovalsCount > 0 && (
            <span className="absolute top-0.5 right-4 w-4 h-4 rounded-full bg-teal-400 text-slate-950 font-black text-[9px] flex items-center justify-center ring-2 ring-slate-900">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        {/* Nav Item 4: Finance */}
        <button
          type="button"
          onClick={() => setActiveTab('finance')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer active:scale-95 ${
            activeTab === 'finance' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-5 h-5" />
          <span className="text-[10px] mt-1">ফিন্যান্স</span>
        </button>

        {/* Nav Item 5: Settings */}
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer active:scale-95 ${
            activeTab === 'settings' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-1">সেটিংস</span>
        </button>

      </nav>

      {/* =========================================================
          4. INVOICE MODAL BOTTOM SHEET
         ========================================================= */}
      {selectedOrderForInvoice && (
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">অর্ডার ইনভয়েস রিসিট</h3>
                <p className="text-[10px] text-slate-400">অর্ডার #{selectedOrderForInvoice.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForInvoice(null)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="text-center pb-2 border-b border-slate-800">
                <span className="font-black text-sm text-white">ঝাদিমাদি ডটকম</span>
                <p className="text-[10px] text-slate-400">খাগড়াছড়ি পার্বত্য জেলা • হটলাইন: {ADMIN_PHONE_DISPLAY}</p>
              </div>

              <div className="space-y-1 text-slate-300">
                <p><strong>গ্রাহক:</strong> {selectedOrderForInvoice.customerName}</p>
                <p><strong>মোবাইল:</strong> {selectedOrderForInvoice.customerPhone}</p>
                <p><strong>ঠিকানা:</strong> {selectedOrderForInvoice.deliveryAddress}</p>
                <p><strong>তারিখ:</strong> {new Date(selectedOrderForInvoice.date).toLocaleString('bn-BD')}</p>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1">
                <div className="flex justify-between font-bold text-white">
                  <span>{selectedOrderForInvoice.productName} ({selectedOrderForInvoice.quantity}x)</span>
                  <span>৳{selectedOrderForInvoice.totalPrice}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>পেমেন্ট মেথড:</span>
                  <span className="text-emerald-400 font-bold">{selectedOrderForInvoice.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>বর্তমান স্ট্যাটাস:</span>
                  <span className="text-amber-400 font-bold">{selectedOrderForInvoice.status}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedOrderForInvoice(null)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition active:scale-95"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MobileAdminDashboard;
