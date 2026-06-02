'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Settings as SettingsIcon, User, Save, RefreshCw, Check, Brain, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [payDate, setPayDate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState('');
  const [memories, setMemories] = useState<{ id: string; key: string; value: string }[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');

      const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) {
        setFullName(data.full_name || '');
        setCurrency(data.currency || 'USD');
        setPayDate(data.pay_date || 1);
      }

      const { data: ctx } = await (supabase as any).from('user_context').select('*').eq('user_id', user.id);
      if (ctx) setMemories(ctx);
      setLoading(false);
    })();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await (supabase as any).from('profiles').upsert({
      id: user.id,
      full_name: fullName,
      currency,
      pay_date: payDate,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
    setSaving(false);
  };

  const handleAddMemory = async () => {
    if (!newMemory.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await (supabase as any).from('user_context').insert(
      { user_id: user.id, key: newMemory.trim(), value: newMemory.trim() }
    ).select().maybeSingle();

    if (data) setMemories(prev => [...prev, data]);
    setNewMemory('');
  };

  const handleDeleteMemory = async (id: string) => {
    await (supabase as any).from('user_context').delete().eq('id', id);
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your profile and preferences</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
              <User className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Profile</h3>
              <p className="text-xs text-gray-400">{email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="AUD">AUD (A$)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pay day</label>
                <input type="number" min="1" max="31" value={payDate} onChange={e => setPayDate(parseInt(e.target.value) || 1)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Account</h3>
              <p className="text-xs text-gray-400">Signed in as {email}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
              <Brain className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Memory</h3>
              <p className="text-xs text-gray-400">Things you want the AI to remember about your finances</p>
            </div>
          </div>

          <div className="border-b border-gray-100 pb-4 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-3">Add a new memory</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMemory}
                onChange={e => setNewMemory(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMemory()}
                placeholder="e.g. I get paid on the 1st"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              />
              <button
                onClick={handleAddMemory}
                disabled={!newMemory.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {memories.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No memories saved yet.</p>
            )}
            {memories.map(m => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800">{m.value}</div>
                </div>
                <button
                  onClick={() => handleDeleteMemory(m.id)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
