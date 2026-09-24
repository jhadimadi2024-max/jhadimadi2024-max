import React, { useState } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku?: string;
}

interface CartDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  clearCart: () => void;
}

export const CartDrawerModal: React.FC<CartDrawerModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  clearCart,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedCourier, setSelectedCourier] = useState('সুন্দরবন কুরিয়ার সার্ভিস');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerPhone.trim()) {
      alert('দয়া করে আপনার নাম এবং মোবাইল নম্বর লিখুন।');
      return;
    }

    if (cartItems.length === 0) {
      alert('আপনার কার্ট খালি রয়েছে!');
      return;
    }

    setIsSubmitting(true);
    
    // আপনার নতুন এবং আপডেট করা গুগল শিট এপিআই ইউআরএল
    const scriptURL = "https://script.google.com/macros/s/AKfycbybXu6m23mXqNcXwu3yuRavgTg-smwNwJW0e3zO9k6RmXMUCdbv7eMEn4INPe_9fTOVbg/exec";

    try {
      const itemsDescription = cartItems
        .map((item) => `${item.name} (${item.quantity} kg/pcs)`)
        .join(', ');

      const orderData = {
        name: customerName,
        phone: customerPhone,
        address: customerAddress || 'প্রযোজ্য নয়',
        items: itemsDescription,
        totalAmount: totalAmount,
        courier: selectedCourier,
        date: new Date().toLocaleString(),
      };

      await fetch(scriptURL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      alert("অভিনন্দন! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে এবং ডাটাবেজে রেকর্ড হয়েছে।");
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      onClose();
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("অর্ডার জমা দিতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50 flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-xl flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
        
        {/* Header */}
        <div>
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-xl font-bold text-gray-800">আপনার কার্ট</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-lg font-bold"
            >
              ✕
            </button>
          </div>

          {/* Cart Items List */}
          <div className="mt-4 space-y-4 max-h-60 overflow-y-auto">
            {cartItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">কার্টে কোনো পণ্য নেই।</p>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">{item.name}</h4>
                    <p className="text-sm text-gray-600">৳ {item.price} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                    >
                      -
                    </button>
                    <span className="font-medium">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                    >
                      +
                    </button>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-red-500 hover:text-red-700 ml-2 text-sm"
                    >
                      রিমুভ
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Checkout Section */}
        <div className="mt-6 border-t pt-4">
          <div className="flex justify-between items-center mb-4 text-lg font-bold">
            <span>মোট টাকা:</span>
            <span className="text-emerald-600">৳ {totalAmount}</span>
          </div>

          <form onSubmit={handleSubmitOrder} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">আপনার নাম</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                placeholder="পূর্ণ নাম লিখুন"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">মোবাইল নম্বর</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
                placeholder="০১XXXXXXXXX"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ডেলিভারি ঠিকানা</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="এলাকা ও ঠিকানা লিখুন"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">কুরিয়ার সার্ভিস</label>
              <select
                value={selectedCourier}
                onChange={(e) => setSelectedCourier(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="সুন্দরবন কুরিয়ার সার্ভিস">সুন্দরবন কুরিয়ার সার্ভিস</option>
                <option value="এসএ পরিবহন">এসএ পরিবহন</option>
                <option value="করতোয়া কুরিয়ার">করতোয়া কুরিয়ার</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || cartItems.length === 0}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition duration-200 disabled:opacity-50 mt-4"
            >
              {isSubmitting ? 'অর্ডার প্রসেস হচ্ছে...' : 'অর্ডার কনফার্ম করুন'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};