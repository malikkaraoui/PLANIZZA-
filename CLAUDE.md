# Instructions pour Claude

## Commits Git

- **NE JAMAIS ajouter de signature Co-Authored-By dans les commits**
- Les commits doivent être simples, sans signature

## Conventions du projet

- Langue des commits : Français avec aucun d'emojis
- Des phrases courtes et simples
- Routes pizzaiolo : `/pro/truck` est la page d'accueil du dashboard pro
- BackButton dans l'espace pro doit pointer vers `/pro/truck`

## Workflow Git (OBLIGATOIRE)

### Branches
- **main** : production uniquement. Ne JAMAIS push directement dessus.
- **dev** : integration. Tout le travail passe par dev avant main.
- **feature/xxx** ou **fix/xxx** : branches ephemeres (< 72h), mergees dans dev.

### Flux de travail
1. Creer une branche depuis dev : `feature/nom` ou `fix/nom`
2. Travailler et push sur cette branche
3. Merger dans dev (le workflow deploy un preview Firebase)
4. Quand dev est stable : PR dev -> main (deploy prod)

### IMPORTANT : Ne JAMAIS oublier
- Toujours travailler sur une branche feature/fix, jamais directement sur dev ou main
- Toujours push sur dev pour tester le build Firebase avant la prod

## Versioning (OBLIGATOIRE)

### Format : SemVer (MAJOR.MINOR.PATCH)
- **PATCH** (ex: 1.0.1) : bugfix, correction
- **MINOR** (ex: 1.1.0) : nouvelle feature, ajout de fonctionnalite
- **MAJOR** (ex: 2.0.0) : breaking change, refonte majeure

### Fichiers a mettre a jour a chaque release
1. **package.json** : champ `version`
2. **CHANGELOG.md** : ajouter l'entree de la nouvelle version

### Regles de bump
- Chaque `fix/` doit bumper le PATCH
- Chaque `feature/` doit bumper le MINOR
- Un breaking change bumpe le MAJOR
- Le bump se fait AVANT le merge dans main (dans la PR dev -> main)
- Taguer le commit de merge sur main : `git tag vX.Y.Z`

### RAPPEL AUTOMATIQUE
A chaque fin de tache (commit pret), Claude DOIT :
1. Verifier si la version dans package.json doit etre bumpee
2. Mettre a jour CHANGELOG.md avec les changements
3. Rappeler a l'utilisateur de pusher sur dev (pas main)
