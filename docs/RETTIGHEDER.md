# Roller og rettigheder

Løsningen har tre brugerroller:

1. **Barnepige** kan indberette timer og se egne registreringer samt status.
2. **Godkender** kan se samlet overblik, godkende eller afvise timer, trække
   rapporter og administrere grund-, ramme- og ekstrabevillinger.
3. **Administrator** har fuld adgang til alle godkenderfunktioner, stamdata,
   helligdage, beregningsindstillinger samt roller og rettigheder.

Alle godkendere har følgende faste kernerettigheder:

- overblik og godkend/afvis;
- `export_reports`: filtrer rapporter og hent Excel;
- `manage_grants`: rediger grund- og rammebevilling samt tildel, rediger og
  slet tidsafgrænsede ekstrabevillinger.

Følgende ekstra rettigheder kan tildeles en individuel godkender:

- `manage_children`: administrer børns stamdata og relationer til barnepiger;
- `manage_caregivers`: administrer barnepiger;
- `manage_holidays`: opret, ret og slet brugerdefinerede helligdage;
- `manage_settings`: ret beregningsindstillinger som månedsinterval.

`manage_permissions` er forbeholdt administratorrollen og giver adgang til at
oprette profiler, vælge rolle og tildele ekstra rettigheder.

Mindst én aktiv administrator skal altid være tilbage. Administratoren får
alle rettigheder via rollen, mens godkenderens faste rettigheder samles med de
individuelt tildelte rettigheder. Menuer, frontend-ruter og API-handlinger
kontrollerer den samme effektive adgang.

Den nuværende profilvælger er en demo-erstatning for login. Ved senere login
skal profil-id og rolle komme fra den validerede serversession i stedet for
`X-Approver-Id`/`approver_id` fra klienten. Rettighedsmodellen og databasen kan
genbruges uændret.
