import Image from "next/image";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[#b52324] flex items-center justify-center">
            <Image
                src="/rose_loader.png"
                alt="Loading..."
                width={100}
                height={100}
                className="animate-spin"
            />
        </div>
    );
}
