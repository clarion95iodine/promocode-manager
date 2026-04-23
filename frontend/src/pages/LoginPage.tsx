import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Container, TextField, Typography } from '@mui/material';
import { api } from '../api/client';
import { useAuth } from '../state/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => {
    const emailError = email.trim() === '' ? 'Email is required' : /\S+@\S+\.\S+/.test(email) ? null : 'Enter a valid email';
    const passwordError = password.length === 0 ? 'Password is required' : password.length < 8 ? 'Password must be at least 8 characters' : null;
    return { emailError, passwordError, isValid: !emailError && !passwordError };
  }, [email, password]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validation.isValid) {
      setError('Please fix the highlighted fields');
      return;
    }

    setError(null);
    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError('Login failed');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
        <Typography variant="h4">Login</Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={Boolean(validation.emailError)}
          helperText={validation.emailError ?? ' '}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={Boolean(validation.passwordError)}
          helperText={validation.passwordError ?? ' '}
        />
        <Button type="submit" variant="contained" disabled={!validation.isValid}>Sign in</Button>
        <Link to="/register">Create account</Link>
      </Box>
    </Container>
  );
}
