export default async function Home() {
  // Simulate loading delay
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return (
    <div className="min-h-screen bg-[#b52324] flex items-center justify-center flex-col gap-4">
      <h1 className="text-4xl font-bold text-white mb-4">Ikkudi: Cycle Story</h1>
      <a
        href="/game"
        className="px-6 py-3 bg-white text-[#b52324] font-bold rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
      >
        Play Game
      </a>
    </div>
  );
}
