import { apiRequest } from "@/src/api/client";
import type { ServiceCategory } from "@/src/types/api";

export function listCategories() {
  return apiRequest<ServiceCategory[]>("/categories", { auth: false });
}
