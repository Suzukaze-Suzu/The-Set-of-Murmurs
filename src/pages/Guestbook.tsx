import { useState } from 'react';
import { useComments } from '../context/CommentContext';
import CommentSection from '../components/CommentSection';
import BugFeedback from '../components/BugFeedback';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT } from '../i18n';

export default function Guestbook() {
  const t = useT();
  usePageTitle(t('comment.guestbookTitle'));
  const { guestbook, addGuestbook, deleteComment } = useComments();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [tab, setTab] = useState<'guestbook' | 'bug'>('guestbook');

  return (
    <div className="page guestbook-page">
      <div className="guestbook-hero card">
        <h1 className="page-title">{t('comment.guestbookTitle')}</h1>
        {/* 欢迎语中间夹着站长的名字链接，所以按「前截 + 链接 + 后截」拼，
            英文语序与中文不同也不会串（见 dict 的 comment.gbPrefix/gbSuffix）。 */}
        <p>
          {t('comment.gbPrefix')}
          <a href="/">{profile.nickname}</a>
          {t('comment.gbSuffix')}
        </p>
      </div>

      <div className="guestbook-tabs">
        <button
          className={tab === 'guestbook' ? 'guestbook-tab active' : 'guestbook-tab'}
          onClick={() => setTab('guestbook')}
        >
          {t('comment.tabGuestbook')}
        </button>
        <button
          className={tab === 'bug' ? 'guestbook-tab active' : 'guestbook-tab'}
          onClick={() => setTab('bug')}
        >
          {t('comment.tabBug')}
        </button>
      </div>

      {tab === 'guestbook' ? (
        <CommentSection comments={guestbook} onAdd={(name, content, parentId, parentName, avatar) => addGuestbook({ name, content, parentId, parentName, avatar })} currentUserId={user?.id} onDelete={(cid) => deleteComment(cid, 'guestbook')} />
      ) : (
        <BugFeedback />
      )}
    </div>
  );
}
