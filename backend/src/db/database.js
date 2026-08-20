import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Databaseplacering. I produktion peger DB_PATH på et persistent mount.
export const DB_PATH = process.env.DB_PATH
    ? resolve(process.env.DB_PATH)
    : join(__dirname, 'database.sqlite');

mkdirSync(dirname(DB_PATH), { recursive: true });

// Opret database forbindelse
const db = Database(DB_PATH);

// Aktiver foreign keys
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

function ensureColumn(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(existing => existing.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        return true;
    }
    return false;
}

// Initialiser database med schema
export function initializeDatabase() {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    const migrate = db.transaction(() => {
        db.exec(schema);
        ensureColumn('caregivers', 'deleted_at', 'DATETIME');
        ensureColumn('children', 'deleted_at', 'DATETIME');
        ensureColumn('time_entries', 'calculation_version', "TEXT NOT NULL DEFAULT 'legacy'");
        ensureColumn('extra_grants', 'granted_by', "TEXT NOT NULL DEFAULT 'Godkender'");
        const grantedAtAdded = ensureColumn('extra_grants', 'granted_at', 'DATETIME');
        if (grantedAtAdded) {
            db.exec('UPDATE extra_grants SET granted_at = COALESCE(created_at, CURRENT_TIMESTAMP)');
        }
        const extraGrantSourceAdded = ensureColumn('extra_grants', 'grant_source', "TEXT NOT NULL DEFAULT 'normal'");
        if (extraGrantSourceAdded) {
            // Før denne migration kunne ekstratimer kun gives til rammebevillinger.
            db.exec("UPDATE extra_grants SET grant_source = 'frame'");
        }
        const grantSourceAdded = ensureColumn('time_entries', 'grant_source', "TEXT NOT NULL DEFAULT 'normal'");
        if (grantSourceAdded) {
            // Legacydata med en ren rammebevilling har hidtil implicit brugt denne pulje.
            db.exec(`
                UPDATE time_entries SET grant_source = 'frame'
                WHERE child_id IN (
                    SELECT id FROM children
                    WHERE has_frame_grant = 1 AND COALESCE(grant_hours, 0) = 0
                )
            `);
        }
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_caregivers_deleted_at ON caregivers(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_children_deleted_at ON children(deleted_at);
        `);

        const demoApprovers = [
            ['Mette Sørensen', 'mette.sorensen@example.test'],
            ['Jonas Nielsen', 'jonas.nielsen@example.test'],
            ['Lene Hansen', 'lene.hansen@example.test']
        ];
        const insertApprover = db.prepare(`
            INSERT OR IGNORE INTO approvers (name, email) VALUES (?, ?)
        `);
        for (const approver of demoApprovers) insertApprover.run(...approver);

        const permissionSets = {
            'mette.sorensen@example.test': [
                'export_reports', 'manage_children', 'manage_caregivers',
                'manage_holidays', 'manage_settings', 'manage_permissions'
            ],
            'jonas.nielsen@example.test': ['export_reports'],
            'lene.hansen@example.test': ['manage_holidays']
        };
        const findApprover = db.prepare('SELECT id FROM approvers WHERE email = ?');
        const insertPermission = db.prepare(`
            INSERT OR IGNORE INTO approver_permissions (approver_id, permission, granted_by)
            VALUES (?, ?, 'System – standardprofiler')
        `);
        for (const [email, permissions] of Object.entries(permissionSets)) {
            const approver = findApprover.get(email);
            for (const permission of permissions) insertPermission.run(approver.id, permission);
        }
    });

    migrate();
    console.log(`Database initialiseret: ${DB_PATH}`);
}

export default db;
