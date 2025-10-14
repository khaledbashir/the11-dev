import Image from 'next/image';

export function SocialGardenHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-sg-green/20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container flex h-16 items-center px-4">
        <div className="flex items-center gap-3">
          <Image 
            src="/social-garden-logo.png" 
            alt="Social Garden Logo" 
            width={40} 
            height={40}
            className="h-10 w-10"
          />
          <div className="flex flex-col">
            <span className="text-lg font-bold text-sg-dark">Social Garden</span>
            <span className="text-xs text-sg-dark/70">SOW Generator</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline text-sm text-sg-dark/60 font-medium">
            Powered by AI
          </span>
          <div className="h-2 w-2 rounded-full bg-sg-green animate-pulse"></div>
        </div>
      </div>
    </header>
  );
}
