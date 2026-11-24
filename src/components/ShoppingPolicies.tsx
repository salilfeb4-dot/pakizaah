import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ban,
  Eye,
  Video,
  Truck,
  CheckCircle2,
  Palette,
  Tag,
  MessageCircle,
  Clock,
  Sparkles,
  Copy,
  Check,
  X,
  Heart,
  ExternalLink,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../lib/utils';

export const PAKIZAAH_ORDER_WHATSAPP_DISPLAY = '+61 413 867 001';
export const PAKIZAAH_ORDER_WHATSAPP_DIGITS = '61413867001';
export const PAKIZAAH_INQUIRY_WHATSAPP_DIGITS = '61452482019';

export interface PolicyItem {
  number: string;
  numDisplay: string;
  title: string;
  description: string;
  emphasis?: string;
  phoneHighlight?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const PAKIZAAH_POLICIES: PolicyItem[] = [
  {
    number: '1',
    numDisplay: '01',
    title: 'NO REFUNDS OR EXCHANGES',
    description: 'All sales are final. We do not offer refunds or exchanges.',
    icon: Ban,
  },
  {
    number: '2',
    numDisplay: '02',
    title: 'FOR PICK-UP ORDERS',
    description:
      'Please inspect your items carefully before leaving. Any damage reported after leaving the premises will not be accepted.',
    icon: Eye,
  },
  {
    number: '3',
    numDisplay: '03',
    title: 'FOR POSTAL DELIVERIES',
    description:
      'An unedited, continuous parcel-opening video is mandatory to claim any exchange or replacement in case of damage or incorrect items.',
    emphasis: 'NO VIDEO = NO EXCHANGE / NO REPLACEMENT.',
    icon: Video,
  },
  {
    number: '4',
    numDisplay: '04',
    title: 'POSTAGE CHARGES',
    description:
      'Postal delivery is available at additional charges, payable by the customer.',
    icon: Truck,
  },
  {
    number: '5',
    numDisplay: '05',
    title: 'ORDER CONFIRMATION',
    description:
      'Once your order is confirmed, no cancellations or change-of-mind requests will be entertained.',
    icon: CheckCircle2,
  },
  {
    number: '6',
    numDisplay: '06',
    title: 'COLOUR VARIATIONS',
    description:
      'Actual product colours may vary slightly due to lighting conditions, photography and screen settings.',
    icon: Palette,
  },
  {
    number: '7',
    numDisplay: '07',
    title: 'FIXED PRICES',
    description: 'All our prices are firm and non-negotiable.',
    icon: Tag,
  },
  {
    number: '8',
    numDisplay: '08',
    title: 'ORDER CONFIRMATION',
    description:
      'To confirm your order, kindly send a screenshot of your selected item to our WhatsApp number:',
    phoneHighlight: PAKIZAAH_ORDER_WHATSAPP_DISPLAY,
    icon: MessageCircle,
  },
  {
    number: '9',
    numDisplay: '09',
    title: 'PAYMENT POLICY',
    description:
      'After order confirmation, payment must be completed within 24 hours.',
    icon: Clock,
  },
  {
    number: '10',
    numDisplay: '10',
    title: 'NO HOLDS, PLEASE!',
    description:
      'We do not reserve or hold items. All products are available on a first-come, first-served basis.',
    icon: Sparkles,
  },
];

export const PAKIZAAH_POLICIES_WHATSAPP_MESSAGE = `*PAKIZAAH*
*SHOPPING POLICIES | TERMS & CONDITIONS*

Thank you for choosing PAKIZAAH! ❤️

We truly appreciate your love and support. To ensure a smooth and delightful shopping experience, kindly read our policies carefully before placing your order.

*1. NO REFUNDS OR EXCHANGES*
All sales are final. We do not offer refunds or exchanges.

*2. FOR PICK-UP ORDERS*
Please inspect your items carefully before leaving. Any damage reported after leaving the premises will not be accepted.

*3. FOR POSTAL DELIVERIES*
An unedited, continuous parcel-opening video is mandatory to claim any exchange or replacement in case of damage or incorrect items.
*NO VIDEO = NO EXCHANGE / NO REPLACEMENT.*

*4. POSTAGE CHARGES*
Postal delivery is available at additional charges, payable by the customer.

*5. ORDER CONFIRMATION*
Once your order is confirmed, no cancellations or change-of-mind requests will be entertained.

*6. COLOUR VARIATIONS*
Actual product colours may vary slightly due to lighting conditions, photography and screen settings.

*7. FIXED PRICES*
All our prices are firm and non-negotiable.

*8. ORDER CONFIRMATION*
To confirm your order, kindly send a screenshot of your selected item to our WhatsApp number:
*+61 413 867 001*

*9. PAYMENT POLICY*
After order confirmation, payment must be completed within 24 hours.

*10. NO HOLDS, PLEASE!*
We do not reserve or hold items. All products are available on a first-come, first-served basis.

*NEED ASSISTANCE?*
For further information or queries, feel free to connect with us through WhatsApp, Facebook, Instagram or TikTok.

*Let's make every shopping experience a gratifying one!*

Thank you for your time, trust and continued support. ❤️

*WITH LOVE,*
*TEAM PAKIZAAH*
_Discover Yourself in PAKIZAAH._`;

export const buildWhatsAppLink = (phoneDigits: string, message: string): string => {
  const cleanPhone = phoneDigits.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(message);
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    return cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;
  }
  return cleanPhone
    ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://web.whatsapp.com/send?text=${encodedText}`;
};

export const buildProductInquiryMessage = (
  items: any[],
  sanitizeMediaUrl: (url: any, isVideoAlt?: boolean) => string,
  options?: {
    customerName?: string;
    customerNote?: string;
    includePolicies?: boolean;
  }
): string => {
  let text = `Hello PAKIZAAH Boutique,\n\n`;
  if (options?.customerName?.trim()) {
    text += `👤 *Customer:* ${options.customerName.trim()}\n\n`;
  }

  if (items.length === 1) {
    const product = items[0];
    const productName = product?.name || 'Artisan Piece';
    text += `I am interested in inquiring about this beautiful piece:\n`;
    if (product?.code) text += `🔢 *Product Code:* ${product.code}\n`;
    text += `✨ *Product:* ${productName}\n`;
    if (product?.salePrice) {
      text += `💵 *Sale Price:* ${product.salePrice}\n`;
    } else if (product?.price) {
      text += `💵 *Price:* ${product.price}\n`;
    }
    if (product?.category) text += `🏷️ *Category:* ${product.category}\n`;
    if (product?.subcategory) text += `📁 *Subcategory:* ${product.subcategory}\n`;
    if (product?.desc) text += `📝 *Details:* ${product.desc}\n`;

    const poses = [
      product?.image,
      product?.secondImage,
      product?.thirdImage,
      product?.fourthImage,
      product?.fifthImage,
    ].filter(Boolean);

    if (poses.length > 0) {
      text += `\n📸 *Product Poses / Images:*\n`;
      poses.forEach((poseUrl, idx) => {
        text += `• Pose ${idx + 1}: ${sanitizeMediaUrl(poseUrl)}\n`;
      });
    }
  } else if (items.length > 1) {
    text += `I am interested in inquiring about the following pieces from my selection:\n\n`;
    items.forEach((product, idx) => {
      text += `*${idx + 1}. ${product?.name || 'Artisan Piece'}*`;
      if (product?.code) text += ` (Code: ${product.code})`;
      if (product?.salePrice || product?.price) {
        text += ` — ${product.salePrice || product.price}`;
      }
      text += `\n`;
      if (product?.image) {
        text += `   📸 ${sanitizeMediaUrl(product.image)}\n`;
      }
    });
  }

  if (options?.customerNote?.trim()) {
    text += `\n💬 *Additional Note:* ${options.customerNote.trim()}\n`;
  }

  text += `\nCould you please let me know about availability and ordering details? I have read and acknowledged PAKIZAAH's Shopping Policies. Thank you!`;

  if (options?.includePolicies !== false) {
    text += `\n\n━━━━━━━━━━━━━━━━━━\n\n${PAKIZAAH_POLICIES_WHATSAPP_MESSAGE}`;
  }

  return text;
};

const WhatsAppGlyph = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={cn('fill-current', className)} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.115-2.903-6.99-1.872-1.873-4.35-2.903-6.986-2.904-5.44 0-9.866 4.425-9.869 9.868-.001 1.79.468 3.548 1.36 5.113L1.816 22.33l4.831-1.266zM17.522 14.382c-.3-.149-1.78-.879-2.055-.978-.277-.1-.478-.149-.68.149-.2.3-.775.979-.95 1.178-.175.2-.351.224-.651.075-.3-.15-1.267-.467-2.414-1.492-.893-.797-1.496-1.78-1.671-2.08-.175-.3-.019-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.3.3-.499.1-.2.05-.375-.025-.524-.075-.15-.68-1.64-.931-2.24-.244-.59-.513-.51-.68-.51-.175-.008-.375-.01-.575-.01-.2 0-.525.075-.8.376-.275.3-.1.177-1.05 1.1-.95 1.1-1.025 2.199-1.025 3.321s.8 2.22 1.1 2.62c.3.4 2.371 3.621 5.741 5.072 2.235.962 3.125 1.01 4.11.861.73-.11 1.78-.727 2.03-1.424.25-.699.25-1.299.175-1.424-.075-.125-.275-.199-.575-.349z" />
  </svg>
);

export const ShoppingPoliciesSection: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyPolicies = async () => {
    try {
      await navigator.clipboard.writeText(PAKIZAAH_POLICIES_WHATSAPP_MESSAGE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for restricted clipboard contexts
      const textarea = document.createElement('textarea');
      textarea.value = PAKIZAAH_POLICIES_WHATSAPP_MESSAGE;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <section
      id="shopping-policies"
      className="relative py-24 md:py-36 px-4 sm:px-6 md:px-10 bg-[#0a0a0a] border-t border-white/5 overflow-hidden"
    >
      {/* Subtle Ambient Luxury Gold Glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            'radial-gradient(ellipse 65% 50% at 50% 0%, rgba(212, 175, 55, 0.09) 0%, rgba(10, 10, 10, 0) 75%)',
        }}
      />

      <div className="relative max-w-[1320px] mx-auto">
        {/* Outer Ornamental Frame */}
        <div className="relative border border-[#D4AF37]/25 bg-gradient-to-b from-white/[0.025] via-[#0d0c0a]/80 to-[#0a0a0a] p-6 sm:p-10 md:p-16 lg:p-20 shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
          {/* Corner Filigree Accents */}
          <span className="pointer-events-none absolute top-3 left-3 w-5 h-5 border-t border-l border-[#D4AF37]/60" />
          <span className="pointer-events-none absolute top-3 right-3 w-5 h-5 border-t border-r border-[#D4AF37]/60" />
          <span className="pointer-events-none absolute bottom-3 left-3 w-5 h-5 border-b border-l border-[#D4AF37]/60" />
          <span className="pointer-events-none absolute bottom-3 right-3 w-5 h-5 border-b border-r border-[#D4AF37]/60" />

          {/* Header Block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="text-center max-w-3xl mx-auto space-y-6 pb-14 md:pb-20 border-b border-white/10"
          >
            <div className="inline-flex items-center gap-3 px-5 py-2 border border-[#D4AF37]/30 bg-[#D4AF37]/[0.06] rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="text-[9px] sm:text-[10px] tracking-[0.38em] uppercase font-semibold text-[#D4AF37]">
                Shopping Policies &nbsp;|&nbsp; Terms &amp; Conditions
              </span>
            </div>

            <div className="space-y-3">
              <h2 className="text-4xl sm:text-6xl md:text-7xl font-bodoni font-light tracking-[0.22em] uppercase text-[#fdfcf9]">
                PAKIZAAH
              </h2>
              <div className="flex items-center justify-center gap-4 pt-1">
                <span className="h-[1px] w-14 sm:w-24 bg-gradient-to-r from-transparent to-[#D4AF37]/70" />
                <span className="w-2 h-2 rotate-45 bg-[#D4AF37]" />
                <span className="h-[1px] w-14 sm:w-24 bg-gradient-to-l from-transparent to-[#D4AF37]/70" />
              </div>
            </div>

            <p className="text-xl sm:text-2xl md:text-[26px] font-serif italic text-[#fdfcf9] pt-2">
              Thank you for choosing PAKIZAAH!{' '}
              <span role="img" aria-label="heart" className="not-italic">
                ❤️
              </span>
            </p>

            <p className="text-sm sm:text-base text-white/70 leading-relaxed max-w-2xl mx-auto font-light">
              We truly appreciate your love and support. To ensure a smooth and delightful shopping
              experience, kindly read our policies carefully before placing your order.
            </p>
          </motion.div>

          {/* 10 Policies Architectural Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 py-12 md:py-16">
            {PAKIZAAH_POLICIES.map((policy, idx) => {
              const IconComponent = policy.icon;
              return (
                <motion.article
                  key={policy.number}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.55, delay: (idx % 2) * 0.08 }}
                  className={cn(
                    'group relative p-6 sm:p-8 border transition-all duration-500 flex flex-col justify-between gap-4',
                    policy.emphasis || policy.phoneHighlight
                      ? 'border-[#D4AF37]/35 bg-gradient-to-br from-[#D4AF37]/[0.07] via-white/[0.02] to-transparent hover:border-[#D4AF37]/70'
                      : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.035] hover:border-[#D4AF37]/40'
                  )}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <span className="font-bodoni italic text-2xl sm:text-3xl text-[#D4AF37] leading-none">
                          {policy.numDisplay}
                        </span>
                        <div className="h-5 w-[1px] bg-white/15" />
                        <h3 className="text-xs sm:text-[13px] tracking-[0.22em] uppercase font-bold text-[#fdfcf9] leading-snug">
                          {policy.number}. {policy.title}
                        </h3>
                      </div>
                      <div className="w-9 h-9 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] flex items-center justify-center shrink-0 text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black transition-all duration-500">
                        <IconComponent className="w-4 h-4" />
                      </div>
                    </div>

                    <p className="text-sm sm:text-[15px] text-white/75 leading-relaxed font-light pl-0 sm:pl-1">
                      {policy.description}
                    </p>
                  </div>

                  {policy.emphasis && (
                    <div className="mt-2 px-4 py-3 border border-[#D4AF37]/50 bg-[#D4AF37]/10 text-center">
                      <p className="text-[11px] sm:text-xs tracking-[0.18em] uppercase font-bold text-[#D4AF37]">
                        {policy.emphasis}
                      </p>
                    </div>
                  )}

                  {policy.phoneHighlight && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <a
                        href={buildWhatsAppLink(
                          PAKIZAAH_ORDER_WHATSAPP_DIGITS,
                          `Hello PAKIZAAH! I would like to confirm my order with a screenshot of my selected item.\n\n${PAKIZAAH_POLICIES_WHATSAPP_MESSAGE}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-[#25D366]/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-[#25D366]/45 transition-all duration-300 text-xs sm:text-sm tracking-[0.18em] font-bold"
                      >
                        <WhatsAppGlyph className="w-4 h-4" />
                        <span>{policy.phoneHighlight}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                      </a>
                    </div>
                  )}
                </motion.article>
              );
            })}
          </div>

          {/* Closing Need Assistance & Love Signature Block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8 }}
            className="relative border border-[#D4AF37]/25 bg-gradient-to-b from-[#D4AF37]/[0.07] via-black/30 to-transparent p-8 sm:p-12 md:p-14 text-center space-y-8"
          >
            <div className="space-y-3 max-w-2xl mx-auto">
              <p className="text-[10px] sm:text-[11px] tracking-[0.45em] uppercase font-bold text-[#D4AF37]">
                Need Assistance?
              </p>
              <p className="text-sm sm:text-base text-white/75 leading-relaxed font-light">
                For further information or queries, feel free to connect with us through{' '}
                <span className="text-[#fdfcf9] font-medium">
                  WhatsApp, Facebook, Instagram or TikTok
                </span>
                .
              </p>
            </div>

            {/* Social Channel Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={buildWhatsAppLink(
                  PAKIZAAH_ORDER_WHATSAPP_DIGITS,
                  `Hello PAKIZAAH! I have a query regarding your collection.\n\n${PAKIZAAH_POLICIES_WHATSAPP_MESSAGE}`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all duration-300 text-[10px] tracking-[0.28em] uppercase font-bold"
              >
                <WhatsAppGlyph className="w-3.5 h-3.5" />
                WhatsApp
              </a>
              {['Facebook', 'Instagram', 'TikTok'].map((channel) => (
                <span
                  key={channel}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 bg-white/[0.03] text-white/75 text-[10px] tracking-[0.28em] uppercase font-semibold"
                >
                  {channel}
                </span>
              ))}
            </div>

            <div className="h-[1px] w-24 bg-[#D4AF37]/30 mx-auto" />

            {/* Warm Brand Sign-off */}
            <div className="space-y-4 max-w-xl mx-auto">
              <p className="text-base sm:text-lg md:text-xl font-semibold tracking-wide text-[#fdfcf9]">
                Let&apos;s make every shopping experience a gratifying one!
              </p>
              <p className="text-sm sm:text-base text-white/70 font-light">
                Thank you for your time, trust and continued support.{' '}
                <span role="img" aria-label="heart">
                  ❤️
                </span>
              </p>

              <div className="pt-4 space-y-1.5">
                <p className="text-[10px] tracking-[0.45em] uppercase text-white/50 font-semibold">
                  With Love,
                </p>
                <p className="text-2xl sm:text-3xl font-bodoni tracking-[0.26em] uppercase text-[#D4AF37]">
                  TEAM PAKIZAAH
                </p>
                <p className="text-base sm:text-lg font-serif italic text-[#fdfcf9]/85 pt-1">
                  Discover Yourself in PAKIZAAH.
                </p>
              </div>
            </div>

            {/* Utility Actions: Send Policies on WhatsApp or Copy */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={buildWhatsAppLink('', PAKIZAAH_POLICIES_WHATSAPP_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-[#25D366] hover:bg-[#128C7E] text-white text-[10px] tracking-[0.3em] uppercase font-bold transition-all duration-300 shadow-xl w-full sm:w-auto"
              >
                <WhatsAppGlyph className="w-4 h-4" />
                Share Policies on WhatsApp
              </a>
              <button
                type="button"
                onClick={handleCopyPolicies}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 border border-[#D4AF37]/40 hover:border-[#D4AF37] bg-white/[0.03] hover:bg-[#D4AF37]/10 text-[#fdfcf9] text-[10px] tracking-[0.3em] uppercase font-bold transition-all duration-300 w-full sm:w-auto cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-[#D4AF37]">Policies Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#D4AF37]" />
                    <span>Copy Policies Text</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

interface WhatsAppInquiryModalProps {
  isOpen: boolean;
  items: any[];
  onClose: () => void;
  sanitizeMediaUrl: (url: any, isVideoAlt?: boolean) => string;
}

export const WhatsAppInquiryModal: React.FC<WhatsAppInquiryModalProps> = ({
  isOpen,
  items,
  onClose,
  sanitizeMediaUrl,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [acknowledged, setAcknowledged] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAllPolicies, setShowAllPolicies] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setIsSubmitted(false);
    setCustomerName('');
    setCustomerNote('');
    setAcknowledged(true);
    setCopied(false);
    onClose();
  };

  const fullWhatsAppMessage = buildProductInquiryMessage(items, sanitizeMediaUrl, {
    customerName,
    customerNote,
    includePolicies: true,
  });

  const inquiryWhatsAppUrl = buildWhatsAppLink(
    PAKIZAAH_INQUIRY_WHATSAPP_DIGITS,
    fullWhatsAppMessage
  );

  const orderConfirmationWhatsAppUrl = buildWhatsAppLink(
    PAKIZAAH_ORDER_WHATSAPP_DIGITS,
    fullWhatsAppMessage
  );

  const handleSubmitWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledged) return;
    window.open(inquiryWhatsAppUrl, '_blank', 'noopener,noreferrer');
    setIsSubmitted(true);
  };

  const handleCopyPolicies = async () => {
    try {
      await navigator.clipboard.writeText(PAKIZAAH_POLICIES_WHATSAPP_MESSAGE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = PAKIZAAH_POLICIES_WHATSAPP_MESSAGE;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && items.length > 0 && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/92 backdrop-blur-2xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto custom-scrollbar bg-[#11100e] border border-[#D4AF37]/30 shadow-[0_30px_90px_rgba(0,0,0,0.85)]"
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-6 sm:px-8 py-5 bg-[#11100e]/95 backdrop-blur-md border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#25D366]/15 border border-[#25D366]/40 flex items-center justify-center text-[#25D366]">
                  <WhatsAppGlyph className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[9px] tracking-[0.38em] uppercase text-[#D4AF37] font-bold">
                    {isSubmitted
                      ? 'Policies Message Shared'
                      : 'WhatsApp Concierge & Shopping Policies'}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bodoni italic text-[#fdfcf9]">
                    {isSubmitted ? 'Thank You for Choosing PAKIZAAH' : 'Submit WhatsApp Inquiry'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 text-white/50 hover:text-white transition-colors cursor-pointer"
                aria-label="Close WhatsApp modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {isSubmitted ? (
              /* Post-Submission Confirmation Screen showing the Policies message sent to the customer */
              <div className="p-6 sm:p-8 md:p-10 space-y-8">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#25D366]/15 border border-[#25D366]/40 flex items-center justify-center text-[#25D366]">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-bodoni italic text-[#D4AF37]">
                    WhatsApp Message Ready &amp; Policies Included
                  </h4>
                  <p className="text-xs sm:text-sm text-white/70 max-w-xl mx-auto leading-relaxed">
                    Your inquiry and PAKIZAAH&apos;s complete Shopping Policies message have been
                    prepared for WhatsApp. For your convenience, here is your copy of our Shopping
                    Policies &amp; Terms &amp; Conditions:
                  </p>
                </div>

                {/* WhatsApp-Style Policies Message Card */}
                <div className="relative rounded-lg border border-[#25D366]/30 bg-[#0c1a13]/70 p-5 sm:p-7 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2 text-[#25D366]">
                      <WhatsAppGlyph className="w-4 h-4" />
                      <span className="text-[10px] tracking-[0.28em] uppercase font-bold">
                        Message Sent to Customer — PAKIZAAH Policies
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPolicies}
                      className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase text-[#D4AF37] hover:text-white transition-colors font-bold cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="space-y-4 text-xs sm:text-[13px] leading-relaxed text-white/85">
                    <div className="space-y-1">
                      <p className="font-bodoni text-lg tracking-[0.2em] text-[#D4AF37] uppercase">
                        PAKIZAAH
                      </p>
                      <p className="text-[10px] tracking-[0.3em] uppercase text-white/60 font-bold">
                        SHOPPING POLICIES | TERMS &amp; CONDITIONS
                      </p>
                      <p className="pt-1 font-serif italic text-sm text-[#fdfcf9]">
                        Thank you for choosing PAKIZAAH! ❤️
                      </p>
                      <p className="text-white/70">
                        We truly appreciate your love and support. To ensure a smooth and delightful
                        shopping experience, kindly read our policies carefully before placing your
                        order.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {PAKIZAAH_POLICIES.map((p) => (
                        <div
                          key={p.number}
                          className="p-3.5 bg-black/35 border border-white/10 rounded space-y-1"
                        >
                          <p className="text-[10px] tracking-[0.16em] uppercase font-bold text-[#D4AF37]">
                            {p.number}. {p.title}
                          </p>
                          <p className="text-[11px] sm:text-xs text-white/75">{p.description}</p>
                          {p.emphasis && (
                            <p className="text-[10px] tracking-[0.12em] uppercase font-bold text-[#D4AF37] pt-1">
                              {p.emphasis}
                            </p>
                          )}
                          {p.phoneHighlight && (
                            <p className="text-xs font-bold text-[#25D366] pt-1">
                              {p.phoneHighlight}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-white/10 space-y-1.5 text-center">
                      <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-[#D4AF37]">
                        NEED ASSISTANCE?
                      </p>
                      <p className="text-xs text-white/75">
                        For further information or queries, feel free to connect with us through
                        WhatsApp, Facebook, Instagram or TikTok.
                      </p>
                      <p className="text-xs font-semibold text-white">
                        Let&apos;s make every shopping experience a gratifying one!
                      </p>
                      <p className="text-xs text-white/70">
                        Thank you for your time, trust and continued support. ❤️
                      </p>
                      <p className="text-xs font-bold tracking-[0.22em] text-[#D4AF37] pt-1">
                        WITH LOVE, TEAM PAKIZAAH
                      </p>
                      <p className="font-serif italic text-xs text-white/80">
                        Discover Yourself in PAKIZAAH.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={inquiryWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#128C7E] text-white py-4 px-5 text-[10px] tracking-[0.3em] uppercase font-bold transition-all"
                  >
                    <WhatsAppGlyph className="w-4 h-4" />
                    Re-open WhatsApp Inquiry
                  </a>
                  <a
                    href={orderConfirmationWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2.5 border border-[#D4AF37]/60 bg-[#D4AF37]/10 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black py-4 px-5 text-[10px] tracking-[0.25em] uppercase font-bold transition-all"
                  >
                    <WhatsAppGlyph className="w-4 h-4" />
                    Confirm Order ({PAKIZAAH_ORDER_WHATSAPP_DISPLAY})
                  </a>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
                  <a
                    href={buildWhatsAppLink('', PAKIZAAH_POLICIES_WHATSAPP_MESSAGE)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase text-[#25D366] hover:underline font-bold"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    Save / Forward Policies Copy on WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-8 py-3 bg-white text-black text-[10px] tracking-[0.35em] uppercase font-bold hover:bg-[#D4AF37] transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Pre-Submission Screen with Selected Piece + Complete Policies + Submit */
              <form onSubmit={handleSubmitWhatsApp} className="p-6 sm:p-8 md:p-10 space-y-7">
                {/* Selected Piece(s) Summary */}
                <div className="space-y-3">
                  <p className="text-[10px] tracking-[0.35em] uppercase text-white/40 font-bold">
                    {items.length === 1 ? 'Selected Piece' : `Selected Pieces (${items.length})`}
                  </p>
                  <div className="space-y-2.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                    {items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="flex items-center gap-4 p-3 bg-white/[0.03] border border-white/10"
                      >
                        {item.image && (
                          <img
                            src={sanitizeMediaUrl(item.image)}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-14 h-16 object-cover border border-white/10 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          {item.code && (
                            <span className="inline-block bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 text-[8px] font-mono font-bold tracking-wider px-2 py-0.5 uppercase">
                              CODE: {item.code}
                            </span>
                          )}
                          <p className="text-sm font-bodoni uppercase tracking-wider text-white truncate">
                            {item.name}
                          </p>
                          {(item.salePrice || item.price) && (
                            <p className="text-[11px] tracking-[0.15em] text-[#D4AF37] font-semibold">
                              {item.salePrice || item.price}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optional Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] tracking-[0.3em] uppercase text-white/50 font-semibold">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g., Priya Sharma"
                      className="w-full bg-white/5 border border-white/15 px-4 py-3 text-xs text-white outline-none focus:border-[#D4AF37] transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] tracking-[0.3em] uppercase text-white/50 font-semibold">
                      Size / Delivery Preference (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      placeholder="e.g., Size M, Pick-up or Postal"
                      className="w-full bg-white/5 border border-white/15 px-4 py-3 text-xs text-white outline-none focus:border-[#D4AF37] transition-colors"
                    />
                  </div>
                </div>

                {/* Complete Shopping Policies | Terms & Conditions Panel */}
                <div className="border border-[#D4AF37]/35 bg-gradient-to-b from-[#D4AF37]/[0.07] to-black/40">
                  <button
                    type="button"
                    onClick={() => setShowAllPolicies((prev) => !prev)}
                    className="w-full flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/20 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-[#D4AF37]" />
                      <div>
                        <p className="text-[10px] sm:text-[11px] tracking-[0.3em] uppercase font-bold text-[#D4AF37]">
                          PAKIZAAH — Shopping Policies | Terms &amp; Conditions
                        </p>
                        <p className="text-[10px] text-white/55 mt-0.5">
                          Automatically included in your WhatsApp message for your reference
                        </p>
                      </div>
                    </div>
                    {showAllPolicies ? (
                      <ChevronUp className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    )}
                  </button>

                  {showAllPolicies && (
                    <div className="p-5 max-h-72 overflow-y-auto custom-scrollbar space-y-4">
                      <div className="space-y-1 text-center pb-3 border-b border-white/10">
                        <p className="font-serif italic text-base text-[#fdfcf9]">
                          Thank you for choosing PAKIZAAH! ❤️
                        </p>
                        <p className="text-xs text-white/65 leading-relaxed">
                          We truly appreciate your love and support. To ensure a smooth and
                          delightful shopping experience, kindly read our policies carefully before
                          placing your order.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {PAKIZAAH_POLICIES.map((policy) => (
                          <div
                            key={policy.number}
                            className="p-3.5 bg-white/[0.025] border border-white/10 space-y-1"
                          >
                            <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#D4AF37]">
                              {policy.number}. {policy.title}
                            </p>
                            <p className="text-xs text-white/80 leading-relaxed">
                              {policy.description}
                            </p>
                            {policy.emphasis && (
                              <p className="text-[10px] tracking-[0.15em] uppercase font-bold text-[#D4AF37] pt-1">
                                {policy.emphasis}
                              </p>
                            )}
                            {policy.phoneHighlight && (
                              <p className="text-xs font-bold text-[#25D366] pt-1">
                                {policy.phoneHighlight}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-white/10 text-center space-y-1.5">
                        <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-[#D4AF37]">
                          NEED ASSISTANCE?
                        </p>
                        <p className="text-xs text-white/70">
                          For further information or queries, feel free to connect with us through
                          WhatsApp, Facebook, Instagram or TikTok.
                        </p>
                        <p className="text-xs font-semibold text-white">
                          Let&apos;s make every shopping experience a gratifying one!
                        </p>
                        <p className="text-xs text-white/70">
                          Thank you for your time, trust and continued support. ❤️
                        </p>
                        <p className="text-xs font-bold tracking-[0.25em] text-[#D4AF37] pt-1">
                          WITH LOVE, TEAM PAKIZAAH
                        </p>
                        <p className="text-xs font-serif italic text-white/80">
                          Discover Yourself in PAKIZAAH.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Policy Acknowledgment */}
                <label className="flex items-start gap-3 cursor-pointer select-none p-3.5 bg-white/[0.02] border border-white/10 hover:border-[#D4AF37]/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5 accent-[#D4AF37] w-4 h-4 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-white/80 leading-relaxed">
                    I have read and acknowledge{' '}
                    <span className="text-[#D4AF37] font-semibold">
                      PAKIZAAH&apos;s Shopping Policies &amp; Terms &amp; Conditions
                    </span>
                    , and understand that the Policies message will be included with my WhatsApp
                    submission.
                  </span>
                </label>

                {/* Submit Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={!acknowledged}
                    className="flex-1 flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 disabled:cursor-not-allowed text-white py-4 px-6 text-[10px] sm:text-[11px] tracking-[0.32em] uppercase font-bold transition-all duration-300 shadow-2xl cursor-pointer"
                  >
                    <WhatsAppGlyph className="w-4 h-4" />
                    Send WhatsApp Message &amp; Policies
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-6 py-4 border border-white/15 hover:border-white/40 text-white/70 hover:text-white text-[10px] tracking-[0.3em] uppercase font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
