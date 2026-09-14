import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';

export function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    try {
      if (isLogin) {
        await login(data);
        toast.success('Welcome back to SPARKPOS!');
        navigate('/pos');
      } else {
        // Mock register for now
        toast.success('Registration successful. Please log in.');
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
      // For demo purposes, let's bypass auth if backend isn't reachable
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
         toast.success('Demo Mode: Bypassing auth');
         navigate('/pos');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500 shadow-lg mb-4">
           <span className="text-white font-display font-bold text-4xl leading-none">S</span>
        </div>
        <h2 className="mt-2 text-center text-3xl font-display font-bold tracking-tight text-gray-900">
          {isLogin ? 'Sign in to SPARKPOS' : 'Register your business'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isLogin ? "Enter your details to access your point of sale." : "Start your premium POS experience today."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="business_name" className="block text-sm font-medium text-gray-700">Business Name</label>
                  <div className="mt-1">
                    <input id="business_name" name="business_name" type="text" required className="block w-full appearance-none rounded-lg border border-gray-200 px-3 py-2.5 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm transition-shadow" placeholder="Spark Cafe" />
                  </div>
                </div>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                  <div className="mt-1">
                    <input id="name" name="name" type="text" required className="block w-full appearance-none rounded-lg border border-gray-200 px-3 py-2.5 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm transition-shadow" placeholder="John Doe" />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
                  <div className="mt-1">
                    <input id="email" name="email" type="email" required className="block w-full appearance-none rounded-lg border border-gray-200 px-3 py-2.5 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm transition-shadow" placeholder="john@example.com" />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username / Email</label>
              <div className="mt-1">
                <input id="username" name="username" type="text" required className="block w-full appearance-none rounded-lg border border-gray-200 px-3 py-2.5 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm transition-shadow" placeholder="admin" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1">
                <input id="password" name="password" type="password" required className="block w-full appearance-none rounded-lg border border-gray-200 px-3 py-2.5 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm transition-shadow" placeholder="••••••••" />
              </div>
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">Remember me</label>
                </div>
                <div className="text-sm">
                  <a href="#" className="font-medium text-brand-600 hover:text-brand-500 transition-colors">Forgot your password?</a>
                </div>
              </div>
            )}

            <div>
              <button type="submit" disabled={isLoading} className="flex w-full justify-center rounded-lg border border-transparent bg-brand-600 py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors disabled:opacity-70">
                {isLoading ? 'Processing...' : (isLogin ? 'Sign in' : 'Register')}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors"
              >
                {isLogin ? 'Create a new business account' : 'Sign in to existing account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
