'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Room = {
  id: string
  post_id: string
  posts: { shop: string; date: string }
  room_members: { user_id: string; profiles: { name: string; nickname: string; avatar_url: string } }[]
  messages: { text: string; created_at: string }[]
  unread?: number
  lastMessageAt?: string
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
      .select('*, posts(shop, date), room_members(user_id, profiles(name, nickname, avatar_url)), messages(text, created_at)')
      .in('id', roomIds)

    const { data: reads } = await supabase
      .from('message_reads')
      .select('room_id, last_read_at')
      .eq('user_id', uid)

    const roomsWithUnread = await Promise.all((data || []).map(async room => {
      const read = reads?.find(r => r.room_id === room.id)
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .neq('user_id', uid)
        .gt('created_at', read?.last_read_at || '2000-01-01')

      const lastMsg = room.messages?.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

      return {
        ...room,
        unread: count || 0,
        lastMessageAt: lastMsg?.created_at || room.messages?.[0]?.created_at || ''
      }
    }))

    // 新着順にソート
    roomsWithUnread.sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    )

    setRooms(roomsWithUnread)
    setLoading(false)
  }

  const fmt = (d: string) => {
    const t = new Date(d)
    return `${t.getMonth()+1}月${t.getDate()}日（${'日月火水木金土'[t.getDay()]}）`
  }

  const timeAgo = (d: string) => {
    if (!d) return ''
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'たった今'
    if (mins < 60) return `${mins}分前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}時間前`
    const days = Math.floor(hours / 24)
    return `${days}日前`
  }

  const displayName = (p: any) => p?.nickname || p?.name || '?'

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/board')} className="text-gray-400 hover:text-gray-600">‹ 戻る</button>
          <h1 className="font-semibold text-lg">メッセージ</h1>
          {rooms.some(r => r.unread && r.unread > 0) && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
              未読あり
            </span>
          )}
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
              const lastMsg = room.messages?.sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0]
              const hasUnread = (room.unread || 0) > 0

              return (
                <div key={room.id}
                  onClick={() => router.push(`/messages/${room.id}`)}
                  className={`bg-white rounded-2xl p-4 shadow-sm border cursor-pointer hover:border-green-200 transition-colors ${hasUnread ? 'border-l-4 border-l-green-500 border-gray-100' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="flex -space-x-2">
                        {others.slice(0, 3).map((m, i) => (
                          <div key={i} className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm border-2 border-white overflow-hidden">
                            {m.profiles?.avatar_url
                              ? <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                              : <span>{displayName(m.profiles)[0]}</span>
                            }
                          </div>
                        ))}
                      </div>
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {(room.unread || 0) > 9 ? '9+' : room.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className={`text-sm ${hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {others.map(m => displayName(m.profiles)).join('・')}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{timeAgo(room.lastMessageAt || '')}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {room.posts?.shop && `📍 ${room.posts.shop}`}
                        {room.posts?.date && `　${fmt(room.posts.date)}`}
                      </div>
                      {lastMsg && (
                        <div className={`text-xs mt-1 truncate ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                          {lastMsg.text}
                        </div>
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