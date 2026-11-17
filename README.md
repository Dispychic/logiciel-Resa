# Dipsy Tables

Plan de salle et réservations, avec passerelle authentifiée vers [Dipsy Caisse](https://steven77726.github.io/DIPSY-CAISSE/).

**Ne pas effacer les données des anciens navigateurs.** Chaque appareil contenant des réservations doit passer par **Connexion sécurisée → Préparer la migration** sur [l’URL habituelle](https://dispychic.github.io/logiciel-Resa/). La migration est réservée à l’administrateur, conserve les UUID, prépare une copie de secours et demande de résoudre les différences avant confirmation. Le bouton CAISSE s’active après confirmation serveur. Le choix Steven/Naty ne remplace pas l’authentification.

Le serveur partagé est le projet Supabase `wseewiaaygyzkalpslee`. La source de vérité est l’état Dipsy Tables versionné, avec une projection de réservations par UUID. Les clés `dipsy-simple-festif-v1`, `dispychico-plan-history-v1` et les réglages de tables existants restent utilisés pour conserver les copies locales. L’ancienne synchronisation anonyme vers `vkkkpijncevbwzvopctp` est retirée ; aucun de ses enregistrements n’est supprimé par ce code.

La fiche caisse utilise uniquement `reservation_id`, jamais le nom. La session entre onglets utilise des messages contrôlés par origine, fenêtre et nonce ; aucun jeton n’est placé dans le lien. Les modifications concurrentes nécessitent une comparaison explicite.

## Développement

Node.js 24 : `npm ci`, `npm test`, `npm run build`. Le fichier `reservation-bridge.js` est le bundle produit à partir de `bridge-entry.js` et `migration.mjs`, avec des versions épinglées. Le fichier est versionné pour conserver la publication GitHub Pages existante depuis la racine de `main`. Le ZIP historique est conservé sans modification.

La migration SQL et le [guide complet](https://github.com/Steven77726/DIPSY-CAISSE/blob/main/docs/RESERVATION-BRIDGE.md) sont versionnés dans le dépôt Caisse. La base de données ne se modifie pas lors d’un simple déploiement Pages.
