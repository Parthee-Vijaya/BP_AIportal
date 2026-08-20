-- Barnepige Timeregistrering Database Schema
-- SQLite database

-- Barnepiger (babysitters). E-mail kobler barnepigen til hendes login i
-- "rigtige data"-tilstanden (valgfri; unik når sat).
CREATE TABLE IF NOT EXISTS caregivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    ma_number TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Godkendere og administratorer. Kernerettigheder følger rollen, mens
-- eventuelle ekstra rettigheder ligger separat i approver_permissions.
CREATE TABLE IF NOT EXISTS approvers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'approver' CHECK (role IN ('approver', 'administrator')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approver_permissions (
    approver_id INTEGER NOT NULL,
    permission TEXT NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by TEXT NOT NULL DEFAULT 'System',
    PRIMARY KEY (approver_id, permission),
    FOREIGN KEY (approver_id) REFERENCES approvers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_approver_permissions_approver ON approver_permissions(approver_id);

-- Børn (children)
CREATE TABLE IF NOT EXISTS children (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE,
    psp_element TEXT,

    -- Bevillingstype: 'week', 'month', 'quarter', 'half_year', 'year', 'specific_weekdays'
    grant_type TEXT NOT NULL DEFAULT 'week',

    -- Standard bevilling (timer) - bruges for alle typer undtagen specific_weekdays
    grant_hours REAL DEFAULT 0,

    -- Bevilling pr. ugedag (JSON) - kun for specific_weekdays
    -- Format: {"monday": 2, "tuesday": 4, "wednesday": 0, ...}
    grant_weekdays TEXT,

    -- Rammebevilling
    has_frame_grant INTEGER DEFAULT 0,
    frame_hours REAL DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Relation: Barn <-> Barnepige (many-to-many)
CREATE TABLE IF NOT EXISTS child_caregiver (
    child_id INTEGER NOT NULL,
    caregiver_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (child_id, caregiver_id),
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
);

-- Timeregistreringer
CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caregiver_id INTEGER NOT NULL,
    child_id INTEGER NOT NULL,

    -- Dato og tid
    date DATE NOT NULL,
    start_time TEXT NOT NULL,  -- Format: "HH:MM"
    end_time TEXT NOT NULL,    -- Format: "HH:MM"

    -- Beregnede timer (opdateres automatisk)
    normal_hours REAL DEFAULT 0,
    evening_hours REAL DEFAULT 0,
    night_hours REAL DEFAULT 0,
    saturday_hours REAL DEFAULT 0,
    sunday_holiday_hours REAL DEFAULT 0,
    total_hours REAL DEFAULT 0,

    -- Version af regelsættet som beregnede timefelterne
    calculation_version TEXT NOT NULL DEFAULT 'legacy',

    -- Valgt bevillingskilde: 'normal' eller 'frame'
    grant_source TEXT NOT NULL DEFAULT 'normal' CHECK (grant_source IN ('normal', 'frame')),

    -- Kommentar
    comment TEXT,

    -- Status: 'pending', 'approved', 'rejected'
    status TEXT DEFAULT 'pending',

    -- Timestamps
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    rejection_reason TEXT,

    -- Lønsystem registrering
    payroll_registered INTEGER DEFAULT 0,
    payroll_date DATETIME,

    FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

-- Append-only auditlog for timeregistreringens workflow
CREATE TABLE IF NOT EXISTS time_entry_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time_entry_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_time_entry_audit_entry ON time_entry_audit(time_entry_id, created_at);

-- Systemindstillinger (fx månedsinterval)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    effective_from DATE -- Gælder fra denne dato (forhindrer bagudrettede ændringer)
);

-- Månedsinterval historik (bevarer historik så ændringer ikke slår bagud)
CREATE TABLE IF NOT EXISTS month_interval_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_day INTEGER NOT NULL, -- Første dag i perioden (fx 16)
    end_day INTEGER NOT NULL,   -- Sidste dag i perioden (fx 15)
    effective_from DATE NOT NULL, -- Gælder fra denne dato
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ekstrabevilling (ud over almindelig bevilling, overruler ikke denne)
CREATE TABLE IF NOT EXISTS extra_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    hours REAL NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    grant_source TEXT NOT NULL DEFAULT 'normal' CHECK (grant_source IN ('normal', 'frame')),
    comment TEXT,
    granted_by TEXT NOT NULL DEFAULT 'Godkender',
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_extra_grants_child_id ON extra_grants(child_id);
CREATE INDEX IF NOT EXISTS idx_extra_grants_dates ON extra_grants(from_date, to_date);

-- Brugerdefinerede helligdage
CREATE TABLE IF NOT EXISTS custom_holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    all_day INTEGER DEFAULT 1,
    start_time TEXT,
    end_time TEXT,
    recurring INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for hurtigere søgning
CREATE INDEX IF NOT EXISTS idx_time_entries_child_id ON time_entries(child_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_caregiver_id ON time_entries(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
