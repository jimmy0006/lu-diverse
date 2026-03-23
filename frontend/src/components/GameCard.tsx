import { Link } from 'react-router-dom';

export interface Game {
  id: number;
  title: string;
  description: string;
  current_version: string;
  thumbnail_url: string | null;
  view_count: number;
  wishlist_count: number;
  uploader?: string;
  updated_at: string;
}

export default function GameCard({ game }: { game: Game }) {
  return (
    <Link
      to={`/game/${game.id}`}
      className="bg-gray-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition group flex flex-col"
    >
      <div className="aspect-video bg-gray-700 overflow-hidden">
        {game.thumbnail_url ? (
          <img
            src={game.thumbnail_url}
            alt={game.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-4xl">
            🎮
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <h3 className="text-white font-semibold text-base leading-tight line-clamp-1">{game.title}</h3>
        {game.uploader && (
          <p className="text-gray-500 text-xs">{game.uploader}</p>
        )}
        <p className="text-gray-400 text-sm line-clamp-2 flex-1">{game.description}</p>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>v{game.current_version}</span>
          <div className="flex gap-3">
            <span>👁 {game.view_count.toLocaleString()}</span>
            <span>🤍 {game.wishlist_count.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
