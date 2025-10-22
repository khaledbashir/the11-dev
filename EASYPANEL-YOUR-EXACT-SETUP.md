# 🎯 YOUR EASYPANEL MANUAL SETUP - READY TO GO

## What You Need to Do (3 Steps)

---

## ✅ STEP 1: Create MySQL Database on EasyPanel

**Click: "+ Service" → "Database" → "MySQL"**

### Fill in these exact values:

```
Service Name:    mysql-database
Database Name:   socialgarden_sow
User:            sg_sow_user
Password:        SG_sow_2025_SecurePass!
Root Password:   (leave empty for auto-generate)
Docker Image:    mysql:8.0
```

**Then click "Create"**

✅ **MySQL is now running!**

---

## ✅ STEP 2: Create Backend Service on EasyPanel

**Click: "+ Service" → "Docker" → "GitHub"**

### Git Configuration:

```
Owner:           khaledbashir
Repository:      the11-dev
Branch:          backend-service
Build Path:      /
```

Click "Save"

### Service Configuration:

```
Service Name:    sow-backend
Port:            8000
Dockerfile:      backend/Dockerfile
```

### Environment Variables (Add ALL of these):

```
DB_HOST=mysql-database
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow

ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA

GOOGLE_OAUTH_REDIRECT_URI=https://sow.qandu.me/api/oauth/callback
```

**Then click "Deploy"**

✅ **Backend is building! (takes 2-3 minutes)**

---

## ✅ STEP 3: Update Frontend Service on EasyPanel

**Click: Your existing "sow-frontend" service → Edit**

### Environment Variables - UPDATE THESE:

```
FIND THIS:
DB_HOST=168.231.115.219

CHANGE TO:
DB_HOST=mysql-database
```

### ADD THESE IF MISSING:

```
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
NEXT_PUBLIC_ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
NEXT_PUBLIC_PDF_SERVICE_URL=http://sow-backend:8000

DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow

NEXT_PUBLIC_BASE_URL=https://sow.qandu.me
NEXT_PUBLIC_API_URL=http://sow-frontend:3001
```

**Then click "Deploy" or "Redeploy"**

✅ **Frontend is now updated!**

---

## 📋 Credentials to Keep Safe

Save these in a password manager (LastPass, 1Password, etc.):

```
MySQL Database
├─ Host: mysql-database (or your-instance.easypanel.host)
├─ Port: 3306
├─ Database: socialgarden_sow
├─ User: sg_sow_user
└─ Password: SG_sow_2025_SecurePass!

Backend Service
├─ Name: sow-backend
├─ Port: 8000
├─ Dockerfile: backend/Dockerfile
└─ Branch: backend-service

Frontend Service
├─ Name: sow-frontend
├─ Port: 3001
├─ URL: https://sow.qandu.me
└─ Connected to: mysql-database + sow-backend
```

---

## ✨ After Everything is Deployed

All three services will be running:

```
✅ mysql-database    → Running on port 3306
✅ sow-backend       → Running on port 8000
✅ sow-frontend      → Running on https://sow.qandu.me
```

**Everything is now on ONE EasyPanel dashboard!** 🎉

---

## 🔍 How to Check If It's Working

### Test MySQL:
- Go to sow-frontend
- Should NOT have `/undefined/` errors
- Workspace creation should work

### Test Backend:
- Go to https://sow.qandu.me/api/health
- Should return 200 OK (PDF service running)

### Test Full System:
- Create a new workspace
- Edit a SOW
- Export to PDF (tests backend connection)
- Should work smoothly!

---

## ❓ Common Issues

**MySQL won't start?**
- Check port 3306 isn't in use
- Check password has no special characters that need escaping

**Backend won't build?**
- Check EasyPanel logs
- Verify branch is `backend-service`
- Verify `backend/Dockerfile` exists

**Frontend can't connect?**
- Hard refresh browser (Ctrl+F5)
- Check `DB_HOST=mysql-database` is set
- Check `NEXT_PUBLIC_PDF_SERVICE_URL=http://sow-backend:8000`

---

## 📞 After You're Done

Tell me:
1. ✅ MySQL is running
2. ✅ Backend is running
3. ✅ Frontend is updated

And I'll:
- Verify the configuration is correct
- Fix any remaining issues
- Push final updates to GitHub
- Celebrate the unified system! 🎊

---

**You've got this! 🚀**
