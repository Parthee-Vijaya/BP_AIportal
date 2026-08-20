# Beregningsregler og afklaringer

Dette dokument beskriver det regelsæt, som løsningen faktisk beregner efter.
Regelsættet har versions-id `2026-08-v2`, og versions-id'et gemmes på nye og
genberegnede timeregistreringer.

## Grundtimer og tillæg

- `normal_hours` er alle registrerede grundtimer og er derfor lig `total_hours`.
- Aften-, nat-, lørdags- og søn-/helligdagstimer er tillæg oven i grundtimerne.
- En arbejdet time kan højst udløse én af de fire tillægstyper.
- Begge klokkeslæt rundes op til nærmeste kvarter før beregningen.
- Et tidsrum kan krydse midnat, men skal være kortere end 24 timer.

| Kalender/tid | Tillæg |
| --- | --- |
| Mandag-fredag 00:00-06:00 | Nat |
| Mandag-fredag 06:00-17:00 | Intet tillæg |
| Mandag-fredag 17:00-23:00 | Aften |
| Mandag-fredag 23:00-24:00 | Nat |
| Lørdag 00:00-06:00 | Nat |
| Lørdag 06:00-08:00 | Intet tillæg |
| Lørdag 08:00-24:00 | Lørdag |
| Søndag og beregningshelligdag 00:00-24:00 | Søn-/helligdag |

Intervallerne er halvt åbne. Det betyder fx, at 17:00-18:00 giver præcis én
aftentillægstime.

## Beregningshelligdage

Motoren behandler følgende datoer som hele beregningshelligdage:

- 1. januar, 25. december og 26. december.
- Skærtorsdag, langfredag, påskedag, 2. påskedag, Kristi himmelfartsdag,
  pinsedag og 2. pinsedag.
- Aktive brugerdefinerede hele, delvise eller tilbagevendende helligdage.

Kalendarium.dk er den eksterne datakilde. Kun poster markeret som officielle
helligdage bruges automatisk i beregningen. Hvis API'et ikke svarer, anvendes det
samme deterministiske, lokalt beregnede sæt af officielle helligdage. Mærkedage
som 1. maj, grundlovsdag, juleaftensdag og nytårsaftensdag er kun information og
påvirker ikke beregningen, medmindre de oprettes som en brugerdefineret dag.
21. januar er ikke hardkodet. Store bededag indgår ikke fra 2024. En delvis
brugerdefineret helligdag erstatter det normale tillæg i sit tidsrum og giver
derfor ikke dobbelt tillæg.

## Bevillinger

- Forbruget opgøres pr. barn, ikke pr. barnepige.
- Afventende og godkendte timer tæller; afviste timer tæller ikke.
- Normal- og rammebevilling er adskilte puljer.
- Ekstrabevillinger lægges kun oven på rammebevillingen. Grundrammen forbruges
  først; derefter forbruges aktive ekstrabevillinger i tildelingsrækkefølge.
- En ekstrabevilling har en gyldighedsperiode, tildelingstidspunkt, tildeler,
  tildelte timer, brugte timer og resterende timer.
- Uge går fra mandag til søndag.
- Kvartal, halvår og år følger kalendergrænserne inklusivt.
- Måned er enten 1-31 eller en sammenhængende forskudt måned, fx 16-15.
- Specifikke ugedage har deres egen pulje pr. ugedag pr. uge.
- Alle kalenderberegninger er uafhængige af serverens tidszone.
- Timer afrundes til to decimaler før sammenligning, så flydende decimaltal ikke
  giver en falsk overskridelse.

## Afgrænsning

Overenskomst- og OPUS-lønartsregler er ikke en del af dette regelsæt. De
automatiske beregninger følger de beskrevne tidsvinduer, officielle helligdage
og bevillingspuljer.

## Automatisk kontrol

`npm test` kontrollerer blandt andet:

- alle 672 kvarterer i en repræsentativ uge;
- skift over midnat og kvartersafrunding;
- faste, bevægelige, delvise og tilbagevendende helligdage;
- uge-, måneds-, kvartals-, halvårs-, års- og ugedagsbevillinger;
- normal/ramme-puljer, ekstrabevillinger, statustælling og decimalgrænser;
- samme resultater i forskellige server-tidszoner.

`npm run recalculate:time-entries` viser afvigelser uden at ændre data.
`npm run recalculate:time-entries -- --apply` genberegner og skriver et auditspor.
