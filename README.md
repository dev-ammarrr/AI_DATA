# Revonix Finance

**AI-powered personal finance assistant** — import your transactions, visualize spending, set budgets, and chat with an AI about your finances.

![Dashboard](https://img.shields.io/badge/status-active-success)
![Next.js](https://img.shields.io/badge/Next.js-13.5-black)
![Supabase](https://img.shields.io/badge/Supabase-2.x-green)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

### Dashboard
- Monthly spending overview with income vs expense tracking
- Daily spending chart (last 30 days)
- Category breakdown (pie chart)
- Budget alerts when approaching/exceeding limits
- Recent transactions list

### Transactions
- Import transactions via CSV upload
- Manual transaction entry
- Search and filter by category
- Delete transactions
- Auto-detects columns: `date`, `description`, `amount`, `category`, `type`

### Budgets
- Set monthly spending limits per category
- Dashboard alerts when nearing or over budget
- Track all budgets in one view

### AI Assistant
- Ask questions about your finances in natural language
- Get spending summaries, category breakdowns, and budgeting advice
- Powered by Groq (Llama 3.3 70B) — blazing fast inference
- Conversation history persists across sessions

### Settings
- Profile management (name, currency, pay day)
- Currency selection (USD, EUR, GBP, JPY, CAD, AUD)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 13.5](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) (Radix primitives) |
| Database & Auth | [Supabase](https://supabase.com/) |
| AI | [Groq](https://groq.com/) via [Vercel AI SDK](https://sdk.vercel.ai/) |
| Charts | [Recharts](https://recharts.org/) |
| Icons | [Lucide](https://lucide.dev/) |
| Forms | [react-hook-form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| CSV Parsing | [PapaParse](https://www.papaparse.com/) |
| Deployment | [Vercel](https://vercel.com/) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project ([free tier](https://supabase.com/))
- A Groq API key ([free](https://console.groq.com/)) for the AI assistant

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd revonix-finance
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GROQ_API_KEY=gsk_your-groq-api-key
```

### 3. Database Setup

Run the migration SQL in your Supabase dashboard's SQL editor:

```
supabase/migrations/20260602070703_create_finance_assistant_schema.sql
```

This creates all required tables with Row Level Security.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account and import a CSV to get started.

---

## Database Schema

### `profiles`
User metadata — name, currency, pay day.

### `transactions`
All financial transactions with category, type (debit/credit), merchant, and source tracking.

### `budgets`
Per-category monthly spending limits (unique per user per category).

### `chat_messages`
Conversation history for the AI assistant.

### `user_context`
Persistent key-value memory for the AI assistant to remember user preferences.

All tables have RLS policies restricting access to the owning user.

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | Sends chat messages to Groq AI with user's financial data as context |

---

## Deployment

Deploy to Vercel:

```bash
npx vercel
```

Add the same environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`) in Vercel's dashboard under **Settings → Environment Variables**.

---

## Sample CSV Format

```csv
date,description,amount,category,merchant,type
2024-01-15,Grocery Store Purchase,125.50,Groceries,Whole Foods,debit
2024-01-16,Netflix Subscription,15.99,Entertainment,Netflix,debit
2024-01-18,Salary Deposit,3500.00,Income,Employer Inc,credit
```

Accepted column names:
- `date` (or `Date`, `DATE`, `Transaction Date`)
- `description` (or `Description`, `DESCRIPTION`, `memo`, `name`)
- `amount` (or `Amount`, `AMOUNT`)
- `category` (optional, defaults to "Uncategorized")
- `type` (optional — "debit" or "credit", auto-detected from negative amounts)

---

## Project Structure

```
app/
├── (app)/                    # Authenticated routes (with sidebar)
│   ├── dashboard/            # Main dashboard with charts
│   ├── transactions/         # CSV import & transaction management
│   ├── budgets/              # Budget CRUD
│   ├── chat/                 # AI assistant
│   └── settings/             # User profile settings
├── api/chat/                 # AI chat API route
├── auth/
│   ├── login/                # Login page
│   └── signup/               # Signup page
├── layout.tsx                # Root layout
└── page.tsx                  # Root redirect to /dashboard

components/
├── layout/
│   └── Sidebar.tsx           # Navigation sidebar
└── ui/                       # shadcn/ui components

lib/
└── supabase/
    ├── client.ts             # Browser Supabase client
    ├── server.ts             # Server Supabase client
    └── types.ts              # Database type definitions

supabase/migrations/          # SQL migrations
```

---

## License

MIT
