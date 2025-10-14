# 🌱 Social Garden SOW Generator

> **Beautiful, AI-powered Statement of Work generator with professional PDF export**

Clone anywhere. Run instantly. Deploy everywhere. 🚀

---

## ⚡ Quick Start

```bash
# 1. Clone
git clone https://github.com/khaledbashir/the11.git
cd the11
git checkout production-ready

# 2. Configure
cp .env.example .env
nano .env  # Add your OpenRouter API key

# 3. Run
docker-compose up -d

# 4. Open http://localhost:3333
```

**That's it!** The app is running with full AI features and PDF export.

---

## ✨ Features

- 📝 **Rich text editor** with slash commands (`/table`, `/divider`, `/heading`, etc.)
- 🤖 **AI writing assistant** (improve, shorten, lengthen, simplify, fix spelling)
- 📄 **Professional PDF export** with Social Garden branding
- 🎨 **Beautiful dark mode** with brand color accents
- 💾 **Auto-save** to localStorage
- 🖼️ **Image uploads** and embeds
- �� **Tables** with proper formatting

---

## 🔧 Quick Configuration

Edit `.env`:

```bash
OPENROUTER_API_KEY=your_api_key_here  # Get free at https://openrouter.ai/keys
FRONTEND_PORT=3333                     # Change if port in use
```

---

## 🐳 Docker Commands

```bash
docker-compose up -d      # Start
docker-compose down       # Stop
docker-compose logs -f    # View logs
docker-compose build      # Rebuild after changes
```

---

## 🚀 Deploy Anywhere

Works on any system with Docker:
- ✅ Local machine (Mac/Windows/Linux)
- ✅ VPS (DigitalOcean, Linode, etc.)
- ✅ Cloud (AWS, GCP, Azure)
- ✅ Self-hosted servers

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

---

## 📁 Project Structure

```
the11/
├── docker-compose.yml       # Orchestration
├── novel-editor-demo/       # Next.js frontend (port 3333)
└── pdf-service/            # Python PDF service (port 8000)
```

---

## 🐛 Troubleshooting

```bash
# Port already in use?
netstat -tulpn | grep 3333
# Change FRONTEND_PORT in .env

# Check logs
docker-compose logs

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

---

## 🔒 Security Note

Never commit `.env` file - it contains your API key!

---

**Made with ❤️ for Social Garden**
