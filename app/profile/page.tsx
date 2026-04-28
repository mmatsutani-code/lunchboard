'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Photo = {
  id: string
  photo_url: string
  order_index: number
}

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [gender, setGender] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
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
      const { data: photoData } = await supabase
        .from('profile_photos')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })
      setPhotos(photoData || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      setAvatarUrl(url)
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
    }
    setUploading(false)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (photos.length >= 6) { alert('写真は最大6枚まで追加できます'); return }
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/photos/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl
      const { data: newPhoto } = await supabase.from('profile_photos').insert({
        user_id: userId,
        photo_url: url,
        order_index: photos.length
      }).select().single()
      if (newPhoto) setPhotos(prev => [...prev, newPhoto])
    }
    setUploadingPhoto(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function deletePhoto(photoId: string) {
    await supabase.from('profile_photos').delete().eq('id', photoId)
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  async function handleSave() {
    if (!nickname.trim()) { alert('ニックネームは必須です！'); return }
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-100">
      <div className="text-4xl animate-bounce">💕</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      <div className="bg-gradient-to-r from-pink-400 to-rose-400 shadow-lg px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/board')} className="text-white/80 hover:text-white text-xl">‹</button>
          <h1 className="font-black text-white text-lg">プロフィール編集</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* メインアバター */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
          <h2 className="font-bold text-gray-700 mb-4">💕 メイン写真</h2>
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-24 h-24 rounded-3xl object-cover border-4 border-pink-200 shadow-md" />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center text-pink-500 text-4xl font-bold shadow-md">
                  {nickname?.[0] || name?.[0] || '?'}
                </div>
              )}
              <button onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-r from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white shadow-md hover:shadow-lg transition-all">
                📷
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            {uploading && <span className="text-xs text-pink-400 animate-pulse">アップロード中...</span>}
          </div>
        </div>

        {/* サブ写真 */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-700">🎞️ フォトギャラリー <span className="text-xs text-gray-400 font-normal">（最大6枚）</span></h2>
            {photos.length < 6 && (
              <button onClick={() => photoInputRef.current?.click()}
                className="bg-gradient-to-r from-pink-400 to-rose-500 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow hover:shadow-md transition-all">
                ＋ 追加
              </button>
            )}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          {uploadingPhoto && <p className="text-xs text-pink-400 animate-pulse mb-2">アップロード中...</p>}
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="relative aspect-square">
                <img src={photo.photo_url} alt="" className="w-full h-full object-cover rounded-2xl shadow-sm" />
                <button onClick={() => deletePhoto(photo.id)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow hover:bg-red-600 transition-colors">
                  ✕
                </button>
              </div>
            ))}
            {photos.length === 0 && (
              <div className="col-span-3 text-center py-8 text-gray-300">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm">写真を追加してみよう！</p>
              </div>
            )}
          </div>
        </div>

        {/* 基本情報 */}
        <div className="bg-white rounded-3xl p-6 shadow-md space-y-4">
          <h2 className="font-bold text-gray-700">✏️ 基本情報</h2>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">メールアドレス</label>
            <div className="w-full border border-gray-100 rounded-2xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400">{email}</div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">名前</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">
              ニックネーム <span className="text-pink-400 text-xs font-bold">※必須</span>
            </label>
            <input type="text" placeholder="例：まさき、ランチ王" value={nickname} onChange={e => setNickname(e.target.value)}
              className={`w-full border rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 ${!nickname.trim() ? 'border-pink-300' : 'border-gray-200'}`} />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-2 block">年齢層</label>
            <div className="flex gap-2 flex-wrap">
              {['20代', '30代', '40代', '50代以上'].map(age => (
                <button key={age} onClick={() => setAgeGroup(age)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${ageGroup === age ? 'bg-gradient-to-r from-pink-400 to-rose-500 text-white border-transparent shadow-md' : 'border-gray-200 text-gray-500 hover:border-pink-300'}`}>
                  {age}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-2 block">性別</label>
            <div className="flex gap-2">
              {['男性', '女性', 'その他'].map(g => (
                <button key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-full text-sm font-semibold border transition-all ${gender === g ? 'bg-gradient-to-r from-pink-400 to-rose-500 text-white border-transparent shadow-md' : 'border-gray-200 text-gray-500 hover:border-pink-300'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">自己紹介</label>
            <textarea placeholder="好きな食べ物や、ランチの好みなど自由に！" value={bio} onChange={e => setBio(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none h-24" />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-gradient-to-r from-pink-400 to-rose-500 text-white rounded-2xl py-3 text-sm font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50">
            {saved ? '✅ 保存しました！' : saving ? '保存中...' : '保存する 💕'}
          </button>
        </div>

        <button onClick={handleLogout}
          className="w-full border-2 border-red-200 text-red-400 rounded-2xl py-3 text-sm font-bold hover:bg-red-50 transition-all">
          ログアウト
        </button>
      </div>
    </div>
  )
}