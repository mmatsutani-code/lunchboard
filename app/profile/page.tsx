'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email || '')
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setName(data.name || '')
        setDepartment(data.department || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').upsert({ id: user.id, name, department })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/board')} className="text-gray-400 hover:text-gray-600">‹ 戻る</button>
          <h1 className="font-semibold text-lg">プロフィール</h1>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-center mb-2">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-2xl font-bold">
              {name?.[0] || '?'}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">メールアドレス</label>
            <div className="w-full border rounded-lg px-4 py-2 text-sm bg-gray-50 text-gray-400">{email}</div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">名前</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">部署</label>
            <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-green-500 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-600 disabled:opacity-50">
            {saved ? '✅ 保存しました！' : saving ? '保存中...' : '保存する'}
          </button>
        </div>

        <div className="mt-4">
          <button onClick={handleLogout}
            className="w-full border border-red-200 text-red-400 rounded-lg py-2.5 text-sm font-medium hover:bg-red-50">
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}