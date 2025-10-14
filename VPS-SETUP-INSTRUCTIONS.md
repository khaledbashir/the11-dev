# VPS Setup Instructions

## Quick Setup on Your VPS

1. **Clone the repository:**
```bash
git clone https://github.com/khaledbashir/the11.git
cd the11
```

2. **Initialize the submodule (this downloads all the novel-editor-demo code):**
```bash
git submodule update --init --recursive
```

3. **Start with Docker:**
```bash
docker-compose up --build
```

That's it! The app will be available at `http://your-vps-ip:3000`

---

## Alternative: Use the Setup Script

```bash
git clone https://github.com/khaledbashir/the11.git
cd the11
./setup.sh
docker-compose up --build
```

---

## Troubleshooting

**If the novel-editor-demo folder is empty:**
```bash
cd the11
git submodule update --init --recursive
```

**To stop the services:**
```bash
docker-compose down
```

**To restart after changes:**
```bash
docker-compose up --build
```

**To run in background (detached mode):**
```bash
docker-compose up -d --build
```

**To view logs:**
```bash
docker-compose logs -f
```
