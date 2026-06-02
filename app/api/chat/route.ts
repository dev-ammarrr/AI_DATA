import { createGroq } from '@ai-sdk/groq';
import { generateText, streamText } from 'ai';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  return Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length);
}

function findRecurring(txns: any[]): any[] {
  const grouped: Record<string, number[]> = {};
  for (const t of txns) {
    if (t.type !== 'debit') continue;
    const key = `${t.description}|${t.amount}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(new Date(t.date).getTime());
  }
  const recurring: any[] = [];
  for (const [key, dates] of Object.entries(grouped)) {
    if (dates.length < 2) continue;
    dates.sort();
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push(dates[i] - dates[i - 1]);
    }
    const avgGap = mean(gaps);
    const gapDays = avgGap / (1000 * 60 * 60 * 24);
    if (gapDays >= 20 && gapDays <= 35) {
      const [desc] = key.split('|');
      recurring.push({ description: desc, amount: Math.round(Number(key.split('|')[1]) * 100) / 100, frequency: 'monthly' });
    }
  }
  return recurring;
}

function isImageContent(msg: any): boolean {
  return Array.isArray(msg.content) && msg.content.some((p: any) => p.type === 'image');
}

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
  const lastMsg = messages[messages.length - 1];

  if (lastMsg && isImageContent(lastMsg)) {
    const imagePart = lastMsg.content.find((p: any) => p.type === 'image');
    const textPart = lastMsg.content.find((p: any) => p.type === 'text');

    try {
      const result = await generateText({
        model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
        system: `You are a receipt OCR assistant. Extract the transaction details from this receipt image.

Return ONLY a JSON object (no markdown, no code fences) with these fields:
{
  "date": "YYYY-MM-DD",
  "description": "merchant or store name",
  "amount": 0.00,
  "category": "one of: Food, Groceries, Transport, Shopping, Healthcare, Utilities, Entertainment, Other",
  "type": "debit"
}

If the date is not visible, use today's date: "${new Date().toISOString().split('T')[0]}".
If the category is unclear, use "Other".
Always use "debit" for purchases.`,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: textPart?.text || 'Extract this receipt' },
              { type: 'image', image: imagePart.image },
            ],
          },
        ],
      });

      try {
        const cleaned = result.text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const tx = {
          user_id: userId,
          date: parsed.date || new Date().toISOString().split('T')[0],
          description: parsed.description || 'Receipt scan',
          amount: Math.abs(parseFloat(parsed.amount) || 0),
          category: parsed.category || 'Other',
          type: 'debit',
          source: 'receipt',
        };

        await (supabase as any).from('transactions').insert(tx);

        return Response.json({
          content: `📄 **Receipt scanned**\n\nRecorded as:\n- **${tx.description}** — $${tx.amount.toFixed(2)}\n- Category: ${tx.category}\n- Date: ${tx.date}`,
        });
      } catch {
        return Response.json({
          content: `I couldn't fully parse that receipt, but here's what I read:\n\n${result.text}\n\nYou may want to add it manually in Transactions.`,
        });
      }
    } catch (err: any) {
      return Response.json({ content: `❌ Receipt error: ${err.message || 'Vision model failed'}` }, { status: 500 });
    }
  }

  const [txRes, budgetRes, profileRes, ctxRes] = await Promise.all([
    (supabase as any).from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(500),
    (supabase as any).from('budgets').select('*').eq('user_id', userId),
    (supabase as any).from('profiles').select('*').eq('id', userId).maybeSingle(),
    (supabase as any).from('user_context').select('key, value').eq('user_id', userId),
  ]);

  const transactions = (txRes.data || []) as any[];
  const budgets = (budgetRes.data || []) as any[];
  const profile = profileRes.data as any;
  const userContext = (ctxRes.data || []) as any[];

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

  const amounts = uniqueTx.filter(t => t.type === 'debit').map(t => Number(t.amount));
  const avg = amounts.length > 0 ? mean(amounts) : 0;
  const sd = amounts.length > 1 ? stddev(amounts, avg) : 0;
  const threshold = avg + sd * 2.5;

  const anomalies = uniqueTx
    .filter(t => t.type === 'debit' && Number(t.amount) > threshold && amounts.length > 5)
    .slice(0, 5)
    .map(t => `  [${t.date}] ${t.description}: $${t.amount} (${Math.round((Number(t.amount) / avg - 1) * 100)}% above average)`);

  const recurring = findRecurring(uniqueTx);

  const memories = userContext.map((c: any) => `- ${c.value}`);
  const memoryBlock = memories.length > 0 ? `User context (the AI must remember these):\n${memories.join('\n')}\n` : '';

  const system = `You are a personal finance assistant. The user's actual financial data is below.

User: ${profile?.full_name || session.user.email}
Currency: ${profile?.currency || 'USD'}

Summary:
- Total income: $${totalIncome.toFixed(2)}
- Total expenses: $${totalSpent.toFixed(2)}
- Net: $${(totalIncome - totalSpent).toFixed(2)}
- Transaction count: ${uniqueTx.length}
- Average transaction: $${avg.toFixed(2)}

${memoryBlock}
${recurring.length > 0 ? `Likely recurring subscriptions:\n${recurring.map(r => `  - ${r.description}: $${r.amount}/month`).join('\n')}\n` : ''}

${anomalies.length > 0 ? `Unusual transactions (significantly above normal):\n${anomalies.join('\n')}\n` : ''}

Budgets:
${budgetContext}

${txSummary}

Rules:
- List each transaction exactly once — no duplicates.
- Use markdown formatting.
- If you can't answer from the data, say so clearly. Don't guess.
- When asked to suggest cutbacks, look at the user's spending by category and suggest specific, numbers-backed ideas.
- When asked about subscriptions, reference the recurring list above.
- When you notice unusual charges, proactively flag them.
- Be concise and practical.`;

  const result = await streamText({
    model: groq('llama-3.3-70b-versatile'),
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of result.textStream) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
