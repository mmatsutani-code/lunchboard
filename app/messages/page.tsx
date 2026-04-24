'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Room = {
  id: string
  post_id: string
  posts: { shop: string; date: string }
  room_members: { user_id: string; profiles: { name: string } }[]
  messages: { text: string; created_at: string }[]
}

export default function MessagesPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      loadRooms(data.user.id)
    })
  }, [])

  async function loadRooms(uid: string) {
    const { data: memberOf } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', uid)

    const roomIds = memberOf?.map(m => m.room_id) || []
    if (roomIds.length === 0) { setLoading(false); return }

    const { data } = await supabase
      .from('rooms')
      .select('*, posts(shop, date), room_members(user_id, profiles(name)), messages(text, created_at)')
      .in('id', roomIds)
      .order('created_at', { referencedTable: 'messages', ascending: false })
    setRooms(data || [])
    setLoading(false)
  }

  const fmt = (d: string) => {
    const t = new Date(d)
    return `${t.getMonth()+1}月${t.getDate()}日（${'日月火水木金土'[t.getDay()]}）`
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/board')} className="text-gray-400 hover:text-gray-600">‹ 戻る</button>
          <h1 className="font-semibold text-lg">メッセージ</h1>
        </div>
        {rooms.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">💬</div>
            <p>マッチしたらここにメッセージが届きます</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(room => {
              const others = room.room_members.filter(m => m.user_id !== userId)
              const names = others.map(m => m.profiles?.name).join('・')
              const lastMsg = room.messages?.[0]
              return (
                <div key={room.id}
                  onClick={() => router.push(`/messages/${room.id}`)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm flex-shrink-0">
                      {others[0]?.profiles?.name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{names}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        📍 {room.posts?.shop}　{room.posts?.date && fmt(room.posts.date)}
                      </div>
                      {lastMsg && (
                        <div className="text-xs text-gray-400 mt-1 truncate">{lastMsg.text}</div>
                      )}
                    </div>
                    <div className="text-gray-300">›</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}