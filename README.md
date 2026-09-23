# Phare

Ton assistant vocal personnel en 3D, façon Jarvis, en français.
Une sphère holographique cyan, avec un cœur de lumière et des traînées liquides en orbite, qui respire, t'écoute, réfléchit et te répond à voix haute. Autour d'elle, tes conversations flottent comme des bulles reliées au cœur.

![Le monde de Phare : la spirale des conversations à travers les portails](docs/apercu.png)

- **Veille** : le cœur respire lentement, les traînées dérivent.
- **Écoute** : la forme autour du cœur ondule et les traînées s'écartent au volume de ta voix.
- **Réflexion** : un faisceau lumineux balaie la sphère, les traînées accélèrent, une étincelle file vers la conversation en cours.
- **Parole** : la sphère pulse au rythme de la voix de Phare.

---

## Version en ligne (sans rien installer)

Phare est aussi publié comme page privée sur claude.ai : <https://claude.ai/artifact/PhfKL2JYjaafKBrbUvoBPC>

- Ouvre le lien en étant connecté à ton compte claude.ai. À la première question, claude.ai te demande d'autoriser Phare à utiliser Claude : accepte.
- Les réponses sont comptées sur ton abonnement claude.ai, pas sur une clé API.
- Tes conversations sont enregistrées dans un espace privé de la page, que personne d'autre ne peut lire.
- **Limite :** claude.ai bloque le micro dans ses pages. En ligne, tu **écris** à Phare et il te **répond à voix haute**. Pour lui parler, utilise la version installée ci-dessous.

Pour republier la page après une modification : `npm run build:claude`, qui fabrique `dist-claude/phare.html`.

---

## Installation pas à pas

Compte 10 minutes la première fois. Tout se fait dans le **Terminal** (Mac) ou **PowerShell** (Windows).

### 1. Installer Node.js (une seule fois)

Va sur <https://nodejs.org>, télécharge la version **LTS** et installe-la comme n'importe quel logiciel.
Pour vérifier, ouvre un terminal et tape :

```bash
node -v
```

Tu dois voir un numéro comme `v22.x.x` (au moins 20).

### 2. Récupérer une clé API Anthropic (une seule fois)

1. Crée un compte sur <https://console.anthropic.com>.
2. Ajoute un peu de crédit (menu *Billing*). Quelques euros suffisent pour des semaines d'usage.
3. Menu *API Keys* → *Create Key*. Copie la clé (elle commence par `sk-ant-`). Garde-la pour toi.

### 3. Télécharger Phare

Sur la page GitHub du projet, choisis la branche `claude/phare-voice-assistant-3d-m0rdcc` (menu déroulant en haut à gauche), puis bouton vert **Code** → **Download ZIP**, et dézippe le dossier.
(Ou, si tu connais git : `git clone` puis `git checkout claude/phare-voice-assistant-3d-m0rdcc`.)

Dans le terminal, place-toi dans le dossier. Le plus simple : tape `cd ` (avec l'espace), puis glisse le dossier dans la fenêtre du terminal et appuie sur Entrée.

### 4. Installer les dépendances (une seule fois)

```bash
npm install
```

### 5. Enregistrer ta clé API (une seule fois)

```bash
npm run setup
```

Colle ta clé quand on te la demande, puis Entrée. Ça crée le fichier `.env` tout seul.
Ce fichier reste sur ton ordinateur : la clé n'est jamais envoyée au navigateur, et il est exclu de git.

> Évite de créer `.env` à la main avec TextEdit ou le Bloc-notes : ils le renomment souvent en `.env.rtf` ou `.env.txt` sans le dire, et Phare ne trouve plus la clé.

### 6. Lancer Phare

```bash
npm run dev
```

Le terminal affiche deux types de lignes, `[serveur]` et `[site]`. **Laisse cette fenêtre ouverte** tant que tu utilises Phare.

Ouvre **Google Chrome** sur <http://localhost:5173>. La première fois, Chrome demande l'accès au micro : clique sur **Autoriser**.

Si quelque chose cloche, un message rouge sous la sphère te dit quoi faire.

Pour arrêter : `Ctrl + C` dans le terminal. Pour relancer plus tard : seulement l'étape 6.

---

## Utilisation

| Action | Ordinateur | Téléphone |
| --- | --- | --- |
| Parler | Maintiens la **barre espace** (ou le bouton micro) pendant que tu parles, relâche à la fin | Maintiens le bouton micro |
| Parler sans maintenir | Un appui court : Phare écoute jusqu'à ce que tu te taises | Pareil |
| Mot d'activation | Active **« Phare »**, puis dis « Phare, quel temps pour une coupure à Deauville ? » | Pareil |
| Écrire au lieu de parler | Champ « Ou écris à Phare… », puis Entrée | Pareil |
| Couper Phare | **Échap** ou le bouton **Couper** | Bouton **Couper** |
| Repartir de zéro | **Nouvelle conv.** | Pareil |

Tu peux aussi couper Phare en reprenant la parole : appuie sur le micro pendant qu'il parle.

### Mémoire et bulles de conversation

Toutes les conversations sont enregistrées dans `data/conversations.json`, sur ton ordinateur.
Phare se souvient des 30 derniers messages de la conversation en cours. **Nouvelle conv.** démarre une page blanche (l'ancienne reste dans le fichier).

Tes 12 dernières conversations sont des bulles dans le monde, de la plus récente (près de Phare) à la plus ancienne (au loin). La bulle au-dessus de Phare, avec un fil en pointillés, est la conversation en cours.
- Les conversations proches affichent leur sujet et leur date ; approche-toi des autres pour les lire.
- Clique sur une bulle : tu voles jusqu'à elle, et le bouton **Reprendre** permet de la continuer là où tu t'étais arrêté.
- Au clavier : `Tab` passe d'une bulle à l'autre, `Entrée` l'ouvre.

### Se déplacer dans le monde

Phare vit dans un espace 3D que tu peux explorer. Tes conversations forment une spirale qui s'enfonce dans la profondeur : **plus tu avances, plus tu remontes dans le temps**. Un fil lumineux relie chaque conversation à Phare, et un fil en pointillés les relie dans l'ordre.

| Action | Ordinateur | Téléphone |
| --- | --- | --- |
| Regarder autour | Glisser avec la souris | Glisser avec un doigt |
| Avancer, reculer, pas de côté | `Z` `Q` `S` `D` ou les flèches | Joystick en bas à gauche |
| Foncer | Molette | Pincer / écarter deux doigts |
| Monter, descendre | `E` / `A` | |
| Courir | `Maj` maintenue | |
| Aller à une conversation | Clic sur la bulle ou son étiquette | Toucher la bulle |
| Revenir devant Phare | Bouton **Revenir à Phare** | Pareil |

### Aperçu des animations

Pour voir chaque état sans parler, ajoute à l'adresse :
`?etat=veille`, `?etat=ecoute`, `?etat=reflexion` ou `?etat=parole`
(par exemple <http://localhost:5173/?etat=reflexion>).

### Réduire les animations

Si l'option système « Réduire les animations » est activée (macOS, Windows, Android, iOS), Phare bouge beaucoup moins : pas de mouvement de caméra, faisceau lent, pulsations adoucies.

---

## Sur le téléphone

Chrome n'autorise le micro que sur une page sécurisée (https). Pour tester sur ton téléphone Android :

1. Ordinateur et téléphone sur **le même Wi‑Fi**.
2. Lance :
   ```bash
   npm run dev:mobile
   ```
3. Le terminal affiche une ligne `Network: https://192.168.x.x:5173`. Ouvre cette adresse dans Chrome sur le téléphone.
4. Chrome affiche un avertissement de sécurité (certificat local) : **Paramètres avancés → Continuer**. C'est normal, c'est ton propre ordinateur.

Incline le téléphone : la caméra suit le mouvement.

Sur iPhone, Safari et Chrome ne proposent pas (encore) la reconnaissance vocale de façon fiable : Phare est pensé pour Chrome ordinateur et Chrome Android.

---

## En cas de souci

| Problème | Solution |
| --- | --- |
| « Il manque la clé API » | Lance `npm run setup` (étape 5), puis `npm run dev`. |
| « Ma clé API est refusée » | La clé est mal copiée (relance `npm run setup`), ou le compte n'a pas de crédit. |
| « Le serveur de Phare ne répond pas » | Le terminal a été fermé ou `npm run dev` n'est pas lancé. |
| « Node.js … est trop ancien » | Installe la version LTS depuis <https://nodejs.org>. |
| `npm` : commande introuvable | Node.js n'est pas installé (étape 1). Ferme et rouvre le terminal après l'installation. |
| Page blanche ou sphère absente | Mets Chrome à jour. Vérifie que l'accélération matérielle est active (Paramètres → Système). |
| Rien ne se passe quand je parle | Essaie d'écrire une question dans le champ texte : si Phare répond, c'est le micro (voir ligne suivante). |
| « Le micro est bloqué » | Clique sur l'icône à gauche de l'adresse dans Chrome → Micro → Autoriser, puis recharge. |
| Phare n'a pas de voix française | Chrome utilise les voix du système. Sur Windows : Paramètres → Heure et langue → Voix → ajoute Français. |
| Le mot « Phare » n'est pas reconnu | Parle distinctement, marque une mini pause après « Phare ». « Far » fonctionne aussi. |

---

## Bon à savoir (vie privée)

- La reconnaissance vocale de Chrome envoie l'audio aux serveurs de Google pour le transcrire. C'est le cas pour tous les sites qui l'utilisent.
- En mode mot d'activation, Chrome écoute en continu tant que l'onglet est ouvert. Sur Android, un petit bip peut retentir quand l'écoute redémarre.
- Tes questions et les réponses passent par l'API Anthropic (modèle `claude-sonnet-5`) et l'historique est stocké uniquement dans `data/` sur ton ordinateur.

---

## Comment c'est construit

```
server/            petit serveur Node/Express (garde la clé API)
  index.ts         route /api/chat : envoie la question à Claude et renvoie la réponse en flux
  memory.ts        historique des conversations dans data/conversations.json
shared/
  prompt.ts        la personnalité de Phare (commune au serveur et à la version en ligne)
scripts/
  setup.mjs        npm run setup : enregistre la clé API dans .env
  check.mjs        vérifications automatiques avant npm run dev
  build-claude.mjs npm run build:claude : fabrique la version en ligne (un seul fichier HTML)
src/
  backend/         d'où viennent les réponses : serveur local (server.ts) ou claude.ai (claude.ts)
  App.tsx          l'interface (boutons, sous-titres, clavier)
  scene/           le monde 3D (react-three-fiber) : Hologram (sphère, cœur, traînées),
                   World (sol, poussière, portails), Navigator + NavControls (déplacements, joystick),
                   ConversationNodes + NodeLabels (spirale du temps), Scene (bloom)
  voice/           la voix : reconnaissance (Web Speech API), mot d'activation,
                   synthèse vocale phrase par phrase, analyse du micro (AnalyserNode)
```

La réponse arrive en flux : Phare commence à parler dès la première phrase reçue, sans attendre la fin.

## Feuille de route

- [x] **Phase 1** : sphère holographique 3D animée, bulles de conversation, voix (appuyer pour parler + mot d'activation), réponses parlées, mémoire locale.
- [ ] **Phase 2** : connexion Gmail et Google Agenda (OAuth Google). Avant tout envoi de mail ou modification d'agenda, Phare lit à voix haute ce qu'il va faire et attend ta confirmation vocale.
