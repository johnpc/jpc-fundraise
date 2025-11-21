import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LandingPage } from './pages/LandingPage'
import { CreateGoalPage } from './pages/CreateGoalPage'
import { EditGoalPage } from './pages/EditGoalPage'
import { GoalPage } from './pages/GoalPage'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<CreateGoalPage />} />
          <Route path="/goal/:goalId" element={<GoalPage />} />
          <Route
            path="/goal/:goalId/edit/:password"
            element={<EditGoalPage />}
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
