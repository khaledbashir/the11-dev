# 🎯 EasyPanel Manual Configuration (Step-by-Step)

## Overview: What You're Creating

```
EasyPanel Dashboard
├── Service 1: mysql-database (MySQL 8.0)
├── Service 2: sow-backend (Python/FastAPI from backend/)
└── Service 3: sow-frontend (Node.js from frontend/) - ALREADY EXISTS
```

---

## ✅ STEP 1: Create MySQL Database Service

### 1A: Click "+ Service"
![Screenshot: Click green "+ Service" button in EasyPanel]

### 1B: Choose "Database" → "MySQL"
```
EasyPanel shows database template options
Select: MySQL (not MariaDB, not Postgres)
```

### 1C: Fill in the form:

```
┌─────────────────────────────────────────────────┐
│ Service Name *                                  │
│ [mysql-database                              ] │
│ (can be any name, this is for EasyPanel UI)     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Database Name *                                 │
│ [socialgarden_sow                            ] │
│ (this is your main database name)               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ User *                                          │
│ [sg_sow_user                                 ] │
│ (username to connect to database)               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Password                                        │
│ [SG_sow_2025_SecurePass!                     ] │
│ Leave empty to auto-generate (NOT recommended)  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Root Password                                   │
│ [root_secured_pass_123                       ] │
│ Leave empty to auto-generate (recommended)      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Docker Image                                    │
│ [mysql:8.0                                   ] │
│ (Official MySQL 8.0 - this is correct!)        │
└─────────────────────────────────────────────────┘
```

### 1D: Click "Create"

✅ **MySQL is now running!**

EasyPanel will show:
- Service Status: ✅ Running
- Connection Info (note these!)

---

## ✅ STEP 2: Create Backend Service

### 2A: Click "+ Service" again

### 2B: Choose "Docker"
```
You're creating from Git source (GitHub)
NOT from Docker Hub
```

### 2C: Fill in the Git source (see screenshot at top):

```
┌─────────────────────────────────────────────────┐
│ Source: [tabs] Upload  Github  Docker Image  Git │
│ Select: Github ← THIS ONE                       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Owner *                                         │
│ [khaledbashir                                ] │
│ (YOUR GitHub username)                          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Repository *                                    │
│ [the11-dev                                   ] │
│ (YOUR repo name)                                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Branch *                                        │
│ [backend-service                             ] │
│ (NEW BRANCH we just created!)                   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Build Path *                                    │
│ [/                                           ] │
│ (root of repo - this is correct)                │
└─────────────────────────────────────────────────┘

✅ Click "Save"
```

### 2D: Configure Service Details:

```
┌─────────────────────────────────────────────────┐
│ Service Name *                                  │
│ [sow-backend                                 ] │
│ (EasyPanel will use this as the hostname)       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Port *                                          │
│ [8000                                        ] │
│ (FastAPI runs on port 8000)                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Dockerfile *                                    │
│ [backend/Dockerfile                          ] │
│ (Path to the Dockerfile)                        │
└─────────────────────────────────────────────────┘
```

### 2E: Add Environment Variables:

Click "Environment" tab and add these variables:

```
┌─────────────────────────────────────────────────┐
│ Variables                                       │
├─────────────────────────────────────────────────┤
│ DB_HOST = mysql-database                        │
│ DB_PORT = 3306                                  │
│ DB_USER = sg_sow_user                           │
│ DB_PASSWORD = SG_sow_2025_SecurePass!           │
│ DB_NAME = socialgarden_sow                      │
│                                                 │
│ ANYTHINGLLM_URL = https://ahmad-anything-llm... │
│ ANYTHINGLLM_API_KEY = 0G0WTZ3-6ZX4D20-...      │
│                                                 │
│ GOOGLE_OAUTH_CLIENT_SECRET = GOCSPX-...        │
│ GOOGLE_OAUTH_REDIRECT_URI = https://sow...     │
└─────────────────────────────────────────────────┘
```

### 2F: Click "Deploy"

✅ **Backend is building and will be running soon!**

(First build takes 2-3 minutes while Docker builds the image)

---

## ✅ STEP 3: Update Frontend Service

### 3A: Go to existing "sow-frontend" service

Click on it in the Services list.

### 3B: Click "Edit" or "Environment"

### 3C: Update these environment variables:

**FIND THESE AND CHANGE:**

```
OLD:
DB_HOST=168.231.115.219

NEW:
DB_HOST=mysql-database
```

**ADD THESE IF MISSING:**

```
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
NEXT_PUBLIC_ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
NEXT_PUBLIC_PDF_SERVICE_URL=http://sow-backend:8000
```

**MAKE SURE THESE ARE PRESENT:**

```
DB_HOST=mysql-database
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow
NEXT_PUBLIC_BASE_URL=https://sow.qandu.me
NEXT_PUBLIC_API_URL=http://sow-frontend:3001
OPENROUTER_API_KEY=sk-or-v1-...
GOOGLE_OAUTH_CLIENT_ID=450525611451-...
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...
```

### 3D: Click "Deploy" or "Redeploy"

✅ **Frontend now points to EasyPanel MySQL!**

---

## 📋 Complete Checklist

After everything is deployed, verify:

- [ ] **MySQL Service** is ✅ Running
  - Access: `mysql-database:3306`
  - User: `sg_sow_user`
  - Database: `socialgarden_sow`

- [ ] **Backend Service** is ✅ Running
  - Access: `http://sow-backend:8000`
  - Health check: `GET /health`
  - Git branch: `backend-service`

- [ ] **Frontend Service** is ✅ Running
  - Access: `https://sow.qandu.me`
  - DB connection: `mysql-database:3306`
  - Backend connection: `http://sow-backend:8000`

---

## ✨ What Happened

```
Before:
Frontend → External DB (168.231.115.219)
Backend → External DB (168.231.115.219)

After:
Frontend → EasyPanel MySQL (mysql-database)
Backend → EasyPanel MySQL (mysql-database)
Frontend → EasyPanel Backend (sow-backend:8000)
```

**Everything is now on ONE EasyPanel dashboard!** 🎉

---

## 🆘 Troubleshooting

**MySQL container won't start?**
- Check if port 3306 is already in use
- Check EasyPanel logs for error messages
- Password might have special characters that need escaping

**Backend container build failed?**
- Check EasyPanel logs for error messages
- Verify `backend/Dockerfile` exists in the repo
- Check branch is `backend-service`

**Frontend can't connect to MySQL?**
- Verify `DB_HOST=mysql-database` is set
- Check MySQL service is running
- Try connecting from backend first to test

**Frontend can't connect to Backend?**
- Verify `NEXT_PUBLIC_PDF_SERVICE_URL=http://sow-backend:8000`
- Check backend service is running
- Restart frontend service

---

## 💾 Save Your Credentials

**KEEP THESE SAFE:**
```
Database Password: SG_sow_2025_SecurePass!
MySQL User: sg_sow_user
MySQL Database: socialgarden_sow
MySQL Host (EasyPanel): mysql-database
```

**Store in a password manager (LastPass, 1Password, etc.)**

---

## ✅ Done!

You now have:
✅ MySQL database on EasyPanel
✅ Backend service on EasyPanel (building from GitHub)
✅ Frontend service on EasyPanel (already there, now updated)
✅ Everything unified on ONE dashboard
✅ Everything version-controlled in GitHub
✅ Everything ready to scale!
