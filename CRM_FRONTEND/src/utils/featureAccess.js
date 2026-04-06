export const FEATURE_KEYS = [
  'dashboard_overview',
  'new_booking',
  'projection_leads',
  'all_bookings',
  'proforma_invoice',
  'agreements_generator',
  'generated_documents',
  'manage_users',
  'manage_services',
  'company_profile',
  'leave_management',
  'communication',
  'employee_profile',
  'trash',
];

export const FEATURE_LABELS = {
  dashboard_overview: 'Dashboard',
  new_booking: 'New Booking',
  projection_leads: 'Projection Lead',
  all_bookings: 'All Booking',
  proforma_invoice: 'Proforma Invoice',
  agreements_generator: 'Agreements Generator',
  generated_documents: 'Generated Documents',
  manage_users: 'Manage User',
  manage_services: 'Manage Services',
  company_profile: 'Company Profile',
  leave_management: 'Leave Management',
  communication: 'Communication',
  employee_profile: 'Employee Profile',
  trash: 'Trash',
};

export const ROLE_TEMPLATE_OPTIONS = [
  { key: 'admin', label: 'Admin' },
  { key: 'senior admin', label: 'Senior Admin' },
  { key: 'super admin', label: 'Super Admin' },
  { key: 'hr', label: 'HR' },
  { key: 'bdm', label: 'BDM' },
  { key: 'dev', label: 'Dev' },
  { key: 'srdev', label: 'Sr Dev' },
];

const normalizeRole = (role = '') => role.toString().trim().toLowerCase();

const DEFAULT_ROLE_PERMISSIONS = {
  dev: FEATURE_KEYS,
  srdev: FEATURE_KEYS,
  'super admin': FEATURE_KEYS,
  admin: [
    'dashboard_overview',
    'new_booking',
    'projection_leads',
    'all_bookings',
    'proforma_invoice',
    'agreements_generator',
    'generated_documents',
    'manage_users',
    'manage_services',
    'company_profile',
    'leave_management',
    'communication',
    'employee_profile',
  ],
  'senior admin': [
    'dashboard_overview',
    'new_booking',
    'projection_leads',
    'all_bookings',
    'proforma_invoice',
    'agreements_generator',
    'generated_documents',
    'manage_users',
    'manage_services',
    'company_profile',
    'leave_management',
    'communication',
    'employee_profile',
  ],
  hr: ['leave_management', 'communication', 'employee_profile'],
  bdm: [
    'dashboard_overview',
    'new_booking',
    'projection_leads',
    'all_bookings',
    'proforma_invoice',
    'generated_documents',
    'leave_management',
    'communication',
    'employee_profile',
  ],
};

export const getDefaultFeaturePermissionsForRole = (role) => {
  const normalized = normalizeRole(role);
  const defaults = DEFAULT_ROLE_PERMISSIONS[normalized];
  if (defaults?.length) return defaults;

  return ['dashboard_overview', 'projection_leads', 'leave_management', 'communication', 'employee_profile'];
};

export const applyRoleTemplate = (roleKey) => ({
  role: roleKey,
  permissions: getDefaultFeaturePermissionsForRole(roleKey),
});

export const sanitizeFeaturePermissions = (permissions = []) => {
  let list = Array.isArray(permissions) ? [...permissions] : [];
  // Migrate old profile keys to the new unified key
  if (list.includes('create_profile') || list.includes('my_profile') || list.includes('manage_employees')) {
    list.push('employee_profile');
  }
  return [...new Set(list.filter((key) => FEATURE_KEYS.includes(key)))];
};

export const resolveFeaturePermissions = (userSession = {}) => {
  const explicit = sanitizeFeaturePermissions(userSession?.feature_permissions);
  if (explicit.length) return explicit;
  return getDefaultFeaturePermissionsForRole(userSession?.user_role);
};

export const canAccessFeature = (userSession, featureKey) =>
  resolveFeaturePermissions(userSession).includes(featureKey);

// Helper to check higher authority role on frontend
export const HIGHER_AUTHORITY_ROLES = ['admin', 'senior admin', 'super admin', 'hr', 'dev', 'srdev'];
export const isHigherAuthority = (userSession) => {
  const role = (userSession?.user_role || '').trim().toLowerCase();
  return HIGHER_AUTHORITY_ROLES.includes(role);
};
