'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Photo = {
  id: string
  photo_url: string
  order_index: number
}

type Profile = {
  id: string
  name: string
  nickname: string
  bio: string
  age_group: string
  gender: string
  avatar_url: string
  photos?: Photo[]
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
    })
    loadUsers()
  }, [])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (!data) { setLoading(false); return }

    const usersWithPhotos = await Promise.all(data.map(async user => {
      const { data: photos } = await supabase
        .from('profile_photos')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })
      return { ...user, photos: photos || [] }
    }))
    setUsers(usersWithPhotos)
    setLoading(false)
  }

  async function inviteToLunch(targetUserId: string) {
    const { data: room } = await supabase.from('rooms').insert({ post_id: null }).select().single()
    if (!room) return
    await supabase.from('room_members').insert([
      { room_id: room.id, user_id: userId },
      { room_id: room.id, user_id: targetUserId }
    ])
    await supabase.from('messages').insert({
      room_id: room.id, user_id: userId,
      text: `🍜 ランチに誘いました！都合のいい日を相談しましょう`
    })
    setSelectedUser(null)
    router.push(`/messages/${room.id}`)
  }

  const displayName = (u: Profile) => u?.nickname || u?.name || '?'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-100">
      <div className="text-4xl animate-bounce">👥</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      <div className="bg-gradient-to-r from-pink-400 to-rose-400 shadow-lg px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/board')} className="text-white/80 hover:text-white text-xl">‹</button>
          <h1 className="font-black text-white text-lg">メンバー一覧</h1>
          <span className="text-pink-100 text-sm">{users.length}人</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="grid grid-cols-2 gap-3">
          {users.map(user => {
            const isMe = user.id === userId
            const allPhotos = [
              ...(user.avatar_url ? [{ id: 'avatar', photo_url: user.avatar_url }] : []),
              ...(user.photos || [])
            ]

            return (
              <div key={user.id}
                onClick={() => { setSelectedUser(user); setCurrentPhotoIndex(0) }}
                className="bg-white rounded-3xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                <div className="relative aspect-square bg-gradient-to-br from-pink-100 to-rose-200">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-pink-400">
                      {displayName(user)[0]}
                    </div>
                  )}
                  {isMe && (
                    <div className="absolute top-2 left-2 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      自分
                    </div>
                  )}
                  {(user.photos?.length || 0) > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      📷 {(user.photos?.length || 0) + (user.avatar_url ? 1 : 0)}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-bold text-gray-800 truncate">{displayName(user)}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {user.age_group && <span className="text-xs bg-pink-50 text-pink-500 px-2 py-0.5 rounded-full">{user.age_group}</span>}
                    {user.gender && <span className="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">{user.gender}</span>}
                  </div>
                  {user.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{user.bio}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* プロフィール詳細モーダル */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4"
          onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* 写真スライダー */}
            <div className="relative aspect-square bg-gradient-to-br from-pink-100 to-rose-200">
              {(() => {
                const allPhotos = [
                  ...(selectedUser.avatar_url ? [selectedUser.avatar_url] : []),
                  ...(selectedUser.photos?.map(p => p.photo_url) || [])
                ]
                return allPhotos.length > 0 ? (
                  <>
                    <img src={allPhotos[currentPhotoIndex]} alt="" className="w-full h-full object-cover" />
                    {allPhotos.length > 1 && (
                      <>
                        <button onClick={() => setCurrentPhotoIndex(i => Math.max(0, i - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60">‹</button>
                        <button onClick={() => setCurrentPhotoIndex(i => Math.min(allPhotos.length - 1, i + 1))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60">›</button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                          {allPhotos.map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentPhotoIndex ? 'bg-white scale-125' : 'bg-white/50'}`} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl font-bold text-pink-300">
                    {displayName(selectedUser)[0]}
                  </div>
                )
              })()}
              <button onClick={() => setSelectedUser(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60">✕</button>
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-black text-xl text-gray-800">{displayName(selectedUser)}</div>
                  <div className="flex gap-2 mt-1">
                    {selectedUser.age_group && <span className="text-xs bg-pink-50 text-pink-500 px-2 py-0.5 rounded-full font-semibold">{selectedUser.age_group}</span>}
                    {selectedUser.gender && <span className="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full font-semibold">{selectedUser.gender}</span>}
                  </div>
                </div>
                {selectedUser.id !== userId && (
                  <button onClick={() => inviteToLunch(selectedUser.id)}
                    className="bg-gradient-to-r from-pink-400 to-rose-500 text-white px-4 py-2 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all text-sm">
                    🍜 誘う
                  </button>
                )}
              </div>
              {selectedUser.bio && (
                <p className="text-sm text-gray-500 bg-pink-50 rounded-2xl px-4 py-3">{selectedUser.bio}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}