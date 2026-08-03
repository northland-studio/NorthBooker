import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Documents from '@/pages/Documents'
import Viewer from '@/pages/Viewer'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Documents />} />
        <Route path="/viewer/:id" element={<Viewer />} />
      </Route>
    </Routes>
  )
}
