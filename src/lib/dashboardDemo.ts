import { OWNER_USER_ID } from '@/lib/owner';

export const DEMO_USER_ID = '2db2289b-3df3-4f35-acd7-52f6313e5ec2';

export function dashboardUserId(userId?: string, isAdmin?: boolean | null) {
  return userId === OWNER_USER_ID && isAdmin === true ? DEMO_USER_ID : userId;
}