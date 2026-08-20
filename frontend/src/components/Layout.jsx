import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { initialsOf } from '../utils/helpers';

const KalundborgLogo = () => (
    <svg viewBox="0 0 80 60" className="h-10 w-auto" fill="currentColor" aria-hidden="true">
        <g>
            <rect x="8" y="20" width="8" height="25" /><polygon points="12,8 6,20 18,20" /><rect x="10" y="2" width="4" height="8" /><rect x="8" y="4" width="8" height="2" />
            <rect x="20" y="20" width="8" height="25" /><polygon points="24,8 18,20 30,20" /><rect x="22" y="2" width="4" height="8" /><rect x="20" y="4" width="8" height="2" />
            <rect x="32" y="15" width="10" height="30" /><polygon points="37,3 29,15 45,15" /><rect x="35" y="-3" width="4" height="8" /><rect x="33" y="-1" width="8" height="2" />
            <rect x="46" y="20" width="8" height="25" /><polygon points="50,8 44,20 56,20" /><rect x="48" y="2" width="4" height="8" /><rect x="46" y="4" width="8" height="2" />
            <rect x="58" y="20" width="8" height="25" /><polygon points="62,8 56,20 68,20" /><rect x="60" y="2" width="4" height="8" /><rect x="58" y="4" width="8" height="2" />
        </g>
        <path d="M5,50 Q15,45 25,50 T45,50 T65,50 T75,50" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M5,56 Q15,51 25,56 T45,56 T65,56 T75,56" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
);

const icon = (path) => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={path} />
    </svg>
);

const Icons = {
    menu: icon('M4 6h16M4 12h16M4 18h16'),
    close: icon('M6 18L18 6M6 6l12 12'),
    home: icon('M3 11.5L12 4l9 7.5M5.5 10v10h13V10M9 20v-6h6v6'),
    check: icon('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'),
    users: icon('M17 20h5v-2a4 4 0 00-4-4h-1M9 20H2v-2a4 4 0 014-4h3m6-7a4 4 0 11-8 0 4 4 0 018 0z'),
    child: icon('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'),
    clock: icon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
    list: icon('M9 5h10M9 12h10M9 19h10M5 5h.01M5 12h.01M5 19h.01'),
    calendar: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'),
    settings: icon('M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 00.34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0015 19.4a1.7 1.7 0 00-1 .6l-.04.08h-4l-.04-.08A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 003.6 15a1.7 1.7 0 00-.6-1l-.08-.04v-4L3 9.92a1.7 1.7 0 00.6-1 1.7 1.7 0 00-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 008 4.6a1.7 1.7 0 001-.6l.04-.08h4l.04.08a1.7 1.7 0 001 .6 1.7 1.7 0 001.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0019.4 9a1.7 1.7 0 00.6 1l.08.04v4L20 14.08a1.7 1.7 0 00-.6.92z'),
    user: icon('M20 21a8 8 0 00-16 0m12-13a4 4 0 11-8 0 4 4 0 018 0z'),
    logout: icon('M17 16l4-4m0 0l-4-4m4 4H9m4 7H7a2 2 0 01-2-2V7a2 2 0 012-2h6'),
    chevron: icon('M19 9l-7 7-7-7')
};

const CAREGIVER_NAV = [
        ['/barnepige', 'Overblik', Icons.home],
        ['/barnepige/registrer', 'Registrer', Icons.check],
        ['/barnepige/mine-timer', 'Mine timer', Icons.calendar]
];

const ADMIN_NAV = [
    ['barnepiger', 'Barnepiger', Icons.users, 'manage_caregivers'],
    ['helligdage', 'Helligdage', Icons.calendar, 'manage_holidays'],
    ['rettigheder', 'Roller og rettigheder', Icons.settings, 'manage_permissions']
];

const ROLE_LABELS = { approver: 'Godkender', administrator: 'Administrator', caregiver: 'Barnepige' };
const HOME_PATHS = { approver: '/godkender/overblik', administrator: '/administrator/overblik', caregiver: '/barnepige' };

export default function Layout({ children, userRole, onRoleChange, approvers = [], approver, onApproverChange, availableRoles = ['approver', 'administrator', 'caregiver'], me, onOpenRolePicker, caregivers = [], caregiver, onCaregiverChange }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const isStaff = userRole === 'approver' || userRole === 'administrator';
    const basePath = userRole === 'administrator' ? '/administrator' : '/godkender';
    const navItems = userRole === 'caregiver' ? CAREGIVER_NAV : [
        [`${basePath}/overblik`, 'Overblik', Icons.home],
        [`${basePath}/godkendelse`, 'Godkendelse', Icons.check],
        [`${basePath}/boern`, 'Børn og bevillinger', Icons.child],
        [`${basePath}/rapporter`, 'Rapporter', Icons.list]
    ];
    const adminItems = ADMIN_NAV
        .filter(([, , , permission]) => approver?.permissions?.includes(permission))
        .map(([path, label, navIcon, permission]) => [`${basePath}/${path}`, label, navIcon, permission]);

    useEffect(() => {
        setMenuOpen(false);
        setAdminOpen(false);
        setUserMenuOpen(false);
    }, [location.pathname]);

    function changeRole(role) {
        onRoleChange(role);
        navigate(HOME_PATHS[role]);
    }

    const isActive = path => location.pathname === path;

    return (
        <div className={`app-shell min-h-screen ${userRole === 'caregiver' ? 'has-mobile-nav' : ''}`}>
            <a href="#main-content" className="skip-link">Spring til hovedindhold</a>
            <header className="brand-header sticky top-0 z-50 text-white">
                <div className="mx-auto flex min-h-[72px] max-w-[1600px] items-stretch gap-5 px-4 sm:px-6 lg:px-8">
                    <Link to={HOME_PATHS[userRole]} className="brand-lockup flex shrink-0 items-center gap-3 py-3" aria-label="Kalundborg Kommune, gå til overblik">
                        <KalundborgLogo />
                        <span className="text-[15px] font-bold leading-[1.05] tracking-wide sm:text-base">Kalundborg<br />Kommune</span>
                    </Link>

                    <nav aria-label="Primær navigation" className="desktop-nav hidden items-stretch xl:flex">
                        {navItems.map(([path, label, navIcon]) => (
                            <Link key={path} to={path} aria-current={isActive(path) ? 'page' : undefined} className={`desktop-nav-link ${isActive(path) ? 'is-active' : ''}`}>
                                {navIcon}<span>{label}</span>
                            </Link>
                        ))}
                        {isStaff && adminItems.length > 0 && (
                            <div className="relative flex">
                                <button type="button" onClick={() => setAdminOpen(open => !open)} aria-expanded={adminOpen} className={`desktop-nav-link ${location.pathname.startsWith(`${basePath}/`) && !navItems.some(([path]) => path === location.pathname) ? 'is-active' : ''}`}>
                                    {Icons.settings}<span>Administration</span>{Icons.chevron}
                                </button>
                                {adminOpen && (
                                    <div className="admin-menu absolute left-0 top-[calc(100%-2px)] z-50 min-w-64 border border-stone-200 bg-white p-2 text-slate-900 shadow-lg">
                                        {adminItems.map(([path, label, navIcon]) => (
                                            <Link key={path} to={path} className={`admin-menu-link ${isActive(path) ? 'is-active' : ''}`}>{navIcon}{label}</Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </nav>

                    <div className="ml-auto flex min-w-0 items-center gap-2 py-3">
                        <div className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium 2xl:flex">
                            {Icons.user}
                            <span>{ROLE_LABELS[userRole]}{isStaff && approver?.name ? ` · ${approver.name}` : ''}{userRole === 'caregiver' && caregiver ? ` · ${caregiver.first_name} ${caregiver.last_name}` : ''}</span>
                        </div>
                        {availableRoles.length > 1 && (
                            <>
                                <label className="sr-only" htmlFor="role-switcher">Skift visning</label>
                                <select id="role-switcher" value={userRole} onChange={event => changeRole(event.target.value)} className="header-select max-w-[150px]">
                                    {availableRoles.map(role => (
                                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        {isStaff && approvers.length > 0 && (
                            <>
                                <label className="sr-only" htmlFor="approver-switcher">Valgt profil</label>
                                <select id="approver-switcher" value={approver?.id || ''} onChange={event => onApproverChange(event.target.value)} className="header-select hidden max-w-[190px] 2xl:block">
                                    {approvers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </select>
                            </>
                        )}
                        {userRole === 'caregiver' && caregivers.length > 0 && (
                            <>
                                <label className="sr-only" htmlFor="caregiver-switcher">Demo-profil: hvilken barnepiges data vises</label>
                                <select id="caregiver-switcher" value={caregiver?.id || ''} onChange={event => onCaregiverChange(event.target.value)} className="header-select hidden max-w-[190px] 2xl:block" title="Demo-profil: hvilken barnepiges data vises">
                                    {caregivers.map(item => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}
                                </select>
                            </>
                        )}
                        {me !== undefined && (
                            <div className="relative flex shrink-0 items-center">
                                <button
                                    type="button"
                                    onClick={() => setUserMenuOpen(open => !open)}
                                    aria-expanded={userMenuOpen}
                                    aria-label="Brugermenu"
                                    title={me?.name ? `Logget ind som ${me.name}` : 'Brugermenu'}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white transition-colors hover:bg-white/30"
                                >
                                    {initialsOf(me?.name)}
                                </button>
                                {userMenuOpen && (
                                    <div className="admin-menu absolute right-0 top-[calc(100%+8px)] z-50 min-w-64 border border-stone-200 bg-white p-2 text-slate-900 shadow-lg">
                                        <div className="border-b border-stone-100 px-2.5 pb-2 pt-1">
                                            <p className="truncate text-sm font-semibold">{me?.name || 'Ukendt bruger'}</p>
                                            <p className="truncate text-xs text-slate-500">{me?.upn || ''}</p>
                                        </div>
                                        {onOpenRolePicker && (
                                            <button type="button" onClick={() => { setUserMenuOpen(false); onOpenRolePicker(); }} className="admin-menu-link w-full text-left">
                                                {Icons.settings}Skift demo-roller
                                            </button>
                                        )}
                                        {me?.authEnabled && (
                                            <a href="/api/auth/entra/logout" target="_top" className="admin-menu-link">
                                                {Icons.logout}Log ud
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <button type="button" className="header-icon-button xl:hidden" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? 'Luk menu' : 'Åbn menu'} onClick={() => setMenuOpen(open => !open)}>
                            {menuOpen ? Icons.close : Icons.menu}
                        </button>
                    </div>
                </div>

                {menuOpen && (
                    <nav id="mobile-menu" aria-label="Mobilmenu" className="mobile-menu border-t border-white/20 px-4 py-3 xl:hidden">
                        {isStaff && approvers.length > 0 && (
                            <div className="mb-3">
                                <label htmlFor="mobile-approver-switcher" className="mb-1 block text-xs font-semibold text-white/75">Aktiv {ROLE_LABELS[userRole].toLowerCase()}</label>
                                <select id="mobile-approver-switcher" value={approver?.id || ''} onChange={event => onApproverChange(event.target.value)} className="header-select w-full max-w-none">
                                    {approvers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </select>
                            </div>
                        )}
                        {userRole === 'caregiver' && caregivers.length > 0 && (
                            <div className="mb-3">
                                <label htmlFor="mobile-caregiver-switcher" className="mb-1 block text-xs font-semibold text-white/75">Demo-profil (barnepige)</label>
                                <select id="mobile-caregiver-switcher" value={caregiver?.id || ''} onChange={event => onCaregiverChange(event.target.value)} className="header-select w-full max-w-none">
                                    {caregivers.map(item => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}
                                </select>
                            </div>
                        )}
                        {[...navItems, ...(isStaff ? adminItems : [])].map(([path, label, navIcon]) => (
                            <Link key={path} to={path} className={`mobile-menu-link ${isActive(path) ? 'is-active' : ''}`}>{navIcon}{label}</Link>
                        ))}
                        {me?.name && (
                            <p className="mt-2 px-1 text-xs text-white/70">Logget ind som {me.name}{me.upn ? ` (${me.upn})` : ''}</p>
                        )}
                        {onOpenRolePicker && (
                            <button type="button" onClick={onOpenRolePicker} className="mobile-menu-link w-full text-left">
                                {Icons.user}
                                <span>Skift demo-roller</span>
                            </button>
                        )}
                        {me?.authEnabled && (
                            <a href="/api/auth/entra/logout" target="_top" className="mobile-menu-link">
                                {Icons.logout}
                                <span>Log ud</span>
                            </a>
                        )}
                    </nav>
                )}
            </header>

            <main id="main-content" tabIndex="-1" className="app-main mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                {children}
            </main>

            <footer className="app-footer border-t border-stone-200 bg-white">
                <div className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                    <span className="font-semibold text-slate-800">Kalundborg Kommune</span>
                    <span>Timeregistrering · Barnepige-ordningen</span>
                </div>
            </footer>

            {userRole === 'caregiver' && (
                <nav className="mobile-bottom-nav md:hidden" aria-label="Primær mobilnavigation">
                    {navItems.map(([path, label, navIcon]) => (
                        <Link key={path} to={path} aria-current={isActive(path) ? 'page' : undefined} className={`mobile-bottom-link ${isActive(path) ? 'is-active' : ''}`}>
                            {navIcon}<span>{label}</span>
                        </Link>
                    ))}
                </nav>
            )}
        </div>
    );
}
