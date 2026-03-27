import { Bell, Search } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

export default function Topbar({ title }: { title: string }) {
  const { user } = useAuthStore();

  return (
    <div className="h-14 border-b border-gray-100 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-10">
      <h1 className="font-semibold text-gray-900 text-[15px]">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 w-52">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input
            placeholder="Search..."
            className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full"
          />
        </div>

        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-green-500 rounded-full ring-2 ring-white" />
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2.5 pl-1 border-l border-gray-100">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-gray-800 leading-none">{user?.full_name}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Admin</p>
          </div>
        </div>
      </div>
    </div>
  );
}
