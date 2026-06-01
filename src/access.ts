export type PageAccessMode = 'none' | 'view' | 'edit';

export const pageKeys = [
  'dashboard',
  'farmAtGlance',
  'tillage',
  'seeding',
  'planterChecks',
  'scouting',
  'spray',
  'potatoYield',
  'harvest',
  'potatoStorage',
  'fieldSummary',
  'seedingPlan',
  'fields',
] as const;

export type AppPageKey = (typeof pageKeys)[number];
export type AppPagePermissions = Record<AppPageKey, PageAccessMode>;

export interface AuthUser {
  username: string;
  createdAt: string;
  status: 'pending' | 'approved';
  isAdmin: boolean;
  permissions: AppPagePermissions;
}

export const pageDefinitions: Array<{
  key: AppPageKey;
  label: string;
  route: string;
  editable: boolean;
  navLabel?: string;
  adminOnly?: boolean;
}> = [
  { key: 'dashboard', label: 'Dashboard', route: '/', editable: false, navLabel: 'Dashboard' },
  { key: 'farmAtGlance', label: 'Farm at a Glance', route: '/farm-at-a-glance', editable: false, navLabel: 'Farm at a Glance' },
  { key: 'tillage', label: 'Tillage', route: '/tillage', editable: true, navLabel: 'Tillage' },
  { key: 'seeding', label: 'Seeding', route: '/seeding', editable: true, navLabel: 'Seeding' },
  { key: 'planterChecks', label: 'Planter Checks', route: '/seeding/planter-checks', editable: true },
  { key: 'scouting', label: 'Scouting', route: '/scouting', editable: true, navLabel: 'Scouting' },
  { key: 'spray', label: 'Spray Plan', route: '/spray', editable: true, navLabel: 'Spray Plan' },
  { key: 'potatoYield', label: 'Potato Yield', route: '/potato-yield', editable: true, navLabel: 'Potato Yield' },
  { key: 'harvest', label: 'Harvest', route: '/harvest', editable: true, navLabel: 'Harvest' },
  { key: 'potatoStorage', label: 'Potato Storage', route: '/potato-storage', editable: true, navLabel: 'Potato Storage' },
  { key: 'fieldSummary', label: 'Field Summary', route: '/field-summary', editable: false, navLabel: 'Field Summary' },
  { key: 'seedingPlan', label: 'Seeding Plan', route: '/seeding-plan', editable: true, navLabel: 'Seeding Plan' },
  { key: 'fields', label: 'Fields', route: '/fields', editable: true, navLabel: 'Fields', adminOnly: true },
];

export const createPermissions = (mode: PageAccessMode): AppPagePermissions => (
  Object.fromEntries(pageKeys.map((key) => [key, mode])) as AppPagePermissions
);

export const fullEditPermissions = createPermissions('edit');

export const defaultApprovedPermissions: AppPagePermissions = {
  ...createPermissions('none'),
  dashboard: 'view',
  farmAtGlance: 'view',
};

export const normalizePermissions = (value?: Partial<Record<AppPageKey, PageAccessMode>> | null, fallback: AppPagePermissions = defaultApprovedPermissions): AppPagePermissions => {
  const source = value ?? {};
  return Object.fromEntries(
    pageKeys.map((key) => {
      const raw = source[key];
      return [key, raw === 'none' || raw === 'view' || raw === 'edit' ? raw : fallback[key]];
    }),
  ) as AppPagePermissions;
};

export const canView = (mode: PageAccessMode) => mode === 'view' || mode === 'edit';
export const canEdit = (mode: PageAccessMode) => mode === 'edit';