# 🚀 Déploiement sur Vercel + Render

## ❓ Pourquoi cette configuration ?

Vercel ne supporte **pas les WebSockets persistants** (serverless functions). La solution est de :
- 🎨 **Frontend sur Vercel** (gratuit, CDN rapide mondial)
- 🔌 **Backend WebSocket sur Render** (gratuit aussi, supporte WebSockets)

---

## 📦 Étape 1 : Héberger le Backend sur Render

### 1.1 Créer un compte Render
Aller sur [https://render.com](https://render.com) et créer un compte gratuit.

### 1.2 Créer un Web Service
1. Cliquer sur **"New +"** → **"Web Service"**
2. Connecter votre repo GitHub
3. Configurer :
   - **Name** : `physique-3js-server` (ou autre)
   - **Environment** : `Node`
   - **Build Command** : (laisser vide)
   - **Start Command** : `node server.js`
   - **Plan** : `Free`

### 1.3 Variables d'environnement
Ajouter dans Render :
```
PORT=10000
```

### 1.4 Déployer
Cliquer sur **"Create Web Service"**. Render va déployer automatiquement.

### 1.5 Récupérer l'URL
Une fois déployé, vous aurez une URL comme :
```
https://physique-3js-server.onrender.com
```

---

## 🎨 Étape 2 : Héberger le Frontend sur Vercel

### 2.1 Modifier Voiture.js
Trouver cette ligne dans `Voiture.js` (ligne ~57) :
```javascript
const wsUrl = `${proto}://${window.location.hostname}:${window.location.port || 3000}`;
```

Remplacer par votre URL Render :
```javascript
// En production, utiliser Render pour WebSocket
const wsUrl = window.location.hostname === 'localhost' 
    ? `${proto}://localhost:3000`
    : `wss://physique-3js-server.onrender.com`; // <-- Votre URL Render ici
```

### 2.2 Créer vercel.json
Créer un fichier `vercel.json` à la racine :
```json
{
  "version": 2,
  "builds": [
    {
      "src": "**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```

### 2.3 Déployer sur Vercel
1. Aller sur [https://vercel.com](https://vercel.com)
2. Cliquer sur **"Import Project"**
3. Connecter votre repo GitHub
4. Laisser les paramètres par défaut
5. Cliquer sur **"Deploy"**

### 2.4 Récupérer l'URL
Vous aurez une URL comme :
```
https://physique-3js.vercel.app
```

---

## ✅ Étape 3 : Tester

1. Ouvrir votre URL Vercel dans un navigateur
2. Ouvrir la console (F12) pour voir les logs
3. Vérifier que la connexion WebSocket fonctionne
4. Inviter des amis à rejoindre !

---

## 🔧 Alternative : Tout sur Render

Si vous préférez tout héberger au même endroit :

### Configuration Render (Frontend + Backend)
```json
// render.yaml
services:
  - type: web
    name: physique-3js
    env: node
    buildCommand: echo "No build needed"
    startCommand: node server.js
    envVars:
      - key: PORT
        value: 10000
```

Render servira automatiquement les fichiers statiques ET le WebSocket.

---

## 💡 Autres alternatives gratuites

### Railway
- Supporte WebSockets
- $5 de crédit gratuit par mois
- Configuration similaire à Render

### Fly.io
- Supporte WebSockets
- Plan gratuit généreux
- Configuration avec Dockerfile

### Heroku
- Plan gratuit (avec limitations)
- Supporte WebSockets
- Configuration avec Procfile

---

## 📝 Checklist de déploiement

- [ ] Backend déployé sur Render
- [ ] URL WebSocket récupérée
- [ ] `Voiture.js` modifié avec la bonne URL
- [ ] Frontend déployé sur Vercel
- [ ] Test de connexion réussi
- [ ] Test multijoueur avec plusieurs navigateurs
- [ ] Partager le lien avec des amis !

---

## 🐛 Troubleshooting

### Le WebSocket ne se connecte pas
- Vérifier que l'URL dans `Voiture.js` est correcte
- Vérifier que le serveur Render est bien démarré
- Ouvrir la console pour voir les erreurs

### Le serveur Render s'endort
Le plan gratuit de Render met le serveur en veille après 15 min d'inactivité.
- Le premier joueur prendra ~30s à se connecter (réveil du serveur)
- Ensuite tout est normal

### Erreur CORS
Render et Vercel ne devraient pas avoir de problèmes CORS pour WebSocket.
Si problème, ajouter dans `server.js` :
```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
```

---

## 🎉 C'est tout !

Votre jeu est maintenant en ligne et accessible partout dans le monde ! 🌍
