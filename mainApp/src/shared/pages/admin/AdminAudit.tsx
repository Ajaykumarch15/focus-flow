import { useSearchParams } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Activity } from 'lucide-react';
import { AdminOverview } from './AdminOverview';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminActivity } from './AdminActivity';

// S4-T3: the organization's monitoring surfaces (Overview / Analytics /
// Activity) were separate top-level routes that all lived behind the admin
// sidebar. They are consolidated into a single deep-link Audit page with an
// in-page view switch, matching the pattern TeamWorkspace uses for its tabs.
// The active view is reflected in the query string (?view=activity) so a
// specific surface stays deep-linkable.
type AuditView = 'overview' | 'analytics' | 'activity';

const VIEWS: { id: AuditView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'activity', label: 'Activity', icon: Activity },
];

function isAuditView(value: string | null): value is AuditView {
  return value === 'overview' || value === 'analytics' || value === 'activity';
}

export function AdminAudit() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: AuditView = isAuditView(viewParam) ? viewParam : 'overview';

  const selectView = (id: AuditView) => {
    setSearchParams(id === 'overview' ? {} : { view: id }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="px-6 lg:px-8 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Activity size={18} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">Audit</h1>
              <p className="text-sm text-surface-400 mt-0.5">
                Organization health, analytics and activity — one deep-link surface.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-surface-850/70 border border-surface-800 p-1 rounded-xl w-fit" role="tablist" aria-label="Audit views">
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const isActive = view === id;
            return (
              <button key={id} role="tab" aria-selected={isActive}
                onClick={() => selectView(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-surface-800 text-surface-50 border border-surface-700/80 shadow-sm'
                    : 'text-surface-400 hover:text-surface-200'
                }`}>
                <Icon size={14} className={isActive ? 'text-purple-400' : ''} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {view === 'overview' && <AdminOverview />}
      {view === 'analytics' && <AdminAnalytics />}
      {view === 'activity' && <AdminActivity />}
    </div>
  );
}
