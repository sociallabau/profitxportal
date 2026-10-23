import { OWNER_USER_ID } from '@/lib/owner';

export const HARRY_DEMO_USER_ID = '1948d8b5-0ff7-419c-8440-6dd61a28eb54';

export function dashboardUserId(userId?: string, isAdmin?: boolean | null) {
  return userId === OWNER_USER_ID && isAdmin === true ? HARRY_DEMO_USER_ID : userId;
}