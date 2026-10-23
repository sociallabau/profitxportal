import { OWNER_USER_ID } from '@/lib/owner';

export const DEMO_USER_ID = 'a0d1ccd1-b27b-479e-8abe-1027e13972c3';

export function dashboardUserId(userId?: string, isAdmin?: boolean | null) {
  return userId === OWNER_USER_ID && isAdmin === true ? DEMO_USER_ID : userId;
}