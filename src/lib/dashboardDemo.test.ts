import { expect, it } from 'vitest';
import { dashboardUserId, DEMO_USER_ID } from './dashboardDemo';
import { OWNER_USER_ID } from './owner';

it('shows Seb data only on the owner admin dashboard', () => {
  expect(dashboardUserId(OWNER_USER_ID, true)).toBe('2db2289b-3df3-4f35-acd7-52f6313e5ec2');
  expect(dashboardUserId(OWNER_USER_ID, false)).toBe(OWNER_USER_ID);
  expect(dashboardUserId('another-admin', true)).toBe('another-admin');
  expect(dashboardUserId(DEMO_USER_ID, false)).toBe(DEMO_USER_ID);
});