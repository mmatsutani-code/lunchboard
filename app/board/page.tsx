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
  slots: number
  comment: string
  user_id: string
  profiles: { name: string; nickname: string; department: string; avatar_url: string }
  applications: Application[]
}

const FILTERS = ['すべて', '今日', '今週', '募集中']

export default function BoardPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [filter, setFilter] = useState('すべて')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
    })
    loadPosts()
  }, [])

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

  const displayName = (p: { name: string; nickname: string }) => p?.nickname || p?.name || '?'
  const displayAvatar = (p: { name: string; nickname: string; avatar_url: string }) => {
    if (p?.avatar_url) return <img src={p.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
    return <span>{(p?.nickname || p?.name)?.[0] || '?'}</span>
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const mondayStr = monday.toISOString().slice(0, 10)
  const sundayStr = sunday.toISOString().slice(0, 10)

  const filteredPosts = posts.filter(post => {
    if (filter === '今日') return post.date === todayStr
    if (filter === '今週') return post.date >= mondayStr && post.date <= sundayStr
    if (filter === '募集中') {
      const approved = post.applications.filter(a => a.status === 'approved').length
      return approved < post.slots - 1
    }
    return true
  })

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">L</div>
            <div>
              <div className="font-semibold text-lg">LunchBoard</div>
              <div className="text-xs text-gray-400">社内ランチ募集掲示板</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/messages')}
              className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-100">💬</button>
            <button onClick={() => router.push('/profile')}
              className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-100">👤</button>
            <button onClick={() => router.push('/board/new')}
              className="bg-green-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-600">＋ 募集する</button>
          </div>
        </div>

        <div className="flex gap-2 mb-4 border-b border-gray-200">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${filter === f ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredPosts.length === 0 && (
            <div className="text-center py-12 text-gray-400">該当する募集がありません</div>
          )}
          {filteredPosts.map(post => {
            const isMine = post.user_id === userId
            const myApp = post.applications.find(a => a.user_id === userId)
            const approvedCount = post.applications.filter(a => a.status === 'approved').length
            const pendingApps = post.applications.filter(a => a.status === 'pending')
            const isExpanded = expandedPost === post.id

            return (
              <div key={post.id} className={`bg-white rounded-2xl shadow-sm border ${isMine ? 'border-l-4 border-l-green-500' : 'border-gray-100'}`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm flex-shrink-0 overflow-hidden">
                      {displayAvatar(post.profiles)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{displayName(post.profiles)}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{post.profiles?.department}</span>
                        {isMine && <span className="text-xs text-green-600 font-medium">自分の募集</span>}
                      </div>
                      <div className="font-semibold">{fmt(post.date)}　{post.time}〜</div>
                      <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                        📍
                        {post.shop_url ? (
                          <a href={post.shop_url} target="_blank" rel="noopener noreferrer"
                            className="text-green-600 underline hover:text-green-700">{post.shop}</a>
                        ) : (
                          <span>{post.shop}</span>
                        )}
                      </div>
                      {post.comment && <div className="text-sm text-gray-500 mt-2">{post.comment}</div>}
                    </div>
                    {isMine && (
                      <button onClick={() => deletePost(post.id)}
                        className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">🗑</button>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <button onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
                      👥 応募者 {post.applications.length}人{isMine && pendingApps.length > 0 && `（承認待ち ${pendingApps.length}人）`} {isExpanded ? '▲' : '▼'}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${approvedCount >= post.slots-1 ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600'}`}>
                        {approvedCount >= post.slots-1 ? '満員' : `残り${post.slots-1-approvedCount}人`}
                      </span>
                      {!isMine && !myApp && approvedCount < post.slots-1 && (
                        <button onClick={() => apply(post.id)}
                          className="text-xs bg-green-500 text-white rounded-lg px-3 py-1.5 hover:bg-green-600">応募する</button>
                      )}
                      {!isMine && myApp?.status === 'pending' && <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">承認待ち</span>}
                      {!isMine && myApp?.status === 'approved' && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">✅ 承認済み</span>}
                      {!isMine && myApp?.status === 'rejected' && <span className="text-xs text-red-400 bg-red-50 px-2 py-1 rounded-full">見送り</span>}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 pb-4">
                    {post.applications.length === 0 ? (
                      <div className="text-xs text-gray-400 py-3 text-center">まだ応募がありません</div>
                    ) : (
                      <div className="space-y-2 pt-3">
                        {post.applications.map(app => (
                          <div key={app.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-semibold overflow-hidden">
                                {displayAvatar(app.profiles)}
                              </div>
                              <div>
                                <div className="text-sm font-medium">{displayName(app.profiles)}</div>
                                <div className="text-xs text-gray-400">{app.profiles?.department}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {app.status === 'pending' && isMine && (
                                <>
                                  <button onClick={() => approve(app.id, post.id, app.user_id)}
                                    className="text-xs bg-green-500 text-white rounded-lg px-3 py-1.5 hover:bg-green-600">承認</button>
                                  <button onClick={() => reject(app.id)}
                                    className="text-xs border rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100">見送り</button>
                                </>
                              )}
                              {app.status === 'approved' && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">✅ 承認済み</span>}
                              {app.status === 'rejected' && <span className="text-xs text-red-400 bg-red-50 px-2 py-1 rounded-full">見送り</span>}
                              {app.status === 'pending' && !isMine && <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">承認待ち</span>}
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