import { expect, it } from 'vitest';
import { dashboardUserId, HARRY_DEMO_USER_ID } from './dashboardDemo';
import { OWNER_USER_ID } from './owner';

it('shows Harry data only on the owner admin dashboard', () => {
  expect(dashboardUserId(OWNER_USER_ID, true)).toBe(HARRY_DEMO_USER_ID);
  expect(dashboardUserId(OWNER_USER_ID, false)).toBe(OWNER_USER_ID);
  expect(dashboardUserId('another-admin', true)).toBe('another-admin');
  expect(dashboardUserId(HARRY_DEMO_USER_ID, false)).toBe(HARRY_DEMO_USER_ID);
});