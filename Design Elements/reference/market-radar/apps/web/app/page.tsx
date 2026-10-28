import Image from 'next/image';

export default function Page() {
  return (
    <div className="placeholder">
      <main className="placeholder-main">
        <Image
          className="placeholder-wordmark"
          src="/brand/everyone-logotype.svg"
          alt="everyone."
          width={519}
          height={87}
          preload
        />
        <h1 className="placeholder-label">Market Radar</h1>
      </main>
      <footer className="placeholder-footer">Internal · everyone.</footer>
    </div>
  );
}
