import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold text-white tracking-tight hover:text-indigo-400 transition">
        lu-diverse
      </Link>
      <div className="flex items-center gap-4">
        {isLoggedIn ? (
          <>
            <span className="text-gray-400 text-sm">{user?.username}</span>
            <Link
              to="/my-games"
              className="text-gray-300 hover:text-white text-sm transition"
            >
              내 게임
            </Link>
            <Link
              to="/wishlist"
              className="text-gray-300 hover:text-white text-sm transition"
            >
              찜 목록
            </Link>
            <Link
              to="/upload"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-1.5 rounded-lg transition"
            >
              업로드
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm transition"
            >
              로그아웃
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-1.5 rounded-lg transition"
          >
            로그인
          </Link>
        )}
      </div>
    </nav>
  );
}
