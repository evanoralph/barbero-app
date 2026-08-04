import { ApiError, apiRequest } from "@/src/api/client";
import type { Booking, BookingStatus } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

function assertBooking(data: unknown, context: string): Booking {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    logger.error("bookings-api", `${context} returned non-object booking`, {
      isArray: Array.isArray(data),
      type: typeof data,
    });
    throw new ApiError(
      "Booking detail response was invalid",
      "INVALID_BOOKING",
      500,
      data,
    );
  }
  const booking = data as Booking;
  if (!booking._id || !booking.startsAt || !booking.serviceName) {
    logger.error("bookings-api", `${context} missing required fields`, {
      id: booking._id,
      serviceName: booking.serviceName,
      startsAt: booking.startsAt,
    });
    throw new ApiError(
      "Booking detail is missing required fields",
      "INVALID_BOOKING",
      500,
      booking,
    );
  }
  return booking;
}

export function listBookings(params?: { limit?: number; page?: number }) {
  logger.debug("bookings-api", "listBookings", params);
  return apiRequest<Booking[]>("/bookings", {
    query: {
      limit: params?.limit,
      page: params?.page,
    },
  });
}

export async function getBooking(id: string) {
  logger.debug("bookings-api", "getBooking", { id });
  const data = await apiRequest<Booking>(`/bookings/${encodeURIComponent(id)}`);
  const booking = assertBooking(data, "getBooking");
  logger.info("bookings-api", "getBooking ok", {
    id: booking._id,
    serviceName: booking.serviceName,
    status: booking.status,
  });
  return booking;
}

export function createBooking(input: {
  customerId: string;
  providerId: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
}) {
  logger.info("bookings-api", "createBooking", {
    providerId: input.providerId,
    serviceName: input.serviceName,
  });
  return apiRequest<Booking>("/bookings", { method: "POST", body: input });
}

export function updateBookingStatus(
  id: string,
  input: { status: BookingStatus; startsAt?: string; endsAt?: string },
) {
  logger.info("bookings-api", "updateBookingStatus", { id, status: input.status });
  return apiRequest<Booking>(`/bookings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}
