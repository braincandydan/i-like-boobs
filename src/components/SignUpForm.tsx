import { useState } from 'react';
import { signUp } from '../stores/auth';

export default function SignUpForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    username: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    const result = await signUp(formData.email, formData.password, {
      full_name: formData.fullName,
      username: formData.username
    });
    
    if (result.success) {
      // Check if email confirmation warning
      if (result.warning) {
        // Email confirmation required - show as info message
        setError(''); // Clear any error
        alert(result.warning);
        // Redirect to signin page so they can confirm email
        window.location.href = '/auth/signin';
      } else {
        // Account created and confirmed - redirect to home
        alert('Account created successfully! You are now signed in.');
        window.location.href = '/';
      }
    } else {
      setError(result.error || 'Sign up failed');
    }
    
    setIsLoading(false);
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-600 text-white p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
            placeholder="Email address"
            value={formData.email}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="fullName" className="sr-only">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
            placeholder="Full Name"
            value={formData.fullName}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="username" className="sr-only">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
            placeholder="Username (optional)"
            value={formData.username}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
            placeholder="Password (minimum 6 characters)"
            value={formData.password}
            onChange={handleChange}
          />
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="sr-only">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            'Create Account'
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-400">
          By signing up, you agree to our{' '}
          <a href="/terms" className="font-medium text-red-600 hover:text-red-500">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="font-medium text-red-600 hover:text-red-500">
            Privacy Policy
          </a>
        </p>
      </div>
    </form>
  );
}
