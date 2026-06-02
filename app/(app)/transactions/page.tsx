'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Transaction } from '@/lib/supabase/types';
import { Upload, Plus, Trash2, Search, Filter, RefreshCw, X, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Papa from 'papaparse';

const CATEGORIES = ['Food', 'Groceries', 'Transport', 'Entertainment', 'Shopping', 'Healthcare', 'Utilities', 'Subscriptions', 'Other', 'Uncategorized'];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [newTx, setNewTx] = useState({ date: format(new Date(), 'yyyy-MM-dd'), description: '', amount: '', category: 'Uncategorized', type: 'debit' as 'debit' | 'credit' });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase as any).from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(500);
    setTransactions(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleCSV = async (file: File) => {
    setImporting(true);
    setImportResult('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[];
        const toInsert = rows.map(row => {
          const dateVal = row.date || row.Date || row.DATE || row['Transaction Date'] || row['TransactionDate'] || '';
          const descVal = row.description || row.Description || row.DESCRIPTION || row.memo || row.Memo || row.name || row.Name || '';
          const amountStr = (row.amount || row.Amount || row.AMOUNT || row.debit || row.Debit || '0').toString().replace(/[,$\s]/g, '');
          const amount = Math.abs(parseFloat(amountStr) || 0);
          const type = (parseFloat(amountStr) < 0 || row.type?.toLowerCase() === 'debit') ? 'debit' : 'credit';
          const category = row.category || row.Category || 'Uncategorized';

          let parsedDate = dateVal;
          try {
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) parsedDate = format(d, 'yyyy-MM-dd');
          } catch {}

          return { user_id: user.id, date: parsedDate || format(new Date(), 'yyyy-MM-dd'), description: descVal || 'Imported transaction', amount, category, type, source: 'csv' };
        }).filter(r => r.amount > 0 && r.description);

        if (toInsert.length === 0) {
          setImportResult('No valid rows found. Check column names: date, description, amount, category (optional).');
          setImporting(false);
          return;
        }

        const { error } = await (supabase as any).from('transactions').insert(toInsert);
        if (error) {
          setImportResult(`Error: ${error.message}`);
        } else {
          setImportResult(`Successfully imported ${toInsert.length} transactions.`);
          await fetchTransactions();
        }
        setImporting(false);
      },
      error: () => {
        setImportResult('Failed to parse CSV file.');
        setImporting(false);
      },
    });
  };

  const handleAddTransaction = async () => {
    if (!newTx.description || !newTx.amount || !newTx.date) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from('transactions').insert({
      user_id: user.id,
      date: newTx.date,
      description: newTx.description,
      amount: Math.abs(parseFloat(newTx.amount)),
      category: newTx.category,
      type: newTx.type,
      source: 'manual',
    });
    setNewTx({ date: format(new Date(), 'yyyy-MM-dd'), description: '', amount: '', category: 'Uncategorized', type: 'debit' });
    setShowAdd(false);
    setSaving(false);
    await fetchTransactions();
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from('transactions').delete().eq('id', id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const filtered = transactions.filter(t => {
    const matchSearch = !search || t.description.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || t.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
          <p className="text-gray-500 text-sm mt-0.5">{transactions.length} total transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-400 appearance-none cursor-pointer"
          >
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Description</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Category</th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Amount</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">{format(parseISO(tx.date), 'MMM d, yyyy')}</td>
                    <td className="px-5 py-3 text-sm text-gray-800 font-medium">{tx.description}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium">{tx.category}</span>
                    </td>
                    <td className={`px-5 py-3 text-sm font-semibold text-right ${tx.type === 'credit' ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {tx.type === 'credit' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => handleDelete(tx.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Import CSV</h3>
              <button onClick={() => { setShowImport(false); setImportResult(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Upload a CSV file with columns: <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">date</span>, <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">description</span>, <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">amount</span>, <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">category</span> (optional)</p>
            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${importing ? 'border-sky-200 bg-sky-50' : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50'}`}>
              {importing ? (
                <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Click to upload CSV</span>
                </>
              )}
              <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleCSV(e.target.files[0])} disabled={importing} />
            </label>
            {importResult && (
              <div className={`mt-3 px-4 py-3 rounded-xl text-sm ${importResult.startsWith('Error') || importResult.startsWith('No valid') || importResult.startsWith('Failed') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'} flex items-start gap-2`}>
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {importResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Add transaction</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input type="date" value={newTx.date} onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={newTx.type} onChange={e => setNewTx(p => ({ ...p, type: e.target.value as 'debit' | 'credit' }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent">
                    <option value="debit">Debit (expense)</option>
                    <option value="credit">Credit (income)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input type="text" placeholder="e.g. Grocery run" value={newTx.description} onChange={e => setNewTx(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={newTx.amount} onChange={e => setNewTx(p => ({ ...p, amount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={newTx.category} onChange={e => setNewTx(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
              <button onClick={handleAddTransaction} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Add transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
