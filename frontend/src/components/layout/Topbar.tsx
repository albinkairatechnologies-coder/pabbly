import { Bell } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

export default function Topbar({ title }: { title: string }) {
  const { user, workspace } = useAuthStore();

  return (
    <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <button className="text-gray-400 hover:text-gray-600 relative">
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="text-sm text-gray-700 hidden sm:block">{user?.full_name}</span>
        </div>
      </div>
    </div>
  );
}
