export const ROLES = {
  PLATFORM_ADMIN: 1,
  COMPANY_ADMIN: 2,
  USER: 3,
  MANAGER: 4,
} as const;

export function isPlatformAdmin(roleId?: number | null): boolean {
  return roleId === ROLES.PLATFORM_ADMIN;
}

export function isCompanyAdmin(roleId?: number | null): boolean {
  return roleId === ROLES.COMPANY_ADMIN;
}

export function isManager(roleId?: number | null): boolean {
  return roleId === ROLES.MANAGER;
}

export function isRegularUser(roleId?: number | null): boolean {
  return roleId === ROLES.USER;
}

/** Company Admin or Manager — sidebar admin sections (not billing/company settings). */
export function isCompanyScopedAdmin(roleId?: number | null): boolean {
  return isCompanyAdmin(roleId) || isManager(roleId);
}

export function canAccessBilling(roleId?: number | null): boolean {
  return isCompanyAdmin(roleId);
}

export function canAccessCompanySettings(roleId?: number | null): boolean {
  return isCompanyAdmin(roleId);
}

export function canManageUsers(roleId?: number | null): boolean {
  return isPlatformAdmin(roleId) || isCompanyAdmin(roleId) || isManager(roleId);
}

export function canDeleteUsers(roleId?: number | null): boolean {
  return isPlatformAdmin(roleId) || isCompanyAdmin(roleId);
}

export function canCreateDepartments(roleId?: number | null): boolean {
  return isPlatformAdmin(roleId) || isCompanyAdmin(roleId);
}

export function canDeleteDepartments(roleId?: number | null): boolean {
  return isPlatformAdmin(roleId) || isCompanyAdmin(roleId);
}

export function canUpdateDepartments(roleId?: number | null): boolean {
  return isPlatformAdmin(roleId) || isCompanyAdmin(roleId) || isManager(roleId);
}

export function canManagePhoneNumbers(roleId?: number | null): boolean {
  return isPlatformAdmin(roleId) || isCompanyAdmin(roleId);
}

export function canViewPhoneNumbers(roleId?: number | null): boolean {
  return canManagePhoneNumbers(roleId) || isManager(roleId);
}

export function canAccessMediaLibrary(roleId?: number | null): boolean {
  return isCompanyAdmin(roleId) || isManager(roleId);
}

export function canDeleteMediaFile(
  roleId?: number | null,
  fileUserId?: number | null,
  currentUserId?: number | null
): boolean {
  if (isPlatformAdmin(roleId) || isCompanyAdmin(roleId)) return true;
  if (isManager(roleId)) {
    return (
      fileUserId != null &&
      currentUserId != null &&
      Number(fileUserId) === Number(currentUserId)
    );
  }
  return false;
}

/** Listen / barge on live calls (supervisor Twilio access). */
export function hasSupervisorAccess(roleId?: number | null): boolean {
  return isPlatformAdmin(roleId) || isCompanyAdmin(roleId) || isManager(roleId);
}

export function getRoleName(roleId?: number | null): string {
  switch (roleId) {
    case ROLES.PLATFORM_ADMIN:
      return 'Super Admin';
    case ROLES.COMPANY_ADMIN:
      return 'Admin';
    case ROLES.MANAGER:
      return 'Manager';
    case ROLES.USER:
      return 'User';
    default:
      return 'Unknown';
  }
}

/** Full company-wide app access (calls, SMS, comms) — Company Admin or Manager. */
export function hasCompanyWideAccess(roleId?: number | null): boolean {
  return isCompanyAdmin(roleId) || isManager(roleId);
}

export function canListAllCompanyDepartments(roleId?: number | null): boolean {
  return isPlatformAdmin(roleId) || hasCompanyWideAccess(roleId);
}

export function getAssignableRolesForCreator(creatorRoleId?: number | null): number[] {
  if (isPlatformAdmin(creatorRoleId)) {
    return [ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.USER];
  }
  if (isCompanyAdmin(creatorRoleId)) {
    return [ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.USER];
  }
  if (isManager(creatorRoleId)) {
    return [ROLES.USER];
  }
  return [];
}
