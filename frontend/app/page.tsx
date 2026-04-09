"use client";
import { useRef, useState } from "react";
import { uploadClips, clearClips } from "./utils/api";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<any>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fileInputRef.current?.files) {
      const res = await uploadClips(fileInputRef.current.files);
      setResult(res);
    }
  };

  const handleClear = async () => {
    const res = await clearClips();
    setResult(res);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-200">
      <div className="w-full max-w-lg bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl p-10 border border-blue-100">
        <h1 className="text-3xl font-extrabold mb-8 text-center text-blue-700 tracking-tight drop-shadow-sm">Clip Uploader</h1>
        <form onSubmit={handleUpload} className="flex flex-col gap-6">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-base file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 border border-blue-200 rounded-xl p-3 bg-white/70 shadow-sm focus:ring-2 focus:ring-blue-400 transition"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all text-lg tracking-wide"
          >
            Upload Clips
          </button>
        </form>
        <button
          onClick={handleClear}
          className="mt-6 w-full bg-gradient-to-r from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all text-lg tracking-wide"
        >
          Clear All Clips
        </button>
        <pre className="mt-8 bg-gray-50/80 rounded-xl p-5 text-sm overflow-x-auto border border-gray-200 shadow-inner min-h-[60px]">
          {result && JSON.stringify(result, null, 2)}
        </pre>
      </div>
    </div>
  );
}