import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Container, TextField, Typography } from '@mui/material';
import { api } from '../api/client';
import { useAuth } from '../state/AuthContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => {
    const emailError = email.trim() === '' ? 'Email is required' : /\S+@\S+\.\S+/.test(email) ? null : 'Enter a valid email';
    const nameError = name.trim() === '' ? 'Name is required' : name.trim().length < 2 ? 'Name must be at least 2 characters' : null;
    const phoneError = phone.trim() === '' ? 'Phone is required' : /^\+?[0-9\s()-]{7,20}$/.test(phone) ? null : 'Enter a valid phone number';
    const passwordError = password.length === 0 ? 'Password is required' : password.length < 8 ? 'Password must be at least 8 characters' : null;
    return { emailError, nameError, phoneError, passwordError, isValid: !emailError && !nameError && !phoneError && !passwordError };
  }, [email, name, phone, password]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validation.isValid) {
      setError('Please fix the highlighted fields');
      return;
    }

    setError(null);
    try {
      const response = await api.post('/auth/register', { email, name, phone, password });
      login(response.data);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch {
      setError('Registration failed');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
        <Typography variant="h4">Register</Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={Boolean(validation.emailError)}
          helperText={validation.emailError ?? ' '}
        />
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={Boolean(validation.nameError)}
          helperText={validation.nameError ?? ' '}
        />
        <TextField
          label="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={Boolean(validation.phoneError)}
          helperText={validation.phoneError ?? ' '}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={Boolean(validation.passwordError)}
          helperText={validation.passwordError ?? ' '}
        />
        <Button type="submit" variant="contained" disabled={!validation.isValid}>Create account</Button>
        <Link to="/login">Back to login</Link>
      </Box>
    </Container>
  );
}
