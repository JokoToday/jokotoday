export type UserRole = 'admin' | 'staff' | 'product_staff';

export interface RolePermissions {
  canAccessAdmin: boolean;
  canAccessScanner: boolean;
  canAccessProductStaff: boolean;
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManagePages: boolean;
  canManageSettings: boolean;
  canManageLabels: boolean;
  canManagePickupRules: boolean;
  canManageLocations: boolean;
  canManageUsers: boolean;
  canManageOrders: boolean;
  canViewOrderDetails: boolean;
  canMarkOrderPaid: boolean;
  canMarkOrderPickedUp: boolean;
}

export function getPermissions(role: UserRole): RolePermissions {
  if (role === 'admin') {
    return {
      canAccessAdmin: true,
      canAccessScanner: true,
      canAccessProductStaff: true,
      canManageProducts: true,
      canManageCategories: true,
      canManagePages: true,
      canManageSettings: true,
      canManageLabels: true,
      canManagePickupRules: true,
      canManageLocations: true,
      canManageUsers: true,
      canManageOrders: true,
      canViewOrderDetails: true,
      canMarkOrderPaid: true,
      canMarkOrderPickedUp: true,
    };
  }

  if (role === 'product_staff') {
    return {
      canAccessAdmin: false,
      canAccessScanner: false,
      canAccessProductStaff: true,
      canManageProducts: true,
      canManageCategories: false,
      canManagePages: false,
      canManageSettings: false,
      canManageLabels: false,
      canManagePickupRules: false,
      canManageLocations: false,
      canManageUsers: false,
      canManageOrders: false,
      canViewOrderDetails: false,
      canMarkOrderPaid: false,
      canMarkOrderPickedUp: false,
    };
  }

  if (role === 'staff') {
    return {
      canAccessAdmin: false,
      canAccessScanner: true,
      canAccessProductStaff: false,
      canManageProducts: false,
      canManageCategories: false,
      canManagePages: false,
      canManageSettings: false,
      canManageLabels: false,
      canManagePickupRules: false,
      canManageLocations: false,
      canManageUsers: false,
      canManageOrders: false,
      canViewOrderDetails: true,
      canMarkOrderPaid: true,
      canMarkOrderPickedUp: true,
    };
  }

  return {
    canAccessAdmin: false,
    canAccessScanner: false,
    canAccessProductStaff: false,
    canManageProducts: false,
    canManageCategories: false,
    canManagePages: false,
    canManageSettings: false,
    canManageLabels: false,
    canManagePickupRules: false,
    canManageLocations: false,
    canManageUsers: false,
    canManageOrders: false,
    canViewOrderDetails: false,
    canMarkOrderPaid: false,
    canMarkOrderPickedUp: false,
  };
}

export function canAccessProductStaff(role: UserRole): boolean {
  return role === 'admin' || role === 'product_staff';
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

export function isStaff(role: UserRole): boolean {
  return role === 'staff';
}
