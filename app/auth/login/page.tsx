'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-[32px] font-semibold tracking-tight text-black">Sign in</h1>
          <p className="text-[15px] text-gray-400 mt-2">Enter your email and password</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className="w-full h-12 px-4 rounded-xl bg-gray-50 text-[15px] text-black placeholder-gray-400 border border-gray-200 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete="current-password"
              className="w-full h-12 px-4 rounded-xl bg-gray-50 text-[15px] text-black placeholder-gray-400 border border-gray-200 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-black text-white text-[15px] font-medium hover:bg-gray-900 active:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setEmail('abc@gmail.com'); setPassword('123456'); }}
          className="w-full mt-3 h-12 rounded-xl border-2 border-sky-400 text-sky-500 text-[14px] font-semibold hover:bg-sky-50 transition-all"
        >
          Use demo account
        </button>

        <p className="mt-8 text-center text-[14px] text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-sky-500 font-medium hover:text-sky-600 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
