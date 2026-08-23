import { useState, useEffect } from 'react';
import { 
  ShoppingCart, Search, MapPin, Clock, 
  CheckCircle2, Plus, Minus, Trash2, ArrowRight, 
  Tag, Receipt, RefreshCw, Sparkles, Truck, ShieldCheck, CreditCard, QrCode, Scan
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface StoreProduct {
  id: string;
  emoji: string;
  nameHi: string;
  nameEn: string;
  weight: string;
  price: number;
  originalPrice?: number;
  category: string;
  inStock: boolean;
  eta?: string;
}

const DEFAULT_STORE_PRODUCTS: StoreProduct[] = [
  { id: 'atta',     emoji: '🌾', nameHi: 'आशीर्वाद चक्की आटा', nameEn: 'Aashirvaad Shudh Chakki Atta', weight: '5 kg', price: 210, originalPrice: 245, category: 'Staples', inStock: true, eta: '15 MINS' },
  { id: 'doodh',    emoji: '🥛', nameHi: 'अमूल ताजा ताजा दूध',   nameEn: 'Amul Taaza Fresh Toned Milk', weight: '1 Litre', price: 62, originalPrice: 68, category: 'Dairy', inStock: true, eta: '10 MINS' },
  { id: 'maggi',    emoji: '🍜', nameHi: 'मैगी 2-मिनट नूडल्स', nameEn: 'Maggi 2-Minute Masala Noodles', weight: '70 g', price: 14, originalPrice: 15, category: 'Snacks', inStock: true, eta: '10 MINS' },
  { id: 'namak',    emoji: '🧂', nameHi: 'टाटा शुद्ध नमक',       nameEn: 'Tata Vacuum Evaporated Salt', weight: '1 kg', price: 25, originalPrice: 28, category: 'Staples', inStock: true, eta: '15 MINS' },
  { id: 'tel',      emoji: '🫙', nameHi: 'फॉर्च्यून रिफाइंड तेल', nameEn: 'Fortune Sunlite Refined Oil', weight: '1 Litre', price: 155, originalPrice: 175, category: 'Staples', inStock: true, eta: '15 MINS' },
  { id: 'chai',     emoji: '🍵', nameHi: 'टाटा टी गोल्ड चाय',   nameEn: 'Tata Tea Gold Rich Aroma', weight: '250 g', price: 160, originalPrice: 180, category: 'Beverages', inStock: true, eta: '15 MINS' },
  { id: 'biscuit',  emoji: '🍪', nameHi: 'पारले-जी ग्लूकोज',     nameEn: 'Parle-G Original Gluco Biscuits', weight: '250 g', price: 20, originalPrice: 25, category: 'Snacks', inStock: true, eta: '10 MINS' },
  { id: 'sabun',    emoji: '🧼', nameHi: 'डव ब्यूटी बाथिंग बार', nameEn: 'Dove Soft Moisture Soap Bar', weight: '100 g', price: 55, originalPrice: 65, category: 'Home Care', inStock: true, eta: '15 MINS' },
  { id: 'makhan',   emoji: '🧈', nameHi: 'अमूल बटर मक्खन',      nameEn: 'Amul Pasteurised Butter', weight: '500 g', price: 275, originalPrice: 295, category: 'Dairy', inStock: true, eta: '10 MINS' },
  { id: 'chawal',   emoji: '🍚', nameHi: 'दावत बासमती चावल',     nameEn: 'Daawat Rozana Basmati Rice', weight: '1 kg', price: 85, originalPrice: 99, category: 'Staples', inStock: true, eta: '15 MINS' },
  { id: 'surf',     emoji: '🫧', nameHi: 'सर्फ एक्सेल मैटिक',     nameEn: 'Surf Excel Easy Wash Detergent', weight: '1 kg', price: 140, originalPrice: 160, category: 'Home Care', inStock: true, eta: '20 MINS' },
  { id: 'daliya',   emoji: '🌻', nameHi: 'केलॉग्स कॉर्नफ्लेक्स',   nameEn: 'Kelloggs Real Almond Cornflakes', weight: '450 g', price: 190, originalPrice: 215, category: 'Snacks', inStock: true, eta: '15 MINS' },
];

interface CartItem {
  product: StoreProduct;
  qty: number;
}

interface PlacedOrder {
  orderId: string;
  items: CartItem[];
  total: number;
  payMode: string;
  status: string;
  riderName: string;
  riderPhone: string;
  time: string;
  eta: string;
}

export function CustomerPortal() {
  const { lang, t } = useLanguage();
  const [customerTab, setCustomerTab] = useState<'shop' | 'orders' | 'khata'>('shop');
  const [products, setProducts] = useState<StoreProduct[]>(DEFAULT_STORE_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState('Ramesh Kumar');
  const [customerPhone, setCustomerPhone] = useState('98111 22334');
  const [customerAddress, setCustomerAddress] = useState('Flat 302, Royal Palms Society, Main Road');
  const [payMethod, setPayMethod] = useState<'cod' | 'upi' | 'khata'>('cod');
  const [isPlacing, setIsPlacing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [orders, setOrders] = useState<PlacedOrder[]>([
    {
      orderId: 'ORD-8821',
      items: [
        { product: DEFAULT_STORE_PRODUCTS[0], qty: 1 },
        { product: DEFAULT_STORE_PRODUCTS[2], qty: 2 }
      ],
      total: 238,
      payMode: 'Cash on Delivery',
      status: 'Out For Delivery',
      riderName: 'Vikram Singh (Rider #4)',
      riderPhone: '+91 98765 43210',
      time: '15 mins ago',
      eta: '10 mins'
    }
  ]);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [khataFilter, setKhataFilter] = useState<'all' | 'pending' | 'paid'>('all');

  useEffect(() => {
    fetchBackendInventory();
    fetchBackendOrders();
  }, []);

  const fetchBackendInventory = async () => {
    try {
      const res = await fetch('http://localhost:3500/api/inventory');
      if (res.ok) {
        const data = await res.json();
        if (data.products && Array.isArray(data.products)) {
          const mapped = data.products.map((p: any) => ({
            id: p.id,
            emoji: p.emoji || '📦',
            nameHi: p.name,
            nameEn: p.name,
            weight: p.unit || '1 unit',
            price: p.sellingPrice || 100,
            originalPrice: Math.round((p.sellingPrice || 100) * 1.15),
            category: p.category || 'Staples',
            inStock: p.currentStock > 0,
            eta: '15 MINS'
          }));
          if (mapped.length > 0) setProducts(mapped);
        }
      }
    } catch {
      // Offline fallback
    }
  };

  const fetchBackendOrders = async () => {
    try {
      const res = await fetch('http://localhost:3500/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (data.orders && Array.isArray(data.orders)) {
          const userOrders = data.orders.slice(0, 5).map((o: any) => ({
            orderId: o.orderId || 'ORD-999',
            items: (o.items || []).map((it: any) => ({
              product: {
                id: it.id || 'item',
                emoji: it.emoji || '📦',
                nameHi: it.name || 'Grocery Item',
                nameEn: it.name || 'Grocery Item',
                weight: '1 unit',
                price: it.price || 50,
                category: 'Staples',
                inStock: true,
                eta: '15 MINS'
              },
              qty: it.qty || 1
            })),
            total: o.total || 150,
            payMode: o.paymentMethod || 'Cash on Delivery',
            status: o.status || 'Received',
            riderName: o.riderName || 'Vikram Singh (Rider #4)',
            riderPhone: o.riderPhone || '+91 98765 43210',
            time: 'Recently',
            eta: '15-20 mins'
          }));
          if (userOrders.length > 0) setOrders(userOrders);
        }
      }
    } catch {
      // Offline fallback
    }
  };

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const freeDeliveryThreshold = 299;
  const deliveryFee = subtotal >= freeDeliveryThreshold || subtotal === 0 ? 0 : 25;
  const finalTotal = Math.max(0, subtotal + deliveryFee - appliedDiscount);
  const totalItemCount = cart.reduce((s, i) => s + i.qty, 0);
  const amountNeededForFreeShip = Math.max(0, freeDeliveryThreshold - subtotal);

  const addToCart = (product: StoreProduct) => {
    setCart(prev => {
      const exists = prev.find(i => i.product.id === product.id);
      if (exists) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(i => i.product.id === id ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0)
    );
  };

  const applyCoupon = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'WELCOME50') {
      setAppliedDiscount(50);
      setPromoMessage(t('🎉 ₹50 की छूट लागू हो गई!', '🎉 ₹50 discount applied!'));
    } else if (code === 'OBSIDIAN') {
      const disc = Math.round(subtotal * 0.15);
      setAppliedDiscount(disc);
      setPromoMessage(t(`🎉 15% छूट (₹${disc}) लागू!`, `🎉 15% discount (₹${disc}) applied!`));
    } else if (code === 'FREESHIP') {
      setAppliedDiscount(deliveryFee);
      setPromoMessage(t('🎉 मुफ्त डिलीवरी लागू!', '🎉 Free delivery applied!'));
    } else {
      setPromoMessage(t('❌ अमान्य कूपन कोड', '❌ Invalid promo code'));
    }
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (payMethod === 'khata' && finalTotal > 3000) {
      alert(t('उधार खाते की सीमा ₹3000 है। कृपया नकद या UPI चुनें।', 'Khata Credit limit is ₹3000. Please select COD or UPI.'));
      return;
    }
    setIsPlacing(true);

    const orderPayload = {
      customerName,
      customerPhone,
      address: customerAddress,
      items: cart.map(i => ({
        productId: i.product.id,
        name: i.product.nameHi,
        emoji: i.product.emoji,
        qty: i.qty,
        price: i.product.price
      })),
      total: finalTotal,
      payMode: payMethod === 'cod' ? 'Cash on Delivery' : payMethod === 'upi' ? 'UPI Online' : 'Udhar Khata'
    };

    try {
      await fetch('http://localhost:3500/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
    } catch {
      // Offline support
    }

    const newOrder: PlacedOrder = {
      orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      items: [...cart],
      total: finalTotal,
      payMode: payMethod === 'cod' ? t('नकद डिलीवरी (COD)', 'Cash on Delivery') : payMethod === 'upi' ? 'UPI Online' : t('उधार खाता', 'Udhar Khata'),
      status: 'Received',
      riderName: 'Vikram Singh (Rider #4)',
      riderPhone: '+91 98765 43210',
      time: 'Just now',
      eta: '20 mins'
    };

    setOrders(prev => [newOrder, ...prev]);
    setShowOrderSuccess(true);
    setCart([]);
    setShowCheckout(false);
    setIsPlacing(false);

    setTimeout(() => {
      setShowOrderSuccess(false);
      setCustomerTab('orders');
    }, 2400);
  };

  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      handlePlaceOrder();
      setIsScanning(false);
    }, 1500);
  };

  const categories = [
    { id: 'all', label: t('सभी सामान', 'All Items'), emoji: '🛒' },
    { id: 'Staples', label: t('राशन व अनाज', 'Staples & Atta'), emoji: '🌾' },
    { id: 'Dairy', label: t('दूध व मक्खन', 'Dairy & Milk'), emoji: '🥛' },
    { id: 'Snacks', label: t('नाश्ता व मैगी', 'Snacks & Noodles'), emoji: '🍜' },
    { id: 'Beverages', label: t('चाय व पेय', 'Tea & Coffee'), emoji: '🍵' },
    { id: 'Home Care', label: t('घरेलू सफाई', 'Home Care & Soaps'), emoji: '🧼' }
  ];

  const filtered = products.filter(p => {
    const matchesSearch = p.nameHi.includes(searchQuery) || p.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-36">
      {/* Order Confirmed Flash Animation */}
      {showOrderSuccess && (
        <div className="fullscreen-success">
          <div className="success-content">
            <div className="success-emoji">🛵</div>
            <div className="success-title">{t('ऑर्डर दर्ज हो गया!', 'Order Confirmed!')}</div>
            <div className="success-sub">
              {t('दुकानदार आपका सामान पैक कर रहे हैं • 15 मिनट में डिलीवरी', 'Your order is being packed • 15 mins delivery')}
            </div>
          </div>
        </div>
      )}

      {/* ─── Hero Store Header Banner (Amazon Fresh & Blinkit style) ─── */}
      <div className="pro-card-box bg-gradient-to-r from-emerald-950/60 via-slate-900/90 to-teal-950/60 border border-emerald-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 bg-emerald-500/15 rounded-2xl border border-emerald-500/30">🏪</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-100 tracking-tight">
                  VyaparSync Kirana
                </h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {t('🟢 खुली है', '🟢 OPEN')}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Clock size={13} /> {t('⚡ 10-15 मिनट सुपरफास्ट डिलीवरी', '⚡ 10-15 Min Superfast Delivery')}
                </span>
                <span>•</span>
                <span className="text-slate-400 flex items-center gap-1">
                  <MapPin size={13} /> {customerAddress.split(',')[0]}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Customer Sub-Nav Tabs */}
        <div className="flex gap-2.5 w-full md:w-auto overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setCustomerTab('shop')}
            className={`category-box-btn ${customerTab === 'shop' ? 'category-box-active' : ''}`}
          >
            🛒 {t('दुकान (सामान)', 'Storefront')}
          </button>
          <button
            onClick={() => setCustomerTab('orders')}
            className={`category-box-btn relative ${customerTab === 'orders' ? 'category-box-active' : ''}`}
          >
            📦 {t('मेरे ऑर्डर्स', 'My Orders')}
            {orders.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-1 -right-1"></span>
            )}
          </button>
          <button
            onClick={() => setCustomerTab('khata')}
            className={`category-box-btn ${customerTab === 'khata' ? 'category-box-active' : ''}`}
          >
            📒 {t('मेरा उधार खाता', 'My Khata Passbook')}
          </button>
        </div>
      </div>

      {/* VIEW 1: STOREFRONT & PRODUCTS */}
      {customerTab === 'shop' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Main Catalog Area */}
          <div className="flex-1 w-full min-w-0">
            {/* Promo Box Banner */}
            <div className="pro-card-box bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900/80 border border-blue-500/30 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-500/30">
                  <Tag size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-blue-200">
                    {promoMessage || t('कूपन कोड WELCOME50 लगाएं और पाएं ₹50 की सीधी छूट!', 'Use promo code WELCOME50 for ₹50 instant discount!')}
                  </div>
                  <div className="text-[10px] text-blue-400/80 mt-0.5">
                    {t('न्यूनतम ऑर्डर ₹199 • नए ग्राहकों के लिए', 'Min order ₹199 • For all shoppers')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setPromoCode('WELCOME50');
                  applyCoupon();
                }}
                className="text-xs font-bold text-blue-200 hover:text-white bg-blue-600/30 hover:bg-blue-600/50 px-3.5 py-1.5 rounded-xl border border-blue-500/40 transition-all"
              >
                {t('कूपन लगाएं', 'Apply')}
              </button>
            </div>

            {/* Search & Categories Inline Row */}
            <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-none mb-4 items-center">
              {/* Search Bar */}
              <div className="relative shrink-0 w-[180px]">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  className="curvy-search-box w-full pl-9 pr-3 py-2 text-sm placeholder-slate-400 outline-none"
                  placeholder={t('🔍 खोजें...', '🔍 Search...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category Box Slider */}
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`category-box-btn shrink-0 ${selectedCategory === cat.id ? 'category-box-active' : ''}`}
                >
                  <span className="text-base">{cat.emoji}</span>
                  <span className="font-bold">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* ─── Side-by-Side Horizontal Product Grid (Forced 2 Column) ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {filtered.map(product => {
                const inCart = cart.find(i => i.product.id === product.id);
                const discountPct = product.originalPrice 
                  ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                  : 0;

                return (
                  <div key={product.id} className="pro-card-box-horizontal">
                    {/* Left: Compact Image Stage with ETA badge */}
                    <div className="pro-img-stage-horizontal">
                      <span className="item-emoji">{product.emoji}</span>
                      <div className="eta-tag-compact">
                        ⚡ {product.eta || '15 MINS'}
                      </div>
                    </div>

                    {/* Right: Product Info & Actions Side-by-Side */}
                    <div className="pro-info-col">
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-extrabold text-sm text-white line-clamp-1 leading-tight tracking-tight">
                            {lang === 'en' ? product.nameEn : product.nameHi}
                          </h4>
                          {discountPct > 0 && (
                            <span className="discount-badge-compact">
                              {discountPct}% OFF
                            </span>
                          )}
                        </div>
                        <div className="product-weight-text mt-0.5">
                          {product.weight}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80">
                        <div className="flex items-baseline">
                          <span className="product-price-text">
                            ₹{product.price}
                          </span>
                          {product.originalPrice && (
                            <span className="product-mrp-text ml-1.5">
                              ₹{product.originalPrice}
                            </span>
                          )}
                        </div>

                        {/* Stepper / + ADD */}
                        {inCart ? (
                          <div className="blinkit-stepper-compact">
                            <button onClick={() => changeQty(product.id, -1)} className="blinkit-step-btn-compact">
                              <Minus size={11} />
                            </button>
                            <span className="text-xs font-black min-w-[14px] text-center">{inCart.qty}</span>
                            <button onClick={() => changeQty(product.id, +1)} className="blinkit-step-btn-compact">
                              <Plus size={11} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            className="blinkit-add-btn-compact"
                          >
                            <Plus size={12} />
                            <span>{t('ADD', 'ADD')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Customer Live Cart Drawer (Desktop Sticky Box) ─── */}
          <div className="w-full lg:w-96 shrink-0 lg:sticky lg:top-20 hidden lg:block">
            <div className="pro-card-box bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-emerald-400" />
                  <span className="font-bold text-base text-slate-100">{t('आपका थैला', 'My Cart')}</span>
                </div>
                <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  {totalItemCount} {t('सामान', 'Items')}
                </span>
              </div>

              {/* Free Delivery Threshold Bar */}
              {subtotal > 0 && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                  {amountNeededForFreeShip > 0 ? (
                    <div className="text-xs text-slate-300">
                      🚚 {t('मुफ्त डिलीवरी के लिए ₹', 'Add ₹')}<span className="text-emerald-400 font-bold">{amountNeededForFreeShip}</span> {t('का और सामान जोड़ें', 'more for FREE Delivery')}
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, (subtotal / freeDeliveryThreshold) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                      <Sparkles size={14} /> {t('बधाई! आपके ऑर्डर पर मुफ्त डिलीवरी लागू है 🎉', 'Congratulations! FREE Delivery Unlocked 🎉')}
                    </div>
                  )}
                </div>
              )}

              {/* Cart Items List */}
              {cart.length > 0 ? (
                <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="text-2xl p-1 bg-slate-900 rounded-lg shrink-0">{item.product.emoji}</span>
                      <div className="flex-1 min-w-0 min-w-[100px]">
                        <div className="text-xs font-bold text-slate-200 truncate">
                          {lang === 'en' ? item.product.nameEn : item.product.nameHi}
                        </div>
                        <div className="text-[10px] text-secondary">₹{item.product.price} × {item.qty}</div>
                      </div>
                      
                      {/* Price and Stepper Side-by-Side */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-xs font-black text-emerald-400 min-w-[35px] text-right">
                          ₹{item.product.price * item.qty}
                        </div>
                        
                        <div className="blinkit-stepper-compact">
                          <button onClick={() => changeQty(item.product.id, -1)} className="blinkit-step-btn-compact"><Minus size={11} /></button>
                          <span className="text-xs font-black min-w-[14px] text-center">{item.qty}</span>
                          <button onClick={() => changeQty(item.product.id, +1)} className="blinkit-step-btn-compact"><Plus size={11} /></button>
                        </div>
                        
                        <button onClick={() => setCart(c => c.filter(i => i.product.id !== item.product.id))} className="text-rose-400 hover:text-rose-300">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="text-5xl mb-2">🛒</div>
                  <div className="text-sm font-bold text-slate-300">{t('थैला खाली है', 'Your Cart is Empty')}</div>
                  <div className="text-xs text-secondary mt-1">{t('सामान चुनकर थैले में डालें', 'Add grocery items to order')}</div>
                </div>
              )}

              {/* Bill Details */}
              {cart.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-800 text-xs">
                  <div className="flex justify-between text-secondary">
                    <span>{t('सामान का मूल्य', 'Item Total')}</span>
                    <span>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-secondary">
                    <span>{t('डिलीवरी पार्टनर शुल्क', 'Delivery Fee')}</span>
                    <span>{deliveryFee === 0 ? <span className="text-emerald-400 font-bold">{t('मुफ्त (FREE)', 'FREE')}</span> : `₹${deliveryFee}`}</span>
                  </div>
                  {appliedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>{t('कूपन डिस्काउंट', 'Promo Discount')}</span>
                      <span>-₹{appliedDiscount}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-700 text-base font-black text-slate-100">
                    <span>{t('कुल देय राशि', 'To Pay')}</span>
                    <span className="text-xl text-emerald-400">₹{finalTotal.toLocaleString('en-IN')}</span>
                  </div>

                  {/* Checkout Button */}
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="category-box-btn category-box-active w-full justify-center py-3.5 shadow-2xl shadow-emerald-500/20"
                  >
                    <span className="text-sm font-black">{t('ऑर्डर पूरा करें', 'Proceed to Checkout')}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CUSTOMER MY ORDERS */}
      {customerTab === 'orders' && (
        <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              📦 {t('मेरे हालिया ऑर्डर्स', 'My Recent Orders')}
            </h3>
            <button className="btn btn-outline text-xs" onClick={fetchBackendOrders}>
              <RefreshCw size={13} /> {t('ताज़ा करें', 'Refresh')}
            </button>
          </div>

          {orders.map(ord => (
            <div key={ord.orderId} className="pro-card-box flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-base text-slate-100">{ord.orderId}</div>
                  <div className="text-xs text-secondary mt-0.5">{ord.time} • {ord.payMode}</div>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  {ord.status}
                </span>
              </div>

              {/* Order Tracking Progress Bar */}
              <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 my-1">
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>🛵 {ord.riderName}</span>
                  <span className="text-emerald-400 font-bold">ETA: {ord.eta}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full w-3/4 rounded-full animate-pulse"></div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-1 text-xs text-slate-300">
                {ord.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.product.emoji} {item.product.nameHi} × {item.qty}</span>
                    <span>₹{item.product.price * item.qty}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-bold text-sm">
                <span>{t('कुल बिल', 'Total Bill')}</span>
                <span className="text-emerald-400">₹{ord.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 3: CUSTOMER KHATA PASSBOOK */}
      {customerTab === 'khata' && (
        <div className="flex flex-col gap-5 max-w-3xl mx-auto w-full">
          <div className="pro-card-box bg-gradient-to-br from-orange-950/50 via-amber-950/30 to-slate-900/80 border border-orange-500/30 p-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs uppercase font-bold text-orange-300">{t('दुकानदार से आपका उधार खाता', 'Your Khata Balance')}</div>
                <div className="text-3xl font-black text-orange-400 mt-2">₹850</div>
                <div className="text-xs text-slate-300 mt-1">{t('अंतिम खरीदारी: 5 दिन पहले (आटा + तेल)', 'Last purchase: 5 days ago (Atta + Oil)')}</div>
              </div>
              <div className="text-4xl">📒</div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-orange-500/20">
              <button className="btn text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl">
                📱 {t('UPI से तुरंत चुकता करें (GPay/PhonePe)', 'Pay Dues via UPI')}
              </button>
              <button className="btn btn-outline text-xs rounded-xl">
                📲 {t('दुकानदार से WhatsApp पर पूछें', 'Ask on WhatsApp')}
              </button>
            </div>
          </div>

          <div className="pro-card-box">
            <h4 className="font-bold text-sm text-slate-100 mb-3">{t('हालिया खाता लेनदेन (Passbook History)', 'Passbook History')}</h4>

            {/* Filter Tabs for Passbook */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none mb-4">
              <button 
                onClick={() => setKhataFilter('all')}
                className={`category-box-btn shrink-0 ${khataFilter === 'all' ? 'category-box-active' : ''}`}
              >
                {t('सभी', 'All')}
              </button>
              <button 
                onClick={() => setKhataFilter('pending')}
                className={`category-box-btn shrink-0 ${khataFilter === 'pending' ? 'category-box-active' : ''}`}
              >
                {t('बकाया', 'Pending')}
              </button>
              <button 
                onClick={() => setKhataFilter('paid')}
                className={`category-box-btn shrink-0 ${khataFilter === 'paid' ? 'category-box-active' : ''}`}
              >
                {t('चुकता', 'Paid')}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {(khataFilter === 'all' || khataFilter === 'pending') && (
                <>
                  <div className="flex justify-between items-center p-3 bg-slate-950/70 rounded-xl border border-slate-800">
                    <div>
                      <div className="font-semibold text-slate-200">🌾 5kg Atta + 1L Fortune Oil</div>
                      <div className="text-[10px] text-secondary">18 Aug • Credit Purchase (उधार)</div>
                    </div>
                    <span className="font-bold text-orange-400">+₹365</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-950/70 rounded-xl border border-slate-800">
                    <div>
                      <div className="font-semibold text-slate-200">🥛 Amul Milk + Bread</div>
                      <div className="text-[10px] text-secondary">15 Aug • Credit Purchase (उधार)</div>
                    </div>
                    <span className="font-bold text-orange-400">+₹117</span>
                  </div>
                </>
              )}

              {(khataFilter === 'all' || khataFilter === 'paid') && (
                <div className="flex justify-between items-center p-3 bg-emerald-950/30 rounded-xl border border-emerald-500/20">
                  <div>
                    <div className="font-semibold text-emerald-300">💵 UPI Payment Received (चुकता)</div>
                    <div className="text-[10px] text-emerald-400/80">10 Aug • Paid to Seth Ji</div>
                  </div>
                  <span className="font-bold text-emerald-400">-₹500</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── CHECKOUT MODAL (Pro Boxed Layout) ─── */}
      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Receipt size={20} className="text-emerald-400" />
              {t('डिलीवरी व भुगतान विवरण', 'Delivery & Payment Checkout')}
            </h3>

            {/* Delivery Address Form */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-secondary font-bold uppercase">{t('आपका नाम', 'Your Name')}</label>
                <input
                  className="input-field mt-1 text-xs"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-secondary font-bold uppercase">{t('मोबाइल नंबर', 'Phone Number')}</label>
                <input
                  className="input-field mt-1 text-xs"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-secondary font-bold uppercase">{t('डिलीवरी पता', 'Delivery Address')}</label>
                <input
                  className="input-field mt-1 text-xs"
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="mb-4">
              <label className="text-xs text-secondary font-bold uppercase mb-2 block">{t('भुगतान का तरीका', 'Payment Method')}</label>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setPayMethod('cod')}
                  className={`category-box-btn shrink-0 ${payMethod === 'cod' ? 'category-box-active' : ''}`}
                >
                  <Truck size={16} />
                  <span>{t('COD नकद', 'Cash on Delivery')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('upi')}
                  className={`category-box-btn shrink-0 ${payMethod === 'upi' ? 'category-box-active' : ''}`}
                >
                  <CreditCard size={16} />
                  <span>UPI / QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('khata')}
                  className={`category-box-btn shrink-0 ${payMethod === 'khata' ? 'category-box-active' : ''}`}
                >
                  <ShieldCheck size={16} />
                  <div className="flex flex-col items-start gap-0.5">
                    <span>{t('उधार खाता', 'Khata Credit')}</span>
                    {finalTotal > 3000 && <span className="text-[9px] text-rose-400 font-bold whitespace-nowrap">{t('केवल ₹3000 तक', 'Max ₹3K limit')}</span>}
                  </div>
                </button>
              </div>
              
              {/* Warning for Khata Limit Exceeded */}
              {payMethod === 'khata' && finalTotal > 3000 && (
                <div className="text-xs text-rose-500 font-bold mt-2 flex items-center gap-1.5 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  <span className="text-base">⚠️</span>
                  {t('ऑर्डर की राशि ₹3000 से अधिक है। कृपया नकद या UPI चुनें।', 'Cart total exceeds Khata limit of ₹3000. Please select Cash or UPI.')}
                </div>
              )}
            </div>

            {/* UPI QR Code Container */}
            {payMethod === 'upi' && (
              <div className="p-4 bg-slate-900 rounded-xl border border-blue-500/30 flex flex-col items-center justify-center mb-4 animation-fade-in relative overflow-hidden">
                <div className="text-sm font-bold text-slate-100 mb-1">{t('दुकानदार को भुगतान करें', 'Pay the Shopkeeper')}</div>
                <div className="text-xs text-blue-300 font-mono mb-3 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">vyaparsync@ybl</div>
                
                <button 
                  onClick={handleSimulateScan}
                  disabled={isScanning}
                  className="bg-white p-3 rounded-2xl cursor-pointer hover:scale-105 transition-transform border-4 border-blue-500/30 shadow-lg shadow-blue-500/20 relative group"
                >
                  <QrCode size={120} className="text-slate-900" />
                  
                  {isScanning && (
                    <div className="absolute inset-0 bg-white/80 rounded-xl flex flex-col items-center justify-center text-blue-600">
                      <Scan size={32} className="animate-pulse" />
                      <span className="text-[10px] font-black mt-1 uppercase tracking-wider animate-pulse">{t('स्कैन हो रहा है...', 'Scanning...')}</span>
                    </div>
                  )}

                  {!isScanning && (
                    <div className="absolute inset-0 bg-blue-600/90 rounded-xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Scan size={32} className="text-white mb-1" />
                      <span className="text-white text-[10px] font-bold text-center px-2">{t('स्कैन सिमुलेट करने के लिए क्लिक करें', 'Click to Simulate Scan')}</span>
                    </div>
                  )}
                </button>
                
                <div className="text-[10px] text-secondary mt-3 text-center px-4">
                  {t('अपने फ़ोन से इसे स्कैन करें। (डेमो के लिए, बस QR पर क्लिक करें)', 'Scan this with your phone. (For demo, just click the QR)')}
                </div>
              </div>
            )}

            {/* Promo Code Input */}
            <div className="mb-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <label className="text-xs text-secondary font-bold uppercase mb-2 block">{t('प्रोमो कोड', 'Promo Code')}</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={t('यहाँ टाइप करें (उदा: OBSIDIAN)', 'Type here (e.g. OBSIDIAN)')}
                  value={promoCode} 
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="input-field text-xs flex-1 uppercase"
                />
                <button onClick={applyCoupon} className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 rounded-xl shadow-lg shadow-emerald-600/20">
                  {t('लागू करें', 'Apply')}
                </button>
              </div>
              {promoMessage && <div className={`text-[10px] mt-1.5 font-bold ${promoMessage.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{promoMessage}</div>}
            </div>

            {/* Final Total Banner */}
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center mb-4">
              <span className="text-xs text-secondary">{t('कुल देय राशि', 'Total Payable')}</span>
              <span className="text-xl font-black text-emerald-400">₹{finalTotal.toLocaleString('en-IN')}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline text-xs" onClick={() => setShowCheckout(false)} disabled={isPlacing}>
                {t('वापस', 'Back')}
              </button>
              {payMethod !== 'upi' && (
                <button
                  className="btn text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 disabled:opacity-50"
                  onClick={handlePlaceOrder}
                  disabled={isPlacing || (payMethod === 'khata' && finalTotal > 3000)}
                >
                  <CheckCircle2 size={16} />
                  {isPlacing ? t('ऑर्डर भेजा जा रहा है...', 'Placing Order...') : t('ऑर्डर पक्का करें!', 'Confirm Order Now!')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
