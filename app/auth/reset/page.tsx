'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleReset() {
    if (!password || password !== confirm) {
      setMessage('パスワードが一致しません')
      return
    }
    if (password.length < 6) {
      setMessage('パスワードは6文字以上で入力してください')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setMessage(error.message)
    else router.push('/board')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-3">IL6</div>
          <h1 className="text-xl font-semibold">パスワードの再設定</h1>
        </div>
        <div className="space-y-3">
          <input type="password" placeholder="新しいパスワード（6文字以上）" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <input type="password" placeholder="パスワード（確認）" value={confirm} onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReset()}
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          {message && (
            <p className="text-sm text-center text-gray-600">{message}</p>
          )}
          <button onClick={handleReset} disabled={loading || !password || !confirm}
            className="w-full bg-green-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-600 disabled:opacity-50">
            {loading ? '処理中...' : 'パスワードを更新する'}
          </button>
        </div>
      </div>
    </div>
  )
}
