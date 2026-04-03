type Color = "green" | "yellow" | "red" | "blue" | "gray" | "purple" | "orange" | "pink" | "indigo";
type Variant = "solid" | "outline" | "soft";

interface BadgeProps {
  label: string;
  color?: Color;
  variant?: Variant;
  dot?: boolean;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const solidColors: Record<Color, string> = {
  green: "bg-green-100 text-green-700 border-green-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  red: "bg-red-100 text-red-700 border-red-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  gray: "bg-gray-100 text-gray-700 border-gray-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  pink: "bg-pink-100 text-pink-700 border-pink-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

const outlineColors: Record<Color, string> = {
  green: "border-2 border-green-500 text-green-700 bg-white",
  yellow: "border-2 border-yellow-500 text-yellow-700 bg-white",
  red: "border-2 border-red-500 text-red-700 bg-white",
  blue: "border-2 border-blue-500 text-blue-700 bg-white",
  gray: "border-2 border-gray-500 text-gray-700 bg-white",
  purple: "border-2 border-purple-500 text-purple-700 bg-white",
  orange: "border-2 border-orange-500 text-orange-700 bg-white",
  pink: "border-2 border-pink-500 text-pink-700 bg-white",
  indigo: "border-2 border-indigo-500 text-indigo-700 bg-white",
};

const softColors: Record<Color, string> = {
  green: "bg-green-50 text-green-600 border-green-100",
  yellow: "bg-yellow-50 text-yellow-600 border-yellow-100",
  red: "bg-red-50 text-red-600 border-red-100",
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  gray: "bg-gray-50 text-gray-600 border-gray-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
  orange: "bg-orange-50 text-orange-600 border-orange-100",
  pink: "bg-pink-50 text-pink-600 border-pink-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
};

const dotColors: Record<Color, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  gray: "bg-gray-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
};

const sizes = {
  sm: "text-xs px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
  lg: "text-sm px-3 py-1.5",
};

export default function Badge({
  label,
  color = "gray",
  variant = "solid",
  dot = false,
  icon,
  size = "md",
}: BadgeProps) {
  const colorClass =
    variant === "outline"
      ? outlineColors[color]
      : variant === "soft"
      ? softColors[color]
      : solidColors[color];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border transition-all duration-200 ${
        sizes[size]
      } ${colorClass}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color]} animate-pulse`} />}
      {icon && <span className="flex items-center">{icon}</span>}
      {label}
    </span>
  );
}
