export default function PermissionRoute({ allowed, children }) {
    if (allowed) return children;
    return (
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <h2 className="text-xl font-bold text-amber-950">Du har ikke adgang til funktionen</h2>
            <p className="mt-2 text-sm text-amber-800">
                Den aktive profil mangler den nødvendige rettighed. En administrator kan ændre profilens ekstra adgang.
            </p>
        </div>
    );
}
