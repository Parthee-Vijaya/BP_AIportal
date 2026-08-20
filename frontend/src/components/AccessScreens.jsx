// Sider for de to "låste" tilstande: mangler rolle 1 (adgang til app), eller
// har adgang men ingen af de tre funktionsroller. Bruges også når de rigtige
// AD-grupper kommer — så er teksten allerede på plads.

function LockedShell({ children }) {
    return (
        <div className="flex min-h-screen flex-col bg-stone-100">
            <header className="brand-header text-white">
                <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
                    <p className="text-[15px] font-bold leading-tight">Kalundborg Kommune</p>
                    <p className="text-sm text-white/80">Barnepige Timeregistrering</p>
                </div>
            </header>
            <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-10 sm:px-6">
                {children}
            </main>
        </div>
    );
}

export function NoAccessScreen({ onOpenRolePicker }) {
    return (
        <LockedShell>
            <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                <h1 className="text-xl font-bold text-amber-950">Du har ikke adgang til appen</h1>
                <p className="mt-2 text-sm text-amber-800">
                    Adgang kræver rollen "Adgang til app" (rolle 1). Kontakt en administrator,
                    hvis du mener, du skulle have adgang.
                </p>
                <button type="button" onClick={onOpenRolePicker} className="btn-primary mt-5">
                    Vælg demo-roller
                </button>
            </div>
        </LockedShell>
    );
}

export function NoRolesScreen({ onOpenRolePicker }) {
    return (
        <LockedShell>
            <div className="w-full rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
                <h1 className="text-xl font-bold text-slate-900">Du har adgang, men ingen roller</h1>
                <p className="mt-2 text-sm text-slate-600">
                    Din bruger har rollen "Adgang til app", men ingen af rollerne Brugere,
                    Godkender eller Administrator — så der er ikke noget at vise endnu.
                </p>
                <button type="button" onClick={onOpenRolePicker} className="btn-primary mt-5">
                    Vælg demo-roller
                </button>
            </div>
        </LockedShell>
    );
}
