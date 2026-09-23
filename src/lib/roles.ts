// Central role-based access control.
// Roles: admin, super_admin, manager, staff, captain, kitchen
//
// - Only admin / super_admin can view Settings (and manage Staff).
// - Kitchen staff can only see the Kitchen display (KDS).
// - Captain has the same floor access as staff (no Settings/Staff).
// - Profile is visible to every role.

export function normRole(userOrRole: any): string {
  const r = typeof userOrRole === 'string' ? userOrRole : userOrRole?.user_type || userOrRole?.role || '';
  return String(r).toLowerCase();
}

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

// Where each role lands after login / on `/`.
export function landingPath(role: string): string {
  if (role === 'kitchen') return '/kds';
  return '/dashboard';
}

// Paths kitchen staff may open (profile + subscribe are universal).
const KITCHEN_PATHS = new Set(['/kds', '/profile', '/subscribe']);

// Paths restricted to admin / super_admin.
const ADMIN_PATHS = new Set(['/settings', '/staff']);

export function canAccessPath(roleInput: any, path: string): boolean {
  const role = normRole(roleInput);
  const clean = (path || '').split('?')[0].replace(/\/+$/, '') || '/';
  if (clean === '/profile' || clean === '/subscribe' || clean === '/login') return true;
  if (isAdminRole(role)) return true;
  if (ADMIN_PATHS.has(clean)) return false;
  if (role === 'kitchen') return KITCHEN_PATHS.has(clean);
  // manager, staff, captain: everything except admin-only paths
  return true;
}
