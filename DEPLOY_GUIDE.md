# Waste2Power: Deploy Guide (Render + Vercel)

Folder structure:
```
frontend/   -> Vercel (static site)
backend/    -> Render (Node/Express API)
render.yaml -> optional Render blueprint
```

## Step 1: GitHub par upload
1. Poora folder (frontend + backend + render.yaml) ek GitHub repo mein push karo.
2. `.env` file kabhi push mat karna (`.gitignore` mein already hai).

## Step 2: Backend ko Render par deploy karo
1. render.com > New > **Web Service** > apna repo select karo.
2. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
3. Environment Variables:
   - `GEMINI_API_KEY` = Google AI Studio wali key
   - `ALLOWED_ORIGINS` = abhi `*` rakho, Vercel URL milne ke baad usse replace karo
4. Deploy ke baad URL milega, jaise `https://waste2power-api.onrender.com`.
5. Browser mein `<URL>/api/health` kholo. `{"ok":true,"ai":true,...}` aana chahiye.

## Step 3: Frontend ko Vercel par deploy karo
1. `frontend/config.js` kholo aur likho:
   `window.W2P_API_BASE = "https://waste2power-api.onrender.com";`
2. vercel.com > Add New > Project > wahi repo.
3. **Root Directory = `frontend`**, Framework Preset = Other, Build Command khali.
4. Deploy. Aapko `https://your-app.vercel.app` milega.

## Step 4: CORS lock karo
Render > Environment mein `ALLOWED_ORIGINS` = `https://your-app.vercel.app` set karo (save = auto redeploy).

## Option B: Backend bhi Vercel par (Render ki jagah)
Backend ab Vercel serverless ke liye bhi ready hai (`backend/api/index.js` + `backend/vercel.json`).
1. Vercel par **dusra project** banao, same repo, **Root Directory = `backend`**, Framework Preset = Other.
2. Environment Variables: `GEMINI_API_KEY`, `ALLOWED_ORIGINS` (frontend ka Vercel URL).
3. Deploy ke baad `https://<backend>.vercel.app/api/health` kholo.
4. `frontend/config.js` mein yehi URL daalo aur frontend redeploy karo.
Dhyan: Vercel par file permanent save nahi hoti (`/tmp` use hota hai). Marketplace listings kabhi bhi reset ho sakti hain, aur alag-alag serverless instance alag data dikha sakte hain. Listings ke liye database zaroori hai (Supabase / MongoDB Atlas / Upstash Redis). Sirf AI detect aur health database ke bina theek chalte hain.
Agar listings permanent chahiye, to Render ya Vercel dono par database lagana padega.

## Dhyan rakhne wali baatein
- Render free plan 15 min idle ke baad sleep hota hai. Pehli request 30-60 sec le sakti hai. Demo se pehle `/api/health` ek baar khol lo.
- Marketplace listings abhi server ki JSON file mein hain. Render free par redeploy/restart par ye reset ho jaati hain. Permanent data ke liye MongoDB Atlas ya Supabase use karo.
- Marketplace listing ka contact sabko dikhta hai. Personal phone/email mat daalo.
- Login abhi sirf naam wala demo hai (password nahi). Waste log abhi bhi browser ke localStorage mein hai.
- Agar `config.js` mein URL khali chhodo, app purane offline mode mein chalega (apni Gemini key AI settings mein).

## Local test
```
cd backend
npm install
cp .env.example .env   # key daalo
npm run dev            # http://localhost:3000
```
Phir `frontend/config.js` mein `window.W2P_API_BASE = "http://localhost:3000";` karke `index.html` Live Server se kholo.
