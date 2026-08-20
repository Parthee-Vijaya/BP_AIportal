# Roller og rettigheder

Løsningen har to brugerroller:

1. **Barnepige** kan indberette timer og se egne registreringer samt status.
2. **Godkender** kan se samlet overblik og godkende eller afvise timer.

Alle godkendere har de samme to kernerettigheder. Følgende administrative
rettigheder kan tildeles individuelt:

- `export_reports`: træk rapporter.
- `manage_children`: administrer børn, bevillinger og ekstrabevillinger.
- `manage_caregivers`: administrer barnepiger.
- `manage_holidays`: opret, ret og slet brugerdefinerede helligdage.
- `manage_settings`: ret beregningsindstillinger som månedsinterval.
- `manage_permissions`: opret godkendere og tildel rettigheder.

Mindst én aktiv godkender skal altid have `manage_permissions`. Menuer og
frontend-ruter følger den valgte profils rettigheder, og administrative
API-handlinger kontrollerer samme rettighed i backend.

Den nuværende profilvælger er en demo-erstatning for login. Ved senere login
skal godkender-id'et komme fra den validerede serversession i stedet for
`X-Approver-Id`/`approver_id` fra klienten. Rettighedsmodellen og databasen kan
genbruges uændret.
