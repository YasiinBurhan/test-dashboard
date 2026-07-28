import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Announcement } from '../types';
import {
  subscribeToAnnouncements,
  toggleAnnouncementReaction,
  addAnnouncementComment
} from '../firebase/services/announcementService';
import { subscribeToAllUsers } from '../firebase/services/userService';
import { formatWIBDate } from '../utils/format';
import { useAuth } from '../hooks/useAuth';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Megaphone,
  Pin,
  Calendar,
  RefreshCw,
  MessageSquare,
  Send,
  Smile,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const STANDARD_EMOJIS = ['👍', '🔥', '❤️', '👏', '🎉'];

export const PengumumanPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openComments, setOpenComments] = useState<{ [annId: string]: boolean }>({});
  const [commentText, setCommentText] = useState<{ [annId: string]: string }>({});
  const [usersMap, setUsersMap] = useState<{ [tgId: string]: { role: string; photoUrl?: string } }>({});

  useEffect(() => {
    setIsLoading(true);
    const unsubscribeAnn = subscribeToAnnouncements((data) => {
      setAnnouncements(data || []);
      setIsLoading(false);
    });

    const unsubscribeUsers = subscribeToAllUsers((users) => {
      const map: { [tgId: string]: { role: string; photoUrl?: string } } = {};
      users.forEach((u) => {
        if (u.telegramId) {
          map[u.telegramId] = {
            role: u.role,
            photoUrl: u.photoUrl
          };
        }
      });
      setUsersMap(map);
    });

    return () => {
      unsubscribeAnn();
      unsubscribeUsers();
    };
  }, []);

  const handleReaction = async (annId: string, emoji: string) => {
    if (!userProfile) return;
    const currentUserId = userProfile.telegramId;
    const userName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.username || 'User';
    const currentRole = usersMap[currentUserId]?.role || userProfile.role || 'Recruiter';
    const currentPhoto = usersMap[currentUserId]?.photoUrl || userProfile.photoUrl;
    
    await toggleAnnouncementReaction(
      annId,
      currentUserId,
      userName,
      currentPhoto,
      currentRole,
      emoji
    );
  };

  const handleSendComment = async (annId: string) => {
    if (!userProfile) return;
    const text = commentText[annId]?.trim();
    if (!text) return;

    const currentUserId = userProfile.telegramId;
    const userName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.username || 'User';
    const currentRole = usersMap[currentUserId]?.role || userProfile.role || 'Recruiter';
    const currentPhoto = usersMap[currentUserId]?.photoUrl || userProfile.photoUrl || '';

    await addAnnouncementComment(annId, {
      userId: currentUserId,
      userName,
      userPhotoUrl: currentPhoto,
      role: currentRole,
      content: text
    });

    setCommentText((prev) => ({ ...prev, [annId]: '' }));
  };

  const toggleCommentsSection = (annId: string) => {
    setOpenComments((prev) => ({ ...prev, [annId]: !prev[annId] }));
  };

  return (
    <div className="space-y-5">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-amber-500 animate-bounce" />
            <span>Pengumuman Rekrutmen</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Instruksi, regulasi, dan informasi penting dari manajemen.
          </p>
        </div>

        <button
          onClick={() => {}}
          disabled={isLoading}
          className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-12 text-center text-slate-600 dark:text-slate-400 text-xs">
            Memuat pengumuman...
          </div>
        ) : announcements.length === 0 ? (
          <GlassCard className="py-12 text-center text-slate-600 dark:text-slate-400 space-y-2">
            <Megaphone className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Belum Ada Pengumuman</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pengumuman dari Admin dan Owner akan muncul di sini.
            </p>
          </GlassCard>
        ) : (
          announcements.map((ann) => {
            const commentsCount = ann.comments?.length || 0;
            const commentsOpen = !!openComments[ann.id];

            return (
              <GlassCard
                key={ann.id}
                className={`p-5 space-y-3 border-slate-200 dark:border-slate-800 transition-all ${
                  ann.pinned
                    ? 'border-amber-500/40 bg-amber-50/40 dark:bg-slate-900 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20'
                    : ''
                }`}
              >
                {/* Title & Pinned Badge */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`text-base tracking-tight leading-snug ${
                    ann.author === 'Owner'
                      ? 'font-black text-rose-600 dark:text-rose-400'
                      : 'font-extrabold text-slate-950 dark:text-white'
                  }`}>
                    {ann.title}
                  </h3>
                  {ann.pinned && (
                    <span className="shrink-0 text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30 font-bold flex items-center gap-1">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                </div>

                {/* Main Content */}
                <div className={`text-xs whitespace-pre-line leading-relaxed border-t border-slate-100 dark:border-slate-800/80 pt-3 ${
                  ann.author === 'Owner'
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {ann.content}
                </div>

                {/* Author & Timestamp Footer */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/40">
                  <span className="font-semibold text-sky-500 dark:text-sky-400">Oleh: {ann.author}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatWIBDate(ann.createdAt)}
                  </span>
                </div>

                {/* Reactions Section */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/20">
                  {STANDARD_EMOJIS.map((emoji) => {
                    const reactionsForEmoji = (ann.reactionsList || []).filter((r) => r.emoji === emoji);
                    const count = reactionsForEmoji.length;
                    const hasReacted = userProfile && reactionsForEmoji.some((r) => r.userId === userProfile.telegramId);

                    // Usernames tooltip
                    const tooltipText = reactionsForEmoji.length > 0
                      ? reactionsForEmoji.map((r) => {
                          const resolvedRole = usersMap[r.userId]?.role || r.role;
                          return `${r.userName} (${resolvedRole})`;
                        }).join(', ')
                      : undefined;

                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(ann.id, emoji)}
                        title={tooltipText}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs transition-all duration-150 ${
                          hasReacted
                            ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-500/50 text-sky-600 dark:text-sky-300 font-bold scale-105'
                            : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-sm">{emoji}</span>
                        {count > 0 && <span className="font-semibold text-xs">{count}</span>}
                      </button>
                    );
                  })}

                  {/* Toggle Comments Button */}
                  <button
                    onClick={() => toggleCommentsSection(ann.id)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                    <span>Diskusi ({commentsCount})</span>
                    {commentsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Collapsible Discussion Section */}
                {commentsOpen && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/40 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <span>Diskusi Pengumuman</span>
                      <span className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full font-semibold">
                        {commentsCount} pesan
                      </span>
                    </h4>

                    {/* Comment List */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {commentsCount === 0 ? (
                        <div className="py-4 text-center text-slate-500 dark:text-slate-500 text-xs italic">
                          Belum ada komentar. Mulai diskusi di bawah ini!
                        </div>
                      ) : (
                        ann.comments?.map((comment) => (
                          <div
                            key={comment.id}
                            className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100/50 dark:border-slate-800/50"
                          >
                            {/* Profile Photo */}
                            {(() => {
                              const resolvedPhoto = usersMap[comment.userId]?.photoUrl || comment.userPhotoUrl;
                              return resolvedPhoto ? (
                                <img
                                  src={resolvedPhoto}
                                  alt="Profile"
                                  referrerPolicy="no-referrer"
                                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[11px] shrink-0 border border-indigo-500/20">
                                  {comment.userName.charAt(0).toUpperCase()}
                                </div>
                              );
                            })()}

                            {/* Comment Bubble */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                                  {comment.userName}
                                </span>
                                <StatusBadge role={(usersMap[comment.userId]?.role || comment.role) as any} size="sm" />
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 ml-auto">
                                  {formatWIBDate(comment.createdAt)}
                                </span>
                              </div>
                              {(() => {
                                const resolvedRole = usersMap[comment.userId]?.role || comment.role;
                                const isOwner = resolvedRole === 'Owner';
                                return (
                                  <p className={`text-xs leading-relaxed mt-1 break-words ${
                                    isOwner 
                                      ? 'text-rose-600 dark:text-rose-400 font-bold' 
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {comment.content}
                                  </p>
                                );
                              })()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* New Comment Input */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/20">
                      <input
                        type="text"
                        value={commentText[ann.id] || ''}
                        onChange={(e) =>
                          setCommentText((prev) => ({ ...prev, [ann.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSendComment(ann.id);
                          }
                        }}
                        placeholder="Tulis komentar/diskusi..."
                        className={`flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                          userProfile?.role === 'Owner'
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      />
                      <button
                        onClick={() => handleSendComment(ann.id)}
                        disabled={!commentText[ann.id]?.trim()}
                        className="p-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white transition-all shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
};
