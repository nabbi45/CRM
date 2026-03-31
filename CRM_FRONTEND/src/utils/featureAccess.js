export const FEATURE_KEYS = [
  'dashboard_overview',
  'new_booking',
  'all_bookings',
  'my_bookings',
  'proforma_invoice',
  'agreements_generator',
  'generated_documents',
  'manage_users',
  'manage_services',
  'company_profile',
  'manage_employees',
  'leave_management',
  'communication',
  'my_profile',
  'create_profile',
  'all_trash',
  'my_trash',
];

export const FEATURE_LABELS = {
  dashboard_overview: 'Dashboard',
  new_booking: 'New Booking',
  all_bookings: 'All Booking',
  my_bookings: 'My Booking',
  proforma_invoice: 'Proforma Invoice',
  agreements_generator: 'Agreements Generator',
  generated_documents: 'Generated Documents',
  manage_users: 'Manage User',
  manage_services: 'Manage Services',
  company_profile: 'Company Profile',
  manage_employees: 'Manage Employees',
  leave_management: 'Leave Management',
  communication: 'Communication',
  my_profile: 'My Profile',
  create_profile: 'Create Profile',
  all_trash: 'All Trash',
  my_trash: 'My Trash',
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
    'all_bookings',
    'proforma_invoice',
    'agreements_generator',
    'generated_documents',
    'manage_users',
    'manage_services',
    'company_profile',
    'leave_management',
    'communication',
    'my_profile',
    'create_profile',
    'all_trash',
  ],
  'senior admin': [
    'dashboard_overview',
    'new_booking',
    'all_bookings',
    'proforma_invoice',
    'agreements_generator',
    'generated_documents',
    'manage_users',
    'manage_services',
    'company_profile',
    'leave_management',
    'communication',
    'my_profile',
    'create_profile',
    'all_trash',
  ],
  hr: ['manage_employees', 'leave_management', 'communication', 'my_profile', 'create_profile'],
  bdm: [
    'dashboard_overview',
    'new_booking',
    'my_bookings',
    'proforma_invoice',
    'generated_documents',
    'leave_management',
    'communication',
    'my_profile',
    'create_profile',
    'my_trash',
  ],
};

export const getDefaultFeaturePermissionsForRole = (role) => {
  const normalized = normalizeRole(role);
  const defaults = DEFAULT_ROLE_PERMISSIONS[normalized];
  if (defaults?.length) return defaults;

  return ['dashboard_overview', 'leave_management', 'communication', 'my_profile', 'create_profile'];
};

export const applyRoleTemplate = (roleKey) => ({
  role: roleKey,
  permissions: getDefaultFeaturePermissionsForRole(roleKey),
});

export const sanitizeFeaturePermissions = (permissions = []) =>
  [...new Set((Array.isArray(permissions) ? permissions : []).filter((key) => FEATURE_KEYS.includes(key)))];

export const resolveFeaturePermissions = (userSession = {}) => {
  const explicit = sanitizeFeaturePermissions(userSession?.feature_permissions);
  if (explicit.length) return explicit;
  return getDefaultFeaturePermissionsForRole(userSession?.user_role);
};

export const canAccessFeature = (userSession, featureKey) =>
  resolveFeaturePermissions(userSession).includes(featureKey);
