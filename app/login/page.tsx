'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [dept, setDept] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleLogin() {
    if (!email || !name) return
    setLoading(true)
    const params = new URLSearchParams({ name, dept })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?${params}` }
    })
    if (!error) setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow text-center max-w-sm w-full">
        <div className="text-4xl mb-4">📧</div>
        <h2 className="text-xl font-semibold mb-2">メールを確認してください</h2>
        <p className="text-gray-500 text-sm">{email} にログインリンクを送りました</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-3">IL6</div>
          <h1 className="text-2xl font-semibold">IL6 Lunch LOVE</h1>
          <p className="text-gray-500 text-sm mt-1">社内ランチマッチング</p>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder="名前" value={name} onChange={e => setName(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <input type="text" placeholder="部署" value={dept} onChange={e => setDept(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <input type="email" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <button onClick={handleLogin} disabled={loading || !email || !name}
            className="w-full bg-green-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-600 disabled:opacity-50">
            {loading ? '送信中...' : 'ログインリンクを送る'}
          </button>
        </div>
      </div>
    </div>
  )
}