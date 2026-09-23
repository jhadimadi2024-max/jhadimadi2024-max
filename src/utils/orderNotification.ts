/**
 * Order Notification & WhatsApp Messaging Utilities
 * 
 * Handles formatting and dispatching instant WhatsApp notifications to the 
 * official admin WhatsApp hotline (+8801870592699) upon customer checkout.
 */

export const ADMIN_WHATSAPP_NUMBER = '8801870592699';
export const ADMIN_PHONE_DISPLAY = '+8801870592699';

export interface OrderWhatsAppDetails {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  productName: string;
  productCode: string;
  quantity: string | number;
  totalPrice: string | number;
  paymentMethod: string;
}

/**
 * Formats the exact order summary message for WhatsApp as strictly required:
 * 🛒 নতুন অর্ডার এসেছে!
 * নাম: [Customer Name]
 * ফোন: [Phone]
 * ঠিকানা: [Address]
 * প্রোডাক্ট: [Product Name] (কোড: [Product Code])
 * পরিমাণ: [Quantity]
 * মোট মূল্য: [Total Price] টাকা
 * পেমেন্ট: [Payment Method]
 */
export function formatWhatsAppOrderMessage(order: OrderWhatsAppDetails): string {
  const cleanName = (order.customerName || 'সম্মানিত ক্রেতা').trim();
  const cleanPhone = (order.customerPhone || '').trim();
  const cleanAddress = (order.deliveryAddress || 'ঠিকানা দেওয়া হয়নি').trim();
  const cleanProduct = (order.productName || 'ঝাদিমাদি অর্গানিক পণ্য').trim();
  const cleanCode = (order.productCode || 'JDM-001').trim();
  const cleanQty = String(order.quantity || '১').trim();
  const cleanPrice = String(order.totalPrice || '০').replace(/[^0-9.]/g, '') || String(order.totalPrice);
  const cleanPayment = (order.paymentMethod || 'ক্যাশ অন ডেলিভারি (COD)').trim();

  return `🛒 নতুন অর্ডার এসেছে!
নাম: ${cleanName}
ফোন: ${cleanPhone}
ঠিকানা: ${cleanAddress}
প্রোডাক্ট: ${cleanProduct} (কোড: ${cleanCode})
পরিমাণ: ${cleanQty}
মোট মূল্য: ${cleanPrice} টাকা
পেমেন্ট: ${cleanPayment}`;
}

/**
 * Builds the direct WhatsApp click-to-chat URL for admin
 */
export function buildAdminWhatsAppUrl(order: OrderWhatsAppDetails): string {
  const messageText = formatWhatsAppOrderMessage(order);
  return `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(messageText)}`;
}

/**
 * Triggers direct redirect or popup window to admin WhatsApp
 */
export function triggerAdminWhatsAppNotification(order: OrderWhatsAppDetails): string {
  const url = buildAdminWhatsAppUrl(order);
  try {
    if (typeof window !== 'undefined') {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      // If popup blocker intervened, log info
      if (!opened) {
        console.info('[WhatsApp Notification] Direct popup blocked, caller can supply click button:', url);
      }
    }
  } catch (err) {
    console.warn('[WhatsApp Notification] Error opening window:', err);
  }
  return url;
}
