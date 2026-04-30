'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit() {
    if (!email || !password) return
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` }
      })
      if (error) setMessage(error.message)
      else setMessage('確認メールを送りました。メール内のリンクをクリックして登録を完了してください。')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage('メールアドレスまたはパスワードが正しくありません')
      else router.push('/board')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-3">IL6</div>
          <h1 className="text-2xl font-semibold">IL6 Lunch LOVE</h1>
          <p className="text-gray-500 text-sm mt-1">社内ランチマッチング</p>
        </div>
        <div className="space-y-3">
          <input type="email" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          {message && (
            <p className="text-sm text-center text-gray-600">{message}</p>
          )}
          <button onClick={handleSubmit} disabled={loading || !email || !password}
            className="w-full bg-green-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-600 disabled:opacity-50">
            {loading ? '処理中...' : isSignUp ? '新規登録' : 'ログイン'}
          </button>
          <button onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 text-center">
            {isSignUp ? 'すでにアカウントをお持ちの方はこちら' : '初めての方はこちら（新規登録）'}
          </button>
        </div>
      </div>
    </div>
  )
}
