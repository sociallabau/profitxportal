/**
 * Who can open Dan AI. Admins always can. Flip DAN_AI_MEMBERS_LIVE to true to
 * launch it to members: the route, the sidebar and every "Help me do this"
 * button follow this one switch.
 */
export const DAN_AI_MEMBERS_LIVE = false;

export function canUseDanAi(isAdmin: boolean | null | undefined): boolean {
  return DAN_AI_MEMBERS_LIVE || Boolean(isAdmin);
}
