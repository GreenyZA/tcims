'use client';

import AuthPortal from '../../components/AuthPortal';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-900">
          TCIMS
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Community Incident Management System
        </p>
        <AuthPortal />
      </div>
    </div>
  );
}
