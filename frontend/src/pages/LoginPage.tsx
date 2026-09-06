import React, { useState } from 'react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/google`;
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect to Google OAuth / Dev session
    handleGoogleLogin();
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 selection:bg-[#00A859] selection:text-white">
      {/* Centered Login Card */}
      <div className="w-full max-w-[420px] bg-white border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-3xl p-8 sm:p-10">
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6 tracking-tight">
          Login
        </h1>

        {/* Google Login Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full bg-[#E8F8EE] hover:bg-[#D8F3E2] text-gray-800 font-semibold py-3 px-4 rounded-xl border border-[#CEEED8] flex items-center justify-center space-x-2.5 transition text-sm cursor-pointer"
        >
          {/* Multi-color Google G Icon */}
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Login With Google</span>
        </button>

        {/* Divider */}
        <div className="my-6 relative flex items-center justify-center">
          <div className="w-full border-t border-gray-200"></div>
          <span className="absolute px-3 bg-white text-xs text-gray-400 font-normal">
            or sign up through email
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-3.5">
          <div>
            <input
              type="text"
              placeholder="Email ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#F3F4F6] border border-transparent focus:border-[#00A859] focus:bg-white text-sm text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 outline-none transition"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#F3F4F6] border border-transparent focus:border-[#00A859] focus:bg-white text-sm text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 outline-none transition"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-[#00A859] hover:bg-[#00924D] text-white font-semibold py-3.5 rounded-xl text-sm transition shadow-sm cursor-pointer"
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
