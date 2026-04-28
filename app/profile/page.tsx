'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [gender, setGender] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
        setNickname(data.nickname || '')
        setBio(data.bio || '')
        setAgeGroup(data.age_group || '')
        setGender(data.gender || '')
        setAvatarUrl(data.avatar_url || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      setAvatarUrl(url)
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!nickname.trim()) {
      alert('ニックネームは必須です！')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').upsert({
      id: user.id, name, nickname, bio, age_group: ageGroup, gender, avatar_url: avatarUrl
    })
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
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar"
                  className="w-20 h-20 rounded-full object-cover border-2 border-green-200" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-3xl font-bold">
                  {nickname?.[0] || name?.[0] || '?'}
                </div>
              )}
              <button onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white text-sm hover:bg-green-600">
                ✏️
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            {uploading && <span className="text-xs text-gray-400">アップロード中...</span>}
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
            <label className="text-sm text-gray-500 mb-1 block">
              ニックネーム <span className="text-red-400">※必須</span>
            </label>
            <input type="text" placeholder="例：まさき、ランチ王" value={nickname} onChange={e => setNickname(e.target.value)}
              className={`w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!nickname.trim() ? 'border-red-300' : ''}`} />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">年齢層</label>
            <div className="flex gap-2">
              {['20代', '30代', '40代', '50代以上'].map(age => (
                <button key={age} onClick={() => setAgeGroup(age)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${ageGroup === age ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500 hover:border-green-300'}`}>
                  {age}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">性別</label>
            <div className="flex gap-2">
              {['男性', '女性', 'その他'].map(g => (
                <button key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${gender === g ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500 hover:border-green-300'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">自己紹介</label>
            <textarea placeholder="好きな食べ物や、ランチの好みなど自由に！" value={bio} onChange={e => setBio(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none h-24" />
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