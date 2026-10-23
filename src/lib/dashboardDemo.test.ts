import { expect, it } from 'vitest';
import { dashboardUserId, DEMO_USER_ID } from './dashboardDemo';
import { OWNER_USER_ID } from './owner';

it('shows Tobias data only on the owner admin dashboard', () => {
  expect(dashboardUserId(OWNER_USER_ID, true)).toBe('a0d1ccd1-b27b-479e-8abe-1027e13972c3');
  expect(dashboardUserId(OWNER_USER_ID, false)).toBe(OWNER_USER_ID);
  expect(dashboardUserId('another-admin', true)).toBe('another-admin');
  expect(dashboardUserId(DEMO_USER_ID, false)).toBe(DEMO_USER_ID);
});