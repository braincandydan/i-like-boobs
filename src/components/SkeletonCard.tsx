export default function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="rounded-lg overflow-hidden bg-gray-800">
        <div className="w-full aspect-[2/3] bg-gray-700" />
      </div>
      <div className="mt-2 h-3 bg-gray-700 rounded w-3/4" />
      <div className="mt-1 h-3 bg-gray-700 rounded w-1/2" />
    </div>
  );
}
