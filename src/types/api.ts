export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: ApiErrorBody };

export type LoginResponse = {
  token: string;
  userId: string;
  expiresAt: string;
  email: string;
  roles: string[];
};

export type AuthMe = {
  userId: string;
  email: string;
  roles: string[];
  expiresAt: string;
};

export type ServiceCategory = {
  slug: string;
  name: string;
  sortOrder: number;
};

export type ProviderLocation = {
  address: string;
  city: string;
  lat: number;
  lng: number;
};

export type ProviderService = {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  category: string;
  image?: string;
  isVisible?: boolean;
};

export type ProviderListItem = {
  _id: string;
  slug: string;
  name: string;
  categorySlug: string;
  avatar: string;
  coverImage: string;
  bio: string;
  location: ProviderLocation;
  rating: number;
  reviewCount: number;
  isPremium: boolean;
  isFeatured: boolean;
  responseTime: string;
  startingPrice: number;
  serviceCount: number;
};

export type EstablishmentListItem = {
  _id: string;
  slug: string;
  name: string;
  categorySlug: string;
  logo: string;
  coverImage: string;
  bio: string;
  location: ProviderLocation;
  isFeatured: boolean;
};

export type PortfolioItem = {
  id: string;
  image: string;
  title: string;
  description?: string;
  likes: number;
  createdAt: string;
  isVisible?: boolean;
};

export type ProviderPromotion = {
  id: string;
  title: string;
  description: string;
  discountPercent: number;
  validUntil: string;
  code: string;
};

export type PayoutDestinationType = "bank" | "gcash" | "maya";

export type PayoutDestination = {
  type: PayoutDestinationType;
  accountName: string;
  accountNumber: string;
  bankCode?: string;
};

export type PayoutVerificationStatus = "verified" | "unverified" | "pending";

export type PaymongoOnboardingStatus =
  | "none"
  | "created"
  | "kyc_pending"
  | "kyc_passed"
  | "ready_to_activate"
  | "activated"
  | "declined"
  | "error";

export type ProviderPaymongoStatus = {
  paymongoSubAccountId?: string;
  paymongoOnboardingStatus?: PaymongoOnboardingStatus;
  paymongoSplitEnabled?: boolean;
  paymongoIdentitySessionUrl?: string;
  paymongoActivatedAt?: string;
  paymongoLastError?: string;
  subscriptionTier?: "free" | "pro" | "premium";
};

export type ProofDocument = {
  url: string;
  fileName: string;
  contentType: string;
  uploadedAt: string;
};

/** POST /providers/apply/start body. */
export type ProviderApplyStartInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  turnstileToken?: string;
};

/** PATCH /providers/apply body. */
export type ProviderApplyUpdateInput = {
  name?: string;
  categorySlug?: string;
  bio?: string;
  location?: ProviderLocation;
  proofDocuments?: ProofDocument[];
  governmentIdDocument?: ProofDocument;
  selfieWithId?: ProofDocument;
};

/** POST /providers/apply/submit body. */
export type ProviderApplySubmitInput = {
  proofDocuments: ProofDocument[];
  governmentIdDocument: ProofDocument;
  selfieWithId: ProofDocument;
};

export type ProviderProfile = ProviderListItem & {
  userId?: string;
  joinedAt: string;
  completedBookings: number;
  services: ProviderService[];
  portfolio: PortfolioItem[];
  availability: Array<{ day: string; slots: Array<{ time: string; available: boolean }> }>;
  promotions?: ProviderPromotion[];
  loyaltyProgram?: {
    enabled: boolean;
    stampsRequired: number;
    rewardDiscountPercent: number;
  };
  payoutDestination?: PayoutDestination;
  payoutVerificationStatus?: PayoutVerificationStatus;
  paymentsDisabled?: boolean;
};

export type MyProviderPortfolioQuery = {
  limit?: number;
  page?: number;
  q?: string;
  filter?: "all" | "with-desc" | "no-desc";
};

export type MyProviderPortfolioPage = {
  items: PortfolioItem[];
  total: number;
  page: number;
  limit: number;
};

export type MyProviderServicesQuery = {
  limit?: number;
  page?: number;
  q?: string;
  category?: string;
};

export type MyProviderServicesPage = {
  items: ProviderService[];
  total: number;
  page: number;
  limit: number;
};

/** PATCH /providers/me body (matches Meteor updateProviderProfileInputSchema). */
export type UpdateProviderProfileInput = {
  bio?: string;
  responseTime?: string;
  avatar?: string;
  coverImage?: string;
  location?: {
    address?: string;
    city?: string;
    lat?: number;
    lng?: number;
  };
  addService?: {
    name: string;
    description: string;
    price: number;
    durationMinutes: number;
    category: string;
    image?: string;
  };
  updateService?: {
    id: string;
    name?: string;
    description?: string;
    price?: number;
    durationMinutes?: number;
    category?: string;
    image?: string;
  };
  removeServiceId?: string;
  addPortfolioItem?: {
    image: string;
    title: string;
    description?: string;
  };
  updatePortfolioItem?: {
    id: string;
    image?: string;
    title?: string;
    description?: string;
  };
  removePortfolioItemId?: string;
  addPromotion?: {
    title: string;
    description: string;
    discountPercent: number;
    validUntil: string;
    code: string;
  };
  removePromotionId?: string;
  loyaltyProgram?: {
    enabled: boolean;
    stampsRequired: number;
    rewardDiscountPercent: number;
  };
  visiblePortfolioIds?: string[];
  visibleServiceIds?: string[];
};

export type LoyaltyCardView = {
  providerId: string;
  stamps: number;
  stampsRequired: number;
  rewardReady: boolean;
  rewardDiscountPercent: number;
  programEnabled: boolean;
};

export type Review = {
  _id: string;
  providerId: string;
  customerId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  createdAt: string;
  images?: string[];
  bookingId?: string;
  providerSlug?: string;
  providerName?: string;
};

export type ProviderMapMarker = {
  _id: string;
  slug: string;
  name: string;
  categorySlug: string;
  lat: number;
  lng: number;
  rating: number;
  avatar: string;
  isPremium: boolean;
};

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type BookingPaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "failed";

export type Booking = {
  _id: string;
  customerId: string;
  providerId: string;
  serviceName: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  amount: number;
  currency: string;
  paymentStatus: BookingPaymentStatus;
  paymongoCheckoutSessionId?: string;
  paymongoPaymentIntentId?: string;
  loyaltyRewardApplied?: boolean;
  loyaltyDiscountPercent?: number;
  amountBeforeDiscount?: number;
  createdAt: string;
  updatedAt: string;
  customer?: { userId: string; name: string; avatar?: string };
};

export type ConversationListItem = {
  threadId: string;
  bookingId: string;
  participantUserId: string;
  participantName: string;
  participantAvatar?: string;
  providerId?: string;
  providerSlug?: string;
  categorySlug?: string;
  serviceName?: string;
  startsAt?: string;
  bookingStatus?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  peerLastReadAt?: string;
};

export type Message = {
  _id: string;
  threadId: string;
  senderId: string;
  body: string;
  imageUrl?: string;
  createdAt: string;
};

export type AccountProfile = {
  userId: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  address?: string;
  city?: string;
  bio?: string;
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
    promotions: boolean;
  };
  createdAt: string;
};

export type AvailabilityTimeRange = {
  id: string;
  start: string;
  end: string;
};

export type AvailabilityOverrideStatus = "weekly" | "unavailable" | "custom";

export type ProviderAvailability = {
  providerId: string;
  weekly: Record<string, { enabled: boolean; ranges: AvailabilityTimeRange[] }>;
  overrides: Record<
    string,
    { status: AvailabilityOverrideStatus; ranges: AvailabilityTimeRange[] }
  >;
  updatedAt: string;
};

export type ProviderAnalyticsRange = "7days" | "30days" | "3months" | "12months" | "ytd";

export type ProviderAnalytics = {
  totalBookings: number;
  bookingsThisMonth: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  revenueThisMonth: number;
  revenueTotal: number;
  averageRating: number;
  reviewCount: number;
  upcoming: Array<{
    _id: string;
    customerId: string;
    customerName?: string;
    serviceName: string;
    startsAt: string;
    status: string;
  }>;
  revenueByMonth: Array<{ month: string; revenue: number }>;
  bookingsByMonth: Array<{ month: string; count: number }>;
  serviceCategoryBreakdown: Array<{
    name: string;
    value: number;
    revenue: number;
    bookings: number;
  }>;
  topServices: Array<{ service: string; bookings: number; revenue: number }>;
  customerGrowthByMonth: Array<{ month: string; new: number; returning: number }>;
  recentActivity: Array<{
    id: string;
    customerId: string;
    service: string;
    date: string;
    amount: number;
    status: string;
  }>;
  customerInsights: {
    newCustomers: number;
    returningCustomers: number;
    repeatRate: number;
    customerGrowthPercent: number;
  };
  bookingPerformance: {
    completedBookings: number;
    cancelledBookings: number;
    upcomingBookings: number;
    completionRate: number;
    promotionCount: number;
    isPremium: boolean;
    isFeatured: boolean;
  };
};

export type SubscriptionPlansResponse = {
  /** Sellable catalog is pro | premium only. Client filters out id === "free" if present. */
  plans: Array<{
    id: "free" | "pro" | "premium";
    name: string;
    price: number;
    yearlyPrice?: number;
    billingPeriod: "monthly" | "yearly";
    isPopular?: boolean;
    features: string[];
  }>;
  current: {
    /** Internal "free" means locked (no active paid/trial subscription). */
    planId: "free" | "pro" | "premium";
    status: "active" | "cancelled" | "none";
    billingPeriod: "monthly" | "yearly";
    startedAt: string | null;
    expiresAt: string | null;
    isPremium: boolean;
    isFeatured: boolean;
    source: "trial" | "paid" | null;
    trialUsed: boolean;
    isTrialing: boolean;
  };
};

export type SubscriptionPayment = {
  id: string;
  checkoutSessionId: string;
  planId: "pro" | "premium";
  billingPeriod: "monthly" | "yearly";
  amount: number;
  status: "completed" | "failed";
  paidAt: string;
};

const BOOKING_THREAD_PREFIX = "booking:";

/** Stable thread id for a single booking (no open personal DMs). */
export function threadIdForBooking(bookingId: string): string {
  return `${BOOKING_THREAD_PREFIX}${bookingId}`;
}

export function bookingIdFromThreadId(threadId: string): string | null {
  if (!threadId.startsWith(BOOKING_THREAD_PREFIX)) return null;
  const bookingId = threadId.slice(BOOKING_THREAD_PREFIX.length).trim();
  return bookingId.length > 0 ? bookingId : null;
}

/** Expo Router may pass `string | string[]`; params are often already decoded. */
export function normalizeThreadIdParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  if (decoded.includes("%3A") || decoded.includes("%3a")) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      /* keep first decode */
    }
  }
  return decoded;
}
