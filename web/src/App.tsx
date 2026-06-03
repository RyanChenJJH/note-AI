// 路由表：/ → 封面，/app → 两栏壳，其余重定向到封面（docs/02 §5）。
import { Navigate, Route, Routes } from 'react-router-dom';
import { Cover } from '@/pages/Cover';
import { AppShell } from '@/pages/AppShell';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Cover />} />
      <Route path="/app" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
