import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const { messages } = await req.json();

  if (!process.env.GROQ_API_KEY) {
    return Response.json({
      content: 'AI assistant is not configured. Set your GROQ_API_KEY in .env.local to enable AI responses.',
    });
  }

  const userId = session.user.id;

  const [txRes, budgetRes, profileRes] = await Promise.all([
    (supabase as any).from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(100),
    (supabase as any).from('budgets').select('*').eq('user_id', userId),
    (supabase as any).from('profiles').select('*').eq('id', userId).maybeSingle(),
  ]);

  const transactions = (txRes.data || []) as any[];
  const budgets = (budgetRes.data || []) as any[];
  const profile = profileRes.data as any;

  const totalSpent = transactions
    .filter(t => t.type === 'debit')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = transactions
    .filter(t => t.type === 'credit')
    .reduce((s, t) => s + Number(t.amount), 0);

  const budgetContext = budgets.length > 0
    ? budgets.map(b => `- ${b.category}: $${b.monthly_limit}/month`).join('\n')
    : 'No budgets set.';

  const uniqueTx = (transactions as any[]).filter(
    (t, i, arr) => arr.findIndex((x: any) => x.date === t.date && x.description === t.description && x.amount === t.amount) === i
  );

  const txSummary = uniqueTx.length > 0
    ? `Transactions (${uniqueTx.length} total, showing up to 30):\n${uniqueTx.slice(0, 30).map((t: any) =>
        `  [${t.date}] ${t.description}: $${t.amount}${t.category ? ` [${t.category}]` : ''}${t.type ? ` (${t.type})` : ''}`
      ).join('\n')}`
    : 'No transactions yet.';

  const system = `You are a personal finance assistant. The user's actual financial data is below. Answer questions using their real data.

User: ${profile?.full_name || session.user.email}
Currency: ${profile?.currency || 'USD'}

Summary:
- Total income: $${totalIncome.toFixed(2)}
- Total expenses: $${totalSpent.toFixed(2)}
- Net: $${(totalIncome - totalSpent).toFixed(2)}
- Transaction count: ${uniqueTx.length}

Budgets:
${budgetContext}

${txSummary}

Important rules:
- List each transaction exactly once — no duplicates.
- Use markdown formatting (bold, lists, code) for readability.
- Be concise and practical.`;

  const result = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    system,
    messages,
  });

  return Response.json({ content: result.text });
}
