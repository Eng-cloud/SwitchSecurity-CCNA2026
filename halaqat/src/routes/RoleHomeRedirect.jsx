import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_HOME } from '../config/navigation.js';

/** /app → لوحة الدور الحالي. */
export default function RoleHomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={ROLE_HOME[role] ?? '/login'} replace />;
}
