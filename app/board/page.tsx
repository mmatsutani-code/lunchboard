'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Application = {
  id: string
  user_id: string
  status: string
  profiles: { name: string; nickname: string; department: string; avatar_url: string }
}

type Post = {
  id: string
  date: string
  time: string
  shop: string
  shop_url: string
  genre: string
  slots: number
  comment: string
  user_id: string
  profiles: { name: string; nickname: string; department: string; avatar_url: string }
  applications: Application[]
}

const FILTERS = ['すべて', '今日', '今週', '募集中']

const GENRE_COLORS: Record<string, string> = {
  '和食': 'bg-red-100 text-red-600',
  'イタリアン': 'bg-green-100 text-green-600',
  'フレンチ': 'bg-blue-100 text-blue-600',
  '中華': 'bg-yellow-100 text-yellow-600',
  'タイ料理': 'bg-orange-100 text-orange-600',
  'ベトナム料理': 'bg-lime-100 text-lime-600',
  'カレー': 'bg-amber-100 text-amber-600',
  '中東料理': 'bg-purple-100 text-purple-600',
  'お茶・カフェ': 'bg-pink-100 text-pink-600',
  'その他': 'bg-gray-100 text-gray-600',
}

export default function BoardPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [filter, setFilter] = useState('すべて')
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      loadUnreadCount(data.user.id)
    })
    loadPosts()

    const channel = supabase
      .channel('new-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) loadUnreadCount(data.user.id)
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadUnreadCount(uid: string) {
    const { data: memberOf } = await supabase.from('room_members').select('room_id').eq('user_id', uid)
    const roomIds = memberOf?.map(m => m.room_id) || []
    if (roomIds.length === 0) return
    const { data: reads } = await supabase.from('message_reads').select('room_id, last_read_at').eq('user_id', uid)
    let unread = 0
    for (const roomId of roomIds) {
      const read = reads?.find(r => r.room_id === roomId)
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('room_id', roomId).neq('user_id', uid).gt('created_at', read?.last_read_at || '2000-01-01')
      unread += count || 0
    }
    setUnreadCount(unread)
  }

  async function loadPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(name, nickname, department, avatar_url), applications(id, user_id, status, profiles(name, nickname, department, avatar_url))')
      .order('date', { ascending: true })
    setPosts(data || [])
    setLoading(false)
  }

  async function apply(postId: string) {
    await supabase.from('applications').insert({ post_id: postId, user_id: userId, status: 'pending' })
    loadPosts()
  }

  async function deletePost(postId: string) {
    if (!confirm('この募集を削除しますか？')) return
    await supabase.from('posts').delete().eq('id', postId)
    loadPosts()
  }

  async function approve(applicationId: string, postId: string, applicantId: string) {
    await supabase.from('applications').update({ status: 'approved' }).eq('id', applicationId)
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const { data: existingRoom } = await supabase.from('rooms').select('id').eq('post_id', postId).single()
    let roomId = existingRoom?.id
    if (!roomId) {
      const { data: room } = await supabase.from('rooms').insert({ post_id: postId }).select().single()
      if (!room) return
      roomId = room.id
      await supabase.from('room_members').insert({ room_id: roomId, user_id: userId })
    }
    const { data: existingMember } = await supabase.from('room_members').select('user_id').eq('room_id', roomId).eq('user_id', applicantId).single()
    if (!existingMember) {
      await supabase.from('room_members').insert({ room_id: roomId, user_id: applicantId })
    }
    await supabase.from('messages').insert({
      room_id: roomId, user_id: userId,
      text: `✅ マッチング成立！${post.shop}でのランチが決まりました。詳細を相談しましょう！`
    })
    loadPosts()
    router.push(`/messages/${roomId}`)
  }

  async function reject(applicationId: string) {
    await supabase.from('applications').update({ status: 'rejected' }).eq('id', applicationId)
    loadPosts()
  }

  const fmt = (d: string) => {
    const t = new Date(d)
    return `${t.getMonth()+1}月${t.getDate()}日（${'日月火水木金土'[t.getDay()]}）`
  }

  const displayName = (p: any) => p?.nickname || p?.name || '?'
  const displayAvatar = (p: any) => {
    if (p?.avatar_url) return <img src={p.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
    return <span className="text-lg">{(p?.nickname || p?.name)?.[0] || '?'}</span>
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const dow = now.getDay()
  const monday = new Date(now); monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const mondayStr = monday.toISOString().slice(0, 10)
  const sundayStr = sunday.toISOString().slice(0, 10)

  const filteredPosts = posts.filter(post => {
    if (filter === '今日') return post.date === todayStr
    if (filter === '今週') return post.date >= mondayStr && post.date <= sundayStr
    if (filter === '募集中') return post.applications.filter(a => a.status === 'approved').length < post.slots - 1
    return true
  })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-100">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-bounce">🍜</div>
        <p className="text-pink-500 font-medium">読み込み中...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-pink-400 to-rose-400 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-md">
                <span className="text-pink-500 font-black text-xs">IL6</span>
              </div>
              <div>
                <div className="font-black text-white text-lg tracking-wide">IL6 Lunch LOVE</div>
                <div className="text-pink-100 text-xs">社内ランチマッチング 🍱</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push('/messages')}
                className="relative bg-white/20 backdrop-blur rounded-xl px-3 py-2 text-white hover:bg-white/30 transition-all flex flex-col items-center gap-0.5">
                <span>💬</span>
                <span className="text-[10px] font-semibold leading-none">トーク</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold pulse-dot">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button onClick={() => router.push('/calendar')}
                className="bg-white/20 backdrop-blur rounded-xl px-3 py-2 text-white hover:bg-white/30 transition-all flex flex-col items-center gap-0.5">
                <span>📅</span>
                <span className="text-[10px] font-semibold leading-none">予定</span>
              </button>
              <button onClick={() => router.push('/users')}
                className="bg-white/20 backdrop-blur rounded-xl px-3 py-2 text-white hover:bg-white/30 transition-all flex flex-col items-center gap-0.5">
                <span>👥</span>
                <span className="text-[10px] font-semibold leading-none">メンバー</span>
              </button>
              <button onClick={() => router.push('/profile')}
                className="bg-white/20 backdrop-blur rounded-xl px-3 py-2 text-white hover:bg-white/30 transition-all flex flex-col items-center gap-0.5">
                <span>👤</span>
                <span className="text-[10px] font-semibold leading-none">マイページ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* 募集するボタン */}
        <button onClick={() => router.push('/board/new')}
          className="w-full bg-gradient-to-r from-pink-400 to-rose-500 text-white rounded-2xl py-4 font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all mb-5 flex items-center justify-center gap-2">
          <span className="text-2xl">🍽️</span>
          ランチ募集を立てる！
        </button>

        {/* フィルター */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${filter === f
                ? 'bg-pink-500 text-white shadow-md transform scale-105'
                : 'bg-white text-gray-500 shadow hover:shadow-md'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* カード一覧 */}
        <div className="space-y-4">
          {filteredPosts.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🍱</div>
              <p className="text-gray-400 font-medium">まだ募集がありません</p>
              <p className="text-gray-300 text-sm mt-1">最初の募集を立ててみよう！</p>
            </div>
          )}
          {filteredPosts.map(post => {
            const isMine = post.user_id === userId
            const myApp = post.applications.find(a => a.user_id === userId)
            const approvedCount = post.applications.filter(a => a.status === 'approved').length
            const pendingApps = post.applications.filter(a => a.status === 'pending')
            const isExpanded = expandedPost === post.id
            const isFull = approvedCount >= post.slots - 1
            const genreColor = GENRE_COLORS[post.genre] || 'bg-gray-100 text-gray-600'

            return (
              <div key={post.id} className={`bg-white rounded-3xl shadow-md overflow-hidden animate-fade-in ${isMine ? 'ring-2 ring-pink-400' : ''}`}>
                {isMine && (
                  <div className="bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-1.5">
                    <span className="text-white text-xs font-bold">✨ 自分の募集</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center font-bold text-pink-600 flex-shrink-0 overflow-hidden shadow-sm">
                      {displayAvatar(post.profiles)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-gray-800">{displayName(post.profiles)}</span>
                        {post.genre && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${genreColor}`}>
                            {post.genre}
                          </span>
                        )}
                      </div>
                      <div className="font-black text-gray-900 text-lg leading-tight">{fmt(post.date)}</div>
                      <div className="text-pink-500 font-semibold text-sm">🕐 {post.time}〜</div>
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        📍
                        {post.shop_url ? (
                          <a href={post.shop_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 underline hover:text-blue-700 font-medium">{post.shop}</a>
                        ) : (
                          <span className="font-medium">{post.shop}</span>
                        )}
                      </div>
                      {post.comment && (
                        <div className="mt-2 bg-pink-50 rounded-xl px-3 py-2 text-sm text-gray-600 italic">
                          💬 {post.comment}
                        </div>
                      )}
                    </div>
                    {isMine && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => router.push(`/board/edit/${post.id}`)}
                          className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center hover:bg-blue-100 transition-colors">✏️</button>
                        <button onClick={() => deletePost(post.id)}
                          className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors">🗑️</button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-medium">
                      👥 {post.applications.length}人が応募
                      {isMine && pendingApps.length > 0 && (
                        <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-xs font-bold ml-1">
                          承認待ち {pendingApps.length}
                        </span>
                      )}
                      <span className="ml-1">{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${isFull ? 'bg-gray-100 text-gray-400' : 'bg-pink-100 text-pink-600'}`}>
                        {isFull ? '😢 満員' : `残り${post.slots-1-approvedCount}席`}
                      </span>
                      {!isMine && !myApp && !isFull && (
                        <button onClick={() => apply(post.id)}
                          className="bg-gradient-to-r from-pink-400 to-rose-500 text-white text-xs px-4 py-1.5 rounded-full font-bold shadow hover:shadow-md transform hover:-translate-y-0.5 transition-all">
                          参加する！
                        </button>
                      )}
                      {!isMine && myApp?.status === 'pending' && <span className="text-xs text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full font-bold">⏳ 承認待ち</span>}
                      {!isMine && myApp?.status === 'approved' && <span className="text-xs text-pink-600 bg-pink-50 px-3 py-1 rounded-full font-bold">✅ 参加確定</span>}
                      {!isMine && myApp?.status === 'rejected' && <span className="text-xs text-red-400 bg-red-50 px-3 py-1 rounded-full font-bold">見送り</span>}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-pink-50 px-4 pb-4 pt-3">
                    {post.applications.length === 0 ? (
                      <div className="text-xs text-gray-400 py-2 text-center">まだ応募がありません 🙏</div>
                    ) : (
                      <div className="space-y-2">
                        {post.applications.map(app => (
                          <div key={app.id} className="flex items-center justify-between bg-white rounded-2xl px-3 py-2 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center text-pink-600 text-xs font-bold overflow-hidden">
                                {displayAvatar(app.profiles)}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-gray-800">{displayName(app.profiles)}</div>
                                <div className="text-xs text-gray-400">{app.profiles?.department}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {app.status === 'pending' && isMine && (
                                <>
                                  <button onClick={() => approve(app.id, post.id, app.user_id)}
                                    className="text-xs bg-gradient-to-r from-pink-400 to-rose-500 text-white rounded-full px-3 py-1.5 font-bold shadow hover:shadow-md transition-all">承認 ✓</button>
                                  <button onClick={() => reject(app.id)}
                                    className="text-xs bg-gray-100 text-gray-500 rounded-full px-3 py-1.5 font-bold hover:bg-gray-200 transition-all">見送り</button>
                                </>
                              )}
                              {app.status === 'approved' && <span className="text-xs text-pink-600 bg-pink-50 px-3 py-1 rounded-full font-bold">✅ 参加確定</span>}
                              {app.status === 'rejected' && <span className="text-xs text-red-400 bg-red-50 px-3 py-1 rounded-full font-bold">見送り</span>}
                              {app.status === 'pending' && !isMine && <span className="text-xs text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full font-bold">⏳ 承認待ち</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}