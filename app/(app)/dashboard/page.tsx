'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Transaction, Budget } from '@/lib/supabase/types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, CreditCard, Target, AlertTriangle, RefreshCw } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import Link from 'next/link';

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#0ea5e9',
  Groceries: '#0284c7',
  Transport: '#1e293b',
  Entertainment: '#334155',
  Shopping: '#475569',
  Healthcare: '#64748b',
  Utilities: '#94a3b8',
  Subscriptions: '#0369a1',
  Other: '#cbd5e1',
  Uncategorized: '#e2e8f0',
};

function getColor(category: string, index: number) {
  return CATEGORY_COLORS[category] || `hsl(${199 + index * 25}, 70%, ${45 + index * 5}%)`;
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, txRes, budgetRes] = await Promise.all([
      (supabase as any).from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      (supabase as any).from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      (supabase as any).from('budgets').select('*').eq('user_id', user.id),
    ]);

    setUserName(profileRes.data?.full_name?.split(' ')[0] || 'there');
    setTransactions(txRes.data || []);
    setBudgets(budgetRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasData = transactions.length > 0;

  const latestDate = hasData
    ? transactions.reduce((latest, t) => t.date > latest ? t.date : latest, transactions[0].date)
    : new Date().toISOString();
  const refDate = parseISO(latestDate);
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);

  const thisMonthTx = transactions.filter(t => {
    const d = parseISO(t.date);
    return d >= monthStart && d <= monthEnd;
  });

  const lastMonthStart = startOfMonth(subMonths(refDate, 1));
  const lastMonthEnd = endOfMonth(subMonths(refDate, 1));
  const lastMonthTx = transactions.filter(t => {
    const d = parseISO(t.date);
    return d >= lastMonthStart && d <= lastMonthEnd;
  });

  const totalSpent = thisMonthTx.filter(t => (t as any).type === 'debit').reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = thisMonthTx.filter(t => (t as any).type === 'credit').reduce((s, t) => s + Number(t.amount), 0);
  const lastMonthSpent = lastMonthTx.filter(t => (t as any).type === 'debit').reduce((s, t) => s + Number(t.amount), 0);
  const spendingChange = lastMonthSpent > 0 ? ((totalSpent - lastMonthSpent) / lastMonthSpent) * 100 : 0;

  const categoryBreakdown = thisMonthTx
    .filter(t => (t as any).type === 'debit')
    .reduce((acc, t) => {
      const cat = (t as any).category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const pieData = Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

  const dailySpend: Record<string, number> = {};
  const chartStart = subMonths(refDate, 1);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(chartStart); d.setDate(d.getDate() + i);
    dailySpend[format(d, 'MMM d')] = 0;
  }
  transactions.filter(t => (t as any).type === 'debit').forEach(t => {
    const label = format(parseISO(t.date), 'MMM d');
    const key = Object.keys(dailySpend).find(k => k === label);
    if (key) dailySpend[key] += Number(t.amount);
  });
  const chartData = Object.entries(dailySpend).map(([date, amount]) => ({ date, amount }));

  const recurringTx = transactions.filter(t => (t as any).is_recurring);
  const recurringTotal = recurringTx.reduce((s, t) => s + Number(t.amount), 0);

  const budgetAlerts = budgets.filter(b => {
    const spent = categoryBreakdown[b.category] || 0;
    return spent > b.monthly_limit * 0.8;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {userName}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {format(refDate, 'MMMM yyyy')} overview
          {latestDate !== new Date().toISOString().slice(0, 10) && (
            <span className="text-gray-400"> · showing latest month with data</span>
          )}
        </p>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No transactions yet</h3>
          <p className="text-gray-400 text-sm mb-6">Import your transaction data to get started with your financial overview.</p>
          <Link href="/transactions" className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all">
            Import Transactions
          </Link>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Spent this month</div>
              <div className="text-2xl font-semibold text-gray-900">${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${spendingChange > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {spendingChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(spendingChange).toFixed(1)}% vs last month
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Income this month</div>
              <div className="text-2xl font-semibold text-gray-900">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-gray-400 mt-1">Net: ${(totalIncome - totalSpent).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Subscriptions</div>
              <div className="text-2xl font-semibold text-gray-900">${recurringTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-gray-400 mt-1">{recurringTx.length} recurring charge{recurringTx.length !== 1 ? 's' : ''}</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Budget alerts</div>
              <div className="text-2xl font-semibold text-gray-900">{budgetAlerts.length}</div>
              <div className={`text-xs mt-1 ${budgetAlerts.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {budgetAlerts.length > 0 ? 'Categories near limit' : 'All budgets on track'}
              </div>
            </div>
          </div>

          {/* Budget alerts */}
          {budgetAlerts.length > 0 && (
            <div className="mb-6 space-y-2">
              {budgetAlerts.map(b => {
                const spent = categoryBreakdown[b.category] || 0;
                const pct = Math.round((spent / b.monthly_limit) * 100);
                const over = spent > b.monthly_limit;
                return (
                  <div key={b.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${over ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${over ? 'text-red-500' : 'text-amber-500'}`} />
                    <span className="text-gray-700">
                      <span className="font-medium">{b.category}</span>: ${spent.toFixed(0)} of ${b.monthly_limit.toFixed(0)} budget ({pct}% used)
                      {over && ' — over budget'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Daily spending (last 30 days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, 'Spent']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#0ea5e9" strokeWidth={2} fill="url(#spendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">This month by category</h3>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                        {pieData.map((entry, index) => (
                          <Cell key={entry.name} fill={getColor(entry.name, index)} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {pieData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: getColor(entry.name, i) }} />
                          <span className="text-gray-600">{entry.name}</span>
                        </div>
                        <span className="font-medium text-gray-800">${entry.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-400 text-sm py-8">No spending data</div>
              )}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700">Recent transactions</h3>
              <Link href="/transactions" className="text-xs text-sky-500 hover:text-sky-600 font-medium">View all</Link>
            </div>
            <div className="space-y-1">
              {transactions.slice(0, 8).map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800 leading-tight">{tx.description}</div>
                      <div className="text-xs text-gray-400">{tx.category} · {format(parseISO(tx.date), 'MMM d')}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {tx.type === 'credit' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
