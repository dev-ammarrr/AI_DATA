'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Budget } from '@/lib/supabase/types';
import { Target, Plus, Trash2, RefreshCw, X, AlertTriangle } from 'lucide-react';

const CATEGORIES = ['Food', 'Groceries', 'Transport', 'Entertainment', 'Shopping', 'Healthcare', 'Utilities', 'Subscriptions', 'Other'];

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newBudget, setNewBudget] = useState({ category: 'Food', monthly_limit: '' });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('budgets').select('*').eq('user_id', user.id).order('category');
    setBudgets(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const handleAdd = async () => {
    if (!newBudget.monthly_limit || !newBudget.category) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = budgets.find(b => b.category === newBudget.category);
    if (existing) {
      await (supabase.from('budgets') as any).update({ monthly_limit: parseFloat(newBudget.monthly_limit) }).eq('id', existing.id);
    } else {
      await (supabase.from('budgets') as any).insert({ user_id: user.id, category: newBudget.category, monthly_limit: parseFloat(newBudget.monthly_limit) });
    }

    setNewBudget({ category: 'Food', monthly_limit: '' });
    setShowAdd(false);
    setSaving(false);
    await fetchBudgets();
  };

  const handleDelete = async (id: string) => {
    await (supabase.from('budgets') as any).delete().eq('id', id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  const totalBudget = budgets.reduce((s, b) => s + b.monthly_limit, 0);

  return (
    <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Budgets</h1>
          <p className="text-gray-500 text-sm mt-0.5">{budgets.length} categories tracked</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Budget
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No budgets set</h3>
          <p className="text-gray-400 text-sm mb-6">Create monthly spending limits for your categories.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Budget
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">Monthly budget overview</span>
              <span className="text-lg font-semibold text-gray-900">${totalBudget.toLocaleString()}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-sky-400 rounded-full" style={{ width: `${Math.min(100, budgets.length * 10)}%` }} />
            </div>
          </div>

          {budgets.map(budget => (
            <div key={budget.id} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
                    <Target className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{budget.category}</h3>
                    <p className="text-xs text-gray-400">Monthly limit</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-gray-900">${budget.monthly_limit.toLocaleString()}</span>
                  <button onClick={() => handleDelete(budget.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Add budget</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select value={newBudget.category} onChange={e => setNewBudget(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent">
                  {CATEGORIES.filter(c => !budgets.find(b => b.category === c) || c === newBudget.category).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monthly limit ($)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={newBudget.monthly_limit} onChange={e => setNewBudget(p => ({ ...p, monthly_limit: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {budgets.find(b => b.category === newBudget.category) ? 'Update' : 'Add'} Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
