# Backend Service - FastAPI PDF Generation

## Deployment on EasyPanel

This backend service runs FastAPI with WeasyPrint for PDF generation.

### EasyPanel Configuration

**Source:** GitHub  
**Repository:** `khaledbashir/the11-dev`  
**Branch:** `backend-service`  
**Build Path:** `/backend`  
**Dockerfile:** `Dockerfile` (in /backend directory)  
**Port:** 8000

### Environment Variables Required

```env
DB_HOST=ahmad-mysql-database
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow
ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
OPENROUTER_API_KEY=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
```

### Verification

After deployment, verify the service is running:

```bash
curl https://ahmad-socialgarden-backend.840tjq.easypanel.host/docs
```

Should return FastAPI Swagger UI (HTML), not a 404 page.

### Endpoints

- `GET /docs` - Swagger UI
- `POST /generate-pdf` - Generate PDF from HTML
- `POST /export-to-sheets` - Export SOW to Google Sheets
- `GET /health` - Health check

### Docker Build (Local Testing)

```bash
cd backend
docker build -t socialgarden-backend:latest .
docker run -p 8000:8000 --env-file .env socialgarden-backend:latest
```

### Important Notes

- This branch (`backend-service`) should ONLY contain backend code
- All frontend Dockerfiles have been removed to prevent EasyPanel confusion
- The only Dockerfile should be in `/backend/Dockerfile`
