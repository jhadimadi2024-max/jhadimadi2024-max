import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Clock, 
  Phone, 
  MessageCircle, 
  Search, 
  UserCheck, 
  Eye, 
  EyeOff, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Briefcase, 
  Users,
  Copy,
  ExternalLink
} from 'lucide-react';
import { useData } from '../../context/DataContext';

interface AdminApprovalModerationTabProps {
  showToast: (msg: string) => void;
}

type FilterCategory = 'all_pending' | 'service_providers' | 'permanent_members' | 'approved';

export const AdminApprovalModerationTab: React.FC<AdminApprovalModerationTabProps> = ({ showToast }) => {
  const { 
    professionals, 
    users, 
    approveProfessional, 
    rejectProfessional, 
    approveUser, 
    rejectUser 
  } = useData();

  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all_pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Combine and normalize candidates from both professionals and users
  const candidates = useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    // 1. Service Providers from professionals array
    (professionals || []).forEach((pro) => {
      const id = String(pro.id || (pro as any).uniqueId || (pro as any).memberId || '');
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        const isApproved = pro.verified === true || (pro as any).is_verified === true || (pro as any).status === 'Approved';
        const phone = pro.phone || (pro as any).mobileNumber || '';
        const isPartial = !pro.img || !pro.phone || !pro.job || (pro as any).isPartial === true;

        list.push({
          id,
          sourceType: 'professional',
          roleType: 'service_provider',
          roleLabel: 'সেবাদাতা / পেশাজীবী',
          name: pro.name || 'নাম নেই',
          phone,
          nid: (pro as any).nidNumber || (pro as any).nid || (pro as any).nid_number || 'জমা দেয়া হয়নি',
          professions: (pro as any).selectedProfessions || [pro.job || 'সেবাদাতা'],
          job: pro.job || 'সার্ভিস প্রোভাইডার',
          location: `${pro.upazila || ''}, ${pro.district || 'খাগড়াছড়ি'}`.trim().replace(/^,\s*/, ''),
          avatar: pro.img || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          isApproved,
          isPartial,
          joinedDate: (pro as any).joinedDate || (pro as any).createdAt || 'সম্প্রতি',
          dailyRate: pro.dailyRate || (pro as any).rate || (pro as any).dailyWage || '৬০০',
          notes: (pro as any).notes || ''
        });
      }
    });

    // 2. Users (Permanent Members and any service providers in users state)
    (users || []).forEach((u) => {
      const id = String(u.id || (u as any).uniqueId || (u as any).memberUID || '');
      if (id && !seenIds.has(id)) {
        const userRole = String((u as any).role || '');
        const isPermanent = userRole === 'member' || userRole === 'permanent' || Boolean((u as any).isPermanentMember);
        const isProvider = userRole === 'professional' || userRole === 'service_provider';

        if (isPermanent || isProvider) {
          seenIds.add(id);
          const isApproved = u.status === 'Approved' || (u as any).isVerified === true || (u as any).verified === true;
          const phone = u.phone || (u as any).mobileNumber || '';
          const isPartial = !u.avatar || !(u as any).nidNumber || (u as any).isPartial === true;

          list.push({
            id,
            sourceType: isPermanent ? 'user_permanent' : 'user_provider',
            roleType: isPermanent ? 'permanent_member' : 'service_provider',
            roleLabel: isPermanent ? 'স্থায়ী সদস্য (Permanent Member)' : 'সেবাদাতা / পেশাজীবী',
            name: u.name || 'নাম নেই',
            phone,
            nid: (u as any).nidNumber || (u as any).nid || (u as any).nid_number || 'জমা দেয়া হয়নি',
            professions: (u as any).selectedProfessions || [u.roleLabelBn || (isPermanent ? 'স্থায়ী সদস্য' : 'সেবাদাতা')],
            job: u.roleLabelBn || (isPermanent ? 'অফিসিয়াল প্রতিনিধি' : 'সেবাদাতা'),
            location: `${u.upazila || ''}, ${u.district || 'খাগড়াছড়ি'}`.trim().replace(/^,\s*/, ''),
            avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            isApproved,
            isPartial,
            joinedDate: (u as any).joinedDate || (u as any).createdAt || 'সম্প্রতি',
            dailyRate: (u as any).dailyRate || 'প্রযোজ্য নয়',
            notes: u.notes || ''
          });
        }
      }
    });

    return list;
  }, [professionals, users]);

  // Statistics
  const stats = useMemo(() => {
    const totalPending = candidates.filter(c => !c.isApproved).length;
    const pendingProviders = candidates.filter(c => !c.isApproved && c.roleType === 'service_provider').length;
    const pendingMembers = candidates.filter(c => !c.isApproved && c.roleType === 'permanent_member').length;
    const approvedTotal = candidates.filter(c => c.isApproved).length;

    return { totalPending, pendingProviders, pendingMembers, approvedTotal };
  }, [candidates]);

  // Filtered candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Filter by category
      if (activeFilter === 'all_pending' && c.isApproved) return false;
      if (activeFilter === 'service_providers' && (c.isApproved || c.roleType !== 'service_provider')) return false;
      if (activeFilter === 'permanent_members' && (c.isApproved || c.roleType !== 'permanent_member')) return false;
      if (activeFilter === 'approved' && !c.isApproved) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone.toLowerCase().includes(q);
        const matchNid = c.nid.toLowerCase().includes(q);
        const matchJob = c.job.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchNid && !matchJob) return false;
      }

      return true;
    });
  }, [candidates, activeFilter, searchQuery]);

  const handleApprove = (c: any) => {
    if (c.sourceType === 'professional') {
      approveProfessional(c.id);
    } else {
      approveUser(c.id);
    }
    showToast(`✅ "${c.name}"-এর প্রোফাইল যাচাইকৃত ও অনুমোদিত হয়েছে! এখন কাস্টমারদের কাছে দৃশ্যমান।`);
  };

  const handleReject = (c: any) => {
    const reason = window.prompt('স্থগিত বা বাতিলের কারণ লিখুন (ঐচ্ছিক):', 'তথ্য অসঙ্গতি / পুনঃযাচাই প্রয়োজন');
    if (reason === null) return; // user cancelled

    if (c.sourceType === 'professional') {
      rejectProfessional(c.id, reason);
    } else {
      rejectUser(c.id, reason);
    }
    showToast(`⚠️ "${c.name}"-এর আবেদন স্থগিত করা হয়েছে।`);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header and Workflow Explanation */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <span>নিবন্ধন ও পরিচয়পত্র যাচাই (Admin Approval System)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              সেবাদাতা ও স্থায়ী সদস্যদের জমা দেওয়া তথ্য, মোবাইল নম্বর এবং NID যাচাই করুন। অ্যাডমিন অনুমোদনের পরই কেবল প্রোফাইলটি কাস্টমার ও পাবলিক সার্চে দৃশ্যমান হবে।
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>{stats.totalPending} জন অপেক্ষমাণ</span>
            </span>
            <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{stats.approvedTotal} জন অনুমোদিত</span>
            </span>
          </div>
        </div>

        {/* Workflow Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={() => setActiveFilter('all_pending')}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeFilter === 'all_pending'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-[11px] font-bold text-slate-500">সকল অপেক্ষমাণ</div>
            <div className="text-xl font-black text-amber-700">{stats.totalPending}</div>
          </button>

          <button
            onClick={() => setActiveFilter('service_providers')}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeFilter === 'service_providers'
                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-blue-600" />
              <span>সেবাদাতা (Pending)</span>
            </div>
            <div className="text-xl font-black text-blue-700">{stats.pendingProviders}</div>
          </button>

          <button
            onClick={() => setActiveFilter('permanent_members')}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeFilter === 'permanent_members'
                ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-400'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Users className="w-3 h-3 text-purple-600" />
              <span>স্থায়ী সদস্য (Pending)</span>
            </div>
            <div className="text-xl font-black text-purple-700">{stats.pendingMembers}</div>
          </button>

          <button
            onClick={() => setActiveFilter('approved')}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeFilter === 'approved'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>অনুমোদিত ও দৃশ্যমান</span>
            </div>
            <div className="text-xl font-black text-emerald-700">{stats.approvedTotal}</div>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="নাম, ফোন নম্বর, এনআইডি নম্বর অথবা পেশা দিয়ে সার্চ করুন..."
          className="w-full text-xs font-medium text-slate-900 focus:outline-none placeholder:text-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-400 hover:text-slate-600 mr-2 cursor-pointer"
          >
            মুছুন
          </button>
        )}
      </div>

      {/* Candidates List / Grid */}
      {filteredCandidates.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">কোনো রেকর্ড পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            বর্তমান ফিল্টারে যাচাইয়ের জন্য কোনো প্রার্থী নেই অথবা সার্চের সাথে মেলেনি।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCandidates.map((c) => {
            const cleanPhone = (c.phone || '').replace(/[\s\-()]/g, '');
            const waPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone.replace(/^0/, '0')}`;

            return (
              <div 
                key={c.id} 
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                {/* Header: Photo, Name, and Role/Status Badges */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={c.avatar} 
                        alt={c.name} 
                        className="w-13 h-13 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm text-slate-900">{c.name}</h3>
                          {c.isPartial && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-500" /> আংশিক তথ্য
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-emerald-700 font-bold mt-0.5">{c.roleLabel}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{c.location || 'খাগড়াছড়ি'}</p>
                      </div>
                    </div>

                    {/* Visibility & Status Tag */}
                    <div>
                      {c.isApproved ? (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> দৃশ্যমান (Live)
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <EyeOff className="w-3.5 h-3.5" /> অপ্রকাশিত (Hidden)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Professions / Skills Chips */}
                  {Array.isArray(c.professions) && c.professions.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {c.professions.map((prof: string, i: number) => (
                        <span 
                          key={i} 
                          className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200"
                        >
                          {prof}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Manual Review Details Box (Phone, NID, Verification) */}
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 space-y-2.5 text-xs">
                    {/* Phone & Direct Dial / WhatsApp */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-900">{c.phone || 'ফোন নেই'}</span>
                      </div>
                      
                      {cleanPhone && (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${cleanPhone}`}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] transition flex items-center gap-1 border border-emerald-200"
                            title="সরাসরি কল দিন"
                          >
                            <Phone className="w-3 h-3" /> কল
                          </a>
                          <a
                            href={`https://wa.me/${waPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 font-bold text-[11px] transition flex items-center gap-1 border border-green-200"
                            title="হোয়াটসঅ্যাপে যোগাযোগ"
                          >
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </a>
                        </div>
                      )}
                    </div>

                    {/* NID Card & Identity Info */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>NID: <strong className="text-slate-900">{c.nid}</strong></span>
                      </div>
                      
                      {c.nid && c.nid !== 'জমা দেয়া হয়নি' && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(c.nid, c.id)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedId === c.id ? 'কপি হয়েছে' : 'কপি'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons: Approve & Publish vs Reject */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500">
                    {c.isApproved ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> কাস্টমার সার্চে লাইভ
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> অনুমোদন ছাড়া গোপন
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!c.isApproved ? (
                      <button
                        onClick={() => handleApprove(c)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Check className="w-4 h-4" /> অনুমোদন ও লাইভ করুন
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReject(c)}
                        className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-rose-200"
                      >
                        <X className="w-3.5 h-3.5" /> স্থগিত করুন
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminApprovalModerationTab;
