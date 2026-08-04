import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@martechos/ui';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@martechos/ui';
import { Alert, AlertTitle, AlertDescription } from '@martechos/ui';
import { Input } from '@martechos/ui';
import { AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '../Providers/AuthContext';
import { apiClient } from '../../lib/api-client';

export function Login() {
  const { t } = useTranslation('common');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { login } = useAuth();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (isProcessing) return;
    
    setError(null);
    setIsProcessing(true);

    try {
      const response = await apiClient.post<{ token: string; user_id: string; workspace_id: string }>(
        '/v1/auth/login',
        {
          username,
          password,
        }
      );

      if (response.token) {
        login(response.token);
      } else {
        throw new Error('No token received from server');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = err instanceof Error ? err.message : t('login.failedLogin');
      setError(errorMsg);
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('login.title')}</CardTitle>
          <CardDescription>
            {t('login.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('login.errorTitle')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                  {t('login.username')}
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('login.usernamePlaceholder')}
                  required
                  disabled={isProcessing}
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  {t('login.password')}
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  required
                  disabled={isProcessing}
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                variant="default"
                icon={<LogIn size={16} />}
                disabled={isProcessing}
                loading={isProcessing}
              >
                {isProcessing ? t('login.signingIn') : t('login.signIn')}
              </Button>
            </div>
            <p className="text-sm text-center mt-4 text-mutedForeground">
              {t('login.noAccount')}{' '}
              <Link to="/signup/role" className="font-medium text-[#5e6ad2] hover:underline">
                {t('login.signUp')}
              </Link>
            </p>
            <div className="text-xs text-mutedForeground mt-4">
              <p className="font-medium mb-1">{t('login.devModeTitle')}</p>
              <p>{t('login.devModeDescription')}</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
