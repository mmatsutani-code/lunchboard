'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Availability = {
  id: string
  user_id: string
  date: string
  profiles: { name: string; nickname: string; avatar_url: string }
}

type Photo = {
  id: string
  photo_url: string
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

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [myDates, setMyDates] = useState<string[]>([])
  const [allAvailability, setAllAvailability] = useState<Availability[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(uid: string) {
    const { data } = await supabase
      .from('availability')
      .select('*, profiles(name, nickname, avatar_url)')
    setAllAvailability(data || [])
    setMyDates((data || []).filter((a: Availability) => a.user_id === uid).map((a: Availability) => a.date))
    setLoading(false)
  }

  async function toggleDate(dateStr: string) {
    if (!userId) return
    if (myDates.includes(dateStr)) {
      await supabase.from('availability').delete().eq('user_id', userId).eq('date', dateStr)
      setMyDates(prev => prev.filter(d => d !== dateStr))
      setAllAvailability(prev => prev.filter(a => !(a.user_id === userId && a.date === dateStr)))
    } else {
      const { data } = await supabase.from('availability').insert({ user_id: userId, date: dateStr }).select('*, profiles(name, nickname, avatar_url)').single()
      setMyDates(prev => [...prev, dateStr])
      if (data) setAllAvailability(prev => [...prev, data])
    }
  }

  async function openUserProfile(targetUserId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', targetUserId).single()
    if (!data) return
    const { data: photos } = await supabase.from('profile_photos').select('*').eq('user_id', targetUserId).order('order_index', { ascending: true })
    setSelectedUser({ ...data, photos: photos || [] })
    setCurrentPhotoIndex(0)
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

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return { firstDay, daysInMonth, year, month }
  }

  const { firstDay, daysInMonth, year, month } = getDaysInMonth(currentMonth)
  const todayStr = new Date().toISOString().slice(0, 10)

  const dateStr = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const getUsersForDate = (ds: string) => allAvailability.filter(a => a.date === ds)
  const displayName = (p: any) => p?.nickname || p?.name || '?'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-100">
      <div className="text-4xl animate-bounce">📅</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      <div className="bg-gradient-to-r from-pink-400 to-rose-400 shadow-lg px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/board')} className="text-white/80 hover:text-white text-xl">‹</button>
          <h1 className="font-black text-white text-lg">ランチカレンダー 📅</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="bg-white rounded-3xl shadow-md p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              className="w-9 h-9 bg-pink-50 hover:bg-pink-100 rounded-full flex items-center justify-center text-pink-500 font-bold transition-colors">‹</button>
            <span className="font-black text-gray-800 text-lg">{year}年{month + 1}月</span>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              className="w-9 h-9 bg-pink-50 hover:bg-pink-100 rounded-full flex items-center justify-center text-pink-500 font-bold transition-colors">›</button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
              <div key={d} className={`text-center text-xs font-bold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay === 0 ? 0 : firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const ds = dateStr(day)
              const isToday = ds === todayStr
              const isMyDate = myDates.includes(ds)
              const usersForDate = getUsersForDate(ds)
              const otherUsers = usersForDate.filter(a => a.user_id !== userId)
              const isPast = ds < todayStr
              const dayOfWeek = new Date(ds).getDay()

              return (
                <button key={day} onClick={() => !isPast && toggleDate(ds)} disabled={isPast}
                  className={`relative p-1 rounded-2xl min-h-14 flex flex-col items-center transition-all ${isPast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-pink-50'} ${isMyDate ? 'bg-pink-50 border-2 border-pink-300' : 'border-2 border-transparent'} ${isToday ? 'ring-2 ring-pink-400' : ''}`}>
                  <span className={`text-xs font-bold mb-0.5 ${dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-700'}`}>
                    {day}
                  </span>
                  {isMyDate && <span className="text-xs text-pink-500 font-bold">✓</span>}
                  {otherUsers.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                      {otherUsers.slice(0, 3).map((u, idx) => (
                        <div key={idx} className="w-4 h-4 rounded-full bg-pink-200 flex items-center justify-center text-pink-700 overflow-hidden"
                          style={{ fontSize: '8px' }}>
                          {u.profiles?.avatar_url
                            ? <img src={u.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            : displayName(u.profiles)[0]
                          }
                        </div>
                      ))}
                      {otherUsers.length > 3 && <span style={{ fontSize: '8px' }} className="text-gray-400">+{otherUsers.length - 3}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* みんなの空き日程 */}
        <div className="bg-white rounded-3xl shadow-md p-4">
          <h2 className="font-bold text-gray-700 mb-3">👥 みんなの空き日程</h2>
          {allAvailability.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">まだ登録がありません</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(
                allAvailability.reduce((acc: any, a) => {
                  if (!acc[a.date]) acc[a.date] = []
                  acc[a.date].push(a)
                  return acc
                }, {})
              ).sort(([a], [b]) => a.localeCompare(b)).map(([date, users]: [string, any]) => {
                const t = new Date(date)
                const fmt = `${t.getMonth()+1}月${t.getDate()}日（${'日月火水木金土'[t.getDay()]}）`
                return (
                  <div key={date} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600 w-32 flex-shrink-0 font-medium">{fmt}</span>
                    <div className="flex gap-1 flex-wrap">
                      {users.map((u: any, i: number) => (
                        <button key={i}
                          onClick={() => u.user_id !== userId && openUserProfile(u.user_id)}
                          className={`text-xs px-2 py-1 rounded-full font-semibold transition-all ${u.user_id === userId
                            ? 'bg-pink-100 text-pink-600 cursor-default'
                            : 'bg-gray-100 text-gray-600 hover:bg-pink-100 hover:text-pink-600 cursor-pointer'}`}>
                          {displayName(u.profiles)}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">日付をタップして空き日程を登録・解除できます</p>
      </div>

      {/* ユーザー詳細モーダル */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4"
          onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>
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
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center">‹</button>
                        <button onClick={() => setCurrentPhotoIndex(i => Math.min(allPhotos.length - 1, i + 1))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center">›</button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                          {allPhotos.map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentPhotoIndex ? 'bg-white scale-125' : 'bg-white/50'}`} />
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
                className="absolute top-3 right-3 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center">✕</button>
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
                <button onClick={() => inviteToLunch(selectedUser.id)}
                  className="bg-gradient-to-r from-pink-400 to-rose-500 text-white px-4 py-2 rounded-2xl font-bold shadow-md text-sm">
                  🍜 誘う
                </button>
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