import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Search, RefreshCw, Copy, Check, Phone, MapPin, 
  Trash2, Download, X, Tag, Package, Calendar, User, FileText, ChevronDown, ChevronUp, Layers, PieChart
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const AdminCustomerOrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('All');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [copiedFullCardId, setCopiedFullCardId] = useState<string | null>(null);
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null);

  // Supabase থেকে অর্ডার লোড করা
  const fetchRealOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase Fetch Error:', error);
      } else if (data) {
        setOrders(data);
      }
    } catch (err) {
      console.error('Fetch Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRealOrders();

    const channel = supabase
      .channel('public:orders_realtime_v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchRealOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // অর্ডার পার্স করা এবং তথ্য পরিষ্কার করা
  const parseOrder = (order: any) => {
    let items = [];
    try {
      items = Array.isArray(order.items) 
        ? order.items 
        : (typeof order.items === 'string' ? JSON.parse(order.items) : []);
    } catch (e) {
      items = [];
    }
    const firstItem = items[0] || {};

    const productId = order.product_id || order.productId || firstItem.id || firstItem.product_id || firstItem.code || 'JDM-PROD';
    const productName = order.product_name || order.productName || firstItem.name || firstItem.title || 'অন্যান্য পণ্য';

    // ডাইনামিক ওজন/পরিমাণ ধরা
    const rawUnit = order.unit || order.weight || order.size || firstItem.unit || firstItem.weight || firstItem.size || '';
    const rawQty = Number(order.quantity || order.qty || firstItem.quantity || 1);
    
    let formattedQuantity = '';
    if (rawUnit) {
      formattedQuantity = `${rawQty} ${rawUnit}`;
    } else {
      formattedQuantity = `${rawQty} টি`;
    }

    const productImage = order.product_image || order.image || firstItem.image || firstItem.image_url || 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=150&auto=format&fit=crop&q=80';

    return {
      id: order.id || order.order_id || order.order_number || 'N/A',
      customerName: order.customer_name || order.customerName || order.name || 'গ্রাহকের নাম নেই',
      customerPhone: order.customer_phone || order.phone_number || order.phone || 'নম্বর নেই',
      deliveryAddress: order.delivery_address || order.shipping_address || order.address || 'ঠিকানা নেই',
      productName: productName,
      productId: productId,
      productImage: productImage,
      quantityNum: rawQty,
      unitStr: rawUnit || 'টি',
      quantity: formattedQuantity,
      totalPrice: Number(order.total_amount || order.total_price || order.grand_total || order.totalPrice || 0),
      paymentMethod: order.payment_method || order.paymentMethod || 'Cash on Delivery',
      status: order.status || order.order_status || 'Pending',
      createdAt: order.created_at ? new Date(order.created_at).toLocaleString('bn-BD', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }) : 'আজ'
    };
  };

  const parsedOrders = useMemo(() => orders.map(parseOrder), [orders]);

  // ডাইনামিকভাবে প্রতিটি পণ্যের মোট পরিমাণ গণনা করা (Dynamic Auto Summary)
  const productSummary = useMemo(() => {
    const summary: Record<string, { count: number; totalQty: number; unit: string; totalAmount: number }> = {};

    parsedOrders.forEach(o => {
      const pName = o.productName.trim();
      if (!summary[pName]) {
        summary[pName] = { count: 0, totalQty: 0, unit: o.unitStr, totalAmount: 0 };
      }
      summary[pName].count += 1;
      summary[pName].totalQty += o.quantityNum;
      summary[pName].totalAmount += o.totalPrice;
    });

    return summary;
  }, [parsedOrders]);

  // ফিল্টার করা অর্ডার
  const filteredOrders = useMemo(() => {
    return parsedOrders.filter(o => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        o.id.toString().toLowerCase().includes(q) ||
        o.productId.toString().toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q);

      const matchesProductFilter = selectedProductFilter === 'All' || o.productName === selectedProductFilter;

      return matchesSearch && matchesProductFilter;
    });
  }, [parsedOrders, searchQuery, selectedProductFilter]);

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    } catch (err) {
      alert('স্ট্যাটাস আপডেট হয়নি');
    }
  };

  const handleDeleteOrder = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`আপনি কি এই অর্ডারটি মুছে ফেলতে চান?`)) return;
    try {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      await supabase.from('orders').delete().eq('id', orderId);
    } catch (err) {
      alert('ডিলিট করা সম্ভব হয়নি');
    }
  };

  const handleCopyFullCard = (o: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `অর্ডার আইডি: ${o.id}
তারিখ ও সময়: ${o.createdAt}
কাস্টমারের নাম: ${o.customerName}
ফোন নম্বর: ${o.customerPhone}
ঠিকানা: ${o.deliveryAddress}
প্রোডাক্ট আইডি: ${o.productId}
পণ্যের নাম: ${o.productName}
পরিমাণ/ওজন: ${o.quantity}
মোট মূল্য: ৳${o.totalPrice}
পেমেন্ট: ${o.paymentMethod}
স্ট্যাটাস: ${o.status}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedFullCardId(String(o.id));
    setTimeout(() => setCopiedFullCardId(null), 2000);
  };

  // CSV/Excel Export
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return alert('কোনো অর্ডার ডাটা নেই!');

    const headers = ['অর্ডার আইডি', 'তারিখ', 'কাস্টমার নাম', 'ফোন নম্বর', 'ঠিকানা', 'প্রোডাক্ট আইডি', 'পণ্যের নাম', 'পরিমাণ/ওজন', 'মূল্য (৳)', 'পেমেন্ট', 'স্ট্যাটাস'];
    const rows = filteredOrders.map(o => [
      `"${o.id}"`, `"${o.createdAt}"`, `"${o.customerName}"`, `"${o.customerPhone}"`,
      `"${o.deliveryAddress.replace(/"/g, '""')}"`, `"${o.productId}"`, `"${o.productName}"`,
      `"${o.quantity}"`, `"${o.totalPrice}"`, `"${o.paymentMethod}"`, `"${o.status}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 space-y-4 bg-slate-100 min-h-screen">
      {/* হেডার */}
      <div className="bg-white p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            কাস্টমার অর্ডার ড্যাশবোর্ড
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">মোট রিয়েল অর্ডার: {orders.length} টি</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportCSV} 
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> Excel / Word এ এক্সপোর্ট
          </button>
          <button 
            onClick={fetchRealOrders} 
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} /> রিফ্রেশ
          </button>
        </div>
      </div>

      {/* ১. ডাইনামিক মোট টোটাল সামারি কার্ড (Dynamic Product Total Summary) */}
      <div className="bg-white p-4 rounded-xl border shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <PieChart className="w-4 h-4 text-emerald-600" />
          <span>পণ্যের মোট হিসাব ও ডাইনামিক সামারি (অটোমেটিক গণনাকৃত):</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {/* সব পণ্যের অল বাটন */}
          <button
            onClick={() => setSelectedProductFilter('All')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedProductFilter === 'All'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <div className="text-[11px] font-bold opacity-80">সব পণ্য মিলিয়ে</div>
            <div className="text-base font-black mt-0.5">{parsedOrders.length} টি অর্ডার</div>
          </button>

          {/* অটোমেটিক প্রোডাক্ট সামারি বাটনসমূহ */}
          {Object.entries(productSummary).map(([pName, info]) => {
            const isSelected = selectedProductFilter === pName;
            return (
              <button
                key={pName}
                onClick={() => setSelectedProductFilter(pName)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <div className="text-[11px] font-bold truncate">{pName}</div>
                <div className="text-sm font-black mt-0.5">
                  মোট: {info.totalQty} {info.unit}
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  {info.count} টি অর্ডারে | ৳{info.totalAmount}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ২. সার্চ ইনপুট */}
      <div className="bg-white p-3 rounded-xl border shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="অর্ডার আইডি, কাস্টমার নাম, ফোন নম্বর বা প্রোডাক্ট দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200"
          />
        </div>
      </div>

      {/* ৩. নির্দিষ্ট প্রোডাক্ট ফিল্টার হলে মেসেজ */}
      {selectedProductFilter !== 'All' && (
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900">
          <span>
            এখন শুধু <strong>"{selectedProductFilter}"</strong> পণ্যটি যারা যারা অর্ডার করেছে তাদের তালিকা দেখানো হচ্ছে (মোট {filteredOrders.length} জন):
          </span>
          <button 
            onClick={() => setSelectedProductFilter('All')} 
            className="text-xs text-rose-600 hover:underline cursor-pointer"
          >
            সব দেখুন ✕
          </button>
        </div>
      )}

      {/* ৪. অর্ডার কার্ড তালিকা */}
      <div className="space-y-3 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="bg-white p-8 rounded-xl border text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            অর্ডার লোড হচ্ছে...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border text-center text-slate-400">
            এই পণ্যটির কোনো অর্ডার পাওয়া যায়নি।
          </div>
        ) : (
          filteredOrders.map((o, idx) => {
            const isExpanded = expandedOrderId === o.id;

            return (
              <div 
                key={o.id} 
                className={`bg-white border rounded-xl shadow-xs transition-all overflow-hidden ${
                  isExpanded ? 'border-emerald-500 ring-2 ring-emerald-100' : 'hover:border-slate-300'
                }`}
              >
                {/* সংক্ষিপ্ত সংকুচিত রো */}
                <div 
                  onClick={() => toggleOrderDetails(o.id)}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-slate-400 text-xs shrink-0">#{idx + 1}</span>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[150px]">{o.productName}</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          {o.quantity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        কাস্টমার: <strong className="text-slate-700">{o.customerName}</strong> | ফোন: <strong className="text-slate-700">{o.customerPhone}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-xs">৳{o.totalPrice}</div>
                      <span className={`text-[10px] font-bold ${
                        o.status === 'Delivered' ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {o.status}
                      </span>
                    </div>

                    <div className="p-1 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-500 rounded-lg transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* ডিটেইলস (ক্লিক করলে খুলবে) */}
                {isExpanded && (
                  <div className="border-t bg-slate-50/50 p-4 space-y-3 text-xs">
                    
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="font-bold text-slate-700">অর্ডার আইডি: <span className="font-mono text-emerald-700">{o.id}</span></span>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => handleCopyFullCard(o, e)}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-white text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-300 transition-colors cursor-pointer"
                        >
                          {copiedFullCardId === String(o.id) ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedFullCardId === String(o.id) ? 'কপি হয়েছে!' : 'সব তথ্য কপি'}</span>
                        </button>

                        <button 
                          onClick={(e) => handleDeleteOrder(o.id, e)} 
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200/60 bg-white p-3 rounded-lg border border-slate-200">
                      <div className="py-2 flex justify-between">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> তারিখ ও সময়:</span>
                        <span className="font-medium text-slate-800">{o.createdAt}</span>
                      </div>

                      <div className="py-2 flex justify-between">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> কাস্টমারের নাম:</span>
                        <span className="font-bold text-slate-900">{o.customerName}</span>
                      </div>

                      <div className="py-2 flex justify-between">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> ফোন নম্বর:</span>
                        <a href={`tel:${o.customerPhone}`} className="font-bold text-emerald-700 font-mono hover:underline">{o.customerPhone}</a>
                      </div>

                      <div className="py-2 flex justify-between items-start">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5 shrink-0"><MapPin className="w-3.5 h-3.5 text-slate-400" /> ডেলিভারি ঠিকানা:</span>
                        <span className="font-medium text-slate-800 text-right">{o.deliveryAddress}</span>
                      </div>

                      <div className="py-2 flex justify-between items-center">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-slate-400" /> প্রোডাক্ট আইডি ও ছবি:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border text-slate-700">{o.productId}</span>
                          <button 
                            onClick={() => setSelectedProductImage(o.productImage)}
                            className="w-7 h-7 rounded border overflow-hidden hover:opacity-80 transition-opacity"
                            title="ছবি দেখুন"
                          >
                            <img src={o.productImage} alt="" className="w-full h-full object-cover" />
                          </button>
                        </div>
                      </div>

                      <div className="py-2 flex justify-between">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-slate-400" /> পণ্যের নাম:</span>
                        <span className="font-bold text-slate-900">{o.productName}</span>
                      </div>

                      <div className="py-2 flex justify-between items-center bg-emerald-50/60 -mx-3 px-3">
                        <span className="font-bold text-emerald-800 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-emerald-600" /> পরিমাণ / ওজন / সাইজ:</span>
                        <span className="font-black text-emerald-700 text-xs bg-white px-2 py-0.5 rounded border border-emerald-200">{o.quantity}</span>
                      </div>

                      <div className="py-2 flex justify-between items-center">
                        <span className="font-bold text-slate-500">মোট মূল্য:</span>
                        <span className="font-black text-slate-900 text-sm">৳{o.totalPrice}</span>
                      </div>

                      <div className="py-2 flex justify-between items-center">
                        <span className="font-bold text-slate-500">স্ট্যাটাস পরিবর্তন:</span>
                        <select
                          value={o.status}
                          onChange={e => handleStatusChange(o.id, e.target.value)}
                          className="p-1 border rounded text-xs font-bold bg-white focus:outline-none cursor-pointer"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ছবি পপআপ */}
      {selectedProductImage && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 relative shadow-2xl space-y-3 text-center">
            <button 
              onClick={() => setSelectedProductImage(null)} 
              className="absolute top-3 right-3 p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
            <h3 className="text-sm font-bold text-slate-800">পণ্যের ছবি</h3>
            <div className="w-full h-64 rounded-xl overflow-hidden border border-slate-200">
              <img src={selectedProductImage} alt="Product" className="w-full h-full object-contain bg-slate-50" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};