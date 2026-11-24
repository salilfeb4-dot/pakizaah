import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Menu, X, Instagram, Search, Play, ArrowRight, Mail, MapPin, PhoneCall, ChevronDown, Settings, LogIn, Save, Plus, Minus, ZoomIn, ZoomOut, Trash2, Upload, Phone, Link2, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { cn } from './lib/utils';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, writeBatch, deleteDoc, getDocFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import {
  ShoppingPoliciesSection,
  WhatsAppInquiryModal,
  PAKIZAAH_POLICIES,
  PAKIZAAH_POLICIES_WHATSAPP_MESSAGE,
  PAKIZAAH_ORDER_WHATSAPP_DISPLAY,
  PAKIZAAH_INQUIRY_WHATSAPP_DIGITS,
  buildWhatsAppLink,
  buildProductInquiryMessage,
} from './components/ShoppingPolicies';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const storage = getStorage(app);

// --- Firestore Error Handler ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

const safeStringify = (obj: any) => {
  const cache = new WeakSet();
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return "[Circular]";
        }
        cache.add(value);
      }
      return value;
    });
  } catch (err) {
    console.error("Critical stringify failure:", err);
    return "[Non-serializable object]";
  }
};

const deepSafeCopy = (obj: any) => {
  if (!obj) return obj;
  try {
    return JSON.parse(safeStringify(obj));
  } catch (e) {
    console.error("Failed to create safe copy:", e);
    return {};
  }
};

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  const stringifiedInfo = safeStringify(errInfo);
  console.error('Firestore Error:', stringifiedInfo);
  throw new Error(stringifiedInfo);
}

// Check Firestore connection on boot
const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
};
testConnection();

// --- Types & Constants ---
interface AppConfig {
  heroSlides: string[];
  logoUrl: string;
  artisanImage: string;
  jewelryImage: string;
  videoUrl: string;
  popupImageUrl?: string;
  popupEnabled?: boolean;
}

const sanitizeMediaUrl = (url: any, isVideoAlt: boolean = false) => {
  if (!url || typeof url !== 'string') return "";
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  const isVideo = isVideoAlt || lower.match(/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i) || (lower.includes('firebasestorage') && lower.includes('.mp4'));
  
  if (trimmed.includes('drive.google.com') || trimmed.includes('googledrive.com') || trimmed.includes('googleusercontent.com')) {
    const id = extractDriveId(trimmed);
    if (id) {
      if (isVideo) {
        return `https://drive.google.com/uc?id=${id}&export=download`;
      }
      // Use direct Google CDN (lh3.googleusercontent.com) which avoids 302 redirects, cross-origin/iframe blocks, and cookie restrictions
      return `https://lh3.googleusercontent.com/d/${id}=w1600`;
    }
  }
  
  return trimmed;
};

const extractDriveId = (url: string) => {
  if (!url) return null;
  const trimmed = url.trim();
  // Try /d/ first (supports /file/d/ID and /d/ID)
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
  if (dMatch) return dMatch[1];
  // Try id= next (supports ?id=ID and &id=ID)
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
  if (idMatch) return idMatch[1];
  // Try googleusercontent direct URL pattern
  const ucMatch = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{25,})/);
  if (ucMatch) return ucMatch[1];
  // Fallback: any 25+ char token if it's a google domain
  if (trimmed.includes('drive.google.com') || trimmed.includes('googledrive.com') || trimmed.includes('googleusercontent.com')) {
    const fallbackMatch = trimmed.match(/([a-zA-Z0-9_-]{25,})/);
    if (fallbackMatch) return fallbackMatch[1];
  }
  return null;
};

const sortProducts = (list: any[]) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const getSortValue = (p: any) => {
      if (!p) return 0;
      if (typeof p.createdAt === 'number') {
        return p.createdAt;
      }
      if (typeof p.id === 'string' && p.id.startsWith('p-')) {
        const parts = p.id.split('-');
        const ts = parseInt(parts[1], 10);
        if (!isNaN(ts)) {
          return ts;
        }
      }
      if (typeof p.id === 'string' && p.id.startsWith('h')) {
        const num = parseInt(p.id.substring(1), 10);
        if (!isNaN(num)) {
          return 1000 - num;
        }
      }
      return 0;
    };

    return getSortValue(b) - getSortValue(a);
  });
};

const getWhatsAppUrl = (product: any) => {
  const text = buildProductInquiryMessage([product], sanitizeMediaUrl, {
    includePolicies: true,
  });
  return buildWhatsAppLink(PAKIZAAH_INQUIRY_WHATSAPP_DIGITS, text);
};

const DEFAULT_CONFIG: AppConfig = {
  heroSlides: [
    "https://drive.google.com/file/d/1IbMx_lfkeHHLZwjJBhQhonasba7bhkhh/view?usp=drive_link",
    "https://drive.google.com/file/d/1jefw876y6TDHEs4Go8ivAfrvr2C-T-C2/view?usp=sharing",
    "https://drive.google.com/file/d/1JByyw6-A8hDKk39a2PRaX_wtfKQ-TU8U/view?usp=drive_link",
    "https://drive.google.com/file/d/1AuTu_NXNFJ9HEsfPAgDyKYzGalUeF3p8/view?usp=drive_link",
    "https://drive.google.com/file/d/1nDlouOiMgXslG1I7HvDhikDqGeN8FwV3/view?usp=drive_link",
    "https://drive.google.com/file/d/1WPwaAXzZZ0tR-Py3q_Rm1Lcr2rdylxVX/view?usp=drive_link"
  ],
  logoUrl: "https://drive.google.com/file/d/1BD9vjJi1JSWz6IgnxWhBMMp_ih51NwgX/view?usp=drive_link",
  artisanImage: "https://drive.google.com/file/d/1lg1mgyVOCH2gyy0g4b0MmoH4SDSbxV23/view?usp=drive_link",
  jewelryImage: "https://drive.google.com/file/d/1QZAlUbQlpcXMZl6LLeov6IfMhLJPrLmf/view?usp=drive_link",
  videoUrl: "https://drive.google.com/file/d/1bSR3_OF69zosDsgOcYgH4ZM2cJVbjAy6/view?usp=sharing",
  popupImageUrl: "",
  popupEnabled: true
};

// --- Production Catalog ---
const COLLECTIONS = [
  {
    id: 'heritage',
    title: 'The Heritage Series',
    subtitle: 'Fall / Winter 2024',
    products: [
      {
        id: "h1",
        code: "101",
        name: "Vintage Zari Banarasi",
        image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1600",
        desc: "Hand-loomed silk with heritage gold motifs.",
        category: "apparel",
        subcategory: "Designer Sarees"
      },
      {
        id: "h2",
        code: "102",
        name: "Emerald Polki Choker",
        image: "https://images.unsplash.com/photo-1620916297397-a4a542476596?auto=format&fit=crop&q=80&w=1600",
        desc: "Uncut gemstones set in 22k gold.",
        category: "jewelry",
        subcategory: "The Royals"
      },
      {
        id: "h3",
        code: "103",
        name: "Midnight Zardozi Kaftan",
        image: "https://images.unsplash.com/photo-1610413340539-7fcc8e7fa96d?auto=format&fit=crop&q=80&w=1600",
        desc: "Hand-embroidered velvet masterpiece.",
        category: "apparel",
        subcategory: "Trendy Indo-western collection"
      },
      {
        id: "h4",
        code: "104",
        name: "Chanderi Silk Anarkali Set",
        image: "https://images.unsplash.com/photo-1610030469915-030e037c61bf?auto=format&fit=crop&q=80&w=1600",
        desc: "Exclusive Archival Sale: Hand-loomed with resham hand embroidery.",
        category: "collections",
        subcategory: "Kurti sets",
        wasPrice: "A$45,000",
        salePrice: "A$29,500"
      },
      {
        id: "h5",
        code: "105",
        name: "Kundan Statement Crescent Jhumkas",
        image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=1600",
        desc: "Exclusive Archival Sale: Traditional kundan art set in 22k gold plating.",
        category: "collections",
        subcategory: "Nasha",
        wasPrice: "A$65,000",
        salePrice: "A$42,000"
      },
      {
        id: "h6",
        code: "106",
        name: "Handblocked Organza Dupatta Set",
        image: "https://images.unsplash.com/photo-1631730359575-38e4755d772b?auto=format&fit=crop&q=80&w=1600",
        desc: "Exclusive Archival Sale: Ethereal sheer silk organza with tilla borders.",
        category: "collections",
        subcategory: "Designer ladies collection",
        wasPrice: "A$38,000",
        salePrice: "A$24,500"
      },
      {
        id: "h7",
        code: "107",
        name: "Swarovski Adorned Choker Set",
        image: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&q=80&w=1600",
        desc: "Exclusive Archival Sale: Premium luxury crystals with polished details.",
        category: "collections",
        subcategory: "The Royals",
        wasPrice: "A$85,000",
        salePrice: "A$55,000"
      }
    ]
  }
];

const JEWELRY_SUBCATEGORIES = [
  "Nasha",
  "Raeesee",
  "The Royals",
  "Kufar",
  "Designer collection",
  "Heera hai sadaa ke liye"
];

const APPAREL_SUBCATEGORIES = [
  "Designer Sarees",
  "Designer Coord sets",
  "Designer Lehangas",
  "Premium Chikankari collection",
  "Pakistani collection",
  "Trendy Indo-western collection",
  "Kurti sets",
  "Designer ladies collection"
];

const Navigation = ({ onOpenCart, cartCount, logoUrl, onLogin, onLogout, isAdmin, onPageChange, activePage, onSubcategoryChange, activeSubcategory, onUpdateLogo }: { 
  onOpenCart: () => void, 
  cartCount: number, 
  logoUrl: string, 
  onLogin: () => void,
  onLogout: () => void,
  isAdmin: boolean,
  onPageChange: (page: any) => void,
  activePage: string,
  onSubcategoryChange: (sub: string | null) => void,
  activeSubcategory: string | null,
  onUpdateLogo?: (url: string) => void
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { name: 'Home', id: 'home' },
    { 
      name: 'Jewelry', 
      id: 'jewelry', 
      subs: JEWELRY_SUBCATEGORIES 
    },
    { 
      name: 'Apparel', 
      id: 'fabric', 
      subs: APPAREL_SUBCATEGORIES 
    },
    { name: 'Exclusive Sale', id: 'collections' }
  ];

  return (
    <>
      <nav className={cn(
        "fixed top-0 w-full z-[200] transition-all duration-1000 px-6 md:px-10 py-6 md:py-8 flex items-center justify-between",
        isScrolled || activePage !== 'home' ? "bg-black/90 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
      )}>
        <div className="flex gap-4 md:gap-10 items-center">
          <button onClick={() => setIsMenuOpen(true)} className="group p-2">
            <Menu className="w-5 h-5 hover:scale-110 transition-transform" />
          </button>
          <div className="hidden lg:flex gap-10 text-[12px] tracking-[0.5em] uppercase font-bold opacity-80 items-center">
            {menuItems.map(item => (
              <div 
                key={item.id} 
                className="relative group/nav"
                onMouseEnter={() => setHoveredCategory(item.id)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <button 
                  onClick={() => {
                    onPageChange(item.id);
                    onSubcategoryChange(null);
                  }} 
                  className={cn(
                    "transition-all uppercase flex items-center gap-2",
                    item.id === 'collections'
                      ? "px-5 py-2.5 rounded-sm border border-[#D4AF37]/50 bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/5 to-transparent animate-exclusive-flicker text-[#D4AF37]"
                      : (activePage === item.id ? "opacity-100 text-[#D4AF37]" : "opacity-80 hover:opacity-100")
                  )}
                >
                  {item.id === 'collections' && (
                    <span className="relative flex h-2 w-2 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
                    </span>
                  )}
                  {item.name}
                  {item.subs && <ChevronDown className="w-3 h-3 opacity-40 group-hover/nav:rotate-180 transition-transform" />}
                </button>

                {item.subs && (
                  <AnimatePresence>
                    {hoveredCategory === item.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 mt-4 bg-black/95 backdrop-blur-2xl border border-white/10 p-6 min-w-[240px] shadow-2xl"
                      >
                        <div className="flex flex-col gap-4">
                          <button 
                            onClick={() => {
                              onPageChange(item.id);
                              onSubcategoryChange(null);
                              setHoveredCategory(null);
                            }}
                            className={cn(
                              "text-left hover:text-[#D4AF37] transition-colors",
                              !activeSubcategory && activePage === item.id && "text-[#D4AF37]"
                            )}
                          >
                            All {item.name}
                          </button>
                          {item.subs.map(sub => (
                            <button 
                              key={sub}
                              onClick={() => {
                                onPageChange(item.id);
                                onSubcategoryChange(sub);
                                setHoveredCategory(null);
                              }}
                              className={cn(
                                "text-left hover:text-[#D4AF37] transition-colors",
                                activeSubcategory === sub && "text-[#D4AF37]"
                              )}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            ))}
          </div>
        </div>

        <div 
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-6 z-[500] p-2 md:p-4 group/brand"
        >
          <div className="relative group/logo flex flex-row items-center gap-2 md:gap-4">
            <div className={cn(
              "relative",
              !logoUrl && isAdmin ? "w-20 h-10 md:w-40 md:h-20" : ""
            )}>
              <EditableImage
                src={logoUrl || ""}
                alt="Pakizaah"
                isAdmin={isAdmin}
                onUpdate={(url: string) => onUpdateLogo?.(url)}
                imageClassName="max-h-7 sm:max-h-10 md:max-h-12 w-auto cursor-pointer object-contain"
                onImageClick={() => onPageChange('home')}
                className="w-full h-full"
              />
            </div>
            <h1 
              onClick={() => onPageChange('home')} 
              className={cn(
                "brand-text text-[10px] sm:text-lg md:text-2xl font-light font-bodoni uppercase tracking-[0.2em] md:tracking-[0.4em] cursor-pointer whitespace-nowrap"
              )}
            >
              PAKIZAAH
            </h1>
          </div>
        </div>

        <div className="flex gap-2 md:gap-8 items-center relative z-[999]">
          {isAdmin ? (
            <div className="flex items-center gap-2 md:gap-3 bg-white/10 px-2 md:px-4 py-2 rounded-full border border-white/20">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onLogin();
                }}
                className="text-[8px] md:text-[11px] tracking-[0.2em] md:tracking-[0.4em] font-bold text-white hover:text-[#D4AF37] transition-all uppercase flex items-center gap-1 md:gap-2"
              >
                <div className="w-1 md:w-1.5 h-1 md:h-1.5 bg-green-500 rounded-full animate-pulse" />
                Admin
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
                className="text-[8px] md:text-[11px] tracking-[0.2em] md:tracking-[0.4em] font-bold text-white/70 hover:text-red-400 transition-colors uppercase border-l border-white/10 pl-2 md:pl-3"
              >
                Logout
              </button>
            </div>
          ) : (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onLogin();
              }} 
              className="p-2 md:p-3 bg-white/10 hover:bg-[#D4AF37] rounded-full transition-all cursor-pointer group pointer-events-auto relative z-[1000]"
              title="Admin Login"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5 text-white group-hover:text-black group-hover:rotate-90 transition-all duration-500" />
            </button>
          )}
          <button onClick={onOpenCart} className="relative p-2 hover:scale-110 transition-transform">
            <ShoppingBag className="w-4 h-4 md:w-5 md:h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[10px] flex items-center justify-center rounded-full font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[110] bg-black p-12 flex flex-col justify-center items-center text-center"
          >
            <button onClick={() => setIsMenuOpen(false)} className="absolute top-12 right-12 p-4">
              <X className="w-12 h-12 opacity-20 hover:opacity-100 transition-opacity" />
            </button>
            
            <div className="space-y-12">
              {menuItems.map((item, i) => (
                <motion.button
                  key={item.name}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1, duration: 0.8 }}
                  className={cn(
                    "block text-left text-5xl md:text-8xl font-bodoni font-light hover:italic transition-all duration-500 uppercase tracking-tighter flex items-center justify-center gap-4",
                    item.id === 'collections'
                      ? "px-8 md:px-12 py-4 md:py-6 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 animate-exclusive-flicker text-[#D4AF37]"
                      : "text-white"
                  )}
                  onClick={() => {
                    onPageChange(item.id);
                    onSubcategoryChange(null);
                    setIsMenuOpen(false);
                  }}
                >
                  {item.id === 'collections' && (
                    <span className="relative flex h-4 w-4 md:h-6 md:w-6">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 md:h-6 md:w-6 bg-[#D4AF37]"></span>
                    </span>
                  )}
                  {item.name}
                </motion.button>
              ))}
            </div>
            
            <div className="absolute bottom-12 flex flex-col items-center gap-6 opacity-60 text-[12px] tracking-[0.5em] uppercase font-bold">
              <div className="flex gap-12">
                <span>Instagram</span>
                <span>Pinterest</span>
                <span>WhatsApp</span>
              </div>
              <p>© 2024 Pakizaah International</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const CartSidebar = ({ cart, onRemove, onClose, isOpen, onImageClick, onBookCall, onInquireWhatsApp }: any) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[100vw] sm:max-w-lg z-[510] bg-[#0a0a0a] border-l border-white/10 p-6 md:p-12 flex flex-col shadow-3xl"
          >
            <div className="flex justify-between items-center mb-16">
              <h3 className="text-2xl md:text-3xl font-bodoni italic font-light tracking-widest text-[#D4AF37]">My Selection</h3>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X className="w-8 h-8 opacity-40 hover:opacity-100" /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 md:space-y-12 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex items-center justify-center italic opacity-20 font-serif text-lg md:text-xl mt-[-100px]">
                  Your curation is empty.
                </div>
              ) : (
                cart.map((item: any, i: number) => (
                  <motion.div key={`${item.id}-${i}`} className="flex gap-4 md:gap-8 group">
                    <div className="w-20 h-28 md:w-24 md:h-32 flex-shrink-0 bg-white/5 overflow-hidden border border-white/5">
                      <motion.img 
                        whileHover={{ scale: 1.1 }}
                        onClick={() => onImageClick(item.image)}
                        src={sanitizeMediaUrl(item.image)} 
                        className="w-full h-full object-cover cursor-pointer brightness-100 grayscale hover:grayscale-0 transition-all duration-700" 
                        alt={item.name} 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-center py-2">
                       <div className="flex justify-between items-start">
                         <div className="space-y-1">
                           {item.code && (
                             <span className="inline-block bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 text-[8px] font-mono font-bold tracking-wider px-2 py-0.5 rounded uppercase mb-0.5">
                               CODE: {item.code}
                             </span>
                           )}
                           <h4 className="text-[10px] md:text-xs tracking-[0.3em] md:tracking-[0.4em] uppercase font-light text-white leading-relaxed">{item.name}</h4>
                           <p className="text-[9px] md:text-[10px] italic font-serif opacity-40">Heritage Collection</p>
                         </div>
                         <button onClick={() => onRemove(i)} className="opacity-20 group-hover:opacity-100 transition-opacity p-2">
                           <X className="w-4 h-4" />
                         </button>
                       </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-white/10 pt-8 md:pt-12 mt-8 md:mt-12 space-y-6 md:space-y-8">
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={onBookCall}
                    className="w-full bg-white text-black py-4 md:py-5 text-[11px] md:text-[13px] tracking-[0.4em] uppercase font-bold hover:bg-[#D4AF37] transition-all shadow-2xl cursor-pointer"
                  >
                    Book a Video Call
                  </button>
                  {onInquireWhatsApp && (
                    <button
                      onClick={onInquireWhatsApp}
                      className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] text-white py-4 md:py-5 text-[10px] md:text-[12px] tracking-[0.35em] uppercase font-bold hover:bg-[#128C7E] transition-all shadow-2xl cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.115-2.903-6.99-1.872-1.873-4.35-2.903-6.986-2.904-5.44 0-9.866 4.425-9.869 9.868-.001 1.79.468 3.548 1.36 5.113L1.816 22.33l4.831-1.266zM17.522 14.382c-.3-.149-1.78-.879-2.055-.978-.277-.1-.478-.149-.68.149-.2.3-.775.979-.95 1.178-.175.2-.351.224-.651.075-.3-.15-1.267-.467-2.414-1.492-.893-.797-1.496-1.78-1.671-2.08-.175-.3-.019-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.3.3-.499.1-.2.05-.375-.025-.524-.075-.15-.68-1.64-.931-2.24-.244-.59-.513-.51-.68-.51-.175-.008-.375-.01-.575-.01-.2 0-.525.075-.8.376-.275.3-.1.177-1.05 1.1-.95 1.1-1.025 2.199-1.025 3.321s.8 2.22 1.1 2.62c.3.4 2.371 3.621 5.741 5.072 2.235.962 3.125 1.01 4.11.861.73-.11 1.78-.727 2.03-1.424.25-.699.25-1.299.175-1.424-.075-.125-.275-.199-.575-.349z"/>
                      </svg>
                      Inquire on WhatsApp
                    </button>
                  )}
                </div>
                <div className="flex justify-between items-center text-[7px] md:text-[8px] tracking-[0.3em] uppercase opacity-30 mt-4">
                  <span>Shipping: Worldwide</span>
                  <span>Concierge Support</span>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const ProductDetailModal = ({ 
  product, 
  onClose, 
  onAddToCart,
  isAdmin,
  onToggleSold,
  onInquireWhatsApp
}: { 
  product: any, 
  onClose: () => void, 
  onAddToCart: (p: any) => void,
  isAdmin?: boolean,
  onToggleSold?: (id: string, currentSold: boolean) => void,
  onInquireWhatsApp?: (p: any) => void
}) => {
  const [scale, setScale] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    setCurrentImageIndex(0);
    setScale(1);
  }, [product]);

  if (!product) return null;

  const images = [product.image, product.secondImage, product.thirdImage, product.fourthImage, product.fifthImage].filter(Boolean);
  const activeImg = images[currentImageIndex] || product.image;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/98 backdrop-blur-3xl"
        />
        
        <motion.div 
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          className={cn(
            "relative bg-[#101010] border border-white/10 w-full overflow-hidden flex flex-col md:flex-row shadow-3xl transition-all duration-700",
            isFullScreen ? "max-w-full h-full rounded-none" : "max-w-[95vw] md:max-w-screen-2xl max-h-[95vh] rounded-lg"
          )}
        >
          <div className="absolute top-8 right-8 z-[200] flex gap-4">
            <button 
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-3 bg-black/50 hover:bg-black rounded-full transition-all border border-white/20 group backdrop-blur-sm"
              title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
            >
              {isFullScreen ? <Minimize2 className="w-8 h-8 text-white" /> : <Maximize2 className="w-8 h-8 text-white" />}
            </button>
            <button 
              onClick={onClose}
              className="p-3 bg-black/50 hover:bg-black rounded-full transition-all border border-white/20 group backdrop-blur-sm"
            >
              <X className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* Left: Interactive Image */}
          <div className={cn(
            "relative bg-[#080808] flex items-center justify-center overflow-hidden transition-all duration-700",
            isFullScreen ? "w-full h-full" : "w-full md:w-[65%] h-[50vh] md:h-auto border-r border-white/5"
          )}>
            <div className="absolute top-8 left-8 z-[110] flex gap-4">
              <button 
                onClick={() => setScale(prev => Math.min(prev + 0.5, 5))}
                className="p-4 bg-black/60 hover:bg-black rounded-full text-white transition-all border border-white/20 shadow-xl"
              >
                <Plus className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setScale(prev => Math.max(prev - 0.5, 0.5))}
                className="p-4 bg-black/60 hover:bg-black rounded-full text-white transition-all border border-white/20 shadow-xl"
              >
                <Minus className="w-6 h-6" />
              </button>
            </div>
            
            <motion.div className="w-full h-full flex items-center justify-center p-4">
              <motion.img 
                key={currentImageIndex}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: 1, scale: isFullScreen ? scale * 1.1 : scale }}
                exit={{ opacity: 0.3 }}
                src={sanitizeMediaUrl(activeImg)}
                alt={product.name}
                className={cn(
                  "max-w-full max-h-full cursor-grab active:cursor-grabbing shadow-2xl transition-all duration-700",
                  isFullScreen ? "object-contain" : "object-contain"
                )}
                transition={{ type: "spring", damping: 30, stiffness: 150 }}
                drag
                dragConstraints={{ left: -2000, right: 2000, top: -2000, bottom: 2000 }}
                dragElastic={0.2}
              />
            </motion.div>

            {images.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[130] flex gap-3 bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 shadow-2xl">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentImageIndex(idx);
                      setScale(1);
                    }}
                    className={cn(
                      "relative w-12 h-16 rounded overflow-hidden border-2 transition-all duration-300",
                      currentImageIndex === idx 
                        ? "border-[#D4AF37] scale-105 shadow-[0_0_12px_rgba(212,175,55,0.4)]" 
                        : "border-white/10 opacity-60 hover:opacity-100"
                    )}
                  >
                    <img 
                      src={sanitizeMediaUrl(img)} 
                      alt={`Pose ${idx + 1}`} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white/90 text-center font-bold tracking-widest py-0.5 uppercase">
                      {"Pose " + (idx + 1)}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {product.soldOut && (
              <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/25 backdrop-blur-[0.5px] pointer-events-none select-none overflow-hidden">
                <div className="w-[141%] bg-[#D4AF37] text-black font-black text-sm md:text-lg tracking-[0.4em] uppercase py-4 text-center rotate-[-45deg] shadow-[0_4px_15px_rgba(0,0,0,0.6)] border-y-2 border-black/15">
                  SOLD OUT
                </div>
              </div>
            )}
          </div>

          {/* Right: Details */}
          {!isFullScreen && (
            <div className="flex-1 p-6 md:p-24 flex flex-col justify-center gap-6 md:gap-12 overflow-y-auto custom-scrollbar bg-[#101010]">
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-[10px] md:text-[13px] tracking-[0.5em] uppercase opacity-80 font-bold">{product.subcategory || product.category || 'Pure Artisanry'}</p>
                {product.code && (
                  <span className="bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-[9px] md:text-[11px] tracking-widest px-2.5 py-0.5 rounded font-bold uppercase shadow-sm">
                    CODE: {product.code}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <h3 className="text-2xl sm:text-3xl md:text-6xl font-bodoni font-light tracking-tight uppercase leading-tight italic">{product.name}</h3>
                {product.soldOut && (
                  <span className="bg-[#D4AF37] text-black font-black text-xs md:text-sm tracking-widest px-3 py-1 uppercase rounded shadow">
                    SOLD OUT
                  </span>
                )}
              </div>
              
              {(product.wasPrice || product.salePrice) && (
                <div className="flex flex-wrap items-center gap-4 mt-2 border-l-2 border-[#D4AF37] pl-4 py-1">
                  {product.wasPrice && (
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-widest text-white/40">Original Price</span>
                      <span className="relative inline-block text-sm md:text-base text-white/45 font-medium tracking-wider px-1">
                        {product.wasPrice}
                        <span className="absolute left-[-5%] right-[-5%] top-[50%] h-[1.5px] bg-[#D4AF37]/80 -rotate-[12deg] transform origin-center pointer-events-none" />
                      </span>
                    </div>
                  )}
                  {product.wasPrice && product.salePrice && (
                    <span className="text-white/20 text-xs font-light px-1">|</span>
                  )}
                  {product.salePrice && (
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-[0.15em] text-[#D4AF37] font-bold">Exclusive Sale Price</span>
                      <span className="text-lg md:text-2xl text-[#D4AF37] font-bold tracking-widest">{product.salePrice}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-4 md:space-y-6">
              <p className="text-[11px] md:text-[13px] tracking-[0.3em] uppercase leading-relaxed opacity-60 max-w-md">
                {product.desc}
              </p>
              <div className="h-[1px] w-12 md:w-20 bg-[#D4AF37]" />
            </div>

            <div className="flex flex-col gap-3 md:gap-4 pt-2 md:pt-4">
              {!product.soldOut ? (
                <button 
                  onClick={() => { onAddToCart(product); onClose(); }}
                  className="w-full bg-white text-black py-4 md:py-6 text-[10px] md:text-[13px] tracking-[0.5em] uppercase font-bold hover:bg-[#D4AF37] hover:text-black transition-all duration-500 shadow-2xl"
                >
                  Add to Acquisition
                </button>
              ) : (
                <button 
                  disabled
                  className="w-full bg-zinc-800 text-zinc-500 py-4 md:py-6 text-[10px] md:text-[13px] tracking-[0.5em] uppercase font-bold cursor-not-allowed border border-white/5"
                >
                  SOLD OUT
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onInquireWhatsApp) {
                    onClose();
                    onInquireWhatsApp(product);
                  } else {
                    window.open(getWhatsAppUrl(product), '_blank', 'noopener,noreferrer');
                  }
                }}
                className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] text-white py-4 md:py-6 text-[10px] md:text-[13px] tracking-[0.5em] uppercase font-bold hover:bg-[#128C7E] transition-all duration-500 shadow-2xl cursor-pointer"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.115-2.903-6.99-1.872-1.873-4.35-2.903-6.986-2.904-5.44 0-9.866 4.425-9.869 9.868-.001 1.79.468 3.548 1.36 5.113L1.816 22.33l4.831-1.266zM17.522 14.382c-.3-.149-1.78-.879-2.055-.978-.277-.1-.478-.149-.68.149-.2.3-.775.979-.95 1.178-.175.2-.351.224-.651.075-.3-.15-1.267-.467-2.414-1.492-.893-.797-1.496-1.78-1.671-2.08-.175-.3-.019-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.3.3-.499.1-.2.05-.375-.025-.524-.075-.15-.68-1.64-.931-2.24-.244-.59-.513-.51-.68-.51-.175-.008-.375-.01-.575-.01-.2 0-.525.075-.8.376-.275.3-.1.177-1.05 1.1-.95 1.1-1.025 2.199-1.025 3.321s.8 2.22 1.1 2.62c.3.4 2.371 3.621 5.741 5.072 2.235.962 3.125 1.01 4.11.861.73-.11 1.78-.727 2.03-1.424.25-.699.25-1.299.175-1.424-.075-.125-.275-.199-.575-.349z"/>
                </svg>
                Inquire on WhatsApp
              </button>

              {isAdmin && onToggleSold && (
                <button
                  onClick={() => onToggleSold(product.id, !!product.soldOut)}
                  className={cn(
                    "w-full py-4 md:py-5 text-[10px] md:text-[11px] tracking-[0.3em] uppercase font-bold transition-all duration-500 border flex items-center justify-center gap-2 mt-2",
                    product.soldOut 
                      ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10 hover:bg-transparent"
                      : "border-white/20 text-white/80 hover:border-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#D4AF37]/5"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", product.soldOut ? "bg-[#D4AF37] animate-pulse" : "bg-white/40")} />
                  {product.soldOut ? "Mark as Available" : "Mark as Sold"}
                </button>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3 md:gap-8 py-2 md:py-4 opacity-60 text-[8px] md:text-[10px] tracking-[0.4em] uppercase">
                <span>Hand-Loomed</span>
                <span className="hidden md:inline">•</span>
                <span>Ethical Craft</span>
                <span className="hidden md:inline">•</span>
                <span>Worldwide Delivery</span>
              </div>
            </div>
          </div>
        )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const AdminPanel = ({ 
  config, 
  onUpdate, 
  onClose, 
  isOpen, 
  isLoggedIn, 
  onLogin, 
  products, 
  onUpdateProduct, 
  onAddProduct, 
  onDeleteProduct,
  onUpdateProductDetails
}: { 
  config: AppConfig, 
  onUpdate: (c: AppConfig) => void, 
  onClose: () => void, 
  isOpen: boolean,
  isLoggedIn: boolean,
  onLogin: (pass: string) => boolean,
  products: any[],
  onUpdateProduct: (id: string, url: string) => void,
  onAddProduct: () => void,
  onDeleteProduct: (id: string) => void,
  onUpdateProductDetails?: (id: string, updates: any) => void
}) => {
  const [password, setPassword] = useState('');
  const [tempConfig, setTempConfig] = useState(config);

  useEffect(() => {
    setTempConfig(config);
  }, [config]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLogin(password)) {
      alert('Invalid Password');
    }
  };

  const updateSlide = (index: number, val: string) => {
    const newSlides = [...tempConfig.heroSlides];
    newSlides[index] = val;
    setTempConfig({ ...tempConfig, heroSlides: newSlides });
  };

  const handleSave = async () => {
    try {
      await onUpdate(tempConfig);
      alert('Settings Saved Successfully');
      onClose();
    } catch (e) {
      console.error("Save error:", e);
      alert('Settings saved locally.');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-[#151515] border border-white/10 p-6 md:p-16 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl custom-scrollbar"
          >
            <button onClick={onClose} className="absolute top-6 md:top-8 right-6 md:right-8 text-white/40 hover:text-white">
              <X className="w-6 h-6 md:w-8 md:h-8" />
            </button>

            {!isLoggedIn ? (
              <div className="max-w-md mx-auto space-y-8 md:space-y-12 py-8 md:py-12">
                <div className="text-center space-y-4">
                  <LogIn className="w-12 h-12 md:w-16 md:h-16 mx-auto opacity-20" />
                  <h3 className="text-3xl md:text-4xl font-bodoni italic tracking-widest">Administrator</h3>
                  <p className="text-[10px] md:text-[12px] tracking-[0.3em] md:tracking-[0.4em] uppercase opacity-40">Personnel Only</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-6 md:space-y-8">
                  <input
                    type="password"
                    placeholder="ENTER ACCESS KEY"
                    className="w-full bg-transparent border-b border-white/10 py-3 md:py-4 text-center text-sm md:text-base tracking-[0.3em] md:tracking-[0.4em] outline-none focus:border-white transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button className="w-full bg-white text-black py-4 md:py-6 text-[10px] md:text-[12px] tracking-[0.4em] uppercase font-bold hover:bg-[#fdfcf9] transition-all">
                    Unlock Console
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-12 md:space-y-16">
                <div className="border-b border-white/5 pb-6 md:pb-8">
                  <h3 className="text-3xl md:text-5xl font-bodoni italic tracking-widest">Storefront Control</h3>
                  <p className="text-[10px] md:text-[12px] tracking-[0.4em] md:tracking-[0.6em] uppercase opacity-40 mt-4">Edit Cinematic Imagery & Branding</p>
                </div>

                <div className="space-y-12">
                  {/* Logo Section */}
                  <div className="space-y-6">
                    <h4 className="text-[12px] tracking-[0.4em] uppercase font-bold opacity-60">Brand Logo</h4>
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      <div className="w-32 h-32 flex-shrink-0">
                        <EditableImage
                          src={tempConfig.logoUrl}
                          alt="Logo"
                          isAdmin={true}
                          onUpdate={(url: string) => setTempConfig({ ...tempConfig, logoUrl: url })}
                        />
                      </div>
                      <div className="flex-1 w-full space-y-2">
                        <label className="text-[10px] tracking-[0.2em] opacity-30 uppercase">Paste Logo URL</label>
                        <input
                          type="text"
                          className="w-full bg-white/5 border border-white/10 p-4 text-xs outline-none focus:border-[#D4AF37] transition-colors text-white"
                          placeholder="https://..."
                          value={tempConfig.logoUrl || ""}
                          onChange={(e) => setTempConfig({ ...tempConfig, logoUrl: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Slideshow Section */}
                  <div className="space-y-8">
                    <h4 className="text-[12px] tracking-[0.4em] uppercase font-bold opacity-60">Hero Slideshow (6 Images)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                      {tempConfig.heroSlides.map((slide, idx) => (
                        <div key={idx} className="space-y-4">
                          <label className="text-[10px] tracking-[0.2em] opacity-30 uppercase">Slide {idx + 1}</label>
                          <div className="aspect-[16/9]">
                            <EditableImage
                              src={slide}
                              alt={`Slide ${idx + 1}`}
                              isAdmin={true}
                              onUpdate={(url: string) => {
                                const newSlides = [...tempConfig.heroSlides];
                                newSlides[idx] = url;
                                setTempConfig({ ...tempConfig, heroSlides: newSlides });
                              }}
                            />
                          </div>
                          <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 p-3 text-[10px] outline-none focus:border-[#D4AF37] transition-colors text-white"
                            placeholder="Slide URL"
                            value={slide}
                            onChange={(e) => {
                              const newSlides = [...tempConfig.heroSlides];
                              newSlides[idx] = e.target.value;
                              setTempConfig({ ...tempConfig, heroSlides: newSlides });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Narrative & Media */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="space-y-4">
                      <label className="text-[12px] tracking-[0.4em] uppercase font-bold opacity-60">Narrative Video</label>
                      <div className="aspect-video">
                        <EditableImage
                          src={tempConfig.videoUrl}
                          alt="Narrative Video"
                          isAdmin={true}
                          onUpdate={(url: string) => setTempConfig({ ...tempConfig, videoUrl: url })}
                        />
                      </div>
                      <input
                        type="text"
                        className="w-full bg-white/5 border border-white/10 p-3 text-[10px] outline-none focus:border-[#D4AF37] transition-colors text-white"
                        placeholder="Video URL"
                        value={tempConfig.videoUrl || ""}
                        onChange={(e) => setTempConfig({ ...tempConfig, videoUrl: e.target.value })}
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[12px] tracking-[0.4em] uppercase font-bold opacity-60">Artisan Narrative Image</label>
                      <div className="aspect-square">
                        <EditableImage
                          src={tempConfig.artisanImage}
                          alt="Artisan Image"
                          isAdmin={true}
                          onUpdate={(url: string) => setTempConfig({ ...tempConfig, artisanImage: url })}
                        />
                      </div>
                      <input
                        type="text"
                        className="w-full bg-white/5 border border-white/10 p-3 text-[10px] outline-none focus:border-[#D4AF37] transition-colors text-white"
                        placeholder="Image URL"
                        value={tempConfig.artisanImage || ""}
                        onChange={(e) => setTempConfig({ ...tempConfig, artisanImage: e.target.value })}
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[12px] tracking-[0.4em] uppercase font-bold opacity-60">Jewelry Section Image</label>
                      <div className="aspect-square">
                        <EditableImage
                          src={tempConfig.jewelryImage}
                          alt="Jewelry Section"
                          isAdmin={true}
                          onUpdate={(url: string) => setTempConfig({ ...tempConfig, jewelryImage: url })}
                        />
                      </div>
                      <input
                        type="text"
                        className="w-full bg-white/5 border border-white/10 p-3 text-[10px] outline-none focus:border-[#D4AF37] transition-colors text-white"
                        placeholder="Image URL"
                        value={tempConfig.jewelryImage || ""}
                        onChange={(e) => setTempConfig({ ...tempConfig, jewelryImage: e.target.value })}
                      />
                    </div>
                  </div>


                  {/* Products Section */}
                  <div className="space-y-8">
                    <div className="flex justify-between items-center bg-white/5 p-6 rounded-sm">
                      <h4 className="text-[12px] tracking-[0.4em] uppercase font-bold opacity-60">Catalog Management</h4>
                      <button onClick={onAddProduct} className="bg-[#D4AF37] px-6 py-2 rounded-full text-black text-[10px] font-bold uppercase hover:scale-105 transition-transform flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add Piece
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {sortProducts(products).filter(p => p && p.id).map((p) => (
                        <div key={p.id} className="space-y-4 p-6 bg-white/5 border border-white/10 rounded-sm">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 space-y-3">
                              <label className="text-[10px] tracking-[0.2em] opacity-30 uppercase">{p.name || 'Unnamed Piece'}</label>
                              <div className="flex flex-col md:flex-row gap-4 items-start">
                                <div className="w-24 h-32 flex-shrink-0">
                                  <EditableImage
                                    src={p.image || ''}
                                    alt={p.name || ''}
                                    isAdmin={true}
                                    onUpdate={(url: string) => onUpdateProduct(p.id, url)}
                                  />
                                </div>
                                <div className="flex-1 w-full space-y-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9px] tracking-[0.2em] opacity-30 uppercase block">Product Code / SKU</label>
                                      <input
                                        type="text"
                                        className="w-full bg-black/40 border border-[#D4AF37]/40 p-3 text-[10px] font-mono outline-none focus:border-[#D4AF37] transition-colors text-[#D4AF37]"
                                        placeholder="e.g. 101"
                                        value={p.code || ''}
                                        onChange={(e) => onUpdateProductDetails && onUpdateProductDetails(p.id, { code: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] tracking-[0.2em] opacity-30 uppercase block">Piece Image URL</label>
                                      <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 p-3 text-[10px] outline-none focus:border-[#D4AF37] transition-colors text-white"
                                        placeholder="Paste URL here..."
                                        value={p.image || ''}
                                        onChange={(e) => onUpdateProduct(p.id, e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  {onUpdateProductDetails && (
                                    <div className="space-y-1.5 mt-2">
                                      <label className="text-[9px] tracking-[0.2em] opacity-30 uppercase block">Alternate Pose URL / Google Drive Link (Pose 2)</label>
                                      <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 p-3 text-[10px] outline-none focus:border-[#D4AF37] transition-colors text-white"
                                        placeholder="Paste Google Drive Link/URL for alternate pose..."
                                        value={p.secondImage || ''}
                                        onChange={(e) => onUpdateProductDetails(p.id, { secondImage: e.target.value })}
                                      />
                                    </div>
                                  )}
                                  {onUpdateProductDetails && (
                                    <div className="space-y-1.5 mt-2">
                                      <label className="text-[9px] tracking-[0.2em] opacity-30 uppercase block">Third Pose URL / Google Drive Link (Pose 3)</label>
                                      <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 p-3 text-[10px] outline-none focus:border-[#D4AF37] transition-colors text-white"
                                        placeholder="Paste Google Drive Link/URL for third pose..."
                                        value={p.thirdImage || ''}
                                        onChange={(e) => onUpdateProductDetails(p.id, { thirdImage: e.target.value })}
                                      />
                                    </div>
                                  )}
                                  {onUpdateProductDetails && (
                                    <div className="space-y-1.5 mt-2">
                                      <label className="text-[9px] tracking-[0.2em] opacity-30 uppercase block">Fourth Pose URL / Google Drive Link (Pose 4)</label>
                                      <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 p-3 text-[10px] outline-none focus:border-[#D4AF37] transition-colors text-white"
                                        placeholder="Paste Google Drive Link/URL for fourth pose..."
                                        value={p.fourthImage || ''}
                                        onChange={(e) => onUpdateProductDetails(p.id, { fourthImage: e.target.value })}
                                      />
                                    </div>
                                  )}
                                  {onUpdateProductDetails && (
                                    <div className="space-y-1.5 mt-2">
                                      <label className="text-[9px] tracking-[0.2em] opacity-30 uppercase block">Fifth Pose URL / Google Drive Link (Pose 5)</label>
                                      <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 p-3 text-[10px] outline-none focus:border-[#D4AF37] transition-colors text-white"
                                        placeholder="Paste Google Drive Link/URL for fifth pose..."
                                        value={p.fifthImage || ''}
                                        onChange={(e) => onUpdateProductDetails(p.id, { fifthImage: e.target.value })}
                                      />
                                    </div>
                                  )}
                                  {onUpdateProductDetails && (
                                    <div className="flex items-center gap-2 mt-3 bg-white/5 p-2.5 border border-white/10 rounded">
                                      <input 
                                        type="checkbox"
                                        id={`admin-sold-${p.id}`}
                                        checked={!!p.soldOut}
                                        onChange={(e) => onUpdateProductDetails(p.id, { soldOut: e.target.checked })}
                                        className="accent-[#D4AF37] h-3.5 w-3.5 cursor-pointer rounded border-white/10 bg-white/5"
                                      />
                                      <label htmlFor={`admin-sold-${p.id}`} className="text-[9px] tracking-[0.15em] uppercase font-bold text-[#D4AF37] select-none cursor-pointer">
                                        Mark as Sold Out
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end pt-2 border-t border-white/5">
                             <button onClick={() => onDeleteProduct(p.id)} className="text-red-400 text-[9px] uppercase tracking-widest hover:text-red-300 flex items-center gap-2">
                               <Trash2 className="w-3 h-3" /> Remove from Catalog
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-8 flex gap-6">
                  <button 
                    onClick={handleSave}
                    className="flex-1 bg-white text-black py-8 text-[12px] tracking-[0.5em] uppercase font-bold hover:scale-[1.02] transition-transform flex items-center justify-center gap-4"
                  >
                    <Save className="w-4 h-4" /> Save All Changes
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ImageLightbox = ({ src, isOpen, onClose }: { src: string, isOpen: boolean, onClose: () => void }) => {
  const [scale, setScale] = useState(1);
  const [isRotating, setIsRotating] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setScale(1);
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/98 backdrop-blur-2xl"
        onClick={onClose}
      >
        <div className="absolute top-8 right-8 flex items-center gap-6 z-[1600]">
          <button 
            onClick={(e) => { e.stopPropagation(); setScale(prev => Math.min(prev + 0.5, 5)); }} 
            className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all hover:scale-110 active:scale-95 flex items-center justify-center border border-white/10 backdrop-blur-md shadow-2xl"
            title="Zoom In"
          >
            <Plus className="w-8 h-8" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setScale(prev => Math.max(prev - 0.5, 0.25)); }} 
            className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all hover:scale-110 active:scale-95 flex items-center justify-center border border-white/10 backdrop-blur-md shadow-2xl"
            title="Zoom Out"
          >
            <Minus className="w-8 h-8" />
          </button>
          <button 
            onClick={onClose}
            className="p-4 bg-white/5 hover:bg-red-500/20 rounded-full text-white transition-all hover:scale-110 border border-white/10 backdrop-blur-md ml-4 shadow-2xl"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        <motion.div 
          className="w-full h-full flex items-center justify-center p-4 md:p-12 overflow-hidden"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          {src.match(/\.(mp4|webm|ogg|mov)$/i) || src.includes('export=media') ? (
            <motion.video
              src={sanitizeMediaUrl(src)}
              className="max-w-full max-h-full object-contain shadow-[0_0_100px_rgba(0,0,0,0.5)]"
              animate={{ scale }}
              transition={{ type: "spring", damping: 30, stiffness: 150 }}
              onClick={(e) => e.stopPropagation()}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <motion.img 
              src={sanitizeMediaUrl(src)} 
              alt="Full view" 
              className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing shadow-[0_0_100px_rgba(0,0,0,0.5)]"
              animate={{ scale }}
              transition={{ type: "spring", damping: 30, stiffness: 150 }}
              drag
              dragConstraints={{ left: -3000, right: 3000, top: -3000, bottom: 3000 }}
              dragElastic={0.2}
              onClick={(e) => e.stopPropagation()}
              referrerPolicy="no-referrer"
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const EditableImage = ({ 
  src, 
  secondSrc,
  thirdSrc,
  fourthSrc,
  fifthSrc,
  alt, 
  className, 
  imageClassName,
  isAdmin, 
  onUpdate,
  onImageClick,
  disableHoverZoom,
  forceGearVisible,
  referrerPolicy = "no-referrer"
 }: { 
  src: string, 
  secondSrc?: string,
  thirdSrc?: string,
  fourthSrc?: string,
  fifthSrc?: string,
  alt: string, 
  className?: string, 
  imageClassName?: string,
  isAdmin: boolean, 
  onUpdate: (url: string) => void,
  onImageClick?: (src: string) => void,
  disableHoverZoom?: boolean,
  forceGearVisible?: boolean,
  referrerPolicy?: React.HTMLAttributeReferrerPolicy
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isHovered, setIsHovered] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const slideshowImages = [src, secondSrc, thirdSrc, fourthSrc, fifthSrc].filter(Boolean) as string[];

  useEffect(() => {
    if (!isHovered || slideshowImages.length <= 1) {
      setActiveIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % slideshowImages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [isHovered, slideshowImages.length]);

  const currentSrc = slideshowImages[activeIdx] || src;

  const isVideo = typeof currentSrc === 'string' && Boolean(
    currentSrc.split('?')[0].match(/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i) || 
    currentSrc.includes('export=media') || 
    currentSrc.includes('export=download') || 
    (currentSrc.includes('firebasestorage.googleapis.com') && currentSrc.toLowerCase().includes('.mp4')) ||
    (currentSrc.includes('/uploads/') && currentSrc.match(/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i))
  );

  const [isEditingLink, setIsEditingLink] = useState(false);
  const [tempUrl, setTempUrl] = useState(src || '');

  const uploadToServer = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.success && data.url) {
              resolve(data.url);
            } else {
              reject(new Error(data.error || 'Upload failed'));
            }
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error(`Server returned status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error uploading to server'));
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('🚀 Starting upload:', file.name, 'Size:', file.size, 'Type:', file.type);
    setIsUploading(true);
    setUploadProgress(0);

    const isVideoFile = file.type.startsWith('video/');

    try {
      const storageRef = ref(storage, `${isVideoFile ? 'videos' : 'uploads'}/${Date.now()}-${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        }, 
        async (error) => {
          console.warn('⚠️ Firebase Storage upload notice, attempting server fallback:', error);
          try {
            const serverUrl = await uploadToServer(file);
            console.log('✅ Fallback upload successful:', serverUrl);
            onUpdate(serverUrl);
          } catch (serverErr: any) {
            console.error('❌ Server upload error:', serverErr);
            alert('Upload failed: ' + (serverErr?.message || error.message));
          } finally {
            setIsUploading(false);
            setUploadProgress(0);
          }
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('✅ Upload successful. New URL:', downloadURL);
          onUpdate(downloadURL);
          setIsUploading(false);
          setUploadProgress(0);
        }
      );
    } catch (err: any) {
      console.warn('⚠️ Firebase Storage direct notice, using server upload directly:', err);
      try {
        const serverUrl = await uploadToServer(file);
        console.log('✅ Direct server upload successful:', serverUrl);
        onUpdate(serverUrl);
      } catch (serverErr: any) {
        console.error('❌ Server upload error:', serverErr);
        alert('Upload failed: ' + (serverErr?.message || err?.message));
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    }
  };
  
  if (!src && !isAdmin) {
    return (
      <div className={cn("w-full h-full bg-white/5 flex items-center justify-center border border-white/5", className)}>
        <span className="text-[8px] uppercase tracking-widest opacity-20">Pakizaah Original</span>
      </div>
    );
  }

  const imageSrc = sanitizeMediaUrl(currentSrc, isVideo);

  return (
    <div 
      className={cn("relative group/edit", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input 
        type="file" 
        key={`input-${src}`} // Reset input state when src changes without key collision with the image sibling
        ref={fileInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
        accept="image/*,video/*"
      />
      {!src && isAdmin ? (
        <div 
          className="w-full h-full min-h-[60px] border border-dashed border-white/20 flex flex-col items-center justify-center bg-white/5 opacity-50 hover:opacity-100 transition-opacity cursor-default gap-2"
        >
           <div className="flex gap-2">
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 fileInputRef.current?.click();
               }}
               className="p-2 bg-[#D4AF37] rounded-full text-black hover:scale-110 transition-transform"
               title="Upload"
             >
               <Upload className="w-4 h-4" />
             </button>
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 setIsEditingLink(true);
               }}
               className="p-2 bg-white/10 rounded-full text-white hover:bg-white hover:text-black transition-all"
               title="Link"
             >
               <Link2 className="w-4 h-4" />
             </button>
           </div>
           <span className="text-[8px] uppercase tracking-widest text-white/40">Media</span>
         </div>
      ) : isVideo ? (
        <motion.video
          key={`media-${imageSrc}`}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          src={imageSrc}
          className={cn("w-full h-full object-cover transition-all duration-700 brightness-100", imageClassName)}
          autoPlay
          muted
          loop
          playsInline
          whileHover={disableHoverZoom ? {} : { scale: 1.08 }}
          onClick={(e) => {
            if (onImageClick) {
              e.stopPropagation();
              onImageClick(currentSrc);
            }
          }}
        />
      ) : (
        <motion.img 
          key={`media-${imageSrc}`}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          src={imageSrc} 
          alt={alt} 
          className={cn("w-full h-full object-cover transition-all duration-700 brightness-100", imageClassName)} 
          referrerPolicy={referrerPolicy}
          whileHover={disableHoverZoom ? {} : { scale: 1.08 }}
          onClick={(e) => {
            if (onImageClick) {
              e.stopPropagation();
              onImageClick(currentSrc);
            }
          }}
          role={onImageClick ? "button" : undefined}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const currentImgUrl = target.src || '';
            // If direct Google CDN failed, try thumbnail format
            if (currentImgUrl.includes('googleusercontent.com/d/')) {
              const id = extractDriveId(currentImgUrl);
              if (id) {
                target.src = `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
                return;
              }
            } else if (currentImgUrl.includes('drive.google.com/thumbnail')) {
              const id = extractDriveId(currentImgUrl);
              if (id) {
                target.src = `https://drive.google.com/uc?export=view&id=${id}`;
                return;
              }
            }
            // General Fallback for broken images
            if (!target.src.includes('placeholder')) {
               target.src = 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&q=80&w=800';
            }
          }}
        />
      )}
      {isAdmin && (
        <div className={cn(
          "absolute -top-6 -right-6 z-[2000] flex flex-col items-end gap-2 p-2",
          !forceGearVisible && "opacity-0 group-hover/edit:opacity-100 transition-opacity"
        )}>
          {isUploading ? (
            <div className="bg-[#D4AF37] p-2 rounded-full text-black w-14 h-14 flex items-center justify-center">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-black/20 rounded-full" />
                <div 
                  className="absolute inset-0 border-2 border-black rounded-full animate-spin" 
                  style={{ borderTopColor: 'transparent' }}
                />
                <span className="text-[10px] font-bold">{uploadProgress}%</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  fileInputRef.current?.click();
                }}
                className="bg-[#D4AF37] p-4 rounded-full text-black shadow-2xl flex items-center justify-center border border-black/20 cursor-pointer hover:scale-110 active:scale-95 transition-all w-14 h-14"
                title="Upload New"
              >
                <Upload className="w-6 h-6" />
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsEditingLink(true);
                  setTempUrl(src || '');
                }}
                className="bg-white/90 p-4 rounded-full text-black shadow-2xl flex items-center justify-center border border-black/20 cursor-pointer hover:scale-110 active:scale-95 transition-all w-14 h-14"
                title="Paste Link"
              >
                <Link2 className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      )}

      {isEditingLink && (
        <div className="absolute inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 gap-4 animate-in fade-in zoom-in duration-200">
          <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold">Paste Media Link</p>
          <input 
            type="text"
            className="w-full bg-white/10 border border-white/20 p-3 text-[10px] text-white outline-none focus:border-[#D4AF37] transition-all"
            placeholder="https://drive.google.com/..."
            value={tempUrl}
            onChange={(e) => setTempUrl(e.target.value)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-2 w-full">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(tempUrl);
                setIsEditingLink(false);
              }}
              className="flex-1 bg-[#D4AF37] text-black py-2 text-[10px] uppercase font-bold hover:bg-[#b8962d] transition-colors"
            >
              Update
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingLink(false);
              }}
              className="flex-1 bg-white/10 text-white py-2 text-[10px] uppercase font-bold hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {onImageClick && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/edit:opacity-100 pointer-events-none transition-opacity bg-black/10">
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-full text-white border border-white/20">
            <ZoomIn className="w-5 h-5" />
          </div>
        </div>
      )}
    </div>
  );
};

const HeroSlideshow = ({ slides, isAdmin, onUpdateSlide, onImageClick }: { slides: string[], isAdmin: boolean, onUpdateSlide: (idx: number, url: string) => void, onImageClick?: (src: string) => void }) => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || !slides || slides.length === 0) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % (slides.length || 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [slides, isPaused]);

  if (!slides || slides.length === 0) return <div className="absolute inset-0 bg-black/40" />;

  return (
    <div 
      className="absolute inset-0 z-0"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
          <motion.div
            key={`${current}-${slides[current]}`}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <EditableImage 
              src={slides[current]}
              alt={`Slide ${current + 1}`}
              isAdmin={isAdmin}
              onUpdate={(url) => onUpdateSlide(current, url)}
              disableHoverZoom={true}
              className="absolute inset-0"
              imageClassName="opacity-95 md:opacity-100"
            />
          </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-transparent pointer-events-none" />
      
      {/* Progress Indicators & Admin Controls */}
      <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end z-20">
        <div className="flex gap-4">
          {slides.map((_, idx) => (
            <button 
              key={idx}
              onClick={() => setCurrent(idx)}
              className={cn(
                "h-[1px] transition-all duration-700",
                idx === current ? "w-12 bg-white" : "w-4 bg-white/20"
              )}
            />
          ))}
        </div>

        {isAdmin && (
          <button 
            onClick={() => onUpdateSlide(current, slides[current])}
            className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-full flex items-center gap-3 hover:bg-white hover:text-black transition-all group"
          >
            <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
            <span className="text-[10px] tracking-[0.3em] font-bold uppercase">Edit Slideshow</span>
          </button>
        )}
      </div>
    </div>
  );
};

const VideoCallModal = ({ onCancel, cart }: { onCancel: () => void, cart?: any[] }) => {
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    whatsapp: '',
    interest: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const totalNum = cart?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;
      const inquiryData = { 
        ...formData, 
        type: 'video-call',
        cart: cart || [],
        total: totalNum > 0 ? `$${totalNum.toLocaleString()}` : 'Bespoke Valuation',
        timestamp: new Date().toISOString()
      };

      // 1. Save to Firestore (Lead Backup)
      const leadId = `vc_${Date.now()}`;
      try {
        await setDoc(doc(db, 'inquiries', leadId), deepSafeCopy(inquiryData));
      } catch (fsErr) {
        console.error('Firestore save failed:', fsErr);
      }

      // 2. Send Email
      const response = await fetch('/api/book-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify(inquiryData)
      });
      if (response.ok) {
        setIsSubmitted(true);
      } else {
        alert('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-[#151515] border border-white/10 p-6 sm:p-10 md:p-14 w-full max-w-2xl max-h-[92vh] overflow-y-auto custom-scrollbar rounded-lg shadow-2xl"
      >
        <button onClick={onCancel} className="absolute top-6 right-6 opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
          <X className="w-7 h-7" />
        </button>

        {isSubmitted ? (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-9 h-9 text-[#D4AF37]" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-bodoni italic tracking-widest text-[#D4AF37]">Request Received</h3>
              <p className="text-base sm:text-lg serif italic opacity-80 leading-relaxed px-2">
                Thank you for the response — you are truly a precious customer for us. We will contact you soon.
              </p>
            </div>

            {/* Shopping Policies Message for Customer */}
            <div className="border border-[#D4AF37]/30 bg-black/40 p-5 sm:p-6 space-y-4 text-left">
              <div className="text-center space-y-1 border-b border-white/10 pb-3">
                <p className="text-[10px] tracking-[0.35em] uppercase text-[#D4AF37] font-bold">
                  PAKIZAAH — Shopping Policies | Terms &amp; Conditions
                </p>
                <p className="font-serif italic text-sm text-[#fdfcf9]">Thank you for choosing PAKIZAAH! ❤️</p>
              </div>

              <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-2.5 pr-1 text-xs text-white/80">
                {PAKIZAAH_POLICIES.map((p) => (
                  <div key={p.number} className="p-2.5 bg-white/[0.02] border border-white/10 space-y-0.5">
                    <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-[#D4AF37]">
                      {p.number}. {p.title}
                    </p>
                    <p className="text-white/75 leading-relaxed">{p.description}</p>
                    {p.emphasis && (
                      <p className="text-[10px] font-bold text-[#D4AF37] pt-0.5">{p.emphasis}</p>
                    )}
                    {p.phoneHighlight && (
                      <p className="text-xs font-bold text-[#25D366] pt-0.5">{p.phoneHighlight}</p>
                    )}
                  </div>
                ))}
                <div className="pt-2 text-center space-y-1 text-white/70">
                  <p className="font-semibold text-white">Let&apos;s make every shopping experience a gratifying one!</p>
                  <p>Thank you for your time, trust and continued support. ❤️</p>
                  <p className="text-[#D4AF37] font-bold tracking-[0.2em]">WITH LOVE, TEAM PAKIZAAH</p>
                  <p className="font-serif italic">Discover Yourself in PAKIZAAH.</p>
                </div>
              </div>

              <a
                href={buildWhatsAppLink(formData.whatsapp || '', PAKIZAAH_POLICIES_WHATSAPP_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#128C7E] text-white py-3.5 px-5 text-[10px] tracking-[0.3em] uppercase font-bold transition-all"
              >
                Receive Policies Message on WhatsApp
              </a>
            </div>

            <div className="text-center">
              <button 
                onClick={onCancel}
                className="px-12 py-4 bg-white text-black text-[10px] tracking-[0.4em] uppercase font-bold hover:bg-[#D4AF37] transition-all cursor-pointer"
              >
                Great
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <h3 className="text-4xl sm:text-5xl font-bodoni italic tracking-widest">Bespoke Fitting</h3>
              <p className="text-[10px] tracking-[0.6em] uppercase opacity-40 mt-3">Book Your Private Video Call</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] tracking-[0.3em] uppercase opacity-40">Your Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 p-4 text-sm outline-none focus:border-[#D4AF37] transition-all" 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] tracking-[0.3em] uppercase opacity-40">Country</label>
                  <input 
                    required
                    type="text" 
                    value={formData.country}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 p-4 text-sm outline-none focus:border-[#D4AF37] transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] tracking-[0.3em] uppercase opacity-40">WhatsApp Number</label>
                  <input 
                    required
                    type="tel" 
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 p-4 text-sm outline-none focus:border-[#D4AF37] transition-all" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] tracking-[0.3em] uppercase opacity-40">Interested In</label>
                <select 
                  required
                  value={formData.interest}
                  onChange={(e) => setFormData({...formData, interest: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 p-4 text-sm outline-none focus:border-[#D4AF37] transition-all appearance-none"
                >
                  <option value="" className="bg-[#151515]">Select Interest</option>
                  <option value="Bridal Wear" className="bg-[#151515]">Bridal Wear</option>
                  <option value="Heritage Jewelry" className="bg-[#151515]">Heritage Jewelry</option>
                  <option value="Premium Fabrics" className="bg-[#151515]">Premium Fabrics</option>
                  <option value="Designer Suits" className="bg-[#151515]">Designer Suits</option>
                  <option value="Other" className="bg-[#151515]">Other</option>
                </select>
              </div>

              {/* Concise Policies Notice */}
              <div className="border border-[#D4AF37]/30 bg-[#D4AF37]/[0.05] p-4 space-y-2">
                <p className="text-[10px] tracking-[0.28em] uppercase font-bold text-[#D4AF37]">
                  Shopping Policies | Terms &amp; Conditions
                </p>
                <p className="text-xs text-white/75 leading-relaxed">
                  All sales are final (no refunds/exchanges). Parcel-opening video is mandatory for postal claims (<strong className="text-[#D4AF37]">NO VIDEO = NO EXCHANGE / NO REPLACEMENT</strong>). Fixed prices, no holds, payment within 24 hrs, confirm via WhatsApp at <strong className="text-white">{PAKIZAAH_ORDER_WHATSAPP_DISPLAY}</strong>. Full policies message will be shared upon submission.
                </p>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#fdfcf9] text-black py-5 text-[10px] tracking-[0.5em] uppercase font-bold hover:bg-[#D4AF37] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Requesting...' : 'Request Video Consultation'}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const LoginModal = ({ isOpen, onClose, onLogin }: { isOpen: boolean, onClose: () => void, onLogin: (email: string) => void }) => {
  const [email, setEmail] = useState('');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-2xl"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-md bg-white/5 border border-white/10 p-12 text-center space-y-10"
          >
            <div className="space-y-4">
              <h3 className="text-3xl font-bodoni italic tracking-widest text-white">Admin Access</h3>
              <p className="text-[10px] tracking-[0.4em] uppercase opacity-40">Personnel Verification</p>
            </div>

            <div className="space-y-8">
              <input
                type="text"
                placeholder="ENTER EMAIL OR 'admin'"
                className="w-full bg-transparent border-b border-white/10 py-4 text-center tracking-[0.2em] outline-none focus:border-white transition-colors text-white text-xs uppercase"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onLogin(email)}
              />
              <button 
                onClick={() => onLogin(email)}
                className="w-full bg-white text-black py-6 text-[10px] tracking-[0.4em] uppercase font-bold hover:bg-[#fdfcf9] transition-all"
              >
                Verify Credentials
              </button>
            </div>
            
            <button onClick={onClose} className="text-[9px] tracking-[0.3em] uppercase opacity-20 hover:opacity-100 underline underline-offset-8">
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ImageEditorModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialUrl, 
  title 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (url: string) => void, 
  initialUrl: string,
  title: string
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const isVideo = title.toLowerCase().includes('video') || url.match(/\.(mp4|webm|ogg)$/i);

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl, isOpen]);

  useEffect(() => {
    if (url) setIsLoading(true);
  }, [url]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-8">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0a0a0a]/98 backdrop-blur-3xl"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-[#111] border border-white/10 p-12 md:p-16 space-y-12"
          >
            <div className="space-y-4 border-b border-white/5 pb-8">
              <h3 className="text-4xl font-bodoni italic tracking-widest text-white">{title}</h3>
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                  <p className="text-[10px] tracking-[0.4em] uppercase text-white mb-2 font-bold">Important Instructions:</p>
                  <ol className="text-[9px] tracking-[0.1em] text-white/60 space-y-2 list-decimal list-inside uppercase">
                    <li>This system uses URLs (links). Direct file upload is not supported.</li>
                    <li>For Google Drive: Set sharing to "Anyone with the link can view".</li>
                    <li>For Videos: Use direct MP4 links or Google Drive links (ensure "Anyone can view").</li>
                    <li>Paste the link below and click 'Refresh Preview' to verify.</li>
                  </ol>
                </div>
                <p className="text-[8px] tracking-[0.2em] italic uppercase opacity-40">
                  (Note: For Google Drive, ensure file permissions are set to 'Anyone with the link')
                </p>
              </div>
            </div>

            <div className="space-y-10">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[9px] tracking-[0.4em] uppercase opacity-30 font-bold">Source URL</label>
                  <button 
                    onClick={() => {
                      setIsLoading(true);
                      const currentUrl = url;
                      setUrl("");
                      setTimeout(() => setUrl(currentUrl), 50);
                    }}
                    className="text-[8px] tracking-[0.2em] uppercase opacity-30 hover:opacity-100 transition-opacity"
                  >
                    Refresh Preview
                  </button>
                </div>
                <textarea
                  className="w-full bg-white/5 border border-white/10 p-6 text-sm tracking-wider font-mono outline-none focus:border-white transition-colors text-white/80 h-32 resize-none"
                  placeholder={isVideo ? "https://example.com/video.mp4" : "https://drive.google.com/..."}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              {url && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 content-start">
                  <div className="space-y-4">
                    <p className="text-[9px] tracking-[0.4em] uppercase opacity-30 font-bold">Preview</p>
                    <div className="aspect-video w-full bg-white/5 border border-white/10 overflow-hidden relative rounded-sm">
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-10">
                          <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                      {isVideo ? (
                        <video 
                          key={url}
                          src={sanitizeMediaUrl(url, true)}
                          className="w-full h-full object-cover"
                          autoPlay
                          muted
                          loop
                          onLoadedData={() => setIsLoading(false)}
                          onError={() => setIsLoading(false)}
                        />
                      ) : (
                        <img 
                          key={url}
                          src={sanitizeMediaUrl(url)} 
                          className="w-full h-full object-cover" 
                          alt="Preview" 
                          referrerPolicy="no-referrer" 
                          onLoad={() => setIsLoading(false)}
                          onError={(e) => {
                            setIsLoading(true);
                            setTimeout(() => setIsLoading(false), 1000);
                            (e.target as HTMLImageElement).src = `https://via.placeholder.com/800x450/111/fff?text=Invalid+or+Private+Link`;
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="p-6 bg-white/5 border border-white/10 rounded-sm space-y-4 h-fit">
                    <p className="text-[9px] tracking-[0.4em] uppercase opacity-30 font-bold">Link Diagnostics</p>
                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] tracking-wider uppercase">
                        <span className="opacity-40">Link Type:</span>
                        <span className="text-white">
                          {url.includes('drive.google.com') ? 'Google Drive' : 
                           isVideo ? 'Video File' : 'Image/Other'}
                        </span>
                      </div>
                      {url.includes('drive.google.com') && (
                        <>
                          <div className="flex justify-between text-[10px] tracking-wider uppercase">
                            <span className="opacity-40">Detected ID:</span>
                            <span className={cn("font-mono", extractDriveId(url) ? "text-green-400" : "text-red-400")}>
                              {extractDriveId(url) || 'Not Found'}
                            </span>
                          </div>
                          {!extractDriveId(url) && (
                            <p className="text-[8px] text-red-300 italic uppercase">
                              Check if you pasted the correct "Share" link.
                            </p>
                          )}
                        </>
                      )}
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-[8px] opacity-40 uppercase mb-2">Final Processed URL:</p>
                        <p className="text-[8px] font-mono break-all opacity-60 bg-black/30 p-2 rounded">{sanitizeMediaUrl(url)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => onSave(url)}
                  className="flex-1 bg-white text-black py-6 text-[10px] tracking-[0.4em] uppercase font-bold hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                >
                  <Save className="w-4 h-4" /> Apply Changes
                </button>
                <button 
                  onClick={onClose}
                  className="px-10 border border-white/10 text-[9px] tracking-[0.4em] uppercase opacity-40 hover:opacity-100 transition-opacity"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Footer = () => (
  <footer className="border-t border-white/5 py-24 px-12 bg-black">
    <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 md:gap-16">
      <div className="space-y-6">
        <h4 className="text-[10px] tracking-[0.4em] uppercase font-bold text-[#D4AF37]">The Boutique</h4>
        <div className="text-lg md:text-xl font-bodoni uppercase tracking-wide space-y-1">
          <p>Pakizaah Boutique</p>
          <p>14/220 Holt PDE</p>
          <p>Thomastown, VIC 3074</p>
          <p>Melbourne, Australia</p>
        </div>
      </div>
      
      <div className="space-y-6">
        <h4 className="text-[10px] tracking-[0.4em] uppercase font-bold text-[#D4AF37]">Engagement</h4>
        <div className="text-[10px] md:text-[11px] tracking-[0.2em] uppercase space-y-4 opacity-60">
          <p className="flex items-center gap-3"><Phone className="w-3 h-3" /> 03 9614 4531</p>
          <p className="flex items-center gap-3"><Phone className="w-3 h-3" /> 0061 0430 244 149</p>
          <p className="flex items-center gap-3"><Phone className="w-3 h-3" /> 0061 0452 482 019</p>
        </div>
      </div>

      <div className="space-y-6">
        <h4 className="text-[10px] tracking-[0.4em] uppercase font-bold text-[#D4AF37]">Atelier Hours</h4>
        <div className="text-[10px] md:text-[11px] tracking-[0.2em] uppercase opacity-60 space-y-2">
          <p className="font-bold text-white">Everyday</p>
          <p>11:30 AM — 02:30 PM</p>
          <p>05:30 PM — 08:00 PM</p>
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-16 md:mt-24 pt-8 md:pt-12 border-t border-white/5 flex flex-col md:row justify-between items-center gap-6 opacity-20 text-center md:text-left">
      <p className="text-[8px] tracking-[0.4em] md:tracking-[0.5em] uppercase">© 2024 Pakizaah. All Rights Reserved.</p>
      <div className="flex gap-6 uppercase text-[8px] tracking-[0.4em]">
        <span>Instagram</span>
        <span>Pinterest</span>
      </div>
    </div>
  </footer>
);

const PakizaahApp = () => {
  const [activePage, setActivePage] = useState<'home' | 'jewelry' | 'fabric' | 'collections'>('home');
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isVideoCallModalOpen, setIsVideoCallModalOpen] = useState(false);
  const [whatsappInquiryItems, setWhatsappInquiryItems] = useState<any[]>([]);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [activeEditor, setActiveEditor] = useState<any>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activePage, activeSubcategory]);

  // Disable right-click and dragging on all images and videos to prevent saving
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.closest('img') || target.closest('video'))) {
        e.preventDefault();
      }
    };

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.closest('img') || target.closest('video'))) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('dragstart', handleDragStart, { capture: true });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('dragstart', handleDragStart, { capture: true });
    };
  }, []);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      const isOwner = user?.email?.toLowerCase() === 'salilfeb4@gmail.com';
      if ((isOwner && user?.emailVerified) || user?.isAnonymous) {
        setIsAdminLoggedIn(true);
      } else {
        setIsAdminLoggedIn(false);
      }
    });
    return unsubscribe;
  }, []);

  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('pakizaah_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If parsed config still has the old unsplash images, upgrade to DEFAULT_CONFIG
        if (parsed?.heroSlides?.[0]?.includes('unsplash.com/photo-1490481651871-ab68de25d43d')) {
          return DEFAULT_CONFIG;
        }
        return {
          ...DEFAULT_CONFIG,
          ...parsed
        };
      }
      return DEFAULT_CONFIG;
    } catch (e) {
      console.warn("Failed to load config from storage:", e);
      return DEFAULT_CONFIG;
    }
  });

  const [products, setProducts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pakizaah_products');
      return saved ? JSON.parse(saved) : COLLECTIONS[0].products;
    } catch (e) {
      console.warn("Failed to load products from storage:", e);
      return COLLECTIONS[0].products;
    }
  });

  // Sync with Firestore
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'config', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(prev => ({
          ...DEFAULT_CONFIG,
          ...prev, 
          ...data
        }) as AppConfig);
      }
    }, (err) => {
      console.warn('Config onSnapshot sync notice:', err);
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const dbItems = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      
      setProducts(prev => {
        // If DB is empty, use defaults (Heritage Series)
        if (dbItems.length === 0) return COLLECTIONS[0].products;

        const merged = [...COLLECTIONS[0].products]; // Start with defaults
        
        dbItems.forEach((dbItem: any) => {
          const idx = merged.findIndex(p => p.id === dbItem.id);
          if (idx !== -1) {
            merged[idx] = { ...merged[idx], ...dbItem };
          } else {
            merged.push(dbItem);
          }
        });
        
        // Remove default items if they are specifically deleted from DB?
        // Actually, we don't know if they were deleted or just not uploaded yet.
        // But for a published app, if we have other products, we should probably only show what's in DB.
        // Unless the user wants to keep the Heritage Series as "fixed" starters.
        
        return merged;
      });
    }, (err) => handleFirestoreError(err, OperationType.GET, 'products'));

    return () => {
      unsubConfig();
      unsubProducts();
    };
  }, []);

  const handleAdminLogin = async (emailOrKey: string) => {
    const val = (emailOrKey || '').trim();
    if (val.toLowerCase() === 'admin') {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.warn("Anonymous auth notice:", err);
      }
      setIsAdminLoggedIn(true);
      setIsLoginModalOpen(false);
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      if (val) {
        provider.setCustomParameters({ login_hint: val });
      }
      await signInWithPopup(auth, provider);
      setIsLoginModalOpen(false);
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/cancelled-popup-request') {
        alert('Sign-in popup was blocked by browser. You can enter access key "admin" to log in.');
      } else {
        alert('Login failed. Please sign in with salilfeb4@gmail.com or enter access key "admin".');
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdminLoggedIn(false);
  };

  const updateProductImage = async (id: string, url: any) => {
    if (typeof url !== 'string') {
      console.warn('Blocked non-string URL update for product image:', id, url);
      return;
    }
    // Optimistic Update
    const oldProducts = [...products];
    setProducts(prev => prev.map(p => p.id === id ? { ...p, image: url } : p));
    
    try {
      await setDoc(doc(db, 'products', id), { image: url }, { merge: true });
    } catch (error) {
      setProducts(oldProducts);
      handleFirestoreError(error, OperationType.WRITE, `products/${id}`);
    }
  };

  const updateConfigImage = async (key: keyof AppConfig, url: any) => {
    if (typeof url !== 'string') {
      console.warn('Blocked non-string URL update for config:', key, url);
      return;
    }
    const updatedConfig = { ...config, [key]: url };
    setConfig(updatedConfig);
    try {
      localStorage.setItem('pakizaah_config', safeStringify(updatedConfig));
      await setDoc(doc(db, 'config', 'main'), { [key]: url }, { merge: true });
    } catch (error) {
      console.warn("Firestore update notice for config:", error);
    }
  };

  const updateSlideImage = async (idx: number, url: any) => {
    if (typeof url !== 'string') {
      console.warn('Blocked non-string URL update for slide:', idx, url);
      return;
    }
    const optimisticSlides = [...config.heroSlides];
    optimisticSlides[idx] = url;
    const updatedConfig = { ...config, heroSlides: optimisticSlides };
    setConfig(updatedConfig);
    
    try {
      localStorage.setItem('pakizaah_config', safeStringify(updatedConfig));
      await setDoc(doc(db, 'config', 'main'), { heroSlides: optimisticSlides }, { merge: true });
    } catch (error) {
      console.warn("Firestore update notice for slide:", error);
    }
  };

  const addProduct = async () => {
    const id = `p-${Date.now()}`;
    const defaultCategory = activePage === 'home' ? 'apparel' : activePage;
    const codeNum = Math.floor(100 + Math.random() * 900);
    const newProduct = {
      id,
      code: `${codeNum}`,
      name: `New ${defaultCategory === 'jewelry' ? 'Jewelry' : defaultCategory === 'collections' ? 'Exclusive' : 'Apparel'} Piece`,
      price: 0,
      image: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&q=80&w=1600",
      desc: "Authentic craftsmanship detail.",
      category: defaultCategory,
      subcategory: activeSubcategory || "",
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, 'products', id), deepSafeCopy(newProduct));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `products/${id}`);
    }
  };

  const deleteProduct = async (id: string) => {
    // Optimistic Delete
    const oldProducts = [...products];
    setProducts(prev => prev.filter(p => p.id !== id));
    
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      setProducts(oldProducts);
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const updateProduct = async (id: string, updates: any) => {
    // Optimistic Update
    const oldProducts = [...products];
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    
    try {
      await setDoc(doc(db, 'products', id), deepSafeCopy(updates), { merge: true });
    } catch (error) {
      setProducts(oldProducts);
      handleFirestoreError(error, OperationType.WRITE, `products/${id}`);
    }
  };

  const handleEditorSave = async (url: string) => {
    if (!activeEditor) return;
    
    try {
      if (activeEditor.type === 'product' && activeEditor.productId) {
        await updateProduct(activeEditor.productId, { image: url });
      } else if (activeEditor.type === 'slide' && activeEditor.index !== undefined) {
        await updateSlideImage(activeEditor.index, url);
      } else if (activeEditor.type === 'config' && activeEditor.key) {
        await updateConfigImage(activeEditor.key, url);
      }
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("Verification failed. Please ensure you are signed in correctly.");
    }
    
    setActiveEditor(null);
  };

  useEffect(() => {
    localStorage.setItem('pakizaah_config', safeStringify(config));
  }, [config]);

  const addToCart = (product: any) => {
    setCart([...cart, product]);
    setIsCartOpen(true);
  };

  const syncAllToCloud = async () => {
    try {
      const batch = writeBatch(db);
      
      // Sync Config
      batch.set(doc(db, 'config', 'main'), deepSafeCopy(config));
      
      // Sync Products
      products.forEach(p => {
        batch.set(doc(db, 'products', p.id), deepSafeCopy(p));
      });
      
      await batch.commit();
      alert('Cloud Sync Complete: All current images and settings are now permanently saved in the database.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bulk-sync');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fdfcf9] font-sans selection:bg-[#fdfcf9] selection:text-[#0a0a0a]">
      <div className="fixed bottom-8 left-8 z-[200]">
        {isAdminLoggedIn && (
           <button 
             onClick={syncAllToCloud}
             className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-full hover:bg-white hover:text-black transition-all group flex items-center gap-3 overflow-hidden"
           >
             <Save className="w-5 h-5" />
             <span className="text-[9px] tracking-[0.2em] font-bold uppercase max-w-0 group-hover:max-w-xs transition-all duration-500">Sync All to Cloud</span>
           </button>
        )}
      </div>

      <Navigation 
        onOpenCart={() => setIsCartOpen(true)} 
        cartCount={cart.length} 
        logoUrl={config.logoUrl}
        onLogin={() => isAdminLoggedIn ? setIsAdminPanelOpen(true) : setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        isAdmin={isAdminLoggedIn}
        onPageChange={setActivePage}
        activePage={activePage}
        onSubcategoryChange={setActiveSubcategory}
        activeSubcategory={activeSubcategory}
        onUpdateLogo={(url) => updateConfigImage('logoUrl', url)}
      />

      <ProductDetailModal 
        product={selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
        onAddToCart={addToCart} 
        isAdmin={isAdminLoggedIn}
        onToggleSold={(id, currentSold) => updateProduct(id, { soldOut: !currentSold })}
        onInquireWhatsApp={(product) => setWhatsappInquiryItems([product])}
      />
      
      <main>
        {activePage === 'home' && (
          <>
            {/* Cinematic Hero */}
            <section className="relative h-screen flex items-center justify-center overflow-hidden">
              <HeroSlideshow 
                slides={config.heroSlides} 
                isAdmin={isAdminLoggedIn} 
                onUpdateSlide={(idx, url) => {
                  if (url && url !== config.heroSlides[idx]) {
                    updateSlideImage(idx, url);
                  } else {
                    setActiveEditor({
                      type: 'slide',
                      index: idx,
                      currentUrl: config.heroSlides[idx],
                      title: `Hero Slide ${idx + 1}`
                    });
                  }
                }} 
              />
            </section>
          </>
        )}

        {/* The Curation Gallery */}
        <section id="collections" className={cn("py-20 md:py-40 px-4 md:px-8", activePage !== 'home' && "pt-40 md:pt-60")}>
          <div className="max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 md:mb-32 border-b border-white/5 pb-8 md:pb-16 gap-12 md:gap-0">
              <div className="space-y-4 md:space-y-6">
                <h3 className="text-4xl sm:text-6xl md:text-8xl font-bodoni font-light tracking-tight uppercase leading-tight">
                  {activeSubcategory ? activeSubcategory : (
                    activePage === 'collections' ? 'Exclusive Sale' :
                    activePage === 'home' ? 'The Heritage Series' : 
                    activePage === 'jewelry' ? 'Fine Jewelry' : 'Apparel'
                  )}
                </h3>
              </div>
              <div className="flex flex-col items-center md:items-end gap-4 md:gap-6 w-full md:w-auto">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  {/* Product Search Box */}
                  <div className="relative w-full sm:w-64 md:w-72">
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search code or piece name..."
                      className="bg-white/5 border border-white/10 focus:border-[#D4AF37] px-4 pl-9 py-2.5 md:py-3 rounded-full text-[9px] md:text-[10px] tracking-[0.15em] uppercase font-mono text-[#D4AF37] placeholder:text-white/30 outline-none transition-all w-full shadow-inner"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')} 
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs px-1"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {isAdminLoggedIn && (
                    <button 
                      onClick={addProduct}
                      className="bg-white/10 backdrop-blur-xl border border-white/20 px-5 md:px-6 py-2.5 md:py-3 rounded-full flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-all group font-bold tracking-[0.2em] uppercase text-[9px] md:text-[11px] w-full sm:w-auto"
                    >
                      <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      New Creation
                    </button>
                  )}
                  
                  {(activePage === 'jewelry' || activePage === 'fabric' || activePage === 'collections') && (
                    <div className="relative group/subnav w-full sm:w-auto">
                      <select 
                        value={activeSubcategory || ""}
                        onChange={(e) => setActiveSubcategory(e.target.value || null)}
                        className="bg-white/5 border border-white/10 px-5 md:px-6 py-2.5 md:py-3 rounded-full text-[9px] md:text-[10px] tracking-[0.2em] uppercase font-bold outline-none hover:bg-white/10 transition-all cursor-pointer appearance-none pr-9 md:pr-10 w-full sm:min-w-[180px]"
                      >
                        <option value="" className="bg-[#0a0a0a]">All Collections</option>
                        {(activePage === 'jewelry' ? JEWELRY_SUBCATEGORIES : 
                          activePage === 'fabric' ? APPAREL_SUBCATEGORIES : 
                          [...APPAREL_SUBCATEGORIES, ...JEWELRY_SUBCATEGORIES]
                        ).map((sub: string) => (
                          <option key={sub} value={sub} className="bg-[#0a0a0a]">{sub}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 opacity-40 pointer-events-none" />
                    </div>
                  )}
                </div>

                <div className="flex gap-6 md:gap-10 text-[8px] md:text-[9px] tracking-[0.3em] uppercase font-bold pb-2 border-b md:border-b-0 border-white/5 w-full justify-center md:justify-end items-center flex-wrap">
                  <span 
                    onClick={() => { setActivePage('collections'); setActiveSubcategory(null); }} 
                    className={cn(
                      "cursor-pointer transition-all uppercase flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 animate-exclusive-flicker text-[#D4AF37]"
                    )}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#D4AF37]"></span>
                    </span>
                    Exclusive Sale
                  </span>
                  <span onClick={() => { setActivePage('jewelry'); setActiveSubcategory(null); }} className={cn("cursor-pointer transition-opacity uppercase", activePage === 'jewelry' ? "text-white border-b border-white" : "opacity-30 hover:opacity-100")}>Jewelry</span>
                  <span onClick={() => { setActivePage('fabric'); setActiveSubcategory(null); }} className={cn("cursor-pointer transition-opacity uppercase", activePage === 'fabric' ? "text-white border-b border-white" : "opacity-30 hover:opacity-100")}>Apparel</span>
                </div>
              </div>
            </div>

                  <div className={cn(
                    "grid gap-x-4 md:gap-x-12",
                    activePage === 'home' 
                      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-16 md:gap-y-32" 
                      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-8 md:gap-y-12"
                  )}>
                    {Array.isArray(products) && sortProducts(products)
                      .filter((p: any) => {
                        if (!p) return false;

                        // Filter by search query (Product Code or Name or Subcategory)
                        if (searchQuery.trim()) {
                          const q = searchQuery.trim().toLowerCase();
                          const codeMatch = (p.code || "").toLowerCase().includes(q);
                          const nameMatch = (p.name || "").toLowerCase().includes(q);
                          const descMatch = (p.desc || "").toLowerCase().includes(q);
                          const subMatch = (p.subcategory || "").toLowerCase().includes(q);
                          const catMatch = (p.category || "").toLowerCase().includes(q);
                          if (!codeMatch && !nameMatch && !descMatch && !subMatch && !catMatch) return false;
                        }

                        const catLower = (p.category || "").toLowerCase();
                        const subLower = (p.subcategory || "").toLowerCase();

                        // If explicitly in jewelry or fabric page
                        if (activePage === 'jewelry') {
                          if (activeSubcategory) return subLower === activeSubcategory.toLowerCase();
                          return catLower === 'jewelry';
                        }
                        if (activePage === 'fabric') {
                          if (activeSubcategory) return subLower === activeSubcategory.toLowerCase();
                          return catLower === 'fabric' || catLower === 'apparel';
                        }
                        if (activePage === 'collections') {
                          if (activeSubcategory) return subLower === activeSubcategory.toLowerCase();
                          return catLower === 'collections' || catLower === 'sale' || !!p.wasPrice || !!p.salePrice;
                        }
                        
                        // Default home view (mostly apparel/featured)
                        if (activePage === 'home') return true;

                        // Collections view (all)
                        return true;
                      })
                      .slice(0, activePage === 'home' ? 3 : 1000)
                      .map((p: any, i: number) => {
                        if (!p || !p.id) return null;
                        return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 1 }}
                        viewport={{ once: true }}
                        className={cn("group", activePage !== 'home' && "scale-[0.95] origin-top")}
                      >
                  <div className="relative aspect-[3/4] overflow-hidden mb-6 md:mb-10 bg-white/5 cursor-pointer" onClick={() => setSelectedProduct(p)}>
                    <EditableImage 
                      src={p.image}
                      secondSrc={p.secondImage}
                      thirdSrc={p.thirdImage}
                      fourthSrc={p.fourthImage}
                      fifthSrc={p.fifthImage}
                      alt={p.name}
                      isAdmin={isAdminLoggedIn}
                      onUpdate={(url) => updateProductImage(p.id, url)}
                      className="w-full h-full"
                      imageClassName="transition-all duration-700 opacity-100"
                    />

                    {isAdminLoggedIn && (
                      <div className="absolute top-4 md:top-6 right-4 md:right-6 z-[2100] flex gap-2">
                        <button 
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              console.log("Deleting product:", p.id);
                              await deleteProduct(p.id);
                            } catch (err) {
                              console.error("Delete failed:", safeStringify(err));
                              alert("Deletion failed.");
                            }
                          }}
                          className="bg-red-500 hover:bg-red-600 border border-white/20 text-white p-2 md:p-4 rounded-full opacity-40 group-hover:opacity-100 transition-all shadow-3xl scale-110 active:scale-95 pointer-events-auto"
                          style={{ isolation: 'isolate' }}
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4 md:w-5 md:h-5 pointer-events-none" />
                        </button>
                      </div>
                    )}

                    {p.soldOut && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 backdrop-blur-[0.5px] pointer-events-none select-none overflow-hidden">
                        <div className="w-[141%] bg-[#D4AF37] text-black font-black text-[10px] md:text-xs tracking-[0.4em] uppercase py-2 md:py-3 text-center rotate-[-45deg] shadow-[0_4px_10px_rgba(0,0,0,0.5)] border-y-2 border-black/15">
                          SOLD OUT
                        </div>
                      </div>
                    )}
                    
                    {!p.soldOut ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(p);
                        }}
                        className="absolute bottom-6 md:bottom-10 left-6 md:left-10 right-6 md:right-10 bg-white text-black py-4 md:py-5 text-[8px] md:text-[9px] tracking-[0.4em] md:tracking-[0.5em] uppercase font-bold opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 z-10 shadow-2xl"
                      >
                        Acquire Selection
                      </button>
                    ) : (
                      <button 
                        disabled
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="absolute bottom-6 md:bottom-10 left-6 md:left-10 right-6 md:right-10 bg-zinc-800 text-zinc-500 py-4 md:py-5 text-[8px] md:text-[9px] tracking-[0.4em] md:tracking-[0.5em] uppercase font-bold opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 z-10 cursor-not-allowed border border-white/5"
                      >
                        SOLD OUT
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-start border-b border-white/5 pb-4 md:pb-6">
                    <div className="space-y-2 flex-1">
                      {isAdminLoggedIn ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <input 
                              type="text"
                              value={p.code || ''}
                              onChange={(e) => updateProduct(p.id, { code: e.target.value })}
                              className="col-span-1 bg-white/10 border border-[#D4AF37]/40 px-3 py-1 text-xs font-mono font-bold tracking-wider outline-none focus:border-[#D4AF37] w-full text-[#D4AF37]"
                              placeholder="Code (e.g. 101)"
                            />
                            <input 
                              type="text"
                              value={p.name}
                              onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                              className="col-span-2 bg-white/5 border border-white/10 px-3 py-1 text-sm font-bodoni uppercase tracking-wider outline-none focus:border-[#D4AF37] w-full text-white"
                              placeholder="Piece Name"
                            />
                          </div>
                          <input 
                            type="text"
                            value={p.image || ''}
                            onChange={(e) => updateProduct(p.id, { image: e.target.value })}
                            className="bg-white/10 border border-[#D4AF37]/30 px-3 py-1 text-[8px] tracking-[0.2em] font-mono outline-none focus:border-[#D4AF37] w-full text-white/80"
                            placeholder="Piece Image/Video URL (Paste Here)"
                          />
                          <input 
                            type="text"
                            value={p.secondImage || ''}
                            onChange={(e) => updateProduct(p.id, { secondImage: e.target.value })}
                            className="bg-white/10 border border-[#D4AF37]/30 px-3 py-1 text-[8px] tracking-[0.2em] font-mono outline-none focus:border-[#D4AF37] w-full text-white/80"
                            placeholder="Alternate Pose URL / Google Drive Link (Pose 2)"
                          />
                          <input 
                            type="text"
                            value={p.thirdImage || ''}
                            onChange={(e) => updateProduct(p.id, { thirdImage: e.target.value })}
                            className="bg-white/10 border border-[#D4AF37]/30 px-3 py-1 text-[8px] tracking-[0.2em] font-mono outline-none focus:border-[#D4AF37] w-full text-white/80"
                            placeholder="Third Pose URL / Google Drive Link (Pose 3)"
                          />
                          <input 
                            type="text"
                            value={p.fourthImage || ''}
                            onChange={(e) => updateProduct(p.id, { fourthImage: e.target.value })}
                            className="bg-white/10 border border-[#D4AF37]/30 px-3 py-1 text-[8px] tracking-[0.2em] font-mono outline-none focus:border-[#D4AF37] w-full text-white/80"
                            placeholder="Fourth Pose URL / Google Drive Link (Pose 4)"
                          />
                          <input 
                            type="text"
                            value={p.fifthImage || ''}
                            onChange={(e) => updateProduct(p.id, { fifthImage: e.target.value })}
                            className="bg-white/10 border border-[#D4AF37]/30 px-3 py-1 text-[8px] tracking-[0.2em] font-mono outline-none focus:border-[#D4AF37] w-full text-white/80"
                            placeholder="Fifth Pose URL / Google Drive Link (Pose 5)"
                          />
                          <input 
                            type="text"
                            value={p.desc}
                            onChange={(e) => updateProduct(p.id, { desc: e.target.value })}
                            className="bg-white/5 border border-white/10 px-3 py-1 text-[9px] tracking-[0.2em] uppercase opacity-60 outline-none focus:border-[#D4AF37] w-full text-white"
                            placeholder="Short Description"
                          />
                          <select 
                            value={p.category || 'apparel'}
                            onChange={(e) => updateProduct(p.id, { category: e.target.value, subcategory: null })}
                            className="bg-white/5 border border-white/10 px-3 py-1 text-[8px] tracking-[0.4em] uppercase opacity-40 outline-none focus:border-[#D4AF37] w-full text-white appearance-none"
                          >
                            <option value="apparel" className="bg-[#0a0a0a]">Apparel</option>
                            <option value="jewelry" className="bg-[#0a0a0a]">Jewelry</option>
                            <option value="fabric" className="bg-[#0a0a0a]">Fabric (Apparel)</option>
                            <option value="collections" className="bg-[#0a0a0a]">Exclusive Sale</option>
                          </select>
                          
                          {(p.category === 'jewelry' || p.category === 'fabric' || p.category === 'apparel' || p.category === 'collections' || p.name.toLowerCase().includes('jewelry') || p.name.toLowerCase().includes('fabric')) && (
                            <select 
                              value={p.subcategory || ''}
                              onChange={(e) => updateProduct(p.id, { subcategory: e.target.value })}
                              className="bg-white/5 border border-white/10 px-3 py-1 text-[8px] tracking-[0.4em] uppercase opacity-40 outline-none focus:border-[#D4AF37] w-full text-white appearance-none mt-2"
                            >
                              <option value="" className="bg-[#0a0a0a]">Select Subcategory</option>
                              {(p.category === 'jewelry' || p.name.toLowerCase().includes('jewelry') ? JEWELRY_SUBCATEGORIES : 
                                p.category === 'collections' ? [...APPAREL_SUBCATEGORIES, ...JEWELRY_SUBCATEGORIES] : 
                                APPAREL_SUBCATEGORIES).map((sub: string) => (
                                <option key={sub} value={sub} className="bg-[#0a0a0a]">{sub}</option>
                              ))}
                            </select>
                          )}

                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="text-[7px] tracking-[0.1em] opacity-30 uppercase block mb-1">Was Price</label>
                              <input 
                                type="text"
                                value={p.wasPrice || ''}
                                onChange={(e) => updateProduct(p.id, { wasPrice: e.target.value })}
                                className="bg-white/5 border border-white/10 px-2 py-1 text-[9px] outline-none focus:border-[#D4AF37] w-full text-white"
                                placeholder="e.g. A$45,000"
                              />
                            </div>
                            <div>
                              <label className="text-[7px] tracking-[0.1em] opacity-30 uppercase block mb-1">Sale Price</label>
                              <input 
                                type="text"
                                value={p.salePrice || ''}
                                onChange={(e) => updateProduct(p.id, { salePrice: e.target.value })}
                                className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 px-2 py-1 text-[9px] outline-none focus:border-[#D4AF37] w-full text-[#D4AF37]"
                                placeholder="e.g. A$29,500"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2 bg-white/5 p-2 border border-white/10 rounded">
                            <input 
                              type="checkbox"
                              id={`soldOut-${p.id}`}
                              checked={!!p.soldOut}
                              onChange={(e) => updateProduct(p.id, { soldOut: e.target.checked })}
                              className="accent-[#D4AF37] h-3.5 w-3.5 cursor-pointer rounded border-white/10 bg-white/5"
                            />
                            <label htmlFor={`soldOut-${p.id}`} className="text-[8px] tracking-[0.15em] uppercase font-bold text-[#D4AF37] select-none cursor-pointer">
                              Mark as Sold Out
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {p.code && (
                            <div className="mb-1">
                              <span className="inline-block bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/50 text-[11px] md:text-[13px] font-mono font-bold tracking-widest px-2.5 py-1 rounded uppercase shadow-sm">
                                CODE: #{p.code}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-lg md:text-xl font-bodoni uppercase tracking-wider">{p.name}</h4>
                            {p.soldOut && (
                              <span className="bg-[#D4AF37] text-black font-black text-[7px] tracking-widest px-1.5 py-0.5 rounded uppercase shadow-sm">
                                SOLD OUT
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase opacity-30 italic leading-relaxed">{p.desc}</p>
                          {(p.wasPrice || p.salePrice) && (
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-2 text-[9px] tracking-[0.15em] uppercase font-bold text-white/90">
                              {p.wasPrice && (
                                <span className="text-white/40">Was: <span className="relative inline-block text-white/30 px-1 font-semibold">{p.wasPrice}<span className="absolute left-[-5%] right-[-5%] top-[50%] h-[1.5px] bg-[#D4AF37]/80 -rotate-[12deg] transform origin-center pointer-events-none" /></span></span>
                              )}
                              {p.wasPrice && p.salePrice && <span className="opacity-20">•</span>}
                              {p.salePrice && (
                                <span className="text-[#D4AF37]">Sale Price: {p.salePrice}</span>
                              )}
                            </div>
                          )}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWhatsappInquiryItems([p]);
                              }}
                              className="inline-flex items-center gap-2 text-[#25D366] hover:text-white hover:bg-[#25D366] text-[8px] md:text-[9px] tracking-[0.2em] uppercase font-bold transition-all duration-300 border border-[#25D366]/35 hover:border-[#25D366] px-2.5 py-1.5 rounded bg-[#25D366]/5 cursor-pointer"
                            >
                              <svg className="w-3 h-3 md:w-3.5 md:h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.115-2.903-6.99-1.872-1.873-4.35-2.903-6.986-2.904-5.44 0-9.866 4.425-9.869 9.868-.001 1.79.468 3.548 1.36 5.113L1.816 22.33l4.831-1.266zM17.522 14.382c-.3-.149-1.78-.879-2.055-.978-.277-.1-.478-.149-.68.149-.2.3-.775.979-.95 1.178-.175.2-.351.224-.651.075-.3-.15-1.267-.467-2.414-1.492-.893-.797-1.496-1.78-1.671-2.08-.175-.3-.019-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.3.3-.499.1-.2.05-.375-.025-.524-.075-.15-.68-1.64-.931-2.24-.244-.59-.513-.51-.68-.51-.175-.008-.375-.01-.575-.01-.2 0-.525.075-.8.376-.275.3-.1.177-1.05 1.1-.95 1.1-1.025 2.199-1.025 3.321s.8 2.22 1.1 2.62c.3.4 2.371 3.621 5.741 5.072 2.235.962 3.125 1.01 4.11.861.73-.11 1.78-.727 2.03-1.424.25-.699.25-1.299.175-1.424-.075-.125-.275-.199-.575-.349z"/>
                              </svg>
                              Inquire on WhatsApp
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )})}
            </div>
          </div>
        </section>

        {activePage === 'home' && (
          <>
            {/* Feature Cinematic Spread */}
            <section className="relative h-screen grid grid-cols-1 md:grid-cols-2">
              <div className="relative h-full overflow-hidden">
                <EditableImage 
                  src={config.artisanImage}
                  alt="Artisan Detail"
                  isAdmin={isAdminLoggedIn}
                  onImageClick={setLightboxImage}
                  onUpdate={(url) => updateConfigImage('artisanImage', url)}
                  className="w-full h-full"
                  imageClassName="opacity-100 transition-all duration-1000"
                />
              </div>
              <div className="bg-[#0a0a0a] flex items-center justify-center p-12 md:p-24 border-l border-white/5">
                <div className="max-w-xl space-y-12">
                  <span className="text-[10px] tracking-[0.8em] uppercase opacity-30 block">Master Artisans</span>
                  <div>
                    <h2 className="text-6xl md:text-8xl font-bodoni italic font-light leading-none">The Soul of<br />Pakizaah</h2>
                    <motion.p 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      className="text-lg md:text-xl tracking-tight font-bodoni font-bold italic text-[#D4AF37] mt-6"
                    >
                      Meet Our Founder: Mrs. Monika Sondhi
                    </motion.p>
                  </div>
                  <p className="text-xl serif font-light italic leading-relaxed opacity-60">
                    In a world of fleeting trends, we stand for the permanent. Our artisans spend hundreds of hours on a single weave, ensuring that the legacy of a thousand years lives in every thread.
                  </p>
                  <div className="pt-8 flex flex-col gap-8">
                    <button 
                      onClick={() => {
                        const element = document.getElementById('collections');
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className="w-max px-12 py-5 bg-[#fdfcf9] text-black text-[10px] tracking-[0.5em] uppercase font-bold flex items-center gap-6 group cursor-pointer"
                    >
                      View Atelier <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-12 border-t border-white/5 opacity-60 text-[10px] tracking-[0.4em] uppercase font-bold">
                      <div className="text-[#D4AF37]">Bollywood Inspired Apparel</div>
                      <div className="text-white">Worldwide Shipping</div>
                      <div className="text-white">Latest and High End Designs</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Video Narrative Section */}
            <section className="py-20 md:py-40 px-4 md:px-8 bg-[#0a0a0a]">
              <div className="max-w-[1600px] mx-auto space-y-12 md:space-y-20">
                <div className="text-center space-y-6 md:space-y-8">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1 }}
                  >
                    <span className="text-[9px] md:text-[10px] tracking-[0.6em] md:tracking-[1em] uppercase opacity-40 block mb-4 md:mb-6">The Art of the Craft</span>
                    <h3 className="text-3xl sm:text-4xl md:text-7xl font-bodoni italic font-light text-white">A Legacy in Motion</h3>
                  </motion.div>
                </div>

                <div className="relative aspect-video overflow-hidden group border border-white/5 bg-white/5 shadow-2xl">
                  {config.videoUrl ? (
                    <div className="w-full h-full">
                      {/* For Drive links, if the direct stream fails, we use the Preview Player which is more reliable */}
                      {(() => {
                        const driveIdMatch = config.videoUrl.match(/([a-zA-Z0-9_-]{25,})/);
                        const driveId = driveIdMatch ? driveIdMatch[1] : null;

                        if (driveId && config.videoUrl.includes('drive.google.com')) {
                          return (
                            <iframe 
                              src={`https://drive.google.com/file/d/${driveId}/preview`}
                              className="w-full h-full border-0"
                              allow="autoplay"
                            />
                          );
                        }

                        return (
                          <video 
                            key={config.videoUrl}
                            src={sanitizeMediaUrl(config.videoUrl, true)}
                            autoPlay 
                            loop 
                            muted 
                            playsInline
                            className="w-full h-full object-cover group-hover:scale-110 transition-all duration-[10000ms]"
                          />
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center italic opacity-20 serif text-2xl">
                      Narrative Vision
                    </div>
                  )}
                  {isAdminLoggedIn && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveEditor({
                          type: 'config',
                          key: 'videoUrl',
                          currentUrl: config.videoUrl,
                          title: 'Narrative Video URL'
                        });
                      }}
                      className="absolute top-8 right-8 bg-black/60 backdrop-blur-xl p-4 rounded-full opacity-0 group-hover:opacity-100 text-white transition-all z-40 shadow-2xl scale-110 flex items-center justify-center border border-white/20"
                      title="Edit Video"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
              </div>
            </section>

            {/* Fine Jewelry Call-out */}
            <section className="py-20 md:py-40 px-4 md:px-8 bg-[#0a0a0a]">
              <div className="max-w-[1200px] mx-auto text-center space-y-12 md:space-y-20">
                <div className="space-y-4 md:space-y-6">
                  <p className="text-[9px] md:text-[10px] tracking-[0.6em] md:tracking-[1em] uppercase opacity-30">Adornments</p>
                  <h2 className="text-4xl sm:text-7xl md:text-9xl font-bodoni font-light uppercase tracking-tighter">Artisanal Jewelry</h2>
                </div>
                
                <div className="relative aspect-video overflow-hidden border border-white/5">
                   <EditableImage 
                    src={config.jewelryImage}
                    alt="Jewelry"
                    isAdmin={isAdminLoggedIn}
                    onImageClick={setLightboxImage}
                    onUpdate={(url) => updateConfigImage('jewelryImage', url)}
                    className="w-full h-full"
                    imageClassName="opacity-100 transition-transform duration-[5s]"
                   />
                   <div className="absolute inset-0 flex items-end justify-end p-4 md:p-16 pointer-events-none">
                      <div className="p-6 md:p-12 border border-white/20 backdrop-blur-xl bg-black/10 text-right space-y-4 md:space-y-6 max-w-[280px] md:max-w-sm pointer-events-auto">
                        <h4 className="text-2xl md:text-4xl font-bodoni italic">Bespoke Curation</h4>
                        <p className="text-[8px] md:text-[10px] tracking-[0.3em] md:tracking-[0.4em] uppercase opacity-60">Limited Edition Hand-Carved Masterpieces</p>
                        <button className="text-[8px] md:text-[9px] tracking-[0.4em] md:tracking-[0.5em] uppercase font-bold border-b border-white/50 pb-2 hover:border-white transition-colors ml-auto block">Request Access</button>
                      </div>
                   </div>
                </div>
              </div>
            </section>

            {/* Shopping Policies | Terms & Conditions */}
            <ShoppingPoliciesSection />
          </>
        )}

        {/* Atelier Location Map Section */}
        <section id="location-map" className="py-20 md:py-32 px-4 md:px-8 bg-[#0a0a0a] border-t border-white/5">
          <div className="max-w-[1600px] mx-auto space-y-12">
            <div className="text-center space-y-4">
              <p className="text-[9px] md:text-[10px] tracking-[0.6em] md:tracking-[1em] uppercase opacity-30">Visit the Atelier</p>
              <h2 className="text-3xl sm:text-5xl font-bodoni font-light uppercase tracking-tight text-[#D4AF37]">Our Location</h2>
              <p className="text-[11px] md:text-xs tracking-[0.2em] uppercase opacity-50 max-w-lg mx-auto">
                14/220 Holt PDE, Thomastown, VIC 3074, Melbourne, Australia
              </p>
            </div>
            
            <div className="relative w-full h-[350px] md:h-[500px] bg-white/5 border border-white/10 rounded-sm overflow-hidden group">
              <iframe 
                title="Pakizaah Boutique Google Map"
                src="https://maps.google.com/maps?q=Pakizaah%20Boutique,%2014/220%20Holt%20Pde,%20Thomastown%20VIC%203074&t=&z=15&ie=UTF8&iwloc=&output=embed" 
                className="w-full h-full border-0 opacity-80 contrast-[1.05] grayscale invert transition-all duration-700 group-hover:grayscale-0 group-hover:invert-0 group-hover:opacity-100"
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-4 py-2 border border-[#D4AF37]/30 text-[#D4AF37] text-[9px] tracking-widest uppercase font-bold rounded shadow-lg pointer-events-none group-hover:opacity-0 transition-opacity duration-500">
                Atelier Coordinates
              </div>
            </div>
          </div>
        </section>

        <ImageLightbox 
          src={lightboxImage || ""} 
          isOpen={!!lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      </main>

      <footer className="bg-[#0a0a0a] border-t border-white/5 pt-20 md:pt-40 pb-12 md:pb-16 px-6 md:px-8">
        <div className="max-w-[1800px] mx-auto space-y-16 md:space-y-24">
          <div className="text-center space-y-8 md:space-y-12">
            <h2 className="text-4xl sm:text-6xl md:text-9xl font-bodoni font-light tracking-[0.2em] md:tracking-[0.4em] uppercase text-white/5">Pakizaah</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 md:gap-16 text-left max-w-7xl mx-auto pt-8 md:pt-16">
              <div className="space-y-4 md:space-y-6">
                <h4 className="text-[10px] tracking-[0.4em] uppercase font-bold text-[#D4AF37]">The Boutique</h4>
                <div className="text-lg md:text-xl font-bodoni uppercase tracking-wide space-y-1">
                  <p>Pakizaah Boutique</p>
                  <p>14/220 Holt PDE</p>
                  <p>Thomastown, VIC 3074</p>
                  <p>Melbourne, Australia</p>
                </div>
              </div>
              
              <div className="space-y-4 md:space-y-6">
                <h4 className="text-[10px] tracking-[0.4em] uppercase font-bold text-[#D4AF37]">Engagement</h4>
                <div className="text-[10px] md:text-[11px] tracking-[0.2em] uppercase space-y-4 opacity-60">
                  <div className="space-y-1">
                    <p className="font-bold text-white mb-2">Ph: 03 9614 4531</p>
                    <p>0061 0430 244 149</p>
                    <p>0061 0452 482 019</p>
                    <p className="text-[#D4AF37] pt-1">Order WhatsApp: {PAKIZAAH_ORDER_WHATSAPP_DISPLAY}</p>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[9px] opacity-40">Thomastown, Melbourne</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6">
                <h4 className="text-[10px] tracking-[0.4em] uppercase font-bold text-[#D4AF37]">Atelier Hours</h4>
                <div className="text-[10px] md:text-[11px] tracking-[0.2em] uppercase opacity-60 space-y-2">
                  <p className="font-bold text-white">Everyday</p>
                  <p>11:30 AM — 02:30 PM</p>
                  <p>05:30 PM — 08:00 PM</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 text-[9px] md:text-[10px] tracking-[0.4em] md:tracking-[0.6em] uppercase font-bold items-center justify-items-center">
            <button 
              onClick={() => setActivePage('collections')} 
              className="px-4 py-2.5 rounded border border-[#D4AF37]/50 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/25 transition-all uppercase text-center text-[#D4AF37] animate-exclusive-flicker flex items-center justify-center gap-1.5"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#D4AF37]"></span>
              </span>
              Exclusive Sale
            </button>
            <button onClick={() => setActivePage('home')} className="opacity-30 hover:opacity-100 transition-opacity uppercase text-center text-white cursor-pointer">Heritage</button>
            <button
              onClick={() => {
                setActivePage('home');
                setTimeout(() => {
                  document.getElementById('shopping-policies')?.scrollIntoView({ behavior: 'smooth' });
                }, 120);
              }}
              className="opacity-50 hover:opacity-100 hover:text-[#D4AF37] transition-all uppercase text-center text-white cursor-pointer"
            >
              Policies
            </button>
            <button disabled className="opacity-10 transition-opacity uppercase text-center cursor-default text-white">Social</button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center pt-16 md:pt-24 border-t border-white/5 gap-8 md:gap-12 opacity-30 text-center">
            <p className="text-[8px] tracking-[0.4em] md:tracking-[0.5em] uppercase">© 2024 Pakizaah International. All Rights Reserved.</p>
            <div className="flex gap-8 md:gap-12 text-[8px] md:text-[9px] tracking-[0.4em] md:tracking-[0.5em] uppercase">
              <span>Privacy</span>
              <span>Accessibility</span>
              <span>Atelier</span>
            </div>
          </div>
        </div>
      </footer>

      <CartSidebar 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cart={cart} 
        onRemove={(idx: number) => setCart(cart.filter((_, i) => i !== idx))}
        onBookCall={() => { setIsCartOpen(false); setIsVideoCallModalOpen(true); }}
        onInquireWhatsApp={() => {
          const items = [...cart];
          setIsCartOpen(false);
          setWhatsappInquiryItems(items);
        }}
        onImageClick={setLightboxImage}
      />

      <WhatsAppInquiryModal
        isOpen={whatsappInquiryItems.length > 0}
        items={whatsappInquiryItems}
        onClose={() => setWhatsappInquiryItems([])}
        sanitizeMediaUrl={sanitizeMediaUrl}
      />

      <AnimatePresence>
        {isVideoCallModalOpen && (
          <VideoCallModal 
            onCancel={() => setIsVideoCallModalOpen(false)}
            cart={cart}
          />
        )}
      </AnimatePresence>

      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleAdminLogin}
      />

      <AdminPanel 
        isOpen={isAdminPanelOpen} 
        isLoggedIn={isAdminLoggedIn}
        config={config}
        onUpdate={async (c: AppConfig) => {
          setConfig(c);
          try {
            localStorage.setItem('pakizaah_config', safeStringify(c));
            await setDoc(doc(db, 'config', 'main'), deepSafeCopy(c), { merge: true });
          } catch (error) {
            console.warn("Firestore config save notice:", error);
          }
        }}
        onClose={() => setIsAdminPanelOpen(false)}
        onLogin={(pass) => {
          if (pass === 'admin') {
            signInAnonymously(auth).catch((err) => {
              console.warn("Anonymous auth failed:", err);
            });
            setIsAdminLoggedIn(true);
            return true;
          }
          return false;
        }}
        products={products}
        onUpdateProduct={(id, url) => {
          updateProductImage(id, url);
        }}
        onAddProduct={addProduct}
        onDeleteProduct={deleteProduct}
        onUpdateProductDetails={updateProduct}
      />

      <ImageEditorModal 
        isOpen={!!activeEditor}
        onClose={() => setActiveEditor(null)}
        onSave={handleEditorSave}
        initialUrl={activeEditor?.currentUrl || ''}
        title={activeEditor?.title || 'Edit Image'}
      />

    </div>
  );
};

export default PakizaahApp;
