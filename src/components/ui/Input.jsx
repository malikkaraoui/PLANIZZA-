export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/20 ${className}`}
      {...props}
    />
  );
}
