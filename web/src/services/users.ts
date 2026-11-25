import { api } from "@/lib/api";

/** The subscription rows preloaded onto a user. */
export interface Subscription {
  id: string;
  status: string;
  activated_by?: string;
  plan?: { id: string; name: string };
  expiry_date?: string;
}

/** A user as the admin endpoints return it. */
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED";
  joined_at: string;
  subscriptions?: Subscription[];
  current_app_mode?: string;
  market_joined_at?: string;
  learning_joined_at?: string;
  wallet_balance_minor?: number;
}

export interface UserParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  app_mode?: string;
}

export const usersService = {
  list: (params?: UserParams) => api.get("/users", { params }).then(r => r.data),
  get: (id: string) => api.get(`/users/${id}`).then(r => r.data.data),
  create: (data: { name: string; email: string; phone?: string; password?: string; free_plan_id?: string; duration_days?: number }) =>
    api.post("/users", data).then(r => r.data.data),
  sendOtp: (email: string, name: string) =>
    api.post("/users/send-otp", { email, name }).then(r => r.data),
  verifyOtp: (email: string, otp: string) =>
    api.post("/users/verify-otp", { email, otp }).then(r => r.data),
  update: (id: string, data: { name?: string; status?: string }) =>
    api.patch(`/users/${id}`, data).then(r => r.data.data),
  delete: (id: string) => api.delete(`/users/${id}`),
  forceLogout: (id: string) => api.post(`/users/${id}/force-logout`),
  changePlan: (id: string, plan_id: string) =>
    api.post(`/users/${id}/change-plan`, { plan_id }),
  assignFreePlan: (id: string, plan_id: string, duration_days?: number) =>
    api.post(`/users/${id}/assign-free-plan`, { plan_id, ...(duration_days ? { duration_days } : {}) }),
  cancelFreePlan: (id: string) => api.post(`/users/${id}/cancel-free-plan`),
};
