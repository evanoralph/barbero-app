import { apiRequest } from "@/src/api/client";
import type { Review } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export type CreateReviewInput = {
  providerId: string;
  bookingId: string;
  rating: number;
  comment: string;
};

export function createReview(input: CreateReviewInput) {
  logger.info("reviews-api", "createReview", {
    providerId: input.providerId,
    bookingId: input.bookingId,
    rating: input.rating,
  });
  console.log("[reviews-api] createReview", {
    providerId: input.providerId,
    bookingId: input.bookingId,
    rating: input.rating,
  });
  return apiRequest<Review>("/reviews", {
    method: "POST",
    body: {
      providerId: input.providerId,
      bookingId: input.bookingId,
      rating: input.rating,
      comment: input.comment.trim(),
    },
  });
}
