import { useComments } from '../context/CommentContext';
import CommentSection from '../components/CommentSection';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';

export default function Guestbook() {
  const { guestbook, addGuestbook, deleteComment } = useComments();
  const { user } = useAuth();
  const { profile } = useProfile();

  return (
    <div className="page guestbook-page">
      <div className="guestbook-hero card">
        <h1 className="page-title">留言板</h1>
        <p>
          欢迎在留言板上留下你的足迹～无论是想说的话、推荐的作品，
          还是给<a href="/">{profile.nickname}</a>的悄悄话，都可以写在这里。
        </p>
      </div>

      <CommentSection comments={guestbook} onAdd={(name, content, parentId, parentName) => addGuestbook({ name, content, parentId, parentName })} currentUserId={user?.id} onDelete={(cid) => deleteComment(cid, 'guestbook')} />
    </div>
  );
}
