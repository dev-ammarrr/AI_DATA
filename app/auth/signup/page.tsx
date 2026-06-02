'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await (supabase as any).from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
      });
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-[32px] font-semibold tracking-tight text-black">Create account</h1>
          <p className="text-[15px] text-gray-400 mt-2">Get started for free</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              required
              className="w-full h-12 px-4 rounded-xl bg-gray-50 text-[15px] text-black placeholder-gray-400 border border-gray-200 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
            />
          </div>

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
              autoComplete="new-password"
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-8 text-center text-[14px] text-gray-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-sky-500 font-medium hover:text-sky-600 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
