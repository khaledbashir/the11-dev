# 🚀 UNIFIED DEPLOYMENT: Everything on EasyPanel (October 22, 2025)

## The Problem You Had

**OLD (BAD ❌)**:
- Frontend on GitHub → EasyPanel
- Backend somewhere → DockerHub
- Database external on 168.231.115.219
- Everything scattered, hard to manage

**NEW (GOOD ✅)**:
- ONE GitHub repo (`the11-dev`)
- THREE services on ONE EasyPanel dashboard
- Database containerized (MySQL service)
- Everything unified!

---

## ONE GitHub Repo: Everything Unified

```
the11-dev/ (GitHub)
├── frontend/                ← Next.js app
│   ├── app/
│   ├── lib/
│   ├── package.json
│   └── pnpm-lock.yaml
├── backend/                 ← Python FastAPI
│   ├── main.py
│   ├── routes/
│   ├── requirements.txt
│   └── Dockerfile           ← Backend image
├── database/                ← SQL schemas
│   ├── schema.sql           ← AUTO-LOADED by MySQL service
│   └── migrations/
├── Dockerfile               ← Frontend image
├── docker-compose.yml       ← Local dev (has MySQL!)
└── README.md
```

**DON'T CREATE SEPARATE REPOS!** Just one repo with everything.

---

## 🎯 Step-by-Step: Deploy ALL 3 Services on EasyPanel

### Prerequisites
- GitHub account with `the11-dev` repo
- EasyPanel account (you already have it)
- Docker Hub account (optional, not needed if EasyPanel builds from Git)

---

## ✅ Step 1: Update Frontend Code

Already done! Your `frontend/` folder is ready.

**Make sure in EasyPanel environment**:
```env
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
NEXT_PUBLIC_ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
DB_HOST=database          ← CHANGE THIS (was 168.231.115.219)
DB_USER=sg_sow_user
DB_PASSWORD=SecurePass123!
DB_NAME=socialgarden_sow
```

---

## ✅ Step 2: Update Backend Code

Your `backend/` folder has FastAPI code + Dockerfile ready.

**No code changes needed**, just deploy!

---

## ✅ Step 3: MySQL Database Service

**NEW! Now containerized!**

Docker image: `mysql:8.0`

The `database/schema.sql` is **AUTO-LOADED** when container starts.

---

## 📱 Deployment Instructions (EasyPanel)

### Overview: 3 Services to Deploy

```
EasyPanel Dashboard
├── Service 1: Frontend (Node.js)     [from GitHub: frontend/]
├── Service 2: Backend (Docker)       [from GitHub: backend/, Dockerfile: backend/Dockerfile]
└── Service 3: MySQL Database         [Docker image: mysql:8.0]
```

All three talk to each other internally. Frontend connects to both Backend and MySQL.

---

## 🔧 Option A: EasyPanel Docker Compose (EASIEST ✅)

EasyPanel supports deploying entire `docker-compose.yml` files!

### Steps:

1. **Go to EasyPanel**: https://control.easypanel.io
2. **Click on your project** (ahmad/sow-qandu-me)
3. **Click "+ Service"**
4. **Choose "Docker Compose"**
5. **Paste this entire compose file**:
   ```yaml
   # Copy entire contents of docker-compose.yml from GitHub
   ```
6. **Set Environment Variables** in EasyPanel UI:
   ```
   DB_USER=sg_sow_user
   DB_PASSWORD=SecurePass123!
   DB_NAME=socialgarden_sow
   NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
   NEXT_PUBLIC_ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
   ```
7. **Click Deploy**

✅ **Done!** All 3 services up and running!

---

## 🔧 Option B: Deploy Services Individually (MORE WORK)

If EasyPanel doesn't support Docker Compose:

### Service 1: MySQL Database

1. **Go to EasyPanel → + Service**
2. **Choose "Docker" (NOT Git)**
3. **Configure**:
   - Image: `mysql:8.0`
   - Port: `3306`
   - Environment:
     ```
     MYSQL_ROOT_PASSWORD=root_password
     MYSQL_DATABASE=socialgarden_sow
     MYSQL_USER=sg_sow_user
     MYSQL_PASSWORD=SecurePass123!
     ```
   - Volume: `/var/lib/mysql` (persistent storage)
4. **Deploy**

### Service 2: Backend (FastAPI)

1. **Go to EasyPanel → + Service**
2. **Choose "Docker"**
3. **Configure**:
   - Repository: `https://github.com/khaledbashir/the11-dev.git`
   - Dockerfile path: `backend/Dockerfile`
   - Build context: `.`
   - Port: `8000`
   - Environment:
     ```
     DB_HOST=mysql-container-name
     DB_USER=sg_sow_user
     DB_PASSWORD=SecurePass123!
     DB_NAME=socialgarden_sow
     ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
     ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
     ```
4. **Deploy**

### Service 3: Frontend (Next.js)

1. **Go to EasyPanel → + Service**
2. **Choose "Node.js"** (NOT Docker)
3. **Configure**:
   - Repository: `https://github.com/khaledbashir/the11-dev.git`
   - Build command: `cd frontend && pnpm install && pnpm build`
   - Start command: `cd frontend && pnpm start`
   - Port: `3001`
   - Environment:
     ```
     NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
     NEXT_PUBLIC_ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
     DB_HOST=mysql-container-name
     DB_USER=sg_sow_user
     DB_PASSWORD=SecurePass123!
     DB_NAME=socialgarden_sow
     ```
4. **Deploy**

---

## 🎯 Why This is Better

| Old Setup | New Setup |
|-----------|-----------|
| Frontend on GitHub | Frontend in GitHub ✅ |
| Backend on DockerHub | Backend in GitHub ✅ |
| Database external (fragile) | Database containerized (better) ✅ |
| Multiple places to manage | ONE EasyPanel dashboard ✅ |
| Hard to version | Everything versioned in Git ✅ |
| Data lost if server crashes | Data persisted in volume ✅ |

---

## 📊 Architecture (After Migration)

```
┌───────────────────────────────────────────────────────────┐
│                    EasyPanel Dashboard                    │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Service: sow-frontend (Node.js)                     │ │
│  │ ├─ Repo: the11-dev (GitHub)                         │ │
│  │ ├─ Port: 3001                                       │ │
│  │ ├─ URL: https://sow.qandu.me                        │ │
│  │ └─ Connects to: database + backend                  │ │
│  └─────────────────────────────────────────────────────┘ │
│                          ↓ HTTP                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Service: sow-backend (Docker, Python/FastAPI)       │ │
│  │ ├─ Repo: the11-dev (GitHub)                         │ │
│  │ ├─ Dockerfile: backend/Dockerfile                   │ │
│  │ ├─ Port: 8000                                       │ │
│  │ └─ Connects to: database                            │ │
│  └─────────────────────────────────────────────────────┘ │
│                          ↓ SQL                             │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Service: mysql-database (Docker, MySQL 8.0)         │ │
│  │ ├─ Image: mysql:8.0                                 │ │
│  │ ├─ Schema auto-loaded: database/schema.sql          │ │
│  │ ├─ Port: 3306 (internal only)                       │ │
│  │ └─ Volume: Persistent /var/lib/mysql/               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 🔄 Update Data Flows (After Migration)

### Creating a SOW:
```
1. User creates SOW in editor
2. Frontend: POST /api/sow/create (to own backend)
3. Backend: INSERT INTO sows (to own MySQL)
4. Frontend: POST /api/anythingllm/* (to external AnythingLLM)
```

### Exporting PDF:
```
1. User clicks "Export PDF"
2. Frontend: POST /api/generate-pdf
3. Backend: WeasyPrint renders PDF
4. Frontend: Downloads PDF
```

**No more external database calls!** Everything internal to EasyPanel.

---

## ✨ Benefits

✅ **Single Dashboard**: Manage all 3 services from EasyPanel UI
✅ **Single GitHub Repo**: Everything version-controlled
✅ **Automatic Deployments**: `git push` → all services update
✅ **Persistent Data**: MySQL volume survives restarts
✅ **No External Dependencies**: Database not on external server
✅ **Easy Scaling**: Can add more backend instances if needed
✅ **Easy Backup**: MySQL data is in a volume, easy to backup
✅ **Team-Friendly**: Anyone can deploy by clicking in UI

---

## ⚠️ Migration Checklist

Before you deploy:

- [ ] Push latest code to GitHub (frontend + backend)
- [ ] Update all `DB_HOST` references from `168.231.115.219` to `database`
- [ ] Test locally: `docker-compose up`
- [ ] Prepare EasyPanel environment variables
- [ ] Deploy MySQL first
- [ ] Deploy Backend second (depends on MySQL)
- [ ] Deploy Frontend third (depends on Backend)
- [ ] Verify all services are healthy in EasyPanel UI

---

## 🎉 After Deployment

```
✅ Frontend running at: https://sow.qandu.me
✅ Backend running at: http://sow-backend-container:8000
✅ MySQL running at: http://mysql-container:3306
✅ All internal (no external DB)
✅ All on one dashboard
✅ All from one GitHub repo
```

**EVERYTHING UNIFIED!** 🚀

---

## 📞 Support

**Questions?**
- Check EasyPanel logs for each service
- Verify environment variables are set
- Ensure services can communicate (same network)
- Check MySQL is healthy before starting backend/frontend
