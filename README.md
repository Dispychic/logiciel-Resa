# Dipsy Tables

Plan de salle et réservations, avec passerelle vers [Dipsy Caisse](https://steven77726.github.io/DIPSY-CAISSE/).

**Ne pas effacer les données des anciens navigateurs.** À la demande du propriétaire, l’accès est libre : aucune connexion n’est nécessaire. Chaque appareil sauvegarde sa copie locale d’origine puis réunit les réservations par UUID avec Supabase. Les versions différentes du même UUID exigent un choix explicite ; aucun rapprochement par nom. « Copie de secours » télécharge la copie conservée. Le bouton CAISSE attend la confirmation du serveur.

**Articles & prix** ouvre la fiche complète : nom, référence, prix TTC, TVA, catégorie, groupe comptable et disponibilité. **ARTICLES** sur une réservation permet de corriger son ticket avant le premier règlement. Les changements sont versionnés et journalisés ; les anciennes additions ne sont pas recalculées par une modification de la carte.

**Vert = réglée ; rouge clair = non réglée ou partielle**, avec le restant dû. Le statut utilise le solde confirmé et le `reservation_id`, jamais le nom. Hors ligne ou sans confirmation récente, le statut devient « Paiement à vérifier ».

Le serveur partagé est le projet Supabase `wseewiaaygyzkalpslee`. La source de vérité est l’état Dipsy Tables versionné, avec une projection de réservations par UUID. Les clés `dipsy-simple-festif-v1`, `dispychico-plan-history-v1` et les réglages de tables existants restent utilisés pour conserver les copies locales. L’ancienne synchronisation anonyme vers `vkkkpijncevbwzvopctp` est retirée ; aucun de ses enregistrements n’est supprimé par ce code.

La fiche caisse utilise uniquement `reservation_id`, jamais le nom. La session entre onglets utilise des messages contrôlés par origine, fenêtre et nonce ; aucun jeton n’est placé dans le lien. Les modifications concurrentes nécessitent une comparaison explicite.

## Développement

Node.js 24 : `npm ci`, `npm test`, `npm run build`. Le fichier `reservation-bridge.js` est le bundle produit à partir de `bridge-entry.js` et `migration.mjs`, avec des versions épinglées. Le fichier est versionné pour conserver la publication GitHub Pages existante depuis la racine de `main`. Le ZIP historique est conservé sans modification.

La migration SQL et le [guide complet](https://github.com/Steven77726/DIPSY-CAISSE/blob/main/docs/RESERVATION-BRIDGE.md) sont versionnés dans le dépôt Caisse. La base de données ne se modifie pas lors d’un simple déploiement Pages.
