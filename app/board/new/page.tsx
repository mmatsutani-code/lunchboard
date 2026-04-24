'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Application = {
  id: string
  user_id: string
  status: string
  profiles: { name: string; department: string }
}

type Post = {
  id: string
  date: string
  time: string
  shop: string
  slots: number
  comment: string
  user_id: string
  profiles: { name: string; department: string }
  applications: Application[]
}

export default function BoardPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
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
      .select('*, profiles(name, department), applications(id, user_id, status, profiles(name, department))')
      .order('date', { ascending: true })
    setPosts(data || [])
    setLoading(false)
  }

  async function apply(postId: string) {
    await supabase.from('applications').insert({ post_id: postId, user_id: userId, status: 'pending' })
    loadPosts()
  }

  async function cancel(postId: string) {
    await supabase.from('applications').delete()
      .eq('post_id', postId).eq('user_id', userId)
    loadPosts()
  }

  async function approve(applicationId: string, postId: string, applicantId: string) {
    await supabase.from('applications').update({ status: 'approved' }).eq('id', applicationId)
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const { data: room } = await supabase.from('rooms').insert({ post_id: postId }).select().single()
    if (!room) return
    await supabase.from('room_members').insert([
      { room_id: room.id, user_id: userId },
      { room_id: room.id, user_id: applicantId }
    ])
    await supabase.from('messages').insert({
      room_id: room.id,
      user_id: userId,
      text: `✅ マッチング成立！${post.shop}でのランチが決まりました。詳細を相談しましょう！`
    })
    loadPosts()
    router.push(`/messages/${room.id}`)
  }

  async function reject(applicationId: string) {
    await supabase.from('applications').update({ status: 'rejected' }).eq('id', applicationId)
    loadPosts()
  }

  const fmt = (d: string) => {
    const t = new Date(d)
    return `${t.getMonth()+1}月${t.getDate()}日（${'日月火水木金土'[t.getDay()]}）`
  }

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
              className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-100">💬 メッセージ</button>
            <button onClick={() => router.push('/board/new')}
              className="bg-green-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-600">＋ 募集する</button>
          </div>
        </div>

        <div className="space-y-3">
          {posts.length === 0 && (
            <div className="text-center py-12 text-gray-400">まだ募集がありません</div>
          )}
          {posts.map(post => {
            const isMine = post.user_id === userId
            const myApp = post.applications.find(a => a.user_id === userId)
            const approvedCount = post.applications.filter(a => a.status === 'approved').length
            const pendingApps = post.applications.filter(a => a.status === 'pending')
            const isExpanded = expandedPost === post.id

            return (
              <div key={post.id} className={`bg-white rounded-2xl shadow-sm border ${isMine ? 'border-l-4 border-l-green-500' : 'border-gray-100'}`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm flex-shrink-0">
                      {post.profiles?.name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{post.profiles?.name}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{post.profiles?.department}</span>
                        {isMine && <span className="text-xs text-green-600 font-medium">自分の募集</span>}
                      </div>
                      <div className="font-semibold">{fmt(post.date)}　{post.time}〜</div>
                      <div className="text-sm text-gray-500 mt-0.5">📍 {post.shop}</div>
                      {post.comment && <div className="text-sm text-gray-500 mt-2">{post.comment}</div>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <button onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                      className="text-xs text-gray-400 hover:text-gray-600">
                      👥 応募者 {post.applications.length}人 {isMine && pendingApps.length > 0 && `（承認待ち ${pendingApps.length}人）`} {isExpanded ? '▲' : '▼'}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${approvedCount >= post.slots-1 ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600'}`}>
                        {approvedCount >= post.slots-1 ? '満員' : `残り${post.slots-1-approvedCount}人`}
                      </span>
                      {!isMine && !myApp && approvedCount < post.slots-1 && (
                        <button onClick={() => apply(post.id)}
                          className="text-xs bg-green-500 text-white rounded-lg px-3 py-1.5 hover:bg-green-600">応募する</button>
                      )}
                      {!isMine && myApp && myApp.status === 'pending' && (
                        <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">承認待ち</span>
                      )}
                      {!isMine && myApp && myApp.status === 'approved' && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">✅ 承認済み</span>
                      )}
                      {!isMine && myApp && myApp.status === 'rejected' && (
                        <span className="text-xs text-red-400 bg-red-50 px-2 py-1 rounded-full">見送り</span>
                      )}
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
                              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-semibold">
                                {app.profiles?.name?.[0]}
                              </div>
                              <div>
                                <div className="text-sm font-medium">{app.profiles?.name}</div>
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