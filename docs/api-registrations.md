# API Registrations — État d'avancement

Dernière mise à jour : 2026-05-13

---

## 1. pawaPay (Paiements Mobile Money)

**Statut** : ✅ Formulaire KYC soumis — en attente de review

### Ce qui a été fait
- [x] Step 1 — Business Info : Hello Consulting, Gabon, RCCM `GA-LBV-01-2026-A10-01738`, NIF `20262006137-B`
- [x] Step 2 — Business Details : rempli
- [x] Step 3 — Business Activity : ride-hailing, None of the above, disbursements = Yes
- [x] Step 4 — Company Address : Alibandeng A IGADE, Libreville, Estuaire, 001
- [x] Step 5 — Documents : hellodriver.pdf (ANPI) + RCCM (2.jpeg) uploadés (warning "expired" ignoré)
- [x] Step 6 — Related Persons : BIAM WORA Patrick Ronny, 100%, Director + Beneficial Owner + Controlling Person
- [ ] Step 7 — Related company : à vérifier/compléter

### Prochaine action
- Attendre email de confirmation pawaPay
- Si bloqué → contacter support pawaPay avec référence du dossier

---

## 2. Meta WhatsApp Cloud API

**Statut** : 🟡 En cours — vérification d'entreprise Meta en attente

### Ce qui a été fait
- [x] Meta App créée : ID `1591985595187598` sur developers.facebook.com
- [x] Business Portfolio créé : **Hello Consulting** (ID `1303312524945364`)
- [x] Business details corrigés : Legal name = `Hello Consulting` (pas HelloDriver)
- [x] Adresse : Libreville, 001, Estuaire, Gabon
- [x] Phone : +24166749669
- [x] Website : https://hellodriver-main.fly.dev/
- [x] Document uploadé pour vérification : RCCM (type = Business Registration or License Document)
- [ ] Vérification Meta en attente d'approbation (statut actuel : **Unverified**)

### Bloquant actuel
- WABA (WhatsApp Business Account) restreinte tant que le business n'est pas vérifié
- Erreur : `2655121 - account is currently restricted`

### Prochaine action quand la vérification est approuvée
1. Retourner sur developers.facebook.com → app `1591985595187598`
2. WhatsApp → Getting Started → **Step 1 Try it out**
3. Récupérer `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN`
4. **Step 2 Production setup** → ajouter vrai numéro gabonais dédié (+241...)
5. Configurer Webhook :
   - URL : `https://hellodriver-main.fly.dev/agent/webhook`
   - Verify Token : à définir (ex: `hellodriver_webhook_2026`)
6. Ajouter secrets dans Fly.io :
   ```
   WHATSAPP_PHONE_NUMBER_ID=xxx
   WHATSAPP_ACCESS_TOKEN=xxx
   META_WEBHOOK_VERIFY_TOKEN=hellodriver_webhook_2026
   META_WEBHOOK_SECRET=xxx
   ```

### Note importante
- Il faut un **numéro de téléphone dédié** pour WhatsApp Business (ne peut pas être utilisé sur WhatsApp personnel)
- Prévoir un numéro gabonais ou international non lié à un compte WhatsApp existant

---

## 3. D7 Networks (SMS OTP) — Non commencé

**Statut** : ⏸️ Pas encore démarré

- Actuellement : OTP loggué en console uniquement (mode dev)
- À faire : créer compte sur d7networks.com, récupérer `D7_NETWORKS_API_KEY`
- Mettre dans Fly.io secrets + changer `SMS_PROVIDER=d7` dans config

---

## Secrets à ajouter dans Fly.io une fois tout débloqué

```bash
flyctl secrets set \
  WHATSAPP_PHONE_NUMBER_ID=xxx \
  WHATSAPP_ACCESS_TOKEN=xxx \
  META_WEBHOOK_VERIFY_TOKEN=xxx \
  META_WEBHOOK_SECRET=xxx \
  D7_NETWORKS_API_KEY=xxx \
  --app hellodriver-main
```
