# AI DEPLOYMENT GUIDANCE - SOW GENERATOR SYSTEM

## CRITICAL: EasyPanel Multi-Container Deployment Architecture

### System Overview
- **Frontend**: Next.js application (sow-qandu-me container)
- **Backend**: FastAPI Python service (socialgarden-backend container)  
- **Database**: MySQL (ahmad_mysql-database container)
- **Deployment**: EasyPanel with automatic GitHub integration

### Branch Strategy (CRITICAL - DO NOT VIOLATE)
```
main          → Production (DO NOT PUSH DIRECTLY)
sow-latest    → Frontend production (PUSH HERE FOR FRONTEND)
backend-service → Backend production (PUSH HERE FOR BACKEND)
develop       → Staging (optional)
```

### Deployment Workflow (MANDATORY)

#### For Frontend Changes:
```bash
# 1. Work on feature branch
git checkout -b feature/your-feature

# 2. Make changes and test locally

# 3. Push to sow-latest (frontend production)
git checkout sow-latest
git merge feature/your-feature
git push origin sow-latest

# Result: EasyPanel rebuilds sow-qandu-me container
```

#### For Backend Changes:
```bash
# 1. Work on feature branch  
git checkout -b feature/your-feature

# 2. Make changes and test locally

# 3. Push to backend-service (backend production)
git checkout backend-service
git merge feature/your-feature
git push origin backend-service

# Result: EasyPanel rebuilds socialgarden-backend container
```

#### For Critical Fixes (like discount calculation):
```bash
# 1. Create hotfix branch from target branch
git checkout sow-latest  # or backend-service
git checkout -b hotfix/critical-fix

# 2. Implement fix

# 3. Force push if needed (for urgent fixes)
git push origin hotfix/critical-fix:sow-latest --force

# Result: Immediate deployment of critical fix
```

### Environment Variables (MANDATORY)

#### Frontend Container (sow-qandu-me):
```
NODE_ENV=production
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
NEXT_PUBLIC_ANYTHINGLLM_API_KEY=0G0WTZ3-6ZW4D20-H35VBRG-9059WPA
NEXT_PUBLIC_PDF_SERVICE_URL=http://168.231.115.219:3000/projects/ahmad/app/socialgarden-backend
NEXT_PUBLIC_BASE_URL=http://168.231.115.219:3000/projects/ahmad/app/sow-qandu-me/deployments
NEXT_PUBLIC_API_URL=http://168.231.115.219:3000/projects/ahmad/app/socialgarden-backend
DB_HOST=ahmad_mysql-database
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow
OPENROUTER_API_KEY=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
```

#### Backend Container (socialgarden-backend):
```
API_PORT=8000
DB_HOST=ahmad_mysql-database
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow
ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=0G0WTZ3-6ZW4D20-H35VBRG-9059WPA
GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON=your_service_account_json
GOOGLE_SHEETS_AUTO_SHARE_EMAIL=your_email@example.com
```

### Docker Configuration (MANDATORY)

#### Frontend Dockerfile (Dockerfile.frontend):
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js
CMD ["npm", "start"]
```

#### .dockerignore (CRITICAL):
```
backend/
database/
logs/
scripts/
templates/
.env*
*.md
```

### Health Check Endpoints

#### Backend Health:
```
GET http://168.231.115.219:3000/projects/ahmad/app/socialgarden-backend/health
Expected: {"status": "healthy", "service": "Social Garden PDF Service"}
```

#### Frontend Health:
```
GET http://168.231.115.219:3000/projects/ahmad/app/sow-qandu-me/deployments/
Expected: Working SOW Generator UI
```

### Common Issues & Solutions

#### Issue: "failed to read dockerfile: open Dockerfile: no such file or directory"
**Solution**: Ensure `Dockerfile.frontend` exists in root directory

#### Issue: "Invalid module 'backend/main' in scheme"
**Solution**: Add `.dockerignore` to exclude backend files from frontend build

#### Issue: Merge conflicts when pushing
**Solution**: Use `--force` for critical fixes, or create clean feature branches

#### Issue: Container not rebuilding
**Solution**: Check EasyPanel webhook configuration and branch mappings

### Critical Rules (DO NOT VIOLATE)

1. **NEVER push to main branch** - it will break production
2. **ALWAYS push frontend changes to sow-latest**
3. **ALWAYS push backend changes to backend-service**
4. **ALWAYS include .dockerignore for frontend builds**
5. **ALWAYS test locally before pushing**
6. **ALWAYS check EasyPanel build logs after push**

### Emergency Rollback

#### Frontend Rollback:
```bash
# EasyPanel: Navigate to sow-qandu-me container
# View deployment history
# Click "Rollback" on previous successful deployment
```

#### Backend Rollback:
```bash
# EasyPanel: Navigate to socialgarden-backend container  
# View deployment history
# Click "Rollback" on previous successful deployment
```

### Testing Checklist (MANDATORY)

#### Pre-Deployment:
- [ ] Local build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Critical functionality tested

#### Post-Deployment:
- [ ] Health endpoints respond correctly
- [ ] Core functionality works (SOW generation, PDF export, Excel export)
- [ ] No console errors in browser
- [ ] Database connections working

### Contact Information
- **Frontend Issues**: Check sow-qandu-me container logs
- **Backend Issues**: Check socialgarden-backend container logs
- **Database Issues**: Check ahmad_mysql-database container logs
- **Deployment Issues**: Check EasyPanel deployment history

---

**Last Updated**: November 2025
**Critical**: Follow this guide exactly to avoid deployment failures
**Emergency Contact**: Check EasyPanel dashboard for container status