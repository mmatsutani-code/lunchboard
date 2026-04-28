'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Message = {
  id: string
  text: string
  user_id: string
  created_at: string
  profiles: { name: string; nickname: string; avatar_url: string }
}

export default function RoomPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [roomInfo, setRoomInfo] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const router = useRouter()
  const { roomId } = useParams()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      markAsRead(data.user.id)
    })
    loadMessages()
    loadRoomInfo()

    const channel = supabase
      .channel('messages-' + roomId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      }, () => {
        loadMessages()
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) markAsRead(data.user.id)
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function markAsRead(uid: string) {
    await supabase.from('message_reads').upsert({
      room_id: roomId,
      user_id: uid,
      last_read_at: new Date().toISOString()
    }, { onConflict: 'room_id,user_id' })
  }

  async function loadRoomInfo() {
    const { data } = await supabase
      .from('rooms')
      .select('*, posts(shop, date), room_members(user_id, profiles(name, nickname, avatar_url))')
      .eq('id', roomId)
      .single()
    setRoomInfo(data)
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(name, nickname, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  async function sendMessage() {
    if (!text.trim() || !userId) return
    const t = text
    setText('')
    await supabase.from('messages').insert({
      room_id: roomId,
      user_id: userId,
      text: t
    })
    await markAsRead(userId)
  }

  const fmt = (d: string) => {
    const t = new Date(d)
    return `${t.getMonth()+1}月${t.getDate()}日（${'日月火水木金土'[t.getDay()]}）`
  }

  const timeStr = (d: string) => {
    const t = new Date(d)
    return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`
  }

  const displayName = (p: any) => p?.nickname || p?.name || '?'
  const displayAvatar = (p: any) => {
    if (p?.avatar_url) return <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
    return <span>{(p?.nickname || p?.name)?.[0] || '?'}</span>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/messages')} className="text-gray-400 hover:text-gray-600">‹</button>
        <div>
          <div className="font-medium text-sm">
            {roomInfo?.room_members?.filter((m: any) => m.user_id !== userId).map((m: any) => displayName(m.profiles)).join('・')}
          </div>
          <div className="text-xs text-gray-400">
            📍 {roomInfo?.posts?.shop}　{roomInfo?.posts?.date && fmt(roomInfo.posts.date)}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700 mb-4">
          ✅ マッチング成立！集合時間や場所などここで相談してください
        </div>
        {messages.map(msg => {
          const isMe = msg.user_id === userId
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-semibold flex-shrink-0 overflow-hidden">
                  {displayAvatar(msg.profiles)}
                </div>
              )}
              <div>
                {!isMe && <div className="text-xs text-gray-400 mb-1">{displayName(msg.profiles)}</div>}
                <div className={`px-3 py-2 rounded-2xl text-sm max-w-xs ${isMe ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white border border-gray-100 rounded-bl-sm'}`}>
                  {msg.text}
                </div>
                <div className={`text-xs text-gray-300 mt-1 ${isMe ? 'text-right' : ''}`}>{timeStr(msg.created_at)}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white border-t px-4 py-3 flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          placeholder="メッセージを入力..."
          className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <button onClick={sendMessage} disabled={!text.trim()}
          className="bg-green-500 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-green-600 disabled:opacity-50">
          送信
        </button>
      </div>
    </div>
  )
}