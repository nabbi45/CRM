export const FEATURE_KEYS = [
  'dashboard_overview',
  'new_booking',
  'projection_leads',
  'projection_leads_all',
  'all_bookings',
  'proforma_invoice',
  'agreements_generator',
  'generated_documents',
  'client_documents',
  'manage_users',
  'manage_services',
  'company_profile',
  'timecard',
  'timecard_edit',
  'communication',
  'employee_profile',
  'trash',
  'manage_documents',
  'edit_documents',
  'security',
];

export const FEATURE_LABELS = {
  dashboard_overview: 'Dashboard',
  new_booking: 'New Booking',
  projection_leads: 'Projection Lead',
  projection_leads_all: 'View All Projection Leads',
  all_bookings: 'All Booking',
  proforma_invoice: 'Proforma Invoice',
  agreements_generator: 'Agreements Generator',
  generated_documents: 'Generated Documents',
  client_documents: 'Client Documents',
  manage_users: 'Manage User',
  manage_services: 'Manage Services',
  company_profile: 'Company Profile',
  timecard: 'Timecard',
  timecard_edit: 'Manage/Edit Timecards',
  communication: 'Communication',
  employee_profile: 'Employee Profile',
  trash: 'Trash',
  manage_documents: 'Manage Documents (Delete/Reupload)',
  edit_documents: 'Edit Documents',
  security: 'Security',
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
    'projection_leads_all',
    'all_bookings',
    'proforma_invoice',
    'agreements_generator',
    'generated_documents',
    'client_documents',
    'manage_documents',
    'edit_documents',
    'manage_users',
    'manage_services',
    'company_profile',
    'timecard',
    'timecard_edit',
    'communication',
    'employee_profile',
    'security',
  ],
  'senior admin': [
    'dashboard_overview',
    'new_booking',
    'projection_leads',
    'projection_leads_all',
    'all_bookings',
    'proforma_invoice',
    'agreements_generator',
    'generated_documents',
    'client_documents',
    'manage_documents',
    'edit_documents',
    'manage_users',
    'manage_services',
    'company_profile',
    'timecard',
    'timecard_edit',
    'communication',
    'employee_profile',
    'security',
  ],
  hr: ['timecard', 'timecard_edit', 'communication', 'employee_profile'],
  bdm: [
    'dashboard_overview',
    'new_booking',
    'projection_leads',
    'all_bookings',
    'proforma_invoice',
    'generated_documents',
    'timecard',
    'communication',
    'employee_profile',
  ],
};

export const getDefaultFeaturePermissionsForRole = (role) => {
  const normalized = normalizeRole(role);
  const defaults = DEFAULT_ROLE_PERMISSIONS[normalized];
  if (defaults?.length) return defaults;

  return ['dashboard_overview', 'timecard', 'communication', 'employee_profile'];
};

export const applyRoleTemplate = (roleKey) => ({
  role: roleKey,
  permissions: getDefaultFeaturePermissionsForRole(roleKey),
});

export const sanitizeFeaturePermissions = (permissions = []) => {
  let list = Array.isArray(permissions) ? [...permissions] : [];
  // Migrate old keys
  if (list.includes('create_profile') || list.includes('my_profile') || list.includes('manage_employees')) list.push('employee_profile');
  if (list.includes('leave_management')) list.push('timecard');
  if (list.includes('process_documents')) list.push('client_documents');

  return [...new Set(list.filter((key) => FEATURE_KEYS.includes(key)))];
};

export const resolveFeaturePermissions = (userSession = {}) => {
  let final = [];
  const explicit = sanitizeFeaturePermissions(userSession?.feature_permissions);
  const defaults = getDefaultFeaturePermissionsForRole(userSession?.user_role);

  // Use explicit if it exists and has items (after sanitization), otherwise use defaults
  if (explicit.length > 0) {
    final = [...explicit];
  } else {
    final = [...defaults];
  }

  // Force essential tabs for everyone regardless of role or explicit setting
  if (!final.includes('dashboard_overview')) final.push('dashboard_overview');
  if (!final.includes('employee_profile')) final.push('employee_profile');
  if (['director', 'super admin', 'dev', 'srdev', 'sr dev', 'admin', 'senior admin'].includes(normalizeRole(userSession?.user_role)) && !final.includes('security')) {
    final.push('security');
  }

  return [...new Set(final.filter(k => FEATURE_KEYS.includes(k)))];
};

export const canAccessFeature = (userSession, featureKey) =>
  resolveFeaturePermissions(userSession).includes(featureKey);

// Helper to check higher authority role on frontend
export const HIGHER_AUTHORITY_ROLES = ['admin', 'senior admin', 'super admin', 'director', 'hr', 'dev', 'srdev', 'sr dev'];
export const isHigherAuthority = (userSession) => {
  const role = (userSession?.user_role || '').trim().toLowerCase();
  return HIGHER_AUTHORITY_ROLES.includes(role);
};
