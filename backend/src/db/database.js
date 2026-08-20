import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { currentDataSource, DATA_SOURCES } from './dataSource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// To databaser side om side på samme (persistente) placering:
// - demo:  seedet testdata — legepladsen (uændret filnavn, så eksisterende
//          demodata bevares)
// - live:  rigtige data — starter helt tom og bygges op af brugerne
export const DB_PATH = process.env.DB_PATH
    ? resolve(process.env.DB_PATH)
    : join(__dirname, 'database.sqlite');
export const LIVE_DB_PATH = process.env.LIVE_DB_PATH
    ? resolve(process.env.LIVE_DB_PATH)
    : join(dirname(DB_PATH), 'live.sqlite');

function openDatabase(path) {
    mkdirSync(dirname(path), { recursive: true });
    const database = Database(path);
    database.pragma('foreign_keys = ON');
    database.pragma('journal_mode = WAL');
    database.pragma('busy_timeout = 5000');
    return database;
}

const databases = Object.freeze({
    [DATA_SOURCES.DEMO]: openDatabase(DB_PATH),
    [DATA_SOURCES.LIVE]: openDatabase(LIVE_DB_PATH)
});

export function databaseFor(source) {
    return databases[source] || databases[DATA_SOURCES.DEMO];
}

function activeDatabase() {
    return databaseFor(currentDataSource());
}

function ensureColumn(database, table, column, definition) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(existing => existing.name === column)) {
        database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        return true;
    }
    return false;
}

// Skema + migreringer — køres på BEGGE databaser (idempotent).
function migrateSchema(database) {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    const migrate = database.transaction(() => {
        database.exec(schema);
        ensureColumn(database, 'caregivers', 'deleted_at', 'DATETIME');
        ensureColumn(database, 'children', 'deleted_at', 'DATETIME');
        // E-mail kobler en barnepige til hendes login (rigtige data-tilstanden).
        ensureColumn(database, 'caregivers', 'email', 'TEXT');
        const approverRoleAdded = ensureColumn(database, 'approvers', 'role', "TEXT NOT NULL DEFAULT 'approver'");
        if (approverRoleAdded) {
            // Den tidligere profil med rettighedsstyring svarer til den nye administratorrolle.
            database.exec(`
                UPDATE approvers SET role = 'administrator'
                WHERE id IN (
                    SELECT approver_id FROM approver_permissions
                    WHERE permission = 'manage_permissions'
                )
            `);
        }
        ensureColumn(database, 'time_entries', 'calculation_version', "TEXT NOT NULL DEFAULT 'legacy'");
        ensureColumn(database, 'extra_grants', 'granted_by', "TEXT NOT NULL DEFAULT 'Godkender'");
        const grantedAtAdded = ensureColumn(database, 'extra_grants', 'granted_at', 'DATETIME');
        if (grantedAtAdded) {
            database.exec('UPDATE extra_grants SET granted_at = COALESCE(created_at, CURRENT_TIMESTAMP)');
        }
        const extraGrantSourceAdded = ensureColumn(database, 'extra_grants', 'grant_source', "TEXT NOT NULL DEFAULT 'normal'");
        if (extraGrantSourceAdded) {
            // Før denne migration kunne ekstratimer kun gives til rammebevillinger.
            database.exec("UPDATE extra_grants SET grant_source = 'frame'");
        }
        const grantSourceAdded = ensureColumn(database, 'time_entries', 'grant_source', "TEXT NOT NULL DEFAULT 'normal'");
        if (grantSourceAdded) {
            // Legacydata med en ren rammebevilling har hidtil implicit brugt denne pulje.
            database.exec(`
                UPDATE time_entries SET grant_source = 'frame'
                WHERE child_id IN (
                    SELECT id FROM children
                    WHERE has_frame_grant = 1 AND COALESCE(grant_hours, 0) = 0
                )
            `);
        }
        database.exec(`
            CREATE INDEX IF NOT EXISTS idx_caregivers_deleted_at ON caregivers(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_children_deleted_at ON children(deleted_at);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_caregivers_email
                ON caregivers(lower(email)) WHERE email IS NOT NULL;
        `);
    });
    migrate();
}

// Standard-godkenderprofiler — KUN i demodatabasen. Den rigtige database
// starter helt tom; dér oprettes den første administrator automatisk ud fra
// portal-loginet (se bootstrapLiveAdministrator i index.js).
function seedDemoProfiles(database) {
    const demoApprovers = [
        ['Mette Sørensen', 'mette.sorensen@example.test', 'administrator'],
        ['Jonas Nielsen', 'jonas.nielsen@example.test', 'approver'],
        ['Lene Hansen', 'lene.hansen@example.test', 'approver']
    ];
    const insertApprover = database.prepare(`
        INSERT OR IGNORE INTO approvers (name, email, role) VALUES (?, ?, ?)
    `);
    for (const approver of demoApprovers) insertApprover.run(...approver);

    const permissionSets = {
        'mette.sorensen@example.test': [
            'export_reports', 'manage_children', 'manage_caregivers',
            'manage_holidays', 'manage_settings', 'manage_permissions', 'manage_grants'
        ],
        'jonas.nielsen@example.test': ['export_reports', 'manage_grants'],
        'lene.hansen@example.test': ['manage_holidays']
    };
    const findApprover = database.prepare('SELECT id FROM approvers WHERE email = ?');
    const insertPermission = database.prepare(`
        INSERT OR IGNORE INTO approver_permissions (approver_id, permission, granted_by)
        VALUES (?, ?, 'System – standardprofiler')
    `);
    for (const [email, permissions] of Object.entries(permissionSets)) {
        const approver = findApprover.get(email);
        for (const permission of permissions) insertPermission.run(approver.id, permission);
    }
}

// Initialiser begge databaser med skema; kun demo får seedede profiler.
export function initializeDatabase() {
    migrateSchema(databases[DATA_SOURCES.DEMO]);
    seedDemoProfiles(databases[DATA_SOURCES.DEMO]);
    migrateSchema(databases[DATA_SOURCES.LIVE]);
    console.log(`Database initialiseret: demo=${DB_PATH} live=${LIVE_DB_PATH}`);
}

// Proxy: al eksisterende kode importerer én "db", men hvert kald rammer den
// database som requesten har valgt (demo udenfor requests). Statements
// forberedes inde i request-håndteringen, så de binder til den rigtige fil.
const db = new Proxy({}, {
    get(_target, prop) {
        const database = activeDatabase();
        const value = database[prop];
        return typeof value === 'function' ? value.bind(database) : value;
    }
});

export default db;
