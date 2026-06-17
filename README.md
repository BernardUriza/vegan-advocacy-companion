# 🌱 Vegan Advocacy Companion

An educational Chrome Extension that helps vegan activists identify logical fallacies in debates. Powered by Azure OpenAI GPT-5-mini.

## Features

- 🎯 **Fallacy Identification**: Learn to identify Appeal to Tradition fallacies with AI-powered validation
- 💬 **Quick Responses**: Pre-written snippets for common anti-vegan arguments
- 📊 **Progress Tracking**: Level up as you improve your logic skills (XP, levels, stats)
- 🔒 **Secure**: Azure Key Vault integration for safe credential management

## Architecture

- **Frontend**: Chrome Extension (Vanilla JS + HTML/CSS)
- **Backend**: Next.js 15 API Routes (Serverless)
- **AI**: Azure OpenAI GPT-5-mini (gpt-5-mini deployment)
- **Security**: Azure Key Vault for credential storage

## Prerequisites

- Node.js 20+
- Azure CLI (authenticated)
- Chrome Browser
- Azure subscription with OpenAI deployment

## Installation

### 1. Clone and Install Backend

```bash
cd backend
npm install
```

### 2. Authenticate with Azure

The backend uses Azure Default Credentials (your Azure CLI login):

```bash
az login
```

### 3. Start Backend Server

```bash
npm run dev
```

Backend will run on `http://localhost:3001`

### 4. Load Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `/Users/bernardurizaorozco/Documents/vegan-advocacy-companion` directory (root folder, not `backend`)
5. The extension should appear in your extensions list

### 5. Open Side Panel

1. Click the extension icon in Chrome toolbar
2. Or right-click the extension icon → "Open side panel"

## Usage

### Identify a Fallacy

1. Read an anti-vegan argument (e.g., on Facebook)
2. Copy the argument text
3. Open the Vegan Advocacy Companion side panel
4. Paste the argument in the textarea
5. Click "✓ Validate My Identification"
6. Receive instant feedback from GPT-5-mini
7. Earn XP if correct!

### Use Quick Responses

1. Scroll to the "Quick Responses" section
2. Browse the 5 pre-written snippets
3. Click "📋 Copy" on the response you want
4. Paste it into your Facebook comment

## Project Structure

```
vegan-advocacy-companion/
├── manifest.json              # Chrome Extension config
├── icons/                     # Extension icons
├── sidepanel/                 # Extension UI
│   ├── index.html            # Main interface
│   ├── styles.css            # Styling
│   └── script.js             # Logic + API integration
├── backend/                   # Next.js API
│   ├── app/api/
│   │   └── validate-fallacy/
│   │       └── route.ts      # Main API endpoint
│   ├── lib/
│   │   └── azure-config.ts   # Key Vault integration
│   └── package.json
└── README.md
```

## Azure Resources Created

| Resource | Name | Purpose |
|----------|------|---------|
| Key Vault | `kv-vegan-advocacy-86134` | Stores API credentials securely |
| Secret | `AZURE-OPENAI-ENDPOINT` | OpenAI endpoint URL |
| Secret | `AZURE-OPENAI-API-KEY` | API authentication key |
| Secret | `AZURE-OPENAI-DEPLOYMENT` | Deployment name (gpt-5-mini) |

## API Endpoints

### POST /api/validate-fallacy

Analyzes text for Appeal to Tradition fallacy.

**Request:**
```json
{
  "argumentText": "Humans have always eaten meat"
}
```

**Response:**
```json
{
  "isValid": true,
  "confidence": 95,
  "explanation": "This argument appeals to historical practice without examining moral merit.",
  "keywords": ["always", "eaten meat"],
  "model": "gpt-5-mini"
}
```

## Development

### Backend Development

```bash
cd backend
npm run dev     # Start dev server on port 3001
```

### Extension Development

1. Make changes to files in `sidepanel/` or root
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the side panel

### Testing

**Test the API directly:**

```bash
curl -X POST http://localhost:3001/api/validate-fallacy \
  -H "Content-Type: application/json" \
  -d '{"argumentText":"Humans have always eaten meat"}'
```

**Test the Extension:**

1. Open Chrome
2. Load the extension
3. Open side panel
4. Paste test argument: "Our ancestors ate animals"
5. Click validate
6. Should receive AI-powered analysis

## Troubleshooting

### "API request failed" error

- Ensure backend is running: `cd backend && npm run dev`
- Check backend terminal for errors
- Verify Azure CLI is authenticated: `az account show`

### "Failed to retrieve Azure Key Vault secret"

- Verify you're logged into Azure CLI: `az login`
- Check Key Vault permissions:

```bash
az keyvault secret list --vault-name kv-vegan-advocacy-86134
```

### Extension not loading

- Check `chrome://extensions/` for error messages
- Verify manifest.json is valid JSON
- Try reloading the extension

## Cost Estimation

Based on 10 validations/day per user:

- **GPT-5-mini**: ~$0.15 per 1M input tokens
- **Average validation**: ~200 tokens input + 150 tokens output
- **Cost per validation**: ~$0.00005
- **Monthly cost (1 user, 300 validations)**: ~$0.015
- **Monthly cost (20 users)**: ~$0.30

Extremely affordable for educational use! 🎉

## Next Steps

- [ ] Add more fallacy types (Ad Hominem, Whataboutism, etc.)
- [ ] Implement snippet generation with AI
- [ ] Add Facebook content script for "Mark as Debate" button
- [ ] Deploy backend to Vercel
- [ ] Add user authentication (Supabase)
- [ ] Implement full gamification (badges, streak, leaderboard)

## Security

- ✅ API keys stored in Azure Key Vault (never in code)
- ✅ HTTPS-only communication
- ✅ CORS configured for extension origin
- ✅ Rate limiting recommended for production

## License

MIT

## Contributing

This is a private educational project. Contributions welcome from the core team!

---

Built with ❤️ for vegan activists learning logic and rhetoric.
