'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  name: string
  nickname: string
  bio: string
  age_group: string
  gender: string
  avatar_url: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function inviteToLunch(targetUserId: string, targetName: string) {
    const { data: room } = await supabase
      .from('rooms')
      .insert({ post_id: null })
      .select()
      .single()
    if (!room) return
    await supabase.from('room_members').insert([
      { room_id: room.id, user_id: userId },
      { room_id: room.id, user_id: targetUserId }
    ])
    await supabase.from('messages').insert({
      room_id: room.id,
      user_id: userId,
      text: `🍜 ランチに誘いました！都合のいい日を相談しましょう`
    })
    router.push(`/messages/${room.id}`)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/board')} className="text-gray-400 hover:text-gray-600">‹ 戻る</button>
          <h1 className="font-semibold text-lg">メンバー一覧</h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{users.length}人</span>
        </div>

        <div className="space-y-3">
          {users.map(user => {
            const isMe = user.id === userId
            const displayName = user.nickname || user.name || '?'
            return (
              <div key={user.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold flex-shrink-0 overflow-hidden">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span>{displayName[0]}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{displayName}</span>
                      {isMe && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">自分</span>}
                      {user.age_group && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{user.age_group}</span>}
                      {user.gender && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{user.gender}</span>}
                    </div>
                    {user.bio && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{user.bio}</p>}
                  </div>
                  {!isMe && (
                    <button onClick={() => inviteToLunch(user.id, displayName)}
                      className="text-xs bg-green-500 text-white rounded-lg px-3 py-1.5 hover:bg-green-600 flex-shrink-0">
                      誘う🍜
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}